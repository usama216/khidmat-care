"""The prepaid balance: top-ups, commission and corrections."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from khidmat_api.core.errors import ConflictError, NotFoundError
from khidmat_api.modules.audit.service import record_audit
from khidmat_api.modules.files.models import FilePurpose
from khidmat_api.modules.files.service import require_owned_file
from khidmat_api.modules.identity.models import User
from khidmat_api.modules.providers.models import Provider
from khidmat_api.modules.wallet.models import (
    TopupRequest,
    TopupStatus,
    WalletTransaction,
    WalletTransactionType,
)


async def _apply(
    session: AsyncSession,
    provider_id: UUID,
    transaction_type: WalletTransactionType,
    amount: int,
    *,
    session_id: UUID | None = None,
    topup_id: UUID | None = None,
    actor_id: UUID | None = None,
    note: str | None = None,
) -> WalletTransaction:
    # The row lock makes concurrent changes to one balance happen one at a time.
    provider = await session.get(
        Provider, provider_id, with_for_update=True, populate_existing=True
    )
    if provider is None:
        raise NotFoundError("This physiotherapist was not found.")
    provider.balance_pkr += amount
    transaction = WalletTransaction(
        provider_id=provider_id,
        type=transaction_type,
        amount_pkr=amount,
        balance_after_pkr=provider.balance_pkr,
        session_id=session_id,
        topup_id=topup_id,
        created_by_id=actor_id,
        note=note,
    )
    session.add(transaction)
    return transaction


async def charge_commission(
    session: AsyncSession, provider_id: UUID, session_id: UUID, amount: int
) -> None:
    """Called in the same transaction that completes a session. The balance may go negative."""
    if amount > 0:
        await _apply(
            session, provider_id, WalletTransactionType.COMMISSION, -amount, session_id=session_id
        )


async def request_topup(
    session: AsyncSession,
    user: User,
    provider: Provider,
    *,
    amount: int,
    method: str,
    reference: str,
    proof_file_id: UUID,
) -> TopupRequest:
    await require_owned_file(session, proof_file_id, user=user, purpose=FilePurpose.TOPUP_PROOF)
    topup = TopupRequest(
        provider_id=provider.id,
        amount_pkr=amount,
        method=method,
        reference=reference,
        proof_file_id=proof_file_id,
    )
    session.add(topup)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise ConflictError("This transaction reference was already submitted.") from exc
    return topup


async def review_topup(
    session: AsyncSession,
    topup_id: UUID,
    *,
    approve: bool,
    reason: str | None,
    actor: User,
    ip_address: str,
) -> TopupRequest:
    topup = await session.get(TopupRequest, topup_id, with_for_update=True)
    if topup is None:
        raise NotFoundError("This top-up was not found.")
    if topup.status != TopupStatus.PENDING:
        raise ConflictError("This top-up was already reviewed.")
    if not approve and not reason:
        raise ConflictError("Please give a reason.")

    topup.status = TopupStatus.APPROVED if approve else TopupStatus.REJECTED
    topup.reject_reason = None if approve else reason
    topup.reviewed_by_id = actor.id
    topup.reviewed_at = datetime.now(UTC)
    if approve:
        await _apply(
            session,
            topup.provider_id,
            WalletTransactionType.TOPUP,
            topup.amount_pkr,
            topup_id=topup.id,
            actor_id=actor.id,
        )
    record_audit(
        session,
        actor_id=actor.id,
        action="topup.approved" if approve else "topup.rejected",
        entity_type="topup_request",
        entity_id=str(topup.id),
        metadata={"amount_pkr": topup.amount_pkr},
        ip_address=ip_address,
    )
    await session.commit()
    return topup


async def adjust_balance(
    session: AsyncSession,
    provider_id: UUID,
    amount: int,
    note: str,
    *,
    actor: User,
    ip_address: str,
) -> WalletTransaction:
    transaction = await _apply(
        session,
        provider_id,
        WalletTransactionType.ADJUSTMENT,
        amount,
        actor_id=actor.id,
        note=note,
    )
    record_audit(
        session,
        actor_id=actor.id,
        action="wallet.adjusted",
        entity_type="provider",
        entity_id=str(provider_id),
        metadata={"amount_pkr": amount, "note": note},
        ip_address=ip_address,
    )
    await session.commit()
    return transaction


async def list_transactions(
    session: AsyncSession, provider_id: UUID, *, offset: int, limit: int
) -> tuple[list[WalletTransaction], int]:
    condition = WalletTransaction.provider_id == provider_id
    total = await session.scalar(
        select(func.count()).select_from(WalletTransaction).where(condition)
    )
    rows = await session.scalars(
        select(WalletTransaction)
        .where(condition)
        .order_by(WalletTransaction.created_at.desc(), WalletTransaction.id.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(rows), total or 0


async def list_topups(
    session: AsyncSession,
    *,
    provider_id: UUID | None = None,
    status: TopupStatus | None = None,
    offset: int,
    limit: int,
) -> tuple[list[TopupRequest], int]:
    filters = []
    if provider_id is not None:
        filters.append(TopupRequest.provider_id == provider_id)
    if status is not None:
        filters.append(TopupRequest.status == status)
    total = await session.scalar(select(func.count()).select_from(TopupRequest).where(*filters))
    rows = await session.scalars(
        select(TopupRequest)
        .where(*filters)
        .order_by(TopupRequest.created_at.desc(), TopupRequest.id.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(rows), total or 0


async def count_pending_topups(session: AsyncSession) -> int:
    count = await session.scalar(
        select(func.count())
        .select_from(TopupRequest)
        .where(TopupRequest.status == TopupStatus.PENDING)
    )
    return count or 0

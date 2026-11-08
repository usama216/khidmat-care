"""Wallet endpoints for physiotherapists and the finance team."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Request, status
from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from khidmat_api.core.database import SessionDep
from khidmat_api.core.pagination import Page, PageParamsDep
from khidmat_api.core.requests import client_ip
from khidmat_api.modules.catalog.settings_service import get_platform_settings
from khidmat_api.modules.identity.dependencies import (
    FinanceManagerDep,
    ProviderUserDep,
    SettingsDep,
)
from khidmat_api.modules.providers.service import require_provider_for_user
from khidmat_api.modules.wallet.models import TopupRequest, TopupStatus, WalletTransaction
from khidmat_api.modules.wallet.service import (
    adjust_balance,
    list_topups,
    list_transactions,
    request_topup,
    review_topup,
)

self_router = APIRouter(prefix="/provider/wallet", tags=["physiotherapist"])
admin_router = APIRouter(prefix="/admin/wallet", tags=["admin"])

Reason = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=500)]


class WalletSummary(BaseModel):
    balance_pkr: int
    minimum_balance_pkr: int
    can_accept_orders: bool
    topup_instructions: str


class TransactionView(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type: str
    amount_pkr: int
    balance_after_pkr: int
    note: str | None
    created_at: datetime


class TopupView(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    provider_id: UUID
    amount_pkr: int
    method: str
    reference: str
    proof_file_id: UUID
    status: TopupStatus
    reject_reason: str | None
    created_at: datetime


class TopupCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    amount_pkr: Annotated[int, Field(gt=0, le=1_000_000)]
    method: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=40)]
    reference: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=80)]
    proof_file_id: UUID


class TopupReview(BaseModel):
    model_config = ConfigDict(extra="forbid")

    approve: bool
    reason: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None = None


class BalanceAdjustment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    amount_pkr: Annotated[int, Field(ge=-1_000_000, le=1_000_000)]
    note: Reason


@self_router.get("", summary="Your balance")
async def my_wallet(user: ProviderUserDep, session: SessionDep) -> WalletSummary:
    provider = await require_provider_for_user(session, user.id)
    platform = await get_platform_settings(session)
    return WalletSummary(
        balance_pkr=provider.balance_pkr,
        minimum_balance_pkr=platform.minimum_balance_pkr,
        can_accept_orders=provider.balance_pkr >= platform.minimum_balance_pkr,
        topup_instructions=platform.topup_instructions,
    )


@self_router.get("/transactions", summary="Your balance history")
async def my_transactions(
    user: ProviderUserDep, session: SessionDep, params: PageParamsDep
) -> Page[TransactionView]:
    provider = await require_provider_for_user(session, user.id)
    rows, total = await list_transactions(
        session, provider.id, offset=params.offset, limit=params.page_size
    )
    return Page(
        items=[TransactionView.model_validate(row) for row in rows],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


@self_router.get("/topups", summary="Your top-up requests")
async def my_topups(
    user: ProviderUserDep, session: SessionDep, params: PageParamsDep
) -> Page[TopupView]:
    provider = await require_provider_for_user(session, user.id)
    rows, total = await list_topups(
        session, provider_id=provider.id, offset=params.offset, limit=params.page_size
    )
    return Page(
        items=[TopupView.model_validate(row) for row in rows],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


@self_router.post("/topups", status_code=status.HTTP_201_CREATED, summary="Request a top-up")
async def create_topup(
    payload: TopupCreate, user: ProviderUserDep, session: SessionDep
) -> TopupView:
    provider = await require_provider_for_user(session, user.id)
    topup: TopupRequest = await request_topup(
        session,
        user,
        provider,
        amount=payload.amount_pkr,
        method=payload.method,
        reference=payload.reference,
        proof_file_id=payload.proof_file_id,
    )
    return TopupView.model_validate(topup)


@admin_router.get("/topups", summary="All top-up requests")
async def all_topups(
    _: FinanceManagerDep,
    session: SessionDep,
    params: PageParamsDep,
    status: TopupStatus | None = None,
) -> Page[TopupView]:
    rows, total = await list_topups(
        session, status=status, offset=params.offset, limit=params.page_size
    )
    return Page(
        items=[TopupView.model_validate(row) for row in rows],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


@admin_router.post("/topups/{topup_id}/review", summary="Approve or reject a top-up")
async def review(
    topup_id: UUID,
    payload: TopupReview,
    actor: FinanceManagerDep,
    session: SessionDep,
    request: Request,
    settings: SettingsDep,
) -> TopupView:
    topup = await review_topup(
        session,
        topup_id,
        approve=payload.approve,
        reason=payload.reason,
        actor=actor,
        ip_address=client_ip(request, settings),
    )
    return TopupView.model_validate(topup)


@admin_router.get("/providers/{provider_id}/transactions", summary="A balance history")
async def provider_transactions(
    provider_id: UUID, _: FinanceManagerDep, session: SessionDep, params: PageParamsDep
) -> Page[TransactionView]:
    rows, total = await list_transactions(
        session, provider_id, offset=params.offset, limit=params.page_size
    )
    return Page(
        items=[TransactionView.model_validate(row) for row in rows],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


@admin_router.post("/providers/{provider_id}/adjust", summary="Correct a balance, with a note")
async def adjust(
    provider_id: UUID,
    payload: BalanceAdjustment,
    actor: FinanceManagerDep,
    session: SessionDep,
    request: Request,
    settings: SettingsDep,
) -> TransactionView:
    transaction: WalletTransaction = await adjust_balance(
        session,
        provider_id,
        payload.amount_pkr,
        payload.note,
        actor=actor,
        ip_address=client_ip(request, settings),
    )
    return TransactionView.model_validate(transaction)

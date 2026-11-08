"""The physiotherapist's prepaid balance. Commission is deducted from it after each session."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from khidmat_api.core.models import Base, CreatedAtMixin, UUIDPrimaryKeyMixin, enum_type


class WalletTransactionType(StrEnum):
    TOPUP = "TOPUP"
    COMMISSION = "COMMISSION"
    ADJUSTMENT = "ADJUSTMENT"


class TopupStatus(StrEnum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class WalletTransaction(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    """Append-only ledger. Mistakes are fixed with an adjustment, never by editing a row."""

    __tablename__ = "wallet_transactions"
    __table_args__ = (
        CheckConstraint("amount_pkr <> 0", name="amount_not_zero"),
        Index("ix_wallet_transactions_provider_id_created_at", "provider_id", "created_at"),
        # A session can only ever be charged commission once.
        Index(
            "uq_wallet_transactions_one_commission_per_session",
            "session_id",
            unique=True,
            postgresql_where=text("type = 'COMMISSION'"),
        ),
    )

    provider_id: Mapped[UUID] = mapped_column(ForeignKey("providers.id"))
    type: Mapped[WalletTransactionType] = mapped_column(enum_type(WalletTransactionType, "type"))
    amount_pkr: Mapped[int]  # Positive adds to the balance, negative deducts.
    balance_after_pkr: Mapped[int]
    session_id: Mapped[UUID | None] = mapped_column(ForeignKey("treatment_sessions.id"))
    topup_id: Mapped[UUID | None] = mapped_column(ForeignKey("topup_requests.id"), index=True)
    created_by_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    note: Mapped[str | None] = mapped_column(Text)


class TopupRequest(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "topup_requests"
    __table_args__ = (
        CheckConstraint("amount_pkr > 0", name="amount_positive"),
        Index("ix_topup_requests_status_created_at", "status", "created_at"),
    )

    provider_id: Mapped[UUID] = mapped_column(ForeignKey("providers.id"), index=True)
    amount_pkr: Mapped[int]
    method: Mapped[str] = mapped_column(String(40))
    reference: Mapped[str] = mapped_column(String(80), unique=True)
    proof_file_id: Mapped[UUID] = mapped_column(ForeignKey("file_assets.id"), unique=True)
    status: Mapped[TopupStatus] = mapped_column(
        enum_type(TopupStatus, "status"), default=TopupStatus.PENDING
    )
    reject_reason: Mapped[str | None] = mapped_column(Text)
    reviewed_by_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    reviewed_at: Mapped[datetime | None]

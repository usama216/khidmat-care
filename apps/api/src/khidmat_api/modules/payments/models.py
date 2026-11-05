"""Money collected from patients and settled with providers. All amounts are whole rupees."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column

from khidmat_api.core.models import Base, CreatedAtMixin, UUIDPrimaryKeyMixin, enum_type


class PaymentMethod(StrEnum):
    CASH = "CASH"


class SettlementDirection(StrEnum):
    PROVIDER_TO_PLATFORM = "PROVIDER_TO_PLATFORM"
    PLATFORM_TO_PROVIDER = "PLATFORM_TO_PROVIDER"


class Payment(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint("amount_pkr > 0", name="amount_positive"),
        CheckConstraint("commission_pkr >= 0", name="commission_not_negative"),
        CheckConstraint("provider_payout_pkr >= 0", name="payout_not_negative"),
        CheckConstraint("commission_pkr + provider_payout_pkr = amount_pkr", name="split_adds_up"),
    )

    booking_id: Mapped[UUID] = mapped_column(ForeignKey("bookings.id"), index=True)
    session_id: Mapped[UUID | None] = mapped_column(ForeignKey("treatment_sessions.id"), index=True)
    amount_pkr: Mapped[int]
    commission_pkr: Mapped[int]
    provider_payout_pkr: Mapped[int]
    method: Mapped[PaymentMethod] = mapped_column(
        enum_type(PaymentMethod, "method"), default=PaymentMethod.CASH
    )
    # When the provider holds the cash, the provider owes the platform its commission.
    collected_by_provider_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("providers.id"), index=True
    )
    recorded_by_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    collected_at: Mapped[datetime]
    note: Mapped[str | None] = mapped_column(Text)


class Settlement(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "settlements"
    __table_args__ = (CheckConstraint("amount_pkr > 0", name="amount_positive"),)

    provider_id: Mapped[UUID] = mapped_column(ForeignKey("providers.id"), index=True)
    direction: Mapped[SettlementDirection] = mapped_column(
        enum_type(SettlementDirection, "direction")
    )
    amount_pkr: Mapped[int]
    settled_at: Mapped[datetime]
    recorded_by_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    note: Mapped[str | None] = mapped_column(Text)

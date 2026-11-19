"""add whatsapp request alerts

Physiotherapists can turn WhatsApp alerts off. Each alert is recorded against the order it was
about, so nobody is alerted twice for the same order.

Revision ID: 0007
Revises: 0006
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TYPES = (
    "BOOKING_RECEIVED",
    "ASSIGNMENT_OFFERED",
    "PROVIDER_ASSIGNED",
    "PROVIDER_ON_THE_WAY",
    "SESSION_COMPLETED",
    "FEEDBACK_REQUEST",
    "PROVIDER_STATUS_CHANGED",
)


def _type_check(values: Sequence[str]) -> str:
    return "type IN (" + ", ".join(f"'{value}'" for value in values) + ")"


def upgrade() -> None:
    op.add_column("notifications", sa.Column("booking_id", sa.Uuid(), nullable=True))
    op.create_index("ix_notifications_booking_id", "notifications", ["booking_id"], unique=False)
    op.create_foreign_key(
        op.f("fk_notifications_booking_id_bookings"),
        "notifications",
        "bookings",
        ["booking_id"],
        ["id"],
    )
    op.drop_constraint(op.f("ck_notifications_type"), "notifications", type_="check")
    op.create_check_constraint(
        op.f("ck_notifications_type"), "notifications", _type_check((*_TYPES, "OPEN_REQUEST"))
    )
    op.add_column(
        "providers",
        sa.Column("whatsapp_alerts", sa.Boolean(), server_default=sa.text("true"), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("providers", "whatsapp_alerts")
    op.execute("DELETE FROM notifications WHERE type = 'OPEN_REQUEST'")
    op.drop_constraint(op.f("ck_notifications_type"), "notifications", type_="check")
    op.create_check_constraint(op.f("ck_notifications_type"), "notifications", _type_check(_TYPES))
    op.drop_constraint(
        op.f("fk_notifications_booking_id_bookings"), "notifications", type_="foreignkey"
    )
    op.drop_index("ix_notifications_booking_id", table_name="notifications")
    op.drop_column("notifications", "booking_id")

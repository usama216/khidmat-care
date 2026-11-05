"""add admin auth fields

Revision ID: 0003
Revises: 0002
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "contact_messages", sa.Column("handled_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.create_index(
        "uq_service_packages_one_active_per_size",
        "service_packages",
        ["service_type_id", "sessions_count"],
        unique=True,
        postgresql_where=sa.text("is_active"),
    )
    op.add_column("users", sa.Column("password_hash", sa.String(length=255), nullable=True))
    op.add_column(
        "users", sa.Column("failed_login_count", sa.Integer(), server_default="0", nullable=False)
    )
    op.add_column("users", sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "locked_until")
    op.drop_column("users", "failed_login_count")
    op.drop_column("users", "password_hash")
    op.drop_index(
        "uq_service_packages_one_active_per_size",
        table_name="service_packages",
        postgresql_where=sa.text("is_active"),
    )
    op.drop_column("contact_messages", "handled_at")

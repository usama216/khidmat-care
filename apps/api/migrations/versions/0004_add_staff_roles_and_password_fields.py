"""add staff roles and password fields

Revision ID: 0004
Revises: 0003
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint(op.f("ck_users_role"), "users", type_="check")
    op.create_check_constraint(
        op.f("ck_users_role"),
        "users",
        "role IN ('PATIENT', 'PROVIDER', 'ADMIN', 'OPERATIONS', 'VERIFICATION', 'FINANCE', 'SUPPORT')",
    )
    op.add_column(
        "users",
        sa.Column("must_change_password", sa.Boolean(), server_default="false", nullable=False),
    )
    op.add_column(
        "users", sa.Column("password_changed_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column("users", sa.Column("signup_ip_hash", sa.String(length=64), nullable=True))
    op.create_index(
        "ix_users_signup_ip_hash_created_at",
        "users",
        ["signup_ip_hash", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_constraint(op.f("ck_users_role"), "users", type_="check")
    op.create_check_constraint(
        op.f("ck_users_role"), "users", "role IN ('PATIENT', 'PROVIDER', 'ADMIN')"
    )
    op.drop_index("ix_users_signup_ip_hash_created_at", table_name="users")
    op.drop_column("users", "signup_ip_hash")
    op.drop_column("users", "password_changed_at")
    op.drop_column("users", "must_change_password")

"""add contact messages

Revision ID: 0002
Revises: 0001
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "contact_messages",
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("phone", sa.String(length=16), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("locale", sa.String(length=2), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "NEW",
                "HANDLED",
                name="status",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("ip_hash", sa.String(length=64), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_contact_messages")),
    )
    op.create_index(
        "ix_contact_messages_ip_hash_created_at",
        "contact_messages",
        ["ip_hash", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_contact_messages_status_created_at",
        "contact_messages",
        ["status", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_contact_messages_status_created_at", table_name="contact_messages")
    op.drop_index("ix_contact_messages_ip_hash_created_at", table_name="contact_messages")
    op.drop_table("contact_messages")

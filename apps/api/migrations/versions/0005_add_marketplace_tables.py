"""add marketplace tables

Revision ID: 0005
Revises: 0004
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint(op.f("ck_providers_status"), "providers", type_="check")
    op.create_check_constraint(
        op.f("ck_providers_status"),
        "providers",
        "status IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED')",
    )
    op.drop_constraint(op.f("ck_treatment_sessions_status"), "treatment_sessions", type_="check")
    op.create_check_constraint(
        op.f("ck_treatment_sessions_status"),
        "treatment_sessions",
        "status IN ('SCHEDULED', 'ON_THE_WAY', 'ARRIVED', 'COMPLETED', 'CANCELLED', 'NO_SHOW')",
    )
    op.drop_constraint(op.f("ck_session_events_status"), "session_events", type_="check")
    op.create_check_constraint(
        op.f("ck_session_events_status"),
        "session_events",
        "status IN ('SCHEDULED', 'ON_THE_WAY', 'ARRIVED', 'COMPLETED', 'CANCELLED', 'NO_SHOW')",
    )
    op.create_table(
        "topup_requests",
        sa.Column("provider_id", sa.Uuid(), nullable=False),
        sa.Column("amount_pkr", sa.Integer(), nullable=False),
        sa.Column("method", sa.String(length=40), nullable=False),
        sa.Column("reference", sa.String(length=80), nullable=False),
        sa.Column("proof_file_id", sa.Uuid(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING",
                "APPROVED",
                "REJECTED",
                name="status",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("reject_reason", sa.Text(), nullable=True),
        sa.Column("reviewed_by_id", sa.Uuid(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("amount_pkr > 0", name=op.f("ck_topup_requests_amount_positive")),
        sa.ForeignKeyConstraint(
            ["proof_file_id"],
            ["file_assets.id"],
            name=op.f("fk_topup_requests_proof_file_id_file_assets"),
        ),
        sa.ForeignKeyConstraint(
            ["provider_id"], ["providers.id"], name=op.f("fk_topup_requests_provider_id_providers")
        ),
        sa.ForeignKeyConstraint(
            ["reviewed_by_id"], ["users.id"], name=op.f("fk_topup_requests_reviewed_by_id_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_topup_requests")),
        sa.UniqueConstraint("proof_file_id", name=op.f("uq_topup_requests_proof_file_id")),
        sa.UniqueConstraint("reference", name=op.f("uq_topup_requests_reference")),
    )
    op.create_index(
        op.f("ix_topup_requests_provider_id"), "topup_requests", ["provider_id"], unique=False
    )
    op.create_index(
        op.f("ix_topup_requests_reviewed_by_id"), "topup_requests", ["reviewed_by_id"], unique=False
    )
    op.create_index(
        "ix_topup_requests_status_created_at",
        "topup_requests",
        ["status", "created_at"],
        unique=False,
    )
    op.create_table(
        "wallet_transactions",
        sa.Column("provider_id", sa.Uuid(), nullable=False),
        sa.Column(
            "type",
            sa.Enum(
                "TOPUP",
                "COMMISSION",
                "ADJUSTMENT",
                name="type",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("amount_pkr", sa.Integer(), nullable=False),
        sa.Column("balance_after_pkr", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=True),
        sa.Column("topup_id", sa.Uuid(), nullable=True),
        sa.Column("created_by_id", sa.Uuid(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("amount_pkr <> 0", name=op.f("ck_wallet_transactions_amount_not_zero")),
        sa.ForeignKeyConstraint(
            ["created_by_id"], ["users.id"], name=op.f("fk_wallet_transactions_created_by_id_users")
        ),
        sa.ForeignKeyConstraint(
            ["provider_id"],
            ["providers.id"],
            name=op.f("fk_wallet_transactions_provider_id_providers"),
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["treatment_sessions.id"],
            name=op.f("fk_wallet_transactions_session_id_treatment_sessions"),
        ),
        sa.ForeignKeyConstraint(
            ["topup_id"],
            ["topup_requests.id"],
            name=op.f("fk_wallet_transactions_topup_id_topup_requests"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_wallet_transactions")),
    )
    op.create_index(
        op.f("ix_wallet_transactions_created_by_id"),
        "wallet_transactions",
        ["created_by_id"],
        unique=False,
    )
    op.create_index(
        "ix_wallet_transactions_provider_id_created_at",
        "wallet_transactions",
        ["provider_id", "created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_wallet_transactions_topup_id"), "wallet_transactions", ["topup_id"], unique=False
    )
    op.create_index(
        "uq_wallet_transactions_one_commission_per_session",
        "wallet_transactions",
        ["session_id"],
        unique=True,
        postgresql_where=sa.text("type = 'COMMISSION'"),
    )
    op.alter_column(
        "bookings", "lat", existing_type=sa.DOUBLE_PRECISION(precision=53), nullable=True
    )
    op.alter_column(
        "bookings", "lng", existing_type=sa.DOUBLE_PRECISION(precision=53), nullable=True
    )
    op.add_column(
        "file_assets",
        sa.Column(
            "purpose",
            sa.Enum(
                "PROVIDER_PHOTO",
                "PROVIDER_DOCUMENT",
                "TOPUP_PROOF",
                name="purpose",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            server_default="PROVIDER_DOCUMENT",
            nullable=False,
        ),
    )
    op.add_column(
        "file_assets", sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column("providers", sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "providers", sa.Column("agreement_accepted_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "providers",
        sa.Column(
            "verification_checks",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
    )
    op.add_column(
        "providers", sa.Column("balance_pkr", sa.Integer(), server_default="0", nullable=False)
    )


def downgrade() -> None:
    op.drop_constraint(op.f("ck_providers_status"), "providers", type_="check")
    op.create_check_constraint(
        op.f("ck_providers_status"),
        "providers",
        "status IN ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED')",
    )
    op.drop_constraint(op.f("ck_treatment_sessions_status"), "treatment_sessions", type_="check")
    op.create_check_constraint(
        op.f("ck_treatment_sessions_status"),
        "treatment_sessions",
        "status IN ('SCHEDULED', 'ON_THE_WAY', 'ARRIVED', 'COMPLETED', 'CANCELLED')",
    )
    op.drop_constraint(op.f("ck_session_events_status"), "session_events", type_="check")
    op.create_check_constraint(
        op.f("ck_session_events_status"),
        "session_events",
        "status IN ('SCHEDULED', 'ON_THE_WAY', 'ARRIVED', 'COMPLETED', 'CANCELLED')",
    )
    op.drop_column("providers", "balance_pkr")
    op.drop_column("providers", "verification_checks")
    op.drop_column("providers", "agreement_accepted_at")
    op.drop_column("providers", "submitted_at")
    op.drop_column("file_assets", "confirmed_at")
    op.drop_column("file_assets", "purpose")
    op.alter_column(
        "bookings", "lng", existing_type=sa.DOUBLE_PRECISION(precision=53), nullable=False
    )
    op.alter_column(
        "bookings", "lat", existing_type=sa.DOUBLE_PRECISION(precision=53), nullable=False
    )
    op.drop_index(
        "uq_wallet_transactions_one_commission_per_session",
        table_name="wallet_transactions",
        postgresql_where=sa.text("type = 'COMMISSION'"),
    )
    op.drop_index(op.f("ix_wallet_transactions_topup_id"), table_name="wallet_transactions")
    op.drop_index("ix_wallet_transactions_provider_id_created_at", table_name="wallet_transactions")
    op.drop_index(op.f("ix_wallet_transactions_created_by_id"), table_name="wallet_transactions")
    op.drop_table("wallet_transactions")
    op.drop_index("ix_topup_requests_status_created_at", table_name="topup_requests")
    op.drop_index(op.f("ix_topup_requests_reviewed_by_id"), table_name="topup_requests")
    op.drop_index(op.f("ix_topup_requests_provider_id"), table_name="topup_requests")
    op.drop_table("topup_requests")

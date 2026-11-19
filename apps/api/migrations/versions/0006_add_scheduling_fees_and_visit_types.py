"""add scheduling, fees and visit types

Physiotherapists set their own fee, slot length, home or clinic visits and time off. Offers hold
their time for a limited period. Contact messages keep the team's reply.

Revision ID: 0006
Revises: 0005
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_ASSIGNMENT_STATUSES = ("OFFERED", "ACCEPTED", "REJECTED", "WITHDRAWN")

# Specializations patients filter by. Existing services already cover sports, back and neck.
_NEW_SERVICES = (
    ("neuro", "Neuro rehab", "اعصابی بحالی", 6),
    ("pediatric", "Children's physiotherapy", "بچوں کی فزیوتھراپی", 7),
)


def _status_check(values: Sequence[str]) -> str:
    return "status IN (" + ", ".join(f"'{value}'" for value in values) + ")"


def upgrade() -> None:
    op.create_table(
        "provider_time_off",
        sa.Column("provider_id", sa.Uuid(), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.String(length=200), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("start_at < end_at", name=op.f("ck_provider_time_off_ends_after_start")),
        sa.ForeignKeyConstraint(
            ["provider_id"],
            ["providers.id"],
            name=op.f("fk_provider_time_off_provider_id_providers"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_provider_time_off")),
    )
    op.create_index(
        "ix_provider_time_off_provider_id_start_at",
        "provider_time_off",
        ["provider_id", "start_at"],
        unique=False,
    )

    # Bookings ------------------------------------------------------------------------------
    op.add_column(
        "bookings",
        sa.Column(
            "visit_type",
            sa.Enum(
                "HOME",
                "CLINIC",
                name="visit_type",
                native_enum=False,
                create_constraint=False,
                length=32,
            ),
            server_default="HOME",
            nullable=False,
        ),
    )
    op.create_check_constraint(
        op.f("ck_bookings_visit_type"), "bookings", "visit_type IN ('HOME', 'CLINIC')"
    )
    op.add_column(
        "bookings",
        sa.Column("duration_minutes", sa.Integer(), server_default="60", nullable=False),
    )
    op.add_column("bookings", sa.Column("hold_expires_at", sa.DateTime(timezone=True)))
    op.alter_column("bookings", "address_line", existing_type=sa.VARCHAR(length=500), nullable=True)
    op.create_check_constraint(
        op.f("ck_bookings_duration_positive"), "bookings", "duration_minutes > 0"
    )
    op.create_check_constraint(
        op.f("ck_bookings_home_visit_has_address"),
        "bookings",
        "visit_type <> 'HOME' OR address_line IS NOT NULL",
    )
    op.create_index(
        "ix_bookings_status_hold_expires_at",
        "bookings",
        ["status", "hold_expires_at"],
        unique=False,
    )
    # Offers already waiting get the default 3 hours from now, like new ones.
    op.execute(
        "UPDATE bookings SET hold_expires_at = now() + interval '3 hours' "
        "WHERE status = 'AWAITING_ACCEPTANCE'"
    )

    op.drop_constraint(op.f("ck_booking_assignments_status"), "booking_assignments", type_="check")
    op.create_check_constraint(
        op.f("ck_booking_assignments_status"),
        "booking_assignments",
        _status_check((*_ASSIGNMENT_STATUSES, "EXPIRED")),
    )

    op.add_column(
        "treatment_sessions",
        sa.Column("duration_minutes", sa.Integer(), server_default="60", nullable=False),
    )

    # Contact messages ----------------------------------------------------------------------
    op.add_column("contact_messages", sa.Column("reply_note", sa.Text(), nullable=True))
    op.add_column("contact_messages", sa.Column("handled_by_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        op.f("fk_contact_messages_handled_by_id_users"),
        "contact_messages",
        "users",
        ["handled_by_id"],
        ["id"],
    )
    op.create_index(
        op.f("ix_contact_messages_handled_by_id"),
        "contact_messages",
        ["handled_by_id"],
        unique=False,
    )

    # Physiotherapist practice settings -----------------------------------------------------
    op.add_column("providers", sa.Column("fee_pkr", sa.Integer(), nullable=True))
    op.add_column(
        "providers",
        sa.Column("slot_minutes", sa.Integer(), server_default="60", nullable=False),
    )
    op.add_column(
        "providers",
        sa.Column("visit_home", sa.Boolean(), server_default=sa.text("true"), nullable=False),
    )
    op.add_column(
        "providers",
        sa.Column("visit_clinic", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )
    op.add_column("providers", sa.Column("clinic_address", sa.String(length=500), nullable=True))
    op.add_column("providers", sa.Column("clinic_area_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        op.f("fk_providers_clinic_area_id_areas"), "providers", "areas", ["clinic_area_id"], ["id"]
    )
    op.create_index(
        op.f("ix_providers_clinic_area_id"), "providers", ["clinic_area_id"], unique=False
    )
    op.create_check_constraint(op.f("ck_providers_fee_positive"), "providers", "fee_pkr > 0")
    op.create_check_constraint(
        op.f("ck_providers_slot_minutes_allowed"), "providers", "slot_minutes IN (30, 45, 60)"
    )
    op.create_check_constraint(
        op.f("ck_providers_offers_a_visit_type"), "providers", "visit_home OR visit_clinic"
    )
    op.create_check_constraint(
        op.f("ck_providers_clinic_has_address"),
        "providers",
        "NOT visit_clinic OR (clinic_address IS NOT NULL AND clinic_area_id IS NOT NULL)",
    )

    for slug, name, name_urdu, sort_order in _NEW_SERVICES:
        op.execute(
            sa.text(
                "INSERT INTO service_types "
                "(id, slug, category, name, name_urdu, is_active, sort_order) "
                "VALUES (gen_random_uuid(), :slug, 'PHYSIO', :name, :name_urdu, true, :sort_order) "
                "ON CONFLICT (slug) DO NOTHING"
            ).bindparams(slug=slug, name=name, name_urdu=name_urdu, sort_order=sort_order)
        )

    # Prices now come from each physiotherapist's fee, so a package only says how many sessions.
    # Every service gets a single-session option, so none is left unbookable.
    op.execute(
        "INSERT INTO service_packages (id, service_type_id, sessions_count, price_pkr, is_active) "
        "SELECT gen_random_uuid(), s.id, 1, 0, true FROM service_types s "
        "WHERE NOT EXISTS (SELECT 1 FROM service_packages p "
        "WHERE p.service_type_id = s.id AND p.sessions_count = 1 AND p.is_active)"
    )


def downgrade() -> None:
    # The added services stay: bookings may already point at them.
    op.drop_constraint(op.f("ck_providers_clinic_has_address"), "providers", type_="check")
    op.drop_constraint(op.f("ck_providers_offers_a_visit_type"), "providers", type_="check")
    op.drop_constraint(op.f("ck_providers_slot_minutes_allowed"), "providers", type_="check")
    op.drop_constraint(op.f("ck_providers_fee_positive"), "providers", type_="check")
    op.drop_index(op.f("ix_providers_clinic_area_id"), table_name="providers")
    op.drop_constraint(op.f("fk_providers_clinic_area_id_areas"), "providers", type_="foreignkey")
    op.drop_column("providers", "clinic_area_id")
    op.drop_column("providers", "clinic_address")
    op.drop_column("providers", "visit_clinic")
    op.drop_column("providers", "visit_home")
    op.drop_column("providers", "slot_minutes")
    op.drop_column("providers", "fee_pkr")

    op.drop_index(op.f("ix_contact_messages_handled_by_id"), table_name="contact_messages")
    op.drop_constraint(
        op.f("fk_contact_messages_handled_by_id_users"), "contact_messages", type_="foreignkey"
    )
    op.drop_column("contact_messages", "handled_by_id")
    op.drop_column("contact_messages", "reply_note")

    op.drop_column("treatment_sessions", "duration_minutes")

    op.execute("UPDATE booking_assignments SET status = 'WITHDRAWN' WHERE status = 'EXPIRED'")
    op.drop_constraint(op.f("ck_booking_assignments_status"), "booking_assignments", type_="check")
    op.create_check_constraint(
        op.f("ck_booking_assignments_status"),
        "booking_assignments",
        _status_check(_ASSIGNMENT_STATUSES),
    )

    op.drop_index("ix_bookings_status_hold_expires_at", table_name="bookings")
    op.drop_constraint(op.f("ck_bookings_home_visit_has_address"), "bookings", type_="check")
    op.drop_constraint(op.f("ck_bookings_duration_positive"), "bookings", type_="check")
    # Clinic visits had no address. A placeholder keeps the old NOT NULL rule satisfiable.
    op.execute("UPDATE bookings SET address_line = 'Clinic visit' WHERE address_line IS NULL")
    op.alter_column(
        "bookings", "address_line", existing_type=sa.VARCHAR(length=500), nullable=False
    )
    op.drop_column("bookings", "hold_expires_at")
    op.drop_column("bookings", "duration_minutes")
    op.drop_constraint(op.f("ck_bookings_visit_type"), "bookings", type_="check")
    op.drop_column("bookings", "visit_type")

    op.drop_index("ix_provider_time_off_provider_id_start_at", table_name="provider_time_off")
    op.drop_table("provider_time_off")

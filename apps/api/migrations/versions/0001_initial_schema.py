"""initial schema

Revision ID: 0001
Revises:
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "areas",
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("name_urdu", sa.String(length=80), nullable=False),
        sa.Column("city", sa.String(length=80), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_areas")),
        sa.UniqueConstraint("city", "name", name="uq_areas_city_name"),
    )
    op.create_table(
        "otp_codes",
        sa.Column("phone", sa.String(length=16), nullable=False),
        sa.Column("code_hash", sa.String(length=128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_otp_codes")),
    )
    op.create_index(
        "ix_otp_codes_phone_created_at", "otp_codes", ["phone", "created_at"], unique=False
    )
    op.create_table(
        "platform_settings",
        sa.Column("key", sa.String(length=80), nullable=False),
        sa.Column("value", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("key", name=op.f("pk_platform_settings")),
    )
    op.create_table(
        "service_types",
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column(
            "category",
            sa.Enum(
                "PHYSIO",
                "NURSING",
                "DOCTOR",
                "LAB",
                name="category",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("name_urdu", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("description_urdu", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_service_types")),
        sa.UniqueConstraint("slug", name=op.f("uq_service_types_slug")),
    )
    op.create_index(
        "ix_service_types_category_is_active",
        "service_types",
        ["category", "is_active"],
        unique=False,
    )
    op.create_table(
        "users",
        sa.Column("phone", sa.String(length=16), nullable=False),
        sa.Column("email", sa.String(length=254), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=True),
        sa.Column(
            "role",
            sa.Enum(
                "PATIENT",
                "PROVIDER",
                "ADMIN",
                name="role",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column(
            "locale",
            sa.Enum(
                "EN", "UR", name="locale", native_enum=False, create_constraint=True, length=32
            ),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
        sa.UniqueConstraint("phone", name=op.f("uq_users_phone")),
    )
    op.create_table(
        "addresses",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("label", sa.String(length=60), nullable=True),
        sa.Column("address_line", sa.String(length=500), nullable=False),
        sa.Column("area_id", sa.Uuid(), nullable=False),
        sa.Column("lat", sa.Double(), nullable=False),
        sa.Column("lng", sa.Double(), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("lat BETWEEN -90 AND 90", name=op.f("ck_addresses_lat_range")),
        sa.CheckConstraint("lng BETWEEN -180 AND 180", name=op.f("ck_addresses_lng_range")),
        sa.ForeignKeyConstraint(["area_id"], ["areas.id"], name=op.f("fk_addresses_area_id_areas")),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_addresses_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_addresses")),
    )
    op.create_index(op.f("ix_addresses_area_id"), "addresses", ["area_id"], unique=False)
    op.create_index(op.f("ix_addresses_user_id"), "addresses", ["user_id"], unique=False)
    op.create_index(
        "uq_addresses_one_default_per_user",
        "addresses",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("is_default"),
    )
    op.create_table(
        "audit_logs",
        sa.Column("actor_id", sa.Uuid(), nullable=True),
        sa.Column("action", sa.String(length=80), nullable=False),
        sa.Column("entity_type", sa.String(length=80), nullable=False),
        sa.Column("entity_id", sa.String(length=64), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["actor_id"],
            ["users.id"],
            name=op.f("fk_audit_logs_actor_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_logs")),
    )
    op.create_index(
        "ix_audit_logs_actor_id_created_at", "audit_logs", ["actor_id", "created_at"], unique=False
    )
    op.create_index(
        "ix_audit_logs_entity_type_entity_id",
        "audit_logs",
        ["entity_type", "entity_id"],
        unique=False,
    )
    op.create_table(
        "file_assets",
        sa.Column("storage_key", sa.String(length=512), nullable=False),
        sa.Column(
            "visibility",
            sa.Enum(
                "PUBLIC",
                "PRIVATE",
                name="visibility",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("mime_type", sa.String(length=127), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("uploaded_by_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("size_bytes > 0", name=op.f("ck_file_assets_size_positive")),
        sa.ForeignKeyConstraint(
            ["uploaded_by_id"], ["users.id"], name=op.f("fk_file_assets_uploaded_by_id_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_file_assets")),
        sa.UniqueConstraint("storage_key", name=op.f("uq_file_assets_storage_key")),
    )
    op.create_index(
        op.f("ix_file_assets_uploaded_by_id"), "file_assets", ["uploaded_by_id"], unique=False
    )
    op.create_table(
        "notifications",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "type",
            sa.Enum(
                "BOOKING_RECEIVED",
                "ASSIGNMENT_OFFERED",
                "PROVIDER_ASSIGNED",
                "PROVIDER_ON_THE_WAY",
                "SESSION_COMPLETED",
                "FEEDBACK_REQUEST",
                "PROVIDER_STATUS_CHANGED",
                name="type",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column(
            "channel",
            sa.Enum(
                "IN_APP",
                "SMS",
                "WHATSAPP",
                name="channel",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING",
                "SENT",
                "FAILED",
                name="status",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_notifications_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_notifications")),
    )
    op.create_index(
        "ix_notifications_status_channel", "notifications", ["status", "channel"], unique=False
    )
    op.create_index(
        "ix_notifications_user_id_read_at", "notifications", ["user_id", "read_at"], unique=False
    )
    op.create_table(
        "patients",
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column(
            "gender",
            sa.Enum(
                "MALE",
                "FEMALE",
                name="gender",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("birth_year", sa.Integer(), nullable=True),
        sa.Column(
            "relation",
            sa.Enum(
                "SELF",
                "PARENT",
                "SPOUSE",
                "CHILD",
                "SIBLING",
                "OTHER",
                name="relation",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("birth_year >= 1900", name=op.f("ck_patients_birth_year_valid")),
        sa.ForeignKeyConstraint(
            ["owner_id"], ["users.id"], name=op.f("fk_patients_owner_id_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_patients")),
    )
    op.create_index(op.f("ix_patients_owner_id"), "patients", ["owner_id"], unique=False)
    op.create_table(
        "refresh_tokens",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("family_id", sa.Uuid(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_refresh_tokens_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_refresh_tokens")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_refresh_tokens_token_hash")),
    )
    op.create_index(
        op.f("ix_refresh_tokens_family_id"), "refresh_tokens", ["family_id"], unique=False
    )
    op.create_index(op.f("ix_refresh_tokens_user_id"), "refresh_tokens", ["user_id"], unique=False)
    op.create_table(
        "service_packages",
        sa.Column("service_type_id", sa.Uuid(), nullable=False),
        sa.Column("sessions_count", sa.Integer(), nullable=False),
        sa.Column("price_pkr", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.CheckConstraint("price_pkr >= 0", name=op.f("ck_service_packages_price_not_negative")),
        sa.CheckConstraint(
            "sessions_count > 0", name=op.f("ck_service_packages_sessions_count_positive")
        ),
        sa.ForeignKeyConstraint(
            ["service_type_id"],
            ["service_types.id"],
            name=op.f("fk_service_packages_service_type_id_service_types"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_service_packages")),
    )
    op.create_index(
        "ix_service_packages_service_type_id_is_active",
        "service_packages",
        ["service_type_id", "is_active"],
        unique=False,
    )
    op.create_table(
        "providers",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column(
            "gender",
            sa.Enum(
                "MALE",
                "FEMALE",
                name="gender",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("cnic_encrypted", sa.Text(), nullable=False),
        sa.Column("cnic_hash", sa.String(length=128), nullable=False),
        sa.Column("qualification", sa.String(length=200), nullable=False),
        sa.Column("experience_years", sa.Integer(), nullable=False),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("photo_file_id", sa.Uuid(), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING",
                "APPROVED",
                "REJECTED",
                "SUSPENDED",
                name="status",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("status_reason", sa.Text(), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rating_avg", sa.Double(), nullable=False),
        sa.Column("rating_count", sa.Integer(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "experience_years >= 0", name=op.f("ck_providers_experience_not_negative")
        ),
        sa.CheckConstraint(
            "rating_avg BETWEEN 0 AND 5", name=op.f("ck_providers_rating_avg_range")
        ),
        sa.CheckConstraint(
            "rating_count >= 0", name=op.f("ck_providers_rating_count_not_negative")
        ),
        sa.ForeignKeyConstraint(
            ["photo_file_id"],
            ["file_assets.id"],
            name=op.f("fk_providers_photo_file_id_file_assets"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_providers_user_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_providers")),
        sa.UniqueConstraint("cnic_hash", name=op.f("uq_providers_cnic_hash")),
        sa.UniqueConstraint("photo_file_id", name=op.f("uq_providers_photo_file_id")),
        sa.UniqueConstraint("user_id", name=op.f("uq_providers_user_id")),
    )
    op.create_index("ix_providers_status_gender", "providers", ["status", "gender"], unique=False)
    op.create_table(
        "availabilities",
        sa.Column("provider_id", sa.Uuid(), nullable=False),
        sa.Column("day_of_week", sa.Integer(), nullable=False),
        sa.Column("start_minute", sa.Integer(), nullable=False),
        sa.Column("end_minute", sa.Integer(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.CheckConstraint(
            "day_of_week BETWEEN 0 AND 6", name=op.f("ck_availabilities_day_of_week_range")
        ),
        sa.CheckConstraint(
            "start_minute >= 0 AND end_minute <= 1440 AND start_minute < end_minute",
            name=op.f("ck_availabilities_minutes_valid"),
        ),
        sa.ForeignKeyConstraint(
            ["provider_id"],
            ["providers.id"],
            name=op.f("fk_availabilities_provider_id_providers"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_availabilities")),
    )
    op.create_index(
        "ix_availabilities_provider_id_day_of_week",
        "availabilities",
        ["provider_id", "day_of_week"],
        unique=False,
    )
    op.create_table(
        "bookings",
        sa.Column("number", sa.Integer(), sa.Identity(always=False, start=1001), nullable=False),
        sa.Column("patient_id", sa.Uuid(), nullable=False),
        sa.Column("booked_by_id", sa.Uuid(), nullable=False),
        sa.Column("service_type_id", sa.Uuid(), nullable=False),
        sa.Column("package_id", sa.Uuid(), nullable=False),
        sa.Column("provider_id", sa.Uuid(), nullable=True),
        sa.Column("preferred_provider_id", sa.Uuid(), nullable=True),
        sa.Column(
            "preferred_gender",
            sa.Enum(
                "MALE",
                "FEMALE",
                name="preferred_gender",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "PENDING_ASSIGNMENT",
                "AWAITING_ACCEPTANCE",
                "ACTIVE",
                "COMPLETED",
                "CANCELLED",
                name="status",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("sessions_count", sa.Integer(), nullable=False),
        sa.Column("price_total_pkr", sa.Integer(), nullable=False),
        sa.Column("commission_bps", sa.Integer(), nullable=False),
        sa.Column("address_line", sa.String(length=500), nullable=False),
        sa.Column("area_id", sa.Uuid(), nullable=False),
        sa.Column("lat", sa.Double(), nullable=False),
        sa.Column("lng", sa.Double(), nullable=False),
        sa.Column("preferred_start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("condition", sa.Text(), nullable=False),
        sa.Column("cancel_reason", sa.Text(), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "commission_bps BETWEEN 0 AND 10000", name=op.f("ck_bookings_commission_bps_range")
        ),
        sa.CheckConstraint("lat BETWEEN -90 AND 90", name=op.f("ck_bookings_lat_range")),
        sa.CheckConstraint("lng BETWEEN -180 AND 180", name=op.f("ck_bookings_lng_range")),
        sa.CheckConstraint("price_total_pkr >= 0", name=op.f("ck_bookings_price_not_negative")),
        sa.CheckConstraint("sessions_count > 0", name=op.f("ck_bookings_sessions_count_positive")),
        sa.ForeignKeyConstraint(["area_id"], ["areas.id"], name=op.f("fk_bookings_area_id_areas")),
        sa.ForeignKeyConstraint(
            ["booked_by_id"], ["users.id"], name=op.f("fk_bookings_booked_by_id_users")
        ),
        sa.ForeignKeyConstraint(
            ["package_id"],
            ["service_packages.id"],
            name=op.f("fk_bookings_package_id_service_packages"),
        ),
        sa.ForeignKeyConstraint(
            ["patient_id"], ["patients.id"], name=op.f("fk_bookings_patient_id_patients")
        ),
        sa.ForeignKeyConstraint(
            ["preferred_provider_id"],
            ["providers.id"],
            name=op.f("fk_bookings_preferred_provider_id_providers"),
        ),
        sa.ForeignKeyConstraint(
            ["provider_id"], ["providers.id"], name=op.f("fk_bookings_provider_id_providers")
        ),
        sa.ForeignKeyConstraint(
            ["service_type_id"],
            ["service_types.id"],
            name=op.f("fk_bookings_service_type_id_service_types"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_bookings")),
        sa.UniqueConstraint("number", name=op.f("uq_bookings_number")),
    )
    op.create_index(op.f("ix_bookings_area_id"), "bookings", ["area_id"], unique=False)
    op.create_index(op.f("ix_bookings_booked_by_id"), "bookings", ["booked_by_id"], unique=False)
    op.create_index(op.f("ix_bookings_package_id"), "bookings", ["package_id"], unique=False)
    op.create_index(op.f("ix_bookings_patient_id"), "bookings", ["patient_id"], unique=False)
    op.create_index(
        op.f("ix_bookings_preferred_provider_id"),
        "bookings",
        ["preferred_provider_id"],
        unique=False,
    )
    op.create_index(op.f("ix_bookings_provider_id"), "bookings", ["provider_id"], unique=False)
    op.create_index(
        op.f("ix_bookings_service_type_id"), "bookings", ["service_type_id"], unique=False
    )
    op.create_index(
        "ix_bookings_status_created_at", "bookings", ["status", "created_at"], unique=False
    )
    op.create_table(
        "provider_areas",
        sa.Column("provider_id", sa.Uuid(), nullable=False),
        sa.Column("area_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["area_id"], ["areas.id"], name=op.f("fk_provider_areas_area_id_areas")
        ),
        sa.ForeignKeyConstraint(
            ["provider_id"],
            ["providers.id"],
            name=op.f("fk_provider_areas_provider_id_providers"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("provider_id", "area_id", name=op.f("pk_provider_areas")),
    )
    op.create_index(op.f("ix_provider_areas_area_id"), "provider_areas", ["area_id"], unique=False)
    op.create_table(
        "provider_documents",
        sa.Column("provider_id", sa.Uuid(), nullable=False),
        sa.Column(
            "type",
            sa.Enum(
                "CNIC_FRONT",
                "CNIC_BACK",
                "DEGREE",
                "LICENSE",
                "OTHER",
                name="type",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("file_id", sa.Uuid(), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["file_id"], ["file_assets.id"], name=op.f("fk_provider_documents_file_id_file_assets")
        ),
        sa.ForeignKeyConstraint(
            ["provider_id"],
            ["providers.id"],
            name=op.f("fk_provider_documents_provider_id_providers"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_provider_documents")),
        sa.UniqueConstraint("file_id", name=op.f("uq_provider_documents_file_id")),
    )
    op.create_index(
        op.f("ix_provider_documents_provider_id"),
        "provider_documents",
        ["provider_id"],
        unique=False,
    )
    op.create_table(
        "provider_services",
        sa.Column("provider_id", sa.Uuid(), nullable=False),
        sa.Column("service_type_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["provider_id"],
            ["providers.id"],
            name=op.f("fk_provider_services_provider_id_providers"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["service_type_id"],
            ["service_types.id"],
            name=op.f("fk_provider_services_service_type_id_service_types"),
        ),
        sa.PrimaryKeyConstraint(
            "provider_id", "service_type_id", name=op.f("pk_provider_services")
        ),
    )
    op.create_index(
        op.f("ix_provider_services_service_type_id"),
        "provider_services",
        ["service_type_id"],
        unique=False,
    )
    op.create_table(
        "settlements",
        sa.Column("provider_id", sa.Uuid(), nullable=False),
        sa.Column(
            "direction",
            sa.Enum(
                "PROVIDER_TO_PLATFORM",
                "PLATFORM_TO_PROVIDER",
                name="direction",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("amount_pkr", sa.Integer(), nullable=False),
        sa.Column("settled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("recorded_by_id", sa.Uuid(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("amount_pkr > 0", name=op.f("ck_settlements_amount_positive")),
        sa.ForeignKeyConstraint(
            ["provider_id"], ["providers.id"], name=op.f("fk_settlements_provider_id_providers")
        ),
        sa.ForeignKeyConstraint(
            ["recorded_by_id"], ["users.id"], name=op.f("fk_settlements_recorded_by_id_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_settlements")),
    )
    op.create_index(
        op.f("ix_settlements_provider_id"), "settlements", ["provider_id"], unique=False
    )
    op.create_index(
        op.f("ix_settlements_recorded_by_id"), "settlements", ["recorded_by_id"], unique=False
    )
    op.create_table(
        "booking_assignments",
        sa.Column("booking_id", sa.Uuid(), nullable=False),
        sa.Column("provider_id", sa.Uuid(), nullable=False),
        sa.Column("assigned_by_id", sa.Uuid(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "OFFERED",
                "ACCEPTED",
                "REJECTED",
                "WITHDRAWN",
                name="status",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("reject_reason", sa.Text(), nullable=True),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["assigned_by_id"],
            ["users.id"],
            name=op.f("fk_booking_assignments_assigned_by_id_users"),
        ),
        sa.ForeignKeyConstraint(
            ["booking_id"], ["bookings.id"], name=op.f("fk_booking_assignments_booking_id_bookings")
        ),
        sa.ForeignKeyConstraint(
            ["provider_id"],
            ["providers.id"],
            name=op.f("fk_booking_assignments_provider_id_providers"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_booking_assignments")),
    )
    op.create_index(
        op.f("ix_booking_assignments_assigned_by_id"),
        "booking_assignments",
        ["assigned_by_id"],
        unique=False,
    )
    op.create_index(
        "ix_booking_assignments_booking_id", "booking_assignments", ["booking_id"], unique=False
    )
    op.create_index(
        "ix_booking_assignments_provider_id_status",
        "booking_assignments",
        ["provider_id", "status"],
        unique=False,
    )
    op.create_index(
        "uq_booking_assignments_one_open_per_booking",
        "booking_assignments",
        ["booking_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('OFFERED', 'ACCEPTED')"),
    )
    op.create_table(
        "booking_attachments",
        sa.Column("booking_id", sa.Uuid(), nullable=False),
        sa.Column("file_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["booking_id"],
            ["bookings.id"],
            name=op.f("fk_booking_attachments_booking_id_bookings"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["file_id"], ["file_assets.id"], name=op.f("fk_booking_attachments_file_id_file_assets")
        ),
        sa.PrimaryKeyConstraint("booking_id", "file_id", name=op.f("pk_booking_attachments")),
        sa.UniqueConstraint("file_id", name=op.f("uq_booking_attachments_file_id")),
    )
    op.create_table(
        "treatment_sessions",
        sa.Column("booking_id", sa.Uuid(), nullable=False),
        sa.Column("provider_id", sa.Uuid(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "SCHEDULED",
                "ON_THE_WAY",
                "ARRIVED",
                "COMPLETED",
                "CANCELLED",
                name="status",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("arrived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("pain_score", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("cancel_reason", sa.Text(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "pain_score BETWEEN 0 AND 10", name=op.f("ck_treatment_sessions_pain_score_range")
        ),
        sa.CheckConstraint("sequence > 0", name=op.f("ck_treatment_sessions_sequence_positive")),
        sa.ForeignKeyConstraint(
            ["booking_id"], ["bookings.id"], name=op.f("fk_treatment_sessions_booking_id_bookings")
        ),
        sa.ForeignKeyConstraint(
            ["provider_id"],
            ["providers.id"],
            name=op.f("fk_treatment_sessions_provider_id_providers"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_treatment_sessions")),
        sa.UniqueConstraint(
            "booking_id", "sequence", name="uq_treatment_sessions_booking_sequence"
        ),
    )
    op.create_index(
        "ix_treatment_sessions_provider_id_scheduled_at",
        "treatment_sessions",
        ["provider_id", "scheduled_at"],
        unique=False,
    )
    op.create_table(
        "complaints",
        sa.Column("booking_id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=True),
        sa.Column("raised_by_id", sa.Uuid(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "OPEN",
                "IN_PROGRESS",
                "RESOLVED",
                "DISMISSED",
                name="status",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("resolution", sa.Text(), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["booking_id"], ["bookings.id"], name=op.f("fk_complaints_booking_id_bookings")
        ),
        sa.ForeignKeyConstraint(
            ["raised_by_id"], ["users.id"], name=op.f("fk_complaints_raised_by_id_users")
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["treatment_sessions.id"],
            name=op.f("fk_complaints_session_id_treatment_sessions"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_complaints")),
    )
    op.create_index(op.f("ix_complaints_booking_id"), "complaints", ["booking_id"], unique=False)
    op.create_index(
        op.f("ix_complaints_raised_by_id"), "complaints", ["raised_by_id"], unique=False
    )
    op.create_index(op.f("ix_complaints_session_id"), "complaints", ["session_id"], unique=False)
    op.create_index(
        "ix_complaints_status_created_at", "complaints", ["status", "created_at"], unique=False
    )
    op.create_table(
        "payments",
        sa.Column("booking_id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=True),
        sa.Column("amount_pkr", sa.Integer(), nullable=False),
        sa.Column("commission_pkr", sa.Integer(), nullable=False),
        sa.Column("provider_payout_pkr", sa.Integer(), nullable=False),
        sa.Column(
            "method",
            sa.Enum("CASH", name="method", native_enum=False, create_constraint=True, length=32),
            nullable=False,
        ),
        sa.Column("collected_by_provider_id", sa.Uuid(), nullable=True),
        sa.Column("recorded_by_id", sa.Uuid(), nullable=False),
        sa.Column("collected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("amount_pkr > 0", name=op.f("ck_payments_amount_positive")),
        sa.CheckConstraint(
            "commission_pkr + provider_payout_pkr = amount_pkr",
            name=op.f("ck_payments_split_adds_up"),
        ),
        sa.CheckConstraint("commission_pkr >= 0", name=op.f("ck_payments_commission_not_negative")),
        sa.CheckConstraint(
            "provider_payout_pkr >= 0", name=op.f("ck_payments_payout_not_negative")
        ),
        sa.ForeignKeyConstraint(
            ["booking_id"], ["bookings.id"], name=op.f("fk_payments_booking_id_bookings")
        ),
        sa.ForeignKeyConstraint(
            ["collected_by_provider_id"],
            ["providers.id"],
            name=op.f("fk_payments_collected_by_provider_id_providers"),
        ),
        sa.ForeignKeyConstraint(
            ["recorded_by_id"], ["users.id"], name=op.f("fk_payments_recorded_by_id_users")
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["treatment_sessions.id"],
            name=op.f("fk_payments_session_id_treatment_sessions"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_payments")),
    )
    op.create_index(op.f("ix_payments_booking_id"), "payments", ["booking_id"], unique=False)
    op.create_index(
        op.f("ix_payments_collected_by_provider_id"),
        "payments",
        ["collected_by_provider_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_payments_recorded_by_id"), "payments", ["recorded_by_id"], unique=False
    )
    op.create_index(op.f("ix_payments_session_id"), "payments", ["session_id"], unique=False)
    op.create_table(
        "reviews",
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("reviewer_id", sa.Uuid(), nullable=False),
        sa.Column("provider_id", sa.Uuid(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("rating BETWEEN 1 AND 5", name=op.f("ck_reviews_rating_range")),
        sa.ForeignKeyConstraint(
            ["provider_id"], ["providers.id"], name=op.f("fk_reviews_provider_id_providers")
        ),
        sa.ForeignKeyConstraint(
            ["reviewer_id"], ["users.id"], name=op.f("fk_reviews_reviewer_id_users")
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["treatment_sessions.id"],
            name=op.f("fk_reviews_session_id_treatment_sessions"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_reviews")),
        sa.UniqueConstraint("session_id", name=op.f("uq_reviews_session_id")),
    )
    op.create_index(
        "ix_reviews_provider_id_rating", "reviews", ["provider_id", "rating"], unique=False
    )
    op.create_index(op.f("ix_reviews_reviewer_id"), "reviews", ["reviewer_id"], unique=False)
    op.create_table(
        "session_events",
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "SCHEDULED",
                "ON_THE_WAY",
                "ARRIVED",
                "COMPLETED",
                "CANCELLED",
                name="status",
                native_enum=False,
                create_constraint=True,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("actor_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["actor_id"], ["users.id"], name=op.f("fk_session_events_actor_id_users")
        ),
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["treatment_sessions.id"],
            name=op.f("fk_session_events_session_id_treatment_sessions"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_session_events")),
    )
    op.create_index(
        op.f("ix_session_events_actor_id"), "session_events", ["actor_id"], unique=False
    )
    op.create_index(
        op.f("ix_session_events_session_id"), "session_events", ["session_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_session_events_session_id"), table_name="session_events")
    op.drop_index(op.f("ix_session_events_actor_id"), table_name="session_events")
    op.drop_table("session_events")
    op.drop_index(op.f("ix_reviews_reviewer_id"), table_name="reviews")
    op.drop_index("ix_reviews_provider_id_rating", table_name="reviews")
    op.drop_table("reviews")
    op.drop_index(op.f("ix_payments_session_id"), table_name="payments")
    op.drop_index(op.f("ix_payments_recorded_by_id"), table_name="payments")
    op.drop_index(op.f("ix_payments_collected_by_provider_id"), table_name="payments")
    op.drop_index(op.f("ix_payments_booking_id"), table_name="payments")
    op.drop_table("payments")
    op.drop_index("ix_complaints_status_created_at", table_name="complaints")
    op.drop_index(op.f("ix_complaints_session_id"), table_name="complaints")
    op.drop_index(op.f("ix_complaints_raised_by_id"), table_name="complaints")
    op.drop_index(op.f("ix_complaints_booking_id"), table_name="complaints")
    op.drop_table("complaints")
    op.drop_index("ix_treatment_sessions_provider_id_scheduled_at", table_name="treatment_sessions")
    op.drop_table("treatment_sessions")
    op.drop_table("booking_attachments")
    op.drop_index(
        "uq_booking_assignments_one_open_per_booking",
        table_name="booking_assignments",
        postgresql_where=sa.text("status IN ('OFFERED', 'ACCEPTED')"),
    )
    op.drop_index("ix_booking_assignments_provider_id_status", table_name="booking_assignments")
    op.drop_index("ix_booking_assignments_booking_id", table_name="booking_assignments")
    op.drop_index(op.f("ix_booking_assignments_assigned_by_id"), table_name="booking_assignments")
    op.drop_table("booking_assignments")
    op.drop_index(op.f("ix_settlements_recorded_by_id"), table_name="settlements")
    op.drop_index(op.f("ix_settlements_provider_id"), table_name="settlements")
    op.drop_table("settlements")
    op.drop_index(op.f("ix_provider_services_service_type_id"), table_name="provider_services")
    op.drop_table("provider_services")
    op.drop_index(op.f("ix_provider_documents_provider_id"), table_name="provider_documents")
    op.drop_table("provider_documents")
    op.drop_index(op.f("ix_provider_areas_area_id"), table_name="provider_areas")
    op.drop_table("provider_areas")
    op.drop_index("ix_bookings_status_created_at", table_name="bookings")
    op.drop_index(op.f("ix_bookings_service_type_id"), table_name="bookings")
    op.drop_index(op.f("ix_bookings_provider_id"), table_name="bookings")
    op.drop_index(op.f("ix_bookings_preferred_provider_id"), table_name="bookings")
    op.drop_index(op.f("ix_bookings_patient_id"), table_name="bookings")
    op.drop_index(op.f("ix_bookings_package_id"), table_name="bookings")
    op.drop_index(op.f("ix_bookings_booked_by_id"), table_name="bookings")
    op.drop_index(op.f("ix_bookings_area_id"), table_name="bookings")
    op.drop_table("bookings")
    op.drop_index("ix_availabilities_provider_id_day_of_week", table_name="availabilities")
    op.drop_table("availabilities")
    op.drop_index("ix_providers_status_gender", table_name="providers")
    op.drop_table("providers")
    op.drop_index("ix_service_packages_service_type_id_is_active", table_name="service_packages")
    op.drop_table("service_packages")
    op.drop_index(op.f("ix_refresh_tokens_user_id"), table_name="refresh_tokens")
    op.drop_index(op.f("ix_refresh_tokens_family_id"), table_name="refresh_tokens")
    op.drop_table("refresh_tokens")
    op.drop_index(op.f("ix_patients_owner_id"), table_name="patients")
    op.drop_table("patients")
    op.drop_index("ix_notifications_user_id_read_at", table_name="notifications")
    op.drop_index("ix_notifications_status_channel", table_name="notifications")
    op.drop_table("notifications")
    op.drop_index(op.f("ix_file_assets_uploaded_by_id"), table_name="file_assets")
    op.drop_table("file_assets")
    op.drop_index("ix_audit_logs_entity_type_entity_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_actor_id_created_at", table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_index(
        "uq_addresses_one_default_per_user",
        table_name="addresses",
        postgresql_where=sa.text("is_default"),
    )
    op.drop_index(op.f("ix_addresses_user_id"), table_name="addresses")
    op.drop_index(op.f("ix_addresses_area_id"), table_name="addresses")
    op.drop_table("addresses")
    op.drop_table("users")
    op.drop_index("ix_service_types_category_is_active", table_name="service_types")
    op.drop_table("service_types")
    op.drop_table("platform_settings")
    op.drop_index("ix_otp_codes_phone_created_at", table_name="otp_codes")
    op.drop_table("otp_codes")
    op.drop_table("areas")

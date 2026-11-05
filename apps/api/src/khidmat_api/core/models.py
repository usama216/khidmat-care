"""Declarative base and column helpers shared by all modules."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid7

from sqlalchemy import DateTime, Enum, MetaData, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Predictable constraint names let Alembic create, compare and drop them reliably.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
    type_annotation_map = {datetime: DateTime(timezone=True)}  # noqa: RUF012


class UUIDPrimaryKeyMixin:
    # UUIDv7 is time-ordered, which keeps B-tree inserts efficient, and it can't be enumerated
    # the way sequential ids can.
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid7)


class CreatedAtMixin:
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class TimestampMixin(CreatedAtMixin):
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())


def enum_type(enum_class: type[StrEnum], name: str) -> Enum:
    """Store an enum as VARCHAR with a CHECK constraint.

    Native Postgres enums can't drop values and need special migration handling. A CHECK
    constraint gives the same integrity and is an ordinary migration to change.
    """
    return Enum(
        enum_class,
        name=name,
        native_enum=False,
        create_constraint=True,
        length=32,
        values_callable=lambda members: [member.value for member in members],
    )

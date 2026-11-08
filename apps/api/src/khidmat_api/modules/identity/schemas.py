"""Request and response shapes for authentication and staff management."""

from datetime import datetime
from typing import Annotated, Literal, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator

from khidmat_api.core.phone import normalize_phone
from khidmat_api.modules.identity.models import Role, User
from khidmat_api.modules.identity.permissions import permissions_for

PersonName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
# The upper bound stops very long inputs from wasting password-hashing work.
NewPassword = Annotated[str, Field(min_length=8, max_length=128)]

StaffRole = Literal["ADMIN", "OPERATIONS", "VERIFICATION", "FINANCE", "SUPPORT"]


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Phone number for patients and physiotherapists; staff can also use their email.
    identifier: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=3, max_length=254)
    ]
    password: str = Field(min_length=1, max_length=128)


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: PersonName
    phone: Annotated[str, Field(max_length=32)]
    password: NewPassword
    # Only these two can sign themselves up. Staff accounts are created by an admin.
    role: Literal["PATIENT", "PROVIDER"]

    @field_validator("phone")
    @classmethod
    def _normalize_phone(cls, value: str) -> str:
        return normalize_phone(value)


class ChangePasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: str = Field(min_length=1, max_length=128)
    new_password: NewPassword


class CurrentUserResponse(BaseModel):
    id: UUID
    phone: str
    email: str | None
    name: str | None
    role: Role
    permissions: list[str]
    must_change_password: bool

    @classmethod
    def from_user(cls, user: User) -> Self:
        return cls(
            id=user.id,
            phone=user.phone,
            email=user.email,
            name=user.name,
            role=user.role,
            permissions=sorted(permissions_for(user.role)),
            must_change_password=user.must_change_password,
        )


class StaffResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str | None
    phone: str
    email: str | None
    role: Role
    is_active: bool
    must_change_password: bool
    created_at: datetime


class StaffCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: PersonName
    phone: Annotated[str, Field(max_length=32)]
    email: EmailStr
    role: StaffRole

    @field_validator("phone")
    @classmethod
    def _normalize_phone(cls, value: str) -> str:
        return normalize_phone(value)


class StaffUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: PersonName | None = None
    role: StaffRole | None = None
    is_active: bool | None = None


class TemporaryPasswordResponse(BaseModel):
    """The only time a temporary password is ever shown. It isn't stored anywhere readable."""

    staff: StaffResponse
    temporary_password: str

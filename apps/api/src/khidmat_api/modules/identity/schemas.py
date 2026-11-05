"""Request and response shapes for authentication."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from khidmat_api.modules.identity.models import Role


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    # Upper bound stops very long inputs from wasting password-hashing work.
    password: str = Field(min_length=1, max_length=256)


class CurrentUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str | None
    name: str | None
    role: Role

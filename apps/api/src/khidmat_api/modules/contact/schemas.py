"""Request and response shapes for the contact form."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from khidmat_api.core.phone import normalize_phone


class ContactMessageCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
    phone: Annotated[str, Field(max_length=32)]
    message: Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=2000)]
    locale: Literal["en", "ur"] = "en"
    # Hidden from people by the form. Anything filled in here came from a bot.
    website: Annotated[str, Field(max_length=200)] = ""

    @field_validator("phone")
    @classmethod
    def _normalize_phone(cls, value: str) -> str:
        return normalize_phone(value)


class ContactMessageAccepted(BaseModel):
    status: Literal["received"] = "received"

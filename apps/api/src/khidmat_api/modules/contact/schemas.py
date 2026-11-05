"""Request and response shapes for the contact form."""

import re
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

_PAKISTAN_LOCAL_MOBILE = re.compile(r"^03\d{9}$")
_E164_PHONE = re.compile(r"^\+[1-9]\d{7,14}$")
_PHONE_SEPARATORS = re.compile(r"[\s()-]")


def normalize_phone(value: str) -> str:
    """Convert local and international formats to E.164, e.g. 0300-1234567 -> +923001234567."""
    phone = _PHONE_SEPARATORS.sub("", value)
    if _PAKISTAN_LOCAL_MOBILE.match(phone):
        phone = f"+92{phone[1:]}"
    elif phone.startswith("00"):
        phone = f"+{phone[2:]}"
    if not _E164_PHONE.match(phone):
        raise ValueError("Enter a valid phone number")
    return phone


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

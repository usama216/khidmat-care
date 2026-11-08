"""Phone number normalization shared by every module that accepts a number."""

import re

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

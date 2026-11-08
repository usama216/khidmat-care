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


def like_patterns(search: str) -> list[str]:
    """ILIKE patterns for a name or phone search, escaped so user input can't act as wildcards.

    Phones are stored as +923001234567, so "0300 123" also matches as "+92300123".
    """
    text = search.strip()
    if not text:
        return []

    def escape(value: str) -> str:
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")

    patterns = [f"%{escape(text)}%"]
    digits = _PHONE_SEPARATORS.sub("", text)
    if digits.isdigit() and digits.startswith("0") and len(digits) > 1:
        patterns.append(f"%{escape('+92' + digits[1:])}%")
    return patterns

"""Field encryption for highly sensitive values such as CNIC numbers."""

import base64
import hashlib
import hmac

from cryptography.fernet import Fernet

from khidmat_api.core.config import Settings


def _fernet(settings: Settings) -> Fernet:
    # Any strong secret becomes a valid Fernet key, so operators only manage one random value.
    digest = hashlib.sha256(settings.encryption_key.get_secret_value().encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_text(value: str, settings: Settings) -> str:
    return _fernet(settings).encrypt(value.encode()).decode()


def decrypt_text(value: str, settings: Settings) -> str:
    return _fernet(settings).decrypt(value.encode()).decode()


def keyed_hash(value: str, settings: Settings) -> str:
    """Lets the database enforce uniqueness without storing the value."""
    secret = settings.encryption_key.get_secret_value().encode()
    return hmac.new(secret, value.encode(), hashlib.sha256).hexdigest()

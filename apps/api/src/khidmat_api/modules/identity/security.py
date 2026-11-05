"""Password hashing and token creation. Nothing here touches the database."""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from khidmat_api.core.config import Settings

_JWT_ALGORITHM = "HS256"
_ACCESS_TOKEN_TYPE = "access"  # noqa: S105

_password_hasher = PasswordHasher()
# Verified when the email is unknown, so a login takes the same time either way and
# response timing can't reveal which emails have accounts.
_DUMMY_HASH = _password_hasher.hash(secrets.token_urlsafe(32))


def hash_password(password: str) -> str:
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    try:
        _password_hasher.verify(password_hash or _DUMMY_HASH, password)
    except VerificationError, InvalidHashError:
        return False
    return password_hash is not None


def create_access_token(user_id: UUID, settings: Settings) -> str:
    now = datetime.now(UTC)
    return jwt.encode(
        {
            "sub": str(user_id),
            "type": _ACCESS_TOKEN_TYPE,
            "iat": now,
            "exp": now + timedelta(minutes=settings.access_token_minutes),
            "jti": uuid4().hex,
        },
        settings.jwt_secret.get_secret_value(),
        algorithm=_JWT_ALGORITHM,
    )


def read_access_token(token: str, settings: Settings) -> UUID | None:
    """Return the user id from a valid access token, or None."""
    try:
        claims = jwt.decode(
            token,
            settings.jwt_secret.get_secret_value(),
            algorithms=[_JWT_ALGORITHM],
            options={"require": ["sub", "exp", "type"]},
        )
        if claims["type"] != _ACCESS_TOKEN_TYPE:
            return None
        return UUID(claims["sub"])
    except jwt.InvalidTokenError, ValueError:
        return None


def new_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    # The token is already high-entropy, so a fast hash is safe. A leaked table is unusable.
    return hashlib.sha256(token.encode()).hexdigest()

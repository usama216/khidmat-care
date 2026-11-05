"""Request dependencies for authentication and role checks."""

from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import Depends, Request

from khidmat_api.core.config import Settings
from khidmat_api.core.database import SessionDep
from khidmat_api.core.errors import ForbiddenError, UnauthorizedError
from khidmat_api.modules.identity.models import Role, User
from khidmat_api.modules.identity.security import read_access_token

ACCESS_COOKIE = "kc_access"
REFRESH_COOKIE = "kc_refresh"

_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def get_settings_from_app(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


SettingsDep = Annotated[Settings, Depends(get_settings_from_app)]


def require_trusted_origin(request: Request, settings: SettingsDep) -> None:
    """Reject cross-site writes that browsers would otherwise send with our cookies."""
    if request.method in _SAFE_METHODS:
        return
    origin = request.headers.get("origin")
    if origin is not None and origin not in settings.cors_origins:
        raise ForbiddenError("This request origin is not allowed.")


async def get_current_user(
    request: Request,
    session: SessionDep,
    settings: SettingsDep,
    _: Annotated[None, Depends(require_trusted_origin)],
) -> User:
    token = request.cookies.get(ACCESS_COOKIE)
    user_id = read_access_token(token, settings) if token else None
    if user_id is None:
        raise UnauthorizedError
    # Loaded on every request, so suspending an account takes effect immediately.
    user = await session.get(User, user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError
    return user


CurrentUserDep = Annotated[User, Depends(get_current_user)]


def require_role(*roles: Role) -> Callable[[User], Awaitable[User]]:
    async def _check_role(user: CurrentUserDep) -> User:
        if user.role not in roles:
            raise ForbiddenError
        return user

    return _check_role


AdminUserDep = Annotated[User, Depends(require_role(Role.ADMIN))]

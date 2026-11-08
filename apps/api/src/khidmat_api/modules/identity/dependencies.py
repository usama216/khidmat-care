"""Request dependencies for authentication and permission checks."""

from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import Depends, Request

from khidmat_api.core.config import Settings
from khidmat_api.core.database import SessionDep
from khidmat_api.core.errors import ForbiddenError, UnauthorizedError
from khidmat_api.modules.identity.models import Role, User
from khidmat_api.modules.identity.permissions import Permission, permissions_for
from khidmat_api.modules.identity.security import read_access_token

ACCESS_COOKIE = "kc_access"
REFRESH_COOKIE = "kc_refresh"

_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


class PasswordChangeRequiredError(ForbiddenError):
    code = "password_change_required"
    message = "Please change your temporary password to continue."


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
    claims = read_access_token(token, settings) if token else None
    if claims is None:
        raise UnauthorizedError
    # Loaded on every request, so suspending an account takes effect immediately.
    user = await session.get(User, claims.user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError
    # Tokens issued before a password change stop working straight away.
    if user.password_changed_at is not None and claims.issued_at < int(
        user.password_changed_at.timestamp()
    ):
        raise UnauthorizedError
    return user


CurrentUserDep = Annotated[User, Depends(get_current_user)]


def require_permission(permission: Permission) -> Callable[[User], Awaitable[User]]:
    async def _check_permission(user: CurrentUserDep) -> User:
        if permission not in permissions_for(user.role):
            raise ForbiddenError
        if user.must_change_password:
            raise PasswordChangeRequiredError
        return user

    return _check_permission


def require_any_permission(*permissions: Permission) -> Callable[[User], Awaitable[User]]:
    async def _check_any(user: CurrentUserDep) -> User:
        if not permissions_for(user.role) & set(permissions):
            raise ForbiddenError
        if user.must_change_password:
            raise PasswordChangeRequiredError
        return user

    return _check_any


DashboardViewerDep = Annotated[User, Depends(require_permission(Permission.DASHBOARD_VIEW))]
MessagesManagerDep = Annotated[User, Depends(require_permission(Permission.MESSAGES_MANAGE))]
CatalogManagerDep = Annotated[User, Depends(require_permission(Permission.CATALOG_MANAGE))]
AuditViewerDep = Annotated[User, Depends(require_permission(Permission.AUDIT_VIEW))]
StaffManagerDep = Annotated[User, Depends(require_permission(Permission.STAFF_MANAGE))]
ProviderVerifierDep = Annotated[User, Depends(require_permission(Permission.PROVIDERS_VERIFY))]
BookingManagerDep = Annotated[User, Depends(require_permission(Permission.BOOKINGS_MANAGE))]
ComplaintManagerDep = Annotated[User, Depends(require_permission(Permission.COMPLAINTS_MANAGE))]
FinanceManagerDep = Annotated[User, Depends(require_permission(Permission.FINANCE_MANAGE))]
SettingsManagerDep = Annotated[User, Depends(require_permission(Permission.SETTINGS_MANAGE))]
# Ratings matter both to complaint handling and to deciding whether a physio stays active.
ReviewViewerDep = Annotated[
    User,
    Depends(require_any_permission(Permission.COMPLAINTS_MANAGE, Permission.PROVIDERS_VERIFY)),
]


def require_role(role: Role) -> Callable[[User], Awaitable[User]]:
    async def _check_role(user: CurrentUserDep) -> User:
        if user.role != role:
            raise ForbiddenError
        return user

    return _check_role


PatientUserDep = Annotated[User, Depends(require_role(Role.PATIENT))]
ProviderUserDep = Annotated[User, Depends(require_role(Role.PROVIDER))]

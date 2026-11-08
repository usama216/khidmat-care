"""What each staff role may do. New features add a permission here, not role checks in routes."""

from enum import StrEnum

from khidmat_api.modules.identity.models import Role


class Permission(StrEnum):
    DASHBOARD_VIEW = "dashboard.view"
    MESSAGES_MANAGE = "messages.manage"
    CATALOG_MANAGE = "catalog.manage"
    AUDIT_VIEW = "audit.view"
    STAFF_MANAGE = "staff.manage"
    PROVIDERS_VERIFY = "providers.verify"
    BOOKINGS_MANAGE = "bookings.manage"
    COMPLAINTS_MANAGE = "complaints.manage"
    FINANCE_MANAGE = "finance.manage"
    SETTINGS_MANAGE = "settings.manage"


STAFF_ROLES = frozenset(
    {Role.ADMIN, Role.OPERATIONS, Role.VERIFICATION, Role.FINANCE, Role.SUPPORT}
)

_ROLE_PERMISSIONS: dict[Role, frozenset[Permission]] = {
    Role.ADMIN: frozenset(Permission),
    Role.OPERATIONS: frozenset(
        {
            Permission.DASHBOARD_VIEW,
            Permission.MESSAGES_MANAGE,
            Permission.CATALOG_MANAGE,
            Permission.BOOKINGS_MANAGE,
            Permission.COMPLAINTS_MANAGE,
        }
    ),
    Role.VERIFICATION: frozenset({Permission.DASHBOARD_VIEW, Permission.PROVIDERS_VERIFY}),
    Role.FINANCE: frozenset(
        {Permission.DASHBOARD_VIEW, Permission.FINANCE_MANAGE, Permission.SETTINGS_MANAGE}
    ),
    Role.SUPPORT: frozenset(
        {
            Permission.DASHBOARD_VIEW,
            Permission.MESSAGES_MANAGE,
            Permission.BOOKINGS_MANAGE,
            Permission.COMPLAINTS_MANAGE,
        }
    ),
}


def permissions_for(role: Role) -> frozenset[Permission]:
    return _ROLE_PERMISSIONS.get(role, frozenset())

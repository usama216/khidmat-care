"""Imports every module's models so Base.metadata knows all tables (for Alembic and tests)."""

from khidmat_api.core.models import Base
from khidmat_api.modules.audit import models as audit
from khidmat_api.modules.bookings import models as bookings
from khidmat_api.modules.catalog import models as catalog
from khidmat_api.modules.contact import models as contact
from khidmat_api.modules.feedback import models as feedback
from khidmat_api.modules.files import models as files
from khidmat_api.modules.identity import models as identity
from khidmat_api.modules.notifications import models as notifications
from khidmat_api.modules.patients import models as patients
from khidmat_api.modules.payments import models as payments
from khidmat_api.modules.providers import models as providers
from khidmat_api.modules.wallet import models as wallet

__all__ = [
    "Base",
    "audit",
    "bookings",
    "catalog",
    "contact",
    "feedback",
    "files",
    "identity",
    "notifications",
    "patients",
    "payments",
    "providers",
    "wallet",
]

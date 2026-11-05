"""Vercel entrypoint. Vercel looks for a module-level FastAPI instance named `app` here."""

import sys
from pathlib import Path

# The package uses a src layout, so make it importable however the host installs dependencies.
sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from khidmat_api.main import create_app

app = create_app()

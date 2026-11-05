# Khidmat Care API

FastAPI backend. Python 3.14, PostgreSQL, SQLAlchemy 2 (async), Alembic.

## Setup

Requires [uv](https://docs.astral.sh/uv/) and PostgreSQL 18. Run from `apps/api` unless noted.

Use either of these for PostgreSQL:

- **Installed on your machine:** connect as an admin and run:
  ```sql
  CREATE ROLE khidmat LOGIN CREATEDB PASSWORD 'khidmat_local_only';
  CREATE DATABASE khidmat OWNER khidmat;
  ```
- **Docker:** `docker compose -f ../../infra/docker-compose.yml up -d`. Use this only if port 5432 is free.

Then:

```bash
cp .env.example .env
uv sync
uv run alembic upgrade head                              # Create the tables
uv run python -m khidmat_api.seed                        # Areas and services
uv run uvicorn khidmat_api.main:create_app --factory --reload --port 8001
```

- API docs: http://localhost:8001/docs (off in production)
- Liveness: `/healthz`. Readiness, including the database: `/readyz`

## Checks

```bash
uv run ruff check .
uv run ruff format --check .
uv run mypy
uv run pytest
```

Tests use a real Postgres. They drop and recreate `khidmat_test` and `khidmat_test_migrations` on the local server. Set `TEST_DATABASE_URL` to use another server, and never point it at a database you care about.

## Changing the database

```bash
uv run alembic revision --autogenerate -m "add something"   # Then review the generated file
uv run alembic upgrade head
```

Always read a generated migration before running it. A test fails if the models and migrations don't match.

## Deploying to Vercel

Set the Vercel project's Root Directory to `apps/api`. `app.py` is the entrypoint, and `vercel.json` runs it in Sydney (`syd1`), next to the database. Set these environment variables:

| Variable | Value |
|---|---|
| `ENVIRONMENT` | `production` |
| `DATABASE_URL` | `postgresql+asyncpg://USER:PASSWORD@RDS_ENDPOINT:5432/DB_NAME?ssl=require` |
| `DB_NULL_POOL` | `true` |
| `CORS_ORIGINS` | The frontend's URL, no trailing slash |
| `ALLOWED_HOSTS` | The API's own host name, no `https://` |
| `CLIENT_IP_HEADER` | `x-forwarded-for` |
| `IP_HASH_SECRET` | A long random value, see `.env.example` |

Migrations don't run on Vercel. Run `uv run alembic upgrade head` from your machine with `DATABASE_URL` pointing at the production database.

## Architecture

A modular monolith: one deployable app and one database, split into modules that could be extracted later.

```
src/khidmat_api/
  core/        Config, database, errors, logging, middleware. Knows nothing about features.
  modules/     One folder per business area (identity, providers, bookings, ...)
    <module>/
      models.py    Tables
      schemas.py   Request and response shapes (Pydantic)
      service.py   Business logic and transactions
      router.py    HTTP only: validate, call the service, return
  main.py      Application factory
  seed.py      Reference data
```

### Rules

1. **Routers stay thin.** Business logic goes in services, so it can be tested without HTTP.
2. **Modules talk through services.** A module never queries another module's tables or imports its models. Tables reference each other by foreign key, and models have no relationships across modules.
3. **Services own the transaction.** A service commits explicitly, so a failed commit becomes an error response.
4. **Every error is an `AppError`** and uses one JSON shape. Clients branch on `code`.
5. **The database enforces the rules too.** Important rules are CHECK and UNIQUE constraints as well as application code.
6. **Money is whole rupees (`_pkr`, integer)** and commission is basis points. Never floats.
7. **Times are UTC (`timestamptz`).** Convert to Asia/Karachi only for display.
8. **Sensitive data stays out of logs and audit metadata.** No CNICs, medical notes, OTPs, tokens or query strings.
9. **New routes go under `/api/v1`.** Breaking changes get a new version.

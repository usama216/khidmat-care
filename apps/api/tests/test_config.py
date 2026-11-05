import pytest
from pydantic import ValidationError

from khidmat_api.core.config import Environment, Settings

ASYNC_URL = "postgresql+asyncpg://user:top-secret@localhost/db"


def _settings(**values: object) -> Settings:
    return Settings(_env_file=None, database_url=ASYNC_URL, **values)  # type: ignore[arg-type]


def test_rejects_a_sync_database_driver() -> None:
    with pytest.raises(ValidationError, match="postgresql\\+asyncpg"):
        Settings(_env_file=None, database_url="postgresql://user@localhost/db")


def test_database_password_is_not_in_repr() -> None:
    assert "top-secret" not in repr(_settings())


def test_splits_comma_separated_lists(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "https://a.example, https://b.example")
    assert _settings().cors_origins == ["https://a.example", "https://b.example"]


@pytest.mark.parametrize("environment", [Environment.STAGING, Environment.PRODUCTION])
@pytest.mark.parametrize("field", ["cors_origins", "allowed_hosts"])
def test_rejects_wildcards_when_deployed(environment: Environment, field: str) -> None:
    with pytest.raises(ValidationError, match="cannot contain"):
        _settings(
            environment=environment,
            ip_hash_secret="test-secret",
            jwt_secret="x" * 48,
            **{field: ["*"]},
        )


def test_only_deployed_environments_use_json_logs() -> None:
    assert _settings(environment=Environment.LOCAL).json_logs is False
    assert (
        _settings(
            environment=Environment.PRODUCTION, ip_hash_secret="test-secret", jwt_secret="x" * 48
        ).json_logs
        is True
    )


@pytest.mark.parametrize("secret", [None, "too-short"])
def test_deployed_settings_require_a_real_jwt_secret(secret: str | None) -> None:
    values: dict[str, object] = {"environment": Environment.PRODUCTION, "ip_hash_secret": "s"}
    if secret:
        values["jwt_secret"] = secret
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        _settings(**values)

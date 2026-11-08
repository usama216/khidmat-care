"""File storage. A local folder in development, S3 when a bucket is configured.

Both backends work the same way for the browser: it POSTs a form to the URL it was given. S3
receives the file directly, which avoids the request size limit on serverless hosts.
"""

import asyncio
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, Protocol

import boto3
import jwt
from botocore.config import Config
from botocore.exceptions import ClientError
from pydantic import BaseModel

from khidmat_api.core.config import Settings
from khidmat_api.core.errors import ServiceUnavailableError

LOCAL_UPLOAD_PATH = "/api/v1/files/local-upload"
LOCAL_DOWNLOAD_PATH = "/api/v1/files/local"
_LINK_LIFETIME = timedelta(minutes=5)
_JWT_ALGORITHM = "HS256"


class UploadTicket(BaseModel):
    url: str
    fields: dict[str, str]


class Storage(Protocol):
    def upload_ticket(self, key: str, mime_type: str, max_bytes: int) -> UploadTicket: ...

    async def size(self, key: str) -> int | None: ...

    async def read_start(self, key: str, length: int) -> bytes | None: ...

    def download_url(self, key: str) -> str: ...

    async def delete(self, key: str) -> None: ...


class LocalStorage:
    def __init__(self, root: Path, secret: str) -> None:
        self.root = root.resolve()
        self.secret = secret

    def path_for(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if not path.is_relative_to(self.root):
            raise ValueError("Invalid storage key")
        return path

    def _token(self, purpose: str, **claims: object) -> str:
        expires = datetime.now(UTC) + _LINK_LIFETIME
        return jwt.encode(
            {"purpose": purpose, "exp": expires, **claims}, self.secret, algorithm=_JWT_ALGORITHM
        )

    def read_token(self, token: str, purpose: str) -> dict[str, Any] | None:
        try:
            claims: dict[str, Any] = jwt.decode(token, self.secret, algorithms=[_JWT_ALGORITHM])
        except jwt.InvalidTokenError:
            return None
        return claims if claims.get("purpose") == purpose else None

    def upload_ticket(self, key: str, mime_type: str, max_bytes: int) -> UploadTicket:
        token = self._token("local-upload", key=key, mime=mime_type, max=max_bytes)
        return UploadTicket(url=LOCAL_UPLOAD_PATH, fields={"token": token})

    def write(self, key: str, data: bytes) -> None:
        path = self.path_for(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    async def size(self, key: str) -> int | None:
        path = self.path_for(key)
        return await asyncio.to_thread(lambda: path.stat().st_size if path.exists() else None)

    async def read_start(self, key: str, length: int) -> bytes | None:
        path = self.path_for(key)

        def _read() -> bytes | None:
            if not path.exists():
                return None
            with path.open("rb") as handle:
                return handle.read(length)

        return await asyncio.to_thread(_read)

    def download_url(self, key: str) -> str:
        return f"{LOCAL_DOWNLOAD_PATH}/{self._token('local-download', key=key)}"

    async def delete(self, key: str) -> None:
        path = self.path_for(key)
        await asyncio.to_thread(path.unlink, missing_ok=True)


class S3Storage:
    def __init__(
        self,
        bucket: str,
        region: str,
        access_key_id: str | None = None,
        secret_access_key: str | None = None,
    ) -> None:
        self.bucket = bucket
        # Without explicit keys boto3 falls back to its default chain (local development).
        self.client: Any = boto3.client(
            "s3",
            region_name=region,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            # Virtual addressing gives the regional host (bucket.s3.<region>.amazonaws.com). The
            # global host redirects requests for new buckets outside us-east-1, which a browser
            # upload can't follow.
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "virtual"},
                retries={"max_attempts": 2},
            ),
        )

    def upload_ticket(self, key: str, mime_type: str, max_bytes: int) -> UploadTicket:
        post = self.client.generate_presigned_post(
            self.bucket,
            key,
            Fields={"Content-Type": mime_type},
            Conditions=[{"Content-Type": mime_type}, ["content-length-range", 1, max_bytes]],
            ExpiresIn=int(_LINK_LIFETIME.total_seconds()),
        )
        return UploadTicket(url=post["url"], fields=post["fields"])

    async def size(self, key: str) -> int | None:
        try:
            head = await asyncio.to_thread(self.client.head_object, Bucket=self.bucket, Key=key)
        except ClientError:
            return None
        return int(head["ContentLength"])

    async def read_start(self, key: str, length: int) -> bytes | None:
        def _read() -> bytes | None:
            try:
                response = self.client.get_object(
                    Bucket=self.bucket, Key=key, Range=f"bytes=0-{length - 1}"
                )
            except ClientError:
                return None
            data: bytes = response["Body"].read()
            return data

        return await asyncio.to_thread(_read)

    def download_url(self, key: str) -> str:
        url: str = self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=int(_LINK_LIFETIME.total_seconds()),
        )
        return url

    async def delete(self, key: str) -> None:
        await asyncio.to_thread(self.client.delete_object, Bucket=self.bucket, Key=key)


class UnconfiguredStorage:
    """Deployed without a bucket. Serverless disks don't persist, so uploads are refused."""

    def _fail(self) -> ServiceUnavailableError:
        return ServiceUnavailableError("File uploads aren't configured yet.")

    def upload_ticket(self, key: str, mime_type: str, max_bytes: int) -> UploadTicket:
        raise self._fail()

    async def size(self, key: str) -> int | None:
        raise self._fail()

    async def read_start(self, key: str, length: int) -> bytes | None:
        raise self._fail()

    def download_url(self, key: str) -> str:
        raise self._fail()

    async def delete(self, key: str) -> None:
        raise self._fail()


def create_storage(settings: Settings) -> Storage:
    if settings.s3_bucket:
        secret = settings.s3_secret_access_key
        return S3Storage(
            settings.s3_bucket,
            settings.s3_region,
            settings.s3_access_key_id,
            secret.get_secret_value() if secret else None,
        )
    if settings.secure_cookies:  # Staging or production.
        return UnconfiguredStorage()
    return LocalStorage(Path(settings.local_upload_dir), settings.jwt_secret.get_secret_value())

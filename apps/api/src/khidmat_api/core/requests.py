"""Helpers for reading trusted information from a request."""

import hashlib
import hmac

from fastapi import Request

from khidmat_api.core.config import Settings


def hash_ip(ip_address: str, settings: Settings) -> str:
    """A keyed hash lets us count requests per address without storing the address."""
    secret = settings.ip_hash_secret.get_secret_value()
    return hmac.new(secret.encode(), ip_address.encode(), hashlib.sha256).hexdigest()


def client_ip(request: Request, settings: Settings) -> str:
    if settings.client_ip_header:
        forwarded = request.headers.get(settings.client_ip_header, "")
        first_hop = forwarded.split(",")[0].strip()
        if first_hop:
            return first_hop
    return request.client.host if request.client else "unknown"

"""Sending WhatsApp template messages through Meta's Cloud API.

Only approved templates can start a conversation, so every message here is a template with
positional body parameters ({{1}}, {{2}}, ...). Parameters carry no patient names, addresses or
phone numbers: a WhatsApp message can be read by anyone holding the phone.
"""

from dataclasses import dataclass
from typing import Annotated, Protocol

import httpx
import structlog
from fastapi import Depends, Request

from khidmat_api.core.config import Settings

logger = structlog.get_logger("khidmat.whatsapp")

_TIMEOUT = httpx.Timeout(10.0)


class WhatsAppError(Exception):
    """The message wasn't accepted. The text is safe to store: it never holds the token."""


@dataclass(frozen=True)
class TemplateMessage:
    to: str  # E.164, e.g. +923001234567
    template: str
    language: str
    parameters: list[str]


class WhatsAppSender(Protocol):
    enabled: bool

    async def send(self, message: TemplateMessage) -> str:
        """Send one message and return WhatsApp's message id."""
        ...


def _clean(text: str) -> str:
    # WhatsApp rejects body parameters with new lines, tabs or more than four spaces in a row.
    return " ".join(text.split())[:1000] or "-"


class CloudApiSender:
    enabled = True

    def __init__(self, phone_number_id: str, access_token: str, api_version: str) -> None:
        self._url = f"https://graph.facebook.com/{api_version}/{phone_number_id}/messages"
        self._headers = {"Authorization": f"Bearer {access_token}"}

    async def send(self, message: TemplateMessage) -> str:
        body = {
            "messaging_product": "whatsapp",
            "to": message.to.lstrip("+"),
            "type": "template",
            "template": {
                "name": message.template,
                "language": {"code": message.language},
                "components": [
                    {
                        "type": "body",
                        "parameters": [
                            {"type": "text", "text": _clean(value)} for value in message.parameters
                        ],
                    }
                ],
            },
        }
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                response = await client.post(self._url, json=body, headers=self._headers)
        except httpx.HTTPError as exc:
            raise WhatsAppError(f"Could not reach WhatsApp: {type(exc).__name__}") from exc
        data = response.json() if response.content else {}
        if response.status_code >= 400:
            error = data.get("error", {}) if isinstance(data, dict) else {}
            detail = error.get("error_data", {}).get("details") or error.get("message")
            raise WhatsAppError(f"{response.status_code} {error.get('code', '')}: {detail}"[:500])
        try:
            return str(data["messages"][0]["id"])
        except (KeyError, IndexError, TypeError) as exc:
            raise WhatsAppError("WhatsApp replied without a message id.") from exc


class DisabledSender:
    """Used when WhatsApp isn't configured, e.g. on a developer's machine. Sends nothing."""

    enabled = False

    async def send(self, message: TemplateMessage) -> str:
        logger.info("whatsapp_skipped", template=message.template)
        return ""


def create_whatsapp_sender(settings: Settings) -> WhatsAppSender:
    if settings.whatsapp_phone_number_id and settings.whatsapp_access_token:
        return CloudApiSender(
            settings.whatsapp_phone_number_id,
            settings.whatsapp_access_token.get_secret_value(),
            settings.whatsapp_api_version,
        )
    return DisabledSender()


def get_whatsapp(request: Request) -> WhatsAppSender:
    sender: WhatsAppSender = request.app.state.whatsapp
    return sender


WhatsAppDep = Annotated[WhatsAppSender, Depends(get_whatsapp)]

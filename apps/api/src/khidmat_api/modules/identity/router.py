"""Authentication endpoints. Tokens travel only in HttpOnly cookies, never in response bodies."""

from fastapi import APIRouter, Depends, Request, Response, status

from khidmat_api.core.config import Settings
from khidmat_api.core.database import SessionDep
from khidmat_api.core.requests import client_ip
from khidmat_api.modules.identity.dependencies import (
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    CurrentUserDep,
    SettingsDep,
    require_trusted_origin,
)
from khidmat_api.modules.identity.schemas import CurrentUserResponse, LoginRequest
from khidmat_api.modules.identity.service import (
    ClientInfo,
    SessionTokens,
    login,
    logout,
    refresh_session,
)

router = APIRouter(prefix="/auth", tags=["auth"], dependencies=[Depends(require_trusted_origin)])

_REFRESH_COOKIE_PATH = "/api/v1/auth"


def _client_info(request: Request, settings: Settings) -> ClientInfo:
    return ClientInfo(
        ip_address=client_ip(request, settings), user_agent=request.headers.get("user-agent")
    )


def _set_session_cookies(response: Response, tokens: SessionTokens, settings: Settings) -> None:
    response.set_cookie(
        ACCESS_COOKIE,
        tokens.access_token,
        max_age=settings.access_token_minutes * 60,
        path="/",
        httponly=True,
        secure=settings.secure_cookies,
        samesite="lax",
    )
    # Limited to the auth routes, so the long-lived token isn't sent on every request.
    response.set_cookie(
        REFRESH_COOKIE,
        tokens.refresh_token,
        max_age=settings.refresh_token_days * 86400,
        path=_REFRESH_COOKIE_PATH,
        httponly=True,
        secure=settings.secure_cookies,
        samesite="lax",
    )


def _clear_session_cookies(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        ACCESS_COOKIE, path="/", httponly=True, secure=settings.secure_cookies, samesite="lax"
    )
    response.delete_cookie(
        REFRESH_COOKIE,
        path=_REFRESH_COOKIE_PATH,
        httponly=True,
        secure=settings.secure_cookies,
        samesite="lax",
    )


@router.post("/login", summary="Sign in with email and password")
async def login_endpoint(
    payload: LoginRequest,
    request: Request,
    response: Response,
    session: SessionDep,
    settings: SettingsDep,
) -> CurrentUserResponse:
    tokens = await login(
        session, payload.email, payload.password, settings, _client_info(request, settings)
    )
    _set_session_cookies(response, tokens, settings)
    return CurrentUserResponse.model_validate(tokens.user)


@router.post("/refresh", summary="Renew the session")
async def refresh_endpoint(
    request: Request, response: Response, session: SessionDep, settings: SettingsDep
) -> CurrentUserResponse:
    tokens = await refresh_session(
        session,
        request.cookies.get(REFRESH_COOKIE),
        settings,
        _client_info(request, settings),
    )
    _set_session_cookies(response, tokens, settings)
    return CurrentUserResponse.model_validate(tokens.user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Sign out")
async def logout_endpoint(
    request: Request, response: Response, session: SessionDep, settings: SettingsDep
) -> None:
    await logout(session, request.cookies.get(REFRESH_COOKIE))
    _clear_session_cookies(response, settings)


@router.get("/me", summary="The signed-in user")
async def me(user: CurrentUserDep) -> CurrentUserResponse:
    return CurrentUserResponse.model_validate(user)

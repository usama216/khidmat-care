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
from khidmat_api.modules.identity.schemas import (
    ChangePasswordRequest,
    CurrentUserResponse,
    LoginRequest,
    RegisterRequest,
)
from khidmat_api.modules.identity.service import (
    ClientInfo,
    SessionTokens,
    change_password,
    login,
    logout,
    refresh_session,
    register,
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


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    summary="Create a patient or physiotherapist account",
)
async def register_endpoint(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    session: SessionDep,
    settings: SettingsDep,
) -> CurrentUserResponse:
    tokens = await register(session, payload, settings, _client_info(request, settings))
    _set_session_cookies(response, tokens, settings)
    return CurrentUserResponse.from_user(tokens.user)


@router.post("/change-password", summary="Change your own password")
async def change_password_endpoint(
    payload: ChangePasswordRequest,
    user: CurrentUserDep,
    request: Request,
    response: Response,
    session: SessionDep,
    settings: SettingsDep,
) -> CurrentUserResponse:
    tokens = await change_password(
        session,
        user,
        payload.current_password,
        payload.new_password,
        settings,
        _client_info(request, settings),
    )
    _set_session_cookies(response, tokens, settings)
    return CurrentUserResponse.from_user(tokens.user)


@router.post("/login", summary="Sign in with a phone number or email, and a password")
async def login_endpoint(
    payload: LoginRequest,
    request: Request,
    response: Response,
    session: SessionDep,
    settings: SettingsDep,
) -> CurrentUserResponse:
    tokens = await login(
        session, payload.identifier, payload.password, settings, _client_info(request, settings)
    )
    _set_session_cookies(response, tokens, settings)
    return CurrentUserResponse.from_user(tokens.user)


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
    return CurrentUserResponse.from_user(tokens.user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Sign out")
async def logout_endpoint(
    request: Request, response: Response, session: SessionDep, settings: SettingsDep
) -> None:
    await logout(session, request.cookies.get(REFRESH_COOKIE))
    _clear_session_cookies(response, settings)


@router.get("/me", summary="The signed-in user")
async def me(user: CurrentUserDep) -> CurrentUserResponse:
    return CurrentUserResponse.from_user(user)

"""HTTP routes for user authentication, under /api/v1/auth."""

from __future__ import annotations

from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.auth.service import AuthError, AuthService


class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=256)


class VerifyEmailRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    code: str = Field(min_length=4, max_length=10)


class ResendOtpRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=256)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _error(exc: AuthError) -> JSONResponse:
    headers = {}
    if exc.retry_after:
        headers["Retry-After"] = str(exc.retry_after)
    return JSONResponse(
        status_code=exc.status,
        content={"detail": exc.detail, "code": exc.code},
        headers=headers,
    )


def build_auth_router(service: AuthService) -> APIRouter:
    router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

    @router.post("/signup", status_code=201)
    def signup(payload: SignupRequest, request: Request):
        try:
            return service.signup(
                name=payload.name,
                email=payload.email,
                password=payload.password,
                client_ip=_client_ip(request),
            )
        except AuthError as exc:
            return _error(exc)

    @router.post("/verify-email")
    def verify_email(payload: VerifyEmailRequest):
        try:
            return service.verify_email(email=payload.email, code=payload.code)
        except AuthError as exc:
            return _error(exc)

    @router.post("/resend-otp")
    def resend_otp(payload: ResendOtpRequest):
        try:
            return service.resend_otp(email=payload.email)
        except AuthError as exc:
            return _error(exc)

    @router.post("/login")
    def login(payload: LoginRequest, request: Request):
        try:
            return service.login(
                email=payload.email,
                password=payload.password,
                client_ip=_client_ip(request),
            )
        except AuthError as exc:
            return _error(exc)

    @router.post("/logout", status_code=204)
    def logout() -> None:
        # Sessions are stateless bearer tokens; logging out is the client
        # discarding its token. The endpoint exists so clients have one
        # explicit place to end a session (and future revocation hooks).
        return None

    @router.get("/me")
    def me(authorization: str | None = Header(default=None)):
        token = ""
        if authorization and authorization.lower().startswith("bearer "):
            token = authorization[7:].strip()
        try:
            return service.me(token)
        except AuthError as exc:
            return _error(exc)

    return router

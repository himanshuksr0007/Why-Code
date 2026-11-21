"""HTTP routes for user authentication, under /api/v1/auth.

Sign-in itself happens at Clerk (the frontend drives it). What remains
here is the bridge: exchange a Clerk session token for an app session,
plus the session housekeeping endpoints.
"""

from __future__ import annotations

from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.auth.service import AuthError, AuthService


class SocialRequest(BaseModel):
    token: str = Field(min_length=10, max_length=4096)


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

    @router.post("/social")
    def social(payload: SocialRequest, request: Request):
        """Exchange a verified Clerk session token (email, Google or
        GitHub sign-in) for a WhyCode session on the account with the
        same email."""
        try:
            return service.exchange_clerk_token(
                token=payload.token,
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

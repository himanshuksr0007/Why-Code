"""User authentication: Clerk verifies identity (email, Google,
GitHub); this package exchanges Clerk sessions for app sessions and
stores the account records the rest of the product hangs off."""

from app.auth.service import AuthService, build_auth_service

__all__ = ["AuthService", "build_auth_service"]

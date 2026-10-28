"""User authentication: email + password accounts with OTP email
verification, stored in Neo4j (SQLite fallback), passwords hashed with
Argon2id, OTP codes delivered through Gmail SMTP."""

from app.auth.service import AuthService, build_auth_service

__all__ = ["AuthService", "build_auth_service"]

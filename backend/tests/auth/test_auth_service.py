"""The Clerk-bridge auth flows, on the SQLite store.

Identity verification itself is Clerk's job; what these tests pin down
is the part this service owns: find-or-create by verified email, one
account per email across providers, and app-session issuance.
"""

from __future__ import annotations

import pytest

from app.auth.service import AuthError, AuthService, RateLimiter
from app.auth.store import SQLiteAuthStore, UserRecord


@pytest.fixture()
def service(tmp_path) -> tuple[AuthService, SQLiteAuthStore]:
    store = SQLiteAuthStore(str(tmp_path / "auth.db"))
    return AuthService(store, secret="test-secret", limiter=RateLimiter()), store


def test_social_login_creates_verified_account(service) -> None:
    svc, store = service
    session = svc.social_login(
        email="grace@gmail.com", name="Grace Hopper",
        provider="oauth_google", client_ip="1.2.3.4",
    )
    assert session["token"]
    assert session["user"]["email"] == "grace@gmail.com"
    assert session["user"]["email_verified"] is True
    stored = store.get_user_by_email("grace@gmail.com")
    assert stored is not None and stored.email_verified is True

    me = svc.me(session["token"])
    assert me["user"]["email"] == "grace@gmail.com"


def test_social_login_is_one_account_per_email(service) -> None:
    svc, _ = service
    first = svc.social_login(
        email="ada@gmail.com", name="Ada",
        provider="oauth_google", client_ip="1.2.3.4",
    )
    second = svc.social_login(
        email="ada@gmail.com", name="Ada",
        provider="oauth_github", client_ip="1.2.3.4",
    )
    third = svc.social_login(
        email="ada@gmail.com", name="Ada",
        provider="clerk_email", client_ip="1.2.3.4",
    )
    assert first["user"]["id"] == second["user"]["id"] == third["user"]["id"]


def test_social_login_links_preexisting_account_record(service) -> None:
    """Accounts created before the Clerk migration (e.g. by the retired
    direct sign-up) keep their id: the first Clerk sign-in with the same
    email adopts the record and marks it verified."""
    svc, store = service
    store.create_user(
        UserRecord(
            id="usr_legacy1",
            name="Ada",
            email="ada@gmail.com",
            password_hash="$argon2id$legacy",
            email_verified=False,
            created_at="2026-11-01T00:00:00+00:00",
            updated_at="2026-11-01T00:00:00+00:00",
        )
    )
    session = svc.social_login(
        email="ada@gmail.com", name="Ada",
        provider="oauth_google", client_ip="1.2.3.4",
    )
    assert session["user"]["id"] == "usr_legacy1"
    assert store.get_user_by_email("ada@gmail.com").email_verified is True


def test_social_login_rejects_malformed_email(service) -> None:
    svc, _ = service
    with pytest.raises(AuthError) as exc:
        svc.social_login(
            email="not-an-email", name="Ada",
            provider="oauth_google", client_ip="1.2.3.4",
        )
    assert exc.value.code == "invalid_email"


def test_social_login_rate_limit(service) -> None:
    svc, _ = service
    for _ in range(20):
        svc.social_login(
            email="ada@gmail.com", name="Ada",
            provider="oauth_google", client_ip="1.2.3.4",
        )
    with pytest.raises(AuthError) as exc:
        svc.social_login(
            email="ada@gmail.com", name="Ada",
            provider="oauth_google", client_ip="1.2.3.4",
        )
    assert exc.value.code == "rate_limited"


def test_me_rejects_garbage_token(service) -> None:
    svc, _ = service
    with pytest.raises(AuthError) as exc:
        svc.me("not-a-token")
    assert exc.value.code == "no_session"


def test_exchange_rejects_when_clerk_not_configured(service) -> None:
    svc, _ = service
    with pytest.raises(AuthError) as exc:
        svc.exchange_clerk_token(token="x" * 40, client_ip="1.2.3.4")
    assert exc.value.code == "social_not_configured"
    assert exc.value.status == 503

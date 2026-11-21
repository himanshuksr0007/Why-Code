"""The auth flows end to end, on the SQLite store with a capturing mailer."""

from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timedelta, timezone

import pytest

from app.auth.service import AuthError, AuthService, OTP_PURPOSE_VERIFY, RateLimiter
from app.auth.store import SQLiteAuthStore


class CapturingMailer:
    def __init__(self) -> None:
        self.sent: list[tuple[str, str]] = []

    def send_otp(self, to: str, code: str, *, purpose: str) -> None:
        self.sent.append((to, code))

    def code_for(self, email: str) -> str:
        return [code for to, code in self.sent if to == email][-1]


@pytest.fixture()
def service(tmp_path) -> tuple[AuthService, CapturingMailer, SQLiteAuthStore]:
    store = SQLiteAuthStore(str(tmp_path / "auth.db"))
    mailer = CapturingMailer()
    return AuthService(store, mailer, secret="test-secret", limiter=RateLimiter()), mailer, store


def signup_and_verify(service, mailer, email="ada@gmail.com", password="passw0rd9", name="Ada"):
    service.signup(name=name, email=email, password=password, client_ip="1.2.3.4")
    return service.verify_email(email=email, code=mailer.code_for(email))


def test_full_lifecycle(service) -> None:
    svc, mailer, _ = service
    result = svc.signup(
        name="Ada", email="Ada@gmail.com", password="passw0rd9", client_ip="1.2.3.4"
    )
    assert result == {"email": "ada@gmail.com", "otp_sent": True}
    assert mailer.sent and mailer.sent[0][0] == "ada@gmail.com"

    session = svc.verify_email(email="ada@gmail.com", code=mailer.code_for("ada@gmail.com"))
    assert session["token"]
    assert session["user"]["email_verified"] is True
    assert session["user"]["name"] == "Ada"

    me = svc.me(session["token"])
    assert me["user"]["email"] == "ada@gmail.com"

    login = svc.login(email="ada@gmail.com", password="passw0rd9", client_ip="1.2.3.4")
    assert login["token"]


def test_duplicate_verified_signup_conflicts(service) -> None:
    svc, mailer, _ = service
    signup_and_verify(svc, mailer)
    with pytest.raises(AuthError) as exc:
        svc.signup(name="Ada", email="ada@gmail.com", password="passw0rd9", client_ip="1.2.3.4")
    assert exc.value.status == 409
    assert exc.value.code == "account_exists"


def test_unverified_signup_can_be_retaken(service) -> None:
    svc, mailer, store = service
    svc.signup(name="Ada", email="ada@gmail.com", password="passw0rd9", client_ip="1.2.3.4")
    first_code = mailer.code_for("ada@gmail.com")
    # Simulate the cooldown having passed by aging the challenge.
    challenge = store.get_otp("ada@gmail.com", OTP_PURPOSE_VERIFY)
    store.save_otp(
        replace(challenge, created_at=(datetime.now(timezone.utc) - timedelta(minutes=2)).isoformat())
    )
    svc.signup(name="Ada L", email="ada@gmail.com", password="newpass1x", client_ip="1.2.3.4")
    session = svc.verify_email(email="ada@gmail.com", code=mailer.code_for("ada@gmail.com"))
    assert session["user"]["name"] == "Ada L"
    # The old password no longer works; the new one does.
    with pytest.raises(AuthError):
        svc.login(email="ada@gmail.com", password="passw0rd9", client_ip="1.2.3.4")
    svc.login(email="ada@gmail.com", password="newpass1x", client_ip="1.2.3.4")
    assert first_code  # (the first code existed and was superseded)


def test_login_requires_verification(service) -> None:
    svc, mailer, _ = service
    svc.signup(name="Ada", email="ada@gmail.com", password="passw0rd9", client_ip="1.2.3.4")
    with pytest.raises(AuthError) as exc:
        svc.login(email="ada@gmail.com", password="passw0rd9", client_ip="1.2.3.4")
    assert exc.value.status == 403
    assert exc.value.code == "email_not_verified"


def test_login_errors_are_generic(service) -> None:
    svc, mailer, _ = service
    signup_and_verify(svc, mailer)
    for email, password in [
        ("ada@gmail.com", "wrongpass1"),  # wrong password
        ("ghost@gmail.com", "passw0rd9"),  # unknown account
    ]:
        with pytest.raises(AuthError) as exc:
            svc.login(email=email, password=password, client_ip="1.2.3.4")
        assert exc.value.status == 401
        assert exc.value.detail == "Invalid email or password."


def test_wrong_code_attempts_exhaust_the_challenge(service) -> None:
    svc, mailer, _ = service
    svc.signup(name="Ada", email="ada@gmail.com", password="passw0rd9", client_ip="1.2.3.4")
    good = mailer.code_for("ada@gmail.com")
    bad = "000000" if good != "000000" else "111111"
    for _ in range(5):
        with pytest.raises(AuthError) as exc:
            svc.verify_email(email="ada@gmail.com", code=bad)
        assert exc.value.code == "code_mismatch"
    with pytest.raises(AuthError) as exc:
        svc.verify_email(email="ada@gmail.com", code=good)
    assert exc.value.code == "too_many_attempts"


def test_expired_code_is_rejected(service) -> None:
    svc, mailer, store = service
    svc.signup(name="Ada", email="ada@gmail.com", password="passw0rd9", client_ip="1.2.3.4")
    challenge = store.get_otp("ada@gmail.com", OTP_PURPOSE_VERIFY)
    store.save_otp(
        replace(challenge, expires_at=(datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat())
    )
    with pytest.raises(AuthError) as exc:
        svc.verify_email(email="ada@gmail.com", code=mailer.code_for("ada@gmail.com"))
    assert exc.value.code == "code_expired"


def test_code_is_single_use(service) -> None:
    svc, mailer, _ = service
    code = None
    svc.signup(name="Ada", email="ada@gmail.com", password="passw0rd9", client_ip="1.2.3.4")
    code = mailer.code_for("ada@gmail.com")
    svc.verify_email(email="ada@gmail.com", code=code)
    with pytest.raises(AuthError) as exc:
        svc.verify_email(email="ada@gmail.com", code=code)
    assert exc.value.code == "no_pending_code"


def test_resend_cooldown_and_unknown_email_privacy(service) -> None:
    svc, mailer, _ = service
    svc.signup(name="Ada", email="ada@gmail.com", password="passw0rd9", client_ip="1.2.3.4")
    with pytest.raises(AuthError) as exc:
        svc.resend_otp(email="ada@gmail.com")
    assert exc.value.status == 429
    assert exc.value.code == "otp_cooldown"
    # Unknown addresses get the same outward answer but no mail.
    assert svc.resend_otp(email="ghost@gmail.com") == {
        "email": "ghost@gmail.com",
        "otp_sent": True,
    }
    assert all(to != "ghost@gmail.com" for to, _ in mailer.sent)


def test_weak_passwords_and_bad_emails_are_rejected(service) -> None:
    svc, _, _ = service
    for password in ["short1", "onlyletters", "12345678"]:
        with pytest.raises(AuthError) as exc:
            svc.signup(name="Ada", email="ada@gmail.com", password=password, client_ip="1.2.3.4")
        assert exc.value.status == 422
    with pytest.raises(AuthError):
        svc.signup(name="Ada", email="not-an-email", password="passw0rd9", client_ip="1.2.3.4")


def test_login_rate_limit(service) -> None:
    svc, mailer, _ = service
    signup_and_verify(svc, mailer)
    for _ in range(10):
        with pytest.raises(AuthError) as exc:
            svc.login(email="ada@gmail.com", password="wrongpass1", client_ip="9.9.9.9")
        assert exc.value.status == 401
    with pytest.raises(AuthError) as exc:
        svc.login(email="ada@gmail.com", password="wrongpass1", client_ip="9.9.9.9")
    assert exc.value.status == 429
    assert exc.value.retry_after > 0


def test_password_is_stored_hashed_only(service) -> None:
    svc, _, store = service
    svc.signup(name="Ada", email="ada@gmail.com", password="passw0rd9", client_ip="1.2.3.4")
    user = store.get_user_by_email("ada@gmail.com")
    assert user is not None
    assert user.password_hash.startswith("$argon2id$")
    assert "passw0rd9" not in user.password_hash


def test_me_rejects_bad_tokens(service) -> None:
    svc, _, _ = service
    with pytest.raises(AuthError) as exc:
        svc.me("garbage.token.here")
    assert exc.value.status == 401


def test_signup_rejects_uncommon_email_domain(service) -> None:
    svc, _, _ = service
    with pytest.raises(AuthError) as exc:
        svc.signup(
            name="Ada", email="ada@mailinator.com",
            password="passw0rd1", client_ip="1.2.3.4",
        )
    assert exc.value.code == "email_domain_not_allowed"
    assert exc.value.status == 422


def test_social_login_creates_verified_account(service) -> None:
    svc, _, store = service
    session = svc.social_login(
        email="grace@gmail.com", name="Grace Hopper",
        provider="oauth_google", client_ip="1.2.3.4",
    )
    assert session["token"]
    assert session["user"]["email"] == "grace@gmail.com"
    assert session["user"]["email_verified"] is True
    stored = store.get_user_by_email("grace@gmail.com")
    assert stored is not None and stored.email_verified is True


def test_social_login_links_to_existing_direct_account(service) -> None:
    svc, mailer, _ = service
    direct = signup_and_verify(svc, mailer, email="ada@gmail.com")
    social = svc.social_login(
        email="ada@gmail.com", name="Ada",
        provider="oauth_github", client_ip="1.2.3.4",
    )
    assert social["user"]["id"] == direct["user"]["id"]


def test_social_login_verifies_pending_direct_signup(service) -> None:
    svc, mailer, store = service
    svc.signup(
        name="Ada", email="ada@gmail.com",
        password="passw0rd1", client_ip="1.2.3.4",
    )
    pending = store.get_user_by_email("ada@gmail.com")
    assert pending is not None and pending.email_verified is False
    session = svc.social_login(
        email="ada@gmail.com", name="Ada",
        provider="oauth_google", client_ip="1.2.3.4",
    )
    assert session["user"]["id"] == pending.id
    assert store.get_user_by_email("ada@gmail.com").email_verified is True


def test_social_account_has_no_usable_password(service) -> None:
    svc, _, _ = service
    svc.social_login(
        email="grace@gmail.com", name="Grace",
        provider="oauth_google", client_ip="1.2.3.4",
    )
    with pytest.raises(AuthError) as exc:
        svc.login(
            email="grace@gmail.com", password="passw0rd1", client_ip="1.2.3.4"
        )
    assert exc.value.code == "invalid_credentials"


def test_exchange_rejects_when_clerk_not_configured(service) -> None:
    svc, _, _ = service
    with pytest.raises(AuthError) as exc:
        svc.exchange_clerk_token(token="x" * 40, client_ip="1.2.3.4")
    assert exc.value.code == "social_not_configured"
    assert exc.value.status == 503

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


def signup_and_verify(service, mailer, email="ada@example.com", password="passw0rd9", name="Ada"):
    service.signup(name=name, email=email, password=password, client_ip="1.2.3.4")
    return service.verify_email(email=email, code=mailer.code_for(email))


def test_full_lifecycle(service) -> None:
    svc, mailer, _ = service
    result = svc.signup(
        name="Ada", email="Ada@Example.COM", password="passw0rd9", client_ip="1.2.3.4"
    )
    assert result == {"email": "ada@example.com", "otp_sent": True}
    assert mailer.sent and mailer.sent[0][0] == "ada@example.com"

    session = svc.verify_email(email="ada@example.com", code=mailer.code_for("ada@example.com"))
    assert session["token"]
    assert session["user"]["email_verified"] is True
    assert session["user"]["name"] == "Ada"

    me = svc.me(session["token"])
    assert me["user"]["email"] == "ada@example.com"

    login = svc.login(email="ada@example.com", password="passw0rd9", client_ip="1.2.3.4")
    assert login["token"]


def test_duplicate_verified_signup_conflicts(service) -> None:
    svc, mailer, _ = service
    signup_and_verify(svc, mailer)
    with pytest.raises(AuthError) as exc:
        svc.signup(name="Ada", email="ada@example.com", password="passw0rd9", client_ip="1.2.3.4")
    assert exc.value.status == 409
    assert exc.value.code == "account_exists"


def test_unverified_signup_can_be_retaken(service) -> None:
    svc, mailer, store = service
    svc.signup(name="Ada", email="ada@example.com", password="passw0rd9", client_ip="1.2.3.4")
    first_code = mailer.code_for("ada@example.com")
    # Simulate the cooldown having passed by aging the challenge.
    challenge = store.get_otp("ada@example.com", OTP_PURPOSE_VERIFY)
    store.save_otp(
        replace(challenge, created_at=(datetime.now(timezone.utc) - timedelta(minutes=2)).isoformat())
    )
    svc.signup(name="Ada L", email="ada@example.com", password="newpass1x", client_ip="1.2.3.4")
    session = svc.verify_email(email="ada@example.com", code=mailer.code_for("ada@example.com"))
    assert session["user"]["name"] == "Ada L"
    # The old password no longer works; the new one does.
    with pytest.raises(AuthError):
        svc.login(email="ada@example.com", password="passw0rd9", client_ip="1.2.3.4")
    svc.login(email="ada@example.com", password="newpass1x", client_ip="1.2.3.4")
    assert first_code  # (the first code existed and was superseded)


def test_login_requires_verification(service) -> None:
    svc, mailer, _ = service
    svc.signup(name="Ada", email="ada@example.com", password="passw0rd9", client_ip="1.2.3.4")
    with pytest.raises(AuthError) as exc:
        svc.login(email="ada@example.com", password="passw0rd9", client_ip="1.2.3.4")
    assert exc.value.status == 403
    assert exc.value.code == "email_not_verified"


def test_login_errors_are_generic(service) -> None:
    svc, mailer, _ = service
    signup_and_verify(svc, mailer)
    for email, password in [
        ("ada@example.com", "wrongpass1"),  # wrong password
        ("ghost@example.com", "passw0rd9"),  # unknown account
    ]:
        with pytest.raises(AuthError) as exc:
            svc.login(email=email, password=password, client_ip="1.2.3.4")
        assert exc.value.status == 401
        assert exc.value.detail == "Invalid email or password."


def test_wrong_code_attempts_exhaust_the_challenge(service) -> None:
    svc, mailer, _ = service
    svc.signup(name="Ada", email="ada@example.com", password="passw0rd9", client_ip="1.2.3.4")
    good = mailer.code_for("ada@example.com")
    bad = "000000" if good != "000000" else "111111"
    for _ in range(5):
        with pytest.raises(AuthError) as exc:
            svc.verify_email(email="ada@example.com", code=bad)
        assert exc.value.code == "code_mismatch"
    with pytest.raises(AuthError) as exc:
        svc.verify_email(email="ada@example.com", code=good)
    assert exc.value.code == "too_many_attempts"


def test_expired_code_is_rejected(service) -> None:
    svc, mailer, store = service
    svc.signup(name="Ada", email="ada@example.com", password="passw0rd9", client_ip="1.2.3.4")
    challenge = store.get_otp("ada@example.com", OTP_PURPOSE_VERIFY)
    store.save_otp(
        replace(challenge, expires_at=(datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat())
    )
    with pytest.raises(AuthError) as exc:
        svc.verify_email(email="ada@example.com", code=mailer.code_for("ada@example.com"))
    assert exc.value.code == "code_expired"


def test_code_is_single_use(service) -> None:
    svc, mailer, _ = service
    code = None
    svc.signup(name="Ada", email="ada@example.com", password="passw0rd9", client_ip="1.2.3.4")
    code = mailer.code_for("ada@example.com")
    svc.verify_email(email="ada@example.com", code=code)
    with pytest.raises(AuthError) as exc:
        svc.verify_email(email="ada@example.com", code=code)
    assert exc.value.code == "no_pending_code"


def test_resend_cooldown_and_unknown_email_privacy(service) -> None:
    svc, mailer, _ = service
    svc.signup(name="Ada", email="ada@example.com", password="passw0rd9", client_ip="1.2.3.4")
    with pytest.raises(AuthError) as exc:
        svc.resend_otp(email="ada@example.com")
    assert exc.value.status == 429
    assert exc.value.code == "otp_cooldown"
    # Unknown addresses get the same outward answer but no mail.
    assert svc.resend_otp(email="ghost@example.com") == {
        "email": "ghost@example.com",
        "otp_sent": True,
    }
    assert all(to != "ghost@example.com" for to, _ in mailer.sent)


def test_weak_passwords_and_bad_emails_are_rejected(service) -> None:
    svc, _, _ = service
    for password in ["short1", "onlyletters", "12345678"]:
        with pytest.raises(AuthError) as exc:
            svc.signup(name="Ada", email="ada@example.com", password=password, client_ip="1.2.3.4")
        assert exc.value.status == 422
    with pytest.raises(AuthError):
        svc.signup(name="Ada", email="not-an-email", password="passw0rd9", client_ip="1.2.3.4")


def test_login_rate_limit(service) -> None:
    svc, mailer, _ = service
    signup_and_verify(svc, mailer)
    for _ in range(10):
        with pytest.raises(AuthError) as exc:
            svc.login(email="ada@example.com", password="wrongpass1", client_ip="9.9.9.9")
        assert exc.value.status == 401
    with pytest.raises(AuthError) as exc:
        svc.login(email="ada@example.com", password="wrongpass1", client_ip="9.9.9.9")
    assert exc.value.status == 429
    assert exc.value.retry_after > 0


def test_password_is_stored_hashed_only(service) -> None:
    svc, _, store = service
    svc.signup(name="Ada", email="ada@example.com", password="passw0rd9", client_ip="1.2.3.4")
    user = store.get_user_by_email("ada@example.com")
    assert user is not None
    assert user.password_hash.startswith("$argon2id$")
    assert "passw0rd9" not in user.password_hash


def test_me_rejects_bad_tokens(service) -> None:
    svc, _, _ = service
    with pytest.raises(AuthError) as exc:
        svc.me("garbage.token.here")
    assert exc.value.status == 401

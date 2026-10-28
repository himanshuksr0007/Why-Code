"""The Brevo HTTPS mailer (the transport that works where outbound
SMTP is blocked) and the build_mailer selection order."""

from __future__ import annotations

import json

import httpx
import pytest

from app.auth import mailer as mailer_module
from app.auth.mailer import BrevoApiMailer, ConsoleMailer, SmtpMailer, build_mailer


def _capture_mailer(status: int = 201):
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["api_key"] = request.headers.get("api-key")
        captured["payload"] = json.loads(request.content)
        return httpx.Response(status, json={"messageId": "x"})

    mailer = BrevoApiMailer(
        api_key="xkeysib-test",
        sender_email="studpay.inc@gmail.com",
        transport=httpx.MockTransport(handler),
    )
    return mailer, captured


def test_brevo_mailer_posts_the_code_to_the_recipient() -> None:
    mailer, captured = _capture_mailer()
    mailer.send_otp("user@example.com", "123456", purpose="verify_email")
    assert captured["url"] == "https://api.brevo.com/v3/smtp/email"
    assert captured["api_key"] == "xkeysib-test"
    payload = captured["payload"]
    assert payload["sender"]["email"] == "studpay.inc@gmail.com"
    assert payload["to"] == [{"email": "user@example.com"}]
    assert "123456" in payload["textContent"]
    assert payload["subject"] == "Your WhyCode verification code"


def test_brevo_mailer_raises_on_api_error() -> None:
    mailer, _ = _capture_mailer(status=401)
    with pytest.raises(RuntimeError, match="401"):
        mailer.send_otp("user@example.com", "123456", purpose="verify_email")


def _set_env(monkeypatch: pytest.MonkeyPatch, **values: str) -> None:
    for name in (
        "WHYCODE_BREVO_API_KEY",
        "WHYCODE_MAIL_FROM",
        "WHYCODE_GMAIL_ADDRESS",
        "WHYCODE_GMAIL_APP_PASSWORD",
        "WHYCODE_MAIL_OUTBOX",
    ):
        monkeypatch.delenv(name, raising=False)
    for name, value in values.items():
        monkeypatch.setenv(name, value)


def test_build_mailer_prefers_brevo(monkeypatch: pytest.MonkeyPatch) -> None:
    _set_env(
        monkeypatch,
        WHYCODE_BREVO_API_KEY="xkeysib-test",
        WHYCODE_GMAIL_ADDRESS="studpay.inc@gmail.com",
        WHYCODE_GMAIL_APP_PASSWORD="app-password",
    )
    mailer = build_mailer()
    assert isinstance(mailer, mailer_module.BrevoApiMailer)
    assert mailer.sender_email == "studpay.inc@gmail.com"


def test_build_mailer_uses_mail_from_as_sender(monkeypatch: pytest.MonkeyPatch) -> None:
    _set_env(
        monkeypatch,
        WHYCODE_BREVO_API_KEY="xkeysib-test",
        WHYCODE_MAIL_FROM="hello@example.com",
    )
    mailer = build_mailer()
    assert isinstance(mailer, mailer_module.BrevoApiMailer)
    assert mailer.sender_email == "hello@example.com"


def test_build_mailer_falls_back_to_smtp_then_console(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _set_env(
        monkeypatch,
        WHYCODE_GMAIL_ADDRESS="studpay.inc@gmail.com",
        WHYCODE_GMAIL_APP_PASSWORD="app-password",
    )
    assert isinstance(build_mailer(), SmtpMailer)
    _set_env(monkeypatch)
    assert isinstance(build_mailer(), ConsoleMailer)

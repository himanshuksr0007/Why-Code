"""Outgoing mail for verification codes.

Two production transports, picked in this order:

1. **Brevo HTTPS API** (recommended on Render and similar hosts —
   several PaaS providers block outbound SMTP ports, which makes
   direct SMTP fail with "Network is unreachable"):

       WHYCODE_BREVO_API_KEY   a Brevo API key (not the SMTP key)
       WHYCODE_MAIL_FROM       the verified sender address (falls
                               back to WHYCODE_GMAIL_ADDRESS)

   The sender address must be verified in Brevo (Senders & IP →
   Senders); a Gmail address can be verified as a single sender
   without owning a domain.

2. **SMTP** (Gmail with an app password by default):

       WHYCODE_GMAIL_ADDRESS       the Gmail address that sends
       WHYCODE_GMAIL_APP_PASSWORD  a Google *app password* (not the
                                   account password; needs 2-Step
                                   Verification)

   Optional overrides: WHYCODE_SMTP_HOST (default smtp.gmail.com),
   WHYCODE_SMTP_PORT (default 587).

WHYCODE_MAIL_FROM_NAME (default "WhyCode") applies to both.

When nothing is configured the console mailer is used: messages are
logged (and appended to the JSONL outbox at WHYCODE_MAIL_OUTBOX when
set). That keeps the offline demo and local development fully usable
— and it must never be the production setup, because the code then
lands in server logs instead of an inbox.
"""

from __future__ import annotations

import json
import logging
import os
import smtplib
from dataclasses import dataclass, field
from email.message import EmailMessage
from pathlib import Path
from typing import Protocol

import httpx

logger = logging.getLogger("whycode.auth.mail")

OTP_SUBJECT = "Your WhyCode verification code"


def otp_body(code: str) -> str:
    return (
        "Hi,\n\n"
        f"Your WhyCode verification code is: {code}\n\n"
        "It expires in 10 minutes and can be used once.\n"
        "If you did not request this code, you can ignore this email — "
        "your account is not affected.\n\n"
        "— WhyCode\n"
    )


class Mailer(Protocol):
    def send_otp(self, to: str, code: str, *, purpose: str) -> None: ...


@dataclass(frozen=True)
class SmtpMailer:
    host: str
    port: int
    username: str
    password: str
    from_name: str = "WhyCode"

    def send_otp(self, to: str, code: str, *, purpose: str) -> None:
        message = EmailMessage()
        message["From"] = f"{self.from_name} <{self.username}>"
        message["To"] = to
        message["Subject"] = OTP_SUBJECT
        message.set_content(otp_body(code))
        with smtplib.SMTP(self.host, self.port, timeout=20) as smtp:
            smtp.starttls()
            smtp.login(self.username, self.password)
            smtp.send_message(message)


@dataclass(frozen=True)
class BrevoApiMailer:
    """Transactional mail through Brevo's HTTPS API (port 443, so it
    works on hosts that block outbound SMTP)."""

    api_key: str
    sender_email: str
    sender_name: str = "WhyCode"
    transport: httpx.BaseTransport | None = field(default=None, repr=False)

    def send_otp(self, to: str, code: str, *, purpose: str) -> None:
        with httpx.Client(timeout=20, transport=self.transport) as client:
            response = client.post(
                "https://api.brevo.com/v3/smtp/email",
                headers={
                    "api-key": self.api_key,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                json={
                    "sender": {"name": self.sender_name, "email": self.sender_email},
                    "to": [{"email": to}],
                    "subject": OTP_SUBJECT,
                    "textContent": otp_body(code),
                },
            )
        if response.status_code >= 300:
            raise RuntimeError(
                f"Brevo API returned {response.status_code}: {response.text[:200]}"
            )


@dataclass(frozen=True)
class ConsoleMailer:
    outbox_path: str = ""

    def send_otp(self, to: str, code: str, *, purpose: str) -> None:
        logger.warning(
            "DEV MAIL (no SMTP configured) to=%s purpose=%s code=%s",
            to,
            purpose,
            code,
        )
        if self.outbox_path:
            Path(self.outbox_path).parent.mkdir(parents=True, exist_ok=True)
            with open(self.outbox_path, "a", encoding="utf-8") as handle:
                handle.write(
                    json.dumps({"to": to, "purpose": purpose, "code": code}) + "\n"
                )


def build_mailer() -> Mailer:
    def env(name: str) -> str:
        return os.environ.get(f"WHYCODE_{name}", "").strip()

    brevo_key = env("BREVO_API_KEY")
    sender = env("MAIL_FROM") or env("GMAIL_ADDRESS")
    if brevo_key and sender:
        logger.info("Auth mailer: Brevo HTTPS API from %s", sender)
        return BrevoApiMailer(
            api_key=brevo_key,
            sender_email=sender,
            sender_name=env("MAIL_FROM_NAME") or "WhyCode",
        )
    if brevo_key:
        logger.warning(
            "Auth mailer: WHYCODE_BREVO_API_KEY is set but no sender"
            " address (WHYCODE_MAIL_FROM / WHYCODE_GMAIL_ADDRESS) —"
            " falling through to the next transport"
        )

    address = env("GMAIL_ADDRESS")
    app_password = env("GMAIL_APP_PASSWORD")
    if address and app_password:
        logger.info("Auth mailer: Gmail SMTP as %s", address)
        return SmtpMailer(
            host=env("SMTP_HOST") or "smtp.gmail.com",
            port=int(env("SMTP_PORT") or "587"),
            username=address,
            password=app_password,
            from_name=env("MAIL_FROM_NAME") or "WhyCode",
        )
    logger.warning(
        "Auth mailer: WHYCODE_GMAIL_ADDRESS / WHYCODE_GMAIL_APP_PASSWORD not"
        " set — verification codes go to the console mailer (dev only)"
    )
    return ConsoleMailer(outbox_path=env("MAIL_OUTBOX"))

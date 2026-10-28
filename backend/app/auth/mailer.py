"""Outgoing mail for verification codes.

Production sends through Gmail SMTP with an app password:

    WHYCODE_GMAIL_ADDRESS       the Gmail address that sends the mail
    WHYCODE_GMAIL_APP_PASSWORD  a Google *app password* (not the account
                                password; requires 2-Step Verification)

Optional overrides: WHYCODE_SMTP_HOST (default smtp.gmail.com),
WHYCODE_SMTP_PORT (default 587), WHYCODE_MAIL_FROM_NAME (default
"WhyCode").

When no Gmail credentials are configured the console mailer is used:
messages are logged (and appended to the JSONL outbox at
WHYCODE_MAIL_OUTBOX when set). That keeps the offline demo and local
development fully usable — and it must never be the production setup,
because the code then lands in server logs instead of an inbox.
"""

from __future__ import annotations

import json
import logging
import os
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from pathlib import Path
from typing import Protocol

logger = logging.getLogger("whycode.auth.mail")


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
        subject = "Your WhyCode verification code"
        body = (
            "Hi,\n\n"
            f"Your WhyCode verification code is: {code}\n\n"
            "It expires in 10 minutes and can be used once.\n"
            "If you did not request this code, you can ignore this email — "
            "your account is not affected.\n\n"
            "— WhyCode\n"
        )
        message = EmailMessage()
        message["From"] = f"{self.from_name} <{self.username}>"
        message["To"] = to
        message["Subject"] = subject
        message.set_content(body)
        with smtplib.SMTP(self.host, self.port, timeout=20) as smtp:
            smtp.starttls()
            smtp.login(self.username, self.password)
            smtp.send_message(message)


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

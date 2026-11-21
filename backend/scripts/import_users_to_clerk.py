#!/usr/bin/env python
"""One-off migration: import existing WhyCode accounts into Clerk.

Run this ONCE, from a machine that has both the production auth-store
environment (WHYCODE_NEO4J_* for Neo4j, or WHYCODE_AUTH_DB for the
SQLite file) and the Clerk secret key:

    CLERK_SECRET_KEY=sk_live_... backend/.venv/bin/python \
        backend/scripts/import_users_to_clerk.py [--dry-run]

What it does per account:
- Skips anyone already in Clerk with the same email (idempotent —
  safe to re-run after a partial failure).
- Imports Argon2id password hashes as-is (Clerk accepts the PHC string
  with password_hasher="argon2id"), so existing users keep their
  passwords. Accounts whose stored hash is not Argon2id (the PBKDF2
  fallback) are created WITHOUT a password: those users sign in with
  an email code or reset their password — Clerk handles both.
- Sets external_id to the WhyCode user id, so the two records stay
  cross-referenced.
- Never prints password hashes or the secret key.
"""

from __future__ import annotations

import argparse
import os
import sys

import httpx

CLERK_API = "https://api.clerk.com/v1"


def load_local_users() -> list[dict]:
    """Read every account from the configured auth store."""
    uri = os.environ.get("WHYCODE_NEO4J_URI", "").strip()
    user = os.environ.get("WHYCODE_NEO4J_USER", "").strip()
    password = os.environ.get("WHYCODE_NEO4J_PASSWORD", "").strip()
    if uri and user and password:
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
        from app.graph.neo4j_driver import Neo4jClient

        client = Neo4jClient.connect(
            uri=uri,
            database=os.environ.get("WHYCODE_NEO4J_DATABASE") or "neo4j",
            user=user,
            password=password,
        )
        result = client.run("MATCH (u:User) RETURN u")
        return [dict(row["u"]) for row in result]

    import sqlite3

    db_path = os.environ.get("WHYCODE_AUTH_DB") or "artifacts/auth.db"
    if not os.path.exists(db_path):
        raise SystemExit(f"No Neo4j env and no SQLite auth DB at {db_path}")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return [dict(row) for row in conn.execute("SELECT * FROM users")]


def clerk_email_exists(client: httpx.Client, email: str) -> bool:
    resp = client.get(f"{CLERK_API}/users", params={"email_address": email})
    resp.raise_for_status()
    return len(resp.json()) > 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true",
                        help="Report what would happen; create nothing.")
    args = parser.parse_args()

    secret = (
        os.environ.get("WHYCODE_CLERK_SECRET_KEY")
        or os.environ.get("CLERK_SECRET_KEY")
        or ""
    ).strip()
    if not secret:
        raise SystemExit("Set CLERK_SECRET_KEY (or WHYCODE_CLERK_SECRET_KEY).")

    users = load_local_users()
    print(f"Local accounts: {len(users)}")

    created = skipped = passwordless = failed = 0
    with httpx.Client(
        headers={"Authorization": f"Bearer {secret}"}, timeout=30.0
    ) as client:
        for record in users:
            email = str(record.get("email", "")).strip().lower()
            name = str(record.get("name", "")).strip()
            if not email:
                continue
            if clerk_email_exists(client, email):
                skipped += 1
                print(f"  skip (already in Clerk): {email}")
                continue
            parts = name.split(" ", 1)
            payload: dict = {
                "email_address": [email],
                "first_name": parts[0] if parts else "",
                "last_name": parts[1] if len(parts) > 1 else "",
                "external_id": str(record.get("id", "")),
            }
            digest = str(record.get("password_hash", ""))
            if digest.startswith("$argon2id$"):
                payload["password_digest"] = digest
                payload["password_hasher"] = "argon2id"
            else:
                payload["skip_password_requirement"] = True
                passwordless += 1
            if args.dry_run:
                kind = "with password" if "password_digest" in payload else "passwordless"
                print(f"  would create ({kind}): {email}")
                created += 1
                continue
            resp = client.post(f"{CLERK_API}/users", json=payload)
            if resp.status_code in (200, 201):
                created += 1
                print(f"  created: {email}")
            else:
                failed += 1
                detail = resp.text[:200].replace("\n", " ")
                print(f"  FAILED {email}: HTTP {resp.status_code} {detail}")

    print(
        f"Done. created={created} skipped={skipped} "
        f"passwordless={passwordless} failed={failed}"
    )
    if passwordless:
        print(
            "Passwordless accounts sign in with an email code or a "
            "password reset — both are Clerk flows, nothing to do here."
        )
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())

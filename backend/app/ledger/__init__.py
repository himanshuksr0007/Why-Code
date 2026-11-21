"""The decision ledger: a durable, verifiable system of record for *why*.

Mines decisions deterministically (ADRs, ``WHY:``-style markers, commits,
pull-request decision blocks), verifies every evidence quote against the
repository, tracks whether each decision still describes the code, and keeps
an append-only log of who put it in force. Served to people (API, CLI), to
coding agents (MCP) and to the merge path (PR check).
"""

from app.ledger.store import LedgerError, LedgerStore
from app.ledger.why import WhyEngine

__all__ = ["LedgerError", "LedgerStore", "WhyEngine"]

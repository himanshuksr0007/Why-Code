"""Shared chat links: public links anyone can open, and private links
restricted to a whitelist of account handles. Snapshots are stored in
Neo4j (SQLite fallback); access is checked against account sessions."""

from app.shares.service import ShareService, build_share_service

__all__ = ["ShareService", "build_share_service"]

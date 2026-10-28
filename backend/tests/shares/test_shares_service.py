"""Share service: public/private access rules, whitelist handling,
owner operations — against the SQLite store with a stubbed identity
resolver (the same contract the auth service provides in production).
"""

from __future__ import annotations

import pytest

from app.shares.service import ShareError, ShareService, normalize_handle
from app.shares.store import SQLiteShareStore

USERS = {
    "tok-owner": {"id": "u1", "name": "Owner One", "email": "owner@x.com"},
    "tok-friend": {"id": "u2", "name": "Friend Two", "email": "friend.two@x.com"},
    "tok-stranger": {"id": "u3", "name": "Stranger", "email": "stranger@x.com"},
}

TURNS = [
    {"question": "Why retries?", "answer": "Because the client retries.", "answer_status": "answered"},
    {"question": "Why HTTP/3?", "answer": "", "error": "boom"},
]


@pytest.fixture()
def service(tmp_path) -> ShareService:
    store = SQLiteShareStore(str(tmp_path / "shares.db"))
    return ShareService(store, user_for_token=lambda token: USERS.get(token))


def _publish(service: ShareService, **overrides) -> dict:
    kwargs = dict(
        token="tok-owner",
        chat_id="chat-1",
        title="Retry chat",
        repo="python/httpx",
        visibility="public",
        whitelist=[],
        turns=TURNS,
    )
    kwargs.update(overrides)
    return service.publish(**kwargs)


def test_publish_requires_login(service: ShareService) -> None:
    with pytest.raises(ShareError) as caught:
        _publish(service, token="")
    assert caught.value.status == 401
    assert caught.value.code == "login_required"


def test_public_share_is_world_readable(service: ShareService) -> None:
    published = _publish(service)
    viewed = service.view(token="", share_id=published["id"])
    assert viewed["title"] == "Retry chat"
    assert viewed["owner_handle"] == "owner"
    assert [turn["question"] for turn in viewed["turns"]] == [
        "Why retries?",
        "Why HTTP/3?",
    ]


def test_private_share_access_matrix(service: ShareService) -> None:
    published = _publish(
        service, visibility="private", whitelist=["@Friend.Two", "pal@x.com"]
    )
    # Anonymous: told to log in.
    with pytest.raises(ShareError) as caught:
        service.view(token="", share_id=published["id"])
    assert caught.value.code == "login_required"
    # Signed-in stranger: not whitelisted (handle appears in the message).
    with pytest.raises(ShareError) as caught:
        service.view(token="tok-stranger", share_id=published["id"])
    assert caught.value.status == 403
    assert caught.value.code == "not_whitelisted"
    assert "@stranger" in caught.value.detail
    # Whitelisted friend (typed with @ and capitals) and the owner pass.
    assert service.view(token="tok-friend", share_id=published["id"])["turns"]
    assert service.view(token="tok-owner", share_id=published["id"])["turns"]


def test_republish_updates_same_link(service: ShareService) -> None:
    first = _publish(service)
    second = _publish(service, visibility="private", whitelist=["friend_two"])
    assert second["id"] == first["id"]
    assert second["visibility"] == "private"
    mine = service.my_share(token="tok-owner", chat_id="chat-1")
    assert mine["whitelist"] == ["friend_two"]


def test_unpublish_removes_link_for_everyone(service: ShareService) -> None:
    published = _publish(service)
    # Only the owner can unpublish.
    with pytest.raises(ShareError):
        service.unpublish(token="tok-friend", share_id=published["id"])
    service.unpublish(token="tok-owner", share_id=published["id"])
    with pytest.raises(ShareError) as caught:
        service.view(token="", share_id=published["id"])
    assert caught.value.status == 404


def test_my_share_404s_before_publishing(service: ShareService) -> None:
    with pytest.raises(ShareError) as caught:
        service.my_share(token="tok-owner", chat_id="never-shared")
    assert caught.value.code == "not_shared"


def test_normalize_handle_matches_the_frontend() -> None:
    assert normalize_handle("HimanshuKSR12") == "himanshuksr12"
    assert normalize_handle("@friend.two") == "friend_two"
    assert normalize_handle("pal@x.com") == "pal"
    assert normalize_handle("  @@weird--name!! ") == "weird_name"
    assert normalize_handle("") == "user"

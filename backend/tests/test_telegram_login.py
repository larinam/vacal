import time
import hashlib
import hmac

from fastapi.testclient import TestClient

from backend.main import app, TELEGRAM_BOT_TOKEN
from backend.model import User, AuthDetails


client = TestClient(app)


def _generate_payload(username: str, user_id: int):
    auth_date = int(time.time())
    data_check_arr = [
        f"auth_date={auth_date}",
        f"id={user_id}",
        f"username={username}",
    ]
    data_check_arr.sort()
    data_check_string = "\n".join(data_check_arr)
    secret_key = hashlib.sha256(TELEGRAM_BOT_TOKEN.encode()).digest()
    calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    return {
        "hash": calculated_hash,
        "id": user_id,
        "auth_date": auth_date,
        "username": username,
    }


def test_telegram_login_case_insensitive_sets_id():
    User.drop_collection()
    user = User(
        name="TG User",
        email="tg@example.com",
        auth_details=AuthDetails(username="tguser", telegram_username="TelegramUser"),
    ).save()

    payload = _generate_payload("telegramuser", 1)

    response = client.post("/telegram-login", json=payload)
    assert response.status_code == 200
    assert response.json().get("access_token")

    user.reload()
    assert user.auth_details.telegram_id == 1


def test_telegram_login_prioritizes_id_over_username():
    User.drop_collection()
    user = User(
        name="TG User",
        email="tg2@example.com",
        auth_details=AuthDetails(username="tguser2", telegram_id=111, telegram_username="oldusername"),
    ).save()

    payload = _generate_payload("newusername", 111)

    response = client.post("/telegram-login", json=payload)
    assert response.status_code == 200
    assert response.json().get("access_token")


def test_telegram_login_fails_if_username_has_different_id():
    User.drop_collection()
    user = User(
        name="TG User",
        email="tg3@example.com",
        auth_details=AuthDetails(username="tguser3", telegram_username="telegramuser", telegram_id=999),
    ).save()

    payload = _generate_payload("telegramuser", 111)

    response = client.post("/telegram-login", json=payload)
    assert response.status_code == 404


def test_telegram_login_fails_for_disabled_user():
    User.drop_collection()
    user = User(
        name="TG User",
        email="tg4@example.com",
        auth_details=AuthDetails(username="tguser4", telegram_username="telegramuser"),
        disabled=True,
    ).save()

    payload = _generate_payload("telegramuser", 111)

    response = client.post("/telegram-login", json=payload)
    assert response.status_code == 400
    assert response.json()["detail"] == "Inactive user"
    user.reload()
    assert user.auth_details.telegram_id is None



def test_telegram_login_rejected_when_bot_token_unset(monkeypatch):
    """An empty bot token makes the HMAC key sha256(b"") - a constant anyone can compute -
    so the signature check would accept a forged payload. The endpoint must refuse instead."""
    User.drop_collection()
    User(
        name="TG User",
        email="tgunset@example.com",
        auth_details=AuthDetails(username="tgunset", telegram_username="victimtg"),
    ).save()

    monkeypatch.setattr("backend.main.TELEGRAM_BOT_TOKEN", "")

    auth_date = int(time.time())
    data_check_string = "\n".join(
        sorted([f"auth_date={auth_date}", "id=424242", "username=victimtg"])
    )
    forged_hash = hmac.new(
        hashlib.sha256(b"").digest(), data_check_string.encode(), hashlib.sha256
    ).hexdigest()

    response = client.post(
        "/telegram-login",
        json={"hash": forged_hash, "id": 424242, "auth_date": auth_date, "username": "victimtg"},
    )

    assert response.status_code == 422
    assert "access_token" not in response.json()


def test_telegram_login_rejects_non_string_hash():
    """compare_digest raises TypeError on a non-str, which pydantic does not turn into a 422."""
    response = client.post(
        "/telegram-login",
        json={"hash": 1, "id": 1, "auth_date": int(time.time()), "username": "whoever"},
    )
    assert response.status_code == 422


def test_telegram_login_rejects_non_ascii_hash():
    """compare_digest also raises TypeError when a str contains non-ASCII characters."""
    response = client.post(
        "/telegram-login",
        json={"hash": "ä" * 64, "id": 1, "auth_date": int(time.time()), "username": "whoever"},
    )
    assert response.status_code == 422


def test_telegram_login_rejects_missing_hash():
    response = client.post(
        "/telegram-login",
        json={"id": 1, "auth_date": int(time.time()), "username": "whoever"},
    )
    assert response.status_code == 422


def test_telegram_login_rejects_future_auth_date():
    """Only elapsed time was bounded, so a far-future auth_date stayed replayable forever.

    The hash is computed over the future auth_date so the signature itself is valid - the
    rejection has to come from the freshness window, not from a mismatched digest.
    """
    auth_date = int(time.time()) + 86_400
    data_check_string = "\n".join(
        sorted([f"auth_date={auth_date}", "id=1", "username=whoever"])
    )
    secret_key = hashlib.sha256(TELEGRAM_BOT_TOKEN.encode()).digest()
    valid_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    response = client.post(
        "/telegram-login",
        json={"hash": valid_hash, "id": 1, "auth_date": auth_date, "username": "whoever"},
    )
    assert response.status_code == 422

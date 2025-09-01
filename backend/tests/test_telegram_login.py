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


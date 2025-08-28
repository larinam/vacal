import time
import hashlib
import hmac
import uuid

from fastapi.testclient import TestClient

from backend.main import app, TELEGRAM_BOT_TOKEN, get_current_active_user
from backend.model import Tenant, User, AuthDetails

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


def test_telegram_connect_links_current_user():
    tenant = Tenant(name=str(uuid.uuid4()), identifier=str(uuid.uuid4())).save()
    user = User(
        tenants=[tenant],
        name="Telegram User",
        auth_details=AuthDetails(username="existing"),
    ).save()

    payload = _generate_payload("telegramuser", user_id=111)

    app.dependency_overrides[get_current_active_user] = lambda: user
    response = client.post("/telegram-connect", json=payload)
    app.dependency_overrides.clear()

    assert response.status_code == 200
    user.reload()
    assert user.auth_details.telegram_id == payload["id"]
    assert user.auth_details.telegram_username == payload["username"]


def test_telegram_connect_fails_if_telegram_id_used():
    tenant = Tenant(name=str(uuid.uuid4()), identifier=str(uuid.uuid4())).save()
    existing_user = User(
        tenants=[tenant],
        name="Other User",
        auth_details=AuthDetails(username="other", telegram_id=222, telegram_username="existinguser"),
    ).save()
    current_user = User(
        tenants=[tenant],
        name="Current User",
        auth_details=AuthDetails(username="current"),
    ).save()

    payload = _generate_payload("existinguser", user_id=222)

    app.dependency_overrides[get_current_active_user] = lambda: current_user
    response = client.post("/telegram-connect", json=payload)
    app.dependency_overrides.clear()

    assert response.status_code == 400
    current_user.reload()
    assert current_user.auth_details.telegram_id is None
    assert current_user.auth_details.telegram_username is None

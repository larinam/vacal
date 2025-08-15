import time
import hashlib
import hmac

from fastapi.testclient import TestClient
from backend.main import app, TELEGRAM_BOT_TOKEN
from backend.model import User, AuthDetails

client = TestClient(app)


def test_telegram_login_case_insensitive():
    user = User(
        name="TG User",
        email="tg@example.com",
        auth_details=AuthDetails(username="tguser", telegram_username="TelegramUser")
    )
    user.save()

    auth_date = int(time.time())
    username_login = "telegramuser"
    data_check_arr = [
        f"auth_date={auth_date}",
        "id=1",
        f"username={username_login}"
    ]
    data_check_arr.sort()
    data_check_string = "\n".join(data_check_arr)
    secret_key = hashlib.sha256(TELEGRAM_BOT_TOKEN.encode()).digest()
    calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    payload = {
        "hash": calculated_hash,
        "id": 1,
        "auth_date": auth_date,
        "username": username_login,
    }

    response = client.post("/telegram-login", json=payload)
    assert response.status_code == 200
    token = response.json().get("access_token")
    assert token

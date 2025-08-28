import uuid
from fastapi.testclient import TestClient

from backend.main import app, get_current_active_user
from backend.model import Tenant, User, AuthDetails

client = TestClient(app)


def test_telegram_disconnect_removes_auth_details():
    tenant = Tenant(name=str(uuid.uuid4()), identifier=str(uuid.uuid4())).save()
    user = User(
        tenants=[tenant],
        name="Telegram User",
        auth_details=AuthDetails(username=str(uuid.uuid4()), telegram_id=333, telegram_username="user"),
    ).save()

    app.dependency_overrides[get_current_active_user] = lambda: user

    response = client.delete("/telegram-connect")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    user.reload()
    assert user.auth_details.telegram_id is None
    assert user.auth_details.telegram_username is None

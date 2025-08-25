import uuid
from fastapi.testclient import TestClient

from backend.main import app, get_current_active_user
from backend.model import Tenant, User, AuthDetails

client = TestClient(app)


def test_google_disconnect_removes_auth_details():
    tenant = Tenant(name=str(uuid.uuid4()), identifier=str(uuid.uuid4())).save()
    email = f"{uuid.uuid4()}@example.com"
    user = User(
        tenants=[tenant],
        name="Google User",
        auth_details=AuthDetails(username=str(uuid.uuid4()), google_id=str(uuid.uuid4()), google_email=email),
    ).save()

    app.dependency_overrides[get_current_active_user] = lambda: user

    response = client.delete("/google-connect")
    app.dependency_overrides.clear()
    assert response.status_code == 200
    user.reload()
    assert user.auth_details.google_id is None
    assert user.auth_details.google_email is None

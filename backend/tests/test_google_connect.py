import uuid
from fastapi.testclient import TestClient

from backend.main import app, get_current_active_user
from backend.model import Tenant, User, AuthDetails

client = TestClient(app)


def test_google_connect_links_current_user(monkeypatch):
    tenant = Tenant(name=str(uuid.uuid4()), identifier=str(uuid.uuid4())).save()
    email = f"{uuid.uuid4()}@example.com"
    user = User(
        tenants=[tenant],
        name="Google User",
        auth_details=AuthDetails(username="existing")
    ).save()

    google_id = "google-id-1"

    def mock_verify_oauth2_token(token, request, audience):
        assert token == "test-token"
        return {"sub": google_id, "email": email}

    monkeypatch.setattr("google.oauth2.id_token.verify_oauth2_token", mock_verify_oauth2_token)
    app.dependency_overrides[get_current_active_user] = lambda: user

    response = client.post("/google-connect", json={"token": "test-token"})
    app.dependency_overrides.clear()
    assert response.status_code == 200
    user.reload()
    assert user.auth_details.google_id == google_id
    assert user.auth_details.google_email == email


def test_google_connect_fails_if_google_id_used(monkeypatch):
    tenant = Tenant(name=str(uuid.uuid4()), identifier=str(uuid.uuid4())).save()
    existing_google_id = "google-id-2"

    other_user = User(
        tenants=[tenant],
        name="Other User",
        auth_details=AuthDetails(username="other", google_id=existing_google_id)
    ).save()
    current_user = User(
        tenants=[tenant],
        name="Current User",
        auth_details=AuthDetails(username="current")
    ).save()

    def mock_verify_oauth2_token(token, request, audience):
        return {"sub": existing_google_id, "email": "new@example.com"}

    monkeypatch.setattr("google.oauth2.id_token.verify_oauth2_token", mock_verify_oauth2_token)
    app.dependency_overrides[get_current_active_user] = lambda: current_user

    response = client.post("/google-connect", json={"token": "token"})
    app.dependency_overrides.clear()
    assert response.status_code == 400
    current_user.reload()
    assert current_user.auth_details.google_id is None

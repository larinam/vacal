from fastapi.testclient import TestClient

import uuid

from backend.main import app
from backend.model import Tenant, User, AuthDetails

client = TestClient(app)


def test_google_login_links_existing_user(monkeypatch):
    User.drop_collection()
    tenant = Tenant(name=str(uuid.uuid4()), identifier=str(uuid.uuid4())).save()
    email = f"{uuid.uuid4()}@example.com"
    username = str(uuid.uuid4())
    user = User(
        tenants=[tenant],
        name="Google User",
        email=email,
        auth_details=AuthDetails(username=username)
    ).save()

    def mock_verify_oauth2_token(token, request, audience):
        assert token == "test-token"
        return {"sub": "google-id", "email": email}

    monkeypatch.setattr("google.oauth2.id_token.verify_oauth2_token", mock_verify_oauth2_token)

    response = client.post("/google-login", json={"token": "test-token"})
    assert response.status_code == 200
    user.reload()
    assert user.auth_details.google_id == "google-id"
    assert user.auth_details.google_email == email
    assert response.json()["access_token"]


def test_google_login_fails_for_disabled_user(monkeypatch):
    User.drop_collection()
    tenant = Tenant(name=str(uuid.uuid4()), identifier=str(uuid.uuid4())).save()
    email = f"{uuid.uuid4()}@example.com"
    username = str(uuid.uuid4())
    user = User(
        tenants=[tenant],
        name="Google User",
        email=email,
        auth_details=AuthDetails(username=username),
        disabled=True,
    ).save()

    def mock_verify_oauth2_token(token, request, audience):
        assert token == "test-token"
        return {"sub": "google-id", "email": email}

    monkeypatch.setattr("google.oauth2.id_token.verify_oauth2_token", mock_verify_oauth2_token)

    response = client.post("/google-login", json={"token": "test-token"})
    assert response.status_code == 400
    assert response.json()["detail"] == "Inactive user"
    user.reload()
    assert not user.auth_details.google_id

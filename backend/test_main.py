from unittest.mock import patch
import os

# Use an in-memory MongoDB for tests
os.environ.setdefault("MONGO_MOCK", "1")
os.environ.setdefault("AUTHENTICATION_SECRET_KEY", "test_secret")

from fastapi.testclient import TestClient
from .main import app
from .model import User, AuthDetails, WebAuthnCredential
import pytest

client = TestClient(app)


def test_read_config():
    response = client.get("/config")
    assert response.status_code == 200

    config = response.json()
    assert config, "Response JSON should not be empty"
    assert isinstance(config, dict), "Response should be a JSON object"
    assert len(config) == 4, "Config should contain four key-value pairs"


@pytest.fixture
def mock_user():
    return User(
        auth_details=AuthDetails(
            username="testuser",
            hashed_password="hashed_password"  # This should be a properly hashed password in reality
        )
    )


def test_login_for_access_token(mock_user):
    # Mock the authenticate_user method
    with patch.object(User, 'authenticate_user', return_value=mock_user):
        response = client.post(
            "/token",
            data={"username": "testuser", "password": "testpassword"},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )

        assert response.status_code == 200
        token_data = response.json()
        assert "access_token" in token_data
        assert token_data["token_type"] == "bearer"


def test_login_for_access_token_invalid_credentials():
    # Mock the authenticate_user method to return None (invalid credentials)
    with patch.object(User, 'authenticate_user', return_value=None):
        response = client.post(
            "/token",
            data={"username": "wronguser", "password": "wrongpassword"},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )

        assert response.status_code == 401
        error_data = response.json()
        assert error_data["detail"] == "Incorrect username or password"


def test_webauthn_register_options():
    user = User(auth_details=AuthDetails(username="alice"))
    with patch.object(User, 'get_by_username', return_value=user), \
         patch.object(WebAuthnCredential, 'objects', return_value=[]):
        response = client.post("/webauthn/register-options", json={"username": "alice"})
        assert response.status_code == 200
        data = response.json()
        assert "challenge" in data


def test_webauthn_authenticate_options_no_creds():
    user = User(auth_details=AuthDetails(username="bob"))
    with patch.object(User, 'get_by_username', return_value=user), \
         patch.object(WebAuthnCredential, 'objects', return_value=[]):
        response = client.post("/webauthn/authenticate-options", json={"username": "bob"})
        assert response.status_code == 400

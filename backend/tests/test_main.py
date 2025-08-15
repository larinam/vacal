from unittest.mock import patch

from fastapi.testclient import TestClient
from backend.main import app
from backend.model import User, AuthDetails
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
            hashed_password="hashed_password",  # This should be a properly hashed password in reality
            mfa_confirmed=True
        )
    )


def test_login_for_access_token(mock_user):
    # Mock the authenticate_user method
    with patch.object(User, 'authenticate_user', return_value=mock_user), \
         patch.object(mock_user, 'verify_mfa_code', return_value=True):
        response = client.post(
            "/token",
            data={"username": "testuser", "password": "testpassword", "otp": "123456"},
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
            data={"username": "wronguser", "password": "wrongpassword", "otp": "000000"},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )

        assert response.status_code == 401
        error_data = response.json()
        assert error_data["detail"] == "Incorrect username or password"

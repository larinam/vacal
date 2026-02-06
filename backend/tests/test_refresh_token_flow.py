from datetime import datetime, timedelta, timezone
import uuid
from unittest.mock import patch

import pyotp
import pytest
from bson import ObjectId
from fastapi.testclient import TestClient

import backend.main as main
from backend.dependencies import create_access_token
from backend.main import app
from backend.model import AuthDetails, DayType, RefreshToken, Team, Tenant, User

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_collections():
    # Keep cross-test isolation strong and remove references before base docs.
    for model in (RefreshToken, Team, User, DayType, Tenant):
        model.drop_collection()
    yield
    for model in (RefreshToken, Team, User, DayType, Tenant):
        model.drop_collection()


def create_user(password: str = "pass") -> User:
    tenant = Tenant(name=str(uuid.uuid4()), identifier=str(uuid.uuid4())).save()
    username = str(uuid.uuid4())
    user = User(
        tenants=[tenant],
        name="Token User",
        email=f"{username}@example.com",
        auth_details=AuthDetails(username=username),
    )
    user.hash_password(password)
    user.save()
    return user


def issue_tokens(user: User, password: str = "pass") -> dict:
    otp = pyotp.TOTP(user.auth_details.mfa_secret).now()
    response = client.post(
        "/token",
        data={"username": user.auth_details.username, "password": password, "otp": otp},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert response.status_code == 200
    return response.json()


def test_refresh_token_rotates_tokens():
    user = create_user()
    login_tokens = issue_tokens(user)

    refresh_response = client.post(
        "/token/refresh",
        json={"refresh_token": login_tokens["refresh_token"]},
    )
    assert refresh_response.status_code == 200
    refreshed_tokens = refresh_response.json()
    assert refreshed_tokens["refresh_token"] != login_tokens["refresh_token"]
    assert refreshed_tokens["access_token"]

    reuse_response = client.post(
        "/token/refresh",
        json={"refresh_token": login_tokens["refresh_token"]},
    )
    assert reuse_response.status_code == 401
    assert reuse_response.json()["detail"] == "Invalid refresh token"


def test_refresh_token_rejects_invalid_format():
    response = client.post("/token/refresh", json={"refresh_token": "not-a-valid-token"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid refresh token"


def test_refresh_token_rejects_nonexistent_token_id_without_user_scan():
    fake_token = f"{ObjectId()}.fake-secret"
    with patch.object(main.User, "objects", side_effect=AssertionError("User scan should not happen")):
        response = client.post("/token/refresh", json={"refresh_token": fake_token})

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid refresh token"


def test_refresh_token_rejects_revoked_token():
    user = create_user()
    login_tokens = issue_tokens(user)
    token_id = login_tokens["refresh_token"].split(".", 1)[0]

    token_doc = RefreshToken.objects(id=ObjectId(token_id)).first()
    assert token_doc is not None
    token_doc.revoke()

    response = client.post("/token/refresh", json={"refresh_token": login_tokens["refresh_token"]})
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid refresh token"


def test_refresh_token_rejects_expired_token():
    user = create_user()
    login_tokens = issue_tokens(user)
    token_id = login_tokens["refresh_token"].split(".", 1)[0]

    RefreshToken.objects(id=ObjectId(token_id)).update_one(
        set__expiration_date=datetime.now(timezone.utc) - timedelta(seconds=1)
    )

    response = client.post("/token/refresh", json={"refresh_token": login_tokens["refresh_token"]})
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid refresh token"


def test_refresh_token_rejects_disabled_user():
    user = create_user()
    login_tokens = issue_tokens(user)

    user.disabled = True
    user.save()

    response = client.post("/token/refresh", json={"refresh_token": login_tokens["refresh_token"]})
    assert response.status_code == 400
    assert response.json()["detail"] == "Inactive user"


def test_logout_revokes_refresh_token_with_expired_access_token():
    user = create_user()
    login_tokens = issue_tokens(user)
    expired_access_token = create_access_token(
        data={"sub": user.auth_details.username},
        expires_delta=timedelta(minutes=-1),
    )

    logout_response = client.post(
        "/logout",
        json={"refresh_token": login_tokens["refresh_token"]},
        headers={"Authorization": f"Bearer {expired_access_token}"},
    )
    assert logout_response.status_code == 200

    refresh_response = client.post(
        "/token/refresh",
        json={"refresh_token": login_tokens["refresh_token"]},
    )
    assert refresh_response.status_code == 401
    assert refresh_response.json()["detail"] == "Invalid refresh token"

import os
os.environ.setdefault("MONGO_MOCK", "1")
os.environ.setdefault("AUTHENTICATION_SECRET_KEY", "test_secret")

import pyotp
from fastapi.testclient import TestClient

from .main import app
from .model import Tenant, User, AuthDetails
import uuid

client = TestClient(app)


def create_mfa_user():
    tenant = Tenant(name=str(uuid.uuid4()), identifier=str(uuid.uuid4())).save()
    username = str(uuid.uuid4())
    email = f"{username}@example.com"
    user = User(tenants=[tenant], name="Admin", email=email,
                auth_details=AuthDetails(username=username))
    user.hash_password("pass")
    user.save()
    return user, user.auth_details.mfa_secret


def test_mfa_setup_and_confirmation():
    user, secret = create_mfa_user()
    # First login without OTP should return setup information
    resp = client.post(
        "/token",
        data={"username": user.auth_details.username, "password": "pass"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    assert resp.status_code == 403
    data = resp.json()
    assert "otp_uri" in data

    totp = pyotp.TOTP(secret)
    code = totp.now()
    # Providing correct code confirms MFA and logs in
    resp = client.post(
        "/token",
        data={"username": user.auth_details.username, "password": "pass", "otp": code},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    assert resp.status_code == 200
    user.reload()
    assert user.auth_details.mfa_confirmed is True


def test_confirmed_user_requires_valid_mfa_code():
    user, secret = create_mfa_user()
    user.auth_details.mfa_confirmed = True
    user.save()
    totp = pyotp.TOTP(secret)
    # Missing OTP should fail with 401
    resp = client.post(
        "/token",
        data={"username": user.auth_details.username, "password": "pass"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    assert resp.status_code == 401

    # Wrong OTP should fail
    resp = client.post(
        "/token",
        data={"username": user.auth_details.username, "password": "pass", "otp": "000000"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    assert resp.status_code == 401

    # Correct OTP succeeds
    code = totp.now()
    resp = client.post(
        "/token",
        data={"username": user.auth_details.username, "password": "pass", "otp": code},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    assert resp.status_code == 200


def test_reset_mfa_regenerates_secret_and_unconfirms():
    user, secret = create_mfa_user()
    user.auth_details.mfa_confirmed = True
    user.save()

    totp = pyotp.TOTP(secret)
    code = totp.now()
    resp = client.post(
        "/token",
        data={"username": user.auth_details.username, "password": "pass", "otp": code},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    token = resp.json()["access_token"]

    resp = client.post(
        f"/users/{user.id}/reset-mfa",
        headers={"Authorization": f"Bearer {token}", "Tenant-ID": user.tenants[0].identifier}
    )
    assert resp.status_code == 200
    user.reload()
    assert user.auth_details.mfa_confirmed is False
    assert user.auth_details.mfa_secret != secret

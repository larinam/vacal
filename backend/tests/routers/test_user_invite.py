import hashlib
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.model import Tenant, User, AuthDetails, UserInvite
import pyotp

client = TestClient(app)

@pytest.fixture
def tenant_and_token(clean_user_collections, unique_suffix):
    tenant = Tenant(name="Tenant", identifier=f"tenant-{unique_suffix}").save()
    user = User(
        tenants=[tenant],
        name="Admin",
        email=f"admin-{unique_suffix}@example.com",
        auth_details=AuthDetails(username=f"admin-{unique_suffix}"),
    )
    user.hash_password("pass")
    user.save()
    totp = pyotp.TOTP(user.auth_details.mfa_secret)
    code = totp.now()
    resp = client.post(
        "/token",
        data={"username": user.auth_details.username, "password": "pass", "otp": code},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    token = resp.json()["access_token"]
    return tenant, token


def test_invite_token_hashed(tenant_and_token):
    tenant, token = tenant_and_token
    captured = {}

    def fake_send(email, t):
        captured["token"] = t

    with patch("backend.routers.users.send_invitation_email", fake_send):
        resp = client.post(
            "/users/invite",
            json={"email": "new@example.com"},
            headers={"Authorization": f"Bearer {token}", "Tenant-ID": tenant.identifier}
        )
        assert resp.status_code == 200

    invite = UserInvite.objects(email="new@example.com", tenant=tenant).first()
    assert invite is not None
    assert invite.token == hashlib.sha256(captured["token"].encode()).hexdigest()

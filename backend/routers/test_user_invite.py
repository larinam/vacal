import os
import hashlib
from unittest.mock import patch
from fastapi.testclient import TestClient

os.environ.setdefault("MONGO_MOCK", "1")
os.environ.setdefault("AUTHENTICATION_SECRET_KEY", "test_secret")

from ..main import app
from ..model import Tenant, User, AuthDetails, UserInvite, UserRole
import pyotp

client = TestClient(app)


def setup_user_and_token():
    tenant = Tenant(name="Tenant", identifier="tenant").save()
    user = User(tenants=[tenant], name="Admin", email="admin@example.com",
                auth_details=AuthDetails(username="admin"), role=UserRole.MANAGER)
    user.hash_password("pass")
    user.save()
    totp = pyotp.TOTP(user.auth_details.mfa_secret)
    code = totp.now()
    resp = client.post("/token", data={"username": "admin", "password": "pass", "otp": code},
                        headers={"Content-Type": "application/x-www-form-urlencoded"})
    token = resp.json()["access_token"]
    return tenant, token


def test_invite_token_hashed():
    tenant, token = setup_user_and_token()
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

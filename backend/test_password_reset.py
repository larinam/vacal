import os
os.environ.setdefault("MONGO_MOCK", "1")
os.environ.setdefault("AUTHENTICATION_SECRET_KEY", "test_secret")

import hashlib
from unittest.mock import patch
from fastapi.testclient import TestClient

from .main import app
from .model import Tenant, User, AuthDetails, PasswordResetToken

client = TestClient(app)


def setup_user():
    tenant = Tenant(name="TestTenant", identifier="testtenant").save()
    user = User(tenants=[tenant], name="Test User", email="user@example.com",
                auth_details=AuthDetails(username="user"))
    user.hash_password("oldpassword")
    user.save()
    return user


def test_password_reset_token_hashed_and_usable():
    user = setup_user()
    captured = {}

    def fake_send_email(email, token):
        captured["token"] = token

    with patch("backend.routers.users.send_password_reset_email", fake_send_email):
        resp = client.post("/users/password-reset/request", json={"email": "user@example.com"})
        assert resp.status_code == 200

    prt = PasswordResetToken.objects(user=user).first()
    assert prt is not None
    assert prt.token == hashlib.sha256(captured["token"].encode()).hexdigest()

    resp = client.post(f"/users/password-reset/{captured['token']}", json={"new_password": "newpass", "confirm_password": "newpass"})
    assert resp.status_code == 200
    user.reload()
    assert user.verify_password("newpass")

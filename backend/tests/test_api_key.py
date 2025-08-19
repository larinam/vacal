import uuid
import pyotp
from fastapi.testclient import TestClient

from backend.main import app
from backend.model import Tenant, User, AuthDetails

client = TestClient(app)


def create_user():
    tenant = Tenant(name=str(uuid.uuid4()), identifier=str(uuid.uuid4())).save()
    username = str(uuid.uuid4())
    email = f"{username}@example.com"
    user = User(tenants=[tenant], name="User", email=email,
                auth_details=AuthDetails(username=username))
    user.hash_password("pass")
    user.save()
    return user


def auth_headers(user):
    resp = client.post(
        "/token",
        data={"username": user.auth_details.username, "password": "pass"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    totp = pyotp.TOTP(user.auth_details.mfa_secret)
    code = totp.now()
    resp = client.post(
        "/token",
        data={"username": user.auth_details.username, "password": "pass", "otp": code},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}", "Tenant-ID": user.tenants[0].identifier}


def test_get_and_regenerate_api_key():
    user = create_user()
    headers = auth_headers(user)
    old_key = user.auth_details.api_key

    resp = client.get("/users/me/api-key", headers=headers)
    assert resp.status_code == 200
    masked = resp.json()["api_key"]
    assert masked.startswith(old_key[:4])
    assert masked.endswith(old_key[-4:])
    assert "*" in masked

    resp = client.post("/users/me/api-key", headers=headers)
    assert resp.status_code == 200
    new_key = resp.json()["api_key"]
    assert new_key != old_key
    user.reload()
    assert user.auth_details.api_key == new_key

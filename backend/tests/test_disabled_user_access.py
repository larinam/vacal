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


def test_disabled_user_rejected_after_login():
    user = create_user()
    headers = auth_headers(user)
    user.reload()
    user.disabled = True
    user.save()

    response = client.get("/users/me", headers=headers)

    assert response.status_code == 400
    assert response.json()["detail"] == "Inactive user"


def test_user_can_be_disabled_via_update_endpoint():
    user = create_user()
    user.role = "manager"
    user.save()
    headers = auth_headers(user)

    payload = {
        "name": user.name,
        "email": user.email,
        "username": user.auth_details.username,
        "telegram_username": None,
        "disabled": True,
    }

    resp = client.put(f"/users/{user.id}", json=payload, headers=headers)
    assert resp.status_code == 200

    user.reload()
    assert user.disabled is True

    totp = pyotp.TOTP(user.auth_details.mfa_secret)
    code = totp.now()
    resp = client.post(
        "/token",
        data={"username": user.auth_details.username, "password": "pass", "otp": code},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Inactive user"

import hashlib
from datetime import datetime, timezone, timedelta
from unittest.mock import patch

import pytest
from bson import ObjectId
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


def test_resend_invite_generates_new_token_and_resets_expiration(tenant_and_token):
    tenant, token = tenant_and_token

    old_raw = "old-raw-token"
    old_hash = hashlib.sha256(old_raw.encode()).hexdigest()
    # Start from an already expired invite to prove the expiration is refreshed.
    invite = UserInvite(
        email="resend@example.com",
        tenant=tenant,
        token=old_hash,
        status="pending",
        expiration_date=datetime.now(timezone.utc) - timedelta(days=1),
    ).save()

    captured = {}

    def fake_send(email, t):
        captured["email"] = email
        captured["token"] = t

    with patch("backend.routers.users.send_invitation_email", fake_send):
        resp = client.post(
            f"/users/invite/{invite.id}/resend",
            headers={"Authorization": f"Bearer {token}", "Tenant-ID": tenant.identifier},
        )
        assert resp.status_code == 200

    invite.reload()
    # A brand new token is issued (the old link is invalidated)...
    assert invite.token != old_hash
    # ...and the email is sent with the new raw token that hashes to the stored value.
    assert captured["email"] == "resend@example.com"
    assert invite.token == hashlib.sha256(captured["token"].encode()).hexdigest()
    # Status stays pending and the expiration is pushed back into the future.
    assert invite.status == "pending"
    assert not invite.is_expired()


def test_resend_invite_not_found(tenant_and_token):
    tenant, token = tenant_and_token

    resp = client.post(
        f"/users/invite/{ObjectId()}/resend",
        headers={"Authorization": f"Bearer {token}", "Tenant-ID": tenant.identifier},
    )
    assert resp.status_code == 404


def test_resend_invite_other_tenant_is_isolated(tenant_and_token, unique_suffix):
    tenant, token = tenant_and_token

    other_tenant = Tenant(name="Other", identifier=f"other-{unique_suffix}").save()
    invite = UserInvite(
        email="other@example.com",
        tenant=other_tenant,
        token=hashlib.sha256(b"other").hexdigest(),
        status="pending",
    ).save()

    with patch("backend.routers.users.send_invitation_email") as send_mock:
        resp = client.post(
            f"/users/invite/{invite.id}/resend",
            headers={"Authorization": f"Bearer {token}", "Tenant-ID": tenant.identifier},
        )
        assert resp.status_code == 404
        send_mock.assert_not_called()


def test_resend_accepted_invite_rejected(tenant_and_token):
    tenant, token = tenant_and_token

    invite = UserInvite(
        email="accepted@example.com",
        tenant=tenant,
        token=hashlib.sha256(b"accepted").hexdigest(),
        status="accepted",
    ).save()

    with patch("backend.routers.users.send_invitation_email") as send_mock:
        resp = client.post(
            f"/users/invite/{invite.id}/resend",
            headers={"Authorization": f"Bearer {token}", "Tenant-ID": tenant.identifier},
        )
        assert resp.status_code == 400
        send_mock.assert_not_called()

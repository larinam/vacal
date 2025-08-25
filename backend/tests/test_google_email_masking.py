import uuid
from fastapi.testclient import TestClient

from backend.main import app
from backend.dependencies import get_current_active_user_check_tenant, get_tenant
from backend.model import Tenant, User, AuthDetails

client = TestClient(app)


def test_google_email_is_masked_in_users_endpoint():
    tenant = Tenant(name=str(uuid.uuid4()), identifier=str(uuid.uuid4())).save()
    email = f"{uuid.uuid4()}@example.com"
    user = User(
        tenants=[tenant],
        name="Google User",
        auth_details=AuthDetails(username=str(uuid.uuid4()), google_id=str(uuid.uuid4()), google_email=email),
    ).save()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: user
    app.dependency_overrides[get_tenant] = lambda: tenant

    response = client.get("/users")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    local, domain = email.split('@', 1)
    expected = f"{local[0]}{'*' * max(len(local) - 2, 1)}{local[-1]}@{domain}"
    assert data[0]["auth_details"]["google_email"] == expected

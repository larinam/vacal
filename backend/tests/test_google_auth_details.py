import uuid

from backend.model import Tenant, User, AuthDetails


def test_get_by_google_id():
    tenant = Tenant(name=str(uuid.uuid4()), identifier=str(uuid.uuid4())).save()
    google_id = str(uuid.uuid4())
    user = User(
        tenants=[tenant],
        name="Google User",
        email=f"{uuid.uuid4()}@example.com",
        auth_details=AuthDetails(
            username=str(uuid.uuid4()),
            google_id=google_id,
            google_email="user@example.com",
            google_refresh_token="refresh-token",
        ),
    ).save()

    fetched = User.get_by_google_id(google_id)
    assert fetched is not None
    assert fetched.id == user.id

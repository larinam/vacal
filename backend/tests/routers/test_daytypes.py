import os
import uuid
import pytest

os.environ.setdefault("MONGO_MOCK", "1")
os.environ.setdefault("AUTHENTICATION_SECRET_KEY", "test_secret")

from fastapi.testclient import TestClient

from backend.main import app
from backend.model import DayType, Tenant, User, AuthDetails, Team, TeamMember, DayEntry
from backend.dependencies import get_current_active_user_check_tenant, get_tenant

client = TestClient(app)


def setup_day_type(identifier: str):
    tenant = Tenant(name=f"Test Tenant {uuid.uuid4()}", identifier=str(uuid.uuid4())).save()
    DayType.init_day_types(tenant)
    day_type = DayType.objects(tenant=tenant, identifier=identifier).first()
    user = User(
        name="Test User",
        email=f"{uuid.uuid4()}@example.com",
        tenants=[tenant],
        auth_details=AuthDetails(username=str(uuid.uuid4())),
    ).save()
    return tenant, user, day_type


@pytest.mark.parametrize("identifier", DayType.SYSTEM_DAY_TYPE_IDENTIFIERS)
def test_cannot_toggle_is_absence_for_system_day_types(identifier):
    tenant, user, day_type = setup_day_type(identifier)
    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: user
    app.dependency_overrides[get_tenant] = lambda: tenant

    payload = {
        "name": day_type.name,
        "identifier": day_type.identifier,
        "color": day_type.color,
        "is_absence": not day_type.is_absence,
    }

    response = client.put(
        f"/daytypes/{day_type.id}",
        json=payload,
        headers={"Tenant-ID": tenant.identifier},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Can't change the is_absence flag for the system DayType"
    app.dependency_overrides = {}


def setup_custom_day_type():
    tenant = Tenant(name=f"Tenant {uuid.uuid4()}", identifier=str(uuid.uuid4())).save()
    DayType.init_day_types(tenant)
    custom = DayType(tenant=tenant, name="Custom", identifier=str(uuid.uuid4()), color="#FFFFFF").save()
    user = User(
        name="User",
        email=f"{uuid.uuid4()}@example.com",
        tenants=[tenant],
        auth_details=AuthDetails(username=str(uuid.uuid4())),
    ).save()
    return tenant, user, custom


def test_cannot_delete_day_type_when_in_use():
    tenant, user, day_type = setup_custom_day_type()
    member = TeamMember(name="Alice", country="United States", available_day_types=[day_type])
    member.days = {"2024-01-01": DayEntry(day_types=[day_type])}
    Team(tenant=tenant, name="Team", team_members=[member], available_day_types=[day_type]).save()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: user
    app.dependency_overrides[get_tenant] = lambda: tenant

    response = client.delete(f"/daytypes/{day_type.id}", headers={"Tenant-ID": tenant.identifier})
    assert response.status_code == 400
    assert response.json()["detail"] == "DayType is in use and cannot be deleted"
    app.dependency_overrides = {}


def test_delete_unused_day_type():
    tenant, user, day_type = setup_custom_day_type()
    member = TeamMember(name="Bob", country="United States")
    Team(tenant=tenant, name="Team", team_members=[member]).save()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: user
    app.dependency_overrides[get_tenant] = lambda: tenant

    response = client.delete(f"/daytypes/{day_type.id}", headers={"Tenant-ID": tenant.identifier})
    assert response.status_code == 200
    assert response.json()["message"] == "DayType deleted successfully"
    app.dependency_overrides = {}

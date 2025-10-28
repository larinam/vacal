import datetime
import os
import uuid

os.environ.setdefault("MONGO_MOCK", "1")
os.environ.setdefault("AUTHENTICATION_SECRET_KEY", "test_secret")

from fastapi.testclient import TestClient

from backend.dependencies import get_current_active_user_check_tenant, get_tenant
from backend.main import app
from backend.model import (
    AuthDetails,
    DayType,
    Team,
    TeamMember,
    Tenant,
    User,
    DepartureInitiator,
)


client = TestClient(app)


def test_delete_team_member_stores_last_working_day():
    unique_suffix = str(uuid.uuid4())
    tenant = Tenant(name=f"Tenant-{unique_suffix}", identifier=f"tenant-{unique_suffix}").save()
    team_member = TeamMember(name="Alice", country="Sweden")
    team = Team(tenant=tenant, name="Team Alpha", team_members=[team_member]).save()
    user = User(
        name="Manager",
        role="manager",
        tenants=[tenant],
        auth_details=AuthDetails(username=f"manager-{unique_suffix}"),
    ).save()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: user
    app.dependency_overrides[get_tenant] = lambda: tenant

    try:
        response = client.request(
            "DELETE",
            f"/teams/{team.id}/members/{team_member.uid}",
            json={
                "last_working_day": "2024-06-01",
                "departure_initiated_by": DepartureInitiator.TEAM_MEMBER.value,
            },
            headers={"Tenant-ID": tenant.identifier},
        )

        assert response.status_code == 200
        assert response.json() == {"message": "Team member deleted successfully"}

        team.reload()
        stored_member = team.get_member(team_member.uid, include_archived=True)
        assert stored_member is not None
        assert stored_member.is_deleted is True
        assert stored_member.last_working_day == datetime.date(2024, 6, 1)
        assert stored_member.departure_initiated_by == DepartureInitiator.TEAM_MEMBER.value
    finally:
        app.dependency_overrides = {}


def test_delete_team_member_requires_manager_role():
    unique_suffix = str(uuid.uuid4())
    tenant = Tenant(name=f"Tenant-{unique_suffix}", identifier=f"tenant-{unique_suffix}").save()
    team_member = TeamMember(name="Alice", country="Sweden")
    team = Team(tenant=tenant, name="Team Alpha", team_members=[team_member]).save()
    user = User(
        name="Employee",
        role="employee",
        tenants=[tenant],
        auth_details=AuthDetails(username=f"employee-{unique_suffix}"),
    ).save()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: user
    app.dependency_overrides[get_tenant] = lambda: tenant

    try:
        response = client.request(
            "DELETE",
            f"/teams/{team.id}/members/{team_member.uid}",
            json={
                "last_working_day": "2024-06-01",
                "departure_initiated_by": DepartureInitiator.TEAM_MEMBER.value,
            },
            headers={"Tenant-ID": tenant.identifier},
        )

        assert response.status_code == 403
        assert response.json() == {"detail": "Only managers can delete team members."}

        team.reload()
        stored_member = team.get_member(team_member.uid, include_archived=True)
        assert stored_member is not None
        assert getattr(stored_member, "is_deleted", False) is False
    finally:
        app.dependency_overrides = {}


def test_delete_team_without_members_removes_document():
    unique_suffix = str(uuid.uuid4())
    tenant = Tenant(name=f"Tenant-{unique_suffix}", identifier=f"tenant-{unique_suffix}").save()
    team = Team(tenant=tenant, name="Team Empty", team_members=[]).save()
    user = User(
        name="Manager",
        role="manager",
        tenants=[tenant],
        auth_details=AuthDetails(username=f"manager-{unique_suffix}"),
    ).save()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: user
    app.dependency_overrides[get_tenant] = lambda: tenant

    try:
        response = client.request(
            "DELETE",
            f"/teams/{team.id}",
            headers={"Tenant-ID": tenant.identifier},
        )

        assert response.status_code == 200
        assert response.json() == {"message": "Team deleted successfully"}
        assert Team.objects_with_deleted(id=team.id).first() is None
    finally:
        app.dependency_overrides = {}


def test_delete_team_with_members_soft_deletes():
    unique_suffix = str(uuid.uuid4())
    tenant = Tenant(name=f"Tenant-{unique_suffix}", identifier=f"tenant-{unique_suffix}").save()
    team_member = TeamMember(name="Alice", country="Sweden")
    team = Team(tenant=tenant, name="Team With Members", team_members=[team_member]).save()
    user = User(
        name="Manager",
        role="manager",
        tenants=[tenant],
        auth_details=AuthDetails(username=f"manager-{unique_suffix}"),
    ).save()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: user
    app.dependency_overrides[get_tenant] = lambda: tenant

    try:
        response = client.request(
            "DELETE",
            f"/teams/{team.id}",
            headers={"Tenant-ID": tenant.identifier},
        )

        assert response.status_code == 200
        assert response.json() == {"message": "Team deleted successfully"}

        team.reload()
        assert team.is_deleted is True
        assert team.deleted_at is not None
        assert team.deleted_by == user
    finally:
        app.dependency_overrides = {}


def test_team_member_birthday_added_once_per_year():
    unique_suffix = str(uuid.uuid4())
    tenant = Tenant(name=f"Tenant-{unique_suffix}", identifier=f"tenant-{unique_suffix}").save()
    DayType.init_day_types(tenant)
    team_member = TeamMember(name="Alice", country="Sweden", birthday="05-12")
    team = Team(tenant=tenant, name="Team Birthday", team_members=[team_member]).save()
    user = User(
        name="Manager",
        role="manager",
        tenants=[tenant],
        auth_details=AuthDetails(username=f"manager-{unique_suffix}"),
    ).save()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: user
    app.dependency_overrides[get_tenant] = lambda: tenant

    try:
        response = client.get("/teams", headers={"Tenant-ID": tenant.identifier})

        assert response.status_code == 200
        teams_payload = response.json()["teams"]
        assert len(teams_payload) == 1

        member_payload = teams_payload[0]["team_members"][0]
        days = member_payload["days"]
        current_year = datetime.datetime.now().year

        for year in (current_year, current_year + 1):
            birthday_key = f"{year}-05-12"
            assert birthday_key in days
            assert len(days[birthday_key]["day_types"]) == 1
    finally:
        app.dependency_overrides = {}

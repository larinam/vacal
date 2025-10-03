import uuid

from fastapi.testclient import TestClient

from backend.dependencies import get_current_active_user_check_tenant
from backend.main import app
from backend.model import AuthDetails, DayType, Team, TeamMember, Tenant, User


client = TestClient(app)


def _create_team_with_user(role: str = "employee"):
    tenant = Tenant(name=f"Tenant-{uuid.uuid4()}", identifier=str(uuid.uuid4())).save()
    DayType.init_day_types(tenant)
    vacation = DayType.objects(tenant=tenant, identifier="vacation").first()

    members = [
        TeamMember(name="Alice", country="Sweden"),
        TeamMember(name="Bob", country="Sweden"),
    ]
    team = Team(tenant=tenant, name=f"Team-{uuid.uuid4()}", team_members=members).save()
    team.reload()

    user = User(
        tenants=[tenant],
        name="User",
        role=role,
        auth_details=AuthDetails(username=str(uuid.uuid4())),
    ).save()

    return tenant, team, vacation, user


def test_employee_can_set_absence_when_coworker_available():
    tenant, team, vacation, user = _create_team_with_user(role="employee")
    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: user
    try:
        response = client.put(
            f"/teams/{team.id}/members/{team.team_members[0].uid}/days",
            json={"2025-07-01": {"day_types": [str(vacation.id)], "comment": ""}},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 200
    finally:
        app.dependency_overrides = {}


def test_employee_cannot_mark_last_coworker_absent():
    tenant, team, vacation, user = _create_team_with_user(role="employee")
    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: user
    try:
        first_response = client.put(
            f"/teams/{team.id}/members/{team.team_members[0].uid}/days",
            json={"2025-08-01": {"day_types": [str(vacation.id)], "comment": ""}},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert first_response.status_code == 200

        second_response = client.put(
            f"/teams/{team.id}/members/{team.team_members[1].uid}/days",
            json={"2025-08-01": {"day_types": [str(vacation.id)], "comment": ""}},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert second_response.status_code == 400
        assert second_response.json()["detail"] == "At least one teammate must remain available for this day."
    finally:
        app.dependency_overrides = {}


def test_manager_can_mark_all_coworkers_absent():
    tenant, team, vacation, user = _create_team_with_user(role="manager")
    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: user
    try:
        first_response = client.put(
            f"/teams/{team.id}/members/{team.team_members[0].uid}/days",
            json={"2025-09-01": {"day_types": [str(vacation.id)], "comment": ""}},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert first_response.status_code == 200

        second_response = client.put(
            f"/teams/{team.id}/members/{team.team_members[1].uid}/days",
            json={"2025-09-01": {"day_types": [str(vacation.id)], "comment": ""}},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert second_response.status_code == 200
    finally:
        app.dependency_overrides = {}

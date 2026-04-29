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
    SeparationType,
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
            f"/teams/{team.id}/members/{team_member.uid}"
            f"?last_working_day=2024-06-01&separation_type={SeparationType.RESIGNATION.value}",
            headers={"Tenant-ID": tenant.identifier},
        )

        assert response.status_code == 200
        assert response.json() == {"message": "Team member deleted successfully"}

        team.reload()
        stored_member = team.get_member(team_member.uid, include_archived=True)
        assert stored_member is not None
        assert stored_member.is_deleted is True
        assert stored_member.last_working_day == datetime.date(2024, 6, 1)
        assert stored_member.separation_type == SeparationType.RESIGNATION.value
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
            f"/teams/{team.id}/members/{team_member.uid}"
            f"?last_working_day=2024-06-01&separation_type={SeparationType.RESIGNATION.value}",
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


def test_delete_team_member_allows_missing_departure_initiator():
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
            f"/teams/{team.id}/members/{team_member.uid}?last_working_day=2024-06-01",
            headers={"Tenant-ID": tenant.identifier},
        )

        assert response.status_code == 200
        assert response.json() == {"message": "Team member deleted successfully"}

        team.reload()
        stored_member = team.get_member(team_member.uid, include_archived=True)
        assert stored_member is not None
        assert stored_member.is_deleted is True
        assert stored_member.last_working_day == datetime.date(2024, 6, 1)
        assert stored_member.separation_type is None
    finally:
        app.dependency_overrides = {}


def test_delete_team_member_requires_last_working_day():
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
            headers={"Tenant-ID": tenant.identifier},
        )

        assert response.status_code == 422

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


def test_add_team_member_success():
    unique_suffix = str(uuid.uuid4())
    tenant = Tenant(name=f"Tenant-{unique_suffix}", identifier=f"tenant-{unique_suffix}").save()
    team = Team(tenant=tenant, name="Team Alpha", team_members=[]).save()
    user = User(
        name="Manager",
        role="manager",
        tenants=[tenant],
        auth_details=AuthDetails(username=f"manager-{unique_suffix}"),
    ).save()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: user
    app.dependency_overrides[get_tenant] = lambda: tenant

    try:
        response = client.post(
            f"/teams/{team.id}/members",
            json={
                "name": "Bob",
                "country": "Sweden",
                "employee_start_date": "2025-01-01",
                "yearly_vacation_days": 25,
            },
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 200
        assert response.json() == {"message": "Team member created successfully"}

        team.reload()
        assert len(team.team_members) == 1
        assert team.team_members[0].name == "Bob"
    finally:
        app.dependency_overrides = {}


def test_add_team_member_invalid_country_returns_422():
    unique_suffix = str(uuid.uuid4())
    tenant = Tenant(name=f"Tenant-{unique_suffix}", identifier=f"tenant-{unique_suffix}").save()
    team = Team(tenant=tenant, name="Team Alpha", team_members=[]).save()
    user = User(
        name="Manager",
        role="manager",
        tenants=[tenant],
        auth_details=AuthDetails(username=f"manager-{unique_suffix}"),
    ).save()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: user
    app.dependency_overrides[get_tenant] = lambda: tenant

    try:
        response = client.post(
            f"/teams/{team.id}/members",
            json={
                "name": "Bob",
                "country": "taylor",
                "employee_start_date": "2025-01-01",
                "yearly_vacation_days": 25,
            },
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 422

        team.reload()
        assert len(team.team_members) == 0
    finally:
        app.dependency_overrides = {}


def test_add_team_member_team_not_found():
    unique_suffix = str(uuid.uuid4())
    tenant = Tenant(name=f"Tenant-{unique_suffix}", identifier=f"tenant-{unique_suffix}").save()
    user = User(
        name="Manager",
        role="manager",
        tenants=[tenant],
        auth_details=AuthDetails(username=f"manager-{unique_suffix}"),
    ).save()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: user
    app.dependency_overrides[get_tenant] = lambda: tenant

    try:
        response = client.post(
            "/teams/000000000000000000000000/members",
            json={
                "name": "Bob",
                "country": "Sweden",
                "employee_start_date": "2025-01-01",
                "yearly_vacation_days": 25,
            },
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 404
        assert response.json() == {"detail": "Team not found"}
    finally:
        app.dependency_overrides = {}


# --- update_team_member (PUT /{team_id}/members/{team_member_id}) tests ---


def _setup_team_with_member(**member_kwargs):
    """Helper: create tenant, team with one member, and a manager user."""
    unique_suffix = str(uuid.uuid4())
    tenant = Tenant(name=f"Tenant-{unique_suffix}", identifier=f"tenant-{unique_suffix}").save()
    defaults = {"name": "Alice", "country": "Sweden"}
    defaults.update(member_kwargs)
    team_member = TeamMember(**defaults)
    team = Team(tenant=tenant, name=f"Team-{unique_suffix}", team_members=[team_member]).save()
    user = User(
        name="Manager",
        role="manager",
        tenants=[tenant],
        auth_details=AuthDetails(username=f"manager-{unique_suffix}"),
    ).save()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: user
    app.dependency_overrides[get_tenant] = lambda: tenant

    return tenant, team, team_member, user


def _update_member_payload(**overrides):
    """Return a minimal valid payload for updating a team member."""
    payload = {
        "name": "Alice Updated",
        "country": "Norway",
    }
    payload.update(overrides)
    return payload


def test_update_team_member_success():
    tenant, team, member, user = _setup_team_with_member()
    try:
        response = client.put(
            f"/teams/{team.id}/members/{member.uid}",
            json=_update_member_payload(
                email="alice@example.com",
                phone="+46701234567",
                birthday="05-12",
                employee_start_date="2024-03-01",
                yearly_vacation_days=30,
            ),
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 200
        assert response.json() == {"message": "Team member modified successfully"}

        team.reload()
        updated = team.get_member(member.uid)
        assert updated.name == "Alice Updated"
        assert updated.country == "Norway"
        assert updated.email == "alice@example.com"
        assert updated.phone == "+46701234567"
        assert updated.birthday == "05-12"
        assert updated.employee_start_date == datetime.date(2024, 3, 1)
        assert float(updated.yearly_vacation_days) == 30.0
    finally:
        app.dependency_overrides = {}


def test_update_team_member_minimal_payload():
    """Only name and country are required; optional fields should be cleared."""
    tenant, team, member, _ = _setup_team_with_member(
        email="old@example.com", phone="+1234", birthday="01-15"
    )
    try:
        response = client.put(
            f"/teams/{team.id}/members/{member.uid}",
            json=_update_member_payload(),
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 200

        team.reload()
        updated = team.get_member(member.uid)
        assert updated.name == "Alice Updated"
        assert updated.country == "Norway"
        assert updated.email is None
        assert updated.phone is None
        assert updated.birthday is None
    finally:
        app.dependency_overrides = {}


def test_update_team_member_team_not_found():
    tenant, team, member, _ = _setup_team_with_member()
    try:
        response = client.put(
            f"/teams/000000000000000000000000/members/{member.uid}",
            json=_update_member_payload(),
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 404
        assert response.json() == {"detail": "Team not found"}
    finally:
        app.dependency_overrides = {}


def test_update_team_member_member_not_found():
    tenant, team, member, _ = _setup_team_with_member()
    fake_uid = str(uuid.uuid4())
    try:
        response = client.put(
            f"/teams/{team.id}/members/{fake_uid}",
            json=_update_member_payload(),
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 404
        assert response.json() == {"detail": "Team member not found"}
    finally:
        app.dependency_overrides = {}


def test_update_team_member_archived_returns_400():
    tenant, team, member, user = _setup_team_with_member()
    # Archive the member first via the delete endpoint
    try:
        delete_resp = client.request(
            "DELETE",
            f"/teams/{team.id}/members/{member.uid}?last_working_day=2024-06-01",
            headers={"Tenant-ID": tenant.identifier},
        )
        assert delete_resp.status_code == 200

        response = client.put(
            f"/teams/{team.id}/members/{member.uid}",
            json=_update_member_payload(),
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 400
        assert response.json() == {"detail": "Team member is archived"}
    finally:
        app.dependency_overrides = {}


def test_update_team_member_invalid_country_returns_422():
    tenant, team, member, _ = _setup_team_with_member()
    try:
        response = client.put(
            f"/teams/{team.id}/members/{member.uid}",
            json=_update_member_payload(country="NotACountry"),
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 422

        # Ensure original data is unchanged
        team.reload()
        unchanged = team.get_member(member.uid)
        assert unchanged.name == "Alice"
        assert unchanged.country == "Sweden"
    finally:
        app.dependency_overrides = {}


def test_update_team_member_empty_email_converted_to_none():
    tenant, team, member, _ = _setup_team_with_member(email="old@example.com")
    try:
        response = client.put(
            f"/teams/{team.id}/members/{member.uid}",
            json=_update_member_payload(email=""),
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 200

        team.reload()
        updated = team.get_member(member.uid)
        assert updated.email is None
    finally:
        app.dependency_overrides = {}


def test_update_team_member_invalid_email_returns_422():
    tenant, team, member, _ = _setup_team_with_member()
    try:
        response = client.put(
            f"/teams/{team.id}/members/{member.uid}",
            json=_update_member_payload(email="not-an-email"),
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 422
    finally:
        app.dependency_overrides = {}


def test_update_team_member_valid_birthday():
    tenant, team, member, _ = _setup_team_with_member()
    try:
        response = client.put(
            f"/teams/{team.id}/members/{member.uid}",
            json=_update_member_payload(birthday="12-25"),
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 200

        team.reload()
        updated = team.get_member(member.uid)
        assert updated.birthday == "12-25"
    finally:
        app.dependency_overrides = {}


def test_update_team_member_empty_birthday_converted_to_none():
    tenant, team, member, _ = _setup_team_with_member(birthday="03-14")
    try:
        response = client.put(
            f"/teams/{team.id}/members/{member.uid}",
            json=_update_member_payload(birthday=""),
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 200

        team.reload()
        updated = team.get_member(member.uid)
        assert updated.birthday is None
    finally:
        app.dependency_overrides = {}


def test_update_team_member_invalid_birthday_returns_422():
    tenant, team, member, _ = _setup_team_with_member()
    try:
        response = client.put(
            f"/teams/{team.id}/members/{member.uid}",
            json=_update_member_payload(birthday="2024-05-12"),
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 422
    finally:
        app.dependency_overrides = {}


def test_update_team_member_ignores_last_working_day():
    """last_working_day is managed exclusively by the delete endpoint and must
    not be settable through the edit payload."""
    tenant, team, member, _ = _setup_team_with_member()
    try:
        response = client.put(
            f"/teams/{team.id}/members/{member.uid}",
            json=_update_member_payload(last_working_day="2025-01-01"),
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 200

        team.reload()
        updated = team.get_member(member.uid)
        assert updated.last_working_day is None
    finally:
        app.dependency_overrides = {}


def test_add_team_member_ignores_last_working_day():
    """last_working_day must not be settable when creating a team member."""
    unique_suffix = str(uuid.uuid4())
    tenant = Tenant(name=f"Tenant-{unique_suffix}", identifier=f"tenant-{unique_suffix}").save()
    team = Team(tenant=tenant, name="Team Alpha", team_members=[]).save()
    user = User(
        name="Manager",
        role="manager",
        tenants=[tenant],
        auth_details=AuthDetails(username=f"manager-{unique_suffix}"),
    ).save()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: user
    app.dependency_overrides[get_tenant] = lambda: tenant

    try:
        response = client.post(
            f"/teams/{team.id}/members",
            json={
                "name": "Bob",
                "country": "Sweden",
                "employee_start_date": "2025-01-01",
                "yearly_vacation_days": 25,
                "last_working_day": "2025-06-01",
            },
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 200

        team.reload()
        assert len(team.team_members) == 1
        assert team.team_members[0].last_working_day is None
    finally:
        app.dependency_overrides = {}

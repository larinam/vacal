import datetime
import os
import uuid

os.environ.setdefault("MONGO_MOCK", "1")
os.environ.setdefault("AUTHENTICATION_SECRET_KEY", "test_secret")

from bson import ObjectId
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


def test_delete_team_member_allows_missing_separation_type():
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
            f"/teams/{team.id}/members/{member.uid}?last_working_day=2024-06-01&separation_type={SeparationType.RESIGNATION.value}",
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


def test_get_archived_members_requires_manager_role():
    unique_suffix = str(uuid.uuid4())
    tenant = Tenant(name=f"Tenant-{unique_suffix}", identifier=f"tenant-{unique_suffix}").save()
    user = User(
        name="Employee",
        role="employee",
        tenants=[tenant],
        auth_details=AuthDetails(username=f"employee-{unique_suffix}"),
    ).save()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: user
    app.dependency_overrides[get_tenant] = lambda: tenant

    try:
        response = client.get(
            "/teams/archived-members",
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 403
        assert response.json() == {"detail": "Only managers can access archived members."}
    finally:
        app.dependency_overrides = {}


def test_get_archived_members_returns_archived_only():
    unique_suffix = str(uuid.uuid4())
    tenant = Tenant(name=f"Tenant-{unique_suffix}", identifier=f"tenant-{unique_suffix}").save()
    active_member = TeamMember(name="Active Alice", country="Sweden")
    archived_member = TeamMember(
        name="Archived Bob",
        country="Germany",
        is_deleted=True,
        last_working_day=datetime.date(2024, 6, 1),
        separation_type=SeparationType.RESIGNATION.value,
    )
    team = Team(tenant=tenant, name="Test Team", team_members=[active_member, archived_member]).save()
    user = User(
        name="Manager",
        role="manager",
        tenants=[tenant],
        auth_details=AuthDetails(username=f"manager-{unique_suffix}"),
    ).save()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: user
    app.dependency_overrides[get_tenant] = lambda: tenant

    try:
        response = client.get(
            "/teams/archived-members",
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["archived_members"]) == 1
        result = data["archived_members"][0]
        assert result["name"] == "Archived Bob"
        assert result["team_name"] == "Test Team"
        assert result["separation_type"] == "resignation"
        assert result["last_working_day"] == "2024-06-01"
    finally:
        app.dependency_overrides = {}


# --- team parent hierarchy (parent_team_id) tests ---


def _authenticate_as(tenant, role, unique_suffix):
    """Create a user of the given role and route the auth dependencies to them."""
    user = User(
        name=role.capitalize(),
        role=role,
        tenants=[tenant],
        auth_details=AuthDetails(username=f"{role}-{unique_suffix}"),
    ).save()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: user
    app.dependency_overrides[get_tenant] = lambda: tenant

    return user


def _setup_team_tree(role="manager"):
    """Helper: tenant with Engineering > Backend > Payments, plus an authenticated user."""
    unique_suffix = str(uuid.uuid4())
    tenant = Tenant(name=f"Tenant-{unique_suffix}", identifier=f"tenant-{unique_suffix}").save()
    engineering = Team(tenant=tenant, name=f"Engineering-{unique_suffix}").save()
    backend = Team(tenant=tenant, name=f"Backend-{unique_suffix}",
                   parent_team_id=str(engineering.id)).save()
    payments = Team(tenant=tenant, name=f"Payments-{unique_suffix}",
                    parent_team_id=str(backend.id)).save()
    user = _authenticate_as(tenant, role, unique_suffix)

    return tenant, engineering, backend, payments, user


def test_add_team_with_parent_team_id():
    tenant, engineering, _, _, _ = _setup_team_tree()
    try:
        response = client.post(
            "/teams",
            json={"name": f"Frontend-{uuid.uuid4()}", "parent_team_id": str(engineering.id)},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 200
        created = Team.objects(tenant=tenant, parent_team_id=str(engineering.id),
                               name__startswith="Frontend-").first()
        assert created is not None
        assert created.parent_team_id == str(engineering.id)
    finally:
        app.dependency_overrides = {}


def test_add_team_without_parent_stores_none():
    tenant, _, _, _, _ = _setup_team_tree()
    try:
        name = f"Standalone-{uuid.uuid4()}"
        response = client.post(
            "/teams",
            json={"name": name},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 200
        assert Team.objects(tenant=tenant, name=name).first().parent_team_id is None
    finally:
        app.dependency_overrides = {}


def test_add_team_with_empty_parent_string_stores_none():
    tenant, _, _, _, _ = _setup_team_tree()
    try:
        name = f"Standalone-{uuid.uuid4()}"
        response = client.post(
            "/teams",
            json={"name": name, "parent_team_id": ""},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 200
        assert Team.objects(tenant=tenant, name=name).first().parent_team_id is None
    finally:
        app.dependency_overrides = {}


def test_add_team_with_unknown_parent_returns_404():
    tenant, _, _, _, _ = _setup_team_tree()
    try:
        response = client.post(
            "/teams",
            json={"name": f"Orphan-{uuid.uuid4()}", "parent_team_id": str(ObjectId())},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 404
        assert response.json() == {"detail": "Parent team not found"}
    finally:
        app.dependency_overrides = {}


def test_add_team_with_malformed_parent_id_returns_400():
    tenant, _, _, _, _ = _setup_team_tree()
    try:
        response = client.post(
            "/teams",
            json={"name": f"Orphan-{uuid.uuid4()}", "parent_team_id": "not-an-object-id"},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 400
        assert response.json() == {"detail": "Invalid parent team id"}
    finally:
        app.dependency_overrides = {}


def test_add_team_with_parent_from_another_tenant_returns_404():
    tenant, _, _, _, _ = _setup_team_tree()
    other_suffix = str(uuid.uuid4())
    other_tenant = Tenant(name=f"Tenant-{other_suffix}", identifier=f"tenant-{other_suffix}").save()
    foreign_team = Team(tenant=other_tenant, name=f"Foreign-{other_suffix}").save()
    try:
        response = client.post(
            "/teams",
            json={"name": f"Sneaky-{uuid.uuid4()}", "parent_team_id": str(foreign_team.id)},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 404
        assert response.json() == {"detail": "Parent team not found"}
    finally:
        app.dependency_overrides = {}


def test_add_team_with_parent_requires_manager_role():
    tenant, engineering, _, _, _ = _setup_team_tree(role="employee")
    try:
        name = f"Frontend-{uuid.uuid4()}"
        response = client.post(
            "/teams",
            json={"name": name, "parent_team_id": str(engineering.id)},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 403
        assert response.json() == {"detail": "Only managers can change the team hierarchy."}
        assert Team.objects(tenant=tenant, name=name).first() is None
    finally:
        app.dependency_overrides = {}


def test_add_team_without_parent_is_allowed_for_employee():
    tenant, _, _, _, _ = _setup_team_tree(role="employee")
    try:
        name = f"Standalone-{uuid.uuid4()}"
        response = client.post(
            "/teams",
            json={"name": name},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 200
        assert Team.objects(tenant=tenant, name=name).first() is not None
    finally:
        app.dependency_overrides = {}


def test_update_team_sets_parent_team_id():
    tenant, engineering, _, _, _ = _setup_team_tree()
    standalone = Team(tenant=tenant, name=f"Sales-{uuid.uuid4()}").save()
    try:
        response = client.put(
            f"/teams/{standalone.id}",
            json={"name": standalone.name, "parent_team_id": str(engineering.id)},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 200
        standalone.reload()
        assert standalone.parent_team_id == str(engineering.id)
    finally:
        app.dependency_overrides = {}


def test_update_team_clears_parent_with_explicit_null():
    tenant, _, backend, _, _ = _setup_team_tree()
    try:
        response = client.put(
            f"/teams/{backend.id}",
            json={"name": backend.name, "parent_team_id": None},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 200
        backend.reload()
        assert backend.parent_team_id is None
    finally:
        app.dependency_overrides = {}


def test_update_team_omitting_parent_preserves_existing_parent():
    # TeamWriteDTO is shared by POST and PUT: a rename must not detach the team.
    tenant, engineering, backend, _, _ = _setup_team_tree()
    try:
        response = client.put(
            f"/teams/{backend.id}",
            json={"name": f"Renamed-{uuid.uuid4()}"},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 200
        backend.reload()
        assert backend.parent_team_id == str(engineering.id)
    finally:
        app.dependency_overrides = {}


def test_update_team_self_parent_returns_400():
    tenant, _, backend, _, _ = _setup_team_tree()
    try:
        response = client.put(
            f"/teams/{backend.id}",
            json={"name": backend.name, "parent_team_id": str(backend.id)},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 400
        assert response.json() == {"detail": "Parent team assignment would create a cycle"}
    finally:
        app.dependency_overrides = {}


def test_update_team_descendant_parent_returns_400():
    tenant, engineering, _, payments, _ = _setup_team_tree()
    try:
        response = client.put(
            f"/teams/{engineering.id}",
            json={"name": engineering.name, "parent_team_id": str(payments.id)},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 400
        assert response.json() == {"detail": "Parent team assignment would create a cycle"}
        engineering.reload()
        assert engineering.parent_team_id is None
    finally:
        app.dependency_overrides = {}


def test_update_team_with_archived_parent_returns_404():
    tenant, _, _, _, _ = _setup_team_tree()
    archived = Team(tenant=tenant, name=f"Archived-{uuid.uuid4()}", is_deleted=True).save()
    standalone = Team(tenant=tenant, name=f"Sales-{uuid.uuid4()}").save()
    try:
        response = client.put(
            f"/teams/{standalone.id}",
            json={"name": standalone.name, "parent_team_id": str(archived.id)},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 404
        assert response.json() == {"detail": "Parent team not found"}
    finally:
        app.dependency_overrides = {}


def test_update_team_resending_unchanged_parent_skips_validation():
    # A no-op PUT must not fail even if the stored parent would no longer validate.
    tenant, _, _, _, _ = _setup_team_tree()
    archived = Team(tenant=tenant, name=f"Archived-{uuid.uuid4()}").save()
    child = Team(tenant=tenant, name=f"Child-{uuid.uuid4()}", parent_team_id=str(archived.id)).save()
    archived.is_deleted = True
    archived.save()
    try:
        response = client.put(
            f"/teams/{child.id}",
            json={"name": child.name, "parent_team_id": str(archived.id)},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 200
        child.reload()
        assert child.parent_team_id == str(archived.id)
    finally:
        app.dependency_overrides = {}


def test_update_team_parent_requires_manager_role():
    tenant, engineering, _, _, _ = _setup_team_tree(role="employee")
    standalone = Team(tenant=tenant, name=f"Sales-{uuid.uuid4()}").save()
    try:
        response = client.put(
            f"/teams/{standalone.id}",
            json={"name": standalone.name, "parent_team_id": str(engineering.id)},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 403
        assert response.json() == {"detail": "Only managers can change the team hierarchy."}
        standalone.reload()
        assert standalone.parent_team_id is None
    finally:
        app.dependency_overrides = {}


def test_update_team_rename_without_parent_is_allowed_for_employee():
    tenant, engineering, backend, _, _ = _setup_team_tree(role="employee")
    try:
        new_name = f"Renamed-{uuid.uuid4()}"
        response = client.put(
            f"/teams/{backend.id}",
            json={"name": new_name},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 200
        backend.reload()
        assert backend.name == new_name
        assert backend.parent_team_id == str(engineering.id)
    finally:
        app.dependency_overrides = {}


def test_list_teams_exposes_parent_team_id():
    tenant, engineering, backend, _, _ = _setup_team_tree()
    try:
        response = client.get("/teams", headers={"Tenant-ID": tenant.identifier})
        assert response.status_code == 200
        by_id = {team["_id"]: team for team in response.json()["teams"]}
        assert by_id[str(engineering.id)]["parent_team_id"] is None
        assert by_id[str(backend.id)]["parent_team_id"] == str(engineering.id)
    finally:
        app.dependency_overrides = {}


def test_delete_team_reparents_children_to_grandparent():
    # Backend has no members, so it is hard-deleted; Payments must move under Engineering.
    tenant, engineering, backend, payments, _ = _setup_team_tree()
    try:
        response = client.delete(f"/teams/{backend.id}", headers={"Tenant-ID": tenant.identifier})
        assert response.status_code == 200
        assert Team.objects_with_deleted(id=backend.id).first() is None
        payments.reload()
        assert payments.parent_team_id == str(engineering.id)
    finally:
        app.dependency_overrides = {}


def test_soft_delete_team_reparents_children_to_grandparent():
    tenant, engineering, backend, payments, _ = _setup_team_tree()
    backend.team_members = [TeamMember(name="Alice", country="Sweden")]
    backend.save()
    try:
        response = client.delete(f"/teams/{backend.id}", headers={"Tenant-ID": tenant.identifier})
        assert response.status_code == 200
        backend.reload()
        assert backend.is_deleted is True
        payments.reload()
        assert payments.parent_team_id == str(engineering.id)
    finally:
        app.dependency_overrides = {}


def test_delete_root_team_makes_children_roots():
    tenant, engineering, backend, _, _ = _setup_team_tree()
    try:
        response = client.delete(f"/teams/{engineering.id}", headers={"Tenant-ID": tenant.identifier})
        assert response.status_code == 200
        backend.reload()
        assert backend.parent_team_id is None
    finally:
        app.dependency_overrides = {}


def test_delete_team_reparents_archived_children():
    tenant, engineering, backend, payments, _ = _setup_team_tree()
    payments.is_deleted = True
    payments.save()
    try:
        response = client.delete(f"/teams/{backend.id}", headers={"Tenant-ID": tenant.identifier})
        assert response.status_code == 200
        payments.reload()
        assert payments.parent_team_id == str(engineering.id)
    finally:
        app.dependency_overrides = {}


# --- team leader (leader_uid) tests ---


def _setup_teams_with_members(role="manager"):
    """Helper: two teams with members, plus an authenticated user of the given role."""
    unique_suffix = str(uuid.uuid4())
    tenant = Tenant(name=f"Tenant-{unique_suffix}", identifier=f"tenant-{unique_suffix}").save()
    # GET /teams computes vacation days per member, which needs the seeded day types.
    DayType.init_day_types(tenant)
    ada = TeamMember(name="Ada", country="Sweden")
    bob = TeamMember(name="Bob", country="Finland")
    engineering = Team(tenant=tenant, name=f"Engineering-{unique_suffix}",
                       team_members=[ada, bob]).save()
    cleo = TeamMember(name="Cleo", country="Norway")
    payments = Team(tenant=tenant, name=f"Payments-{unique_suffix}", team_members=[cleo]).save()
    user = _authenticate_as(tenant, role, unique_suffix)

    return tenant, engineering, payments, user


def test_add_team_with_leader_from_another_team():
    tenant, engineering, _, _ = _setup_teams_with_members()
    leader_uid = str(engineering.team_members[0].uid)
    try:
        name = f"Frontend-{uuid.uuid4()}"
        response = client.post(
            "/teams",
            json={"name": name, "leader_uid": leader_uid},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 200
        created = Team.objects(tenant=tenant, name=name).first()
        assert created.leader_uid == leader_uid
    finally:
        app.dependency_overrides = {}


def test_add_team_without_leader_stores_none():
    tenant, _, _, _ = _setup_teams_with_members()
    try:
        name = f"Leaderless-{uuid.uuid4()}"
        response = client.post("/teams", json={"name": name},
                               headers={"Tenant-ID": tenant.identifier})
        assert response.status_code == 200
        assert Team.objects(tenant=tenant, name=name).first().leader_uid is None
    finally:
        app.dependency_overrides = {}


def test_add_team_with_empty_leader_string_stores_none():
    tenant, _, _, _ = _setup_teams_with_members()
    try:
        name = f"Leaderless-{uuid.uuid4()}"
        response = client.post("/teams", json={"name": name, "leader_uid": ""},
                               headers={"Tenant-ID": tenant.identifier})
        assert response.status_code == 200
        assert Team.objects(tenant=tenant, name=name).first().leader_uid is None
    finally:
        app.dependency_overrides = {}


def test_add_team_with_unknown_leader_returns_404():
    tenant, _, _, _ = _setup_teams_with_members()
    try:
        response = client.post(
            "/teams",
            json={"name": f"Ghost-{uuid.uuid4()}", "leader_uid": str(uuid.uuid4())},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 404
        assert response.json()["detail"] == "Team leader not found"
    finally:
        app.dependency_overrides = {}


def test_add_team_with_malformed_leader_returns_400():
    tenant, _, _, _ = _setup_teams_with_members()
    try:
        response = client.post(
            "/teams",
            json={"name": f"Broken-{uuid.uuid4()}", "leader_uid": "not-a-uuid"},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 400
        assert response.json()["detail"] == "Invalid team leader id"
    finally:
        app.dependency_overrides = {}


def test_add_team_with_leader_from_other_tenant_returns_404():
    tenant, _, _, _ = _setup_teams_with_members()
    other_suffix = str(uuid.uuid4())
    other_tenant = Tenant(name=f"Other-{other_suffix}", identifier=f"other-{other_suffix}").save()
    outsider = TeamMember(name="Outsider", country="Denmark")
    Team(tenant=other_tenant, name=f"Outside-{other_suffix}", team_members=[outsider]).save()
    try:
        response = client.post(
            "/teams",
            json={"name": f"Poach-{uuid.uuid4()}", "leader_uid": str(outsider.uid)},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 404
    finally:
        app.dependency_overrides = {}


def test_add_team_with_leader_is_rejected_for_employee():
    tenant, engineering, _, _ = _setup_teams_with_members(role="employee")
    name = f"Frontend-{uuid.uuid4()}"
    try:
        response = client.post(
            "/teams",
            json={"name": name, "leader_uid": str(engineering.team_members[0].uid)},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 403
        assert response.json()["detail"] == "Only managers can change the team leader."
        assert Team.objects(tenant=tenant, name=name).first() is None
    finally:
        app.dependency_overrides = {}


def test_add_team_without_leader_is_allowed_for_employee():
    tenant, _, _, _ = _setup_teams_with_members(role="employee")
    try:
        name = f"Standalone-{uuid.uuid4()}"
        response = client.post("/teams", json={"name": name},
                               headers={"Tenant-ID": tenant.identifier})
        assert response.status_code == 200
        assert Team.objects(tenant=tenant, name=name).first().leader_uid is None
    finally:
        app.dependency_overrides = {}


def test_update_team_sets_leader():
    tenant, engineering, payments, _ = _setup_teams_with_members()
    leader_uid = str(engineering.team_members[1].uid)
    try:
        response = client.put(
            f"/teams/{payments.id}",
            json={"name": payments.name, "leader_uid": leader_uid},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 200
        payments.reload()
        assert payments.leader_uid == leader_uid
    finally:
        app.dependency_overrides = {}


def test_update_team_with_own_member_as_leader():
    tenant, engineering, _, _ = _setup_teams_with_members()
    leader_uid = str(engineering.team_members[0].uid)
    try:
        response = client.put(
            f"/teams/{engineering.id}",
            json={"name": engineering.name, "leader_uid": leader_uid},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 200
        engineering.reload()
        assert engineering.leader_uid == leader_uid
    finally:
        app.dependency_overrides = {}


def test_update_team_clears_leader_with_explicit_null():
    tenant, engineering, payments, _ = _setup_teams_with_members()
    payments.leader_uid = str(engineering.team_members[0].uid)
    payments.save()
    try:
        response = client.put(
            f"/teams/{payments.id}",
            json={"name": payments.name, "leader_uid": None},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 200
        payments.reload()
        assert payments.leader_uid is None
    finally:
        app.dependency_overrides = {}


def test_update_team_without_leader_key_keeps_stored_leader():
    tenant, engineering, payments, _ = _setup_teams_with_members()
    leader_uid = str(engineering.team_members[0].uid)
    payments.leader_uid = leader_uid
    payments.save()
    try:
        response = client.put(
            f"/teams/{payments.id}",
            json={"name": f"Renamed-{uuid.uuid4()}"},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 200
        payments.reload()
        assert payments.leader_uid == leader_uid
    finally:
        app.dependency_overrides = {}


def test_update_team_rename_without_leader_key_is_allowed_for_employee():
    tenant, engineering, payments, _ = _setup_teams_with_members(role="employee")
    leader_uid = str(engineering.team_members[0].uid)
    payments.leader_uid = leader_uid
    payments.save()
    new_name = f"Renamed-{uuid.uuid4()}"
    try:
        response = client.put(
            f"/teams/{payments.id}",
            json={"name": new_name},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 200
        payments.reload()
        assert payments.name == new_name
        assert payments.leader_uid == leader_uid
    finally:
        app.dependency_overrides = {}


def test_update_team_resending_unchanged_leader_skips_validation():
    tenant, engineering, payments, _ = _setup_teams_with_members()
    leader = engineering.team_members[0]
    payments.leader_uid = str(leader.uid)
    payments.save()
    # The stored leader is archived, so re-validating would now reject them.
    leader.is_deleted = True
    engineering.save()
    try:
        response = client.put(
            f"/teams/{payments.id}",
            json={"name": payments.name, "leader_uid": str(leader.uid)},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 200
        payments.reload()
        assert payments.leader_uid == str(leader.uid)
    finally:
        app.dependency_overrides = {}


def test_update_team_leader_is_rejected_for_employee():
    tenant, engineering, payments, _ = _setup_teams_with_members(role="employee")
    try:
        response = client.put(
            f"/teams/{payments.id}",
            json={"name": payments.name, "leader_uid": str(engineering.team_members[0].uid)},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 403
        payments.reload()
        assert payments.leader_uid is None
    finally:
        app.dependency_overrides = {}


def test_update_team_with_archived_member_as_leader_returns_404():
    tenant, engineering, payments, _ = _setup_teams_with_members()
    archived = engineering.team_members[0]
    archived.is_deleted = True
    engineering.save()
    try:
        response = client.put(
            f"/teams/{payments.id}",
            json={"name": payments.name, "leader_uid": str(archived.uid)},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 404
    finally:
        app.dependency_overrides = {}


def test_update_team_with_member_of_archived_team_as_leader_returns_404():
    tenant, engineering, payments, _ = _setup_teams_with_members()
    engineering.is_deleted = True
    engineering.save()
    try:
        response = client.put(
            f"/teams/{payments.id}",
            json={"name": payments.name, "leader_uid": str(engineering.team_members[0].uid)},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 404
    finally:
        app.dependency_overrides = {}


def test_update_team_normalises_uppercase_leader_uid():
    tenant, engineering, payments, _ = _setup_teams_with_members()
    leader_uid = str(engineering.team_members[0].uid)
    try:
        response = client.put(
            f"/teams/{payments.id}",
            json={"name": payments.name, "leader_uid": leader_uid.upper()},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 200
        payments.reload()
        assert payments.leader_uid == leader_uid
    finally:
        app.dependency_overrides = {}


def test_one_member_can_lead_several_teams():
    tenant, engineering, payments, _ = _setup_teams_with_members()
    leader_uid = str(engineering.team_members[0].uid)
    try:
        for team in (engineering, payments):
            response = client.put(
                f"/teams/{team.id}",
                json={"name": team.name, "leader_uid": leader_uid},
                headers={"Tenant-ID": tenant.identifier},
            )
            assert response.status_code == 200
            team.reload()
            assert team.leader_uid == leader_uid
    finally:
        app.dependency_overrides = {}


def test_list_teams_exposes_leader_uid():
    tenant, engineering, payments, _ = _setup_teams_with_members()
    leader_uid = str(engineering.team_members[0].uid)
    payments.leader_uid = leader_uid
    payments.save()
    try:
        response = client.get("/teams", headers={"Tenant-ID": tenant.identifier})
        assert response.status_code == 200
        by_name = {team["name"]: team for team in response.json()["teams"]}
        assert by_name[payments.name]["leader_uid"] == leader_uid
        assert by_name[engineering.name]["leader_uid"] is None
    finally:
        app.dependency_overrides = {}


def test_delete_team_member_clears_leader_references():
    tenant, engineering, payments, _ = _setup_teams_with_members()
    leader = engineering.team_members[0]
    other_leader_uid = str(engineering.team_members[1].uid)
    engineering.leader_uid = str(leader.uid)
    engineering.save()
    payments.leader_uid = str(leader.uid)
    payments.save()
    bystander = Team(tenant=tenant, name=f"Bystander-{uuid.uuid4()}",
                     leader_uid=other_leader_uid).save()
    try:
        response = client.delete(
            f"/teams/{engineering.id}/members/{leader.uid}",
            params={"last_working_day": "2026-07-31"},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 200
        engineering.reload()
        payments.reload()
        bystander.reload()
        assert engineering.leader_uid is None
        assert payments.leader_uid is None
        # A team led by somebody else must be left alone.
        assert bystander.leader_uid == other_leader_uid
    finally:
        app.dependency_overrides = {}


def test_delete_team_clears_other_teams_leader_references():
    tenant, engineering, payments, _ = _setup_teams_with_members()
    leader_uid = str(engineering.team_members[0].uid)
    engineering.leader_uid = leader_uid
    engineering.save()
    payments.leader_uid = leader_uid
    payments.save()
    try:
        response = client.delete(f"/teams/{engineering.id}",
                                 headers={"Tenant-ID": tenant.identifier})
        assert response.status_code == 200
        payments.reload()
        assert payments.leader_uid is None
        # The archived team keeps its own pointer so a revival stays self-consistent.
        engineering.reload()
        assert engineering.leader_uid == leader_uid
    finally:
        app.dependency_overrides = {}

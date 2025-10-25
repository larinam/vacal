import datetime
import os

os.environ.setdefault("MONGO_MOCK", "1")
os.environ.setdefault("AUTHENTICATION_SECRET_KEY", "test_secret")

from fastapi.testclient import TestClient

from backend.dependencies import get_current_active_user_check_tenant, get_tenant
from backend.main import app
from backend.model import AuthDetails, Team, TeamMember, Tenant, User


client = TestClient(app)


def test_delete_team_member_stores_last_working_day():
    tenant = Tenant(name="Tenant", identifier="tenant-identifier").save()
    team_member = TeamMember(name="Alice", country="Sweden")
    team = Team(tenant=tenant, name="Team Alpha", team_members=[team_member]).save()
    user = User(
        name="Manager",
        role="manager",
        tenants=[tenant],
        auth_details=AuthDetails(username="manager"),
    ).save()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: user
    app.dependency_overrides[get_tenant] = lambda: tenant

    try:
        response = client.request(
            "DELETE",
            f"/teams/{team.id}/members/{team_member.uid}",
            json={"last_working_day": "2024-06-01"},
            headers={"Tenant-ID": tenant.identifier},
        )

        assert response.status_code == 200
        assert response.json() == {"message": "Team member deleted successfully"}

        team.reload()
        stored_member = team.get_member(team_member.uid, include_archived=True)
        assert stored_member is not None
        assert stored_member.is_deleted is True
        assert stored_member.last_working_day == datetime.date(2024, 6, 1)
    finally:
        app.dependency_overrides = {}

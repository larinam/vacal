import datetime
import uuid

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.model import Tenant, DayType, Team, TeamMember, User, AuthDetails, DayAudit
from backend.dependencies import get_current_active_user_check_tenant, get_tenant

client = TestClient(app)


def setup_team():
    tenant = Tenant(name=f"Tenant{uuid.uuid4()}", identifier=str(uuid.uuid4())).save()
    DayType.init_day_types(tenant)
    member = TeamMember(name="Alice", country="Sweden")
    team = Team(tenant=tenant, name="Team", team_members=[member]).save()
    user = User(tenants=[tenant], name="User", auth_details=AuthDetails(username=str(uuid.uuid4()))).save()
    return team, member, user


def test_update_days_creates_audit():
    team, member, user = setup_team()
    vac = DayType.objects(tenant=team.tenant, identifier="vacation").first()
    day_type_id = str(vac.id)

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: user

    resp = client.put(
        f"/teams/{team.id}/members/{member.uid}/days",
        json={"2025-01-01": {"day_types": [day_type_id], "comment": "hello"}},
        headers={"Tenant-ID": team.tenant.identifier},
    )
    assert resp.status_code == 200

    resp = client.put(
        f"/teams/{team.id}/members/{member.uid}/days",
        json={"2025-01-01": {"day_types": [day_type_id], "comment": "changed"}},
        headers={"Tenant-ID": team.tenant.identifier},
    )
    assert resp.status_code == 200

    audits = DayAudit.objects(
        tenant=team.tenant,
        team=team,
        member_uid=str(member.uid),
        date=datetime.date(2025, 1, 1),
    ).order_by("timestamp")
    assert audits.count() == 2
    assert audits[0].action == "created"
    assert audits[1].action == "updated"
    hist_resp = client.get(
        f"/teams/{team.id}/members/{member.uid}/days/2025-01-01/history",
        headers={"Tenant-ID": team.tenant.identifier},
    )
    assert hist_resp.status_code == 200
    history = hist_resp.json()
    assert len(history) == 2
    # newest entry first
    assert history[0]["action"] == "updated"
    assert history[1]["action"] == "created"

    member_hist_resp = client.get(
        f"/teams/{team.id}/members/{member.uid}/history",
        headers={"Tenant-ID": team.tenant.identifier},
    )
    assert member_hist_resp.status_code == 200
    member_history = member_hist_resp.json()
    assert len(member_history) == 2
    assert member_history[0]["action"] == "updated"
    assert member_history[1]["action"] == "created"

    app.dependency_overrides = {}


@pytest.mark.parametrize(
    "endpoint",
    [
        "/teams/{team_id}/members/{member_uid}/history",
        "/teams/{team_id}/members/{member_uid}/days/2025-01-01/history",
    ],
)
def test_history_pagination(endpoint):
    team, member, user = setup_team()
    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: user

    for i in range(120):
        DayAudit(
            tenant=team.tenant,
            team=team,
            member_uid=str(member.uid),
            date=datetime.date(2025, 1, 1),
            user=user,
            timestamp=datetime.datetime.utcnow() + datetime.timedelta(minutes=i),
            old_day_types=[],
            new_day_types=[],
            old_comment="",
            new_comment="",
            action="updated",
        ).save()

    url = endpoint.format(team_id=team.id, member_uid=member.uid)

    resp = client.get(
        url,
        headers={"Tenant-ID": team.tenant.identifier},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 100

    resp2 = client.get(
        f"{url}?skip=100",
        headers={"Tenant-ID": team.tenant.identifier},
    )
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert len(data2) == 20

    resp3 = client.get(
        f"{url}?skip=200",
        headers={"Tenant-ID": team.tenant.identifier},
    )
    assert resp3.status_code == 200
    assert resp3.json() == []

    app.dependency_overrides = {}

import os
os.environ.setdefault("MONGO_MOCK", "1")
os.environ.setdefault("AUTHENTICATION_SECRET_KEY", "test_secret")

import datetime
import uuid

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

    audit = DayAudit.objects(tenant=team.tenant, team=team, member_uid=str(member.uid), date=datetime.date(2025,1,1)).first()
    assert audit is not None
    assert audit.action == "created"
    assert [str(dt.id) for dt in audit.new_day_types] == [day_type_id]
    hist_resp = client.get(
        f"/teams/{team.id}/members/{member.uid}/days/2025-01-01/history",
        headers={"Tenant-ID": team.tenant.identifier},
    )
    assert hist_resp.status_code == 200
    history = hist_resp.json()
    assert len(history) == 1
    assert history[0]["action"] == "created"

    app.dependency_overrides = {}

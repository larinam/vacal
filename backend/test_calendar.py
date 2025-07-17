import os
os.environ.setdefault("MONGO_MOCK", "1")
os.environ.setdefault("AUTHENTICATION_SECRET_KEY", "test_secret")

from fastapi.testclient import TestClient
from .main import app
from .model import Tenant, DayType, Team, TeamMember, DayEntry

client = TestClient(app)


def setup_team():
    tenant = Tenant(name="Test Tenant", identifier="test").save()
    DayType.init_day_types(tenant)
    vacation = DayType.objects(tenant=tenant, identifier="vacation").first()
    member = TeamMember(name="Alice", country="Sweden", days={"2025-01-01": DayEntry(day_types=[vacation])})
    team = Team(tenant=tenant, name="Team", team_members=[member], calendar_token="tok123")
    team.save()
    return team


def test_calendar_feed_deterministic():
    setup_team()
    resp1 = client.get("/teams/calendar/tok123")
    resp2 = client.get("/teams/calendar/tok123")
    assert resp1.status_code == 200
    assert resp1.status_code == resp2.status_code
    assert resp1.text == resp2.text
    assert "BEGIN:VEVENT" in resp1.text
    assert "VALUE=DATE" in resp1.text

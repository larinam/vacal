import os
os.environ.setdefault("MONGO_MOCK", "1")
os.environ.setdefault("AUTHENTICATION_SECRET_KEY", "test_secret")

from fastapi.testclient import TestClient
import uuid
from .main import app
from .model import Tenant, DayType, Team, TeamMember, DayEntry, User, AuthDetails

client = TestClient(app)


def setup_team():
    tenant = Tenant(name=f"Tenant{uuid.uuid4()}", identifier=str(uuid.uuid4())).save()
    DayType.init_day_types(tenant)
    vacation = DayType.objects(tenant=tenant, identifier="vacation").first()
    member = TeamMember(name="Alice", country="Sweden", days={"2025-01-01": DayEntry(day_types=[vacation])})
    user = User(
        tenants=[tenant],
        name="Subscriber",
        email=f"sub{uuid.uuid4()}@example.com",
        auth_details=AuthDetails(username=str(uuid.uuid4()))
    ).save()
    team = Team(
        tenant=tenant,
        name="Team",
        team_members=[member],
        subscribers=[user],
    ).save()
    return team, user


def test_calendar_feed_deterministic():
    team, user = setup_team()
    url = f"/teams/calendar/{team.id}?user_api_key={user.auth_details.api_key}"
    resp1 = client.get(url)
    resp2 = client.get(url)
    assert resp1.status_code == 200
    assert resp1.status_code == resp2.status_code
    assert resp1.text == resp2.text
    assert "BEGIN:VEVENT" in resp1.text
    assert "VALUE=DATE" in resp1.text


def test_calendar_feed_revoked_after_user_deleted():
    team, user = setup_team()
    api_key = user.auth_details.api_key
    # Remove user from the system entirely
    user.delete()
    url = f"/teams/calendar/{team.id}?user_api_key={api_key}"
    resp = client.get(url)
    assert resp.status_code == 404

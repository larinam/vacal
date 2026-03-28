from fastapi.testclient import TestClient
from icalendar import Calendar
import uuid

from backend.main import app
from backend.model import Tenant, DayType, Team, TeamMember, DayEntry, User, AuthDetails

client = TestClient(app)


def setup_team():
    tenant = Tenant(name=f"Tenant{uuid.uuid4()}", identifier=str(uuid.uuid4())).save()
    DayType.init_day_types(tenant)
    vacation = DayType.objects(tenant=tenant, identifier="vacation").first()
    member = TeamMember(
        name="Alice",
        country="Sweden",
        days={"2025-01-01": DayEntry(day_types=[vacation], comment="Out of office")},
    )
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
    assert "X-WR-CALNAME:Team - " in resp1.text
    assert "BEGIN:VEVENT" in resp1.text
    assert "VALUE=DATE" in resp1.text

    parsed = Calendar.from_ical(resp1.text)
    events = [component for component in parsed.walk() if component.name == "VEVENT"]
    assert len(events) == 1

    event = events[0]
    assert str(parsed["X-WR-CALNAME"]).startswith("Team - ")
    assert str(event["SUMMARY"]) == "Alice - Vacation"
    assert str(event["DESCRIPTION"]) == "Out of office"
    assert str(event["UID"]) == f"{team.id}-{team.team_members[0].uid}-2025-01-01-{team.team_members[0].days['2025-01-01'].day_types[0].id}"
    assert event.decoded("DTSTART").isoformat() == "2025-01-01"


def test_calendar_feed_revoked_after_user_deleted():
    team, user = setup_team()
    api_key = user.auth_details.api_key
    # Remove user from the system entirely
    user.delete()
    url = f"/teams/calendar/{team.id}?user_api_key={api_key}"
    resp = client.get(url)
    assert resp.status_code == 404


def test_calendar_feed_blocks_cross_tenant_access():
    team, _ = setup_team()
    other_tenant = Tenant(name=f"Tenant{uuid.uuid4()}", identifier=str(uuid.uuid4())).save()
    other_user = User(
        tenants=[other_tenant],
        name="Other Subscriber",
        email=f"sub{uuid.uuid4()}@example.com",
        auth_details=AuthDetails(username=str(uuid.uuid4())),
    ).save()

    url = f"/teams/calendar/{team.id}?user_api_key={other_user.auth_details.api_key}"
    resp = client.get(url)
    assert resp.status_code == 404

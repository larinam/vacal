import datetime
import uuid
from unittest.mock import patch

from backend.model import Tenant, DayType, Team, TeamMember, DayEntry, User, AuthDetails
from backend.scheduled.vacation_starts import send_upcoming_vacation_email_updates


def setup_team_with_ongoing_vacation(today: datetime.date):
    tenant = Tenant(name=f"Tenant{uuid.uuid4()}", identifier=str(uuid.uuid4())).save()
    DayType.init_day_types(tenant)
    vacation = DayType.objects(tenant=tenant, identifier="vacation").first()

    # Subscriber to receive notifications
    subscriber = User(
        tenants=[tenant],
        name="Subscriber",
        email=f"sub{uuid.uuid4()}@example.com",
        auth_details=AuthDetails(username=str(uuid.uuid4()))
    ).save()

    start = today - datetime.timedelta(days=1)  # vacation started yesterday
    end = today + datetime.timedelta(days=3)
    days = {}
    current = start
    while current <= end:
        days[str(current)] = DayEntry(day_types=[vacation])
        current += datetime.timedelta(days=1)

    member = TeamMember(name="Alice", country="Sweden", email="alice@example.com", days=days)
    Team(tenant=tenant, name="Team", team_members=[member], subscribers=[subscriber]).save()
    return subscriber.email


def test_upcoming_vacation_excludes_ongoing_vacation():
    today = datetime.date(2025, 9, 5)
    email = setup_team_with_ongoing_vacation(today)

    with patch("backend.scheduled.vacation_starts.send_email") as mock_send_email, \
         patch("backend.scheduled.vacation_starts.datetime") as mock_datetime:
        mock_datetime.date.today.return_value = today
        mock_datetime.timedelta = datetime.timedelta
        send_upcoming_vacation_email_updates()
        # No email should be sent because the vacation already started
        mock_send_email.assert_not_called()

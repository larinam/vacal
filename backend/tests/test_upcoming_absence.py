import datetime
import uuid
from unittest.mock import patch

from backend.model import (
    Tenant,
    DayType,
    Team,
    TeamMember,
    DayEntry,
    User,
    AuthDetails,
    TeamNotificationSubscription,
    NotificationTopic,
)
from backend.scheduled.absence_starts import send_upcoming_absence_email_updates


def setup_team_with_ongoing_absence(today: datetime.date):
    tenant = Tenant(name=f"Tenant{uuid.uuid4()}", identifier=str(uuid.uuid4())).save()
    DayType.init_day_types(tenant)
    absence_day_type = DayType.objects(tenant=tenant, identifier="vacation").first()

    # Subscriber to receive notifications
    subscriber = User(
        tenants=[tenant],
        name="Subscriber",
        email=f"sub{uuid.uuid4()}@example.com",
        auth_details=AuthDetails(username=str(uuid.uuid4()))
    ).save()

    start = today - datetime.timedelta(days=1)  # absence started yesterday
    end = today + datetime.timedelta(days=3)
    days = {}
    current = start
    while current <= end:
        days[str(current)] = DayEntry(day_types=[absence_day_type])
        current += datetime.timedelta(days=1)

    member = TeamMember(name="Alice", country="Sweden", email="alice@example.com", days=days)
    Team(
        tenant=tenant,
        name="Team",
        team_members=[member],
        notification_subscriptions=[
            TeamNotificationSubscription(
                user=subscriber,
                topics=[topic.value for topic in NotificationTopic.defaults()],
            )
        ],
    ).save()
    return subscriber.email


def test_upcoming_absence_excludes_ongoing_absence():
    today = datetime.date(2025, 9, 5)
    setup_team_with_ongoing_absence(today)

    with patch("backend.scheduled.absence_starts.send_email") as mock_send_email, \
         patch("backend.scheduled.absence_starts.datetime") as mock_datetime:
        mock_datetime.date.today.return_value = today
        mock_datetime.timedelta = datetime.timedelta
        send_upcoming_absence_email_updates()
        # No email should be sent because the absence already started
        mock_send_email.assert_not_called()

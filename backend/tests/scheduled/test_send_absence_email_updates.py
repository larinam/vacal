import datetime
import uuid
from unittest.mock import patch

from backend.model import (
    Tenant,
    User,
    AuthDetails,
    DayType,
    Team,
    TeamMember,
    DayEntry,
)
from backend.scheduled.absence_starts import send_absence_email_updates


def test_send_absence_email_updates_dispatch_and_content():
    tenant = Tenant(
        name=f"Tenant{uuid.uuid4()}",
        identifier=str(uuid.uuid4()),
    ).save()
    DayType.init_day_types(tenant)
    vacation = DayType.objects(tenant=tenant, identifier="vacation").first()

    member = TeamMember(
        name="John Doe",
        email="john@example.com",
        country="United States",
        days={"2024-07-01": DayEntry(day_types=[vacation])},
    )

    subscriber_email = f"alice{uuid.uuid4()}@example.com"
    subscriber = User(
        name="Alice",
        email=subscriber_email,
        tenants=[tenant],
        auth_details=AuthDetails(username=str(uuid.uuid4())),
    ).save()

    Team(
        tenant=tenant,
        name="Team Alpha",
        team_members=[member],
        subscribers=[subscriber],
    ).save()

    today = datetime.date(2024, 7, 1)

    expected_subject = "Absences Starting Today - July 01"
    expected_body = (
        "Hi there!\n\n"
        "Team Alpha:\n"
        "- John Doe is absent on 2024-07-01.\n\n"
        "For details, visit https://example.com.\n\n"
        "Best regards,\nVacation Calendar"
    )
    real_date = datetime.date
    with patch("backend.scheduled.absence_starts.send_email") as mock_send_email, \
         patch("backend.scheduled.absence_starts.datetime.date") as mock_date, \
         patch("backend.scheduled.absence_starts.get_country_holidays", return_value={}), \
         patch("backend.scheduled.absence_starts.cors_origin", "https://example.com"):
        mock_date.today.return_value = today
        mock_date.side_effect = lambda *args, **kwargs: real_date(*args, **kwargs)

        send_absence_email_updates()

        mock_send_email.assert_called_once_with(
            expected_subject, expected_body, subscriber_email
        )

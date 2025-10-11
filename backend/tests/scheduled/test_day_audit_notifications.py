import datetime
import uuid
from unittest.mock import patch

import pytest

from backend.model import (
    DayAudit,
    DayEntry,
    DayType,
    Team,
    TeamMember,
    Tenant,
    User,
    AuthDetails,
    TeamNotificationSubscription,
    NotificationTopic,
)
from backend.scheduled.day_audit_notifications import send_recent_absence_notifications


@pytest.fixture(autouse=True)
def clear_collections():
    DayAudit.drop_collection()
    Team.drop_collection()
    Tenant.drop_collection()
    DayType.drop_collection()
    User.drop_collection()
    yield
    DayAudit.drop_collection()
    Team.drop_collection()
    Tenant.drop_collection()
    DayType.drop_collection()
    User.drop_collection()


def _create_user(name: str, tenant: Tenant) -> User:
    return User(
        tenants=[tenant],
        name=name,
        email=f"{name.lower().replace(' ', '.')}{uuid.uuid4()}@example.com",
        auth_details=AuthDetails(username=str(uuid.uuid4())),
    ).save()


def test_send_recent_absence_notifications_dispatch_and_content():
    now = datetime.datetime(2025, 5, 10, 12, 0, tzinfo=datetime.timezone.utc)
    tenant = Tenant(name=f"Tenant{uuid.uuid4()}", identifier=str(uuid.uuid4())).save()
    DayType.init_day_types(tenant)
    vacation = DayType.objects(tenant=tenant, identifier="vacation").first()
    compensatory = DayType.objects(tenant=tenant, identifier="compensatory_leave").first()

    subscriber = _create_user("Subscriber", tenant)
    manager = _create_user("Manager Example", tenant)

    member_alice = TeamMember(name="Alice Example", country="Sweden", email="alice@example.com")
    member_bob = TeamMember(name="Bob Example", country="Sweden", email="bob@example.com")

    team = Team(
        tenant=tenant,
        name="Team Alpha",
        team_members=[member_alice, member_bob],
        notification_subscriptions=[
            TeamNotificationSubscription(
                user=subscriber,
                topics=[topic.value for topic in NotificationTopic.defaults()],
            )
        ],
    ).save()

    alice_day = str(datetime.date(2025, 5, 12))
    bob_day = str(datetime.date(2025, 5, 13))
    team.team_members[0].days = {alice_day: DayEntry(day_types=[vacation], comment="Enjoy your vacation!")}
    team.team_members[1].days = {bob_day: DayEntry(day_types=[compensatory])}
    team.save()

    window_start = datetime.datetime(2025, 5, 10, 10, 0, tzinfo=datetime.timezone.utc)
    DayAudit(
        tenant=tenant,
        team=team,
        member_uid=str(member_alice.uid),
        date=datetime.date(2025, 5, 12),
        user=manager,
        timestamp=window_start + datetime.timedelta(minutes=15),
        old_day_types=[],
        new_day_types=[vacation],
        old_comment="",
        new_comment="Enjoy your vacation!",
        action="created",
    ).save()

    override = DayType.objects(tenant=tenant, identifier="override").first()
    DayAudit(
        tenant=tenant,
        team=team,
        member_uid=str(member_bob.uid),
        date=datetime.date(2025, 5, 13),
        user=manager,
        timestamp=window_start + datetime.timedelta(minutes=30),
        old_day_types=[override],
        new_day_types=[compensatory],
        old_comment="",
        new_comment="",
        action="updated",
    ).save()

    expected_subject = "New Absences Added - May 10 10:00 - 11:00 UTC"
    expected_body = (
        "Hello!\n\n"
        "The following absences were added between May 10, 2025 10:00 and 11:00 UTC:\n\n"
        "Team Alpha:\n"
        "- Alice Example was marked absent with Vacation on 2025-05-12. Added by Manager Example. Comment: Enjoy your vacation!\n"
        "- Bob Example was marked absent with Compensatory leave on 2025-05-13. Added by Manager Example.\n\n"
        "For details, visit https://example.com.\n\n"
        "Best regards,\n"
        "Vacation Calendar"
    )

    with patch("backend.scheduled.day_audit_notifications.send_email") as mock_send_email, \
         patch("backend.scheduled.day_audit_notifications.cors_origin", "https://example.com"):
        send_recent_absence_notifications(now=now)

    mock_send_email.assert_called_once_with(
        expected_subject,
        expected_body,
        subscriber.email,
    )


def test_send_recent_absence_notifications_ignores_non_matching_audits():
    now = datetime.datetime(2025, 5, 10, 12, 0, tzinfo=datetime.timezone.utc)
    tenant = Tenant(name=f"Tenant{uuid.uuid4()}", identifier=str(uuid.uuid4())).save()
    DayType.init_day_types(tenant)
    vacation = DayType.objects(tenant=tenant, identifier="vacation").first()

    subscriber = _create_user("Subscriber", tenant)
    manager = _create_user("Manager Example", tenant)

    member = TeamMember(name="Charlie Example", country="Sweden", email="charlie@example.com")
    team = Team(
        tenant=tenant,
        name="Team Beta",
        team_members=[member],
        notification_subscriptions=[
            TeamNotificationSubscription(
                user=subscriber,
                topics=[topic.value for topic in NotificationTopic.defaults()],
            )
        ],
    ).save()

    team.team_members[0].days = {}
    team.save()

    window_start = datetime.datetime(2025, 5, 10, 10, 0, tzinfo=datetime.timezone.utc)
    # Timestamp in the immediately preceding hour should be ignored
    DayAudit(
        tenant=tenant,
        team=team,
        member_uid=str(member.uid),
        date=datetime.date(2025, 5, 14),
        user=manager,
        timestamp=window_start + datetime.timedelta(hours=1, minutes=5),
        old_day_types=[],
        new_day_types=[vacation],
        old_comment="",
        new_comment="",
        action="created",
    ).save()

    # No change in absence day types
    DayAudit(
        tenant=tenant,
        team=team,
        member_uid=str(member.uid),
        date=datetime.date(2025, 5, 15),
        user=manager,
        timestamp=window_start + datetime.timedelta(minutes=10),
        old_day_types=[vacation],
        new_day_types=[vacation],
        old_comment="Old",
        new_comment="Updated comment",
        action="updated",
    ).save()

    with patch("backend.scheduled.day_audit_notifications.send_email") as mock_send_email:
        send_recent_absence_notifications(now=now)

    mock_send_email.assert_not_called()


def test_send_recent_absence_notifications_skips_removed_absences():
    now = datetime.datetime(2025, 5, 10, 12, 0, tzinfo=datetime.timezone.utc)
    tenant = Tenant(name=f"Tenant{uuid.uuid4()}", identifier=str(uuid.uuid4())).save()
    DayType.init_day_types(tenant)
    vacation = DayType.objects(tenant=tenant, identifier="vacation").first()

    subscriber = _create_user("Subscriber", tenant)
    manager = _create_user("Manager Example", tenant)

    member = TeamMember(name="Dana Example", country="Sweden", email="dana@example.com")
    team = Team(
        tenant=tenant,
        name="Team Gamma",
        team_members=[member],
        notification_subscriptions=[
            TeamNotificationSubscription(
                user=subscriber,
                topics=[topic.value for topic in NotificationTopic.defaults()],
            )
        ],
    ).save()

    # Final state without absences for the day
    team.team_members[0].days = {}
    team.save()

    window_start = datetime.datetime(2025, 5, 10, 10, 0, tzinfo=datetime.timezone.utc)

    DayAudit(
        tenant=tenant,
        team=team,
        member_uid=str(member.uid),
        date=datetime.date(2025, 5, 16),
        user=manager,
        timestamp=window_start + datetime.timedelta(minutes=10),
        old_day_types=[],
        new_day_types=[vacation],
        old_comment="",
        new_comment="",
        action="created",
    ).save()

    DayAudit(
        tenant=tenant,
        team=team,
        member_uid=str(member.uid),
        date=datetime.date(2025, 5, 16),
        user=manager,
        timestamp=window_start + datetime.timedelta(minutes=40),
        old_day_types=[vacation],
        new_day_types=[],
        old_comment="",
        new_comment="",
        action="deleted",
    ).save()

    with patch("backend.scheduled.day_audit_notifications.send_email") as mock_send_email:
        send_recent_absence_notifications(now=now)

    mock_send_email.assert_not_called()


def test_send_recent_absence_notifications_respects_topics():
    now = datetime.datetime(2025, 5, 10, 12, 0, tzinfo=datetime.timezone.utc)
    tenant = Tenant(name=f"Tenant{uuid.uuid4()}", identifier=str(uuid.uuid4())).save()
    DayType.init_day_types(tenant)
    vacation = DayType.objects(tenant=tenant, identifier="vacation").first()

    subscribed = _create_user("Subscribed", tenant)
    unsubscribed = _create_user("Unsubscribed", tenant)
    manager = _create_user("Manager Example", tenant)

    member = TeamMember(name="Eve Example", country="Sweden", email="eve@example.com")
    team = Team(
        tenant=tenant,
        name="Team Delta",
        team_members=[member],
        notification_subscriptions=[
            TeamNotificationSubscription(
                user=subscribed,
                topics=[NotificationTopic.RECENT_ABSENCES.value],
            ),
            TeamNotificationSubscription(
                user=unsubscribed,
                topics=[NotificationTopic.BIRTHDAYS.value],
            ),
        ],
    ).save()

    member.days = {str(datetime.date(2025, 5, 12)): DayEntry(day_types=[vacation])}
    team.save()

    window_start = datetime.datetime(2025, 5, 10, 10, 0, tzinfo=datetime.timezone.utc)
    DayAudit(
        tenant=tenant,
        team=team,
        member_uid=str(member.uid),
        date=datetime.date(2025, 5, 12),
        user=manager,
        timestamp=window_start + datetime.timedelta(minutes=15),
        old_day_types=[],
        new_day_types=[vacation],
        old_comment="",
        new_comment="",
        action="created",
    ).save()

    with patch("backend.scheduled.day_audit_notifications.send_email") as mock_send_email, \
         patch("backend.scheduled.day_audit_notifications.cors_origin", "https://example.com"):
        send_recent_absence_notifications(now=now)

    mock_send_email.assert_called_once()
    args, kwargs = mock_send_email.call_args
    assert args[2] == subscribed.email

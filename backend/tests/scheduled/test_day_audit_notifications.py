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
)
from backend.notification_types import ABSENCE_RECENT_CHANGES_NOTIFICATION
from backend.scheduled.day_audit_notifications import send_recent_calendar_change_notifications


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


def test_send_recent_calendar_change_notifications_dispatch_and_content():
    now = datetime.datetime(2025, 5, 10, 12, 0, tzinfo=datetime.timezone.utc)
    tenant = Tenant(name=f"Tenant{uuid.uuid4()}", identifier=str(uuid.uuid4())).save()
    DayType.init_day_types(tenant)
    vacation = DayType.objects(tenant=tenant, identifier="vacation").first()
    compensatory = DayType.objects(tenant=tenant, identifier="compensatory_leave").first()

    subscriber = _create_user("Subscriber", tenant)
    manager = _create_user("Manager Example", tenant)

    member_alice = TeamMember(name="Alice Example", country="Sweden", email="alice@example.com")
    member_bob = TeamMember(name="Bob Example", country="Sweden", email="bob@example.com")
    member_carol = TeamMember(name="Carol Example", country="Sweden", email="carol@example.com")

    team = Team(
        tenant=tenant,
        name="Team Alpha",
        team_members=[member_alice, member_bob, member_carol],
        notification_preferences={
            str(subscriber.id): [ABSENCE_RECENT_CHANGES_NOTIFICATION],
        },
    ).save()

    alice_day = str(datetime.date(2025, 5, 12))
    bob_day = str(datetime.date(2025, 5, 13))
    carol_day = str(datetime.date(2025, 5, 14))
    team.team_members[0].days = {alice_day: DayEntry(day_types=[vacation], comment="Enjoy your vacation!")}
    team.team_members[1].days = {bob_day: DayEntry(day_types=[compensatory])}
    birthday = DayType.objects(tenant=tenant, identifier="birthday").first()
    team.team_members[2].days = {carol_day: DayEntry(day_types=[birthday])}
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

    DayAudit(
        tenant=tenant,
        team=team,
        member_uid=str(member_carol.uid),
        date=datetime.date(2025, 5, 14),
        user=manager,
        timestamp=window_start + datetime.timedelta(minutes=45),
        old_day_types=[],
        new_day_types=[birthday],
        old_comment="",
        new_comment="",
        action="created",
    ).save()

    expected_subject = "New Calendar Changes - May 10 10:00 - 11:00 UTC"
    expected_body = (
        "Hello!\n\n"
        "The following calendar changes were recorded between May 10, 2025 10:00 and 11:00 UTC:\n\n"
        "Team Alpha:\n"
        "- Alice Example was assigned Vacation on 2025-05-12. Added by Manager Example. Comment: Enjoy your vacation!\n"
        "- Bob Example was assigned Compensatory leave on 2025-05-13. Added by Manager Example.\n"
        "- Carol Example was assigned Birthday on 2025-05-14. Added by Manager Example.\n\n"
        "For details, visit https://example.com.\n\n"
        "Best regards,\n"
        "Vacation Calendar"
    )

    with patch("backend.scheduled.day_audit_notifications.send_email") as mock_send_email, \
         patch("backend.scheduled.day_audit_notifications.cors_origin", "https://example.com"):
        send_recent_calendar_change_notifications(now=now)

    assert mock_send_email.call_count == 4
    calls_by_recipient = {
        args[2]: (args[0], args[1]) for args, _ in mock_send_email.call_args_list
    }

    assert calls_by_recipient[subscriber.email] == (expected_subject, expected_body)

    expected_member_subject = "Your Calendar Updates - May 10 10:00 - 11:00 UTC"
    expected_bodies = {
        "alice@example.com": (
            "Hello!\n\n"
            "The following updates were made to your calendar between May 10, 2025 10:00 and 11:00 UTC:\n\n"
            "In Team Alpha:\n"
            "- Alice Example was assigned Vacation on 2025-05-12. Added by Manager Example. Comment: Enjoy your vacation!\n\n"
            "For details, visit https://example.com.\n\n"
            "Best regards,\n"
            "Vacation Calendar"
        ),
        "bob@example.com": (
            "Hello!\n\n"
            "The following updates were made to your calendar between May 10, 2025 10:00 and 11:00 UTC:\n\n"
            "In Team Alpha:\n"
            "- Bob Example was assigned Compensatory leave on 2025-05-13. Added by Manager Example.\n\n"
            "For details, visit https://example.com.\n\n"
            "Best regards,\n"
            "Vacation Calendar"
        ),
        "carol@example.com": (
            "Hello!\n\n"
            "The following updates were made to your calendar between May 10, 2025 10:00 and 11:00 UTC:\n\n"
            "In Team Alpha:\n"
            "- Carol Example was assigned Birthday on 2025-05-14. Added by Manager Example.\n\n"
            "For details, visit https://example.com.\n\n"
            "Best regards,\n"
            "Vacation Calendar"
        ),
    }
    for email, expected_member_body in expected_bodies.items():
        subject, body = calls_by_recipient[email]
        assert subject == expected_member_subject
        assert body == expected_member_body


def test_send_recent_calendar_change_notifications_skips_acting_subscriber():
    now = datetime.datetime(2025, 5, 10, 12, 0, tzinfo=datetime.timezone.utc)
    tenant = Tenant(name=f"Tenant{uuid.uuid4()}", identifier=str(uuid.uuid4())).save()
    DayType.init_day_types(tenant)
    vacation = DayType.objects(tenant=tenant, identifier="vacation").first()

    actor = _create_user("Actor Example", tenant)

    member = TeamMember(name="Eve Example", country="Sweden", email="eve@example.com")
    team = Team(
        tenant=tenant,
        name="Team Delta",
        team_members=[member],
        notification_preferences={
            str(actor.id): [ABSENCE_RECENT_CHANGES_NOTIFICATION],
        },
    ).save()

    day_key = str(datetime.date(2025, 5, 12))
    team.team_members[0].days = {day_key: DayEntry(day_types=[vacation])}
    team.save()

    DayAudit(
        tenant=tenant,
        team=team,
        member_uid=str(member.uid),
        date=datetime.date(2025, 5, 12),
        user=actor,
        timestamp=datetime.datetime(2025, 5, 10, 10, 15, tzinfo=datetime.timezone.utc),
        old_day_types=[],
        new_day_types=[vacation],
        old_comment="",
        new_comment="Enjoy!",
        action="created",
    ).save()

    with patch("backend.scheduled.day_audit_notifications.send_email") as mock_send_email:
        send_recent_calendar_change_notifications(now=now)

    assert mock_send_email.call_count == 1
    args, _ = mock_send_email.call_args
    assert args[0] == "Your Calendar Updates - May 10 10:00 - 11:00 UTC"
    assert args[2] == "eve@example.com"


def test_send_recent_calendar_change_notifications_ignores_non_matching_audits():
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
        notification_preferences={
            str(subscriber.id): [ABSENCE_RECENT_CHANGES_NOTIFICATION],
        },
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
        send_recent_calendar_change_notifications(now=now)

    mock_send_email.assert_not_called()


def test_send_recent_calendar_change_notifications_skips_removed_absences():
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
        notification_preferences={
            str(subscriber.id): [ABSENCE_RECENT_CHANGES_NOTIFICATION],
        },
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
        send_recent_calendar_change_notifications(now=now)

    mock_send_email.assert_not_called()


def test_send_recent_calendar_change_notifications_skips_member_when_emails_match():
    now = datetime.datetime(2025, 5, 10, 12, 0, tzinfo=datetime.timezone.utc)
    tenant = Tenant(name=f"Tenant{uuid.uuid4()}", identifier=str(uuid.uuid4())).save()
    DayType.init_day_types(tenant)
    vacation = DayType.objects(tenant=tenant, identifier="vacation").first()

    shared_email = "shared@example.com"
    actor = User(
        tenants=[tenant],
        name="Member Example",
        email=shared_email,
        auth_details=AuthDetails(username=str(uuid.uuid4())),
    ).save()

    member = TeamMember(name="Member Example", country="Sweden", email=shared_email)
    team = Team(
        tenant=tenant,
        name="Team Shared",
        team_members=[member],
    ).save()

    day_key = str(datetime.date(2025, 5, 12))
    team.team_members[0].days = {day_key: DayEntry(day_types=[vacation])}
    team.save()

    DayAudit(
        tenant=tenant,
        team=team,
        member_uid=str(member.uid),
        date=datetime.date(2025, 5, 12),
        user=actor,
        timestamp=datetime.datetime(2025, 5, 10, 10, 15, tzinfo=datetime.timezone.utc),
        old_day_types=[],
        new_day_types=[vacation],
        old_comment="",
        new_comment="Enjoy!",
        action="created",
    ).save()

    with patch("backend.scheduled.day_audit_notifications.send_email") as mock_send_email:
        send_recent_calendar_change_notifications(now=now)

    mock_send_email.assert_not_called()


def test_send_recent_calendar_change_notifications_aggregates_member_entries():
    now = datetime.datetime(2025, 5, 10, 12, 0, tzinfo=datetime.timezone.utc)
    tenant = Tenant(name=f"Tenant{uuid.uuid4()}", identifier=str(uuid.uuid4())).save()
    DayType.init_day_types(tenant)
    vacation = DayType.objects(tenant=tenant, identifier="vacation").first()
    compensatory = DayType.objects(tenant=tenant, identifier="compensatory_leave").first()

    actor = _create_user("Manager Example", tenant)

    member = TeamMember(name="Member One", country="Sweden", email="member.one@example.com")
    team = Team(
        tenant=tenant,
        name="Team Aggregated",
        team_members=[member],
    ).save()

    first_day = str(datetime.date(2025, 5, 12))
    second_day = str(datetime.date(2025, 5, 13))
    team.team_members[0].days = {
        first_day: DayEntry(day_types=[vacation]),
        second_day: DayEntry(day_types=[compensatory]),
    }
    team.save()

    DayAudit(
        tenant=tenant,
        team=team,
        member_uid=str(member.uid),
        date=datetime.date(2025, 5, 12),
        user=actor,
        timestamp=datetime.datetime(2025, 5, 10, 10, 10, tzinfo=datetime.timezone.utc),
        old_day_types=[],
        new_day_types=[vacation],
        old_comment="",
        new_comment="Enjoy!",
        action="created",
    ).save()

    DayAudit(
        tenant=tenant,
        team=team,
        member_uid=str(member.uid),
        date=datetime.date(2025, 5, 13),
        user=actor,
        timestamp=datetime.datetime(2025, 5, 10, 10, 20, tzinfo=datetime.timezone.utc),
        old_day_types=[],
        new_day_types=[compensatory],
        old_comment="",
        new_comment="",
        action="created",
    ).save()

    with patch("backend.scheduled.day_audit_notifications.send_email") as mock_send_email:
        send_recent_calendar_change_notifications(now=now)

    mock_send_email.assert_called_once()
    args, _ = mock_send_email.call_args
    assert args[0] == "Your Calendar Updates - May 10 10:00 - 11:00 UTC"
    assert args[2] == "member.one@example.com"
    assert args[1] == (
        "Hello!\n\n"
        "The following updates were made to your calendar between May 10, 2025 10:00 and 11:00 UTC:\n\n"
        "In Team Aggregated:\n"
        "- Member One was assigned Vacation on 2025-05-12. Added by Manager Example. Comment: Enjoy!\n"
        "- Member One was assigned Compensatory leave on 2025-05-13. Added by Manager Example.\n\n"
        "For details, visit the vacation calendar.\n\n"
        "Best regards,\n"
        "Vacation Calendar"
    )

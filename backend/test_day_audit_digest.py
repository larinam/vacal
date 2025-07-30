import os
import datetime
import uuid
from unittest.mock import patch

os.environ.setdefault("MONGO_MOCK", "1")
os.environ.setdefault("AUTHENTICATION_SECRET_KEY", "test_secret")

from backend.model import Tenant, DayType, Team, TeamMember, User, AuthDetails, DayAudit
from backend.scheduled.day_audit_changes import send_day_audit_email_updates


def setup_team():
    Tenant.drop_collection()
    DayType.drop_collection()
    Team.drop_collection()
    User.drop_collection()
    DayAudit.drop_collection()

    tenant = Tenant(name=f"Tenant{uuid.uuid4()}", identifier=str(uuid.uuid4())).save()
    DayType.init_day_types(tenant)
    member = TeamMember(name="Alice", country="Sweden", email="alice@example.com")
    subscriber = User(
        tenants=[tenant],
        name="Subscriber",
        email=f"sub{uuid.uuid4()}@example.com",
        auth_details=AuthDetails(username=str(uuid.uuid4()))
    ).save()
    team = Team(tenant=tenant, name="Team", team_members=[member], subscribers=[subscriber]).save()
    return team, member, subscriber


def create_audits(team, member, user, now):
    vac = DayType.objects(tenant=team.tenant, identifier="vacation").first()
    override = DayType.objects(tenant=team.tenant, identifier="override").first()

    DayAudit(
        tenant=team.tenant,
        team=team,
        member_uid=str(member.uid),
        date=datetime.date(2025, 1, 1),
        user=user,
        timestamp=now - datetime.timedelta(hours=23),
        old_day_types=[],
        old_comment="",
        new_day_types=[vac],
        new_comment="start",
        action="created",
    ).save()
    DayAudit(
        tenant=team.tenant,
        team=team,
        member_uid=str(member.uid),
        date=datetime.date(2025, 1, 1),
        user=user,
        timestamp=now - datetime.timedelta(hours=1),
        old_day_types=[vac],
        old_comment="start",
        new_day_types=[vac, override],
        new_comment="final",
        action="updated",
    ).save()


def test_day_audit_digest_sent_when_changed():
    now = datetime.datetime(2025, 1, 2, 12, tzinfo=datetime.timezone.utc)
    team, member, subscriber = setup_team()
    create_audits(team, member, subscriber, now)

    with patch("backend.scheduled.day_audit_changes.send_email") as mock_send_email, \
         patch("backend.scheduled.day_audit_changes.datetime") as mock_datetime:
        mock_datetime.datetime.now.return_value = now
        mock_datetime.datetime.side_effect = datetime.datetime
        mock_datetime.timedelta = datetime.timedelta
        mock_datetime.timezone = datetime.timezone
        send_day_audit_email_updates()
        mock_send_email.assert_called_once()
        args = mock_send_email.call_args.args
        assert subscriber.email == args[2]
        body = args[1]
        assert "Alice" in body
        assert "vacation" in body.lower()
        assert "override" in body.lower()


def test_day_audit_digest_skipped_when_reverted():
    now = datetime.datetime(2025, 1, 2, 12, tzinfo=datetime.timezone.utc)
    team, member, subscriber = setup_team()
    vac = DayType.objects(tenant=team.tenant, identifier="vacation").first()
    DayAudit(
        tenant=team.tenant,
        team=team,
        member_uid=str(member.uid),
        date=datetime.date(2025, 1, 1),
        user=subscriber,
        timestamp=now - datetime.timedelta(hours=23),
        old_day_types=[],
        old_comment="",
        new_day_types=[vac],
        new_comment="",
        action="created",
    ).save()
    DayAudit(
        tenant=team.tenant,
        team=team,
        member_uid=str(member.uid),
        date=datetime.date(2025, 1, 1),
        user=subscriber,
        timestamp=now - datetime.timedelta(hours=1),
        old_day_types=[vac],
        old_comment="",
        new_day_types=[],
        new_comment="",
        action="deleted",
    ).save()

    with patch("backend.scheduled.day_audit_changes.send_email") as mock_send_email, \
         patch("backend.scheduled.day_audit_changes.datetime") as mock_datetime:
        mock_datetime.datetime.now.return_value = now
        mock_datetime.datetime.side_effect = datetime.datetime
        mock_datetime.timedelta = datetime.timedelta
        mock_datetime.timezone = datetime.timezone
        send_day_audit_email_updates()
        mock_send_email.assert_not_called()

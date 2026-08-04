import datetime
import os
import uuid

os.environ.setdefault("MONGO_MOCK", "1")

from unittest.mock import patch

from backend.model import Team, TeamMember, Tenant

TODAY = datetime.date(2026, 8, 4)


def make_team(*members):
    unique_suffix = str(uuid.uuid4())
    tenant = Tenant(name=f"Tenant-{unique_suffix}", identifier=f"tenant-{unique_suffix}").save()
    return Team(tenant=tenant, name=f"Team-{unique_suffix}", team_members=list(members)).save()


def member(**kwargs):
    return TeamMember(name=kwargs.pop("name", "Alice"), country="Sweden", **kwargs)


def test_member_without_last_working_day_is_active():
    subject = member()
    assert subject.is_archived(TODAY) is False
    assert subject.is_leaving(TODAY) is False
    assert subject.is_separation_due(TODAY) is False


def test_future_last_working_day_is_leaving_not_archived():
    subject = member(last_working_day=datetime.date(2027, 3, 31))
    assert subject.is_archived(TODAY) is False
    assert subject.is_leaving(TODAY) is True
    assert subject.is_separation_due(TODAY) is False


def test_the_last_working_day_itself_is_still_active():
    """A member is a full member through the end of their last working day."""
    subject = member(last_working_day=TODAY)
    assert subject.is_archived(TODAY) is False
    assert subject.is_leaving(TODAY) is True


def test_passed_last_working_day_is_archived_and_due():
    subject = member(last_working_day=TODAY - datetime.timedelta(days=1))
    assert subject.is_archived(TODAY) is True
    assert subject.is_leaving(TODAY) is False
    # Not yet reconciled: the flag is still False, so the nightly job has work to do.
    assert subject.is_separation_due(TODAY) is True


def test_reconciled_member_is_archived_but_no_longer_due():
    subject = member(last_working_day=TODAY - datetime.timedelta(days=1), is_deleted=True)
    assert subject.is_archived(TODAY) is True
    assert subject.is_separation_due(TODAY) is False


def test_is_deleted_beats_a_future_last_working_day():
    """The old endpoint accepted a future date and archived anyway. Nobody deliberately
    removed gets resurrected by deriving state."""
    subject = member(last_working_day=datetime.date(2027, 3, 31), is_deleted=True)
    assert subject.is_archived(TODAY) is True
    assert subject.is_leaving(TODAY) is False


def test_datetime_assigned_in_memory_does_not_raise():
    """DateField.to_python yields a date, but a value assigned before save/reload is
    whatever the caller passed, and date < datetime would raise."""
    subject = member(last_working_day=datetime.datetime(2027, 3, 31, 9, 30))
    assert subject.is_archived(TODAY) is False
    assert subject.is_leaving(TODAY) is True


def test_active_and_archived_members_are_a_partition():
    """The absence report concatenates both lists, so a member must land in exactly one
    of them in every state."""
    plain = member(name="Plain")
    leaving = member(name="Leaving", last_working_day=TODAY + datetime.timedelta(days=30))
    on_last_day = member(name="On last day", last_working_day=TODAY)
    due = member(name="Due", last_working_day=TODAY - datetime.timedelta(days=1))
    reconciled = member(name="Reconciled", last_working_day=datetime.date(2025, 1, 1),
                        is_deleted=True)
    team = make_team(plain, leaving, on_last_day, due, reconciled)

    with patch("backend.model.get_today", return_value=TODAY):
        active_names = {m.name for m in team.active_members}
        archived_names = {m.name for m in team.archived_members}

    assert active_names == {"Plain", "Leaving", "On last day"}
    assert archived_names == {"Due", "Reconciled"}
    assert active_names & archived_names == set()
    assert len(active_names) + len(archived_names) == len(team.team_members)


def test_get_member_follows_the_derived_state():
    leaving = member(name="Leaving", last_working_day=TODAY + datetime.timedelta(days=30))
    due = member(name="Due", last_working_day=TODAY - datetime.timedelta(days=1))
    team = make_team(leaving, due)

    with patch("backend.model.get_today", return_value=TODAY):
        # A scheduled departure keeps the member reachable without include_archived.
        assert team.get_member(leaving.uid) is not None
        # A departure that has taken effect does not, even before the job runs.
        assert team.get_member(due.uid) is None
        assert team.get_member(due.uid, include_archived=True) is not None

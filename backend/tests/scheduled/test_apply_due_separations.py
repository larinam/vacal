import datetime
import os
import uuid
from unittest.mock import patch

os.environ.setdefault("MONGO_MOCK", "1")

import pytest
from backend.model import AuthDetails, Team, TeamMember, Tenant, User
from backend.scheduled.apply_due_separations import apply_due_separations

TODAY = datetime.date(2026, 8, 4)


@pytest.fixture(autouse=True)
def mock_get_today():
    """Mock get_today() to return the fixed TODAY date for all tests in this module."""
    with patch("backend.model.get_today", return_value=TODAY):
        with patch("backend.routers.teams.get_today", return_value=TODAY):
            yield


def make_tenant():
    unique_suffix = str(uuid.uuid4())
    return Tenant(name=f"Tenant-{unique_suffix}", identifier=f"tenant-{unique_suffix}").save()


def make_user(tenant):
    unique_suffix = str(uuid.uuid4())
    return User(name="Manager", role="manager", tenants=[tenant],
                auth_details=AuthDetails(username=f"manager-{unique_suffix}")).save()


def test_due_member_is_archived_and_stamped():
    tenant = make_tenant()
    actor = make_user(tenant)
    member = TeamMember(name="Alice", country="Sweden",
                        last_working_day=TODAY - datetime.timedelta(days=1),
                        separation_recorded_at=datetime.datetime(2026, 5, 1),
                        separation_recorded_by=actor)
    team = Team(tenant=tenant, name=f"Team-{uuid.uuid4()}", team_members=[member]).save()

    assert apply_due_separations(today=TODAY) >= 1

    team.reload()
    stored = team.get_member(member.uid, include_archived=True)
    assert stored.is_deleted is True
    assert stored.deleted_at is not None
    # The actor is carried over, so "Archived by" still names the responsible manager.
    assert stored.deleted_by.id == actor.id


def test_scheduled_future_departure_is_left_alone():
    tenant = make_tenant()
    member = TeamMember(name="Alice", country="Sweden",
                        last_working_day=TODAY + datetime.timedelta(days=30))
    team = Team(tenant=tenant, name=f"Team-{uuid.uuid4()}", team_members=[member]).save()

    apply_due_separations(today=TODAY)

    team.reload()
    stored = team.get_member(member.uid)
    assert stored is not None
    assert stored.is_deleted is False


def test_member_on_their_last_working_day_is_left_alone():
    tenant = make_tenant()
    member = TeamMember(name="Alice", country="Sweden", last_working_day=TODAY)
    team = Team(tenant=tenant, name=f"Team-{uuid.uuid4()}", team_members=[member]).save()

    apply_due_separations(today=TODAY)

    team.reload()
    assert team.get_member(member.uid).is_deleted is False


def test_is_idempotent():
    tenant = make_tenant()
    member = TeamMember(name="Alice", country="Sweden",
                        last_working_day=TODAY - datetime.timedelta(days=1))
    team = Team(tenant=tenant, name=f"Team-{uuid.uuid4()}", team_members=[member]).save()

    apply_due_separations(today=TODAY)
    team.reload()
    first_deleted_at = team.get_member(member.uid, include_archived=True).deleted_at

    apply_due_separations(today=TODAY)
    team.reload()
    stored = team.get_member(member.uid, include_archived=True)
    assert stored.is_deleted is True
    # Already reconciled, so the second run must not restamp it.
    assert stored.deleted_at == first_deleted_at


def test_clears_leader_references_when_the_departure_takes_effect():
    tenant = make_tenant()
    leader = TeamMember(name="Leader", country="Sweden",
                        last_working_day=TODAY - datetime.timedelta(days=1))
    team = Team(tenant=tenant, name=f"Team-{uuid.uuid4()}", team_members=[leader],
                leader_uid=str(leader.uid)).save()
    led_elsewhere = Team(tenant=tenant, name=f"Sub-{uuid.uuid4()}",
                         leader_uid=str(leader.uid)).save()

    apply_due_separations(today=TODAY)

    team.reload()
    led_elsewhere.reload()
    assert team.leader_uid is None
    assert led_elsewhere.leader_uid is None


def test_processes_members_of_soft_deleted_teams():
    """Otherwise their stored state would never converge."""
    tenant = make_tenant()
    member = TeamMember(name="Alice", country="Sweden",
                        last_working_day=TODAY - datetime.timedelta(days=1))
    team = Team(tenant=tenant, name=f"Team-{uuid.uuid4()}", team_members=[member],
                is_deleted=True).save()

    apply_due_separations(today=TODAY)

    team = Team.objects_with_deleted(id=team.id).first()
    assert team.get_member(member.uid, include_archived=True).is_deleted is True


def test_survives_a_dangling_separation_actor():
    """separation_recorded_by has no reverse_delete_rule, so a deleted user leaves a
    reference that raises on access. That must not abort the sweep."""
    tenant = make_tenant()
    actor = make_user(tenant)
    member = TeamMember(name="Alice", country="Sweden",
                        last_working_day=TODAY - datetime.timedelta(days=1),
                        separation_recorded_by=actor)
    team = Team(tenant=tenant, name=f"Team-{uuid.uuid4()}", team_members=[member]).save()
    actor.delete()

    apply_due_separations(today=TODAY)

    team.reload()
    assert team.get_member(member.uid, include_archived=True).is_deleted is True


def test_returns_zero_when_there_is_nothing_to_do():
    tenant = make_tenant()
    member = TeamMember(name="Alice", country="Sweden")
    Team(tenant=tenant, name=f"Team-{uuid.uuid4()}", team_members=[member]).save()

    # Other tests may leave due members behind, so assert on this tenant's member only.
    apply_due_separations(today=TODAY)
    team = Team.objects(tenant=tenant).first()
    assert team.get_member(member.uid).is_deleted is False

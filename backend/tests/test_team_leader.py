import datetime
import os
import uuid

os.environ.setdefault("MONGO_MOCK", "1")
os.environ.setdefault("AUTHENTICATION_SECRET_KEY", "test_secret")

from backend.model import Team, TeamMember, Tenant, find_active_member_by_uid


def _tenant():
    suffix = str(uuid.uuid4())
    return Tenant(name=f"Tenant-{suffix}", identifier=f"tenant-{suffix}").save()


def test_finds_active_member_anywhere_in_the_tenant():
    tenant = _tenant()
    ada = TeamMember(name="Ada", country="Sweden")
    team = Team(tenant=tenant, name=f"Engineering-{uuid.uuid4()}", team_members=[ada]).save()

    found = find_active_member_by_uid(tenant, str(ada.uid))

    assert found is not None
    found_team, found_member = found
    assert found_team.id == team.id
    assert found_member.name == "Ada"


def test_archived_member_is_not_found():
    tenant = _tenant()
    ada = TeamMember(name="Ada", country="Sweden", is_deleted=True)
    Team(tenant=tenant, name=f"Engineering-{uuid.uuid4()}", team_members=[ada]).save()

    assert find_active_member_by_uid(tenant, str(ada.uid)) is None


def test_leaving_member_is_still_found():
    """Leading a team until your last day is normal, so a scheduled departure must not
    make somebody unappointable."""
    tenant = _tenant()
    ada = TeamMember(name="Ada", country="Sweden",
                     last_working_day=datetime.date.today() + datetime.timedelta(days=60))
    Team(tenant=tenant, name=f"Engineering-{uuid.uuid4()}", team_members=[ada]).save()

    assert find_active_member_by_uid(tenant, str(ada.uid)) is not None


def test_member_past_last_working_day_is_not_found():
    """Even before the nightly job has flipped the flag."""
    tenant = _tenant()
    ada = TeamMember(name="Ada", country="Sweden",
                     last_working_day=datetime.date.today() - datetime.timedelta(days=1))
    Team(tenant=tenant, name=f"Engineering-{uuid.uuid4()}", team_members=[ada]).save()

    assert find_active_member_by_uid(tenant, str(ada.uid)) is None


def test_member_of_archived_team_is_not_found():
    tenant = _tenant()
    ada = TeamMember(name="Ada", country="Sweden")
    Team(tenant=tenant, name=f"Engineering-{uuid.uuid4()}", team_members=[ada],
         is_deleted=True).save()

    assert find_active_member_by_uid(tenant, str(ada.uid)) is None


def test_member_of_another_tenant_is_not_found():
    tenant = _tenant()
    other_tenant = _tenant()
    outsider = TeamMember(name="Outsider", country="Denmark")
    Team(tenant=other_tenant, name=f"Outside-{uuid.uuid4()}", team_members=[outsider]).save()

    assert find_active_member_by_uid(tenant, str(outsider.uid)) is None


def test_unknown_uid_is_not_found():
    tenant = _tenant()
    Team(tenant=tenant, name=f"Empty-{uuid.uuid4()}").save()

    assert find_active_member_by_uid(tenant, str(uuid.uuid4())) is None

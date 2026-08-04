"""The notification jobs must follow the derived lifecycle state.

They all iterate ``team.members()``, so a member with a scheduled future departure should
still be notified about and a departed one should not - including during the window after
their last working day but before the nightly reconciliation job has flipped the flag.
Nothing in these jobs reads ``last_working_day`` directly, so these tests are what stops a
departed employee quietly staying in the digests.
"""

import datetime
import os
import uuid

os.environ.setdefault("MONGO_MOCK", "1")

import pytest

from backend.model import DayEntry, DayType, Team, TeamMember, Tenant, User
from backend.scheduled.absence_starts import find_absence_periods
from backend.scheduled.birthdays import find_birthdays

TODAY = datetime.date.today()
YESTERDAY = TODAY - datetime.timedelta(days=1)
NEXT_MONTH = TODAY + datetime.timedelta(days=30)


@pytest.fixture(autouse=True)
def clear_collections():
    Team.drop_collection()
    Tenant.drop_collection()
    DayType.drop_collection()
    User.drop_collection()
    yield
    Team.drop_collection()
    Tenant.drop_collection()
    DayType.drop_collection()
    User.drop_collection()


def make_tenant():
    tenant = Tenant(name=f"Tenant{uuid.uuid4()}", identifier=str(uuid.uuid4())).save()
    DayType.init_day_types(tenant)
    return tenant


def test_birthday_digest_includes_a_leaving_member_and_skips_a_departed_one():
    tenant = make_tenant()
    birthday_today = TODAY.strftime("%m-%d")

    leaving = TeamMember(name="Leaving", country="Sweden", birthday=birthday_today,
                         last_working_day=NEXT_MONTH)
    departed = TeamMember(name="Departed", country="Sweden", birthday=birthday_today,
                          last_working_day=YESTERDAY)  # is_deleted still False: unreconciled
    on_last_day = TeamMember(name="OnLastDay", country="Sweden", birthday=birthday_today,
                             last_working_day=TODAY)
    team = Team(tenant=tenant, name="Team", team_members=[leaving, departed, on_last_day]).save()

    names = {entry["name"] for entry in find_birthdays(team)}

    assert "Leaving" in names, "somebody still employed must stay in the digest"
    assert "OnLastDay" in names, "employed through the end of the last working day"
    assert "Departed" not in names, "a departed member must drop out before the job runs"


def test_absence_digest_includes_a_leaving_member_and_skips_a_departed_one():
    tenant = make_tenant()
    vacation = DayType.objects(tenant=tenant, identifier="vacation").first()
    absence_start = TODAY + datetime.timedelta(days=3)
    days = {str(absence_start): DayEntry(day_types=[vacation])}

    leaving = TeamMember(name="Leaving", country="Sweden", email="leaving@example.com",
                         days=dict(days), last_working_day=NEXT_MONTH)
    departed = TeamMember(name="Departed", country="Sweden", email="departed@example.com",
                          days=dict(days), last_working_day=YESTERDAY)
    team = Team(tenant=tenant, name="Team", team_members=[leaving, departed]).save()

    names = {entry["name"] for entry in find_absence_periods(team, absence_start)}

    assert names == {"Leaving"}


def test_reconciled_member_stays_out_of_both_digests():
    """The same result once the nightly job has persisted the flag - the two paths must
    not disagree."""
    tenant = make_tenant()
    vacation = DayType.objects(tenant=tenant, identifier="vacation").first()
    absence_start = TODAY + datetime.timedelta(days=3)

    archived = TeamMember(
        name="Archived", country="Sweden", email="archived@example.com",
        birthday=TODAY.strftime("%m-%d"),
        days={str(absence_start): DayEntry(day_types=[vacation])},
        last_working_day=YESTERDAY, is_deleted=True,
    )
    team = Team(tenant=tenant, name="Team", team_members=[archived]).save()

    assert find_birthdays(team) == []
    assert find_absence_periods(team, absence_start) == []


def test_billing_count_drops_a_departed_member_without_the_nightly_job():
    """calculate_team_members_number_in_tenant goes through team.members(), so a departed
    employee stops being billable at midnight rather than whenever the job next runs."""
    from backend.model import calculate_team_members_number_in_tenant

    tenant = make_tenant()
    Team(tenant=tenant, name="Team", team_members=[
        TeamMember(name="Active", country="Sweden"),
        TeamMember(name="Leaving", country="Sweden", last_working_day=NEXT_MONTH),
        TeamMember(name="Departed", country="Sweden", last_working_day=YESTERDAY),
    ]).save()

    # Active + Leaving, but not Departed.
    assert calculate_team_members_number_in_tenant(tenant) == 2

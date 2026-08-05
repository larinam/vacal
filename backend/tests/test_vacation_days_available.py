import datetime
from unittest.mock import patch
import uuid
from backend.routers.teams import TeamMemberReadDTO

from backend.model import Tenant, DayType, TeamMember, DayEntry
from backend.dependencies import mongo_to_pydantic, tenant_var


def setup_member(days=None, last_working_day=None, start=datetime.date(2024, 7, 1)):
    tenant = Tenant(name=f"Test{uuid.uuid4()}", identifier=str(uuid.uuid4())).save()
    DayType.init_day_types(tenant)
    vac = DayType.objects(tenant=tenant, identifier="vacation").first()
    member_days = days or {}
    member = TeamMember(
        name="Alice",
        country="Sweden",
        employee_start_date=start,
        yearly_vacation_days=20,
        last_working_day=last_working_day,
        days=member_days,
    )
    return member, vac, tenant


def mark_vacation(member, vac, dates):
    for date_str in dates:
        member.days[date_str] = DayEntry(day_types=[vac])


def test_available_days_without_usage():
    member, _, tenant = setup_member()
    token = tenant_var.set(tenant)
    member_dto = mongo_to_pydantic(member, TeamMemberReadDTO)
    with patch("backend.routers.teams.get_today", return_value=datetime.date(2025, 1, 1)):
        assert member_dto.vacation_available_days == 30
    tenant_var.reset(token)


def test_available_days_with_usage_and_plans():
    used_and_planned = {}
    member, vac, tenant = setup_member(used_and_planned)
    # 5 used days in 2024
    for i in range(1, 6):
        member.days[f"2024-08-{i:02d}"] = DayEntry(day_types=[vac])
    # 5 planned days in 2025
    for i in range(1, 6):
        member.days[f"2025-02-{i:02d}"] = DayEntry(day_types=[vac])

    token = tenant_var.set(tenant)
    member_dto = mongo_to_pydantic(member, TeamMemberReadDTO)
    with patch("backend.routers.teams.get_today", return_value=datetime.date(2025, 1, 1)):
        # 30 total budget - 5 used - 5 planned = 20
        assert member_dto.vacation_available_days == 20
    tenant_var.reset(token)


def test_future_year_plans_ignored():
    member, vac, tenant = setup_member()
    # plans for 2026 should not reduce availability in 2025
    for i in range(1, 6):
        member.days[f"2026-03-{i:02d}"] = DayEntry(day_types=[vac])

    token = tenant_var.set(tenant)
    member_dto = mongo_to_pydantic(member, TeamMemberReadDTO)
    with patch("backend.routers.teams.get_today", return_value=datetime.date(2025, 9, 1)):
        assert member_dto.vacation_available_days == 30
    tenant_var.reset(token)


def test_last_working_day_caps_the_entitlement():
    """A member who already left mid-2025 earned 2024's part-year plus half of 2025,
    not 2025 in full - 19 rather than the 30 they would show without a departure."""
    member, _, tenant = setup_member(last_working_day=datetime.date(2025, 6, 30))
    token = tenant_var.set(tenant)
    member_dto = mongo_to_pydantic(member, TeamMemberReadDTO)
    with patch("backend.routers.teams.get_today", return_value=datetime.date(2025, 9, 1)):
        # 184/366*20 + 181/365*20 = 19.97
        assert member_dto.vacation_available_days == 19
    tenant_var.reset(token)


def test_future_last_working_day_prorates_the_final_year():
    """The departure year is credited now, prorated - that is what makes the number
    answer "how much can they still take before they go?"."""
    member, _, tenant = setup_member(last_working_day=datetime.date(2026, 6, 30))
    token = tenant_var.set(tenant)
    member_dto = mongo_to_pydantic(member, TeamMemberReadDTO)
    with patch("backend.routers.teams.get_today", return_value=datetime.date(2025, 9, 1)):
        # 184/366*20 + 20 + 181/365*20 = 39.97
        assert member_dto.vacation_available_days == 39
    tenant_var.reset(token)


def test_days_marked_after_last_working_day_are_not_charged():
    """Entitlement stops at the last working day, so spending must stop there too -
    otherwise every leaver with a booked trip past their notice reads lower than earned.
    The raw per-year counters still report them, because the cells stay on the calendar.
    """
    member, vac, tenant = setup_member(last_working_day=datetime.date(2025, 6, 30))
    mark_vacation(member, vac, [f"2025-08-{i:02d}" for i in range(1, 6)])

    token = tenant_var.set(tenant)
    member_dto = mongo_to_pydantic(member, TeamMemberReadDTO)
    with patch("backend.routers.teams.get_today", return_value=datetime.date(2025, 9, 1)):
        assert member_dto.vacation_available_days == 19
        assert member_dto.vacation_used_days_by_year == {2025: 5}
    tenant_var.reset(token)


def test_days_planned_before_a_future_last_working_day_are_charged():
    """The horizon that credits the departure year must also charge it. Crediting without
    charging would be wrong in the generous direction."""
    member, vac, tenant = setup_member(last_working_day=datetime.date(2026, 6, 30))
    mark_vacation(member, vac, [f"2026-03-{i:02d}" for i in range(2, 7)])

    token = tenant_var.set(tenant)
    member_dto = mongo_to_pydantic(member, TeamMemberReadDTO)
    with patch("backend.routers.teams.get_today", return_value=datetime.date(2025, 9, 1)):
        # 39.97 - 5 planned days inside the employment window
        assert member_dto.vacation_available_days == 34
        assert member_dto.vacation_planned_days_by_year == {2026: 5}
    tenant_var.reset(token)


def test_last_working_day_before_start_date_yields_zero():
    """Every year's employment window is empty, so the budget is 0 - and for departing
    members we show the actual available value, which is 0 (charged from an empty budget)."""
    member, _, tenant = setup_member(last_working_day=datetime.date(2024, 6, 1))
    token = tenant_var.set(tenant)
    member_dto = mongo_to_pydantic(member, TeamMemberReadDTO)
    with patch("backend.routers.teams.get_today", return_value=datetime.date(2026, 8, 4)):
        assert member_dto.vacation_available_days == 0
    tenant_var.reset(token)


def test_split_uses_the_vacation_identifier_not_the_name():
    """Renaming the system Vacation day type is allowed. Looking it up by name used to
    raise AttributeError here, taking the whole /teams response down with it."""
    member, vac, tenant = setup_member()
    mark_vacation(member, vac, [f"2024-08-{i:02d}" for i in range(1, 6)])
    vac.name = "Annual leave"
    vac.save()

    token = tenant_var.set(tenant)
    member_dto = mongo_to_pydantic(member, TeamMemberReadDTO)
    with patch("backend.routers.teams.get_today", return_value=datetime.date(2025, 1, 1)):
        assert member_dto.vacation_used_days_by_year == {2024: 5}
        assert member_dto.vacation_available_days == 25
    tenant_var.reset(token)


def test_days_marked_before_the_start_date_are_not_charged():
    """The charging window is bounded at BOTH ends of employment.

    Entitlement is credited only from the start date, so charging a day booked before the
    member was ever employed would deduct from a budget that never included that period.
    """
    member, vac, tenant = setup_member(last_working_day=datetime.date(2027, 12, 31),
                                       start=datetime.date(2027, 1, 1))
    mark_vacation(member, vac, ["2026-03-02"])

    token = tenant_var.set(tenant)
    member_dto = mongo_to_pydantic(member, TeamMemberReadDTO)
    with patch("backend.routers.teams.get_today", return_value=datetime.date(2026, 8, 4)):
        # Only 2027 is credited (365/365 * 20 = 20) and the 2026 mark predates employment.
        assert member_dto.vacation_available_days == 20
        # The raw counter still reports it (as used, since it predates today): the cell is
        # on the calendar either way, so the tooltip must keep matching what is visible.
        assert member_dto.vacation_used_days_by_year == {2026: 1}
    tenant_var.reset(token)


def test_pre_start_mark_does_not_reduce_a_normal_balance():
    """The same asymmetry with an ordinary past start date - the likelier case, since
    employee_start_date gets backfilled and corrected in practice."""
    member, vac, tenant = setup_member(start=datetime.date(2025, 6, 1))
    mark_vacation(member, vac, ["2025-03-03"])

    token = tenant_var.set(tenant)
    member_dto = mongo_to_pydantic(member, TeamMemberReadDTO)
    with patch("backend.routers.teams.get_today", return_value=datetime.date(2026, 8, 4)):
        # 214/365*20 + 20 = 31.72, nothing charged.
        assert member_dto.vacation_available_days == 31
    tenant_var.reset(token)


def test_in_employment_marks_are_still_charged():
    """Guard against the lower bound swallowing legitimate deductions."""
    member, vac, tenant = setup_member(start=datetime.date(2025, 6, 1))
    mark_vacation(member, vac, ["2025-08-04", "2025-08-05"])

    token = tenant_var.set(tenant)
    member_dto = mongo_to_pydantic(member, TeamMemberReadDTO)
    with patch("backend.routers.teams.get_today", return_value=datetime.date(2026, 8, 4)):
        assert member_dto.vacation_available_days == 29  # 31.72 - 2
    tenant_var.reset(token)


def test_departing_member_negative_balance():
    """For departing members, negative values are allowed and shown - indicating they've
    used more vacation than they earned before leaving."""
    member, vac, tenant = setup_member(last_working_day=datetime.date(2025, 6, 30))
    # Mark 25 days of vacation in May (more than the ~19 available)
    for i in range(1, 26):
        member.days[f"2025-05-{i:02d}"] = DayEntry(day_types=[vac])

    token = tenant_var.set(tenant)
    member_dto = mongo_to_pydantic(member, TeamMemberReadDTO)
    with patch("backend.routers.teams.get_today", return_value=datetime.date(2025, 9, 1)):
        # ~20 available (184/366*20 + 181/365*20 = 19.97) - 25 charged = -5
        assert member_dto.vacation_available_days == -5
    tenant_var.reset(token)


def test_active_member_never_negative():
    """Active members (without last_working_day) should never show negative balance."""
    member, vac, tenant = setup_member()
    # Mark 35 days of vacation (more than the 30 available)
    for i in range(1, 26):
        member.days[f"2025-05-{i:02d}"] = DayEntry(day_types=[vac])
    for i in range(1, 11):
        member.days[f"2025-06-{i:02d}"] = DayEntry(day_types=[vac])

    token = tenant_var.set(tenant)
    member_dto = mongo_to_pydantic(member, TeamMemberReadDTO)
    with patch("backend.routers.teams.get_today", return_value=datetime.date(2025, 4, 1)):
        # Should be clamped to 0, not negative
        assert member_dto.vacation_available_days == 0
    tenant_var.reset(token)

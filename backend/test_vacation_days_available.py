import os
os.environ.setdefault("MONGO_MOCK", "1")
os.environ.setdefault("AUTHENTICATION_SECRET_KEY", "test_secret")

import datetime
from unittest.mock import patch

from backend.model import Tenant, DayType, TeamMember, DayEntry
from backend.dependencies import mongo_to_pydantic, tenant_var
from backend.main import TeamMemberReadDTO
import uuid


def setup_member(days=None):
    tenant = Tenant(name=f"Test{uuid.uuid4()}", identifier=str(uuid.uuid4())).save()
    DayType.init_day_types(tenant)
    vac = DayType.objects(tenant=tenant, identifier="vacation").first()
    member_days = days or {}
    member = TeamMember(
        name="Alice",
        country="Sweden",
        employee_start_date=datetime.date(2024, 7, 1),
        yearly_vacation_days=20,
        days=member_days,
    )
    return member, vac, tenant


def test_available_days_without_usage():
    member, _, tenant = setup_member()
    token = tenant_var.set(tenant)
    member_dto = mongo_to_pydantic(member, TeamMemberReadDTO)
    with patch("backend.main.get_today", return_value=datetime.date(2025, 1, 1)):
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
    with patch("backend.main.get_today", return_value=datetime.date(2025, 1, 1)):
        # 30 total budget - 5 used - 5 planned = 20
        assert member_dto.vacation_available_days == 20
    tenant_var.reset(token)

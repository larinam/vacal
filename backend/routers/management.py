from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from backend.dependencies import mongo_to_pydantic, get_api_key
from backend.model import Tenant

router = APIRouter(prefix="/management", tags=["Management"])


class TenantDTO(BaseModel):
    id: str = Field(None, alias='_id')
    name: str
    identifier: str
    creation_date: datetime
    status: str
    trial_until: datetime
    current_period: datetime
    max_team_members_in_periods: dict


@router.get("/billing", dependencies=[Depends(get_api_key)])
async def get_billing_info():
    tenants = Tenant.objects()
    tenants_to_transfer = []
    for t in tenants:
        tenants_to_transfer.append(mongo_to_pydantic(t, TenantDTO))
    return tenants_to_transfer

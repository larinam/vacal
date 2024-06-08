import logging
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, EmailStr, computed_field

from backend.dependencies import mongo_to_pydantic, get_api_key
from backend.model import Tenant, User

log = logging.getLogger(__name__)
router = APIRouter(prefix="/management", tags=["Management"])


# noinspection PyNestedDecorators
class TenantDTO(BaseModel):
    id: str = Field(None, alias='_id')
    name: str
    identifier: str
    creation_date: datetime
    status: str
    trial_until: datetime
    current_period: datetime
    max_team_members_in_periods: dict

    @computed_field
    @property
    def email(self) -> EmailStr:
        tenant = Tenant.objects.get(id=self.id)
        first_user = User.objects(tenants=tenant).order_by('id').first()
        return first_user.email if first_user else None


@router.get("/billing", dependencies=[Depends(get_api_key)])
async def get_billing_info():
    tenants = Tenant.objects()
    tenants_to_transfer = []
    for t in tenants:
        tenants_to_transfer.append(mongo_to_pydantic(t, TenantDTO))
    return tenants_to_transfer

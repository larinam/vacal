from functools import lru_cache
from typing import Annotated

from fastapi import HTTPException, APIRouter
from fastapi import status, Depends
from pydantic import BaseModel, Field

from ..dependencies import get_current_active_user_check_tenant, get_tenant, mongo_to_pydantic
from ..dependencies import tenant_var
from ..model import Team, DayType, User, Tenant

router = APIRouter(prefix="/daytypes", tags=["Day Type Operations"])


class DayTypeWriteDTO(BaseModel):
    name: str
    color: str


class DayTypeReadDTO(DayTypeWriteDTO):
    id: str = Field(None, alias='_id')

    @classmethod
    @lru_cache(maxsize=8192)
    def from_mongo_reference_field(cls, day_type_document_reference):
        if day_type_document_reference:
            day_type_document = DayType.objects.get(tenant=tenant_var.get(), id=day_type_document_reference)
            return cls(_id=str(day_type_document.id),
                       name=day_type_document.name,
                       color=day_type_document.color)
        return None


@router.get("/")
async def get_all_day_types(current_user: Annotated[User, Depends(get_current_active_user_check_tenant)],
                            tenant: Annotated[Tenant, Depends(get_tenant)]):
    vacation = DayType.objects(tenant=tenant, name="Vacation").first()
    other_day_types = DayType.objects(tenant=tenant, name__ne="Vacation").order_by("name")
    # Ensure 'Vacation' is at the start if it exists
    day_types = [vacation] + list(other_day_types) if vacation else list(other_day_types)
    return {"day_types": [mongo_to_pydantic(day_type, DayTypeReadDTO) for day_type in day_types]}


@router.post("/")
async def create_day_type(day_type_dto: DayTypeWriteDTO,
                          current_user: Annotated[User, Depends(get_current_active_user_check_tenant)],
                          tenant: Annotated[Tenant, Depends(get_tenant)]):
    if not day_type_dto.color:
        day_type_dto.color = None
    day_type_data = day_type_dto.model_dump()
    day_type_data.update({"tenant": tenant})
    DayType(**day_type_data).save()
    return {"day_types": [mongo_to_pydantic(day_type, DayTypeReadDTO) for day_type in
                          DayType.objects(tenant=tenant).order_by("name")]}


@router.put("/{day_type_id}")
async def update_day_type(day_type_id: str, day_type_dto: DayTypeWriteDTO,
                          current_user: Annotated[User, Depends(get_current_active_user_check_tenant)],
                          tenant: Annotated[Tenant, Depends(get_tenant)]):
    day_type = DayType.objects(tenant=tenant, id=day_type_id).first()
    if not day_type:
        raise HTTPException(status_code=404, detail="DayType not found")

    day_type.name = day_type_dto.name
    day_type.color = day_type_dto.color
    day_type.save()
    DayTypeReadDTO.from_mongo_reference_field.cache_clear()
    return {"day_types": [mongo_to_pydantic(day_type, DayTypeReadDTO) for day_type in
                          DayType.objects(tenant=tenant).order_by("name")]}


def flatten_list(list_of_lists):
    return [item for sublist in list_of_lists for item in sublist]


@router.delete("/{day_type_id}")
async def delete_day_type(day_type_id: str,
                          current_user: Annotated[User, Depends(get_current_active_user_check_tenant)],
                          tenant: Annotated[Tenant, Depends(get_tenant)]):
    # Check if DayType is used in any TeamMember's days or available_day_types, or in any Team's available_day_types
    if any(
            day_type_id in (str(day_types.id) for day_types in flatten_list(member.days.values()))
            for team in Team.objects(tenant=tenant)
            for member in team.team_members
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="DayType is in use and cannot be deleted")

    # Proceed with deletion if DayType is not in use
    result = DayType.objects(tenant=tenant, id=day_type_id).delete()
    if result == 0:
        raise HTTPException(status_code=404, detail="DayType not found")
    DayTypeReadDTO.from_mongo_reference_field.cache_clear()
    return {"message": "DayType deleted successfully"}

from typing import Annotated, List

from fastapi import APIRouter, HTTPException, Depends
from pydantic import field_validator, BaseModel, Field, computed_field
from starlette import status

from ..dependencies import get_current_active_user, get_tenant, mongo_to_pydantic, get_current_active_user_check_tenant
from ..model import User, AuthDetails, Tenant, DayType

router = APIRouter()


class TenantDTO(BaseModel):
    id: str = Field(None, alias='_id')
    name: str
    identifier: str

    @classmethod
    def from_mongo_reference_field(cls, tenant_document_reference):
        if tenant_document_reference:
            tenant_document = Tenant.objects.get(id=tenant_document_reference)
            return cls(_id=str(tenant_document.id),
                       name=tenant_document.name,
                       identifier=tenant_document.identifier)
        return None


class AuthDetailsDTO(BaseModel):
    telegram_id: int | None = None
    telegram_username: str | None = None
    username: str


class UserWithoutTenantsDTO(BaseModel):
    id: str = Field(alias="_id", default=None)
    name: str | None = None
    email: str | None = None
    disabled: bool | None = None
    auth_details: AuthDetailsDTO

    @computed_field
    @property
    def username(self) -> str:
        return self.auth_details.username

    @computed_field
    @property
    def telegram_username(self) -> str | None:
        return self.auth_details.telegram_username


class UserDTO(UserWithoutTenantsDTO):
    tenants: List[TenantDTO]

    @field_validator('tenants', mode="before")
    @classmethod
    def convert_tenants(cls, v):
        if v and isinstance(v, list):
            return [TenantDTO.from_mongo_reference_field(ref) for ref in v]


class TenantCreationModel(BaseModel):
    name: str
    identifier: str


class UserCreationModel(BaseModel):
    tenant: TenantCreationModel | None = None
    name: str
    email: str
    username: str
    password: str
    telegram_username: str | None = None


class UserUpdateModel(BaseModel):
    name: str
    email: str
    username: str
    telegram_username: str | None = None


# noinspection PyNestedDecorators
class PasswordUpdateModel(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

    @field_validator('confirm_password')
    @classmethod
    def passwords_match(cls, v, values, **kwargs):
        if 'new_password' in values and v != values['new_password']:
            raise ValueError("passwords do not match")
        return v


# User Management
@router.post("/users/create-initial")
async def create_initial_user(user_creation: UserCreationModel):
    tenant_data = user_creation.tenant
    # Retrieve or create the tenant
    tenant = Tenant.objects(name=tenant_data.name, identifier=tenant_data.identifier).first()
    if not tenant:
        tenant = Tenant(name=tenant_data.name, identifier=tenant_data.identifier)
        tenant.save()

    # Add Vacation Day Type
    DayType.init_vacation_day_type(tenant)

    # Check if there are any users associated with this tenant
    existing_users = User.objects(tenants__in=[tenant]).count()
    if existing_users > 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant already exists."
        )

    user = User()
    user.tenants = [tenant]
    user.name = user_creation.name
    user.email = user_creation.email
    user.auth_details = AuthDetails(username=user_creation.username)
    user.hash_password(user_creation.password)
    user.save()

    return {"message": "Initial user created successfully"}


@router.post("/users/")
async def create_user(user_creation: UserCreationModel,
                      current_user: Annotated[User, Depends(get_current_active_user_check_tenant)],
                      tenant: Annotated[Tenant, Depends(get_tenant)]):
    user = User()
    user.tenants = [tenant]
    user.name = user_creation.name
    user.email = user_creation.email
    user.auth_details = AuthDetails(username=user_creation.username,
                                    telegram_username=user_creation.telegram_username)
    user.hash_password(user_creation.password)
    user.save()

    return {"message": "User created successfully"}


@router.put("/users/{user_id}")
async def update_user(user_id: str, user_update: UserUpdateModel,
                      current_user: Annotated[User, Depends(get_current_active_user_check_tenant)],
                      tenant: Annotated[Tenant, Depends(get_tenant)]):
    user = User.objects(tenants__in=[tenant], id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.name = user_update.name
    user.email = user_update.email
    user.auth_details.username = user_update.username
    if not user_update.telegram_username:
        user.auth_details.telegram_username = None
    else:
        user.auth_details.telegram_username = user_update.telegram_username
    # Don't update password here; handle password updates separately for security
    user.save()

    return {"message": "User updated successfully"}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: Annotated[User, Depends(get_current_active_user_check_tenant)],
                      tenant: Annotated[Tenant, Depends(get_tenant)]):
    # One should not be able to delete the last user in the tenant.
    # There should be another option to destroy the whole tenant with the last user.
    if User.objects(tenants__in=[tenant]).count() == 1:
        raise HTTPException(status_code=400, detail="Can't delete the last user in the workspace")

    result = User.objects(tenants__in=[tenant], id=user_id).delete()
    if result == 0:
        raise HTTPException(status_code=404, detail="User not found")

    return {"message": "User deleted successfully"}


@router.post("/users/me/password")
async def update_password(password_update: PasswordUpdateModel,
                          current_user: Annotated[User, Depends(get_current_active_user)]):
    # Verify current password
    if not current_user.verify_password(password_update.current_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password."
        )

    # Check if the new password is different from the old password
    if password_update.current_password == password_update.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password."
        )

    # Update to the new password
    current_user.hash_password(password_update.new_password)
    current_user.save()
    return {"message": "Password updated successfully"}


@router.get("/users/")
async def read_users(current_user: Annotated[User, Depends(get_current_active_user_check_tenant)],
                     tenant: Annotated[Tenant, Depends(get_tenant)]):
    users = User.objects(tenants__in=[tenant]).all()
    return [mongo_to_pydantic(user, UserWithoutTenantsDTO) for user in users]


@router.get("/users/me/")
async def read_users_me(current_user: Annotated[User, Depends(get_current_active_user)]):
    return mongo_to_pydantic(current_user, UserDTO)

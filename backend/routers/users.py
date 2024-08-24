import logging
import os
import secrets
from datetime import datetime
from typing import Annotated, List

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import field_validator, BaseModel, Field, computed_field
from starlette import status

from ..dependencies import get_current_active_user, get_tenant, mongo_to_pydantic, get_current_active_user_check_tenant
from ..email_service import send_email
from ..model import User, AuthDetails, Tenant, DayType, Team, TeamMember, UserInvite

log = logging.getLogger(__name__)
cors_origin = os.getenv("CORS_ORIGIN")  # should contain production domain of the frontend

router = APIRouter(prefix="/users", tags=["User Operations"])


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
        if 'new_password' in values.data and v != values.data['new_password']:
            raise ValueError("passwords do not match")
        return v


# User Management
@router.post("/create-initial")
async def create_initial_user(user_creation: UserCreationModel):
    tenant_data = user_creation.tenant
    # Retrieve or create the tenant
    tenant = Tenant.objects(name=tenant_data.name, identifier=tenant_data.identifier).first()
    if not tenant:
        tenant = Tenant(name=tenant_data.name, identifier=tenant_data.identifier)
        tenant.save()

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

    await init_business_objects(tenant, user_creation)

    return {"message": "Initial user created successfully"}


async def init_business_objects(tenant, user_creation):
    """Init business objects for the tenant"""
    DayType.init_day_types(tenant)
    team_member = TeamMember(name=user_creation.name,
                             country="United States",
                             email=user_creation.email)
    Team.init_team(tenant, team_member)


@router.get("")
async def read_users(current_user: Annotated[User, Depends(get_current_active_user_check_tenant)],
                     tenant: Annotated[Tenant, Depends(get_tenant)]):
    users = User.objects(tenants__in=[tenant]).order_by('name').all()
    return [mongo_to_pydantic(user, UserWithoutTenantsDTO) for user in users]


@router.put("/{user_id}")
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


@router.delete("/{user_id}")
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


@router.get("/me")
async def read_users_me(current_user: Annotated[User, Depends(get_current_active_user)]):
    return mongo_to_pydantic(current_user, UserDTO)


@router.post("/me/password")
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


@router.get("/me/remove tenant/{tenant_id}")
async def remove_tenant(tenant_id: str, current_user: Annotated[User, Depends(get_current_active_user)]):
    try:
        current_user.remove_tenant(Tenant.objects(identifier=tenant_id).first())
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    return {"message": "Tenant removed."}


def send_invitation_email(email: str, token: str):
    """
    Sends an email invitation to the specified email address with a registration link.

    :param email: The email address to send the invitation to.
    :param token: The unique token associated with the invitation.
    """
    log.debug(f"Sending invitation email to {email}")

    subject = "You're invited to join Vacation Calendar!"
    registration_link = f"{cors_origin}/register/{token}"
    body = (
        f"Hi there!\n\n"
        f"You have been invited to join our Vacation Calendar. To complete your registration, "
        f"please click the link below:\n\n"
        f"{registration_link}\n\n"
        f"If you did not expect this email, you can safely ignore it.\n\n"
        f"Best regards,\n"
        f"Vacation Calendar"
    )

    try:
        send_email(subject, body, email)
        log.info(f"Invitation email sent to {email}")
    except Exception as e:
        log.error(f"Failed to send invitation email to {email}: {str(e)}")
        raise


class InviteUserRequest(BaseModel):
    email: str


@router.post("/invite")
async def invite_user(invite_data: InviteUserRequest,
                      background_tasks: BackgroundTasks,
                      current_user: Annotated[User, Depends(get_current_active_user_check_tenant)],
                      tenant: Annotated[Tenant, Depends(get_tenant)]):
    # Extract the email from the request body
    email = invite_data.email

    # Check if the email is already associated with an invite
    existing_invite = UserInvite.objects(email=email, tenant=tenant).first()
    if existing_invite and not existing_invite.is_expired():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already invited")

    # Check if a user with this email already exists in the current tenant
    existing_user = User.objects(email=email, tenants__in=[tenant]).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="User with this email already exists in the Workspace")

    # Generate a unique token for the invitation
    token = secrets.token_urlsafe(32)
    invite = UserInvite(email=email, inviter=current_user, tenant=tenant, token=token)
    invite.save()

    # Send an invitation email in the background
    background_tasks.add_task(send_invitation_email, email, token)

    return {"message": "Invitation sent successfully"}


@router.get("/invite/{token}")
async def get_invite_details(token: str):
    invite = UserInvite.objects(token=token, status="pending").first()

    if not invite or invite.is_expired():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired invitation token")

    # Retrieve related tenant details
    tenant = invite.tenant
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Associated tenant not found")

    existing_user = User.objects(email=invite.email).first() is not None

    return {
        "email": invite.email,
        "tenant_name": tenant.name,
        "tenant_identifier": tenant.identifier,
        "existing_user": existing_user
    }


@router.post("/register/{token}")
async def register_user_via_invite(token: str, user_creation: UserCreationModel):
    invite = UserInvite.objects(token=token, status="pending").first()

    if not invite or invite.is_expired():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired invitation token")

    # Check if the user already exists based on the email from the invite
    user = User.objects(email=invite.email).first()

    if user:
        # User exists, add the new tenant
        if invite.tenant in user.tenants:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already associated with this tenant")

        user.tenants.append(invite.tenant)
        user.save()
    else:
        # User doesn't exist, create a new one
        user = User()
        user.tenants = [invite.tenant]
        user.name = user_creation.name
        user.email = invite.email
        user.auth_details = AuthDetails(
            username=user_creation.username,
            telegram_username=user_creation.telegram_username if user_creation.telegram_username else None
        )
        user.hash_password(user_creation.password)
        user.save()

    # Mark invite as accepted
    invite.mark_as_accepted()

    return {"message": "User registered successfully" if not user else "Tenant associated successfully with the existing user"}



class UserInviteDTO(BaseModel):
    id: str = Field(alias="_id", default=None)
    email: str
    status: str
    expiration_date: datetime


@router.get("/invites", response_model=List[UserInviteDTO])
async def list_invites(current_user: Annotated[User, Depends(get_current_active_user_check_tenant)],
                       tenant: Annotated[Tenant, Depends(get_tenant)]):
    invites = UserInvite.objects(tenant=tenant, status__ne="accepted").all()
    return [mongo_to_pydantic(invite, UserInviteDTO) for invite in invites]


@router.delete("/invite/{invite_id}")
async def withdraw_invite(invite_id: str,
                          current_user: Annotated[User, Depends(get_current_active_user_check_tenant)],
                          tenant: Annotated[Tenant, Depends(get_tenant)]):
    invite = UserInvite.objects(id=invite_id, tenant=tenant).first()

    if not invite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

    if invite.status == "accepted":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot withdraw an accepted invite")

    invite.delete()

    return {"message": "Invite withdrawn successfully"}

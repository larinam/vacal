from typing import Annotated, List

from fastapi import APIRouter, HTTPException, Depends
from pydantic import field_validator, BaseModel
from starlette import status

from ..dependencies import get_current_active_user
from ..model import User, AuthDetails

router = APIRouter()


class UserDTO(BaseModel):
    id: str
    name: str | None = None
    email: str | None = None
    username: str
    disabled: bool | None = None
    telegram_username: str | None = None


class UserCreationModel(BaseModel):
    name: str
    email: str
    username: str
    password: str
    telegram_username: str | None = None


class UserUpdateModel(BaseModel):
    id: str
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
    # Check if there are any users in the system
    existing_users = User.objects.count()
    if existing_users > 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="An initial user already exists."
        )

    user = User()
    user.name = user_creation.name
    user.email = user_creation.email
    user.auth_details = AuthDetails(username=user_creation.username)
    user.hash_password(user_creation.password)
    user.save()

    return {"message": "Initial user created successfully"}


@router.post("/users/")
async def create_user(user_creation: UserCreationModel,
                      current_user: Annotated[User, Depends(get_current_active_user)]):
    user = User()
    user.name = user_creation.name
    user.email = user_creation.email
    user.auth_details = AuthDetails(username=user_creation.username,
                                    telegram_username=user_creation.telegram_username)
    user.hash_password(user_creation.password)
    user.save()

    return {"message": "User created successfully"}


@router.put("/users/{user_id}")
async def update_user(user_id: str, user_update: UserUpdateModel,
                      current_user: Annotated[User, Depends(get_current_active_user)]):
    user = User.objects(id=user_id).first()
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


@router.put("/users/{user_id}", response_model=UserDTO)
async def update_user(user_id: str, user_update: UserCreationModel,
                      current_user: Annotated[User, Depends(get_current_active_user)]) -> UserDTO:
    user = User.objects(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.name = user_update.name
    user.email = user_update.email
    if user_update.telegram_username:
        user.auth_details.telegram_username = user_update.telegram_username

    user.save()
    return UserDTO(
        name=user.name,
        email=user.email,
        username=user.auth_details.username,
        disabled=user.disabled,
        telegram_username=user.auth_details.telegram_username
    )


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: Annotated[User, Depends(get_current_active_user)]):
    result = User.objects(id=user_id).delete()
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


@router.get("/users/", response_model=List[UserDTO])
async def read_users(current_user: Annotated[User, Depends(get_current_active_user)]):
    users = User.objects.all()
    return [
        {
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "username": user.auth_details.username,
            "disabled": user.disabled,
            "telegram_username": user.auth_details.telegram_username,
        }
        for user in users
    ]


@router.get("/users/me/", response_model=UserDTO)
async def read_users_me(current_user: Annotated[User, Depends(get_current_active_user)]):
    return current_user

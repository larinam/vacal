import datetime
import os
from typing import Annotated

import jwt
from fastapi import HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer
from starlette import status

from .model import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
AUTHENTICATION_SECRET_KEY = os.getenv("AUTHENTICATION_SECRET_KEY")
ALGORITHM = "HS256"


def create_access_token(data: dict, expires_delta: datetime.timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.datetime.now(datetime.timezone.utc) + (expires_delta or datetime.timedelta(minutes=15))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, AUTHENTICATION_SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, AUTHENTICATION_SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            raise credentials_exception
        user = User.get_by_username(username)
        if not user:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    return user


def get_current_active_user(current_user: Annotated[User, Depends(get_current_user)]):
    if current_user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

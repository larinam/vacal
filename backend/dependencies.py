import datetime
import os
from contextvars import ContextVar
from typing import Annotated

import jwt
from fastapi import HTTPException, Depends, Header
from fastapi.security import OAuth2PasswordBearer
from starlette import status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from .model import User, Tenant

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
AUTHENTICATION_SECRET_KEY = os.getenv("AUTHENTICATION_SECRET_KEY")
if AUTHENTICATION_SECRET_KEY is None:
    raise EnvironmentError("Required environment variable 'AUTHENTICATION_SECRET_KEY' is not set.")

ALGORITHM = "HS256"


def create_access_token(data: dict, expires_delta: datetime.timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.datetime.now(datetime.timezone.utc) + (expires_delta or datetime.timedelta(minutes=15))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, AUTHENTICATION_SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]) -> User:
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


async def get_tenant(tenant_id: str = Header(None, alias="Tenant-ID")) -> Tenant:
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Tenant-ID header is missing")
    tenant = Tenant.objects(identifier=tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


def get_current_active_user_check_tenant(current_user: Annotated[User, Depends(get_current_active_user)],
                                         tenant: Annotated[Tenant, Depends(get_tenant)]):
    if tenant not in current_user.tenants:
        raise HTTPException(status_code=400, detail="User tenant mismatch with current")
    return current_user


def mongo_to_pydantic(mongo_document, pydantic_model):
    # Convert MongoEngine Document to a dictionary
    document_dict = mongo_document.to_mongo().to_dict()
    if '_id' in document_dict:
        document_dict['_id'] = str(document_dict['_id'])
    # Create a Pydantic model instance from the dictionary
    return pydantic_model(**document_dict)


tenant_var: ContextVar[Tenant] = ContextVar("tenant_var")


class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        tenant_identifier = request.headers.get("Tenant-ID")
        tenant = Tenant.objects(identifier=tenant_identifier).first()
        token = tenant_var.set(tenant)
        response = await call_next(request)
        tenant_var.reset(token)
        return response

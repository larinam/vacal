import datetime
import hashlib
import hmac
import logging
import os
import time
from contextlib import asynccontextmanager
from copy import deepcopy
from typing import Annotated

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm

from prometheus_fastapi_instrumentator import Instrumentator
from pydantic import BaseModel
from pydantic.functional_validators import field_validator, model_validator

from .dependencies import create_access_token, get_current_active_user_check_tenant, get_tenant, TenantMiddleware
from .model import User, Tenant
from .routers import users, daytypes, management, teams, webauthn
from .routers.teams import (
    TeamMemberWriteDTO,
    DayEntryDTO,
    TeamMemberReadDTO,
    TeamWriteDTO,
    TeamReadDTO,
)
from .scheduled.activate_trials import activate_trials
from .scheduled.birthdays import send_birthday_email_updates
from .scheduled.update_max_team_members_numbers import run_update_max_team_members_numbers
from .scheduled.vacation_starts import send_vacation_email_updates, send_upcoming_vacation_email_updates

origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://127.0.0.1",
    "http://127.0.0.1:3000",
]

cors_origin = os.getenv("CORS_ORIGIN")  # should contain production domain of the frontend
if cors_origin:  # for production
    origins.append(cors_origin)

ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 365

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_BOT_USERNAME = os.getenv("TELEGRAM_BOT_USERNAME", "")

MULTITENANCY_ENABLED = os.getenv("MULTITENANCY_ENABLED", False)


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = BackgroundScheduler()
    scheduler.add_job(send_vacation_email_updates, 'cron', hour=6, minute=0)
    scheduler.add_job(send_upcoming_vacation_email_updates, 'cron', hour=6, minute=1)
    scheduler.add_job(send_birthday_email_updates, 'cron', hour=6, minute=5)
    if MULTITENANCY_ENABLED:
        scheduler.add_job(run_update_max_team_members_numbers, 'cron', hour=1, minute=5)
        scheduler.add_job(activate_trials, 'cron', hour=2, minute=5)
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(lifespan=lifespan)
app.add_middleware(TenantMiddleware)
app.include_router(users.router)
app.include_router(daytypes.router)
app.include_router(teams.router)
app.include_router(webauthn.router)
if MULTITENANCY_ENABLED:
    app.include_router(management.router)
Instrumentator().instrument(app).expose(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

log = logging.getLogger(__name__)

@app.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    """
    Health check endpoint for monitoring and load balancer health checks.
    Returns a simple status response with a 200 OK status code.
    This endpoint is suitable for ALB health checks.
    """
    return {"status": "healthy"}


class GeneralApplicationConfigDTO(BaseModel):
    telegram_enabled: bool
    telegram_bot_username: str
    user_initiated: bool
    multitenancy_enabled: bool = False



# General Application Configuration
@app.get("/config", response_model=GeneralApplicationConfigDTO)
async def get_config():
    tenant_exists = Tenant.objects().first() is not None
    user_exists = User.objects().first() is not None
    return {"telegram_enabled": bool(TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME),
            "telegram_bot_username": TELEGRAM_BOT_USERNAME,
            "user_initiated": tenant_exists and user_exists,
            "multitenancy_enabled": MULTITENANCY_ENABLED}


class TokenDTO(BaseModel):
    access_token: str
    token_type: str


class TokenDataDTO(BaseModel):
    username: str | None = None


# Authentication
@app.post("/token")
async def login_for_access_token(form_data: Annotated[OAuth2PasswordRequestForm, Depends()]) -> TokenDTO:
    user = User.authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.auth_details.username}, expires_delta=access_token_expires
    )
    return TokenDTO(access_token=access_token, token_type="bearer")


# noinspection PyNestedDecorators
class TelegramAuthData(BaseModel):
    hash: str
    id: int
    auth_date: int
    username: str

    # Additional fields should be added if necessary for further processing in the endpoint method

    @field_validator('auth_date')
    @classmethod
    def check_auth_date(cls, auth_date):
        if (time.time() - auth_date) > 86400:
            raise ValueError("Data is outdated")
        return auth_date

    @model_validator(mode="before")
    @classmethod
    def check_telegram_authorization(cls, input_values):
        values = deepcopy(input_values)
        telegram_hash = values.pop("hash")
        data_check_arr = ["{}={}".format(key, value) for key, value in values.items()]
        data_check_arr.sort()
        data_check_string = "\n".join(data_check_arr)

        secret_key = hashlib.sha256(TELEGRAM_BOT_TOKEN.encode()).digest()
        calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

        if calculated_hash != telegram_hash:
            raise ValueError("Data is NOT from Telegram")

        return input_values


@app.post("/telegram-login")
async def telegram_login(auth_data: TelegramAuthData):
    # At this point, auth_data is already validated by Pydantic
    username = auth_data.dict().get("username").lower()  # Telegram sends the username in the auth data
    user = User.get_by_telegram_username(username)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"The user with your Telegram username: {username} is not found in our system"
        )
    # update Telegram ID
    if not user.auth_details.telegram_id:
        user.auth_details.telegram_id = auth_data.dict().get("id")
        user.save()
    access_token_expires = datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.auth_details.username}, expires_delta=access_token_expires
    )

    return TokenDTO(access_token=access_token, token_type="bearer")



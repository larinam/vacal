import datetime
import hashlib
import hmac
import logging
import os
import time
from collections import defaultdict
from contextvars import ContextVar
from copy import deepcopy
from io import BytesIO
from typing import List, Dict, Optional, Annotated

import holidays
import pycountry
from apscheduler.schedulers.background import BackgroundScheduler
from bson import ObjectId
from fastapi import FastAPI, status, Body, Depends
from fastapi import Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordRequestForm
from openpyxl import Workbook
from openpyxl.utils import get_column_letter
from prometheus_fastapi_instrumentator import Instrumentator
from pycountry.db import Country
from pydantic import BaseModel, Field, computed_field
from pydantic.functional_validators import field_validator, model_validator
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from .dependencies import create_access_token, get_current_active_user_check_tenant, get_tenant, mongo_to_pydantic
from .model import Team, TeamMember, get_unique_countries, DayType, get_vacation_day_type_id, User, Tenant
from .routers import users

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

tenant_var: ContextVar[Tenant] = ContextVar("tenant_var")


class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        tenant_identifier = request.headers.get("Tenant-ID")
        tenant = Tenant.objects(identifier=tenant_identifier).first()
        token = tenant_var.set(tenant)
        response = await call_next(request)
        tenant_var.reset(token)
        return response


app = FastAPI()
app.add_middleware(TenantMiddleware)
app.include_router(users.router)
Instrumentator().instrument(app).expose(app)
scheduler = BackgroundScheduler()


def your_scheduled_task():
    # Your task logic
    print("Scheduled task executed")


@app.on_event("startup")
def start_scheduler():
    scheduler.add_job(your_scheduled_task, 'cron', hour=7, minute=0)
    scheduler.start()


@app.on_event("shutdown")
def shutdown_scheduler():
    scheduler.shutdown()


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

log = logging.getLogger(__name__)


class GeneralApplicationConfigDTO(BaseModel):
    telegram_enabled: bool
    user_initiated: bool


class DayTypeWriteDTO(BaseModel):
    name: str
    color: str


class DayTypeReadDTO(DayTypeWriteDTO):
    id: str = Field(None, alias='_id')

    @classmethod
    def from_mongo_reference_field(cls, day_type_document_reference):
        if day_type_document_reference:
            day_type_document = DayType.objects.get(tenant=tenant_var.get(), id=day_type_document_reference)
            return cls(_id=str(day_type_document.id),
                       name=day_type_document.name,
                       color=day_type_document.color)
        return None


# noinspection PyNestedDecorators
class TeamMemberWriteDTO(BaseModel):
    name: str
    country: str
    email: Optional[str] = None
    phone: Optional[str] = None
    available_day_types: List[DayTypeReadDTO] = []

    @field_validator("country")
    @classmethod
    def validate_country(cls, value: str) -> str:
        country_name = validate_country_name(value)
        if country_name:
            return country_name
        raise ValueError("Invalid country name")

    @field_validator('email')
    @classmethod
    def empty_email_to_none(cls, v):
        return None if v == "" else v


# noinspection PyNestedDecorators
class TeamMemberReadDTO(TeamMemberWriteDTO):
    uid: str
    days: Dict[str, List[DayTypeReadDTO]] = Field(default_factory=dict)

    @computed_field
    @property
    def vacation_days_by_year(self) -> Dict[int, int]:
        vac_days_count = defaultdict(int)
        vacation_day_type = mongo_to_pydantic(DayType.objects(tenant=tenant_var.get(), name="Vacation").first(),
                                              DayTypeReadDTO)
        for date_str, day_types in self.days.items():
            date = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
            if vacation_day_type in day_types:
                vac_days_count[date.year] += 1
        return dict(vac_days_count)

    @field_validator('days', mode="before")
    @classmethod
    def convert_days(cls, v):
        if v and isinstance(v, dict):
            converted_days = {}
            for date_str, day_type_ids in v.items():
                converted_day_types = []
                for day_type_id in day_type_ids:
                    if isinstance(day_type_id, ObjectId):
                        converted_day_types.append(DayTypeReadDTO.from_mongo_reference_field(day_type_id))
                converted_days[date_str] = converted_day_types
            return converted_days
        return v

    @computed_field
    @property
    def country_flag(self) -> str:
        country = pycountry.countries.get(name=self.country)
        if country:
            return country.flag
        raise ValueError(f"Invalid country name: {self.country}")


class TeamWriteDTO(BaseModel):
    name: str
    available_day_types: List[DayTypeReadDTO] = []


# noinspection PyNestedDecorators
class TeamReadDTO(TeamWriteDTO):
    id: str = Field(None, alias='_id')
    team_members: List[TeamMemberReadDTO]

    @field_validator('team_members')
    @classmethod
    def sort_team_members(cls, team_members):
        return sorted(team_members, key=lambda member: member.name)


class TokenDTO(BaseModel):
    access_token: str
    token_type: str


class TokenDataDTO(BaseModel):
    username: str | None = None


def validate_country_name(country_name):
    countries = pycountry.countries.search_fuzzy(country_name)
    if countries:
        country = countries[0]
        if isinstance(country, Country):
            return country.name
    return None


def get_holidays(tenant, year: int = datetime.datetime.now().year) -> dict:
    countries = get_unique_countries(tenant)
    holidays_dict = {}
    for country in countries:
        country_holidays = {}
        country_alpha_2 = pycountry.countries.get(name=country).alpha_2
        try:
            country_holidays = holidays.country_holidays(
                country_alpha_2, years=[year - 1, year, year + 1]
            )
        except NotImplementedError as e:  # there are no holidays for some countries, but it's fine
            log.warning(e, exc_info=e)
        holidays_dict.update({country: country_holidays})
    return holidays_dict


# General Application Configuration
@app.get("/config", response_model=GeneralApplicationConfigDTO)
async def get_config():
    return {"telegram_enabled": bool(TELEGRAM_BOT_TOKEN),
            "user_initiated": User.objects().count() > 0}


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


# Business Logic
@app.get("/")
async def read_root(current_user: Annotated[User, Depends(get_current_active_user_check_tenant)],
              tenant: Annotated[Tenant, Depends(get_tenant)]):
    return {
        "teams": list(map(lambda x: mongo_to_pydantic(x, TeamReadDTO), Team.objects(tenant=tenant).order_by("name"))),
        "holidays": get_holidays(tenant)} | await get_all_day_types(current_user, tenant)


@app.post("/teams/{team_id}/members/")
async def add_team_member(team_id: str, team_member_dto: TeamMemberWriteDTO,
                    current_user: Annotated[User, Depends(get_current_active_user_check_tenant)],
                    tenant: Annotated[Tenant, Depends(get_tenant)]):
    team_member_data = team_member_dto.model_dump()
    team_member = TeamMember(**team_member_data)
    team = Team.objects(tenant=tenant, id=team_id).first()
    team.team_members.append(team_member)
    team.save()
    return {"message": "Team member created successfully"}


@app.post("/teams/")
async def add_team(team_dto: TeamWriteDTO, current_user: Annotated[User, Depends(get_current_active_user_check_tenant)],
             tenant: Annotated[Tenant, Depends(get_tenant)]):
    team_data = team_dto.model_dump()
    team_data.update({"tenant": tenant})
    Team(**team_data).save()
    return {"message": "Team created successfully"}


@app.delete("/teams/{team_id}")
async def delete_team(team_id: str, current_user: Annotated[User, Depends(get_current_active_user_check_tenant)],
                tenant: Annotated[Tenant, Depends(get_tenant)]):
    Team.objects(tenant=tenant, id=team_id).delete()
    return RedirectResponse(url="/", status_code=status.HTTP_303_SEE_OTHER)


@app.delete("/teams/{team_id}/members/{team_member_id}")
async def delete_team_member(team_id: str, team_member_id: str,
                       current_user: Annotated[User, Depends(get_current_active_user_check_tenant)],
                       tenant: Annotated[Tenant, Depends(get_tenant)]):
    team = Team.objects(tenant=tenant, id=team_id).first()
    team_members = team.team_members
    team_member_to_remove = team_members.get(uid=team_member_id)
    team_members.remove(team_member_to_remove)
    team.save()
    return RedirectResponse(url="/", status_code=status.HTTP_303_SEE_OTHER)


@app.put("/teams/{team_id}")
async def update_team(team_id: str, team_dto: TeamWriteDTO,
                current_user: Annotated[User, Depends(get_current_active_user_check_tenant)],
                tenant: Annotated[Tenant, Depends(get_tenant)]):
    team = Team.objects(tenant=tenant, id=team_id).first()
    if team:
        team.name = team_dto.name
        team.available_day_types = team_dto.available_day_types
        team.save()
        return {"message": "Team modified successfully"}
    else:
        raise HTTPException(status_code=404, detail="Team not found")


@app.put("/teams/{team_id}/members/{team_member_id}")
async def update_team_member(team_id: str, team_member_id: str, team_member_dto: TeamMemberWriteDTO,
                       current_user: Annotated[User, Depends(get_current_active_user_check_tenant)],
                       tenant: Annotated[Tenant, Depends(get_tenant)]):
    team = Team.objects(tenant=tenant, id=team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    team_member: TeamMember = team.team_members.get(uid=team_member_id)
    if not team_member:
        raise HTTPException(status_code=404, detail="Team member not found")

    team_member.name = team_member_dto.name
    team_member.country = team_member_dto.country
    team_member.email = team_member_dto.email if team_member_dto.email else None
    team_member.phone = team_member_dto.phone
    team_member.available_day_types = team_member_dto.available_day_types

    team.save()
    return {"message": "Team member modified successfully"}


@app.post("/move-team-member/{team_member_uid}")
async def move_team_member(current_user: Annotated[User, Depends(get_current_active_user_check_tenant)],
                     tenant: Annotated[Tenant, Depends(get_tenant)],
                     team_member_uid: str,
                     target_team_id: str = Body(...),
                     source_team_id: str = Body(...)):
    # Retrieve source and target teams
    source_team = Team.objects(tenant=tenant, id=source_team_id).first()
    target_team = Team.objects(tenant=tenant, id=target_team_id).first()

    if not source_team or not target_team:
        raise HTTPException(status_code=404, detail="One or both teams not found")

    # Find the team member in source team
    team_member = next((member for member in source_team.team_members if str(member.uid) == str(team_member_uid)), None)
    if not team_member:
        raise HTTPException(status_code=404, detail="Team member not found in source team")

    # Remove team member from source team
    source_team.team_members = [member for member in source_team.team_members if member.uid != team_member.uid]
    source_team.save()

    # Add team member to target team, ensuring no duplicates
    if not any(member.uid == team_member.uid for member in target_team.team_members):
        target_team.team_members.append(team_member)
        target_team.save()

    return {"message": "Team member successfully moved"}


def is_weekend(date):
    return date.weekday() >= 5  # 5 for Saturday and 6 for Sunday


def get_working_days(start_date, end_date, country_holidays):
    # Calculate the number of working days excluding weekends and holidays
    working_days = 0
    current_date = start_date
    while current_date <= end_date:
        if not is_weekend(current_date) and current_date not in country_holidays:
            working_days += 1
        current_date += datetime.timedelta(days=1)
    return working_days


def auto_adjust_column_width(ws):
    for col in ws.columns:
        max_length = 0
        column = col[0].column  # Get the column name
        for cell in col:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(cell.value)
            except:
                pass
        ws.column_dimensions[get_column_letter(column)].width = max_length


@app.get("/export-vacations/")
async def export_vacations(current_user: Annotated[User, Depends(get_current_active_user_check_tenant)],
                     tenant: Annotated[Tenant, Depends(get_tenant)],
                     start_date: datetime.date = Query(...), end_date: datetime.date = Query(...)):
    wb = Workbook()
    ws = wb.active
    ws.title = "Vacations"

    # Headers
    headers = ["Team", "Team Member Name", "Country", "Vacation Days", "Working Days", "Days Worked", "Hours Worked"]
    ws.append(headers)

    vacation_day_type_id = get_vacation_day_type_id(tenant)
    country_holidays = get_holidays(tenant)

    # Query and process the data
    for team in Team.objects(tenant=tenant):
        for member in team.team_members:
            member_holidays = country_holidays.get(member.country, [])
            vac_days_count = 0
            for date_str, day_types in member.days.items():
                # Convert the string to a date object to compare with the given date range
                date = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
                if start_date <= date <= end_date:
                    # Count only if the day type list contains the 'Vacation' day type ID
                    if any(vacation_day_type_id == str(day_type.id) for day_type in day_types):
                        vac_days_count += 1
            # Calculate working days
            working_days = get_working_days(start_date, end_date, member_holidays)
            ws.append(
                [team.name, member.name, member.country, vac_days_count, working_days, working_days - vac_days_count,
                 (working_days - vac_days_count) * 8])

    # Assuming you have added data below headers, now apply auto_filter
    last_column_letter = get_column_letter(len(headers))
    ws.auto_filter.ref = f"A1:{last_column_letter}1"
    auto_adjust_column_width(ws)

    # Save the workbook to a BytesIO object
    b_io = BytesIO()
    wb.save(b_io)
    b_io.seek(0)  # Go to the start of the BytesIO object

    # Create and return the streaming response
    return StreamingResponse(b_io, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={
                                 "Content-Disposition": f"attachment; filename=vacations_{start_date}_{end_date}.xlsx"})


@app.post("/teams/{team_id}/members/{team_member_id}/days")
async def add_days(team_id: str, team_member_id: str, new_days: Dict[str, List[str]],
             current_user: Annotated[User, Depends(get_current_active_user_check_tenant)],
             tenant: Annotated[Tenant, Depends(get_tenant)]):
    team: Team = Team.objects(tenant=tenant, id=team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    team_member: TeamMember = team.team_members.get(uid=team_member_id)
    if not team_member:
        raise HTTPException(status_code=404, detail="Team member not found")

    # Updating days field with new entries
    for date_str, day_type_ids in new_days.items():
        day_types = [DayType.objects(tenant=tenant, id=day_type_id).first() for day_type_id in day_type_ids]
        if date_str in team_member.days:
            # Add new day types to the existing list for this date
            team_member.days[date_str].extend(day_types)
        else:
            # Create a new entry for this date
            team_member.days[date_str] = day_types

    team.save()
    return {"message": "Days added successfully"}


@app.put("/teams/{team_id}/members/{team_member_id}/days")
async def update_days(team_id: str, team_member_id: str, days: Dict[str, List[str]],
                current_user: Annotated[User, Depends(get_current_active_user_check_tenant)],
                tenant: Annotated[Tenant, Depends(get_tenant)]):
    """Assume it is an update for only one day"""
    team: Team = Team.objects(tenant=tenant, id=team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    team_member: TeamMember = team.team_members.get(uid=team_member_id)
    if not team_member:
        raise HTTPException(status_code=404, detail="Team member not found")

    # Convert the day type IDs to DayType references
    updated_days = {}
    for date_str, day_type_ids in days.items():
        day_types = [DayType.objects(tenant=tenant, id=day_type_id).first() for day_type_id in day_type_ids]
        updated_days[date_str] = sorted(day_types, key=lambda day_type: day_type.name)

    team_member.days = team_member.days | updated_days
    team.save()
    return {"message": "Days modified successfully"}


@app.get("/daytypes/")
async def get_all_day_types(current_user: Annotated[User, Depends(get_current_active_user_check_tenant)],
                      tenant: Annotated[Tenant, Depends(get_tenant)]):
    vacation = DayType.objects(tenant=tenant, name="Vacation").first()
    other_day_types = DayType.objects(tenant=tenant, name__ne="Vacation").order_by("name")
    # Ensure 'Vacation' is at the start if it exists
    day_types = [vacation] + list(other_day_types) if vacation else list(other_day_types)
    return {"day_types": [mongo_to_pydantic(day_type, DayTypeReadDTO) for day_type in day_types]}


@app.post("/daytypes/")
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


@app.put("/daytypes/{day_type_id}")
async def update_day_type(day_type_id: str, day_type_dto: DayTypeWriteDTO,
                    current_user: Annotated[User, Depends(get_current_active_user_check_tenant)],
                    tenant: Annotated[Tenant, Depends(get_tenant)]):
    day_type = DayType.objects(tenant=tenant, id=day_type_id).first()
    if not day_type:
        raise HTTPException(status_code=404, detail="DayType not found")

    day_type.name = day_type_dto.name
    day_type.color = day_type_dto.color
    day_type.save()
    return {"day_types": [mongo_to_pydantic(day_type, DayTypeReadDTO) for day_type in
                          DayType.objects(tenant=tenant).order_by("name")]}


def flatten_list(list_of_lists):
    return [item for sublist in list_of_lists for item in sublist]


@app.delete("/daytypes/{day_type_id}")
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

    return {"message": "DayType deleted successfully"}

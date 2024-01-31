import datetime
from collections import defaultdict
from typing import List, Dict, Optional

import holidays
import pycountry
import uvicorn
from bson import ObjectId
from fastapi import FastAPI, status, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from model import Team, TeamMember, get_unique_countries, DayType
from pydantic import BaseModel, Field, computed_field, validator
from pydantic.functional_validators import field_validator
from fastapi.responses import RedirectResponse
import logging
import os
from apscheduler.schedulers.background import BackgroundScheduler

origins = [
    "http://localhost",
    "http://localhost:3000",
]

cors_origin = os.getenv("CORS_ORIGIN")  # should contain production domain of the frontend
if cors_origin:  # for production
    origins.append(cors_origin)

app = FastAPI()
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


class DayTypeWriteDTO(BaseModel):
    name: str
    color: str


class DayTypeReadDTO(DayTypeWriteDTO):
    id: str = Field(None, alias='_id')

    @classmethod
    def from_mongo_reference_field(cls, day_type_document_reference):
        if day_type_document_reference:
            day_type_document = DayType.objects.get(id=day_type_document_reference)
            return cls(_id=str(day_type_document.id),
                       name=day_type_document.name,
                       color=day_type_document.color)
        return None


class TeamMemberWriteDTO(BaseModel):
    name: str
    country: str
    email: Optional[str] = None
    phone: Optional[str] = None
    available_day_types: List[DayTypeReadDTO] = []

    @field_validator("country")
    @classmethod
    def validate_country(cls, value: str) -> str:
        if validate_country_name(value):
            return value
        raise ValueError("Invalid country name")

    @field_validator('email')
    @classmethod
    def empty_email_to_none(cls, v):
        return None if v == "" else v


class TeamMemberReadDTO(TeamMemberWriteDTO):
    uid: str
    days: Dict[str, List[DayTypeReadDTO]] = Field(default_factory=dict)

    @computed_field
    @property
    def vacation_days_by_year(self) -> Dict[int, int]:
        vac_days_count = defaultdict(int)
        vacation_day_type = mongo_to_pydantic(DayType.objects(name="Vacation").first(), DayTypeReadDTO)
        for date_str, day_types in self.days.items():
            date = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
            if vacation_day_type in day_types:
                vac_days_count[date.year] += 1
        return dict(vac_days_count)

    @validator('days', pre=True, always=True)
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


class TeamWriteDTO(BaseModel):
    name: str
    available_day_types: List[DayTypeReadDTO] = []


class TeamReadDTO(TeamWriteDTO):
    id: str = Field(None, alias='_id')
    team_members: List[TeamMemberReadDTO]

    @field_validator('team_members')
    @classmethod
    def sort_team_members(cls, team_members):
        return sorted(team_members, key=lambda member: member.name)


def validate_country_name(country_name):
    for country in pycountry.countries:
        if country_name.lower() == country.name.lower():
            return True
    return False


def mongo_to_pydantic(mongo_document, pydantic_model):
    # Convert MongoEngine Document to a dictionary
    document_dict = mongo_document.to_mongo().to_dict()
    if '_id' in document_dict:
        document_dict['_id'] = str(document_dict['_id'])
    # Create a Pydantic model instance from the dictionary
    return pydantic_model(**document_dict)


def get_holidays(year: int = datetime.datetime.now().year):
    countries = get_unique_countries()
    holidays_dict = {}
    list(map(lambda x: holidays_dict.update({x: holidays.country_holidays(x, years=[year - 1, year, year + 1])}),
             countries))
    return holidays_dict


@app.get("/")
def read_root(year: int = datetime.datetime.now().year):
    return {"teams": list(map(lambda x: mongo_to_pydantic(x, TeamReadDTO), Team.objects.order_by("name"))),
            "holidays": get_holidays(year)} | get_all_day_types()


@app.post("/teams/{team_id}/members/")
def add_team_member(team_id: str, team_member_dto: TeamMemberWriteDTO):
    team_member_data = team_member_dto.model_dump()
    team_member = TeamMember(**team_member_data)
    team = Team.objects(id=team_id).first()
    team.team_members.append(team_member)
    team.save()
    return {"team": mongo_to_pydantic(team, TeamReadDTO)}


@app.post("/teams/")
def add_team(team_dto: TeamWriteDTO):
    team_data = team_dto.model_dump()
    team = Team(**team_data).save()
    return {"team_id": str(team.id)}


@app.delete("/teams/{team_id}")
def delete_team(team_id: str):
    Team.objects(id=team_id).delete()
    return RedirectResponse(url="/", status_code=status.HTTP_303_SEE_OTHER)


@app.delete("/teams/{team_id}/members/{team_member_id}")
def delete_team_member(team_id: str, team_member_id: str):
    team = Team.objects(id=team_id).first()
    team_members = team.team_members
    team_member_to_remove = team_members.get(uid=team_member_id)
    team_members.remove(team_member_to_remove)
    team.save()
    return RedirectResponse(url="/", status_code=status.HTTP_303_SEE_OTHER)


@app.put("/teams/{team_id}")
def update_team(team_id: str, team_dto: TeamWriteDTO):
    team = Team.objects(id=team_id).first()
    if team:
        team.name = team_dto.name
        team.available_day_types = team_dto.available_day_types
        team.save()
        return {"team": mongo_to_pydantic(team, TeamReadDTO)}
    else:
        raise HTTPException(status_code=404, detail="Team not found")


@app.put("/teams/{team_id}/members/{team_member_id}")
def update_team_member(team_id: str, team_member_id: str, team_member_dto: TeamMemberWriteDTO):
    team = Team.objects(id=team_id).first()
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
    return {"team": mongo_to_pydantic(team, TeamReadDTO)}


@app.post("/teams/{team_id}/members/{team_member_id}/days")
def add_days(team_id: str, team_member_id: str, new_days: Dict[str, List[str]]):
    team: Team = Team.objects(id=team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    team_member: TeamMember = team.team_members.get(uid=team_member_id)
    if not team_member:
        raise HTTPException(status_code=404, detail="Team member not found")

    # Updating days field with new entries
    for date_str, day_type_ids in new_days.items():
        day_types = [DayType.objects(id=day_type_id).first() for day_type_id in day_type_ids]
        if date_str in team_member.days:
            # Add new day types to the existing list for this date
            team_member.days[date_str].extend(day_types)
        else:
            # Create a new entry for this date
            team_member.days[date_str] = day_types

    team.save()
    return {"team": mongo_to_pydantic(team, TeamReadDTO)}


@app.put("/teams/{team_id}/members/{team_member_id}/days")
def update_days(team_id: str, team_member_id: str, days: Dict[str, List[str]]):
    """Assume it is an update for only one day"""
    team: Team = Team.objects(id=team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    team_member: TeamMember = team.team_members.get(uid=team_member_id)
    if not team_member:
        raise HTTPException(status_code=404, detail="Team member not found")

    # Convert the day type IDs to DayType references
    updated_days = {}
    for date_str, day_type_ids in days.items():
        day_types = [DayType.objects(id=day_type_id).first() for day_type_id in day_type_ids]
        updated_days[date_str] = sorted(day_types, key=lambda day_type: day_type.name)

    team_member.days = team_member.days | updated_days
    team.save()
    return {"team": mongo_to_pydantic(team, TeamReadDTO)}


@app.get("/daytypes/")
def get_all_day_types():
    vacation = DayType.objects(name="Vacation").first()
    other_day_types = DayType.objects(name__ne="Vacation").order_by("name")
    # Ensure 'Vacation' is at the start if it exists
    day_types = [vacation] + list(other_day_types) if vacation else list(other_day_types)
    return {"day_types": [mongo_to_pydantic(day_type, DayTypeReadDTO) for day_type in day_types]}


@app.post("/daytypes/")
def create_day_type(day_type_dto: DayTypeWriteDTO):
    if not day_type_dto.color:
        day_type_dto.color = None
    day_type_data = day_type_dto.model_dump()
    DayType(**day_type_data).save()
    return {"day_types": [mongo_to_pydantic(day_type, DayTypeReadDTO) for day_type in DayType.objects.order_by("name")]}


@app.put("/daytypes/{day_type_id}")
def update_day_type(day_type_id: str, day_type_dto: DayTypeWriteDTO):
    day_type = DayType.objects(id=day_type_id).first()
    if not day_type:
        raise HTTPException(status_code=404, detail="DayType not found")

    day_type.name = day_type_dto.name
    day_type.color = day_type_dto.color
    day_type.save()
    return {"day_types": [mongo_to_pydantic(day_type, DayTypeReadDTO) for day_type in DayType.objects.order_by("name")]}


def flatten_list(list_of_lists):
    return [item for sublist in list_of_lists for item in sublist]


@app.delete("/daytypes/{day_type_id}")
def delete_day_type(day_type_id: str):
    # Check if DayType is used in any TeamMember's days or available_day_types, or in any Team's available_day_types
    if any(
            day_type_id in (str(day_types.id) for day_types in flatten_list(member.days.values()))
            for team in Team.objects
            for member in team.team_members
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="DayType is in use and cannot be deleted")

    # Proceed with deletion if DayType is not in use
    result = DayType.objects(id=day_type_id).delete()
    if result == 0:
        raise HTTPException(status_code=404, detail="DayType not found")

    return {"message": "DayType deleted successfully"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

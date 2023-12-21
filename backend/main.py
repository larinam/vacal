import datetime
from collections import defaultdict
from typing import List, Dict, Optional

import holidays
import pycountry
from fastapi import FastAPI, status, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from model import Team, TeamMember, get_unique_countries, DayType
from pydantic import BaseModel, Field, computed_field
from pydantic.functional_validators import field_validator
from fastapi.responses import RedirectResponse
import logging
import os

origins = [
    "http://localhost",
    "http://localhost:3000",
]

cors_origin = os.getenv("CORS_ORIGIN")  # should contain production domain of the frontend
if cors_origin:  # for production
    origins.append(cors_origin)

app = FastAPI()

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


class TeamMemberWriteDTO(BaseModel):
    name: str
    country: str
    email: Optional[str] = None
    phone: Optional[str] = None
    vac_days: List[datetime.date] = []

    @field_validator("country")
    @classmethod
    def validate_country(cls, value: str) -> str:
        if validate_country_name(value):
            return value
        raise ValueError("Invalid country name")


class TeamMemberReadDTO(TeamMemberWriteDTO):
    uid: str

    @computed_field
    @property
    def vacation_days_by_year(self) -> Dict[int, int]:
        vac_days_count = defaultdict(int)
        for day in self.vac_days:
            vac_days_count[day.year] += 1
        return dict(vac_days_count)


class TeamWriteDTO(BaseModel):
    name: str


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
            "holidays": get_holidays(year)}


@app.post("/teams/{team_id}/members/{team_member_id}/vac_days/")
def add_vac_days(team_id: str, team_member_id: str, vac_days: List[datetime.date]):
    team = Team.objects(id=team_id).first()
    team_member = team.team_members.get(uid=team_member_id)
    vac_days = set(vac_days)
    team_member.vac_days = list(set(team_member.vac_days) | vac_days)
    team.save()
    return {"team": mongo_to_pydantic(team, TeamReadDTO)}


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
    team = Team(name=team_dto.name).save()
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


@app.delete("/teams/{team_id}/members/{team_member_id}/vac_days/")
def delete_vac_days(team_id: str, team_member_id: str, vac_days: List[datetime.date]):
    team = Team.objects(id=team_id).first()
    team_member = team.team_members.get(uid=team_member_id)
    vac_days = set(vac_days)
    team_member.vac_days = list(set(team_member.vac_days) - vac_days)
    team.save()
    return {"team": mongo_to_pydantic(team, TeamReadDTO)}


@app.put("/teams/{team_id}")
def update_team(team_id: str, team_dto: TeamWriteDTO):
    team = Team.objects(id=team_id).first()
    if team:
        team.name = team_dto.name
        team.save()
        return {"team": mongo_to_pydantic(team, TeamReadDTO)}
    else:
        raise HTTPException(status_code=404, detail="Team not found")


@app.put("/teams/{team_id}/members/{team_member_id}")
def update_team_member(team_id: str, team_member_id: str, team_member_dto: TeamMemberWriteDTO):
    team = Team.objects(id=team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    team_member = team.team_members.get(uid=team_member_id)
    if not team_member:
        raise HTTPException(status_code=404, detail="Team member not found")

    team_member.name = team_member_dto.name
    team_member.country = team_member_dto.country
    team_member.email = team_member_dto.email if team_member_dto.email else None
    team_member.phone = team_member_dto.phone

    team.save()
    return {"team": mongo_to_pydantic(team, TeamReadDTO)}


@app.put("/teams/{team_id}/members/{team_member_id}/vac_days")
def update_vac_days(team_id: str, team_member_id: str, vac_days: List[datetime.date]):
    team: Team = Team.objects(id=team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    team_member: TeamMember = team.team_members.get(uid=team_member_id)
    if not team_member:
        raise HTTPException(status_code=404, detail="Team member not found")

    team_member.vac_days = vac_days
    team.save()
    return {"team": mongo_to_pydantic(team, TeamReadDTO)}


@app.post("/daytypes/")
def create_day_type(day_type_dto: DayTypeWriteDTO):
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


@app.delete("/daytypes/{day_type_id}")
def delete_day_type(day_type_id: str):
    result = DayType.objects(id=day_type_id).delete()
    if result == 0:
        raise HTTPException(status_code=404, detail="DayType not found")
    return {"message": "DayType deleted successfully"}

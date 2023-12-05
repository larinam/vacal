import datetime
from typing import Union, List

import holidays
import pycountry
from fastapi import FastAPI, status, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from model import Team, TeamMember, get_unique_countries
from pydantic import BaseModel, Field
from pydantic.functional_validators import field_validator
from fastapi.responses import RedirectResponse
import logging

origins = [
    "http://localhost",
    "http://localhost:8080",
    "http://localhost:3000",
]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

log = logging.getLogger(__name__)


class TeamMemberWriteDTO(BaseModel):
    name: str
    country: str
    vac_days: List[datetime.datetime]

    @field_validator("country")
    @classmethod
    def validate_country(cls, value: str) -> str:
        if validate_country_name(value):
            return value
        raise ValueError("Invalid country name")


class TeamMemberReadDTO(TeamMemberWriteDTO):
    uid: str


class TeamReadDTO(BaseModel):
    id: str = Field(None, alias='_id')
    name: str
    team_members: List[TeamMemberReadDTO]


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
    list(map(lambda x: holidays_dict.update({x: holidays.country_holidays(x, years=[year-1, year, year+1])}), countries))
    return holidays_dict


@app.get("/")
def read_root(year: int = datetime.datetime.now().year):
    return {"teams": list(map(lambda x: mongo_to_pydantic(x, TeamReadDTO), Team.objects.order_by("name"))),
            "holidays": get_holidays(year)}


def clean_time_from_datetime(dt: datetime.datetime):
    return datetime.datetime(dt.year, dt.month, dt.day).date()


@app.post("/teams/{team_id}/members/{team_member_id}/vac_days/")
def add_vac_days(team_id: str, team_member_id: str, vac_days: List[datetime.datetime]):
    team = Team.objects(id=team_id).first()
    team_member = team.team_members.get(uid=team_member_id)
    vac_days = set(map(clean_time_from_datetime, vac_days))
    team_member.vac_days = list(set(team_member.vac_days) | vac_days)
    team.save()
    return {"team": mongo_to_pydantic(team, TeamReadDTO)}


@app.post("/teams/{team_id}/members/")
def add_team_member(team_id: str, team_member: TeamMemberWriteDTO):
    team_member = TeamMember(
        name=team_member.name,
        country=team_member.country,
        vac_days=team_member.vac_days
    )
    team = Team.objects(id=team_id).first()
    team.team_members.append(team_member)
    team.save()
    return {"team": mongo_to_pydantic(team, TeamReadDTO)}


@app.post("/teams/")
def add_team(team_name: str):
    team = Team(name=team_name).save()
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
def delete_vac_days(team_id: str, team_member_id: str, vac_days: List[datetime.datetime]):
    team = Team.objects(id=team_id).first()
    team_member = team.team_members.get(uid=team_member_id)
    vac_days = set(map(clean_time_from_datetime, vac_days))
    team_member.vac_days = list(set(team_member.vac_days) - vac_days)
    team.save()
    return {"team": mongo_to_pydantic(team, TeamReadDTO)}


@app.put("/teams/{team_id}")
def update_team(team_id: str, team_name: str):
    team = Team.objects(id=team_id).first()
    if team:
        team.name = team_name
        team.save()
        return {"team": mongo_to_pydantic(team, TeamReadDTO)}
    else:
        raise HTTPException(status_code=404, detail="Team not found")


@app.put("/teams/{team_id}/members/{team_member_id}")
def update_team_member(team_id: str, team_member_id: str, name: str, country: str):
    team = Team.objects(id=team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    team_member = team.team_members.get(uid=team_member_id)
    if not team_member:
        raise HTTPException(status_code=404, detail="Team member not found")

    team_member.name = name
    team_member.country = country

    team.save()
    return {"team": mongo_to_pydantic(team, TeamReadDTO)}


@app.put("/teams/{team_id}/members/{team_member_id}/vac_days")
def update_vac_days(team_id: str, team_member_id: str, vac_days: List[datetime.datetime]):
    team = Team.objects(id=team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    team_member = team.team_members.get(uid=team_member_id)
    if not team_member:
        raise HTTPException(status_code=404, detail="Team member not found")

    team_member.vac_days = list(map(clean_time_from_datetime, vac_days))
    team.save()
    return {"team": mongo_to_pydantic(team, TeamReadDTO)}

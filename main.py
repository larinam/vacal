import datetime
from typing import Union, List

import holidays
from fastapi import FastAPI, status

from model import Team, TeamMember, get_unique_countries
from pydantic import BaseModel, Field
from fastapi.responses import RedirectResponse
import logging

app = FastAPI()

log = logging.getLogger(__name__)


class TeamMemberWriteDTO(BaseModel):
    name: str
    country: str
    vac_days: List[datetime.datetime]


class TeamMemberReadDTO(TeamMemberWriteDTO):
    uid: str


class TeamDTO(BaseModel):
    id: str = Field(None, alias='_id')
    name: str
    team_members: List[TeamMemberReadDTO]


def mongo_to_pydantic(mongo_document, pydantic_model):
    # Convert MongoEngine Document to a dictionary
    document_dict = mongo_document.to_mongo().to_dict()
    if '_id' in document_dict:
        document_dict['_id'] = str(document_dict['_id'])
    # Create a Pydantic model instance from the dictionary
    return pydantic_model(**document_dict)


def get_holidays_and_weekends(year: int = datetime.datetime.now().year):
    countries = get_unique_countries()
    holidays_dict = {}
    list(map(lambda x: holidays_dict.update({x: holidays.country_holidays(x, years=year)}), countries))
    return holidays_dict


@app.get("/")
def read_root():
    return {"teams": str(list(map(lambda x: mongo_to_pydantic(x, TeamDTO), Team.objects.order_by("name")))),
            "holidays": get_holidays_and_weekends()}


@app.get("/items/{item_id}")
def read_item(item_id: int, q: Union[str, None] = None):
    return {"item_id": item_id, "q": q}


def clean_time_from_datetime(dt: datetime.datetime):
    return datetime.datetime(dt.year, dt.month, dt.day).date()


@app.post("/teams/{team_id}/members/{team_member_id}/vac_days/")
def add_vac_days(team_id: str, team_member_id: str, vac_days: List[datetime.datetime]):
    team = Team.objects(id=team_id).first()
    team_member = team.team_members.get(uid=team_member_id)
    vac_days = set(map(clean_time_from_datetime, vac_days))
    team_member.vac_days = list(set(team_member.vac_days) | vac_days)
    team.save()
    return {"team": str(mongo_to_pydantic(team, TeamDTO))}


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
    return {"team": str(mongo_to_pydantic(team, TeamDTO))}


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
    return {"team": str(mongo_to_pydantic(team, TeamDTO))}

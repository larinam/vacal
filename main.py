import datetime
from typing import Union, List

from fastapi import FastAPI

from model import Team, TeamMember
from pydantic import BaseModel

app = FastAPI()


class TeamMemberDTO(BaseModel):
    name: str
    country: str
    vac_days: List[datetime.datetime]


@app.get("/")
def read_root():
    return {"Hello": "World",
            "teams": str(Team.objects.order_by("name"))}


@app.get("/items/{item_id}")
def read_item(item_id: int, q: Union[str, None] = None):
    return {"item_id": item_id, "q": q}


@app.post("/teams/vac_days/")
def add_vac_days(team_id: str, team_member_id: str, vac_days: List[datetime.datetime]):
    team = Team.objects(id=team_id).first()
    team_member = team.team_members.get(id=team_member_id)
    for vac_day in vac_days:
        team_member.update_one(add_to_set__vac_days=vac_day)
    team.reload()
    return {"team": team}


@app.post("/teams/members/")
def add_team_member(team_id: str, team_member: TeamMemberDTO):
    team_member = TeamMember(
        name=team_member.name,
        country=team_member.country,
        vac_days=[]
    )
    team = Team.objects(id=team_id).first()
    team.team_members.append(team_member)
    team.save()
    return {"team": team}


@app.post("/teams/")
def add_team(team_name: str):
    team = Team(name=team_name).save()
    return {"team_id": str(team.id)}

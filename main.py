from typing import Union

import dotenv
from fastapi import FastAPI

from model import Team, User

dotenv.load_dotenv()

app = FastAPI()


@app.get("/")
def read_root():
    return {"Hello": "World",
            "teams": Team.objects.find().sort("name")}


@app.get("/items/{item_id}")
def read_item(item_id: int, q: Union[str, None] = None):
    return {"item_id": item_id, "q": q}


@app.post("/teams/")
def add_team(team_name: str):
    return {"team_name": team_name}


@app.post("/teams/")
def add_team(team_name: str):
    team = Team(name=team_name).save()
    return {"team_id": team.id}

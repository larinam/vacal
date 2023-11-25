from bson import ObjectId
from mongoengine import StringField, DateField, ListField, connect, Document, EmbeddedDocument, \
    EmbeddedDocumentListField, ObjectIdField

import dotenv
import os
import logging

log = logging.getLogger(__name__)

# in production the environments should be set and no need to load from .env
if not os.getenv("MONGO_USERNAME"):
    dotenv.load_dotenv()  # mostly for local development with docker-compose

mongo_username = os.getenv("MONGO_USERNAME")
mongo_password = os.getenv("MONGO_PASSWORD")
mongo_host = os.getenv("MONGO_HOST")
mongo_port = os.getenv("MONGO_PORT")
mongo_db_name = os.getenv("MONGO_DB_NAME")

if mongo_username:  # connect to some external MongoDB
    mongo_connection_string = f"mongodb://{mongo_username}:{mongo_password}@{mongo_host}:{mongo_port}/{mongo_db_name}"
    log.info(f"MongoDB connection string: {mongo_connection_string}")
    connect("vacal", host=mongo_connection_string)
else:  # just local MongoDB
    log.info("Connecting to local MongoDB")
    connect("vacal")


class TeamMember(EmbeddedDocument):
    id = ObjectIdField(required=True, default=ObjectId, unique=True, primary_key=True)
    name = StringField(required=True)
    country = StringField(required=True)  # country name from pycountry
    vac_days = ListField(DateField(required=True))


class Team(Document):
    name = StringField(required=True)
    team_members = EmbeddedDocumentListField(TeamMember)

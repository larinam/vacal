from bson import ObjectId
from mongoengine import StringField, DateField, ListField, connect, Document, EmbeddedDocument, \
    EmbeddedDocumentListField, ObjectIdField

from pymongo import MongoClient

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
    if os.getenv("MONGO_INITDB_ROOT_USERNAME") and os.getenv("MONGO_INITDB_ROOT_PASSWORD"):
        log.info("Initiating MongoDB user")
        admin_db_uri = f"mongodb://{os.getenv("MONGO_INITDB_ROOT_USERNAME")}:{os.getenv("MONGO_INITDB_ROOT_PASSWORD")}@{mongo_host}:{mongo_port}/admin"
        with (MongoClient(admin_db_uri) as client):
            admin_db = client['admin']
            existing_user = admin_db.system.users.find_one({"user": mongo_username})
            if not existing_user:
                user_command = {
                    "createUser": mongo_username,
                    "pwd": mongo_password,
                    "roles": [
                        {
                            "role": "readWrite",
                            "db": mongo_db_name
                        }
                    ]
                }
                admin_db.command(user_command)
                log.info("MongoDB user created")
            else:
                log.info("MongoDB user already exists")
    mongo_connection_string = f"mongodb://{mongo_username}:{mongo_password}@{mongo_host}:{mongo_port}/"
    log.info(f"MongoDB connection string: {mongo_connection_string}")
    connect(mongo_db_name, host=mongo_connection_string)
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

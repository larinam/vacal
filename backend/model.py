import uuid
import random

from mongoengine import StringField, DateField, ListField, connect, Document, EmbeddedDocument, \
    EmbeddedDocumentListField, UUIDField, EmailField, ReferenceField, MapField

from pymongo import MongoClient

from dotenv import load_dotenv
import os
import logging
from mongodb_migration_engine import run_migrations

log = logging.getLogger(__name__)

# in production the environments should be set and not loaded from .env
load_dotenv()  # mostly for local development with docker-compose

mongo_username = os.getenv("MONGO_USERNAME")
mongo_password = os.getenv("MONGO_PASSWORD")
mongo_host = os.getenv("MONGO_HOST")
mongo_port = os.getenv("MONGO_PORT")
mongo_db_name = os.getenv("MONGO_DB_NAME")

if mongo_username:  # connect to some external MongoDB
    if os.getenv("MONGO_INITDB_ROOT_USERNAME") and os.getenv("MONGO_INITDB_ROOT_PASSWORD"):
        log.info("Initiating MongoDB user")
        admin_db_uri = f"mongodb://{os.getenv('MONGO_INITDB_ROOT_USERNAME')}:{os.getenv('MONGO_INITDB_ROOT_PASSWORD')}@{mongo_host}:{mongo_port}/admin"
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
    connect(mongo_db_name, host=mongo_connection_string)
else:  # just local MongoDB
    log.info("Connecting to local MongoDB")
    connect("vacal")


def generate_random_hex_color():
    """Generate a random hex color code."""
    return "#{:06x}".format(random.randint(0, 0xFFFFFF))


class DayType(Document):
    name = StringField(required=True)
    color = StringField(default=generate_random_hex_color)


class TeamMember(EmbeddedDocument):
    uid = UUIDField(binary=False, default=uuid.uuid4, unique=True, sparse=True)
    name = StringField(required=True)
    country = StringField(required=True)  # country name from pycountry
    email = EmailField()
    phone = StringField()
    vac_days = ListField(DateField(required=True))
    # {date_str1:[day_type1, day_type2, day_type3, ..., day_typeN, date_str2:[day_type3, ...]]
    days = MapField(ListField(ReferenceField(DayType)))
    available_day_types = ListField(ReferenceField(DayType))


class Team(Document):
    name = StringField(required=True)
    team_members = EmbeddedDocumentListField(TeamMember)
    available_day_types = ListField(ReferenceField(DayType))


def get_unique_countries():
    unique_countries = set()
    for team in Team.objects:
        for member in team.team_members:
            unique_countries.add(member.country)
    return list(unique_countries)


def initialize_database():
    if DayType.objects.count() == 0:
        initial_day_types = [
            DayType(name='Vacation', color="#48BF91"),
        ]
        DayType.objects.insert(initial_day_types, load_bulk=False)


run_migrations()
initialize_database()

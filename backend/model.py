import logging
import os
import random
import uuid

from dotenv import load_dotenv
from mongoengine import StringField, ListField, connect, Document, EmbeddedDocument, \
    EmbeddedDocumentListField, UUIDField, EmailField, ReferenceField, MapField, EmbeddedDocumentField, BooleanField, \
    LongField
from passlib.context import CryptContext
from pymongo import MongoClient

from .mongodb_migration_engine import run_migrations

log = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

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


class Tenant(Document):
    name = StringField(required=True, unique=True, default="Company")
    identifier = StringField(required=True, unique=True, default="main")

    meta = {
        "indexes": [
            "identifier",
        ],
        "index_background": True
    }


def generate_random_hex_color():
    """Generate a random hex color code."""
    return "#{:06x}".format(random.randint(0, 0xFFFFFF))


class DayType(Document):
    tenant = ReferenceField(Tenant, required=True)
    name = StringField(required=True)
    color = StringField(default=generate_random_hex_color)

    meta = {
        "indexes": [
            "tenant",
        ],
        "index_background": True
    }


class TeamMember(EmbeddedDocument):
    uid = UUIDField(binary=False, default=uuid.uuid4, unique=True, sparse=True)
    name = StringField(required=True)
    country = StringField(required=True)  # country name from pycountry
    email = EmailField()
    phone = StringField()
    # {date_str1:[day_type1, day_type2, day_type3, ..., day_typeN, date_str2:[day_type3, ...]]
    days = MapField(ListField(ReferenceField(DayType)))
    available_day_types = ListField(ReferenceField(DayType))


class Team(Document):
    tenant = ReferenceField(Tenant, required=True)
    name = StringField(required=True)
    team_members = EmbeddedDocumentListField(TeamMember)
    available_day_types = ListField(ReferenceField(DayType))

    meta = {
        "indexes": [
            "tenant",
        ],
        "index_background": True
    }


class AuthDetails(EmbeddedDocument):
    # Stores various authentication details
    telegram_id = LongField(unique=True, required=False, sparse=True)
    telegram_username = StringField(unique=True, required=False, sparse=True)
    # Fields for username/password authentication
    username = StringField(unique=True, required=True, sparse=True)
    hashed_password = StringField(required=False)


class User(Document):
    tenants = ListField(ReferenceField(Tenant, required=True))
    name = StringField(required=True)
    email = EmailField(unique=True, required=False, sparse=True, default=None)
    auth_details = EmbeddedDocumentField(AuthDetails)
    disabled = BooleanField(default=False)

    meta = {
        "indexes": [
            "email",
            "auth_details.telegram_id",
            "auth_details.telegram_username",
            "auth_details.username",
            "tenants"
        ],
        "index_background": True
    }

    @classmethod
    def get_by_username(cls, username: str):
        user = cls.objects(auth_details__username=username).first()
        return user

    def hash_password(self, plain_password):
        self.auth_details.hashed_password = pwd_context.hash(plain_password)

    def verify_password(self, plain_password):
        return pwd_context.verify(plain_password, self.auth_details.hashed_password)

    @classmethod
    def authenticate_user(cls, username: str, password: str):
        user = cls.get_by_username(username)
        if not user or not user.verify_password(password):
            return False
        return user

    @classmethod
    def get_by_telegram_username(cls, username):
        user = cls.objects(auth_details__telegram_username=username).first()
        return user


def get_unique_countries(tenant):
    unique_countries = set()
    for team in Team.objects(tenant=tenant):
        for member in team.team_members:
            unique_countries.add(member.country)
    return list(unique_countries)


def init_vacation_day_type(tenant):
    if DayType.objects(tenant=tenant).count() == 0:
        initial_day_types = [
            DayType(tenant=tenant, name='Vacation', color="#48BF91"),
        ]
        DayType.objects.insert(initial_day_types, load_bulk=False)


def initialize_database():
    if Tenant.objects().count() == 0:
        Tenant().save()
    for tenant in Tenant.objects:
        init_vacation_day_type(tenant)


def get_team_id_and_member_uid_by_email(tenant, email):
    for team in Team.objects(tenant=tenant):
        for member in team.team_members:
            if member.email == email:
                return str(team.id), str(member.uid)
    return None, None


def get_vacation_day_type_id(tenant):
    return str(DayType.objects(tenant=tenant, name='Vacation').first().id)


run_migrations()
initialize_database()

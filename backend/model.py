import logging
import os
import random
import uuid

import mongoengine
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
mongo_uri = os.getenv("MONGO_URI")

if mongo_uri:
    if mongo_uri.startswith('"') and mongo_uri.endswith('"'):
        mongo_uri = mongo_uri.strip('"')
    connect(mongo_db_name, host=mongo_uri)
elif mongo_username:  # connect to some external MongoDB
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
    name = StringField(required=True, unique=True)
    identifier = StringField(required=True, unique=True)

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
    tenant = ReferenceField(Tenant, required=True, reverse_delete_rule=mongoengine.CASCADE)
    name = StringField(required=True, unique_with="tenant")
    identifier = StringField(required=True, unique_with="tenant")
    color = StringField(default=generate_random_hex_color)

    meta = {
        "indexes": [
            ("tenant", "identifier")
        ],
        "index_background": True
    }

    SYSTEM_DAY_TYPE_IDENTIFIERS = ['vacation', 'compensatory_leave', 'override', 'birthday']

    @classmethod
    def init_day_types(cls, tenant):
        if cls.objects(tenant=tenant).count() == 0:
            initial_day_types = [
                cls(tenant=tenant, name='Vacation', identifier='vacation', color="#FF6666"),
                cls(tenant=tenant, name='Compensatory leave', identifier='compensatory_leave', color="#CC99FF"),
                cls(tenant=tenant, name='Holiday override', identifier='override', color="#EEEEEE"),
                cls(tenant=tenant, name='Birthday', identifier='birthday', color="#FFC0CB"),
            ]
            cls.objects.insert(initial_day_types, load_bulk=False)

    @classmethod
    def get_vacation_day_type_id(cls, tenant):
        return str(cls.objects(tenant=tenant, identifier='vacation').first().id)

    @classmethod
    def get_birthday_day_type_id(cls, tenant):
        return str(cls.objects(tenant=tenant, identifier='birthday').first().id)


class TeamMember(EmbeddedDocument):
    uid = UUIDField(binary=False, default=uuid.uuid4, unique=True, sparse=True)
    name = StringField(required=True)
    country = StringField(required=True)  # country name from pycountry
    email = EmailField()
    phone = StringField()
    # {date_str1:[day_type1, day_type2, day_type3, ..., day_typeN, date_str2:[day_type3, ...]]
    days = MapField(ListField(ReferenceField(DayType)))
    available_day_types = ListField(ReferenceField(DayType))
    birthday = StringField(regex='^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$')  # only MM-DD


class Team(Document):
    tenant = ReferenceField(Tenant, required=True, reverse_delete_rule=mongoengine.CASCADE)
    name = StringField(required=True, unique_with="tenant")
    team_members = EmbeddedDocumentListField(TeamMember)
    subscriber_emails = ListField(EmailField())
    available_day_types = ListField(ReferenceField(DayType))

    meta = {
        "indexes": [
            "tenant",
        ],
        "index_background": True
    }

    @classmethod
    def init_team(cls, tenant, team_member):
        if cls.objects(tenant=tenant).count() == 0:
            initial_teams = [
                cls(tenant=tenant, name='My Team', team_members=[team_member]),
            ]
            cls.objects.insert(initial_teams, load_bulk=False)


class AuthDetails(EmbeddedDocument):
    # Stores various authentication details
    telegram_id = LongField(unique=True, sparse=True)
    telegram_username = StringField(unique=True, required=False, sparse=True)
    # Fields for username/password authentication
    username = StringField(unique=True, required=True, sparse=True)
    hashed_password = StringField(required=False)


class User(Document):
    tenants = ListField(ReferenceField(Tenant, required=True, reverse_delete_rule=mongoengine.PULL))
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

    def __str__(self):
        tenant_names = ', '.join(tenant.name for tenant in self.tenants)
        return f"User(name='{self.name}', email='{self.email}', tenants=[{tenant_names}], disabled={self.disabled})"

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

    def remove_tenant(self, tenant):
        if len(self.tenants) <= 1:
            raise RuntimeError("The last tenant can't be removed from the user. User should have at least one attached "
                               "tenant.")
        self.tenants.remove(tenant)
        self.save()


def get_unique_countries(tenant):
    unique_countries = set()
    for team in Team.objects(tenant=tenant):
        for member in team.team_members:
            unique_countries.add(member.country)
    return list(unique_countries)


def get_team_id_and_member_uid_by_email(tenant, email):
    for team in Team.objects(tenant=tenant):
        for member in team.team_members:
            if member.email == email:
                return str(team.id), str(member.uid)
    return None, None


run_migrations()

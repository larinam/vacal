import logging
import os
import random
import secrets
import uuid
from datetime import datetime, timezone, timedelta

import mongoengine
import mongomock
from dateutil.relativedelta import relativedelta
from dotenv import load_dotenv
from mongoengine import StringField, ListField, connect, Document, EmbeddedDocument, \
    EmbeddedDocumentListField, UUIDField, EmailField, ReferenceField, MapField, EmbeddedDocumentField, BooleanField, \
    LongField, DateTimeField, IntField, DateField, DecimalField
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from pwdlib.hashers.bcrypt import BcryptHasher
from pymongo import MongoClient
import pyotp

from .mongodb_migration_engine import run_migrations

log = logging.getLogger(__name__)

# Configure password hashing to use Argon2 for new hashes while
# still accepting existing bcrypt hashes for verification.
pwd_context = PasswordHash((Argon2Hasher(), BcryptHasher()))

# in production the environments should be set and not loaded from .env
load_dotenv()  # mostly for local development with docker-compose

mongo_username = os.getenv("MONGO_USERNAME")
mongo_password = os.getenv("MONGO_PASSWORD")
mongo_host = os.getenv("MONGO_HOST")
mongo_port = os.getenv("MONGO_PORT")
mongo_db_name = os.getenv("MONGO_DB_NAME")
mongo_uri = os.getenv("MONGO_URI")
use_mock_env = os.getenv("MONGO_MOCK")
use_mock = str(use_mock_env).lower() in ("1", "true", "yes")

if use_mock:
    log.info("Using mongomock for MongoDB connection")
    connect(
        mongo_db_name or "vacal",
        mongo_client_class=mongomock.MongoClient,
        uuidRepresentation="standard",
    )
elif mongo_uri:
    if mongo_uri.startswith('"') and mongo_uri.endswith('"'):
        mongo_uri = mongo_uri.strip('"')
    connect(mongo_db_name, host=mongo_uri, uuidRepresentation="standard")
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
    connect(mongo_db_name, host=mongo_connection_string, uuidRepresentation="standard")
else:  # just local MongoDB
    log.info("Connecting to local MongoDB")
    connect("vacal", uuidRepresentation="standard")


def add_a_month(source_date):
    return source_date + relativedelta(months=1)


class Tenant(Document):
    name = StringField(required=True, unique=True)
    identifier = StringField(required=True, unique=True)
    creation_date = DateTimeField(required=True, default=lambda: datetime.now(timezone.utc))
    status = StringField(required=True, choices=['trial', 'active', 'blocked', 'free'], default='trial')
    trial_until = DateTimeField(required=True, default=lambda: add_a_month(datetime.now(timezone.utc)))
    current_period = DateTimeField(required=True, default=lambda: datetime.now(timezone.utc))
    max_team_members_in_periods = MapField(IntField())

    meta = {
        "indexes": [
            "identifier",
        ],
        "index_background": True
    }

    def is_active(self):
        return os.getenv("MULTITENANCY_ENABLED", False) and self.status == 'active'

    def activate_trial(self):
        self.trial_until = self.trial_until.replace(tzinfo=timezone.utc)
        if self.is_trial() and datetime.now(timezone.utc) > self.trial_until:
            self.status = 'active'
            self.save()

    def is_blocked(self):
        return os.getenv("MULTITENANCY_ENABLED", False) and self.status == 'blocked'

    def block(self):
        self.status = 'blocked'
        self.save()

    def is_trial(self):
        return os.getenv("MULTITENANCY_ENABLED", False) and self.status == 'trial'

    def reset_trial(self):
        self.status = 'trial'
        self.trial_until = add_a_month(datetime.now(timezone.utc))
        self.save()

    def is_free(self):
        return ((os.getenv("MULTITENANCY_ENABLED", False) and self.status == 'free') or
                os.getenv("MULTITENANCY_ENABLED", False) is False)

    def set_free(self):
        self.status = 'free'
        self.save()

    def update_max_team_members_in_the_period(self):
        now = datetime.now(timezone.utc)
        self.current_period = self.current_period.replace(tzinfo=timezone.utc)
        # Check if the current period needs to be updated
        if now >= add_a_month(self.current_period):
            self.current_period = add_a_month(self.current_period)

        current_period_str = self.current_period.isoformat()

        current_team_member_count = calculate_team_members_number_in_tenant(self)

        existing_max = self.max_team_members_in_periods.get(current_period_str, 0)

        if current_team_member_count > existing_max:
            self.max_team_members_in_periods.update({current_period_str: current_team_member_count})
            self.save()


class AuthDetails(EmbeddedDocument):
    # Stores various authentication details
    telegram_id = LongField(unique=True, sparse=True)
    telegram_username = StringField(unique=True, required=False, sparse=True)
    # Fields for Google authentication
    google_id = StringField(unique=True, required=False, sparse=True)
    google_email = EmailField(unique=True, required=False, sparse=True)
    google_refresh_token = StringField(required=False)
    # Fields for username/password authentication
    username = StringField(unique=True, required=True, sparse=True)
    hashed_password = StringField(required=False)
    # Unique token used for accessing calendar feeds
    api_key = StringField(unique=True, default=lambda: secrets.token_urlsafe(16))
    # Secret for Time-based One-Time Password (TOTP) MFA
    mfa_secret = StringField(required=True, default=lambda: pyotp.random_base32())
    # Indicates whether the user has scanned the MFA secret and provided a valid
    # one-time code at least once
    mfa_confirmed = BooleanField(default=False)


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
            "tenants",
            "auth_details.api_key",
            "auth_details.google_id",
            "auth_details.google_email"
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

    @classmethod
    def get_by_google_id(cls, google_id: str):
        user = cls.objects(auth_details__google_id=google_id).first()
        return user

    @classmethod
    def get_by_telegram_id(cls, telegram_id: int):
        user = cls.objects(auth_details__telegram_id=telegram_id).first()
        return user

    def hash_password(self, plain_password):
        self.auth_details.hashed_password = pwd_context.hash(plain_password)

    def verify_password(self, plain_password):
        return pwd_context.verify(plain_password, self.auth_details.hashed_password)

    def generate_mfa_secret(self):
        secret = pyotp.random_base32()
        self.auth_details.mfa_secret = secret
        self.save()
        return secret

    def get_mfa_uri(self):
        """Return provisioning URI for TOTP apps."""
        return pyotp.totp.TOTP(self.auth_details.mfa_secret).provisioning_uri(
            name=self.auth_details.username,
            issuer_name="Vacal"
        )

    def verify_mfa_code(self, otp: str) -> bool:
        totp = pyotp.TOTP(self.auth_details.mfa_secret)
        return totp.verify(otp)

    @classmethod
    def authenticate_user(cls, username: str, password: str):
        user = cls.get_by_username(username)
        if not user or not user.verify_password(password):
            return False
        return user

    @classmethod
    def get_by_telegram_username(cls, username):
        user = cls.objects(auth_details__telegram_username__iexact=username).first()
        return user

    def remove_tenant(self, tenant):
        if len(self.tenants) <= 1:
            raise RuntimeError("The last tenant can't be removed from the user. User should have at least one attached "
                               "tenant.")
        self.tenants.remove(tenant)
        self.save()


class UserInvite(Document):
    email = EmailField(required=True)
    inviter = ReferenceField(User, required=False, reverse_delete_rule=mongoengine.NULLIFY)
    tenant = ReferenceField(Tenant, required=True, unique_with="email", reverse_delete_rule=mongoengine.CASCADE)
    token = StringField(required=True, unique=True)
    status = StringField(choices=["pending", "accepted", "expired"], default="pending")
    expiration_date = DateTimeField(default=lambda: datetime.now(timezone.utc) + timedelta(days=7))

    meta = {
        "indexes": [
            "email",
            "token",
            "status",
        ],
        "index_background": True
    }

    def is_expired(self):
        self.expiration_date = self.expiration_date.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) > self.expiration_date

    def mark_as_accepted(self):
        self.status = "accepted"
        self.save()

    def mark_as_expired(self):
        self.status = "expired"
        self.save()


class PasswordResetToken(Document):
    user = ReferenceField(User, required=True, reverse_delete_rule=mongoengine.CASCADE)
    token = StringField(required=True, unique=True)
    status = StringField(choices=["pending", "used", "expired"], default="pending")
    expiration_date = DateTimeField(default=lambda: datetime.now(timezone.utc) + timedelta(hours=1))

    meta = {
        "indexes": [
            "user",
            "token",
            "status",
        ],
        "index_background": True
    }

    def is_expired(self):
        self.expiration_date = self.expiration_date.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) > self.expiration_date

    def mark_as_used(self):
        self.status = "used"
        self.save()


def generate_random_hex_color():
    """Generate a random hex color code."""
    return "#{:06x}".format(random.randint(0, 0xFFFFFF))


class DayType(Document):
    tenant = ReferenceField(Tenant, required=True, reverse_delete_rule=mongoengine.CASCADE)
    name = StringField(required=True, unique_with="tenant")
    identifier = StringField(required=True, unique_with="tenant")
    color = StringField(default=generate_random_hex_color)
    is_absence = BooleanField(default=False)

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
                cls(tenant=tenant, name='Vacation', identifier='vacation', color="#FF6666", is_absence=True),
                cls(tenant=tenant, name='Compensatory leave', identifier='compensatory_leave', color="#CC99FF", is_absence=True),
                cls(tenant=tenant, name='Holiday override', identifier='override', color="#EEEEEE", is_absence=False),
                cls(tenant=tenant, name='Birthday', identifier='birthday', color="#FFC0CB", is_absence=False),
            ]
            cls.objects.insert(initial_day_types, load_bulk=False)

    @classmethod
    def get_vacation_day_type_id(cls, tenant):
        return str(cls.objects(tenant=tenant, identifier='vacation').first().id)

    @classmethod
    def get_birthday_day_type_id(cls, tenant):
        return str(cls.objects(tenant=tenant, identifier='birthday').first().id)


class DayEntry(EmbeddedDocument):
    day_types = ListField(ReferenceField(DayType))
    comment = StringField()


class TeamMember(EmbeddedDocument):
    uid = UUIDField(binary=False, default=uuid.uuid4, unique=True, sparse=True)
    name = StringField(required=True)
    country = StringField(required=True)  # country name from pycountry
    email = EmailField()
    phone = StringField()
    days = MapField(EmbeddedDocumentField(DayEntry))
    available_day_types = ListField(ReferenceField(DayType))
    birthday = StringField(regex='^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$')  # only MM-DD
    employee_start_date = DateField()
    yearly_vacation_days = DecimalField()


class Team(Document):
    tenant = ReferenceField(Tenant, required=True, reverse_delete_rule=mongoengine.CASCADE)
    name = StringField(required=True, unique_with="tenant")
    team_members = EmbeddedDocumentListField(TeamMember)
    available_day_types = ListField(ReferenceField(DayType))
    subscribers = ListField(ReferenceField(User, reverse_delete_rule=mongoengine.PULL))

    meta = {
        "indexes": [
            "tenant",
            ("tenant", "team_members.email"),
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


def get_unique_countries(tenant):
    pipeline = [
        {"$match": {"tenant": tenant.id}},
        {"$unwind": "$team_members"},
        {"$group": {"_id": None, "countries": {"$addToSet": "$team_members.country"}}},
    ]
    result = list(Team.objects.aggregate(pipeline))
    return result[0]["countries"] if result else []


class DayAudit(Document):
    tenant = ReferenceField(Tenant, required=True, reverse_delete_rule=mongoengine.CASCADE)
    team = ReferenceField(Team, required=True, reverse_delete_rule=mongoengine.CASCADE)
    member_uid = StringField(required=True)
    date = DateField(required=True)
    user = ReferenceField(User, required=True, reverse_delete_rule=mongoengine.NULLIFY)
    timestamp = DateTimeField(required=True, default=lambda: datetime.now(timezone.utc))
    old_day_types = ListField(ReferenceField(DayType))
    old_comment = StringField(default='')
    new_day_types = ListField(ReferenceField(DayType))
    new_comment = StringField(default='')
    action = StringField(required=True, choices=['created', 'updated', 'deleted'])

    meta = {
        "indexes": [
            ("tenant", "team", "member_uid", "date"),
        ],
        "index_background": True,
    }


def get_team_id_and_member_uid_by_email(tenant, email):
    team = Team.objects(tenant=tenant, team_members__email=email).only(
        "id", "team_members__email", "team_members__uid"
    ).first()
    if not team:
        return None, None
    for member in team.team_members:
        if member.email == email:
            return str(team.id), str(member.uid)
    return None, None


def calculate_team_members_number_in_tenant(tenant):
    team_member_count = 0
    for team in Team.objects(tenant=tenant):
        team_member_count += len(team.team_members)
    return team_member_count


if not use_mock:
    run_migrations()

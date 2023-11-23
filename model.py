from mongoengine import StringField, DateField, ListField, connect, Document, EmbeddedDocument, \
    EmbeddedDocumentListField

import dotenv
import os
import logging

env_vars_loaded = dotenv.load_dotenv()

log = logging.getLogger(__name__)

mongo_username = os.getenv("MONGO_USERNAME")
mongo_password = os.getenv("MONGO_PASSWORD")
mongo_host = os.getenv("MONGO_HOST")
mongo_port = os.getenv("MONGO_PORT")
mongo_db_name = os.getenv("MONGO_DB_NAME")

print(1)
if mongo_username:
    print(2)
    mongo_connection_string = f"mongodb://{mongo_username}:{mongo_password}@{mongo_host}:{mongo_port}/{mongo_db_name}"
    connect("vacal", host=mongo_connection_string)
    log.info(f"MongoDB connection string: {mongo_connection_string}")
else:
    print(3)
    connect("vacal")


class User(EmbeddedDocument):
    name = StringField(required=True)
    country = StringField(required=True)  # country name from pycountry
    vac_days = ListField(DateField(required=True))


class Team(Document):
    name = StringField(required=True)
    team_members = EmbeddedDocumentListField(User)

import os

from dotenv import load_dotenv
from pymongo import MongoClient
import mongomock

# in production the environments should be set and not loaded from .env
load_dotenv()  # mostly for local development with docker-compose

mongo_username = os.getenv("MONGO_USERNAME")
mongo_password = os.getenv("MONGO_PASSWORD")
mongo_host = os.getenv("MONGO_HOST")
mongo_port = os.getenv("MONGO_PORT")
mongo_db_name = os.getenv("MONGO_DB_NAME", "vacal")
mongo_uri = os.getenv("MONGO_URI")
use_mock_env = os.getenv("MONGO_MOCK")
use_mock = str(use_mock_env).lower() in ("1", "true", "yes")

if use_mock:
    client = mongomock.MongoClient()
elif mongo_uri:
    if mongo_uri.startswith('"') and mongo_uri.endswith('"'):
        mongo_uri = mongo_uri.strip('"')
    client = MongoClient(mongo_uri)
elif mongo_username:  # connect to some external MongoDB
    client = MongoClient(f"mongodb://{mongo_username}:{mongo_password}@{mongo_host}:{mongo_port}/")
else:
    client = MongoClient()

db = client[mongo_db_name]


class SkipActionException(Exception):
    """Exception raised to skip an action at a higher level without rethrowing."""
    pass

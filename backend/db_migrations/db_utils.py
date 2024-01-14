import os
from pymongo import MongoClient

mongo_username = os.getenv("MONGO_USERNAME")
mongo_password = os.getenv("MONGO_PASSWORD")
mongo_host = os.getenv("MONGO_HOST")
mongo_port = os.getenv("MONGO_PORT")
mongo_db_name = os.getenv("MONGO_DB_NAME", "vacal")

if mongo_username:  # connect to some external MongoDB
    client = MongoClient(f"mongodb://{mongo_username}:{mongo_password}@{mongo_host}:{mongo_port}/")
else:
    client = MongoClient()

db = client[mongo_db_name]

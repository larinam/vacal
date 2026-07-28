from .db_utils import db

team_collection = db["team"]

result = team_collection.update_many(
    {"leader_uid": {"$exists": False}},
    {"$set": {"leader_uid": None}},
)

print(f"Initialised leader_uid for {result.modified_count} teams.")

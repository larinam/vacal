from .db_utils import db

team_collection = db["team"]

result = team_collection.update_many(
    {"parent_team_id": {"$exists": False}},
    {"$set": {"parent_team_id": None}},
)

print(f"Initialised parent_team_id for {result.modified_count} teams.")

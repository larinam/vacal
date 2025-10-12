from .db_utils import db

team_collection = db["team"]

result = team_collection.update_many(
    {"subscribers": {"$exists": True}},
    {"$unset": {"subscribers": ""}},
)

print(f"Removed legacy subscribers field from {result.modified_count} teams.")

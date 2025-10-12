from importlib import import_module

from .db_utils import db

team_collection = db["team"]
notification_types_module = import_module("backend.notification_types")
all_notification_types = notification_types_module.list_notification_type_ids()

for team in team_collection.find():
    subscribers = team.get("subscribers") or []
    if not subscribers:
        continue

    preferences = {
        str(subscriber_id): list(all_notification_types)
        for subscriber_id in subscribers
    }
    team_collection.update_one(
        {"_id": team["_id"]},
        {"$set": {"notification_preferences": preferences}},
    )

print("Notification preferences backfilled for existing subscribers.")

from .db_utils import db

team_collection = db["team"]

DEFAULT_TOPICS = [
    "recent_absences",
    "absence_starts",
    "upcoming_absences",
    "birthdays",
]


for team in team_collection.find():
    existing_subscriptions = team.get("notification_subscriptions", []) or []
    normalized = {}

    for subscription in existing_subscriptions:
        user_id = subscription.get("user")
        if not user_id:
            continue
        topics = subscription.get("topics") or DEFAULT_TOPICS
        filtered_topics = [topic for topic in topics if topic in DEFAULT_TOPICS]
        normalized[user_id] = sorted(filtered_topics or DEFAULT_TOPICS)

    for user_id in team.get("subscribers", []) or []:
        if user_id not in normalized:
            normalized[user_id] = DEFAULT_TOPICS

    team_collection.update_one(
        {"_id": team["_id"]},
        {
            "$set": {"notification_subscriptions": [
                {"user": user_id, "topics": topics}
                for user_id, topics in normalized.items()
            ]},
            "$unset": {"subscribers": ""},
        },
    )

print("Migrated team subscribers to notification_subscriptions.")

from .db_utils import db

MIGRATION_MAP = {"team_member": "resignation", "company": "termination"}
team_collection = db["team"]

for team in team_collection.find():
    members = team.get("team_members", [])
    members_changed = False
    for member in members:
        if "departure_initiated_by" not in member:
            continue
        old_value = member.pop("departure_initiated_by")
        member["separation_type"] = MIGRATION_MAP.get(old_value)
        members_changed = True
    if members_changed:
        team_collection.update_one({"_id": team["_id"]}, {"$set": {"team_members": members}})
        print(f"Migrated separation_type fields for team {team['_id']}")

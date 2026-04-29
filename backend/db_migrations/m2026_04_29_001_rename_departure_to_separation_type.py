from .db_utils import db

MIGRATION_MAP = {
    "team_member": "resignation",
    "company":     "termination",
}

team_collection = db["team"]

for team in team_collection.find():
    members = team.get("team_members", [])
    updated_members = []
    members_changed = False

    for member in members:
        member_update = dict(member)
        old_value = member_update.pop("departure_initiated_by", "__missing__")
        if old_value == "__missing__" and "separation_type" in member_update:
            updated_members.append(member_update)
            continue
        member_update["separation_type"] = MIGRATION_MAP.get(old_value) if old_value != "__missing__" else member_update.get("separation_type")
        members_changed = True
        updated_members.append(member_update)

    if members_changed:
        team_collection.update_one(
            {"_id": team["_id"]},
            {"$set": {"team_members": updated_members}},
        )
        print(f"Migrated separation_type fields for team {team['_id']}")

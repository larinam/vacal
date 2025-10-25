from .db_utils import db

team_collection = db["team"]

for team in team_collection.find():
    set_fields: dict = {}

    if "is_deleted" not in team:
        set_fields["is_deleted"] = False
    if "deleted_at" not in team:
        set_fields["deleted_at"] = None
    if "deleted_by" not in team:
        set_fields["deleted_by"] = None

    members = team.get("team_members", [])
    updated_members = []
    members_changed = False
    for member in members:
        member_changed = False
        member_update = dict(member)
        if "is_deleted" not in member_update:
            member_update["is_deleted"] = False
            member_changed = True
        if "deleted_at" not in member_update:
            member_update["deleted_at"] = None
            member_changed = True
        if "deleted_by" not in member_update:
            member_update["deleted_by"] = None
            member_changed = True
        if member_changed:
            members_changed = True
            updated_members.append(member_update)
        else:
            updated_members.append(member)

    if members_changed:
        set_fields["team_members"] = updated_members

    if set_fields:
        team_collection.update_one({"_id": team["_id"]}, {"$set": set_fields})
        print(f"Updated soft-delete fields for team {team['_id']}")

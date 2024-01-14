from .db_utils import db
from bson.objectid import ObjectId

# Accessing the collections directly
day_type_collection = db['day_type']
team_collection = db['team']

# Finding or creating the "Vacation" day type
vacation_day_type = day_type_collection.find_one({"name": "Vacation"})
if not vacation_day_type:
    vacation_day_type_id = day_type_collection.insert_one({"name": "Vacation", "color": "#48BF91"}).inserted_id
else:
    vacation_day_type_id = vacation_day_type['_id']

# Iterating through teams and their members
for team in team_collection.find():
    team_modified = False
    for member in team.get("team_members", []):
        member_modified = False
        for vac_day in member.get("vac_days", []):
            date_str = vac_day.strftime("%Y-%m-%d")
            if date_str not in member.get("days", {}):
                if not member_modified:
                    member["days"] = member.get("days", {})
                    member_modified = True
                if not team_modified:
                    team_modified = True

                if date_str not in member["days"]:
                    member["days"][date_str] = []
                member["days"][date_str].append(ObjectId(vacation_day_type_id))

        if member_modified:
            # Update the member's days in the team document
            team_collection.update_one(
                {"_id": team["_id"], "team_members.uid": member["uid"]},
                {"$set": {"team_members.$.days": member["days"]}}
            )

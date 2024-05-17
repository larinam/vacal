from .db_utils import db

# Assuming 'team' collection holds the Team documents
teams = db['team'].find()

for team in teams:
    updated_team_members = []
    for member in team['team_members']:
        if 'days' in member:
            updated_days = {}
            for date, day_types in member['days'].items():
                updated_days[date] = {
                    "day_types": day_types,
                    "comment": ""
                }
            member['days'] = updated_days
        updated_team_members.append(member)

    db['team'].update_one(
        {"_id": team['_id']},
        {"$set": {"team_members": updated_team_members}}
    )
    print(f"Added comment to team with ID {team['_id']}")
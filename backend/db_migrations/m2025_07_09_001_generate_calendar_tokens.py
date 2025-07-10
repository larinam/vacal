from .db_utils import db
import secrets

team_collection = db['team']

for team in team_collection.find():
    token = team.get('calendar_token')
    if not token:
        new_token = secrets.token_urlsafe(16)
        team_collection.update_one({'_id': team['_id']}, {'$set': {'calendar_token': new_token}})
        print(f"Set calendar_token for team {team['_id']}")

print("Migration completed successfully.")

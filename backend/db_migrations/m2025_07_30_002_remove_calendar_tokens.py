from .db_utils import db

team_collection = db['team']
updated = team_collection.update_many({'calendar_token': {'$exists': True}}, {'$unset': {'calendar_token': ""}})
print(f"Removed calendar_token from {updated.modified_count} teams")

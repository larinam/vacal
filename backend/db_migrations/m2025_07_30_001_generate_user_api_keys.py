import secrets
from .db_utils import db

collection = db['user']
for user in collection.find():
    auth_details = user.get('auth_details', {})
    if not auth_details.get('api_key'):
        token = secrets.token_urlsafe(16)
        collection.update_one({'_id': user['_id']}, {'$set': {'auth_details.api_key': token}})
        print(f"Set api_key for user {user['_id']}")

print("Migration completed successfully.")

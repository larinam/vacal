from .db_utils import db

collection = db['user']
result = collection.update_many(
    {'auth_details.mfa_confirmed': {'$exists': False}},
    {'$set': {'auth_details.mfa_confirmed': False}}
)
print(f"Updated {result.modified_count} users with mfa_confirmed=False")

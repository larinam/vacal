import pyotp
from .db_utils import db

collection = db['user']
for user in collection.find({'auth_details.mfa_secret': {'$exists': False}}):
    secret = pyotp.random_base32()
    collection.update_one({'_id': user['_id']}, {'$set': {'auth_details.mfa_secret': secret}})
    print(f"Set mfa_secret for user {user['_id']}")

print("Migration completed successfully.")

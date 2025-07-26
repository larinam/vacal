import hashlib
from datetime import datetime, timezone

from .db_utils import db

collection = db['password_reset_token']
now = datetime.now(timezone.utc)

for reset in collection.find({'status': 'pending', 'expiration_date': {'$gt': now}}):
    token = reset.get('token')
    if token and len(token) != 64:
        hashed = hashlib.sha256(token.encode()).hexdigest()
        collection.update_one({'_id': reset['_id']}, {'$set': {'token': hashed}})
        print(f"Hashed token for password reset {reset['_id']}")

print("Migration completed successfully.")

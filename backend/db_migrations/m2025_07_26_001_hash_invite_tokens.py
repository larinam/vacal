import hashlib
from datetime import datetime, timezone

from .db_utils import db

collection = db['user_invite']
now = datetime.now(timezone.utc)

for invite in collection.find({'status': 'pending', 'expiration_date': {'$gt': now}}):
    token = invite.get('token')
    if token and len(token) != 64:
        hashed = hashlib.sha256(token.encode()).hexdigest()
        collection.update_one({'_id': invite['_id']}, {'$set': {'token': hashed}})
        print(f"Hashed token for invite {invite['_id']}")

print("Migration completed successfully.")

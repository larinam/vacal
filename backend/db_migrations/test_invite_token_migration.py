import os
import hashlib
from datetime import datetime, timedelta, timezone
from bson import ObjectId
import importlib

os.environ.setdefault("MONGO_MOCK", "1")

from . import db_utils


def test_hash_pending_invite_tokens_migration():
    db = db_utils.db
    coll = db['user_invite']

    raw_token = 'plain-token'
    coll.insert_one({
        'email': 'a@example.com',
        'tenant': ObjectId(),
        'token': raw_token,
        'status': 'pending',
        'expiration_date': datetime.now(timezone.utc) + timedelta(days=1)
    })

    importlib.import_module('backend.db_migrations.m2025_07_26_001_hash_invite_tokens')

    invite = coll.find_one({'email': 'a@example.com'})
    assert invite['token'] == hashlib.sha256(raw_token.encode()).hexdigest()

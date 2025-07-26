import os
import hashlib
from datetime import datetime, timedelta, timezone
from bson import ObjectId
import importlib

os.environ.setdefault("MONGO_MOCK", "1")

from . import db_utils


def test_hash_pending_password_reset_tokens_migration():
    db = db_utils.db
    coll = db['password_reset_token']

    raw_token = 'reset-token'
    user_id = ObjectId()
    coll.insert_one({
        'user': user_id,
        'token': raw_token,
        'status': 'pending',
        'expiration_date': datetime.now(timezone.utc) + timedelta(hours=1)
    })

    importlib.import_module('backend.db_migrations.m2025_07_26_002_hash_password_reset_tokens')

    token_doc = coll.find_one({'user': user_id})
    assert token_doc['token'] == hashlib.sha256(raw_token.encode()).hexdigest()

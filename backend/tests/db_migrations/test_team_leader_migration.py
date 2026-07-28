import importlib
import os
import uuid

from bson import ObjectId

os.environ.setdefault("MONGO_MOCK", "1")

from backend.db_migrations import db_utils


def test_add_leader_uid_migration_backfills_none():
    coll = db_utils.db['team']

    without_field = coll.insert_one({'name': 'Legacy leaderless', 'tenant': ObjectId()}).inserted_id
    existing_leader = str(uuid.uuid4())
    with_field = coll.insert_one({
        'name': 'Already migrated leader',
        'tenant': ObjectId(),
        'leader_uid': existing_leader,
    }).inserted_id

    importlib.import_module('backend.db_migrations.m2026_07_28_001_add_team_leader_uid')

    assert coll.find_one({'_id': without_field})['leader_uid'] is None
    # An existing leader must survive the backfill.
    assert coll.find_one({'_id': with_field})['leader_uid'] == existing_leader

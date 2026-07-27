import importlib
import os

from bson import ObjectId

os.environ.setdefault("MONGO_MOCK", "1")

from backend.db_migrations import db_utils


def test_add_parent_team_id_migration_backfills_none():
    coll = db_utils.db['team']

    without_field = coll.insert_one({'name': 'Legacy', 'tenant': ObjectId()}).inserted_id
    existing_parent = str(ObjectId())
    with_field = coll.insert_one({
        'name': 'Already migrated',
        'tenant': ObjectId(),
        'parent_team_id': existing_parent,
    }).inserted_id

    importlib.import_module('backend.db_migrations.m2026_07_27_001_add_team_parent_team_id')

    assert coll.find_one({'_id': without_field})['parent_team_id'] is None
    # An existing parent must survive the backfill.
    assert coll.find_one({'_id': with_field})['parent_team_id'] == existing_parent

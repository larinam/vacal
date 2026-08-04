import importlib
import os
import uuid
from datetime import datetime, timedelta

from bson import ObjectId

os.environ.setdefault("MONGO_MOCK", "1")

from backend.db_migrations import db_utils


def test_separation_audit_fields_backfill():
    coll = db_utils.db['team']

    # Naive throughout: mongo stores UTC and strips tzinfo on the way back out.
    archived_at = datetime(2025, 3, 4, 9, 30)
    actor_id = ObjectId()
    already_recorded_at = datetime(2026, 1, 1)
    # No microseconds: mongo truncates them, which would break the round-trip compare.
    future_last_working_day = (datetime.now() + timedelta(days=90)).replace(
        hour=0, minute=0, second=0, microsecond=0)

    archived_uid = str(uuid.uuid4())
    active_uid = str(uuid.uuid4())
    migrated_uid = str(uuid.uuid4())
    future_dated_uid = str(uuid.uuid4())

    team_id = coll.insert_one({
        'name': 'Separation audit backfill',
        'tenant': ObjectId(),
        'team_members': [
            {'uid': archived_uid, 'name': 'Archived', 'country': 'Sweden',
             'is_deleted': True, 'deleted_at': archived_at, 'deleted_by': actor_id,
             'last_working_day': datetime(2025, 3, 3)},
            {'uid': active_uid, 'name': 'Active', 'country': 'Sweden', 'is_deleted': False},
            {'uid': migrated_uid, 'name': 'Already migrated', 'country': 'Sweden',
             'is_deleted': False, 'separation_recorded_at': already_recorded_at,
             'separation_recorded_by': actor_id},
            {'uid': future_dated_uid, 'name': 'Archived with future date', 'country': 'Sweden',
             'is_deleted': True, 'deleted_at': archived_at,
             'last_working_day': future_last_working_day},
        ],
    }).inserted_id

    importlib.import_module(
        'backend.db_migrations.m2026_08_04_001_add_member_separation_audit_fields'
    )

    members = {m['uid']: m for m in coll.find_one({'_id': team_id})['team_members']}

    # An archived member's archival stamps are the best record of who recorded it.
    assert members[archived_uid]['separation_recorded_at'] == archived_at
    assert members[archived_uid]['separation_recorded_by'] == actor_id

    # An active member gets the fields, empty.
    assert members[active_uid]['separation_recorded_at'] is None
    assert members[active_uid]['separation_recorded_by'] is None

    # An already-migrated member is left alone.
    assert members[migrated_uid]['separation_recorded_at'] == already_recorded_at

    # A member archived under the old endpoint with a future last working day stays
    # archived: nobody gets resurrected by the migration.
    assert members[future_dated_uid]['is_deleted'] is True
    assert members[future_dated_uid]['last_working_day'] == future_last_working_day

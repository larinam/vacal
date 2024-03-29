import glob
import importlib
import logging
import os.path
import re
from datetime import datetime
from typing import Optional

from .db_migrations import db_utils

log = logging.getLogger(__name__)

# Collection for storing migration history
migration_collection = db_utils.db['migration_history']


def parse_migration_filename(filename):
    """
    Parse the migration filename to extract the date, serial number, and name.
    """
    filename = filename.replace("backend/db_migrations/", "") \
        if filename.startswith("backend/db_migrations/") else filename
    match = re.match(r"m(\d{4})_(\d{2})_(\d{2})_(\d{3})_(.+)", filename)
    if match:
        year, month, day, serial, name = match.groups()
        return {
            "date": datetime(int(year), int(month), int(day)),
            "serial": int(serial),
            "name": name,
            "filename": filename
        }
    return None


def apply_migration(migration_file):
    """
    Apply the migration logic from the migration file.
    This function needs to be adapted based on the structure and content of the migration files.
    """
    log.info(f"Applying migration from {migration_file}.")
    importlib.import_module(migration_file.replace(os.path.sep, '.')[:-3])
    log.info(f"MongoDB Migration done for {migration_file}.")


def run_migrations():
    # Check if it's the first run
    if db_utils.db['day_type'].count_documents({}) == 0 and db_utils.db['team'].count_documents({}) == 0:
        # Handle the first run scenario
        latest_migration = max(glob.glob('backend/db_migrations/m*.py'), key=lambda x: (
            parse_migration_filename(x)['date'], parse_migration_filename(x)['serial']))
        migration_collection.insert_one({"filename": parse_migration_filename(latest_migration)['filename'],
                                         "applied": datetime.now()})
        return

    # Getting the list of migration files
    migration_files = glob.glob('backend/db_migrations/m*.py')
    migration_files.sort(key=lambda x: (parse_migration_filename(x)['date'], parse_migration_filename(x)['serial']))

    # Fetch the last applied migration
    last_migration = migration_collection.find_one(sort=[("applied", -1)])
    last_migration_info: Optional[dict] = parse_migration_filename(
        last_migration["filename"]) if last_migration else None

    for migration_file in migration_files:
        migration_info = parse_migration_filename(migration_file)
        if last_migration is None or (migration_info['date'], migration_info['serial']) > (
                last_migration_info['date'], last_migration_info['serial']):
            apply_migration(migration_file)
            migration_collection.insert_one({"filename": migration_info['filename'], "applied": datetime.now()})


if __name__ == "__main__":
    # Run migrations manually
    run_migrations()

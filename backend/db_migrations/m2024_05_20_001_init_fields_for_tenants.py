from datetime import datetime, timezone, timedelta

from .db_utils import db

# Define the default values for the new fields
default_creation_date = datetime.now(timezone.utc)
default_status = 'trial'
default_trial_until = default_creation_date + timedelta(days=31)
default_current_period = default_creation_date

# Fetch all tenants from the collection
tenants = db['tenant'].find()

# Update each tenant document
for tenant in tenants:
    update_fields = {
        'creation_date': tenant.get('creation_date', default_creation_date),
        'status': tenant.get('status', default_status),
        'trial_until': tenant.get('trial_until', default_trial_until),
        'current_period': tenant.get('current_period', default_current_period),
        'max_team_members_in_periods': tenant.get('max_team_members_in_periods', {})
    }

    db['tenant'].update_one(
        {"_id": tenant['_id']},
        {"$set": update_fields}
    )
    print(f"Updated tenant with ID {tenant['_id']}")

print("Migration completed successfully.")
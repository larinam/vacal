from .db_utils import db, SkipActionException

# Fetch the single tenant
tenants = list(db['tenant'].find())
if len(tenants) == 0:
    raise SkipActionException("No tenants found, the migration will run next time again.")

if len(tenants) == 1:
    tenant_id = tenants[0]['_id']
else:
    raise Exception("This migration is designed to work with exactly one tenant.")

# The Vacation was created for the tenant automatically on the tenant creation, as this is
# a migration of the existing setup, it already has Vacation DayType, so we need to remove newly created one.
# Check and delete the existing 'Vacation' DayType for the specified tenant
vacation_day_type = db['day_type'].find_one({'name': 'Vacation', 'tenant': tenant_id})
if vacation_day_type:
    db['day_type'].delete_one({'_id': vacation_day_type['_id']})
    print(f"Deleted existing 'Vacation' DayType for tenant ID {tenant_id}")

# Update DayTypes and Teams with the single tenant
for collection_name in ['day_type', 'team']:
    result = db[collection_name].update_many(
        {},  # This empty query matches all documents
        {'$set': {'tenant': tenant_id}}  # Setting tenant field to the single tenant's ID
    )
    print(f"Updated {result.modified_count} documents in {collection_name} collection")

# Update Users with the single tenant if they don't already have it
users = db['user'].find()
for user in users:
    result = db['user'].update_one(
        {'_id': user['_id']},
        {'$addToSet': {'tenants': tenant_id}}  # Adding the tenant ID to the user's tenant list
    )
    if result.modified_count > 0:
        print(f"Updated user {user['_id']} to include the tenant {tenant_id}")
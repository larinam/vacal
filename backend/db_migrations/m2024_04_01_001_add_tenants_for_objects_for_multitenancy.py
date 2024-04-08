from .db_utils import db

# Fetch the single tenant
tenants = list(db['tenant'].find())
if len(tenants) == 1:
    tenant_id = tenants[0]['_id']
else:
    raise Exception("This migration is designed to work with exactly one tenant.")

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
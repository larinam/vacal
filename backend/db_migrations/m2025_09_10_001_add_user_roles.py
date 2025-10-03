from .db_utils import db

user_collection = db['user']
tenant_collection = db['tenant']

employee_updates = user_collection.update_many(
    {"role": {"$exists": False}},
    {"$set": {"role": "employee"}}
)

print(f"Set role='employee' on {employee_updates.modified_count} users without a role")

manager_updates = 0

for tenant in tenant_collection.find({}, {"_id": 1}):
    tenant_id = tenant.get('_id')
    if tenant_id is None:
        continue
    existing_manager = user_collection.find_one({
        "tenants": tenant_id,
        "role": "manager"
    })
    if existing_manager:
        continue
    first_user = user_collection.find({"tenants": tenant_id}).sort("_id", 1).limit(1)
    first_user = list(first_user)
    if not first_user:
        continue
    updated = user_collection.update_one({"_id": first_user[0]['_id']}, {"$set": {"role": "manager"}})
    manager_updates += updated.modified_count

print(f"Ensured a manager exists for {manager_updates} tenants")

from .db_utils import db

initial_day_types = [
    {
        "name": "Birthday",
        "identifier": "birthday",
        "color": "#FFC0CB"
    }
]

tenants = list(db['tenant'].find())

for tenant in tenants:
    tenant_id = tenant['_id']

    # Check each initial day type by identifier
    for day_type in initial_day_types:
        existing = db['day_type'].find_one(
            {"tenant": tenant_id, "identifier": day_type["identifier"]}
        )
        if not existing:
            # If it doesn't exist for this tenant, insert the initial day type
            new_day_type = {
                "tenant": tenant_id,
                "name": day_type["name"],
                "identifier": day_type["identifier"],
                "color": day_type["color"]
            }
            db['day_type'].insert_one(new_day_type)
            print(f"Inserted '{day_type['name']}' with identifier '{day_type['identifier']}' for tenant ID {tenant_id}")
        else:
            print(
                f"'{day_type['name']}' with identifier '{day_type['identifier']}' already exists for tenant ID {tenant_id}")

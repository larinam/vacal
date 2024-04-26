import re

from .db_utils import db


def generate_identifier(name):
    # Convert to lowercase and replace spaces with underscores
    identifier = re.sub(r'\s+', '_', name.lower())
    return identifier


# Find all DayType documents
day_types = db['day_type'].find({})

# Iterate through the DayType documents and update the identifier if it doesn't exist or is empty
for day_type in day_types:
    identifier = day_type.get("identifier", "")
    if not identifier:
        # Generate identifier if it's missing or blank
        new_identifier = generate_identifier(day_type["name"])
        result = db['day_type'].update_one(
            {'_id': day_type['_id']},
            {'$set': {'identifier': new_identifier}}
        )
        if result.modified_count > 0:
            print(f"Set identifier '{new_identifier}' for DayType {day_type['name']}")

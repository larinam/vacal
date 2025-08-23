from .db_utils import db

absence_identifiers = ["vacation", "compensatory_leave"]

day_type_collection = db['day_type']
for day_type in day_type_collection.find():
    identifier = day_type.get('identifier')
    is_absence = identifier in absence_identifiers
    day_type_collection.update_one({'_id': day_type['_id']}, {'$set': {'is_absence': is_absence}})
    print(f"Set is_absence={is_absence} for DayType '{day_type.get('name')}' (identifier='{identifier}')")

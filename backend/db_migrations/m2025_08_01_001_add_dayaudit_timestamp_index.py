from .db_utils import db

collection = db['day_audit']
collection.create_index([('team', 1), ('timestamp', 1)], background=True)
print('Created index on day_audit.team and timestamp')

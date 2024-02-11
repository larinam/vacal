from .db_utils import db

# Accessing the collections directly
team_collection = db['team']

result = team_collection.update_many(
    {},  # This empty query matches all documents
    {'$unset': {'team_members.$[].vac_days': ''}}  # The '$[]' operator indicates to apply the operation to all elements in the array
)

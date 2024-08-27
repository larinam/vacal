from .db_utils import db

# Accessing the collections directly
team_collection = db['team']
user_collection = db['user']

# Step 1: Migrate subscriber_emails to subscribers
teams = team_collection.find()

for team in teams:
    subscribers = []
    for email in team.get('subscriber_emails', []):
        user = user_collection.find_one({'email': email})
        if user:
            subscribers.append(user['_id'])

    # Step 2: Update the team with the found subscribers
    team_collection.update_one(
        {'_id': team['_id']},
        {'$set': {'subscribers': subscribers}}
    )

# Step 3: Remove the subscriber_emails field from the collection
team_collection.update_many(
    {},
    {'$unset': {'subscriber_emails': ''}}
)

print("Migration completed successfully.")

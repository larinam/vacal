"""Backfill separation_recorded_at/by on team members.

A departure can now be scheduled for a future date, which means "when the separation was
recorded" and "when the member was archived" are no longer the same moment.
deleted_at/deleted_by keep meaning the latter, so the new pair carries the former.

For members archived before this change the two coincide, so the archival stamps are the
best available record of who recorded the separation.
"""

from datetime import date, datetime

from .db_utils import db

team_collection = db["team"]

suspicious = 0

for team in team_collection.find():
    members = team.get("team_members", [])
    members_changed = False
    for member in members:
        if "separation_recorded_at" not in member:
            member["separation_recorded_at"] = member.get("deleted_at")
            member["separation_recorded_by"] = member.get("deleted_by")
            members_changed = True

        # The old endpoint accepted a future last working day and archived the member
        # anyway. Those rows are left archived on purpose - turning them into scheduled
        # departures would resurrect people somebody deliberately removed. They are only
        # counted here so an admin can review them and use the restore endpoint if any
        # were genuine mistakes.
        last_working_day = member.get("last_working_day")
        if member.get("is_deleted") and isinstance(last_working_day, datetime) \
                and last_working_day.date() > date.today():
            suspicious += 1
            print(f"Archived member {member.get('uid')} in team {team['_id']} has a future "
                  f"last working day ({last_working_day.date()}); left archived")

    if members_changed:
        team_collection.update_one({"_id": team["_id"]}, {"$set": {"team_members": members}})
        print(f"Backfilled separation audit fields for team {team['_id']}")

if suspicious:
    print(f"{suspicious} archived member(s) carry a future last working day - review if needed")

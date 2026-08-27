"""Drop notification_preferences entries that do not belong to the team's tenant.

Two sources of bad keys are cleaned up here:

* Users deleted or removed from a tenant - nothing ever unset their subscriber entry, so
  every deployment that has deleted a user has been logging "Subscriber id ... no longer
  resolves to a user" on each GET /teams.
* Users from another workspace, injected through the unscoped user_id parameter that
  POST /teams/{id}/subscribe used to accept.

Migrations run synchronously at application startup (backend/model.py calls
run_migrations() at import), so this resolves users with one query per distinct tenant
rather than one per subscriber - the naive form is tens of thousands of sequential round
trips on a large estate and would push a container past its health check.
"""

from collections import defaultdict

from bson import ObjectId
from bson.errors import InvalidId

from .db_utils import db

team_collection = db['team']
user_collection = db['user']

teams_with_subscribers = list(
    team_collection.find(
        {'notification_preferences': {'$exists': True, '$ne': {}}},
        {'notification_preferences': 1, 'tenant': 1},
    )
)

# Pass 1: split each team's keys into malformed ones (unusable, always orphans) and
# well-formed candidates, and record which tenants need a membership lookup.
malformed_by_team = {}
candidates_by_team = {}
candidate_ids_by_tenant = defaultdict(set)

for team in teams_with_subscribers:
    tenant_id = team.get('tenant')
    malformed = []
    candidates = {}
    for raw_id in team.get('notification_preferences') or {}:
        try:
            candidates[raw_id] = ObjectId(raw_id)
        except (InvalidId, TypeError, ValueError):
            malformed.append(raw_id)
    malformed_by_team[team['_id']] = malformed
    candidates_by_team[team['_id']] = (tenant_id, candidates)
    candidate_ids_by_tenant[tenant_id].update(candidates.values())

# Pass 2: one membership query per tenant. `tenants` is a ListField(ReferenceField) stored
# as bare ObjectIds, so equality against the tenant id is a list-membership test.
members_by_tenant = {}
for tenant_id, candidate_ids in candidate_ids_by_tenant.items():
    members_by_tenant[tenant_id] = {
        str(doc['_id'])
        for doc in user_collection.find(
            {'_id': {'$in': list(candidate_ids)}, 'tenants': tenant_id}, {'_id': 1}
        )
    }

# Pass 3: unset everything that did not resolve to a user of the team's own tenant.
cleaned_teams = 0
removed_keys = 0

for team_id, (tenant_id, candidates) in candidates_by_team.items():
    members = members_by_tenant.get(tenant_id, set())
    orphan_keys = malformed_by_team[team_id] + [
        raw_id for raw_id in candidates if raw_id not in members
    ]
    if not orphan_keys:
        continue

    team_collection.update_one(
        {'_id': team_id},
        {'$unset': {f'notification_preferences.{key}': "" for key in orphan_keys}},
    )
    cleaned_teams += 1
    removed_keys += len(orphan_keys)
    print(f"Removed {len(orphan_keys)} orphan subscriber(s) from team {team_id}")

print(
    f"Scanned {len(teams_with_subscribers)} teams with subscribers in "
    f"{len(candidate_ids_by_tenant)} tenants; cleaned {cleaned_teams} teams, "
    f"removed {removed_keys} subscriber entries"
)

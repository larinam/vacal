import logging
import datetime
import os
from collections import defaultdict

from ..email_service import send_email
from ..model import DayAudit, Team, DayType

log = logging.getLogger(__name__)

cors_origin = os.getenv("CORS_ORIGIN")


def _summaries_for_team(team: Team, start: datetime.datetime, end: datetime.datetime) -> list[str]:
    pipeline = [
        {
            "$match": {
                "team": team.id,
                "timestamp": {"$gte": start, "$lte": end},
            }
        },
        {"$sort": {"member_uid": 1, "date": 1, "timestamp": 1}},
        {
            "$group": {
                "_id": {"uid": "$member_uid", "date": "$date"},
                "first_old_types": {"$first": "$old_day_types"},
                "first_old_comment": {"$first": "$old_comment"},
                "last_new_types": {"$last": "$new_day_types"},
                "last_new_comment": {"$last": "$new_comment"},
            }
        },
    ]

    results = list(DayAudit.objects.aggregate(*pipeline))
    if not results:
        return []

    # Index team members and day types for fast lookup
    member_lookup = {str(m.uid): m for m in team.team_members}
    daytype_lookup = {str(dt.id): dt.name for dt in DayType.objects(tenant=team.tenant)}

    summaries = []
    for res in results:
        member_uid = res["_id"]["uid"]
        date = res["_id"]["date"]
        old_types = [daytype_lookup.get(str(dt), str(dt)) for dt in res.get("first_old_types", [])]
        new_types = [daytype_lookup.get(str(dt), str(dt)) for dt in res.get("last_new_types", [])]
        old_comment = res.get("first_old_comment") or ""
        new_comment = res.get("last_new_comment") or ""

        if set(old_types) == set(new_types) and old_comment == new_comment:
            continue

        member_name = member_lookup.get(member_uid).name if member_uid in member_lookup else member_uid
        old_types_text = ", ".join(old_types) if old_types else "none"
        new_types_text = ", ".join(new_types) if new_types else "none"

        summary = f"{member_name} on {date}: {old_types_text}"
        if old_comment:
            summary += f" (\"{old_comment}\")"
        summary += f" -> {new_types_text}"
        if old_comment != new_comment and new_comment:
            summary += f" (\"{new_comment}\")"
        summaries.append(summary)
    return summaries


def _generate_email_body(team_changes: list[tuple[str, list[str]]]) -> str:
    if not team_changes:
        return ""
    body = "Hi there!\n\n"
    for team_name, summaries in team_changes:
        if not summaries:
            continue
        body += f"{team_name}:\n"
        for s in summaries:
            body += f"- {s}\n"
        body += "\n"
    body += f"For details, visit {cors_origin}."
    body += "\n\nBest regards,\nVacation Calendar"
    return body


def send_day_audit_email_updates() -> None:
    log.debug("Start scheduled task send_day_audit_email_updates")
    now = datetime.datetime.now(datetime.timezone.utc)
    start = now - datetime.timedelta(days=1)

    changes_by_subscriber: defaultdict[str, list[tuple[str, list[str]]]] = defaultdict(list)

    for team in Team.objects():
        summaries = _summaries_for_team(team, start, now)
        if not summaries:
            continue
        for subscriber in team.subscribers:
            changes_by_subscriber[subscriber.email].append((team.name, summaries))

    for email, team_changes in changes_by_subscriber.items():
        body = _generate_email_body(team_changes)
        if body:
            subject = f"Day Changes - {now.strftime('%B %d')}"
            send_email(subject, body, email)

    log.debug("Stop scheduled task send_day_audit_email_updates")

import datetime
import logging
import os
from collections import defaultdict
from typing import Dict, Iterable, List, Set

from ..email_service import send_email
from ..model import DayAudit, Team

log = logging.getLogger(__name__)

cors_origin = os.getenv("CORS_ORIGIN")  # should contain production domain of the frontend


def _normalize_now(now: datetime.datetime | None) -> datetime.datetime:
    if now is None:
        return datetime.datetime.now(datetime.timezone.utc)
    if now.tzinfo is None:
        return now.replace(tzinfo=datetime.timezone.utc)
    return now.astimezone(datetime.timezone.utc)


def _get_time_window(now: datetime.datetime | None) -> tuple[datetime.datetime, datetime.datetime]:
    normalized_now = _normalize_now(now)
    current_hour_start = normalized_now.replace(minute=0, second=0, microsecond=0)
    previous_hour_start = current_hour_start - datetime.timedelta(hours=1)
    window_start = previous_hour_start - datetime.timedelta(hours=1)
    return window_start, previous_hour_start


def _get_added_absence_day_types(audit: DayAudit) -> List:
    old_absence_ids = {str(day_type.id) for day_type in audit.old_day_types if getattr(day_type, "is_absence", False)}
    added_absence_day_types = []
    for day_type in audit.new_day_types:
        if not getattr(day_type, "is_absence", False):
            continue
        if str(day_type.id) not in old_absence_ids:
            added_absence_day_types.append(day_type)
    return added_absence_day_types


def _get_member_by_uid(team: Team, member_uid: str):
    for member in team.team_members:
        if str(member.uid) == member_uid:
            return member
    return None


def _get_current_absence_day_type_ids(member, date: datetime.date) -> Set[str]:
    day_entry = member.days.get(str(date)) if getattr(member, "days", None) else None
    if not day_entry:
        return set()
    return {
        str(day_type.id)
        for day_type in getattr(day_entry, "day_types", [])
        if getattr(day_type, "is_absence", False)
    }


def _get_actor_name(audit: DayAudit) -> str | None:
    user = audit.user
    if not user:
        return None
    if getattr(user, "name", None):
        return user.name
    if getattr(user, "email", None):
        return user.email
    auth_details = getattr(user, "auth_details", None)
    if auth_details and getattr(auth_details, "username", None):
        return auth_details.username
    return None


def _collect_notifications(
    audits: Iterable[DayAudit],
) -> Dict[str, Dict[str, List[dict]]]:
    notifications = defaultdict(lambda: defaultdict(list))
    for audit in audits:
        added_absence_day_types = _get_added_absence_day_types(audit)
        if not added_absence_day_types:
            continue
        team = audit.team
        if team is None:
            continue
        member = _get_member_by_uid(team, audit.member_uid)
        if member is None:
            continue
        current_absence_ids = _get_current_absence_day_type_ids(member, audit.date)
        relevant_day_types = [
            day_type for day_type in added_absence_day_types if str(day_type.id) in current_absence_ids
        ]
        if not relevant_day_types:
            continue
        entry = {
            "member_name": member.name,
            "date": audit.date,
            "day_types": [day_type.name for day_type in relevant_day_types],
            "added_by": _get_actor_name(audit),
            "comment": (audit.new_comment or "").strip(),
        }
        for email in team.get_subscriber_emails():
            notifications[email][team.name].append(entry)
    return notifications


def _format_notification_line(entry: dict) -> str:
    day_types = ", ".join(entry["day_types"])
    line = f"- {entry['member_name']} was marked absent with {day_types} on {entry['date'].isoformat()}."
    if entry.get("added_by"):
        line += f" Added by {entry['added_by']}."
    comment = entry.get("comment")
    if comment:
        line += f" Comment: {comment}"
    return line


def _generate_email_body(
    teams_notifications: Dict[str, List[dict]],
    window_start: datetime.datetime,
    window_end: datetime.datetime,
) -> str:
    if not teams_notifications:
        return ""
    window_start_str = window_start.strftime("%B %d, %Y %H:%M")
    window_end_str = window_end.strftime("%H:%M")
    body_lines = [
        "Hello!",
        "",
        f"The following absences were added between {window_start_str} and {window_end_str} UTC:",
        "",
    ]
    for team_name, entries in sorted(teams_notifications.items()):
        body_lines.append(f"{team_name}:")
        for entry in sorted(entries, key=lambda e: (e["date"], e["member_name"], e["day_types"])):
            body_lines.append(_format_notification_line(entry))
        body_lines.append("")
    destination = cors_origin or "the vacation calendar"
    body_lines.extend([
        f"For details, visit {destination}.",
        "",
        "Best regards,",
        "Vacation Calendar",
    ])
    return "\n".join(body_lines)


def _generate_subject(window_start: datetime.datetime, window_end: datetime.datetime) -> str:
    return (
        "New Absences Added - "
        f"{window_start.strftime('%b %d %H:%M')} - {window_end.strftime('%H:%M')} UTC"
    )


def send_recent_absence_notifications(now: datetime.datetime | None = None) -> None:
    log.debug("Start scheduled task send_recent_absence_notifications")
    window_start, window_end = _get_time_window(now)
    audits = DayAudit.objects(
        timestamp__gte=window_start,
        timestamp__lt=window_end,
    ).select_related()

    notifications = _collect_notifications(audits)
    if not notifications:
        log.debug("No new absence audits to notify about")
        log.debug("Stop scheduled task send_recent_absence_notifications")
        return

    subject = _generate_subject(window_start, window_end)
    for email, teams_notifications in notifications.items():
        body = _generate_email_body(teams_notifications, window_start, window_end)
        if body:
            send_email(subject, body, email)
    log.debug("Stop scheduled task send_recent_absence_notifications")

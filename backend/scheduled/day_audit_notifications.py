import datetime
import logging
import os
from collections import defaultdict
from typing import Dict, Iterable, List, Set, Tuple

from ..email_service import send_email
from ..model import DayAudit, Team
from ..notification_types import ABSENCE_RECENT_CHANGES_NOTIFICATION

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


def _get_added_day_types(audit: DayAudit) -> List:
    old_day_type_ids = {str(day_type.id) for day_type in audit.old_day_types if day_type}
    added_day_types = []
    for day_type in audit.new_day_types:
        if not day_type:
            continue
        if str(day_type.id) not in old_day_type_ids:
            added_day_types.append(day_type)
    return added_day_types


def _get_current_day_type_ids(member, date: datetime.date) -> Set[str]:
    day_entry = member.days.get(str(date)) if getattr(member, "days", None) else None
    if not day_entry:
        return set()
    return {
        str(day_type.id)
        for day_type in getattr(day_entry, "day_types", [])
        if day_type
    }


def _get_actor_id(audit: DayAudit) -> str | None:
    user = getattr(audit, "user", None)
    if not user:
        return None
    user_id = getattr(user, "id", None)
    return str(user_id) if user_id else None


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


def _get_actor_email(audit: DayAudit) -> str | None:
    user = getattr(audit, "user", None)
    if not user:
        return None
    if getattr(user, "email", None):
        return user.email
    auth_details = getattr(user, "auth_details", None)
    if auth_details and getattr(auth_details, "google_email", None):
        return auth_details.google_email
    return None


def _normalize_email(email: str | None) -> str | None:
    if not email:
        return None
    return email.strip().lower() or None


def _get_member_email(member) -> str | None:
    email = getattr(member, "email", None)
    return _normalize_email(email)


def _collect_notifications(
    audits: Iterable[DayAudit],
) -> Tuple[Dict[str, Dict[str, List[dict]]], Dict[str, Dict[str, List[dict]]]]:
    subscriber_notifications = defaultdict(lambda: defaultdict(list))
    member_notifications = defaultdict(lambda: defaultdict(list))
    for audit in audits:
        added_day_types = _get_added_day_types(audit)
        if not added_day_types:
            continue
        team = audit.team
        if team is None:
            continue
        member = team.get_member(audit.member_uid)
        if member is None:
            continue
        current_day_type_ids = _get_current_day_type_ids(member, audit.date)
        relevant_day_types = [
            day_type for day_type in added_day_types if str(day_type.id) in current_day_type_ids
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
        actor_id = _get_actor_id(audit)
        exclude_ids = [actor_id] if actor_id else None
        for email in team.get_subscriber_emails(
            ABSENCE_RECENT_CHANGES_NOTIFICATION,
            exclude_user_ids=exclude_ids,
        ):
            subscriber_notifications[email][team.name].append(entry)

        member_email = _get_member_email(member)
        actor_email = _normalize_email(_get_actor_email(audit))
        if member_email and member_email != actor_email:
            # Keep a copy per member to avoid sharing dict references across collections
            entry_copy = dict(entry)
            member_notifications[member_email][team.name].append(entry_copy)
    return subscriber_notifications, member_notifications


def _format_notification_line(entry: dict) -> str:
    day_types = ", ".join(entry["day_types"])
    line = f"- {entry['member_name']} was assigned {day_types} on {entry['date'].isoformat()}."
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
        f"The following calendar changes were recorded between {window_start_str} and {window_end_str} UTC:",
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
        "New Calendar Changes - "
        f"{window_start.strftime('%b %d %H:%M')} - {window_end.strftime('%H:%M')} UTC"
    )


def _generate_member_subject(window_start: datetime.datetime, window_end: datetime.datetime) -> str:
    return (
        "Your Calendar Updates - "
        f"{window_start.strftime('%b %d %H:%M')} - {window_end.strftime('%H:%M')} UTC"
    )


def _generate_member_email_body(
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
        f"The following updates were made to your calendar between {window_start_str} and {window_end_str} UTC:",
        "",
    ]
    for team_name, entries in sorted(teams_notifications.items()):
        body_lines.append(f"In {team_name}:")
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


def send_recent_calendar_change_notifications(now: datetime.datetime | None = None) -> None:
    log.debug("Start scheduled task send_recent_calendar_change_notifications")
    window_start, window_end = _get_time_window(now)
    audits = DayAudit.objects(
        timestamp__gte=window_start,
        timestamp__lt=window_end,
    ).select_related()

    subscriber_notifications, member_notifications = _collect_notifications(audits)
    if not subscriber_notifications and not member_notifications:
        log.debug("No new calendar change audits to notify about")
        log.debug("Stop scheduled task send_recent_calendar_change_notifications")
        return

    subject = _generate_subject(window_start, window_end)
    for email, teams_notifications in subscriber_notifications.items():
        body = _generate_email_body(teams_notifications, window_start, window_end)
        if body:
            send_email(subject, body, email)

    member_subject = _generate_member_subject(window_start, window_end)
    for email, teams_notifications in member_notifications.items():
        body = _generate_member_email_body(teams_notifications, window_start, window_end)
        if body:
            send_email(member_subject, body, email)

    log.debug("Stop scheduled task send_recent_calendar_change_notifications")

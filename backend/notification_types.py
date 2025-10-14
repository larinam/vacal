from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List


@dataclass(frozen=True)
class NotificationTypeDefinition:
    identifier: str
    label: str
    description: str


ABSENCE_DAILY_NOTIFICATION = "absence_daily"
ABSENCE_UPCOMING_NOTIFICATION = "absence_upcoming"
ABSENCE_RECENT_CHANGES_NOTIFICATION = "absence_recent_changes"
BIRTHDAY_DAILY_NOTIFICATION = "birthday_daily"


_NOTIFICATION_TYPES: List[NotificationTypeDefinition] = [
    NotificationTypeDefinition(
        identifier=ABSENCE_DAILY_NOTIFICATION,
        label="Today's absence summary",
        description="Receive a consolidated summary of the absences that begin today.",
    ),
    NotificationTypeDefinition(
        identifier=ABSENCE_UPCOMING_NOTIFICATION,
        label="Upcoming absences",
        description="Receive a notification about absences starting on the next working day.",
    ),
    NotificationTypeDefinition(
        identifier=ABSENCE_RECENT_CHANGES_NOTIFICATION,
        label="Recent calendar additions",
        description="Stay informed when new absences or special day types are added to the calendar during the day.",
    ),
    NotificationTypeDefinition(
        identifier=BIRTHDAY_DAILY_NOTIFICATION,
        label="Daily birthday summary",
        description="Receive a list of teammates who celebrate their birthday today.",
    ),
]

_NOTIFICATION_TYPES_BY_ID = {definition.identifier: definition for definition in _NOTIFICATION_TYPES}


def list_notification_types() -> List[NotificationTypeDefinition]:
    """Return the registered notification types in declaration order."""
    return list(_NOTIFICATION_TYPES)


def list_notification_type_ids() -> List[str]:
    """Return the identifiers of the registered notification types."""
    return [definition.identifier for definition in _NOTIFICATION_TYPES]


def ensure_valid_notification_types(selected_types: Iterable[str]) -> List[str]:
    """Validate that ``selected_types`` contains only registered identifiers."""
    unique_types = list(dict.fromkeys(selected_types))
    unknown = [identifier for identifier in unique_types if identifier not in _NOTIFICATION_TYPES_BY_ID]
    if unknown:
        raise ValueError(f"Unknown notification types: {', '.join(sorted(unknown))}")
    return unique_types


__all__ = [
    "NotificationTypeDefinition",
    "ABSENCE_DAILY_NOTIFICATION",
    "ABSENCE_UPCOMING_NOTIFICATION",
    "ABSENCE_RECENT_CHANGES_NOTIFICATION",
    "BIRTHDAY_DAILY_NOTIFICATION",
    "list_notification_types",
    "list_notification_type_ids",
    "ensure_valid_notification_types",
]

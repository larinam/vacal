import datetime
import logging

from ..model import Team, archive_member, clear_leader_references
from ..utils import get_today

log = logging.getLogger(__name__)


def apply_due_separations(today: datetime.date | None = None) -> int:
    """Persist the archived state of members whose last working day has passed.

    The lifecycle state is derived at read time (see ``TeamMember.is_archived``), so this
    job never decides whether somebody has left - it only materialises the flag and the
    audit stamps. That means a missed run costs a stale ``deleted_at`` and a lingering
    leader pointer, not a departed employee who is still billed and emailed.

    Idempotent and catch-up safe: running it twice, or once after several days of
    downtime, produces the same result.
    """
    today = today or get_today()
    now = datetime.datetime.now(datetime.timezone.utc)
    # Deferred import: the holidays cache lives in the router, and scheduled modules
    # otherwise only import from model/utils/email_service.
    from ..routers.teams import invalidate_holidays_cache

    archived_total = 0
    cache_is_stale = False
    # Soft-deleted teams are included so their members' stored state converges too.
    for team in Team.objects_with_deleted():
        try:
            due = [member for member in team.team_members if member.is_separation_due(today)]
            if not due:
                continue
            for member in due:
                archive_member(member, now=now)
            team.save()
            clear_leader_references(team.tenant, [str(member.uid) for member in due])
            archived_total += len(due)
            cache_is_stale = True
        except Exception:
            # One unreadable document must not abort the sweep for every other team.
            log.exception("Failed to apply due separations for team %s", team.id)
    if cache_is_stale:
        invalidate_holidays_cache()
    log.info("Applied %s due separations", archived_total)
    return archived_total

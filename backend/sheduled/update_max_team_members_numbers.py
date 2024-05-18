import logging

from backend.model import Tenant

log = logging.getLogger(__name__)


def run_update_max_team_members_numbers():
    log.debug("Start scheduled task update_max_team_members_numbers")
    tenants = Tenant.objects()
    for tenant in tenants:
        tenant.update_max_team_members_in_the_period()
    log.debug("Stop scheduled task update_max_team_members_numbers")

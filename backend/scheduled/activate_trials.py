import logging

from backend.model import Tenant

log = logging.getLogger(__name__)


def activate_trials():
    log.debug("Start scheduled task activate_trials")
    tenants = Tenant.objects()
    for tenant in tenants:
        tenant.activate_trial()
    log.debug("Stop scheduled task activate_trials")

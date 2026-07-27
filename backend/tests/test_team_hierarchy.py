import uuid

from backend.model import Tenant, Team, TeamMember
from backend.routers.teams import would_create_team_cycle


def setup_tree():
    """Engineering > Backend > Payments in a single tenant."""
    tenant = Tenant(name=f"Tenant{uuid.uuid4()}", identifier=str(uuid.uuid4())).save()
    engineering = Team(tenant=tenant, name=f"Engineering{uuid.uuid4()}").save()
    backend = Team(tenant=tenant, name=f"Backend{uuid.uuid4()}",
                   parent_team_id=str(engineering.id)).save()
    payments = Team(tenant=tenant, name=f"Payments{uuid.uuid4()}",
                    parent_team_id=str(backend.id)).save()
    return tenant, engineering, backend, payments


def test_no_parent_is_not_a_cycle():
    tenant, engineering, _, _ = setup_tree()
    assert would_create_team_cycle(tenant, str(engineering.id), None) is False


def test_self_assignment_is_a_cycle():
    tenant, engineering, _, _ = setup_tree()
    assert would_create_team_cycle(tenant, str(engineering.id), str(engineering.id)) is True


def test_assigning_a_descendant_as_parent_is_a_cycle():
    # Engineering under Payments would loop Engineering -> Payments -> Backend -> Engineering.
    tenant, engineering, _, payments = setup_tree()
    assert would_create_team_cycle(tenant, str(engineering.id), str(payments.id)) is True


def test_assigning_an_ancestor_as_parent_is_allowed():
    # Payments already sits under Engineering; re-pointing it there terminates at the root.
    tenant, engineering, _, payments = setup_tree()
    assert would_create_team_cycle(tenant, str(payments.id), str(engineering.id)) is False


def test_assigning_an_unrelated_team_is_allowed():
    tenant, engineering, _, payments = setup_tree()
    unrelated = Team(tenant=tenant, name=f"Sales{uuid.uuid4()}").save()
    assert would_create_team_cycle(tenant, str(payments.id), str(unrelated.id)) is False
    assert would_create_team_cycle(tenant, str(unrelated.id), str(engineering.id)) is False


def test_cycle_detection_walks_through_an_archived_team():
    # Archiving the middle team must not truncate the walk and let a cycle through.
    tenant, engineering, backend, payments = setup_tree()
    backend.is_deleted = True
    backend.save()
    assert would_create_team_cycle(tenant, str(engineering.id), str(payments.id)) is True


def test_cycle_detection_is_scoped_to_tenant():
    # An identical chain in another tenant must not influence the answer.
    tenant, engineering, _, payments = setup_tree()
    setup_tree()
    other_tenant_team = Team.objects(tenant__ne=tenant).first()
    assert other_tenant_team is not None
    assert would_create_team_cycle(tenant, str(engineering.id), str(other_tenant_team.id)) is False
    assert would_create_team_cycle(tenant, str(payments.id), str(engineering.id)) is False


def test_pre_existing_cycle_terminates():
    tenant, engineering, backend, payments = setup_tree()
    # Close the loop directly in the database, bypassing the API guard.
    Team.objects_with_deleted(id=engineering.id).update(set__parent_team_id=str(payments.id))
    unrelated = Team(tenant=tenant, name=f"Sales{uuid.uuid4()}").save()
    assert would_create_team_cycle(tenant, str(unrelated.id), str(backend.id)) is False

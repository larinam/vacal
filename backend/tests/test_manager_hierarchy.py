import uuid

from backend.model import Tenant, Team, TeamMember
from backend.routers.teams import would_create_manager_cycle


def setup_chain():
    """A is manager of B, B is manager of C, spread across two teams."""
    tenant = Tenant(name=f"Tenant{uuid.uuid4()}", identifier=str(uuid.uuid4())).save()
    a = TeamMember(name="A", country="Sweden")
    b = TeamMember(name="B", country="Sweden", manager_uid=str(a.uid))
    c = TeamMember(name="C", country="Sweden", manager_uid=str(b.uid))
    Team(tenant=tenant, name="Team1", team_members=[a, b]).save()
    Team(tenant=tenant, name="Team2", team_members=[c]).save()
    return tenant, a, b, c


def test_no_manager_is_not_a_cycle():
    tenant, a, _, _ = setup_chain()
    assert would_create_manager_cycle(tenant, str(a.uid), None) is False


def test_self_assignment_is_a_cycle():
    tenant, a, _, _ = setup_chain()
    assert would_create_manager_cycle(tenant, str(a.uid), str(a.uid)) is True


def test_assigning_a_descendant_as_manager_is_a_cycle():
    # Making A report to its grand-report C would loop A -> C -> B -> A.
    tenant, a, _, c = setup_chain()
    assert would_create_manager_cycle(tenant, str(a.uid), str(c.uid)) is True


def test_assigning_an_ancestor_as_manager_is_allowed():
    # C reporting to A is fine; A has no manager so the chain terminates.
    tenant, a, _, c = setup_chain()
    assert would_create_manager_cycle(tenant, str(c.uid), str(a.uid)) is False

"""Tenant scoping of user references in shared DTOs.

`UserWithoutTenantsDTO` is embedded in almost every shared response, so every path that
turns a user reference into one has to be scoped to the caller's tenant. Three did not:

* the raw `api_key` was a declared field on the DTO, so it reached every tenant member;
* the resolver cache was keyed on the user id alone while the tenant filter lived inside
  the query, so a warm entry served a user across a tenant boundary - and a cold miss
  raised an unhandled `DoesNotExist`;
* `_safe_deref_user` and the `isinstance(value, User)` branches of the `deleted_by`
  validators dereferenced without any tenant check at all.

The cross-tenant cases need a user who belonged to two tenants and left one, or was
deleted outright - `User.tenants` is a ListField, so that is a first-class shape.
"""

import datetime
import hashlib
import uuid

import pytest
from bson import ObjectId
from fastapi.testclient import TestClient

from backend.dependencies import (
    get_current_active_user,
    get_current_active_user_check_tenant,
    tenant_var,
)
from backend.main import app
from backend.model import AuthDetails, DayAudit, DayType, Team, TeamMember, Tenant, User, UserInvite
from backend.routers.teams import TeamReadDTO
from backend.routers.users import (
    UserWithoutTenantsDTO,
    _resolve_user_dto,
    clear_user_dto_cache,
)

# raise_server_exceptions=False so an unhandled 500 is asserted on rather than re-raised.
client = TestClient(app, raise_server_exceptions=False)


@pytest.fixture(autouse=True)
def _clean_state():
    """conftest drops Tenant/User/UserInvite but never Team, and the resolver cache is
    process-global, so both have to be reset around every test here."""
    clear_user_dto_cache()
    yield
    Team.drop_collection()
    Tenant.drop_collection()
    User.drop_collection()
    clear_user_dto_cache()


def _tenant():
    tenant = Tenant(name=f"T-{uuid.uuid4()}", identifier=str(uuid.uuid4())).save()
    DayType.init_day_types(tenant)
    return tenant


def _user(tenants, name="User", role="manager"):
    return User(
        tenants=tenants,
        name=name,
        email=f"{uuid.uuid4()}@example.com",
        auth_details=AuthDetails(username=str(uuid.uuid4())),
        role=role,
    ).save()


# --- A: the raw key is no longer a field on the shared DTO ---------------------------


def test_users_list_does_not_expose_api_keys():
    tenant = _tenant()
    caller = _user([tenant], name="Caller")
    colleague = _user([tenant], name="Colleague")

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: caller
    try:
        response = client.get("/users", headers={"Tenant-ID": tenant.identifier})
        assert response.status_code == 200
        assert colleague.auth_details.api_key not in response.text
        assert caller.auth_details.api_key not in response.text
        assert "api_key" not in response.text
    finally:
        app.dependency_overrides = {}


def test_users_me_still_exposes_the_callers_own_api_key():
    """The calendar link in the UI is built from this field - CalendarComponent.jsx."""
    tenant = _tenant()
    caller = _user([tenant], name="Caller")

    app.dependency_overrides[get_current_active_user] = lambda: caller
    try:
        response = client.get("/users/me", headers={"Tenant-ID": tenant.identifier})
        assert response.status_code == 200
        assert response.json()["auth_details"]["api_key"] == caller.auth_details.api_key
    finally:
        app.dependency_overrides = {}


# --- G: departed users are not disclosed through a bare dereference ------------------


def test_archived_members_does_not_disclose_a_departed_users_record():
    tenant_a, tenant_b = _tenant(), _tenant()
    departed = _user([tenant_a, tenant_b], name="Departed")
    manager = _user([tenant_b], name="Manager")

    member = TeamMember(name="Alice", country="Sweden", is_deleted=True, deleted_by=departed)
    Team(tenant=tenant_b, name="Team", team_members=[member]).save()

    departed.tenants = [tenant_a]  # leaves B, still exists in A
    departed.save()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: manager
    try:
        response = client.get("/teams/archived-members", headers={"Tenant-ID": tenant_b.identifier})
        assert response.status_code == 200
        assert departed.auth_details.api_key not in response.text
        assert departed.name not in response.text
        assert response.json()["archived_members"][0]["deleted_by"] is None
    finally:
        app.dependency_overrides = {}


def test_archived_team_deleted_by_is_tenant_scoped():
    """team_to_read_dto passes a dereferenced User, which took the isinstance(value, User)
    branch of the validator and bypassed every tenant check."""
    tenant_a, tenant_b = _tenant(), _tenant()
    departed = _user([tenant_a, tenant_b], name="Departed")
    caller = _user([tenant_b], name="Caller", role="employee")

    Team(tenant=tenant_b, name="Archived", is_deleted=True, deleted_by=departed).save()
    departed.tenants = [tenant_a]
    departed.save()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: caller
    try:
        response = client.get(
            "/teams?include_archived=true", headers={"Tenant-ID": tenant_b.identifier}
        )
        assert response.status_code == 200
        assert departed.auth_details.api_key not in response.text
        assert departed.name not in response.text
    finally:
        app.dependency_overrides = {}


# --- F: the resolver cache is tenant-partitioned and fails closed --------------------


def test_warm_cache_does_not_serve_a_user_across_tenants():
    tenant_a, tenant_b = _tenant(), _tenant()
    shared = _user([tenant_a, tenant_b], name="Shared")
    caller_a = _user([tenant_a], name="CallerA")
    caller_b = _user([tenant_b], name="CallerB")

    member_a = TeamMember(name="AliceA", country="Sweden", is_deleted=True, deleted_by=shared)
    Team(tenant=tenant_a, name="TeamA", team_members=[member_a]).save()
    member_b = TeamMember(name="AliceB", country="Sweden", is_deleted=True, deleted_by=shared)
    Team(tenant=tenant_b, name="TeamB", team_members=[member_b]).save()

    # Tenant A warms the cache for `shared`, who then leaves B. Asserting the name is
    # present matters: without it, a first request that failed to resolve would leave the
    # cache cold and the cross-tenant assertion below would pass for the wrong reason.
    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: caller_a
    try:
        first = client.get(
            "/teams/archived-members", headers={"Tenant-ID": tenant_a.identifier}
        )
        assert first.status_code == 200
        assert first.json()["archived_members"][0]["deleted_by"]["name"] == "Shared"
    finally:
        app.dependency_overrides = {}

    shared.tenants = [tenant_a]
    shared.save()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: caller_b
    try:
        second = client.get(
            "/teams/archived-members", headers={"Tenant-ID": tenant_b.identifier}
        )
        assert second.status_code == 200
        assert shared.auth_details.api_key not in second.text
        assert shared.name not in second.text
    finally:
        app.dependency_overrides = {}


def test_dangling_deleted_by_does_not_500_the_teams_listing():
    """TeamMember.deleted_by is a ReferenceField inside an EmbeddedDocument, where
    mongoengine cannot apply a reverse_delete_rule, so a full user delete leaves a
    reference that raises on access."""
    tenant = _tenant()
    actor = _user([tenant], name="Actor")
    caller = _user([tenant], name="Caller")
    member = TeamMember(name="Alice", country="Sweden", is_deleted=True, deleted_by=actor)
    Team(tenant=tenant, name="Team", team_members=[member]).save()
    actor.delete()
    clear_user_dto_cache()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: caller
    try:
        response = client.get(
            "/teams?include_archived_members=true", headers={"Tenant-ID": tenant.identifier}
        )
        assert response.status_code == 200, response.text[:400]
    finally:
        app.dependency_overrides = {}


def test_dangling_deleted_by_does_not_500_archived_members():
    tenant = _tenant()
    actor = _user([tenant], name="Actor")
    manager = _user([tenant], name="Manager")
    member = TeamMember(name="Alice", country="Sweden", is_deleted=True, deleted_by=actor)
    Team(tenant=tenant, name="Team", team_members=[member]).save()
    actor.delete()
    clear_user_dto_cache()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: manager
    try:
        response = client.get(
            "/teams/archived-members", headers={"Tenant-ID": tenant.identifier}
        )
        assert response.status_code == 200, response.text[:400]
        assert response.json()["archived_members"][0]["deleted_by"] is None
    finally:
        app.dependency_overrides = {}


def test_a_cached_miss_does_not_outlive_a_tenant_join():
    """A miss is cached like a hit, so joining a tenant must invalidate the cache or the
    joiner stays invisible in that tenant for the life of the process."""
    tenant_a, tenant_b = _tenant(), _tenant()
    joiner = _user([tenant_a], name="Joiner")
    manager = _user([tenant_b], name="Manager")

    member = TeamMember(name="Alice", country="Sweden", is_deleted=True, deleted_by=joiner)
    Team(tenant=tenant_b, name="Team", team_members=[member]).save()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: manager
    try:
        # Warms a negative entry: joiner is not in tenant B yet.
        first = client.get("/teams/archived-members", headers={"Tenant-ID": tenant_b.identifier})
        assert first.json()["archived_members"][0]["deleted_by"] is None

        joiner.tenants = [tenant_a, tenant_b]
        joiner.save()
        clear_user_dto_cache()  # what the tenant-join paths in users.py now call

        second = client.get("/teams/archived-members", headers={"Tenant-ID": tenant_b.identifier})
        assert second.json()["archived_members"][0]["deleted_by"]["name"] == "Joiner"
    finally:
        app.dependency_overrides = {}


# --- H: regenerating the key invalidates the cache -----------------------------------


def test_regenerate_api_key_invalidates_the_resolver_cache():
    """Asserted against cache_info rather than the response body: now that the shared DTO
    no longer carries api_key, a body assertion would pass whether or not the cache was
    cleared. This is hygiene - keeping regenerate consistent with every other user
    mutation - not a live leak."""
    tenant = _tenant()
    user = _user([tenant], name="Rotator")
    member = TeamMember(name="Alice", country="Sweden", is_deleted=True, deleted_by=user)
    Team(tenant=tenant, name="Team", team_members=[member]).save()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: user
    app.dependency_overrides[get_current_active_user] = lambda: user
    try:
        warm = client.get("/teams/archived-members", headers={"Tenant-ID": tenant.identifier})
        assert warm.status_code == 200
        assert _resolve_user_dto.cache_info().currsize > 0

        rotated = client.post("/users/me/api-key", headers={"Tenant-ID": tenant.identifier})
        assert rotated.status_code == 200
        assert _resolve_user_dto.cache_info().currsize == 0
    finally:
        app.dependency_overrides = {}


def test_member_deleted_by_is_tenant_scoped():
    """TeamMemberReadDTO.convert_deleted_by, reached through GET /teams."""
    tenant_a, tenant_b = _tenant(), _tenant()
    departed = _user([tenant_a, tenant_b], name="Departed")
    caller = _user([tenant_b], name="Caller", role="employee")
    member = TeamMember(name="Alice", country="Sweden", is_deleted=True, deleted_by=departed)
    Team(tenant=tenant_b, name="Team", team_members=[member]).save()
    departed.tenants = [tenant_a]
    departed.save()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: caller
    try:
        response = client.get(
            "/teams?include_archived_members=true", headers={"Tenant-ID": tenant_b.identifier}
        )
        assert response.status_code == 200
        assert departed.name not in response.text
        assert departed.auth_details.api_key not in response.text
    finally:
        app.dependency_overrides = {}


def test_day_audit_actor_is_tenant_scoped():
    """DayAuditDTO.convert_user, reached through the member history endpoint."""
    tenant_a, tenant_b = _tenant(), _tenant()
    departed = _user([tenant_a, tenant_b], name="Departed")
    caller = _user([tenant_b], name="Caller", role="employee")
    member = TeamMember(name="Alice", country="Sweden")
    team = Team(tenant=tenant_b, name="Team", team_members=[member]).save()
    DayAudit(
        tenant=tenant_b,
        team=team,
        member_uid=str(member.uid),
        date=datetime.date(2026, 1, 1),
        user=departed,
        action="updated",
    ).save()
    departed.tenants = [tenant_a]
    departed.save()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: caller
    try:
        response = client.get(
            f"/teams/{team.id}/members/{member.uid}/history",
            headers={"Tenant-ID": tenant_b.identifier},
        )
        assert response.status_code == 200
        assert departed.name not in response.text
        assert departed.auth_details.api_key not in response.text
    finally:
        app.dependency_overrides = {}


def test_from_mongo_reference_field_fails_closed_without_a_tenant():
    """Outside a request there is no tenant to scope against, so the resolver must return
    None rather than query with a null tenant."""
    tenant = _tenant()
    user = _user([tenant], name="Someone")
    token = tenant_var.set(None)
    try:
        assert UserWithoutTenantsDTO.from_mongo_reference_field(user.id) is None
    finally:
        tenant_var.reset(token)


def test_invite_acceptance_invalidates_a_cached_miss():
    """The real join endpoint, not a hand-rolled membership edit - this is what would catch
    a missing or mis-ordered clear_user_dto_cache() in register_user_via_invite."""
    tenant_a, tenant_b = _tenant(), _tenant()
    joiner = _user([tenant_a], name="Joiner")
    manager = _user([tenant_b], name="Manager")

    member = TeamMember(name="Alice", country="Sweden", is_deleted=True, deleted_by=joiner)
    Team(tenant=tenant_b, name="Team", team_members=[member]).save()

    raw_token = uuid.uuid4().hex
    UserInvite(
        email=joiner.email,
        inviter=manager,
        tenant=tenant_b,
        token=hashlib.sha256(raw_token.encode()).hexdigest(),
    ).save()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: manager
    try:
        before = client.get("/teams/archived-members", headers={"Tenant-ID": tenant_b.identifier})
        assert before.json()["archived_members"][0]["deleted_by"] is None  # miss now cached

        registered = client.post(
            f"/users/register/{raw_token}",
            json={
                "name": joiner.name,
                "email": joiner.email,
                "username": str(uuid.uuid4()),
                "password": "pass",
            },
        )
        assert registered.status_code == 200, registered.text[:300]

        after = client.get("/teams/archived-members", headers={"Tenant-ID": tenant_b.identifier})
        assert after.json()["archived_members"][0]["deleted_by"]["name"] == "Joiner"
    finally:
        app.dependency_overrides = {}


def test_unresolvable_subscriber_is_dropped_not_nulled():
    """Exercised at the DTO directly, not through GET /teams.

    Team.list_subscribers already drops ids that do not resolve in the tenant, so the HTTP
    path never hands convert_subscribers an unresolved ObjectId - a route-level test of
    this guard passes whether or not the guard exists. The guard still matters: the field
    is declared List[UserWithoutTenantsDTO], so a None would fail response validation.
    """
    tenant = _tenant()
    token = tenant_var.set(tenant)
    try:
        dto = TeamReadDTO(
            _id=str(ObjectId()),
            name="Team",
            team_members=[],
            subscribers=[ObjectId()],  # resolves to nothing in this tenant
        )
        assert dto.subscribers == []
    finally:
        tenant_var.reset(token)

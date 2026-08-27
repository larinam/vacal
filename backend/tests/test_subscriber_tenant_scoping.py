"""Tenant scoping and lifecycle cleanup for team notification subscribers.

Covers the two halves of the cross-tenant subscription bug: the write side (subscribe /
unsubscribe / notification-preferences used to act on an arbitrary user_id resolved without
a tenant filter) and the read side (list_subscribers resolved those ids unscoped). Also
covers the orphan entries left behind when a user is deleted or leaves a tenant.
"""

import uuid

import pytest
from bson.errors import InvalidId
from fastapi.testclient import TestClient

from backend.dependencies import get_current_active_user_check_tenant, get_current_active_user
from backend.main import app
from backend.model import AuthDetails, DayType, Team, Tenant, User
from backend.notification_types import ABSENCE_DAILY_NOTIFICATION, list_notification_type_ids

client = TestClient(app)


@pytest.fixture(autouse=True)
def _drop_teams_and_tenants():
    """The shared conftest fixture drops Tenant/User/UserInvite but never Team, so teams
    created here would outlive their tenant and leave dangling references for whichever
    test runs next - notably the scheduled-job tests, which iterate Team.objects()."""
    yield
    Team.drop_collection()
    Tenant.drop_collection()
    User.drop_collection()


def _create_user(tenant, *, name="User", disabled=False):
    return User(
        tenants=[tenant],
        name=name,
        email=f"user{uuid.uuid4()}@example.com",
        auth_details=AuthDetails(username=str(uuid.uuid4())),
        disabled=disabled,
    ).save()


def _create_tenant():
    tenant = Tenant(name=f"Tenant-{uuid.uuid4()}", identifier=str(uuid.uuid4())).save()
    DayType.init_day_types(tenant)
    return tenant


def _create_team(tenant):
    return Team(tenant=tenant, name=f"Team-{uuid.uuid4()}").save()


# --- write side: the endpoints no longer act on another user -------------------------


def test_subscribe_ignores_user_id_and_subscribes_the_caller():
    tenant = _create_tenant()
    team = _create_team(tenant)
    caller = _create_user(tenant, name="Caller")
    other_tenant = _create_tenant()
    victim = _create_user(other_tenant, name="Victim")

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: caller
    try:
        response = client.post(
            f"/teams/{team.id}/subscribe?user_id={victim.id}",
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 200
        team.reload()
        assert str(victim.id) not in team.notification_preferences
        assert str(caller.id) in team.notification_preferences
    finally:
        app.dependency_overrides = {}


def test_unsubscribe_ignores_user_id_and_leaves_the_target_subscribed():
    tenant = _create_tenant()
    team = _create_team(tenant)
    caller = _create_user(tenant, name="Caller")
    colleague = _create_user(tenant, name="Colleague")
    team.notification_preferences = {
        str(caller.id): list_notification_type_ids(),
        str(colleague.id): list_notification_type_ids(),
    }
    team.save()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: caller
    try:
        response = client.post(
            f"/teams/{team.id}/unsubscribe?user_id={colleague.id}",
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 200
        team.reload()
        assert str(colleague.id) in team.notification_preferences
        assert str(caller.id) not in team.notification_preferences
    finally:
        app.dependency_overrides = {}


def test_update_notification_preferences_ignores_user_id():
    tenant = _create_tenant()
    team = _create_team(tenant)
    caller = _create_user(tenant, name="Caller")
    colleague = _create_user(tenant, name="Colleague")
    team.notification_preferences = {str(colleague.id): list_notification_type_ids()}
    team.save()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: caller
    try:
        response = client.put(
            f"/teams/{team.id}/notification-preferences",
            json={
                "notification_types": [ABSENCE_DAILY_NOTIFICATION],
                "user_id": str(colleague.id),
            },
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 200
        team.reload()
        assert team.notification_preferences[str(colleague.id)] == list_notification_type_ids()
        assert team.notification_preferences[str(caller.id)] == [ABSENCE_DAILY_NOTIFICATION]
    finally:
        app.dependency_overrides = {}


# --- read side: foreign subscribers are not resolved ---------------------------------


def test_list_subscribers_excludes_users_from_another_tenant():
    tenant = _create_tenant()
    team = _create_team(tenant)
    member = _create_user(tenant, name="Member")
    foreign = _create_user(_create_tenant(), name="Foreign")
    team.notification_preferences = {
        str(member.id): list_notification_type_ids(),
        str(foreign.id): list_notification_type_ids(),
    }
    team.save()

    assert [u.name for u in team.list_subscribers()] == ["Member"]
    assert [u.name for u in team.list_subscribers(tenant)] == ["Member"]


def test_subscribers_endpoint_excludes_users_from_another_tenant():
    tenant = _create_tenant()
    team = _create_team(tenant)
    member = _create_user(tenant, name="Member")
    foreign = _create_user(_create_tenant(), name="Foreign")
    team.notification_preferences = {
        str(member.id): list_notification_type_ids(),
        str(foreign.id): list_notification_type_ids(),
    }
    team.save()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: member
    try:
        response = client.get(
            f"/teams/{team.id}/subscribers", headers={"Tenant-ID": tenant.identifier}
        )
        assert response.status_code == 200
        assert [entry["name"] for entry in response.json()] == ["Member"]

        prefs = client.get(
            f"/teams/{team.id}/notification-preferences",
            headers={"Tenant-ID": tenant.identifier},
        )
        assert prefs.status_code == 200
        assert [entry["user"]["name"] for entry in prefs.json()] == ["Member"]
    finally:
        app.dependency_overrides = {}


# --- notifications skip disabled accounts --------------------------------------------


def test_get_subscriber_emails_skips_disabled_subscribers():
    tenant = _create_tenant()
    team = _create_team(tenant)
    active = _create_user(tenant, name="Active")
    disabled = _create_user(tenant, name="Disabled", disabled=True)
    team.notification_preferences = {
        str(active.id): list_notification_type_ids(),
        str(disabled.id): list_notification_type_ids(),
    }
    team.save()

    emails = team.get_subscriber_emails(ABSENCE_DAILY_NOTIFICATION)
    assert emails == [active.email]


# --- lifecycle cleanup ---------------------------------------------------------------


def test_remove_subscriber_clears_key_across_tenant_including_deleted_teams():
    tenant = _create_tenant()
    other_tenant = _create_tenant()
    user = _create_user(tenant, name="Leaver")
    namesake = _create_user(other_tenant, name="Namesake")

    live = _create_team(tenant)
    archived = _create_team(tenant)
    untouched = _create_team(tenant)
    foreign = _create_team(other_tenant)

    for team in (live, archived, untouched, foreign):
        team.notification_preferences = {str(user.id): list_notification_type_ids()}
        team.save()
    untouched.notification_preferences = {str(namesake.id): list_notification_type_ids()}
    untouched.save()
    archived.is_deleted = True
    archived.save()

    changed = Team.remove_subscriber(tenant, user.id)

    # Matched-vs-modified: only the two teams that actually held the key.
    assert changed == 2
    live.reload()
    archived.reload()
    untouched.reload()
    foreign.reload()
    assert str(user.id) not in live.notification_preferences
    assert str(user.id) not in archived.notification_preferences
    assert str(namesake.id) in untouched.notification_preferences
    assert str(user.id) in foreign.notification_preferences


def test_remove_subscriber_rejects_a_non_objectid_key():
    """An unvalidated key is parsed as a query path, so "in" would become an operator
    and unset the entire notification_preferences map."""
    tenant = _create_tenant()
    team = _create_team(tenant)
    member = _create_user(tenant, name="Member")
    team.notification_preferences = {str(member.id): list_notification_type_ids()}
    team.save()

    for bad_key in ("in", "ne", "S"):
        with pytest.raises(InvalidId):
            Team.remove_subscriber(tenant, bad_key)

    team.reload()
    assert str(member.id) in team.notification_preferences


def test_delete_user_removes_their_subscriber_entries():
    tenant = _create_tenant()
    team = _create_team(tenant)
    manager = _create_user(tenant, name="Manager")
    manager.role = "manager"
    manager.save()
    leaver = _create_user(tenant, name="Leaver")
    team.notification_preferences = {
        str(manager.id): list_notification_type_ids(),
        str(leaver.id): list_notification_type_ids(),
    }
    team.save()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: manager
    try:
        response = client.delete(
            f"/users/{leaver.id}", headers={"Tenant-ID": tenant.identifier}
        )
        assert response.status_code == 200
        team.reload()
        assert str(leaver.id) not in team.notification_preferences
        assert str(manager.id) in team.notification_preferences
    finally:
        app.dependency_overrides = {}


def test_deleting_a_multi_tenant_user_only_clears_the_tenant_they_left():
    tenant = _create_tenant()
    other_tenant = _create_tenant()
    manager = _create_user(tenant, name="Manager")
    manager.role = "manager"
    manager.save()
    leaver = _create_user(tenant, name="Leaver")
    leaver.tenants = [tenant, other_tenant]
    leaver.save()

    team = _create_team(tenant)
    other_team = _create_team(other_tenant)
    for t in (team, other_team):
        t.notification_preferences = {str(leaver.id): list_notification_type_ids()}
        t.save()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: manager
    try:
        response = client.delete(
            f"/users/{leaver.id}", headers={"Tenant-ID": tenant.identifier}
        )
        assert response.status_code == 200
    finally:
        app.dependency_overrides = {}

    team.reload()
    other_team.reload()
    assert str(leaver.id) not in team.notification_preferences
    assert str(leaver.id) in other_team.notification_preferences


def test_remove_tenant_endpoint_clears_subscriber_entries():
    tenant = _create_tenant()
    other_tenant = _create_tenant()
    user = _create_user(tenant, name="Leaver")
    user.tenants = [tenant, other_tenant]
    user.save()

    team = _create_team(tenant)
    kept = _create_team(other_tenant)
    for t in (team, kept):
        t.notification_preferences = {str(user.id): list_notification_type_ids()}
        t.save()

    app.dependency_overrides[get_current_active_user] = lambda: user
    try:
        response = client.delete(f"/users/me/remove-tenant/{tenant.identifier}")
        assert response.status_code == 200
    finally:
        app.dependency_overrides = {}

    team.reload()
    kept.reload()
    assert str(user.id) not in team.notification_preferences
    assert str(user.id) in kept.notification_preferences


def test_remove_tenant_endpoint_returns_404_for_an_unknown_tenant():
    tenant = _create_tenant()
    user = _create_user(tenant, name="User")

    app.dependency_overrides[get_current_active_user] = lambda: user
    try:
        response = client.delete("/users/me/remove-tenant/does-not-exist")
        assert response.status_code == 404
    finally:
        app.dependency_overrides = {}


def test_remove_subscriber_rejects_none():
    """ObjectId(None) mints a fresh random id instead of raising, so a None user_id would
    silently match nothing rather than failing."""
    tenant = _create_tenant()
    with pytest.raises(ValueError):
        Team.remove_subscriber(tenant, None)


def test_list_subscribers_survives_a_dangling_tenant_reference():
    """get_subscriber_emails newly dereferences self.tenant; a dangling reference must not
    abort a scheduled notification fan-out."""
    tenant = _create_tenant()
    team = _create_team(tenant)
    member = _create_user(tenant, name="Member")
    team.notification_preferences = {str(member.id): list_notification_type_ids()}
    team.save()

    Tenant.objects(id=tenant.id).delete()

    assert team.list_subscribers() == []
    assert team.get_subscriber_emails(ABSENCE_DAILY_NOTIFICATION) == []

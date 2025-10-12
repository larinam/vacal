import uuid

from fastapi.testclient import TestClient

from backend.dependencies import get_current_active_user_check_tenant
from backend.main import app
from backend.model import AuthDetails, DayType, Team, Tenant, User
from backend.notification_types import (
    ABSENCE_DAILY_NOTIFICATION,
    BIRTHDAY_DAILY_NOTIFICATION,
    list_notification_type_ids,
)

client = TestClient(app)


def _create_team_with_user():
    tenant = Tenant(name=f"Tenant-{uuid.uuid4()}", identifier=str(uuid.uuid4())).save()
    DayType.init_day_types(tenant)
    user = User(
        tenants=[tenant],
        name="User",
        email=f"user{uuid.uuid4()}@example.com",
        auth_details=AuthDetails(username=str(uuid.uuid4())),
    ).save()
    team = Team(tenant=tenant, name=f"Team-{uuid.uuid4()}").save()
    return tenant, team, user


def test_subscribe_assigns_all_notification_types():
    tenant, team, user = _create_team_with_user()
    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: user
    try:
        response = client.post(
            f"/teams/{team.id}/subscribe",
            headers={"Tenant-ID": tenant.identifier},
        )
        assert response.status_code == 200
        team.reload()
        user_preferences = team.notification_preferences.get(str(user.id))
        assert user_preferences is not None
        assert set(user_preferences) == set(list_notification_type_ids())
        assert team.is_subscribed(user)
    finally:
        app.dependency_overrides = {}


def test_update_notification_preferences_and_unsubscribe_allows_customization():
    tenant, team, user = _create_team_with_user()
    team.notification_preferences[str(user.id)] = list_notification_type_ids()
    team.save()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: user
    try:
        update_response = client.put(
            f"/teams/{team.id}/notification-preferences",
            json={"notification_types": [ABSENCE_DAILY_NOTIFICATION, BIRTHDAY_DAILY_NOTIFICATION]},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert update_response.status_code == 200
        team.reload()
        assert team.notification_preferences[str(user.id)] == [
            ABSENCE_DAILY_NOTIFICATION,
            BIRTHDAY_DAILY_NOTIFICATION,
        ]

        removal_response = client.put(
            f"/teams/{team.id}/notification-preferences",
            json={"notification_types": []},
            headers={"Tenant-ID": tenant.identifier},
        )
        assert removal_response.status_code == 200
        team.reload()
        assert str(user.id) not in team.notification_preferences
        assert not team.is_subscribed(user)
    finally:
        app.dependency_overrides = {}

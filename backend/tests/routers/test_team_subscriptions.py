import uuid

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.model import (
    Tenant,
    Team,
    User,
    AuthDetails,
    TeamMember,
    DayType,
    NotificationTopic,
)
from backend.dependencies import get_current_active_user_check_tenant, get_tenant

client = TestClient(app)


@pytest.fixture(autouse=True)
def cleanup_collections():
    Tenant.drop_collection()
    Team.drop_collection()
    User.drop_collection()
    DayType.drop_collection()
    yield
    Tenant.drop_collection()
    Team.drop_collection()
    User.drop_collection()
    DayType.drop_collection()


def _create_tenant_user_and_team():
    tenant = Tenant(name=f"Tenant {uuid.uuid4()}", identifier=str(uuid.uuid4())).save()
    DayType.init_day_types(tenant)
    user = User(
        tenants=[tenant],
        name="Owner",
        email=f"user{uuid.uuid4()}@example.com",
        auth_details=AuthDetails(username=str(uuid.uuid4())),
    ).save()
    team = Team(
        tenant=tenant,
        name="Team Alpha",
        team_members=[TeamMember(name="Alice", country="Sweden")],
    ).save()
    return tenant, user, team


def test_subscribe_user_with_specific_topics():
    tenant, user, team = _create_tenant_user_and_team()

    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: user
    app.dependency_overrides[get_tenant] = lambda: tenant

    response = client.post(
        f"/teams/{team.id}/subscribe",
        json={"notification_topics": [NotificationTopic.BIRTHDAYS.value]},
        headers={"Tenant-ID": tenant.identifier},
    )
    assert response.status_code == 200
    team.reload()
    assert len(team.notification_subscriptions) == 1
    subscription = team.notification_subscriptions[0]
    assert subscription.user == user
    assert subscription.topics == [NotificationTopic.BIRTHDAYS.value]

    response = client.post(
        f"/teams/{team.id}/subscribe",
        json={
            "notification_topics": [
                NotificationTopic.BIRTHDAYS.value,
                NotificationTopic.RECENT_ABSENCES.value,
            ]
        },
        headers={"Tenant-ID": tenant.identifier},
    )
    assert response.status_code == 200
    team.reload()
    subscription = team.notification_subscriptions[0]
    updated_topics = subscription.topics
    assert updated_topics == sorted(
        [NotificationTopic.BIRTHDAYS.value, NotificationTopic.RECENT_ABSENCES.value]
    )

    response = client.get(
        f"/teams/{team.id}/subscriptions",
        headers={"Tenant-ID": tenant.identifier},
    )
    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["user"]["_id"] == str(user.id)
    assert sorted(payload[0]["topics"]) == sorted(
        [NotificationTopic.BIRTHDAYS.value, NotificationTopic.RECENT_ABSENCES.value]
    )

    topics_response = client.get("/teams/notification-topics")
    assert topics_response.status_code == 200
    assert sorted(topics_response.json()) == sorted([topic.value for topic in NotificationTopic])

    unsubscribe_response = client.post(
        f"/teams/{team.id}/unsubscribe",
        headers={"Tenant-ID": tenant.identifier},
    )
    assert unsubscribe_response.status_code == 200
    team.reload()
    assert team.notification_subscriptions == []

    app.dependency_overrides = {}

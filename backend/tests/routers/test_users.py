from unittest.mock import patch
import os
from unittest.mock import patch

# Use in-memory MongoDB for tests
os.environ.setdefault("MONGO_MOCK", "1")
os.environ.setdefault("AUTHENTICATION_SECRET_KEY", "test_secret")

import pytest
from bson.objectid import ObjectId
from fastapi.testclient import TestClient

from backend.main import app
from backend.model import User, AuthDetails, Tenant
from backend.dependencies import (get_current_user, get_current_active_user,
                                  get_current_active_user_check_tenant, get_tenant)

client = TestClient(app)


def test_create_initial_user():
    response = client.post("/users/create-initial",
                           json={"tenant": {"name": "foobar", "identifier": "barfoo"}, "name": "Foo Bar",
                                 "email": "foo@bar.dom",
                                 "username": "username", "password": "password",
                                 "telegram_username": "telegram_username"},
                           )
    assert response.status_code == 200
    assert response.json() == {"message": "Initial user created successfully"}
    created_user = User.objects(auth_details__username="username").first()
    assert created_user is not None
    assert created_user.role == "manager"


@pytest.fixture
def mock_tenant():
    return Tenant(
        id=ObjectId(),
        name="Test Tenant",
        identifier="test-tenant"
    )


@pytest.fixture
def mock_user(mock_tenant):
    return User(
        id=ObjectId(),
        name="Test User",
        email="test@example.com",
        auth_details=AuthDetails(username="testuser"),
        tenants=[mock_tenant],  # Use the mock_tenant here
        disabled=False,
        role="manager"
    )


def test_read_users(mock_user, mock_tenant):
    # Mock the dependencies
    with patch('backend.dependencies.get_current_user', return_value=mock_user), \
         patch('backend.dependencies.get_current_active_user', return_value=mock_user), \
         patch('backend.dependencies.get_tenant', return_value=mock_tenant), \
         patch('backend.model.Tenant.objects') as mock_tenant_objects, \
         patch('backend.dependencies.get_current_active_user_check_tenant', return_value=mock_user), \
         patch('backend.model.User.objects') as mock_user_objects, \
         patch('backend.model.User.get_by_username', return_value=mock_user), \
         patch('backend.dependencies.oauth2_scheme', return_value="mocked_token"):

        # Setup the mock for User.objects
        mock_user_objects.return_value.all.return_value = [mock_user]
        mock_user_objects.return_value.order_by.return_value.all.return_value = [mock_user]
        mock_tenant_objects.return_value.first.return_value = mock_tenant

        # Mock jwt.decode to return a valid payload
        with patch('jwt.decode', return_value={"sub": "testuser"}):
            # Make the request
            response = client.get("/users", headers={"Tenant-ID": "test-tenant", "Authorization": "Bearer mocked_token"})

        print(f"\n\nResponse body: {response.json()}")
        # Check the response
        assert response.status_code == 200, f"Unexpected status code: {response.status_code}. Response: {response.json()}"
        users = response.json()
        assert len(users) == 1
        assert users[0]["name"] == "Test User"
        assert users[0]["email"] == "test@example.com"
        assert users[0]["username"] == "testuser"
        assert users[0]["role"] == "manager"
        assert "_id" in users[0]

        # Verify that the correct query was made
        mock_user_objects.assert_called_once()
        mock_user_objects.assert_called_once_with(tenants__in=[mock_tenant])


def test_manager_cannot_demote_self():
    tenant = Tenant(name="Manager Tenant", identifier="manager-tenant")
    tenant.save()
    user = User(
        name="Manager",
        email="manager@example.com",
        auth_details=AuthDetails(username="manager"),
        tenants=[tenant],
        disabled=False,
        role="manager"
    )
    user.save()

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_current_active_user] = lambda: user
    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: user
    app.dependency_overrides[get_tenant] = lambda: tenant

    try:
        response = client.put(
            f"/users/{user.id}",
            headers={"Tenant-ID": tenant.identifier},
            json={
                "name": user.name,
                "email": user.email,
                "username": user.auth_details.username,
                "telegram_username": user.auth_details.telegram_username,
                "disabled": user.disabled,
                "role": "employee"
            }
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 400
    assert response.json() == {"detail": "Managers cannot demote themselves."}


def test_employee_cannot_promote_user():
    tenant = Tenant(name="Employee Tenant", identifier="employee-tenant")
    tenant.save()
    employee_user = User(
        name="Employee",
        email="employee@example.com",
        auth_details=AuthDetails(username="employee"),
        tenants=[tenant],
        disabled=False,
        role="employee"
    )
    employee_user.save()
    target_user = User(
        name="Target",
        email="target@example.com",
        auth_details=AuthDetails(username="target"),
        tenants=[tenant],
        disabled=False,
        role="employee"
    )
    target_user.save()

    app.dependency_overrides[get_current_user] = lambda: employee_user
    app.dependency_overrides[get_current_active_user] = lambda: employee_user
    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: employee_user
    app.dependency_overrides[get_tenant] = lambda: tenant

    try:
        response = client.put(
            f"/users/{target_user.id}",
            headers={"Tenant-ID": tenant.identifier},
            json={
                "name": target_user.name,
                "email": target_user.email,
                "username": target_user.auth_details.username,
                "telegram_username": target_user.auth_details.telegram_username,
                "disabled": target_user.disabled,
                "role": "manager"
            }
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 403
    assert response.json() == {"detail": "Only managers can promote users."}


def test_remove_tenant(mock_user, mock_tenant):
    other_tenant = Tenant(
        id=ObjectId(),
        name="Other Tenant",
        identifier="other-tenant",
    )
    mock_user.tenants = [mock_tenant, other_tenant]

    with patch('backend.dependencies.get_current_user', return_value=mock_user), \
         patch('backend.dependencies.get_current_active_user', return_value=mock_user), \
         patch('backend.dependencies.oauth2_scheme', return_value="mocked_token"), \
         patch('backend.model.Tenant.objects') as mock_tenant_objects, \
         patch('backend.model.User.get_by_username', return_value=mock_user), \
         patch('jwt.decode', return_value={"sub": "testuser"}), \
         patch.object(mock_user, 'remove_tenant') as mock_remove_tenant:

        mock_tenant_objects.return_value.first.return_value = other_tenant

        response = client.delete(
            f"/users/me/remove-tenant/{other_tenant.identifier}",
            headers={"Authorization": "Bearer mocked_token"}
        )

    assert response.status_code == 200
    assert response.json() == {"message": "Tenant removed."}
    mock_remove_tenant.assert_called_once_with(other_tenant)

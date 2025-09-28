from unittest.mock import patch
import os

# Use in-memory MongoDB for tests
os.environ.setdefault("MONGO_MOCK", "1")
os.environ.setdefault("AUTHENTICATION_SECRET_KEY", "test_secret")

import pytest
from bson.objectid import ObjectId
from fastapi.testclient import TestClient

from ..main import app
from ..model import User, AuthDetails, Tenant, UserRole

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

    user = User.objects().first()
    assert user.role == UserRole.MANAGER


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
        role=UserRole.MANAGER,
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
        assert users[0]["role"] == UserRole.MANAGER.value
        assert "_id" in users[0]

        # Verify that the correct query was made
        mock_user_objects.assert_called_once()
        mock_user_objects.assert_called_once_with(tenants__in=[mock_tenant])


def test_update_user_role(mock_tenant):
    tenant = Tenant(name="Role Tenant", identifier="role-tenant")
    tenant.save()

    user = User(
        name="Employee",
        email="employee@example.com",
        auth_details=AuthDetails(username="employee"),
        tenants=[tenant],
        role=UserRole.EMPLOYEE,
    )
    user.save()

    manager = User(
        name="Manager",
        email="manager@example.com",
        auth_details=AuthDetails(username="manager"),
        tenants=[tenant],
        role=UserRole.MANAGER,
    )
    manager.save()

    with patch('backend.routers.users.get_current_active_user_check_tenant', return_value=manager), \
         patch('backend.routers.users.get_tenant', return_value=tenant), \
         patch('jwt.decode', return_value={"sub": "manager"}):
        response = client.put(
            f"/users/{user.id}",
            headers={"Authorization": "Bearer mocked_token", "Tenant-ID": tenant.identifier},
            json={
                "name": "Employee",
                "email": "employee@example.com",
                "username": "employee",
                "telegram_username": None,
                "role": UserRole.MANAGER.value,
            },
        )

    assert response.status_code == 200
    user.reload()
    assert user.role == UserRole.MANAGER


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

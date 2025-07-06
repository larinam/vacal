from unittest.mock import patch
import os

# Use in-memory MongoDB for tests
os.environ.setdefault("MONGO_MOCK", "1")
os.environ.setdefault("AUTHENTICATION_SECRET_KEY", "test_secret")

import pytest
from bson.objectid import ObjectId
from fastapi.testclient import TestClient

from ..main import app
from ..model import User, AuthDetails, Tenant

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
        disabled=False
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
        assert "_id" in users[0]

        # Verify that the correct query was made
        mock_user_objects.assert_called_once()
        mock_user_objects.assert_called_once_with(tenants__in=[mock_tenant])

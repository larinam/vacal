"""Tests for user self-edit via PUT /users/{user_id} with different roles."""

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.model import User, AuthDetails, Tenant
from backend.dependencies import (get_current_user, get_current_active_user,
                                  get_current_active_user_check_tenant, get_tenant)

pytestmark = pytest.mark.usefixtures("clean_user_collections")

client = TestClient(app)


def _create_user_and_tenant(suffix, role="employee"):
    tenant = Tenant(name=f"Tenant {suffix}", identifier=f"tenant-{suffix}")
    tenant.save()
    user = User(
        name="Original Name",
        email=f"user-{suffix}@example.com",
        auth_details=AuthDetails(username=f"user-{suffix}"),
        tenants=[tenant],
        disabled=False,
        role=role,
    )
    user.save()
    return user, tenant


def _override_deps(user, tenant):
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_current_active_user] = lambda: user
    app.dependency_overrides[get_current_active_user_check_tenant] = lambda: user
    app.dependency_overrides[get_tenant] = lambda: tenant


def _clear_deps():
    app.dependency_overrides.clear()


# --- Happy path: employee edits own basic info ---

def test_employee_can_edit_own_name(unique_suffix):
    """An employee should be able to update their own name."""
    user, tenant = _create_user_and_tenant(unique_suffix, role="employee")
    _override_deps(user, tenant)
    try:
        response = client.put(
            f"/users/{user.id}",
            headers={"Tenant-ID": tenant.identifier},
            json={
                "name": "Updated Name",
                "email": user.email,
                "username": user.auth_details.username,
                "telegram_username": user.auth_details.telegram_username,
            },
        )
    finally:
        _clear_deps()

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.json()}"
    user.reload()
    assert user.name == "Updated Name"


def test_employee_can_edit_own_info_with_disabled_false(unique_suffix):
    """An employee editing themselves with disabled=false (as the frontend sends)
    should succeed, since the value is unchanged."""
    user, tenant = _create_user_and_tenant(unique_suffix, role="employee")
    _override_deps(user, tenant)
    try:
        response = client.put(
            f"/users/{user.id}",
            headers={"Tenant-ID": tenant.identifier},
            json={
                "name": "Updated Name",
                "email": user.email,
                "username": user.auth_details.username,
                "telegram_username": user.auth_details.telegram_username,
                "disabled": False,
                "role": "employee",
            },
        )
    finally:
        _clear_deps()

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.json()}"
    user.reload()
    assert user.name == "Updated Name"
    assert user.disabled is False


# --- Happy path: manager edits own basic info ---

def test_manager_can_edit_own_name(unique_suffix):
    """A manager should be able to update their own name."""
    user, tenant = _create_user_and_tenant(unique_suffix, role="manager")
    _override_deps(user, tenant)
    try:
        response = client.put(
            f"/users/{user.id}",
            headers={"Tenant-ID": tenant.identifier},
            json={
                "name": "Manager New Name",
                "email": user.email,
                "username": user.auth_details.username,
                "telegram_username": user.auth_details.telegram_username,
                "disabled": False,
                "role": "manager",
            },
        )
    finally:
        _clear_deps()

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.json()}"
    user.reload()
    assert user.name == "Manager New Name"


# --- Negative: employee cannot escalate privileges ---

def test_employee_cannot_change_own_role(unique_suffix):
    """An employee should not be able to promote themselves to manager."""
    user, tenant = _create_user_and_tenant(unique_suffix, role="employee")
    _override_deps(user, tenant)
    try:
        response = client.put(
            f"/users/{user.id}",
            headers={"Tenant-ID": tenant.identifier},
            json={
                "name": user.name,
                "email": user.email,
                "username": user.auth_details.username,
                "telegram_username": user.auth_details.telegram_username,
                "role": "manager",
            },
        )
    finally:
        _clear_deps()

    assert response.status_code == 403
    user.reload()
    assert user.role == "employee"


def test_employee_cannot_disable_themselves(unique_suffix):
    """An employee should not be able to set disabled=true on themselves."""
    user, tenant = _create_user_and_tenant(unique_suffix, role="employee")
    _override_deps(user, tenant)
    try:
        response = client.put(
            f"/users/{user.id}",
            headers={"Tenant-ID": tenant.identifier},
            json={
                "name": user.name,
                "email": user.email,
                "username": user.auth_details.username,
                "telegram_username": user.auth_details.telegram_username,
                "disabled": True,
            },
        )
    finally:
        _clear_deps()

    assert response.status_code == 403
    user.reload()
    assert user.disabled is False

import os
import uuid

os.environ.setdefault("MONGO_MOCK", "1")
os.environ.setdefault("AUTHENTICATION_SECRET_KEY", "test_secret")
os.environ.setdefault("TELEGRAM_BOT_TOKEN", "testtoken")
os.environ.setdefault("TELEGRAM_BOT_USERNAME", "testbot")
os.environ.setdefault("GOOGLE_CLIENT_ID", "test-google-client")

import pytest

from backend.model import Tenant, User, UserInvite


@pytest.fixture
def clean_user_collections():
    """Ensure user related collections start empty for each test."""

    for model in (Tenant, User, UserInvite):
        model.drop_collection()

    yield

    for model in (Tenant, User, UserInvite):
        model.drop_collection()


@pytest.fixture
def unique_suffix():
    """Provide a random suffix for test data that must be unique."""

    return uuid.uuid4().hex

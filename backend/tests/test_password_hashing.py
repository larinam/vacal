import uuid
from backend.model import Tenant, User, AuthDetails
from pwdlib.hashers.bcrypt import BcryptHasher


def test_verify_legacy_bcrypt_password():
    tenant = Tenant(name=str(uuid.uuid4()), identifier=str(uuid.uuid4())).save()
    bcrypt_hash = BcryptHasher().hash("secret")
    user = User(
        tenants=[tenant],
        name="User",
        email="u@example.com",
        auth_details=AuthDetails(username="user", hashed_password=bcrypt_hash),
    )
    assert user.verify_password("secret")


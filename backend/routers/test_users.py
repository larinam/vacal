from fastapi.testclient import TestClient
from ..main import app

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

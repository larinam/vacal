from fastapi.testclient import TestClient
from .main import app

client = TestClient(app)


def test_read_config():
    response = client.get("/config")
    assert response.status_code == 200

    config = response.json()
    assert config, "Response JSON should not be empty"
    assert isinstance(config, dict), "Response should be a JSON object"
    assert len(config) == 4, "Config should contain four key-value pairs"

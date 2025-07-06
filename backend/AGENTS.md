## Automatic testing
Run backend tests only in case there were backend changes.

### Running tests
The test suite uses an in-memory MongoDB when the `MONGO_MOCK` environment
variable is set. The test files set this variable automatically, so running the
tests is as simple as:

```
pip install -r backend/requirements.txt
pip install httpx  # required by FastAPI TestClient
pytest backend
```

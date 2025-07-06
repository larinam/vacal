## Automatic testing
Run backend tests only in case there were backend changes.

### Running tests locally
The test suite uses an in-memory MongoDB when the `MONGO_MOCK` environment
variable is set. The test files set this variable automatically, so running the
tests is as simple as:

```
pip install -r backend/requirements.txt
pip install httpx  # required by FastAPI TestClient
pytest backend
```

If running tests manually, ensure `AUTHENTICATION_SECRET_KEY` is defined (any
value is fine) and `MONGO_MOCK=1` so that the real database is not required.

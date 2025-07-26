## Data migrations

In `backend/db_migrations` sit mongodb migrations, when the schema is modified, and it is supposed to have some default
values to be populated, take inspiration from existing migrations and write the appropriate migration.


## Automatic Testing Guidelines

### When to run tests  
Run backend tests only if you’ve modified backend code.

### Setup & Execution  
The suite uses an in-memory MongoDB when `MONGO_MOCK=true`. Test files set this automatically. To install dependencies and run:

```bash
pip install -r backend/requirements.txt
pip install httpx    # for FastAPI TestClient
pytest backend
```

### Writing Tests

* **New functionality**
  Write at least one meaningful unit or integration test covering core behavior and critical edge cases.

* **Review existing tests**
  Update any tests affected by your changes: adjust assertions or setup, refactor, or remove obsolete tests.

* **Best practices**
  * Tests should reside in the same package as the module they test.
  * Use pytest fixtures and mocks to isolate external dependencies.
  * Give tests clear, descriptive names.
  * Keep tests fast, deterministic, and focused on a single behavior.
  * Ensure 100% coverage for new code before pushing.

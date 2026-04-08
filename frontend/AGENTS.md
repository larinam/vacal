## Automatic testing
Run frontend tests only in case there were frontend changes.

To run tests, execute the following from the `frontend/` directory:
```bash
npm test -- --run
```
The `--run` flag is required to run tests in single-pass mode. Without it, Vitest starts in interactive watch mode, which will hang.

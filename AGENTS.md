# Vacal - VACation CALendar

It is a 3-tier application, consisting of three logical layers: the presentation tier, the application tier, and the
data tier.

* presentation — frontend/
* application — frontend/ and backend/
* data — mongodb.

There is additional information about backend and frontend in the respective folders in AGENTS.md files.

## Workflow

When starting a task, please determine whether the solution should be implemented in the backend, the frontend, or both,
and proceed accordingly.

## Security Considerations

When implementing any task, think about security at every layer:

* **Authentication & Authorization**: Ensure proper user identity verification and enforce least-privilege access
  controls. Use established frameworks for authentication (e.g., OAuth, JWT) and validate roles/permissions server-side.
* **Input Validation & Sanitization**: Validate and sanitize all inputs on both frontend and backend to prevent
  injection attacks (XSS, SQL/NoSQL injection).
* **Secure Data Handling**: Encrypt sensitive data in transit (TLS/HTTPS) and at rest (database encryption). Manage
  secrets (API keys, certificates) using secure vaults or environment variables—never commit secrets to source control.
* **Dependency Management**: Keep libraries and frameworks up to date. Regularly run dependency vulnerability scans (
  e.g., npm audit, Snyk).
* **Error Handling & Logging**: Avoid leaking stack traces or sensitive information in error messages. Log
  security-relevant events centrally and monitor for anomalies.
* **OWASP Best Practices**: Consult the OWASP Top Ten and apply recommended mitigations throughout the implementation.
* **Secure Configuration**: Review production configurations (CORS, CSP, HTTP headers) to harden your application
  against common web threats.

## Documentation

If the change to the product is significant, please suggest an adjustment to the README.md file.
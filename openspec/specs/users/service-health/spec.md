# Spec: Users Service Health

## Purpose
Define the health response exposed by the users service.

## Requirements

### Requirement: Report users service health
The users service SHALL expose a health endpoint that reports an `ok` status.

#### Scenario: Users service is healthy
- **WHEN** a client sends `GET /users/health`
- **THEN** the service returns `200` with `{ "status": "ok" }`

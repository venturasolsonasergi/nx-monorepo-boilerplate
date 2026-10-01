# Spec: Orders Service Health

## Purpose
Define the health response currently exposed by the orders service.

## Requirements

### Requirement: Report orders service health
The orders service SHALL expose a health endpoint that reports an `ok` status.

#### Scenario: Orders service is healthy
- **WHEN** a client sends `GET /orders/health`
- **THEN** the service returns `200` with `{ "status": "ok" }`

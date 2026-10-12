# production-runtime Specification

## Purpose

Define how the API host process behaves in a production deployment: it starts only after pending database migrations are applied, and it stops gracefully on termination signals so in-flight requests finish and database connections close.

## Requirements

### Requirement: Start after applying pending migrations

The API host process, when deployed as a production container, SHALL apply pending database migrations for every service that owns migrations before it starts accepting HTTP requests. Migration application SHALL be idempotent: re-running it with no pending migrations SHALL make no schema changes and SHALL NOT prevent startup. If any migration fails to apply, the process SHALL exit without serving traffic.

#### Scenario: Pending migrations are applied before serving

- **WHEN** a production deployment starts while a service's database has pending migrations
- **THEN** the pending migrations are applied to that service's database before the API answers any HTTP request

#### Scenario: Startup without pending migrations

- **WHEN** a production deployment starts and every service database is already at the latest migration
- **THEN** the API starts and serves traffic without applying any schema change

#### Scenario: Failed migration prevents startup

- **WHEN** a pending migration fails to apply during a production deployment start
- **THEN** the process exits with a failure outcome, serves no HTTP traffic, and the databases are left without a partially applied migration state that blocks the next attempt

### Requirement: Stop gracefully on termination

The API host process SHALL handle termination signals (`SIGTERM`, `SIGINT`) by stopping acceptance of new requests, completing already accepted in-flight requests, closing database connections through the existing shutdown lifecycle, and then exiting. The process SHALL NOT drop in-flight requests on a normal termination signal.

#### Scenario: In-flight request completes during shutdown

- **WHEN** the process receives a termination signal while an HTTP request is being handled
- **THEN** that request completes with its normal response and no database connection it used is left open after the process exits

#### Scenario: New requests are not accepted during shutdown

- **WHEN** the process has received a termination signal and a new HTTP request arrives
- **THEN** the process does not accept the request into handling and subsequently exits

#### Scenario: Database connections close on shutdown

- **WHEN** the process shuts down after receiving a termination signal
- **THEN** every database connection pool opened by the process is closed before exit

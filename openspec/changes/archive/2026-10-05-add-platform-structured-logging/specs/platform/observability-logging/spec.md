# Spec Delta

## Purpose

Define the observable operational logging behavior of the NestJS API process — level control, run and module context, per-request correlation, sensitive-data redaction, body-logging prohibition, error logging, and separation from durable business audit — so that a single runtime logging contract applies across every module hosted in `apps/api`.

## ADDED Requirements

### Requirement: Emit structured operational logs

The API process SHALL emit operational logs as structured, machine-parseable entries in production and as human-readable entries in development, and SHALL NOT write unstructured free-form log lines in production.

#### Scenario: Structured production output

- **WHEN** the API process runs in production and emits an operational log entry
- **THEN** that entry is emitted as a single structured record whose fields are individually addressable, and not as an unstructured interpolated string

#### Scenario: Readable development output

- **WHEN** the API process runs in development and emits an operational log entry
- **THEN** that entry is emitted in a human-readable form while preserving the same entry fields the production record carries

### Requirement: Control the operational log level

The API process SHALL apply a single minimum log level for the whole process. It SHALL use `LOG_LEVEL` when configured; otherwise it SHALL default to `warn` when `NODE_ENV` is `production` and `info` in non-production environments.

#### Scenario: Level filters entries

- **WHEN** the configured minimum level is informational and a debug-level entry is emitted
- **THEN** the debug entry is suppressed while entries at informational level and above are emitted

#### Scenario: Production default level when unconfigured

- **WHEN** the API process starts without an explicit level configuration
- **AND** `NODE_ENV` is `production`
- **THEN** it emits warning and error entries and suppresses informational and lower entries

#### Scenario: Non-production default level when unconfigured

- **WHEN** the API process starts without an explicit level configuration
- **AND** `NODE_ENV` is not `production`
- **THEN** it emits informational and higher entries and suppresses debug entries

#### Scenario: Configured level overrides the environment default

- **WHEN** `LOG_LEVEL` contains a supported Pino level
- **THEN** the process uses that level in every environment instead of the environment default

### Requirement: Identify run and module context

Every operational log entry SHALL identify the emitting API process with `service: api`, an `environment` field derived from `NODE_ENV` (defaulting to `development` when unset), and the operational module with a `module` field whose value is `api`, `auth`, `users`, or `orders`. Entries from different modules SHALL be distinguishable by the `module` field without separate logger configuration.

#### Scenario: Module context is present

- **WHEN** a module hosted in `apps/api` emits an operational log entry
- **THEN** the entry identifies the API process and that module, and entries from two different modules are distinguishable by their module context alone

#### Scenario: One process, one configuration

- **WHEN** two modules hosted in `apps/api` emit operational log entries
- **THEN** both entries are produced under the same process-wide logging configuration and neither module owns an independent logging configuration

### Requirement: Correlate logs by request

The API process SHALL assign a request correlation identifier to every handled request. It SHALL reuse an inbound `x-request-id` only when it is a single value of 1-128 ASCII letters, digits, periods, underscores, or hyphens; otherwise it SHALL generate a new identifier. The resolved identifier SHALL be included on every log entry emitted while handling that request and returned in the `x-request-id` response header. The API SHALL expose this response header to permitted browser origins.

#### Scenario: Inbound correlation identifier is reused

- **WHEN** a request arrives carrying an `x-request-id` header
- **THEN** every log entry emitted while handling that request carries that same value and the response returns that same value in the `x-request-id` header

#### Scenario: Missing correlation identifier is generated
- **WHEN** a request arrives without an `x-request-id` header
- **THEN** the process generates a correlation identifier, attaches it to every log entry emitted while handling the request, and returns it in the `x-request-id` response header

#### Scenario: Invalid correlation identifier is replaced
- **WHEN** a request arrives with an `x-request-id` that is repeated, longer than 128 characters, or contains characters outside ASCII letters, digits, periods, underscores, or hyphens
- **THEN** the process generates a new correlation identifier, uses that value on every log entry for the request, and returns that value in the `x-request-id` response header

#### Scenario: Correlation header is available to browser clients
- **WHEN** a permitted browser origin makes a cross-origin request to the API
- **THEN** the response includes `x-request-id` and exposes that header to the browser client

### Requirement: Redact sensitive data

The API process SHALL redact credentials, cookies, tokens, passwords, payment card numbers, card security codes, and other secrets from operational log output before emission, including values nested in structured log fields, and SHALL NOT emit such values in plaintext.

#### Scenario: Sensitive headers are redacted

- **WHEN** a request or response carries an authorization header, a cookie header, or a set-cookie header and the process logs that request or response context
- **THEN** the header values appear as redaction markers and the original secrets are absent from the output

#### Scenario: Sensitive fields are redacted

- **WHEN** an operational log entry includes a token, password, secret, credential, payment card number, or card security code, whether at the top level or nested inside a structured field
- **THEN** that value appears as a redaction marker and the original value is absent from the output

### Requirement: Do not log request or response bodies by default

The API process SHALL NOT record request or response bodies in operational logs by default, including on error paths, and this change SHALL NOT provide an opt-in that records them.

#### Scenario: Successful request body is not logged

- **WHEN** a request with a body succeeds
- **THEN** no log entry contains the request body or the response body content

#### Scenario: Failed request body is not logged

- **WHEN** a request with a body fails or is rejected
- **THEN** the emitted error log identifies the failure, route, method, and status or error condition without containing the request or response body content

### Requirement: Do not log sensitive URL values
The API process SHALL NOT include query-string values or raw route-parameter values in operational logs. Request logs MAY include the HTTP method and route template.

#### Scenario: URL contains sensitive values
- **WHEN** a request URL contains query-string values or raw route-parameter values, including credentials or tokens
- **THEN** operational logs contain neither those values nor the raw URL, and MAY identify the request using its method and route template

### Requirement: Log failed HTTP requests in a standard structured form

For each HTTP response with a 4xx or 5xx status, the API process SHALL emit exactly one structured failure record containing `requestId`, `module`, and `http.method`, `http.route`, and `http.statusCode`. It SHALL log 4xx responses at `warn` and 5xx responses at `error`. When an unexpected exception caused the failure, the record SHALL include a serialized `err` object with its type, message, and stack when available. Error records SHALL not include request or response bodies, raw URLs, or unredacted sensitive values. This requirement standardizes operational logs only and SHALL NOT change existing HTTP response status codes or body schemas.

#### Scenario: Client and server HTTP failures have standard records

- **WHEN** a handled request returns a 4xx or 5xx response
- **THEN** exactly one failure record includes the request identifier, module, method, route template, and status code, with `warn` for 4xx and `error` for 5xx

#### Scenario: Unexpected request exception is serialized

- **WHEN** an unexpected exception during request handling causes a 5xx response
- **THEN** the single failure record includes a structured `err` object with type, message, and stack when available, excludes request/response bodies and sensitive values, and the process continues serving subsequent requests

#### Scenario: HTTP error response contract is preserved

- **WHEN** the API returns an HTTP error response
- **THEN** its status and body remain as defined by the existing service contract; operational logging does not replace the response with a different error format

### Requirement: Keep operational logging separate from business audit

Operational logs SHALL NOT be the durable record of business facts or decisions, and this capability MUST NOT be used to satisfy a business audit requirement.

#### Scenario: Business audit is not derived from operational logs

- **WHEN** a business action requires a durable audit record
- **THEN** the operational logging behavior defined here is not used as that record, and the capability provides no retention or queryability guarantee for business audit

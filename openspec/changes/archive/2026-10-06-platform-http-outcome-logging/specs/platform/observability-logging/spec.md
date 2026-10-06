# Spec Delta

## MODIFIED Requirements

### Requirement: Log failed HTTP requests in a standard structured form

For each 4xx or 5xx HTTP response that reports a failed or rejected request, the API process SHALL emit exactly one structured failure record containing `requestId`, `module`, `http.method`, `http.route`, and `http.statusCode`, logged at `warn` for 4xx and `error` for 5xx. The expected anonymous session probe — a `POST /auth/refresh` request answered with `401` because no active session exists — SHALL be treated as a normal outcome rather than a failure: it SHALL be logged at `debug` with a non-failure message and SHALL NOT produce a `warn` failure record. An unexpected exception SHALL add a serialized `err` object with type, message, and stack when available. Records SHALL exclude bodies, raw URLs, and unredacted secrets.

#### Scenario: Client and server HTTP failures have standard records

- **WHEN** a handled request other than the expected anonymous session probe returns a 4xx or 5xx response
- **THEN** exactly one failure record includes the request identifier, module, method, route template, and status code, with `warn` for 4xx and `error` for 5xx

#### Scenario: Expected anonymous session probe is not a failure

- **WHEN** a `POST /auth/refresh` request is answered with `401` because no active session exists
- **THEN** exactly one record includes the request identifier, module, method, route template, and status code, logged at `debug` with a message that does not describe a failure, and no `warn` failure record is emitted for it

#### Scenario: Unexpected request exception is serialized

- **WHEN** an unexpected exception during request handling causes a 5xx response
- **THEN** the single failure record includes a structured `err` object with type, message, and stack when available, excludes request/response bodies and sensitive values, and the process continues serving subsequent requests

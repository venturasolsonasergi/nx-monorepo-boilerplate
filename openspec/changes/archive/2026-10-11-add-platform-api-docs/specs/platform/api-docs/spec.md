# Spec Delta

## Purpose

Provide a single developer-facing location at the API host for browsing the merged HTTP
contract of every module it hosts, generated read-only from each service's authoritative
OpenAPI contract, with availability controlled per environment.

## ADDED Requirements

### Requirement: Merged OpenAPI document endpoint

The API host SHALL expose `GET /docs/openapi.json` returning the merged OpenAPI document
assembled from every hosted service's authoritative OpenAPI contract, served with an
`application/json` content type, when documentation is enabled.

#### Scenario: Document retrieval in development

- **WHEN** a client requests `GET /docs/openapi.json` while documentation is enabled
- **THEN** the response has status 200 with `application/json` body containing a valid
  OpenAPI document that includes paths from all hosted services

### Requirement: Deterministic merge of service contracts

The merged document SHALL include every path of every service contract unchanged under its
existing path prefix, SHALL tag every operation with its owning service's tag, SHALL merge
component definitions across services prefixing any component name declared by more than one
service with that service's name (rewriting all affected `$ref` usages consistently,
including security schemes), and SHALL declare a single server entry.

#### Scenario: Paths and tags from all services

- **WHEN** the merged document is generated from the hosted service contracts
- **THEN** every operation of each service appears under its existing path prefix and carries
  its service tag among its tags

#### Scenario: Component name collision

- **WHEN** two service contracts define a component with the same name
- **THEN** both definitions are kept in the merged document under service-prefixed names and
  every `$ref` within each service's operations resolves to the prefixed name

#### Scenario: Unique component name preserved

- **WHEN** a component name is declared by only one service
- **THEN** the merged document keeps the original name and references to it resolve

#### Scenario: Deterministic regeneration

- **WHEN** the merge runs twice over identical source contracts
- **THEN** the output is byte-identical

### Requirement: API reference UI endpoint

The API host SHALL expose `GET /docs` returning an interactive HTML API reference that loads
the merged document from `GET /docs/openapi.json`, when documentation is enabled.

#### Scenario: UI page loads reference

- **WHEN** a browser navigates to `GET /docs` while documentation is enabled
- **THEN** it receives an HTML page that renders the merged document and references
  `/docs/openapi.json`

### Requirement: Documentation availability control

The API host SHALL enable the documentation endpoints by default outside production and
SHALL disable them by default in production. The `API_DOCS_ENABLED` environment variable,
when set to a boolean value, SHALL override the default in any environment.

#### Scenario: Disabled by default in production

- **WHEN** the API runs with `NODE_ENV=production` and no `API_DOCS_ENABLED` override
- **THEN** `GET /docs` and `GET /docs/openapi.json` do not serve documentation

#### Scenario: Explicit enable in production

- **WHEN** the API runs with `NODE_ENV=production` and `API_DOCS_ENABLED=true`
- **THEN** the documentation endpoints respond as they do in development

#### Scenario: Explicit disable outside production

- **WHEN** the API runs outside production with `API_DOCS_ENABLED=false`
- **THEN** `GET /docs` and `GET /docs/openapi.json` do not serve documentation

### Requirement: Documentation does not alter existing behavior

The documentation capability SHALL NOT change the status codes, response schemas, or
middleware behavior of any existing endpoint, and SHALL NOT impose authentication on the
documentation endpoints while they are enabled by default.

#### Scenario: Existing endpoint unaffected

- **WHEN** the documentation endpoints are enabled and a client calls an existing endpoint
  such as the orders health check
- **THEN** the response is identical to the response with documentation disabled

### Requirement: Merged document freshness

The build and start pipeline SHALL regenerate the merged document from the current service
contracts before the API is built or started, and the `verify` pipeline SHALL fail when the
merged document is missing, fails OpenAPI schema validation, or does not match a fresh
regeneration from the current contracts.

#### Scenario: Stale merged document fails verification

- **WHEN** a service contract changes and the merged document is not regenerated
- **THEN** running the `verify` pipeline fails with a freshness error

#### Scenario: Regeneration before build or start

- **WHEN** a service contract changes and the build or start pipeline runs
- **THEN** `GET /docs/openapi.json` reflects the updated contract after the pipeline
  completes

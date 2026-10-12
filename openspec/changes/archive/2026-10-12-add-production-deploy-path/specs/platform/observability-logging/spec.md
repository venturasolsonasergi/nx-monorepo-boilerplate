# Spec Delta

## MODIFIED Requirements

### Requirement: Identify run and module context

Every operational log entry SHALL identify the emitting API process with `service: api`, an `environment` field derived from `NODE_ENV` (defaulting to `development` when unset), and the operational module with a `module` field whose value is `api`, `auth`, `users`, or `orders`. Entries from different modules SHALL be distinguishable by the `module` field without separate logger configuration. Every entry SHALL also carry build/version identification: a `version` field sourced from `APP_VERSION` and a `commit` field sourced from `GIT_SHA`, using the literal `dev` for either field that is unset.

#### Scenario: Module context is present

- **WHEN** a module hosted in `apps/api` emits an operational log entry
- **THEN** the entry identifies the API process and that module, and entries from two different modules are distinguishable by their module context alone

#### Scenario: One process, one configuration

- **WHEN** two modules hosted in `apps/api` emit operational log entries
- **THEN** both entries are produced under the same process-wide logging configuration and neither module owns an independent logging configuration

#### Scenario: Build metadata is present

- **WHEN** the API process emits an operational log entry while `APP_VERSION` and `GIT_SHA` are configured
- **THEN** the entry carries those values in its `version` and `commit` fields

#### Scenario: Build metadata falls back when unconfigured

- **WHEN** the API process emits an operational log entry without `APP_VERSION` or without `GIT_SHA` configured
- **THEN** the entry carries the literal `dev` for each unset field, and no entry omits or misreports the build metadata fields

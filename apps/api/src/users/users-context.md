# Users Context

## Purpose

`users` is a microservice module inside the main NestJS application. It owns the user domain, its application use cases, its HTTP and persistence adapters, its OpenAPI contract, and its contract tests.

The service keeps a lightweight layered structure:

```text
infrastructure -> application -> domain
```

- `domain/` contains business concepts and rules.
- `application/` coordinates use cases and defines repository ports.
- `infrastructure/` contains NestJS, HTTP, Prisma, and dependency wiring.
- `specs/` contains the OpenAPI source and SDD context.
- `tests/` contains contract tests.

The domain must not depend on NestJS, Prisma, Zod, HTTP, or database details. The application must not depend directly on Prisma. Infrastructure implements the technical details required by the application.

## Structure

```text
src/users/
├── microservice.json
├── sdd-evolution.md
├── users-context.md
├── domain/
│   ├── user.entity.ts
│   ├── user.vo.ts
│   └── user.domain-service.ts
├── application/
│   ├── create-user.use-case.ts
│   └── user.repository.ts
├── infrastructure/
│   ├── users.controller.ts
│   ├── users.module.ts
│   ├── users.repository.prisma.ts
│   └── prisma/
│       └── schema.prisma
├── specs/
│   ├── openapi.yaml
│   ├── lidr-specboot.config.json
│   └── context/
│       └── README.md
└── tests/
    └── users.contract.spec.ts
```

## Service Metadata

### `microservice.json`

Identifies the service and stores its versions and declared dependencies:

- `name`: `users`.
- `version`: current service version.
- `specVersion`: OpenAPI version.
- `domainVersion`: domain model version.
- `dependencies.internal`: other internal services used by this service.
- `dependencies.external`: external packages used by the service.

`users` currently declares no internal microservice dependencies.

### `sdd-evolution.md`

A short evolution log for the service. It records the initial creation of the OpenAPI, domain, and application scaffolding.

## Domain

The domain is framework-independent. It contains the concepts that represent users and their business rules.

### `domain/user.entity.ts`

Defines `UserEntity` and `UserEntityProps`.

```ts
interface UserEntityProps {
  id: string;
}
```

`UserEntity` is the business representation of a user. It currently only has an `id` and does not contain business behavior yet.

The entity is separate from the Prisma persistence model even though both currently only contain an `id`.

### `domain/user.vo.ts`

Defines `UserIdValueObject`. Its constructor rejects empty or whitespace-only identifiers.

The value object currently exists as an isolated domain primitive. `UserEntity` still uses `string` directly, so this validation is not yet part of the user creation flow.

### `domain/user.domain-service.ts`

Defines `UserDomainService`. It is reserved for domain rules that do not naturally belong to one entity.

Its current `isConsistent()` method always returns `true` and is not used by the current use case. It is a placeholder for future real business rules.

## Application

The application layer coordinates business operations without knowing NestJS or Prisma.

### `application/create-user.use-case.ts`

Defines `CreateUserUseCase`, `CreateUserInput`, and `CreateUserOutput`.

Current input and output:

```ts
{ id: string }
```

The use case receives a `UserRepository`, but currently does not use it. Its current behavior is only:

```text
receive id -> return id
```

It does not yet create a `UserEntity`, use `UserIdValueObject`, invoke `UserDomainService`, persist data, or publish an event.

### `application/user.repository.ts`

Defines the application port used to access users:

- `findById(id)`: returns a `UserEntity` or `null`.
- `save(entity)`: persists a `UserEntity`.

The interface belongs in `application/`; its concrete implementation belongs in `infrastructure/`.

## Infrastructure

Infrastructure contains NestJS adapters, HTTP controllers, dependency injection, Prisma repositories, and database schema details.

### `infrastructure/users.controller.ts`

Defines the HTTP controller with the `users` route prefix.

Current endpoint:

```text
GET /users/health
```

It returns:

```json
{"status":"ok"}
```

The controller is intentionally thin. It currently does not call `CreateUserUseCase`.

### `infrastructure/users.module.ts`

Registers the controller and repository with NestJS. It also constructs `CreateUserUseCase` with `UsersPrismaRepository` through a factory provider.

The dependency wiring is:

```text
UsersPrismaRepository -> CreateUserUseCase
```

The use case is wired, but no controller currently injects or invokes it.

### `infrastructure/users.repository.prisma.ts`

Implements `UserRepository` and is the intended Prisma adapter.

Current behavior is still a stub:

- `findById(id)` immediately returns a new `UserEntity` with that id.
- `save(entity)` ignores the entity and resolves successfully.

It does not currently instantiate or query a Prisma client.

### `infrastructure/prisma/schema.prisma`

Defines the PostgreSQL datasource using the `USERS_DATABASE_URL` environment variable and the `UserRecord` model:

```prisma
model UserRecord {
  id String @id
}
```

`UserRecord` is the persistence model and should remain separate from `UserEntity`.

## Specifications

### `specs/openapi.yaml`

The OpenAPI 3.0.3 document is the source of truth for the public API contract.

It currently defines the service title and version, but has no paths or schemas:

```yaml
paths: {}
components: {}
```

The implemented health endpoint is therefore not yet documented in OpenAPI.

### `specs/lidr-specboot.config.json`

Points the service tooling directly to `specs/openapi.yaml`. The repository no longer relies on generated spec directories or generated contract artifacts.

### `specs/context/`

Reserved for the temporary `spec-context.md` file produced by the SDD context-enrichment step. It is used to describe feature intent, domain decisions, use cases, invariants, and OpenAPI scope before the specification is updated.

## Tests

### `tests/users.contract.spec.ts`

Reserved for contract tests. It is currently a placeholder that only asserts `true`.

It does not yet verify the health endpoint, OpenAPI compatibility, request validation, response schemas, or error contracts.

## Current Runtime Flow

The only real HTTP flow is:

```text
GET /users/health
    -> UsersController.health()
    -> { status: "ok" }
```

The current health request does not use the domain, application use case, repository, Prisma, or OpenAPI-generated code.

## Intended Create-User Flow

The structure is prepared for this future flow:

```text
POST /users
    -> UsersController
    -> CreateUserUseCase
    -> UserEntity / UserIdValueObject
    -> UserRepository
    -> UsersPrismaRepository
    -> PostgreSQL
```

Before this becomes real behavior, the OpenAPI path, request validation, entity creation, repository persistence, response mapping, and contract test must be implemented.

## Removed Scaffolding

The service no longer uses these intermediate or generated locations:

- `application/mappers/`
- `application/generated/`
- `specs/contracts/`
- `specs/generated/`
- `specs/openspec/`
- `infrastructure/nest/`
- `infrastructure/repositories/`
- `domain/entities/`
- `domain/value-objects/`
- `domain/domain-services/`
- `domain/domain-events/`

The current structure keeps the important boundaries while reducing navigation and placeholder files.

## Current Status

The architecture and wiring are in place, but the business functionality is still minimal:

- Health endpoint: implemented.
- User creation endpoint: not implemented.
- Domain validation: only the standalone value object validation exists.
- User persistence: stub only; no real Prisma queries.
- OpenAPI paths: none defined.
- Contract tests: placeholder only.

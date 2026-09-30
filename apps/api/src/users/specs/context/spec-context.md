# Spec Context: create-user

## Service
users

## Feature Summary
Implementar `POST /users` para crear usuarios, validar los campos obligatorios y el email, generar el id en PostgreSQL y persistir mediante Prisma. Se conserva `GET /users/health`.

## Existing Behavior To Preserve
- `GET /users/health` continúa devolviendo `{"status":"ok"}`.
- Se mantienen los límites de arquitectura `infrastructure -> application -> domain`.

## Tactical DDD Model

### Entities
- `UserEntity`: usuario con `id: number` generado por PostgreSQL, `name`, `surname`, `email`, `address` y `phone`. El id no forma parte de la entrada de creación.

### Value Objects
- `UserEmailValueObject`: email no vacío y con formato válido, normalizado con trim, usado durante la creación.
- `UserIdValueObject`: diferido; el id será numérico y generado por persistencia.

### Use Cases
- `CreateUserUseCase`: recibe `name`, `surname`, `email`, `address` y `phone` sin id, valida las reglas de dominio, crea el usuario y delega en `UserRepository`. Devuelve el usuario persistido con id.

### Domain Events
- No se emiten eventos en esta iteración.

### Domain Invariants
- `name`, `surname`, `email`, `address` y `phone` son obligatorios y no pueden quedar vacíos tras trim.
- El email debe tener formato válido. Su unicidad es una restricción de persistencia garantizada por PostgreSQL.
- El id es entero positivo y lo genera PostgreSQL.

## OpenAPI Scope
- Method and path: `POST /users`.
- Request schema: objeto JSON con `name`, `surname`, `email`, `address` y `phone`, todos `string`, obligatorios, sin `id`; los campos se validan tras trim y no pueden estar vacíos; `email` usa formato `email`; no se permiten propiedades adicionales.
- Success response: `201` con `{ id: number, name: string, surname: string, email: string, address: string, phone: string }`.
- Error responses: `400` para body o campos inválidos; `409` cuando el email ya existe.

## Persistence Scope
- `UserRecord`: `id Int @id @default(autoincrement())`, `name String`, `surname String`, `email String @unique`, `address String`, `phone String`.
- Los cinco campos son no nulos y no tienen defaults; email tiene restricción única.
- La violación de unicidad de Prisma sobre email se traduce a `409`.

## Validation And Normalization
- `name`, `surname`, `email`, `address` y `phone` son requeridos, se normalizan con trim y no pueden quedar vacíos.
- `email` debe tener formato válido.
- Los nombres de los campos son iguales en la API, el dominio y Prisma: `name`, `surname`, `email`, `address` y `phone`. No se permite introducir nombres alternativos ni mapeos entre idiomas.

## Test Scope
- Creación válida con `201`, id numérico generado y todos los campos.
- Rechazo de `id` y de cualquier otro campo desconocido enviado por el cliente.
- `400` para body ausente, campos ausentes, strings vacíos y email inválido.
- `409` para email duplicado.
- Persistencia Prisma real, mapeo de campos y regresión de `GET /users/health`.

## Out of Scope
- Actualización, consulta, eliminación, autenticación, autorización, eventos y dependencias externas o entre microservicios.
- Reglas específicas adicionales para `name`, `surname`, `address` o `phone`.

## Decisions
- Todos los campos de usuario usan nombres en inglés de forma consistente en la API, el dominio y la persistencia: `name`, `surname`, `email`, `address` y `phone`.
- El schema de creación usa `additionalProperties: false` y la validación HTTP debe rechazar propiedades desconocidas.
- Prisma será el mecanismo real de persistencia; no se conserva el stub.
- La unicidad concurrente depende de la restricción de PostgreSQL, no de una comprobación previa.

## Open Decisions
- None.
# Monorepo changes (Nx migration)

Este documento explica cómo estaba organizado el proyecto antes, qué se ha
cambiado para convertirlo en un monorepo Nx, y por qué está pensado así. No
sustituye a [.agents/project-context.md](.agents/project-context.md) (que
describe el estado actual "oficial" del proyecto) — es un registro de la
migración en sí, para quien necesite entender el "antes / después" y el
razonamiento detrás de las decisiones.

## Motivación

El proyecto nació planteado como varios microservicios en un mismo
repositorio, pero en la práctica siempre se desplegó como una única app
NestJS. Con un solo desarrollador trabajando durante un tiempo, mantener la
ficción de "microservicios aislados" sin las ventajas reales de aislamiento no
compensaba. A la vez, se quería:

- Poder seguir separando cada dominio (`users`, `orders`) con límites claros.
- Poder aislar un servicio en su propio deploy en el futuro sin fricción.
- Añadir más adelante un frontend en React sin reestructurar todo otra vez.

La solución: convertir el repo en un **monorepo Nx modular**, manteniendo la
separación por capas (domain/application/infrastructure) que ya existía, pero
formalizando la separación entre "lo que se despliega" (`apps/`) y "lo que es
reutilizable/aislable" (`libs/`).

## Cómo estaba organizado antes

```
src/
  app.module.ts             # único punto de entrada, importaba ambos módulos
  app.controller.ts
  app.service.ts
  main.ts
  users/
    domain/
    application/
    infrastructure/
    specs/                  # openapi.yaml, contexto DDD
    tests/                  # contract tests
    microservice.json
  orders/
    (misma estructura)
  shared/
    domain/
    validation/
test/
  app.e2e-spec.ts
```

Puntos clave del estado anterior:

- Un solo `nest-cli.json`, un solo `package.json`, un solo Dockerfile — todo
  se compilaba y desplegaba como una única aplicación.
- La carpeta `microservice.json` por servicio era solo metadata; no había
  ningún mecanismo que impidiera importar código de un servicio desde otro,
  más allá de un script custom (`architecture/validation-engine/check-dependencies.mjs`)
  que recorría el árbol de imports a mano.
- No existía ningún concepto de "aplicación" separado de "librería": todo
  vivía bajo `src/`.

## Cómo ha quedado ahora

```
apps/
  api/                      # host NestJS: main.ts, app.module.ts — solo bootstrap
    src/
  api-e2e/                  # tests end-to-end de apps/api

libs/
  users/                    # todo el microservicio "users" completo
    domain/
    application/
    infrastructure/         # controladores, módulo Nest, Prisma (users_db)
    specs/
    tests/
    microservice.json
  orders/                   # mismo patrón, orders_db
  shared/
    domain/
    validation/
    api-contracts/          # vacío, reservado para tipos generados desde OpenAPI (futuro frontend)

architecture/                # motor de validación de capas, ahora apunta a libs/
scripts/                     # CLI propio (SDD), sin cambios de lógica
```

### `apps/` vs `libs/`: qué va en cada sitio y por qué

- **`apps/api`** es solo el punto de composición: `main.ts` arranca Nest,
  `app.module.ts` importa los módulos de `libs/users` y `libs/orders` y los
  registra juntos. No contiene lógica de negocio ni de infraestructura propia.
- **`libs/<service>/`** contiene el microservicio **completo**, con sus tres
  capas (`domain`, `application`, `infrastructure`) más sus specs y tests.

Esto puede parecer contraintuitivo si se compara con la convención Nx más
estricta ("libs solo deberían tener lógica reutilizable, no controladores ni
Prisma"). La razón de mantener `infrastructure/` (controladores, módulo Nest,
repositorio Prisma) dentro de la lib, y no en `apps/api`, es precisamente el
objetivo de aislamiento futuro: si mañana se quiere desplegar `orders` como
servicio independiente, basta con crear una `apps/orders-api` nueva (un
`main.ts` + `AppModule` mínimos) que importe `OrdersModule` desde
`libs/orders/infrastructure`. Nada dentro de `libs/orders` se toca. Si esa
infraestructura viviera en `apps/api`, aislar el servicio implicaría mover
código fuera de la app en el momento de la separación — justo el trabajo que
se quería evitar.

### Separación de capas dentro de cada lib

La separación `domain → application → infrastructure` (con las reglas de
[architecture/rules.json](architecture/rules.json): dominio sin NestJS/Prisma/Zod,
application sin Prisma, sin imports cruzados de dominio entre servicios) ya
existía antes de Nx y no ha cambiado. Se decidió **no** partir cada
microservicio en 3 proyectos Nx (`users-domain`, `users-application`,
`users-infrastructure`) para minimizar la disrupción de esta migración; la
pureza de capas la sigue validando el motor custom en
`architecture/validation-engine/*.mjs`, ahora apuntando a `libs/` en vez de
`src/`.

### Boundaries entre proyectos (Nx)

Se añadió `@nx/enforce-module-boundaries` en [eslint.config.mjs](eslint.config.mjs),
con tags declarados en el `project.json` de cada proyecto:

| Tag | Proyectos | Regla |
|---|---|---|
| `platform:server` | `apps/api`, `libs/users`, `libs/orders`, `libs/shared/domain`, `libs/shared/validation` | no puede ser importado desde `platform:browser` |
| `platform:browser` | (futuro `apps/web`) | no puede importar `platform:server` |
| `platform:agnostic` | `libs/shared/api-contracts` | importable desde ambos lados |
| `scope:users` | `libs/users` | no puede importar `scope:orders` |
| `scope:orders` | `libs/orders` | no puede importar `scope:users` |

Esta regla sustituye/complementa la comprobación manual de imports cruzados
que antes solo hacía `check-dependencies.mjs`, y además obliga a que los
imports entre proyectos usen alias de TypeScript (`@app/users/...`) en vez de
rutas relativas — evitando enlaces frágiles tipo `../../../users/domain`.

### Alias de import

Se añadió `tsconfig.base.json` con los paths:

- `@app/api/*` → `apps/api/src/*`
- `@app/users/*` → `libs/users/*`
- `@app/orders/*` → `libs/orders/*`
- `@app/shared/domain`, `@app/shared/validation`, `@app/shared/api-contracts`

Estos alias se resuelven en distintos contextos con mecanismos distintos:

- **Dev** (`pnpm api:start:dev`): con `tsx`, que resuelve los `paths` del tsconfig
  de forma nativa.
- **Tests** (`jest`): con `moduleNameMapper` en el bloque `jest` de
  [package.json](package.json) (y en `apps/api-e2e/test/jest-e2e.json` para
  los e2e).
- **Build de producción** (`pnpm api:build`): `nest build` compila y `tsc-alias`
  reescribe los alias a rutas relativas dentro de `dist/`. El build copia
  también los clientes Prisma generados a sus rutas equivalentes en `dist/`.

### Clientes Prisma por servicio

Cada `schema.prisma` define su propio `output` en
`infrastructure/prisma/generated/client`; `users` y `orders` ya no escriben
ambos sobre el cliente global `@prisma/client`. Los adaptadores importan el
cliente generado dentro de su propio servicio. Las carpetas generadas se
ignoran en Git: `pnpm api:build`, `pnpm api:start`, `pnpm api:start:dev` y
`pnpm api:start:debug` las regeneran automáticamente. El build las copia a `dist`
para que los imports compilados sigan resolviéndose en producción.

### `libs/shared/api-contracts`

Carpeta vacía creada ya de antemano, reservada para cuando se implemente el
frontend: contendrá tipos/cliente generados a partir de los `openapi.yaml` de
cada servicio, para que `apps/web` (aún no creado) no tenga que duplicar DTOs
a mano.

## Qué NO ha cambiado

- El flujo SDD (`/enrich-us`, `/new`, `/ff`, `/apply`, `/verify`,
  `/code-review`) sigue igual, solo con `libs/<service>/...` en vez de
  `src/<service>/...` como rutas de referencia.
- Cada servicio sigue con su propia base de datos y su propio
  `schema.prisma` — la migración no afecta al aislamiento de datos.
- El despliegue sigue siendo una única app (`apps/api`, un contenedor
  Docker) — no se ha separado nada a nivel de infraestructura real todavía.
- El CLI propio (`scripts/cli.ts`) sigue orquestando todo el flujo; Nx no
  sustituye ninguno de esos comandos, solo aporta la estructura de
  apps/libs y las reglas de boundaries.

## Próximos pasos (no implementados todavía)

- `apps/web`: scaffold de React + Vite + Vitest, con tag `platform:browser`.
- Generación real de tipos en `libs/shared/api-contracts` a partir de los
  `openapi.yaml`, cuando se empiece a implementar el frontend.

# Arquitectura

Monorepo con Nx 24 y workspaces de pnpm 10. Cada proyecto es un paquete (`package.json` con nombre `@team27/*`) y Nx infiere sus tareas con plugins. El dominio vive en contextos hexagonales; la API los compone y la web habla con la API.

## Estructura

| Carpeta                                   | Proyecto                | Tags                           | Qué es                                                   |
| ----------------------------------------- | ----------------------- | ------------------------------ | -------------------------------------------------------- |
| [`apps/web`](../apps/web/README.md)       | `@team27/web`           | `type:app`                     | Next.js 16 (App Router, Turbopack): el panel, en `:3000` |
| [`apps/api`](../apps/api/README.md)       | `@team27/api`           | `type:app`                     | NestJS 12: la API HTTP, en `:3001/api`                   |
| [`context/<ctx>`](../context/README.md)   | `@team27/context-<ctx>` | `type:context`, `scope:<ctx>`  | Un bounded context hexagonal. Todavía no hay ninguno     |
| [`data/main`](../data/main/README.md)     | `@team27/data-main`     | `type:data`                    | Prisma 7 sobre PostgreSQL: schema, migraciones y cliente |
| [`packages/ui`](../packages/ui/README.md) | `@team27/ui`            | `type:package`, `scope:shared` | Tema (tokens claro y oscuro) y componentes de React      |

```mermaid
flowchart LR
  web["apps/web<br/>Next.js"] -->|HTTP /api| api["apps/api<br/>NestJS"]
  web --> ui["packages/ui"]
  api --> ctx["context/&lt;ctx&gt;<br/>domain · application · infra"]
  api --> data["data/main<br/>Prisma 7"]
  ctx -->|adapters| data
  data --> pg[("PostgreSQL 18")]

  classDef app fill:#E7F5FF,stroke:#1C7ED6,color:#0B3D6B
  classDef domain fill:#E6FCF5,stroke:#12B886,color:#0B3D2E
  classDef shared fill:#F3F0FF,stroke:#7048E8,color:#2E1A6B
  class web,api app
  class ctx domain
  class ui,data,pg shared
```

## Fronteras

`@nx/enforce-module-boundaries` (en `eslint.config.mjs`) solo deja depender así:

| Desde          | Puede importar                                          |
| -------------- | ------------------------------------------------------- |
| `type:app`     | `type:context`, `type:data`, `type:package`, `type:lib` |
| `type:context` | `type:data`, `type:lib`                                 |
| `type:data`    | `type:lib`                                              |
| `type:package` | `type:package`, `type:lib`                              |
| `type:lib`     | `type:lib`                                              |

Un contexto nunca importa a otro: lo que cruza contextos lo compone la API.

## Contextos hexagonales

```
context/<ctx>/src/
├── domain/              entidades, valores y reglas puras
├── application/
│   ├── ports/           lo que el caso de uso necesita del mundo (repositorios, servicios externos)
│   └── use-cases/       un caso de uso por archivo; recibe sus puertos por constructor
├── infra/adapters/      implementaciones de los puertos (Prisma, APIs externas, memoria)
└── index.ts             exporta domain y application, nunca infra
```

- `domain/` solo importa archivos de `domain/`. `application/` solo importa `domain/` y `application/`: lo externo entra por un puerto. ESLint lo exige en cualquier `**/src/domain/**` y `**/src/application/**`.
- Los adapters se exportan por un subpath propio (`@team27/context-<ctx>/adapters`) y solo los importa la API, que es quien compone.
- Los nombres salen del [glosario](negocio.md#glosario).
- Los tests de casos de uso usan puertos falsos (`vi.fn()`). Cada adapter real tiene sus propios tests.

### Crear un contexto

```sh
pnpm nx g @nx/js:lib context/<ctx> --name=@team27/context-<ctx> --bundler=none \
  --unitTestRunner=vitest --linter=eslint --tags=type:context,scope:<ctx> --no-interactive
```

1. Reemplaza `src/lib/` por las carpetas de arriba. Los imports relativos van con `.ts`, no con el `.js` que trae el generador.
2. En el `tsconfig.lib.json` del contexto, agrega `"erasableSyntaxOnly": true` y `"verbatimModuleSyntax": true`: Node ejecuta el contexto sin compilarlo ([TypeScript](#typescript)).
3. En su `package.json`, agrega el subpath `./adapters` a `exports`, con la misma forma que `.`, apuntando a `./src/infra/adapters/index.ts`. Si un adapter usa la base, agrega `"@team27/data-main": "workspace:*"` a `dependencies`.
4. En `apps/api/package.json`, agrega `"@team27/context-<ctx>": "workspace:*"` y corre `pnpm install` y `pnpm nx sync`.
5. En `apps/api/src/modules/<ctx>/`, crea el módulo de Nest:
   - registra cada adapter con un token (`{ provide: TOKEN, useFactory/useClass }`)
   - registra cada caso de uso con `provideUseCase(CasoDeUso, [TOKEN, …])`, el único punto de unión entre los casos de uso y Nest
   - agrega el controller, que inyecta el caso de uso con `@Inject(CasoDeUso)`
   - importa el módulo en `app.module.ts`

## Web y API

- La web habla con la API por HTTP:
  - Desde el servidor (server components, server actions), con `fetch` a `API_URL`, como `src/lib/api.ts`.
  - Desde el navegador, a `/api/*` del mismo origen: `next.config.ts` lo reenvía a `API_URL` con un `rewrite`. No hace falta CORS.
- Todo `/api/*` llega a la API. La web no define rutas bajo `app/api/`: las rutas de Next se resuelven antes que el `rewrite` y le quitarían esa ruta a la API.
- La API corre con el prefijo global `/api`. Valida la entrada con el schema que declara cada `@Body`, `@Query` o `@Param` (`StandardSchemaValidationPipe`, con zod).

| Variable             | Defecto                                                | Quién la usa   | Qué es                                                                                                                                                               |
| -------------------- | ------------------------------------------------------ | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`       | `postgresql://postgres:postgres@localhost:5427/team27` | API, Prisma    | La base (el Postgres de compose en dev)                                                                                                                              |
| `API_PORT`           | `3001`                                                 | API            | Puerto de la API                                                                                                                                                     |
| `CORS_ALLOW_ORIGINS` | `http://localhost:3000`                                | API            | Orígenes permitidos, separados por coma. `*` no se acepta con `NODE_ENV=production`                                                                                  |
| `API_URL`            | `http://localhost:3001`                                | Web            | Dónde está la API. El `rewrite` la fija al compilar la web (queda en `routes-manifest.json`); `fetch` la lee en cada request. En un deploy, defínela antes del build |
| `POSTGRES_*`         | ver `.env.example`                                     | docker compose | Usuario, clave, base y puerto del Postgres local                                                                                                                     |

Nx carga el `.env` de la raíz en cada tarea (plantilla: `.env.example`). La API no lee archivos: toma el entorno, y si una variable no cumple su schema (`apps/api/src/config/env.ts`), no arranca.

## Datos

- [`data/main`](../data/main/README.md) tiene el schema (`prisma/schema.prisma`), las migraciones (`prisma/migrations`) y `createPrismaClient(url)`, que usa el driver adapter de `pg`. El cliente se genera en `data/main/generated/`, que no se versiona.
- `prisma.config.ts` lee el `.env` de la raíz, así que los comandos de Prisma funcionan desde cualquier carpeta.
- La API crea un solo `PrismaClient` (`DatabaseModule`, token `PRISMA_CLIENT`), lo inyecta donde se pide y lo cierra al apagarse.

## TypeScript

- Los paquetes no se compilan: su `exports` apunta a los `.ts`.
  - La web los transpila con `transpilePackages`.
  - Vitest los lee directo.
  - La API compila solo su código (`nest build`); en runtime Node ejecuta los contextos y `data/main` como TypeScript, quitando los tipos. Por eso esos paquetes usan solo sintaxis borrable: sin `enum`, sin parameter properties, sin `namespace`, e `import type` explícito.
- Los imports relativos llevan la extensión `.ts`, gracias a `allowImportingTsExtensions` en la base. La API la reescribe a `.js` al compilar (`rewriteRelativeImportExtensions`). Turbopack no resuelve `./x.js` hacia `x.ts`.
- Es un TS solution de Nx: `tsconfig.json` de la raíz referencia a cada proyecto, y `typecheck` (`tsc --build`) emite los `.d.ts` en `dist/` para quien depende. Por eso `build` corre después del `typecheck` de las dependencias. `pnpm nx sync` mantiene las referencias al día.
- TypeScript 6.0: `typescript-eslint` todavía no acepta la 6.1 ni la 7.

## Tareas de Nx

| Tarea       | Proyecto             | Qué hace                                                                                            |
| ----------- | -------------------- | --------------------------------------------------------------------------------------------------- |
| `dev`       | web, api             | `next dev` en `:3000`; `nest start --watch` en `:3001` (primero genera el cliente de Prisma)        |
| `build`     | web, api             | `next build`; `nest build` a `apps/api/dist`                                                        |
| `start`     | web, api             | Sirve el build: `next start`; `node dist/main.js`                                                   |
| `generate`  | data-main            | `prisma generate`, con caché; lo corren antes `dev`, `build`, `test` y `typecheck` de quien depende |
| `lint`      | todos                | `eslint .`                                                                                          |
| `test`      | api, web y contextos | Vitest                                                                                              |
| `typecheck` | paquetes y api       | `tsc --build`                                                                                       |

- `pnpm check` corre `lint`, `test`, `typecheck` y `build` en todo; es lo mismo que corre la [CI](#ci). `pnpm affected` corre lo mismo, solo en lo que cambió respecto de `main`.
- `pnpm nx graph` dibuja el grafo de proyectos.

## CI

[`.github/workflows/check.yml`](../.github/workflows/check.yml) corre `pnpm install --frozen-lockfile` y `pnpm check` en cada push a `main` y en cada pull request, con el Node de `.nvmrc` y el pnpm de `packageManager`. No necesita base de datos: el cliente de Prisma se genera sin conectarse.

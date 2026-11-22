# Arquitectura

Monorepo con Nx 24 y workspaces de pnpm 10. Cada proyecto es un paquete (`package.json` con nombre `@team27/*`) y Nx infiere sus tareas con plugins. El dominio vive en contextos hexagonales; la API los compone y la web habla con la API.

La vista completa, con DevOps y el flujo de datos de un cambio, está en los [diagramas](diagramas/README.md).

## Estructura

| Carpeta                                   | Proyecto                | Tags                           | Qué es                                                                          |
| ----------------------------------------- | ----------------------- | ------------------------------ | ------------------------------------------------------------------------------- |
| [`apps/web`](../apps/web/README.md)       | `@team27/web`           | `type:app`                     | Next.js 16 (App Router, Turbopack): el panel, en `:3000`                        |
| [`apps/api`](../apps/api/README.md)       | `@team27/api`           | `type:app`                     | NestJS 12: la API HTTP, en `:3001/api`                                          |
| [`context/<ctx>`](../context/README.md)   | `@team27/context-<ctx>` | `type:context`, `scope:<ctx>`  | Un bounded context hexagonal: `lake`, `impact`, `notification` e `integrations` |
| [`data/main`](../data/main/README.md)     | `@team27/data-main`     | `type:data`                    | Prisma 7 sobre PostgreSQL: schema, migraciones y cliente                        |
| [`packages/ui`](../packages/ui/README.md) | `@team27/ui`            | `type:package`, `scope:shared` | Tema (tokens claro y oscuro) y componentes de React                             |

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
  class ui,data,pg,autodesk shared
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
5. En `apps/api/src/modules/<ctx>/`, compón el contexto:
   - si no depende de un proyecto, crea el módulo de Nest: registra cada adapter con un token (`{ provide: TOKEN, useFactory/useClass }`), cada caso de uso con `provideUseCase(CasoDeUso, [TOKEN, …])` (el único punto de unión entre los casos de uso y Nest), agrega el controller, que inyecta el caso de uso con `@Inject(CasoDeUso)`, e importa el módulo en `app.module.ts`
   - si trabaja sobre un proyecto, exporta una función `build<Ctx>(db, project)` que arma sus adapters y casos de uso con el `ProjectCatalog` del pedido y el cliente de la transacción, como `buildLake`, `buildImpact` y `buildNotification`

## Coordinación de un cambio

Tres contextos, uno por etapa del [flujo](negocio.md#flujo): `lake` captura los hechos, los compara con lo vigente y detecta el cambio por elemento; `impact` calcula a quién afecta y además lee el texto libre; `notification` avisa. Ninguno conoce a los otros. El módulo `coordination` de la API los encadena y traduce lo que sale de uno a lo que entra al siguiente. El diseño completo del motor (lo vigente, propuestas, consenso, rutas y lo que falta) está en [motor](motor.md), y el de los solapamientos (áreas, fragmentos, detección y validación conjunta), en [solapamientos](solapamientos.md).

| Contexto                                            | Qué hace                                                                                                                                                                                                                                                                             | Dominio                                                                                                                                                                                | Puertos → adapters                                                                                                                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`lake`](../context/lake/README.md)                 | Ingiere revisiones como fragmentos y hechos, los compara con lo vigente, abre una propuesta (el PR de la obra) por revisión, detecta solapamientos, lleva el consenso y compara una base con un siguiente estado de cada elemento: un cambio por elemento, con su revisión de origen | `Revision`, `Chunk`, `Claim`, `BaselineEntry`, `Proposal`, `Discrepancy`, `Overlap`, `ModelElement`, `Change`, `classifyClaims`, `detectOverlaps`, `computeStaleness`, `diffSnapshots` | un repositorio por agregado → Prisma (`ChangeRepository` incluido); `FactExtractor` → `InlineFactExtractor` (los fragmentos vienen con la revisión)                       |
| [`impact`](../context/impact/README.md)             | Recorre el grafo del proyecto desde lo que cambió (dependencias, partidas y ruta crítica), lee el texto libre y estima quién más puede estar afectado                                                                                                                                | `ProjectGraph`, `Impact`, `Finding`, `analyzeChange`, `criticalPath`, `ProjectVocabulary`, `Evidence`, `screenClaims`, `screenEstimates`                                               | `ProjectGraphRepository` → en memoria; `ImpactRepository` → Prisma; `ClaimReader` y `AffectedEstimator` → Claude; `DependencyScorer` → Jev (con respuestas fijas y caché) |
| [`notification`](../context/notification/README.md) | Junta los hallazgos de cada afectado en un aviso, en su canal, y guarda su respuesta, que es el voto                                                                                                                                                                                 | `Stakeholder`, `Notification`, `draftNotifications`                                                                                                                                    | `StakeholderDirectory` → en memoria; `NotificationRepository` → Prisma                                                                                                    |

```mermaid
sequenceDiagram
  participant S as Persona del equipo
  participant A as API · coordination
  participant L as lake
  participant I as impact
  participant N as notification
  S->>A: POST /api/projects/:projectId/revisions (fragmentos)
  A->>I: ExtractClaims (solo los fragmentos de texto libre)
  I-->>A: hechos con confianza y rechazados
  A->>L: IngestRevision
  L-->>A: resultados por hecho y un borrador de propuesta
  A->>L: DetectChanges (base y siguiente de los elementos que cambian)
  L-->>A: un cambio por elemento
  loop por cada cambio
    A->>I: AnalyzeChange
    I-->>A: impacto, hallazgos y filtrados
  end
  A->>N: NotifyStakeholders (un aviso por revisor)
  A->>L: OpenProposal (revisores y filtrados)
  A->>L: OpenOverlaps y SettleOverlaps
  S->>A: POST /api/projects/:projectId/notifications/:id/response
  A->>L: RecordReview
  A->>N: RespondToNotification
  A->>L: SettleOverlaps (vuelve a detectar y fusiona lo que quedó listo)
  L-->>A: fusionada, y lo vigente cambia
  A->>L: GetConsensus (desfases y sello)
```

- **La cadena es sincrónica y transaccional.** Cuando la ingesta responde, la revisión, el cambio, el impacto, los avisos y la propuesta ya están guardados; si algo falla, nada queda a medias. Cada acción de escritura toma un advisory lock de Postgres y el voto bloquea además la fila de la propuesta.
- **El texto libre se lee en la API, con `impact`.** `ImpactModule` solo provee `ExtractClaims`, con un `ClaimReader`: con una `ANTHROPIC_API_KEY` no vacía, `CachedClaimReader(ClaudeClaimReader)` con una caché en memoria; con la clave vacía o ausente (como en `.env.example`), `UnavailableClaimReader`, y un fragmento de texto libre responde `503 inference_unavailable`. El vocabulario sale de la definición del proyecto. El modelo de áreas (niveles, grilla, sistemas y la huella de cada elemento) también vive en la API y se le pasa al lago como un `FootprintModel`.
- **Los contextos se arman por proyecto.** Lo que depende del proyecto no se registra por token en Nest: `buildLake`, `buildImpact` y `buildNotification` arman los adapters y casos de uso de `lake`, `impact` y `notification` en cada pedido, con el `ProjectCatalog` y el cliente de la transacción. `lake` no importa `impact` ni `notification`: los revisores de una propuesta son los afectados que `impact` devuelve y `notification` avisa, y es `coordination` quien se los pasa a `OpenProposal`. Los ids de revisor son los de los afectados, valores opacos para el lago.
- **La definición del proyecto vive en Postgres** (tablas `projects` y `project_*`, ver [`data/main`](../data/main/README.md#el-proyecto)): el equipo, el modelo, el grafo, los espacios, los sujetos con su huella, los atributos, la grilla y el registro de documentos con su dueño. Un proyecto creado desde la web solo trae a quien lo creó: todavía no hay cómo cargarle el resto ([motor](motor.md#por-proyecto-y-con-tu-cuenta)).
- **La API carga el proyecto en cada pedido.** Las rutas del motor son `/api/projects/:projectId/...` y piden la cuenta (`AccountGuard`); `ProjectCatalogs.load(projectId)` lee la definición de la base, la valida con su schema y arma un `ProjectCatalog` con las búsquedas de nombres, documentos, sujetos y áreas. El catálogo alimenta los adapters en memoria `InMemoryProjectGraph` e `InMemoryStakeholderDirectory`, y su `footprintModel` llega al lago. La API arranca sin ningún proyecto en la base.
- **El actor es la cuenta.** El id del usuario es su id en el equipo del proyecto (`project_members`): leer pide ser de la organización del proyecto y escribir, además, ser del equipo (`403 not_on_team`).
- **Cada fila del motor lleva su `project_id`** (revisiones, hechos, lo vigente, propuestas, votos, cambios, impactos, avisos y eventos). Los adapters Prisma reciben el id del proyecto al construirse y filtran por él cada lectura y escritura.
- **Tiempo real por sondeo.** Cada transición del orquestador inserta filas de `project_events` en su misma transacción, y la web las pide con `GET /api/projects/:projectId/events?after=<seq>` ([motor](motor.md#tiempo-real)).
- **Los conectores reales viven en `integrations`.** `modules/integrations` compone [`context/integrations`](../context/integrations/README.md): conecta la cuenta de Google de cada persona, vincula planillas a un proyecto por su link y las revisa cuando Google avisa que alguien las editó (avisos de Drive, con `GOOGLE_WEBHOOK_URL`) o, sin avisos, cada `INTEGRATIONS_POLL_SECONDS`. Las rutas van con la cuenta (`AccountGuard`) y cada proyecto ve solo sus planillas. Es un canal de conexión y escucha: cuando una planilla cambia, deja en el log de la API qué celdas cambiaron, sin interpretarlas ni entregarlas a la cadena. También recibe los webhooks de Autodesk en `POST /api/integrations/autodesk/webhooks`, sin cuenta: verifica la firma sobre el cuerpo crudo (la app se crea con `rawBody`), descarta los repetidos con la tabla `autodesk_events` y deja cada aviso nuevo en el log ([cambios en Autodesk](spec/cambios-autodesk.md#el-receptor)).
- **La conexión con Autodesk también es un módulo de la API.** `modules/integrations/aps` guarda, por organización, la cuenta de Autodesk que conectó un administrador (OAuth de tres patas) para leer sus proyectos de Autodesk Construction Cloud. Sus puertos (`TokenVault` y `ApsOAuthClient`) viven en el módulo con sus adapters (`PrismaTokenVault` y `SdkApsOAuthClient`): no es un contexto porque no tiene reglas del dominio de la obra, solo credenciales. Los tokens van cifrados con AES-256-GCM (`APS_TOKEN_KEY`) y se renuevan solos ([la API](../apps/api/README.md#conexión-con-autodesk)).
- **Los avisos todavía no salen por un canal.** Un aviso se guarda con su canal, y el afectado lo ve y lo responde en el detalle del cambio dentro de la web. Un canal real sería un puerto nuevo en `notification`, con un adapter por proveedor ([motor](motor.md#lo-que-falta)).

## Web y API

- La web habla con la API por HTTP:
  - Desde el servidor (server components, server actions), con `fetch` a `API_URL`, como `src/lib/api.ts`.
  - Desde el navegador, a `/api/*` del mismo origen: `next.config.ts` lo reenvía a `API_URL` con un `rewrite`. No hace falta CORS.
- Todo `/api/*` llega a la API. La web no define rutas bajo `app/api/`: las rutas de Next se resuelven antes que el `rewrite` y le quitarían esa ruta a la API.
- La API corre con el prefijo global `/api`. Valida la entrada con el schema que declara cada `@Body`, `@Query` o `@Param` (`StandardSchemaValidationPipe`, con zod).

| Variable                                                 | Defecto                                                                 | Quién la usa   | Qué es                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------- | ----------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                           | `postgresql://postgres:postgres@localhost:5427/team27`                  | API, Prisma    | La base (el Postgres de compose en dev)                                                                                                                                                                                                                                             |
| `API_PORT`                                               | `3001`                                                                  | API            | Puerto de la API                                                                                                                                                                                                                                                                    |
| `CORS_ALLOW_ORIGINS`                                     | `http://localhost:3000`                                                 | API            | Orígenes permitidos, separados por coma. `*` no se acepta con `NODE_ENV=production`                                                                                                                                                                                                 |
| `ANTHROPIC_API_KEY`                                      | vacía (opcional)                                                        | API            | Clave de Claude para leer los fragmentos de texto libre. Sin clave, la API no lee texto libre: una revisión con un fragmento de texto responde `503 inference_unavailable`. Va en `.env.example` sin valor                                                                          |
| `API_URL`                                                | `http://localhost:3001`                                                 | Web            | Dónde está la API. El `rewrite` la fija al compilar la web (queda en `routes-manifest.json`); `fetch` la lee en cada request. En un deploy, defínela antes del build                                                                                                                |
| `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`                         | vacías                                                                  | API, Web       | El tenant de Auth0 (p. ej. `vigente.us.auth0.com`) y el identificador de su API. Sin ellas la API arranca igual y las rutas con cuenta responden 503                                                                                                                                |
| `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET` | vacías                                                                  | Web            | La Regular Web Application de Auth0 y la clave de 64 caracteres hexadecimales que cifra la cookie de sesión (`openssl rand -hex 32`). Sin ellas la web no ofrece entrar. Nunca llegan al navegador                                                                                  |
| `APP_BASE_URL`                                           | `http://localhost:3000`                                                 | Web            | La URL pública de la web, para las redirecciones de Auth0                                                                                                                                                                                                                           |
| `SEED_EMAIL`                                             | vacía (opcional)                                                        | `pnpm db:seed` | Si va, la semilla invita a Constructora Cordillera direcciones con «+» sobre ese correo (`tu+admin@…`, `tu+ana@…`) en vez de las de `@cordillera.test`, para que puedas entrar como cada persona ([`data/main`](../data/main/README.md))                                            |
| `SUPERADMIN_EMAILS`                                      | `superadmin@vigente.test` en `.env.example`                             | API            | Los correos de los superadmins de Vigente, separados por coma. Quien entra con uno de ellos entra sin invitación y ve `/admin`: todos los usuarios, crear organizaciones e invitar a cualquiera. El de `.env.example` no recibe correo: para entrar, suma el tuyo                   |
| `APS_CLIENT_ID`, `APS_CLIENT_SECRET`                     | vacías                                                                  | API            | Credenciales de la app de Autodesk Platform Services, para la conexión de cada organización con su cuenta de Autodesk. Sin ellas la API arranca igual y conectar responde 503. Nunca llegan al navegador                                                                            |
| `APS_CALLBACK_URL`                                       | `http://localhost:3000/api/integrations/aps/callback` en `.env.example` | API            | El callback de la conexión con Autodesk (OAuth de tres patas). Pasa por la web, que lo reenvía a la API, y tiene que estar registrado en la app de APS. Al volver, la API redirige a `/cuenta` del mismo origen                                                                     |
| `APS_TOKEN_KEY`                                          | vacía                                                                   | API            | 64 caracteres hexadecimales (`openssl rand -hex 32`): la clave AES-256-GCM que cifra los tokens de Autodesk en Postgres y sella el `state` de OAuth. Sin ella, o sin `APS_CALLBACK_URL`, la API arranca igual y conectar responde 503 `aps_oauth_not_configured`. Nunca se commitea |
| `APS_WEBHOOK_SECRET`                                     | vacía                                                                   | API            | El secreto con que Autodesk firma sus webhooks (`x-adsk-signature`), el mismo que se registra en APS. Sin él, la API arranca igual y `POST /api/integrations/autodesk/webhooks` responde 503 `autodesk_webhooks_off`. En Render lo genera el Blueprint. Nunca se commitea           |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`               | vacías                                                                  | API            | La app de OAuth de Google para el conector de Sheets. Sin ellas (o sin `INTEGRATIONS_ENCRYPTION_KEY`), `/conectores` y los archivos de cada proyecto dicen que falta configurar Google y la API no sondea nada. Nunca llegan al navegador                                           |
| `GOOGLE_REDIRECT_URI`                                    | `http://localhost:3000/api/integrations/google/callback`                | API            | Adonde vuelve Google después de pedir el permiso. Pasa por la web (el `rewrite` la lleva a la API), y la vuelta (a los archivos del proyecto o a `/conectores`) sale de su origen                                                                                                   |
| `INTEGRATIONS_ENCRYPTION_KEY`                            | vacía                                                                   | API            | Clave (16 caracteres o más) con que se cifran los refresh tokens en Postgres. Si cambia, hay que volver a conectar las cuentas                                                                                                                                                      |
| `INTEGRATIONS_POLL_SECONDS`                              | `60`                                                                    | API            | Cada cuánto se revisan las planillas vinculadas. `0` apaga el sondeo y queda «Revisar ahora»; con `GOOGLE_WEBHOOK_URL`, la API igual suscribe las planillas y renueva sus avisos de Drive. Vacía vale el default                                                                    |
| `GOOGLE_WEBHOOK_URL`                                     | vacía                                                                   | API            | URL pública con HTTPS de `POST /api/integrations/google/notifications`. Con ella, Google avisa al instante cada cambio de una planilla vinculada. Vacía, solo hay sondeo                                                                                                            |
| `INTEGRATIONS_WATCH_HOURS`                               | `24`                                                                    | API            | Cuánto dura cada suscripción a los avisos de Drive (de 1 a 24 h, el tope de Drive). La API la renueva antes de que venza, con un timer propio que corre aunque no haya sondeo. Vacía vale el default                                                                                |
| `INTEGRATIONS_FALLBACK_SECONDS`                          | `900`                                                                   | API            | Con avisos activos, cada cuánto se revisa igual una planilla por si un aviso se perdió. Vacía vale el default                                                                                                                                                                       |
| `POSTGRES_*`                                             | ver `.env.example`                                                      | docker compose | Usuario, clave, base y puerto del Postgres local                                                                                                                                                                                                                                    |

Nx carga el `.env` de la raíz en cada tarea (plantilla: `.env.example`). La API no lee archivos: toma el entorno, y si una variable no cumple su schema (`apps/api/src/config/env.ts`), no arranca.

## Datos

- [`data/main`](../data/main/README.md) tiene el schema (`prisma/schema.prisma`), las migraciones (`prisma/migrations`) y `createPrismaClient(url)`, que usa el driver adapter de `pg`. El cliente se genera en `data/main/generated/`, que no se versiona.
- `prisma.config.ts` lee el `.env` de la raíz, así que los comandos de Prisma funcionan desde cualquier carpeta.
- La API crea un solo `PrismaClient` (`DatabaseModule`, token `PRISMA_CLIENT`), lo inyecta donde se pide y lo cierra al apagarse.
- Una acción de escritura corre en `UnitOfWork.run`: una transacción interactiva con un advisory lock, cuyo cliente reciben los adapters de todos los contextos para que queden en la misma transacción.

## TypeScript

- Los paquetes no se compilan: su `exports` apunta a los `.ts`.
  - La web los transpila con `transpilePackages`.
  - Vitest los lee directo.
  - La API compila solo su código (`nest build`); en runtime Node ejecuta los contextos y `data/main` como TypeScript, quitando los tipos. Por eso esos paquetes usan solo sintaxis borrable: sin `enum`, sin parameter properties, sin `namespace`, e `import type` explícito.
- Los imports relativos llevan la extensión `.ts`, gracias a `allowImportingTsExtensions` en la base. La API la reescribe a `.js` al compilar (`rewriteRelativeImportExtensions`). Turbopack no resuelve `./x.js` hacia `x.ts`.
- Es un TS solution de Nx: `tsconfig.json` de la raíz referencia a cada proyecto, y `typecheck` (`tsc --build`) emite los `.d.ts` en `dist/` para quien depende. Por eso `build` corre después del `typecheck` de las dependencias. `pnpm nx sync` mantiene las referencias al día.
- TypeScript 6.0: `typescript-eslint` todavía no acepta la 6.1 ni la 7.

## Tareas de Nx

| Tarea       | Proyecto                  | Qué hace                                                                                            |
| ----------- | ------------------------- | --------------------------------------------------------------------------------------------------- |
| `dev`       | web, api                  | `next dev` en `:3000`; `nest start --watch` en `:3001` (primero genera el cliente de Prisma)        |
| `build`     | web, api                  | `next build`; `nest build` a `apps/api/dist`                                                        |
| `start`     | web, api                  | Sirve el build: `next start`; `node dist/main.js`                                                   |
| `generate`  | data-main                 | `prisma generate`, con caché; lo corren antes `dev`, `build`, `test` y `typecheck` de quien depende |
| `lint`      | todos                     | `eslint .`                                                                                          |
| `test`      | api, web, aps y contextos | Vitest                                                                                              |
| `typecheck` | paquetes, api y aps       | `tsc --build`                                                                                       |

- `pnpm check` corre `lint`, `test`, `typecheck` y `build` en todo; es lo mismo que corre la [CI](#ci). `pnpm affected` corre lo mismo, solo en lo que cambió respecto de `main`.
- `pnpm nx graph` dibuja el grafo de proyectos.

## CI

[`.github/workflows/check.yml`](../.github/workflows/check.yml) corre `pnpm install --frozen-lockfile` y `pnpm check` en cada push a `main` y en cada pull request, con el Node de `.nvmrc` y el pnpm de `packageManager`. No necesita base de datos: el cliente de Prisma se genera sin conectarse.

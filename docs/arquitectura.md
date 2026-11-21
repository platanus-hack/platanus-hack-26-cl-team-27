# Arquitectura

Monorepo con Nx 24 y workspaces de pnpm 10. Cada proyecto es un paquete (`package.json` con nombre `@team27/*`) y Nx infiere sus tareas con plugins. El dominio vive en contextos hexagonales; la API los compone y la web habla con la API.

La vista completa, con DevOps y el flujo de datos de un cambio, está en los [diagramas](diagramas/README.md).

## Estructura

| Carpeta                                                   | Proyecto                | Tags                           | Qué es                                                                                                                                                                                                                                   |
| --------------------------------------------------------- | ----------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`apps/web`](../apps/web/README.md)                       | `@team27/web`           | `type:app`                     | Next.js 16 (App Router, Turbopack): el panel, en `:3000`                                                                                                                                                                                 |
| [`apps/api`](../apps/api/README.md)                       | `@team27/api`           | `type:app`                     | NestJS 12: la API HTTP, en `:3001/api`                                                                                                                                                                                                   |
| [`apps/etl`](../apps/etl/README.md)                       | `@team27/etl`           | `type:app`, `scope:etl`        | El ETL de la muestra: lee el lago ficticio de archivos, extrae hechos con parsers deterministas, los carga a la API por HTTP y juega a las personas que no tomaron su asiento. Corre con `pnpm etl`, sin servidor ni dependencias nuevas |
| [`apps/aps`](../apps/aps/README.md)                       | `@team27/aps`           | `type:app`, `scope:aps`        | La CLI de Autodesk Platform Services: sube los modelos de Revit a un bucket de OSS y los traduce a SVF2 para el visor. Corre con `pnpm aps:check` y `pnpm aps:models`                                                                    |
| [`context/<ctx>`](../context/README.md)                   | `@team27/context-<ctx>` | `type:context`, `scope:<ctx>`  | Un bounded context hexagonal: `lake`, `impact`, `notification` e `integrations`                                                                                                                                                          |
| [`data/main`](../data/main/README.md)                     | `@team27/data-main`     | `type:data`                    | Prisma 7 sobre PostgreSQL: schema, migraciones y cliente                                                                                                                                                                                 |
| [`packages/ui`](../packages/ui/README.md)                 | `@team27/ui`            | `type:package`, `scope:shared` | Tema (tokens claro y oscuro) y componentes de React                                                                                                                                                                                      |
| [`tool-use-case/revit`](../tool-use-case/revit/README.md) | fuera de Nx             | —                              | Add-in de Revit en C# (.NET 8 y 10): manda la minuta de cambios de cada guardado a la API. Se compila con `dotnet`; `pnpm check` no lo toca                                                                                              |

```mermaid
flowchart LR
  web["apps/web<br/>Next.js"] -->|HTTP /api| api["apps/api<br/>NestJS"]
  etl["apps/etl<br/>ETL y jugadores"] -->|HTTP /api| api
  web --> ui["packages/ui"]
  api --> ctx["context/&lt;ctx&gt;<br/>domain · application · infra"]
  api --> data["data/main<br/>Prisma 7"]
  ctx -->|adapters| data
  data --> pg[("PostgreSQL 18")]
  apscli["apps/aps<br/>CLI de APS"] -->|sube y traduce| autodesk[("Autodesk<br/>Platform Services")]
  api -->|lista los modelos y el token del visor| autodesk

  classDef app fill:#E7F5FF,stroke:#1C7ED6,color:#0B3D6B
  classDef domain fill:#E6FCF5,stroke:#12B886,color:#0B3D2E
  classDef shared fill:#F3F0FF,stroke:#7048E8,color:#2E1A6B
  class web,api,etl,apscli app
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
5. En `apps/api/src/modules/<ctx>/`, crea el módulo de Nest:
   - registra cada adapter con un token (`{ provide: TOKEN, useFactory/useClass }`)
   - registra cada caso de uso con `provideUseCase(CasoDeUso, [TOKEN, …])`, el único punto de unión entre los casos de uso y Nest
   - agrega el controller, que inyecta el caso de uso con `@Inject(CasoDeUso)`
   - importa el módulo en `app.module.ts`

## Coordinación de un cambio

Tres contextos, uno por etapa del [flujo](negocio.md#flujo): `lake` captura los hechos, los compara con lo vigente y detecta el cambio por elemento; `impact` calcula a quién afecta y además lee el texto libre; `notification` avisa. Ninguno conoce a los otros. El módulo `coordination` de la API los encadena y traduce lo que sale de uno a lo que entra al siguiente. El diseño completo de la sala está en [multijugador](multijugador.md), y el de los solapamientos (áreas, fragmentos, detección y validación conjunta), en [solapamientos](solapamientos.md).

| Contexto                                            | Qué hace                                                                                                                                                                                                                                                                             | Dominio                                                                                                                                                                                | Puertos → adapters                                                                                                                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`lake`](../context/lake/README.md)                 | Ingiere revisiones como fragmentos y hechos, los compara con lo vigente, abre una propuesta (el PR de la obra) por revisión, detecta solapamientos, lleva el consenso y compara una base con un siguiente estado de cada elemento: un cambio por elemento, con su revisión de origen | `Revision`, `Chunk`, `Claim`, `BaselineEntry`, `Proposal`, `Discrepancy`, `Overlap`, `ModelElement`, `Change`, `classifyClaims`, `detectOverlaps`, `computeStaleness`, `diffSnapshots` | un repositorio por agregado → Prisma (`ChangeRepository` incluido); `FactExtractor` → `InlineFactExtractor` (los fragmentos vienen con la revisión)                       |
| [`impact`](../context/impact/README.md)             | Recorre el grafo del proyecto desde lo que cambió (dependencias, partidas y ruta crítica), lee el texto libre y estima quién más puede estar afectado                                                                                                                                | `ProjectGraph`, `Impact`, `Finding`, `analyzeChange`, `criticalPath`, `ProjectVocabulary`, `Evidence`, `screenClaims`, `screenEstimates`                                               | `ProjectGraphRepository` → en memoria; `ImpactRepository` → Prisma; `ClaimReader` y `AffectedEstimator` → Claude; `DependencyScorer` → Jev (con respuestas fijas y caché) |
| [`notification`](../context/notification/README.md) | Junta los hallazgos de cada afectado en un aviso, en su canal, y guarda su respuesta, que es el voto                                                                                                                                                                                 | `Stakeholder`, `Notification`, `draftNotifications`                                                                                                                                    | `StakeholderDirectory` → en memoria; `NotificationRepository` → Prisma                                                                                                    |

```mermaid
sequenceDiagram
  participant S as Asiento
  participant A as API · coordination
  participant L as lake
  participant I as impact
  participant N as notification
  S->>A: POST /api/revisions (fragmentos)
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
  S->>A: POST /api/notifications/:id/response
  A->>L: RecordReview
  A->>N: RespondToNotification
  A->>L: SettleOverlaps (vuelve a detectar y fusiona lo que quedó listo)
  L-->>A: fusionada, y lo vigente cambia
  A->>L: GetConsensus (desfases y sello)
```

- **La cadena es sincrónica y transaccional.** Cuando la ingesta responde, la revisión, el cambio, el impacto, los avisos y la propuesta ya están guardados; si algo falla, nada queda a medias. Cada acción de escritura toma un advisory lock de Postgres y el voto bloquea además la fila de la propuesta.
- **El texto libre se lee en la API, con `impact`.** `modules/impact` compone `ExtractClaims` con un `ClaimReader`: con una `ANTHROPIC_API_KEY` no vacía, `CachedClaimReader(ClaudeClaimReader)`; con la clave vacía o ausente (como en `.env.example`), la lectura es determinista: `CachedClaimReader(FixtureClaimReader)` con las respuestas fijas de la muestra. La caché es un `FileResponseCache` en `apps/api/inference-cache`, versionado en el repo. El vocabulario sale del modelo del proyecto. El modelo de áreas (niveles, grilla, sistemas y la huella de cada elemento) también vive en la API y se le pasa al lago como un `FootprintModel`.
- **El lago se enchufa por el API.** `modules/lake` registra los adapters por token y los casos de uso con `provideUseCase`. `lake` no importa `impact` ni `notification`: los revisores de una propuesta son los afectados que `impact` devuelve y `notification` avisa, y es `coordination` quien se los pasa a `OpenProposal`. Los ids de revisor son los de los afectados, valores opacos para el lago.
- **La definición del proyecto vive en la API** ([`los-aromos.ts`](../apps/api/src/scenario/los-aromos.ts) y [`documents.ts`](../apps/api/src/scenario/documents.ts)): el elenco, el grafo, los espacios, los sujetos, los atributos y el registro de documentos con su dueño. No trae documentos ni guion: esos son del ETL. La API los pasa a los adapters en memoria `InMemoryProjectGraph`, `InMemoryStakeholderDirectory` y `InlineFactExtractor` (los hechos vienen en la revisión). Lo que cambia durante la muestra (revisiones, hechos, lo vigente, propuestas, votos, cambios, impactos y avisos) se guarda en Postgres.
- **La API no siembra ni sabe que existe una demo.** Recibe revisiones por `POST /api/revisions` y la carga inicial por `POST /api/lake/seed` (solo con el lago vacío). `POST /api/room/reset` (con `x-presenter-key`) borra todas las tablas en una transacción, suma uno a la época y libera los asientos; el lago queda vacío. Quien carga y juega la muestra es el ETL (`apps/etl`, ver su [README](../apps/etl/README.md)): lee archivos del lago ficticio, extrae hechos con parsers deterministas y los entrega a la API como un cliente más, con la clave del presentador y `x-act-as` para actuar por los asientos que nadie tomó (la API responde 409 `seat_held` si una persona lo tiene).
- **La sala es un módulo de la API, no un contexto.** `modules/room` lleva asientos y eventos, y llama al orquestador `coordination`, nunca a los contextos. Es infraestructura de la muestra.
  - **Asientos.** Un celular toma un asiento con `POST /api/seats/:castId/claim` y recibe un token que se guarda hasheado (SHA-256) y viaja en `x-seat-token`. La presentadora actúa como Fernanda con `x-presenter-key`.
  - **Tiempo real.** Sondeo corto con cursor en `GET /api/events`: cada transición del orquestador inserta filas de `room_events` en su misma transacción. La petición con `x-seat-token` es el latido; un asiento sin latido por 20 s queda libre.
- **Los conectores reales viven en `integrations`.** `modules/integrations` compone [`context/integrations`](../context/integrations/README.md): conecta la cuenta de Google, vincula una planilla a un documento y la revisa cada `INTEGRATIONS_POLL_SECONDS`. Cada cambio entra por el mismo camino interno que `POST /api/revisions`, como el dueño del documento, y solo cuando la obra ya tiene la carga inicial. El add-in de Revit es el otro conector real y llega por `POST /api/integrations/revit/minutes`.
- **APS es un módulo de la API, no un contexto.** `modules/aps` entrega el token del visor y la lista de modelos traducidos, que le pide en vivo al bucket de APS (`APS_BUCKET_KEY`): la API no guarda un catálogo. Quien sube y traduce los modelos es la CLI `apps/aps`, que no importa nada de la API.
- **Los canales son simulados.** Un aviso guardado es un aviso entregado: la web lo muestra en la maqueta de su canal. Un canal real sería un puerto nuevo en `notification`, con un adapter por proveedor. Por qué es así: [espacio controlado](muestra.md#espacio-controlado).

## Web y API

- La web habla con la API por HTTP:
  - Desde el servidor (server components, server actions), con `fetch` a `API_URL`, como `src/lib/api.ts`.
  - Desde el navegador, a `/api/*` del mismo origen: `next.config.ts` lo reenvía a `API_URL` con un `rewrite`. No hace falta CORS.
- Todo `/api/*` llega a la API. La web no define rutas bajo `app/api/`: las rutas de Next se resuelven antes que el `rewrite` y le quitarían esa ruta a la API.
- La API corre con el prefijo global `/api`. Valida la entrada con el schema que declara cada `@Body`, `@Query` o `@Param` (`StandardSchemaValidationPipe`, con zod).

| Variable                                   | Defecto                                                            | Quién la usa    | Qué es                                                                                                                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------ | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                             | `postgresql://postgres:postgres@localhost:5427/team27`             | API, Prisma     | La base (el Postgres de compose en dev)                                                                                                                                                                  |
| `API_PORT`                                 | `3001`                                                             | API             | Puerto de la API                                                                                                                                                                                         |
| `CORS_ALLOW_ORIGINS`                       | `http://localhost:3000`                                            | API             | Orígenes permitidos, separados por coma. `*` no se acepta con `NODE_ENV=production`                                                                                                                      |
| `ANTHROPIC_API_KEY`                        | vacía (opcional)                                                   | API             | Clave de Claude para leer los fragmentos de texto libre. Sin clave, la lectura de texto libre es determinista (respuestas fijas y grabadas) y no sale nada a la red. Va en `.env.example` sin valor      |
| `PRESENTER_KEY`                            | `sala-los-aromos` fuera de producción; obligatoria en `production` | API             | Clave del presentador (`x-presenter-key`): reinicio, carga inicial, soltar asientos, y actuar como Fernanda o, con `x-act-as`, como otro asiento. También la usa el ETL. Mínimo 8 caracteres             |
| `API_URL`                                  | `http://localhost:3001`                                            | Web             | Dónde está la API. El `rewrite` la fija al compilar la web (queda en `routes-manifest.json`); `fetch` la lee en cada request. En un deploy, defínela antes del build                                     |
| `APS_CLIENT_ID`, `APS_CLIENT_SECRET`       | vacías                                                             | API, `apps/aps` | Credenciales de la app de Autodesk Platform Services. Sin ellas la API arranca igual y las rutas de `/api/aps` responden 503. Nunca llegan al navegador                                                  |
| `APS_BUCKET_KEY`                           | el bucket del equipo, en `.env.example` y en `render.yaml`         | API, `apps/aps` | El bucket de OSS con los modelos: la CLI los sube ahí y la API lista los traducidos. Es de la app de APS que lo creó, así que va con sus credenciales                                                    |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | vacías                                                             | API             | La app de OAuth de Google para el conector de Sheets. Sin ellas (o sin `INTEGRATIONS_ENCRYPTION_KEY`), `/conectores` dice que falta configurar Google y la API no sondea nada. Nunca llegan al navegador |
| `GOOGLE_REDIRECT_URI`                      | `http://localhost:3000/api/integrations/google/callback`           | API             | Adonde vuelve Google después de pedir el permiso. Pasa por la web (el `rewrite` la lleva a la API), y la vuelta a `/conectores` sale de su origen                                                        |
| `INTEGRATIONS_ENCRYPTION_KEY`              | vacía                                                              | API             | Clave (16 caracteres o más) con que se cifran los refresh tokens en Postgres. Si cambia, hay que volver a conectar las cuentas                                                                           |
| `INTEGRATIONS_POLL_SECONDS`                | `60`                                                               | API             | Cada cuánto se revisan las planillas vinculadas. `0` apaga el sondeo y queda «Revisar ahora»                                                                                                             |
| `POSTGRES_*`                               | ver `.env.example`                                                 | docker compose  | Usuario, clave, base y puerto del Postgres local                                                                                                                                                         |

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
| `test`      | api, etl, web y contextos | Vitest                                                                                              |
| `typecheck` | paquetes, api y etl       | `tsc --build`                                                                                       |

- `pnpm check` corre `lint`, `test`, `typecheck` y `build` en todo; es lo mismo que corre la [CI](#ci). `pnpm affected` corre lo mismo, solo en lo que cambió respecto de `main`.
- `pnpm nx graph` dibuja el grafo de proyectos.

## CI

[`.github/workflows/check.yml`](../.github/workflows/check.yml) corre `pnpm install --frozen-lockfile` y `pnpm check` en cada push a `main` y en cada pull request, con el Node de `.nvmrc` y el pnpm de `packageManager`. No necesita base de datos: el cliente de Prisma se genera sin conectarse.

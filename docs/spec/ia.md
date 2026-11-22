# Spec para agentes

Contexto operativo para un agente que va a construir sobre Vigente. Lee antes el `CLAUDE.md` de la raíz y el doc del área que vas a tocar. La versión para el equipo, con el backlog y las decisiones abiertas, está en [README.md](README.md).

## Invariantes

No se negocian. Si una tarea parece pedir romper una, detente y pregunta.

1. **El stack es fijo.** Nx 24 + pnpm 10, Next.js 16 + React 19 + Tailwind 4, NestJS 12 (Express), Prisma 7 + PostgreSQL 18, Vitest 5, TypeScript 6.0. No introduzcas Turborepo, Fastify, Drizzle, otro ORM ni otro framework. Una librería que corre dentro de este stack (el SDK de Sentry, el de un proveedor de canal, pg-boss) se agrega solo si la tarea la pide.
2. **Capas hexagonales.** En `context/<ctx>/src/`, `domain/` importa solo `domain/`; `application/` importa `domain/` y `application/`; `infra/adapters/` implementa puertos y sale por el subpath `/adapters`; `index.ts` nunca exporta infra. Un contexto nunca importa a otro: compone la API. ESLint lo exige.
3. **Sintaxis borrable** en `context/*` y `data/main`: sin `enum`, sin parameter properties, sin `namespace`, con `import type`. Imports relativos con `.ts`.
4. **Las cifras salen de reglas.** Un modelo de lenguaje solo lee texto libre y escribe razones; nunca calcula costo, plazo ni probabilidad.
5. **La API no sabe que existe una demo.** Nada de lógica de guion en `apps/api`. Lo simulado vive en `apps/etl` y en las maquetas de canal de `apps/web`.
6. **Toda escritura corre en `UnitOfWork.run`** (transacción con `pg_advisory_xact_lock`), y sus eventos de sala se insertan en la misma transacción con `CoordinationService.track`.
7. **El código no lleva comentarios.** Los textos de UI van en español de Chile, con tuteo; los identificadores, en inglés y con los nombres del [glosario](../negocio.md#glosario).
8. **Cierre de una tarea:** tests, el doc del área al día en el mismo cambio y `pnpm check` en verde. Trabaja en una rama, nunca en `main`.

## Mapa del código

| Ruta                                          | Qué hay                                                                                                                                                                                                                 |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context/lake/src/domain/`                    | `classifyClaims`, `buildProposalDraft`, `decideProposal`, `reopenFor`, `detectOverlaps`, `computeStaleness`, `buildProvenance`, `diffSnapshots`, `consensusIndex`                                                       |
| `context/lake/src/application/use-cases/`     | `IngestRevision`, `DetectChanges`, `OpenProposal`, `RecordReview`, `ReopenProposal`, `WithdrawProposal`, `OpenOverlaps`, `SettleOverlaps`, `VoteOverlap`, `SeedLake` y las lecturas                                     |
| `context/impact/src/domain/`                  | `analyzeChange` (afectados, costo y plazo), `quantities.ts`, `schedule.ts` (`criticalPath`), `ProjectGraph`, `Vocabulary`, probabilidad                                                                                 |
| `context/impact/src/application/use-cases/`   | `AnalyzeChange`, `ExtractClaims` (texto libre), `SuggestAffected` (sin conectar), `GetImpacts`                                                                                                                          |
| `context/impact/src/infra/adapters/`          | `InMemoryProjectGraph`, `PrismaImpactRepository`, `ClaudeClaimReader`, `ClaudeAffectedEstimator`, `JevDependencyScorer`, fixtures y caché                                                                               |
| `context/notification/src/domain/`            | `Stakeholder` con `CHANNELS = ['email', 'whatsapp', 'slack']`; `Notification` con `RESPONSE_KINDS = ['reviewed', 'issue']` y `draftNotifications`                                                                       |
| `context/notification/src/infra/adapters/`    | `InMemoryStakeholderDirectory`, `PrismaNotificationRepository`                                                                                                                                                          |
| `context/integrations/`                       | El conector de Google Sheets: conectar la cuenta, vincular planillas y escuchar sus cambios (`WatchSource`, `diffSnapshots`), con los adapters de Google, Prisma y cifrado. La API lo compone en `modules/integrations` |
| `apps/api/src/modules/coordination/`          | `coordination.service.ts` (la cadena), `query.service.ts` (vistas), `revision-body.ts`, `revit-minute.ts`, `chunk-reader.ts`, `action-log.ts` (idempotencia en memoria, 500 entradas)                                   |
| `apps/api/src/modules/room/`                  | Asientos con token hasheado, eventos con `seq`, época y reinicio                                                                                                                                                        |
| `apps/api/src/modules/database/`              | `PRISMA_CLIENT` y `unit-of-work.ts`                                                                                                                                                                                     |
| `apps/api/src/modules/project/`               | `ProjectCatalog` y `project-schema.ts`: al arrancar cargan de la base un proyecto (`PROJECT_ID`, o el más antiguo) con su elenco, grafo, espacios, documentos, sujetos, atributos y áreas                               |
| `data/main/project/` y `data/main/seed/`      | `definition.ts` y `store.ts` leen y escriben el proyecto en la base; `seed/los-aromos.ts` es el proyecto Los Aromos que siembra `pnpm db:seed`                                                                          |
| `apps/api/src/modules/accounts/`              | `AccountGuard` (token Bearer de Auth0), `AccountsService` (usuarios, organizaciones, invitaciones, roles `admin` y `member`, proyectos) y `/api/me`, `/api/projects`, `/api/organizations`                              |
| `apps/api/src/modules/integrations/`          | Los conectores: `connectors.controller.ts` (Google Sheets) y `aps/` (OAuth de tres patas con Autodesk por organización: `TokenVault`, `TokenCipher` AES-256-GCM, tabla `aps_connections`)                               |
| `apps/api/src/scenario/`                      | `caso-p12.ts`: el caso del pitch (P-12 y la bandeja E-B-03)                                                                                                                                                             |
| `apps/api/src/common/provide-use-case.ts`     | El único punto de unión entre un caso de uso y Nest                                                                                                                                                                     |
| `apps/api/tests/`                             | Vitest sin base de datos. No hay tests de `CoordinationService` ni contra Postgres                                                                                                                                      |
| `apps/web/src/app/`                           | Route groups `(site)`, `(sala)`, `(asiento)` y `(caso)`. En `(site)`, `/cuenta` y `/proyectos` piden cuenta (`components/cuenta/SessionGate.tsx`). No hay `error.tsx` ni `loading.tsx`                                  |
| `apps/web/src/components/asiento/Channel.tsx` | El look de cada canal simulado                                                                                                                                                                                          |
| `apps/web/src/lib/`                           | Un cliente tipado por tema; `http.ts` pone `x-seat-token`, `x-presenter-key` y `x-action-id` (`crypto.randomUUID`)                                                                                                      |
| `apps/etl/src/transform/`                     | Un parser determinista por tipo: `plano`, `eett`, `presupuesto`, `gantt`, `cotizacion`, `acta`, `whatsapp`, `libro`                                                                                                     |
| `apps/etl/tests/golden.spec.ts`               | Test de oro: cada archivo del lago produce los hechos esperados                                                                                                                                                         |
| `data/main/prisma/schema.prisma`              | 36 modelos. `Notification.channel` es `String`: agregar un canal no exige migración                                                                                                                                     |
| `tool-use-case/revit/`                        | Add-in C# fuera de Nx; contrato en `contract/`, que también parsea `apps/api/tests/modules/coordination/revit-minute.spec.ts`                                                                                           |

## La cadena de una revisión

Lo que hace `POST /api/revisions` (y `POST /api/integrations/revit/minutes`, por el mismo camino):

1. `revision-body.ts` valida con zod; el actor es el dueño del documento (token de asiento o `x-presenter-key` + `x-act-as`).
2. Fuera de la transacción, `ChunkReader` lee con `ExtractClaims` los fragmentos de texto libre. Bajo 0,7 de confianza, el hecho queda rechazado y visible.
3. Dentro de `UnitOfWork.run`:
   1. `IngestRevision` clasifica cada hecho contra lo vigente: igual, corrobora, cambio (fuente con autoridad), discrepancia (sin autoridad) o desfase (hecho «usa»).
   2. `elementsFromBaseline` arma la base y el siguiente de cada elemento; `DetectChanges` (`diffSnapshots`) persiste un `Change` por elemento.
   3. `AnalyzeChange` por cada cambio: hallazgos por afectado, filtrados con su razón, `costDelta` y `delayDays`.
   4. `NotifyStakeholders` una vez: un aviso por afectado con sus hallazgos de todos los hunks.
   5. `OpenProposal`: revisores = unión de afectados; reemplaza la propuesta abierta del mismo documento.
   6. `ResolveOverlaps`, `OpenOverlaps` y `SettleOverlaps`: detecta solapamientos y fusiona lo que quedó listo.
   7. `track` inserta los eventos de sala.
4. Un voto (`POST /api/notifications/:id/response`) pasa por `RecordReview`, `RespondToNotification` y `SettleOverlaps`. Fusiona cuando todos aprueban y no hay solapamientos vivos.

## Las 26 tareas

Estado de cada tarea del plan original frente al código, con su evidencia y lo que falta. Estados: `hecho`, `distinto` (resuelto de otra forma), `parcial`, `falta`.

### Fundaciones

**1 · Monorepo y CI** · `distinto`

- Hay: Nx 24 (`nx.json`), pnpm 10, ESLint 9 con fronteras por tags (`eslint.config.mjs`), Prettier, Vitest, `.github/workflows/check.yml` con `pnpm check`.
- Falta: Sentry. Va como `@sentry/nestjs` en `apps/api/src/main.ts` y `@sentry/nextjs` en `apps/web`, con el DSN validado en `apps/api/src/config/env.ts` como opcional.
- Listo cuando: un error lanzado a propósito en la API y en la web llega a Sentry, y sin DSN nada cambia.

**2 · Modelo de datos** · `parcial`

- Hay: Prisma 7, `data/main/prisma/schema.prisma` y doce migraciones. El proyecto vive en la base: `projects` con su organización, y `project_id` en las tablas del proyecto, el lago, los avisos y la sala. `pnpm db:seed` siembra Los Aromos.
- Falta: servir más de un proyecto. La API carga uno al arrancar (`apps/api/src/modules/project/project.module.ts`) y los adapters `InMemoryProjectGraph` e `InMemoryStakeholderDirectory` se arman con él. Ver la receta [el proyecto en la base](#el-proyecto-en-la-base).

**3 · Autenticación** · `distinto`

- Hay: Auth0 para la identidad (`apps/web/src/lib/auth0.ts` en la web; `accounts.service.ts` valida el token en la API) y, en Postgres, `organizations`, `users`, `memberships` e `invitations`, con los roles `admin` y `member` (`AccountGuard`, `requireAdmin`). Es opcional: sin las variables `AUTH0_*` la API arranca, las rutas con cuenta no funcionan y la web avisa que las cuentas no están configuradas.
- La sala y el caso no usan la cuenta: siguen con el token de asiento hasheado con SHA-256 (`apps/api/src/modules/room/seats.service.ts`) y `PRESENTER_KEY` (`credentials.ts`), sin usuarios, a propósito ([muestra](../muestra.md#espacio-controlado)).
- Falta: nada que la muestra pida.

**4 · Infraestructura y despliegue** · `parcial`

- Hay: `docker-compose.yml`, `render.yaml` (API Docker y Postgres administrado; `PRESENTER_KEY` generada), `apps/web/vercel.json`, `apps/api/Dockerfile`. Ver [despliegue](../despliegue.md).
- Falta: un ambiente de staging (segundo servicio y base en Render, preview en Vercel).

### Integración con Autodesk

**5 · OAuth con APS** · `parcial`

- Hay: `apps/api/src/modules/integrations/aps/`. Un administrador autoriza (`POST /api/organizations/:organizationId/integrations/aps/authorize`), `GET /api/integrations/aps/callback` guarda la cuenta de Autodesk de la organización, y los tokens van cifrados con AES-256-GCM (`token-cipher.ts`, `APS_TOKEN_KEY`) en `aps_connections` por el puerto `TokenVault` (`prisma-token-vault.ts`). La web la muestra en `components/cuenta/AutodeskCard.tsx`, dentro de `/cuenta`.
- Falta: que algo use esos tokens para leer ACC. Hoy nada los consume.

**6 · Webhooks de APS** · `falta`

- Hay: la ingesta genérica `POST /api/revisions` y la idempotencia por `x-action-id` en `action-log.ts`, solo en memoria.
- Falta: la ruta de Nest con firma validada, idempotencia persistente (una tabla) y encolado en la outbox (tarea 10). El webhook termina en la misma ingesta.

**7 · Spike de AEC Data Model** · `distinto`

- Hay: el cambio por elemento. El add-in compara cada guardado con el anterior (`tool-use-case/revit/src/Team27.Minuta.Revit/ChangeTracker.cs`) y `DetectChanges` lo convierte en `Change`.
- Spike hecho: [aec-data-model.md](aec-data-model.md). ACC lo entrega con `diffElementGroupByVersionWithLatest`, por versión sincronizada o publicada y no por guardado, y solo con el modelo en un hub de ACC con AEC Data Model activado.
- Falta: comprobarlo con un hub real (la lista está al final del spike) y, si sirve, un conector que arme la misma minuta y la mande a `POST /api/integrations/revit/minutes`.

**8 · Parser de Presto o S10** · `distinto`

- Hay: `apps/etl/src/transform/presupuesto.ts`, sobre un CSV ficticio.
- Falta: el formato real (Presto exporta FIEBDC-3, `.bc3`). Ver la receta [agregar un conector o un parser](#agregar-un-conector-o-un-parser).
- El conector de Google Sheets ya conecta y escucha las planillas, pero no las lee: ver [integraciones](integraciones.md).

**9 · Parser de P6 o MS Project** · `distinto`

- Hay: `apps/etl/src/transform/gantt.ts`, sobre un CSV ficticio.
- Falta: los formatos reales (XER de P6, XML de MS Project). Misma receta.

### Núcleo

**10 · Worker y colas** · `falta`

- Hay: la cadena sincrónica en `coordination.service.ts`.
- Falta: ver la receta [una tarea diferida](#una-tarea-diferida). La cadena no se vuelve asíncrona: solo lo que sale al mundo.

**11 · Detector de cambios** · `hecho`

- `context/lake/src/domain/classifyClaims.ts`, `Authority.ts` y `diffSnapshots.ts`; `IngestRevision` y `DetectChanges`.

**12 · Resolvedor de dependencias** · `hecho`

- `context/impact/src/domain/analyzeChange.ts` sobre `ProjectGraph.dependencies` (`watches`, `measures`). El grafo se lee de la base al arrancar: `InMemoryProjectGraph` desde `ProjectCatalog`.
- Pendiente aparte: conectar `SuggestAffected` a la API (segmento 7 de la [muestra](../muestra.md#segmentos)).

**13 · Detector de conflictos** · `hecho`

- `context/lake/src/domain/detectOverlaps.ts`, `Overlap.ts`; `OpenOverlaps`, `VoteOverlap`, `SettleOverlaps`. Las áreas salen del proyecto (`project_levels`, `project_systems` y los ejes de `projects`). Ver [solapamientos](../solapamientos.md).

**14 · Calculador de costo y plazo** · `hecho`

- `context/impact/src/domain/quantities.ts` y `schedule.ts` (`criticalPath`, holgura).

**15 · Redactor de avisos** · `parcial`

- Hay: `draftNotifications` en `context/notification/src/domain/Notification.ts` (un aviso por afectado, hallazgos con `summary`, `details` y `action`). El canal solo cambia el look en `apps/web/src/components/asiento/Channel.tsx`.
- Falta: una función pura de dominio que rinda el texto por canal y rol (asunto y cuerpo de correo, plantilla de WhatsApp, tarjeta de Teams), con tests.

**16 · Seguimiento** · `parcial`

- Hay: el autor ve quién aprobó, disputó o falta (`GET /api/proposals`, `/presentador`, «Tus propuestas»); `ReopenProposal` y `WithdrawProposal`.
- Falta: «No me afecta» (receta [un tipo de respuesta](#un-tipo-de-respuesta)), recordatorios y escalamiento (receta [una tarea diferida](#una-tarea-diferida)).

### Canales

**17 · Correo con Resend** · `falta` · **18 · WhatsApp** · `falta` · **19 · Teams** · `falta` · **20 · ACC Issues** · `falta`

- Hay: canales simulados. Un aviso guardado es un aviso entregado, y la web lo muestra con el look de su canal.
- Falta: ver la receta [un canal real](#un-canal-real). Teams y ACC Issues además suman un valor a `CHANNELS`. WhatsApp necesita un webhook de entrada que convierta la respuesta en voto.
- Slack y Teams reales son nice to have: van después del correo y WhatsApp. En la muestra, Slack sigue simulado.

### Web

**21 · Onboarding del administrador** · `parcial`

- Hay: crear un proyecto desde la web (`/proyectos/nuevo`, `components/proyectos/NewProjectForm.tsx`; `POST /api/projects` y `GET /api/projects` en `accounts.controller.ts`), que lo deja en la organización de quien lo crea, con esa persona como único miembro. `/proyectos/[projectId]` lo muestra.
- Falta: espacios, documentos, equipo y mapa de dependencias del proyecto nuevo, y conectar ACC. Un proyecto nuevo no tiene grilla ni documentos, así que no se carga en la sala. Depende de que algo use los tokens de la tarea 5.

**22 · Editor del mapa de dependencias** · `falta`

- Hay: el grafo en la base (`project_dependencies`, `budget_items`, `schedule_tasks`), sembrado desde `data/main/seed/los-aromos.ts`.
- Falta: el editor.

**23 · Detalle y respuesta del aviso** · `hecho`

- `apps/web/src/app/(site)/cambios/`, `components/cambios/ChangeDetailBody.tsx` y `ChangeResponse.tsx`; `components/asiento/VoteForm.tsx`; `POST /api/notifications/:id/response`.

**24 · Vista de estado** · `hecho`

- `/sala` (`components/sala/`), `/presentador` (`components/presentador/`), «Tus propuestas» (`components/asiento/AuthorActions.tsx`).

### Piloto

**25 · Proyecto de prueba y punta a punta** · `distinto`

- Hay: Los Aromos y el guion del ETL; `apps/etl/tests/golden.spec.ts`; `pnpm etl auto --velocidad 4` llega a «Obra consensuada».
- Falta: tests contra Postgres (votos simultáneos, asientos, reinicio), probar el add-in dentro de Revit y, para el producto, un proyecto en ACC.

**26 · Métricas del piloto** · `falta`

- Hay: `notifications` guarda `channel`, `sent_at`, `response` y `responded_at`.
- Falta: un caso de uso de lectura en `notification` (tiempo de respuesta, respuesta por canal) y su vista. La tasa de «no me afecta» depende de la tarea 16.

## Recetas

### Un canal real

1. En `context/notification/src/application/ports/`, un puerto `ChannelSender` con `send(notification, rendered)`.
2. En `domain/`, la función que rinde el texto por canal (tarea 15), pura y con tests.
3. Un adapter por proveedor en `infra/adapters/`, exportado por `/adapters`, con su test usando un cliente falso.
4. El envío no corre dentro de la cadena: `NotifyStakeholders` escribe en la outbox ([una tarea diferida](#una-tarea-diferida)) y el worker llama al `ChannelSender`.
5. En `apps/api/src/modules/notification/`, registra el adapter por token; elige el adapter por canal según variables de entorno opcionales en `config/env.ts`. Sin la variable, el canal queda simulado, como hoy.
6. Si el canal es nuevo, agrégalo a `CHANNELS` y su look en `apps/web/src/components/asiento/Channel.tsx`.
7. Actualiza `context/notification/README.md`, [arquitectura](../arquitectura.md#coordinación-de-un-cambio) y `.env.example`.

### Un tipo de respuesta

Para «No me afecta» (`not_affected`):

1. Súmalo a `RESPONSE_KINDS` en `context/notification/src/domain/Notification.ts`.
2. Decide en `lake` qué significa para la propuesta. Opción mínima: el revisor sale de la propuesta como filtrado, con su nota como razón, y la propuesta se decide con el resto. Es una función nueva de dominio en `Proposal.ts`, con tests; no cambies `decideProposal`.
3. En `coordination.service.ts`, traduce la respuesta a la operación del lago, dentro de la misma transacción.
4. En la web, el botón en `VoteForm.tsx` y `ChangeResponse.tsx`, y el tipo en `apps/web/src/lib/votes-api.ts`.
5. Actualiza [multijugador](../multijugador.md#propuesta-y-consenso) y el README de la API.

### Una tarea diferida

Para envíos, reintentos, recordatorios y escalamiento:

1. Un modelo `OutboxMessage` en `schema.prisma` (tipo, payload JSON, `available_at`, intentos, último error, `done_at`) y su migración.
2. Quien produce el trabajo inserta la fila con el cliente de la transacción de `UnitOfWork.run`: si la acción falla, no queda nada por enviar.
3. Un worker de Nest en la API toma filas con `SELECT … FOR UPDATE SKIP LOCKED`, ejecuta y reprograma con backoff. pg-boss es la alternativa, sobre el mismo Postgres.
4. Los recordatorios son filas con `available_at` futuro, que se descartan si el aviso ya tiene respuesta al ejecutarse.
5. `POST /api/room/reset` también vacía la outbox.

### Agregar un conector o un parser

- La extracción de lo estructurado ocurre en el conector, no en la API: el parser produce fragmentos (`Chunk`) con sus hechos (`subject`, `attribute`, `value`, `unit`, `role`) y los entrega por `POST /api/revisions`.
- El parser es una función pura con un test de oro sobre un archivo de ejemplo, como `apps/etl/src/transform/` y `apps/etl/tests/golden.spec.ts`.
- `apps/etl` es la simulación de la muestra: un conector real no va ahí. Va en el módulo de la API que recibe esa fuente (por ejemplo `integrations/aps`) o en una herramienta de `tool-use-case/`, como el add-in de Revit.
- Los sujetos y atributos tienen que existir en el proyecto (`project_subjects` y `project_attributes`); si no, la API responde `422 invalid_claims`.

### El proyecto en la base

Lo hecho: las tablas `projects`, `project_members`, `project_spaces`, `project_documents`, `project_subjects`, `project_attributes`, `budget_items`, `schedule_tasks`, `project_dependencies`, `project_levels` y `project_systems`, con `project_id` también en las tablas del lago, los avisos y la sala; `data/main/project/` las lee y escribe, y `apps/api/src/modules/project/` arma el `ProjectCatalog` al arrancar.

Lo que falta:

1. Que la API sirva más de un proyecto. Hoy el catálogo es uno por proceso (`PROJECT_ID` o el más antiguo) y los adapters en memoria se arman con él.
2. Que un proyecto creado desde la web tenga grilla, elenco y documentos para poder cargarse en la sala.
3. Es la base de las tareas 21 y 22.

## Verificación

```bash
pnpm nx run @team27/context-<ctx>:test     # el contexto que tocaste
pnpm nx run @team27/api:test
pnpm check                                  # lint, test, typecheck y build de todo
pnpm db:up && pnpm db:migrate && pnpm dev   # y en otra terminal: pnpm etl auto --velocidad 4
```

Con `pnpm etl auto --velocidad 4`, el guion tiene que llegar a «Obra consensuada» con las cifras de la [muestra](../muestra.md#el-guion): +$5.634.500 y +1 día. Si cambian, rompiste una regla.

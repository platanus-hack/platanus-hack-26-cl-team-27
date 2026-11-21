# @team27/api

La API HTTP en NestJS 12, en `http://localhost:3001/api`. Compone los contextos hexagonales y los expone; la base le llega por [`@team27/data-main`](../../data/main/README.md).

## Comandos

```sh
pnpm dev:api                          # nest start --watch (o pnpm dev, con la web)
pnpm nx run @team27/api:build         # nest build → dist/
pnpm nx run @team27/api:start         # node dist/main.js
pnpm nx run @team27/api:test          # Vitest
```

## Rutas

Todas cuelgan de `/api`. Los POST responden 201, salvo los que dicen 204. Los errores traen `{ statusCode?, code, message }`.

| Ruta | Responde |
| ---- | -------- |
| `GET /health` | `{"status":"ok"}` si el proceso vive. No toca la base |
| `GET /health/ready` | `{"status":"ok","database":"ok"}`, o 503 `{"status":"unavailable","database":"error"}` si la base no responde |
| `POST /room/reset` | 204. Borra cambios, impactos, avisos y todas las tablas del lago en una transacción, y siembra el catálogo (nueve documentos, 15 valores vigentes confirmados en versión 1) |
| `GET /room` | Proyecto, `projectVersion`, `totals`, `consensus` (índice y sello), elenco (`occupant: "bot"`), espacios, `counters` y `seal` |
| `GET /spaces` | `{ spaces }`: cada espacio con sus documentos (`state`: `current`, `stale`, `discrepancy` o `acknowledged`), revisiones y hechos con su resultado |
| `GET /baseline?section=` | `{ version, totals, entries }`: lo vigente con `status` (`confirmed`, `proposed`, `disputed`), `proposedValue`, `sources`, `staleCount` y `version`. `section`: `estructura`, `instalaciones`, `fachada`, `costos` o `plazo` |
| `GET /baseline/:subjectId/:attribute/provenance` | La cadena de procedencia: valor vigente y anteriores con revisión, espacio, autor, propuesta, votos con nota y hora y discrepancias que lo respaldaron; 404 si no hay valor |
| `GET /seats/:castId/tray` | Los documentos que el asiento puede soltar, con la vista previa de sus hechos, `available`, `blockedReason` y `dropped`; 404 si el asiento no existe |
| `POST /spaces/:spaceId/drops` | `{ fixtureId }`: suelta un documento del catálogo y ejecuta toda la cadena. Responde `{ revisionId, claims, proposals, discrepancies, backed, stale }` |
| `GET /proposals?status=` | `{ proposals }`. `status`: `open`, `disputed`, `merged`, `withdrawn`, `replaced` o `active` (abiertas y en disputa) |
| `POST /notifications/:id/response` | `{ kind: "reviewed" \| "issue", note? }`: el voto. Responde `{ notification, proposal, merged, stale, projectVersion }` |
| `POST /proposals/:id/reopen` | La autora reabre una propuesta en disputa: solo quien disputó vuelve a pendiente. Responde la propuesta |
| `POST /proposals/:id/withdraw` | La autora retira la propuesta. Responde la propuesta |
| `POST /discrepancies/:id/dismiss` | 204. El dueño del valor descarta la discrepancia; `{ note? }` opcional |
| `POST /stale/acknowledge` | 204. `{ revisionId, note }`: el dueño del documento confirma sin cambio; la nota es obligatoria |
| `GET /changes?limit=20` | Los cambios más recientes (hasta 50), cada uno con su `impact`, sus `notifications` y su `proposal` |
| `GET /changes/:id` | Un cambio con su impacto, sus avisos y su propuesta; 404 si no existe |

Cabeceras:

- `x-seat: <castId>` identifica quién actúa en drops, votos, reabrir, retirar, descartar y confirmar. Es provisional: el token de asiento (`x-seat-token`) lo reemplaza cuando existan los asientos. Sin ella o con un asiento desconocido, 401 (`seat_required`, `unknown_seat`).
- `x-action-id: <id>` hace idempotentes los drops y los votos: la misma acción devuelve la respuesta de la primera. Se guarda en memoria del proceso (hasta 500) y el reinicio la limpia.

Errores de negocio:

| Código | Cuándo |
| ------ | ------ |
| 400 | La entrada no cumple su schema de zod |
| 401 `seat_required` / `unknown_seat` | Falta el asiento o no existe |
| 403 `not_your_fixture` / `not_your_notification` / `not_author` / `not_owner` | El asiento no es el del documento, el aviso, la propuesta o el valor |
| 404 `fixture_not_found` / `not_found` | El fixture no está en ese espacio, o no existe el recurso |
| 409 `already_ingested` | La revisión del fixture ya está en el repositorio |
| 409 `blocked` | Falta ingerir la revisión que el fixture necesita (`a201-revD` pide `a201-revC`) |
| 409 `invalid_state` | Una regla del dominio lo impide: votar distinto de lo ya votado, votar una propuesta cerrada, reabrir una que no está en disputa |

- Los ids de propuestas, avisos, discrepancias, revisiones y cambios son UUID.
- Cada acción de escritura corre en una transacción de Postgres bajo un advisory lock; el voto además bloquea la fila de la propuesta con `SELECT … FOR UPDATE`.

## Estructura

```
src/
├── main.ts                       arranque: CORS, apagado ordenado y puerto
├── app.setup.ts                  prefijo /api, validación con schemas y filtro de errores (también los usan los tests)
├── app.module.ts                 los módulos de la app
├── config/                       variables de entorno validadas con zod
├── common/provide-use-case.ts    registra un caso de uso de un contexto como provider de Nest
├── scenario/
│   ├── los-aromos.ts             modelo base, grafo del proyecto y elenco (con Fernanda, que no recibe avisos)
│   └── documents.ts              espacios, documentos, revisiones sembradas y fixtures con sus hechos
└── modules/
    ├── database/                 el PrismaClient (token PRISMA_CLIENT), global, y UnitOfWork (transacción con lock)
    ├── health/                   /api/health y /api/health/ready
    ├── lake/                     adapters por token y casos de uso de context-lake; buildLake(db) los arma sobre una transacción
    ├── capture/                  adapters y casos de uso de context-capture
    ├── impact/                   adapters y casos de uso de context-impact (el grafo sale del guion)
    ├── notification/             adapters y casos de uso de context-notification
    └── coordination/             orquesta la cadena y expone las rutas
tests/                            replica src/: Vitest; scenario/ prueba el catálogo con los casos de uso reales sobre puertos en memoria
```

- **`CoordinationService`** es el único que conoce los cuatro contextos. Un drop hace, en una transacción: `IngestRevision`, y por cada borrador de propuesta arma la base y el siguiente con `elementsFromBaseline`, llama a `DetectChanges`, `AnalyzeChange` y `NotifyStakeholders`, y abre la propuesta con `OpenProposal` (revisores: los afectados con hallazgos; filtrados: los de `impact`). Un voto pasa por `RecordReview` y `RespondToNotification`; al reabrir, `ReopenProposal` y `ReopenResponse` para quienes disputaron.
- **`QueryService`** arma las vistas (lo vigente, procedencia, espacios, bandeja, propuestas, cambios y sala) desde los repositorios del lago y los casos de uso de lectura.
- **Transacciones.** `UnitOfWork.run` abre una transacción interactiva, toma `pg_advisory_xact_lock` y entrega un cliente con el que `buildLake`, `buildCapture`, `buildImpact` y `buildNotification` crean sus adapters y casos de uso: todo lo que hace una acción queda en la misma transacción.
- **Totales.** El costo del proyecto es el presupuesto base del modelo más el `costDelta` de las propuestas fusionadas; el plazo es la entrega vigente más sus `delayDays`; la versión del proyecto es 1 más las propuestas fusionadas.
- **El reinicio y el arranque** siembran el catálogo con `SeedLake`; al arrancar solo si lo vigente está vacío.

Variables, cómo se compone un contexto y por qué Node ejecuta los paquetes del workspace como TypeScript: [arquitectura](../../docs/arquitectura.md).

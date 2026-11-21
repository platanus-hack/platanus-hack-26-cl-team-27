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
| `GET /room` | Snapshot: `epoch`, `cursor`, proyecto, `projectVersion`, `totals`, `consensus`, elenco con `occupant` (`human`, `bot` o `presenter`), espacios, `counters`, `seal` y `autoplay` (`enabled`, `speed`) |
| `GET /events?after&epoch&seat&limit` | Sondeo con cursor: `{ epoch, cursor, reset, seat, events }`. Con `x-seat-token` es el latido y devuelve en `seat` el asiento que reconoció (`null` si el token no vale). Dispara el tick de los bots. `limit` 1 a 200 (100 por defecto) |
| `POST /seats/:castId/claim` | 201 `{ castId, token, cast }`. El token se devuelve una sola vez y se guarda hasheado. 409 `seat_taken` si hay latido en los últimos 20 s; 403 `presenter_seat` para Fernanda |
| `DELETE /seats/:castId` | 204. Suelta el asiento: el del dueño (`x-seat-token`) o cualquiera con `x-presenter-key` |
| `GET /seats/:castId/inbox` | `{ castId, items, authoring }`: votos (con progreso), discrepancias, desfases y filtrados del asiento, y las propuestas activas que escribió |
| `GET /room/scenes` | `{ scenes, autoplay }`. Cada escena trae `status` (`pending`, `running`, `played`), `playable` y `disabledReason`. Con `x-presenter-key` |
| `POST /room/scenes/:id/play` | 204. Pone la escena en curso: los bots sueltan sus documentos. 409 `scene_unavailable` si ya se jugó, hay otra en curso o falta una precondición. Con `x-presenter-key` |
| `POST /room/autoplay` | 204. `{ enabled, speed: 1 \| 2 \| 4 }` (acepta `on` en vez de `enabled`). Con `x-presenter-key` |
| `POST /room/reset` | 200 `{ epoch }`. Borra asientos, eventos, tareas de bot, cambios, impactos, avisos y todas las tablas del lago en una transacción, apaga el autoplay, suma uno a la época y siembra el catálogo (nueve documentos, 15 valores vigentes confirmados en versión 1). Con `x-presenter-key` |
| `GET /spaces` | `{ spaces }`: cada espacio con sus documentos (`state`: `current`, `stale`, `discrepancy` o `acknowledged`), revisiones y hechos con su resultado |
| `GET /baseline?section=` | `{ version, totals, entries }`: lo vigente con `status` (`confirmed`, `proposed`, `disputed`), `proposedValue`, `sources`, `staleCount` y `version`. `section`: `estructura`, `instalaciones`, `fachada`, `costos` o `plazo` |
| `GET /baseline/:subjectId/:attribute/provenance` | La cadena de procedencia: valor vigente y anteriores con revisión, espacio, autor, propuesta, votos con nota y hora y discrepancias que lo respaldaron; 404 si no hay valor |
| `GET /seats/:castId/tray` | Los documentos que el asiento puede soltar, con la vista previa de sus hechos, `available`, `blockedReason` y `dropped`; solo el dueño del asiento (o la presentadora, para Fernanda); 404 si el asiento no existe |
| `POST /spaces/:spaceId/drops` | `{ fixtureId }`: suelta un documento del catálogo y ejecuta toda la cadena. Responde `{ revisionId, claims, proposals, discrepancies, backed, stale }` |
| `POST /integrations/revit/minutes` | La minuta de cambios que el add-in de Revit ([`tool-use-case/revit`](../../tool-use-case/revit/README.md)) arma al guardar el modelo (`tool-use-case/revit/contract/minuta.example.json`). Con `x-presenter-key` actúa como Fernanda, dueña del modelo. Valida el cuerpo, convierte cada cambio de un valor que sigue el proyecto en un hecho, ingiere una revisión nueva del documento `modelo-revit` («Modelo Revit de arquitectura», rótulo `guardado N` o `minuta <8 primeros del minuteId>`) y corre la misma cadena que un drop. Responde 201 `{ minuteId, revisionId, documentId, label, title, claims, proposals, discrepancies, backed, stale, ignored, summary }`; `proposals` trae los revisores y los filtrados con su nombre y el `link` al cambio. Idempotente por el `minuteId` del cuerpo. Lo que no entra (elemento o atributo que el proyecto no sigue, unidad distinta, elemento eliminado, valor negativo) vuelve en `ignored` con su motivo |
| `GET /proposals?status=` | `{ proposals }`. `status`: `open`, `disputed`, `merged`, `withdrawn`, `replaced` o `active` (abiertas y en disputa) |
| `POST /notifications/:id/response` | `{ kind: "reviewed" \| "issue", note? }`: el voto. Responde `{ notification, proposal, merged, stale, projectVersion }` |
| `POST /proposals/:id/reopen` | La autora reabre una propuesta en disputa: solo quien disputó vuelve a pendiente. Responde la propuesta |
| `POST /proposals/:id/withdraw` | La autora retira la propuesta. Responde la propuesta |
| `POST /discrepancies/:id/dismiss` | 204. El dueño del valor descarta la discrepancia; `{ note? }` opcional. Repetirlo no cambia nada ni emite otro evento |
| `POST /stale/acknowledge` | 204. `{ revisionId, note }`: el dueño del documento confirma sin cambio; la nota es obligatoria |
| `GET /changes?limit=20` | Los cambios más recientes (hasta 50), cada uno con su `impact`, sus `notifications` y su `proposal` |
| `GET /changes/:id` | Un cambio con su impacto, sus avisos y su propuesta; 404 si no existe |

Cabeceras:

- `x-seat-token: <token>` identifica el asiento en drops, votos, reabrir, retirar, descartar, confirmar, bandeja y carpeta. Lo entrega `claim`. Cualquier petición válida con el token cuenta como latido. Sin token válido, 401 `seat_required`.
- `x-presenter-key: <clave>` es `PRESENTER_KEY`. Autoriza escenas, autoplay, reinicio y soltar asientos, y hace actuar como Fernanda (la presentadora y autora) en drops, reabrir y retirar. Sin clave válida, 401 `presenter_required`.
- `x-action-id: <id>` hace idempotentes los drops y los votos: la misma acción devuelve la respuesta de la primera. Se guarda en memoria del proceso (hasta 500) y el reinicio la limpia.

Tipos de evento (`kind`, repetido en `type`; cada uno trae `message` en español para el ticker y `refs` con los ids que toca): `document.dropped`, `minute.received`, `proposal.opened`, `proposal.disputed`, `proposal.reopened`, `proposal.merged`, `proposal.withdrawn`, `proposal.replaced`, `review.approved`, `discrepancy.opened`, `discrepancy.backed`, `discrepancy.dismissed`, `stale.detected`, `stale.acknowledged`, `consensus.sealed`, `seat.claimed`, `seat.released`, `scene.started`, `autoplay.changed` y `room.reset`. Las transiciones del orquestador los insertan en su misma transacción.

Cursor y época: `reset: true` (sin eventos) si `epoch` no es la actual o `after` va por delante del servidor; sin `after`, la respuesta trae solo el cursor actual; sin novedades, `events: []` y 200.

Errores de negocio:

| Código | Cuándo |
| ------ | ------ |
| 400 | La entrada no cumple su schema de zod |
| 401 `seat_required` | Falta el token de asiento, o ya no es válido |
| 401 `presenter_required` | Falta la clave del presentador o no es correcta |
| 403 `not_your_fixture` / `not_your_document` / `not_your_notification` / `not_author` / `not_owner` / `not_your_seat` / `presenter_seat` | El asiento no es el del documento (o, en una minuta de Revit, el dueño del modelo), el aviso, la propuesta, el valor o la bandeja, o se intenta tomar el asiento de la presentadora |
| 404 `fixture_not_found` / `not_found` | El fixture no está en ese espacio, o no existe el recurso |
| 409 `seat_taken` | El asiento tiene latido de los últimos 20 s (el cuerpo trae `error` y `code`) |
| 409 `scene_unavailable` | La escena ya se jugó, hay otra en curso o falta una precondición |
| 409 `already_ingested` | La revisión del fixture, o el rótulo de la minuta, ya está en el repositorio |
| 409 `blocked` | Falta ingerir la revisión que el fixture necesita (`a201-revD` pide `a201-revC`) |
| 409 `invalid_state` | Una regla del dominio lo impide: votar distinto de lo ya votado, votar una propuesta cerrada, reabrir una que no está en disputa |
| 422 `minute_empty` | Ningún cambio de la minuta corresponde a valores que siga el proyecto (el cuerpo trae `ignored`) |

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
│   ├── documents.ts              espacios, documentos (con el modelo de Revit, sin revisión sembrada), revisiones sembradas y fixtures con sus hechos
│   ├── bots.ts                   retardos por asiento, notas y quién disputa (Paula la losa, Javier el shaft); funciones puras
│   └── scenes.ts                 las escenas s1 a s6 y x1, x2, y el orden del autoplay
└── modules/
    ├── database/                 el PrismaClient (token PRISMA_CLIENT), global, y UnitOfWork (transacción con lock)
    ├── health/                   /api/health y /api/health/ready
    ├── lake/                     adapters por token y casos de uso de context-lake; buildLake(db, extractor?) los arma sobre una transacción
    ├── capture/                  adapters y casos de uso de context-capture
    ├── impact/                   adapters y casos de uso de context-impact (el grafo sale del guion)
    ├── notification/             adapters y casos de uso de context-notification
    ├── coordination/             orquesta la cadena y expone las rutas de datos; `revit-minute.ts` valida la minuta de Revit y la convierte en hechos, y `integrations.controller.ts` la recibe
    └── room/                     asientos, eventos, tick de bots, escenas, autoplay y reinicio (módulo de la API, no un contexto)
tests/                            replica src/: Vitest; scenario/ prueba el catálogo con los casos de uso reales sobre puertos en memoria
```

- **`CoordinationService`** es el único que conoce los cuatro contextos. Un drop hace, en una transacción: `IngestRevision`, y por cada borrador de propuesta arma la base y el siguiente con `elementsFromBaseline`, llama a `DetectChanges`, `AnalyzeChange` y `NotifyStakeholders`, y abre la propuesta con `OpenProposal` (revisores: los afectados con hallazgos; filtrados: los de `impact`). Un voto pasa por `RecordReview` y `RespondToNotification`; al reabrir, `ReopenProposal` y `ReopenResponse` para quienes disputaron.
- **`QueryService`** arma las vistas (lo vigente, procedencia, espacios, bandeja, propuestas, cambios y sala) desde los repositorios del lago y los casos de uso de lectura.
- **Transacciones.** `UnitOfWork.run` abre una transacción interactiva, toma `pg_advisory_xact_lock` y entrega un cliente con el que `buildLake`, `buildCapture`, `buildImpact` y `buildNotification` crean sus adapters y casos de uso: todo lo que hace una acción queda en la misma transacción.
- **Totales.** El costo del proyecto es el presupuesto base del modelo más el `costDelta` de las propuestas fusionadas; el plazo es la entrega vigente más sus `delayDays`; la versión del proyecto es 1 más las propuestas fusionadas.
- **El reinicio y el arranque** siembran el catálogo con `SeedLake`; al arrancar solo si lo vigente está vacío.
- **Eventos.** `CoordinationService.track` compara el estado antes y después de cada transición (propuestas, desfases, sello) y, con los eventos explícitos de la acción, los inserta en la misma transacción.
- **Tick de bots.** `TickService.tick` corre desde `GET /events` y desde jugar una escena o encender el autoplay, como máximo cada 500 ms por proceso y bajo `pg_try_advisory_xact_lock`. Avanza las escenas, crea las tareas que faltan (soltar, votar, reabrir) con clave única y ejecuta hasta cinco vencidas, solo para asientos sin latido de los últimos 20 s. El voto de un bot sale de `planVote`; Paula disputa la losa y Javier el shaft, y ambos aprueban tras la reapertura.
- **Escenas y autoplay.** Una escena en curso crea una tarea de soltar por cada documento pendiente. Termina cuando están todos soltados y no queda propuesta abierta; entonces hay una pausa de 3 s (dividida por la velocidad). El autoplay lanza la siguiente de `AUTOPLAY_CHAIN` (`s1` a `s4`, `x1`, `x2`, `s5`, `s6`) cuando no hay propuesta abierta, y la presentadora reabre una propuesta en disputa a los 4 s. Si el dueño de un documento es una persona con latido, la escena espera a que lo suelte.
- **Variables.** `PRESENTER_KEY` (por defecto `sala-los-aromos` fuera de producción; obligatoria en producción).

Variables, cómo se compone un contexto y por qué Node ejecuta los paquetes del workspace como TypeScript: [arquitectura](../../docs/arquitectura.md).

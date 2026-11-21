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
| `GET /room` | Snapshot: `epoch`, `cursor`, proyecto, `projectVersion`, `totals`, `consensus`, elenco con `occupant` (`human`, `bot` si lo juega el ETL, o `presenter`), espacios, `counters` (incluye `openOverlaps`), `seal` y `lake: { empty }` (`true` mientras no hay carga inicial: el snapshot responde igual, con ceros) |
| `GET /events?after&epoch&seat&limit` | Sondeo con cursor: `{ epoch, cursor, reset, seat, events }`. Con `x-seat-token` es el latido y devuelve en `seat` el asiento que reconoció (`null` si el token no vale). `limit` 1 a 200 (100 por defecto) |
| `POST /seats/:castId/claim` | 201 `{ castId, token, cast }`. El token se devuelve una sola vez y se guarda hasheado. 409 `seat_taken` si hay latido en los últimos 20 s; 403 `presenter_seat` para Fernanda |
| `DELETE /seats/:castId` | 204. Suelta el asiento: el del dueño (`x-seat-token`) o cualquiera con `x-presenter-key` |
| `GET /seats/:castId/inbox` | `{ castId, items, authoring }`: solapamientos por validar (`type: 'overlap'`, con `myVote`), votos (con progreso y `blockedByOverlap`), discrepancias, desfases y filtrados del asiento, y las propuestas activas que escribió |
| `POST /room/reset` | 200 `{ epoch }`. Borra asientos, eventos, cambios, impactos, avisos y todas las tablas del lago en una transacción y suma uno a la época. No siembra: el lago queda vacío hasta `POST /lake/seed`. Con `x-presenter-key` |
| `POST /lake/seed` | 201 `{ revisions, baseline }`. `{ revisions: [ cuerpo de /revisions + authorId ] }` (los fragmentos pueden ir vacíos; los de texto libre los lee la API): deja lo vigente confirmado con su procedencia en versión 1, en el orden dado. Solo con el lago vacío (409 `lake_not_empty`). Valida como `/revisions` y además `authorId` (422 `invalid_author`) y que no se repita documento y rótulo (422 `duplicate_revision`). Emite `lake.seeded`. Con `x-presenter-key` |
| `GET /spaces` | `{ spaces }`: cada espacio con sus documentos (`state`: `current`, `stale`, `discrepancy` o `acknowledged`), revisiones, sus fragmentos (con el texto y lo rechazado por la inferencia) y hechos con su resultado y su confianza |
| `GET /areas` | La ocupación vigente: `levels`, `axes` (longitudinales con sus metros y transversales), `spans`, `cells`, `systems`, `occupants` (huella `areas` de cada elemento con espacio, `proposed` si un PR abierto la mueve, quién la respalda y los solapamientos vivos que toca) y `overlaps` vivos |
| `GET /overlaps?status=` | `{ overlaps }`. `status`: `abierto`, `confirmado`, `descartado`, `resuelto` o `activo` (abiertos y confirmados). Cada uno trae `id`, `kind`, `status`, `relation`, `title`, `area` (`nivel`, `celda`, `sistemas`, `label`), los dos elementos, `chunkLocator`, la revisión, `otherBacking`, `proposalId`, `otherProposalId`, `validators`, `votes`, `resolution` y las fechas |
| `POST /overlaps/:id/vote` | 200. `{ kind: 'se_tocan' \| 'no_se_tocan', note? }` de un validador (token de asiento, o clave más `x-act-as`; `x-action-id` lo hace idempotente). Responde `{ overlap, proposal, merged, stale, projectVersion }`. 403 `not_validator` si no valida ese solapamiento; 409 `invalid_state` si cambia su voto o el solapamiento ya no admite votos |
| `GET /baseline?section=` | `{ version, totals, entries }`: lo vigente con `status` (`confirmed`, `proposed`, `disputed`), `proposedValue`, `sources`, `staleCount` y `version`. `section`: `estructura`, `instalaciones`, `fachada`, `costos` o `plazo` |
| `GET /baseline/:subjectId/:attribute/provenance` | La cadena de procedencia: valor vigente y anteriores con revisión, espacio, autor, propuesta, votos con nota y hora y discrepancias que lo respaldaron; 404 si no hay valor |
| `POST /revisions` | La puerta genérica de ingesta: `{ documentId, label, spaceId, pointer, contentHash?, chunks: { locator, kind: 'fila' \| 'anotacion' \| 'acuerdo' \| 'mensaje' \| 'parametro' \| 'texto', text?, claims?: { subject, attribute, value, unit, role: 'afirma' \| 'usa', confidence? }[] }[] }`. Un fragmento con `claims` es estructurado; uno con `text` y sin `claims` es de texto libre y lo lee `context/impact` (evidencia: el texto más el título del documento y la revisión; confianza mínima 0,7). El `claims` de primer nivel sigue valiendo como fragmentos implícitos de tipo `fila`, uno por localizador. El actor es el dueño del documento (token de asiento, o clave más `x-act-as`). Ejecuta toda la cadena y responde 201 `{ revisionId, claims, chunks, proposals, overlaps, resolvedOverlaps, discrepancies, backed, stale }`. `claims` trae `confidence` y `locator`; `chunks`, `source` (`estructurado` o `inferencia`) y lo `rejected`. `proposals` trae como mucho una (el PR de la revisión): `id`, `changeId`, `documentId`, `label`, `authorId`, `title`, `status`, `costDelta`, `delayDays`, `reviewers` (ids), `filtered`, `hunks` (`subjectId`, `attribute`, `before`, `after`, `locator`, `changed`), `unchangedHunks`, `blockedByOverlap` y `waitingFor`. Idempotente con `x-action-id`. No exige un orden entre revisiones |
| `POST /integrations/revit/minutes` | La minuta de cambios que el add-in de Revit ([`tool-use-case/revit`](../../tool-use-case/revit/README.md)) arma al guardar el modelo (`tool-use-case/revit/contract/minuta.example.json`). Con `x-presenter-key` actúa como Fernanda, dueña del modelo. Valida el cuerpo, convierte cada cambio de un valor que sigue el proyecto en un hecho, ingiere una revisión nueva del documento `modelo-revit` («Modelo Revit de arquitectura», rótulo `guardado N` o `minuta <8 primeros del minuteId>`) y corre la misma cadena que `POST /revisions`, que comparte el camino interno. Responde 201 `{ minuteId, revisionId, documentId, label, title, claims, chunks, proposals, overlaps, resolvedOverlaps, discrepancies, backed, stale, ignored, summary }`; `proposals` trae los revisores y los filtrados con su nombre y el `link` al cambio. Idempotente por el `minuteId` del cuerpo. Lo que no entra (elemento o atributo que el proyecto no sigue, unidad distinta, elemento eliminado, valor negativo) vuelve en `ignored` con su motivo |
| `GET /proposals?status=` | `{ proposals }`: el PR de cada revisión. Trae `documentId`, `label`, `revision`, `hunks` (los que cambian y, con `changed: false`, los que quedan como contexto), `unchangedHunks`, `checks` (`cost`, `schedule` y `overlaps` con sus conteos), `overlaps`, `blockedByOverlap` y `waitingFor` («Espera la validación del solapamiento»); el costo y el atraso son la suma de sus hunks. Cada revisor trae `stakeholderId`, `notificationId` y `decision` (`approve`, `dispute` o `null`). `status`: `open`, `disputed`, `merged`, `withdrawn`, `replaced` o `active` (abiertas y en disputa) |
| `POST /notifications/:id/response` | `{ kind: "reviewed" \| "issue", note? }`: el voto. Responde `{ notification, proposal, merged, stale, projectVersion }` |
| `POST /proposals/:id/reopen` | La autora reabre una propuesta en disputa: solo quien disputó vuelve a pendiente. Responde la propuesta |
| `POST /proposals/:id/withdraw` | La autora retira la propuesta. Responde la propuesta |
| `POST /discrepancies/:id/dismiss` | 204. El dueño del valor descarta la discrepancia; `{ note? }` opcional. Repetirlo no cambia nada ni emite otro evento |
| `POST /stale/acknowledge` | 204. `{ revisionId, note }`: el dueño del documento confirma sin cambio; la nota es obligatoria |
| `GET /changes?limit=20` | Los cambios más recientes (hasta 50), cada uno con su `impact`, sus `notifications` y su `proposal` |
| `GET /changes/:id` | Un cambio con su impacto, sus avisos y su propuesta; 404 si no existe |

Cabeceras:

- `x-seat-token: <token>` identifica el asiento en ingesta, votos, reabrir, retirar, descartar, confirmar y bandeja. Lo entrega `claim`. Cualquier petición válida con el token cuenta como latido. Sin token válido, 401 `seat_required`.
- `x-presenter-key: <clave>` es `PRESENTER_KEY`. Autoriza el reinicio, la carga inicial y soltar asientos, y hace actuar como Fernanda (la presentadora y autora) en el resto de las acciones. Sin clave válida, 401 `presenter_required`.
- `x-act-as: <castId>`, junto con la clave, hace actuar como ese asiento del elenco en todas las acciones de asiento (ingesta, minuta de Revit, votos, reabrir, retirar, descartar, confirmar sin cambio y bandeja). Si una persona tiene el asiento (latido de los últimos 20 s), 409 `seat_held`; si el asiento no existe, 404 `not_found`. El token de asiento manda sobre `x-act-as`. Sin la clave, `x-act-as` no sirve.
- `x-action-id: <id>` hace idempotentes la ingesta, la minuta y los votos: la misma acción devuelve la respuesta de la primera. Se guarda en memoria del proceso (hasta 500) y el reinicio la limpia.

Tipos de evento (`kind`, repetido en `type`; cada uno trae `message` en español para el ticker y `refs` con los ids que toca): `revision.received`, `minute.received`, `proposal.opened`, `proposal.disputed`, `proposal.reopened`, `proposal.merged`, `proposal.withdrawn`, `proposal.replaced`, `review.approved`, `discrepancy.opened`, `discrepancy.backed`, `discrepancy.dismissed`, `overlap.detected`, `overlap.voted`, `overlap.cleared`, `overlap.confirmed`, `overlap.resolved`, `stale.detected`, `stale.acknowledged`, `consensus.sealed`, `seat.claimed`, `seat.released`, `lake.seeded` y `room.reset`. Las transiciones del orquestador los insertan en su misma transacción.

Cursor y época: `reset: true` (sin eventos) si `epoch` no es la actual o `after` va por delante del servidor; sin `after`, la respuesta trae solo el cursor actual; sin novedades, `events: []` y 200.

Errores de negocio:

| Código | Cuándo |
| ------ | ------ |
| 400 | La entrada no cumple su schema de zod |
| 401 `seat_required` | Falta el token de asiento, o ya no es válido |
| 401 `presenter_required` | Falta la clave del presentador o no es correcta |
| 403 `not_your_document` / `not_your_notification` / `not_author` / `not_owner` / `not_validator` / `not_your_seat` / `presenter_seat` | El asiento no es el del documento (o, en una minuta de Revit, el dueño del modelo), el aviso, la propuesta, el valor, el solapamiento o la bandeja, o se intenta tomar el asiento de la presentadora |
| 404 `unknown_document` / `not_found` | El documento no está en el registro del proyecto, o no existe el recurso (también un `x-act-as` fuera del elenco) |
| 409 `seat_taken` | El asiento tiene latido de los últimos 20 s (el cuerpo trae `error` y `code`) |
| 409 `seat_held` | Un `x-act-as` apunta a un asiento que tiene una persona |
| 409 `already_ingested` | Ya está en el repositorio esa revisión (`documentId` y `label`) o el rótulo de la minuta |
| 409 `lake_not_empty` | La carga inicial solo vale con el lago vacío |
| 409 `invalid_state` | Una regla del dominio lo impide: votar distinto de lo ya votado, votar una propuesta o un solapamiento cerrado, reabrir una que no está en disputa |
| 422 `invalid_claims` | La revisión trae sujetos o atributos que el proyecto no tiene, o un espacio distinto al del documento (el cuerpo trae `issues`) |
| 503 `inference_unavailable` | El modelo no respondió al leer un fragmento de texto libre (solo con `ANTHROPIC_API_KEY`) |
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
│   ├── areas.ts                  niveles, grilla de ejes, sistemas y la huella de cada elemento (el modelo de áreas)
│   └── documents.ts              espacios, sujetos, atributos con su unidad y el registro de documentos con su dueño (incluidos el modelo de Revit y el IS-301)
└── modules/
    ├── database/                 el PrismaClient (token PRISMA_CLIENT), global, y UnitOfWork (transacción con lock)
    ├── health/                   /api/health y /api/health/ready
    ├── lake/                     adapters por token y casos de uso de context-lake; buildLake(db, extractor?) los arma sobre una transacción
    ├── capture/                  adapters y casos de uso de context-capture
    ├── impact/                   adapters y casos de uso de context-impact: el grafo (sale de la definición del proyecto), el `ClaimReader` (Claude o respuestas fijas, con caché de archivos), el vocabulario del proyecto y `ExtractClaims`
    ├── notification/             adapters y casos de uso de context-notification
    ├── coordination/             orquesta la cadena y expone las rutas de datos; `revision-body.ts` valida la ingesta genérica y la carga inicial, `chunk-reader.ts` lee los fragmentos de texto libre, `revit-minute.ts` valida la minuta de Revit y la convierte en hechos, y `integrations.controller.ts` la recibe
    └── room/                     asientos, eventos, reinicio (módulo de la API, no un contexto)
tests/                            replica src/: Vitest, sin base de datos
```

- **`CoordinationService`** es el único que conoce los contextos. Antes de la transacción, `ChunkReader` lee con `ExtractClaims` los fragmentos de texto libre (los estructurados pasan tal cual). Una ingesta hace, en una transacción: `IngestRevision`, y con el borrador de la revisión arma la base y el siguiente de todos los elementos que cambian con `elementsFromBaseline`, llama a `DetectChanges` (un cambio por elemento), a `AnalyzeChange` por cada uno y a `NotifyStakeholders` una vez (un aviso por afectado, con sus hallazgos de todos los hunks), y abre la propuesta con `OpenProposal` (revisores: la unión de los afectados; filtrados: los de `impact` que no son revisores). Después corre `ResolveOverlaps`, `OpenOverlaps` y `SettleOverlaps`, que fusiona lo que quedó listo. Un voto pasa por `RecordReview` (que no fusiona con solapamientos vivos), `RespondToNotification` y `SettleOverlaps`; al reabrir, `ReopenProposal` y `ReopenResponse` para quienes disputaron. El voto de un solapamiento pasa por `VoteOverlap` y `SettleOverlaps`.
- **`QueryService`** arma las vistas (lo vigente, procedencia, espacios, bandeja, propuestas, cambios y sala) desde los repositorios del lago y los casos de uso de lectura.
- **Transacciones.** `UnitOfWork.run` abre una transacción interactiva, toma `pg_advisory_xact_lock` y entrega un cliente con el que `buildLake`, `buildCapture`, `buildImpact` y `buildNotification` crean sus adapters y casos de uso: todo lo que hace una acción queda en la misma transacción.
- **Totales.** El costo del proyecto es el presupuesto base del modelo más el `costDelta` de las propuestas fusionadas; el plazo es la entrega vigente más sus `delayDays`; la versión del proyecto es 1 más las propuestas fusionadas.
- **Reinicio y carga inicial.** El reinicio vacía el lago con `SeedLake` sin revisiones y no siembra; al arrancar tampoco. `POST /lake/seed` carga lo vigente con `SeedLake` solo con el lago vacío. Quien carga y juega es el ETL ([`apps/etl`](../etl/README.md)); la API no sabe que existe una demo.
- **Eventos.** `CoordinationService.track` compara el estado antes y después de cada transición (propuestas, solapamientos, desfases, sello) y, con los eventos explícitos de la acción, los inserta en la misma transacción.
- **Variables.** `PRESENTER_KEY` (por defecto `sala-los-aromos` fuera de producción; obligatoria en producción) y `ANTHROPIC_API_KEY` (opcional; ausente o vacía, la lectura de texto libre es determinista: respuestas fijas y grabadas).
- **Lectura de texto libre.** Con `ANTHROPIC_API_KEY`, el `ClaimReader` es `CachedClaimReader(ClaudeClaimReader)` y la primera respuesta queda grabada; sin clave, `CachedClaimReader(FixtureClaimReader)` con las respuestas fijas de la muestra (WhatsApp mensajes 1 y 2, folios 41 y 44, acta 12, con confianza 0,9). La caché es `inference-cache/`, una carpeta versionada de la API con un JSON por consulta: la demo reproduce lo grabado sin red. Sin clave no sale nada a la red.
- **Modelo de áreas.** `scenario/areas.ts` define los niveles `n1` a `n5` y la cubierta `n6`, la grilla (ejes A a E a 0, 4, 8, 12 y 16 m y transversales 1 a 4), los sistemas y la huella de cada elemento: las losas son soporte, el shaft S1, las ventanas y el colector B2 son ocupantes, y las partidas y el proyecto no ocupan espacio. El lago recibe ese modelo como un `FootprintModel`.

Variables, cómo se compone un contexto y por qué Node ejecuta los paquetes del workspace como TypeScript: [arquitectura](../../docs/arquitectura.md).

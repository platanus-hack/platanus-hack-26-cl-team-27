# El motor: de un cambio a un aviso

Una obra no tiene una fuente de verdad. Tiene planos con revisión en Drive, presupuestos en planillas, una Carta Gantt, EETT, actas, mensajes de WhatsApp y un libro de obra, repartidos en espacios distintos que dicen cosas distintas. Este documento describe cómo Vigente consolida esa información en cada proyecto y convierte cada cambio en avisos a quienes afecta. El problema y la propuesta están en [negocio](negocio.md); cómo cada documento es un PR contra la fuente única que además sabe dónde está cada elemento, en [solapamientos](solapamientos.md); el sistema, en [arquitectura](arquitectura.md); y los detalles de cada ruta, en el [README de la API](../apps/api/README.md).

## La idea

Detrás de los documentos de cada proyecto hay un repositorio de cambios, un lago con procedencia. Cada revisión de cada artefacto se lee donde vive, se ingiere como un conjunto de hechos con puntero a su origen y se compara contra **lo vigente**, la versión consolidada y consensuada del proyecto. Una revisión con autoridad que cambia algo abre una **propuesta de cambio**, el pull request de la obra: calcula costo y plazo con reglas deterministas y avisa solo a los afectados. Lo vigente solo cambia cuando todos ellos confirman y no queda ningún solapamiento por validar.

La verdad del proyecto no la decide nadie en solitario: es el acuerdo de personas con intereses distintos, cada una dueña de un espacio y de sus documentos. Cada documento que suelta una persona puede dejar desfasado o en disputa el de otra, y la verdad solo converge cuando todas actúan.

## Principios

1. **Ninguna acción individual mueve lo vigente por sí sola.**
2. **Nadie migra ni cambia su forma de trabajar.** Leemos los artefactos donde viven y consolidamos hechos con un puntero al origen, no los archivos. Consolidar no es centralizar.
3. **Cada valor responde de dónde salió.** Revisión, espacio, autor, propuesta y aprobaciones.
4. **Solo avisamos a quien le afecta**, con lo que le toca, su costo y su plazo. Quien no es afectado queda visible con su razón.
5. **La autoridad es explícita**: el plano y la EETT mandan sobre el diseño, la cotización y el presupuesto sobre el precio, la Carta Gantt y el acta sobre las fechas. Un WhatsApp o el libro de obra proponen, no deciden.
6. **Una disputa no borra lo vigente.** Toda salida es una acción visible: reabrir, retirar o una revisión nueva.
7. **Lo desactualizado se ve**, con su dueño. Confirmar sin cambio exige una nota.
8. **Las cifras salen de reglas.** Un modelo de lenguaje solo lee texto libre (con su confianza) y nunca calcula costos ni plazos.

## Por proyecto y con tu cuenta

Todo el motor cuelga de un proyecto: sus rutas son `/api/projects/:projectId/...` y piden una cuenta (`AccountGuard`, con el token de Auth0 que la web agrega en el servidor).

- **Leer** pide ser parte de la organización del proyecto. Si no, o si el proyecto no existe, la respuesta es `404 not_found`.
- **Escribir** (subir una revisión, votar, reabrir, retirar, descartar o confirmar sin cambio) pide además ser parte del equipo del proyecto (`project_members`). Si no, la respuesta es `403 not_on_team`.
- **El actor es tu usuario.** El id de tu usuario es tu id en el equipo del proyecto: con él se compara quién es dueño de un documento, a quién va un aviso, quién valida un solapamiento y quién es autor de una propuesta.

En cada pedido, `ProjectCatalogs.load(projectId)` lee la definición del proyecto de la base (equipo, espacios, documentos, sujetos con su huella, atributos, modelo, partidas, tareas, dependencias, niveles, ejes y sistemas), la valida con `project-schema.ts` y arma un `ProjectCatalog`. Con él se arman, por proyecto, el lago (`buildLake`), el impacto (`buildImpact`) y los avisos (`buildNotification`); los adapters Prisma reciben el id del proyecto y filtran por él cada lectura y escritura.

**Un proyecto creado desde la web parte vacío.** Tiene a quien lo creó como único integrante del equipo (autor y dueño del costo y del plazo) y no tiene espacios, documentos, sujetos ni modelo. Por eso el motor todavía no tiene nada que procesar en él: una revisión responde `404 unknown_document`. Cargarle a un proyecto sus espacios, documentos, sujetos, modelo y equipo está pendiente ([spec](spec/README.md), tarea 21).

## El lago y el consenso

### Espacios

Un **espacio** es un lugar donde ya vive la información del proyecto, con un dueño del equipo y un tipo: `drive`, `sharepoint`, `email`, `whatsapp` o `libro_obra`. Para el repositorio un espacio es de solo lectura.

Las revisiones llegan por una sola puerta: la ingesta genérica `POST /api/projects/:projectId/revisions`, que usaría cualquier conector. Hoy ningún conector la llama.

### Documentos y revisiones

Un **documento** es una identidad estable del proyecto (un plano, una EETT, el presupuesto, la Carta Gantt, una cotización), con su espacio y su dueño. Una **revisión** es una versión inmutable (rev B, rev C, v2) con espacio, autor, tipo (`plano`, `eett`, `cotizacion`, `presupuesto`, `carta_gantt`, `acta`, `mensaje`, `libro_obra`), hash de contenido, puntero al origen (por ejemplo `Drive/Estructura/E-102_revC.pdf`) y orden de ingesta. Las revisiones nunca se pisan; la vigente de un documento es la última ingerida. Ingerir dos veces la misma revisión responde `409 already_ingested`.

### Fragmentos y hechos

Cada revisión llega partida en **fragmentos** (`Chunk`): `{ locator, kind, text?, claims? }`, con `kind` en `fila`, `anotacion`, `acuerdo`, `mensaje`, `parametro` o `texto`. El hecho hereda el localizador de su fragmento. Los fragmentos estructurados (una fila de un cuadro de plano o de una planilla, un parámetro de un modelo BIM) traen sus hechos ya extraídos por el conector. Los de texto libre (un mensaje de WhatsApp, un folio, un acuerdo de un acta) llegan con `text` y sin `claims`, y los lee la API con `context/impact` ([cómo, en solapamientos](solapamientos.md#fragmentos)).

Cada revisión produce afirmaciones sobre las propiedades de los elementos del proyecto: sujeto, atributo, valor, unidad, rol, localizador y, si las leyó un modelo, confianza. Los sujetos y atributos son los de la definición del proyecto (por ejemplo `losa-n3` `espesor_cm`, `shaft-s1` `posicion_m`, `partida-07.01` `precio_unitario`, `proyecto` `entrega_dias`).

- **Afirma**: el documento declara el valor.
- **Usa**: el documento se calculó sobre ese valor (el presupuesto usa el espesor de la losa).
- **Localizador**: el del fragmento (`cuadro de vanos`, `Partidas!C14`, `folio 44`, `mensaje de las 14:32`, `acuerdo 4`).
- **Confianza**: opcional, de 0 a 1. Los hechos de texto libre la traen; los estructurados, no.

La extracción de los fragmentos estructurados es determinista y ocurre en el conector, antes de llegar a la API (`InlineFactExtractor`). Los fragmentos de texto libre se anclan en la API con `ExtractClaims`: los hechos aceptados entran con su confianza y los rechazados (bajo 0,7, fuera del vocabulario del proyecto) quedan en el fragmento con su razón, visibles y sin efecto. Esa lectura la hace Claude y necesita `ANTHROPIC_API_KEY`: sin la clave, un fragmento de texto libre responde `503 inference_unavailable` y la revisión no entra.

### Lo vigente

Para cada sujeto y atributo, lo vigente guarda el valor, la unidad, el hecho que lo respalda, desde cuándo y el historial de valores. El estado de cada valor se deriva:

| Estado     | Significa                                    |
| ---------- | -------------------------------------------- |
| Confirmado | No hay propuesta abierta sobre él            |
| Propuesto  | Hay una propuesta abierta que lo toca        |
| En disputa | Algún afectado respondió «Tengo un problema» |

Las **fuentes** de un valor son los hechos de revisiones vigentes que dicen lo mismo.

### Autoridad

| Atributos                                | Mandan                      |
| ---------------------------------------- | --------------------------- |
| Espesor, ancho, alto, cantidad, posición | `plano`, `eett`             |
| Precio unitario                          | `cotizacion`, `presupuesto` |
| Fechas y duraciones                      | `carta_gantt`, `acta`       |

`mensaje` y `libro_obra` no mandan sobre ningún atributo, y una cotización tampoco manda sobre el diseño.

### Detección de cambios entre documentos

Al ingerir una revisión, cada hecho que afirma se compara contra lo vigente, venga del documento que venga:

1. **Igual**: corrobora; sube el contador de fuentes.
2. **Igual al valor de una propuesta abierta**: corrobora esa propuesta.
3. **Distinto, con autoridad**: es un cambio, un hunk de la propuesta de esa revisión.
4. **Distinto, sin autoridad**: abre una **discrepancia**. No cambia nada y avisa solo al dueño del valor, que es el autor de la revisión que respalda lo vigente.

Después de este primer anillo, la detección sigue con el **mismo elemento**, la **misma área** y lo **simultáneo**: abren un solapamiento y una validación conjunta ([solapamientos](solapamientos.md#detección-en-anillos)). Los textos de WhatsApp y del libro de obra no mandan, así que no abren propuestas: abren discrepancias.

Un hecho «usa» distinto de lo vigente deja el documento desfasado desde el ingreso. Cuando llega después una revisión con autoridad que afirma el valor de una discrepancia abierta, la discrepancia se cierra como respaldada y queda enlazada en la procedencia: un WhatsApp propone, un plano confirma.

### Propuesta y consenso

Una **propuesta** es el PR de la obra: **una por cada revisión con autoridad que cambia algo**, con un **hunk** por cada fragmento que cambia (`subject`, `attribute`, `before`, `after`, localizador). Los fragmentos que coinciden con lo vigente quedan como contexto sin cambio. Reutiliza `DetectChanges` (el antes y el después de cada elemento del modelo) e `impact` (costo, plazo, un hallazgo por afectado y los filtrados con su razón). El costo es la suma de los hunks y el atraso, la suma de los atrasos por elemento. Los **revisores** son la unión de los afectados notificados por cualquier hunk, con un solo aviso por revisor y por propuesta, que lista sus hallazgos; los filtrados se muestran con su razón y no votan.

- Cada revisor aprueba o disputa, con nota opcional (en `notification`, `reviewed` o `issue`).
- La propuesta se **fusiona** a lo vigente cuando todos los revisores aprobaron y no queda ningún solapamiento abierto o confirmado: es atómica, todos los hunks entran juntos y la versión del proyecto sube en uno. Con cero revisores se fusiona sola apenas no tiene solapamientos. No hay botón de fusionar.
- Una **disputa** deja la propuesta en disputa y lo vigente no cambia.
- Un **solapamiento** abierto o confirmado de cualquier hunk bloquea la propuesta entera, aunque todos hayan aprobado. Su vista trae `blockedByOverlap` y dice «Espera la validación del solapamiento».
- El autor puede **reabrir con la observación**: solo vuelve a pendiente quien disputó, y las aprobaciones se conservan. También puede **retirarla**.
- Una revisión nueva del mismo documento **reemplaza** la propuesta abierta, como un force-push, y abre una nueva con votos limpios; los hunks que la anterior ya traía y la revisión nueva repite siguen en la nueva.

Las respuestas son idempotentes.

### Desfase

El desfase es una vista derivada, sin tabla. Un documento vigente queda **desfasado** cuando alguno de sus hechos (los que afirma con autoridad y los que usa) difiere de lo vigente y no pertenece a una propuesta abierta. Se muestra con su dueño, el valor usado y el valor vigente, y se recalcula tras cada ingreso y fusión. Una revisión nueva del mismo documento lo cierra si coincide. El dueño también puede **confirmar sin cambio** con una nota obligatoria: el desfase queda visible como aviso, no como consenso ciego. El desfase es de un nivel: lo declaran los hechos «usa» de cada revisión.

### Procedencia

Al tocar un valor vigente se arma su cadena: hecho, revisión, espacio, autor, fecha, propuesta, aprobaciones con hora y nota, respaldos de discrepancias y valores anteriores con su origen. Es el `git blame` del plano de la obra y responde «¿de dónde salió este 20 cm?».

### Consenso

El **índice de consenso** son los documentos al día sobre los documentos totales (al día: sin desfase ni discrepancia abierta). Cuando no queda propuesta abierta, discrepancia, solapamiento abierto o confirmado ni desfase, el proyecto queda **consensuado** (evento `consensus.sealed`) en la versión que corresponda. El costo total y la ruta crítica son lo vigente más los impactos de las propuestas fusionadas.

## Cómo encajan impacto y avisos

- `impact` recibe el elemento con sus propiedades antes y después, que la API arma desde el modelo del proyecto y lo vigente (`elementsFromBaseline`), y devuelve costo, plazo, un hallazgo por afectado y los filtrados con su razón. Los afectados son los del equipo del proyecto menos el autor.
- `notification` crea un aviso por afectado y cambio, con su canal y el `link` al detalle del cambio en su proyecto. Su respuesta es el voto: `reviewed` aprueba, `issue` disputa.
- Un aviso guardado todavía no sale por ningún canal: el afectado lo ve y lo responde en el detalle del cambio, dentro de la web (`/proyectos/[projectId]/cambios/[id]`).
- Las discrepancias, los desfases, los solapamientos por validar y los filtrados no son avisos de `notification`: la API los compone en la bandeja de cada persona (`GET /api/projects/:projectId/inbox`) desde el repositorio.

## Contextos y capas

| Contexto       | Papel                                                                                                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lake`         | Repositorio, fragmentos, lo vigente, autoridad, detección, solapamientos, propuestas, discrepancias, desfase, procedencia y el cambio por elemento entre una base y un siguiente (`DetectChanges` sobre `diffSnapshots`) |
| `impact`       | Costo, plazo, afectados y filtrados; lee los fragmentos de texto libre (`ExtractClaims`) con su confianza                                                                                                                |
| `notification` | Un aviso por afectado en su canal; la respuesta es el voto; `ReopenResponse`                                                                                                                                             |

Los contextos nunca se importan entre sí: la API los compone.

### `lake`

- **Dominio**: `Space`, `Revision`, `Chunk`, `Claim`, `Authority`, `BaselineEntry`, `Proposal`, `Review`, `Discrepancy`, `Overlap`, `AreaCell`, `Acknowledgement`, `ModelElement`, `Change`. Funciones puras: `classifyClaims`, `buildProposalDraft`, `detectOverlaps`, `reassessOverlaps`, `decideProposal`, `decideOverlap`, `reopenFor`, `computeStaleness`, `consensusIndex`, `buildProvenance`, `diffSnapshots`. Las huellas (`footprint`) no son del lago: la API le pasa el modelo de áreas del proyecto como un `FootprintModel`.
- **Puertos**: un repositorio por agregado (con `ChunkRepository`, `OverlapRepository` y `ChangeRepository`) y `FactExtractor`.
- **Casos de uso**: `IngestRevision`, `OpenProposal`, `RecordReview`, `ReopenProposal`, `WithdrawProposal`, `DismissDiscrepancy`, `OpenOverlaps`, `VoteOverlap`, `ResolveOverlaps`, `SettleOverlaps`, `ListOverlaps`, `AcknowledgeStale`, `GetBaseline`, `GetProvenance`, `ListStale`, `ListProposals`, `GetConsensus`, `DetectChanges`, `GetChange`, `ListChanges`; y `SeedLake`, que la API no usa. `ChangeDraft` lleva `sourceId` (la revisión de origen); `DetectChanges({ sourceId, base, next })` envuelve `diffSnapshots`, persiste un cambio por elemento y lo devuelve.
- **Adapters** (subpath `/adapters`): Prisma por repositorio e `InlineFactExtractor` (los hechos vienen en la revisión).

### `notification`

`ReopenResponse(notificationId)` limpia la respuesta de un aviso para que quien disputó vuelva a estar pendiente.

### La API compone

`modules/coordination` orquesta una acción completa por proyecto: lectura de los fragmentos de texto (`ChunkReader`, con el vocabulario del proyecto), ingesta, `DetectChanges`, `analyzeChange` por elemento, `NotifyStakeholders`, `OpenProposal`, `OpenOverlaps`, el voto, la fusión y la bandeja. Arma los casos de uso de cada contexto con `buildLake`, `buildImpact` y `buildNotification` sobre el `ProjectCatalog` del pedido y el cliente de la transacción. Después de cada ingreso, voto y retiro corre `SettleOverlaps`: vuelve a detectar, resuelve los solapamientos que ya no se tocan y fusiona las propuestas que quedaron listas. El adaptador `elementsFromBaseline` arma la base y el siguiente como elementos del modelo del proyecto con los valores vigentes y los de la propuesta.

## Datos

- `Revision`, `Chunk`, `Claim` (con su fragmento y su confianza), `BaselineEntry`, `BaselineHistory`, `Proposal` (con los hunks, el contexto, el documento y sus cambios por elemento), `Review`, `Discrepancy`, `Overlap`, `OverlapVote`, `Acknowledgement`, `Change` (con `source_id`), `Impact` y `Notification`, todas con `project_id`.
- `ProjectEvent` (tabla `project_events`): los eventos de cada proyecto, con `seq` autoincremental.
- La definición del proyecto vive en `projects` y `project_*` ([`data/main`](../data/main/README.md)).
- Sin tabla: estado de un valor, fuentes, desfase, versión del proyecto (sale de las propuestas fusionadas) y totales.

## API

Todas las rutas cuelgan de `/api/projects/:projectId` y piden la cuenta (`Authorization: Bearer`, que agrega la web). Las que escriben aceptan `x-action-id` para la idempotencia (en memoria, por proceso). El voto es `{ kind: 'reviewed' | 'issue', note? }`. Los eventos llevan `seq`, `kind`, `message`, `refs` y `at`.

| Método y ruta                                    | Qué hace                                                                                                             |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `GET /events?after&limit`                        | Sondeo con cursor de los eventos del proyecto                                                                        |
| `GET /baseline?section`                          | Lo vigente con estado, fuentes y totales                                                                             |
| `GET /baseline/:subjectId/:attribute/provenance` | Cadena de procedencia                                                                                                |
| `GET /spaces`                                    | Espacios, documentos, revisiones y estado                                                                            |
| `POST /revisions`                                | Ingesta genérica de una revisión de un documento del proyecto; ejecuta toda la cadena                                |
| `GET /areas`                                     | La ocupación vigente: niveles, ejes, sistemas, huella de cada elemento y solapamientos vivos                         |
| `GET /overlaps?status`                           | Solapamientos (`abierto`, `confirmado`, `descartado`, `resuelto` o `activo`)                                         |
| `POST /overlaps/:id/vote`                        | Voto de un validador: `se_tocan` o `no_se_tocan`, con nota opcional                                                  |
| `GET /inbox`                                     | Tu bandeja: solapamientos por validar, votos, discrepancias, desfases, filtrados y tus propuestas                    |
| `GET /proposals?status`                          | Propuestas (el PR de la obra) con hunks, checks, revisores (con `notificationId` y `decision`), filtrados y respaldo |
| `POST /notifications/:id/response`               | Voto `reviewed` o `issue` con nota; fusiona si hay consenso                                                          |
| `POST /proposals/:id/reopen`, `/withdraw`        | Reabrir con la observación; retirar                                                                                  |
| `POST /discrepancies/:id/dismiss`                | Descartar una discrepancia                                                                                           |
| `POST /stale/acknowledge`                        | Confirmar sin cambio con nota                                                                                        |
| `GET /changes?limit`, `GET /changes/:id`         | Feed y detalle de cambios, con su propuesta                                                                          |

Formas principales:

```ts
interface IngestResponse {
  revisionId: string;
  claims: {
    subjectId: string;
    attribute: string;
    value: number | string;
    confidence: number | null;
    locator: string;
    outcome: 'same' | 'corroborates' | 'change' | 'discrepancy' | 'stale' | 'new';
  }[];
  chunks: {
    locator: string;
    kind: 'fila' | 'anotacion' | 'acuerdo' | 'mensaje' | 'parametro' | 'texto';
    source: 'estructurado' | 'inferencia';
    claims: number;
    rejected: { subjectId: string; attribute: string; value: number | string | boolean; confidence: number; reason: string }[];
  }[];
  proposals: {
    id: string;
    changeId: string | null;
    documentId: string;
    label: string;
    authorId: string;
    title: string;
    status: 'open' | 'disputed' | 'merged' | 'withdrawn' | 'replaced';
    costDelta: number;
    delayDays: number;
    reviewers: string[];
    filtered: { stakeholderId: string; reason: string }[];
    hunks: { subjectId: string; attribute: string; before: number | string | boolean; after: number | string | boolean; locator: string; changed: boolean }[];
    unchangedHunks: number;
    blockedByOverlap: boolean;
    waitingFor: string | null;
  }[];
  overlaps: OverlapView[];
  resolvedOverlaps: string[];
  discrepancies: { id: string; ownerId: string }[];
  backed: string[];
  stale: { revisionId: string; subjectId: string; attribute: string }[];
}

interface OverlapView {
  id: string;
  kind: 'mismo-elemento' | 'misma-area' | 'simultaneo';
  status: 'abierto' | 'descartado' | 'confirmado' | 'resuelto';
  relation: 'cruce_trazado' | 'interferencia' | null;
  title: string;
  area: { nivel: string; nivelLabel: string; celda: string; sistemas: string[]; label: string } | null;
  subjectId: string;
  subjectName: string;
  otherSubjectId: string;
  otherSubjectName: string;
  chunkLocator: string;
  revisionId: string;
  revisionTitle: string;
  otherBacking: { documentId: string; label: string; title: string; ownerId: string; ownerName: string };
  proposalId: string | null;
  otherProposalId: string | null;
  validators: string[];
  validatorsInfo: { id: string; name: string; role: string }[];
  votes: { validatorId: string; validatorName: string; kind: 'se_tocan' | 'no_se_tocan'; note: string | null; at: string }[];
  resolution: 'retirada' | 'reemplazada' | 'sin_area_comun' | 'otra_propuesta_cerrada' | null;
  createdAt: string;
  resolvedAt: string | null;
}

interface OverlapVoteResponse {
  overlap: OverlapView;
  proposal: ProposalView | null;
  merged: boolean;
  stale: { revisionId: string; subjectId: string; attribute: string }[];
  projectVersion: number;
}

interface VoteResponse {
  notification: Notification;
  proposal: {
    id: string;
    status: 'open' | 'disputed' | 'merged';
    approved: number;
    required: number;
    missing: string[];
  };
  merged: boolean;
  stale: { revisionId: string; subjectId: string; attribute: string }[];
  projectVersion: number;
}

interface ProvenanceResponse {
  subjectId: string;
  attribute: string;
  label: string;
  current: { value: number | string; unit: string | null; status: string };
  chain: {
    value: number | string;
    unit: string | null;
    current: boolean;
    claim: { role: 'afirma' | 'usa'; locator: string };
    revision: { id: string; title: string; label: string; pointer: string; capturedAt: string };
    space: { id: string; name: string };
    author: { id: string; name: string };
    proposal: { id: string; status: string; at: string } | null;
    reviews: { stakeholderId: string; name: string; decision: 'approve' | 'dispute' | null; note: string | null; at: string | null }[];
    backedBy: { revisionTitle: string; spaceName: string; authorName: string; weakValue: number | string }[];
  }[];
  corroborations: { revisionTitle: string; label: string; spaceName: string; role: string }[];
}
```

**Ingesta.** `POST /revisions` recibe `{ documentId, label, spaceId, pointer, contentHash?, chunks: { locator, kind, text?, claims?: { subject, attribute, value, unit, role, confidence? }[] }[] }`. Un fragmento con `claims` es estructurado; uno con `text` y sin `claims` es de texto libre y lo lee la API con `context/impact`. El campo `claims` de primer nivel sigue valiendo: cada grupo de hechos con el mismo localizador es un fragmento implícito de tipo `fila`. El actor tiene que ser el dueño del documento. Responde `IngestResponse`. La API no exige un orden entre revisiones: ordenar es trabajo de quien ingiere.

**Solapamientos.** `POST /overlaps/:id/vote` recibe `{ kind: 'se_tocan' | 'no_se_tocan', note? }` de un validador del solapamiento y responde `OverlapVoteResponse`. El voto es idempotente; cambiarlo es `409 invalid_state`. Quien no valida el solapamiento recibe `403 not_validator`. En la bandeja, cada solapamiento vivo que validas es un ítem `{ type: 'overlap', kind: 'overlap', id, overlapId, myVote, at, overlap }`. `GET /areas` entrega la ocupación vigente (`levels`, `axes`, `spans`, `systems`, `occupants` con `areas` y la huella `proposed` del PR abierto, y los `overlaps` vivos).

Errores: `401 login_required` o `invalid_token` sin cuenta válida, `403 not_invited`, `404 not_found` (el proyecto no es de tus organizaciones o no existe), `403 not_on_team`, `403 not_your_document`, `404 unknown_document`, `409 already_ingested`, `422 invalid_claims` (sujeto o atributo desconocido, o un espacio distinto al del documento; trae `issues`), `503 inference_unavailable` (sin `ANTHROPIC_API_KEY`, o el modelo no respondió al leer un fragmento de texto), `403 not_validator`, `403 not_your_notification`, `403 not_author`, `403 not_owner`, `409 invalid_state`, `503 auth_not_configured` (la API sin Auth0) y `400` si el cuerpo no cumple la forma.

## Tiempo real

Sondeo corto con cursor, sin SSE ni WebSockets: el `rewrite` de Next puede bufferizar las conexiones largas.

- Cada mutación inserta sus eventos en `project_events` en la misma transacción (`CoordinationService.track` compara el estado antes y después y suma los eventos explícitos de la acción). Los eventos son invalidaciones con un mensaje en español; al recibirlos, la pantalla vuelve a pedir sus datos.
- La web llama a `GET /api/projects/:projectId/events?after=<seq>` cada 1000 ms con jitter de ±150 ms (`useProjectPulse`), con `AbortController`, backoff hasta 3 s y pausa con la pestaña oculta.
- La primera llamada, sin `after`, solo fija el cursor. Si el cursor del cliente está por delante del servidor, la respuesta trae `reset: true` y el cliente recarga todo.
- Las mutaciones se serializan con un advisory lock de Postgres (`UnitOfWork.run`).

## La web

Las pantallas del motor viven dentro de cada proyecto y piden la sesión: `/proyectos/[projectId]` (con el botón «Espacios»), `/proyectos/[projectId]/espacios` (espacios, documentos y revisiones, con `?espacio=`, `?documento=` y `?revision=`), `/proyectos/[projectId]/cambios/[id]` (el detalle de una propuesta, donde el afectado responde «Revisado» o «Tengo un problema») y `/proyectos/[projectId]/valor/[subjectId]/[attribute]` (la procedencia completa de un valor). El detalle está en el [README de la web](../apps/web/README.md).

La web todavía no tiene la bandeja, ni las acciones del autor (reabrir, retirar), ni descartar una discrepancia, confirmar sin cambio o votar un solapamiento: esas acciones existen solo en la API.

## Lo que falta

- **Cargar un proyecto.** Que un proyecto creado desde la web tenga espacios, documentos, sujetos, atributos, modelo, grilla, dependencias y equipo.
- **Canales reales.** Un puerto `ChannelSender` en `notification`, con un adapter por proveedor, y una outbox para enviar fuera de la transacción ([spec](spec/ia.md#un-canal-real)).
- **Autoridad entre fuentes.** Que cada atributo tenga una sola fuente autoritativa entre conectores (geometría y posición desde Autodesk; cantidades, precios y partidas desde la planilla), y que la otra fuente solo pueda levantar una discrepancia.
- **Registro de entregas y vínculos.** Guardar cada entrega cruda de un conector con su `sourceVersion` y su clave de idempotencia, un registro de elementos con alias (`UniqueId` de Revit, `GlobalId` de IFC, la clave de una fila) y una bandeja de lo que llegó sin vincular, para reprocesar sin perder nada.

## Glosario

| Término                                  | Significado                                                                                                                                                             |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Espacio                                  | Lugar donde ya vive la información; tiene un dueño del equipo y el repositorio solo lo lee                                                                              |
| Documento                                | Artefacto de identidad estable (plano, cotización, presupuesto, Carta Gantt, EETT, acta, mensaje, folio)                                                                |
| Revisión                                 | Versión inmutable de un documento, con espacio, autor, fecha, hash y puntero al origen                                                                                  |
| Fragmento (`Chunk`)                      | La parte de una revisión que se compara por separado: una fila, un mensaje, un acuerdo, un parámetro                                                                    |
| Hecho                                    | Afirmación extraída de un fragmento sobre una propiedad de un elemento, con rol, localizador y confianza                                                                |
| Lo vigente                               | Valor consolidado y consensuado de un hecho, con su procedencia e historial                                                                                             |
| Propuesta de cambio (`Proposal`)         | El PR de la obra: una por revisión con autoridad que cambia algo, con un hunk por cambio; se fusiona cuando todos sus revisores aprueban y no tiene solapamientos vivos |
| Área (`AreaCell`) y huella (`footprint`) | Nivel, celda de la grilla y sistemas; y las áreas que ocupa un elemento según sus valores                                                                               |
| Solapamiento (`Overlap`)                 | Un fragmento que toca el mismo elemento o la misma área que otro documento o que otro PR; abre una validación conjunta                                                  |
| Validación conjunta (`Overlap.votes`)    | La decisión de los dueños de ambos lados: se tocan o no se tocan                                                                                                        |
| Discrepancia                             | Valor distinto de lo vigente que viene de una fuente sin autoridad; avisa solo al dueño del valor                                                                       |
| Desfase                                  | Un documento vigente dice o usa un valor distinto de lo vigente                                                                                                         |
| Procedencia                              | Cadena que responde de dónde salió un valor                                                                                                                             |
| Equipo del proyecto                      | Las personas del proyecto (`project_members`), con rol y canal; el id de cada una es el de su usuario                                                                   |
| Consenso                                 | Documentos al día sobre documentos totales; al completarse, el proyecto queda consensuado                                                                               |

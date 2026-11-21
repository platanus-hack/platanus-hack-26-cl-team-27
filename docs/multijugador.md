# La sala de la obra

Una obra no tiene una fuente de verdad. Tiene planos con revisión en Drive, cotizaciones y presupuestos en planillas, una Carta Gantt, EETT, actas, mensajes de WhatsApp y un libro de obra, repartidos en espacios distintos que dicen cosas distintas. Este documento describe cómo el sistema consolida esa información por detrás y cómo la muestra lo convierte en una experiencia multijugador. El problema y la propuesta están en [negocio](negocio.md); la muestra, en [muestra](muestra.md); el sistema, en [arquitectura](arquitectura.md); y cómo cada documento es un PR contra una fuente única que además sabe dónde está cada elemento, en [solapamientos](solapamientos.md).

## La idea

Detrás de los documentos hay un repositorio de cambios, un lago con procedencia. Cada revisión de cada artefacto se lee donde vive, se ingiere como un conjunto de hechos con puntero a su origen y se compara contra **lo vigente**, la versión consolidada y consensuada del proyecto. Una revisión con autoridad que cambia algo abre una **propuesta de cambio**, el pull request de la obra: calcula costo y plazo con reglas deterministas y avisa solo a los afectados, en el canal que ya usan. Lo vigente solo cambia cuando todos ellos confirman y no queda ningún solapamiento por validar.

Multiplayer es el núcleo, no una función. La verdad del proyecto no la decide nadie en solitario: es el acuerdo de personas con intereses distintos, cada una dueña de un espacio y de sus documentos. Cada documento que suelta una persona deja desfasado o en disputa el de otra, y la verdad solo converge cuando todas actúan. En la muestra, el público toma los asientos del elenco desde su celular; los asientos vacíos los juega el ETL como un cliente más (clave de presentador más `x-act-as`), de modo que una sola persona puede presentar todo. La API no sabe que existe una demo: recibe revisiones de documentos por una puerta genérica, igual que las recibiría de un conector real.

## El flujo de 4 pasos

El camino del pitch es un solo caso con dos personas reales y sin bots: Paula Rojas mueve el pilar P-12, Vigente detecta que pisa la bandeja E-B-03 de Camila Vera y propone correrla 40 cm, y Camila acepta. Corre en `/caso/paula-rojas`, `/caso/camila-vera` y `/caso` (presentador), sobre `/api/flow`. El caso, los textos y las cifras están en [docs/spec/fuente-de-verdad.md](spec/fuente-de-verdad.md); la API, en [apps/api/README.md](../apps/api/README.md); la web, en [apps/web/README.md](../apps/web/README.md).

## Principios

1. **Multiplayer es el núcleo.** Ninguna acción individual mueve lo vigente por sí sola.
2. **Nadie migra ni cambia su forma de trabajar.** Leemos los artefactos donde viven y consolidamos hechos con un puntero al origen, no los archivos. Consolidar no es centralizar.
3. **Cada valor responde de dónde salió.** Revisión, espacio, autor, propuesta y aprobaciones.
4. **Solo avisamos a quien le afecta**, en su canal, con lo que le toca, su costo y su plazo. Quien no es afectado queda visible con su razón.
5. **La autoridad es explícita**: el plano y la EETT mandan sobre el diseño, la cotización y el presupuesto sobre el precio, la Carta Gantt y el acta sobre las fechas. Un WhatsApp o el libro de obra proponen, no deciden.
6. **Una disputa no borra lo vigente.** Toda salida es una acción visible: reabrir, retirar o una revisión nueva.
7. **Lo desactualizado se ve**, con su dueño. Confirmar sin cambio exige una nota.
8. **Las cifras salen de reglas.** Un modelo de lenguaje solo lee texto libre (con su confianza) y nunca calcula costos ni plazos. Sin `ANTHROPIC_API_KEY`, esa lectura es determinista.
9. **Espacio controlado.** Todo es ficticio, nada sale de la app, se reinicia en un paso, sin cuentas ni gestión de equipos.

## El lago y el consenso

### Espacios

Cinco lugares ficticios donde ya vive la información, cada uno con un asiento dueño y la apariencia de su tipo:

| Espacio                    | Tipo       | Dueño            | Contiene                            |
| -------------------------- | ---------- | ---------------- | ----------------------------------- |
| Drive del proyecto         | drive      | Fernanda Lagos   | Planos, EETT, actas                 |
| Carpeta de costos          | sharepoint | Daniela Soto     | Presupuesto itemizado y Carta Gantt |
| Correo de Ventanas Quillay | email      | Ventanas Quillay | Cotizaciones                        |
| WhatsApp Obra Los Aromos   | whatsapp   | Marcos Fuentes   | Mensajes                            |
| Libro de obra              | libro_obra | Marcos Fuentes   | Folios                              |

Para el repositorio un espacio es de solo lectura. El conector de la muestra es el ETL (`apps/etl`): lee los archivos del lago ficticio y los entrega por `POST /api/revisions`, la misma ingesta que usaría un conector real. El add-in de Revit ([`tool-use-case/revit`](../tool-use-case/revit/README.md)) es un conector real: cada guardado del modelo llega como una revisión del documento «Modelo Revit de arquitectura», en el Drive y de Fernanda, con los hechos que cambiaron.

### Documentos y revisiones

Un **documento** es una identidad estable (A-201 Fachada norte y shaft, E-102 Planta estructural N3, EETT-03 Hormigones, Presupuesto itemizado, Carta Gantt, Cotización Q-118). Una **revisión** es una versión inmutable (rev B, rev C, v2) con espacio, autor, tipo (`plano`, `eett`, `cotizacion`, `presupuesto`, `carta_gantt`, `acta`, `mensaje`, `libro_obra`), hash de contenido, puntero al origen (por ejemplo `Drive/Los Aromos/Estructura/E-102_revC.pdf`) y orden de ingesta. Las revisiones nunca se pisan; la vigente de un documento es la última ingerida. Ingerir dos veces la misma revisión es idempotente.

### Fragmentos y hechos

Cada revisión llega partida en **fragmentos** (`Chunk`): `{ locator, kind, text?, claims? }`, con `kind` en `fila`, `anotacion`, `acuerdo`, `mensaje`, `parametro` o `texto`. El hecho hereda el localizador de su fragmento. Los fragmentos estructurados (una fila de un cuadro de plano o de una planilla, un parámetro de la minuta de Revit) traen sus hechos ya extraídos por el conector. Los de texto libre (un mensaje de WhatsApp, un folio, un acuerdo de un acta) llegan con `text` y sin `claims`, y los lee la API con `context/impact` ([cómo, en solapamientos](solapamientos.md#fragmentos)).

Cada revisión produce afirmaciones sobre las propiedades de los elementos del proyecto: sujeto, atributo, valor, unidad, rol, localizador y, si las leyó un modelo, confianza. Los sujetos y atributos son los del grafo del proyecto (`losa-n3` `espesor_cm`, `shaft-s1` `posicion_m`, `ventanas-norte` `ancho_cm`, `partida-07.01` `precio_unitario`, `proyecto` `entrega_dias`).

- **Afirma**: el documento declara el valor.
- **Usa**: el documento se calculó sobre ese valor (el presupuesto usa el espesor de la losa).
- **Localizador**: el del fragmento (`cuadro de vanos`, `Partidas!C14`, `folio 44`, `mensaje de las 14:32`, `acuerdo 4`).
- **Confianza**: opcional, de 0 a 1. Los hechos de texto libre la traen; los estructurados, no.

La extracción de los fragmentos estructurados es determinista y ocurre en el conector, antes de llegar a la API (`InlineFactExtractor`). En la muestra, el ETL ([`apps/etl`](../apps/etl/README.md)) lee los archivos del lago ficticio (planos en JSON, EETT en Markdown, presupuesto, Gantt y cotización en CSV, acta, WhatsApp y folios en texto) con un parser por tipo, y manda los textos libres como fragmentos de texto sin hechos. El add-in de Revit manda un fragmento por parámetro cambiado. Los fragmentos de texto libre se anclan en la API con `ExtractClaims`: los hechos aceptados entran con su confianza y los rechazados (bajo 0,7, fuera del vocabulario del proyecto) quedan en el fragmento con su razón, visibles y sin efecto. Sin `ANTHROPIC_API_KEY`, esa lectura es **determinista**: respuestas fijas de la muestra y grabadas en `apps/api/inference-cache`, sin red.

### Lo vigente

Para cada sujeto y atributo, lo vigente guarda el valor, la unidad, el hecho que lo respalda, desde cuándo y el historial de valores. El estado de cada valor se deriva:

| Estado     | Significa                                    |
| ---------- | -------------------------------------------- |
| Confirmado | No hay propuesta abierta sobre él            |
| Propuesto  | Hay una propuesta abierta que lo toca        |
| En disputa | Algún afectado respondió «Tengo un problema» |

Las **fuentes** de un valor son los hechos de revisiones vigentes que dicen lo mismo. La línea base se siembra confirmada, con su procedencia en las revisiones iniciales.

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

El desfase es una vista derivada, sin tabla. Un documento vigente queda **desfasado** cuando alguno de sus hechos (los que afirma con autoridad y los que usa) difiere de lo vigente y no pertenece a una propuesta abierta. Se muestra con su dueño, el valor usado y el valor vigente, y se recalcula tras cada ingreso y fusión. Una revisión nueva del mismo documento lo cierra si coincide. El dueño también puede **confirmar sin cambio** con una nota obligatoria: el desfase queda visible como aviso amarillo, no como consenso ciego. El desfase es de un nivel: lo declaran los hechos «usa» de cada revisión.

### Procedencia

Al tocar un valor vigente se arma su cadena: hecho, revisión, espacio, autor, fecha, propuesta, aprobaciones con hora y nota, respaldos de discrepancias y valores anteriores con su origen. Es el `git blame` del plano de la obra y responde «¿de dónde salió este 20 cm?».

### Meta compartida

El **índice de consenso** son los documentos al día sobre los documentos totales (al día: sin desfase ni discrepancia abierta). Cuando no queda propuesta abierta, discrepancia, solapamiento abierto o confirmado ni desfase, la sala muestra el sello **Obra consensuada** con la versión del proyecto y quién cerró qué. El costo total y la ruta crítica son lo vigente más los impactos de las propuestas fusionadas.

## Cómo encajan impacto y avisos

- `impact` no cambia de reglas ni de cifras. Recibe el elemento con sus propiedades antes y después, que el API arma desde el modelo del escenario y los hechos, y devuelve costo, plazo, un hallazgo por afectado y los filtrados con su razón.
- `notification` crea un aviso por afectado y cambio, en su canal, con el link a `/cambios/:id`. Su respuesta es el voto: `reviewed` aprueba, `issue` disputa.
- Las discrepancias y los desfases no son avisos de `notification`: el API los compone en la bandeja del asiento desde el repositorio.

## Los jugadores

- **Asientos fijos.** Fernanda Lagos (presentadora y autora de los cambios) y los siete del elenco: Paula Rojas (correo), Marcos Fuentes (WhatsApp), Daniela Soto (Slack), Javier Muñoz (WhatsApp), Camila Vera (Slack), Tomás Reyes (correo) y Ventanas Quillay (correo). Un dispositivo toma un asiento sin cuenta: guarda un token en `localStorage`.
- **Presencia.** El token en la consulta de eventos es el latido. Un asiento sin latido por 20 segundos queda libre, y tomarlo de nuevo es posible. El asiento de Fernanda no se toma desde un celular: la presentadora actúa con su clave.
- **Actuar por un asiento.** Con `x-presenter-key` válida y `x-act-as: <castId>`, el actor es ese asiento: sirve para subir revisiones, votar, reabrir, retirar, descartar y confirmar sin cambio. Si una persona tiene el asiento (latido de menos de 20 s), la API responde `409 seat_held`: nadie juega por un humano. Sin `x-act-as`, la clave actúa como Fernanda. Quien usa esto es el ETL, que juega los asientos vacíos; la API no tiene bots.
- **Telón.** `/sala`, solo lectura, para el proyector.

## Contextos y capas

| Contexto       | Estado    | Papel                                                                                                                                                                                                                    |
| -------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lake`         | nuevo     | Repositorio, fragmentos, lo vigente, autoridad, detección, solapamientos, propuestas, discrepancias, desfase, procedencia y el cambio por elemento entre una base y un siguiente (`DetectChanges` sobre `diffSnapshots`) |
| `impact`       | extendido | Costo, plazo, afectados y filtrados; lee los fragmentos de texto libre (`ExtractClaims`) con su confianza                                                                                                                |
| `notification` | extendido | Un aviso por afectado en su canal; la respuesta es el voto; `ReopenResponse`                                                                                                                                             |

Los contextos nunca se importan entre sí: la API los compone. La sala (asientos y eventos) es un módulo de la API, infraestructura de la muestra y no un contexto de dominio.

### `lake`

- **Dominio**: `Space`, `Revision`, `Chunk`, `Claim`, `Authority`, `BaselineEntry`, `Proposal`, `Review`, `Discrepancy`, `Overlap`, `AreaCell`, `Acknowledgement`, `ModelElement`, `Change`. Funciones puras: `classifyClaims`, `buildProposalDraft`, `detectOverlaps`, `reassessOverlaps`, `decideProposal`, `decideOverlap`, `reopenFor`, `computeStaleness`, `consensusIndex`, `buildProvenance`, `diffSnapshots`. Las huellas (`footprint`) no son del lago: la API le pasa el modelo de áreas como un `FootprintModel`.
- **Puertos**: un repositorio por agregado (con `ChunkRepository`, `OverlapRepository` y `ChangeRepository`) y `FactExtractor`.
- **Casos de uso**: `IngestRevision`, `OpenProposal`, `RecordReview`, `ReopenProposal`, `WithdrawProposal`, `DismissDiscrepancy`, `OpenOverlaps`, `VoteOverlap`, `ResolveOverlaps`, `SettleOverlaps`, `ListOverlaps`, `AcknowledgeStale`, `GetBaseline`, `GetProvenance`, `ListStale`, `ListProposals`, `GetConsensus`, `DetectChanges`, `GetChange`, `ListChanges`. `ChangeDraft` lleva `sourceId` (la revisión de origen); `DetectChanges({ sourceId, base, next })` envuelve `diffSnapshots`, persiste un cambio por elemento y lo devuelve.
- **Adapters** (subpath `/adapters`): Prisma por repositorio e `InlineFactExtractor` (los hechos vienen en la revisión).

### `notification`

`ReopenResponse(notificationId)` limpia la respuesta de un aviso para que quien disputó vuelva a estar pendiente.

### La API compone

`modules/lake`, `impact` y `notification` entran cada uno por su módulo de Nest. `modules/coordination` orquesta una acción completa: lectura de los fragmentos de texto, ingesta, `DetectChanges`, `analyzeChange` por elemento, `NotifyStakeholders`, `OpenProposal`, `OpenOverlaps`, el voto, la fusión, los totales y la bandeja. Después de cada ingreso, voto y retiro corre `SettleOverlaps`: vuelve a detectar, resuelve los solapamientos que ya no se tocan y fusiona las propuestas que quedaron listas. `modules/room` lleva asientos y eventos. El adaptador `elementsFromBaseline` arma la base y el siguiente como elementos del modelo del escenario con los valores vigentes y los de la propuesta.

## Datos

Prisma, una migración nueva:

- `Change` gana `source_id` y pierde `integration_id` y `version`; `Snapshot` no existe. `Impact` y `Notification` no cambian.
- `Revision`, `Chunk`, `Claim` (con su fragmento y su confianza), `BaselineEntry`, `BaselineHistory`, `Proposal` (con los hunks, el contexto, el documento y sus cambios por elemento), `Review`, `Discrepancy`, `Overlap`, `OverlapVote`, `Acknowledgement`.
- `Seat` (token hasheado y último latido), `RoomEvent` (`seq` autoincremental), y `RoomState` (la época). La versión del proyecto se deriva de las propuestas fusionadas.
- Sin tabla: estado de un valor, fuentes, desfase y totales.

El reinicio borra todo en una transacción, suma uno a la época y libera los asientos; no siembra: el lago queda vacío hasta la carga inicial del ETL.

## API

Todas las rutas cuelgan de `/api`. Las acciones de asiento llevan `x-seat-token`; las del presentador, `x-presenter-key`, que actúa como Fernanda o, con `x-act-as`, como el asiento que se indique (ver Los jugadores); las que escriben, `x-action-id` (idempotencia). El voto es `{ kind: 'reviewed' | 'issue', note? }`. Los eventos llevan `kind` (y `type`, igual), `message`, `refs` y `at`. Los tipos y los detalles de cada ruta están en el [README de la API](../apps/api/README.md).

| Método y ruta                                        | Qué hace                                                                                                             |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `GET /room`                                          | Snapshot: proyecto, `lake: { empty }`, elenco con ocupante, espacios, contadores y meta                              |
| `POST /seats/:castId/claim`, `DELETE /seats/:castId` | Tomar y soltar un asiento (409 si está tomado)                                                                       |
| `GET /events?after&epoch&seat`                       | Sondeo con cursor; es el latido                                                                                      |
| `GET /baseline?section`                              | Lo vigente con estado, fuentes y totales                                                                             |
| `GET /baseline/:subjectId/:attribute/provenance`     | Cadena de procedencia                                                                                                |
| `GET /spaces`                                        | Espacios, documentos, revisiones y estado                                                                            |
| `POST /revisions`                                    | Ingesta genérica de una revisión de un documento del proyecto; ejecuta toda la cadena                                |
| `POST /lake/seed`                                    | Carga inicial de lo vigente con el lago vacío (con `x-presenter-key`)                                                |
| `POST /integrations/revit/minutes`                   | Recibe la minuta de cambios del add-in de Revit y ejecuta toda la cadena                                             |
| `GET /areas`                                         | La ocupación vigente: niveles, ejes, sistemas, huella de cada elemento y solapamientos vivos                         |
| `GET /overlaps?status`                               | Solapamientos (`abierto`, `confirmado`, `descartado`, `resuelto` o `activo`)                                         |
| `POST /overlaps/:id/vote`                            | Voto de un validador: `se_tocan` o `no_se_tocan`, con nota opcional                                                  |
| `GET /seats/:castId/inbox`                           | Solapamientos por validar, votos, discrepancias, desfases y filtrados del asiento                                    |
| `GET /proposals?status`                              | Propuestas (el PR de la obra) con hunks, checks, revisores (con `notificationId` y `decision`), filtrados y respaldo |
| `POST /notifications/:id/response`                   | Voto `reviewed` o `issue` con nota; fusiona si hay consenso                                                          |
| `POST /proposals/:id/reopen`, `/withdraw`            | Reabrir con la observación; retirar                                                                                  |
| `POST /discrepancies/:id/dismiss`                    | Descartar una discrepancia                                                                                           |
| `POST /stale/acknowledge`                            | Confirmar sin cambio con nota                                                                                        |
| `GET /changes`, `GET /changes/:id`                   | Feed y detalle de cambios, con su propuesta                                                                          |
| `POST /room/reset`                                   | Reinicio vacío (con `x-presenter-key`); responde `{ epoch }`                                                         |

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

**Ingesta.** `POST /revisions` recibe `{ documentId, label, spaceId, pointer, contentHash?, chunks: { locator, kind, text?, claims?: { subject, attribute, value, unit, role, confidence? }[] }[] }`. Un fragmento con `claims` es estructurado; uno con `text` y sin `claims` es de texto libre y lo lee la API con `context/impact`. El campo `claims` de primer nivel sigue valiendo: cada grupo de hechos con el mismo localizador es un fragmento implícito de tipo `fila`. El actor es el dueño del documento: token de asiento, o clave más `x-act-as`. Responde `IngestResponse`. `POST /integrations/revit/minutes` comparte el mismo camino interno, con un fragmento `parametro` por cambio. La API no exige un orden entre revisiones: ordenar es trabajo de quien ingiere.

**Solapamientos.** `POST /overlaps/:id/vote` recibe `{ kind: 'se_tocan' | 'no_se_tocan', note? }` de un validador del solapamiento (token de asiento, o clave más `x-act-as`; `x-action-id` para la idempotencia) y responde `OverlapVoteResponse`. El voto es idempotente; cambiarlo es `409 invalid_state`. Un asiento que no valida el solapamiento recibe `403 not_validator`. En la bandeja del asiento, cada solapamiento vivo que valida es un ítem `{ type: 'overlap', kind: 'overlap', id, overlapId, myVote, at, overlap }`. Los contadores de la sala suman `openOverlaps`, y `GET /areas` entrega la ocupación vigente (`levels`, `axes`, `spans`, `systems`, `occupants` con `areas` y la huella `proposed` del PR abierto, y los `overlaps` vivos).

**Carga inicial.** `POST /lake/seed` recibe `{ revisions: [ cuerpo de /revisions + authorId ] }` (los fragmentos pueden venir vacíos), solo con el lago vacío, y deja lo vigente confirmado con su procedencia. Los fragmentos de texto libre también los lee la API. Responde `201 { revisions, baseline }` y emite `lake.seeded`.

Errores: `401` sin actor o clave inválida, `403 not_your_document`, `404 unknown_document` (o `not_found` para un `x-act-as` fuera del elenco), `409 already_ingested`, `409 lake_not_empty`, `409 seat_held`, `409 seat_taken`, `422 invalid_claims` (sujeto o atributo desconocido, o un espacio distinto al del documento; trae `issues`), `503 inference_unavailable` (el modelo no respondió al leer un fragmento de texto), `403 not_validator`, `422 invalid_author` y `422 duplicate_revision` en la carga inicial, y `400` si el cuerpo no cumple la forma.

## Tiempo real

Sondeo corto con cursor, sin SSE ni WebSockets: el `rewrite` de Next puede bufferizar las conexiones largas, y en un Wi-Fi ruidoso se cortan en silencio.

- Cada cliente llama a `GET /api/events?after=<seq>&epoch=<n>` cada 1000 ms (el telón, cada 700 ms) con jitter de ±150 ms.
- Cada mutación inserta sus eventos en la misma transacción. Los eventos son invalidaciones con un mensaje en español para el ticker; al recibirlos, la pantalla vuelve a pedir su snapshot.
- Si cambió la época (reinicio) o el cursor está por delante del servidor, la respuesta trae `reset: true` y el cliente recarga todo.
- El token en la petición es el latido de presencia.
- Las mutaciones y el reinicio se serializan con un advisory lock de Postgres.
- `useRoomPulse` usa `AbortController`, backoff hasta 3 s, pausa con la pestaña oculta y reanuda al volver.

## La web

Textos de UI en español de Chile, con tuteo. Cada experiencia tiene un trabajo: **la sala informa, el presentador resuelve, el asiento actúa y los espacios dejan explorar el origen**. La información va en tres niveles: resumen en la pantalla, detalle en un panel lateral (propuesta, documento o valor) y procedencia completa en su página. Los paneles no sacan a nadie de donde está, y cada uno tiene su ruta para compartir.

| Ruta                             | Para qué                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| `/`                              | Elegir quién eres en la obra: lista del elenco con rol y canal, tomar o volver a un asiento |
| `/sala`                          | Telón del proyector, solo lectura                                                           |
| `/asiento/[castId]`              | Bandeja del jugador en su celular, con el look de su canal                                  |
| `/presentador`                   | Consola de Fernanda: lo que requiere atención, propuestas, asientos y reinicio              |
| `/espacios`                      | Explorador de espacios y documentos; acepta `?espacio=`, `?documento=` y `?revision=`       |
| `/cambios/[id]`                  | Detalle de una propuesta para compartir; destino del link de cada aviso (`?para=`)          |
| `/valor/[subjectId]/[attribute]` | Procedencia completa de un valor                                                            |

**`/sala`.** Encabezado compacto con el proyecto y «En vivo». Debajo, una franja con el costo, el plazo y la versión del proyecto (cada uno con su variación sobre el base) y la barra «X de 9 documentos al día» con lo que falta (desfasados y con discrepancia). Dos columnas:

- **Principal:** «Propuestas abiertas», cada una con el antes y el después, su estado, quién falta o la nota de quien disputa, un avatar por revisor con su voto, el costo, el plazo y los filtrados con su razón («Marcos Fuentes no recibe aviso: …»). Debajo, «Lo vigente» en una tabla por sección (elemento, valor vigente con la propuesta si la hay, estado y fuentes).
- **Lateral:** «Pendientes de actualizar» (documentos desfasados o con discrepancia, con su dueño y la diferencia), «Espacios conectados» (late al recibir una revisión), «Actividad reciente» y el QR, chico.

Tocar una propuesta, un valor o un documento abre su panel: el detalle de la propuesta, la procedencia o las revisiones con sus hechos. Al consensuar aparece arriba «Obra consensuada · Versión N» con una línea por propuesta fusionada. La tipografía crece con el ancho de la pantalla para el proyector. Nunca muestra archivos: muestra hechos, estados y procedencia. Con el lago vacío muestra «Esperando la carga inicial».

**`/presentador`.** Pide la clave una vez por pestaña y la valida al cargar. Dos columnas:

- **Requieren atención**, primero: las propuestas en disputa (la nota de quien disputa, «Reabrir con la observación» y «Ver detalle») y las discrepancias de los valores que respalda Fernanda (la fuente, los dos valores y por qué no cambia nada, con «Descartar» y «Esperar el plano»). Las discrepancias salen de la bandeja de Fernanda, que la API entrega con la clave del presentador.
- **Propuestas**: una tabla con pestañas «Activas» e «Historial» (fusionadas, retiradas y reemplazadas), con estado, pendientes, última actividad, «Ver detalle» y un menú con las acciones que permite el estado (reabrir solo en disputa, retirar solo lo activo).
- **Lateral:** los asientos (una persona, lo juega un bot o libre, con «Soltar») y, aparte, «Administración» con «Reiniciar la sala».

Retirar, descartar y reiniciar piden confirmación. «Esperar el plano» se recuerda en el navegador (`localStorage`); no es estado de la sala.

**`/asiento/[castId]`.** Encabezado con el nombre, el rol, el canal y la conexión. La bandeja tiene dos pestañas, «Pendientes» y «Respondidos», dentro de un contenedor con el look del canal (bandeja de correo, chat de WhatsApp o canal de Slack). Cada aviso lleva una etiqueta, la hora y su contenido:

- **Te piden revisar**: qué cambia (antes y después), por qué te llega y qué hacer (con «Ver el cálculo»), costo y plazo, quién falta, la nota opcional de hasta 280 caracteres y «Revisado» o «Tengo un problema». Después de responder pasa a «Respondidos» con lo que contestaste, tu nota y el estado de la propuesta: «Esperando que la autora reabra con tu observación», «El cambio ya quedó vigente», retirada o reemplazada.
- **Discrepancia** (dueño del valor): «Dice 150 cm, lo vigente es 120 cm», la fuente y por qué no cambia nada, con «Descartar» y «Esperar el plano».
- **Documento desfasado** (dueño del documento): «Usa 15 cm, lo vigente es 20 cm», qué hacer y «Confirmo sin cambio», que pide una nota obligatoria.
- **Para tu información** (filtrado): «No te avisamos: …» con la razón y «Ver por qué».
- Para la autora, si tiene asiento: «Tus propuestas» con «Reabrir con la observación» y «Retirar».

«Ver el detalle» abre el panel de la propuesta sin salir de la bandeja; desde ahí también se puede responder. Estados: «Estás al día», «Esperando la carga inicial», «Sin conexión», «Tu asiento se liberó» y «Solo lectura». Sin token, el asiento se ve en solo lectura con lo que la sala ya publica (sus votos, sus filtrados y sus desfases, pero no sus discrepancias) y los botones deshabilitados. El token vive en `localStorage` con `try/catch`.

## El escenario

El proyecto, el elenco, el grafo, los espacios, los sujetos, los atributos y el registro de documentos con su dueño están en [`apps/api/src/scenario`](../apps/api/src/scenario) (`los-aromos.ts` y `documents.ts`): es la definición del proyecto, no la demo. Lo que ocurre en la muestra (los archivos del lago, la carga inicial, el guion y los jugadores que votan por los asientos vacíos) vive en el ETL: ver [`apps/etl/README.md`](../apps/etl/README.md).

### La carga inicial

Diez documentos, todos al día, que dejan 16 valores vigentes confirmados:

| Documento                                              | Espacio  | Dueño    | Hechos                                                              |
| ------------------------------------------------------ | -------- | -------- | ------------------------------------------------------------------- |
| A-201 Fachada norte y shaft rev B                      | Drive    | Fernanda | Ventanas 120 × 150 cm, 24 unidades; shaft a 6 m                     |
| E-102 Planta estructural N3 rev B                      | Drive    | Fernanda | Losas en 15 cm                                                      |
| EETT-03 Hormigones rev A                               | Drive    | Paula    | Losas en 15 cm                                                      |
| Presupuesto itemizado v2                               | Costos   | Daniela  | Cuatro precios unitarios; usa losa N3 en 15 cm y ventanas en 120 cm |
| Carta Gantt v4                                         | Costos   | Marcos   | Entrega a 108 días; usa losa N3 en 15 cm                            |
| Cotización Q-118 rev 1                                 | Correo   | Quillay  | $185.000/m²; usa ventanas en 120 cm                                 |
| Acta de coordinación 12                                | Drive    | Fernanda | Entrega a 108 días                                                  |
| Folio 41                                               | Libro    | Marcos   | Shaft a 6 m                                                         |
| Mensaje de WhatsApp                                    | WhatsApp | Marcos   | Ambienta, sin hechos de diseño                                      |
| IS-301 Plano de instalaciones sanitarias nivel 3 rev A | Drive    | Javier   | Colector B2 a 10 m del eje A (celda C-D/3 del nivel 3)              |

El ETL la entrega por `POST /api/lake/seed`.

### Los tres cambios como revisiones

1. **Losa del nivel 3, de 15 a 20 cm** (E-102 rev C). Avisa a 4 de 7: Paula, Javier, Daniela y Marcos. Costo +$3.636.500 (+14 m³ de hormigón y +1.190 kg de acero) y +1 día en la ruta crítica. Camila, Tomás y Quillay no reciben nada. Al fusionarse quedan desfasados la EETT-03, el presupuesto v2 y la Carta Gantt v4.
2. **Ventanas norte, de 120 a 150 cm** (el WhatsApp, luego el A-201 rev C). El WhatsApp abre una discrepancia solo para Fernanda; el plano la respalda y abre la propuesta: 4 de 7 (Quillay, Paula, Tomás y Daniela), +$1.998.000. Marcos queda filtrado: la instalación pasa de 4 a 5 días pero tiene 38 días de holgura y la entrega no se mueve. Al fusionarse, la cotización Q-118 rev 1 queda desfasada hasta la rev 2.
3. **Shaft S1, de 6 a 8,5 m** (el folio 44, luego el A-201 rev D). El folio abre una discrepancia para Fernanda; el plano la respalda y, como las ventanas ya coinciden, abre solo la propuesta del shaft: un hunk que cambia y las ventanas como contexto sin cambio, 3 de 7 (Paula, Javier y Camila), sin costo ni plazo. Daniela y Marcos no reciben aviso. Además, el shaft a 8,5 m cae en la celda C-D/3 del nivel 3, donde el IS-301 rev A pone el colector B2: se abre un solapamiento («nivel 3 · C-D/3 · sanitarias») que validan Fernanda y Javier, y la propuesta no entra aunque sus tres revisores aprueben.
4. **Javier mueve el colector B2** (IS-301 rev B, a 13,5 m, celda D-E/3). Es una propuesta sin revisores. El solapamiento queda resuelto, la propuesta del colector entra sola y la del shaft, que ya tenía sus aprobaciones, entra con ella.

## Guion de 3 minutos

1. **0:00 a 0:20. Contexto.** En `/sala`, Los Aromos con todo confirmado y 10 documentos al día. «Los planos están en el Drive, el presupuesto en una planilla, la cotización en el correo, las decisiones en un WhatsApp y un libro de obra. Nadie migró nada: leemos donde ya viven.» Se toca «15 cm» y la procedencia dice: plano E-102 rev B, Drive del proyecto, confirmado.
2. **0:20 a 0:55. Un plano nuevo.** Paso 1: Fernanda sube el E-102 rev C. El telón marca «Losa N3: 20 cm, propuesto» y lo vigente sigue en 15 cm. +$3.636.500, +1 día, 4 de 7 avisados en su canal.
3. **0:55 a 1:30. El consenso.** Daniela, Javier y Marcos aprueban. Paula disputa («Necesito 2 días…»): el valor queda en disputa y lo vigente no cambia. Fernanda pulsa «Reabrir con la observación»: solo Paula vuelve a estar pendiente. Aprueba y la losa pasa a 20 cm, versión 2.
4. **1:30 a 1:55. Lo que quedó atrás.** «Pendientes de actualizar» lista la EETT, el presupuesto y la Carta Gantt, cada uno con su dueño. Daniela sube el presupuesto v3 y el índice sube.
5. **1:55 a 2:30. Un WhatsApp no manda.** Marcos escribe «las ventanas del norte quedaron en 150». No cambia nada: discrepancia solo para Fernanda. Ella sube el A-201 rev C y la discrepancia queda respaldada. Se abre la propuesta, +$1.998.000, 4 de 7. Marcos no recibe aviso y el telón dice por qué: 38 días de holgura.
6. **2:30 a 2:45. El choque entre espacios.** Las ventanas quedan en 150 cm y la cotización de Quillay, que usaba 120, queda desfasada. Quillay sube la rev 2 y el valor queda corroborado desde dos espacios.
7. **2:45 a 3:00. Cierre.** Se toca «20 cm» y se abre la cadena completa: plano, espacio, autora, aprobaciones con hora y nota, y los 15 cm anteriores. Los dueños ponen al día lo que falta y aparece «Obra consensuada». «Nadie migró nada, nadie cambió su forma de trabajar: la obra tiene una versión consensuada y cada valor sabe de dónde viene.»

### Con una sola persona

Fernanda abre `/sala` en el proyector, `/presentador` en el notebook y `pnpm etl` en una terminal. Enter carga el paso siguiente (o el modo automático corre el guion completo, con la disputa y su reapertura) y el ETL vota por los asientos que nadie tomó. Si alguien del público toma un asiento, el ETL no juega por él (`seat_held`); si deja de latir, retoma. Si el celular no entra, la demo no cambia. Reiniciar es un botón de `/presentador` o `pnpm etl reiniciar`.

## Segmentos de construcción

| Segmento        | Qué cubre                                                                                           | Aceptación                                                                                                                                                           | Estado    |
| --------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Lago y consenso | `lake`, `DetectChanges`, `ReopenResponse`, orquestación y endpoints de datos                        | Los tres cambios producen sus cifras por la API; consenso, disputa, reapertura, procedencia, discrepancia con respaldo y desfase se verifican con llamadas concretas | Listo     |
| Sala            | Asientos con token, eventos, época, reinicio, bandeja, `x-act-as`, ingesta genérica y carga inicial | Un humano en un asiento impide que el ETL juegue por él (`seat_held`)                                                                                                | Listo     |
| Web             | Las siete rutas con el look de canal y la procedencia                                               | El telón se mueve en vivo con el ETL y el celular vota                                                                                                               | Listo     |
| ETL             | Lago de archivos, parsers, guion y jugadores fuera de la API                                        | Test de oro de los 59 hechos; con `pnpm etl auto --velocidad 4` y sin humanos, el guion llega a «Obra consensuada» con las cifras verificadas                        | Listo     |
| Pulido          | Ensayo cronometrado y acceso desde los celulares (despliegue o red local)                           | El guion dura entre 2:50 y 3:10 y un celular externo entra por el QR                                                                                                 | Pendiente |

## Alcance

**Imprescindible.** El contexto `lake` con detección, propuestas y consenso; el lago de archivos del ETL, que reproduce las tres cifras; `DetectChanges`, impact y notification reutilizados; procedencia; desfase; discrepancia con respaldo; asientos, `x-act-as`, ingesta genérica, carga inicial y reinicio; sondeo con cursor; `/sala`, `/asiento/[castId]` y `/presentador`.

**Deseable.** Reapertura solo al disputante y retiro; confirmar sin cambio con nota; sello con la línea de quién cerró qué; `/espacios`, `/cambios/[id]` y `/valor`; paso del shaft; looks de canal; QR y acceso desde celulares.

**Opcional.** Lectura de planos en PDF o del modelo con un modelo de lenguaje; árbitro ITO; cambio de precio unitario desde una cotización; escalamiento por falta de respuesta; cascada de más de un nivel; sonido y animaciones extra.

## Riesgos

| Riesgo                                        | Mitigación                                                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Alcance excesivo para el tiempo               | Un solo contexto nuevo, desfase derivado, segmentos con valor demostrable, recorte de lo deseable y opcional        |
| Romper `DetectChanges`, impact o notification | `impact` intacto, `diffSnapshots` sin tocar, test de regresión de las tres cifras                                   |
| Una disputa atasca la demo                    | «Reabrir con la observación» es un botón determinista y el ETL lo ejecuta en modo automático                        |
| Muchos celulares en un Wi-Fi saturado         | Sondeo corto con cursor, jitter, backoff, época, acciones idempotentes                                              |
| Concurrencia de votos y tareas                | Transacción con bloqueo por propuesta, advisory lock de la sala, evento con `seq` único                             |
| Un humano toma un asiento y no responde       | Sin latido por 20 s el asiento queda libre y el ETL retoma; el presentador puede soltarlo                           |
| Se percibe como un gestor documental          | El telón muestra hechos y procedencia, no archivos; los momentos fuertes son la disputa, el choque y la procedencia |
| Archivos arbitrarios                          | Solo documentos del registro del proyecto, con sujetos y atributos conocidos, y mensaje claro                       |
| Los celulares no entran                       | El ETL cubre la demo; S6 resuelve el acceso                                                                         |
| Archivos del lago incoherentes con lo vigente | Test de oro del ETL: cada archivo produce los hechos esperados                                                      |

## Glosario

| Término                                  | Significado                                                                                                                                                             |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Espacio                                  | Lugar donde ya vive la información; tiene un asiento dueño y el repositorio solo lo lee                                                                                 |
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
| Asiento                                  | Persona fija del elenco que un dispositivo toma sin cuenta; si nadie lo toma, lo juega el ETL                                                                           |
| Sala                                     | La muestra en vivo: asientos y eventos                                                                                                                                  |
| Consenso                                 | Documentos al día sobre documentos totales; al completarse aparece «Obra consensuada»                                                                                   |

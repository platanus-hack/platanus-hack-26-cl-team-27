# La sala de la obra

Una obra no tiene una fuente de verdad. Tiene planos con revisión en Drive, cotizaciones y presupuestos en planillas, una Carta Gantt, EETT, actas, mensajes de WhatsApp y un libro de obra, repartidos en espacios distintos que dicen cosas distintas. Este documento describe cómo el sistema consolida esa información por detrás y cómo la muestra lo convierte en una experiencia multijugador. El problema y la propuesta están en [negocio](negocio.md); la muestra, en [muestra](muestra.md); el sistema, en [arquitectura](arquitectura.md).

## La idea

Detrás de los documentos hay un repositorio de cambios, un lago con procedencia. Cada revisión de cada artefacto se lee donde vive, se ingiere como un conjunto de hechos con puntero a su origen y se compara contra **lo vigente**, la versión consolidada y consensuada del proyecto. Una diferencia con autoridad suficiente abre una **propuesta de cambio**, el pull request de la obra: calcula costo y plazo con reglas deterministas y avisa solo a los afectados, en el canal que ya usan. Lo vigente solo cambia cuando todos ellos confirman.

Multiplayer es el núcleo, no una función. La verdad del proyecto no la decide nadie en solitario: es el acuerdo de personas con intereses distintos, cada una dueña de un espacio y de sus documentos. Cada documento que suelta una persona deja desfasado o en disputa el de otra, y la verdad solo converge cuando todas actúan. En la muestra, el público toma los asientos del elenco desde su celular; los asientos vacíos los juegan bots deterministas, de modo que una sola persona puede presentar todo.

## Principios

1. **Multiplayer es el núcleo.** Ninguna acción individual mueve lo vigente por sí sola.
2. **Nadie migra ni cambia su forma de trabajar.** Leemos los artefactos donde viven y consolidamos hechos con un puntero al origen, no los archivos. Consolidar no es centralizar.
3. **Cada valor responde de dónde salió.** Revisión, espacio, autor, propuesta y aprobaciones.
4. **Solo avisamos a quien le afecta**, en su canal, con lo que le toca, su costo y su plazo. Quien no es afectado queda visible con su razón.
5. **La autoridad es explícita**: el plano y la EETT mandan sobre el diseño, la cotización y el presupuesto sobre el precio, la Carta Gantt y el acta sobre las fechas. Un WhatsApp o el libro de obra proponen, no deciden.
6. **Una disputa no borra lo vigente.** Toda salida es una acción visible: reabrir, retirar o una revisión nueva.
7. **Lo desactualizado se ve**, con su dueño. Confirmar sin cambio exige una nota.
8. **Las cifras salen de reglas.** Un modelo de lenguaje solo es el camino de producción para leer planos y PDFs; la muestra no lo usa.
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

Para el repositorio un espacio es de solo lectura. El conector de la muestra es el botón de soltar un documento de la carpeta del dueño, que ejecuta la misma ingesta que haría un conector real.

### Documentos y revisiones

Un **documento** es una identidad estable (A-201 Fachada norte y shaft, E-102 Planta estructural N3, EETT-03 Hormigones, Presupuesto itemizado, Carta Gantt, Cotización Q-118). Una **revisión** es una versión inmutable (rev B, rev C, v2) con espacio, autor, tipo (`plano`, `eett`, `cotizacion`, `presupuesto`, `carta_gantt`, `acta`, `mensaje`, `libro_obra`), hash de contenido, puntero al origen (por ejemplo `Drive/Los Aromos/Estructura/E-102_revC.pdf`) y orden de ingesta. Las revisiones nunca se pisan; la vigente de un documento es la última ingerida. Ingerir dos veces la misma revisión es idempotente.

### Hechos

Cada revisión produce afirmaciones sobre las propiedades de los elementos del proyecto: sujeto, atributo, valor, unidad, rol y localizador. Los sujetos y atributos son los del grafo del proyecto (`losa-n3` `espesor_cm`, `shaft-s1` `posicion_m`, `ventanas-norte` `ancho_cm`, `partida-07.01` `precio_unitario`, `proyecto` `entrega_dias`).

- **Afirma**: el documento declara el valor.
- **Usa**: el documento se calculó sobre ese valor (el presupuesto usa el espesor de la losa).
- **Localizador**: celda, página o frase de origen (`Partidas!C14`, `cajetín rev C`, `folio 44`).

La extracción es determinista. La revisión del catálogo trae sus hechos escritos a mano, y un lector de la plantilla CSV fija de cotización o presupuesto produce los mismos hechos desde un archivo real, detrás del mismo puerto `FactExtractor`. En producción, un modelo de lenguaje o un lector de planos emitiría los mismos hechos, con confianza, detrás de ese puerto. La muestra no lo usa.

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
3. **Distinto, con autoridad**: es un cambio. Se agrupa por elemento y abre una propuesta.
4. **Distinto, sin autoridad**: abre una **discrepancia**. No cambia nada y avisa solo al dueño del valor, que es el autor de la revisión que respalda lo vigente.

Un hecho «usa» distinto de lo vigente deja el documento desfasado desde el ingreso. Cuando llega después una revisión con autoridad que afirma el valor de una discrepancia abierta, la discrepancia se cierra como respaldada y queda enlazada en la procedencia: un WhatsApp propone, un plano confirma.

### Propuesta y consenso

Una propuesta por elemento reutiliza `capture` (el antes y el después) e `impact` (costo, plazo, un hallazgo por afectado y los filtrados con su razón). Los **revisores** son exactamente los afectados notificados; los filtrados se muestran con su razón y no votan.

- Cada revisor aprueba o disputa, con nota opcional (en `notification`, `reviewed` o `issue`).
- La propuesta se **fusiona** a lo vigente cuando todos los revisores aprobaron. Con cero revisores se fusiona de inmediato.
- Una **disputa** deja la propuesta en disputa y lo vigente no cambia.
- El autor puede **reabrir con la observación**: solo vuelve a pendiente quien disputó, y las aprobaciones se conservan. También puede **retirarla**.
- Una revisión nueva con autoridad que afirma otro valor para el mismo sujeto y atributo **reemplaza** la propuesta abierta y abre una nueva con votos limpios.

Las respuestas son idempotentes.

### Desfase

El desfase es una vista derivada, sin tabla. Un documento vigente queda **desfasado** cuando alguno de sus hechos (los que afirma con autoridad y los que usa) difiere de lo vigente y no pertenece a una propuesta abierta. Se muestra con su dueño, el valor usado y el valor vigente, y se recalcula tras cada ingreso y fusión. Una revisión nueva del mismo documento lo cierra si coincide. El dueño también puede **confirmar sin cambio** con una nota obligatoria: el desfase queda visible como aviso amarillo, no como consenso ciego. El desfase es de un nivel: lo declaran los hechos «usa» del catálogo.

### Procedencia

Al tocar un valor vigente se arma su cadena: hecho, revisión, espacio, autor, fecha, propuesta, aprobaciones con hora y nota, respaldos de discrepancias y valores anteriores con su origen. Es el `git blame` del plano de la obra y responde «¿de dónde salió este 20 cm?».

### Meta compartida

El **índice de consenso** son los documentos al día sobre los documentos totales (al día: sin desfase ni discrepancia abierta). Cuando no queda propuesta abierta, discrepancia ni desfase, la sala muestra el sello **Obra consensuada** con la versión del proyecto y quién cerró qué. El costo total y la ruta crítica son lo vigente más los impactos de las propuestas fusionadas.

## Cómo encajan impacto y avisos

- `impact` no cambia de reglas ni de cifras. Recibe el elemento con sus propiedades antes y después, que el API arma desde el modelo del escenario y los hechos, y devuelve costo, plazo, un hallazgo por afectado y los filtrados con su razón.
- `notification` crea un aviso por afectado y cambio, en su canal, con el link a `/cambios/:id`. Su respuesta es el voto: `reviewed` aprueba, `issue` disputa.
- Las discrepancias y los desfases no son avisos de `notification`: el API los compone en la bandeja del asiento desde el repositorio.

## Los jugadores

- **Asientos fijos.** Fernanda Lagos (presentadora y autora de los cambios) y los siete del elenco: Paula Rojas (correo), Marcos Fuentes (WhatsApp), Daniela Soto (Slack), Javier Muñoz (WhatsApp), Camila Vera (Slack), Tomás Reyes (correo) y Ventanas Quillay (correo). Un dispositivo toma un asiento sin cuenta: guarda un token en `localStorage`.
- **Presencia.** El token en la consulta de eventos es el latido. Un asiento sin latido por 20 segundos lo juega un bot.
- **Bots.** Responden con un guion fijo y retardos fijos. Nunca actúan por un asiento con humano presente.
- **Telón.** `/sala`, solo lectura, para el proyector.

## Contextos y capas

| Contexto       | Estado       | Papel                                                                                          |
| -------------- | ------------ | ---------------------------------------------------------------------------------------------- |
| `lake`         | nuevo        | Repositorio, lo vigente, autoridad, detección, propuestas, discrepancias, desfase, procedencia |
| `capture`      | generalizado | Detecta el cambio entre una base y un siguiente (`DetectChanges` sobre `diffSnapshots`)        |
| `impact`       | sin cambios  | Costo, plazo, afectados y filtrados                                                            |
| `notification` | extendido    | Un aviso por afectado en su canal; la respuesta es el voto; `ReopenResponse`                   |

Los contextos nunca se importan entre sí: la API los compone. La sala (asientos, eventos, bots, escenas) es un módulo de la API, infraestructura de la muestra y no un contexto de dominio.

### `lake`

- **Dominio**: `Space`, `Revision`, `Claim`, `Authority`, `BaselineEntry`, `Proposal`, `Review`, `Discrepancy`, `Acknowledgement`. Funciones puras: `classifyClaims`, `decideProposal`, `reopenFor`, `computeStaleness`, `consensusIndex`, `buildProvenance`.
- **Puertos**: un repositorio por agregado y `FactExtractor`.
- **Casos de uso**: `IngestRevision`, `OpenProposal`, `RecordReview`, `ReopenProposal`, `WithdrawProposal`, `DismissDiscrepancy`, `AcknowledgeStale`, `GetBaseline`, `GetProvenance`, `ListStale`, `ListProposals`, `GetConsensus`.
- **Adapters** (subpath `/adapters`): Prisma por repositorio, `FixtureFactExtractor` y `TemplateCsvFactExtractor`.

### `capture`

`ChangeDraft` lleva `sourceId` (la revisión de origen) y no tiene versión de integración. `DetectChanges({ sourceId, base, next })` envuelve `diffSnapshots`, persiste un cambio por elemento y lo devuelve. `GetChange` y `ListChanges` se conservan.

### `notification`

`ReopenResponse(notificationId)` limpia la respuesta de un aviso para que quien disputó vuelva a estar pendiente.

### La API compone

`modules/lake`, `capture`, `impact` y `notification` entran cada uno por su módulo de Nest. `modules/coordination` orquesta una acción completa: ingesta, `DetectChanges`, `analyzeChange`, `NotifyStakeholders`, `OpenProposal`, el voto, la fusión, los totales y la bandeja. `modules/room` lleva asientos, eventos, bots y escenas. El adaptador `elementsFromBaseline` arma la base y el siguiente como elementos del modelo del escenario con los valores vigentes y los de la propuesta.

## Datos

Prisma, una migración nueva:

- `Change` gana `source_id` y pierde `integration_id` y `version`; `Snapshot` no existe. `Impact` y `Notification` no cambian.
- `Revision`, `Claim`, `BaselineEntry`, `BaselineHistory`, `Proposal`, `Review`, `Discrepancy`, `Acknowledgement`.
- `Seat`, `RoomEvent` (`seq` autoincremental), `BotTask` y `RoomState` (época, autoplay, velocidad, versión del proyecto).
- Sin tabla: estado de un valor, fuentes, desfase y totales.

El reinicio borra todo en una transacción, siembra el catálogo, suma uno a la época y libera los asientos.

## API

Todas las rutas cuelgan de `/api`. Las acciones de asiento llevan `x-seat-token`; las del presentador, `x-presenter-key`; las que escriben, `x-action-id`.

| Método y ruta                                        | Qué hace                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| `GET /room`                                          | Snapshot: proyecto, elenco con ocupante, espacios, contadores y meta           |
| `POST /seats/:castId/claim`, `DELETE /seats/:castId` | Tomar y soltar un asiento (409 si está tomado)                                 |
| `GET /events?after&epoch&seat`                       | Sondeo con cursor; es el latido y ejecuta el tick de bots                      |
| `GET /baseline?section`                              | Lo vigente con estado, fuentes y totales                                       |
| `GET /baseline/:subjectId/:attribute/provenance`     | Cadena de procedencia                                                          |
| `GET /spaces`                                        | Espacios, documentos, revisiones y estado                                      |
| `GET /seats/:castId/tray`                            | Documentos que el asiento puede soltar                                         |
| `POST /spaces/:spaceId/drops`                        | Suelta un documento del catálogo (o la plantilla CSV) y ejecuta toda la cadena |
| `GET /seats/:castId/inbox`                           | Votos, discrepancias, desfases y filtrados del asiento                         |
| `GET /proposals?status`                              | Propuestas con revisores, filtrados y respaldo                                 |
| `POST /notifications/:id/response`                   | Voto `reviewed` o `issue` con nota; fusiona si hay consenso                    |
| `POST /proposals/:id/reopen`, `/withdraw`            | Reabrir con la observación; retirar                                            |
| `POST /discrepancies/:id/dismiss`                    | Descartar una discrepancia                                                     |
| `POST /stale/acknowledge`                            | Confirmar sin cambio con nota                                                  |
| `GET /changes`, `GET /changes/:id`                   | Feed y detalle de cambios, con su propuesta                                    |
| `GET /room/scenes`, `POST /room/scenes/:id/play`     | Escenas del guion                                                              |
| `POST /room/autoplay`, `POST /room/reset`            | Autoplay y reinicio                                                            |

Formas principales:

```ts
interface DropResponse {
  revisionId: string;
  claims: {
    subjectId: string;
    attribute: string;
    value: number | string;
    outcome: 'same' | 'corroborates' | 'change' | 'discrepancy' | 'stale' | 'new';
  }[];
  proposals: {
    id: string;
    changeId: string;
    title: string;
    costDelta: number;
    delayDays: number;
    reviewers: string[];
    filtered: { stakeholderId: string; reason: string }[];
  }[];
  discrepancies: { id: string; ownerId: string }[];
  backed: string[];
  stale: { revisionId: string; subjectId: string; attribute: string }[];
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

Errores: `409 already_ingested`, `409 blocked` (un fixture cuya precondición no se cumple), `409 seat_taken`, `403` para un fixture ajeno al asiento, `401` para token o clave inválidos, `422 template_invalid` para un CSV fuera de plantilla.

## Tiempo real

Sondeo corto con cursor, sin SSE ni WebSockets: el `rewrite` de Next puede bufferizar las conexiones largas, y en un Wi-Fi ruidoso se cortan en silencio.

- Cada cliente llama a `GET /api/events?after=<seq>&epoch=<n>` cada 1000 ms (el telón, cada 700 ms) con jitter de ±150 ms.
- Cada mutación inserta sus eventos en la misma transacción. Los eventos son invalidaciones con un mensaje en español para el ticker; al recibirlos, la pantalla vuelve a pedir su snapshot.
- Si cambió la época (reinicio) o el cursor está por delante del servidor, la respuesta trae `reset: true` y el cliente recarga todo.
- El token en la petición es el latido de presencia.
- Cada petición dispara un tick (como máximo una vez cada 500 ms por proceso) que, bajo un advisory lock de Postgres, ejecuta hasta cinco tareas de bot vencidas. No hay timers que se pierdan.
- `useRoomPulse` usa `AbortController`, backoff hasta 3 s, pausa con la pestaña oculta y reanuda al volver.

## La web

Textos de UI en español de Chile, con tuteo.

| Ruta                             | Para qué                                                              |
| -------------------------------- | --------------------------------------------------------------------- |
| `/`                              | Elige quién eres en la obra: tomar un asiento, ver la sala, QR        |
| `/sala`                          | Telón del proyector, solo lectura                                     |
| `/asiento/[castId]`              | Celular del jugador, con el look de su canal                          |
| `/presentador`                   | Escenas, autoplay, reinicio, carpeta de Fernanda y acciones de autora |
| `/espacios`                      | Explorador de espacios, documentos y revisiones                       |
| `/cambios/[id]`                  | Detalle de una propuesta; destino del link de cada aviso              |
| `/valor/[subjectId]/[attribute]` | Procedencia completa de un valor                                      |

**`/sala`.** Barra de totales (Costo del proyecto, Plazo, Versión del proyecto), anillo de consenso, tablero de lo vigente por sección (Estructura, Instalaciones, Fachada, Costos y plazo) con estado, fuentes y desfases, franja de propuestas con puntos por afectado y el nombre de quien falta (Marcos en gris con su razón), «Pendientes de actualizar» con dueño, mapa de espacios con pulso al recibir, ticker de eventos, sello «Obra consensuada» y QR. Tocar un valor abre la procedencia. Nunca muestra archivos: muestra hechos, estados y procedencia.

**`/asiento/[castId]`.** Un contenedor con el look del canal (bandeja de correo, chat de WhatsApp, hilo de Slack) y el mismo contenido:

- **Voto**: el cambio, lo que te toca, costo y plazo, progreso con «Falta alguien», y los botones «Revisado» y «Tengo un problema» con nota de hasta 280 caracteres.
- **Discrepancia** (dueño del valor): «Dice 150 cm, lo vigente es 120 cm», con «Descartar» y «Esperar el plano».
- **Desfase** (dueño del documento): «Tu documento usa 15 cm, lo vigente es 20 cm», con «Subí la revisión» y «Confirmo sin cambio».
- **Filtrado**: «No te avisamos: …» con la razón.
- **Tu carpeta**: documentos para soltar con vista previa de sus hechos.
- Para la autora: «Reabrir con la observación» y «Retirar».

Estado vacío: «Estás al día». El token vive en `localStorage` con `try/catch`; sin él las pantallas siguen funcionando en solo lectura.

## El escenario

El proyecto, el elenco, el grafo y las reglas están en [`apps/api/src/scenario/los-aromos.ts`](../apps/api/src/scenario/los-aromos.ts). El catálogo de documentos, hechos y fixtures está en `documents.ts`, los bots en `bots.ts` y las escenas en `scenes.ts`.

### Sembrado

Nueve documentos, todos al día y con unos 16 hechos vigentes confirmados:

| Documento                         | Espacio  | Dueño    | Hechos                                                              |
| --------------------------------- | -------- | -------- | ------------------------------------------------------------------- |
| A-201 Fachada norte y shaft rev B | Drive    | Fernanda | Ventanas 120 × 150 cm, 24 unidades; shaft a 6 m                     |
| E-102 Planta estructural N3 rev B | Drive    | Fernanda | Losas en 15 cm                                                      |
| EETT-03 Hormigones rev A          | Drive    | Paula    | Losas en 15 cm                                                      |
| Presupuesto itemizado v2          | Costos   | Daniela  | Cuatro precios unitarios; usa losa N3 en 15 cm y ventanas en 120 cm |
| Carta Gantt v4                    | Costos   | Marcos   | Entrega a 108 días; usa losa N3 en 15 cm                            |
| Cotización Q-118 rev 1            | Correo   | Quillay  | $185.000/m²; usa ventanas en 120 cm                                 |
| Acta de coordinación 12           | Drive    | Fernanda | Entrega a 108 días                                                  |
| Folio 41                          | Libro    | Marcos   | Shaft a 6 m                                                         |
| Mensaje de WhatsApp               | WhatsApp | Marcos   | Ambienta, sin hechos de diseño                                      |

### Fixtures para soltar

`e102-revC`, `presupuesto-v3`, `gantt-v5`, `eett03-revB`, `wa-ventanas-150`, `a201-revC`, `q118-rev2`, `libro-f44-shaft` y `a201-revD` (requiere haber ingerido `a201-revC`). Cada uno tiene asiento, espacio, hechos con localizador, puntero ficticio y precondición.

### Los tres cambios como eventos de documento

1. **Losa del nivel 3, de 15 a 20 cm** (`e102-revC`). Avisa a 4 de 7: Paula, Javier, Daniela y Marcos. Costo +$3.636.500 (+14 m³ de hormigón y +1.190 kg de acero) y +1 día en la ruta crítica. Camila, Tomás y Quillay no reciben nada. Al fusionarse quedan desfasados la EETT-03, el presupuesto v2 y la Carta Gantt v4.
2. **Ventanas norte, de 120 a 150 cm** (`wa-ventanas-150`, luego `a201-revC`). El WhatsApp abre una discrepancia solo para Fernanda; el plano la respalda y abre la propuesta: 4 de 7 (Quillay, Paula, Tomás y Daniela), +$1.998.000. Marcos queda filtrado: la instalación pasa de 4 a 5 días pero tiene 38 días de holgura y la entrega no se mueve. Al fusionarse, la cotización Q-118 rev 1 queda desfasada hasta `q118-rev2`.
3. **Shaft S1, de 6 a 8,5 m** (`libro-f44-shaft`, luego `a201-revD`). El folio abre una discrepancia para Fernanda; el plano la respalda y, como las ventanas ya coinciden, abre solo la propuesta del shaft: 3 de 7 (Paula, Javier y Camila), sin costo ni plazo. Daniela y Marcos no reciben aviso.

### Bots

Retardos a velocidad 1x: Paula 2,5 s, Daniela 3 s, Marcos 3,5 s, Javier 4 s, Quillay 4,5 s, Camila 5 s, Tomás 6 s. Todos aprueban, salvo:

- **Paula**, en la propuesta de la losa: disputa con «Necesito 2 días para recalcular las vigas y pilares que reciben la losa». Tras la reapertura aprueba 3 s después con «Recalculado, queda conforme».
- **Javier**, en la propuesta del shaft: disputa con «El shaft a 8,5 m cruza el colector de la bajada B2» y aprueba tras la reapertura.

En el autoplay, un bot de la presentadora reabre a los 4 s, y los dueños sueltan sus documentos: Daniela el presupuesto, Quillay la cotización, Marcos la Carta Gantt y Paula la EETT.

### Escenas

`s1` Llega el plano E-102 rev C. `s2` Daniela corrige el presupuesto. `s3` Marcos avisa por WhatsApp. `s4` Llega el plano A-201 rev C. `s5` Quillay vuelve a cotizar. `s6` Cierre: los demás se ponen al día. Extras: `x1` Decisión en el libro de obra y `x2` Llega el plano A-201 rev D. El autoplay encadena `s1` a `s6`; cada escena espera a que no haya propuestas abiertas y una pausa de 3 s.

## Guion de 3 minutos

1. **0:00 a 0:20. Contexto.** En `/sala`, Los Aromos con todo confirmado y 9 documentos al día. «Los planos están en el Drive, el presupuesto en una planilla, la cotización en el correo, las decisiones en un WhatsApp y un libro de obra. Nadie migró nada: leemos donde ya viven.» Se toca «15 cm» y la procedencia dice: plano E-102 rev B, Drive del proyecto, confirmado.
2. **0:20 a 0:55. Un plano nuevo.** Escena 1: Fernanda suelta el E-102 rev C. El telón marca «Losa N3: 20 cm, propuesto» y lo vigente sigue en 15 cm. +$3.636.500, +1 día, 4 de 7 avisados en su canal.
3. **0:55 a 1:30. El consenso.** Daniela, Javier y Marcos aprueban. Paula disputa («Necesito 2 días…»): el valor queda en disputa y lo vigente no cambia. Fernanda pulsa «Reabrir con la observación»: solo Paula vuelve a estar pendiente. Aprueba y la losa pasa a 20 cm, versión 2.
4. **1:30 a 1:55. Lo que quedó atrás.** «Pendientes de actualizar» lista la EETT, el presupuesto y la Carta Gantt, cada uno con su dueño. Daniela suelta el presupuesto v3 y el índice sube.
5. **1:55 a 2:30. Un WhatsApp no manda.** Marcos escribe «las ventanas del norte quedaron en 150». No cambia nada: discrepancia solo para Fernanda. Ella suelta el A-201 rev C y la discrepancia queda respaldada. Se abre la propuesta, +$1.998.000, 4 de 7. Marcos no recibe aviso y el telón dice por qué: 38 días de holgura.
6. **2:30 a 2:45. El choque entre espacios.** Las ventanas quedan en 150 cm y la cotización de Quillay, que usaba 120, queda desfasada. Quillay suelta la rev 2 y el valor queda corroborado desde dos espacios.
7. **2:45 a 3:00. Cierre.** Se toca «20 cm» y se abre la cadena completa: plano, espacio, autora, aprobaciones con hora y nota, y los 15 cm anteriores. Los bots ponen al día lo que falta y aparece «Obra consensuada». «Nadie migró nada, nadie cambió su forma de trabajar: la obra tiene una versión consensuada y cada valor sabe de dónde viene.»

### Con una sola persona

Fernanda abre `/sala` en el proyector y `/presentador` en el notebook. Los demás asientos son bots. Avanza escena por escena o enciende el autoplay, que reproduce `s1` a `s6` completo, con la disputa y su reapertura. Si alguien del público toma un asiento, el bot se retira de ese asiento; si deja de latir, retoma. Si el celular no entra, la demo no cambia. Reiniciar es un botón.

## Segmentos de construcción

1. **S3. Repositorio y consenso.** `lake`, `DetectChanges`, `ReopenResponse`, migración, catálogo, orquestación y endpoints de datos. Aceptación: `pnpm check` en verde; los tres cambios producen sus cifras por la API; consenso, disputa, reapertura, procedencia, discrepancia con respaldo y desfase se verifican con llamadas concretas.
2. **S4. Sala.** Asientos con token, eventos, bots perezosos, escenas, autoplay, época y reinicio, bandeja. Aceptación: con autoplay y sin asientos tomados, el sondeo lleva a «Obra consensuada» en menos de 90 s a velocidad 4x, con la disputa de Paula visible.
3. **S5. Web.** Las siete rutas con el look de canal y la procedencia. Aceptación: el telón se mueve en vivo con el autoplay, el celular de 390 px vota y se refleja en menos de 2 s, la procedencia abre con nombres y notas.
4. **S6. Pulido.** Ensayo cronometrado, acceso desde los celulares (despliegue o red local), docs finales, lector opcional de la plantilla CSV. Aceptación: el guion dura entre 2:50 y 3:10 y un celular externo entra por el QR.

## Alcance

**Imprescindible.** El contexto `lake` con detección, propuestas y consenso; el catálogo que reproduce las tres cifras; capture, impact y notification reutilizados; procedencia; desfase; discrepancia con respaldo; asientos, bots, escenas, autoplay y reinicio; sondeo con cursor; `/sala`, `/asiento/[castId]` y `/presentador`.

**Deseable.** Reapertura solo al disputante y retiro; confirmar sin cambio con nota; sello con la línea de quién cerró qué; `/espacios`, `/cambios/[id]` y `/valor`; escena del shaft; looks de canal; QR y acceso desde celulares.

**Opcional.** Lector de plantilla CSV o xlsx; árbitro ITO; cambio de precio unitario desde una cotización; escalamiento por falta de respuesta; cascada de más de un nivel; sonido y animaciones extra.

## Riesgos

| Riesgo                                  | Mitigación                                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Alcance excesivo para el tiempo         | Un solo contexto nuevo, desfase derivado, segmentos con valor demostrable, recorte de lo deseable y opcional        |
| Romper capture, impact o notification   | `impact` intacto, `diffSnapshots` sin tocar, test de regresión de las tres cifras                                   |
| Una disputa atasca la demo              | «Reabrir con la observación» es un botón determinista y un bot lo ejecuta en autoplay                               |
| Muchos celulares en un Wi-Fi saturado   | Sondeo corto con cursor, jitter, backoff, época, acciones idempotentes                                              |
| Concurrencia de votos y tareas          | Transacción con bloqueo por propuesta, advisory lock en el tick, evento con `seq` único                             |
| Un humano toma un asiento y no responde | Sin latido por 20 s el bot retoma; el presentador puede soltar el asiento                                           |
| Se percibe como un gestor documental    | El telón muestra hechos y procedencia, no archivos; los momentos fuertes son la disputa, el choque y la procedencia |
| Archivos arbitrarios                    | Solo catálogo cerrado y plantilla CSV estricta, con mensaje claro                                                   |
| Los celulares no entran                 | Bots y autoplay cubren la demo; S6 resuelve el acceso                                                               |
| Fixtures incoherentes con lo vigente    | Test de integridad del catálogo                                                                                     |

## Glosario

| Término             | Significado                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| Espacio             | Lugar donde ya vive la información; tiene un asiento dueño y el repositorio solo lo lee                  |
| Documento           | Artefacto de identidad estable (plano, cotización, presupuesto, Carta Gantt, EETT, acta, mensaje, folio) |
| Revisión            | Versión inmutable de un documento, con espacio, autor, fecha, hash y puntero al origen                   |
| Hecho               | Afirmación extraída de una revisión sobre una propiedad de un elemento, con rol y localizador            |
| Lo vigente          | Valor consolidado y consensuado de un hecho, con su procedencia e historial                              |
| Propuesta de cambio | Diferencia con autoridad entre una revisión y lo vigente; se fusiona cuando todos sus revisores aprueban |
| Discrepancia        | Valor distinto de lo vigente que viene de una fuente sin autoridad; avisa solo al dueño del valor        |
| Desfase             | Un documento vigente dice o usa un valor distinto de lo vigente                                          |
| Procedencia         | Cadena que responde de dónde salió un valor                                                              |
| Asiento             | Persona fija del elenco que un dispositivo toma sin cuenta; si nadie lo toma, lo juega un bot            |
| Sala                | La muestra en vivo: asientos, eventos, bots y escenas                                                    |
| Consenso            | Documentos al día sobre documentos totales; al completarse aparece «Obra consensuada»                    |

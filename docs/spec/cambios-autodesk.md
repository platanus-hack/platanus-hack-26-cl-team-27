# Los cambios en Autodesk

Qué puede cambiar en la plataforma de Autodesk que apunta Vigente (Autodesk Construction Cloud y Autodesk Docs, con modelos de Revit), por dónde se entera Vigente de cada cambio y cómo lo traduce. La issue es [PH-49](https://linear.app/ph-team-27/issue/PH-49/detectar-los-cambios-en-autodesk-catalogo-de-eventos-y-diff-por). Incluye el spike de AEC Data Model ([PH-28](https://linear.app/ph-team-27/issue/PH-28/spike-diff-de-versiones-con-aec-data-model)) y en el receptor de webhooks ([PH-27](https://linear.app/ph-team-27/issue/PH-27/receptor-de-webhooks-de-aps)).

**Estado:** el dominio, la firma y el receptor están construidos, con tests sin red: [`context/integrations`](../../context/integrations/README.md#autodesk) traduce y deduplica, y `POST /api/integrations/autodesk/webhooks` verifica la firma sobre el cuerpo crudo, descarta los repetidos con la tabla `autodesk_events` y deja cada aviso nuevo en el log de la API ([el receptor](#el-receptor)). Falta registrar los webhooks en Autodesk por cada carpeta de proyecto vinculada, la consulta a AEC Data Model y probar todo contra un hub real de ACC.

## Las dos capas

Autodesk avisa en dos niveles, y Vigente necesita los dos:

1. **El aviso** (qué pasó y dónde): un webhook de APS dice que hay una versión nueva, que alguien bloqueó un archivo, que se movió una carpeta o que cambió una incidencia. Llega solo, pero no dice qué cambió dentro del modelo.
2. **El detalle** (qué elementos y qué valores): para un modelo, AEC Data Model compara la versión nueva con la última que procesamos y entrega cada elemento agregado, modificado o quitado, con el valor anterior y el nuevo de cada propiedad.

`parseAutodeskWebhook` hace la primera capa y marca con `needsElementDiff` los avisos que piden la segunda. `toElementChanges` y `toMinuteChanges` hacen la segunda y arman una minuta: los cambios de cada valor que sigue la obra, con sus elementos. La API todavía no la recibe ([lo que falta](#lo-que-falta)).

## El catálogo

Cada evento de Autodesk se traduce a un `kind` de Vigente. Lo que no está en el catálogo no se pierde: queda como `unknown`, con su nombre original.

### Archivos y versiones (Data Management, sistema `data`)

| Evento de Autodesk                           | `kind`             | Qué pasó                                               | ¿Diff por elemento? |
| -------------------------------------------- | ------------------ | ------------------------------------------------------ | ------------------- |
| `dm.version.added`                           | `version.added`    | Se subió un archivo o una versión nueva                | Sí, si es un modelo |
| `dm.version.modified`                        | `version.modified` | Cambiaron los datos de una versión (nombre, atributos) | No                  |
| `dm.version.deleted`                         | `version.deleted`  | Se borró una versión o el archivo                      | No                  |
| `dm.version.moved`, `dm.version.moved.out`   | `version.moved`    | El archivo entró o salió de la carpeta                 | No                  |
| `dm.version.copied`, `dm.version.copied.out` | `version.copied`   | Se copió el archivo hacia o desde la carpeta           | No                  |
| `dm.lineage.updated`                         | `item.updated`     | Cambiaron los datos del archivo (todas sus versiones)  | No                  |
| `dm.lineage.reserved`                        | `item.locked`      | Alguien bloqueó el archivo para editarlo               | No                  |
| `dm.lineage.unreserved`                      | `item.unlocked`    | Se liberó el bloqueo                                   | No                  |

### Carpetas y operaciones (Data Management)

| Evento de Autodesk                               | `kind`                                     | Qué pasó                                         |
| ------------------------------------------------ | ------------------------------------------ | ------------------------------------------------ |
| `dm.folder.added`                                | `folder.added`                             | Se creó una carpeta                              |
| `dm.folder.modified`                             | `folder.modified`                          | Cambiaron los datos de una carpeta               |
| `dm.folder.deleted`                              | `folder.deleted`                           | Se borró una carpeta                             |
| `dm.folder.purged`                               | `folder.purged`                            | Se eliminó para siempre                          |
| `dm.folder.moved`, `dm.folder.moved.out`         | `folder.moved`                             | La carpeta entró o salió                         |
| `dm.folder.copied`, `dm.folder.copied.out`       | `folder.copied`                            | Se copió la carpeta                              |
| `dm.operation.started`, `dm.operation.completed` | `operation.started`, `operation.completed` | Empezó o terminó una copia o un movimiento largo |

### Modelos (Model Derivative y Revit en la nube)

| Evento de Autodesk    | Sistema      | `kind`               | Qué pasó                                         | ¿Diff por elemento? |
| --------------------- | ------------ | -------------------- | ------------------------------------------------ | ------------------- |
| `extraction.finished` | `derivative` | `derivative.ready`   | Autodesk terminó de procesar el modelo           | Sí                  |
| `extraction.updated`  | `derivative` | `derivative.updated` | Avanzó el procesamiento                          | No                  |
| `model.sync`          | `adsk.c4r`   | `model.synced`       | Alguien sincronizó el modelo de Revit en la nube | Sí                  |
| `model.publish`       | `adsk.c4r`   | `model.published`    | Se publicó el modelo                             | Sí                  |

### Módulos de ACC

| Evento de Autodesk                  | Sistema                        | `kind`           | Qué pasó                                                       |
| ----------------------------------- | ------------------------------ | ---------------- | -------------------------------------------------------------- |
| `issue.created-1.0`                 | `autodesk.construction.issues` | `issue.created`  | Se creó una incidencia                                         |
| `issue.updated-1.0`                 | `autodesk.construction.issues` | `issue.updated`  | Cambió una incidencia (estado, responsable, fecha, campos)     |
| `issue.deleted-1.0`                 | `autodesk.construction.issues` | `issue.deleted`  | Se borró                                                       |
| `issue.restored-1.0`                | `autodesk.construction.issues` | `issue.restored` | Se restauró                                                    |
| `issue.unlinked-1.0`                | `autodesk.construction.issues` | `issue.unlinked` | Se desvinculó de su documento                                  |
| Cualquier evento de Cost Management | `autodesk.construction.cost`   | `cost.changed`   | Cambió un presupuesto, contrato, orden de cambio, gasto o pago |

Los eventos de Cost Management se agrupan por su sistema o por el prefijo (`budget.`, `contract.`, `cost.`, `changeorder.`, `expense.`, `payment.`) porque ACC agrega eventos nuevos seguido. Hay que confirmar los nombres exactos con la cuenta de ACC antes de registrarlos.

### Dentro de un modelo (AEC Data Model)

| Diferencia     | Vigente    | En la minuta                                           |
| -------------- | ---------- | ------------------------------------------------------ |
| `ADDITION`     | `added`    | El valor anterior es `null`                            |
| `MODIFICATION` | `modified` | Valor anterior y nuevo                                 |
| `REMOVAL`      | `removed`  | El valor nuevo es `null` (la API lo deja en `ignored`) |

Las propiedades que siguen la obra son estas: «Thickness», «Default Thickness», «Espesor», «Grosor» y «Grosor por defecto» van a `espesor_cm`; «Width», «Ancho» y «Anchura» a `ancho_cm`; «Height», «Alto» y «Altura» a `alto_cm`; y «Distancia eje A», «Distancia al eje A», «Posición» y «Posicion» a `posicion_m`. `cantidad` sale de contar los elementos de cada clave en las dos versiones (`countBySubject`), porque el diff solo trae lo que cambió.

**Lo que da y sus límites.** AEC Data Model trae un diff por elemento y por propiedad (`diffElementGroupByVersionWithLatest`), con el valor anterior y el nuevo. Alcanza para la losa N3 de 15 a 20 cm, con estos límites:

| Límite                                                                                                                                                       | Qué significa para Vigente                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **El modelo tiene que estar en un hub de ACC** (hoy Forma Data Management), con AEC Data Model activado por un administrador de la cuenta. No viene activado | Los modelos del visor viven en un bucket de OSS ([`apps/aps`](../../apps/aps/README.md)), no en un hub. No sirven tal cual: hay que subirlos a un proyecto de ACC                                     |
| **Revit 2024 o posterior**                                                                                                                                   | Un modelo en una versión anterior no entrega diff                                                                                                                                                     |
| **Solo ve versiones**: las publicadas o, con la sincronización activa, las de trabajo (`WIP`) de la línea de tiempo del documento                            | Un guardado local no es una versión. El diff llega cuando alguien sincroniza o publica el modelo en la nube, no en cada Ctrl+S                                                                        |
| **El diff compara una versión con la última**, no dos versiones cualquiera                                                                                   | Sirve para ir de la última que procesamos a la actual. Si entre tanto hubo dos versiones, llegan juntas en un solo diff. Para comparar dos versiones exactas, hay que leer las dos y compararlas aquí |
| **Tiene que pedirlo una persona**: token de tres patas, nunca de dos                                                                                         | Usa la conexión de Autodesk de la organización ([PH-25](https://linear.app/ph-team-27/issue/PH-25/conexion-oauth-con-autodesk-aps)), y esa cuenta tiene que ver el proyecto en ACC                    |
| **No entrega geometría**                                                                                                                                     | `espesor_cm`, `ancho_cm` y `alto_cm` salen de parámetros. `posicion_m` solo sale si hay un parámetro «Distancia eje A»: la nube no puede calcularlo desde la geometría                                |
| **Se entera tarde y sin aviso propio**: hay que esperar a que AEC Data Model extraiga la versión                                                             | El gatillo es un webhook de Data Management o una consulta periódica, más esperar `elementGroupExtractionStatus` en `SUCCESS`                                                                         |

**Recomendación:** AEC Data Model es el camino para leer el modelo sin instalar nada en el PC: un conector que arma el diff de cada versión y lo manda como una revisión del documento del modelo por la puerta de siempre (`POST /api/projects/:projectId/revisions`), de modo que la cadena no cambia. Avisar en cada guardado local, sin depender de un hub de ACC, pediría un add-in instalado en Revit, que hoy no existe.

#### La API

- **Endpoint:** `POST https://developer.api.autodesk.com/aec/graphql`, con la cabecera `Region` (`US` por defecto, `EMEA`, `AUS` y otras) y un token de tres patas. La página del endpoint lista los permisos `data:create data:read data:write`. La conexión de PH-25 pide `data:read account:read user-profile:read`: hay que confirmarlo con la primera consulta real y, si no alcanza, sumar los permisos que falten.
- **El modelo es un `ElementGroup`.** `elementGroupAtTip` da la última versión y `elementGroupByVersionNumber(elementGroupId, versionNumber)` una en particular. `versionHistory { tipVersion, versions }` lista las versiones. Cada `ElementGroupVersion` trae `versionNumber` (la publicada), `wipVersionNumber` (la de trabajo, nula sin sincronización) y `createdOn`. `versionFilter: { versionType: WIP | PUBLISHED }` elige la línea; por defecto es `PUBLISHED`.
- **Los elementos de una versión:** `elementsByElementGroupAtVersion(elementGroupId, versionNumber, filter, pagination)`. Cada `Element` trae `id`, `name`, `properties { name, displayValue, value, definition { units } }`, `references` (por ejemplo su tipo) y `alternativeIdentifiers { externalElementId, revitElementId }`.
- **El filtro** va en `filter.query`, en sintaxis RSQL: `property.name.category==Floors`, `'property.name.Clave obra'==losa-n3` (con comillas simples porque el nombre tiene un espacio), `and`, `or` y paréntesis. Un filtro por nombre de propiedad se expande a ids: hasta 100 por modelo.
- **El diff:** `diffElementGroupByVersionWithLatest(elementGroupId, startVersion, versionFilter, changeFilter, pagination)` devuelve `result: [ElementDifference]`. Cada uno trae `type` (`ADDITION`, `MODIFICATION` o `REMOVAL`), el `element` y `differences.results: [PropertyDifference]`, con `item` (la propiedad en la última versión) y `oldItem` (en `startVersion`). `diffElementByVersionWithLatest(elementId, startElementGroupVersion)` hace lo mismo para un solo elemento.
- **La extracción:** `elementGroupExtractionStatus(fileUrn, versionNumber)` dice `IN_PROGRESS`, `FAILED` o `SUCCESS`.

#### Lo que falta comprobar

No tenemos un hub de ACC con AEC Data Model activado: la respuesta del ejemplo sale del schema publicado, no de un modelo real. Con un hub, en media hora con el [explorador de AEC Data Model](https://aps.autodesk.com/en/docs/aecdatamodel/v1/tutorials/) se confirma:

1. **Que el espesor de la losa sale como propiedad del elemento.** En Revit, «Grosor» del ejemplar es de solo lectura y «Grosor por defecto» es del tipo. Si el ejemplar no lo trae, se lee del tipo por `references` y el cambio de tipo aparece como un cambio de la referencia. Se ve con `propertyDefinitionsByElementGroup`.
2. **Que un parámetro compartido de texto como «Clave obra» se extrae** y se puede filtrar.
3. **Que el id del elemento es estable entre versiones** y si `externalElementId` es el `UniqueId` de Revit, para cruzarlo con el `externalId` del visor.
4. **Los permisos** que pide el endpoint, frente a los que pide la conexión de PH-25.
5. **Cuánto tarda** la versión en aparecer después de sincronizar, y si las versiones `WIP` dan un diff por sincronización.
6. **Los límites de consultas** de la API: la documentación no los publica.

## Cómo se traduce

- **El aviso.** `parseAutodeskWebhook(cuerpo)` lee `hook.event`, `hook.system` y el `payload`, y devuelve un `AutodeskChange`: `kind`, `source`, el recurso (urn, linaje, nombre, extensión, versión, carpeta y proyecto), la hora, quién lo hizo y `needsElementDiff`. Un archivo `.rvt`, `.nwd`, `.nwc` o `.ifc` es un modelo; un PDF o una planilla es un archivo. Lanza `AutodeskEventError` si el cuerpo no es un webhook.
- **Los repetidos.** Autodesk reintenta un webhook si no respondemos a tiempo, y el reintento trae el mismo cuerpo. `dedupeKey` es el hook (`hook.hookId`), el evento, el linaje (o el urn) y el momento. En los eventos que nombra una versión (`dm.version.added`, `dm.version.deleted`, `model.sync`, `model.publish` y `extraction.finished`) el momento es la versión; en los demás, como `dm.version.modified` o los bloqueos `dm.lineage.*`, es la versión junto a la hora del cambio, así que dos ediciones de la misma versión son dos avisos. Si no hay versión ni hora, el momento es una huella del cuerpo (FNV-1a de 64 bits sobre el JSON con las llaves ordenadas), y lo mismo el destino si no viene urn. La hora sale del `payload` (`modifiedTime`, `updatedAt`, `createdTime` o `createdAt`), nunca de `hook.createdDate`, que es cuándo se creó el hook: sin hora en el payload, `occurredAt` queda en `null`. El mismo aviso da la misma llave, y el receptor guarda las llaves vistas en `autodesk_events`.
- **La firma.** Autodesk firma el cuerpo con el secreto que se registra al crear el webhook: `x-adsk-signature: sha1hash=<HMAC-SHA1 del cuerpo crudo>`. `verifyApsWebhook(cuerpo, cabecera, secreto)` lo compara en tiempo constante. Se verifica el cuerpo crudo, tal como llegó, no el JSON que arma Nest.
- **El detalle.** `toElementChanges(diferencias)` lee cada `ElementDifference` de AEC Data Model con su clave (el parámetro «Clave obra»), su categoría, su nivel y sus propiedades cambiadas. `toMinuteChanges(cambios, conteos?)` arma los cambios de la minuta: convierte metros, centímetros, milímetros, pies y pulgadas (también desde el texto, como «150 mm»), redondea como la API (cm con un decimal, m con dos), y si los elementos de una clave no coinciden vale el valor que más se repite.
- **Lo que no entra** vuelve en `ignored` con su motivo: `no_subject` (el elemento no está vinculado a la obra), `untracked_attribute` (cambió algo que la obra no sigue), `unknown_unit` (la unidad no se reconoce) y `no_revit_id` (el elemento no trae su id de Revit).
- **La minuta.** Lleva `trigger: "sync"`, `model.saveNumber: null` y la versión en `model.versionGuid`. `minuteIdFor(modelo, desde, hasta)` da un UUID estable para el modelo y las dos versiones, para que reintentar no duplique la revisión. Hoy no tiene a dónde ir: la API no recibe minutas, y la puerta de la obra es `POST /api/projects/:projectId/revisions`.

## El receptor

`POST /api/integrations/autodesk/webhooks` no pide cuenta: lo que vale es la firma. Responde:

| Caso                                                                   | Respuesta                                                                          |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| El cuerpo llega como `application/json` pero no es JSON válido         | 400 de Nest (`Bad Request`, sin `code`), antes de mirar la firma                   |
| La API no tiene `APS_WEBHOOK_SECRET`                                   | 503 `autodesk_webhooks_off`. El log lo dice una vez, con el primer aviso que llega |
| Falta `x-adsk-signature`, o no calza con el HMAC-SHA1 del cuerpo crudo | 403 `invalid_signature`                                                            |
| La firma calza, pero `parseAutodeskWebhook` rechaza el cuerpo          | 400 `invalid_webhook`, con el motivo                                               |
| Un aviso nuevo                                                         | 204: se guarda y se avisa                                                          |
| Un repetido (la misma `dedupeKey`)                                     | 204, sin guardar ni avisar de nuevo, para que Autodesk deje de reintentar          |

- **El cuerpo crudo.** La API se crea con `rawBody` de Nest (`APP_OPTIONS` en `apps/api/src/app.setup.ts`, que también usan los tests), así que la firma se calcula sobre los bytes que llegaron. Autodesk manda `application/json`; un cuerpo con otro tipo llega vacío y no pasa la firma. El parser JSON de Nest corre antes que el controlador, así que un JSON roto se rechaza con 400 sin llegar a la firma.
- **El caso de uso.** `ReceiveAutodeskEvent` traduce el cuerpo, guarda la llave con `AutodeskEventRepository.recordIfNew` y, solo si era nueva, le pasa el `AutodeskChange` al `AutodeskChangeListener`. En la API, `PrismaAutodeskEventRepository` inserta la fila con `createMany` y `skipDuplicates` sobre `dedupe_key`, que es única: dos reintentos a la par guardan uno.
- **El aviso.** Hoy el listener es `LoggingAutodeskListener`, que deja una línea en el log `Conectores`, como `Autodesk: version.added «Muro.rvt» (v3) por <usuario de Autodesk> en <proyecto> / <carpeta>; el diff por elemento queda pendiente`. La última parte sale solo con `needsElementDiff`, y un evento fuera del catálogo sale con su nombre original y «(sin clasificar)».
- **El secreto.** `APS_WEBHOOK_SECRET` es el que se registra en Autodesk con `POST /webhooks/v1/tokens` (`PUT /webhooks/v1/tokens/@me` para cambiarlo), con un token de la app (2-legged) para los webhooks de la app o de la cuenta (3-legged) para los de esa persona. En Render lo genera el Blueprint ([despliegue](../despliegue.md)).

## Lo que falta

1. **Registrar los webhooks** en Autodesk para cada carpeta de proyecto vinculada (`POST /webhooks/v1/systems/{sistema}/events/{evento}/hooks`, con la carpeta en `scope`), con la cuenta de Autodesk de la organización ([PH-25](https://linear.app/ph-team-27/issue/PH-25/conexion-oauth-con-autodesk-aps)) y la URL `https://vigente-api.onrender.com/api/integrations/autodesk/webhooks`.
2. **Encolar el diff.** Un `AutodeskChangeListener` que, para los cambios con `needsElementDiff`, encole la consulta a AEC Data Model. Hoy la llave se guarda antes de avisar al listener: si el listener falla, la API responde 500 y el reintento de Autodesk llega como repetido. El encolado tiene que quedar en la misma transacción que la llave (la outbox de la tarea 10).
3. **La consulta a AEC Data Model** para los cambios con `needsElementDiff`: esperar `elementGroupExtractionStatus` en `SUCCESS` y pedir `diffElementGroupByVersionWithLatest` desde la última versión procesada, con todas las páginas ([AEC Data Model](#dentro-de-un-modelo-aec-data-model)).
4. **Entregar la minuta a la obra.** Convertir cada cambio en un fragmento `parametro` con su hecho y mandarlo como revisión del documento del modelo a `POST /api/projects/:projectId/revisions`, o volver a tener en la API una ruta que reciba minutas.
5. **Probar con un hub real.** La cuenta de Autodesk de la UC de Carter tiene licencias: si trae un hub de ACC con AEC Data Model, ahí se confirman los nombres de las propiedades, las unidades y los eventos de ACC.

# Los cambios en Autodesk

Qué puede cambiar en la plataforma de Autodesk que apunta Vigente (Autodesk Construction Cloud y Autodesk Docs, con modelos de Revit), por dónde se entera Vigente de cada cambio y cómo lo traduce. La issue es [PH-49](https://linear.app/ph-team-27/issue/PH-49/detectar-los-cambios-en-autodesk-catalogo-de-eventos-y-diff-por). Se apoya en el spike de AEC Data Model ([PH-28](https://linear.app/ph-team-27/issue/PH-28/spike-diff-de-versiones-con-aec-data-model)) y deja lista la parte de dominio que usa el receptor de webhooks ([PH-27](https://linear.app/ph-team-27/issue/PH-27/receptor-de-webhooks-de-aps)).

**Estado:** el dominio y la firma están construidos en [`context/integrations`](../../context/integrations/README.md#autodesk), con tests sin red. Falta la ruta que recibe los webhooks, registrar los webhooks en Autodesk, la consulta a AEC Data Model y probar todo contra un hub real de ACC.

## Las dos capas

Autodesk avisa en dos niveles, y Vigente necesita los dos:

1. **El aviso** (qué pasó y dónde): un webhook de APS dice que hay una versión nueva, que alguien bloqueó un archivo, que se movió una carpeta o que cambió una incidencia. Llega solo, pero no dice qué cambió dentro del modelo.
2. **El detalle** (qué elementos y qué valores): para un modelo, AEC Data Model compara la versión nueva con la última que procesamos y entrega cada elemento agregado, modificado o quitado, con el valor anterior y el nuevo de cada propiedad.

`parseAutodeskWebhook` hace la primera capa y marca con `needsElementDiff` los avisos que piden la segunda. `toElementChanges` y `toMinuteChanges` hacen la segunda y terminan en la misma minuta que manda el add-in de Revit, así que la cadena de la obra no cambia.

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

Las propiedades que siguen la obra son las del add-in: «Thickness», «Default Thickness», «Espesor», «Grosor» y «Grosor por defecto» van a `espesor_cm`; «Width», «Ancho» y «Anchura» a `ancho_cm`; «Height», «Alto» y «Altura» a `alto_cm`; y «Distancia eje A», «Distancia al eje A», «Posición» y «Posicion» a `posicion_m`. `cantidad` sale de contar los elementos de cada clave en las dos versiones (`countBySubject`), porque el diff solo trae lo que cambió.

## Cómo se traduce

- **El aviso.** `parseAutodeskWebhook(cuerpo)` lee `hook.event`, `hook.system` y el `payload`, y devuelve un `AutodeskChange`: `kind`, `source`, el recurso (urn, linaje, nombre, extensión, versión, carpeta y proyecto), la hora, quién lo hizo y `needsElementDiff`. Un archivo `.rvt`, `.nwd`, `.nwc` o `.ifc` es un modelo; un PDF o una planilla es un archivo. Lanza `AutodeskEventError` si el cuerpo no es un webhook.
- **Los repetidos.** Autodesk reintenta un webhook si no respondemos a tiempo. `dedupeKey` es el evento, el linaje (o el urn) y la versión (o la hora): el mismo aviso da la misma llave, y el receptor guarda las llaves vistas en una tabla (PH-27).
- **La firma.** Autodesk firma el cuerpo con el secreto que se registra al crear el webhook: `x-adsk-signature: sha1hash=<HMAC-SHA1 del cuerpo crudo>`. `verifyApsWebhook(cuerpo, cabecera, secreto)` lo compara en tiempo constante. Hay que verificar el cuerpo crudo, antes de que Nest lo convierta en JSON.
- **El detalle.** `toElementChanges(diferencias)` lee cada `ElementDifference` de AEC Data Model con su clave (el parámetro «Clave obra»), su categoría, su nivel y sus propiedades cambiadas. `toMinuteChanges(cambios, conteos?)` arma los cambios de la minuta: convierte metros, centímetros, milímetros, pies y pulgadas (también desde el texto, como «150 mm»), redondea como la API (cm con un decimal, m con dos), y si los elementos de una clave no coinciden vale el valor que más se repite.
- **Lo que no entra** vuelve en `ignored` con su motivo: `sin_clave` (el elemento no está vinculado a la obra), `sin_atributo_seguido` (cambió algo que la obra no sigue), `unidad_desconocida` y `sin_identificador_revit`.
- **La minuta.** Va a `POST /api/integrations/revit/minutes` con `trigger: "sync"`, `model.saveNumber: null` y la versión en `model.versionGuid`. `minuteIdFor(modelo, desde, hasta)` da un UUID estable para el modelo y las dos versiones: reintentar no duplica la revisión.

## Lo que falta

1. **El receptor** (PH-27): una ruta de Nest que lea el cuerpo crudo, verifique la firma, descarte los repetidos con una tabla y encole el cambio.
2. **Registrar los webhooks** en Autodesk para cada carpeta de proyecto vinculada (`POST /webhooks/v1/systems/{sistema}/events/{evento}/hooks`), con la cuenta de Autodesk de la organización ([PH-25](https://linear.app/ph-team-27/issue/PH-25/conexion-oauth-con-autodesk-aps)) y una URL pública.
3. **La consulta a AEC Data Model** para los cambios con `needsElementDiff`: esperar `elementGroupExtractionStatus` en `SUCCESS` y pedir `diffElementGroupByVersionWithLatest` desde la última versión procesada, con todas las páginas (el spike de PH-28, `docs/spec/aec-data-model.md` en su rama).
4. **Probar con un hub real.** La cuenta de Autodesk de la UC de Carter tiene licencias: si trae un hub de ACC con AEC Data Model, ahí se confirman los nombres de las propiedades, las unidades y los eventos de ACC.

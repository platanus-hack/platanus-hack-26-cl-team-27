# Spike: el diff de versiones con AEC Data Model

La tarea 7 del plan ([PH-28](https://linear.app/ph-team-27/issue/PH-28/spike-diff-de-versiones-con-aec-data-model)). Hoy ninguna pieza de Vigente lee el modelo de Revit: el lago sabe comparar dos versiones de un modelo (`diffSnapshots` y `DetectChanges`), pero nadie le entrega esas versiones. La pregunta es si ACC, con la [AEC Data Model API](https://aps.autodesk.com/en/docs/aecdatamodel/v1/developers_guide/overview/), puede entregar el diff por elemento desde la nube, sin instalar nada en el PC.

## La respuesta

**Sí, con límites.** AEC Data Model trae un diff por elemento y por propiedad (`diffElementGroupByVersionWithLatest`), con el valor anterior y el nuevo. Alcanza para la losa N3 de 15 a 20 cm, con estos límites:

| Límite                                                                                                                                                       | Qué significa para Vigente                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **El modelo tiene que estar en un hub de ACC** (hoy Forma Data Management), con AEC Data Model activado por un administrador de la cuenta. No viene activado | Los modelos tienen que vivir en un proyecto de ACC: un archivo suelto no tiene diff                                                                                                                   |
| **Revit 2024 o posterior**                                                                                                                                   | Un modelo en una versión anterior no entrega diff                                                                                                                                                     |
| **Solo ve versiones**: las publicadas o, con la sincronización activa, las de trabajo (`WIP`) de la línea de tiempo del documento                            | Un guardado local no es una versión. El diff llega cuando alguien sincroniza o publica el modelo en la nube, no en cada Ctrl+S                                                                        |
| **El diff compara una versión con la última**, no dos versiones cualquiera                                                                                   | Sirve para ir de la última que procesamos a la actual. Si entre tanto hubo dos versiones, llegan juntas en un solo diff. Para comparar dos versiones exactas, hay que leer las dos y compararlas aquí |
| **Tiene que pedirlo una persona**: token de tres patas, nunca de dos                                                                                         | Usa la conexión de Autodesk de la organización ([PH-25](https://linear.app/ph-team-27/issue/PH-25/conexion-oauth-con-autodesk-aps)), y esa cuenta tiene que ver el proyecto en ACC                    |
| **No entrega geometría**                                                                                                                                     | `espesor_cm`, `ancho_cm` y `alto_cm` salen de parámetros. `posicion_m` solo sale si hay un parámetro «Distancia eje A»: la nube no puede calcularlo desde la geometría                                |
| **Se entera tarde y sin aviso propio**: hay que esperar a que AEC Data Model extraiga la versión                                                             | El gatillo es un webhook de Data Management o una consulta periódica, más esperar `elementGroupExtractionStatus` en `SUCCESS`                                                                         |

**Recomendación:** AEC Data Model es el camino para leer el modelo sin instalar nada en el PC: un conector que arma el diff de cada versión y lo manda como una revisión del documento del modelo por la puerta de siempre (`POST /api/projects/:projectId/revisions`), de modo que la cadena no cambia. Avisar en cada guardado local, sin depender de un hub de ACC, pediría un add-in instalado en Revit, que hoy no existe.

## Cómo se ve en la API de Autodesk

- **Endpoint:** `POST https://developer.api.autodesk.com/aec/graphql`, con la cabecera `Region` (`US` por defecto, `EMEA`, `AUS` y otras) y un token de tres patas. La página del endpoint lista los permisos `data:create data:read data:write`. La conexión de PH-25 pide `data:read account:read user-profile:read`: hay que confirmarlo con la primera consulta real y, si no alcanza, sumar los permisos que falten.
- **El modelo es un `ElementGroup`.** `elementGroupAtTip` da la última versión y `elementGroupByVersionNumber(elementGroupId, versionNumber)` una en particular. `versionHistory { tipVersion, versions }` lista las versiones. Cada `ElementGroupVersion` trae `versionNumber` (la publicada), `wipVersionNumber` (la de trabajo, nula sin sincronización) y `createdOn`. `versionFilter: { versionType: WIP | PUBLISHED }` elige la línea; por defecto es `PUBLISHED`.
- **Los elementos de una versión:** `elementsByElementGroupAtVersion(elementGroupId, versionNumber, filter, pagination)`. Cada `Element` trae `id`, `name`, `properties { name, displayValue, value, definition { units } }`, `references` (por ejemplo su tipo) y `alternativeIdentifiers { externalElementId, revitElementId }`.
- **El filtro** va en `filter.query`, en sintaxis RSQL: `property.name.category==Floors`, `'property.name.Clave obra'==losa-n3` (con comillas simples porque el nombre tiene un espacio), `and`, `or` y paréntesis. Un filtro por nombre de propiedad se expande a ids: hasta 100 por modelo.
- **El diff:** `diffElementGroupByVersionWithLatest(elementGroupId, startVersion, versionFilter, changeFilter, pagination)` devuelve `result: [ElementDifference]`. Cada uno trae `type` (`ADDITION`, `MODIFICATION` o `REMOVAL`), el `element` y `differences.results: [PropertyDifference]`, con `item` (la propiedad en la última versión) y `oldItem` (en `startVersion`). `diffElementByVersionWithLatest(elementId, startElementGroupVersion)` hace lo mismo para un solo elemento.
- **La extracción:** `elementGroupExtractionStatus(fileUrn, versionNumber)` dice `IN_PROGRESS`, `FAILED` o `SUCCESS`.

## El ejemplo: la losa N3 de 15 a 20 cm

En el modelo de arquitectura, Fernanda cambia el tipo de la losa del nivel 3 de «Losa H30 15 cm» a «Losa H30 20 cm» y sincroniza. AEC Data Model crea la versión 8 del modelo. Vigente había procesado la 7.

**1. La consulta.** El diff desde la versión 7 hasta la última, solo de lo modificado, y solo de las losas vinculadas a la obra:

```graphql
query LosaN3($modelo: ID!, $desde: Int!) {
  diffElementGroupByVersionWithLatest(elementGroupId: $modelo, startVersion: $desde, changeFilter: [MODIFICATION, ADDITION, REMOVAL], pagination: { limit: 100 }) {
    result {
      type
      element {
        id
        name
        alternativeIdentifiers {
          externalElementId
          revitElementId
        }
        properties(filter: { names: ["Clave obra", "Category"] }) {
          results {
            name
            displayValue
          }
        }
      }
      differences {
        results {
          type
          oldItem {
            name
            value
            displayValue
            definition {
              units {
                name
              }
            }
          }
          item {
            name
            value
            displayValue
            definition {
              units {
                name
              }
            }
          }
        }
      }
    }
    pagination {
      cursor
    }
  }
}
```

```json
{ "modelo": "<id del ElementGroup de LosAromos_ARQ>", "desde": 7 }
```

**2. La respuesta esperada.** Esta respuesta sigue el schema publicado, pero no viene de un modelo real (ver [lo que falta comprobar](#lo-que-falta-comprobar)). Los valores y las unidades son ilustrativos:

```json
{
  "data": {
    "diffElementGroupByVersionWithLatest": {
      "result": [
        {
          "type": "MODIFICATION",
          "element": {
            "id": "<id del elemento>",
            "name": "Losa H30 20 cm",
            "alternativeIdentifiers": {
              "externalElementId": "8d2f6a1c-5b3e-4c7a-9f0d-1e2b3c4d5e6f-0004c488",
              "revitElementId": "312456"
            },
            "properties": {
              "results": [
                { "name": "Clave obra", "displayValue": "losa-n3" },
                { "name": "Category", "displayValue": "Floors" }
              ]
            }
          },
          "differences": {
            "results": [
              {
                "type": "MODIFICATION",
                "oldItem": { "name": "Thickness", "value": 0.15, "displayValue": "150 mm", "definition": { "units": { "name": "Meters" } } },
                "item": { "name": "Thickness", "value": 0.2, "displayValue": "200 mm", "definition": { "units": { "name": "Meters" } } }
              },
              {
                "type": "MODIFICATION",
                "oldItem": { "name": "Type Name", "value": "Losa H30 15 cm" },
                "item": { "name": "Type Name", "value": "Losa H30 20 cm" }
              }
            ]
          }
        }
      ],
      "pagination": { "cursor": null }
    }
  }
}
```

**3. La revisión que sale.** El conector toma solo los elementos con «Clave obra», pasa la propiedad de Revit al atributo de la obra («Thickness» a `espesor_cm`, «Width» a `ancho_cm`, «Height» a `alto_cm`), convierte la unidad y redondea (cm con un decimal). Cada valor que cambia es un fragmento `parametro` con su hecho:

```json
{
  "locator": "Losa H30 20 cm · 8d2f6a1c-5b3e-4c7a-9f0d-1e2b3c4d5e6f-0004c488",
  "kind": "parametro",
  "claims": [
    {
      "subject": "losa-n3",
      "attribute": "espesor_cm",
      "value": 20,
      "unit": "cm",
      "role": "afirma"
    }
  ]
}
```

La revisión va al documento del modelo del proyecto, con la versión del modelo como rótulo y el link a esa versión en ACC como `pointer`. La propuesta, los avisos, el costo y el plazo salen de la misma cadena que cualquier otra revisión.

## Cómo sería el conector

1. **El gatillo.** Un webhook de Data Management por versión nueva del archivo, o, sin URL pública, una consulta cada pocos minutos a `versionHistory { tipVersion }` de cada modelo vinculado.
2. **Esperar la extracción.** `elementGroupExtractionStatus` hasta `SUCCESS`; con `FAILED`, se anota el error en el modelo vinculado y no se avanza.
3. **El diff.** `diffElementGroupByVersionWithLatest` desde la última versión procesada, con todas las páginas. Se guarda la versión procesada junto al modelo vinculado, como hoy el hash de una planilla en [`integrations`](../../context/integrations/README.md).
4. **La revisión.** Se filtra por «Clave obra», se arma un fragmento `parametro` por valor que cambia y se manda a `POST /api/projects/:projectId/revisions`. `cantidad` se calcula contando los elementos de cada clave en la versión nueva (`elementsByElementGroupAtVersion`), porque el diff solo trae lo que cambió. El rótulo sale de la versión, así reintentar no duplica la revisión (`409 already_ingested`).

Es el mismo canal de conexión y escucha que el de Google Sheets: el contexto `integrations` gana un proveedor, la cuenta es la de Autodesk de la organización y lo que se vincula es un modelo de un proyecto de ACC.

## Lo que falta comprobar

No tenemos un hub de ACC con AEC Data Model activado: la respuesta del ejemplo sale del schema publicado, no de un modelo real. Con un hub, en media hora con el [explorador de AEC Data Model](https://aps.autodesk.com/en/docs/aecdatamodel/v1/tutorials/) se confirma:

1. **Que el espesor de la losa sale como propiedad del elemento.** En Revit, «Grosor» del ejemplar es de solo lectura y «Grosor por defecto» es del tipo. Si el ejemplar no lo trae, se lee del tipo por `references` y el cambio de tipo aparece como un cambio de la referencia. Se ve con `propertyDefinitionsByElementGroup`.
2. **Que un parámetro compartido de texto como «Clave obra» se extrae** y se puede filtrar.
3. **Que el id del elemento es estable entre versiones** y si `externalElementId` es el `UniqueId` de Revit, para cruzarlo con el `externalId` del visor.
4. **Los permisos** que pide el endpoint, frente a los que pide la conexión de PH-25.
5. **Cuánto tarda** la versión en aparecer después de sincronizar, y si las versiones `WIP` dan un diff por sincronización.
6. **Los límites de consultas** de la API: la documentación no los publica.

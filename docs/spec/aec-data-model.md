# Spike: el diff de versiones con AEC Data Model

La tarea 7 del plan ([PH-28](https://linear.app/ph-team-27/issue/PH-28/spike-diff-de-versiones-con-aec-data-model)). Hoy el cambio por elemento lo arma el add-in de Revit: compara cada guardado con el anterior ([`ChangeTracker.cs`](../../tool-use-case/revit/src/Team27.Minuta.Revit/ChangeTracker.cs)) y manda la [minuta](../../tool-use-case/revit/README.md#la-minuta). La pregunta es si ACC, con la [AEC Data Model API](https://aps.autodesk.com/en/docs/aecdatamodel/v1/developers_guide/overview/), puede entregar el mismo diff desde la nube, sin instalar nada en el PC.

## La respuesta

**Sí, con límites.** AEC Data Model trae un diff por elemento y por propiedad (`diffElementGroupByVersionWithLatest`), con el valor anterior y el nuevo. Alcanza para la losa N3 de 15 a 20 cm, pero no reemplaza al add-in en la muestra:

| Límite                                                                                                                                                       | Qué significa para Vigente                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **El modelo tiene que estar en un hub de ACC** (hoy Forma Data Management), con AEC Data Model activado por un administrador de la cuenta. No viene activado | Los modelos de la muestra viven en un bucket de OSS ([`apps/aps`](../../apps/aps/README.md)), no en un hub. No sirven tal cual: hay que subirlos a un proyecto de ACC                                 |
| **Revit 2024 o posterior**                                                                                                                                   | El add-in ya pide 2025 o posterior                                                                                                                                                                    |
| **Solo ve versiones**: las publicadas o, con la sincronización activa, las de trabajo (`WIP`) de la línea de tiempo del documento                            | Un guardado local no es una versión. El diff llega cuando alguien sincroniza o publica el modelo en la nube, no en cada Ctrl+S                                                                        |
| **El diff compara una versión con la última**, no dos versiones cualquiera                                                                                   | Sirve para ir de la última que procesamos a la actual. Si entre tanto hubo dos versiones, llegan juntas en un solo diff. Para comparar dos versiones exactas, hay que leer las dos y compararlas aquí |
| **Tiene que pedirlo una persona**: token de tres patas, nunca de dos                                                                                         | Usa la conexión de Autodesk de la organización ([PH-25](https://linear.app/ph-team-27/issue/PH-25/conexion-oauth-con-autodesk-aps)), y esa cuenta tiene que ver el proyecto en ACC                    |
| **No entrega geometría**                                                                                                                                     | `espesor_cm`, `ancho_cm` y `alto_cm` salen de parámetros. `posicion_m` solo sale si hay un parámetro «Distancia eje A»: el add-in lo calcula desde la geometría cuando falta, y la nube no puede      |
| **Se entera tarde y sin aviso propio**: hay que esperar a que AEC Data Model extraiga la versión                                                             | El gatillo es un webhook de Data Management o una consulta periódica, más esperar `elementGroupExtractionStatus` en `SUCCESS`                                                                         |

**Recomendación:** el add-in sigue siendo la fuente para la muestra, porque avisa en cada guardado y no depende de un hub de ACC. AEC Data Model es el camino para un cliente que ya trabaja en ACC y no quiere instalar nada: un segundo conector que arma la misma minuta y la manda a la misma puerta (`POST /api/integrations/revit/minutes`), de modo que la cadena no cambia.

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

**3. La minuta que sale.** El conector toma solo los elementos con «Clave obra», pasa la propiedad de Revit al atributo de la obra con la misma tabla del add-in («Thickness» a `espesor_cm`, «Width» a `ancho_cm`, «Height» a `alto_cm`), convierte la unidad y redondea igual (cm con un decimal). El resultado es el mismo cambio que hoy manda el add-in en [`minuta.example.json`](../../tool-use-case/revit/contract/minuta.example.json):

```json
{
  "subjectId": "losa-n3",
  "attribute": "espesor_cm",
  "before": 15,
  "after": 20,
  "unit": "cm",
  "elements": [
    {
      "id": 312456,
      "uniqueId": "8d2f6a1c-5b3e-4c7a-9f0d-1e2b3c4d5e6f-0004c488",
      "category": "Suelos",
      "name": "Losa H30 20 cm",
      "level": "Nivel 3"
    }
  ]
}
```

La minuta va con `trigger: "sync"`, `model.saveNumber: null` (en la nube no hay número de guardado) y la versión del modelo en `model.versionGuid`. La API la rotula `minuta <8 primeros del minuteId>`, como «Publicar estado», y el contrato de [`contract/`](../../tool-use-case/revit/contract/) no cambia. La propuesta, los avisos, el costo y el plazo salen iguales que con el add-in.

## Cómo sería el conector

1. **El gatillo.** Un webhook de Data Management por versión nueva del archivo, o, sin URL pública, una consulta cada pocos minutos a `versionHistory { tipVersion }` de cada modelo vinculado.
2. **Esperar la extracción.** `elementGroupExtractionStatus` hasta `SUCCESS`; con `FAILED`, se anota el error en el modelo vinculado y no se avanza.
3. **El diff.** `diffElementGroupByVersionWithLatest` desde la última versión procesada, con todas las páginas. Se guarda la versión procesada junto al modelo vinculado, como hoy el hash de una planilla en [`integrations`](../../context/integrations/README.md).
4. **La minuta.** Se filtra por «Clave obra», se arma con la tabla de atributos del add-in y se manda a `POST /api/integrations/revit/minutes`. `cantidad` se calcula contando los elementos de cada clave en la versión nueva (`elementsByElementGroupAtVersion`), porque el diff solo trae lo que cambió. El `minuteId` sale del modelo y las dos versiones, así reintentar no duplica la revisión.

Es el mismo canal de conexión y escucha que el de Google Sheets: el contexto `integrations` gana un proveedor, la cuenta es la de Autodesk de la organización y lo que se vincula es un modelo de un proyecto de ACC.

## Lo que falta comprobar

No tenemos un hub de ACC con AEC Data Model activado: la respuesta del ejemplo sale del schema publicado, no de un modelo real. Con un hub, en media hora con el [explorador de AEC Data Model](https://aps.autodesk.com/en/docs/aecdatamodel/v1/tutorials/) se confirma:

1. **Que el espesor de la losa sale como propiedad del elemento.** En Revit, «Grosor» del ejemplar es de solo lectura y «Grosor por defecto» es del tipo. Si el ejemplar no lo trae, se lee del tipo por `references` y el cambio de tipo aparece como un cambio de la referencia. Se ve con `propertyDefinitionsByElementGroup`.
2. **Que un parámetro compartido de texto como «Clave obra» se extrae** y se puede filtrar.
3. **Que el id del elemento es estable entre versiones** y si `externalElementId` es el `UniqueId` de Revit, para cruzarlo con la minuta del add-in.
4. **Los permisos** que pide el endpoint, frente a los que pide la conexión de PH-25.
5. **Cuánto tarda** la versión en aparecer después de sincronizar, y si las versiones `WIP` dan un diff por sincronización.
6. **Los límites de consultas** de la API: la documentación no los publica.

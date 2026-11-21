# @team27/context-capture

Detecta qué cambió entre dos estados de los elementos del proyecto. Quien lo llama entrega una base y un siguiente; `DetectChanges` los compara y guarda un `Change` por elemento, con la revisión de origen (`sourceId`) que lo provocó.

## Dominio

- **`ModelElement`:** un elemento del modelo, con `id` estable, `category` (`losa`, `shaft`, `ventana`…) y propiedades `{ key, label, value, unit, editable }`.
- **`diffSnapshots(base, siguiente, sourceId)`:** compara por `id`. Un elemento puede ser `added`, `removed` o `modified`; si es `modified`, solo entran las propiedades cuyo valor cambió. Cada cambio trae `before` y `after` completos (clave → valor) y un `summary` legible, por ejemplo `Espesor: 15 cm → 20 cm`, con coma decimal.
- **`Change`:** el elemento, el tipo, el resumen, las diferencias, el antes y el después, y `sourceId`.

## Casos de uso

| Caso de uso     | Qué hace                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `DetectChanges` | `{ sourceId, base, next }`: compara, guarda un cambio por elemento y los devuelve. Si nada cambió no guarda. Rechaza ids repetidos y un `sourceId` vacío (`ValidationError`) |
| `ListChanges`   | Los cambios más recientes primero, hasta `MAX_CHANGES` (50)                                                                           |
| `GetChange`     | Un cambio por id, o `null`                                                                                                            |

## Adapters

`PrismaChangeRepository`, sobre la tabla `changes` de [`data/main`](../../data/main/README.md). Las diferencias y los valores se guardan como JSON; `source_id` es el id de la revisión de origen, sin llave foránea.

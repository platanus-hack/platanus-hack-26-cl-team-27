# @team27/context-capture

Captura los cambios del software de origen sin que nadie los reporte. Cada publicación del modelo es una versión (`Snapshot`); `PublishVersion` la compara con la anterior y guarda un `Change` por elemento que cambió.

## Dominio

- **`ModelElement`:** un elemento del modelo, con `id` estable, `category` (`losa`, `shaft`, `ventana`…) y propiedades `{ key, label, value, unit, editable }`.
- **`diffSnapshots(anterior, nueva)`:** compara por `id`. Un elemento puede ser `added`, `removed` o `modified`; si es `modified`, solo entran las propiedades cuyo valor cambió. Cada cambio trae `before` y `after` completos (clave → valor) y un `summary` legible, por ejemplo `Espesor: 15 cm → 20 cm`, con coma decimal.

## Casos de uso

| Caso de uso         | Qué hace                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `PublishVersion`    | La primera versión es la base y no genera cambios. Si nada cambió, no crea versión. Rechaza ids repetidos (`ValidationError`) |
| `GetLatestSnapshot` | La última versión de una integración, o `null`                                                                            |
| `ListChanges`       | Los cambios más recientes primero, hasta `MAX_CHANGES` (50)                                                               |
| `GetChange`         | Un cambio por id, o `null`                                                                                                |

## Adapters

`PrismaSnapshotRepository` y `PrismaChangeRepository`, sobre las tablas `snapshots` y `changes` de [`data/main`](../../data/main/README.md). Los elementos, las diferencias y los valores se guardan como JSON.

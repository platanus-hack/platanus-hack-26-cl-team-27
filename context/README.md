# context/

Aquí vive el dominio: un bounded context hexagonal por carpeta (`context/<ctx>`, paquete `@team27/context-<ctx>`).

| Contexto                                | Qué hace                                                              |
| --------------------------------------- | --------------------------------------------------------------------- |
| [`capture`](capture/README.md)          | Versiones del modelo y los cambios entre ellas                        |
| [`impact`](impact/README.md)            | Quién se ve afectado por un cambio, con su costo y su plazo           |
| [`notification`](notification/README.md) | Un aviso por afectado, en su canal, y su respuesta                  |

Cómo se encadenan: [coordinación de un cambio](../docs/arquitectura.md#coordinación-de-un-cambio). Las capas, las reglas y el comando para crear uno: [contextos hexagonales](../docs/arquitectura.md#contextos-hexagonales).

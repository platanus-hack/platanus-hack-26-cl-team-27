# context/

Aquí vive el dominio: un bounded context hexagonal por carpeta (`context/<ctx>`, paquete `@team27/context-<ctx>`).

| Contexto                                | Qué hace                                                              |
| --------------------------------------- | --------------------------------------------------------------------- |
| [`lake`](lake/README.md)                | El lago de hechos con procedencia, lo vigente y el consenso           |
| [`capture`](capture/README.md)          | Los cambios entre una base y un siguiente estado de un elemento       |
| [`impact`](impact/README.md)            | Quién se ve afectado por un cambio, con su costo y su plazo           |
| [`notification`](notification/README.md) | Un aviso por afectado, en su canal, y su respuesta                  |
| [`inference`](inference/README.md)      | La probabilidad de que alguien más esté afectado (Jev) y la lectura de mensajes y planos (Claude) |

Cómo se encadenan: [coordinación de un cambio](../docs/arquitectura.md#coordinación-de-un-cambio). Las capas, las reglas y el comando para crear uno: [contextos hexagonales](../docs/arquitectura.md#contextos-hexagonales).

# context/

Aquí vive el dominio: un bounded context hexagonal por carpeta (`context/<ctx>`, paquete `@team27/context-<ctx>`).

| Contexto                                 | Qué hace                                                                                                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`lake`](lake/README.md)                 | El lago de hechos con procedencia, lo vigente, el consenso y el cambio por elemento                                                                               |
| [`impact`](impact/README.md)             | Quién se ve afectado por un cambio, con su costo y su plazo (reglas), la probabilidad de que alguien más lo esté (Jev) y la lectura de mensajes y planos (Claude) |
| [`notification`](notification/README.md) | Un aviso por afectado, en su canal, y su respuesta                                                                                                                |
| [`integrations`](integrations/README.md) | Los conectores reales: conecta la cuenta de Google, vincula planillas y escucha cuándo cambian |

Cómo se encadenan: [coordinación de un cambio](../docs/arquitectura.md#coordinación-de-un-cambio). Las capas, las reglas y el comando para crear uno: [contextos hexagonales](../docs/arquitectura.md#contextos-hexagonales).

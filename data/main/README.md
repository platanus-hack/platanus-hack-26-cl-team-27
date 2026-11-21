# @team27/data-main

Prisma 7 sobre PostgreSQL 18. Contiene el schema (`prisma/schema.prisma`), las migraciones (`prisma/migrations`) y el cliente generado en `generated/`, que no se versiona ni se edita. El único código propio es `index.ts`, que exporta el cliente generado y `createPrismaClient(url)`.

## Modelos

| Modelo (tabla)                  | Contexto       | Qué guarda                                                                          |
| ------------------------------- | -------------- | ----------------------------------------------------------------------------------- |
| `Change` (`changes`)            | `capture`      | Un cambio por elemento entre una base y un siguiente: la revisión de origen (`source_id`), tipo, resumen, diferencias, antes y después |
| `Impact` (`impacts`)            | `impact`       | El impacto de un cambio: costo y atraso en columnas, el resto del detalle en JSON   |
| `Notification` (`notifications`) | `notification` | Un aviso por afectado y cambio, con sus hallazgos en JSON y la respuesta del afectado |
| `Revision` (`revisions`) | `lake` | Cada versión de un documento, inmutable: espacio, autor, tipo, hash, puntero al origen y orden de ingesta. Única por documento y etiqueta |
| `Chunk` (`chunks`) | `lake` | Un fragmento de una revisión (fila, anotación, acuerdo, mensaje, parámetro o texto), con su posición, localizador, el texto si es libre y lo rechazado por la inferencia en JSON |
| `Claim` (`claims`) | `lake` | Un hecho de una revisión: sujeto, atributo, valor en JSON, unidad, rol (`afirma` o `usa`), localizador, su fragmento (`chunk_id`) y la confianza si la leyó un modelo |
| `BaselineEntry` (`baseline_entries`) | `lake` | Lo vigente de cada sujeto y atributo, con el hecho, la revisión y la propuesta que lo respaldan. Clave compuesta |
| `BaselineHistory` (`baseline_history`) | `lake` | Los valores vigentes anteriores, con desde cuándo y hasta cuándo rigieron |
| `Proposal` (`proposals`) | `lake` | Una propuesta (el PR) por revisión con autoridad: el documento, los hunks en JSON (cada uno con su elemento y localizador), el contexto sin cambio, el cambio principal de `capture` y todos los de sus elementos (`change_ids`), los filtrados y su estado |
| `Review` (`reviews`) | `lake` | El voto de cada revisor de una propuesta: aprobar, disputar o pendiente, con nota y hora |
| `Discrepancy` (`discrepancies`) | `lake` | Un hecho sin autoridad que difiere de lo vigente, con su dueño y su estado (abierta, respaldada o descartada) |
| `Overlap` (`overlaps`) | `lake` | Un solapamiento: tipo (`mismo-elemento`, `misma-area` o `simultaneo`), área (nivel, celda y sistemas), los dos elementos, la propuesta y el fragmento que lo abrieron, quién respalda al otro elemento, los validadores y su estado (`abierto`, `confirmado`, `descartado` o `resuelto`, con la razón de la resolución) |
| `OverlapVote` (`overlap_votes`) | `lake` | El voto de cada validador de un solapamiento: `se_tocan` o `no_se_tocan`, con nota y hora. Único por solapamiento y validador |
| `Acknowledgement` (`acknowledgements`) | `lake` | La confirmación sin cambio de un documento desfasado, con su nota y la firma del desfase |
| `Seat` (`seats`) | API (sala) | Un asiento tomado: el hash SHA-256 del token y el último latido |
| `RoomEvent` (`room_events`) | API (sala) | Los eventos del ticker: `seq` autoincremental, época, tipo, mensaje en español y referencias |
| `RoomState` (`room_state`) | API (sala) | Una sola fila: la época |

- Cada tabla es de un solo contexto, salvo las de la sala, que son de la API. No hay llaves foráneas entre tablas de contextos distintos: los ids viajan como valores.
- Las tablas y columnas van en `snake_case` con `@@map` y `@map`; los modelos y campos, en `camelCase`.

## Comandos

```sh
cp .env.example .env                      # en la raíz: DATABASE_URL
pnpm db:up                                # Postgres de docker compose en :5427
pnpm --filter @team27/data-main migrate:dev -- --name <nombre>   # crea y aplica una migración desde el schema
pnpm db:migrate                           # aplica las migraciones pendientes (prisma migrate deploy)
pnpm db:studio                            # Prisma Studio
pnpm nx run @team27/data-main:generate    # el cliente; lo corren solas las tareas que dependen de él
```

- `prisma.config.ts` lee el `.env` de la raíz.
- `migrate dev` pide una terminal interactiva. Sin ella, genera el SQL con `pnpm --filter @team27/data-main exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` y guárdalo en `prisma/migrations/<timestamp>_<nombre>/migration.sql`.
- Una migración aplicada no se edita: se escribe otra.
- El `typecheck` de este paquete usa todo su directorio como input, schema incluido. El cliente generado no se versiona y Nx no lo ve, así que, sin el schema, la caché podría devolver los tipos de un cliente viejo.
- Lo que Prisma no modela (CHECK, triggers, roles) va en el SQL de la migración.

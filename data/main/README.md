# @team27/data-main

Prisma 7 sobre PostgreSQL 18. Contiene el schema (`prisma/schema.prisma`), las migraciones (`prisma/migrations`) y el cliente generado en `generated/`, que no se versiona ni se edita. El único código propio es `index.ts`, que exporta el cliente generado y `createPrismaClient(url)`.

## Modelos

| Modelo (tabla)                  | Contexto       | Qué guarda                                                                          |
| ------------------------------- | -------------- | ----------------------------------------------------------------------------------- |
| `Snapshot` (`snapshots`)        | `capture`      | Cada versión publicada del modelo, con sus elementos en JSON. Única por integración y número |
| `Change` (`changes`)            | `capture`      | Un cambio por elemento entre dos versiones: tipo, resumen, diferencias, antes y después |
| `Impact` (`impacts`)            | `impact`       | El impacto de un cambio: costo y atraso en columnas, el resto del detalle en JSON   |
| `Notification` (`notifications`) | `notification` | Un aviso por afectado y cambio, con sus hallazgos en JSON y la respuesta del afectado |

- Cada tabla es de un solo contexto. No hay llaves foráneas entre tablas de contextos distintos: los ids viajan como valores.
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

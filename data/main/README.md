# @team27/data-main

Prisma 7 sobre PostgreSQL 18. Contiene el schema (`prisma/schema.prisma`), las migraciones (`prisma/migrations`) y el cliente generado en `generated/`, que no se versiona ni se edita. El código propio es `index.ts` (el cliente generado y `createPrismaClient(url)`), `project/` (la definición de un proyecto y cómo se guarda y se lee) y `seed/` (la semilla de Los Aromos).

## Modelos

| Modelo (tabla)                  | Contexto       | Qué guarda                                                                          |
| ------------------------------- | -------------- | ----------------------------------------------------------------------------------- |
| `Change` (`changes`)            | `lake`         | Un cambio por elemento entre una base y un siguiente: la revisión de origen (`source_id`), tipo, resumen, diferencias, antes y después |
| `Impact` (`impacts`)            | `impact`       | El impacto de un cambio: costo y atraso en columnas, el resto del detalle en JSON   |
| `Notification` (`notifications`) | `notification` | Un aviso por afectado y cambio, con sus hallazgos en JSON y la respuesta del afectado |
| `Revision` (`revisions`) | `lake` | Cada versión de un documento, inmutable: espacio, autor, tipo, hash, puntero al origen y orden de ingesta. Única por documento y etiqueta |
| `Chunk` (`chunks`) | `lake` | Un fragmento de una revisión (fila, anotación, acuerdo, mensaje, parámetro o texto), con su posición, localizador, el texto si es libre y lo rechazado por la inferencia en JSON |
| `Claim` (`claims`) | `lake` | Un hecho de una revisión: sujeto, atributo, valor en JSON, unidad, rol (`afirma` o `usa`), localizador, su fragmento (`chunk_id`) y la confianza si la leyó un modelo |
| `BaselineEntry` (`baseline_entries`) | `lake` | Lo vigente de cada sujeto y atributo, con el hecho, la revisión y la propuesta que lo respaldan. Clave compuesta |
| `BaselineHistory` (`baseline_history`) | `lake` | Los valores vigentes anteriores, con desde cuándo y hasta cuándo rigieron |
| `Proposal` (`proposals`) | `lake` | Una propuesta (el PR) por revisión con autoridad: el documento, los hunks en JSON (cada uno con su elemento y localizador), el contexto sin cambio, el cambio principal y todos los de sus elementos (`change_ids`), los filtrados y su estado |
| `Review` (`reviews`) | `lake` | El voto de cada revisor de una propuesta: aprobar, disputar o pendiente, con nota y hora |
| `Discrepancy` (`discrepancies`) | `lake` | Un hecho sin autoridad que difiere de lo vigente, con su dueño y su estado (abierta, respaldada o descartada) |
| `Overlap` (`overlaps`) | `lake` | Un solapamiento: tipo (`mismo-elemento`, `misma-area` o `simultaneo`), área (nivel, celda y sistemas), los dos elementos, la propuesta y el fragmento que lo abrieron, quién respalda al otro elemento, los validadores y su estado (`abierto`, `confirmado`, `descartado` o `resuelto`, con la razón de la resolución) |
| `OverlapVote` (`overlap_votes`) | `lake` | El voto de cada validador de un solapamiento: `se_tocan` o `no_se_tocan`, con nota y hora. Único por solapamiento y validador |
| `Acknowledgement` (`acknowledgements`) | `lake` | La confirmación sin cambio de un documento desfasado, con su nota y la firma del desfase |
| `Seat` (`seats`) | API (sala) | Un asiento tomado: el hash SHA-256 del token y el último latido |
| `RoomEvent` (`room_events`) | API (sala) | Los eventos del ticker: `seq` autoincremental, época, tipo, mensaje en español y referencias |
| `RoomState` (`room_state`) | API (sala) | Una fila por proyecto: la época |
| `Organization` (`organizations`) | API (cuentas) | Un cliente: id y nombre. Tiene sus proyectos, miembros e invitaciones |
| `User` (`users`) | API (cuentas) | Una persona con cuenta: el `sub` de Auth0 (`auth_subject`), su correo confirmado y su nombre. Únicos el `sub` y el correo |
| `Membership` (`memberships`) | API (cuentas) | Una persona en una organización con su rol (`admin` o `member`). Clave `(organization_id, user_id)` |
| `Invitation` (`invitations`) | API (cuentas) | Un correo invitado a una organización con un rol; `accepted_at` cuando esa persona entra. Única por organización y correo |
| `Project` (`projects`) | API (proyecto) | Un proyecto de una organización (`organization_id`, que no se puede borrar mientras tenga proyectos): nombre, lugar, descripción, autor, dueños del costo y del plazo, el documento del modelo de Revit y los ejes de la grilla |
| `ProjectMember`, `ProjectSpace`, `ProjectDocument`, `ProjectAttribute`, `ProjectSubject`, `ModelElement`, `BudgetItem`, `ScheduleTask`, `ProjectDependency`, `ProjectLevel`, `ProjectSystem` (`project_*`, `model_elements`, `budget_items`, `schedule_tasks`) | API (proyecto) | La definición del proyecto: elenco, espacios, documentos con su dueño, atributos, sujetos (sección, categoría, atributos con unidad y huella en JSON), elementos del modelo, partidas, tareas, dependencias, niveles y sistemas. Clave `(project_id, id)` y `position` para el orden |

- Cada tabla es de un solo contexto, salvo las de la sala y el proyecto, que son de la API. No hay llaves foráneas entre tablas de contextos distintos: los ids viajan como valores.
- Las tablas de la sala, el lago, los cambios, los impactos y los avisos llevan `project_id` (sin llave foránea), y sus claves compuestas lo incluyen: una revisión es única por proyecto, documento y etiqueta; lo vigente, por proyecto, sujeto y atributo; un asiento, por proyecto y elenco. `reviews` y `overlap_votes` lo heredan de su propuesta o solapamiento.
- La migración `proyecto_en_cada_tabla` vació esas tablas: después de aplicarla, recarga la muestra con `pnpm etl reiniciar`.
- La migración `cuentas_y_organizaciones` borró las definiciones de proyecto (no tenían organización): después de aplicarla, `pnpm db:seed`. El lago y la sala no se tocan.
- Las tablas y columnas van en `snake_case` con `@@map` y `@map`; los modelos y campos, en `camelCase`.

## El proyecto

- **`ProjectDefinition`** ([`project/definition.ts`](project/definition.ts)) es la definición completa de un proyecto como datos planos. La API la valida al cargarla.
- **`saveOrganization(prisma, organización)`** crea o actualiza una organización, que tiene que existir antes que sus proyectos; **`inviteToOrganization(prisma, { organizationId, email, role })`** invita un correo.
- **`saveProjectDefinition(prisma, definición)`** la guarda en una transacción: crea o actualiza la fila de `projects` y reemplaza sus filas hijas. No toca el lago, la sala ni los avisos.
- **`loadProjectDefinition(prisma, id)`** la lee en el orden de `position`, y **`listProjectIds(prisma)`** lista los proyectos por fecha de creación.
- **La semilla** ([`seed/los-aromos.ts`](seed/los-aromos.ts)) es el Edificio Los Aromos de la [muestra](../../docs/muestra.md#el-proyecto-edificio-los-aromos). Los tests de la API la importan desde `@team27/data-main/seed`.
- **Las huellas** de cada sujeto van en `project_subjects.spatial`: tipo (`soporte` u `ocupante`), niveles, celdas (`{ kind: 'all' }`, `{ kind: 'axis', axis }` o `{ kind: 'position', attribute, axis }`) y sistemas.

## Comandos

```sh
cp .env.example .env                      # en la raíz: DATABASE_URL
pnpm db:up                                # Postgres de docker compose en :5427
pnpm --filter @team27/data-main migrate:dev -- --name <nombre>   # crea y aplica una migración desde el schema
pnpm db:migrate                           # aplica las migraciones pendientes (prisma migrate deploy)
pnpm db:seed                              # siembra Inmobiliaria Los Aromos y su proyecto; si ya está, reemplaza su definición
SEED_ADMIN_EMAIL=<correo> pnpm db:seed    # además invita ese correo como administrador de la organización
pnpm --filter @team27/data-main exec node seed/main.ts --si-no-hay   # siembra solo si la base no tiene proyectos (así arranca la imagen de la API)
pnpm db:studio                            # Prisma Studio
pnpm nx run @team27/data-main:generate    # el cliente; lo corren solas las tareas que dependen de él
```

- `prisma.config.ts` lee el `.env` de la raíz.
- `migrate dev` pide una terminal interactiva. Sin ella, genera el SQL con `pnpm --filter @team27/data-main exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` y guárdalo en `prisma/migrations/<timestamp>_<nombre>/migration.sql`.
- Una migración aplicada no se edita: se escribe otra.
- El `typecheck` de este paquete usa todo su directorio como input, schema incluido. El cliente generado no se versiona y Nx no lo ve, así que, sin el schema, la caché podría devolver los tipos de un cliente viejo.
- Lo que Prisma no modela (CHECK, triggers, roles) va en el SQL de la migración.

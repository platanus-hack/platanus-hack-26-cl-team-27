# @team27/data-main

Prisma 7 sobre PostgreSQL 18. Contiene el schema (`prisma/schema.prisma`), las migraciones (`prisma/migrations`) y el cliente generado en `generated/`, que no se versiona ni se edita. El código propio es `index.ts` (el cliente generado y `createPrismaClient(url)`), `project/` (la definición de un proyecto y cómo se lee, y las organizaciones y sus invitaciones) y `seed/` (la semilla de la organización base).

## Modelos

| Modelo (tabla)                  | Contexto       | Qué guarda                                                                          |
| ------------------------------- | -------------- | ----------------------------------------------------------------------------------- |
| `Change` (`changes`)            | `lake`         | Un cambio por elemento entre una base y un siguiente: la revisión de origen (`source_id`), tipo, resumen, diferencias, antes y después |
| `Impact` (`impacts`)            | `impact`       | El impacto de un cambio: costo y atraso en columnas, el resto del detalle en JSON   |
| `Notification` (`notifications`) | `notification` | Un aviso por afectado y cambio, con sus hallazgos en JSON, el contexto para redactarlo (`context`: rol, nombre, impacto y choques) y la respuesta del afectado |
| `NotificationDelivery` (`notification_deliveries`) | `notification` | La cola de envío (outbox) de un aviso: el canal (el de la persona al crearla y el que usó de verdad al salir: `email`, `whatsapp` o `slack`), el destinatario, el estado (`pending`, `sent`, `skipped` o `failed`), los intentos, cuándo reintentar, el motivo o el último error y el id del proveedor. Se escribe junto con el aviso y se borra con él |
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
| `ProjectEvent` (`project_events`) | API (coordinación) | Los eventos de cada proyecto: `seq` autoincremental (el cursor del sondeo), tipo, mensaje en español y referencias |
| `Organization` (`organizations`) | API (cuentas) | Un cliente: id y nombre. Tiene sus proyectos, miembros e invitaciones |
| `User` (`users`) | API (cuentas) | Una persona con cuenta: el `sub` de Auth0 (`auth_subject`), su correo confirmado y su nombre. Únicos el `sub` y el correo |
| `Membership` (`memberships`) | API (cuentas) | Una persona en una organización con su rol (`admin` o `member`). Clave `(organization_id, user_id)` |
| `Invitation` (`invitations`) | API (cuentas) | Un correo invitado a una organización con un rol; `accepted_at` cuando esa persona entra. Única por organización y correo |
| `ApsConnection` (`aps_connections`) | API (conexión con Autodesk) | La cuenta de Autodesk de una organización (una por organización, se borra con ella): quién la conectó (`connected_by_id`, queda nulo si se borra esa persona), el usuario de Autodesk, los scopes, el access y el refresh token cifrados con AES-256-GCM (`*_ciphertext`), cuándo vence el access token, la última renovación y el estado (`active` o `reconnect_required`, con un CHECK) |
| `Project` (`projects`) | API (proyecto) | Un proyecto de una organización (`organization_id`, que no se puede borrar mientras tenga proyectos): nombre, lugar, descripción, autor, dueños del costo y del plazo, el documento del modelo y los ejes de la grilla |
| `ProjectMember`, `ProjectSpace`, `ProjectDocument`, `ProjectAttribute`, `ProjectSubject`, `ModelElement`, `BudgetItem`, `ScheduleTask`, `ProjectDependency`, `ProjectLevel`, `ProjectSystem` (`project_*`, `model_elements`, `budget_items`, `schedule_tasks`) | API (proyecto) | La definición del proyecto: elenco, espacios, documentos con su dueño, atributos, sujetos (sección, categoría, atributos con unidad y huella en JSON), elementos del modelo, partidas, tareas, dependencias, niveles y sistemas. Clave `(project_id, id)` y `position` para el orden |
| `IntegrationConnection` (`integration_connections`) | `integrations` | La cuenta de un proveedor (`google`) que conectó una persona (`user_id`, única por persona y proveedor): el correo, los permisos y el refresh token cifrado con `INTEGRATIONS_ENCRYPTION_KEY` |
| `IntegrationSource` (`integration_sources`) | `integrations` | Una planilla vinculada a un proyecto (`project_id`, única por proyecto e id externo: la misma planilla puede estar en dos proyectos) y la cuenta con que se lee (`connection_id`): el título, el link, el hash de sus celdas, la última revisión, el último cambio con quién lo hizo (`changed_by`, JSON) y el último error, y el canal de avisos de Drive (`watch_channel_id`, único, `watch_resource_id`, `watch_token` y `watch_expires_at`). Lo que cambió no se guarda. Si se borra la cuenta, la planilla queda sin cuenta (`connection_id` nulo) hasta que alguien la vuelva a vincular |
| `AutodeskEvent` (`autodesk_events`) | `integrations` | Cada webhook de Autodesk que se recibió una vez: la llave (`dedupe_key`, única, que descarta los reintentos), el evento y su `kind`, el sistema, el hook, el recurso (tipo, urn, linaje, nombre, versión, carpeta y proyecto de Autodesk), quién lo hizo, cuándo pasó, si pide el diff por elemento y cuándo llegó. Índice por `lineage_urn` |

- Cada tabla es de un solo contexto, salvo las de eventos, cuentas y proyecto, que son de la API. No hay llaves foráneas entre tablas de contextos distintos: los ids viajan como valores.
- Las tablas de eventos, el lago, los cambios, los impactos y los avisos llevan `project_id` (sin llave foránea), y sus claves compuestas lo incluyen: una revisión es única por proyecto, documento y etiqueta; lo vigente, por proyecto, sujeto y atributo. `reviews` y `overlap_votes` lo heredan de su propuesta o solapamiento. Por eso borrar un proyecto no borra su lago: hay que hacerlo por `project_id`, como hace la migración `sin_la_muestra`.
- La migración `planillas_por_proyecto` borró las cuentas y planillas vinculadas, que no tenían dueño: después de aplicarla, cada persona vuelve a conectar su cuenta de Google y a vincular sus planillas en `/conectores`.
- La migración `sin_la_muestra` borra el proyecto `los-aromos` con todo lo que el lago, los avisos y los conectores guardaron de él, y la organización `inmobiliaria-los-aromos` solo si queda sin proyectos. Además borra las tablas `seats`, `room_state` y `room_events`, y crea `project_events` vacía.
- Las tablas y columnas van en `snake_case` con `@@map` y `@map`; los modelos y campos, en `camelCase`.

## El proyecto

- **`ProjectDefinition`** ([`project/definition.ts`](project/definition.ts)) es la definición completa de un proyecto como datos planos. La API la valida al cargarla.
- **`saveOrganization(prisma, organización)`** crea o actualiza una organización, que tiene que existir antes que sus proyectos; **`inviteToOrganization(prisma, { organizationId, email, role })`** invita un correo.
- **Un proyecto creado desde la web** lo escribe la API directo en `projects` y `project_members`: solo lo básico y su creador en el elenco, con las demás tablas vacías.
- **`loadProjectDefinition(prisma, id)`** la lee en el orden de `position`, o devuelve `null` si no existe. La API la carga en cada pedido de un proyecto; uno recién creado también pasa la validación, aunque no tenga grilla.
- **Un proyecto completo** de ejemplo, con elenco, grilla, modelo, presupuesto y plazos, vive en los tests de la API (`apps/api/tests/fixtures/los-aromos.ts`). No está en la base ni en la semilla.
- **Las huellas** de cada sujeto van en `project_subjects.spatial`: tipo (`soporte` u `ocupante`), niveles, celdas (`{ kind: 'all' }`, `{ kind: 'axis', axis }` o `{ kind: 'position', attribute, axis }`) y sistemas.

## La semilla

[`seed/main.ts`](seed/main.ts) deja una organización base, sin proyectos ni archivos: **Constructora Cordillera** (`constructora-cordillera`, en [`seed/cordillera.ts`](seed/cordillera.ts)).

- **`pnpm db:seed`** (en local) crea o actualiza la organización e invita a seis personas: un administrador y cinco miembros. Puedes correrla las veces que quieras: no duplica nada.
- **Sin `SEED_EMAIL`**, los correos son inventados, en el dominio reservado `cordillera.test`: `admin@cordillera.test` (`admin`), y `ana.soto`, `bruno.diaz`, `carla.mena`, `diego.fuentes` y `elena.parra` (`member`). La organización queda poblada, pero nadie puede entrar con ellos: Auth0 manda el código de entrada al correo, y esas bandejas no existen.
- **Con `SEED_EMAIL=tu@gmail.com`**, los correos llevan un `+` sobre el tuyo: `tu+admin@gmail.com`, `tu+ana@gmail.com`, `tu+bruno@gmail.com`… Para Auth0 son personas distintas, pero todos los códigos te llegan a ti, así que puedes entrar como cada rol (por ejemplo, en ventanas de incógnito). Tu correo queda en tu `.env`, que no se versiona.
- **`node seed/main.ts --si-no-hay`** (lo corre la imagen de la API al arrancar) crea la organización solo si la base no tiene ninguna organización, y sin personas. En producción, quien entra primero es un superadmin (`SUPERADMIN_EMAILS`), que invita a la gente desde `/admin`. Si después alguien la borra y quedan otras organizaciones, no vuelve a aparecer.
- Las invitaciones se aceptan solas cuando esa persona entra con su correo confirmado ([API, cuentas](../../apps/api/README.md#cuentas-organizaciones-y-roles)).

## Comandos

```sh
cp .env.example .env                      # en la raíz: DATABASE_URL
pnpm db:up                                # Postgres de docker compose en :5427
pnpm --filter @team27/data-main migrate:dev -- --name <nombre>   # crea y aplica una migración desde el schema
pnpm db:migrate                           # aplica las migraciones pendientes (prisma migrate deploy)
pnpm db:seed                              # Constructora Cordillera con su administrador y sus miembros invitados
SEED_EMAIL=<tu correo> pnpm db:seed       # lo mismo, con correos «+» sobre el tuyo, para poder entrar con cada uno
pnpm --filter @team27/data-main exec node seed/main.ts --si-no-hay   # solo la organización, si la base no tiene ninguna (así arranca la imagen de la API)
pnpm db:studio                            # Prisma Studio
pnpm nx run @team27/data-main:generate    # el cliente; lo corren solas las tareas que dependen de él
```

- `prisma.config.ts` lee el `.env` de la raíz.
- `migrate dev` pide una terminal interactiva. Sin ella, genera el SQL con `pnpm --filter @team27/data-main exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` y guárdalo en `prisma/migrations/<timestamp>_<nombre>/migration.sql`.
- Una migración aplicada no se edita: se escribe otra.
- El `typecheck` de este paquete usa todo su directorio como input, schema incluido. El cliente generado no se versiona y Nx no lo ve, así que, sin el schema, la caché podría devolver los tipos de un cliente viejo.
- Lo que Prisma no modela (CHECK, triggers, roles) va en el SQL de la migración.

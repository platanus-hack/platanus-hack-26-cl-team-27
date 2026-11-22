# Vigente (Team 27) — Monorepo de Platanus Hack 26

Monorepo de la hackatón: Nx 24 + pnpm 10, una web en Next.js 16 (React 19, Tailwind 4), una API en NestJS 12, PostgreSQL con Prisma 7 y el dominio en contextos hexagonales. El producto se llama Vigente ([docs/marca.md](docs/marca.md)) y convierte cada cambio de un proyecto de construcción en avisos a los equipos que afecta, en las herramientas que ya usan. El modelo de negocio todavía se está definiendo.

Lo que se construye es la app que se va a poblar con datos reales: no hay proyecto ficticio ni datos inventados. Se entra con una cuenta de Auth0 (solo por invitación, salvo los superadmins de `SUPERADMIN_EMAILS`), y cada organización tiene sus proyectos. El motor ([docs/motor.md](docs/motor.md)) trabaja por proyecto: recibe las revisiones de sus documentos, las compara con lo vigente, abre propuestas y avisa a los afectados. Un proyecto creado desde la web todavía parte vacío (sin espacios, documentos ni modelo), así que el motor no tiene nada que procesar hasta que haya cómo cargarle esa definición. Los conectores de Google Sheets y Autodesk se activan con sus variables. Cada cambio se cierra con tests, docs y `pnpm check` en verde.

## Documentación

Antes de tocar un área, lee su doc. Si cambias un comportamiento, actualiza el doc en el mismo cambio.

| Área                                                                                                                 | Doc                                                                                           |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Problema, propuesta, actores, historias de usuario, glosario del dominio                                             | [docs/negocio.md](docs/negocio.md)                                                            |
| El motor: el lago de hechos, lo vigente, propuestas y consenso, avisos, rutas por proyecto y lo que falta            | [docs/motor.md](docs/motor.md)                                                                |
| Solapamientos: cada documento como un PR contra la fuente única, áreas, fragmentos, detección y validación conjunta  | [docs/solapamientos.md](docs/solapamientos.md)                                                |
| Monorepo, fronteras, contextos hexagonales (y cómo crear uno), web ↔ API, variables, datos, TypeScript, tareas de Nx | [docs/arquitectura.md](docs/arquitectura.md)                                                  |
| Diagramas de arquitectura, DevOps y flujo de datos                                                                   | [docs/diagramas/README.md](docs/diagramas/README.md)                                          |
| Auditoría de la idea: debate adversarial, la idea purificada (Mano alzada), soporte del producto y plan              | [docs/auditoria.md](docs/auditoria.md)                                                        |
| Despliegue: espejo a un repo personal, API y Postgres en Render, web en Vercel, la semilla y el día del pitch        | [docs/despliegue.md](docs/despliegue.md)                                                      |
| Spec: síntesis, el plan de 26 tareas frente al código, backlog, flujo de usuario y arquitectura en draw.io           | [docs/spec/README.md](docs/spec/README.md), y para agentes [docs/spec/ia.md](docs/spec/ia.md) |
| La web                                                                                                               | [apps/web/README.md](apps/web/README.md)                                                      |
| La API                                                                                                               | [apps/api/README.md](apps/api/README.md)                                                      |
| Conectores reales: conectar Google Sheets y escuchar sus cambios, y cómo configurar Google                           | [context/integrations/README.md](context/integrations/README.md)                              |
| Los cambios en Autodesk: catálogo de eventos de webhook, firma, diff por elemento de AEC Data Model y la minuta      | [docs/spec/cambios-autodesk.md](docs/spec/cambios-autodesk.md)                                |
| Base de datos y migraciones                                                                                          | [data/main/README.md](data/main/README.md)                                                    |
| Tema y componentes                                                                                                   | [packages/ui/README.md](packages/ui/README.md)                                                |
| Marca: nombre, isotipo, logotipo, color y archivos                                                                   | [docs/marca.md](docs/marca.md)                                                                |

## Comandos

```bash
nvm use && corepack enable          # Node 24 y pnpm 10.33
pnpm install
cp .env.example .env
pnpm db:up                          # PostgreSQL 18 de docker compose en :5427
pnpm db:migrate                     # migraciones pendientes
pnpm db:seed                        # crea Constructora Cordillera e invita a su admin y sus miembros (ver data/main/README.md)
pnpm dev                            # API en http://localhost:3001/api y web en http://localhost:3000
pnpm dev:api | pnpm dev:web
pnpm db:studio                      # Prisma Studio
pnpm check                          # lint, test, typecheck y build de todo
pnpm affected                       # lo mismo, solo lo que cambió respecto de main
pnpm nx run <proyecto>:<tarea>      # p. ej. pnpm nx run @team27/web:build
pnpm nx graph
pnpm format
```

## Convenciones

- **El código no lleva comentarios.** Lo que hay que saber va en el doc del área, en un nombre claro o en un test. Solo se aceptan los funcionales (`eslint-disable`, `@ts-expect-error`, `/// <reference>`).
- **Los docs describen el sistema como es hoy.** Nada de historia: eso queda en git.
- **Capas hexagonales** (`context/<ctx>/src/`): `domain/` solo importa relativos de `domain/`; `application/` (puertos y casos de uso) solo importa `domain/` y `application/`; `infra/adapters/` implementa los puertos y sale por el subpath `/adapters`; `index.ts` nunca exporta infra. ESLint lo exige.
- **Fronteras por tags**: `type:app` → `type:context`, `type:data`, `type:package`, `type:lib`; `type:context` → `type:data`, `type:lib`; `type:data` → `type:lib`. Un contexto nunca importa a otro.
- **La API compone**: cada contexto entra por `apps/api/src/modules/<ctx>/`. Lo que no depende de un proyecto va en un módulo de Nest, con sus adapters por token y sus casos de uso con `provideUseCase`; lo que trabaja sobre un proyecto (`lake`, `impact`, `notification`) se arma en cada pedido con `build<Ctx>(db, project)`. La web habla con la API por HTTP.
- **Imports relativos con extensión `.ts`** en los paquetes. Contextos y `data/main` usan solo sintaxis borrable (`erasableSyntaxOnly`): Node los ejecuta sin compilar.
- **Textos de UI** en español de Chile, con tuteo. Identificadores en inglés.

## Gotchas

- El `README.md`, `platanus-hack-project.jsonc`, `project-description.md` y `project-logo.png` de la raíz son la entrega de la hackatón y tienen sus propias reglas: léelas antes de editarlos. Prettier no los toca.
- `ANTHROPIC_API_KEY` va vacía en `.env.example`. Sin ella, la API no lee texto libre (WhatsApp, folios, actas): una revisión con un fragmento de texto responde `503 inference_unavailable`. Con la clave en tu `.env`, lee Claude. Nunca commitees la clave: el `.env` no se versiona.
- Para entrar en local necesitas tu correo real en `SUPERADMIN_EMAILS` de tu `.env` (el login de Auth0 no usa contraseña: manda un código al correo). Los correos `@cordillera.test` de la semilla no reciben el código: solo pueblan la organización. Con `SEED_EMAIL=<tu correo>`, la semilla invita direcciones con «+» sobre tu correo y puedes entrar como cada una.
- Un paquete nuevo del workspace que use la web va también en `transpilePackages` (`apps/web/next.config.ts`). Turbopack no resuelve `./x.js` hacia `x.ts`.
- `next build` necesita los `.d.ts` de sus dependencias (project references). Corre el build por Nx (`pnpm nx run @team27/web:build`), que primero hace el `typecheck` de las dependencias. Si aparece `TS6305`, es eso.
- Si el build de la web falla en `.next/dev/types/validator.ts` (`TS2307` tras borrar o mover una ruta, o `TS6133`/`TS6196` por imports sin usar), son tipos viejos de un `next dev` anterior: borra `apps/web/.next`.
- Si un puerto choca con `EADDRINUSE`, mira quién lo tiene antes de cerrar nada: `ss -ltnp | grep <puerto>` da el pid y `ps -o args -p <pid>` dice qué es. En `ss`, los procesos de Node aparecen como `MainThread`.
  - Si es un `node dist/main` de un watcher anterior, ciérralo.
  - **Nunca cierres un proceso de `.vscode-server`.** En WSL, VS Code se queda con puertos como el 3000 o el 3002 para reenviarlos, y cerrarlo bota las extensiones del editor. Usa otro puerto: `next start -p 3100` o `next dev -p 3100`.
- Después de agregar o quitar una dependencia entre proyectos, corre `pnpm nx sync`.
- Todo `/api/*` de la web se reenvía a la API (`rewrites` en `apps/web/next.config.ts`): no crees rutas en `apps/web/src/app/api/`, porque le ganan al reenvío. El `rewrite` fija `API_URL` al compilar la web.
- La CI (`.github/workflows/check.yml`) corre `pnpm install --frozen-lockfile` y `pnpm check` en cada push a `main` y cada PR: si cambias dependencias, commitea el `pnpm-lock.yaml`.
- El deploy sale del espejo (`agustin-rios/hack-team-27`), no del repo de la organización. `mirror.yml` lo pone al día en cada push a `main`, también al mergear un PR en GitHub, si existe el secret `MIRROR_TOKEN`. Si no existe, quien mergea corre `git pull && git push` con el doble push ([despliegue](docs/despliegue.md#el-repo-espejo)).
- Nx carga el `.env` de la raíz en cada tarea, y `data/main/prisma.config.ts` también lo lee. La API no lee archivos: toma el entorno y no arranca si una variable no cumple su schema.
- Si `pnpm db:up` falla en WSL con «docker could not be found», activa la integración con WSL en Docker Desktop, o apunta `DATABASE_URL` a otro Postgres.
- En WSL, el shell puede traer un Node viejo: `nvm use` antes de `pnpm`.

## Toolchain

- Node 24 (`.nvmrc`), pnpm 10.33 (`packageManager`, con corepack), Nx 24.0.6.
- TypeScript 6.0 (`typescript-eslint` exige `< 6.1`), ESLint 9 (`eslint-plugin-react` exige `<= 9`), Next 16.4, React 19.3, Tailwind 4.3, Vitest 5.
- NestJS 12.6, Prisma 7.10 (el tag `latest` de `prisma` apunta a un RC de la 8: fija la 7), PostgreSQL 18 en compose.

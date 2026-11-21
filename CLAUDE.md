# Team 27 — Monorepo de Platanus Hack 26

Monorepo de la hackatón: Nx 24 + pnpm 10, una web en Next.js 16 (React 19, Tailwind 4), una API en NestJS 12, PostgreSQL con Prisma 7 y el dominio en contextos hexagonales. El producto convierte cada cambio de un proyecto de construcción en avisos a los equipos que afecta, en las herramientas que ya usan. El modelo de negocio todavía se está definiendo.

## Documentación

Antes de tocar un área, lee su doc. Si cambias un comportamiento, actualiza el doc en el mismo cambio.

| Área                                                                                                                 | Doc                                            |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Problema, propuesta, actores, historias de usuario, glosario del dominio                                             | [docs/negocio.md](docs/negocio.md)             |
| Monorepo, fronteras, contextos hexagonales (y cómo crear uno), web ↔ API, variables, datos, TypeScript, tareas de Nx | [docs/arquitectura.md](docs/arquitectura.md)   |
| Despliegue (espejo a un repo personal)                                                                               | [docs/despliegue.md](docs/despliegue.md)       |
| La web                                                                                                               | [apps/web/README.md](apps/web/README.md)       |
| La API                                                                                                               | [apps/api/README.md](apps/api/README.md)       |
| Base de datos y migraciones                                                                                          | [data/main/README.md](data/main/README.md)     |
| Tema y componentes                                                                                                   | [packages/ui/README.md](packages/ui/README.md) |

## Comandos

```bash
nvm use && corepack enable          # Node 24 y pnpm 10.33
pnpm install
cp .env.example .env
pnpm db:up                          # PostgreSQL 18 de docker compose en :5427
pnpm db:migrate                     # migraciones pendientes
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
- **La API compone**: cada contexto entra por un módulo de Nest en `apps/api/src/modules/<ctx>/`, con sus adapters por token y sus casos de uso con `provideUseCase`. La web habla con la API por HTTP.
- **Imports relativos con extensión `.ts`** en los paquetes. Contextos y `data/main` usan solo sintaxis borrable (`erasableSyntaxOnly`): Node los ejecuta sin compilar.
- **Textos de UI** en español de Chile, con tuteo. Identificadores en inglés.

## Gotchas

- El `README.md`, `platanus-hack-project.jsonc`, `project-description.md` y `project-logo.png` de la raíz son la entrega de la hackatón y tienen sus propias reglas: léelas antes de editarlos. Prettier no los toca.
- Un paquete nuevo del workspace que use la web va también en `transpilePackages` (`apps/web/next.config.ts`). Turbopack no resuelve `./x.js` hacia `x.ts`.
- `next build` necesita los `.d.ts` de sus dependencias (project references). Corre el build por Nx (`pnpm nx run @team27/web:build`), que primero hace el `typecheck` de las dependencias. Si aparece `TS6305`, es eso.
- Si borras o mueves una ruta y el build de la web falla con `TS2307` en `.next/dev/types/validator.ts`, son tipos viejos de un `next dev` anterior: borra `apps/web/.next`.
- Después de agregar o quitar una dependencia entre proyectos, corre `pnpm nx sync`.
- Todo `/api/*` de la web se reenvía a la API (`rewrites` en `apps/web/next.config.ts`): no crees rutas en `apps/web/src/app/api/`, porque le ganan al reenvío. El `rewrite` fija `API_URL` al compilar la web.
- La CI (`.github/workflows/check.yml`) corre `pnpm install --frozen-lockfile` y `pnpm check` en cada push a `main` y cada PR: si cambias dependencias, commitea el `pnpm-lock.yaml`.
- Nx carga el `.env` de la raíz en cada tarea, y `data/main/prisma.config.ts` también lo lee. La API no lee archivos: toma el entorno y no arranca si una variable no cumple su schema.
- Si `pnpm db:up` falla en WSL con «docker could not be found», activa la integración con WSL en Docker Desktop, o apunta `DATABASE_URL` a otro Postgres.
- En WSL, el shell puede traer un Node viejo: `nvm use` antes de `pnpm`.

## Toolchain

- Node 24 (`.nvmrc`), pnpm 10.33 (`packageManager`, con corepack), Nx 24.0.6.
- TypeScript 6.0 (`typescript-eslint` exige `< 6.1`), ESLint 9 (`eslint-plugin-react` exige `<= 9`), Next 16.4, React 19.3, Tailwind 4.3, Vitest 5.
- NestJS 12.6, Prisma 7.10 (el tag `latest` de `prisma` apunta a un RC de la 8: fija la 7), PostgreSQL 18 en compose.

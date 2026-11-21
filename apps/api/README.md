# @team27/api

La API HTTP en NestJS 12, en `http://localhost:3001/api`. Compone los contextos hexagonales y los expone; la base le llega por [`@team27/data-main`](../../data/main/README.md).

## Comandos

```sh
pnpm dev:api                          # nest start --watch (o pnpm dev, con la web)
pnpm nx run @team27/api:build         # nest build → dist/
pnpm nx run @team27/api:start         # node dist/main.js
pnpm nx run @team27/api:test          # Vitest
```

## Rutas

| Ruta                                           | Responde                                                                                                                         |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/health`                              | `{"status":"ok"}` si el proceso vive. No toca la base                                                                            |
| `GET /api/health/ready`                        | `{"status":"ok","database":"ok"}`, o 503 `{"status":"unavailable","database":"error"}` si la base no responde                    |
| `GET /api/demo`                                | El proyecto, la integración con su autora, el elenco y los atajos del guion                                                      |
| `POST /api/demo/reset`                         | 204. Borra versiones, cambios, impactos y avisos, y vuelve a publicar el modelo base                                             |
| `GET /api/integrations/:integrationId/model`   | La última versión del modelo                                                                                                     |
| `POST /api/integrations/:integrationId/versions` | Publica `{ elements }`: guarda la versión, calcula el impacto de cada cambio y avisa. Responde `{ version, changeIds }`; si nada cambió, `changeIds` va vacío |
| `GET /api/changes?limit=20`                    | Los cambios más recientes (hasta 50), cada uno con su `impact` y sus `notifications`                                             |
| `GET /api/changes/:id`                         | Un cambio con su impacto y sus avisos; 404 si no existe                                                                          |
| `POST /api/notifications/:id/response`         | `{ kind: "reviewed" \| "issue", note? }`: guarda la respuesta del afectado y devuelve el aviso; 404 si no existe                 |

- `:integrationId` solo acepta `modelo-arquitectura`, la integración del guion.
- Los ids de cambios y avisos son UUID.
- Si una entrada no cumple su schema de zod, la API responde 400.

## Estructura

```
src/
├── main.ts                       arranque: CORS, apagado ordenado y puerto
├── app.setup.ts                  prefijo /api y validación con schemas (también la usan los tests)
├── app.module.ts                 los módulos de la app
├── config/                       variables de entorno validadas con zod
├── common/provide-use-case.ts    registra un caso de uso de un contexto como provider de Nest
├── scenario/los-aromos.ts        el guion de la muestra: modelo base, grafo del proyecto, elenco y atajos
└── modules/
    ├── database/                 el PrismaClient (token PRISMA_CLIENT), global
    ├── health/                   /api/health y /api/health/ready
    ├── capture/                  adapters y casos de uso de context-capture
    ├── impact/                   adapters y casos de uso de context-impact (el grafo sale del guion)
    ├── notification/             adapters, casos de uso y la ruta de respuestas de context-notification
    └── coordination/             encadena captura → impacto → aviso, arma el feed y reinicia la muestra
tests/                            replica src/: Vitest con @nestjs/testing
```

- **`CoordinationService`** es el único que conoce los tres contextos:
  - publica una versión y, por cada cambio, llama a `AnalyzeChange` y después a `NotifyStakeholders`;
  - arma el feed juntando cambios, impactos y avisos, con los avisos en el orden del elenco;
  - al arrancar, publica el modelo base si todavía no hay ninguna versión.
- **El reinicio** borra las tablas directamente con el `PrismaClient`. Es una operación de la muestra, no de un contexto.

Variables, cómo se compone un contexto y por qué Node ejecuta los paquetes del workspace como TypeScript: [arquitectura](../../docs/arquitectura.md).

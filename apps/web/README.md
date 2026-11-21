# @team27/web

El panel del proyecto: Next.js 16 (App Router, Turbopack), React 19 y Tailwind 4, con el tema y los componentes de [`@team27/ui`](../../packages/ui/README.md). Los datos los pide a la [API](../api/README.md).

## Comandos

```sh
pnpm dev:web                          # http://localhost:3000 (o pnpm dev, con la API)
pnpm nx run @team27/web:build         # typecheck de sus dependencias y next build
pnpm nx run @team27/web:start         # sirve el build
pnpm nx run @team27/web:lint
pnpm nx run @team27/web:test          # Vitest: los *.spec.ts de src/
```

## Rutas

| Ruta                             | Qué es                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `/`                              | Elegir asiento: tarjetas del elenco, «Ver la sala», «Volver a mi asiento». Fernanda entra a `/presentador` |
| `/sala`                          | El telón del proyector, solo lectura, a pantalla completa                                               |
| `/asiento/[castId]`              | El celular del jugador (mobile-first, 390 px), con el look de su canal                                  |
| `/presentador`                   | Escenas, autoplay, reinicio, asientos, carpeta de Fernanda y acciones de autora                         |
| `/espacios`                      | Explorador de espacios, documentos y revisiones (solo lectura, muestra el puntero)                      |
| `/cambios/[id]`                  | Detalle de una propuesta; acepta `?para=<stakeholderId>`                                                |
| `/valor/[subjectId]/[attribute]` | Procedencia completa de un valor                                                                        |

Los route groups `(site)`, `(sala)` y `(asiento)` dan a cada pantalla su propio layout: el sitio con encabezado, el telón sin márgenes y el celular en una columna de 430 px. Todo `/api/*` lo reenvía `next.config.ts` a la API; el navegador llama a rutas relativas.

## Estructura

```
src/
├── app/                   rutas y layouts (route groups), globals.css y favicon
├── components/
│   ├── common/            Icon, StateMark (icono + texto), CostDelay, LiveBadge, estados de carga
│   ├── inicio/            SeatPicker y SeatCard
│   ├── sala/              SalaBoard, TotalsBar, ConsensusRing, BaselineBoard, ProposalStrip, StalePanel,
│   │                      SpaceMap, EventTicker, SealBanner, JoinQr, ProvenanceDrawer
│   ├── asiento/           SeatScreen, ChannelShell (EmailInbox, WhatsAppChat, SlackFeed), VoteCard,
│   │                      VoteButtons, DiscrepancyCard, StaleCard, FilteredCard, DropTray, AuthorActions,
│   │                      PresenceBadge
│   ├── presentador/       PresenterConsole, KeyGate, SceneList, AutoplayToggle, ResetButton, SeatOccupancy
│   ├── espacios/          SpaceExplorer, SpaceTabs, DocumentList, RevisionRow
│   ├── cambios/           ChangeDetailView, FactDiff, ImpactSummary, ReviewerList, FilteredList
│   └── valor/             ValuePage, ProvenanceChain
├── hooks/                 useRoomPulse, useLive, useHeldSeats, useSeatToken, usePresenterKey
└── lib/                   un módulo por tema, con sus tipos y su cliente tipado (ver abajo)
```

- `@/*` apunta a `src/*`.
- `next.config.ts` reenvía todo `/api/*` a `API_URL` y transpila los paquetes del workspace (`transpilePackages`). Por eso la web no define rutas en `app/api/`.
- Los tests van junto al código (`*.spec.ts`) e importan `describe`, `it` y `vi` desde `vitest`, para que los tipe el mismo `tsconfig.json` de la app.

## Cliente de la API (`src/lib`)

Cada módulo declara los tipos de las respuestas y las funciones que las piden. `http.ts` pone los encabezados: `x-seat-token` (asiento), `x-presenter-key` (presentador) y `x-action-id` (un UUID por escritura). Los errores llegan como `ApiError` con `status` y `code` (`seat_taken`, `already_ingested`, `blocked`, `template_invalid`), y `describeError` los traduce.

| Módulo               | Endpoints                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| `room-api.ts`        | `GET /api/room`, `POST /api/seats/:castId/claim`, `DELETE /api/seats/:castId`                              |
| `events-api.ts`      | `GET /api/events?after&epoch&seat`                                                                         |
| `baseline-api.ts`    | `GET /api/baseline?section`                                                                                |
| `provenance-api.ts`  | `GET /api/baseline/:subjectId/:attribute/provenance`                                                       |
| `spaces-api.ts`      | `GET /api/spaces`                                                                                          |
| `drops-api.ts`       | `GET /api/seats/:castId/tray`, `POST /api/spaces/:spaceId/drops` con `{ fixtureId }`                        |
| `inbox-api.ts`       | `GET /api/seats/:castId/inbox`                                                                             |
| `proposals-api.ts`   | `GET /api/proposals?status`, `POST /api/proposals/:id/reopen`, `POST /api/proposals/:id/withdraw`           |
| `votes-api.ts`       | `POST /api/notifications/:id/response` con `{ kind, note? }`, `POST /api/discrepancies/:id/dismiss`, `POST /api/stale/acknowledge` con `{ revisionId, note }` |
| `changes-api.ts`     | `GET /api/changes/:id`                                                                                     |
| `scenes-api.ts`      | `GET /api/room/scenes`, `POST /api/room/scenes/:id/play`, `POST /api/room/autoplay`, `POST /api/room/reset` |

Los formatos (`format.ts`) son es-CL: pesos sin decimales (`$3.636.500`), `1 día` y `4 días`, coma decimal (`8,5 m`).

## Tiempo real

`useRoomPulse` consulta `GET /api/events?after=<seq>&epoch=<n>&seat=<castId>` cada 700 ms en `/sala` y cada 1000 ms en el resto, con ±150 ms de jitter. Manda `x-seat-token` si el visitante tiene asiento: es su latido. La lógica pura vive en `lib/pulse.ts`:

- `applyPulse` fija época y cursor en la primera respuesta, descarta los eventos ya vistos, mantiene el ticker (40 eventos) y marca el reinicio con `reset: true` o con un cambio de época.
- `nextDelay` suma el jitter y, tras errores, retrocede hasta 3 s.
- Cada sondeo lleva un `AbortController`; con la pestaña oculta se pausa y al volver se consulta de inmediato.

`useLive` carga los datos de una pantalla y los vuelve a pedir cuando llegan eventos. Con `reset: true` recarga todo; los celulares borran sus tokens y vuelven a `/`.

## Almacenamiento

- El token de cada asiento vive en `localStorage` bajo `sala:asiento:<castId>` (`lib/seat-storage.ts`). Todo acceso va con `try/catch`: si el navegador no deja guardar, el token sigue en memoria mientras dure la pestaña y la pantalla muestra «Tu navegador no deja guardar el asiento». Sin token, `/asiento/[castId]` queda en solo lectura.
- La clave del presentador vive en `sessionStorage` bajo `sala:presentador`; se pide una vez por pestaña y se borra si la API la rechaza.

## Diseño

- Los estados siempre llevan icono y texto, nunca solo color (`StateMark`).
- `/sala` usa tipografía grande y contraste fuerte, y respeta el modo oscuro del tema de `@team27/ui`.
- Los canales (correo, chat, canal de equipo) cambian el aspecto, no el contenido, y no usan logos ni marcas.
- `JoinQr` codifica `window.location.origin + '/'` e imprime la URL debajo.
- `next dev` en marcha reescribe `.next/dev/types` y rompe `next build` (`TS6196` en `validator.ts`): detén el `dev` antes de correr el build.

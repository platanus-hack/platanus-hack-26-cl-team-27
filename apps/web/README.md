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

| Ruta                             | Qué es                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `/`                              | Elegir asiento: lista del elenco con rol, canal y estado; «Tomar este asiento» o «Volver a mi asiento»       |
| `/sala`                          | El telón del proyector, solo lectura; propuestas, valores y documentos se abren en un panel                  |
| `/asiento/[castId]`              | La bandeja del jugador (mobile-first, 430 px), con pestañas Pendientes y Respondidos y el look de su canal    |
| `/presentador`                   | La consola de Fernanda: requieren atención, propuestas (activas e historial), asientos y reinicio            |
| `/caso/[castId]`                 | La pantalla de una persona del caso P-12: `paula-rojas` (plano, «Mover P-12 40 cm al norte» y línea de tiempo) o `camila-vera` (plano y tarjeta de la propuesta, con «Aceptar propuesta» y «Tengo un problema»). Toma el asiento sola si no lo tiene |
| `/caso`                          | Vista del presentador del caso: las dos pantallas lado a lado, el hilo de eventos `flow.*` y «Reiniciar caso» (pide la clave del presentador; actúa como cada persona con `x-act-as`) |
| `/espacios`                      | Espacios y documentos; el documento se abre en un panel. Acepta `?espacio=`, `?documento=` y `?revision=`    |
| `/cambios/[id]`                  | Detalle de una propuesta; acepta `?para=<stakeholderId>`                                                     |
| `/modelos`                       | El visor de APS con todas las disciplinas del catálogo de la API (`GET /api/aps/models`) en una escena: abre con Arquitectura y carga las demás al encenderlas, con un interruptor por disciplina y las propiedades del elemento seleccionado |
| `/conectores`                    | Los conectores de un proyecto (con tu cuenta; sin sesión, pide entrar): elegir el proyecto (`?proyecto=`, o el primero de tus organizaciones), conectar tu cuenta de Google, vincular planillas al proyecto por su link y ver por cada una la última revisión, el último cambio y el error, con «Revisar ahora» y «Desvincular». Cada proyecto ve solo sus planillas. Autodesk aparece como próximamente (leer presupuestos y versiones de ACC), con un enlace a `/cuenta`, donde cada organización conecta su cuenta de Autodesk. Vuelve de Google con `?proyecto=…&google=conectado` o `?proyecto=…&google=error&motivo=` |
| `/cuenta` | Tu cuenta: entrar con tu correo (sin contraseña, con Auth0), tus organizaciones con tu rol, sus proyectos (cada uno se abre en `/proyectos/[projectId]`) con «Crear proyecto», la conexión con Autodesk, el equipo con las invitaciones pendientes y, si eres administrador, invitar un correo y conectar la cuenta de Autodesk de la organización. Sin Auth0 configurado, avisa que las cuentas no están activas |
| `/proyectos/nuevo` | Crear un proyecto: organización (si eres parte de más de una; `?organizacion=` elige cuál), nombre, lugar y descripción. Al crearlo, abre el proyecto. Pide sesión como `/cuenta` |
| `/proyectos/[projectId]` | Un proyecto de tus organizaciones: nombre, organización, lugar, descripción y fecha de creación, con el aviso de que todavía no tiene documentos, equipo ni mapa de dependencias. Pide sesión como `/cuenta` |
| `/valor/[subjectId]/[attribute]` | Procedencia completa de un valor                                                                             |

Los route groups `(site)`, `(sala)`, `(asiento)` y `(caso)` dan a cada pantalla su propio layout: el sitio con encabezado y navegación (marca la sección actual), el telón sin márgenes y el celular en una columna de 430 px y el caso a todo el ancho. Todo `/api/*` lo reenvía `next.config.ts` a la API; el navegador llama a rutas relativas.

Qué muestra cada pantalla y por qué está ordenada así: [multijugador, «La web»](../../docs/multijugador.md#la-web).

## Estructura

```
src/
├── app/                   rutas y layouts (route groups), globals.css y favicon
├── components/
│   ├── common/            Drawer, ConfirmDialog, ActionMenu, Tabs, SectionHeader, StatusChip, Avatar,
│   │                      RelativeTime, Icon, StateMark, status (chips de estado), CostDelay, LiveBadge,
│   │                      SiteNav, LoadState, link-styles
│   ├── inicio/            SeatPicker y SeatRow
│   ├── sala/              SalaBoard, SummaryStrip, ProposalList, ValueTable, PendingDocuments, SpaceList,
│   │                      ActivityFeed, SealBanner, JoinQr, ProvenanceDrawer
│   ├── asiento/           SeatScreen, Channel (marco y aviso por canal), InboxBodies (voto, respondido,
│   │                      discrepancia, desfase, filtrado), VoteForm, AuthorActions, PresenceBadge
│   ├── presentador/       PresenterConsole, KeyGate, AttentionList, ProposalTable, SeatList
│   ├── conectores/        ConnectorsConsole, SourceRow, LinkSheetForm
│   ├── espacios/          SpaceExplorer, DocumentDrawer, RevisionFacts
│   ├── cambios/           ChangeDetailBody (el detalle, compartido), ChangeResponse, ChangeDetailView,
│   │                      ProposalDrawer
│   ├── cuenta/            AccountPanel, MembersCard, SessionGate (pide la sesión de Auth0)
│   ├── proyectos/         NewProjectForm, ProjectView
│   └── valor/             ValuePage, ProvenanceChain, useChangeIds
├── hooks/                 useRoomPulse, useLive, useResource, useNow, useHeldSeats, useSeatToken,
│                          usePresenterKey
└── lib/                   un módulo por tema, con sus tipos, su cliente tipado y su lógica pura (ver abajo)
```

- `@/*` apunta a `src/*`.
- `next.config.ts` reenvía todo `/api/*` a `API_URL` y transpila los paquetes del workspace (`transpilePackages`). Por eso la web no define rutas en `app/api/`.
- Los tests van junto al código (`*.spec.ts`) e importan `describe`, `it` y `vi` desde `vitest`, para que los tipe el mismo `tsconfig.json` de la app.
- El detalle de una propuesta es un solo componente (`ChangeDetailBody`) que usan la página `/cambios/[id]` y el panel que abren la sala, el presentador y el celular.

## Cliente de la API (`src/lib`)

Cada módulo declara los tipos de las respuestas y las funciones que las piden. `http.ts` pone los encabezados: `x-seat-token` (asiento), `x-presenter-key` (presentador) y `x-action-id` (un UUID por escritura). Los errores llegan como `ApiError` con `status` y `code` (`seat_taken` al tomar un asiento ocupado, `seat_held` cuando otra persona tiene el asiento), y `describeError` los traduce.

| Módulo               | Endpoints                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| `room-api.ts`        | `GET /api/room` (con `lake.empty`), `POST /api/seats/:castId/claim`, `DELETE /api/seats/:castId`, `POST /api/room/reset` |
| `events-api.ts`      | `GET /api/events?after&epoch&seat`                                                                         |
| `baseline-api.ts`    | `GET /api/baseline?section`                                                                                |
| `provenance-api.ts`  | `GET /api/baseline/:subjectId/:attribute/provenance`                                                       |
| `spaces-api.ts`      | `GET /api/spaces`                                                                                          |
| `inbox-api.ts`       | `GET /api/seats/:castId/inbox`                                                                             |
| `proposals-api.ts`   | `GET /api/proposals?status`, `POST /api/proposals/:id/reopen`, `POST /api/proposals/:id/withdraw`           |
| `attention.ts`       | Sin endpoint: junta las disputas y las discrepancias de Fernanda para «Requieren atención»                   |
| `waiting.ts`         | Sin endpoint: recuerda en `localStorage` las discrepancias marcadas con «Esperar el plano»                   |
| `votes-api.ts`       | `POST /api/notifications/:id/response` con `{ kind, note? }`, `POST /api/discrepancies/:id/dismiss`, `POST /api/stale/acknowledge` con `{ revisionId, note }` |
| `aps-api.ts`         | `GET /api/aps/models`, `GET /api/aps/viewer-token`                                                         |
| `changes-api.ts`     | `GET /api/changes/:id`                                                                                     |
| `integrations-api.ts` | `GET /api/integrations/projects/:projectId`, `POST /api/integrations/google/authorize`, `DELETE /api/integrations/google`, `POST /api/integrations/projects/:projectId/sources`, `POST …/sources/:id/check`, `DELETE …/sources/:id`; y lo puro: `pickProject` (el proyecto pedido si es tuyo, o el primero), los avisos de cada acción y el estado de cada planilla |
| `accounts-api.ts`    | `GET /api/me`, `GET /api/projects`, `POST /api/projects` (recorta los textos), `GET /api/projects/:id`, `GET /api/organizations/:id/members`, `POST /api/organizations/:id/invitations`, `projectsByOrganization` (los proyectos bajo cada organización), `initialOrganization` (la del formulario), `projectHref` y `newProjectHref` |

Con el lago vacío (`lake.empty`), `/sala`, `/presentador` y el celular muestran «Esperando la carga inicial» hasta que el ETL carga lo vigente. La web no sube documentos: la tarjeta de desfase dice «Sube la revisión nueva a tu carpeta y la leemos solos» y ofrece «Confirmo sin cambio».

La lógica de las pantallas vive en `lib`, pura y con tests:

- `proposals-api.ts`: la última actividad, quién disputa, qué acciones permite cada estado (`actionsFor`), la separación entre activas e historial y la etiqueta de cada estado (también el `superseded` que trae la procedencia).
- `inbox-api.ts`: qué está pendiente (un voto de una propuesta retirada o reemplazada ya no lo está), los grupos de la bandeja (`groupInbox`) y la bandeja de solo lectura (`publicInbox`), armada con `/api/proposals` y `/api/spaces`, porque `/api/seats/:castId/inbox` exige el asiento.
- `spaces-api.ts`: los documentos pendientes, la última revisión y la búsqueda de un documento por id o por revisión.
- La bandeja de Fernanda (`GET /api/seats/fernanda-lagos/inbox`) se pide con la clave del presentador, que la API trata como Fernanda.

Los formatos (`format.ts`) son es-CL: pesos sin decimales (`$3.636.500`), `1 día` y `4 días`, coma decimal (`8,5 m`), el antes y el después con flecha (`15 cm → 20 cm`) y el tiempo relativo («Hace 2 min»), que `useNow` refresca cada 15 s.

## Cuentas

El login es de Auth0, con `@auth0/nextjs-auth0` en el servidor de Next: la aplicación de Auth0 es una Regular Web Application y el navegador nunca ve el token.

- `lib/auth0.ts` arma el `Auth0Client` solo si están `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET` y `AUTH0_AUDIENCE` (`authConfigured` en `lib/account-routes.ts`); `APP_BASE_URL` es la URL de la web. Pide `openid profile email offline_access` y un access token para la audiencia de la API. Sin esas variables, `auth0` es `null`: no hay `/auth/*`, `/cuenta` avisa y el resto de la web funciona igual.
- `src/proxy.ts` (el `middleware` de Next 16) monta `/auth/login`, `/auth/callback` y `/auth/logout` y mantiene viva la sesión. A las rutas de cuenta de la API (`/api/me`, `/api/projects`, `/api/organizations/*`, `/api/integrations/projects/*` y `/api/integrations/google/*`, `needsAccountToken`) les agrega `Authorization: Bearer <access token>` antes del `rewrite`. Las de la sala no lo llevan.
- `/cuenta`, `/proyectos/*` y `/conectores` revisan la sesión en el servidor con `SessionGate`: sin Auth0 avisa, sin sesión muestra «Entrar con tu correo» (`/auth/login?returnTo=<la ruta>`) y con sesión muestra la página. `AccountPanel`, `AutodeskCard`, `MembersCard`, `NewProjectForm` y `ProjectView` piden los datos a la API desde el navegador.
- `AutodeskCard` muestra, por organización, si su cuenta de Autodesk está conectada y como quién (`lib/autodesk-api.ts`). Un administrador ve «Conectar cuenta de Autodesk» (o «Volver a conectar» si Autodesk dejó de aceptarla) y «Desconectar». Conectar pide la URL a `POST /api/organizations/:id/integrations/aps/authorize` y navega a Autodesk; Autodesk vuelve a `/api/integrations/aps/callback`, que el `rewrite` lleva a la API, y la API redirige a `/cuenta?autodesk=conectada` o `?autodesk=error&motivo=…`, que la página muestra como aviso (`callbackNotice`). El callback no lleva el token de Auth0: lo protege el `state` y una cookie de la API.
- En Auth0: Allowed Callback URLs `http://localhost:3000/auth/callback`, Allowed Logout URLs y Web Origins `http://localhost:3000`, y una API cuyo identificador es `AUTH0_AUDIENCE`. En esa API, pestaña Application Access, la aplicación tiene que quedar con User Access en Authorized: si no, Auth0 corta el login con «Client … is not authorized to access resource server …».

## El flujo del caso

Todo el acceso a `/api/flow` vive en `lib/flow-api.ts` (tipos y llamadas: `getFlow`, `postMinute`, `acceptProposal`, `rejectProposal`, `postPresence`, `resetFlow`). `useFlow` lo mantiene vivo con `useLive`: cada evento de la sala vuelve a pedir `GET /api/flow`.

- `lib/case-plan.ts`: geometría pura del plano (metros a coordenadas SVG, con el norte arriba, 100 unidades por metro), choque entre cajas y desplazamiento de la bandeja.
- `lib/case-view.ts`: textos y formatos del caso (`describeMove`, `formatCostLine`, la línea de tiempo de Paula).
- `components/caso/CasePlan.tsx`: el plano en SVG con `viewBox`. Dibuja los ejes 5, 6 y B, P-12 (con su posición anterior punteada), la bandeja E-B-03, el colector B2, el choque achurado en rojo y el arreglo propuesto como fantasma verde. Al aceptarse la propuesta, el tramo de 6 m se desliza a su nueva posición y se une al tramo fijo con dos quiebres de 45°. La API entrega solo el tramo movible; el tramo fijo se dibuja desde x = 24,9 m, a la derecha del colector (`fixedTrayRange` en `lib/case-plan.ts`).
- `CamilaView` avisa su presencia (`viewing: 'propuesta'` mientras la tarjeta está a la vista, `'plano'` si no) cada 8 s y al volver a la pestaña. Solo con asiento propio; la vista del presentador no la envía y muestra la presencia de Camila a partir de `flow.presence`. El paso 3 de la línea de tiempo de Paula requiere el asiento real de Camila abierto en su dispositivo.
- Si el token de un asiento deja de valer (401 al actuar o al avisar presencia), `CaseScreen` lo borra y vuelve a tomar el asiento solo. «Reiniciar caso» deja el hilo del presentador en el último `flow.reset`.
- El caso no muestra bots.
- **Historia**: `components/caso/HistoryPanel.tsx` muestra, para P-12 y E-B-03, cada valor vigente con hora, autor, documento o minuta y quién lo aprobó, la propuesta pendiente o rechazada en una entrada punteada y el enlace «Ver procedencia» a `/valor/[subjectId]/ubicacion_m`. Va bajo la línea de tiempo en la pantalla de Paula, bajo el plano o la propuesta en la de Camila y a todo el ancho en `/caso`. Lee `GET /api/flow/history` con `hooks/use-flow-history.ts`, que vuelve a pedirla cuando cambian la época, el estado de la propuesta o la minuta (`historyKey` en `lib/flow-history.ts`). Si la historia no carga, el panel no se muestra y el flujo sigue.

## Tiempo real

`useRoomPulse` consulta `GET /api/events?after=<seq>&epoch=<n>&seat=<castId>` cada 700 ms en `/sala` y cada 1000 ms en el resto, con ±150 ms de jitter. Manda `x-seat-token` si el visitante tiene asiento: es su latido. La lógica pura vive en `lib/pulse.ts`:

- `applyPulse` fija época y cursor en la primera respuesta, descarta los eventos ya vistos, mantiene el ticker (40 eventos) y marca el reinicio con `reset: true` o con un cambio de época.
- `nextDelay` suma el jitter y, tras errores, retrocede hasta 3 s.
- Cada sondeo lleva un `AbortController`; con la pestaña oculta se pausa y al volver se consulta de inmediato.

`useLive` carga los datos de una pantalla y los vuelve a pedir cuando llegan eventos. Con `reset: true` recarga todo; los celulares borran sus tokens y vuelven a `/`.

## Visor BIM

`BimViewer` (`components/modelos`) carga el visor de APS v7 desde el CDN de Autodesk (`lib/aps-viewer.ts`), con `AutodeskProduction2` y `streamingV2` para SVF2, y pide el token a `/api/aps/viewer-token`. De cada modelo abre la última vista maestra (la fase final, «New Construction» en Snowdon Towers), o si no hay, `{3D}` o la primera vista 3D; un modelo sin vista 3D aparece como error y los demás cargan igual. Carga cada disciplina con `keepCurrentModels` y `applyRefPoint`, y con el `globalOffset` del primer modelo: los de Snowdon Towers comparten coordenadas y quedan alineados. Al abrir carga solo Arquitectura (`PRIMARY_DISCIPLINE`; si no está, el primer modelo): es el modelo principal y fija el offset. Las demás disciplinas parten apagadas y se cargan la primera vez que se encienden; después se ocultan y se muestran sin volver a cargar.

`onReady` entrega un `ViewerControls`, que nombra cada elemento como `{ discipline, dbId }`:

- `ensureLoaded` carga una disciplina si falta y la deja visible (para resaltar en un modelo que todavía no se abrió). `disciplines` lista las cargadas.
- `setDisciplineVisible` muestra u oculta una disciplina ya cargada.
- `resolveExternalIds` traduce `uniqueId` de Revit (el `externalId` del visor, el mismo de la minuta) a elementos, buscando en las disciplinas cargadas.
- `getProperties`, `select`, `isolate` (vacío muestra todo), `highlight` (color RGBA de 0 a 1), `clearHighlights`, `fitTo` y `reset`.

`onSelectionChange` entrega la selección con la misma forma.

## Visor del caso

`CaseModelView` (`components/caso`) muestra el paso 5 del flujo en el visor de APS: el pilar P-12 y la bandeja E-B-03 en sus modelos. Recibe el `FlowState` (`flow`, o `null`) y, opcionalmente, `models`, `externalIds` (id del caso a `uniqueId` de Revit) y `axes`. La lógica vive en `lib/aps-viewer-flow.ts`:

- `selectCaseModels` busca en `GET /api/aps/models` los archivos que empiezan con `caso-estructura` (disciplina `structural`) y `caso-electrico` (`electrical`). Si no están, el componente muestra «Modelos del caso no cargados: se muestra el plano 2D» y no abre el visor. Cada pantalla de `/caso/[castId]` lo pone debajo de su vista con `hideWhenMissing`: sin modelos del caso, o si el visor falla, no muestra nada y basta el plano SVG. La vista del presentador no lo carga.
- `planScene` decide, solo desde el `FlowState`, qué hacer: P-12 se mueve el delta del cambio cuando hay cambio; E-B-03 se mueve el delta de la propuesta cuando está `aplicada` o `resuelta`; el par en choque (`detectada`) va en rojo, y la bandeja aplicada en verde. Si la propuesta se rechaza, la bandeja no se mueve.
- `createCaseScene` abre estructura primero (fija el `globalOffset`), espera `geometryLoaded` (20 s como tope) y entrega `apply(plan)`, que desliza el elemento 0,9 s y repinta. Cada pantalla reaplica el estado completo, sin depender de lo que hizo la otra.
- Un elemento se busca por `externalIds[id]` y, si no, por la propiedad `Mark` (`findByMark`, con coincidencia exacta). `getWorldBoundsMeters` devuelve la caja en metros, con el `globalOffset` y la unidad del modelo.
- Los deltas del caso están en metros, x este, y norte, z arriba. `axes` (`axesRotatedBy(grados)`) los gira si el norte de Revit no coincide con el eje y del visor.
- El visor no clona geometría: la posición propuesta (antes de aceptar) no se dibuja en 3D; el plano SVG muestra el fantasma.

Llamadas del visor «a verificar» contra una corrida real en el navegador:

- `Model.search(text, onSuccess, onError, ['Mark', 'Marca'])` y que `Mark` sea la propiedad de la marca.
- `Model.getObjectTree`, `InstanceTree.enumNodeFragments(dbId, cb, true)` y `FragmentList.getWorldBounds`.
- `FragmentList.updateAnimTransform(fragId, undefined, undefined, translation)` para mover, y `updateAnimTransform(fragId)` sin argumentos para devolver; `viewer.impl.sceneUpdated(true)`.
- Que la traslación esté en unidades del modelo y no en metros, y que no la afecte el `globalOffset`.
- `Model.getUnitScale()` (metros por unidad) y `getUnitString()`.
- Que `getWorldBounds` no incluya la traslación animada.
- El evento `geometryLoaded` y que el `externalId` del modelo traducido sea el `UniqueId` de Revit.
- La orientación de «norte» respecto del eje y del visor (`axes`).

Para cargar los modelos del caso: subir a APS `caso-estructura.rvt` (con el pilar de marca `P-12`) y `caso-electrico.rvt` (con la bandeja de marca `E-B-03`) como los demás (`pnpm aps:models`), de modo que `GET /api/aps/models` los liste con la disciplina correcta.

## Almacenamiento

- El token de cada asiento vive en `localStorage` bajo `sala:asiento:<castId>` (`lib/seat-storage.ts`). Todo acceso va con `try/catch`: si el navegador no deja guardar, el token sigue en memoria mientras dure la pestaña y la pantalla muestra «Tu navegador no deja guardar el asiento». Sin token, `/asiento/[castId]` queda en solo lectura.
- La clave del presentador vive en `sessionStorage` bajo `sala:presentador`; se pide una vez por pestaña y se borra si la API la rechaza.

## Diseño

- Menos contenedores: tablas, listas y divisores antes que tarjetas. Las tarjetas quedan para objetos que se tocan (una propuesta en la sala) y los paneles del costado.
- Las acciones van junto a lo que operan: votar dentro del aviso, reabrir dentro de la disputa, retirar en el menú de la fila. Solo se muestran las que permite el estado.
- Retirar, descartar y reiniciar piden confirmación (`ConfirmDialog`).
- Lo que disputa o pide atención va en rojo para que no pase inadvertido: «Tengo un problema» y «Esperar el plano» en `critical` (rojo lleno), y «Descartar» en `danger`.
- `Drawer` es un panel a la derecha y, en el celular, ocupa la pantalla entera. Se cierra con Esc, con la X o tocando afuera, y devuelve el foco a donde estaba.
- Los estados siempre llevan icono y texto, nunca solo color (`StatusChip`, `StateMark`).
- `/sala` agranda la tipografía con el ancho de la pantalla (`html:has(.sala-root)` en `globals.css`) y respeta el modo oscuro del tema de `@team27/ui`.
- Las tablas esconden columnas en pantallas chicas y pasan ese dato bajo la columna principal: nada se desplaza de lado.
- Los canales (correo, chat, canal de equipo) cambian el aspecto, no el contenido, y no usan logos ni marcas.
- `JoinQr` codifica `window.location.origin + '/'` e imprime la URL al lado.
- `next dev` en marcha reescribe `.next/dev/types` y rompe `next build` (`TS6196` en `validator.ts`): detén el `dev` antes de correr el build.

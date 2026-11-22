# @team27/web

El panel de Vigente: Next.js 16 (App Router, Turbopack), React 19 y Tailwind 4, con el tema y los componentes de [`@team27/ui`](../../packages/ui/README.md). Los datos los pide a la [API](../api/README.md). Todo lo que muestra es de tu cuenta: tus organizaciones, sus proyectos y lo que pasa en cada uno.

## Comandos

```sh
pnpm dev:web                          # http://localhost:3000 (o pnpm dev, con la API)
pnpm nx run @team27/web:build         # typecheck de sus dependencias y next build
pnpm nx run @team27/web:start         # sirve el build
pnpm nx run @team27/web:lint
pnpm nx run @team27/web:test          # Vitest: los *.spec.ts de src/
```

## Rutas

| Ruta | Qué es |
| ---- | ------ |
| `/` | Redirige a `/cuenta` |
| `/cuenta` | Tu cuenta: entrar con tu correo (sin contraseña, con Auth0), tus organizaciones con tu rol, sus proyectos (cada uno se abre en `/proyectos/[projectId]`) con «Crear proyecto», la conexión con Autodesk, el equipo con las invitaciones pendientes y, si eres administrador, invitar un correo, conectar la cuenta de Autodesk de la organización, «Crear organización» y «Eliminar» la organización (con confirmación; la API no deja eliminar una con proyectos ni tu única organización). Sin Auth0 configurado, avisa que las cuentas no están activas. Si eres superadmin, un acceso a `/admin` |
| `/admin` | La administración de la plataforma, solo para superadmins (pide sesión como `/cuenta`): las organizaciones con sus miembros y proyectos y el formulario para crear una; «Crear un usuario», que invita un correo a una organización con su rol; y todos los usuarios con sus organizaciones y las invitaciones pendientes, con búsqueda por nombre o correo (sin tildes ni mayúsculas). A quien no es superadmin le dice que la sección no es para su cuenta |
| `/organizaciones/nueva` | Crear una organización: solo el nombre. Quedas como su administrador y vuelves a `/cuenta`. Si no administras ninguna organización, la página dice que no puedes |
| `/proyectos/nuevo` | Crear un proyecto: organización (si eres parte de más de una; `?organizacion=` elige cuál), nombre, lugar y descripción. Al crearlo, abre el proyecto. Pide sesión como `/cuenta` |
| `/proyectos/[projectId]` | Un proyecto de tus organizaciones: nombre, organización, lugar, descripción y fecha de creación, con «Archivos», «Espacios» y «Tus proyectos»; el equipo del proyecto (`TeamCard`), y el aviso de que todavía no tiene documentos ni mapa de dependencias. Un admin de la organización o quien creó el proyecto ve «Editar» (nombre, lugar y descripción), «Agregar al equipo» (alguien de la organización que no esté, con su rol en el proyecto) y «Quitar» (con confirmación; no a quien lo creó). Pide sesión como `/cuenta` |
| `/proyectos/[projectId]/archivos` | Los archivos que escucha el proyecto (`ProjectFiles`). Google Sheets: sus planillas vinculadas, con la última revisión, el último cambio, quién lo hizo («Lo editó», si Google lo informa), cómo llegan los avisos de Google («Al instante», con la hora en que vence la suscripción, o «Revisión periódica») y el error, con «Revisar ahora» y «Desvincular»; la tarjeta dice si Google avisa al instante, cada cuántos segundos revisa o que la revisión automática está apagada. Con tu cuenta de Google conectada, «Vincular planilla» por su link; sin ella, «Conectar con Google», que vuelve aquí con `?google=conectado` o `?google=error&motivo=`. Autodesk Construction Cloud aparece como próximamente. Recarga las planillas cada 15 s. Pide sesión como `/cuenta` |
| `/proyectos/[projectId]/espacios` | Los espacios del proyecto y sus documentos; el documento se abre en un panel. Acepta `?espacio=`, `?documento=` y `?revision=`. Sin espacios, dice que todavía no hay |
| `/proyectos/[projectId]/cambios/[id]` | El detalle de una propuesta de cambio. Si el cambio te avisó a ti, destaca tus hallazgos y, mientras la propuesta siga activa, muestra «Tu respuesta» con «Revisado», «Tengo un problema» y «No me afecta». Quien dijo que no le afecta aparece en «Revisión y consenso» con su nota, no en «A quién no avisamos». Debajo, `ChangeAnalysis` muestra a quién más afecta (`/suggestions`), con qué otros cambios choca (`/conflicts`, y arriba cada solapamiento de la propuesta con sus votos y, solo para quien lo valida y aún no vota, los botones «Se tocan» y «No se tocan», en `OverlapVotes.tsx`) y cuánto cuesta y atrasa: el impacto del cambio, el impacto junto con cada cambio con que choca y un mensaje por cada atributo sin regla de costo o de plazo, y al final qué decir a cada rol (`/notices`), en dos grupos: «Aviso de cambio», con una tarjeta por afectado, y «Aviso de conflicto», con una por cada autor y afectado de un choque, cada aviso escrito para su rol y su canal y, debajo, lo que hizo el Notificador con él: por qué canal salió, si está en cola o por qué no se envió. Cierra «Seguimiento» (`ChangeFollowUp.tsx`): quién confirmó, objetó, dijo que no le afecta o falta, a quién se le recordó y cuántas veces, a quién se escaló, y los avisos que recibió el autor |
| `/proyectos/[projectId]/valor/[subjectId]/[attribute]` | La procedencia completa de un valor vigente |
| `/privacidad` | La política de privacidad pública de los conectores: qué lee y guarda Vigente de Google y Autodesk, para qué, y cómo desconectar o pedir que se borre. Es la URL que declara la app de OAuth de Google |
| `/conectores`                    | Las cuentas que conectas (con tu cuenta; sin sesión, pide entrar): tu cuenta de Google, con «Conectar con Google» o «Desconectar» (con confirmación), y Autodesk como próximamente, con un enlace a `/cuenta`, donde cada organización conecta su cuenta de Autodesk. Abajo, tus proyectos, cada uno con un enlace a sus archivos: las planillas se vinculan en cada proyecto. Vuelve de Google con `?google=conectado` o `?google=error&motivo=` |

Las pantallas de un proyecto piden sesión con `SessionGate` y van dentro de `ProjectProvider` (`components/proyectos/ProjectContext.tsx`): sus componentes leen el proyecto con `useProjectId()` y arman sus rutas con `lib/project-paths.ts` (`projectApi` para la API, `projectPage` para la web).

El route group `(site)` les da a todas las pantallas el encabezado con la marca, la frase «Lo que vale hoy en tu obra» y la navegación, que marca la sección actual. El layout revisa la sesión en el servidor. Sin sesión, `SiteNav` muestra solo «Entrar» (`/auth/login?returnTo=<la página>`); sin Auth0 configurado, solo Cuenta, que avisa qué falta. Con sesión pide `GET /api/me` y `navLinks` (`lib/nav.ts`) arma los links según el rol: Conectores si eres member o admin de alguna organización, Admin si eres superadmin, y siempre Cuenta. Mientras carga, solo Cuenta. Todo `/api/*` lo reenvía `next.config.ts` a la API; el navegador llama a rutas relativas.

## Estructura

```
src/
├── app/                   rutas y layouts, globals.css y favicon
├── components/
│   ├── common/            Drawer, ConfirmDialog, ActionMenu, Tabs, SectionHeader, StatusChip, Avatar,
│   │                      RelativeTime, Icon, StateMark, status (chips de estado), CostDelay, ValueLink,
│   │                      SiteNav, LoadState (Loading, LoadError, Empty, EmptyPanel), link-styles
│   ├── admin/             AdminPanel, OrganizationsCard, InviteCard, UsersCard
│   ├── archivos/          ProjectFiles, SourceRow, LinkSheetForm
│   ├── conectores/        ConnectorsConsole
│   ├── espacios/          SpaceExplorer, DocumentDrawer, RevisionFacts
│   ├── cambios/           ChangeDetailView, ChangeDetailBody, ChangeAnalysis, ChangeResponse, VoteForm
│   ├── cuenta/            AccountPanel, MembersCard, NewOrganizationForm, AutodeskCard, SessionGate
│   │                      (pide la sesión de Auth0)
│   ├── proyectos/         NewProjectForm, ProjectView, TeamCard, ProjectContext (ProjectProvider y useProjectId)
│   └── valor/             ValuePage, ProvenanceChain, useChangeIds
├── hooks/                 useLive, useProjectPulse, useResource, useNow
├── proxy.ts               las rutas de Auth0 y el token para la API
└── lib/                   un módulo por tema, con sus tipos, su cliente tipado y su lógica pura (ver abajo)
```

- `@/*` apunta a `src/*`.
- `next.config.ts` reenvía todo `/api/*` a `API_URL` y transpila los paquetes del workspace (`transpilePackages`). Por eso la web no define rutas en `app/api/`.
- Los tests van junto al código (`*.spec.ts`) e importan `describe`, `it` y `vi` desde `vitest`, para que los tipe el mismo `tsconfig.json` de la app.

## Cliente de la API (`src/lib`)

Cada módulo declara los tipos de las respuestas y las funciones que las piden. `http.ts` pone los encabezados (`accept`, `content-type` si hay cuerpo y `x-action-id`, un UUID por escritura); el token de la cuenta lo agrega `proxy.ts` en el servidor. Los errores llegan como `ApiError` con `status` y `code`, y `describeError` los traduce (por ejemplo, `not_on_team`: «No eres parte del equipo de este proyecto»).

| Módulo | Endpoints |
| ------ | --------- |
| `project-paths.ts` | Sin endpoint: `projectApi(projectId, path)` (`/api/projects/<id><path>`) y `projectPage(projectId, path)` (`/proyectos/<id><path>`) |
| `spaces-api.ts` | `GET /api/projects/:projectId/spaces` |
| `changes-api.ts` | `GET /api/projects/:projectId/changes/:id` |
| `proposals-api.ts` | `GET /api/projects/:projectId/proposals?status` |
| `provenance-api.ts` | `GET /api/projects/:projectId/baseline/:subjectId/:attribute/provenance`, y `valuePath` (la página del valor) |
| `votes-api.ts` | `POST /api/projects/:projectId/notifications/:id/response` con `{ kind, note? }` |
| `events-api.ts` | `GET /api/projects/:projectId/events?after` |
| `baseline-api.ts` | Sin endpoint: el estado de un valor vigente (`ValueStatus`) |
| `integrations-api.ts` | `GET /api/integrations/projects/:projectId`, `GET /api/integrations/google`, `POST /api/integrations/google/authorize` (con el proyecto, o sin él desde `/conectores`), `DELETE /api/integrations/google`, `POST /api/integrations/projects/:projectId/sources`, `POST …/sources/:id/check`, `DELETE …/sources/:id`; y lo puro: `listeningText` (cómo nos enteramos de los cambios), los avisos de cada acción y el estado de cada planilla |
| `accounts-api.ts`    | `GET /api/me`, `GET /api/projects`, `POST /api/projects` (recorta los textos), `GET /api/projects/:id`, `GET /api/organizations/:id/members`, `POST /api/organizations/:id/invitations`, `projectsByOrganization` (los proyectos bajo cada organización), `initialOrganization` (la del formulario), `projectHref` y `newProjectHref` |
| `admin-api.ts`       | `GET /api/admin/users`, `GET /api/admin/organizations`, `POST /api/admin/organizations`, `POST /api/admin/invitations`, y `filterAdminUsers` (la búsqueda de `/admin`) |

La lógica de las pantallas vive en `lib`, pura y con tests:

- `proposals-api.ts`: la etiqueta de cada estado (también el `superseded` que trae la procedencia) y cuáles siguen activos.
- `spaces-api.ts`: los documentos pendientes, la última revisión y la búsqueda de un documento por id o por revisión.

Los formatos (`format.ts`) son es-CL: pesos sin decimales (`$3.636.500`), `1 día` y `4 días`, coma decimal (`8,5 m`), el antes y el después con flecha (`15 cm → 20 cm`) y el tiempo relativo («Hace 2 min»), que `useNow` refresca cada 15 s.

## Cuentas

El login es de Auth0, con `@auth0/nextjs-auth0` en el servidor de Next: la aplicación de Auth0 es una Regular Web Application y el navegador nunca ve el token.

- `lib/auth0.ts` arma el `Auth0Client` solo si están `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET` y `AUTH0_AUDIENCE` (`authConfigured` en `lib/account-routes.ts`); `APP_BASE_URL` es la URL de la web. Pide `openid profile email offline_access` y un access token para la audiencia de la API. Sin esas variables, `auth0` es `null`: no hay `/auth/*` y las páginas que piden sesión avisan que las cuentas no están configuradas.
- `src/proxy.ts` (el `middleware` de Next 16) monta `/auth/login`, `/auth/callback` y `/auth/logout` y mantiene viva la sesión. A las rutas de cuenta de la API (`/api/me`, `/api/projects` y todo lo que cuelga de un proyecto, `/api/organizations/*`, `/api/admin/*`, `/api/integrations/projects/*` y `/api/integrations/google/*`, `needsAccountToken`) les agrega `Authorization: Bearer <access token>` antes del `rewrite`. Las vueltas de OAuth no lo llevan.
- `/cuenta`, `/proyectos/*`, `/conectores` y `/admin` revisan la sesión en el servidor con `SessionGate`: sin Auth0 avisa, sin sesión muestra «Entrar con tu correo» (`/auth/login?returnTo=<la ruta>`) y con sesión muestra la página. Si la API responde 403 `not_invited` (el correo no tiene invitación), la página lo dice; en `/cuenta` queda «Salir» para entrar con otro correo. `AccountPanel`, `AutodeskCard`, `MembersCard`, `NewOrganizationForm`, `NewProjectForm`, `ProjectView`, `ProjectFiles` y las pantallas de un proyecto piden los datos a la API desde el navegador. `AdminPanel` primero pregunta a `GET /api/me` si la cuenta es superadmin.
- `AutodeskCard` muestra, por organización, si su cuenta de Autodesk está conectada y como quién (`lib/autodesk-api.ts`). Un administrador ve «Conectar cuenta de Autodesk» (o «Volver a conectar» si Autodesk dejó de aceptarla) y «Desconectar». Conectar pide la URL a `POST /api/organizations/:id/integrations/aps/authorize` y navega a Autodesk; Autodesk vuelve a `/api/integrations/aps/callback`, que el `rewrite` lleva a la API, y la API redirige a `/cuenta?autodesk=conectada` o `?autodesk=error&motivo=…`, que la página muestra como aviso (`callbackNotice`). El callback no lleva el token de Auth0: lo protege el `state` y una cookie de la API.
- En Auth0: Allowed Callback URLs `http://localhost:3000/auth/callback`, Allowed Logout URLs y Web Origins `http://localhost:3000`, y una API cuyo identificador es `AUTH0_AUDIENCE`. En esa API, pestaña Application Access, la aplicación tiene que quedar con User Access en Authorized: si no, Auth0 corta el login con «Client … is not authorized to access resource server …».
- Al responder un aviso, la persona es tu cuenta: `ChangeDetailView` pide `GET /api/me` y busca el aviso cuyo `stakeholderId` es tu id. Si el cambio no te avisó, la página queda de solo lectura.

## Tiempo real

`useProjectPulse` consulta `GET /api/projects/:projectId/events?after=<seq>` cada 1000 ms, con ±150 ms de jitter. La lógica pura vive en `lib/pulse.ts`:

- `applyPulse` fija el cursor en la primera respuesta, descarta los eventos ya vistos, guarda los últimos 40 eventos y marca el reinicio con `reset: true` (el cursor del cliente quedó por delante del servidor).
- `nextDelay` suma el jitter y, tras errores, retrocede hasta 3 s.
- Cada sondeo lleva un `AbortController`; con la pestaña oculta se pausa y al volver se consulta de inmediato.

`useLive` carga los datos de una pantalla y los vuelve a pedir cuando llegan eventos de su proyecto; con `reset: true` recarga todo. Sin `projectId` no sondea: `ProjectFiles` lo usa así y recarga sus planillas cada 15 s.

## Diseño

- Menos contenedores: tablas, listas y divisores antes que tarjetas. Las tarjetas quedan para objetos que se tocan y los paneles del costado.
- Las acciones van junto a lo que operan: responder dentro del aviso, desvincular en la fila de la planilla. Solo se muestran las que permite el estado.
- Lo que no se deshace pide confirmación (`ConfirmDialog`): desvincular una planilla, desconectar tu cuenta de Google o eliminar una organización.
- Lo que disputa o pide atención va en rojo para que no pase inadvertido: «Tengo un problema» en `critical` (rojo lleno).
- `Drawer` es un panel a la derecha y, en el celular, ocupa la pantalla entera. Se cierra con Esc, con la X o tocando afuera, y devuelve el foco a donde estaba.
- Los estados siempre llevan icono y texto, nunca solo color (`StatusChip`, `StateMark`).
- Las tablas esconden columnas en pantallas chicas y pasan ese dato bajo la columna principal: nada se desplaza de lado.
- La web respeta el modo oscuro del tema de `@team27/ui`.
- `next dev` en marcha reescribe `.next/dev/types` y rompe `next build` (`TS6196` en `validator.ts`): detén el `dev` antes de correr el build.

# Despliegue

Vigente corre en tres piezas: la web en Vercel ([`hack-team-27.vercel.app`](https://hack-team-27.vercel.app)), y la API ([`vigente-api.onrender.com`](https://vigente-api.onrender.com/api/health)) y su Postgres en Render.

```mermaid
flowchart LR
  P[Navegador] -->|HTTPS| W[Web · Vercel]
  W -->|rewrite /api/*| A[API · Render]
  A --> D[(Postgres · Render)]
```

## El repo espejo

Vercel y Render solo se conectan a repositorios propios: no pueden acceder al repo de la organización `platanus-hack`. El código se espeja en [`agustin-rios/hack-team-27`](https://github.com/agustin-rios/hack-team-27), y los dos servicios se conectan desde la cuenta dueña del espejo. Los commits quedan en el repo de la organización para el jurado y el deploy corre desde el espejo, así que el `main` de los dos tiene que ser el mismo.

Cada push a `main` del repo de la organización, incluido el merge de un PR en GitHub, corre [`mirror.yml`](../.github/workflows/mirror.yml): si el espejo no tiene ese commit, lo empuja sin forzar. Necesita el secret `MIRROR_TOKEN`:

1. La cuenta dueña del espejo crea un fine-grained personal access token solo para `hack-team-27`, con Contents y Workflows en Read and write. Workflows hace falta porque el push lleva los archivos de `.github/workflows`.
2. Alguien con admin en el repo de la organización lo guarda como `MIRROR_TOKEN` en Settings → Secrets and variables → Actions.

Sin el secret, la Action termina con un aviso y el espejo se queda atrás. Mientras tanto, después de mergear un PR en GitHub, quien mergea corre `git pull && git push` desde un clon con el doble push, que actualiza ambos repos con un solo `git push`:

```bash
git remote set-url --add --push origin https://github.com/platanus-hack/platanus-hack-26-cl-team-27.git
git remote set-url --add --push origin https://github.com/agustin-rios/hack-team-27.git
git remote -v    # origin tiene un fetch y dos push
```

El espejo está al día cuando `git ls-remote https://github.com/agustin-rios/hack-team-27.git main` da el mismo commit que `git ls-remote origin main`. Si `mirror.yml` falla al empujar, o el token venció, o el espejo tiene commits que la organización no tiene porque alguien empujó solo al espejo: llévalos al repo de la organización y vuelve a correr la Action.

Si cambia el dueño del espejo, cambia `MIRROR_REPO` en `mirror.yml` y el token, y saca la URL vieja del doble push con `git remote set-url --delete --push origin <url>`. GitHub redirige la URL vieja al repo transferido, así que dejarla solo empuja dos veces al mismo repo.

## La API y la base en Render

[`render.yaml`](../render.yaml) es un Blueprint: declara el servicio `vigente-api` y el Postgres `vigente-db`, los dos en Virginia y en el plan gratis.

- **La imagen** ([`apps/api/Dockerfile`](../apps/api/Dockerfile), con la raíz como contexto) instala el workspace completo y compila con `pnpm nx run @team27/api:build`. Node ejecuta los contextos y `data/main` como TypeScript y no quita tipos dentro de `node_modules`, así que la imagen no puede usar `pnpm deploy` ni podar el workspace.
- **Al arrancar** corre `prisma migrate deploy`, después `node seed/main.ts --si-no-hay` y después `node dist/main.js`. Con `--si-no-hay`, la semilla crea la organización Constructora Cordillera, sin proyectos ni personas, solo si la base no tiene ninguna organización; si alguien la borra, no vuelve en el siguiente deploy. Las personas reales entran como superadmins (`SUPERADMIN_EMAILS`) o por invitación desde `/admin` o `/cuenta`. Las migraciones y la semilla no tienen un paso aparte.
- **Migraciones con la API anterior viva.** Prisma no envuelve una migración en una transacción: cada instrucción queda confirmada apenas corre, y durante el deploy la instancia anterior sigue atendiendo. Si una migración vacía una tabla que la API escribe al atender y después le agrega una columna `NOT NULL`, la API anterior puede volver a insertar una fila entre las dos instrucciones. Entonces la migración queda fallida, la API nueva no arranca y todo deploy siguiente falla con `P3009`. Mientras tanto sigue sirviendo la versión anterior, que responde 200 al leer y 500 al escribir. Una migración así se aplica sin tráfico:
  1. Suspende `vigente-api`.
  2. Desde un checkout del commit que se va a desplegar, sin `.env`, corre `pnpm --filter @team27/data-main exec prisma migrate deploy` y, en `data/main`, `node seed/main.ts --si-no-hay`. Usa la URL externa de `vigente-db` (Connect → External, con `?sslmode=require`). La `DATABASE_URL` del servicio es la interna y solo funciona dentro de Render.
  3. Resume y Deploy latest commit. Al arrancar, la migración y la semilla no tienen nada que hacer.

  Si una migración ya quedó fallida y los datos se pueden perder, primero deja la base vacía (`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`) y después sigue los mismos pasos.

- **Una sola instancia.** El registro de `x-action-id`, los estados de OAuth, el sondeo de las planillas y la última versión de cada una viven en la memoria del proceso.
- **Se despliega en cada push**, salvo cuando el cambio solo toca la web, la CLI de APS, `packages/`, `docs/`, archivos Markdown o los archivos de la entrega (`platanus-hack-project.jsonc` y `project-logo.png`) (`buildFilter`). Así, editar la entrega a última hora no reinicia la API ni su estado en memoria.
- **El plan gratis** se duerme tras 15 minutos sin peticiones y tarda cerca de un minuto en despertar, con 0,1 CPU. Con una pantalla de un proyecto abierta, el sondeo de eventos la mantiene despierta. Si se pone lenta, sube el servicio a Starter en el panel. El Postgres gratis vence a los 30 días.

| Variable                                   | Valor                                                                                             | Por qué                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                 | `production`                                                                                      | Activa las reglas de producción del schema de la API                                                                                                                                                                                                                                                                               |
| `API_PORT`                                 | `10000`                                                                                           | El puerto que Render espera                                                                                                                                                                                                                                                                                                        |
| `DATABASE_URL`                             | La del Postgres `vigente-db`                                                                      | La conexión interna de Render                                                                                                                                                                                                                                                                                                      |
| `CORS_ALLOW_ORIGINS`                       | `https://hack-team-27.vercel.app`, la de la web                                                   | El navegador habla con la API a través del `rewrite` de la web; en producción solo importa que no sea `*`                                                                                                                                                                                                                          |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Las del cliente web de Google Cloud; `sync: false` en `render.yaml`, así que se ponen en el panel | Activan el conector de Google Sheets ([integrations](../context/integrations/README.md#configurar-google)), junto con `INTEGRATIONS_ENCRYPTION_KEY`. Sin ellas, `/conectores` dice que falta configurar Google                                                                                                                     |
| `INTEGRATIONS_ENCRYPTION_KEY`              | La genera Render (`generateValue`)                                                                | La clave con que la API cifra los refresh tokens de Google en Postgres (pide 16 caracteres o más; Render da más). Si la cambias, cada persona vuelve a conectar su cuenta de Google                                                                                                                                                |
| `GOOGLE_REDIRECT_URI`                      | `https://hack-team-27.vercel.app/api/integrations/google/callback`, fijo en `render.yaml`         | Tiene que ser la misma que la registrada en el cliente de Google Cloud. Pasa por la web, como el callback de Autodesk                                                                                                                                                                                                              |
| `GOOGLE_WEBHOOK_URL`                       | `https://vigente-api.onrender.com/api/integrations/google/notifications`, fijo en `render.yaml`   | Activa los avisos al instante de Google Drive. Si la API duerme (plan gratis), el primer aviso la despierta y Drive lo reintenta; el sondeo de respaldo cubre lo que se pierda                                                                                                                                                     |
| `ANTHROPIC_API_KEY`                        | Opcional; se agrega en el panel de Render                                                         | Con ella, Claude lee el texto libre (WhatsApp, folios, actas). Sin ella y con `GEMINI_API_KEY` (de Google AI Studio, y `GEMINI_MODEL` opcional), lo lee Gemini. Sin ninguna, una revisión con un fragmento de texto libre responde `503 inference_unavailable`                                                                     |
| `APS_CLIENT_ID`, `APS_CLIENT_SECRET`       | Las del `.env` de quien corrió `pnpm aps:models`                                                  | Sin ellas la API arranca, pero las rutas de `/api/aps` responden 503 y `/modelos` no carga. La API lista los modelos traducidos del bucket, y un bucket es de la app que lo creó: con las credenciales de otra app, APS no se lo muestra                                                                                           |
| `APS_BUCKET_KEY`                           | `vigente-8b87f1a2b6424d31`, fijo en `render.yaml`                                                 | El bucket del equipo, el mismo de `.env.example`. No es secreto, así que el Blueprint lo declara con su valor; Render lo pone al crear el servicio, pero en uno que ya existe no lo agrega con un push: se pone a mano en Environment o con Manual Sync del Blueprint. Sin él, `/api/aps/models` responde 503 `aps_not_configured` |
| `APS_CALLBACK_URL`                         | `https://hack-team-27.vercel.app/api/integrations/aps/callback`, fijo en `render.yaml`            | El callback de la conexión con Autodesk. Pasa por la web (el `rewrite` lo lleva a la API) para que el navegador mande la cookie del estado, y tiene que estar registrado tal cual en la app de APS                                                                                                                                 |
| `APS_TOKEN_KEY`                            | La generas tú (`openssl rand -hex 32`) y la pones en el panel                                     | La clave AES-256-GCM con que la API cifra los tokens de Autodesk en Postgres. Sin ella (o sin `APS_CALLBACK_URL`), conectar responde 503 `aps_oauth_not_configured`. Si la cambias, las conexiones guardadas quedan en «volver a conectar»                                                                                         |
| `APS_WEBHOOK_SECRET`                       | La genera Render (`generateValue`)                                                                | El secreto con que Autodesk firma sus webhooks. Cópialo del panel y regístralo en Autodesk ([los webhooks de Autodesk](#los-webhooks-de-autodesk)). Sin él, `POST /api/integrations/autodesk/webhooks` responde 503 `autodesk_webhooks_off`                                                                                        |

Para probar la imagen en local contra el Postgres de compose, en una base nueva:

```bash
docker build -f apps/api/Dockerfile -t vigente-api .
docker exec team27-postgres-1 createdb -U postgres vigente_prueba
docker run --rm -p 3101:10000 --network team27_default \
  -e DATABASE_URL=postgresql://postgres:postgres@postgres:5432/vigente_prueba vigente-api
curl localhost:3101/api/health/ready
docker exec team27-postgres-1 dropdb -U postgres vigente_prueba
```

### Los webhooks de Autodesk

Autodesk avisa los cambios de ACC a `https://vigente-api.onrender.com/api/integrations/autodesk/webhooks`, directo a la API (no necesita cookies, así que no pasa por la web). La API solo acepta los avisos firmados con `APS_WEBHOOK_SECRET` ([el receptor](spec/cambios-autodesk.md#el-receptor)).

1. Copia `APS_WEBHOOK_SECRET` del panel de Render.
2. Regístralo en Autodesk con `POST https://developer.api.autodesk.com/webhooks/v1/tokens` y el cuerpo `{"token": "<secreto>"}`, con un token de la app (2-legged, para los webhooks de la app) o de la cuenta de Autodesk que crea los webhooks (3-legged). Si ya había uno, se cambia con `PUT …/tokens/@me`. Autodesk firma con ese secreto todos los webhooks de esa app o cuenta. Si rechaza el valor que generó Render, pon en los dos lados uno de `openssl rand -hex 32`.
3. Crea los webhooks de cada carpeta de proyecto con esa URL como `callbackUrl` (`POST …/webhooks/v1/systems/{sistema}/events/{evento}/hooks`). Hoy se hace a mano: la API todavía no los registra ([lo que falta](spec/cambios-autodesk.md#lo-que-falta)).

Si la API duerme (plan gratis), el primer aviso puede vencer mientras despierta: Autodesk lo reintenta, y si llegan los dos, el segundo se descarta como repetido.

## La web en Vercel

El proyecto de Vercel usa `apps/web` como Root Directory. [`apps/web/vercel.json`](../apps/web/vercel.json) instala el workspace con pnpm y compila desde la raíz con `pnpm nx run @team27/web:build`, que primero hace el `typecheck` de las dependencias. El `engines` de `apps/web/package.json` fija Node 24.

| Variable                       | Valor                                                                                     | Por qué                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `API_URL`                      | `https://vigente-api.onrender.com`: la URL de la API en Render, sin `/api` ni barra final | El `rewrite` la fija al compilar: si cambia, hay que volver a desplegar la web |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1`                                                                                       | Vercel usa el pnpm de `packageManager`                                         |

La opción «Include files outside the Root Directory in the Build Step» tiene que quedar activada (viene así por defecto).

Vercel solo despliega los commits cuyo autor es el dueño del proyecto (`agustin-rios`). Un PR que otra persona mergea en GitHub llega igual al espejo y Render despliega la API, pero Vercel marca el commit «Deployment was blocked» y la web se queda en la versión anterior. Para publicarlo, el dueño empuja encima un commit propio: basta uno que solo toque docs, porque el `buildFilter` de Render lo ignora. También sirve crear el despliegue de `main` desde el panel de Vercel.

Sin las variables de Auth0, la web y la API arrancan igual, pero nadie puede entrar: `/cuenta` avisa que las cuentas no están activas, las rutas con cuenta de la API responden 503 y solo queda `/modelos`. Para activarlas, agrega en Vercel `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET` y `APP_BASE_URL` (la URL de la web), y en Render `AUTH0_DOMAIN`, `AUTH0_AUDIENCE` y `SUPERADMIN_EMAILS` (los correos de los superadmins de Vigente, separados por coma). En Auth0, suma la URL de la web a Allowed Callback URLs (`<web>/auth/callback`), Allowed Logout URLs y Web Origins.

La conexión con Autodesk también es opcional y necesita las cuentas. Para activarla, en la app de APS (la misma de `APS_CLIENT_ID`, de tipo Traditional Web App) agrega a Callback URL `<web>/api/integrations/aps/callback` (y `http://localhost:3000/api/integrations/aps/callback` para local), y en Render pon `APS_TOKEN_KEY`. En un servicio que ya existe, pon también `APS_CALLBACK_URL` a mano: igual que el bucket, un push no la agrega. El bucket es de la app que lo creó, así que `APS_CLIENT_ID`, `APS_CLIENT_SECRET` y `APS_BUCKET_KEY` cambian juntos. Un Manual Sync del Blueprint pone el bucket de `render.yaml`: con las credenciales de otra app, APS no lo muestra y el visor queda sin modelos. Para leer los proyectos de Autodesk Construction Cloud, un administrador de la cuenta de ACC tiene que agregar el Client ID de la app en Account Admin → Custom Integrations.

## La primera vez

1. **Espejo**: guarda el secret `MIRROR_TOKEN` en el repo de la organización ([el repo espejo](#el-repo-espejo)).
2. **Render**: New → Blueprint → el repo espejo. Pide `CORS_ALLOW_ORIGINS`, `APS_CLIENT_ID`, `APS_CLIENT_SECRET`, `APS_TOKEN_KEY`, `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`: pon la URL de la web (`https://hack-team-27.vercel.app`), las credenciales de APS del `.env` de quien corrió `pnpm aps:models`, una clave nueva de `openssl rand -hex 32` (o déjala vacía si no vas a conectar Autodesk) y las del cliente de Google Cloud (o vacías si no vas a conectar Google). `INTEGRATIONS_ENCRYPTION_KEY` y `APS_WEBHOOK_SECRET` las genera Render. Apply. Cuando termine, `https://vigente-api.onrender.com/api/health/ready` responde `{"status":"ok","database":"ok"}`. Si el servicio ya existía antes de que el Blueprint declarara una variable, un push no la agrega: ponla a mano en Environment o haz un Manual Sync del Blueprint. Es el caso de las de Google (`GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` a mano; `GOOGLE_REDIRECT_URI` y `GOOGLE_WEBHOOK_URL` con sus valores de `render.yaml`), de `INTEGRATIONS_ENCRYPTION_KEY` y de `APS_WEBHOOK_SECRET` (a mano, una de `openssl rand -hex 32`). El Manual Sync también vuelve a poner el bucket y las URL fijas de `render.yaml`.
3. **Vercel**: Add New → Project → el repo espejo. Root Directory `apps/web`, las dos variables de arriba y Deploy.
4. Si la URL que dio Vercel no es la que pusiste en el paso 2, corrige `CORS_ALLOW_ORIGINS` en Render.
5. Activa las cuentas (ver arriba) y pon en Render `SUPERADMIN_EMAILS` con los correos reales de quienes administran Vigente. Entra con uno de ellos y, desde `/admin`, invita a la gente a Constructora Cordillera o crea las organizaciones reales.
6. Pon la URL de la web (`https://hack-team-27.vercel.app`) en `deploy-url` de [`platanus-hack-project.jsonc`](../platanus-hack-project.jsonc): es el botón «ver aplicación» de la página de votación.

## El día del pitch

- Abre la web unos minutos antes para despertar la API: el plan gratis tarda cerca de un minuto.
- Quien presente entra con una cuenta: su correo tiene que estar en `SUPERADMIN_EMAILS` o invitado a una organización. El login manda un código al correo, así que ten la bandeja a mano.
- La web pública sin sesión solo ofrece entrar: quien vote y abra `deploy-url` ve la pantalla de entrada, no un proyecto.

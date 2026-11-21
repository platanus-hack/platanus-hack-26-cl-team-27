# Despliegue

La muestra pública corre en tres piezas: la web en Vercel, y la API y su Postgres en Render. El ETL y el add-in de Revit corren en los equipos de quien presenta y apuntan a la API pública. Los celulares entran a la sala por el QR del telón, así que la web necesita una URL pública con HTTPS.

```mermaid
flowchart LR
  P[Celulares y telón] -->|HTTPS| W[Web · Vercel]
  W -->|rewrite /api/*| A[API · Render]
  E[ETL · laptop] -->|API_URL + PRESENTER_KEY| A
  R[Add-in de Revit] -->|apiUrl + presenterKey| A
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
- **Al arrancar** corre `prisma migrate deploy` y después `node dist/main.js`. Las migraciones no tienen un paso aparte.
- **Una sola instancia.** El registro de `x-action-id` vive en la memoria del proceso.
- **Se despliega en cada push**, salvo cuando el cambio solo toca la web, el ETL, `packages/`, `docs/`, el add-in o archivos Markdown (`buildFilter`).
- **El plan gratis** se duerme tras 15 minutos sin peticiones y tarda cerca de un minuto en despertar, con 0,1 CPU. Con la sala abierta, el sondeo la mantiene despierta. Si la sala se pone lenta con muchos celulares, sube el servicio a Starter en el panel. El Postgres gratis vence a los 30 días.

| Variable                             | Valor                                                    | Por qué                                                                                                                                                                                                                           |
| ------------------------------------ | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                           | `production`                                             | Activa las reglas de producción del schema de la API                                                                                                                                                                              |
| `API_PORT`                           | `10000`                                                  | El puerto que Render espera                                                                                                                                                                                                       |
| `DATABASE_URL`                       | La del Postgres `vigente-db`                             | La conexión interna de Render                                                                                                                                                                                                     |
| `PRESENTER_KEY`                      | La genera Render                                         | El repo es público y la clave de desarrollo está en él. Cópiala del panel: la piden el ETL, `/presentador` y el add-in                                                                                                            |
| `CORS_ALLOW_ORIGINS`                 | La URL de la web                                         | El navegador habla con la API a través del `rewrite` de la web; en producción solo importa que no sea `*`                                                                                                                         |
| `ANTHROPIC_API_KEY`                  | Opcional; se agrega en el panel de Render                | Sin ella, la API lee el texto libre (WhatsApp, folios, actas) en modo determinista, con las respuestas grabadas en `apps/api/inference-cache`, que van dentro de la imagen. Con ella, lee Claude                                  |
| `APS_CLIENT_ID`, `APS_CLIENT_SECRET` | Las de la app de APS con que se corrió `pnpm aps:models` | Sin ellas la API arranca, pero `/api/aps/viewer-token` responde 503 y `/modelos` no carga. Las URNs de `apps/api/models/models.json`, que va dentro de la imagen, viven en el bucket de esa app: el token de otra app no las abre |

Para probar la imagen en local contra el Postgres de compose, en una base nueva:

```bash
docker build -f apps/api/Dockerfile -t vigente-api .
docker exec team27-postgres-1 createdb -U postgres vigente_prueba
docker run --rm -p 3101:10000 --network team27_default \
  -e DATABASE_URL=postgresql://postgres:postgres@postgres:5432/vigente_prueba \
  -e PRESENTER_KEY=una-clave-de-prueba vigente-api
curl localhost:3101/api/health/ready
docker exec team27-postgres-1 dropdb -U postgres vigente_prueba
```

## La web en Vercel

El proyecto de Vercel usa `apps/web` como Root Directory. [`apps/web/vercel.json`](../apps/web/vercel.json) instala el workspace con pnpm y compila desde la raíz con `pnpm nx run @team27/web:build`, que primero hace el `typecheck` de las dependencias. El `engines` de `apps/web/package.json` fija Node 24.

| Variable                       | Valor                                                 | Por qué                                                                        |
| ------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| `API_URL`                      | La URL de la API en Render, sin `/api` ni barra final | El `rewrite` la fija al compilar: si cambia, hay que volver a desplegar la web |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1`                                                   | Vercel usa el pnpm de `packageManager`                                         |

La opción «Include files outside the Root Directory in the Build Step» tiene que quedar activada (viene así por defecto).

## La primera vez

1. **Espejo**: guarda el secret `MIRROR_TOKEN` en el repo de la organización ([el repo espejo](#el-repo-espejo)).
2. **Render**: New → Blueprint → el repo espejo. Pide `CORS_ALLOW_ORIGINS`, `APS_CLIENT_ID` y `APS_CLIENT_SECRET`: pon la URL que va a tener la web (por ejemplo `https://vigente.vercel.app`; se corrige después) y las credenciales de APS del `.env` de quien corrió `pnpm aps:models`. Apply. Cuando termine, `https://<api>.onrender.com/api/health/ready` responde `{"status":"ok","database":"ok"}`. Si el servicio ya existía antes de que el Blueprint declarara las variables de APS, agrégalas a mano en Environment.
3. **Vercel**: Add New → Project → el repo espejo. Root Directory `apps/web`, las dos variables de arriba y Deploy.
4. Si la URL que dio Vercel no es la que pusiste en el paso 2, corrige `CORS_ALLOW_ORIGINS` en Render.
5. Copia `PRESENTER_KEY` del panel de Render y carga la muestra desde tu laptop. Las variables del comando le ganan al `.env`:

   ```bash
   API_URL=https://<api>.onrender.com PRESENTER_KEY=<clave> pnpm etl
   ```

6. Pon la URL de la web en `deploy-url` de [`platanus-hack-project.jsonc`](../platanus-hack-project.jsonc): es el botón «ver aplicación» de la página de votación.
7. En la config del add-in de Revit ([README](../tool-use-case/revit/README.md)), cambia `apiUrl` (`https://<api>.onrender.com/api`), `webUrl` y `presenterKey`.

## El día del pitch

- Abre `/sala` unos minutos antes para despertar la API.
- `/presentador` pide la clave una vez por pestaña: es la `PRESENTER_KEY` de Render.
- La URL es pública y cualquiera puede tomar un asiento. Desde `/presentador` se sueltan.
- Después del pitch, deja la sala cargada: quien vote abre `deploy-url` y, con el lago vacío, solo vería «Esperando la carga inicial».

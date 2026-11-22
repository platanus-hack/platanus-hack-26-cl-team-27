# CLI de APS

`@team27/aps` sube los modelos de Revit a un bucket de OSS de Autodesk Platform Services (APS) y los traduce a SVF2 para el visor de la web. No guarda un catálogo: la API le pregunta a APS qué modelos están traducidos en el bucket ([la API](../api/README.md#modelos-bim-aps)). No importa nada de la API.

```sh
pnpm aps:check                                  # prueba las credenciales y el bucket
pnpm aps:models [--force] [--carpeta <ruta>]    # sube y traduce los .rvt de apps/aps/models (o de <ruta>)
```

Node la ejecuta sin compilar, como a los contextos.

## Variables

Las lee del `.env` de la raíz. Si falta alguna, lo dice sin mostrar valores y termina con código 1.

| Variable                             | Qué es                                                                                                                                                                                    |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APS_CLIENT_ID`, `APS_CLIENT_SECRET` | La app de APS. Solo se imprime si funcionan o no, con el HTTP                                                                                                                             |
| `APS_BUCKET_KEY`                     | El bucket de OSS donde viven los modelos, y el mismo que lista la API. Un bucket es de la app que lo creó: otra app no lo ve. `.env.example` trae el del equipo, `vigente-8b87f1a2b6424d31` |

## `aps:check`

Pide un token de `viewables:read` y revisa que la app vea el bucket. Distingue un bucket que no existe (404: lo crea `aps:models`) de uno que es de otra app de APS (403).

## `aps:models`

1. Crea el bucket si no existe (`persistent`, región US).
2. Por cada `.rvt` de la carpeta, lo sube a OSS si no está o cambió de tamaño, y pide la traducción a SVF2 (vistas 2D y 3D) con `generateMasterViews`: una vista 3D por fase de Revit con todos los elementos del modelo, aunque el archivo no traiga vistas 3D propias (el de Site de Snowdon Towers solo trae planos). Se salta el que ya está traducido con el mismo tamaño; `--force` lo vuelve a traducir.
3. Consulta el manifiesto cada 15 s (hasta 45 min) e imprime el progreso, el estado y los mensajes del manifiesto, con un aviso si no quedó ninguna vista 3D. Si un archivo falla, sigue con los demás. Termina con un resumen y con código 1 si alguno no quedó traducido.

La carpeta por defecto es `apps/aps/models/`; `--carpeta` acepta otra, relativa a la raíz. Los `.rvt` no se versionan (`.gitignore`) ni entran a la imagen de la API (`.dockerignore`).

La disciplina no la decide la CLI: la API la saca del nombre del archivo al listar (`arch`, `site`, `struct`, `plumb`, `hvac` o `mech`, `elec`). Por eso `torre-estructura.rvt` queda en `structural` y `torre-electrico.rvt` en `electrical`. Un modelo nuevo aparece en `/modelos` cuando termina su traducción, sin commitear nada; la API guarda la lista 5 minutos.

## Estructura

```
src/
├── main.ts         entrada: lee los argumentos y el .env, y corre el comando
├── args.ts         check | models [--force] [--carpeta <ruta>]
├── config.ts       APS_CLIENT_ID, APS_CLIENT_SECRET y APS_BUCKET_KEY, recortadas
├── token.ts        token 2-legged guardado hasta un minuto antes de vencer, una sola petición a la vez
├── check.ts        aps:check
├── publish.ts      aps:models: bucket, subida, traducción, sondeo del manifiesto y resumen
├── manifest.ts     estado, mensajes y vista 3D de un manifiesto
├── aps-errors.ts   el HTTP de un error del SDK
└── io.ts           salida a stdout y stderr
models/             los .rvt (sin versionar)
tests/              Vitest, sin red
```

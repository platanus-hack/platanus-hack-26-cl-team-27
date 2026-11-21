# Integraciones: Google Sheets y ACC

Lo que la rama `integrations` quiere lograr. Las issues son [PH-17](https://linear.app/ph-team-27/issue/PH-17/conector-de-google-sheets-para-el-presupuesto) (Google Sheets) y [PH-39](https://linear.app/ph-team-27/issue/PH-39/conector-de-presupuestos-de-acc-cost-management) (ACC). Para el pitch, reemplaza la tarea 8 del plan, el parser de Presto o S10 ([README](README.md#las-26-tareas-frente-al-código)).

## Objetivo

Hoy el presupuesto llega desde un CSV ficticio que juega el ETL. Queremos dos conectores reales para el presupuesto: Google Sheets y los presupuestos de Autodesk Construction Cloud (ACC). La persona conecta su cuenta desde la web, elige qué planillas o proyectos sigue Vigente y dice a qué documento de la obra corresponde cada uno. Desde ahí, cada cambio llega solo a la sala como revisión nueva, por el mismo camino que `POST /api/revisions`.

**Listo cuando:** Daniela cambia el precio del hormigón en su planilla de Sheets y, en menos de dos minutos, la sala muestra la revisión nueva del «Presupuesto itemizado» con el antes y el después. Lo mismo con un presupuesto en ACC.

## Requisitos

| #   | Requisito             | Google Sheets                                                                         | ACC                                                                                                             |
| --- | --------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | Conectar la cuenta    | OAuth de Google                                                                       | OAuth de tres patas de APS, el de [PH-25](https://linear.app/ph-team-27/issue/PH-25)                            |
| 2   | Elegir qué se sigue   | Archivos, con Google Picker y el permiso `drive.file`: la API solo ve lo que se elige | Proyectos de la cuenta y, dentro de cada uno, sus presupuestos                                                  |
| 3   | Enterarse del cambio  | Sondeo de `changes.list` de Drive cada 60 s                                           | Webhooks de Cost Management por proyecto, con el receptor de [PH-27](https://linear.app/ph-team-27/issue/PH-27) |
| 4   | Volver a leer después | El id de la planilla y el refresh token cifrado                                       | Los ids del proyecto y del presupuesto, y el refresh token cifrado                                              |

En los dos, el proveedor avisa **que** algo cambió, no **qué** cambió. El conector lee el contenido entero y lo entrega como revisión. La API lo compara con lo vigente y arma el antes y el después: el conector nunca calcula el diff.

La API llama directo a las APIs REST de Google y de Autodesk, sin MCP. MCP sirve para que un modelo use herramientas mientras conversa: no avisa cambios ni corre solo.

## Conector y lector

Son dos piezas separadas, para que sumar una fuente o un formato no toque la otra:

- **Conector:** dónde vive el archivo y cómo nos enteramos de que cambió. Maneja la cuenta, el permiso y la detección.
- **Lector:** cómo el contenido se convierte en fragmentos con hechos. Es una función pura con test de oro, como `apps/etl/src/transform/presupuesto.ts`.

| Conector            | Lector                                                                                                                       | Hechos                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Google Sheets       | Una planilla con los encabezados del presupuesto de hoy: `Código`, `Precio unitario`, `Unidad` y `Dimensión de diseño usada` | `precio_unitario` (afirma) y la dimensión de diseño (usa), con localizador `Partidas!C14` |
| ACC Cost Management | Los presupuestos del proyecto: el código de cada uno es la partida                                                           | `precio_unitario` (afirma)                                                                |

Presto queda para después: su exportación `.bc3` guardada en Drive sería un lector más sobre el mismo conector.

## Qué se construye

- **Contexto `integrations`**, con la receta [crear un contexto](../arquitectura.md#crear-un-contexto):
  - `domain/`: `Connection`, `SourceLink` y los lectores puros.
  - `application/`: los puertos `TokenVault` (el de PH-25), `SourceLinkRepository`, `SheetsSource` y `AccCostSource`, y los casos de uso `ConnectAccount`, `LinkSource`, `PollSources` y `ReadSource`, que devuelve el cuerpo de una revisión.
  - `infra/adapters/`: Prisma, Google (Drive y Sheets) y APS (Cost Management).
- **Módulo de la API** en `apps/api/src/modules/integrations/`: el inicio y el callback de OAuth por proveedor, un token de acceso corto para que la web abra el Picker, vincular y desvincular fuentes, el sondeo cada 60 s y la ruta de los webhooks de ACC. Lo que devuelve el contexto entra por el mismo camino interno que `POST /api/revisions`, como el dueño del documento. Un contexto no importa a otro: compone la API.
- **Datos** en `data/main/prisma/schema.prisma`:
  - `Connection`: el proveedor (`google` o `autodesk`), el espacio que alimenta, el refresh token cifrado, los permisos y el vencimiento.
  - `SourceLink`: la conexión, el id externo, el `documentId`, el `pointer` (el link para personas: `webViewLink` o la URL de ACC), la última versión vista, la última lectura y el último error.
- **Variables** en `apps/api/src/config/env.ts`, todas opcionales: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_PICKER_API_KEY` e `INTEGRATIONS_ENCRYPTION_KEY`. ACC usa `APS_CLIENT_ID` y `APS_CLIENT_SECRET`, que ya existen. Sin ellas, el conector queda apagado y todo sigue como hoy.
- **Web** en `apps/web/src/app/(site)/conectores/`: conectar Google o Autodesk, elegir la planilla o el proyecto, decir qué documento de la obra es, y ver por cada fuente su última lectura y si hubo un error.

## Fuera de alcance

- Cuentas y organizaciones. La conexión cuelga del espacio y la hace la presentadora con `x-presenter-key`, como el resto de la muestra.
- Presto, S10, Excel `.xlsx` y SharePoint.
- Escribir de vuelta en la planilla o en ACC.
- El cambio celda por celda, que en Sheets exige un Apps Script en cada planilla.
- La outbox y el worker ([PH-15](https://linear.app/ph-team-27/issue/PH-15)). El sondeo corre dentro de la API, que hoy tiene una sola instancia.

## Decisiones abiertas

1. **Partidas que el proyecto no conoce.** Un presupuesto real tiene cientos, y el proyecto sigue cuatro (`apps/api/src/scenario/documents.ts`). Con una desconocida, la API responde `422 invalid_claims` y rechaza la revisión. Propuesta: el lector las descarta y las devuelve como ignoradas, como hace `POST /api/integrations/revit/minutes`.
2. **El espacio de Daniela es `sharepoint`** en `apps/api/src/scenario/documents.ts`. Con Sheets, ¿pasa a `drive` o se crea un espacio nuevo?
3. **Cost Management es un módulo pagado de ACC.** Hay que confirmar que la cuenta de prueba lo tenga antes de partir con PH-39, y revisar los nombres exactos de los eventos en la referencia de webhooks de APS.
4. **Google en modo prueba.** Admite hasta 100 usuarios de prueba, y el refresh token vence a los 7 días. Alcanza para el pitch; para el producto hay que pasar la verificación de Google.
5. **El reinicio de la sala** (`POST /api/room/reset`) vacía el lago. Las conexiones no son parte de la sala y sobreviven. Falta decidir si el sondeo vuelve a cargar la planilla o espera la carga inicial del ETL.
6. **Una fuente por documento.** Sheets y ACC podrían alimentar el mismo «Presupuesto itemizado». En la muestra, cada documento tiene una sola fuente vinculada.

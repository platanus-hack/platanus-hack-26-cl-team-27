# Integraciones: Google Sheets y ACC

Lo que la rama `integration-sheets` quiere lograr. Las issues son [PH-17](https://linear.app/ph-team-27/issue/PH-17/conector-de-google-sheets-para-el-presupuesto) (Google Sheets) y [PH-39](https://linear.app/ph-team-27/issue/PH-39/conector-de-presupuestos-de-acc-cost-management) (ACC). Para el pitch, reemplaza la tarea 8 del plan, el parser de Presto o S10 ([README](README.md#las-26-tareas-frente-al-código)).

**Estado:** Google Sheets está construido: [`context/integrations`](../../context/integrations/README.md), `apps/api/src/modules/integrations` y la vista `/conectores`. Falta probarlo con una cuenta real de Google. ACC no está construido.

## Objetivo

El presupuesto de la muestra llega desde un CSV ficticio que juega el ETL. Queremos dos conectores reales para el presupuesto: Google Sheets y los presupuestos de Autodesk Construction Cloud (ACC). La persona conecta su cuenta desde la web, elige qué planillas o proyectos sigue Vigente y dice a qué documento de la obra corresponde cada uno. Desde ahí, cada cambio llega solo a la sala como revisión nueva, por el mismo camino que `POST /api/revisions`.

**Listo cuando:** Daniela cambia el precio del hormigón en su planilla de Sheets y, en menos de dos minutos, la sala muestra la revisión nueva del «Presupuesto itemizado» con el antes y el después. Lo mismo con un presupuesto en ACC.

## Requisitos

| #   | Requisito             | Google Sheets (construido)                                                                      | ACC (por construir)                                                                                             |
| --- | --------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | Conectar la cuenta    | OAuth de Google con `spreadsheets.readonly`                                                     | OAuth de tres patas de APS, el de [PH-25](https://linear.app/ph-team-27/issue/PH-25)                            |
| 2   | Elegir qué se sigue   | Se pega el link de la planilla y se elige el documento de la obra                               | Proyectos de la cuenta y, dentro de cada uno, sus presupuestos                                                  |
| 3   | Enterarse del cambio  | Sondeo cada `INTEGRATIONS_POLL_SECONDS` (60 s): lee la planilla y compara el hash del contenido | Webhooks de Cost Management por proyecto, con el receptor de [PH-27](https://linear.app/ph-team-27/issue/PH-27) |
| 4   | Volver a leer después | El id de la planilla y el refresh token cifrado                                                 | Los ids del proyecto y del presupuesto, y el refresh token cifrado                                              |

En los dos, el proveedor avisa **que** algo cambió, no **qué** cambió. El conector lee el contenido entero y lo entrega como revisión. La API lo compara con lo vigente y arma el antes y el después: el conector nunca calcula el diff.

La API llama directo a las APIs REST de Google y de Autodesk, sin MCP. MCP sirve para que un modelo use herramientas mientras conversa: no avisa cambios ni corre solo.

## Conector y lector

Son dos piezas separadas, para que sumar una fuente o un formato no toque la otra:

- **Conector:** dónde vive el archivo y cómo nos enteramos de que cambió. Maneja la cuenta, el permiso y la detección.
- **Lector:** cómo el contenido se convierte en fragmentos con hechos. Es una función pura con tests, como `readBudgetSheet`.

| Conector            | Lector                                                                                                                          | Hechos                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Google Sheets       | La primera hoja, con una fila de encabezados con `Código`, `Precio unitario` y `Unidad`, y si está, `Dimensión de diseño usada` | `precio_unitario` (afirma) y la dimensión de diseño (usa), con localizador `Partidas!C14` |
| ACC Cost Management | Los presupuestos del proyecto: el código de cada uno es la partida                                                              | `precio_unitario` (afirma)                                                                |

Presto queda para después: su exportación `.bc3` guardada en Drive sería un lector más.

## Lo construido para Google Sheets

- **Contexto `integrations`:** el lector `readBudgetSheet`, los puertos `ConnectionRepository`, `SourceLinkRepository`, `AccountAuthorizer`, `SpreadsheetReader` y `RevisionSink`, los casos de uso `ConnectGoogle`, `LinkSpreadsheet`, `SyncSource` y compañía, y los adapters de Google, Prisma y cifrado. El detalle está en su [README](../../context/integrations/README.md).
- **Módulo de la API** en `apps/api/src/modules/integrations/`: las rutas `/api/integrations/*` ([README de la API](../../apps/api/README.md#rutas)), el sondeo y `CoordinationRevisionSink`, que entrega cada lectura por `CoordinationService.ingest` como el dueño del documento.
- **Datos:** `IntegrationConnection` e `IntegrationSource`, en la migración `20261121220000_integraciones`.
- **Variables:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `INTEGRATIONS_ENCRYPTION_KEY` e `INTEGRATIONS_POLL_SECONDS`, todas opcionales. Sin el cliente, el secreto y la clave de cifrado, el conector queda apagado y todo sigue como hoy.
- **Web:** `/conectores`, con la clave del presentador.

## Fuera de alcance

- Cuentas y organizaciones. Hay una sola cuenta por proveedor y la conecta la presentadora, como el resto de la muestra.
- El selector de Google (Picker) con el permiso `drive.file`, que limita el acceso a los archivos elegidos. Hoy se pega el link y el permiso alcanza para leer todas las planillas de la cuenta.
- Presto, S10, Excel `.xlsx` y SharePoint.
- Escribir de vuelta en la planilla o en ACC.
- El cambio celda por celda, que en Sheets exige un Apps Script en cada planilla.
- La outbox y el worker ([PH-15](https://linear.app/ph-team-27/issue/PH-15)). El sondeo corre dentro de la API, que tiene una sola instancia.

## Decisiones tomadas

1. **Las partidas que la obra no sigue se descartan.** El lector las devuelve como ignoradas, con su celda y su razón, y la vista las muestra. La revisión entra con el resto.
2. **Una planilla por documento.** La base lo exige con un índice único.
3. **El reinicio de la sala no borra las conexiones.** La planilla se vuelve a entregar después de la carga inicial, porque cambió la época de la sala. Con el lago vacío, el sondeo espera.

## Decisiones abiertas

1. **El espacio de Daniela es `sharepoint`** en `apps/api/src/scenario/documents.ts`. Con Sheets, ¿pasa a `drive`?
2. **El guion y la planilla alimentan el mismo documento.** Si la planilla está vinculada, el ETL y la planilla suben revisiones del mismo presupuesto. Para el pitch, ¿se saca la escena del presupuesto v3 del guion?
3. **Cost Management es un módulo pagado de ACC.** Hay que confirmar que la cuenta de prueba lo tenga antes de partir con PH-39, y revisar los nombres exactos de los eventos en la referencia de webhooks de APS.
4. **Google en modo prueba.** Admite hasta 100 usuarios de prueba, y el permiso vence a los 7 días. Alcanza para el pitch; para el producto hay que pasar la verificación de Google.

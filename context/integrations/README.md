# @team27/context-integrations

Los conectores reales: leen un documento donde ya vive, se enteran cuando cambia y lo entregan a la obra como una revisión nueva. Hoy hay uno, **Google Sheets**, para el presupuesto. La spec, con lo que falta (ACC), está en [docs/spec/integraciones.md](../../docs/spec/integraciones.md).

El contexto no conoce el lago. Lee la planilla, la convierte en fragmentos con hechos y se los pasa a un `RevisionSink`, que la API implementa con el mismo camino interno que `POST /api/revisions`. La API compara con lo vigente y arma el antes y el después: el conector nunca calcula el diff.

## Capas

- **Dominio**
  - `readBudgetSheet(tab, vocabulary)`: lee la primera fila que tenga «Código», «Precio unitario» y «Unidad», en cualquier columna, sin importar mayúsculas ni tildes. Por cada partida que la obra sigue, afirma `precio_unitario` con localizador `Hoja!C14`. Si existe la columna «Dimensión de diseño usada», agrega un hecho `usa` (por ejemplo «Losa nivel 3 · espesor 15 cm»). Lo que no entra vuelve en `ignored` con su localizador y su razón: una partida que la obra no sigue, un precio que no es número, una unidad distinta o una dimensión que no reconoce. Sin la fila de encabezados lanza `SheetFormatError`.
  - `matchSubject`: reconoce un elemento por las palabras de su nombre (al menos dos, y todos sus números). «Ventanas del norte» es `ventanas-norte`, «Losa nivel 3» es `losa-n3` y «Losa nivel 7» no es nada.
  - `spreadsheetIdOf(url)` saca el id de un link de Sheets. `sheetsRevisionLabel(fecha)` arma el rótulo de la revisión en hora de Chile: `Sheets 21-11 18:05:12`.
  - `Connection`, `SourceLink` (la planilla vinculada a un documento, con su última revisión, su última lectura entregada y su último error) y `SourceVocabulary` (los sujetos de la obra con sus atributos y unidades; lo arma la API desde `scenario/documents.ts`).
- **Aplicación**
  - Puertos: `ConnectionRepository`, `SourceLinkRepository`, `AccountAuthorizer` (OAuth), `SpreadsheetReader` y `RevisionSink` (`epoch()` y `deliver()`).
  - Casos de uso: `ConnectGoogle`, `DisconnectGoogle`, `GetGoogleConnection` (nunca devuelve el token), `LinkSpreadsheet`, `UnlinkSource`, `ListSources` y `SyncSource`.
  - Errores: `IntegrationError` con `code`, `ProviderError` (Google) y `DeliveryError` (la obra rechazó la revisión).
- **Adapters** (`@team27/context-integrations/adapters`)
  - `GoogleOAuthClient`: OAuth de Google con `access_type=offline` y `prompt=consent`, y los permisos `openid`, `email` y `spreadsheets.readonly`. Guarda el token de acceso en memoria hasta un minuto antes de que venza.
  - `GoogleSheetsReader`: lee la primera hoja con `valueRenderOption=UNFORMATTED_VALUE` (los números llegan como números), arma el link a esa hoja y el hash SHA-256 del contenido. Traduce los 401, 403, 404 y la API desactivada a mensajes en español.
  - `TokenCipher`: AES-256-GCM con una clave derivada de `INTEGRATIONS_ENCRYPTION_KEY`.
  - `PrismaConnectionRepository` (guarda el refresh token cifrado) y `PrismaSourceLinkRepository`.

## Cómo se lee una planilla

`SyncSource.execute(id)`:

1. Si la obra no tiene la carga inicial (`epoch()` es `null`), espera sin leer. Así el sondeo no ocupa el lago vacío antes de `POST /api/lake/seed`.
2. Pide un token de acceso con el refresh token guardado y lee la planilla.
3. Si el hash y la época de la sala son los de la última lectura entregada, solo anota la hora de la revisión. Después de reiniciar la sala, la época cambia y la planilla se entrega de nuevo.
4. Si cambió, la lee con `readBudgetSheet` y la entrega como revisión del documento vinculado, con el rótulo `Sheets <día-mes hora>`, el link a la hoja como `pointer` y el hash como `contentHash`.
5. Cualquier error queda en la fuente (`lastError`) y el caso de uso no lanza. Un error inesperado vuelve con un mensaje genérico y su causa en `failure`, para el log.

## Configurar Google

1. En [Google Cloud Console](https://console.cloud.google.com), crea un proyecto y activa la **Google Sheets API**.
2. En **Pantalla de consentimiento de OAuth**, elige «Externo», déjala en modo de prueba y agrega como usuarios de prueba las cuentas que van a conectar. En modo de prueba, Google acepta hasta 100 usuarios y el permiso vence a los 7 días: después hay que volver a conectar.
3. En **Credenciales**, crea un ID de cliente de OAuth de tipo «Aplicación web» con la URI de redireccionamiento `http://localhost:3000/api/integrations/google/callback`. En un despliegue, es la URL de la web con la misma ruta.
4. En el `.env` de la raíz:

   ```bash
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   INTEGRATIONS_ENCRYPTION_KEY=$(openssl rand -base64 32)
   ```

5. Corre `pnpm db:migrate`, reinicia la API y entra a `/conectores` con la clave del presentador.

## La planilla

La primera hoja necesita una fila de encabezados con «Código», «Precio unitario» y «Unidad»; «Dimensión de diseño usada» es opcional. Puede tener filas de datos generales antes del encabezado. El presupuesto de la muestra sirve tal cual: importa [`Presupuesto_itemizado_v2.csv`](../../apps/etl/lago/carpeta-costos/Presupuesto_itemizado_v2.csv) en Google Sheets con «;» como separador.

Antes de importar, pon la configuración regional de la planilla en Chile («Archivo», «Configuración»). Si no, Sheets lee «145.000» como 145.

| Código | Descripción           | Precio unitario | Unidad | Cantidad | Dimensión de diseño usada    |
| ------ | --------------------- | --------------- | ------ | -------- | ---------------------------- |
| 03.02  | Hormigón H30 en losas | 145.000         | m³     | 210      | Losa nivel 3 · espesor 15 cm |

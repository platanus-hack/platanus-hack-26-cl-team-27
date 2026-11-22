# @team27/context-integrations

Los conectores reales. Hoy hay uno, **Google Sheets**, y es un canal de conexión y escucha: conecta la cuenta de Google de una persona, vincula planillas a un proyecto por su link y avisa cuando cambian, con las celdas que cambiaron. No interpreta las planillas, no entrega nada a la cadena de la obra y no guarda lo que escucha: eso queda para los PR que vienen. La spec, con lo que sigue, está en [docs/spec/integraciones.md](../../docs/spec/integraciones.md).

## De quién es cada cosa

- **La cuenta de Google es de la persona que la conectó** (`Connection.userId`, una por persona y proveedor), porque es su permiso el que lee el archivo. Solo ella la ve y la desconecta.
- **La planilla es del proyecto** (`SourceLink.projectId`), porque si la persona se va, la planilla sigue en la obra. La ven y la manejan todos los miembros de la organización del proyecto. La misma planilla puede estar en dos proyectos; en uno, una sola vez.
- **Cada planilla se lee con la cuenta de quien la vinculó** (`SourceLink.connectionId`). Si esa persona desconecta su cuenta, la planilla queda en el proyecto sin cuenta (`connectionId: null`): cada revisión falla con «La cuenta de Google que leía esta planilla ya no está conectada» hasta que alguien la vuelve a vincular, y entonces la toma con su cuenta, sin perder su historia.
- El contexto no sabe de organizaciones: recibe el `userId` y el `projectId`. Quién puede entrar a qué proyecto lo decide la API (`AccountsService.requireProject`).

## Capas

- **Dominio**
  - `Connection` (la cuenta conectada, con su `userId`) y `SourceLink` (la planilla vinculada: proyecto, cuenta con que se lee, id externo, título, link, hash de sus celdas, última revisión, último cambio y último error).
  - `SheetSnapshot` (las hojas de la planilla con sus celdas) y `diffSnapshots(antes, después)`: las celdas que cambiaron, con su localizador (`Partidas!C2`), el valor anterior y el nuevo. Una celda vacía vale `null`; una hoja nueva o borrada cuenta como celdas que aparecen o desaparecen.
  - `spreadsheetIdOf(url)` saca el id de un link de Sheets y `spreadsheetUrl(id)` arma el link para personas.
- **Aplicación**
  - Puertos: `ConnectionRepository`, `SourceLinkRepository`, `AccountAuthorizer` (OAuth), `SpreadsheetReader`, `SnapshotCache` (la última revisión de cada planilla, en memoria) y `ChangeListener` (a quién se le avisa un cambio).
  - Casos de uso: `ConnectGoogle`, `DisconnectGoogle` y `GetGoogleConnection` (nunca devuelve el token), con el `userId`; `LinkSpreadsheet` (`{ userId, projectId, url }`), `UnlinkSource` (`projectId`, `id`), `ListSources` (las de un proyecto, o todas sin `projectId`, para el sondeo) y `WatchSource` (`id` y, si viene, el `projectId` al que tiene que pertenecer).
  - Errores: `IntegrationError` con `code` y `ProviderError` (Google).
- **Adapters** (`@team27/context-integrations/adapters`)
  - `GoogleOAuthClient`: OAuth de Google con `access_type=offline` y `prompt=consent`, y los permisos `openid`, `email` y `spreadsheets.readonly`. Guarda el token de acceso en memoria hasta un minuto antes de que venza.
  - `GoogleSheetsReader`: lee todas las hojas con `values:batchGet` y `valueRenderOption=UNFORMATTED_VALUE`, y saca el hash SHA-256 de las celdas (el nombre de la planilla no cuenta). Traduce los 401, 403, 404 y la API desactivada a mensajes en español.
  - `TokenCipher`: AES-256-GCM con una clave derivada de `INTEGRATIONS_ENCRYPTION_KEY`.
  - `PrismaConnectionRepository` (guarda el refresh token cifrado, una fila por persona y proveedor), `PrismaSourceLinkRepository` e `InMemorySnapshotCache`.

## Cómo se escucha una planilla

- **Al vincular**, `LinkSpreadsheet` abre la planilla con la cuenta de Google de quien la vincula, la deja en el proyecto con su hash como primera revisión y guarda sus celdas en memoria. No avisa nada.
- **Cada `INTEGRATIONS_POLL_SECONDS`**, la API llama a `WatchSource` por cada planilla de todos los proyectos:
  1. La lee completa, con la cuenta de quien la vinculó.
  2. Si el hash es el de la última revisión, solo anota la hora.
  3. Si cambió, compara con la revisión anterior en memoria, anota la hora del cambio y le pasa al `ChangeListener` las celdas que cambiaron. Si la API se reinició y no tiene la revisión anterior, avisa el cambio sin el detalle. Si el hash cambió pero ninguna celda tiene otro valor, no es un cambio.
  4. Cualquier error queda en la planilla (`lastError`) y el caso de uso no lanza. Un error inesperado vuelve con un mensaje genérico y su causa en `failure`, para el log.
- Hoy el `ChangeListener` de la API es `LoggingChangeListener`: deja en el log algo como `«Presupuesto» cambió: 1 celda. Partidas!C2: 145000 → 150000`, con hasta 10 celdas.

La API **le pregunta a Google**; Google no nos avisa. Los avisos automáticos de Drive necesitan una URL pública y un permiso de Drive, solo dicen «cambió» y vencen. La comparación está en la [spec](../../docs/spec/integraciones.md#preguntar-o-que-google-avise).

## Configurar Google

1. En [Google Cloud Console](https://console.cloud.google.com), crea un proyecto y activa la **Google Sheets API**.
2. En **Google Auth Platform**, configura la app como «Externo» y déjala en modo de prueba. En **Público**, agrega como usuarios de prueba las cuentas que van a conectar. En modo de prueba, Google acepta hasta 100 usuarios y el permiso vence a los 7 días: después hay que volver a conectar.
3. En **Clientes**, crea un cliente de tipo «Aplicación web» con la URI de redireccionamiento `http://localhost:3000/api/integrations/google/callback`. En un despliegue, es la URL de la web con la misma ruta.
4. En el `.env` de la raíz:

   ```bash
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   INTEGRATIONS_ENCRYPTION_KEY=$(openssl rand -base64 32)
   ```

5. Corre `pnpm db:migrate`, reinicia la API y entra a `/conectores` con tu cuenta (las cuentas tienen que estar activas: ver [la web](../../apps/web/README.md)).

Al conectar, Google avisa que la app no está verificada: es normal en modo de prueba. En la pantalla de permisos hay que marcar la casilla de ver las hojas de cálculo; sin ella, la conexión falla con «Falta el permiso para leer tus planillas».

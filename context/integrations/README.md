# @team27/context-integrations

Los conectores reales. **Google Sheets** es un canal de conexión y escucha: conecta la cuenta de Google de una persona, vincula planillas a un proyecto por su link y avisa cuando cambian, con las celdas que cambiaron. De **Autodesk** recibe los webhooks de APS, descarta los repetidos y avisa cada cambio ([Autodesk](#autodesk)). No interpreta lo que escucha ni lo entrega a la cadena de la obra: eso queda para los PR que vienen. La spec, con lo que sigue, está en [docs/spec/integraciones.md](../../docs/spec/integraciones.md).

## De quién es cada cosa

- **La cuenta de Google es de la persona que la conectó** (`Connection.userId`, una por persona y proveedor), porque es su permiso el que lee el archivo. Solo ella la ve y la desconecta.
- **La planilla es del proyecto** (`SourceLink.projectId`), porque si la persona se va, la planilla sigue en la obra. La ven y la manejan todos los miembros de la organización del proyecto. La misma planilla puede estar en dos proyectos; en uno, una sola vez.
- **Cada planilla se lee con la cuenta de quien la vinculó** (`SourceLink.connectionId`). Si esa persona desconecta su cuenta, la planilla queda en el proyecto sin cuenta (`connectionId: null`): cada revisión falla con «La cuenta de Google que leía esta planilla ya no está conectada» hasta que alguien la vuelve a vincular, y entonces la toma con su cuenta, sin perder su historia.
- El contexto no sabe de organizaciones: recibe el `userId` y el `projectId`. Quién puede entrar a qué proyecto lo decide la API (`AccountsService.requireProject`).

## Capas

- **Dominio**
  - `Connection` (la cuenta conectada, con su `userId`) y `SourceLink` (la planilla vinculada: proyecto, cuenta con que se lee, id externo, título, link, hash de sus celdas, última revisión, último cambio con quién lo hizo, último error y el canal de avisos de Drive).
  - `SheetSnapshot` (las hojas de la planilla con sus celdas) y `diffSnapshots(antes, después)`: las celdas que cambiaron, con su localizador (`Partidas!C2`), el valor anterior y el nuevo. Una celda vacía vale `null`; una hoja nueva o borrada cuenta como celdas que aparecen o desaparecen.
  - `spreadsheetIdOf(url)` saca el id de un link de Sheets y `spreadsheetUrl(id)` arma el link para personas.
  - `Push.ts`: `PushChannel` (id, `resourceId`, secreto y vencimiento de la suscripción), `Editor` (quién editó), `canWatch(scopes)`, `needsRenewal(canal, ahora, margen)`, `noticeAction(aviso)` (`check`, `gone` o `ignore`), `parseChanged` y `sameSecret` (comparación en tiempo constante).
- **Aplicación**
  - Puertos: `ConnectionRepository`, `SourceLinkRepository`, `AccountAuthorizer` (OAuth), `SpreadsheetReader`, `SnapshotCache` (la última revisión de cada planilla, en memoria), `ChangeListener` (a quién se le avisa un cambio, con las celdas y quién lo hizo), `FileWatcher` (suscribirse a los avisos de un archivo y cerrarlos) y `EditorLookup` (quién editó por última vez).
  - Casos de uso: `ConnectGoogle`, `DisconnectGoogle` y `GetGoogleConnection` (nunca devuelve el token), con el `userId`; `LinkSpreadsheet` (`{ userId, projectId, url }`), `UnlinkSource` (`projectId`, `id`), `ListSources` (las de un proyecto, o todas sin `projectId`, para el sondeo), `WatchSource` (`id` y, si viene, el `projectId` al que tiene que pertenecer), `SubscribeSource` (abre o renueva el canal de avisos), `ReceiveNotice` (valida un aviso de Drive y dice si hay que revisar) y `UnsubscribeSource` (cierra el canal al desvincular).
  - Errores: `IntegrationError` con `code` y `ProviderError` (Google).
- **Adapters** (`@team27/context-integrations/adapters`)
  - `GoogleOAuthClient`: OAuth de Google con `access_type=offline` y `prompt=consent`, y los permisos `openid`, `email`, `spreadsheets.readonly` y `drive.metadata.readonly`. Guarda el token de acceso en memoria hasta un minuto antes de que venza.
  - `GoogleSheetsReader`: lee todas las hojas con `values:batchGet` y `valueRenderOption=UNFORMATTED_VALUE`, y saca el hash SHA-256 de las celdas (el nombre de la planilla no cuenta). Traduce los 401, 403, 404 y la API desactivada a mensajes en español.
  - `GoogleDriveWatcher`: `files.watch` y `channels.stop` de la API de Drive v3, y `files.get` con `lastModifyingUser` para saber quién editó. Cada canal lleva un id (UUID) y un secreto aleatorio que Google devuelve en `X-Goog-Channel-Token`.
  - `TokenCipher`: AES-256-GCM con una clave derivada de `INTEGRATIONS_ENCRYPTION_KEY`.
  - `PrismaConnectionRepository` (guarda el refresh token cifrado, una fila por persona y proveedor), `PrismaSourceLinkRepository` (con el canal de avisos y quién hizo el último cambio) e `InMemorySnapshotCache`.

## Autodesk

Lo que Vigente entiende de los cambios en Autodesk, sin red, y cómo recibe sus webhooks. El catálogo completo, el receptor y lo que falta: [docs/spec/cambios-autodesk.md](../../docs/spec/cambios-autodesk.md).

- **Dominio** (`src/domain/autodesk/`)
  - `AutodeskEvent.ts`: el catálogo `AUTODESK_EVENTS` de los eventos de webhook de APS (Data Management, Model Derivative, Revit en la nube y las incidencias de ACC) y `defineAutodeskEvent(evento, sistema)`, que agrupa Cost Management y deja lo nuevo como `unknown`.
  - `AutodeskChange.ts`: `parseAutodeskWebhook(cuerpo)` da un `AutodeskChange` con `kind`, recurso, hora (solo la del payload; si no viene, `null`), autor, `needsElementDiff` y `dedupeKey`: el hook, el evento, el linaje o urn y el momento, que es la versión en los eventos que nombra una versión, la versión junto a la hora del cambio en los demás y, si no hay ninguna de las dos, una huella del cuerpo.
  - `ElementDiff.ts`: `toElementChanges` lee el diff de AEC Data Model y `toMinuteChanges` lo convierte en los cambios de una minuta, con lo que no entra en `ignored` (la API todavía no la recibe); `countBySubject` cuenta los elementos por clave para `cantidad`.
  - `MinuteId.ts`: `minuteIdFor(modelo, desde, hasta)`, un UUID estable para no duplicar la revisión.
- **Aplicación**
  - Puertos: `AutodeskEventRepository` (`recordIfNew(cambio, recibido)` guarda la `dedupeKey` y dice si era nueva) y `AutodeskChangeListener` (a quién se le avisa un cambio nuevo).
  - Caso de uso: `ReceiveAutodeskEvent` traduce el cuerpo con `parseAutodeskWebhook`, lo guarda si es nuevo y solo entonces avisa al listener. Devuelve `recorded` o `duplicate`, y deja pasar el `AutodeskEventError` de un cuerpo que no es un webhook.
- **Adapters**
  - `verifyApsWebhook(cuerpo, cabecera, secreto)` y `signApsWebhook` revisan la firma `x-adsk-signature` (HMAC-SHA1 del cuerpo crudo).
  - `PrismaAutodeskEventRepository` guarda cada aviso en `autodesk_events` (evento, `kind`, recurso, autor, hora y `needsElementDiff`), con `createMany` y `skipDuplicates` sobre la `dedupe_key` única. `InMemoryAutodeskEventRepository` hace lo mismo en memoria, para los tests.
- **En la API**, `POST /api/integrations/autodesk/webhooks` verifica la firma con `APS_WEBHOOK_SECRET` sobre el cuerpo crudo y llama a `ReceiveAutodeskEvent`; el listener es `LoggingAutodeskListener`, que deja una línea por aviso nuevo en el log ([la API](../../apps/api/README.md#rutas)).

## Cómo se escucha una planilla

Con `GOOGLE_WEBHOOK_URL`, **Google avisa** cada vez que alguien edita la planilla (los avisos de Drive, `files.watch`) y la API la revisa al instante. Sin esa variable, la API **le pregunta a Google** cada `INTEGRATIONS_POLL_SECONDS`. En los dos casos la revisión es la misma: `WatchSource`.

- **Al vincular**, `LinkSpreadsheet` abre la planilla con la cuenta de Google de quien la vincula, la deja en el proyecto con su hash como primera revisión y guarda sus celdas en memoria. No avisa nada. Con avisos, la API además llama a `SubscribeSource`.
- **La suscripción.** `SubscribeSource` pide a Drive que avise los cambios del archivo a `GOOGLE_WEBHOOK_URL`, por `INTEGRATIONS_WATCH_HOURS` (24 h como máximo, el tope de Drive para un archivo), y guarda el canal en la base. Necesita que la cuenta haya dado `drive.metadata.readonly`; una cuenta conectada antes de ese permiso sigue con la revisión periódica y la API dice en el log que hay que volver a conectarla.
- **La renovación.** Con los avisos activos, la API corre un timer propio, cada mitad del margen y aunque `INTEGRATIONS_POLL_SECONDS` sea 0, más una vuelta un segundo después de arrancar y cada vuelta del sondeo. Renueva los canales que vencen dentro del margen (2 h, o un cuarto del plazo si es más corto): abre el canal nuevo, lo guarda y después cierra el viejo, así nunca queda un hueco. Los canales viven en la base, así que sobreviven a un reinicio o a un despliegue.
- **El aviso.** Drive llama a `POST /api/integrations/google/notifications` con las cabeceras `X-Goog-*`. `ReceiveNotice` busca la planilla por el id del canal, compara el secreto y el `resourceId`, y decide:
  - `sync` (el aviso inicial de cada canal) y cambios solo de permisos: nada.
  - `update` con `content` o `properties`, o `untrash`: revisar.
  - `trash` o `remove`: anota en la planilla que se borró.
  - Un secreto que no calza, o un `resourceId` que no es el del canal, responde 403; un canal que no conocemos, 204 sin hacer nada (vence solo).
- **La ráfaga.** Una persona que edita genera varios avisos seguidos. La API espera 2 s de calma por planilla y revisa una sola vez; las revisiones, la suscripción y la baja de una misma planilla van en una sola fila y nunca corren en paralelo, así dos suscripciones a la par no dejan un canal huérfano.
- **El respaldo.** Con un canal vigente, el sondeo solo revisa una planilla si pasaron `INTEGRATIONS_FALLBACK_SECONDS` (15 min) desde su última revisión. Si un aviso se pierde, el cambio llega igual.
- **La revisión** (`WatchSource`), con avisos o sin ellos:
  1. La lee completa, con la cuenta de quien la vinculó.
  2. Si el hash es el de la última revisión, solo anota la hora.
  3. Si cambió, compara con la revisión anterior en memoria, anota la hora del cambio y le pasa al `ChangeListener` las celdas que cambiaron. Si la API se reinició y no tiene la revisión anterior, avisa el cambio sin el detalle. Si el hash cambió pero ninguna celda tiene otro valor, no es un cambio.
  4. Cualquier error queda en la planilla (`lastError`) y el caso de uso no lanza. Un error inesperado vuelve con un mensaje genérico y su causa en `failure`, para el log.
  5. Si cambió y la cuenta dio el permiso de Drive, pregunta a Drive quién editó por última vez (`lastModifyingUser`) y lo guarda con el cambio. Si Drive no lo dice, el cambio llega sin autor. Drive lo calla cuando editó una persona sin sesión con el link de edición, y también cuando la cuenta que vinculó la planilla la abre solo por el link («cualquier persona con el link») y no está entre las personas con quienes se compartió. Para ver quién editó, comparte la planilla con esa cuenta.
- Hoy el `ChangeListener` de la API es `LoggingChangeListener`: deja en el log algo como `«Presupuesto» cambió (Daniela Soto): 1 celda. Partidas!C2: 145000 → 150000`, con hasta 10 celdas.
- `GET /api/integrations/projects/:projectId` dice si los avisos están activos (`google.push`) y, por planilla, quién hizo el último cambio (`changedBy`) y hasta cuándo vale su suscripción (`push`). `/conectores` lo muestra.

Drive avisa que **cambió el archivo**, no qué celda ni quién: eso sale de la revisión. Tampoco avisa cuando alguien solo abre o mira la planilla; la API de Drive no da presencia.

## Configurar Google

1. En [Google Cloud Console](https://console.cloud.google.com), crea un proyecto y activa la **Google Sheets API** y la **Google Drive API**.
2. En **Google Auth Platform**, configura la app como «Externo» y déjala en modo de prueba. En **Público**, agrega como usuarios de prueba las cuentas que van a conectar. En modo de prueba, Google acepta hasta 100 usuarios y el permiso vence a los 7 días: después hay que volver a conectar.
3. En **Clientes**, crea un cliente de tipo «Aplicación web» con la URI de redireccionamiento `http://localhost:3000/api/integrations/google/callback`. En un despliegue, es la URL de la web con la misma ruta.
4. En el `.env` de la raíz:

   ```bash
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   INTEGRATIONS_ENCRYPTION_KEY=$(openssl rand -base64 32)
   GOOGLE_WEBHOOK_URL=https://<la-api-pública>/api/integrations/google/notifications
   ```

   `GOOGLE_WEBHOOK_URL` es opcional y tiene que ser HTTPS y alcanzable desde internet: en Render, `https://vigente-api.onrender.com/api/integrations/google/notifications`. En local, abre un túnel a la API (por ejemplo `cloudflared tunnel --url http://localhost:3001`) y usa su URL. Sin ella, la API revisa cada `INTEGRATIONS_POLL_SECONDS`.

5. Corre `pnpm db:migrate`, reinicia la API y entra a `/conectores` con tu cuenta (las cuentas tienen que estar activas: ver [la web](../../apps/web/README.md)).

Al conectar, Google avisa que la app no está verificada: es normal en modo de prueba. En la pantalla de permisos hay que marcar la casilla de ver las hojas de cálculo; sin ella, la conexión falla con «Falta el permiso para leer tus planillas». La casilla de ver los metadatos de Drive activa los avisos al instante y el autor de cada cambio; sin ella, la planilla se revisa cada cierto tiempo. `drive.metadata.readonly` es un permiso restringido de Google: en modo de prueba basta, pero publicar la app para cualquier cuenta pide la verificación de Google (o pasar al selector de Google con `drive.file`).

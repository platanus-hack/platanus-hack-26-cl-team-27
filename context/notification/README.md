# @team27/context-notification

Lleva el impacto a cada afectado. Hay dos tipos de aviso (`NoticeKind`): el **aviso de cambio** (`change`), solo a los afectados, y el **aviso de conflicto** (`conflict`), a los dos autores y a los afectados de los dos cambios que chocan. `NotifyStakeholders` junta los hallazgos de cada persona en un solo aviso (`Notification`) por cambio, en el canal de esa persona, con el enlace al detalle del cambio en su proyecto (`/proyectos/<proyecto>/cambios/<cambio>`). `NotifyConflict` guarda un aviso por persona y solapamiento. `RespondToNotification` guarda lo que contesta.

## Dominio

- **`Stakeholder`:** nombre, rol, canal (`email`, `whatsapp` o `slack`) y su dirección en ese canal (`handle`).
- **`draftNotifications`:** agrupa los hallazgos por afectado, en el orden del directorio, cada uno con su tema (`dependency`, `cost` o `schedule`). Ignora a quien no está en el directorio. Cada aviso guarda el contexto para redactarlo (`NoticeContext`): el rol y el nombre de la persona, el costo y el plazo del cambio (`impact`) y los choques (`clashes`).
- **Tipo de aviso:** va en el contexto (`context.kind`); un aviso sin tipo es de cambio (`noticeKindOf`, `isChangeNotice`). El de conflicto lleva además `context.conflict` (`NoticeConflict`): el solapamiento, los dos elementos con su documento, el área, la pregunta de sí o no, la cifra de los dos cambios juntos, el papel de la persona (`author` o `affected`) y si le toca votar (`votes`).
- **`draftConflictNotices`:** un aviso de conflicto por persona, una sola vez aunque venga repetida, en su canal y con el enlace al cambio de su lado. Ignora a quien no está en el directorio.
- **`renderNotice(aviso, rol, canal)`:** función pura que escribe el aviso para un rol y un canal. Devuelve `{ subject, text, html }`.
  - **Rol** (`noticeRoleOf(rol, hallazgos)`): `costos` si el rol habla de costos o presupuesto, `planificacion` si habla de planificación, plazo o programa; si el rol no lo dice, sale de los hallazgos que recibe la persona, y si no, `ingenieria`. Costos ve primero el hallazgo de costo, y el costo va en el asunto y antes que el plazo; planificación ve primero el plazo; ingeniería, la dependencia y su acción.
  - **Canal:** el correo saluda por el nombre y lleva todo (el detalle de cada hallazgo, en texto y en HTML escapado). WhatsApp va en texto plano y corto: el primer hallazgo con su acción, cuántos más hay, las cifras y el enlace, en 600 caracteres como máximo. Slack usa su formato (título en negrita, un punto por hallazgo con su acción, el enlace con texto), sin el detalle, en 1.500 caracteres como máximo. Al recortar, el enlace se conserva.
  - **Impacto y choque:** si el cambio mueve el costo o el plazo, una línea «Impacto del cambio: costo +$3.636.500 · plazo +1 día». Por cada choque, «Puede chocar con X.», la pregunta de sí o no y, si hay, la cifra de los dos cambios juntos. Un impacto en cero no se anuncia.
  - **Aviso de conflicto:** si el aviso trae `conflict`, sale en su forma: el asunto «Choque: A y B», el porqué fijo según el papel («…porque uno de los dos cambios es tuyo.» o «…te afecta.»), qué choca con qué (cada elemento con su documento), dónde, la pregunta y «Los dos juntos: costo … · plazo …». Sin cifra conjunta va el impacto del cambio, y sin área no dice dónde. A quien valida le pide «Responde si se tocan o no se tocan»; al resto, «Mira el choque». Vale para los tres canales, con los mismos largos máximos.
  - **El porqué:** una frase que dice por qué le toca a esa persona. Si el aviso trae una (`why`, que escribe un modelo en `context/impact`), va esa; si no, una fija según el primer hallazgo: «Te avisamos porque llevas el presupuesto y este cambio lo mueve.», «…porque llevas el plazo y este cambio mueve la entrega.» o «…porque tu trabajo depende de lo que cambió.». `renderNotice` nunca cambia una cifra.
- **Respuesta:** la de un aviso de cambio es `reviewed` (revisado) o `issue` (tengo un problema), con una nota opcional de hasta 280 caracteres. Una nota en blanco se guarda como `null`. Responder de nuevo reemplaza la respuesta anterior. Reabrir la respuesta la limpia: quien disputó vuelve a estar pendiente. Un aviso de conflicto no se responde aquí: su respuesta es el voto del solapamiento, en `lake`.

## Casos de uso y adapters

| Caso de uso             | Qué hace                                                    |
| ----------------------- | ----------------------------------------------------------- |
| `NotifyStakeholders`    | Arma y guarda los avisos de un cambio                       |
| `NotifyConflict`        | Arma y guarda los avisos de conflicto de un solapamiento    |
| `AttachClashes`         | `{ changeId, clashes }`: guarda en los avisos de cambio de un cambio con qué choca; sin choques no hace nada |
| `ListNotifications`     | Los avisos de varios cambios o de un afectado, de un tipo si se pide (`kind`) |
| `RespondToNotification` | Guarda la respuesta; `null` si el aviso no existe           |
| `ReopenResponse`        | `ReopenResponse(notificationId)` limpia la respuesta; `null` si el aviso no existe |
| `GetNotification`       | Un aviso por id, o `null`                                   |
| `ListStakeholders`      | El directorio                                               |
| `DeliverNotifications`  | Una vuelta de envío: toma de la cola los avisos pendientes y los manda por correo |

- `InMemoryStakeholderDirectory`: el equipo de un proyecto, que la API le pasa al armarlo (todos menos el autor).
- `PrismaNotificationRepository`: la tabla `notifications`, con los hallazgos y el contexto en JSON. Al guardar un aviso escribe, en la misma transacción, su entrega por correo en `notification_deliveries`.
- `PrismaDeliveryQueue`: la cola de envío sobre `notification_deliveries`.
- `GmailEmailSender`: manda un correo con la API de Gmail (`users.messages.send`) desde la cuenta autorizada. Renueva el access token con el refresh token y lo reusa hasta un minuto antes de que venza; si Gmail responde 401, lo olvida.
- `gmailAuthorizationUrl` y `exchangeGmailCode`: la autorización OAuth 2.0 de esa cuenta, solo con el permiso `gmail.send`.

## Envío por correo

Cada aviso guardado deja una entrega por correo en la cola (outbox), en la misma transacción que el aviso: si el proveedor está caído, el aviso no se pierde. El destinatario es el `handle` del afectado si es un correo; si no (un teléfono o un canal de Slack), la entrega queda sin destinatario.

- **Tomar.** `claim` reserva hasta 10 entregas pendientes con `FOR UPDATE SKIP LOCKED`, suma un intento y corre `next_attempt_at` 5 minutos: si la API se cae a mitad del envío, la entrega vuelve sola. Las entregas de más de un día no se toman: un aviso viejo ya no es noticia.
- **Armar.** `renderEmail` escribe el correo con `renderNotice`, para el rol de la persona y con el contexto que guardó el aviso: el asunto según el rol, el saludo, el porqué fijo, cada hallazgo con su detalle y qué hacer, el impacto, los choques y el enlace absoluto al detalle para responder. Un aviso sin contexto sale igual, con el título como asunto.
- **Mandar.** Un MIME `multipart/alternative` (texto y HTML en UTF-8) con el id de la entrega en `X-Vigente-Delivery`. Gmail no tiene idempotencia: si el envío sale pero la API se cae antes de marcarlo, se puede repetir. Sin destinatario y sin desvío, la entrega queda `skipped`.
- **Reintentar.** Si falla, espera 1, 4, 16 y 60 minutos; al quinto intento queda `failed` con el último error.

En la API, `DeliveryWorker` corre una vuelta cada 5 segundos si están `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET` y `GMAIL_REFRESH_TOKEN`. `EMAIL_REDIRECT_TO` manda todos los correos a una sola dirección, para probar sin escribirle a los afectados. Sin esas variables, el envío está apagado y los avisos solo se ven en la web, en el detalle de su cambio.

## Autorizar la cuenta que manda

Los correos salen de una sola cuenta de Gmail (`EMAIL_FROM`, hoy `appvigente@gmail.com`), autorizada una vez:

1. En Google Cloud, el cliente OAuth (tipo aplicación web) tiene la URI de redirección `http://localhost:3999/gmail/callback` (`GMAIL_REDIRECT_URI`), y la API de Gmail está habilitada.
2. En la pantalla de consentimiento, la app está **en producción**: en modo de prueba, Google vence el refresh token a los 7 días. Sin verificar, Google muestra una advertencia al autorizar; basta con «Configuración avanzada» → «Ir a Vigente».
3. Con `GMAIL_CLIENT_ID` y `GMAIL_CLIENT_SECRET` en el `.env`, `pnpm gmail:auth` imprime el enlace; se abre con la cuenta que manda, se acepta, y el comando guarda `GMAIL_REFRESH_TOKEN` en el `.env` sin mostrarlo.
4. En otro ambiente (Render), se copian las tres variables: el refresh token sirve en cualquier servidor. Si Google lo revoca (cambio de clave de la cuenta o permiso quitado), los envíos fallan con «Vuelve a autorizar» y se repite el paso 3.

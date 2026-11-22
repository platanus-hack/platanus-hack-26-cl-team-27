# @team27/context-notification

Lleva el impacto a cada afectado. `NotifyStakeholders` junta los hallazgos de cada persona en un solo aviso (`Notification`) por cambio, en el canal de esa persona, con el enlace al detalle del cambio en su proyecto (`/proyectos/<proyecto>/cambios/<cambio>`). `RespondToNotification` guarda lo que contesta.

## Dominio

- **`Stakeholder`:** nombre, rol, canal (`email`, `whatsapp` o `slack`) y su dirección en ese canal (`handle`).
- **`draftNotifications`:** agrupa los hallazgos por afectado, en el orden del directorio. Ignora a quien no está en el directorio.
- **Respuesta:** `reviewed` (revisado) o `issue` (tengo un problema), con una nota opcional de hasta 280 caracteres. Una nota en blanco se guarda como `null`. Responder de nuevo reemplaza la respuesta anterior. Reabrir la respuesta la limpia: quien disputó vuelve a estar pendiente.

## Casos de uso y adapters

| Caso de uso             | Qué hace                                                    |
| ----------------------- | ----------------------------------------------------------- |
| `NotifyStakeholders`    | Arma y guarda los avisos de un cambio                       |
| `ListNotifications`     | Los avisos de varios cambios o de un afectado               |
| `RespondToNotification` | Guarda la respuesta; `null` si el aviso no existe           |
| `ReopenResponse`        | `ReopenResponse(notificationId)` limpia la respuesta; `null` si el aviso no existe |
| `GetNotification`       | Un aviso por id, o `null`                                   |
| `ListStakeholders`      | El directorio                                               |
| `DeliverNotifications`  | Una vuelta de envío: toma de la cola los avisos pendientes y los manda por correo |

- `InMemoryStakeholderDirectory`: el equipo de un proyecto, que la API le pasa al armarlo (todos menos el autor).
- `PrismaNotificationRepository`: la tabla `notifications`, con los hallazgos en JSON. Al guardar un aviso escribe, en la misma transacción, su entrega por correo en `notification_deliveries`.
- `PrismaDeliveryQueue`: la cola de envío sobre `notification_deliveries`.
- `GmailEmailSender`: manda un correo con la API de Gmail (`users.messages.send`) desde la cuenta autorizada. Renueva el access token con el refresh token y lo reusa hasta un minuto antes de que venza; si Gmail responde 401, lo olvida.
- `gmailAuthorizationUrl` y `exchangeGmailCode`: la autorización OAuth 2.0 de esa cuenta, solo con el permiso `gmail.send`.

## Envío por correo

Cada aviso guardado deja una entrega por correo en la cola (outbox), en la misma transacción que el aviso: si el proveedor está caído, el aviso no se pierde. El destinatario es el `handle` del afectado si es un correo; si no (un teléfono o un canal de Slack), la entrega queda sin destinatario.

- **Tomar.** `claim` reserva hasta 10 entregas pendientes con `FOR UPDATE SKIP LOCKED`, suma un intento y corre `next_attempt_at` 5 minutos: si la API se cae a mitad del envío, la entrega vuelve sola. Las entregas de más de un día no se toman: un aviso viejo ya no es noticia.
- **Armar.** `renderEmail` usa el título del aviso como asunto, y en el cuerpo (texto y HTML escapado) cada hallazgo con su detalle, qué hacer y el enlace absoluto al detalle para responder.
- **Mandar.** Un MIME `multipart/alternative` (texto y HTML en UTF-8) con el id de la entrega en `X-Vigente-Delivery`. Gmail no tiene idempotencia: si el envío sale pero la API se cae antes de marcarlo, se puede repetir. Sin destinatario y sin desvío, la entrega queda `skipped`.
- **Reintentar.** Si falla, espera 1, 4, 16 y 60 minutos; al quinto intento queda `failed` con el último error.

En la API, `DeliveryWorker` corre una vuelta cada 5 segundos si están `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET` y `GMAIL_REFRESH_TOKEN`. `EMAIL_REDIRECT_TO` manda todos los correos a una sola dirección, para probar sin escribirle a los afectados. Sin esas variables, el envío está apagado y los avisos solo se ven en la web, en el detalle de su cambio.

## Autorizar la cuenta que manda

Los correos salen de una sola cuenta de Gmail (`EMAIL_FROM`, hoy `appvigente@gmail.com`), autorizada una vez:

1. En Google Cloud, el cliente OAuth (tipo aplicación web) tiene la URI de redirección `http://localhost:3999/gmail/callback` (`GMAIL_REDIRECT_URI`), y la API de Gmail está habilitada.
2. En la pantalla de consentimiento, la app está **en producción**: en modo de prueba, Google vence el refresh token a los 7 días. Sin verificar, Google muestra una advertencia al autorizar; basta con «Configuración avanzada» → «Ir a Vigente».
3. Con `GMAIL_CLIENT_ID` y `GMAIL_CLIENT_SECRET` en el `.env`, `pnpm gmail:auth` imprime el enlace; se abre con la cuenta que manda, se acepta, y el comando guarda `GMAIL_REFRESH_TOKEN` en el `.env` sin mostrarlo.
4. En otro ambiente (Render), se copian las tres variables: el refresh token sirve en cualquier servidor. Si Google lo revoca (cambio de clave de la cuenta o permiso quitado), los envíos fallan con «Vuelve a autorizar» y se repite el paso 3.

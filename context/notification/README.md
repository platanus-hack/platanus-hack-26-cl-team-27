# @team27/context-notification

Lleva el impacto a cada afectado. `NotifyStakeholders` junta los hallazgos de cada persona en un solo aviso (`Notification`) por cambio, en el canal de esa persona, con el enlace al detalle (`/cambios/<cambio>?para=<afectado>`). `RespondToNotification` guarda lo que contesta.

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

- `InMemoryStakeholderDirectory`: el elenco del guion de la muestra.
- `PrismaNotificationRepository`: la tabla `notifications`, con los hallazgos en JSON.

Un aviso guardado es un aviso entregado: los canales de la muestra son simulados ([espacio controlado](../../docs/muestra.md#espacio-controlado)).

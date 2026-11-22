# Integraciones: Google Sheets y ACC

El canal con las planillas de Google Sheets y lo que falta para ACC. Las issues son [PH-17](https://linear.app/ph-team-27/issue/PH-17/conector-de-google-sheets-para-el-presupuesto) (Google Sheets) y [PH-39](https://linear.app/ph-team-27/issue/PH-39/conector-de-presupuestos-de-acc-cost-management) (ACC).

**Estado:** el canal de Google Sheets está construido: [`context/integrations`](../../context/integrations/README.md), `apps/api/src/modules/integrations` y la vista `/conectores`. Conectar la cuenta y vincular una planilla están probados con una cuenta real de Google. La cuenta de Autodesk de cada organización se conecta con OAuth en `/cuenta` (`apps/api/src/modules/integrations/aps`), pero nada lee ACC todavía. La API sí recibe los webhooks de Autodesk y deja cada aviso en el log ([cambios en Autodesk](cambios-autodesk.md#el-receptor)).

## Objetivo

Que Vigente quede **enlazado** a las planillas donde ya vive la información de la obra y **escuche** sus cambios. El canal es solo de conexión y escucha:

1. **Conectar** la cuenta de Google desde la web, con un permiso de solo lectura guardado cifrado.
2. **Vincular** una o varias planillas por su link. Queda guardado su id y su link, para que un servicio futuro entre a leerlas.
3. **Escuchar:** con `GOOGLE_WEBHOOK_URL`, Google avisa cada cambio y la API revisa la planilla al instante, con una revisión de respaldo cada `INTEGRATIONS_FALLBACK_SECONDS` (15 min); sin ella, la API revisa cada planilla cada `INTEGRATIONS_POLL_SECONDS` (60 s). Cuando cambia, sabe qué celdas cambiaron, con el valor anterior y el nuevo.

**Listo cuando:** con la cuenta conectada y la planilla vinculada, alguien cambia un precio en la planilla y, en menos de dos minutos, `/conectores` muestra el último cambio y el log de la API dice qué celda cambió y cómo.

## Fuera del canal

- **Interpretar la planilla** (por ejemplo, leerla como presupuesto) y entregar sus hechos a la obra como revisiones. Un primer lector del presupuesto quedó fuera del alcance: está en el commit `7f33caa`, por si sirve de punto de partida.
- **Guardar lo que se escucha.** Hoy las celdas que cambiaron quedan en el log de la API y en memoria; en `integration_sources` solo se guarda cuándo cambió y quién (`changed_at`, `changed_by`). Para guardarlo o actuar sobre él basta otro `ChangeListener`.
- **Documentos.** Las planillas son de un proyecto y cada cuenta de Google es de quien la conectó ([PH-48](https://linear.app/ph-team-27/issue/PH-48/asociar-las-planillas-conectadas-a-un-usuario-o-a-un-proyecto), ver [de quién es cada cosa](../../context/integrations/README.md#de-quién-es-cada-cosa)), pero una planilla todavía no es un documento del proyecto. La conexión con Autodesk, en cambio, es una por organización (`aps_connections`): Google lee con el permiso de cada persona sobre sus archivos y Autodesk con el de la organización sobre sus proyectos de ACC.
- **El selector de Google** (Picker) para elegir varios archivos del Drive con el permiso `drive.file`.
- ACC, Presto, Excel `.xlsx` en Drive, OneDrive y SharePoint.

## Preguntar o que Google avise

Están los dos. Con `GOOGLE_WEBHOOK_URL`, Google avisa (`files.watch`) y la API revisa al instante, con un sondeo lento de respaldo; sin ella, la API pregunta cada `INTEGRATIONS_POLL_SECONDS`. Cómo funciona: [integrations](../../context/integrations/README.md#cómo-se-escucha-una-planilla). La comparación:

|                   | Preguntar                                                                                    | Que Google avise                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Funciona en local | Sí                                                                                           | No: Google llama a una URL pública con HTTPS (en local, con un túnel)               |
| Qué dice          | Leemos la planilla y comparamos: sabemos qué celdas cambiaron                                | Solo «este archivo cambió»; igual hay que leerla                                    |
| Mantención        | Ninguna                                                                                      | Cada suscripción vence (para un archivo, en un día como máximo) y hay que renovarla |
| Rapidez           | Hasta 60 s                                                                                   | Casi al instante, aunque Google a veces agrupa o retrasa los avisos                 |
| A escala          | Dos llamadas por planilla por revisión: choca con los límites de la API con muchas planillas | Solo se llama cuando algo cambió                                                    |
| Permiso           | `spreadsheets.readonly`                                                                      | `drive.metadata.readonly` hoy; `drive.file` con el selector                         |

Hoy los avisos usan `drive.metadata.readonly`, un permiso restringido: sirve en modo de prueba. Para publicar la app, el camino es el selector de Google con `drive.file`, que evita la verificación de permisos restringidos.

## Lo que sigue

1. **Un `ChangeListener` que guarde o actúe:** por ejemplo, entregar la planilla a la cadena como revisión de un documento, con un lector por formato.
2. **La planilla como documento del proyecto.** Ya es del proyecto; falta acordar con el equipo cómo se crea un documento desde un archivo del Drive y quién es su dueño en el elenco. Y un solo cifrado de tokens: hoy Google usa `INTEGRATIONS_ENCRYPTION_KEY` (`TokenCipher` de `context/integrations`) y Autodesk usa `APS_TOKEN_KEY` (AES-256-GCM en `apps/api/src/modules/integrations/aps`).
3. **El selector de Google con varios archivos** y `drive.file`, para publicar la app sin el permiso restringido.
4. **ACC** ([PH-39](https://linear.app/ph-team-27/issue/PH-39/conector-de-presupuestos-de-acc-cost-management)): el mismo canal, con los tokens de la cuenta de Autodesk que cada organización conecta en `/cuenta` ([PH-25](https://linear.app/ph-team-27/issue/PH-25/conexion-oauth-con-autodesk-aps); `getValidAccessToken` los renueva) y una cuenta de ACC con Cost Management para probar. Un administrador de esa cuenta tiene que agregar el Client ID de la app en Account Admin → Custom Integrations.

## Decisiones abiertas

1. **Google en modo prueba.** Admite hasta 100 usuarios de prueba y el permiso vence a los 7 días. Para producción hay que verificar la app con Google; con `drive.file` la verificación es más simple.
2. **Excel.** Este canal escucha planillas de Google Sheets. Si los clientes tienen sus Excel en OneDrive o SharePoint, el equivalente es un conector de Microsoft.

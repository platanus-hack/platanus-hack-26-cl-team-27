# Integraciones: Google Sheets y ACC

El canal con las planillas de Google Sheets y lo que falta para ACC. Las issues son [PH-17](https://linear.app/ph-team-27/issue/PH-17/conector-de-google-sheets-para-el-presupuesto) (Google Sheets) y [PH-39](https://linear.app/ph-team-27/issue/PH-39/conector-de-presupuestos-de-acc-cost-management) (ACC).

**Estado:** el canal de Google Sheets está construido: [`context/integrations`](../../context/integrations/README.md), `apps/api/src/modules/integrations` y la vista `/conectores`. Conectar la cuenta y vincular una planilla están probados con una cuenta real de Google. La cuenta de Autodesk de cada organización se conecta con OAuth en `/cuenta` (`apps/api/src/modules/integrations/aps`), pero nada lee ACC todavía.

## Objetivo

Que Vigente quede **enlazado** a las planillas donde ya vive la información de la obra y **escuche** sus cambios. El canal es solo de conexión y escucha:

1. **Conectar** la cuenta de Google desde la web, con un permiso de solo lectura guardado cifrado.
2. **Vincular** una o varias planillas por su link. Queda guardado su id y su link, para que un servicio futuro entre a leerlas.
3. **Escuchar:** la API revisa cada planilla cada `INTEGRATIONS_POLL_SECONDS` (60 s) y, cuando cambia, sabe qué celdas cambiaron, con el valor anterior y el nuevo.

**Listo cuando:** con la cuenta conectada y la planilla vinculada, alguien cambia un precio en la planilla y, en menos de dos minutos, `/conectores` muestra el último cambio y el log de la API dice qué celda cambió y cómo.

## Fuera del canal

- **Interpretar la planilla** (por ejemplo, leerla como presupuesto) y entregar sus hechos a la obra como revisiones. Un primer lector del presupuesto quedó fuera del alcance: está en el commit `7f33caa`, por si sirve de punto de partida.
- **Guardar lo que se escucha.** Hoy el cambio queda en el log de la API y en memoria. Para guardarlo o actuar sobre él basta otro `ChangeListener`.
- **Documentos.** Las planillas son de un proyecto y cada cuenta de Google es de quien la conectó ([PH-48](https://linear.app/ph-team-27/issue/PH-48/asociar-las-planillas-conectadas-a-un-usuario-o-a-un-proyecto), ver [de quién es cada cosa](../../context/integrations/README.md#de-quién-es-cada-cosa)), pero una planilla todavía no es un documento del proyecto. La conexión con Autodesk, en cambio, es una por organización (`aps_connections`): Google lee con el permiso de cada persona sobre sus archivos y Autodesk con el de la organización sobre sus proyectos de ACC.
- **El selector de Google** (Picker) para elegir varios archivos del Drive con el permiso `drive.file`.
- ACC, Presto, Excel `.xlsx` en Drive, OneDrive y SharePoint.

## Preguntar o que Google avise

Hoy la API **le pregunta a Google** cada 60 s. Google también puede avisar solo, con los avisos de Drive (`files.watch`):

|                   | Preguntar (lo que hay)                                                                       | Que Google avise                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Funciona en local | Sí                                                                                           | No: Google llama a una URL pública con HTTPS (en local, con un túnel)               |
| Qué dice          | Leemos la planilla y comparamos: sabemos qué celdas cambiaron                                | Solo «este archivo cambió»; igual hay que leerla                                    |
| Mantención        | Ninguna                                                                                      | Cada suscripción vence (para un archivo, en un día como máximo) y hay que renovarla |
| Rapidez           | Hasta 60 s                                                                                   | Casi al instante, aunque Google a veces agrupa o retrasa los avisos                 |
| A escala          | Dos llamadas por planilla por revisión: choca con los límites de la API con muchas planillas | Solo se llama cuando algo cambió                                                    |
| Permiso           | `spreadsheets.readonly`                                                                      | Uno de Drive, como `drive.file`                                                     |

Con pocas planillas alcanza con preguntar. Con muchos usuarios, lo mejor son los dos: los avisos de Google como gatillo y una revisión lenta (cada 10 o 15 minutos) de respaldo. Calza con pasar al selector de Google con `drive.file`, que además evita la verificación de permisos sensibles de Google.

## Lo que sigue

1. **Un `ChangeListener` que guarde o actúe:** por ejemplo, entregar la planilla a la cadena como revisión de un documento, con un lector por formato.
2. **La planilla como documento del proyecto.** Ya es del proyecto; falta acordar con el equipo cómo se crea un documento desde un archivo del Drive y quién es su dueño en el equipo del proyecto. Y un solo cifrado de tokens: hoy Google usa `INTEGRATIONS_ENCRYPTION_KEY` (`TokenCipher` de `context/integrations`) y Autodesk usa `APS_TOKEN_KEY` (AES-256-GCM en `apps/api/src/modules/integrations/aps`).
3. **El selector de Google con varios archivos y los avisos de Drive**, para producción.
4. **ACC** ([PH-39](https://linear.app/ph-team-27/issue/PH-39/conector-de-presupuestos-de-acc-cost-management)): el mismo canal, con los tokens de la cuenta de Autodesk que cada organización conecta en `/cuenta` ([PH-25](https://linear.app/ph-team-27/issue/PH-25/conexion-oauth-con-autodesk-aps); `getValidAccessToken` los renueva) y una cuenta de ACC con Cost Management para probar. Un administrador de esa cuenta tiene que agregar el Client ID de la app en Account Admin → Custom Integrations.

## Decisiones abiertas

1. **Google en modo prueba.** Admite hasta 100 usuarios de prueba y el permiso vence a los 7 días. Para producción hay que verificar la app con Google; con `drive.file` la verificación es más simple.
2. **Excel.** Este canal escucha planillas de Google Sheets. Si los clientes tienen sus Excel en OneDrive o SharePoint, el equivalente es un conector de Microsoft.

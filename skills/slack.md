# SKILL CONFIGURATION: SLACK INTEGRATION
# VERSION: 1.0 (TOKEN-OPTIMIZED)

## DEFINICIÓN
Permite al Voice Agent enviar alertas, interactuar en canales de Slack y despachar recordatorios proactivos de forma enriquecida.

## ESQUEMAS DE PARÁMETROS

### `send_message`
* **Parámetros:** `channel` (str), `text` (str)
* **Objetivo:** Publicar mensaje de texto estándar en un canal o chat directo.

### `send_interactive_blocks`
* **Parámetros:** `channel` (str), `blocks` (array de Slack Block Kit)
* **Objetivo:** Enviar encuestas, notificaciones con botones de acción (ej: Aprobar Script Python).

### `create_channel`
* **Parámetros:** `channel_name` (str)
* **Objetivo:** Crear un nuevo canal público/privado de trabajo.

## FORMATO DE NOTIFICACIÓN DE APROBACIÓN
Utilizar Slack Block Kit para las solicitudes de aprobación de código Python, incorporando el ID de ejecución, el propósito, el script resumido, y dos botones: "Aprobar" y "Rechazar".

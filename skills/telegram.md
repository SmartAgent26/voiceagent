# SKILL CONFIGURATION: TELEGRAM BOT
# VERSION: 1.0 (TOKEN-OPTIMIZED)

## DEFINICIÓN
Permite al Voice Agent recibir y enviar mensajes de voz (.ogg), texto y botones interactivos (inline keyboards) a través del bot de Telegram.

## ESQUEMAS DE PARÁMETROS

### `send_text`
* **Parámetros:** `chat_id` (str/int), `text` (str), `parse_mode` (str, default 'MarkdownV2')
* **Objetivo:** Enviar mensajes de texto formateados.

### `send_voice`
* **Parámetros:** `chat_id` (str/int), `voice_bytes_base64` (str)
* **Objetivo:** Enviar respuestas habladas generadas por el sintetizador directamente como nota de voz.

### `send_inline_approval`
* **Parámetros:** `chat_id` (str/int), `execution_id` (str), `purpose` (str)
* **Objetivo:** Enviar una alerta con el script de Python pendiente y dos botones inline: "Aprobar Ejecución" y "Rechazar".

## REGLAS
Soportar la conversión de notas de voz entrantes (`.ogg`) enviándolas al API de Whisper antes de pasárselas al Orquestador.

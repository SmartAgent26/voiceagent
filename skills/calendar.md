# SKILL CONFIGURATION: GOOGLE CALENDAR
# VERSION: 1.0 (TOKEN-OPTIMIZED)

## DEFINICIÓN
Permite al Voice Agent leer, crear, modificar y eliminar eventos en el calendario de Google del usuario.

## ESQUEMAS DE PARÁMETROS

### `list_events`
* **Parámetros:** `time_min` (iso timestamp), `time_max` (iso timestamp), `max_results` (int, default 10)
* **Objetivo:** Retorna lista resumida de eventos en el rango especificado.

### `create_event`
* **Parámetros:** `summary` (str), `start_time` (iso timestamp), `end_time` (iso timestamp), `description` (str, opcional), `attendees` (array email, opcional)
* **Regla de Validación:** Verificar solapamiento de horario. Si existe conflicto, avisar al usuario por voz antes de confirmar.

### `update_event`
* **Parámetros:** `event_id` (str), `updates` (jsonb de campos a modificar: start_time, end_time, summary, etc.)

## FORMATO DE SALIDA (RETORNO AL AGENTE)
JSON compacto con el estado de la operación y detalles clave del evento creado o modificado.

# SKILL CONFIGURATION: HEARTBEAT PROACTIVE ENGINE
# VERSION: 1.0 (TOKEN-OPTIMIZED)

## DEFINICIÓN
Permite al agente reanudar de forma proactiva la conversación con el usuario a través de Telegram o Slack si se detecta un periodo prolongado de inactividad.

## MECANISMO DE CONTROL

### 1. Monitoreo de Inactividad
* **Intervalo de Escaneo:** Un cron job local o Supabase `pg_cron` se ejecuta cada 1 hora.
* **Umbral de Inactividad:** Se activa si `short_term_sessions.updated_at` es mayor a 24 horas (ajustable por usuario).

### 2. Extracción de Contexto Proactivo
* Al cumplirse el umbral, el motor despierta al **Subagente de Memoria** para analizar:
  1. Tareas pendientes cercanas al vencimiento en `pending_tasks_reminders`.
  2. Reuniones importantes en `skills/calendar.md`.
  3. Conversaciones previas e intereses relevantes del usuario en `long_term_memories`.
* **Construcción del Mensaje:** Genera un mensaje corto, personalizado y motivador, en lugar de un "hola" genérico.

### 3. Envío de Notificación
* Despacha el mensaje conversacional directamente a **Telegram** o **Slack** del usuario.
* Si el usuario responde, se actualiza `short_term_sessions` de inmediato, restableciendo la ventana activa de diálogo de corto plazo.

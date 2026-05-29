# SKILL CONFIGURATION: PYTHON SANDBOX EXECUTION
# VERSION: 1.0 (TOKEN-OPTIMIZED)

## DEFINICIÓN
Permite al Tool Agent escribir y ejecutar código Python en un entorno de desarrollo aislado (sandbox) únicamente bajo aprobación explícita del usuario en la PWA, Telegram o Slack.

## PROTOCOLO DE SEGURIDAD & EJECUCIÓN

### 1. Borrador de Código
* El agente escribe el script asegurándose de capturar excepciones y usar bibliotecas estándar.
* **Prohibido:** Acciones dañinas del sistema operativo (rmdir, borrar archivos del sistema) o llamadas de red no autorizadas.

### 2. Registro & Cola de Aprobación
* Se registra la solicitud insertando un registro en la tabla `python_executions`:
  ```sql
  insert into python_executions (user_id, script_code, purpose, status)
  values ('user_uuid', 'print("hola")', 'Procesar reporte', 'pending_approval');
  ```
* Se gatilla una alerta de aprobación con el ID correspondiente a los canales habilitados del usuario.

### 3. Ejecución
* Una vez que el usuario aprueba (`status = 'approved'`), el backend levanta un proceso aislado, ejecuta el script, captura stdout/stderr y actualiza:
  `status = 'executed'`, `result_output = 'consola...'`.
* El agente recibe el resultado y le formula al usuario una respuesta conversacional final.

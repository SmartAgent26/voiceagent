# SKILL CONFIGURATION: CLOUD STORAGE (GOOGLE DRIVE)
# VERSION: 1.0 (TOKEN-OPTIMIZED)

## DEFINICIÓN
Permite al Voice Agent buscar, listar y subir archivos de la carpeta compartida en Google Drive.

## ESQUEMAS DE PARÁMETROS

### `list_files`
* **Parámetros:** `folder_id` (str, opcional), `max_results` (int, default 10)
* **Objetivo:** Listar archivos (nombre, ID, tipo, fecha de modificación) en la carpeta compartida.

### `search_files`
* **Parámetros:** `query` (str, término de búsqueda), `file_type` (str, filtro opcional)
* **Objetivo:** Buscar coincidencias de archivos por nombre o contenido.

### `upload_file`
* **Parámetros:** `filename` (str), `content_bytes` (base64), `mime_type` (str)
* **Objetivo:** Subir un archivo generado o documento a la carpeta de Drive del usuario.

## REGLAS
1. Mantener los nombres de archivos limpios y descriptivos.
2. Tras subir un archivo, notificar de inmediato al Subagente de Memoria para su posterior indexación semántica en la base de datos vectorial.

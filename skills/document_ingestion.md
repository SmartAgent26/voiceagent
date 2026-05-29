# SKILL CONFIGURATION: DOCUMENT INGESTION (RAG PIPELINE)
# VERSION: 1.0 (TOKEN-OPTIMIZED)

## DEFINICIÓN
Habilita el procesamiento de archivos subidos por el usuario (PDF, Markdown, TXT, CSV, etc.) de una carpeta compartida en la nube para estructurar sus contenidos y guardarlos vectorialmente en la memoria de largo plazo (`long_term_memories`).

## FLUJO DE INGESTA

### 1. Lectura y Extracción
* El backend monitorea o recibe el archivo.
* Extrae el texto plano.

### 2. Chunking Semántico (Eficiente en Tokens)
* **Tamaño del Bloque:** Máximo de 256 tokens por fragmento.
* **Solapamiento:** 20-30 tokens para mantener coherencia semántica en los bordes.

### 3. Tagueado Inteligente (Metadatos)
* Para cada fragmento, el **Subagente de Memoria** analiza el texto y genera un JSON compacto:
  ```json
  {
    "tags": ["temática principal", "subcategoría"],
    "keywords": ["palabra_clave_1", "palabra_clave_2"],
    "file_type": "extensión del archivo",
    "source_reference": "nombre_original.pdf",
    "created_at_source": "timestamp original si existe"
  }
  ```

### 4. Vectorización e Indexación
* Genera los embeddings del chunk de texto.
* Guarda en la tabla `long_term_memories` con `source_type = 'file_upload'`, vinculando el texto, el vector embedding y el objeto JSON de metadatos.

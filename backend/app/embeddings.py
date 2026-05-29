import os
from typing import List
from app.config import settings

def get_text_embedding(text: str) -> List[float]:
    """
    Genera un vector embedding (1536 dimensiones) para un texto dado.
    Utiliza Gemini o OpenAI según la disponibilidad de API keys,
    con un fallback local de ceros para desarrollo offline robusto.
    """
    # 1. Intentar con Gemini
    if settings.GEMINI_API_KEY:
        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.GEMINI_API_KEY)
            # Gemini models: 'models/embedding-001' or similar
            response = genai.embed_content(
                model="models/embedding-001",
                content=text,
                task_type="retrieval_document"
            )
            # Redimensionar o asegurar 1536 flotantes si es necesario
            embedding = response.get("embedding", [])
            if len(embedding) == 1536:
                return embedding
            # Si tiene un tamaño diferente (ej: 768 en Gemini), rellenamos o truncamos para pgvector
            if len(embedding) > 0:
                if len(embedding) < 1536:
                    return embedding + [0.0] * (1536 - len(embedding))
                return embedding[:1536]
        except Exception as e:
            print(f"Error al generar embedding con Gemini API: {e}")

    # 2. Intentar con OpenAI
    if settings.OPENAI_API_KEY:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            response = client.embeddings.create(
                model="text-embedding-3-small", # 1536 dimensiones
                input=[text.replace("\n", " ")]
            )
            return response.data[0].embedding
        except Exception as e:
            print(f"Error al generar embedding con OpenAI API: {e}")

    # 3. Fallback seguro para desarrollo local sin costo
    # Genera un vector pseudo-semántico simple para que pgvector funcione sin crasheos
    # (un vector de 1536 dimensiones relleno con el hash del texto y ceros)
    print("Advertencia: Generando embedding pseudo-semántico (fallback sin API Key)...")
    import hashlib
    text_hash = int(hashlib.md5(text.encode('utf-8')).hexdigest(), 16)
    pseudo_val = (text_hash % 1000) / 1000.0
    
    embedding = [0.0] * 1536
    embedding[0] = pseudo_val
    embedding[1] = 1.0 - pseudo_val
    # Añadir hashes adicionales en algunas posiciones fijas para dar cierta variabilidad
    for i in range(2, 10):
        embedding[i] = ((text_hash >> i) % 100) / 100.0
        
    return embedding

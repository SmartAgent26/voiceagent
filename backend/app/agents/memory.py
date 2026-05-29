from typing import Dict, Any, List, Optional
import json
import os
from app.database import (
    supabase,
    get_or_create_session,
    add_long_term_memory,
    search_semantic_memories
)
from app.embeddings import get_text_embedding

class MemoryAgent:
    def __init__(self, user_id: str):
        self.user_id = user_id
        
        # Cargar prompt de sistema
        prompts_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "prompts")
        prompt_path = os.path.join(prompts_dir, "memory_agent.md")
        if os.path.exists(prompt_path):
            with open(prompt_path, 'r', encoding='utf-8') as f:
                self.system_prompt = f.read()
        else:
            self.system_prompt = "Eres un Subagente de Administración de Memoria."

    def get_runtime_context(self, session_id: str, query_text: str) -> Dict[str, Any]:
        """
        Recupera el contexto consolidado de corto y largo plazo.
        Aplica filtros vectoriales e inyecta preferencias.
        """
        # 1. Recuperar memoria de corto plazo (sesión conversacional actual)
        session = get_or_create_session(session_id, self.user_id)
        chat_history = session.get("messages", [])

        # 2. Recuperar preferencias (Submemoria 1 - datos estáticos)
        preferences_text = self._load_user_preferences()

        # 3. Buscar memorias semánticas vectoriales (Submemoria 2)
        embedding = get_text_embedding(query_text)
        semantic_memories = search_semantic_memories(self.user_id, embedding, match_threshold=0.6, match_count=3)

        return {
            "chat_history": chat_history,
            "preferences": preferences_text,
            "semantic_memories": semantic_memories
        }

    def ingest_document(self, filename: str, content: str, file_type: str = "txt") -> int:
        """
        Pipeline RAG de Ingesta:
        1. Fragmenta el texto en chunks de max 256 tokens.
        2. Taguea inteligentemente con metadatos.
        3. Genera embeddings vectoriales.
        4. Guarda en la base vectorial pgvector de Supabase.
        Retorna la cantidad de chunks creados.
        """
        chunks = self._chunk_text(content, max_tokens=250, overlap=25)
        
        for index, chunk in enumerate(chunks):
            # Tagueado inteligente con metadatos
            # En producción, se puede usar un LLM para extraer keywords precisas
            tags = self._extract_basic_tags(chunk, filename)
            metadata = {
                "tags": tags,
                "file_type": file_type,
                "source_reference": filename,
                "chunk_index": index,
                "total_chunks": len(chunks)
            }
            
            # Generar embedding vectorial
            embedding = get_text_embedding(chunk)
            
            # Guardar en Supabase long_term_memories
            add_long_term_memory(
                user_id=self.user_id,
                summary=chunk,
                embedding=embedding,
                source_type="file_upload",
                source_reference=filename,
                metadata=metadata
            )
            
        return len(chunks)

    def extract_and_save_preferences(self, text: str) -> List[str]:
        """
        Analiza el texto buscando nuevos datos sobre preferencias o familia.
        En producción llama al LLM. Retorna claves agregadas/modificadas.
        """
        # Mock simple de extracción estructural de datos para desarrollo base
        extracted_keys = []
        lower_text = text.lower()
        
        import re
        # Ejemplo: "mi hermano se llama Carlos" -> key "hermano_nombre"
        family_match = re.search(r"mi (mamá|papá|esposa|esposo|hijo|hija|hermano|hermana) se llama (\w+)", lower_text)
        if family_match:
            relationship = family_match.group(1)
            name = family_match.group(2).capitalize()
            self._save_preference("family", relationship, {"name": name})
            extracted_keys.append(relationship)
            
        return extracted_keys

    # ==========================================
    # Funciones Auxiliares Privadas
    # ==========================================

    def _load_user_preferences(self) -> str:
        """Lee y concatena las preferencias fijas del usuario."""
        if not supabase:
            return "No hay preferencias configuradas."
        try:
            response = supabase.table("user_preferences").select("*").eq("user_id", self.user_id).execute()
            data = response.data or []
            if not data:
                return "No hay preferencias configuradas."
            
            formatted = []
            for pref in data:
                formatted.append(f"- [{pref.get('category')} / {pref.get('key')}]: {json.dumps(pref.get('value'))}")
            return "\n".join(formatted)
        except Exception as e:
            print(f"Error al cargar user_preferences: {e}")
            return "Error al cargar preferencias."

    def _save_preference(self, category: str, key: str, value: Dict[str, Any]) -> bool:
        """Guarda un registro de preferencia."""
        if not supabase:
            return False
        try:
            payload = {
                "user_id": self.user_id,
                "category": category,
                "key": key,
                "value": value
            }
            supabase.table("user_preferences").upsert(payload).execute()
            return True
        except Exception as e:
            print(f"Error al guardar preferencia: {e}")
            return False

    def _chunk_text(self, text: str, max_tokens: int = 250, overlap: int = 25) -> List[str]:
        """
        Divide un texto de forma semántica basada en palabras acotando tokens.
        (Usa una aproximación simple de 1 palabra = 1.3 tokens para RAG local).
        """
        words = text.split()
        chunks = []
        step = max_tokens - overlap
        
        for i in range(0, len(words), step):
            chunk_words = words[i:i + max_tokens]
            chunks.append(" ".join(chunk_words))
            if i + max_tokens >= len(words):
                break
                
        return chunks

    def _extract_basic_tags(self, text: str, filename: str) -> List[str]:
        """Extrae tags básicos a partir del nombre del archivo y contenido."""
        tags = ["ingestado"]
        ext = filename.split(".")[-1]
        tags.append(ext.lower())
        
        # Filtro de keywords simple
        lower_text = text.lower()
        keywords = ["factura", "reporte", "agenda", "reunión", "familia", "proyecto", "código"]
        for kw in keywords:
            if kw in lower_text:
                tags.append(kw)
        return list(set(tags))

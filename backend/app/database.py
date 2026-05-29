from supabase import create_client, Client
from app.config import settings
import json
from typing import Dict, Any, List, Optional

# Inicializar cliente administrativo de Supabase
supabase: Client = None
if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
    try:
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
        print("Cliente de Supabase administrativo inicializado con éxito.")
    except Exception as e:
        print(f"Error al inicializar cliente administrativo de Supabase: {e}")

# ==========================================
# Helpers de Identidad y Perfil del Agente
# ==========================================

def get_agent_profile(user_id: str) -> Optional[Dict[str, Any]]:
    """Obtiene el perfil del agente de un usuario específico."""
    if not supabase:
        return None
    try:
        response = supabase.table("agent_profile").select("*").eq("user_id", user_id).maybe_single().execute()
        return response.data if response is not None else None
    except Exception as e:
        print(f"Error al obtener agent_profile: {e}")
        return None

def save_agent_profile(user_id: str, profile_data: Dict[str, Any]) -> bool:
    """Inserta o actualiza el perfil del agente de un usuario."""
    if not supabase:
        return False
    try:
        # Asegurar que el user_id esté en el payload
        profile_data["user_id"] = user_id
        # Upsert: actualiza si existe, inserta si no
        supabase.table("agent_profile").upsert(profile_data).execute()
        return True
    except Exception as e:
        print(f"Error al guardar agent_profile: {e}")
        return False

# ==========================================
# Helpers de Skills del Agente
# ==========================================

def get_agent_skills(user_id: str) -> List[Dict[str, Any]]:
    """Obtiene la lista de switches de habilidades (skills) de un usuario."""
    if not supabase:
        return []
    try:
        response = supabase.table("agent_skills").select("*").eq("user_id", user_id).execute()
        return response.data if (response is not None and response.data is not None) else []
    except Exception as e:
        print(f"Error al obtener agent_skills: {e}")
        return []

def is_skill_enabled(user_id: str, skill_name: str) -> bool:
    """Verifica de forma rápida si un skill está activo para el usuario."""
    if not supabase:
        return False
    try:
        response = supabase.table("agent_skills") \
            .select("is_enabled") \
            .eq("user_id", user_id) \
            .eq("skill_name", skill_name) \
            .maybe_single() \
            .execute()
        if response is not None and response.data is not None:
            return response.data.get("is_enabled", False)
        return True # Por defecto activo si no se ha configurado aún
    except Exception as e:
        print(f"Error al verificar is_skill_enabled: {e}")
        return True

def set_skill_status(user_id: str, skill_name: str, is_enabled: bool) -> bool:
    """Habilita o deshabilita un skill para el usuario."""
    if not supabase:
        return False
    try:
        supabase.table("agent_skills").upsert({
            "user_id": user_id,
            "skill_name": skill_name,
            "is_enabled": is_enabled
        }).execute()
        return True
    except Exception as e:
        print(f"Error al setear skill status: {e}")
        return False

# ==========================================
# Helpers de Sesiones Conversacionales (Corto Plazo)
# ==========================================

def get_or_create_session(session_id: str, user_id: str, channel: str = "web") -> Dict[str, Any]:
    """Recupera la sesión de conversación reciente o crea una nueva."""
    if not supabase:
        return {"messages": [], "context": {}}
    try:
        response = supabase.table("short_term_sessions").select("*").eq("id", session_id).maybe_single().execute()
        if response is not None and response.data is not None:
            return response.data
        
        # Crear nueva sesión si no existe
        new_session = {
            "id": session_id,
            "user_id": user_id,
            "channel": channel,
            "context": {},
            "messages": []
        }
        insert_response = supabase.table("short_term_sessions").insert(new_session).execute()
        return insert_response.data[0] if (insert_response is not None and insert_response.data) else new_session
    except Exception as e:
        print(f"Error en get_or_create_session: {e}")
        return {"messages": [], "context": {}}

def append_chat_message(session_id: str, role: str, content: str) -> bool:
    """Agrega un mensaje al historial de la sesión activa."""
    if not supabase:
        return False
    try:
        session = supabase.table("short_term_sessions").select("messages").eq("id", session_id).maybe_single().execute()
        if session is None or session.data is None:
            return False
        
        current_messages = session.data.get("messages") or []
        import datetime
        new_message = {
            "role": role,
            "content": content,
            "timestamp": datetime.datetime.now().isoformat()
        }
        current_messages.append(new_message)

        supabase.table("short_term_sessions").update({
            "messages": current_messages
        }).eq("id", session_id).execute()
        return True
    except Exception as e:
        print(f"Error en append_chat_message: {e}")
        return False

# ==========================================
# Helpers de Memoria de Largo Plazo (Vectorial)
# ==========================================

def add_long_term_memory(
    user_id: str,
    summary: str,
    embedding: List[float],
    source_type: str = "conversation",
    source_reference: Optional[str] = None,
    session_id: Optional[str] = None,
    metadata: Dict[str, Any] = None
) -> bool:
    """Inserta una memoria semántica (conversacional o archivo RAG) con su embedding."""
    if not supabase:
        return False
    try:
        payload = {
            "user_id": user_id,
            "summary": summary,
            "embedding": embedding,
            "source_type": source_type,
            "source_reference": source_reference,
            "session_id": session_id,
            "metadata": metadata or {}
        }
        supabase.table("long_term_memories").insert(payload).execute()
        return True
    except Exception as e:
        print(f"Error al guardar memoria vectorial: {e}")
        return False

def search_semantic_memories(
    user_id: str,
    query_embedding: List[float],
    match_threshold: float = 0.7,
    match_count: int = 3
) -> List[Dict[str, Any]]:
    """
    Realiza una búsqueda semántica de largo plazo usando pgvector.
    Llama a la función almacenada 'match_memories' en Supabase.
    """
    if not supabase:
        return []
    try:
        response = supabase.rpc("match_memories", {
            "query_embedding": query_embedding,
            "match_threshold": match_threshold,
            "match_count": match_count,
            "filter_user_id": user_id
        }).execute()
        return response.data if (response is not None and response.data is not None) else []
    except Exception as e:
        print(f"Error al buscar memorias semánticas (RPC match_memories): {e}")
        # Fallback simple en caso de que no exista la función RPC aún (búsqueda no vectorial filtrada)
        try:
            print("Ejecutando fallback de búsqueda no vectorial...")
            fallback = supabase.table("long_term_memories") \
                .select("id, summary, source_type, source_reference, metadata") \
                .eq("user_id", user_id) \
                .limit(match_count) \
                .execute()
            return fallback.data if (fallback is not None and fallback.data is not None) else []
        except Exception as fe:
            print(f"Error en fallback de búsqueda semántica: {fe}")
            return []

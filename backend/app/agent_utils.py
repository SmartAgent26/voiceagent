import os
from typing import Dict, Any, List, Optional
from app.database import get_agent_profile, search_semantic_memories

PROMPTS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "prompts")

def get_default_profile(user_id: str) -> Dict[str, Any]:
    """Retorna un perfil predeterminado para el agente."""
    return {
        "user_id": user_id,
        "name": "Jarvis",
        "avatar_url": "",
        "voice_id": "es-ES-Polyglot-1",
        "personality": "profesional, servicial y altamente eficiente",
        "gender": "neutro",
        "age": 30,
        "location": "Buenos Aires, Argentina"
    }

def compile_system_prompt(user_id: str, template_filename: str = "voice_agent_system.md") -> str:
    """
    Lee una plantilla .md de prompt e interpola de forma dinámica 
    los atributos de identidad del perfil del agente guardado en Supabase.
    Aplica directrices de eficiencia de tokens acotando las variables.
    """
    # 1. Recuperar el perfil del agente
    profile = get_agent_profile(user_id)
    if not profile:
        profile = get_default_profile(user_id)

    # 2. Cargar la plantilla del prompt .md
    template_path = os.path.join(PROMPTS_DIR, template_filename)
    if not os.path.exists(template_path):
        # Fallback local simple si no encuentra el archivo .md
        return f"Eres {profile['name']}, un asistente virtual con personalidad: {profile['personality']}."

    with open(template_path, 'r', encoding='utf-8') as f:
        template_content = f.read()

    # 3. Formatear dinámicamente con valores seguros
    # Interpolamos los campos de agent_profile en la plantilla del prompt
    compiled_prompt = template_content.format(
        agent_name=profile.get("name", "Jarvis"),
        agent_age=profile.get("age", 30),
        agent_gender=profile.get("gender", "neutro"),
        agent_location=profile.get("location", "Buenos Aires, Argentina"),
        agent_avatar_url=profile.get("avatar_url", ""),
        agent_personality=profile.get("personality", "profesional, servicial y altamente eficiente"),
        user_preferences="{user_preferences}", # Se mantiene el marcador para la inyección de la memoria en runtime
        semantic_context="{semantic_context}"   # Se mantiene el marcador para la inyección de la memoria en runtime
    )
    
    return compiled_prompt

def prune_chat_history(messages: List[Dict[str, Any]], max_messages: int = 3) -> List[Dict[str, Any]]:
    """
    Aplica la Directriz de Eficiencia de Tokens podando dinámicamente el historial.
    Mantiene únicamente los últimos 'max_messages' completos para evitar inyectar
    exceso de tokens en la consulta conversacional.
    """
    if len(messages) <= max_messages:
        return messages
    
    # Tomamos solo los últimos max_messages
    pruned = messages[-max_messages:]
    return pruned

def build_runtime_prompt(system_prompt_template: str, preferences: str, semantic_memories: List[Dict[str, Any]]) -> str:
    """
    Inyecta en runtime los resúmenes y memorias vectoriales en la plantilla compilada del prompt.
    Optimiza tokens acotando el contexto inyectado.
    """
    # Formatear el contexto semántico de RAG de forma muy compacta (max 3 chunks acotados)
    memories_text = ""
    if semantic_memories:
        memories_text = "\n".join([
            f"- [{mem.get('source_type', 'memoria')} / {mem.get('source_reference', 'conversación')}]: {mem.get('summary', '')}"
            for mem in semantic_memories[:3] # Límite estricto de 3 fragmentos
        ])
    else:
        memories_text = "No hay contexto histórico previo relevante para esta frase."

    # Inyectar variables de runtime
    runtime_prompt = system_prompt_template.replace("{user_preferences}", preferences or "Sin preferencias registradas aún.")
    runtime_prompt = runtime_prompt.replace("{semantic_context}", memories_text)

    return runtime_prompt

import os
import json
import datetime
from typing import Dict, Any, List, Optional
from app.config import settings
from app.database import supabase
from app.agent_utils import PROMPTS_DIR

# Ruta del prompt del orquestador principal
ORCHESTRATOR_PROMPT_PATH = os.path.join(PROMPTS_DIR, "voice_agent_system.md")

def analyze_and_log_session_performance(session_id: str, user_id: str) -> Dict[str, Any]:
    """
    Analiza la sesión al cerrarse (o periódicamente):
    1. Calcula el Sentiment Score de los mensajes del usuario.
    2. Determina el Performance Index (0 a 100%).
    3. Registra el log en la tabla 'performance_logs'.
    4. Si el performance es < 90%, gatilla la optimización automática del prompt.
    """
    if not supabase:
        return {"status": "error", "message": "Supabase no conectado."}

    try:
        # 1. Recuperar la sesión y sus mensajes
        response = supabase.table("short_term_sessions").select("messages").eq("id", session_id).maybe_single().execute()
        if not response or not response.data:
            return {"status": "error", "message": "No se encontraron mensajes para la sesión."}

        messages = response.data.get("messages") or []
        if not messages:
            return {"status": "success", "message": "Sesión sin mensajes. No requiere análisis."}

        # 2. Análisis de Sentimiento y Detección de Fricciones
        sentiment_score, issues_detected = _evaluate_sentiment_and_issues(messages)
        
        # Calcular el índice de performance global (0 a 100%)
        # Inicia en 100% y resta 15% por cada issue detectado, limitado a min 0.
        perf_index = max(0.0, 100.0 - (len(issues_detected) * 15.0))
        
        # Si el usuario dio retroalimentación explícita al final (ej: "5 estrellas"), alinear
        user_rating = _extract_user_explicit_rating(messages)
        if user_rating:
            # Ponderación híbrida: 60% performance detectado, 40% feedback del usuario
            perf_index = (perf_index * 0.6) + ((user_rating * 20.0) * 0.4)

        # 3. Loguear en performance_logs
        log_payload = {
            "user_id": user_id,
            "session_id": session_id,
            "sentiment_score": sentiment_score,
            "user_rating": user_rating,
            "performance_index": perf_index,
            "issues_detected": issues_detected
        }
        supabase.table("performance_logs").insert(log_payload).execute()

        # 4. Gatillar auto-optimización si el rendimiento es subóptimo (< 90%)
        prompt_updated = False
        new_version = None
        if perf_index < 90.0:
            print(f"Alerta: Rendimiento subóptimo ({perf_index}%). Gatillando Prompt Optimizer...")
            optimization_result = optimize_agent_prompt(user_id, session_id, messages, issues_detected)
            if optimization_result.get("status") == "success":
                prompt_updated = True
                new_version = optimization_result.get("version")

        return {
            "status": "success",
            "sentiment_score": sentiment_score,
            "performance_index": perf_index,
            "issues_detected": issues_detected,
            "prompt_auto_optimized": prompt_updated,
            "new_prompt_version": new_version
        }

    except Exception as e:
        print(f"Error al analizar performance de sesión: {e}")
        return {"status": "error", "message": str(e)}

def optimize_agent_prompt(
    user_id: str,
    session_id: str,
    messages: List[Dict[str, Any]],
    issues: List[str]
) -> Dict[str, Any]:
    """
    Subagente Prompt Optimizer:
    1. Lee el prompt activo.
    2. Compara el comportamiento fallido e identifica correcciones.
    3. Reescribe el archivo 'voice_agent_system.md' agregando directrices específicas.
    4. Registra la nueva versión en 'prompts_registry' en Supabase.
    """
    try:
        # a. Leer prompt actual
        current_prompt = ""
        if os.path.exists(ORCHESTRATOR_PROMPT_PATH):
            with open(ORCHESTRATOR_PROMPT_PATH, 'r', encoding='utf-8') as f:
                current_prompt = f.read()
        else:
            return {"status": "error", "message": "No se encontró el prompt base del orquestador."}

        # b. Generar versión corregida (Llamada al LLM o Fallback inteligente acotado)
        optimized_content = _call_optimizer_llm(current_prompt, messages, issues)
        
        # c. Obtener versión actual incrementada
        new_version = 1
        if supabase:
            last_version_res = supabase.table("prompts_registry") \
                .select("version") \
                .eq("user_id", user_id) \
                .order("version", desc=True) \
                .limit(1) \
                .execute()
            if last_version_res and last_version_res.data:
                new_version = last_version_res.data[0].get("version", 0) + 1

        # d. Sobrescribir archivo local .md de forma inmediata
        with open(ORCHESTRATOR_PROMPT_PATH, 'w', encoding='utf-8') as f:
            f.write(optimized_content)

        # e. Registrar en Supabase prompts_registry
        if supabase:
            # Desactivar versiones previas
            supabase.table("prompts_registry").update({"is_active": False}).eq("user_id", user_id).execute()
            
            # Insertar nueva versión activa
            supabase.table("prompts_registry").insert({
                "user_id": user_id,
                "version": new_version,
                "prompt_content": optimized_content,
                "optimizations_made": f"Corrección auto-generada para resolver fricciones: {', '.join(issues)}",
                "is_active": True
            }).execute()

        print(f"Prompt auto-optimizado con éxito a la versión {new_version}.")
        return {"status": "success", "version": new_version}

    except Exception as e:
        print(f"Error en Subagente Prompt Optimizer: {e}")
        return {"status": "error", "message": str(e)}

# ==========================================
# Funciones Analíticas Auxiliares Privadas
# ==========================================

def _evaluate_sentiment_and_issues(messages: List[Dict[str, Any]]) -> tuple[float, List[str]]:
    """Calcula sentimientos de frases e identifica fricciones de diálogo."""
    sentiment_sum = 0.0
    user_msg_count = 0
    issues = []
    
    # Palabras clave de queja o descontento
    frustration_keywords = ["mal", "no funciona", "error", "falla", "lento", "peor", "equivocado", "no agendó", "no subió", "repite"]
    satisfaction_keywords = ["gracias", "perfecto", "buenísimo", "excelente", "genial", "listo", "bien", "ok", "copado"]

    for msg in messages:
        if msg.get("role") == "user":
            user_msg_count += 1
            content = msg.get("content", "").lower()
            
            # Evaluación heurística simple para desarrollo base
            msg_sentiment = 0.0
            for fw in frustration_keywords:
                if fw in content:
                    msg_sentiment -= 0.4
                    issues.append(f"Fricción detectada sobre: '{fw}'")
            for sw in satisfaction_keywords:
                if sw in content:
                    msg_sentiment += 0.3
            
            sentiment_sum += max(-1.0, min(1.0, msg_sentiment))

    avg_sentiment = (sentiment_sum / user_msg_count) if user_msg_count > 0 else 0.0
    # Limpiar duplicados de issues
    unique_issues = list(set(issues))
    
    return avg_sentiment, unique_issues

def _extract_user_explicit_rating(messages: List[Dict[str, Any]]) -> Optional[int]:
    """Busca calificaciones explícitas numéricas del usuario (ej: 1 a 5 estrellas)."""
    import re
    for msg in messages:
        if msg.get("role") == "user":
            content = msg.get("content", "")
            # Buscar patrones como "califico con 5", "te doy un 4", "rating 5", "estrellas 5"
            match = re.search(r"\b(califico con|te doy un|rating|estrellas|nota)\b\s*([1-5])", content.lower())
            if match:
                return int(match.group(2))
    return None

def _call_optimizer_llm(current_prompt: str, messages: List[Dict[str, Any]], issues: List[str]) -> str:
    """Llama al LLM para reescribir y optimizar dinámicamente el prompt, o genera un fallback inteligente."""
    
    # 1. Intentar con Gemini
    if settings.GEMINI_API_KEY:
        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.GEMINI_API_KEY)
            
            optimizer_instruction = (
                "Eres un Experto en Meta-Prompting y Prompt Engineering.\n"
                "Tu objetivo es leer un prompt de sistema para un Voice Agent, "
                "identificar qué regla o pauta falló en base a la transcripción de fallos provista, "
                "y reescribir el prompt de sistema agregando directrices específicas, compactas y directas "
                "para solucionar esa fricción para siempre.\n"
                "Mantén la estructura del prompt original, optimiza el consumo de tokens y sé muy conciso."
            )
            
            model = genai.GenerativeModel(
                model_name="gemini-1.5-flash",
                system_instruction=optimizer_instruction
            )
            
            # Estructurar la entrada
            prompt_input = (
                f"### PROMPT ACTUAL:\n{current_prompt}\n\n"
                f"### ERRORES DETECTADOS EN LA SESIÓN:\n{json.dumps(issues)}\n\n"
                f"### FRASES DE LA CONVERSACIÓN:\n{json.dumps(messages)}\n\n"
                f"Por favor, reescribe el prompt de sistema completo optimizado. Retorna únicamente el prompt en Markdown plano."
            )
            
            response = model.generate_content(prompt_input)
            return response.text.strip()
        except Exception as e:
            print(f"Error en Gemini Optimizer LLM: {e}")

    # 2. Fallback de Optimización en Caliente
    # Agrega una regla correctiva estructurada al prompt actual de manera programática
    print("Advertencia: Ejecutando Prompt Optimizer programático (fallback)...")
    
    # Buscar si ya tiene sección de auto-correcciones
    corrective_section = "\n\n## AUTO-CORRECCIONES DINÁMICAS (Auto-Tuned)\n"
    rule_added = ""
    for issue in issues:
        rule_added += f"* Para resolver '{issue}': Recuerda adaptarte activamente y dar respuestas super claras y de acción inmediata.\n"
        
    if corrective_section in current_prompt:
        # Añadir al final de la sección existente
        parts = current_prompt.split(corrective_section)
        optimized = parts[0] + corrective_section + parts[1] + rule_added
    else:
        # Crear la sección al final
        optimized = current_prompt + corrective_section + rule_added
        
    return optimized

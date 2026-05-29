import os
from typing import Dict, Any, List, Optional
from app.config import settings
from app.database import append_chat_message
from app.agent_utils import (
    compile_system_prompt,
    prune_chat_history,
    build_runtime_prompt
)
from app.agents.memory import MemoryAgent
from app.agents.tools import ToolAgent

class OrchestratorAgent:
    def __init__(self, user_id: str):
        self.user_id = user_id
        
        # Inicializar los subagentes subordinados
        self.memory_agent = MemoryAgent(user_id)
        self.tool_agent = ToolAgent(user_id)
        
        # Cargar prompt de sistema compilado
        self.system_prompt_template = compile_system_prompt(user_id, "voice_agent_system.md")

    def process_input(self, session_id: str, input_text: str) -> Dict[str, Any]:
        """
        Orquesta el flujo principal conversacional:
        1. Recupera memoria de corto plazo y largo plazo (RAG híbrido).
        2. Compila el prompt de sistema dinámico y le inyecta la memoria en runtime.
        3. Poda el historial conversacional acotándolo a 3 mensajes por tokens.
        4. Invoca al LLM (Gemini/OpenAI) o corre un mock offline.
        5. Identifica y ejecuta intenciones de herramientas delegando al ToolAgent.
        6. Persiste la interacción en corto plazo y retorna la respuesta.
        """
        # 1. Obtener contexto de memoria (Submemoria 1 y 2 + historial)
        context = self.memory_agent.get_runtime_context(session_id, input_text)
        chat_history = context.get("chat_history", [])
        preferences = context.get("preferences", "")
        semantic_memories = context.get("semantic_memories", [])

        # 2. Compilar el prompt de sistema final e inyectarle la memoria
        runtime_system_prompt = build_runtime_prompt(self.system_prompt_template, preferences, semantic_memories)

        # 3. Guardar el mensaje del usuario en la base de datos de corto plazo
        append_chat_message(session_id, "user", input_text)

        # 4. Podar el historial para cumplir con las directrices de eficiencia de tokens
        pruned_history = prune_chat_history(chat_history, max_messages=3)

        # 5. Invocar al LLM
        response_text = self._call_llm(runtime_system_prompt, pruned_history, input_text)

        # 6. Identificación e Invocación de Skills / Herramientas (Simple parse por comandos en desarrollo inicial)
        # En producción, esto se realiza mediante las capacidades nativas de Function Calling del LLM
        tool_executed = None
        tool_result = None
        
        # Mock simple de detección de intenciones de herramientas
        lower_input = input_text.lower()
        if "agendar" in lower_input or "calendario" in lower_input:
            tool_executed = "calendar"
            # Extraer un título simple
            summary = "Reunión de voz"
            if "reunión" in lower_input:
                summary = "Reunión de trabajo"
            tool_result = self.tool_agent.execute_skill("calendar", {"action": "create", "summary": summary})
            response_text = f"{response_text}\n\n[Sistema]: {tool_result.get('message')}"
            
        elif "subir" in lower_input or "drive" in lower_input:
            tool_executed = "drive"
            tool_result = self.tool_agent.execute_skill("drive", {"action": "upload", "filename": "nota_voz.txt", "content": input_text})
            response_text = f"{response_text}\n\n[Sistema]: {tool_result.get('message')}"
            
        elif "ejecutar código" in lower_input or "python" in lower_input:
            tool_executed = "python"
            script = "print('Ejecución aprobada de prueba')"
            if "suma" in lower_input:
                script = "a = 5\nb = 10\nprint(f'Suma: {a+b}')"
            tool_result = self.tool_agent.execute_skill("python", {"script_code": script, "purpose": "Procesamiento de datos"})
            response_text = f"{response_text}\n\n[Sistema]: {tool_result.get('message')}"

        # 7. Persistir la respuesta del asistente en el corto plazo
        append_chat_message(session_id, "assistant", response_text)

        # 8. Analizar si la frase del usuario contenía datos sobre preferencias
        self.memory_agent.extract_and_save_preferences(input_text)

        return {
            "response_text": response_text,
            "tool_executed": tool_executed,
            "tool_result": tool_result
        }

    # ==========================================
    # Invocación del LLM (Gemini / OpenAI o Fallback)
    # ==========================================

    def _call_llm(self, system_prompt: str, chat_history: List[Dict[str, Any]], latest_input: str) -> str:
        """Llama al LLM disponible aplicando las pautas de eficiencia de tokens."""
        
        # 1. Intentar con Gemini
        if settings.GEMINI_API_KEY:
            try:
                import google.generativeai as genai
                genai.configure(api_key=settings.GEMINI_API_KEY)
                
                # Configurar el modelo
                model = genai.GenerativeModel(
                    model_name="gemini-1.5-flash", # Veloz y eficiente en costo/tokens
                    system_instruction=system_prompt
                )
                
                # Estructurar chat history en el formato de Gemini
                # (role: user/model)
                contents = []
                for msg in chat_history:
                    role = "user" if msg.get("role") == "user" else "model"
                    contents.append({"role": role, "parts": [msg.get("content", "")]})
                
                # Añadir última interacción
                contents.append({"role": "user", "parts": [latest_input]})
                
                response = model.generate_content(contents)
                return response.text.strip()
            except Exception as e:
                print(f"Error al llamar a Gemini API: {e}")

        # 2. Intentar con OpenAI
        if settings.OPENAI_API_KEY:
            try:
                from openai import OpenAI
                client = OpenAI(api_key=settings.OPENAI_API_KEY)
                
                messages = [{"role": "system", "content": system_prompt}]
                for msg in chat_history:
                    messages.append({"role": msg.get("role"), "content": msg.get("content")})
                messages.append({"role": "user", "content": latest_input})
                
                response = client.chat.completures.create(
                    model="gpt-3.5-turbo",
                    messages=messages,
                    max_tokens=150
                )
                return response.choices[0].message.content.strip()
            except Exception as e:
                print(f"Error al llamar a OpenAI API: {e}")

        # 3. Fallback de simulación Offline (Simulación de IA con Personalidad)
        print("Advertencia: Ejecutando simulación conversacional offline (sin API Keys)...")
        
        # Determinar un saludo basado en personalidad básica
        name = compile_system_prompt(self.user_id).split("Nombre:** ")[1].split("\n")[0] if "Nombre:** " in compile_system_prompt(self.user_id) else "Jarvis"
        
        lower_in = latest_input.lower()
        if "hola" in lower_in:
            return f"Hola, soy {name}. ¿En qué te puedo ayudar hoy? Recuerda que mi sistema está configurado y listo para automatizar tus tareas."
        elif "cómo estás" in lower_in:
            return f"Hola. Me encuentro en óptimas condiciones, procesando solicitudes en tu entorno local. ¿Tienes alguna tarea para mí?"
        elif "agendar" in lower_in or "calendario" in lower_in:
            return f"Excelente. Estoy procediendo a registrar el evento en tu calendario."
        elif "subir" in lower_in or "drive" in lower_in:
            return f"Entendido. He iniciado la subida de los archivos a la nube compartida."
        else:
            return f"Procesado con éxito tu comando: '{latest_input}'. Mi base de conocimientos semántica y de corto plazo se ha actualizado."

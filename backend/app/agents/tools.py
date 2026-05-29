import os
from typing import Dict, Any, List, Optional
import datetime
from app.database import (
    supabase,
    is_skill_enabled
)

class ToolAgent:
    def __init__(self, user_id: str):
        self.user_id = user_id
        
        # Cargar prompt de sistema del tool agent
        prompts_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "prompts")
        prompt_path = os.path.join(prompts_dir, "tool_agent.md")
        if os.path.exists(prompt_path):
            with open(prompt_path, 'r', encoding='utf-8') as f:
                self.system_prompt = f.read()
        else:
            self.system_prompt = "Eres un Subagente de Herramientas y Skills."

    def execute_skill(self, skill_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Punto de entrada de ejecución de skills.
        Aplica control dinámico de habilitación mediante agent_skills.
        """
        # 1. Validar si el switch de skill está activo para el usuario en Supabase
        if not is_skill_enabled(self.user_id, skill_name):
            return {
                "status": "disabled",
                "skill": skill_name,
                "message": f"El skill '{skill_name}' está desactivado. Actívalo en el panel de control de la PWA para poder usarlo."
            }

        # 2. Enrutar al ejecutor correspondiente
        try:
            if skill_name == "calendar":
                return self._run_calendar(params)
            elif skill_name == "drive":
                return self._run_drive(params)
            elif skill_name == "slack":
                return self._run_slack(params)
            elif skill_name == "telegram":
                return self._run_telegram(params)
            elif skill_name == "python":
                return self._run_python(params)
            else:
                return {
                    "status": "error",
                    "message": f"Skill '{skill_name}' no soportada o preconfigurada en el catálogo actual."
                }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Fallo al ejecutar el skill '{skill_name}': {str(e)}"
            }

    # ==========================================
    # Ejecución Interna de Skills (Mocked para Desarrollo Inicial)
    # ==========================================

    def _run_calendar(self, params: Dict[str, Any]) -> Dict[str, Any]:
        action = params.get("action", "list")
        if action == "create":
            # Guardaría el evento en Google Calendar real en Fase 4
            summary = params.get("summary", "Reunión sin título")
            start = params.get("start_time", datetime.datetime.now().isoformat())
            end = params.get("end_time", (datetime.datetime.now() + datetime.timedelta(hours=1)).isoformat())
            
            # Insertar recordatorio local en Supabase
            if supabase:
                try:
                    supabase.table("pending_tasks_reminders").insert({
                        "user_id": self.user_id,
                        "title": f"Calendario: {summary}",
                        "description": "Evento agendado automáticamente",
                        "due_date": start,
                        "status": "pending",
                        "notified_channels": ["web"]
                    }).execute()
                except Exception as ex:
                    print(f"Error al loguear recordatorio de calendario: {ex}")

            return {
                "status": "success",
                "message": f"Reunión '{summary}' agendada exitosamente para {start}.",
                "data": {"summary": summary, "start_time": start, "end_time": end}
            }
        return {"status": "success", "message": "Listado de eventos de Google Calendar obtenido.", "events": []}

    def _run_drive(self, params: Dict[str, Any]) -> Dict[str, Any]:
        action = params.get("action", "list")
        if action == "upload":
            filename = params.get("filename", "documento.txt")
            content = params.get("content", "")
            return {
                "status": "success",
                "message": f"Archivo '{filename}' subido con éxito a la carpeta compartida en la nube.",
                "file_info": {"name": filename, "size_bytes": len(content)}
            }
        return {"status": "success", "files": []}

    def _run_slack(self, params: Dict[str, Any]) -> Dict[str, Any]:
        message = params.get("message", "")
        channel = params.get("channel", "general")
        # Integración con Slack Web API en Fase 4
        return {
            "status": "success",
            "message": f"Mensaje enviado a Slack con éxito al canal #{channel}."
        }

    def _run_telegram(self, params: Dict[str, Any]) -> Dict[str, Any]:
        message = params.get("message", "")
        chat_id = params.get("chat_id", "")
        # Integración con Telegram Bot API en Fase 4
        return {
            "status": "success",
            "message": "Mensaje proactivo enviado a Telegram exitosamente."
        }

    def _run_python(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Gatilla el sandbox de Python registrando el script en la cola de aprobación."""
        script_code = params.get("script_code", "")
        purpose = params.get("purpose", "Procesamiento de datos personalizado")
        
        if not script_code:
            return {"status": "error", "message": "Falta el código de script de Python."}
            
        if not supabase:
            return {"status": "error", "message": "Supabase no conectado. Imposible crear solicitud de aprobación."}
            
        try:
            # Registrar ejecución en estado 'pending_approval'
            response = supabase.table("python_executions").insert({
                "user_id": self.user_id,
                "script_code": script_code,
                "purpose": purpose,
                "status": "pending_approval"
            }).execute()
            
            exec_id = response.data[0].get("id") if response.data else "uuid-mock"
            
            # En producción, aquí se dispara una alerta de Slack/Telegram proactiva
            return {
                "status": "pending_approval",
                "execution_id": exec_id,
                "purpose": purpose,
                "message": f"Se ha generado un script Python para {purpose}. Por razones de seguridad, debes autorizar su ejecución desde tu panel de control de la PWA, Telegram o Slack."
            }
        except Exception as e:
            return {"status": "error", "message": f"Error al encolar script de Python: {str(e)}"}

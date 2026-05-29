import sys
import os
import uuid

# Añadir ruta del backend al path de python
sys.path.append(os.path.dirname(__file__))

from app.agents.orchestrator import OrchestratorAgent
from app.database import supabase, get_agent_profile, save_agent_profile

def test_pipeline():
    print("--- INICIANDO TEST DEL ECOVISTEMA DE AGENTES ---")
    
    # 1. Crear un ID de usuario de prueba válido (UUID)
    test_user_id = str(uuid.UUID("00000000-0000-0000-0000-000000000000"))
    test_session_id = str(uuid.uuid4())
    
    # 2. Configurar o crear un perfil de agente para este usuario en Supabase
    print("\n1. Configurando perfil del agente de prueba en Supabase...")
    agent_data = {
        "user_id": test_user_id,
        "name": "Jarvis-Test",
        "personality": "irónico, ingenioso y extremadamente eficiente",
        "location": "Madrid, España",
        "gender": "masculino",
        "age": 28
    }
    success = save_agent_profile(test_user_id, agent_data)
    if success:
        print("Perfil de agente guardado exitosamente en la base de datos.")
    else:
        print("No se pudo guardar el perfil del agente en Supabase (offline/error).")

    # 3. Inicializar el Orquestador
    print("\n2. Inicializando OrchestratorAgent...")
    orchestrator = OrchestratorAgent(test_user_id)
    print("Orquestador inicializado con éxito.")

    # 4. Procesar una interacción con intención de herramienta y extracción de datos
    print("\n3. Enviando frase de prueba 1 (Extracción de preferencias y saludo)...")
    phrase_1 = "Hola Jarvis, mi hermano se llama Carlos y soy de comer pasta los domingos."
    result_1 = orchestrator.process_input(test_session_id, phrase_1)
    
    print("\nRespuesta del Agente:")
    print(">", result_1.get("response_text"))

    # 5. Procesar una interacción con intención de herramienta de calendario
    print("\n4. Enviando frase de prueba 2 (Intención de herramienta de Calendario)...")
    phrase_2 = "Agendar una reunión sobre el proyecto VAGENT mañana a las 10 am."
    result_2 = orchestrator.process_input(test_session_id, phrase_2)
    
    print("\nRespuesta del Agente:")
    print(">", result_2.get("response_text"))
    print("Herramienta Ejecutada:", result_2.get("tool_executed"))
    print("Resultado de Herramienta:", result_2.get("tool_result"))

    # 6. Procesar una interacción con intención de sandbox de Python
    print("\n5. Enviando frase de prueba 3 (Intención de código Python)...")
    phrase_3 = "Quiero ejecutar código python para hacer una suma de variables."
    result_3 = orchestrator.process_input(test_session_id, phrase_3)
    
    print("\nRespuesta del Agente:")
    print(">", result_3.get("response_text"))
    print("Herramienta Ejecutada:", result_3.get("tool_executed"))
    print("Resultado de Herramienta:", result_3.get("tool_result"))

    print("\n--- TEST FINALIZADO CON ÉXITO ---")

if __name__ == "__main__":
    test_pipeline()

import os
import subprocess
import tempfile
import time
import datetime
from typing import Dict, Any, Optional
from app.config import settings
from app.database import supabase

# Directorio temporal de ejecución en el workspace
SANDBOX_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "sandbox_temp")
os.makedirs(SANDBOX_DIR, exist_ok=True)

def run_sandboxed_python(script_code: str, timeout_seconds: int = 10) -> Dict[str, Any]:
    """
    Ejecuta un script de Python de forma aislada y segura usando un subprocess.
    Aplica limites de tiempo (timeout) y ejecuta en modo aislado (-I) para mitigar riesgos.
    """
    # 1. Crear archivo temporal de forma segura en la carpeta sandbox_temp
    fd, temp_file_path = tempfile.mkstemp(suffix=".py", dir=SANDBOX_DIR)
    
    start_time = time.time()
    try:
        # Escribir código en el archivo temporal
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            f.write(script_code)

        # 2. Configurar el comando del subprocess
        # Python -I ejecuta en Modo Aislado: ignora variables de entorno del sistema (PYTHONPATH, etc.)
        # y previene la inyección de módulos locales no deseados.
        python_exe = os.getenv("PYTHON_EXE", "python")
        
        # Intentar usar el python del entorno virtual actual si está disponible
        venv_python = os.path.join(os.path.dirname(__file__), "..", "..", "..", ".venv", "Scripts", "python.exe")
        if os.path.exists(venv_python):
            python_exe = venv_python

        cmd = [python_exe, "-I", temp_file_path]

        # 3. Lanzar la ejecución
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        try:
            # Esperar a que termine con un límite estricto de tiempo
            stdout, stderr = process.communicate(timeout=timeout_seconds)
            execution_time_ms = int((time.time() - start_time) * 1000)
            
            if process.returncode == 0:
                return {
                    "status": "executed",
                    "stdout": stdout,
                    "stderr": stderr,
                    "execution_time_ms": execution_time_ms
                }
            else:
                return {
                    "status": "failed",
                    "stdout": stdout,
                    "stderr": stderr,
                    "execution_time_ms": execution_time_ms
                }
                
        except subprocess.TimeoutExpired:
            # Matar el proceso si excede el tiempo límite (evita loops infinitos)
            process.kill()
            stdout, stderr = process.communicate()
            execution_time_ms = int((time.time() - start_time) * 1000)
            return {
                "status": "timeout",
                "stdout": stdout,
                "stderr": f"{stderr}\n[Sandbox Error]: Tiempo límite de ejecución de {timeout_seconds}s excedido.",
                "execution_time_ms": execution_time_ms
            }

    except Exception as e:
        execution_time_ms = int((time.time() - start_time) * 1000)
        return {
            "status": "failed",
            "stdout": "",
            "stderr": f"[Sandbox Panic]: Error al inicializar el proceso: {str(e)}",
            "execution_time_ms": execution_time_ms
        }
        
    finally:
        # 4. Asegurar la eliminación del archivo de script temporal
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception as ex:
                print(f"Error al limpiar archivo temporal del sandbox: {ex}")

# ==========================================
# Integración con Supabase Aprobación Queue
# ==========================================

def execute_approved_script(execution_id: str) -> Dict[str, Any]:
    """
    Recupera un script de la tabla 'python_executions' de Supabase,
    verifica que esté en estado 'approved', lo ejecuta en el Sandbox
    y actualiza la base de datos con los resultados consolidados.
    """
    if not supabase:
        return {"status": "error", "message": "Supabase no conectado de forma administrativa."}

    try:
        # 1. Recuperar el registro de ejecución
        response = supabase.table("python_executions").select("*").eq("id", execution_id).maybe_single().execute()
        if not response or not response.data:
            return {"status": "error", "message": f"No se encontró el registro de ejecución con ID: {execution_id}"}
            
        execution = response.data
        current_status = execution.get("status")
        script_code = execution.get("script_code")
        
        # 2. Validar que la aprobación manual esté concedida
        if current_status != "approved":
            return {
                "status": "error",
                "message": f"Ejecución denegada. El script se encuentra en estado '{current_status}' y requiere aprobación ('approved')."
            }

        # 3. Actualizar estado a 'running' para prevenir ejecuciones concurrentes
        supabase.table("python_executions").update({
            "status": "running"
        }).eq("id", execution_id).execute()

        # 4. Ejecutar el script en el sandbox aislado
        print(f"Ejecutando script de Python {execution_id} de forma segura en el Sandbox...")
        result = run_sandboxed_python(script_code, timeout_seconds=10)

        # 5. Guardar los resultados en Supabase
        status_update = "executed" if result["status"] == "executed" else "failed"
        output_data = f"STDOUT:\n{result['stdout']}\n\nSTDERR:\n{result['stderr']}\n\nTiempo de ejecución: {result['execution_time_ms']}ms"

        supabase.table("python_executions").update({
            "status": status_update,
            "result_output": output_data,
            "approved_at": datetime.datetime.now().isoformat()
        }).eq("id", execution_id).execute()

        return {
            "status": status_update,
            "stdout": result["stdout"],
            "stderr": result["stderr"],
            "execution_time_ms": result["execution_time_ms"]
        }

    except Exception as e:
        # Fallback de error
        try:
            supabase.table("python_executions").update({
                "status": "failed",
                "result_output": f"[Error del Servidor]: Fallo crítico en el flujo de ejecución: {str(e)}"
            }).eq("id", execution_id).execute()
        except:
            pass
        return {"status": "error", "message": f"Fallo al ejecutar script encolado: {str(e)}"}

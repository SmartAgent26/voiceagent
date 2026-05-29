import sys
import os

# Añadir ruta del backend
sys.path.append(os.path.dirname(__file__))

from app.services.sandbox import run_sandboxed_python

def test_sandbox():
    print("--- INICIANDO TEST DEL PYTHON SANDBOX SEGURO ---")
    
    # 1. Test 1: Ejecución Exitosa Simple
    print("\n1. Test 1: Ejecución exitosa básica...")
    code_1 = 'a = 10\nb = 20\nprint(f"Resultado de la suma: {a+b}")'
    res_1 = run_sandboxed_python(code_1)
    print("Resultado:", res_1)
    assert res_1["status"] == "executed"
    assert "30" in res_1["stdout"]

    # 2. Test 2: Control de Errores (Script con Fallo)
    print("\n2. Test 2: Captura de errores (division por cero)...")
    code_2 = 'x = 10 / 0'
    res_2 = run_sandboxed_python(code_2)
    print("Resultado:", res_2)
    assert res_2["status"] == "failed"
    assert "ZeroDivisionError" in res_2["stderr"]

    # 3. Test 3: Control de Tiempos Límite (Timeout para evitar Loops Infinitos)
    print("\n3. Test 3: Prevención de loops infinitos (Timeout acotado a 3s)...")
    code_3 = 'import time\nprint("Entrando en loop infinito...")\nwhile True:\n    time.sleep(0.1)'
    res_3 = run_sandboxed_python(code_3, timeout_seconds=3)
    print("Resultado:", res_3)
    assert res_3["status"] == "timeout"
    assert "excedido" in res_3["stderr"]

    print("\n--- ¡PYTHON SANDBOX VERIFICADO CON ÉXITO! ---")

if __name__ == "__main__":
    test_sandbox()

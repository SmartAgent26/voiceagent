import uvicorn
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app.config import settings
from app.database import supabase
from app.agents.orchestrator import OrchestratorAgent
from app.agents.memory import MemoryAgent
from app.services.sandbox import execute_approved_script

app = FastAPI(
    title="AI Voice Agent Backend",
    description="Servidor API de alto rendimiento para el Voice Agent con arquitectura multiagente.",
    version="1.0.0"
)

# Configurar CORS para permitir comunicación fluida con la PWA
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Modificar en producción
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# Esquemas Pydantic
# ==========================================

class ChatRequest(BaseModel):
    user_id: str
    session_id: str
    text: str

# ==========================================
# Endpoints de Operación
# ==========================================

@app.post("/chat", tags=["Conversación"])
async def chat_endpoint(request: ChatRequest):
    """
    Recibe la frase del usuario, recopila contexto semántico,
    orquesta subagentes y retorna la respuesta procesada.
    """
    try:
        orchestrator = OrchestratorAgent(request.user_id)
        result = orchestrator.process_input(request.session_id, request.text)
        return result
    except Exception as e:
        print(f"Error en chat_endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Fallo interno en orquestación del chat: {str(e)}")

@app.post("/ingest", tags=["Memoria RAG"])
async def ingest_endpoint(
    user_id: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Monitorea y recibe archivos del usuario, realiza chunking semántico
    de 256 tokens y genera metadatos indexándolos en Supabase pgvector.
    """
    try:
        # 1. Leer el contenido del archivo
        content_bytes = await file.read()
        try:
            content_text = content_bytes.decode("utf-8")
        except UnicodeDecodeError:
            # Fallback simple para decodificar codificaciones latinas
            content_text = content_bytes.decode("latin-1")
            
        # 2. Inicializar el subagente de memoria
        memory_agent = MemoryAgent(user_id)
        
        # 3. Procesar ingesta en la base vectorial pgvector
        file_extension = file.filename.split(".")[-1] if "." in file.filename else "txt"
        chunks_count = memory_agent.ingest_document(
            filename=file.filename,
            content=content_text,
            file_type=file_extension
        )
        
        return {
            "status": "success",
            "filename": file.filename,
            "chunks": chunks_count,
            "message": f"Archivo '{file.filename}' fragmentado e indexado vectorialmente en {chunks_count} bloques."
        }
    except Exception as e:
        print(f"Error en ingest_endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Fallo al procesar e ingestar archivo: {str(e)}")

@app.post("/sandbox/execute/{execution_id}", tags=["Sandbox Python"])
async def execute_sandbox_endpoint(execution_id: str):
    """
    Ejecuta un script de Python registrado en la cola de aprobación,
    únicamente si ha sido autorizado ('approved') por el usuario.
    """
    try:
        result = execute_approved_script(execution_id)
        return result
    except Exception as e:
        print(f"Error en execute_sandbox_endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Error al procesar la ejecución del script en sandbox: {str(e)}")

@app.get("/health", tags=["Salud"])
async def health_check():
    """Verifica el estado del servidor y su conectividad básica con Supabase."""
    supabase_status = "ok" if supabase is not None else "disconnected"
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "supabase_connection": supabase_status
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)

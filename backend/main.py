import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings
from supabase import create_client, Client
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"
        extra = "ignore"

try:
    settings = Settings()
except Exception as e:
    print(f"Error al validar configuraciones de entorno: {e}")
    # Fallback si no están seteadas para evitar crasheo directo en la carga inicial
    class DummySettings:
        SUPABASE_URL = os.getenv("SUPABASE_URL", "")
        SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        PORT = 8000
        HOST = "0.0.0.0"
        ENVIRONMENT = "development"
    settings = DummySettings()

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

# Inicializar cliente Supabase administrativo
supabase: Client = None
if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
    try:
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
        print("Cliente de Supabase inicializado con éxito.")
    except Exception as e:
        print(f"Error al inicializar cliente de Supabase: {e}")

@app.get("/health", tags=["Salud"])
async def health_check():
    """Verifica el estado del servidor y su conectividad básica."""
    supabase_status = "ok" if supabase else "disconnected"
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "supabase_connection": supabase_status
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)

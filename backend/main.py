import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import supabase

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

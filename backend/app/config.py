import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Cargar .env si existe en la raíz del backend
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

class Settings(BaseSettings):
    # Supabase Settings
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str

    # Google Client Settings
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/google/callback"

    # AI API Keys
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    ELEVENLABS_API_KEY: str = ""

    # Integrations Settings
    TELEGRAM_BOT_TOKEN: str = ""
    SLACK_BOT_TOKEN: str = ""
    SLACK_SIGNING_SECRET: str = ""

    # Server Settings
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    ENVIRONMENT: str = "development"

    class Config:
        env_file = os.path.join(os.path.dirname(__file__), "..", ".env")
        extra = "ignore"

try:
    settings = Settings()
except Exception as e:
    print(f"Advertencia: Error al cargar configuraciones usando Settings Pydantic: {e}")
    # Fallback básico
    class SettingsFallback:
        SUPABASE_URL = os.getenv("SUPABASE_URL", "")
        SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
        SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
        GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
        GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/google/callback")
        GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
        OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
        ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
        TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
        SLACK_BOT_TOKEN = os.getenv("SLACK_BOT_TOKEN", "")
        SLACK_SIGNING_SECRET = os.getenv("SLACK_SIGNING_SECRET", "")
        PORT = int(os.getenv("PORT", "8000"))
        HOST = os.getenv("HOST", "0.0.0.0")
        ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
    settings = SettingsFallback()

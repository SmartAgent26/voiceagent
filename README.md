# AI Voice Agent Ecosystem

Este repositorio contiene el código fuente para el **AI Voice Agent Ecosystem**, un asistente virtual de voz premium con capacidades avanzadas de memoria, ejecución de código en sandbox y auto-optimización continua.

## 🚀 Arquitectura
El sistema se compone de:
* **Frontend (PWA):** Una interfaz web premium construida en React + Vite + Tailwind/CSS con modo oscuro y visualizador de voz reactivo.
* **Backend:** Un servidor de alto rendimiento FastAPI (Python) que orquesta los subagentes.
* **Database & Vector Store:** Supabase (PostgreSQL + pgvector) para memoria de corto/largo plazo e ingesta de documentos.
* **Canales:** Integración fluida con Telegram Bot y Slack App.

## 📁 Estructura del Proyecto
* `/backend` - Servidor FastAPI, lógica de agentes y herramientas.
* `/frontend` - Aplicación web PWA.
* `/prompts` - Archivos `.md` de prompts de sistema de los agentes (optimizados dinámicamente).
* `/skills` - Archivos `.md` de catálogo de skills del Tool Agent.

---
Desarrollado en colaboración con **Antigravity (Google DeepMind)**.

-- ==========================================
-- AI Voice Agent Database Schema (Supabase)
-- ==========================================

-- Habilitar extensión vectorial para la memoria semántica de largo plazo
create extension if not exists vector;

-- Función auxiliar para actualizar automáticamente el campo updated_at
create or replace function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 1. Perfil del Agente (Identidad y Personalización del Voice Agent)
create table if not exists public.agent_profile (
  user_id uuid references auth.users on delete cascade not null primary key,
  name varchar(255) not null default 'Jarvis',
  avatar_url text,
  voice_id varchar(100) not null default 'es-ES-Polyglot-1', -- Voz Google TTS / Gemini por defecto
  personality text not null default 'profesional, servicial y altamente eficiente',
  gender varchar(50) default 'neutro',
  age integer default 30,
  location varchar(255) default 'Buenos Aires, Argentina',
  extra_attributes jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone default now()
);

-- Habilitar RLS en agent_profile
alter table public.agent_profile enable row level security;

create policy "Los usuarios pueden ver su propio perfil de agente"
  on public.agent_profile for select
  using (auth.uid() = user_id);

create policy "Los usuarios pueden actualizar su propio perfil de agente"
  on public.agent_profile for update
  using (auth.uid() = user_id);

create policy "Los usuarios pueden insertar su propio perfil de agente"
  on public.agent_profile for insert
  with check (auth.uid() = user_id);

create trigger trigger_agent_profile_updated_at
  before update on public.agent_profile
  for each row execute procedure handle_updated_at();


-- 2. Habilitación de Skills (Interruptores de automatización del agente)
create table if not exists public.agent_skills (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  skill_name varchar(100) not null,
  is_enabled boolean not null default true,
  updated_at timestamp with time zone default now(),
  unique (user_id, skill_name)
);

-- Habilitar RLS en agent_skills
alter table public.agent_skills enable row level security;

create policy "Los usuarios pueden ver sus propios switches de skills"
  on public.agent_skills for select
  using (auth.uid() = user_id);

create policy "Los usuarios pueden modificar sus switches de skills"
  on public.agent_skills for all
  using (auth.uid() = user_id);

create trigger trigger_agent_skills_updated_at
  before update on public.agent_skills
  for each row execute procedure handle_updated_at();


-- 3. Preferencias del Usuario (Submemoria 1 de largo plazo: gustos, familia, etc.)
create table if not exists public.user_preferences (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  category varchar(100) not null default 'general', -- 'family', 'food', 'schedule', 'general'
  key varchar(255) not null,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone default now(),
  unique (user_id, category, key)
);

-- Habilitar RLS en user_preferences
alter table public.user_preferences enable row level security;

create policy "Los usuarios pueden gestionar sus preferencias"
  on public.user_preferences for all
  using (auth.uid() = user_id);

create trigger trigger_user_preferences_updated_at
  before update on public.user_preferences
  for each row execute procedure handle_updated_at();


-- 4. Memoria de Largo Plazo Vectorial (Submemoria 2: Charlas e Ingesta de archivos)
create table if not exists public.long_term_memories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  session_id uuid, -- Nullable si proviene de la ingesta de archivos
  source_type varchar(50) not null default 'conversation', -- 'conversation' o 'file_upload'
  source_reference varchar(255), -- Nombre de archivo original, ID de Drive, etc.
  summary text not null, -- Resumen semántico o fragmento de texto
  embedding vector(1536), -- Vector embedding para OpenAI o Gemini Embeddings
  metadata jsonb not null default '{}'::jsonb, -- {tags, keywords, file_size, chunk_index, created_at_source}
  created_at timestamp with time zone default now()
);

-- Habilitar RLS en long_term_memories
alter table public.long_term_memories enable row level security;

create policy "Los usuarios pueden gestionar su memoria semántica"
  on public.long_term_memories for all
  using (auth.uid() = user_id);


-- 5. Sesiones de Conversación Reciente (Memoria a corto plazo)
create table if not exists public.short_term_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  channel varchar(50) not null default 'web', -- 'web', 'telegram', 'slack'
  context jsonb not null default '{}'::jsonb, -- Estado interno del diálogo
  messages jsonb[] not null default array[]::jsonb[], -- Historial de la charla activa [{role, content, timestamp}]
  updated_at timestamp with time zone default now()
);

-- Habilitar RLS en short_term_sessions
alter table public.short_term_sessions enable row level security;

create policy "Los usuarios pueden gestionar sus sesiones recientes"
  on public.short_term_sessions for all
  using (auth.uid() = user_id);

create trigger trigger_short_term_sessions_updated_at
  before update on public.short_term_sessions
  for each row execute procedure handle_updated_at();


-- 6. Logs de Rendimiento y Sentiment Analysis (Auto-mejora continua)
create table if not exists public.performance_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  session_id uuid references public.short_term_sessions on delete cascade,
  sentiment_score numeric not null default 0, -- -1 a 1
  user_rating integer check (user_rating >= 1 and user_rating <= 5),
  performance_index numeric not null check (performance_index >= 0 and performance_index <= 100),
  issues_detected text[] not null default array[]::text[],
  created_at timestamp with time zone default now()
);

-- Habilitar RLS en performance_logs
alter table public.performance_logs enable row level security;

create policy "Los usuarios pueden ver sus logs de rendimiento"
  on public.performance_logs for select
  using (auth.uid() = user_id);


-- 7. Registro de Versiones de Prompts (Historial de Prompt Tuning dinámico)
create table if not exists public.prompts_registry (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  version integer not null,
  prompt_content text not null,
  optimizations_made text not null,
  average_performance numeric default 0,
  is_active boolean not null default false,
  created_at timestamp with time zone default now()
);

-- Habilitar RLS en prompts_registry
alter table public.prompts_registry enable row level security;

create policy "Los usuarios pueden gestionar sus prompts"
  on public.prompts_registry for all
  using (auth.uid() = user_id);


-- 8. Tareas Pendientes y Recordatorios
create table if not exists public.pending_tasks_reminders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title varchar(255) not null,
  description text,
  due_date timestamp with time zone not null,
  status varchar(50) not null default 'pending', -- 'pending', 'completed'
  notified_channels varchar(50)[] not null default array[]::varchar(50)[], -- ['telegram', 'slack']
  created_at timestamp with time zone default now()
);

-- Habilitar RLS en pending_tasks_reminders
alter table public.pending_tasks_reminders enable row level security;

create policy "Los usuarios pueden gestionar sus tareas"
  on public.pending_tasks_reminders for all
  using (auth.uid() = user_id);


-- 9. Ejecuciones de Código Python Pendientes de Aprobación (Sandbox de seguridad)
create table if not exists public.python_executions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  script_code text not null,
  purpose text not null,
  status varchar(50) not null default 'pending_approval', -- 'pending_approval', 'approved', 'rejected', 'executed', 'failed'
  result_output text,
  approved_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- Habilitar RLS en python_executions
alter table public.python_executions enable row level security;

create policy "Los usuarios pueden ver y gestionar sus ejecuciones"
  on public.python_executions for all
  using (auth.uid() = user_id);

-- =======================================================
-- NOTA IMPORTANTE: Copia y pega este script en el 
-- SQL Editor de tu panel de Supabase para inicializar
-- todas las tablas, relaciones y triggers de seguridad.
-- =======================================================

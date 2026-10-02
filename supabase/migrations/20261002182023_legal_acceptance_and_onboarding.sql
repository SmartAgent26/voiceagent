create type public.legal_document_key as enum ('terms', 'privacy', 'ai_use');

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  document_key public.legal_document_key not null,
  version text not null,
  title text not null,
  content text not null,
  content_hash text not null,
  published_at timestamptz not null default now(),
  unique (document_key, version)
);

create table public.terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  document_key public.legal_document_key not null,
  document_version text not null,
  document_hash text not null,
  read_at timestamptz not null,
  accepted_at timestamptz not null default now(),
  app_version text not null default 'mvp-0.1',
  unique (user_id, document_key, document_version)
);

alter table public.profiles add column avatar_path text;
alter table public.athlete_profiles add column if not exists date_of_birth date;
alter table public.athlete_profiles add column if not exists province text;
alter table public.athlete_profiles add column if not exists city text;
alter table public.athlete_profiles add column if not exists organization_name text;
alter table public.athlete_profiles add column if not exists preferred_coach_name text not null default 'Aksis';
alter table public.athlete_profiles add column if not exists focus_areas text[] not null default '{}';
alter table public.athlete_profiles add column if not exists focus_area_other text;
alter table public.athlete_profiles add column if not exists goals_list jsonb not null default '[]'::jsonb;
alter table public.athlete_profiles add column if not exists current_challenge text;
alter table public.athlete_profiles add column if not exists training_days_per_week smallint check (training_days_per_week between 0 and 7);
alter table public.athlete_profiles add column if not exists next_event_name text;
alter table public.athlete_profiles add column if not exists next_event_date date;
alter table public.athlete_profiles add column if not exists human_coach_status text check (human_coach_status in ('no', 'not_ready', 'later'));

create index terms_acceptances_user_idx on public.terms_acceptances (user_id, accepted_at desc);

alter table public.legal_documents enable row level security;
alter table public.terms_acceptances enable row level security;

create policy legal_documents_select on public.legal_documents for select to authenticated using (true);
create policy legal_documents_admin_all on public.legal_documents for all to authenticated
using (public.is_superadmin()) with check (public.is_superadmin());
create policy terms_acceptances_select_own on public.terms_acceptances for select to authenticated
using (user_id = auth.uid() or public.is_superadmin());
create policy terms_acceptances_insert_own on public.terms_acceptances for insert to authenticated
with check (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy avatar_storage_select on storage.objects for select to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatar_storage_insert on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatar_storage_update on storage.objects for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

insert into public.legal_documents (document_key, version, title, content, content_hash) values
('terms', '2026-10-02', 'Términos de Uso', 'Aksis es una aplicación de coaching ontológico deportivo asistida por inteligencia artificial. No brinda diagnóstico, tratamiento médico, psicológico, psiquiátrico ni atención de emergencias. El uso es exclusivo para mayores de 18 años. No existe monitoreo humano permanente; ante riesgo inmediato se deben usar los recursos de emergencia correspondientes. Responsable provisorio: Aksis, pendiente de constitución legal. Domicilio provisorio: Ciudad Autónoma de Buenos Aires, Argentina. Contacto provisorio: privacidad@aksis.app.', 'terms-2026-10-02-v1'),
('privacy', '2026-10-02', 'Política de Privacidad', 'Aksis trata datos de cuenta, perfil deportivo, sesiones, bitácora, fotos opcionales y registros de uso para prestar el servicio, mejorar la continuidad del acompañamiento y cumplir obligaciones legales. Los datos pueden ser procesados por proveedores de infraestructura y de IA bajo controles de acceso. El usuario puede solicitar acceso, rectificación, actualización o supresión conforme a la Ley 25.326. Las respuestas marcadas como opcionales no son necesarias para crear la cuenta. No se solicita información clínica ni datos sensibles.', 'privacy-2026-10-02-v1'),
('ai_use', '2026-10-02', 'Uso de IA y límites del servicio', 'El coach de Aksis es una IA que usa el contexto autorizado de objetivos, sesiones y bitácora para formular preguntas de coaching. Sus respuestas no son indicaciones médicas, psicológicas, legales ni de entrenamiento técnico. Una foto o futura grabación de voz solo se procesa cuando el usuario decide enviarla. Un coach humano solo accede a información cuando existe una vinculación autorizada. Ante señales de riesgo, Aksis suspende el coaching y muestra recursos de ayuda; no reemplaza servicios de emergencia.', 'ai-use-2026-10-02-v1');

grant select on public.legal_documents to authenticated;
grant select, insert on public.terms_acceptances to authenticated;

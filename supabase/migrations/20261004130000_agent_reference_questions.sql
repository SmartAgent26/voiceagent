create table public.agent_reference_questions (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('contextual', 'transformational')),
  question text not null check (char_length(trim(question)) between 8 and 900),
  purpose text not null default '' check (char_length(purpose) <= 1400),
  is_active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index agent_reference_questions_active_position_idx
  on public.agent_reference_questions (is_active, category, position);

create trigger agent_reference_questions_set_updated_at before update on public.agent_reference_questions
for each row execute function public.set_updated_at();

alter table public.agent_reference_questions enable row level security;
create policy agent_reference_questions_superadmin_all on public.agent_reference_questions for all to authenticated
using (public.is_superadmin()) with check (public.is_superadmin());
grant select, insert, update, delete on public.agent_reference_questions to authenticated;

insert into public.agent_reference_questions (category, question, purpose, position) values
('contextual', '¿Qué te gustaría que pase en esta sesión para que sientas que fue valiosa para vos?', 'Establece el acuerdo de sesión, el compromiso inicial y las expectativas del deportista.', 10),
('contextual', '¿Qué hechos concretos ocurrieron en la competencia o entrenamiento, dejando por un momento lo que pensás al respecto?', 'Ayuda a separar afirmaciones comprobables de juicios o interpretaciones personales.', 20),
('contextual', '¿Cuál es la situación actual que sentís que interrumpió tu ritmo habitual o tu tranquilidad?', 'Identifica el quiebre o la brecha entre la realidad presente y el resultado esperado.', 30),
('contextual', 'Cuando pensás en este desafío, ¿qué emoción o estado de ánimo notás que aparece primero?', 'Permite reconocer la emocionalidad y su predisposición para la acción.', 40),
('contextual', 'Si tuvieras que resumir el principal problema en una sola oración, ¿cuál sería?', 'Verifica la escucha activa y reduce la brecha de interpretación.', 50),
('transformational', 'Decís que nunca rendís bajo presión: ¿hubo alguna vez en que sí pudiste responder, o qué te lo impide específicamente hoy?', 'Desafía generalizaciones y distorsiones del lenguaje sin convertirlas en verdades absolutas.', 60),
('transformational', '¿En qué parte de tu cuerpo sentís ese bloqueo y qué postura o respiración percibís mientras me lo contás?', 'Integra el dominio corporal y somático para reconocer la tensión presente.', 70),
('transformational', 'Si nos paramos en la postura de tu rival o de tu entrenador, ¿qué evidencia existiría para sostener exactamente el juicio contrario al tuyo?', 'Pone a prueba la fundamentación de los juicios y explora evidencia contraria.', 80),
('transformational', '¿Qué precio estás pagando por mantener esta explicación y de qué te estás volviendo responsable al sostenerla?', 'Invita a pasar de la queja a la responsabilidad sobre el propio aprendizaje.', 90),
('transformational', 'Si pudieras hacer una nueva declaración o promesa sobre tu desempeño a partir de hoy, ¿a qué te comprometés concretamente a hacer diferente?', 'Abre declaraciones y compromisos propios una vez explorada suficientemente la situación.', 100);

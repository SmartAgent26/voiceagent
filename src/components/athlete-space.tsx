"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type IconProps = { size?: number };
function Glyph({ symbol }: { symbol: string }) { return <span className="aksis-icon" aria-hidden="true">{symbol}</span>; }
const ArrowRight = (_: IconProps) => <Glyph symbol="→" />;
const BookOpen = (_: IconProps) => <Glyph symbol="▤" />;
const Bot = (_: IconProps) => <Glyph symbol="◌" />;
const Edit3 = (_: IconProps) => <Glyph symbol="✎" />;
const Plus = (_: IconProps) => <Glyph symbol="+" />;
const Quote = (_: IconProps) => <Glyph symbol="“" />;
const Sparkles = (_: IconProps) => <Glyph symbol="✦" />;

type AthleteData = {
  name: string;
  sport: string;
  level: string;
  coachName: string;
  goals: Goal[];
  avatarUrl: string | null;
};
type Goal = { id: string; title: string; description: string; status: "active" | "closed" };

const exampleGoals: Goal[] = [];

export function AthleteSpace() {
  const [athlete, setAthlete] = useState<AthleteData | null>(null);
  const [journalCount, setJournalCount] = useState(0);
  const [goalEditor, setGoalEditor] = useState<Goal | null>(null);
  const [profileEditor, setProfileEditor] = useState(false);

  useEffect(() => {
    const client = createBrowserSupabaseClient();
    void (async () => {
      const { data: auth } = await client.auth.getUser();
      if (!auth.user) return;
      const [{ data: profile }, { data: athleteProfile }, { count: journalCount }] = await Promise.all([
        client.from("profiles").select("display_name, avatar_path").eq("id", auth.user.id).single(),
        client.from("athlete_profiles").select("sport, competition_level, preferred_coach_name, goals_list").eq("user_id", auth.user.id).single(),
        client.from("journal_entries").select("id", { count: "exact", head: true }).eq("athlete_id", auth.user.id),
      ]);

      let avatarUrl: string | null = null;
      if (profile?.avatar_path) {
        const { data } = await client.storage.from("avatars").createSignedUrl(profile.avatar_path, 60 * 60);
        avatarUrl = data?.signedUrl ?? null;
      }

      const storedGoals: Goal[] = Array.isArray(athleteProfile?.goals_list) ? athleteProfile.goals_list.flatMap((goal, index) => typeof goal === "string" ? [{ id: `initial-${index}`, title: goal, description: "", status: "active" as const }] : goal && typeof goal === "object" && "title" in goal ? [{ id: String((goal as Goal).id || crypto.randomUUID()), title: String((goal as Goal).title), description: String((goal as Goal).description || ""), status: (goal as Goal).status === "closed" ? "closed" : "active" }] : []) : [];
      setAthlete({
        name: profile?.display_name || auth.user.email?.split("@")[0] || "Atleta",
        sport: athleteProfile?.sport || "Tu disciplina",
        level: athleteProfile?.competition_level || "Proceso deportivo",
        coachName: athleteProfile?.preferred_coach_name || "Aksis",
        goals: storedGoals.length ? storedGoals : exampleGoals,
        avatarUrl,
      });
      setJournalCount(journalCount ?? 0);
    })();
  }, []);

  async function saveGoals(goals: Goal[]) { const client = createBrowserSupabaseClient(); const { data } = await client.auth.getUser(); if (!data.user) return; await client.from("athlete_profiles").update({ goals_list: goals }).eq("user_id", data.user.id); setAthlete(current => current ? { ...current, goals } : current); }
  async function saveGoal(goal: Goal) { const goals = athlete?.goals || []; await saveGoals(goals.some(item => item.id === goal.id) ? goals.map(item => item.id === goal.id ? goal : item) : [...goals, goal]); setGoalEditor(null); }
  async function saveProfile(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const name = String(form.get("name") || "").trim(); const coachName = String(form.get("coach") || "").trim(); const image = form.get("avatar"); const client = createBrowserSupabaseClient(); const { data } = await client.auth.getUser(); if (!data.user) return; let avatarUrl = athlete?.avatarUrl ?? null; const profileUpdate: { display_name: string; avatar_path?: string } = { display_name: name }; if (image instanceof File && image.size > 0) { if (!['image/jpeg','image/png','image/webp'].includes(image.type) || image.size > 5 * 1024 * 1024) { alert("Elegí una imagen JPG, PNG o WebP de hasta 5 MB."); return; } const extension = image.type === 'image/png' ? 'png' : image.type === 'image/webp' ? 'webp' : 'jpg'; const path = `${data.user.id}/profile.${extension}`; const { error } = await client.storage.from("avatars").upload(path, image, { upsert: true, contentType: image.type }); if (error) { alert("No pudimos guardar la imagen. Intentá nuevamente."); return; } profileUpdate.avatar_path = path; const { data: signed } = await client.storage.from("avatars").createSignedUrl(path, 60 * 60); avatarUrl = signed?.signedUrl ?? null; } await Promise.all([client.from("profiles").update(profileUpdate).eq("id", data.user.id), client.from("athlete_profiles").update({ preferred_coach_name: coachName }).eq("user_id", data.user.id)]); setAthlete(current => current ? { ...current, name, coachName, avatarUrl } : current); setProfileEditor(false); }
  async function signOut() { await createBrowserSupabaseClient().auth.signOut(); location.assign("/access"); }

  const initial = athlete?.name.charAt(0).toUpperCase() || "A";
  return (
    <main className="athlete-space-page">
      <header className="athlete-topbar">
        <Link className="athlete-brand" href="/app"><span className="axis-mark" /><span><b>AKSIS</b><small>MI ESPACIO</small></span></Link>
        <button className="logout-button" aria-label="Cerrar sesión" onClick={signOut}><span>↪</span><small>Salir</small></button>
      </header>

      <div className="athlete-space-content">
        <section className="athlete-identity">
          <div className="athlete-avatar-wrap">
            <div className="athlete-avatar">{athlete?.avatarUrl ? <img src={athlete.avatarUrl} alt="" /> : initial}</div>
            <span className="presence-dot" />
            <button className="avatar-edit" aria-label="Editar perfil" onClick={() => setProfileEditor(true)}><Edit3 size={13} /> Editar</button>
          </div>
          <h1>{athlete?.name || "Preparando tu espacio…"}</h1>
          <p>{athlete ? `${athlete.level} · ${athlete.sport}` : ""}</p>
          <span className="attunement"><Sparkles size={15} /> Enfoque y serenidad <b>· En sintonía</b></span>
        </section>

        <section className="space-actions">
          <Link href="/chat" className="space-action coach-action">
            <span className="space-action-icon"><Bot size={25} /></span>
            <span><strong>Conversar con {athlete?.coachName || "Aksis"}</strong><small>Tu coach está disponible para escuchar y guiar tu diálogo interno.</small></span>
            <ArrowRight size={19} />
          </Link>
          <Link href="/journal" className="space-action journal-action">
            <span className="space-action-icon"><BookOpen size={23} /></span>
            <span><strong>Bitácora personal <em>{journalCount} entradas</em></strong><small>Registros, quiebres y aprendizajes de tu proceso.</small></span>
            <ArrowRight size={19} />
          </Link>
        </section>

        <section className="goals-section">
          <div className="goals-heading"><div><h2>Mis objetivos</h2><span>{athlete?.goals.filter(goal => goal.status === "active").length || 0} activos</span></div><button onClick={() => setGoalEditor({ id: crypto.randomUUID(), title: "", description: "", status: "active" })}><Plus size={17} /> Nuevo</button></div>
          <div className="goals-list">
            {(athlete?.goals || []).map((goal, index) => <button className={`goal-card goal-shadow-${index % 3} ${goal.status === "closed" ? "closed" : ""}`} onClick={() => setGoalEditor(goal)} key={goal.id}>
              <div><span className={`goal-pillar pillar-${index % 3}`}>{["Emoción", "Cuerpo", "Lenguaje"][index % 3]}</span><small>{index === 0 ? "En práctica" : index === 1 ? "Hábito consciente" : "Proceso semanal"}</small></div>
              <h3>{goal.title}</h3>{goal.description && <p>{goal.description}</p>}<div className="goal-progress"><span>{goal.status === "closed" ? "Objetivo cerrado" : "Sesiones donde se trabajó"}</span><b>Próximamente</b></div>
            </button>)}
          </div>
        </section>

        <aside className="daily-quote"><Quote size={21} /><div><p>“Observá sin juzgar, actuá con intención.”</p><small>Presencia diaria · Aksis</small></div></aside>
      </div>

      <nav className="athlete-bottom-nav"><Link className="active" href="/app"><Sparkles size={20} />Espacio</Link><button><span className="breath-icon">∞</span>Centrado</button><Link href="/journal"><Edit3 size={20} />Bitácora</Link><Link href="/chat"><Bot size={20} />Diálogo</Link></nav>
      {goalEditor && <GoalModal goal={goalEditor} onClose={() => setGoalEditor(null)} onSave={saveGoal} onDelete={async () => { await saveGoals((athlete?.goals || []).filter(goal => goal.id !== goalEditor.id)); setGoalEditor(null); }} />}
      {profileEditor && <form className="aksis-modal" onSubmit={saveProfile}><div><h2>Editar perfil</h2><label>Foto de perfil<input name="avatar" type="file" accept="image/jpeg,image/png,image/webp" /><small>JPG, PNG o WebP · hasta 5 MB</small></label><label>Cómo querés que te llamemos<input name="name" defaultValue={athlete?.name} required /></label><label>Nombre de tu coach<input name="coach" defaultValue={athlete?.coachName} required /></label><footer><button type="button" onClick={() => setProfileEditor(false)}>Cancelar</button><button type="submit">Guardar</button></footer></div></form>}
    </main>
  );
}

function GoalModal({ goal, onClose, onSave, onDelete }: { goal: Goal; onClose: () => void; onSave: (goal: Goal) => void; onDelete: () => void }) { return <form className="aksis-modal" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); onSave({ ...goal, title: String(form.get("title") || ""), description: String(form.get("description") || ""), status: String(form.get("status")) === "closed" ? "closed" : "active" }); }}><div><h2>{goal.title ? "Objetivo" : "Nuevo objetivo"}</h2><label>Título<input name="title" defaultValue={goal.title} required /></label><label>Descripción<textarea name="description" defaultValue={goal.description} /></label><label>Estado<select name="status" defaultValue={goal.status}><option value="active">Activo</option><option value="closed">Cerrado</option></select></label><footer><button type="button" onClick={onClose}>Cancelar</button>{!goal.id.startsWith("initial-") && <button type="button" onClick={onDelete}>Borrar</button>}<button type="submit">Guardar</button></footer></div></form>; }

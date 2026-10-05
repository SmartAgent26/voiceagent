"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearServerSession } from "@/lib/auth/browser-session";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { useAksisToast } from "@/components/aksis-toast";
import { PwaInstall } from "@/components/pwa-install";

type IconProps = { size?: number };
function Glyph({ symbol }: { symbol: string }) { return <span className="aksis-icon" aria-hidden="true">{symbol}</span>; }
const ArrowRight = (_: IconProps) => <Glyph symbol="→" />;
const BookOpen = (_: IconProps) => <Glyph symbol="▤" />;
const Calendar = (_: IconProps) => <Glyph symbol="□" />;
const Bot = (_: IconProps) => <Glyph symbol="◌" />;
const Edit3 = (_: IconProps) => <Glyph symbol="✎" />;
const Plus = (_: IconProps) => <Glyph symbol="+" />;
const Quote = (_: IconProps) => <Glyph symbol="“" />;
const Sparkles = (_: IconProps) => <Glyph symbol="✦" />;

type AthleteData = {
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  sport: string;
  discipline: string;
  level: string;
  dateOfBirth: string;
  coachName: string;
  goals: Goal[];
  avatarUrl: string | null;
  subscription: { name: string; status: string; blocksAvailable: number; blocksUsed: number; expiresAt: string | null };
};
type Goal = { id: string; title: string; description: string; status: "active" | "closed"; category?: string };
type GoalProposal = { title: string; description: string; category: string };
const goalCategoryOptions = ["Rendimiento y confianza", "Emocionalidad y calma", "Lenguaje y creencias", "Corporalidad y presencia", "Vínculos y comunicación", "Equilibrio deporte y vida"];

const exampleGoals: Goal[] = [];

export function AthleteSpace() {
  const { showToast } = useAksisToast();
  const [athlete, setAthlete] = useState<AthleteData | null>(null);
  const [journalCount, setJournalCount] = useState(0);
  const [calendarCount, setCalendarCount] = useState(0);
  const [goalEditor, setGoalEditor] = useState<Goal | null>(null);
  const [profileEditor, setProfileEditor] = useState(false);

  useEffect(() => {
    const client = createBrowserSupabaseClient();
    void (async () => {
      const { data: auth } = await client.auth.getUser();
      if (!auth.user) return;
      const [{ data: profile }, { data: athleteProfile }, { count: journalCount }, { count: calendarCount }, { data: subscription }] = await Promise.all([
        client.from("profiles").select("display_name, first_name, last_name, avatar_path, phone").eq("id", auth.user.id).single(),
        client.from("athlete_profiles").select("sport, discipline, competition_level, date_of_birth, preferred_coach_name, goals_list").eq("user_id", auth.user.id).single(),
        client.from("journal_entries").select("id", { count: "exact", head: true }).eq("athlete_id", auth.user.id),
        client.from("calendar_events").select("id", { count: "exact", head: true }).eq("athlete_id", auth.user.id).gte("starts_at", new Date().toISOString()),
        client.from("user_subscriptions").select("status, blocks_available, blocks_used, expires_at, subscription_plans(name)").eq("user_id", auth.user.id).maybeSingle(),
      ]);

      let avatarUrl: string | null = null;
      if (profile?.avatar_path) {
        const { data } = await client.storage.from("avatars").createSignedUrl(profile.avatar_path, 60 * 60);
        avatarUrl = data?.signedUrl ?? null;
      }

      const storedGoals: Goal[] = Array.isArray(athleteProfile?.goals_list) ? athleteProfile.goals_list.flatMap<Goal>((goal, index) => typeof goal === "string" ? [{ id: `initial-${index}`, title: goal, description: "", status: "active" }] : goal && typeof goal === "object" && "title" in goal ? [{ id: String((goal as Goal).id || crypto.randomUUID()), title: String((goal as Goal).title), description: String((goal as Goal).description || ""), status: (goal as Goal).status === "closed" ? "closed" : "active", category: goalCategoryOptions.includes(String((goal as Goal).category)) ? String((goal as Goal).category) : "" }] : []) : [];
      setAthlete({
        name: profile?.display_name || auth.user.email?.split("@")[0] || "Atleta",
        firstName: profile?.first_name || "",
        lastName: profile?.last_name || "",
        email: auth.user.email || "",
        phone: profile?.phone || "",
        sport: athleteProfile?.sport || "Tu disciplina",
        discipline: athleteProfile?.discipline || "",
        level: athleteProfile?.competition_level || "Proceso deportivo",
        dateOfBirth: athleteProfile?.date_of_birth || "",
        coachName: athleteProfile?.preferred_coach_name || "Aksis",
        goals: storedGoals.length ? storedGoals : exampleGoals,
        avatarUrl,
        subscription: { name: (subscription?.subscription_plans as { name?: string } | null)?.name || "Sin plan asignado", status: subscription?.status || "Sin suscripción", blocksAvailable: subscription?.blocks_available || 0, blocksUsed: subscription?.blocks_used || 0, expiresAt: subscription?.expires_at || null },
      });
      setJournalCount(journalCount ?? 0);
      setCalendarCount(calendarCount ?? 0);
    })();
  }, []);

  async function saveGoals(goals: Goal[]) {
    const client = createBrowserSupabaseClient();
    const { data, error: authError } = await client.auth.getUser();
    if (!data.user || authError) {
      showToast("No pudimos validar tu sesión. Volvé a ingresar e intentá nuevamente.", "error");
      return false;
    }
    const { error } = await client.from("athlete_profiles").update({ goals_list: goals }).eq("user_id", data.user.id);
    if (error) {
      showToast("No pudimos guardar el objetivo. Intentá nuevamente.", "error");
      return false;
    }
    setAthlete(current => current ? { ...current, goals } : current);
    showToast("Objetivo guardado correctamente.", "success");
    return true;
  }
  async function saveGoal(goal: Goal) {
    const goals = athlete?.goals || [];
    const nextGoals = goals.some(item => item.id === goal.id) ? goals.map(item => item.id === goal.id ? goal : item) : [...goals, goal];
    if (await saveGoals(nextGoals)) setGoalEditor(null);
  }
  async function saveProfile(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const name = String(form.get("name") || "").trim(); const coachName = String(form.get("coach") || "").trim(); const image = form.get("avatar"); const client = createBrowserSupabaseClient(); const { data } = await client.auth.getUser(); if (!data.user) return; let avatarUrl = athlete?.avatarUrl ?? null; if (image instanceof File && image.size > 0) { const { data: session } = await client.auth.getSession(); const upload = new FormData(); upload.append("avatar", image); const response = await fetch("/api/profile/avatar", { method: "POST", headers: { Authorization: `Bearer ${session.session?.access_token || ""}` }, body: upload }); const payload = await response.json() as { path?: string; error?: string }; if (!response.ok || !payload.path) { showToast(payload.error || "No pudimos guardar la imagen. Intentá nuevamente.", "error"); return; } const { data: signed } = await client.storage.from("avatars").createSignedUrl(payload.path, 60 * 60); avatarUrl = signed?.signedUrl ?? null; } await Promise.all([client.from("profiles").update({ display_name: name }).eq("id", data.user.id), client.from("athlete_profiles").update({ preferred_coach_name: coachName }).eq("user_id", data.user.id)]); setAthlete(current => current ? { ...current, name, coachName, avatarUrl } : current); setProfileEditor(false); showToast("Perfil actualizado correctamente.", "success"); }
  async function signOut() { await createBrowserSupabaseClient().auth.signOut(); await clearServerSession(); location.assign("/access"); }
  async function saveDetailedProfile(event: React.FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const sport = String(form.get("sport") || "").trim();
    const firstName = String(form.get("firstName") || "").trim();
    const lastName = String(form.get("lastName") || "").trim();
    const discipline = String(form.get("discipline") || "").trim();
    const level = String(form.get("level") || "").trim();
    const dateOfBirth = String(form.get("dateOfBirth") || "") || null;
    const phone = String(form.get("phone") || "").trim() || null;
    await saveProfile(event);
    const client = createBrowserSupabaseClient();
    const { data } = await client.auth.getUser();
    if (!data.user) return;
    await Promise.all([
      client.from("profiles").update({ phone, first_name: firstName || null, last_name: lastName || null }).eq("id", data.user.id),
      client.from("athlete_profiles").update({ sport, discipline: discipline || null, competition_level: level || null, date_of_birth: dateOfBirth }).eq("user_id", data.user.id),
    ]);
    setAthlete((current) => current ? { ...current, firstName, lastName, sport, discipline, level, dateOfBirth: dateOfBirth || "", phone: phone || "" } : current);
  }

  const initial = athlete?.name.charAt(0).toUpperCase() || "A";
  return (
    <main className="athlete-space-page">
      <header className="athlete-topbar">
        <Link className="athlete-brand" href="/app"><span className="axis-mark" /><span><b>AKSIS</b><small>MI ESPACIO</small></span></Link>
        <button className="logout-button" aria-label="Cerrar sesión" onClick={signOut}><span>↪</span><small>Salir</small></button>
      </header>

      <div className="athlete-space-content">
        <PwaInstall />
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
          <Link href="/calendar" className="space-action calendar-action">
            <span className="space-action-icon"><Calendar size={23} /></span>
            <span><strong>Agenda &amp; hitos <em>{calendarCount} próximos</em></strong><small>Fechas significativas para tu proceso deportivo y personal.</small></span>
            <ArrowRight size={19} />
          </Link>
        </section>

        <section className="goals-section">
          <div className="goals-heading"><div><h2>Mis objetivos</h2><span>{athlete?.goals.filter(goal => goal.status === "active").length || 0} activos</span></div><button onClick={() => setGoalEditor({ id: crypto.randomUUID(), title: "", description: "", status: "active" })}><Plus size={17} /> Nuevo</button></div>
          <div className="goals-list">
            {(athlete?.goals || []).map((goal, index) => <button className={`goal-card goal-shadow-${index % 3} ${goal.status === "closed" ? "closed" : ""}`} onClick={() => setGoalEditor(goal)} key={goal.id}>
              <div><span className={`goal-pillar pillar-${index % 3}`}>{goal.category || ["Emoción", "Cuerpo", "Lenguaje"][index % 3]}</span><small>{index === 0 ? "En práctica" : index === 1 ? "Hábito consciente" : "Proceso semanal"}</small></div>
              <h3>{goal.title}</h3>{goal.description && <p>{goal.description}</p>}<div className="goal-progress"><span>{goal.status === "closed" ? "Objetivo cerrado" : "Sesiones donde se trabajó"}</span><b>Próximamente</b></div>
            </button>)}
          </div>
        </section>

        <Link href="/sessions" className="conversation-summary-entry"><span className="conversation-summary-icon">◫</span><span><strong>Recorrido de conversaciones</strong><small>Entrá para ver los resúmenes y fechas de lo que fuiste trabajando con tu coach.</small></span><ArrowRight size={19} /></Link>

        <aside className="daily-quote"><Quote size={21} /><div><p>“Observá sin juzgar, actuá con intención.”</p><small>Presencia diaria · Aksis</small></div></aside>
      </div>

      <nav className="athlete-bottom-nav"><Link className="active" href="/app"><Sparkles size={20} />Espacio</Link><Link href="/centered"><span className="breath-icon">∞</span>Centrado</Link><Link href="/journal"><Edit3 size={20} />Bitácora</Link><Link href="/calendar"><Calendar size={20} />Agenda</Link><Link href="/chat"><Bot size={20} />Diálogo</Link></nav>
      {goalEditor && <GoalModal goal={goalEditor} onClose={() => setGoalEditor(null)} onSave={saveGoal} onDelete={async () => { if (await saveGoals((athlete?.goals || []).filter(goal => goal.id !== goalEditor.id))) setGoalEditor(null); }} />}
      {profileEditor && athlete && <ProfileModal athlete={athlete} onClose={() => setProfileEditor(false)} onSubmit={saveDetailedProfile} />}
    </main>
  );
}

function GoalModal({ goal, onClose, onSave, onDelete }: { goal: Goal; onClose: () => void; onSave: (goal: Goal) => Promise<void>; onDelete: () => Promise<void> }) {
  const [title, setTitle] = useState(goal.title);
  const [description, setDescription] = useState(goal.description);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [intention, setIntention] = useState("");
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantMessages, setAssistantMessages] = useState<string[]>([]);
  const [proposal, setProposal] = useState<GoalProposal | null>(null);
  const [assistantStatus, setAssistantStatus] = useState("");
  const [helping, setHelping] = useState(false);
  const [category, setCategory] = useState(goal.category || "");

  async function askGoalAssistant() {
    if (intention.trim().length < 8) return setAssistantStatus("Contanos un poco más sobre lo que te gustaría trabajar.");
    setHelping(true); setAssistantStatus(""); setProposal(null);
    try {
      const client = createBrowserSupabaseClient();
      const { data } = await client.auth.getSession();
      const response = await fetch("/api/goals/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token || ""}` },
        body: JSON.stringify({ messages: [...assistantMessages, intention.trim()] }),
      });
      const payload = await response.json() as { ok?: boolean; error?: string; suggestion?: { kind?: "question" | "suggestion"; title?: string; description?: string; category?: string; question?: string } };
      if (!response.ok || !payload.ok || !payload.suggestion) throw new Error(payload.error || "No pudimos preparar una propuesta.");
      setAssistantMessages((messages) => [...messages, intention.trim()]);
      setIntention("");
      if (payload.suggestion.kind === "suggestion") {
        setAssistantQuestion("");
        setProposal({ title: payload.suggestion.title || "", description: payload.suggestion.description || "", category: goalCategoryOptions.includes(payload.suggestion.category || "") ? payload.suggestion.category || "" : "" });
        setAssistantStatus("Aksis preparó una propuesta. Podés aceptarla o pedir un ajuste.");
      } else {
        setAssistantQuestion(payload.suggestion.question || "Para que el objetivo sea realmente tuyo, ¿qué cambio te gustaría poder elegir en esa situación?");
        setAssistantStatus("Aksis necesita conocer un poco más antes de proponer el objetivo.");
      }
    } catch (error) {
      setAssistantStatus(error instanceof Error && error.message ? error.message : "No pudimos preparar una propuesta. Intentá nuevamente.");
    } finally { setHelping(false); }
  }

  function useProposal() {
    if (!proposal) return;
    setTitle(proposal.title); setDescription(proposal.description); setCategory(proposal.category);
    setAssistantQuestion(""); setAssistantStatus("Propuesta incorporada. Podés ajustar los campos antes de guardar.");
  }

  return <form className="aksis-modal goal-modal" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void onSave({ ...goal, title: String(form.get("title") || ""), description: String(form.get("description") || ""), category: String(form.get("category") || ""), status: String(form.get("status")) === "closed" ? "closed" : "active" }); }}><div><h2>{goal.title ? "Objetivo" : "Nuevo objetivo"}</h2><button className="goal-ai-trigger" type="button" onClick={() => setAssistantOpen(open => !open)}>✦ Ayuda con IA</button>{assistantOpen && <section className="goal-ai-helper"><p>Contale qué te gustaría transformar. Aksis va a indagar primero y después propondrá un objetivo desde el coaching ontológico deportivo.</p>{assistantQuestion && <blockquote>{assistantQuestion}</blockquote>}{proposal && <article className="goal-ai-proposal"><small>PROPUESTA DE AKSIS</small><strong>{proposal.title}</strong><p>{proposal.description}</p><em>{proposal.category}</em><div><button type="button" className="goal-ai-request" onClick={useProposal}>Está bien, usarla</button><button type="button" className="goal-ai-adjust" onClick={() => { setIntention(""); setAssistantQuestion("¿Qué te gustaría cambiar o profundizar de esta propuesta?"); setProposal(null); }}>Quiero ajustarla</button></div></article>}<label>{assistantQuestion ? "Tu respuesta" : proposal ? "Qué querés ajustar" : "Tu intención"}<textarea value={intention} onChange={event => setIntention(event.target.value)} placeholder="Ej. Quiero disfrutar más los partidos sin quedar atrapado en el miedo a equivocarme." /></label><button className="goal-ai-request" type="button" onClick={() => void askGoalAssistant()} disabled={helping}>{helping ? "Pensando la propuesta…" : assistantQuestion || proposal ? "Enviar respuesta" : "Conversar con Aksis"}</button>{assistantStatus && <small className="goal-ai-status" aria-live="polite">{assistantStatus}</small>}</section>}<label>Título<input name="title" value={title} onChange={event => setTitle(event.target.value)} required /></label><label>Descripción<textarea name="description" value={description} onChange={event => setDescription(event.target.value)} /></label><label>Tipo de objetivo<select name="category" value={category} onChange={event => setCategory(event.target.value)}><option value="">Elegí un tipo</option>{goalCategoryOptions.map((item) => <option value={item} key={item}>{item}</option>)}</select></label><label>Estado<select name="status" defaultValue={goal.status}><option value="active">Activo</option><option value="closed">Cerrado</option></select></label><footer><button className="secondary-button" type="button" onClick={onClose}>Cancelar</button>{!goal.id.startsWith("initial-") && <button className="goal-delete-button" type="button" onClick={() => void onDelete()}>Borrar</button>}<button className="primary-button" type="submit">Guardar objetivo</button></footer></div></form>;
}

function ProfileModal({ athlete, onClose, onSubmit }: { athlete: AthleteData; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void> }) {
  const [cropOpen, setCropOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  return <form className="aksis-modal profile-modal" onSubmit={onSubmit}>
    <div>
      <header className="profile-editor-header"><button type="button" className="profile-back" onClick={onClose}>← Volver</button><div><span className="profile-modal-kicker">IDENTIDAD &amp; SOMÁTICA</span><h2>Editar perfil</h2><p>Armonizá tus datos personales, enfoque deportivo y presencia en tu espacio de coaching.</p></div></header>
      <section className="profile-avatar-section"><div className="profile-avatar-preview">{previewUrl || athlete.avatarUrl ? <img src={previewUrl || athlete.avatarUrl || ""} alt="Vista previa del perfil" style={{ transform: `scale(${zoom})` }} /> : athlete.name.charAt(0).toUpperCase()}<button type="button" aria-label="Cambiar foto" onClick={() => document.getElementById("profile-avatar-input")?.click()}>⌁</button></div><div><b>Foto de perfil</b><small>JPG, PNG o WebP · hasta 5 MB</small><label className="profile-photo-action">Subir nueva<input id="profile-avatar-input" name="avatar" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const file = event.target.files?.[0]; if (file) { setPreviewUrl(URL.createObjectURL(file)); setCropOpen(true); } }} /></label>{previewUrl && <button type="button" className="crop-trigger" onClick={() => setCropOpen(true)}>⌗ Ajustar encuadre</button>}</div></section>
      <section className="profile-section"><div className="profile-section-title"><h3>Datos personales</h3><span>Verificado</span></div><div className="profile-fields personal-fields"><label>Nombre y apellido<input name="name" defaultValue={athlete.name} required /></label><label>Correo electrónico <small>Solo lectura</small><input name="email" value={athlete.email} readOnly /></label><label>Teléfono móvil<input name="phone" type="tel" defaultValue={athlete.phone} placeholder="+54 9 11 0000 0000" /></label><label>Fecha de nacimiento<input name="dateOfBirth" type="date" defaultValue={athlete.dateOfBirth} /></label></div></section><section className="profile-section"><div className="profile-section-title"><h3>Trayectoria y categoría</h3></div><div className="profile-fields"><label>Deporte que practicás<input name="sport" defaultValue={athlete.sport} required /></label><label>Modalidad / especialidad<input name="discipline" defaultValue={athlete.discipline} placeholder="Ej. rugby seven, fondo, natación libre" /></label><label>Nivel o etapa actual<input name="level" defaultValue={athlete.level} /></label><label>Nombre de tu coach<input name="coach" defaultValue={athlete.coachName} required /></label></div><p className="profile-coach-note">Esta categoría adapta el lenguaje, las metáforas corporales y el ritmo de las sesiones con tu coach.</p></section>
      <section className="profile-section"><div className="profile-section-title"><h3>Datos personales</h3><span>Verificado</span></div><div className="profile-fields personal-fields"><label>Cómo querés que te llame el coach<input name="name" defaultValue={athlete.name} required /></label><label>Nombre<input name="firstName" defaultValue={athlete.firstName} /></label><label>Apellido<input name="lastName" defaultValue={athlete.lastName} /></label><label>Correo electrónico <small>Solo lectura</small><input name="email" value={athlete.email} readOnly /></label><label>Teléfono móvil<input name="phone" type="tel" defaultValue={athlete.phone} placeholder="+54 9 11 0000 0000" /></label><label>Fecha de nacimiento<input name="dateOfBirth" type="date" defaultValue={athlete.dateOfBirth} /></label></div></section><section className="profile-section"><div className="profile-section-title"><h3>Trayectoria y categoría</h3></div><div className="profile-fields"><label>Deporte que practicás<select name="sport" defaultValue={athlete.sport}><option value={athlete.sport}>{athlete.sport}</option><option value="Atletismo">Atletismo</option><option value="Básquet">Básquet</option><option value="Ciclismo">Ciclismo</option><option value="Fútbol">Fútbol</option><option value="Hockey">Hockey</option><option value="Natación">Natación</option><option value="Rugby">Rugby</option><option value="Running">Running</option><option value="Tenis">Tenis</option><option value="Otro">Otro</option></select></label><label>Modalidad / especialidad<input name="discipline" defaultValue={athlete.discipline} placeholder="Ej. rugby seven, fondo, natación libre" /></label><label>Modalidad de práctica<select name="level" defaultValue={athlete.level}><option value="Formación">Formación</option><option value="Competitivo">Competitivo</option><option value="Alto rendimiento">Alto rendimiento</option><option value="Profesional">Profesional</option><option value="Master / recreativo con objetivos">Master / recreativo con objetivos</option></select></label><label>Nombre de tu coach<input name="coach" defaultValue={athlete.coachName} required /></label></div><p className="profile-coach-note">Esta categoría adapta el lenguaje, las metáforas corporales y el ritmo de las sesiones con tu coach.</p></section>
      <section className="profile-subscription" aria-label="Suscripción actual"><div className="profile-section-title"><h3>Suscripción actual</h3><em>{athlete.subscription.status}</em></div><span>Membresía actual · Solo lectura</span><b>{athlete.subscription.name}</b><p>{athlete.subscription.blocksAvailable - athlete.subscription.blocksUsed} bloques disponibles · Datos administrados por Aksis</p></section>
      <footer><button type="button" onClick={onClose}>Cancelar</button><button type="submit">Guardar cambios</button></footer>
      {cropOpen && <section className="avatar-crop-modal" role="dialog" aria-modal="true" aria-label="Ajustar encuadre"><div><header><div><span className="profile-modal-kicker">FOTO DE PERFIL</span><h3>Ajustar encuadre</h3></div><button type="button" className="modal-close" onClick={() => setCropOpen(false)} aria-label="Cerrar">×</button></header><div className="crop-viewport">{previewUrl && <img src={previewUrl} alt="Encuadre de la foto" style={{ transform: `scale(${zoom})` }} />}</div><label className="crop-range">Acercamiento<input type="range" min="1" max="2" step="0.05" value={zoom} onChange={event => setZoom(Number(event.target.value))} /></label><footer><button type="button" onClick={() => setCropOpen(false)}>Cancelar</button><button type="button" onClick={() => setCropOpen(false)}>Aplicar encuadre</button></footer></div></section>}
    </div>
  </form>;
}

"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { useAksisToast } from "@/components/aksis-toast";

type CalendarEvent = {
  id: string;
  title: string;
  starts_at: string;
  all_day: boolean;
  custom_label: string | null;
  tags: string[];
  expected_state: string | null;
  notes: string | null;
};

const suggestedTags = [
  { label: "Competencia", tone: "mint" },
  { label: "Vínculos", tone: "rose" },
  { label: "Espacio íntimo", tone: "stone" },
  { label: "Práctica física", tone: "sky" },
];
const states = [
  { label: "Calma", icon: "◌" },
  { label: "Foco", icon: "◎" },
  { label: "Gratitud", icon: "♡" },
  { label: "Serenidad", icon: "☼" },
];
const weekdays = ["L", "M", "X", "J", "V", "S", "D"];

const monthName = (date: Date) =>
  new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(date);
const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const displayDate = (date: Date) =>
  `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
const parseDisplayDate = (value: string) => {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const parsed = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  return Number.isNaN(parsed.getTime()) || displayDate(parsed) !== value ? null : parsed;
};
const tagDotColor = (events: CalendarEvent[]) => {
  const labels = events.flatMap((event) => event.tags || []);
  if (labels.includes("Vínculos")) return "#df8d8b";
  if (labels.includes("Práctica física")) return "#55a9b1";
  if (labels.includes("Espacio íntimo")) return "#9aa7a2";
  return "#258b78";
};

export function CalendarEvents() {
  const { showToast } = useAksisToast();
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(localDate(new Date()));
  const [dateText, setDateText] = useState(displayDate(new Date()));
  const [time, setTime] = useState("09:30");
  const [allDay, setAllDay] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [state, setState] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const client = createBrowserSupabaseClient();
  const bounds = useMemo(
    () => ({
      from: new Date(month.getFullYear(), month.getMonth(), 1).toISOString(),
      to: new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString(),
    }),
    [month],
  );

  async function load() {
    const { data: auth } = await client.auth.getUser();
    if (!auth.user) return location.assign("/access");
    const { data, error } = await client
      .from("calendar_events")
      .select("id,title,starts_at,all_day,custom_label,tags,expected_state,notes")
      .eq("athlete_id", auth.user.id)
      .gte("starts_at", bounds.from)
      .lt("starts_at", bounds.to)
      .order("starts_at");
    if (error) showToast("No pudimos cargar tus hitos.", "error");
    else setEvents((data || []) as CalendarEvent[]);
  }

  useEffect(() => {
    void load();
  }, [bounds.from, bounds.to]);

  function reset() {
    setEditing(null);
    setTitle("");
    setDate(localDate(new Date()));
    setDateText(displayDate(new Date()));
    setTime("09:30");
    setAllDay(false);
    setCustomLabel("");
    setTags([]);
    setCustomTag("");
    setState("");
    setNotes("");
  }

  function toggleTag(tag: string) {
    setTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag].slice(0, 8),
    );
  }

  function addCustomTag() {
    const value = customTag.trim();
    if (!value) return;
    setTags((current) =>
      current.includes(value) ? current : [...current, value].slice(0, 8),
    );
    setCustomTag("");
  }

  function edit(event: CalendarEvent) {
    const value = new Date(event.starts_at);
    setEditing(event);
    setTitle(event.title);
    setDate(localDate(value));
    setDateText(displayDate(value));
    setTime(`${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`);
    setAllDay(event.all_day);
    setCustomLabel(event.custom_label || "");
    setTags(event.tags || []);
    setCustomTag("");
    setState(event.expected_state || "");
    setNotes(event.notes || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedDate = parseDisplayDate(dateText);
    if (!title.trim()) return;
    if (!selectedDate) {
      showToast("Usá el formato de fecha dd/mm/aaaa.", "info");
      return;
    }
    setBusy(true);
    const normalizedDate = localDate(selectedDate);
    setDate(normalizedDate);
    const starts = new Date(`${normalizedDate}T${allDay ? "12:00" : time}:00`);
    const payload = {
      title: title.trim(),
      starts_at: starts.toISOString(),
      all_day: allDay,
      custom_label: customLabel.trim() || null,
      tags,
      expected_state: state || null,
      notes: notes.trim() || null,
    };
    const { data: auth } = await client.auth.getUser();
    const result = editing
      ? await client.from("calendar_events").update(payload).eq("id", editing.id)
      : auth.user
        ? await client.from("calendar_events").insert({ ...payload, athlete_id: auth.user.id })
        : { error: new Error("Sin sesión") };
    setBusy(false);
    if (result.error) {
      showToast("No pudimos guardar este hito.", "error");
      return;
    }
    showToast(editing ? "Hito actualizado correctamente." : "Hito registrado en tu calendario.", "success");
    reset();
    await load();
  }

  async function remove(id: string) {
    const { error } = await client.from("calendar_events").delete().eq("id", id);
    if (error) showToast("No pudimos eliminar este hito.", "error");
    else {
      showToast("Hito eliminado.", "info");
      await load();
    }
  }

  const firstWeekday = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const calendarCells = Array.from(
    { length: Math.ceil((firstWeekday + days) / 7) * 7 },
    (_, index) => index - firstWeekday + 1,
  );
  const eventsForDay = (day: number) =>
    events.filter((event) => new Date(event.starts_at).getDate() === day);

  return (
    <main className="calendar-page">
      <header>
        <Link href="/app">← Volver a Mi Espacio</Link>
        <span>● CICLO ACTIVO</span>
        <small>CONCIENCIA TEMPORAL</small>
        <div>
          <section>
            <h1>Agenda &amp; Hitos</h1>
            <p>Registrá entrenamientos, competencias y sucesos que hoy son significativos para vos.</p>
          </section>
          <button className="calendar-add-shortcut" onClick={() => document.getElementById("calendar-form")?.scrollIntoView({ behavior: "smooth" })}>＋ Hito</button>
        </div>
      </header>

      <section className="calendar-month">
        <header>
          <div><b>▣</b><h2>{monthName(month)}</h2></div>
          <aside>
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Mes anterior">‹</button>
            <button className="calendar-today" onClick={() => { const today = new Date(); setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setDate(localDate(today)); setDateText(displayDate(today)); }} aria-label="Ir al día de hoy">Hoy</button>
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Mes siguiente">›</button>
          </aside>
        </header>
        <div className="calendar-weekdays">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-days">
          {calendarCells.map((day, index) => {
            if (day < 1 || day > days) return <span key={`outside-${index}`} className="outside" />;
            const dayEvents = eventsForDay(day);
            const selected = new Date(month.getFullYear(), month.getMonth(), day);
            return <button
              key={`day-${day}`}
              title={dayEvents.length ? dayEvents.map((event) => event.title).join(" · ") : undefined}
              className={localDate(new Date()) === localDate(selected) ? "today" : ""}
              onClick={() => {
                setDate(localDate(selected));
                setDateText(displayDate(selected));
                document.getElementById("calendar-form")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <b>{day}</b>{dayEvents.length > 0 && <i className="has-events" style={{ backgroundColor: tagDotColor(dayEvents) }} />}
            </button>;
          })}
        </div>
      </section>

      <section className="calendar-form" id="calendar-form">
        <header>
          <div><b>●</b><section><small>ESPACIO PROPIO</small><h2>{editing ? "Editar hito" : "Registrar nuevo hito"}</h2></section></div>
          {editing && <button type="button" onClick={reset}>Cancelar edición</button>}
        </header>
        <form onSubmit={save}>
          <label>Título o vivencia<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. torneo, reunión, fecha importante" required maxLength={180} /></label>
          <div className="calendar-date-time">
            <label>Fecha<input type="text" value={dateText} onChange={(event) => setDateText(event.target.value)} placeholder="dd/mm/aaaa" inputMode="numeric" required /></label>
            <label>Hora<input type="time" value={time} disabled={allDay} onChange={(event) => setTime(event.target.value)} /></label>
            <label className="calendar-all-day">Todo el día<input type="checkbox" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} /><i /></label>
          </div>

          <section className="calendar-tag-section">
            <div className="calendar-field-heading"><span>Etiquetas <small>Libre definición</small></span><em>Sin moldes</em></div>
            <div className="calendar-tag-options">
              {suggestedTags.map((tag) => <button key={tag.label} type="button" className={`calendar-tag-choice ${tag.tone} ${tags.includes(tag.label) ? "selected" : ""}`} onClick={() => toggleTag(tag.label)}>{tag.label}</button>)}
            </div>
            <div className="calendar-custom-tag">
              <input value={customTag} onChange={(event) => setCustomTag(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomTag(); } }} placeholder="＋ Otra etiqueta libre…" maxLength={80} />
              <button type="button" onClick={addCustomTag}>Añadir</button>
            </div>
            {!!tags.length && <div className="calendar-selected-tags">{tags.map((tag) => <button type="button" key={tag} onClick={() => toggleTag(tag)}>{tag} <b>×</b></button>)}</div>}
            <label className="calendar-custom-label">Etiqueta de referencia <small>Opcional</small><input value={customLabel} onChange={(event) => setCustomLabel(event.target.value)} placeholder="Ej. algo que querés nombrar con tus propias palabras" maxLength={80} /></label>
          </section>

          <section className="calendar-state-section">
            <div className="calendar-field-heading"><span>Predisposición o sentir esperado <small>Opcional</small></span></div>
            <div className="calendar-state-picker">
              {states.map((item) => <button className={state === item.label ? "selected" : ""} type="button" onClick={() => setState(state === item.label ? "" : item.label)} key={item.label}><b>{item.icon}</b><span>{item.label}</span></button>)}
            </div>
          </section>

          <label>Nota para vos <small>Opcional</small><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="¿Qué querés tener presente al llegar a esta fecha?" maxLength={1000} /></label>
          <footer><button type="button" onClick={reset}>Limpiar</button><button disabled={busy}>{busy ? "Guardando…" : editing ? "Guardar cambios" : "✓ Registrar en calendario"}</button></footer>
        </form>
      </section>

      <section className="calendar-event-list">
        <header><h2>Hitos registrados en el mes</h2><span>{events.length} eventos</span></header>
        {events.length ? events.map((event, index) => {
          const eventTags = [...new Set([event.custom_label, ...(event.tags || [])].filter(Boolean) as string[])];
          return <article className={`calendar-event event-tone-${index % 3}`} key={event.id}>
            <time><b>{new Date(event.starts_at).getDate()}</b><small>{new Intl.DateTimeFormat("es-AR", { month: "short" }).format(new Date(event.starts_at))}</small></time>
            <div><h3>{event.title}</h3>{!!eventTags.length && <p className="calendar-event-tags">{eventTags.map((tag) => <em key={tag}>{tag}</em>)}</p>}<small>{event.all_day ? "Todo el día" : new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" }).format(new Date(event.starts_at))}{event.expected_state ? ` · ${event.expected_state}` : ""}{event.notes ? ` · ${event.notes}` : ""}</small></div>
            <aside><button onClick={() => edit(event)} aria-label="Editar hito">✎</button><button onClick={() => void remove(event.id)} aria-label="Eliminar hito">⌫</button></aside>
          </article>;
        }) : <p className="calendar-empty">Todavía no hay hitos en este mes. Podés registrar el que sea importante para vos.</p>}
      </section>
      <aside className="calendar-quote">“El tiempo del atleta no es solo una cuenta regresiva al próximo desafío: también es el tejido donde conviven su esfuerzo físico, sus afectos y su serenidad interior.”<small>Brújula Aksis</small></aside>
    </main>
  );
}

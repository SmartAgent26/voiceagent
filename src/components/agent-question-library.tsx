"use client";

import { FormEvent, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { useAksisToast } from "@/components/aksis-toast";

type Category = "contextual" | "transformational";
type ReferenceQuestion = { id: string; category: Category; question: string; purpose: string; is_active: boolean; position: number };
const emptyDraft = { category: "contextual" as Category, question: "", purpose: "" };

function ActionIcon({ name }: { name: "edit" | "pause" | "play" | "delete" }) {
  if (name === "edit") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>;
  if (name === "pause") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>;
  if (name === "play") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M9 7l1-3h4l1 3M6 7l1 13h10l1-13"/></svg>;
}

export function AgentQuestionLibrary() {
  const client = createBrowserSupabaseClient();
  const { showToast } = useAksisToast();
  const [questions, setQuestions] = useState<ReferenceQuestion[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | Category>("all");
  const [page, setPage] = useState(1);

  async function operate(body: unknown) {
    const { data } = await client.auth.getSession();
    const response = await fetch("/api/admin/operations", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token || ""}` }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "No pudimos completar la operación.");
  }

  async function load() {
    setLoading(true);
    const { data, error } = await client.from("agent_reference_questions").select("id,category,question,purpose,is_active,position").order("category").order("position");
    if (error) showToast("No pudimos cargar la biblioteca de preguntas.", "error");
    else setQuestions((data || []) as ReferenceQuestion[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);
  function reset() { setDraft(emptyDraft); setEditing(null); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.question.trim()) return;
    setSaving(true);
    const payload = { category: draft.category, question: draft.question.trim(), purpose: draft.purpose.trim() };
    try { await operate(editing ? { action: "question.update", id: editing, data: payload } : { action: "question.create", data: payload }); }
    catch (error) { setSaving(false); showToast(error instanceof Error ? error.message : "No se pudo guardar la pregunta.", "error"); return; }
    setSaving(false);
    showToast(editing ? "Pregunta actualizada correctamente." : "Pregunta agregada a la biblioteca.", "success");
    reset(); await load();
  }
  async function toggle(question: ReferenceQuestion) {
    try { await operate({ action: "question.active", id: question.id, isActive: !question.is_active }); showToast(question.is_active ? "Pregunta desactivada." : "Pregunta activada.", "info"); await load(); }
    catch { showToast("No se pudo actualizar el estado de la pregunta.", "error"); }
  }
  async function remove(question: ReferenceQuestion) {
    try { await operate({ action: "question.delete", id: question.id }); showToast("Pregunta eliminada de la biblioteca.", "success"); if (editing === question.id) reset(); await load(); }
    catch { showToast("No se pudo eliminar la pregunta.", "error"); }
  }
  const pageSize = 6;
  const filtered = questions.filter((item) => filter === "all" || item.category === filter);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleQuestions = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return <section className="agent-question-library">
    <header><div><span>BIBLIOTECA DE REFERENCIA</span><h2>Preguntas que orientan al coach</h2><p>Son recursos, no un libreto: el agente elige, adapta o deja de lado cada una según la conversación.</p></div><b>{questions.filter((item) => item.is_active).length} activas</b></header>
    {loading ? <p className="question-loading">Cargando biblioteca…</p> : <section className="question-table-wrap"><header className="question-table-toolbar"><span>{filtered.length} {filtered.length === 1 ? "pregunta" : "preguntas"}</span><label>Tipo<select value={filter} onChange={(event) => { setFilter(event.target.value as "all" | Category); setPage(1); }}><option value="all">Todas las preguntas</option><option value="contextual">Exploratorias y de encuadre</option><option value="transformational">Poderosas y transformacionales</option></select></label></header><div className="question-table-head"><span>Tipo</span><span>Pregunta e intención</span><span>Estado</span><span>Acciones</span></div>{visibleQuestions.length ? visibleQuestions.map((question) => <article className={!question.is_active ? "paused" : ""} key={question.id}><span className={`question-category ${question.category}`}>{question.category === "contextual" ? "Encuadre" : "Transformacional"}</span><div><b>{question.question}</b>{question.purpose && <p>{question.purpose}</p>}</div><span className={question.is_active ? "question-status active" : "question-status"}>{question.is_active ? "Activa" : "Pausada"}</span><aside><button type="button" className="question-action" onClick={() => { setDraft({ category: question.category, question: question.question, purpose: question.purpose }); setEditing(question.id); }} aria-label="Editar pregunta" title="Editar"><ActionIcon name="edit"/></button><button type="button" className="question-action" onClick={() => void toggle(question)} aria-label={question.is_active ? "Pausar pregunta" : "Activar pregunta"} title={question.is_active ? "Pausar" : "Activar"}><ActionIcon name={question.is_active ? "pause" : "play"}/></button><button type="button" className="question-action delete" onClick={() => void remove(question)} aria-label="Eliminar pregunta" title="Eliminar"><ActionIcon name="delete"/></button></aside></article>) : <p className="question-empty">No hay preguntas para este filtro.</p>}<footer className="question-pagination"><small>Página {currentPage} de {totalPages}</small><div><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1}>Anterior</button><button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage === totalPages}>Siguiente</button></div></footer></section>}
    <form className="question-form" onSubmit={save}><div><span>{editing ? "EDITANDO PREGUNTA" : "NUEVA PREGUNTA"}</span><h3>{editing ? "Ajustá la referencia" : "Sumá una pregunta de referencia"}</h3></div><label>Grupo<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as Category })}><option value="contextual">Exploratoria y de encuadre</option><option value="transformational">Poderosa y transformacional</option></select></label><label>Pregunta<textarea value={draft.question} onChange={(event) => setDraft({ ...draft, question: event.target.value })} placeholder="Escribí la pregunta que el coach podrá adaptar…" required maxLength={900}/></label><label>Propósito ontológico <small>Opcional · guía interna para el agente</small><textarea value={draft.purpose} onChange={(event) => setDraft({ ...draft, purpose: event.target.value })} placeholder="Qué busca explorar o habilitar" maxLength={1400}/></label><footer>{editing && <button type="button" className="secondary-button" onClick={reset}>Cancelar</button>}<button type="submit" disabled={saving}>{saving ? "Guardando…" : editing ? "Guardar pregunta" : "Agregar pregunta"}</button></footer></form>
  </section>;
}

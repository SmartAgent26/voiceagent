"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type Turn = { role: "user" | "assistant"; content: string };

export function AthleteChat() {
  const [history, setHistory] = useState<Turn[]>([]);
  const [coachName, setCoachName] = useState("Aksis");
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => { const client = createBrowserSupabaseClient(); void (async () => { const { data: auth } = await client.auth.getUser(); if (!auth.user) return location.assign("/access"); const { data } = await client.from("athlete_profiles").select("preferred_coach_name").eq("user_id", auth.user.id).single(); const name = data?.preferred_coach_name?.trim() || "Aksis"; setCoachName(name); setHistory([{ role: "assistant", content: "¿Cómo llega hoy tu mente y tu cuerpo a este espacio?" }]); })(); }, []);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || status === "loading") return;
    const next = [...history, { role: "user" as const, content }];
    setHistory(next);
    setDraft("");
    setStatus("loading");
    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: next }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setHistory([...next, { role: "assistant", content: payload.content }]);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return <main className="athlete-chat-page">
    <header className="chat-header">
      <div className="chat-brand"><span className="axis-mark" /><div><h1>Aksis</h1><small>Coaching ontológico deportivo</small></div></div>
      <div className="chat-actions"><span className="chat-timer">◷ Sesión activa</span><Link className="chat-close" href="/app" aria-label="Cerrar diálogo y volver a Mi Espacio">×</Link></div>
    </header>
    <section className="chat-conversation" aria-live="polite">
      {history.map((turn, index) => <article className={`chat-turn ${turn.role}`} key={`${turn.role}-${index}`}>
        {turn.role === "assistant" && <div className="chat-author"><span>◌</span><b>{coachName}</b></div>}
        <div className="chat-bubble">{turn.content}</div>
      </article>)}
      {status === "loading" && <p className="chat-thinking">Aksis está preparando una pregunta…</p>}
      {status === "error" && <p className="chat-error">No pudimos continuar la conversación. Intentá nuevamente.</p>}
    </section>
    <form className="chat-input" onSubmit={send}>
      <button type="button" aria-label="Adjuntar nota" disabled>⌇</button>
      <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Escribí un mensaje…" maxLength={4000} />
      <button className="chat-send" type="submit" aria-label="Enviar mensaje" disabled={status === "loading"}>↗</button>
    </form>
  </main>;
}

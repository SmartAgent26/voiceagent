"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type SessionSummary = { id: string; ended_at: string | null; context_summary: string | null };
const isUsableSummary = (value: string | null) => Boolean(value) && !/(^|\n)\s*(the user wants|analysis of the session|drafting summary|constraints:|internal process|system prompt)/i.test(value || "");

export function SessionSummaries() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => { const client = createBrowserSupabaseClient(); void (async () => { const { data: auth } = await client.auth.getUser(); if (!auth.user) return location.assign("/access"); const { data } = await client.from("coaching_sessions").select("id,ended_at,context_summary").eq("athlete_id", auth.user.id).eq("status", "closed").not("context_summary", "is", null).order("ended_at", { ascending: false }); setSessions(((data || []) as SessionSummary[]).filter((session) => isUsableSummary(session.context_summary))); setReady(true); })(); }, []);
  const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(new Date(value)) : "Fecha no disponible";
  return <main className="session-summaries-page"><header><Link href="/app">← Volver a Mi Espacio</Link><span>{sessions.length} sesiones</span><h1>Recorrido de conversaciones</h1><p>Una mirada breve sobre lo que fuiste explorando con tu coach.</p></header>{!ready ? <p className="session-loading">Preparando tu recorrido…</p> : !sessions.length ? <section className="session-empty"><b>Tu recorrido empieza cuando cierres tu primera sesión.</b><p>Al terminar una conversación, Aksis guarda un resumen breve de lo trabajado para acompañar la próxima.</p><Link href="/chat">Iniciar una conversación →</Link></section> : <section className="session-timeline">{sessions.map((session) => <article key={session.id}><time>{formatDate(session.ended_at)}</time><div><span className="session-dot"/><p>{session.context_summary}</p></div></article>)}</section>}</main>;
}

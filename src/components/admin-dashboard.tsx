"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type Metrics = { athletes: number; sessions: number; tokens: number; cost: number; errors: number; activePlans: number };
type AthleteUsage = { athleteId: string; displayName: string; inputTokens: number; outputTokens: number; totalTokens: number; costUsd: number; sessions: number };
type SessionUsage = { athleteId: string; athleteName: string; sessionId: string | null; operation: string; inputTokens: number; outputTokens: number; totalTokens: number; costUsd: number; status: string; createdAt: string };
type Pagination = { page: number; pageSize: number; total: number; totalPages: number };
type Telemetry = { metrics: Metrics; athletes: AthleteUsage[]; recentSessions: SessionUsage[]; sessionPagination: Pagination };
const empty: Metrics = { athletes: 0, sessions: 0, tokens: 0, cost: 0, errors: 0, activePlans: 0 };
const emptyPagination: Pagination = { page: 1, pageSize: 10, total: 0, totalPages: 1 };

export function AdminDashboard() {
  const [metrics, setMetrics] = useState<Metrics>(empty);
  const [athleteUsage, setAthleteUsage] = useState<AthleteUsage[]>([]);
  const [recentSessions, setRecentSessions] = useState<SessionUsage[]>([]);
  const [pagination, setPagination] = useState<Pagination>(emptyPagination);
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [exporting, setExporting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const client = createBrowserSupabaseClient();
    void (async () => {
      const { data } = await client.auth.getSession();
      const response = await fetch(`/api/admin/metrics?page=${page}`, { headers: { Authorization: `Bearer ${data.session?.access_token || ""}` } });
      const payload = await response.json() as Telemetry | { error?: string };
      if (!response.ok || !("metrics" in payload)) {
        setError("error" in payload ? payload.error || "No pudimos cargar la telemetría." : "No pudimos cargar la telemetría.");
        setLoaded(true);
        return;
      }
      setMetrics(payload.metrics);
      setAthleteUsage(payload.athletes);
      setRecentSessions(payload.recentSessions);
      setPagination(payload.sessionPagination);
      setLoaded(true);
    })();
  }, [page]);

  const number = (value: number) => new Intl.NumberFormat("es-AR").format(value);
  const dateTime = (value: string) => new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  const operation = (value: string) => ({ coach_reply: "Respuesta de coach", goal_assistance: "Ayuda para objetivo", session_summary: "Resumen de sesión", weekly_journal_summary: "Resumen de bitácora" }[value] || "Operación de IA");
  const exportReport = async () => {
    if (!from || !to) { setError("Elegí una fecha inicial y una fecha final para exportar el reporte."); return; }
    setExporting(true); setError("");
    try {
      const { data } = await createBrowserSupabaseClient().auth.getSession();
      const response = await fetch(`/api/admin/metrics?export=csv&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { headers: { Authorization: `Bearer ${data.session?.access_token || ""}` } });
      if (!response.ok) { const payload = await response.json() as { error?: string }; throw new Error(payload.error || "No pudimos generar el reporte."); }
      const blob = await response.blob(); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `aksis-consumo-tokens-${from}-a-${to}.csv`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(link.href);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No pudimos generar el reporte."); }
    finally { setExporting(false); }
  };

  return <main className="admin-view admin-dashboard">
    <span>SUPERADMINISTRACIÓN · RESUMEN</span><h1>Panorama de Aksis</h1>
    <p>Uso, suscripciones y salud operativa de la plataforma. La telemetría no incluye texto de conversaciones ni contenido de bitácora.</p>
    {error && <p className="admin-error">{error}</p>}
    <section className="admin-metrics-grid">
      <article><small>ATLETAS ACTIVOS</small><strong>{loaded ? number(metrics.athletes) : "—"}</strong><p>Cuentas con acceso habilitado.</p></article>
      <article><small>SESIONES ESTE MES</small><strong>{loaded ? number(metrics.sessions) : "—"}</strong><p>Sesiones iniciadas desde el primer día del mes.</p></article>
      <article className="metric-warm"><small>TOKENS ESTE MES</small><strong>{loaded ? number(metrics.tokens) : "—"}</strong><p>Incluye diálogos, ayudas y resúmenes.</p></article>
      <article><small>COSTO ESTIMADO</small><strong>{loaded ? `US$ ${metrics.cost.toFixed(4)}` : "—"}</strong><p>Según las tarifas del modelo configurado.</p></article>
      <article><small>ERRORES DE IA</small><strong>{loaded ? number(metrics.errors) : "—"}</strong><p>Errores y timeouts registrados.</p></article>
      <article><small>PLANES ACTIVOS</small><strong>{loaded ? number(metrics.activePlans) : "—"}</strong><p>Paquetes disponibles para asignar.</p></article>
    </section>

    <section className="admin-usage-table">
      <header><div><small>TELEMETRÍA POR ATLETA · MES ACTUAL</small><h2>Consumo de tokens</h2></div><span>{athleteUsage.length} atletas con actividad</span></header>
      <div className="admin-usage-columns"><span>ATLETA</span><span>SESIONES</span><span>TOKENS IN</span><span>TOKENS OUT</span><span>TOTAL</span><span>COSTO</span></div>
      {athleteUsage.map((row) => <article key={row.athleteId}><strong>{row.displayName}</strong><span>{number(row.sessions)}</span><span>{number(row.inputTokens)}</span><span>{number(row.outputTokens)}</span><b>{number(row.totalTokens)}</b><span>US$ {row.costUsd.toFixed(4)}</span></article>)}
      {loaded && !athleteUsage.length && <p className="admin-usage-empty">Todavía no hay consumo de tokens registrado.</p>}
    </section>

    <section className="admin-usage-table admin-operation-table">
      <header><div><small>ÚLTIMAS OPERACIONES REGISTRADAS</small><h2>Consumo de tokens de IA</h2></div><span>Sin contenido conversacional</span></header>
      <div className="admin-token-tools">
        <div><label>Desde<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>Hasta<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label></div>
        <button type="button" className="admin-export-button" disabled={exporting} onClick={() => void exportReport()}>{exporting ? "Preparando…" : "↓ Exportar Excel"}</button>
      </div>
      <div className="admin-session-columns"><span>FECHA</span><span>ATLETA</span><span>OPERACIÓN</span><span>IN</span><span>OUT</span><span>TOTAL</span><span>ESTADO</span></div>
      {recentSessions.map((row, index) => <article key={`${row.sessionId || row.operation}-${row.createdAt}-${index}`}><time>{dateTime(row.createdAt)}</time><strong>{row.athleteName}</strong><span>{operation(row.operation)}</span><span>{number(row.inputTokens)}</span><span>{number(row.outputTokens)}</span><b>{number(row.totalTokens)}</b><span className={row.status === "completed" ? "usage-ok" : "usage-issue"}>{row.status}</span></article>)}
      {loaded && !recentSessions.length && <p className="admin-usage-empty">Todavía no hay operaciones de IA registradas.</p>}
      {loaded && pagination.total > 0 && <footer className="admin-pagination"><span>{(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} de {number(pagination.total)} registros</span><div><button type="button" disabled={pagination.page <= 1} onClick={() => setPage((current) => current - 1)}>← Anterior</button><b>Página {pagination.page} de {pagination.totalPages}</b><button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)}>Siguiente →</button></div></footer>}
    </section>

    <section className="admin-health-card"><div><small>SALUD DEL SERVICIO</small><h2>Monitoreo operativo</h2><p>El uptime requiere un monitor externo de producción. Estas métricas muestran únicamente actividad técnica autorizada.</p></div><span className="admin-status">Datos en tiempo real</span></section>
  </main>;
}

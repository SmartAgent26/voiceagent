"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type Metrics = { athletes: number; sessions: number; tokens: number; cost: number; errors: number; activePlans: number };
const empty: Metrics = { athletes: 0, sessions: 0, tokens: 0, cost: 0, errors: 0, activePlans: 0 };

export function AdminDashboard() {
  const [metrics, setMetrics] = useState<Metrics>(empty);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const client = createBrowserSupabaseClient();
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    void Promise.all([
      client.from("profiles").select("id", { count: "exact", head: true }).eq("role", "athlete").eq("account_status", "active"),
      client.from("coaching_sessions").select("id", { count: "exact", head: true }).gte("started_at", monthStart.toISOString()),
      client.from("ai_usage_events").select("total_tokens,estimated_cost_usd,status"),
      client.from("subscription_plans").select("id", { count: "exact", head: true }).eq("active", true),
    ]).then(([athletes, sessions, usage, plans]) => {
      const rows = usage.data || [];
      setMetrics({
        athletes: athletes.count || 0,
        sessions: sessions.count || 0,
        tokens: rows.reduce((sum, row) => sum + Number(row.total_tokens || 0), 0),
        cost: rows.reduce((sum, row) => sum + Number(row.estimated_cost_usd || 0), 0),
        errors: rows.filter((row) => row.status === "error" || row.status === "timeout").length,
        activePlans: plans.count || 0,
      });
      setLoaded(true);
    });
  }, []);
  const number = (value: number) => new Intl.NumberFormat("es-AR").format(value);
  return <main className="admin-view admin-dashboard">
    <span>SUPERADMINISTRACIÓN · RESUMEN</span><h1>Panorama de Aksis</h1>
    <p>Uso, suscripciones y salud operativa de la plataforma.</p>
    <section className="admin-metrics-grid">
      <article><small>ATLETAS ACTIVOS</small><strong>{loaded ? number(metrics.athletes) : "—"}</strong><p>Cuentas con acceso habilitado.</p></article>
      <article><small>SESIONES ESTE MES</small><strong>{loaded ? number(metrics.sessions) : "—"}</strong><p>Sesiones iniciadas desde el primer día del mes.</p></article>
      <article className="metric-warm"><small>TOKENS CONSUMIDOS</small><strong>{loaded ? number(metrics.tokens) : "—"}</strong><p>Entrada y salida registrados.</p></article>
      <article><small>COSTO ESTIMADO</small><strong>{loaded ? `US$ ${metrics.cost.toFixed(4)}` : "—"}</strong><p>Según las tarifas cargadas para el modelo.</p></article>
      <article><small>ERRORES DE IA</small><strong>{loaded ? number(metrics.errors) : "—"}</strong><p>Errores y timeouts registrados.</p></article>
      <article><small>PLANES ACTIVOS</small><strong>{loaded ? number(metrics.activePlans) : "—"}</strong><p>Paquetes disponibles para asignar.</p></article>
    </section>
    <section className="admin-health-card"><div><small>SALUD DEL SERVICIO</small><h2>Monitoreo operativo</h2><p>El uptime requiere un monitor externo de producción. En esta etapa, las métricas reflejan los datos persistidos por la plataforma.</p></div><span className="admin-status">Datos en tiempo real</span></section>
  </main>;
}

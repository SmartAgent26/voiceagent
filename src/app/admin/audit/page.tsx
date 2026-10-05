"use client";

import { useEffect, useMemo, useState } from "react";
import { useAksisToast } from "@/components/aksis-toast";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type AuditEvent = { id: string; actor_id: string | null; action: string; entity_type: string; entity_id: string | null; metadata: Record<string, unknown>; created_at: string };
type OperationalEvent = { id: number; event: string; request_id: string | null; route: string; outcome: "error" | "warning" | "info"; status: number | null; error_type: string | null; created_at: string };
type Actor = { id: string; display_name: string | null };
const PAGE_SIZE = 20;

function severity(event: AuditEvent) {
  const content = `${event.action} ${event.entity_type}`.toLowerCase();
  if (content.includes("error") || content.includes("failed") || content.includes("suspend")) return "error";
  if (content.includes("warning") || content.includes("cancel")) return "warning";
  if (content.includes("login") || content.includes("logout")) return "success";
  return "info";
}
function detail(event: AuditEvent) {
  const values = Object.entries(event.metadata || {}).slice(0, 2).map(([key, value]) => `${key}: ${String(value)}`);
  return values.join(" · ") || "Evento registrado por Aksis";
}

export default function Audit() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [actors, setActors] = useState<Record<string, string>>({});
  const [query, setQuery] = useState(""); const [filter, setFilter] = useState("all"); const [module, setModule] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true); const { showToast } = useAksisToast();

  async function load() {
    setLoading(true); const client = createBrowserSupabaseClient();
    const [{ data, error }, { data: operational, error: operationalError }] = await Promise.all([
      client.from("audit_log").select("id,actor_id,action,entity_type,entity_id,metadata,created_at").order("created_at", { ascending: false }).limit(200),
      client.from("operational_events").select("id,event,request_id,route,outcome,status,error_type,created_at").order("created_at", { ascending: false }).limit(200),
    ]);
    if (error || operationalError) { showToast("No pudimos cargar el registro de auditoría.", "error"); setLoading(false); return; }
    const auditRows = ((data || []) as Array<Omit<AuditEvent, "id"> & { id: number }>).map((event) => ({ ...event, id: `audit-${event.id}` }));
    const operationalRows = ((operational || []) as OperationalEvent[]).map((event) => ({ id: `operational-${event.id}`, actor_id: null, action: event.event, entity_type: "operación", entity_id: event.request_id, metadata: { resultado: event.outcome, estado: event.status ? `HTTP ${event.status}` : "sin estado", tipo: event.error_type || "sin detalle" }, created_at: event.created_at }));
    const rows = [...auditRows, ...operationalRows].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()); setEvents(rows);
    const ids = [...new Set(rows.map((row) => row.actor_id).filter(Boolean))] as string[];
    if (ids.length) { const { data: profiles } = await client.from("profiles").select("id,display_name").in("id", ids); setActors(Object.fromEntries(((profiles || []) as Actor[]).map((profile) => [profile.id, profile.display_name || "Usuario Aksis"]))); }
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  const modules = [...new Set(events.map((event) => event.entity_type))];
  const rows = useMemo(() => events.filter((event) => {
    const text = `${event.action} ${event.entity_type} ${actors[event.actor_id || ""] || ""} ${detail(event)}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (filter === "all" || severity(event) === filter) && (module === "all" || event.entity_type === module);
  }), [actors, events, filter, module, query]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const today = events.filter((event) => new Date(event.created_at).toDateString() === new Date().toDateString()).length;
  const alarms = events.filter((event) => severity(event) === "error" || severity(event) === "warning").length;
  const adminSessions = events.filter((event) => event.action === "admin_login").length;

  function exportCsv() {
    const content = [["Fecha UTC", "Severidad", "Evento", "Usuario", "Módulo", "Detalle"], ...rows.map((event) => [new Date(event.created_at).toISOString(), severity(event), event.action, actors[event.actor_id || ""] || "Sistema", event.entity_type, detail(event)])].map((line) => line.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "aksis-auditoria.csv"; anchor.click(); URL.revokeObjectURL(url); showToast("Exportación preparada en formato CSV.", "success");
  }

  return <main className="admin-view audit-view"><div className="audit-heading"><div><span>OPERACIÓN <i /> AUDITORÍA</span><h1>Registro de actividad</h1><p>Eventos administrativos y del sistema, con trazabilidad de accesos y operaciones.</p></div><div className="audit-heading-actions"><button className="secondary-button" onClick={() => void load()}>↻ Actualizar</button><button className="admin-primary-action" onClick={exportCsv}>⇩ Exportar CSV</button></div></div><section className="audit-metrics"><article><small>EVENTOS REGISTRADOS</small><strong>{loading ? "—" : events.length.toLocaleString("es-AR")}</strong><p>Últimos 200 eventos consultados.</p></article><article className={alarms ? "audit-warning" : ""}><small>ALARMAS DETECTADAS</small><strong>{loading ? "—" : alarms}</strong><p>{alarms ? "Revisá eventos de advertencia o error." : "No hay alertas registradas."}</p></article><article><small>SESIONES ADMIN</small><strong>{loading ? "—" : adminSessions}</strong><p>Ingresos administrativos registrados.</p></article><article><small>EVENTOS HOY</small><strong>{loading ? "—" : today}</strong><p>Datos según la zona horaria local.</p></article></section><section className="audit-filters"><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Buscar por usuario, evento o detalle…" /><select value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }}><option value="all">Todas las severidades</option><option value="success">Éxito / acceso</option><option value="warning">Advertencia</option><option value="error">Error</option><option value="info">Información</option></select><select value={module} onChange={(event) => { setModule(event.target.value); setPage(1); }}><option value="all">Módulo: todos</option>{modules.map((item) => <option key={item} value={item}>{item}</option>)}</select><button aria-label="Limpiar filtros" className="audit-clear" onClick={() => { setQuery(""); setFilter("all"); setModule("all"); setPage(1); }}>×</button></section><section className="audit-table"><header><span>Registros de seguridad y operación <b>{rows.length} visibles</b></span><small>Fechas en UTC</small></header><div className="audit-columns"><span>FECHA Y HORA</span><span>SEVERIDAD</span><span>EVENTO / ACCIÓN</span><span>USUARIO / SUJETO</span><span>MÓDULO</span><span>DETALLE</span></div>{pagedRows.map((event) => <article key={event.id}><time><b>{new Date(event.created_at).toLocaleDateString("es-AR")} {new Date(event.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</b><small>UTC {new Date(event.created_at).toISOString().slice(11, 16)}</small></time><span className={`audit-severity ${severity(event)}`}>● {severity(event) === "success" ? "Éxito" : severity(event) === "warning" ? "Advertencia" : severity(event) === "error" ? "Error" : "Info"}</span><div><b>{event.action}</b><small>{detail(event)}</small></div><div><b>{event.actor_id ? actors[event.actor_id] || "Usuario Aksis" : "Sistema / Aksis"}</b><small>{event.actor_id ? "Actor autenticado" : "Proceso interno"}</small></div><code>{event.entity_type}</code><small className="audit-detail">{event.entity_id || "Sin entidad específica"}</small></article>)}{!loading && !rows.length && <div className="audit-empty">No encontramos eventos con estos filtros.</div>}{rows.length > 0 && <footer className="audit-pagination"><span>{(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, rows.length)} de {rows.length} registros</span><div><button type="button" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>← Anterior</button><b>Página {safePage} de {totalPages}</b><button type="button" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>Siguiente →</button></div></footer>}</section></main>;
}

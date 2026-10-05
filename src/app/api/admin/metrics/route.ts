import { NextResponse } from "next/server";
import { getAuthenticatedAdminId } from "@/lib/agent/auth";
import { enforceRateLimit, rateLimitHeaders } from "@/lib/security/request-guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const SESSION_PAGE_SIZE = 10;
const MAX_EXPORT_ROWS = 50_000;

function dateRange(value: string | null, endOfDay = false) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function csvValue(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const adminId = await getAuthenticatedAdminId(request);
  const client = createServerSupabaseClient();
  if (!adminId || !client) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const userLimit = await enforceRateLimit(request, { scope: "admin-metrics", identity: adminId, limit: 30, windowMs: 60_000 });
  if (!userLimit.allowed) return NextResponse.json({ error: "Demasiadas consultas. Intentá nuevamente en un momento." }, { status: 429, headers: rateLimitHeaders(userLimit) });
  const url = new URL(request.url);
  const exportCsv = url.searchParams.get("export") === "csv";
  const from = dateRange(url.searchParams.get("from"));
  const to = dateRange(url.searchParams.get("to"), true);
  if (from === undefined || to === undefined || (from && to && from > to)) return NextResponse.json({ error: "El rango de fechas no es válido." }, { status: 400 });
  if (exportCsv) {
    if (!from || !to) return NextResponse.json({ error: "Elegí una fecha inicial y una fecha final para exportar." }, { status: 400 });
    const { data: rows, error } = await client.from("ai_usage_events")
      .select("athlete_id,session_id,operation,input_tokens,output_tokens,total_tokens,estimated_cost_usd,status,created_at")
      .gte("created_at", from.toISOString()).lte("created_at", to.toISOString())
      .order("created_at", { ascending: false }).limit(MAX_EXPORT_ROWS);
    if (error) return NextResponse.json({ error: "No pudimos preparar la exportación." }, { status: 500 });
    const athleteIds = [...new Set((rows || []).map((row) => row.athlete_id))];
    const { data: profiles, error: profilesError } = athleteIds.length
      ? await client.from("profiles").select("id,display_name").in("id", athleteIds)
      : { data: [], error: null };
    if (profilesError) return NextResponse.json({ error: "No pudimos asociar los atletas de la exportación." }, { status: 500 });
    const names = new Map((profiles || []).map((profile) => [profile.id, profile.display_name || "Atleta sin nombre"]));
    const lines = [
      ["Fecha", "Atleta", "Operación", "Tokens IN", "Tokens OUT", "Tokens totales", "Costo estimado USD", "Estado"].map(csvValue).join(","),
      ...(rows || []).map((row) => [row.created_at, names.get(row.athlete_id) || "Atleta sin nombre", row.operation, Number(row.input_tokens || 0), Number(row.output_tokens || 0), Number(row.total_tokens || 0), Number(row.estimated_cost_usd || 0), row.status].map(csvValue).join(",")),
    ];
    return new NextResponse(`\uFEFF${lines.join("\r\n")}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="aksis-consumo-tokens-${url.searchParams.get("from")}-a-${url.searchParams.get("to")}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }
  const requestedPage = Number(url.searchParams.get("page") || "1");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [athletes, sessions, plans, usage, sessionPage] = await Promise.all([
    client.from("profiles").select("id", { count: "exact", head: true }).eq("role", "athlete").eq("account_status", "active"),
    client.from("coaching_sessions").select("id", { count: "exact", head: true }).gte("started_at", monthStart.toISOString()),
    client.from("subscription_plans").select("id", { count: "exact", head: true }).eq("active", true),
    client.from("ai_usage_events").select("athlete_id,session_id,operation,input_tokens,output_tokens,total_tokens,estimated_cost_usd,status,created_at").gte("created_at", monthStart.toISOString()).order("created_at", { ascending: false }).limit(1000),
    client.from("ai_usage_events").select("athlete_id,session_id,operation,input_tokens,output_tokens,total_tokens,estimated_cost_usd,status,created_at", { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * SESSION_PAGE_SIZE, page * SESSION_PAGE_SIZE - 1),
  ]);

  if (athletes.error || sessions.error || plans.error || usage.error || sessionPage.error) {
    return NextResponse.json({ error: "No pudimos cargar la telemetría operativa." }, { status: 500 });
  }

  const usageRows = usage.data || [];
  const athleteIds = [...new Set([...usageRows, ...(sessionPage.data || [])].map((row) => row.athlete_id))];
  const { data: profiles, error: profilesError } = athleteIds.length
    ? await client.from("profiles").select("id,display_name").in("id", athleteIds)
    : { data: [], error: null };
  if (profilesError) return NextResponse.json({ error: "No pudimos asociar la telemetría de atletas." }, { status: 500 });

  const names = new Map((profiles || []).map((profile) => [profile.id, profile.display_name || "Atleta sin nombre"]));
  const byAthlete = new Map<string, { athleteId: string; displayName: string; inputTokens: number; outputTokens: number; totalTokens: number; costUsd: number; sessions: Set<string> }>();
  for (const row of usageRows) {
    const current = byAthlete.get(row.athlete_id) || {
      athleteId: row.athlete_id,
      displayName: names.get(row.athlete_id) || "Atleta sin nombre",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      sessions: new Set<string>(),
    };
    current.inputTokens += Number(row.input_tokens || 0);
    current.outputTokens += Number(row.output_tokens || 0);
    current.totalTokens += Number(row.total_tokens || 0);
    current.costUsd += Number(row.estimated_cost_usd || 0);
    if (row.session_id) current.sessions.add(row.session_id);
    byAthlete.set(row.athlete_id, current);
  }

  const totalTokens = usageRows.reduce((sum, row) => sum + Number(row.total_tokens || 0), 0);
  const totalCost = usageRows.reduce((sum, row) => sum + Number(row.estimated_cost_usd || 0), 0);
  const errors = usageRows.filter((row) => row.status === "error" || row.status === "timeout").length;

  return NextResponse.json({
    metrics: {
      athletes: athletes.count || 0,
      sessions: sessions.count || 0,
      tokens: totalTokens,
      cost: totalCost,
      errors,
      activePlans: plans.count || 0,
    },
    athletes: [...byAthlete.values()]
      .map(({ sessions: athleteSessions, ...row }) => ({ ...row, sessions: athleteSessions.size }))
      .sort((a, b) => b.totalTokens - a.totalTokens),
    recentSessions: (sessionPage.data || []).map((row) => ({
      athleteId: row.athlete_id,
      athleteName: names.get(row.athlete_id) || "Atleta sin nombre",
      sessionId: row.session_id,
      operation: row.operation || "coach_reply",
      inputTokens: Number(row.input_tokens || 0),
      outputTokens: Number(row.output_tokens || 0),
      totalTokens: Number(row.total_tokens || 0),
      costUsd: Number(row.estimated_cost_usd || 0),
      status: row.status,
      createdAt: row.created_at,
    })),
    sessionPagination: { page, pageSize: SESSION_PAGE_SIZE, total: sessionPage.count || 0, totalPages: Math.max(1, Math.ceil((sessionPage.count || 0) / SESSION_PAGE_SIZE)) },
  });
}

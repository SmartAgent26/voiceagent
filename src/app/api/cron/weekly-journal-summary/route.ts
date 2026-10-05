import { NextResponse } from "next/server";
import { createCompactSummaryWithUsage } from "@/lib/agent/coach";
import { enforceRateLimit, rateLimitHeaders } from "@/lib/security/request-guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasProcessingConsent } from "@/lib/privacy/processing-consents";
import { recordAiUsageEvent } from "@/lib/agent/usage";

function localDate(timezone: string, value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "01";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function subtractDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const requestLimit = await enforceRateLimit(request, { scope: "weekly-summary-cron", limit: 8, windowMs: 10 * 60_000 });
  if (!requestLimit.allowed) return NextResponse.json({ error: "Demasiadas ejecuciones programadas." }, { status: 429, headers: rateLimitHeaders(requestLimit) });
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const client = createServerSupabaseClient();
  if (!client) return NextResponse.json({ error: "Falta configuración de servidor." }, { status: 500 });
  const { data: athletes } = await client.from("profiles").select("id,timezone").eq("role", "athlete").eq("account_status", "active");
  let generated = 0;
  for (const athlete of athletes || []) {
    if (!await hasProcessingConsent(athlete.id, "weekly_journal_summary")) continue;
    const timezone = athlete.timezone || "America/Argentina/Buenos_Aires";
    const periodEnd = localDate(timezone);
    const periodStart = subtractDays(periodEnd, 7);
    const { data: existing } = await client.from("athlete_context_summaries").select("id").eq("athlete_id", athlete.id).eq("kind", "weekly_journal").eq("period_start", periodStart).maybeSingle();
    if (existing) continue;
    const lookback = new Date(); lookback.setUTCDate(lookback.getUTCDate() - 9);
    const { data: allEntries } = await client.from("journal_entries").select("title,content,mood,occurred_at").eq("athlete_id", athlete.id).gte("occurred_at", lookback.toISOString()).order("occurred_at");
    const entries = (allEntries || []).filter((entry) => { const date = localDate(timezone, new Date(entry.occurred_at)); return date >= periodStart && date < periodEnd; });
    if (!entries.length) continue;
    const source = entries.map((entry) => `${localDate(timezone, new Date(entry.occurred_at))} · ${entry.mood || "sin estado"}${entry.title ? ` · ${entry.title}` : ""}: ${entry.content}`).join("\n");
    const summaryResult = await createCompactSummaryWithUsage(source, "weekly_journal");
    const summary = summaryResult.summary;
    await recordAiUsageEvent({ athleteId: athlete.id, requestId: crypto.randomUUID(), provider: summaryResult.provider, model: summaryResult.model, operation: "weekly_journal_summary", usage: summaryResult.usage });
    if (!summary) continue;
    const { error } = await client.from("athlete_context_summaries").upsert({ athlete_id: athlete.id, kind: "weekly_journal", period_start: periodStart, period_end: periodEnd, content: summary, source_count: entries.length }, { onConflict: "athlete_id,kind,period_start", ignoreDuplicates: true });
    if (!error) generated++;
  }
  return NextResponse.json({ ok: true, generated });
}

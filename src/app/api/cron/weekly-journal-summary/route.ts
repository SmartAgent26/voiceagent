import { NextResponse } from "next/server";
import { createCompactSummary } from "@/lib/agent/coach";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const client = createServerSupabaseClient();
  if (!client) return NextResponse.json({ error: "Falta configuración de servidor." }, { status: 500 });
  const end = new Date(); end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 7);
  const periodStart = start.toISOString().slice(0, 10); const periodEnd = end.toISOString().slice(0, 10);
  const { data: athletes } = await client.from("profiles").select("id").eq("role", "athlete").eq("account_status", "active");
  let generated = 0;
  for (const athlete of athletes || []) {
    const { data: existing } = await client.from("athlete_context_summaries").select("id").eq("athlete_id", athlete.id).eq("kind", "weekly_journal").eq("period_start", periodStart).maybeSingle();
    if (existing) continue;
    const { data: entries } = await client.from("journal_entries").select("title,content,mood,occurred_at").eq("athlete_id", athlete.id).gte("occurred_at", start.toISOString()).lt("occurred_at", end.toISOString()).order("occurred_at");
    if (!entries?.length) continue;
    const source = entries.map((entry) => `${entry.occurred_at.slice(0, 10)} · ${entry.mood || "sin estado"}${entry.title ? ` · ${entry.title}` : ""}: ${entry.content}`).join("\n");
    const summary = await createCompactSummary(source, "weekly_journal");
    if (!summary) continue;
    await client.from("athlete_context_summaries").insert({ athlete_id: athlete.id, kind: "weekly_journal", period_start: periodStart, period_end: periodEnd, content: summary, source_count: entries.length });
    generated++;
  }
  return NextResponse.json({ ok: true, generated, periodStart, periodEnd });
}

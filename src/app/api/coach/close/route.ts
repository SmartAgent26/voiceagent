import { NextResponse } from "next/server";
import { z } from "zod";
import { createCompactSummary, separateSummaryFocus } from "@/lib/agent/coach";
import { getAuthenticatedAthleteId } from "@/lib/agent/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({ sessionId: z.string().uuid() });
export async function POST(request: Request) {
  try {
    const { sessionId } = schema.parse(await request.json());
    const athleteId = await getAuthenticatedAthleteId(request);
    const client = createServerSupabaseClient();
    if (!athleteId || !client) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    const { data: session } = await client.from("coaching_sessions").select("id,started_at").eq("id", sessionId).eq("athlete_id", athleteId).eq("status", "active").maybeSingle();
    if (!session) return NextResponse.json({ error: "La sesión ya no está disponible." }, { status: 404 });
    const { data: messages } = await client.from("session_messages").select("sender,content,created_at").eq("session_id", sessionId).order("created_at");
    const turns = messages || [];
    const hasAthleteMessage = turns.some((message) => message.sender === "athlete");
    const hasCoachReply = turns.some((message) => message.sender === "assistant");

    // The chat creates a session on entry. Keep it only if it became a real exchange.
    if (!hasAthleteMessage || !hasCoachReply) {
      const { error: deleteError } = await client.from("coaching_sessions").delete().eq("id", sessionId).eq("athlete_id", athleteId);
      if (deleteError) return NextResponse.json({ error: "No pudimos descartar la sesión vacía." }, { status: 500 });
      return NextResponse.json({ ok: true, discarded: true });
    }

    const transcript = turns.map((message) => `${message.sender === "assistant" ? "Coach" : "Deportista"}: ${message.content}`).join("\n");
    const generatedSummary = await createCompactSummary(transcript, "session");
    const { summary, focus } = separateSummaryFocus(generatedSummary);
    const now = new Date();
    await client.from("coaching_sessions").update({ status: "closed", ended_at: now.toISOString(), duration_seconds: Math.max(0, Math.round((now.getTime() - new Date(session.started_at).getTime()) / 1000)), context_summary: summary || null }).eq("id", sessionId);
    if (summary) await client.from("athlete_context_summaries").insert({ athlete_id: athleteId, kind: "session", content: summary, source_count: turns.length });
    if (focus) await client.from("athlete_conversation_focus").upsert({ athlete_id: athleteId, topic: focus.slice(0, 500), source_session_id: sessionId, is_active: true, set_at: now.toISOString(), closed_at: null });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "No fue posible cerrar la sesión." }, { status: 400 }); }
}

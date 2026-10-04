import { NextResponse } from "next/server";
import { z } from "zod";
import { createCoachReply } from "@/lib/agent/coach";
import { buildAthleteContext } from "@/lib/agent/athlete-context";
import { getAuthenticatedAthleteId } from "@/lib/agent/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  history: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().trim().min(1).max(4_000),
    }),
  ).min(1).max(100),
  sessionId: z.string().uuid().optional(),
});
const BLOCK_SECONDS = 15 * 60;

function wantsToClose(message: string) {
  return /(me\s+(tengo que|debo)\s+(ir|salir)|me\s+voy|tengo que\s+(cortar|salir)|quiero\s+(cerrar|terminar|dejar)\s+(la\s+)?(conversaci[oó]n|sesi[oó]n)|podemos\s+retomar|seguimos?\s+(otro\s+d[ií]a|m[aá]s\s+tarde|ma[nñ]ana)|hasta\s+(luego|pronto|ma[nñ]ana))/i.test(message);
}

function firstName(value: string | undefined) {
  const name = value?.trim();
  return name && name !== "el deportista" ? name.split(/\s+/)[0] : "";
}

function wantsToReleaseFocus(message: string) {
  return /(no\s+quiero\s+(hablar|seguir|volver)\s+(m[aá]s\s+)?(de\s+)?(esto|eso|ese\s+tema)|dejemos\s+(esto|eso|ese\s+tema)|cambiemos\s+de\s+tema|ya\s+no\s+quiero\s+trabajar\s+eso)/i.test(message);
}

export async function POST(request: Request) {
  try {
    const payload = requestSchema.parse(await request.json());
    const athleteId = await getAuthenticatedAthleteId(request);
    if (!athleteId) return NextResponse.json({ error: "Tu sesión no es válida o el acceso está suspendido." }, { status: 401 });
    const client = createServerSupabaseClient();
    if (!client) throw new Error("No hay configuración de servidor para Supabase.");
    let blocksRemaining: number | null = null;
    if (payload.sessionId) {
      const { data: session } = await client.from("coaching_sessions").select("id,started_at,blocks_charged").eq("id", payload.sessionId).eq("athlete_id", athleteId).eq("status", "active").maybeSingle();
      if (!session) return NextResponse.json({ error: "La sesión de coaching no está disponible." }, { status: 404 });
      const requiredBlocks = Math.floor(Math.max(0, Date.now() - new Date(session.started_at).getTime()) / 1_000 / BLOCK_SECONDS) + 1;
      const additionalBlocks = Math.max(0, requiredBlocks - session.blocks_charged);
      const { data: subscription } = await client.from("user_subscriptions").select("id,blocks_available,blocks_used").eq("user_id", athleteId).maybeSingle();
      if (!subscription || subscription.blocks_available < additionalBlocks) return NextResponse.json({ error: "No te quedan bloques disponibles para continuar esta sesión.", blocksRequired: additionalBlocks, blocksAvailable: subscription?.blocks_available || 0 }, { status: 402 });
      if (additionalBlocks > 0) {
        blocksRemaining = subscription.blocks_available - additionalBlocks;
        await Promise.all([
          client.from("user_subscriptions").update({ blocks_available: blocksRemaining, blocks_used: subscription.blocks_used + additionalBlocks }).eq("id", subscription.id),
          client.from("coaching_sessions").update({ blocks_charged: requiredBlocks }).eq("id", session.id),
          client.from("billing_events").insert({ user_id: athleteId, subscription_id: subscription.id, event_type: "session_blocks", amount_ars: 0, status: "completed", metadata: { session_id: session.id, blocks: additionalBlocks, simulated: true } }),
        ]);
      } else blocksRemaining = subscription.blocks_available;
    }
    const recentHistory = payload.history.slice(-20);
    const lastUserMessage = [...recentHistory].reverse().find((turn) => turn.role === "user");
    if (lastUserMessage && wantsToReleaseFocus(lastUserMessage.content)) await client.from("athlete_conversation_focus").update({ is_active: false, closed_at: new Date().toISOString() }).eq("athlete_id", athleteId).eq("is_active", true);
    const athleteContext = await buildAthleteContext(athleteId);
    const asksForGoals = Boolean(lastUserMessage && /objetiv[\s\S]{0,90}(record|recuerda|cu[aá]l|cuales|cu[aá]les|ten[eé]s|son)/i.test(lastUserMessage.content));
    const knownGoals = athleteContext.variables.objetivos && athleteContext.variables.objetivos !== "no informados";
    const athleteName = firstName(athleteContext.variables.nombre);
    const reply = lastUserMessage && wantsToClose(lastUserMessage.content)
      ? { content: `Claro${athleteName ? `, ${athleteName}` : ""}. Gracias por compartir este momento. Podemos retomar cuando quieras, desde donde lo dejamos. Que tengas un buen día.`, model: "cierre-de-sesión", provider: "aksis", usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } }
      : asksForGoals && knownGoals
      ? { content: `Claro. Estos son los objetivos que hoy tenemos presentes:\n\n${athleteContext.variables.objetivos.split(" · ").map((goal) => `- ${goal}`).join("\n")}\n\n¿Cuál sentís que está pidiendo más atención en este momento?`, model: "perfil-actualizado", provider: "aksis", usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } }
      : await createCoachReply(recentHistory, athleteContext.context, athleteContext.variables);
    if (payload.sessionId) {
      if (lastUserMessage) await client.from("session_messages").insert({ session_id: payload.sessionId, sender: "athlete", content: lastUserMessage.content });
      await client.from("session_messages").insert({ session_id: payload.sessionId, sender: "assistant", content: reply.content, model: reply.model });
      await client.from("ai_usage_events").insert({ athlete_id: athleteId, session_id: payload.sessionId, provider: reply.provider, model: reply.model, status: "completed", input_tokens: reply.usage.inputTokens, output_tokens: reply.usage.outputTokens, total_tokens: reply.usage.totalTokens });
    }
    return NextResponse.json({ ...reply, blocksRemaining });
  } catch (error) {
    if (!(error instanceof z.ZodError)) console.error("Coach request failed", error);
    const message = error instanceof z.ZodError
      ? "El mensaje no tiene un formato válido."
      : "No fue posible conectar con el agente. Intentá nuevamente.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

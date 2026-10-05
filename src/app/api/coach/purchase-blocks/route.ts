import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedAthleteId } from "@/lib/agent/auth";
import { enforceRateLimit, parseJsonBody, rateLimitHeaders, RequestBodyTooLargeError } from "@/lib/security/request-guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({ blocks: z.number().int().min(1).max(20), requestId: z.string().uuid() });
export async function POST(request: Request) {
  try {
    const ipLimit = await enforceRateLimit(request, { scope: "simulated-purchase-ip", limit: 8, windowMs: 60_000 });
    if (!ipLimit.allowed) return NextResponse.json({ error: "Demasiadas solicitudes. Intentá nuevamente en un momento." }, { status: 429, headers: rateLimitHeaders(ipLimit) });
    const { blocks, requestId } = await parseJsonBody(request, schema, 2_000);
    const athleteId = await getAuthenticatedAthleteId(request);
    const client = createServerSupabaseClient();
    if (!athleteId || !client) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    const userLimit = await enforceRateLimit(request, { scope: "simulated-purchase-user", identity: athleteId, limit: 3, windowMs: 60 * 60_000 });
    if (!userLimit.allowed) return NextResponse.json({ error: "Alcanzaste el límite de cargas simuladas. Intentá nuevamente más tarde." }, { status: 429, headers: rateLimitHeaders(userLimit) });
    const { data: blocksRemaining, error } = await client.rpc("grant_simulated_blocks", {
      p_athlete_id: athleteId,
      p_blocks: blocks,
      p_request_id: requestId,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, blocksAdded: blocks, blocksRemaining });
  } catch (error) { return NextResponse.json({ error: error instanceof RequestBodyTooLargeError ? error.message : "No pudimos sumar bloques simulados." }, { status: error instanceof RequestBodyTooLargeError ? 413 : 400 }); }
}

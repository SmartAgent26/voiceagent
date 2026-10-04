import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedAthleteId } from "@/lib/agent/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({ blocks: z.number().int().min(1).max(20) });
export async function POST(request: Request) {
  try {
    const { blocks } = schema.parse(await request.json());
    const athleteId = await getAuthenticatedAthleteId(request);
    const client = createServerSupabaseClient();
    if (!athleteId || !client) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    const { data: current } = await client.from("user_subscriptions").select("id,blocks_available").eq("user_id", athleteId).maybeSingle();
    let subscriptionId = current?.id;
    if (current) await client.from("user_subscriptions").update({ blocks_available: current.blocks_available + blocks, status: "active" }).eq("id", current.id);
    else { const { data: created, error } = await client.from("user_subscriptions").insert({ user_id: athleteId, blocks_available: blocks, blocks_used: 0, status: "active" }).select("id").single(); if (error) throw error; subscriptionId = created.id; }
    await Promise.all([client.from("simulated_block_purchases").insert({ user_id: athleteId, blocks }), client.from("billing_events").insert({ user_id: athleteId, subscription_id: subscriptionId, event_type: "simulated_block_purchase", amount_ars: 0, status: "completed", metadata: { blocks, simulated: true } })]);
    return NextResponse.json({ ok: true, blocksAdded: blocks, blocksRemaining: (current?.blocks_available || 0) + blocks });
  } catch { return NextResponse.json({ error: "No pudimos sumar bloques simulados." }, { status: 400 }); }
}

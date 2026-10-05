import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedAdminId } from "@/lib/agent/auth";
import { enforceRateLimit, parseJsonBody, rateLimitHeaders } from "@/lib/security/request-guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const updateSchema = z.object({ id: z.string().uuid(), status: z.enum(["in_review", "completed", "rejected"]), resolutionNote: z.string().trim().max(1200) });

export async function GET(request: Request) {
  const adminId = await getAuthenticatedAdminId(request);
  const client = createServerSupabaseClient();
  if (!adminId || !client) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const limit = await enforceRateLimit(request, { scope: "admin-privacy-requests-read", identity: adminId, limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return NextResponse.json({ error: "Demasiadas consultas." }, { status: 429, headers: rateLimitHeaders(limit) });
  const { data: requests, error } = await client.from("data_subject_requests").select("id,user_id,request_type,status,details,requested_at,resolved_at,resolution_note").order("requested_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: "No pudimos cargar las solicitudes." }, { status: 500 });
  const userIds = [...new Set((requests || []).map((item) => item.user_id))];
  const { data: profiles, error: profilesError } = userIds.length ? await client.from("profiles").select("id,display_name").in("id", userIds) : { data: [], error: null };
  if (profilesError) return NextResponse.json({ error: "No pudimos asociar las solicitudes." }, { status: 500 });
  const names = new Map((profiles || []).map((profile) => [profile.id, profile.display_name || "Usuario Aksis"]));
  return NextResponse.json({ requests: (requests || []).map((item) => ({ ...item, userName: names.get(item.user_id) || "Usuario Aksis" })) });
}

export async function PATCH(request: Request) {
  try {
    const adminId = await getAuthenticatedAdminId(request);
    const client = createServerSupabaseClient();
    if (!adminId || !client) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    const limit = await enforceRateLimit(request, { scope: "admin-privacy-requests-write", identity: adminId, limit: 15, windowMs: 60_000 });
    if (!limit.allowed) return NextResponse.json({ error: "Demasiadas modificaciones." }, { status: 429, headers: rateLimitHeaders(limit) });
    const update = await parseJsonBody(request, updateSchema, 3_000);
    const resolved = update.status === "completed" || update.status === "rejected";
    const { error } = await client.from("data_subject_requests").update({ status: update.status, resolution_note: update.resolutionNote || null, resolved_at: resolved ? new Date().toISOString() : null, resolved_by: resolved ? adminId : null }).eq("id", update.id);
    if (error) throw error;
    const { error: auditError } = await client.from("audit_log").insert({ actor_id: adminId, action: "privacy_request.update", entity_type: "data_subject_request", entity_id: update.id, metadata: { status: update.status } });
    if (auditError) throw auditError;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No pudimos actualizar la solicitud." }, { status: 400 });
  }
}

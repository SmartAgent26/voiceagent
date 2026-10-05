import { NextResponse } from "next/server";
import { getAuthenticatedAthleteId } from "@/lib/agent/auth";
import { sanitizeJournalImage, validateImageBytes } from "@/lib/security/image-validation";
import { enforceRateLimit, rateLimitHeaders } from "@/lib/security/request-guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const MAX_MULTIPART_BYTES = 5_500_000;

export async function POST(request: Request) {
  try {
    const athleteId = await getAuthenticatedAthleteId(request); const client = createServerSupabaseClient();
    if (!athleteId || !client) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    const limit = await enforceRateLimit(request, { scope: "profile-avatar", identity: athleteId, limit: 8, windowMs: 60_000 });
    if (!limit.allowed) return NextResponse.json({ error: "Demasiadas cargas. Esperá un momento." }, { status: 429, headers: rateLimitHeaders(limit) });
    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_MULTIPART_BYTES) return NextResponse.json({ error: "La imagen debe pesar hasta 5 MB." }, { status: 413 });
    const form = await request.formData(); const file = form.get("avatar");
    if (!(file instanceof File)) return NextResponse.json({ error: "Elegí una imagen para subir." }, { status: 400 });
    const raw = new Uint8Array(await file.arrayBuffer()); validateImageBytes(raw);
    const image = await sanitizeJournalImage(raw); const path = `${athleteId}/profile.webp`;
    const { error: uploadError } = await client.storage.from("avatars").upload(path, image.bytes, { upsert: true, contentType: image.mimeType });
    if (uploadError) throw uploadError;
    const { error: profileError } = await client.from("profiles").update({ avatar_path: path }).eq("id", athleteId);
    if (profileError) throw profileError;
    return NextResponse.json({ ok: true, path });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No pudimos procesar la imagen." }, { status: 400 }); }
}

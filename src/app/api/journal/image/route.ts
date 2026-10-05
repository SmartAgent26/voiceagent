import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedAthleteId } from "@/lib/agent/auth";
import { sanitizeJournalImage, validateImageBytes } from "@/lib/security/image-validation";
import { enforceRateLimit, rateLimitHeaders } from "@/lib/security/request-guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const MAX_MULTIPART_BYTES = 5_500_000;

export async function POST(request: Request) {
  try {
    const athleteId = await getAuthenticatedAthleteId(request);
    const client = createServerSupabaseClient();
    if (!athleteId || !client) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    const limit = await enforceRateLimit(request, { scope: "journal-image", identity: athleteId, limit: 12, windowMs: 60_000 });
    if (!limit.allowed) return NextResponse.json({ error: "Demasiadas cargas. Esperá un momento antes de intentar nuevamente." }, { status: 429, headers: rateLimitHeaders(limit) });
    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_MULTIPART_BYTES) return NextResponse.json({ error: "La imagen debe pesar hasta 5 MB." }, { status: 413 });
    const form = await request.formData();
    const entryId = z.string().uuid().parse(form.get("entryId"));
    const file = form.get("image");
    if (!(file instanceof File)) return NextResponse.json({ error: "Elegí una imagen para subir." }, { status: 400 });
    const { data: entry } = await client.from("journal_entries").select("id").eq("id", entryId).eq("athlete_id", athleteId).maybeSingle();
    if (!entry) return NextResponse.json({ error: "El registro no está disponible." }, { status: 404 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    validateImageBytes(bytes);
    const image = await sanitizeJournalImage(bytes);
    const path = `${athleteId}/${entryId}.${image.extension}`;
    const { error: uploadError } = await client.storage.from("journal-media").upload(path, image.bytes, { upsert: true, contentType: image.mimeType });
    if (uploadError) throw uploadError;
    const { error: metadataError } = await client.from("journal_media").upsert({ journal_entry_id: entryId, athlete_id: athleteId, storage_path: path, mime_type: image.mimeType, byte_size: image.bytes.byteLength }, { onConflict: "storage_path" });
    if (metadataError) throw metadataError;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No pudimos subir la imagen." }, { status: 400 });
  }
}

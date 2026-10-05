import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedAdminId } from "@/lib/agent/auth";
import { encryptCredential, getProviderApiKey, type AgentProvider } from "@/lib/agent/credentials";
import { enforceRateLimit, parseJsonBody, rateLimitHeaders, RequestBodyTooLargeError } from "@/lib/security/request-guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const providerSchema = z.enum(["gemini", "openai", "openrouter"]);
const saveSchema = z.object({ provider: providerSchema, apiKey: z.string().trim().min(8).max(1000) });

async function modelsFor(provider: AgentProvider) {
  const apiKey = await getProviderApiKey(provider);
  if (!apiKey) throw new Error("No hay una clave configurada para este proveedor.");
  if (provider === "gemini") {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models", { headers: { "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error("No fue posible consultar Gemini.");
    const body = await response.json() as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> };
    return (body.models || []).filter((model) => model.supportedGenerationMethods?.includes("generateContent")).map((model) => model.name?.replace("models/", "") || "").filter(Boolean).sort();
  }
  const response = await fetch(provider === "openai" ? "https://api.openai.com/v1/models" : "https://openrouter.ai/api/v1/models", { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`No fue posible consultar ${provider === "openai" ? "OpenAI" : "OpenRouter"}.`);
  const body = await response.json() as { data?: Array<{ id?: string }> };
  return (body.data || []).map((model) => model.id || "").filter((id) => id && (provider === "openrouter" || id.startsWith("gpt-"))).sort();
}

export async function GET(request: Request) {
  const adminId = await getAuthenticatedAdminId(request);
  const provider = providerSchema.safeParse(new URL(request.url).searchParams.get("provider"));
  if (!adminId) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const userLimit = await enforceRateLimit(request, { scope: "admin-provider-read", identity: adminId, limit: 20, windowMs: 60_000 });
  if (!userLimit.allowed) return NextResponse.json({ error: "Demasiadas consultas de modelos. Intentá nuevamente en un momento." }, { status: 429, headers: rateLimitHeaders(userLimit) });
  if (!provider.success) return NextResponse.json({ error: "Proveedor inválido." }, { status: 400 });
  try { return NextResponse.json({ models: await modelsFor(provider.data), configured: true }); }
  catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible consultar los modelos.";
    if (message.includes("No hay una clave privada") || message.includes("AGENT_CREDENTIALS_ENCRYPTION_KEY_V1")) return NextResponse.json({ models: [], configured: false });
    return NextResponse.json({ error: message, configured: false }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  const adminId = await getAuthenticatedAdminId(request);
  if (!adminId) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const userLimit = await enforceRateLimit(request, { scope: "admin-provider-write", identity: adminId, limit: 5, windowMs: 60 * 60_000 });
    if (!userLimit.allowed) return NextResponse.json({ error: "Alcanzaste el límite de cambios de credenciales. Intentá nuevamente más tarde." }, { status: 429, headers: rateLimitHeaders(userLimit) });
    const { provider, apiKey } = await parseJsonBody(request, saveSchema, 4_000);
    const client = createServerSupabaseClient(); if (!client) throw new Error("Falta configuración del servidor.");
    const { error: saveError } = await client.from("agent_provider_credentials").upsert({ provider, ...encryptCredential(apiKey), updated_by: adminId });
    if (saveError) throw saveError;
    return NextResponse.json({ ok: true, models: await modelsFor(provider) });
  } catch (error) { return NextResponse.json({ error: error instanceof RequestBodyTooLargeError ? error.message : error instanceof Error ? error.message : "No fue posible guardar la clave." }, { status: error instanceof RequestBodyTooLargeError ? 413 : 400 }); }
}

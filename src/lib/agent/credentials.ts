import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AgentProvider = "gemini" | "openai" | "openrouter";
type SecretRow = { encrypted_secret: string; iv: string; auth_tag: string };

function key() {
  const secret = process.env.AGENT_CONFIG_ENCRYPTION_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("Falta una clave privada de cifrado en el servidor.");
  return createHash("sha256").update(secret).digest();
}
export function encryptCredential(value: string) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(), iv);
  return { encrypted_secret: Buffer.concat([cipher.update(value, "utf8"), cipher.final()]).toString("base64"), iv: iv.toString("base64"), auth_tag: cipher.getAuthTag().toString("base64") };
}
function decryptCredential(row: SecretRow) {
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(row.iv, "base64"));
  decipher.setAuthTag(Buffer.from(row.auth_tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(row.encrypted_secret, "base64")), decipher.final()]).toString("utf8");
}
export async function getProviderApiKey(provider: AgentProvider) {
  const client = createServerSupabaseClient();
  if (client) {
    const { data } = await client.from("agent_provider_credentials").select("encrypted_secret,iv,auth_tag").eq("provider", provider).maybeSingle();
    if (data) return decryptCredential(data as SecretRow);
  }
  return provider === "gemini" ? process.env.GEMINI_API_KEY : provider === "openrouter" ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY;
}

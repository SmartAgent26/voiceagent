import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AgentProvider = "gemini" | "openai" | "openrouter";
type SecretRow = { encrypted_secret: string; iv: string; auth_tag: string; key_version?: string };

function key(version = "v1") {
  if (version !== "v1") throw new Error("La versión de cifrado de la credencial no es compatible.");
  const secret = process.env.AGENT_CREDENTIALS_ENCRYPTION_KEY_V1;
  if (!secret) throw new Error("Falta AGENT_CREDENTIALS_ENCRYPTION_KEY_V1 en el servidor.");
  return createHash("sha256").update(secret).digest();
}
export function encryptCredential(value: string) {
  const keyVersion = "v1"; const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(keyVersion), iv);
  return { encrypted_secret: Buffer.concat([cipher.update(value, "utf8"), cipher.final()]).toString("base64"), iv: iv.toString("base64"), auth_tag: cipher.getAuthTag().toString("base64"), key_version: keyVersion };
}
function decryptCredential(row: SecretRow) {
  const decipher = createDecipheriv("aes-256-gcm", key(row.key_version || "v1"), Buffer.from(row.iv, "base64"));
  decipher.setAuthTag(Buffer.from(row.auth_tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(row.encrypted_secret, "base64")), decipher.final()]).toString("utf8");
}
export async function getProviderApiKey(provider: AgentProvider) {
  const client = createServerSupabaseClient();
  if (client) {
    const { data } = await client.from("agent_provider_credentials").select("encrypted_secret,iv,auth_tag,key_version").eq("provider", provider).maybeSingle();
    if (data) return decryptCredential(data as SecretRow);
  }
  return provider === "gemini" ? process.env.GEMINI_API_KEY : provider === "openrouter" ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY;
}

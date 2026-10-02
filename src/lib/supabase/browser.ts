import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient<any> | undefined;

export function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Falta la configuración pública de Supabase.");
  if (!browserClient) browserClient = createClient(url, key);
  return browserClient;
}

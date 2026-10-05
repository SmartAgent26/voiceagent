"use client";

import { useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

const options = [
  ["export", "Exportar mis datos"],
  ["rectification", "Rectificar mis datos"],
  ["erasure", "Solicitar eliminación"],
  ["withdraw_consent", "Retirar consentimientos"],
] as const;

export function PrivacyRights() {
  const [type, setType] = useState<(typeof options)[number][0]>("export");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setStatus("Enviando…");
    const client = createBrowserSupabaseClient();
    const { error } = await client.rpc("request_data_subject_right", { p_request_type: type, p_details: details });
    setStatus(error ? "No pudimos registrar la solicitud." : "Solicitud registrada. Te contactaremos por el canal asociado a tu cuenta.");
    if (!error) setDetails("");
  }
  return <main className="legal-page"><section className="legal-shell"><Link href="/app">← Volver a Mi Espacio</Link><p className="eyebrow">PRIVACIDAD Y CONTROL</p><h1>Tus datos, tus decisiones.</h1><p>Podés solicitar una acción sobre tus datos. La solicitud será revisada de forma segura; no eliminamos información automáticamente para proteger tu cuenta y obligaciones legales.</p><form className="consent-card" onSubmit={submit}><label>Solicitud<select value={type} onChange={event => setType(event.target.value as typeof type)}>{options.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Detalle opcional<textarea value={details} maxLength={1200} onChange={event => setDetails(event.target.value)} placeholder="Contanos qué necesitás revisar…" /></label><button className="auth-submit">Enviar solicitud</button>{status && <p>{status}</p>}</form></section></main>;
}

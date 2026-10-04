"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { ontologicalCoachPrompt } from "@/lib/agent/ontological-prompt";
import { useAksisToast } from "@/components/aksis-toast";
import { AgentQuestionLibrary } from "@/components/agent-question-library";

type Provider = "gemini" | "openai" | "openrouter";
type Configuration = { id:string; provider:Provider; model:string; system_prompt:string; input_price_per_million_usd:number; output_price_per_million_usd:number };
const defaultPrompt = ontologicalCoachPrompt;

function inlineMarkdown(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => part.startsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : part);
}
function PromptPreview({ content }: { content: string }) {
  return <div className="prompt-preview" aria-label="Vista previa del prompt">{content.split("\n").map((line, index) => {
    if (!line.trim()) return <div className="prompt-gap" key={index} />;
    if (line.startsWith("### ")) return <h4 key={index}>{inlineMarkdown(line.slice(4))}</h4>;
    if (line.startsWith("## ")) return <h3 key={index}>{inlineMarkdown(line.slice(3))}</h3>;
    if (line.startsWith("# ")) return <h2 key={index}>{inlineMarkdown(line.slice(2))}</h2>;
    if (line.startsWith("- ")) return <p className="prompt-bullet" key={index}>{inlineMarkdown(line.slice(2))}</p>;
    return <p key={index}>{inlineMarkdown(line)}</p>;
  })}</div>;
}

export default function AgentAdminPage() {
  const client = createBrowserSupabaseClient();
  const [config, setConfig] = useState<Configuration | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [loadingModels, setLoadingModels] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [promptView, setPromptView] = useState<"edit" | "preview">("edit");
  const [notice, setNotice] = useState("");
  const { showToast } = useAksisToast();
  const value = config || { id:"", provider:"gemini" as Provider, model:"", system_prompt:defaultPrompt, input_price_per_million_usd:0, output_price_per_million_usd:0 };
  function set<K extends keyof typeof value>(key: K, next: (typeof value)[K]) { setConfig({ ...value, [key]: next } as Configuration); }
  useEffect(() => { if (!notice) return; showToast(notice, notice.startsWith("No") || notice.startsWith("Elegí") || notice.startsWith("Agregá") ? "error" : "success"); setNotice(""); }, [notice, showToast]);
  async function token() { const { data } = await client.auth.getSession(); return data.session?.access_token || ""; }
  async function loadModels(provider: Provider) { setLoadingModels(true); setNotice(""); const response = await fetch(`/api/admin/agent/provider?provider=${provider}`, { headers: { Authorization: `Bearer ${await token()}` } }); const payload = await response.json(); if (!response.ok) { setModels([]); setNotice(payload.error || "Agregá una API válida para consultar los modelos."); } else { const next = payload.models as string[]; setModels(next); setConfig((current) => { const base = current || value; return { ...base, provider, model: next.includes(base.model) ? base.model : next[0] || "" } as Configuration; }); } setLoadingModels(false); }
  useEffect(() => { void client.from("agent_configurations").select("*").eq("is_active", true).maybeSingle().then(({ data }) => { const next = data as Configuration | null; setConfig(next); if (next) void loadModels(next.provider); else void loadModels("gemini"); }); }, []);
  async function saveKey() { if (!apiKey.trim()) return; setSavingKey(true); setNotice(""); const response = await fetch("/api/admin/agent/provider", { method:"PUT", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${await token()}` }, body:JSON.stringify({ provider:value.provider, apiKey }) }); const payload = await response.json(); if (!response.ok) setNotice(payload.error || "No se pudo guardar la API."); else { setApiKey(""); setModels(payload.models || []); setConfig({ ...value, model: payload.models?.includes(value.model) ? value.model : payload.models?.[0] || "" } as Configuration); setNotice("API guardada de forma cifrada. Elegí el modelo que vas a usar."); } setSavingKey(false); }
  async function save(event: FormEvent) { event.preventDefault(); if (!value.model) { setNotice("Elegí un modelo antes de guardar."); return; } setSaving(true); setNotice(""); const payload = { provider:value.provider, model:value.model, system_prompt:value.system_prompt, input_price_per_million_usd:Number(value.input_price_per_million_usd) || 0, output_price_per_million_usd:Number(value.output_price_per_million_usd) || 0, is_active:true }; const result = value.id ? await client.from("agent_configurations").update(payload).eq("id", value.id).select().single() : await client.from("agent_configurations").insert(payload).select().single(); if (result.error) setNotice(`No se pudo guardar: ${result.error.message}`); else { setConfig(result.data as Configuration); await client.from("agent_prompt_versions").insert({ configuration_id:result.data.id, prompt:value.system_prompt }); setNotice("Configuración del agente guardada."); } setSaving(false); }
  return <main className="admin-view agent-view"><span>AGENTE DE AKSIS · CONFIGURACIÓN</span><h1>Configuración del agente</h1><p>Elegí el proveedor y cargá su token secreto. Aksis conoce las direcciones de cada proveedor, cifra el token y lo usa únicamente desde el servidor.</p><form className="agent-config-form" onSubmit={save}>
    <section><h2>Proveedor, token y modelo</h2><div className="agent-fields"><label>Proveedor<select value={value.provider} onChange={(event) => { const provider = event.target.value as Provider; setConfig({ ...value, provider, model:"" } as Configuration); setModels([]); void loadModels(provider); }}><option value="gemini">Google Gemini</option><option value="openai">OpenAI</option><option value="openrouter">OpenRouter</option></select></label><label>Modelo disponible<select value={value.model} onChange={(event) => set("model", event.target.value)} disabled={loadingModels || !models.length}><option value="">{loadingModels ? "Consultando modelos…" : models.length ? "Elegí un modelo" : "Cargá un token primero"}</option>{models.map((model) => <option key={model} value={model}>{model}</option>)}</select></label></div><div className="api-key-row"><label>Token de API<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Pegá el token secreto del proveedor" autoComplete="new-password"/></label><button type="button" className="secondary-button" onClick={saveKey} disabled={savingKey || !apiKey.trim()}>{savingKey ? "Validando…" : "Guardar token y consultar modelos"}</button></div><p className="secure-note">El token se transmite solo a Aksis, se cifra en el servidor y no se expone otra vez. Cambiarlo reemplaza el token anterior del proveedor seleccionado.</p></section>
    <section><h2>Costos del modelo seleccionado</h2><div className="agent-fields"><label>Token in · US$ por millón<input type="number" min="0" step="0.000001" value={value.input_price_per_million_usd} onChange={(event) => set("input_price_per_million_usd", Number(event.target.value))}/></label><label>Token out · US$ por millón<input type="number" min="0" step="0.000001" value={value.output_price_per_million_usd} onChange={(event) => set("output_price_per_million_usd", Number(event.target.value))}/></label></div><p className="secure-note">Ingresá las tarifas vigentes del modelo elegido. Aksis las usará para calcular el costo estimado por atleta y por turno.</p></section>
    <section><div className="prompt-heading"><h2>Prompt operativo</h2><div className="prompt-tabs"><button type="button" className={promptView === "edit" ? "selected" : ""} onClick={() => setPromptView("edit")}>Editar MD</button><button type="button" className={promptView === "preview" ? "selected" : ""} onClick={() => setPromptView("preview")}>Vista previa</button></div></div><div className="prompt-template-tools"><button type="button" onClick={() => { set("system_prompt", ontologicalCoachPrompt); setPromptView("edit"); }}>Usar plantilla ontológica de Aksis</button><span>Variables disponibles: <code>@nombre</code> <code>@deporte</code> <code>@disciplina</code> <code>@tipo_deportista</code> <code>@edad</code> <code>@objetivos</code> <code>@resumen_ultima_sesion</code> <code>@resumen_bitacora_semanal</code></span></div>{promptView === "edit" ? <textarea className="prompt-editor" value={value.system_prompt} onChange={(event) => set("system_prompt", event.target.value)} maxLength={20000} spellCheck="false"/> : <PromptPreview content={value.system_prompt} />}<small>{value.system_prompt.length.toLocaleString("es-AR")} / 20.000 caracteres · admite títulos con #, listas con - y énfasis con **texto**.</small></section>
    <button disabled={saving}>{saving ? "Guardando…" : "Guardar configuración del agente"}</button>
  </form><AgentQuestionLibrary /></main>;
}

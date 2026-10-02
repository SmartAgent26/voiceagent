"use client";

import { FormEvent, useState } from "react";

type Turn = { role: "user" | "assistant"; content: string };
type TokenUsage = { inputTokens: number; outputTokens: number; totalTokens: number };

const emptyUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

export function CoachLab() {
  const [history, setHistory] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [usage, setUsage] = useState<TokenUsage>(emptyUsage);

  function resetConversation() {
    if (status === "loading") return;
    setHistory([]);
    setDraft("");
    setUsage(emptyUsage);
    setStatus("idle");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || status === "loading") return;

    const nextHistory = [...history, { role: "user" as const, content }];
    setHistory(nextHistory);
    setDraft("");
    setStatus("loading");

    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: nextHistory }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setHistory([...nextHistory, { role: "assistant", content: payload.content }]);
      setUsage((current) => ({
        inputTokens: current.inputTokens + (payload.usage?.inputTokens ?? 0),
        outputTokens: current.outputTokens + (payload.usage?.outputTokens ?? 0),
        totalTokens: current.totalTokens + (payload.usage?.totalTokens ?? 0),
      }));
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="coach-lab" aria-label="Laboratorio de conversación">
      <header>
        <p className="eyebrow">Laboratorio interno</p>
        <h1>Aksis</h1>
        <p>Probá la metodología del coach ontológico deportivo.</p>
      </header>
      <div className="lab-tools" aria-label="Controles del laboratorio">
        <dl className="token-counter" aria-live="polite">
          <div><dt>Entrada</dt><dd>{usage.inputTokens.toLocaleString("es-AR")}</dd></div>
          <div><dt>Salida</dt><dd>{usage.outputTokens.toLocaleString("es-AR")}</dd></div>
          <div><dt>Total</dt><dd>{usage.totalTokens.toLocaleString("es-AR")}</dd></div>
        </dl>
        <button className="secondary-button" type="button" onClick={resetConversation} disabled={status === "loading" || history.length === 0}>Nueva conversación</button>
      </div>
      <p className="token-note">Tokens acumulados informados por Gemini para esta conversación. La entrada incluye las instrucciones y el contexto enviado en cada turno.</p>
      <div className="turns" aria-live="polite">
        {history.length === 0 && <p className="empty">Contá una situación deportiva que quieras explorar.</p>}
        {history.map((turn, index) => (
          <article className={`turn ${turn.role}`} key={`${turn.role}-${index}`}>
            <strong>{turn.role === "user" ? "Vos" : "Aksis"}</strong>
            <p>{turn.content}</p>
          </article>
        ))}
        {status === "loading" && <p className="thinking">Aksis está pensando…</p>}
        {status === "error" && <p className="error">No se pudo obtener una respuesta. Verificá la configuración e intentá de nuevo.</p>}
      </div>
      <form onSubmit={submit}>
        <label htmlFor="message">Tu mensaje</label>
        <textarea id="message" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={4000} placeholder="Ej.: Después del entrenamiento me quedé pensando que no estoy a la altura." />
        <button type="submit" disabled={status === "loading"}>{status === "loading" ? "Pensando…" : "Explorar con Aksis"}</button>
      </form>
    </section>
  );
}

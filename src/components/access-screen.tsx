"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import logo from "../../imagenes/logo.jpg";
import { synchronizeServerSession } from "@/lib/auth/browser-session";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { useAksisToast } from "@/components/aksis-toast";

const roles = [
  ["juvenil", "Atleta Juvenil", "Desarrollo y base"],
  ["alto_rendimiento", "Alto Rendimiento", "Élite & foco mental"],
  ["master", "Master & Senior", "Longevidad activa"],
  ["coach", "Coach / Familia", "Acompañamiento"],
];

function readableAuthError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("already registered")) return "Ya existe una cuenta con este correo. Probá iniciar sesión.";
  if (normalized.includes("invalid login credentials")) return "El correo o la contraseña no son correctos.";
  if (normalized.includes("email not confirmed")) return "Confirmá tu correo electrónico antes de ingresar.";
  if (normalized.includes("password should be")) return "La contraseña no cumple los requisitos mínimos de seguridad.";
  if (normalized.includes("database error saving new user")) return "Supabase no pudo crear tu perfil. Volvé a intentarlo en unos minutos.";
  return message || "No pudimos completar el acceso. Revisá tus datos e intentá nuevamente.";
}

export function AccessScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("juvenil");
  const { showToast } = useAksisToast();

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mode") === "signup") setMode("signup");
  }, []);

  useEffect(() => {
    const client = createBrowserSupabaseClient();
    void (async () => {
      const { data: identity, error } = await client.auth.getUser();
      if (error || !identity.user) return;
      const { data: sessionData } = await client.auth.getSession();
      if (sessionData.session?.access_token && await synchronizeServerSession(sessionData.session.access_token)) window.location.assign("/app");
    })();
  }, []);

  useEffect(() => {
    if (status !== "success") return;
    const redirect = window.setTimeout(() => {
      setMode("login");
      setStatus("idle");
      setMessage("");
      window.history.replaceState(null, "", "/access");
    }, 2600);
    return () => window.clearTimeout(redirect);
  }, [status]);

  useEffect(() => {
    if (!message || status === "idle" || status === "loading") return;
    showToast(message, status === "error" ? "error" : "success");
  }, [message, showToast, status]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      const client = createBrowserSupabaseClient();
      const result = mode === "login"
        ? await client.auth.signInWithPassword({ email, password })
        : await client.auth.signUp({
            email,
            password,
            options: { data: { display_name: displayName, training_dimension: role } },
          });

      if (result.error) throw result.error;
      if (mode === "login") {
        if (!result.data.session?.access_token || !await synchronizeServerSession(result.data.session.access_token)) throw new Error("No pudimos establecer la sesión segura. Volvé a intentarlo.");
        window.location.assign("/app");
        return;
      }
      if (result.data.session) {
        if (!await synchronizeServerSession(result.data.session.access_token)) throw new Error("No pudimos establecer la sesión segura. Volvé a intentarlo.");
        window.location.assign("/terms");
        return;
      }
      setStatus("success");
      setMessage("Tu cuenta fue creada con éxito. Revisá tu correo para confirmarla y luego ingresá a Aksis.");
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "";
      setStatus("error");
      setMessage(readableAuthError(rawMessage));
    }
  }

  function changeMode(next: "login" | "signup") {
    setMode(next);
    setStatus("idle");
    setMessage("");
  }

  return (
    <main className="auth-page">
      <div className="auth-design">
        <header>
          <Image src={logo} alt="Aksis Coaching Ontológico Deportivo" priority />
          <p><i /> AKSIS COACHING</p>
          <h1>Tu espacio de evolución deportiva</h1>
          <span>Alinea tu mente, cuerpo y propósito con acompañamiento ontológico consciente.</span>
        </header>
        <div className="auth-tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => changeMode("login")}>Iniciar Sesión</button>
          <button className={mode === "signup" ? "active" : ""} onClick={() => changeMode("signup")}>Crear Cuenta</button>
        </div>
        <section className="auth-form-card">
          <form onSubmit={submit}>
            {mode === "signup" && <>
              <label>ROL O DIMENSIÓN DE ENTRENAMIENTO</label>
              <div className="role-grid">{roles.map(([value, title, description]) => <button type="button" className={role === value ? "selected" : ""} onClick={() => setRole(value)} key={value}><strong>{title}</strong><small>{description}</small></button>)}</div>
              <label>NOMBRE COMPLETO<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Ej. Sofía Morales" required /></label>
            </>}
            <label>CORREO ELECTRÓNICO INSTITUCIONAL O PERSONAL<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="atleta@aksis.pro" required /></label>
            <label className="password-label">CONTRASEÑA{mode === "login" && <a href="#">¿Olvidaste tu contraseña?</a>}<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••••••" minLength={8} required /></label>
            <button className="auth-submit" disabled={status === "loading"}>{status === "loading" ? "Un momento…" : mode === "login" ? "Ingresar a mi Espacio" : "Comenzar mi Proceso"} <b>→</b></button>
          </form>
        </section>
        <aside className="ontological-commitment"><b>♧</b><div><strong>Compromiso Ontológico</strong><p>Un espacio confidencial y de confianza para explorar tu potencial humano, emocional y atlético. Tus reflexiones y registros son 100% privados.</p></div></aside>
        <footer><a href="#">Código de Ética</a><i /> <a href="#">Privacidad Deportiva</a><i /> <a href="#">Soporte</a></footer>
      </div>
    </main>
  );
}

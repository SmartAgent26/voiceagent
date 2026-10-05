"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);
}

function isIos() {
  return typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function PwaInstall() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(true);
  const [online, setOnline] = useState(true);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setOnline(navigator.onLine);
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);

    const receivePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const markInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    const markOnline = () => setOnline(true);
    const markOffline = () => setOnline(false);
    window.addEventListener("beforeinstallprompt", receivePrompt);
    window.addEventListener("appinstalled", markInstalled);
    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    return () => {
      window.removeEventListener("beforeinstallprompt", receivePrompt);
      window.removeEventListener("appinstalled", markInstalled);
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
    };
  }, []);

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setInstallPrompt(null);
  }

  if (installed) return !online ? <p className="pwa-connection-status" role="status">Sin conexión. Para continuar necesitás volver a conectarte.</p> : null;
  if (isIos()) return <aside className="pwa-install-card"><div><span>◌</span><p><b>Sumá Aksis a tu inicio</b><small>En Safari, tocá Compartir y elegí “Agregar a inicio”.</small></p></div><button type="button" onClick={() => setShowIosHelp(value => !value)}>{showIosHelp ? "Ocultar" : "Ver cómo"}</button>{showIosHelp && <p className="pwa-ios-help">Abrí esta página en Safari, tocá el ícono de compartir y después “Agregar a inicio”.</p>}</aside>;
  if (!installPrompt) return !online ? <p className="pwa-connection-status" role="status">Sin conexión. Para continuar necesitás volver a conectarte.</p> : null;

  return <aside className="pwa-install-card"><div><span>◌</span><p><b>Llevá Aksis con vos</b><small>Instalá tu espacio para acceder más rápido desde tu inicio.</small></p></div><button type="button" onClick={install}>Instalar</button></aside>;
}

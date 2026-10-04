"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

export type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; message: string };
type ToastContextValue = { showToast: (message: string, kind?: ToastKind) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function AksisToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);

  function showToast(message: string, kind: ToastKind = "info") {
    setToast({ id: Date.now(), message, kind });
  }

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), toast.kind === "error" ? 6500 : 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const value = useMemo(() => ({ showToast }), []);
  return <ToastContext.Provider value={value}>{children}{toast && <div className={`aksis-toast aksis-toast-${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"}><p>{toast.message}</p><button type="button" aria-label="Cerrar mensaje" onClick={() => setToast(null)}>×</button></div>}</ToastContext.Provider>;
}

export function useAksisToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useAksisToast debe utilizarse dentro de AksisToastProvider.");
  return context;
}

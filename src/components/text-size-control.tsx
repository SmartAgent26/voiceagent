"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const storageKey = "aksis-large-text";

export function TextSizeControl() {
  const pathname = usePathname();
  const [largeText, setLargeText] = useState(false);

  useEffect(() => {
    const enabled = window.localStorage.getItem(storageKey) === "true";
    document.documentElement.classList.toggle("aksis-large-text", enabled);
    setLargeText(enabled);
  }, []);

  function toggleTextSize() {
    const next = !largeText;
    document.documentElement.classList.toggle("aksis-large-text", next);
    window.localStorage.setItem(storageKey, String(next));
    setLargeText(next);
  }

  // Es una preferencia de lectura de quienes usan la aplicación, no del sitio
  // público, acceso ni las herramientas de administración.
  if (pathname === "/" || pathname.startsWith("/access") || pathname.startsWith("/admin")) return null;

  return <button
    className={`text-size-control ${largeText ? "is-large" : ""}`}
    type="button"
    onClick={toggleTextSize}
    aria-pressed={largeText}
    aria-label={largeText ? "Volver al tamaño de texto original" : "Duplicar el tamaño del texto"}
    title={largeText ? "Volver al tamaño original" : "Ampliar texto"}
  >
    {largeText ? "−A" : "+A"}
  </button>;
}

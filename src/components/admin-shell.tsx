"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

const navigation = [
  { href: "/admin", label: "Resumen", exact: true },
  { href: "/admin/users/manage", label: "Usuarios y suscripciones" },
  { href: "/admin/plans", label: "Planes" },
  { href: "/admin/agent", label: "Agente Meli" },
  { href: "/admin/audit", label: "Operación y auditoría" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("Superadmin");
  const [avatar, setAvatar] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const client = createBrowserSupabaseClient();
    void (async () => {
      const { data: { user } } = await client.auth.getUser();
      if (!user) return location.assign("/access");
      const { data } = await client.from("profiles").select("role,display_name,avatar_path").eq("id", user.id).single();
      if (data?.role !== "superadmin") return location.assign("/app");
      setName(data.display_name || user.email?.split("@")[0] || "Superadmin");
      if (data.avatar_path) {
        const { data: signed } = await client.storage.from("avatars").createSignedUrl(data.avatar_path, 3600);
        setAvatar(signed?.signedUrl || null);
      }
      await client.from("audit_log").insert({ actor_id: user.id, action: "admin_login", entity_type: "auth" });
      setReady(true);
    })();
  }, []);

  async function logout() {
    const client = createBrowserSupabaseClient();
    const { data: { user } } = await client.auth.getUser();
    if (user) await client.from("audit_log").insert({ actor_id: user.id, action: "admin_logout", entity_type: "auth" });
    await client.auth.signOut(); location.assign("/access");
  }

  if (!ready) return <main className="admin-loading">Verificando acceso administrativo…</main>;
  return <main className="admin-protected"><header className="admin-topbar"><Link className="admin-brand" href="/admin"><span className="axis-mark" /><span><b>AKSIS</b><em>CORE</em><small>ENTORNO PROTEGIDO</small></span></Link><nav aria-label="Navegación administrativa">{navigation.map((item) => <Link key={item.href} className={(item.exact ? pathname === item.href : pathname.startsWith(item.href)) ? "active" : ""} href={item.href}>{item.label}</Link>)}</nav><div className="admin-topbar-user"><span className="admin-daemon"><i /> Auditoría activa</span><div className="admin-identity"><span><b>{name}</b><small>Superadmin</small></span>{avatar ? <img src={avatar} alt={`Avatar de ${name}`} /> : <b className="admin-avatar">{name.charAt(0).toUpperCase()}</b>}</div><button type="button" onClick={logout}>Cerrar sesión</button></div></header><section className="admin-content">{children}</section></main>;
}

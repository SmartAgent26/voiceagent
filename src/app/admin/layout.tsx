import { AdminShell } from "@/components/admin-shell";
import { requireSuperadminPage } from "@/lib/auth/server-session";

export default async function AdminLayout({children}:{children:React.ReactNode}) {
  await requireSuperadminPage();
  return <AdminShell>{children}</AdminShell>;
}

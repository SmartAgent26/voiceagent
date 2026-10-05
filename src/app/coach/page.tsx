import { AppShell } from "@/components/app-shell";
import { requireSuperadminPage } from "@/lib/auth/server-session";

export default async function CoachPage() {
  await requireSuperadminPage();
  return <AppShell view="coach" />;
}

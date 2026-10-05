import { CoachLab } from "@/components/coach-lab";
import { requireSuperadminPage } from "@/lib/auth/server-session";

export default async function LabPage() {
  await requireSuperadminPage();
  return <main className="lab-page"><CoachLab /></main>;
}

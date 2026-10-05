import { TermsFlow } from "@/components/terms-flow";
import { requireAthletePage } from "@/lib/auth/server-session";
export default async function TermsPage() { await requireAthletePage(); return <TermsFlow />; }

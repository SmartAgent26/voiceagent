import { OnboardingFlow } from "@/components/onboarding-flow";
import { requireAthletePage } from "@/lib/auth/server-session";
export default async function OnboardingPage() { await requireAthletePage(); return <OnboardingFlow />; }

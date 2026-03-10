import PersonaLanding from "@/components/PersonaLanding";
import { PERSONA_PORTFOLIO } from "@shared/personaContent";
import heroImage from "@assets/Screenshot_2026-03-10_at_9.07.38_AM_1773148075046.png";

export default function MultiSitesPage() {
  return <PersonaLanding persona={PERSONA_PORTFOLIO} heroImage={heroImage} />;
}

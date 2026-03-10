import PersonaLanding from "@/components/PersonaLanding";
import { PERSONA_PORTFOLIO } from "@shared/personaContent";
import heroImage from "@assets/solar-panels-multi-site-reit-portfolio-quebec-aerial.png";

export default function MultiSitesPage() {
  return <PersonaLanding persona={PERSONA_PORTFOLIO} heroImage={heroImage} />;
}

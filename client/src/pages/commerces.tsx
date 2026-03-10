import PersonaLanding from "@/components/PersonaLanding";
import { PERSONA_COMMERCIAL } from "@shared/personaContent";
import heroImage from "@assets/solar-panels-commercial-building-rooftop-quebec-aerial.png";

export default function CommercesPage() {
  return <PersonaLanding persona={PERSONA_COMMERCIAL} heroImage={heroImage} />;
}

import PersonaLanding from "@/components/PersonaLanding";
import { PERSONA_INDUSTRIAL } from "@shared/personaContent";
import heroImage from "@assets/solar-panels-industrial-warehouse-rooftop-quebec-aerial.png";

export default function IndustrielPage() {
  return <PersonaLanding persona={PERSONA_INDUSTRIAL} heroImage={heroImage} />;
}

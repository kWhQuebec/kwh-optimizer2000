import PersonaLanding from "@/components/PersonaLanding";
import { PERSONA_COMMERCIAL } from "@shared/personaContent";
import heroImage from "@assets/Gemini_Generated_Image_7g4pcu7g4pcu7g4p_1773148106096.png";

export default function CommercesPage() {
  return <PersonaLanding persona={PERSONA_COMMERCIAL} heroImage={heroImage} />;
}

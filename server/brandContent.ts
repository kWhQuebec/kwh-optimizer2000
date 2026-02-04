// ============================================
// SINGLE SOURCE OF TRUTH - CONTENU MARKETING
// Modifier ici = mise à jour partout (PDF, PPTX, Web)
// ============================================

export const BRAND_CONTENT = {
  // === STATS DE CRÉDIBILITÉ ===
  stats: {
    yearsExperience: { value: "15+", labelFr: "Années d'expérience", labelEn: "Years of experience" },
    mwInstalled: { value: "120", labelFr: "MW installés", labelEn: "MW installed" },
    projectsCI: { value: "25+", labelFr: "Projets C&I", labelEn: "C&I Projects" },
  },

  // === TÉMOIGNAGES ===
  testimonials: [
    {
      id: "manufacturing-director",
      quoteFr: "L'analyse détaillée nous a permis de prendre une décision éclairée. Le retour sur investissement prévu s'est avéré exact à 2% près.",
      quoteEn: "The detailed analysis allowed us to make an informed decision. The expected ROI proved accurate within 2%.",
      authorFr: "Directeur des opérations, Entreprise manufacturière",
      authorEn: "Operations Director, Manufacturing Company",
    },
    {
      id: "warehouse-manager", 
      quoteFr: "Réduction de 35% de notre facture énergétique dès la première année.",
      quoteEn: "35% reduction in our energy bill from the first year.",
      authorFr: "Gestionnaire d'entrepôt, Logistique Québec",
      authorEn: "Warehouse Manager, Quebec Logistics",
    },
  ],

  // === CONTACT ===
  contact: {
    email: "info@kwh.quebec",
    website: "www.kwh.quebec",
  },

  // === TITRES DE SECTIONS ===
  sectionTitles: {
    trustUs: { fr: "ILS NOUS FONT CONFIANCE", en: "THEY TRUST US" },
    nextStep: { fr: "PROCHAINE ÉTAPE", en: "NEXT STEP" },
    freeVisit: { 
      fr: "Contactez-nous pour planifier votre visite de site gratuite", 
      en: "Contact us to schedule your free site visit" 
    },
  },

  // === FORMAT DES KPIs ===
  kpiConfig: {
    npv: { labelFr: "Profit Net (VAN)", labelEn: "Net Profit (NPV)", highlight: true },
    irr: { labelFr: "Rendement (TRI)", labelEn: "Return (IRR)", highlight: true },
    savings: { labelFr: "Économies An 1", labelEn: "Year 1 Savings", highlight: false },
    capexNet: { labelFr: "Investissement Net", labelEn: "Net Investment", highlight: false },
    payback: { labelFr: "Retour simple", labelEn: "Simple Payback", highlight: false },
    pvSize: { labelFr: "Puissance PV", labelEn: "PV Power", highlight: false },
    batterySize: { labelFr: "Stockage", labelEn: "Storage", highlight: false },
  },
};

// === HELPER FUNCTIONS ===

type Lang = "fr" | "en";

export function getAllStats(lang: Lang) {
  return Object.values(BRAND_CONTENT.stats).map(stat => ({
    value: stat.value,
    label: lang === "fr" ? stat.labelFr : stat.labelEn,
  }));
}

export function getTestimonial(id: string, lang: Lang) {
  const t = BRAND_CONTENT.testimonials.find(item => item.id === id);
  if (!t) return null;
  return {
    quote: lang === "fr" ? t.quoteFr : t.quoteEn,
    author: lang === "fr" ? t.authorFr : t.authorEn,
  };
}

export function getFirstTestimonial(lang: Lang) {
  const t = BRAND_CONTENT.testimonials[0];
  return {
    quote: lang === "fr" ? t.quoteFr : t.quoteEn,
    author: lang === "fr" ? t.authorFr : t.authorEn,
  };
}

export function getTitle(key: keyof typeof BRAND_CONTENT.sectionTitles, lang: Lang): string {
  return BRAND_CONTENT.sectionTitles[key][lang];
}

export function getContact() {
  return BRAND_CONTENT.contact;
}

export function getContactString(): string {
  const c = BRAND_CONTENT.contact;
  return `${c.email}  |  ${c.website}`;
}

export function getKpiLabel(key: keyof typeof BRAND_CONTENT.kpiConfig, lang: Lang): string {
  const kpi = BRAND_CONTENT.kpiConfig[key];
  return lang === "fr" ? kpi.labelFr : kpi.labelEn;
}

export function isKpiHighlighted(key: keyof typeof BRAND_CONTENT.kpiConfig): boolean {
  return BRAND_CONTENT.kpiConfig[key].highlight;
}

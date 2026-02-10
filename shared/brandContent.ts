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
    phone: "514.427.8871",
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
    pvSize: { labelFr: "Puissance Solaire", labelEn: "Solar Power", highlight: false },
    batterySize: { labelFr: "Stockage", labelEn: "Storage", highlight: false },
  },

  // === HYPOTHÈSES FINANCIÈRES ===
  // IMPORTANT: Ces valeurs doivent correspondre à shared/schema.ts > defaultAnalysisAssumptions
  assumptions: {
    utilityEscalation: { value: "3.5%/an", labelFr: "Escalade prix électricité", labelEn: "Utility price escalation" },
    pvDegradation: { value: "0.5%/an", labelFr: "Dégradation panneaux", labelEn: "Panel degradation" },
    systemLife: { value: "25 ans", labelFr: "Durée de vie système", labelEn: "System lifespan" },
    program: { value: "Autoproduction", labelFr: "Programme HQ", labelEn: "HQ Program" },
    selfConsumption: { value: "~90%", labelFr: "Autoconsommation estimée", labelEn: "Est. self-consumption" },
    discountRate: { value: "7%", labelFr: "Taux d'actualisation (WACC)", labelEn: "Discount rate (WACC)" },
    omCostSolar: { value: "1.0%/an", labelFr: "O&M solaire (% CAPEX)", labelEn: "Solar O&M (% CAPEX)" },
    omCostBattery: { value: "0.5%/an", labelFr: "O&M stockage (% CAPEX)", labelEn: "Storage O&M (% CAPEX)" },
  },

  // === EXCLUSIONS ===
  exclusions: [
    { labelFr: "Travaux de toiture préalables", labelEn: "Prior roof work" },
    { labelFr: "Mise à niveau électrique (si requise)", labelEn: "Electrical upgrades (if required)" },
    { labelFr: "Frais d'interconnexion HQ (à confirmer)", labelEn: "HQ interconnection fees (TBC)" },
    { labelFr: "Stockage batterie (optionnel, si non inclus)", labelEn: "Battery storage (optional, if not included)" },
    { labelFr: "Contrat O&M (optionnel)", labelEn: "O&M contract (optional)" },
    { labelFr: "Frais de grue ou levage spécialisé", labelEn: "Crane or specialized lifting fees" },
  ],

  // === ÉQUIPEMENT INDICATIF ===
  equipment: [
    { labelFr: "Panneaux solaires Tier-1", labelEn: "Tier-1 solar panels", warrantyFr: "25 ans", warrantyEn: "25 years", iconCode: "panel" },
    { labelFr: "Onduleurs certifiés CSA/UL", labelEn: "CSA/UL certified inverters", warrantyFr: "10-15 ans", warrantyEn: "10-15 years", iconCode: "inverter" },
    { labelFr: "Structure de montage KB Racking", labelEn: "KB Racking mounting structure", warrantyFr: "25 ans", warrantyEn: "25 years", iconCode: "mounting" },
    { labelFr: "Main d'œuvre certifiée", labelEn: "Certified workmanship", warrantyFr: "10 ans", warrantyEn: "10 years", iconCode: "workmanship" },
  ],

  // === ÉCHÉANCIER TYPE ===
  timeline: [
    { stepFr: "Signature", stepEn: "Contract", durationFr: "", durationEn: "", iconCode: "contract" },
    { stepFr: "Conception", stepEn: "Design", durationFr: "2-4 sem.", durationEn: "2-4 wks", iconCode: "design" },
    { stepFr: "Permis & HQ", stepEn: "Permits & HQ", durationFr: "8-12 sem.", durationEn: "8-12 wks", iconCode: "permits" },
    { stepFr: "Installation", stepEn: "Installation", durationFr: "2-4 sem.", durationEn: "2-4 wks", iconCode: "install" },
    { stepFr: "Mise en service", stepEn: "Commissioning", durationFr: "1-2 sem.", durationEn: "1-2 wks", iconCode: "commissioning" },
  ],

  // === PROJECT SNAPSHOT LABELS ===
  projectSnapshotLabels: {
    annualConsumption: { labelFr: "Consommation annuelle", labelEn: "Annual consumption", unit: "kWh" },
    peakDemand: { labelFr: "Demande de pointe", labelEn: "Peak demand", unit: "kW" },
    currentTariff: { labelFr: "Tarif HQ actuel", labelEn: "Current HQ tariff", unit: "" },
    estimatedProduction: { labelFr: "Production solaire An 1", labelEn: "Year-1 solar production", unit: "kWh" },
    selfConsumptionRate: { labelFr: "Taux d'autoconsommation", labelEn: "Self-consumption rate", unit: "%" },
    solarCapacity: { labelFr: "Puissance solaire proposée", labelEn: "Proposed solar capacity", unit: "kWc" },
    batteryCapacity: { labelFr: "Stockage proposé", labelEn: "Proposed storage", unit: "kWh" },
  },

  // === NEXT STEPS AMÉLIORÉS ===
  designFeeCovers: [
    { labelFr: "Visite de site complète", labelEn: "Complete site visit" },
    { labelFr: "Ingénierie préliminaire", labelEn: "Preliminary engineering" },
    { labelFr: "Préparation dossier interconnexion HQ", labelEn: "HQ interconnection application prep" },
    { labelFr: "Soumission ferme détaillée", labelEn: "Detailed firm quote" },
  ],

  clientProvides: [
    { labelFr: "Factures Hydro-Québec (12-24 mois)", labelEn: "Hydro-Québec bills (12-24 months)" },
    { labelFr: "Informations toiture (âge, état)", labelEn: "Roof information (age, condition)" },
    { labelFr: "Schéma unifilaire (si disponible)", labelEn: "Single-line diagram (if available)" },
    { labelFr: "Confirmation propriété / bail", labelEn: "Ownership / lease confirmation" },
  ],

  clientReceives: [
    { labelFr: "Soumission ferme avec prix garantis", labelEn: "Firm quote with guaranteed pricing" },
    { labelFr: "Échéancier de réalisation détaillé", labelEn: "Detailed implementation schedule" },
    { labelFr: "Portée et exclusions clarifiées", labelEn: "Clarified scope and exclusions" },
    { labelFr: "Dossier prêt pour demande HQ", labelEn: "File ready for HQ application" },
  ],

  // === STORYTELLING - ARC NARRATIF ===
  narrativeArc: {
    act1_challenge: {
      titleFr: "LE DÉFI ÉNERGÉTIQUE",
      titleEn: "THE ENERGY CHALLENGE",
      subtitleFr: "Vos coûts énergétiques augmentent chaque année. Voici votre situation actuelle.",
      subtitleEn: "Your energy costs rise every year. Here is your current situation.",
    },
    act2_solution: {
      titleFr: "NOTRE SOLUTION",
      titleEn: "OUR SOLUTION",
      subtitleFr: "Reprenez le contrôle avec un système solaire + stockage sur mesure.",
      subtitleEn: "Take back control with a custom solar + storage system.",
    },
    act3_results: {
      titleFr: "VOS RÉSULTATS",
      titleEn: "YOUR RESULTS",
      subtitleFr: "Les chiffres parlent d'eux-mêmes : économies, rendement et valeur à long terme.",
      subtitleEn: "The numbers speak for themselves: savings, returns, and long-term value.",
    },
    act4_action: {
      titleFr: "PASSEZ À L'ACTION",
      titleEn: "TAKE ACTION",
      subtitleFr: "Tout est en place. Voici comment démarrer votre projet.",
      subtitleEn: "Everything is in place. Here's how to start your project.",
    },
    transitions: {
      challengeToSolution: {
        fr: "Face à ces défis, nous avons conçu une solution adaptée à votre bâtiment.",
        en: "Facing these challenges, we designed a solution tailored to your building.",
      },
      solutionToResults: {
        fr: "Voici l'impact concret de cette solution sur vos finances.",
        en: "Here is the concrete impact of this solution on your finances.",
      },
      resultsToAction: {
        fr: "Ces résultats sont à votre portée. Voici les prochaines étapes.",
        en: "These results are within your reach. Here are the next steps.",
      },
    },
  },

  // === POURQUOI LE SOLAIRE AU QUÉBEC MAINTENANT ===
  whySolarNow: {
    sectionTitle: {
      fr: "Pourquoi le solaire au Québec MAINTENANT?",
      en: "Why Solar in Quebec NOW?",
    },
    beforeTitle: {
      fr: "Avant: pourquoi c'était pas rentable",
      en: "Before: Why It Wasn't Profitable",
    },
    beforeReasons: [
      {
        labelFr: "Coût des panneaux très élevé (>4 $/W installé il y a 10 ans)",
        labelEn: "Very high panel costs (>$4/W installed 10 years ago)",
      },
      {
        labelFr: "Aucune subvention gouvernementale significative",
        labelEn: "No significant government incentives",
      },
      {
        labelFr: "Rendement et efficacité des panneaux plus faibles",
        labelEn: "Lower panel efficiency and yield",
      },
      {
        labelFr: "Tarifs d'électricité très bas au Québec = retour sur investissement trop long",
        labelEn: "Very low electricity rates in Quebec = payback period too long",
      },
    ],
    nowTitle: {
      fr: "Aujourd'hui: ce qui a changé",
      en: "Today: What Has Changed",
    },
    nowReasons: [
      {
        labelFr: "Réduction drastique des coûts (~1,50-2,00 $/W installé pour C&I)",
        labelEn: "Drastic cost reduction (~$1.50-2.00/W installed for C&I)",
      },
      {
        labelFr: "Programme d'autoproduction d'Hydro-Québec (incitatif de 1 000 $/kW)",
        labelEn: "Hydro-Québec self-generation program ($1,000/kW incentive)",
      },
      {
        labelFr: "Crédit d'impôt fédéral à l'investissement (CII) de 30%",
        labelEn: "Federal Investment Tax Credit (ITC) of 30%",
      },
      {
        labelFr: "Hausses tarifaires d'HQ (indexation annuelle ~3-5%)",
        labelEn: "HQ rate increases (annual indexation ~3-5%)",
      },
      {
        labelFr: "Meilleure technologie (panneaux bifaciaux, rendements supérieurs)",
        labelEn: "Better technology (bifacial panels, higher yields)",
      },
      {
        labelFr: "Mesurage net avec banque de crédits sur 24 mois",
        labelEn: "Net metering with 24-month credit bank",
      },
      {
        labelFr: "Amortissement fiscal accéléré (DPA catégorie 43.1/43.2)",
        labelEn: "Accelerated tax depreciation (CCA Class 43.1/43.2)",
      },
    ],
    winterTitle: {
      fr: "Et l'hiver? La neige?",
      en: "What About Winter? Snow?",
    },
    winterSubtitle: {
      fr: "Les mythes vs la réalité",
      en: "Myths vs Reality",
    },
    winterMyths: [
      {
        mythFr: "Les panneaux ne produisent pas en hiver",
        mythEn: "Panels don't produce in winter",
        realityFr: "Le système est dimensionné sur la production annuelle, pas seulement l'été. Le Québec génère ~60% de sa production solaire de mai à septembre, et le mesurage net permet d'accumuler des crédits sur 24 mois.",
        realityEn: "The system is sized on annual production, not just summer. Quebec generates ~60% of solar production from May to September, and net metering allows credit banking over 24 months.",
      },
      {
        mythFr: "Le froid réduit la performance des panneaux",
        mythEn: "Cold weather reduces panel performance",
        realityFr: "C'est l'inverse : les températures froides améliorent l'efficacité des panneaux (+0,4%/°C sous 25 °C). Les journées froides et ensoleillées d'hiver au Québec sont en fait idéales pour la production solaire.",
        realityEn: "It's the opposite: cold temperatures actually improve panel efficiency (+0.4%/°C below 25°C). Cold, sunny winter days in Quebec are actually ideal for solar production.",
      },
      {
        mythFr: "La neige bloque les panneaux pendant des mois",
        mythEn: "Snow blocks panels for months",
        realityFr: "La neige glisse rapidement des panneaux commerciaux inclinés. De plus, l'effet albédo (réflexion de la neige au sol) au printemps procure un bonus de production pouvant atteindre 5-10%.",
        realityEn: "Snow slides off tilted commercial panels quickly. Moreover, the albedo effect (snow ground reflection) in spring provides a production bonus of up to 5-10%.",
      },
      {
        mythFr: "Les journées courtes en hiver rendent le solaire non viable",
        mythEn: "Short winter days make solar unviable",
        realityFr: "Les longues journées d'été au Québec (15+ heures d'ensoleillement) compensent largement les journées plus courtes d'hiver. La production annuelle totale est ce qui compte.",
        realityEn: "Quebec's long summer days (15+ hours of sunlight) more than compensate for shorter winter days. Total annual production is what matters.",
      },
      {
        mythFr: "Le solaire n'a pas fait ses preuves dans le climat québécois",
        mythEn: "Solar is unproven in Quebec's climate",
        realityFr: "Plus de 25 ans de données réelles confirment une performance fiable à l'année au Québec. Des milliers de systèmes C&I fonctionnent avec succès dans des climats nordiques similaires à travers le Canada et la Scandinavie.",
        realityEn: "25+ years of real-world data confirm reliable year-round performance in Quebec. Thousands of C&I systems operate successfully in similar northern climates across Canada and Scandinavia.",
      },
    ],
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
  return `${c.email}  |  ${c.phone}  |  ${c.website}`;
}

export function getKpiLabel(key: keyof typeof BRAND_CONTENT.kpiConfig, lang: Lang): string {
  const kpi = BRAND_CONTENT.kpiConfig[key];
  return lang === "fr" ? kpi.labelFr : kpi.labelEn;
}

export function isKpiHighlighted(key: keyof typeof BRAND_CONTENT.kpiConfig): boolean {
  return BRAND_CONTENT.kpiConfig[key].highlight;
}

export function getAssumptions(lang: Lang) {
  return Object.values(BRAND_CONTENT.assumptions).map(a => ({
    label: lang === "fr" ? a.labelFr : a.labelEn,
    value: a.value,
  }));
}

export function getExclusions(lang: Lang) {
  return BRAND_CONTENT.exclusions.map(e => (lang === "fr" ? e.labelFr : e.labelEn));
}

export function getEquipment(lang: Lang) {
  return BRAND_CONTENT.equipment.map(e => ({
    label: lang === "fr" ? e.labelFr : e.labelEn,
    warranty: lang === "fr" ? e.warrantyFr : e.warrantyEn,
  }));
}

export function getTimeline(lang: Lang) {
  return BRAND_CONTENT.timeline.map(t => ({
    step: lang === "fr" ? t.stepFr : t.stepEn,
    duration: lang === "fr" ? t.durationFr : t.durationEn,
  }));
}

export function getProjectSnapshotLabels(lang: Lang) {
  const labels: Record<string, { label: string; unit: string }> = {};
  for (const [key, val] of Object.entries(BRAND_CONTENT.projectSnapshotLabels)) {
    labels[key] = {
      label: lang === "fr" ? val.labelFr : val.labelEn,
      unit: val.unit,
    };
  }
  return labels;
}

export function getDesignFeeCovers(lang: Lang) {
  return BRAND_CONTENT.designFeeCovers.map(d => (lang === "fr" ? d.labelFr : d.labelEn));
}

export function getClientProvides(lang: Lang) {
  return BRAND_CONTENT.clientProvides.map(d => (lang === "fr" ? d.labelFr : d.labelEn));
}

export function getClientReceives(lang: Lang) {
  return BRAND_CONTENT.clientReceives.map(d => (lang === "fr" ? d.labelFr : d.labelEn));
}

export function getNarrativeAct(act: keyof typeof BRAND_CONTENT.narrativeArc, lang: Lang): { title: string; subtitle: string } {
  const a = BRAND_CONTENT.narrativeArc[act];
  if ("titleFr" in a) {
    return {
      title: lang === "fr" ? a.titleFr : a.titleEn,
      subtitle: lang === "fr" ? a.subtitleFr : a.subtitleEn,
    };
  }
  return { title: "", subtitle: "" };
}

export function getNarrativeTransition(key: keyof typeof BRAND_CONTENT.narrativeArc.transitions, lang: Lang): string {
  return BRAND_CONTENT.narrativeArc.transitions[key][lang];
}

export function getWhySolarNow(lang: Lang): {
  sectionTitle: string;
  beforeTitle: string;
  beforeReasons: string[];
  nowTitle: string;
  nowReasons: string[];
  winterTitle: string;
  winterSubtitle: string;
  winterMyths: { myth: string; reality: string }[];
} {
  const w = BRAND_CONTENT.whySolarNow;
  return {
    sectionTitle: w.sectionTitle[lang],
    beforeTitle: w.beforeTitle[lang],
    beforeReasons: w.beforeReasons.map(r => (lang === "fr" ? r.labelFr : r.labelEn)),
    nowTitle: w.nowTitle[lang],
    nowReasons: w.nowReasons.map(r => (lang === "fr" ? r.labelFr : r.labelEn)),
    winterTitle: w.winterTitle[lang],
    winterSubtitle: w.winterSubtitle[lang],
    winterMyths: w.winterMyths.map(m => ({
      myth: lang === "fr" ? m.mythFr : m.mythEn,
      reality: lang === "fr" ? m.realityFr : m.realityEn,
    })),
  };
}

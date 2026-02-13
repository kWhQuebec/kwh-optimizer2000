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
      authorFr: "L. Hodgkinson — dream Industrial REIT",
      authorEn: "L. Hodgkinson — dream Industrial REIT",
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
    npv: { labelFr: "Profit net (VAN)", labelEn: "Net Profit (NPV)", highlight: true },
    irr: { labelFr: "Rendement (TRI)", labelEn: "Return (IRR)", highlight: true },
    savings: { labelFr: "Économies an 1", labelEn: "Year 1 Savings", highlight: false },
    capexNet: { labelFr: "Investissement net", labelEn: "Net Investment", highlight: false },
    payback: { labelFr: "Retour simple", labelEn: "Simple Payback", highlight: false },
    pvSize: { labelFr: "Puissance solaire", labelEn: "Solar Power", highlight: false },
    batterySize: { labelFr: "Stockage", labelEn: "Storage", highlight: false },
  },

  // === HYPOTHÈSES FINANCIÈRES ===
  // IMPORTANT: Ces valeurs doivent correspondre à shared/schema.ts > defaultAnalysisAssumptions
  assumptions: {
    utilityEscalation: { value: "3.5%/an", labelFr: "Escalade prix électricité", labelEn: "Utility price escalation" },
    pvDegradation: { value: "0.5%/an", labelFr: "Dégradation panneaux", labelEn: "Panel degradation" },
    systemLife: { value: "25 ans", labelFr: "Durée de vie système", labelEn: "System lifespan" },
    program: { value: "Autoproduction", labelFr: "Programme Hydro-Québec", labelEn: "Hydro-Québec Program" },
    selfConsumption: { value: "~90%", labelFr: "Autoconsommation estimée", labelEn: "Est. self-consumption" },
    discountRate: { value: "7%", labelFr: "Taux d'actualisation (WACC)", labelEn: "Discount rate (WACC)" },
    omCostSolar: { value: "1.0%/an", labelFr: "O&M solaire (% CAPEX)", labelEn: "Solar O&M (% CAPEX)" },
    omCostBattery: { value: "0.5%/an", labelFr: "O&M stockage (% CAPEX)", labelEn: "Storage O&M (% CAPEX)" },
  },

  // === EXCLUSIONS ===
  exclusions: [
    { labelFr: "Travaux de toiture préalables (si requis)", labelEn: "Prior roof work (if required)" },
    { labelFr: "Mise à niveau électrique (si requis)", labelEn: "Electrical upgrades (if required)" },
    { labelFr: "Permis municipaux (variables selon localité)", labelEn: "Municipal permits (vary by locality)" },
    { labelFr: "Modifications structurales", labelEn: "Structural modifications" },
    { labelFr: "Frais d'interconnexion avec Hydro-Québec", labelEn: "Hydro-Québec interconnection fees" },
  ],

  // === ÉQUIPEMENT INDICATIF ===
  equipment: [
    {
      labelFr: "Panneaux Jinko Solar N-type TOPCon",
      labelEn: "Jinko Solar N-type TOPCon panels",
      warrantyFr: "30 ans",
      warrantyEn: "30 years",
      iconCode: "panel",
      specsFr: "JKM660N-66QL6-BDV 660 Wc bifacial",
      specsEn: "JKM660N-66QL6-BDV 660 Wp bifacial",
      weightKg: 32.5,
      dimensionsMm: "2382 × 1134 × 30",
      powerW: 660,
      efficiencyPct: 24.43,
      certifications: ["CSA", "UL 61730", "IEC 61215:2021", "IEC 61730:2023"],
    },
    {
      labelFr: "Onduleurs certifiés CSA/UL",
      labelEn: "CSA/UL certified inverters",
      warrantyFr: "10-15 ans",
      warrantyEn: "10-15 years",
      iconCode: "inverter",
      specsFr: "Onduleur string triphasé ≥ 100 kW",
      specsEn: "Three-phase string inverter ≥ 100 kW",
      weightKg: 88,
      dimensionsMm: "1035 × 700 × 363",
      powerW: 100000,
      efficiencyPct: 98.3,
      certifications: ["CSA C22.2", "UL 1741", "IEEE 1547"],
    },
    {
      labelFr: "Structure de montage KB Racking",
      labelEn: "KB Racking mounting structure",
      warrantyFr: "25 ans",
      warrantyEn: "25 years",
      iconCode: "mounting",
      specsFr: "Système ballasté toit plat EcoFoot2+",
      specsEn: "EcoFoot2+ flat roof ballasted system",
      weightKg: null,
      dimensionsMm: null,
      powerW: null,
      efficiencyPct: null,
      certifications: ["CSA S157", "NBCC 2020", "Ingénierie scellée / P.Eng. stamped"],
    },
    {
      labelFr: "Main d'œuvre certifiée",
      labelEn: "Certified workmanship",
      warrantyFr: "10 ans",
      warrantyEn: "10 years",
      iconCode: "workmanship",
      specsFr: "Entrepreneur licencié RBQ 1.3",
      specsEn: "RBQ 1.3 licensed general contractor",
      weightKg: null,
      dimensionsMm: null,
      powerW: null,
      efficiencyPct: null,
      certifications: ["RBQ 1.3", "CNESST", "CCQ"],
    },
  ],

  // === RÉSUMÉ TECHNIQUE ÉQUIPEMENT ===
  equipmentTechnicalSummary: {
    panelWeightKgPerM2: { value: 12.0, labelFr: "Poids des panneaux par m²", labelEn: "Panel weight per m²", unit: "kg/m²" },
    rackingWeightKgPerM2: { value: 4.5, labelFr: "Poids de la structure par m²", labelEn: "Racking weight per m²", unit: "kg/m²" },
    totalSystemWeightKgPerM2: { value: 16.5, labelFr: "Poids total système par m²", labelEn: "Total system weight per m²", unit: "kg/m²" },
    totalSystemWeightPsfPerSf: { value: 3.4, labelFr: "Charge totale (lb/pi²)", labelEn: "Total load (psf)", unit: "psf" },
    windLoadDesign: { labelFr: "Conçu pour charges de vent selon NBCC 2020", labelEn: "Designed for wind loads per NBCC 2020" },
    snowLoadNote: { labelFr: "Compatible avec charges de neige typiques au Québec (> 3.5 kPa)", labelEn: "Compatible with typical Quebec snow loads (> 3.5 kPa)" },
  },

  // === PARCOURS CLIENT UNIFIÉ (6 étapes, 3 phases) ===
  timeline: [
    // Phase Découverte (gratuit, sans engagement)
    { stepFr: "Analyse gratuite", stepEn: "Free Analysis", durationFr: "Quelques minutes", durationEn: "A few minutes", iconCode: "analysis", phase: "discovery" },
    { stepFr: "Étude personnalisée", stepEn: "Personalized Study", durationFr: "48-72h", durationEn: "48-72h", iconCode: "study", phase: "discovery" },
    // Phase Conception (engagement initial)
    { stepFr: "Mandat de conception", stepEn: "Design Mandate", durationFr: "Signature + frais", durationEn: "Signature + fees", iconCode: "mandate", phase: "design" },
    { stepFr: "Visite technique & proposition", stepEn: "Site Visit & Proposal", durationFr: "2-3 semaines", durationEn: "2-3 weeks", iconCode: "visit", phase: "design" },
    // Phase Réalisation (clé en main)
    { stepFr: "Permis & approvisionnement", stepEn: "Permits & Procurement", durationFr: "6-10 semaines", durationEn: "6-10 weeks", iconCode: "permits", phase: "execution" },
    { stepFr: "Installation & mise en service", stepEn: "Installation & Commissioning", durationFr: "4-8 semaines", durationEn: "4-8 weeks", iconCode: "install", phase: "execution" },
  ],

  // === PROJECT SNAPSHOT LABELS ===
  projectSnapshotLabels: {
    annualConsumption: { labelFr: "Consommation annuelle", labelEn: "Annual consumption", unit: "kWh" },
    peakDemand: { labelFr: "Demande de pointe", labelEn: "Peak demand", unit: "kW" },
    currentTariff: { labelFr: "Tarif Hydro-Québec actuel", labelEn: "Current Hydro-Québec tariff", unit: "" },
    estimatedProduction: { labelFr: "Production solaire an 1", labelEn: "Year-1 solar production", unit: "kWh" },
    selfConsumptionRate: { labelFr: "Taux d'autoconsommation", labelEn: "Self-consumption rate", unit: "%" },
    solarCapacity: { labelFr: "Puissance solaire proposée", labelEn: "Proposed solar capacity", unit: "kWc" },
    batteryCapacity: { labelFr: "Stockage proposé", labelEn: "Proposed storage", unit: "kWh" },
  },

  // === NEXT STEPS AMÉLIORÉS ===
  designFeeCovers: [
    { labelFr: "Visite technique sur site par ingénieur certifié", labelEn: "On-site technical visit by certified engineer" },
    { labelFr: "Analyse structurelle et conception préliminaire", labelEn: "Structural analysis and preliminary design" },
    { labelFr: "Préparation dossier interconnexion Hydro-Québec", labelEn: "Hydro-Québec interconnection application prep" },
    { labelFr: "Proposition ferme avec prix garanti et échéancier", labelEn: "Firm proposal with guaranteed price and timeline" },
  ],

  // === MANDAT DE CONCEPTION — PRIX ET POSITIONNEMENT ===
  designMandate: {
    price: 5500,
    currency: "CAD",
    labelFr: "Mandat de conception",
    labelEn: "Design Mandate",
    priceLabelFr: "5 500$ + taxes",
    priceLabelEn: "$5,500 + taxes",
    descriptionFr: "Étude complète de conception et d'ingénierie pour votre projet solaire.",
    descriptionEn: "Complete design and engineering study for your solar project.",
    includes: [
      { labelFr: "Visite de site avec ingénieur en structure, électricien et technicien kWh", labelEn: "On-site visit with structural engineer, electrician, and kWh technician" },
      { labelFr: "Analyse d'ombrage sur site", labelEn: "On-site shade analysis" },
      { labelFr: "Plans complets pour soumission", labelEn: "Complete plans for submission" },
      { labelFr: "Modèle 3D de l'installation", labelEn: "3D installation model" },
      { labelFr: "Projections financières détaillées", labelEn: "Detailed financial projections" },
      { labelFr: "Optimisation des incitatifs disponibles", labelEn: "Available incentives optimization" },
      { labelFr: "Comparaison des options de financement", labelEn: "Financing options comparison" },
      { labelFr: "Rapport complet livré même si des travaux correctifs sont requis", labelEn: "Complete report delivered even if corrective work is required" },
    ],
    valuePropositionFr: "Rapport complet et utilisable indépendamment du fournisseur choisi. L'étude a une valeur concrète pour votre décision.",
    valuePropositionEn: "Complete and usable report regardless of which provider you choose. The study has concrete value for your decision.",
  },

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
    { labelFr: "Dossier prêt pour demande Hydro-Québec", labelEn: "File ready for Hydro-Québec application" },
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
        labelFr: "Coûts d'installation élevés",
        labelEn: "High installation costs",
      },
      {
        labelFr: "Aucune subvention significative",
        labelEn: "No significant incentives",
      },
      {
        labelFr: "Rendement des panneaux plus faible",
        labelEn: "Lower panel efficiency",
      },
      {
        labelFr: "Tarifs Hydro-Québec bas = retour trop long",
        labelEn: "Low Hydro-Québec rates = payback too long",
      },
    ],
    nowTitle: {
      fr: "Aujourd'hui: ce qui a changé",
      en: "Today: What Has Changed",
    },
    nowReasons: [
      {
        labelFr: "Réduction importante des coûts d'installation",
        labelEn: "Significant reduction in installation costs",
      },
      {
        labelFr: "Incitatifs Hydro-Québec — Jusqu'à 1 000 $/kW",
        labelEn: "Hydro-Québec Incentives — Up to $1,000/kW",
      },
      {
        labelFr: "Crédit d'impôt fédéral (CII) 30%",
        labelEn: "Federal Investment Tax Credit (ITC) 30%",
      },
      {
        labelFr: "Hausses de coûts énergétiques",
        labelEn: "Rising energy costs",
      },
      {
        labelFr: "Technologie bifaciale + rendements supérieurs",
        labelEn: "Bifacial technology + higher yields",
      },
      {
        labelFr: "Mesurage net — crédits sur 24 mois",
        labelEn: "Net metering — 24-month credit bank",
      },
      {
        labelFr: "Amortissement fiscal accéléré (DPA 43.1/43.2)",
        labelEn: "Accelerated depreciation (CCA 43.1/43.2)",
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
        realityFr: "Dimensionné sur la production annuelle. Mesurage net = crédits sur 24 mois.",
        realityEn: "Sized on annual production. Net metering = 24-month credit bank.",
      },
      {
        mythFr: "Le froid réduit la performance",
        mythEn: "Cold reduces performance",
        realityFr: "L'inverse : le froid améliore l'efficacité (+0,4%/°C sous 25 °C).",
        realityEn: "The opposite: cold improves efficiency (+0.4%/°C below 25°C).",
      },
      {
        mythFr: "La neige bloque les panneaux",
        mythEn: "Snow blocks panels",
        realityFr: "Glisse rapidement sur panneaux inclinés. Effet albédo = bonus 5-10%.",
        realityEn: "Slides off tilted panels quickly. Albedo effect = 5-10% bonus.",
      },
      {
        mythFr: "Journées courtes = non viable",
        mythEn: "Short days = unviable",
        realityFr: "Longs étés québécois (15h+) compensent. Production annuelle totale compte.",
        realityEn: "Long Quebec summers (15h+) compensate. Total annual production matters.",
      },
      {
        mythFr: "Pas fait ses preuves au Québec",
        mythEn: "Unproven in Quebec",
        realityFr: "25+ ans de données réelles. Milliers de systèmes C&I en climats nordiques.",
        realityEn: "25+ years of real data. Thousands of C&I systems in northern climates.",
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

export function getAssumptions(lang: Lang, isSyntheticData?: boolean) {
  const rows = Object.values(BRAND_CONTENT.assumptions).map(a => ({
    label: lang === "fr" ? a.labelFr : a.labelEn,
    value: a.value,
  }));

  if (isSyntheticData !== undefined) {
    if (isSyntheticData) {
      rows.push({
        label: lang === "fr" ? "\u26A0\uFE0F Source consommation" : "\u26A0\uFE0F Consumption source",
        value: lang === "fr" ? "Données synthétiques (estimation)" : "Synthetic data (estimate)",
      });
    } else {
      rows.push({
        label: lang === "fr" ? "Source consommation" : "Consumption source",
        value: lang === "fr" ? "Données Hydro-Québec réelles" : "Real Hydro-Québec data",
      });
    }
  }

  return rows;
}

export function getExclusions(lang: Lang) {
  return BRAND_CONTENT.exclusions.map(e => (lang === "fr" ? e.labelFr : e.labelEn));
}

export function getEquipment(lang: Lang) {
  return BRAND_CONTENT.equipment.map(e => ({
    label: lang === "fr" ? e.labelFr : e.labelEn,
    warranty: lang === "fr" ? e.warrantyFr : e.warrantyEn,
    specs: lang === "fr" ? e.specsFr : e.specsEn,
    weightKg: e.weightKg,
    dimensionsMm: e.dimensionsMm,
    powerW: e.powerW,
    efficiencyPct: e.efficiencyPct,
    certifications: e.certifications,
    iconCode: e.iconCode,
  }));
}

export function getEquipmentTechnicalSummary(lang: Lang) {
  const s = BRAND_CONTENT.equipmentTechnicalSummary;
  return {
    panelWeightKgPerM2: { value: s.panelWeightKgPerM2.value, label: lang === "fr" ? s.panelWeightKgPerM2.labelFr : s.panelWeightKgPerM2.labelEn, unit: s.panelWeightKgPerM2.unit },
    rackingWeightKgPerM2: { value: s.rackingWeightKgPerM2.value, label: lang === "fr" ? s.rackingWeightKgPerM2.labelFr : s.rackingWeightKgPerM2.labelEn, unit: s.rackingWeightKgPerM2.unit },
    totalSystemWeightKgPerM2: { value: s.totalSystemWeightKgPerM2.value, label: lang === "fr" ? s.totalSystemWeightKgPerM2.labelFr : s.totalSystemWeightKgPerM2.labelEn, unit: s.totalSystemWeightKgPerM2.unit },
    totalSystemWeightPsfPerSf: { value: s.totalSystemWeightPsfPerSf.value, label: lang === "fr" ? s.totalSystemWeightPsfPerSf.labelFr : s.totalSystemWeightPsfPerSf.labelEn, unit: s.totalSystemWeightPsfPerSf.unit },
    windLoadDesign: lang === "fr" ? s.windLoadDesign.labelFr : s.windLoadDesign.labelEn,
    snowLoadNote: lang === "fr" ? s.snowLoadNote.labelFr : s.snowLoadNote.labelEn,
  };
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

export function getDesignMandatePrice(lang: Lang): string {
  return lang === "fr" ? BRAND_CONTENT.designMandate.priceLabelFr : BRAND_CONTENT.designMandate.priceLabelEn;
}

export function getDesignMandateLabel(lang: Lang): string {
  return lang === "fr" ? BRAND_CONTENT.designMandate.labelFr : BRAND_CONTENT.designMandate.labelEn;
}

export function getDesignMandateIncludes(lang: Lang): string[] {
  return BRAND_CONTENT.designMandate.includes.map(i => (lang === "fr" ? i.labelFr : i.labelEn));
}

export function getDesignMandateDescription(lang: Lang): string {
  return lang === "fr" ? BRAND_CONTENT.designMandate.descriptionFr : BRAND_CONTENT.designMandate.descriptionEn;
}

export function getDesignMandateValueProp(lang: Lang): string {
  return lang === "fr" ? BRAND_CONTENT.designMandate.valuePropositionFr : BRAND_CONTENT.designMandate.valuePropositionEn;
}

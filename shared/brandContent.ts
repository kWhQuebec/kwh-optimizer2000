// ============================================
// SINGLE SOURCE OF TRUTH - CONTENU MARKETING
// Modifier ici = mise à jour partout (PDF, PPTX, Web)
// ============================================

export const BRAND_CONTENT = {
  // === STATS DE CRÉDIBILITÉ ===
  stats: {
    yearsExperience: { value: "15+", labelFr: "Années d'expérience cumulée en énergie", labelEn: "Years of combined energy experience" },
    mwInstalled: { value: "120", labelFr: "MW installés", labelEn: "MW installed" },
    projectsCI: { value: "25+", labelFr: "Projets C&I", labelEn: "C&I Projects" },
  },

  // === POURQUOI kWh QUÉBEC — VALEURS ===
  values: [
    { id: "simplicite", labelFr: "Simplicité", labelEn: "Simplicity", descFr: "Solution clé en main — on s'occupe de tout !", descEn: "Turnkey solution — we handle everything!" },
    { id: "fiabilite", labelFr: "Fiabilité", labelEn: "Reliability", descFr: "Performance garantie. On respecte nos engagements, toujours !", descEn: "Guaranteed performance. We keep our commitments, always!" },
    { id: "perennite", labelFr: "Pérennité", labelEn: "Sustainability", descFr: "On bâtit des relations et des solutions pour le long terme.", descEn: "We build relationships and solutions for the long term." },
    { id: "fierte", labelFr: "Fierté", labelEn: "Pride", descFr: "On est fier des projets que nous réalisons et de l'impact qu'ils ont sur nos clients et sur l'environnement.", descEn: "We're proud of the projects we deliver and the impact they have on our clients and the environment." },
  ],

  // === CREDIBILITY DESCRIPTION ===
  credibilityDescription: {
    fr: "Nous avons assemblé une équipe qui accompagne les entreprises partout au Canada dans leurs projets d'énergie renouvelable depuis 2010. En tant que Québécois, nous sommes fiers de vous offrir des solutions solaires maintenant rentables ici au Québec.",
    en: "We have assembled a team supporting businesses across Canada in renewable energy projects since 2010. As Quebecers, we're proud to offer solar solutions that are now profitable here in Quebec.",
  },

  // === CREDIBILITY BENEFITS ===
  credibilityBenefits: [
    { labelFr: "Licence RBQ", labelEn: "RBQ Licensed" },
    { labelFr: "Financement flexible", labelEn: "Flexible Financing" },
    { labelFr: "Garantie 25 ans", labelEn: "25-Year Warranty" },
    { labelFr: "Partout au Québec", labelEn: "Across Quebec" },
  ],

  // === CONTACT ===
  contact: {
    email: "info@kwh.quebec",
    phone: "514.427.8871",
    website: "www.kwh.quebec",
  },

  // === CALENDLY BOOKING ===
  calendly: {
    urlEnvVar: "VITE_CALENDLY_URL",
    fallbackUrl: "mailto:ventes@kwh.quebec?subject=Demande%20appel%20d%C3%A9couverte",
    height: "650px",
    labelFr: "Demander un appel découverte",
    labelEn: "Request a discovery call",
    descriptionFr: "Un appel découverte de 10 minutes pour valider votre projet et planifier les prochaines étapes.",
    descriptionEn: "A 10-minute discovery call to validate your project and plan next steps.",
  },

  // === TITRES DE SECTIONS ===
  sectionTitles: {
    trustUs: { fr: "POURQUOI kWh QUÉBEC", en: "WHY kWh QUÉBEC" },
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
    pvDegradation: { value: "0.35-0.5%/an", labelFr: "Dégradation panneaux (après année 1; initiale ~1-2% selon fabricant)", labelEn: "Panel degradation (after Year 1; initial ~1-2% per manufacturer)" },
    dcAcRatio: { value: "1.45", labelFr: "Ratio DC:AC (ILR)", labelEn: "DC:AC ratio (ILR)" },
    systemLosses: { value: "~5.4%", labelFr: "Pertes système nettes (PVSyst)", labelEn: "Net system losses (PVSyst)" },
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
      tierLabelFr: "Modules solaires Tier 1",
      tierLabelEn: "Tier 1 Solar Modules",
      tierDescFr: "Fabricant classé Tier 1 par Bloomberg NEF — fiabilité bancaire confirmée",
      tierDescEn: "Bloomberg NEF Tier 1 rated manufacturer — bankability confirmed",
      tier: "Tier 1",
      manufacturer: "Jinko Solar",
      warrantyFr: "30 ans",
      warrantyEn: "30 years",
      iconCode: "panel",
      specsFr: "JKM-625N-66HL4M-BDV 625 Wc bifacial",
      specsEn: "JKM-625N-66HL4M-BDV 625 Wp bifacial",
      weightKg: 32.6,
      dimensionsMm: "2382 × 1134 × 30",
      powerW: 625,
      efficiencyPct: 23.13,
      certifications: ["CSA", "UL 61730", "IEC 61215:2021", "IEC 61730:2023"],
    },
    {
      labelFr: "Onduleurs Kaco Blueplanet",
      labelEn: "Kaco Blueplanet inverters",
      tierLabelFr: "Onduleurs Tier 1",
      tierLabelEn: "Tier 1 Inverters",
      tierDescFr: "Rendement > 98%, certifié pour interconnexion réseau nord-américain",
      tierDescEn: "Efficiency > 98%, certified for North American grid interconnection",
      tier: "Tier 1",
      manufacturer: "Kaco New Energy",
      warrantyFr: "10 ans (ext. 15 ans)",
      warrantyEn: "10 yrs (ext. 15 yrs)",
      iconCode: "inverter",
      specsFr: "Blueplanet 375 TL3 — 375 kWac triphasé",
      specsEn: "Blueplanet 375 TL3 — 375 kWac three-phase",
      weightKg: 120,
      dimensionsMm: "1060 × 820 × 365",
      powerW: 375000,
      efficiencyPct: 98.6,
      certifications: ["CSA C22.2", "UL 1741", "IEEE 1547"],
    },
    {
      labelFr: "Structure de montage KB Racking",
      labelEn: "KB Racking mounting structure",
      tierLabelFr: "Structure de montage Tier 1",
      tierLabelEn: "Tier 1 Mounting System",
      tierDescFr: "Système ballasté sans pénétration — ingénierie scellée par un ingénieur",
      tierDescEn: "Non-penetrating ballasted system — P.Eng. sealed engineering",
      tier: "Tier 1",
      manufacturer: "KB Racking",
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
      tierLabelFr: "Équipe certifiée kWh Québec",
      tierLabelEn: "kWh Québec Certified Team",
      tierDescFr: "Entrepreneur licencié RBQ, équipes CCQ & CNESST conformes",
      tierDescEn: "RBQ licensed contractor, CCQ & CNESST compliant crews",
      tier: "kWh",
      manufacturer: "kWh Québec",
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

  // === ÉQUIPEMENT BATTERIE (conditionnel) ===
  batteryEquipment: {
    labelFr: "Batterie BESS",
    labelEn: "BESS Battery",
    manufacturer: "BYD",
    warrantyFr: "10 ans / 6 000 cycles",
    warrantyEn: "10 yr / 6,000 cycles",
    iconCode: "battery",
    specsFr: "Battery-Box Premium",
    specsEn: "Battery-Box Premium",
    weightKg: null,
    dimensionsMm: null,
    certifications: ["UL 9540A", "IEC 62619"],
  },

  // === RÉSUMÉ TECHNIQUE ÉQUIPEMENT ===
  equipmentTechnicalSummary: {
    panelWeightKgPerM2: { value: 12.0, labelFr: "Poids des panneaux par m²", labelEn: "Panel weight per m²", unit: "kg/m²" },
    rackingWeightKgPerM2: { value: 4.5, labelFr: "Poids de la structure par m²", labelEn: "Racking weight per m²", unit: "kg/m²" },
    totalSystemWeightKgPerM2: { value: 16.5, labelFr: "Poids total système par m²", labelEn: "Total system weight per m²", unit: "kg/m²" },
    totalSystemWeightPsfPerSf: { value: 3.4, labelFr: "Charge totale (lb/p²)", labelEn: "Total load (lb/sf)", unitFr: "lb/p²", unitEn: "lb/sf" },
    windLoadDesign: { labelFr: "Conçu pour charges de vent selon NBCC 2020", labelEn: "Designed for wind loads per NBCC 2020" },
    snowLoadNote: { labelFr: "Compatible avec charges de neige typiques au Québec (> 3.5 kPa)", labelEn: "Compatible with typical Quebec snow loads (> 3.5 kPa)" },
  },

  // === PARCOURS CLIENT UNIFIÉ (5 étapes) ===
  timeline: [
    // Phase Exploration (gratuit, sans engagement)
    {
      stepFr: "Analyse rapide du potentiel", stepEn: "Quick Potential Analysis",
      durationFr: "Quelques minutes", durationEn: "A few minutes",
      iconCode: "analysis", phase: "discovery",
      bulletsFr: [
        "Calcul basé sur votre facture Hydro-Québec",
        "Estimation des économies et du retour sur investissement",
        "Résultats instantanés envoyés par courriel",
      ],
      bulletsEn: [
        "Calculation based on your Hydro-Québec bill",
        "Savings and ROI estimate",
        "Instant results sent by email",
      ],
    },
    {
      stepFr: "Validation économique", stepEn: "Economic Validation",
      durationFr: "7 jours", durationEn: "7 days",
      iconCode: "study", phase: "discovery",
      bulletsFr: [
        "Analyse du profil énergétique de votre immeuble",
        "Rapport détaillé des impacts financiers et environnementaux",
        "Outils de présentation clairs et faciles à partager (PDF, présentation PPT, portail en ligne)",
      ],
      bulletsEn: [
        "Energy profile analysis of your building",
        "Detailed financial and environmental impact report",
        "Clear, shareable presentation tools (PDF, PPT presentation, online portal)",
      ],
    },
    // Phase Conception (engagement initial — mandat 2 500$ créditable)
    {
      stepFr: "Validation technique", stepEn: "Technical Validation",
      durationFr: "2-3 semaines", durationEn: "2-3 weeks",
      iconCode: "design", phase: "design",
      bulletsFr: [
        "Visite de site, inspection du toit et revue de la salle électrique",
        "Confirmation de la possibilité de raccordement au réseau Hydro-Québec",
        "Conception détaillée, liste des équipements et soumission forfaitaire pour l'ensemble du projet",
      ],
      bulletsEn: [
        "Site visit, roof inspection and electrical room review",
        "Confirmation of Hydro-Québec grid connection feasibility",
        "Detailed design, equipment list and fixed-price quote for the entire project",
      ],
    },
    // Phase Réalisation (clé en main)
    {
      stepFr: "Ingénierie, plans & devis", stepEn: "Engineering, Plans & Quotes",
      durationFr: "4-8 semaines", durationEn: "4-8 weeks",
      iconCode: "plans", phase: "execution",
      bulletsFr: [
        "Validation de la capacité portante du toit par ingénieur en structure",
        "Plans et devis pour construction préparés par ingénieur électrique",
        "Dossier complet pour financement et incitatifs",
      ],
      bulletsEn: [
        "Roof load capacity validation by structural engineer",
        "Construction plans and specs prepared by electrical engineer",
        "Complete file for financing and incentives",
      ],
    },
    {
      stepFr: "Permis & installation clé en main", stepEn: "Permits & Turnkey Installation",
      durationFr: "10-18 semaines", durationEn: "10-18 weeks",
      iconCode: "install", phase: "execution",
      bulletsFr: [
        "Permis municipal et approbation Hydro-Québec",
        "Installation par techniciens kWh compétents et assurés (CCQ & CNESST)",
        "Mise en service, monitoring et garanties",
      ],
      bulletsEn: [
        "Municipal permit and Hydro-Québec approval",
        "Installation by qualified and insured kWh technicians (CCQ & CNESST)",
        "Commissioning, monitoring and warranties",
      ],
    },
  ],

  // === PROJECT SNAPSHOT LABELS ===
  projectSnapshotLabels: {
    annualConsumption: { labelFr: "Consommation annuelle", labelEn: "Annual consumption", unit: "kWh" },
    peakDemand: { labelFr: "Demande de pointe", labelEn: "Peak demand", unit: "kW" },
    currentTariff: { labelFr: "Tarif Hydro-Québec actuel", labelEn: "Current Hydro-Québec tariff", unit: "" },
    estimatedProduction: { labelFr: "Production solaire an 1", labelEn: "Year-1 solar production", unit: "kWh" },
    selfConsumptionRate: { labelFr: "Couverture énergétique", labelEn: "Energy Coverage", unit: "%" },
    solarCapacity: { labelFr: "Puissance solaire proposée", labelEn: "Proposed solar capacity", unit: "kWc" },
    batteryCapacity: { labelFr: "Stockage proposé", labelEn: "Proposed storage", unit: "kWh" },
  },

  // === NEXT STEPS AMÉLIORÉS ===
  designFeeCovers: [
    { labelFr: "Visite technique sur site", labelEn: "On-site technical visit" },
    { labelFr: "Validation toiture et structure", labelEn: "Roof and structural validation" },
    { labelFr: "Évaluation salle électrique", labelEn: "Electrical room assessment" },
    { labelFr: "Layout préliminaire et confirmation de faisabilité", labelEn: "Preliminary layout and feasibility confirmation" },
  ],

  // === MANDAT DE CONCEPTION PRÉLIMINAIRE — PRIX ET POSITIONNEMENT ===
  designMandate: {
    price: 2500,
    currency: "CAD",
    labelFr: "Mandat de conception préliminaire",
    labelEn: "Preliminary Design Mandate",
    priceLabelFr: "2 500$ + taxes",
    priceLabelEn: "$2,500 + taxes",
    pricePer: "building",
    descriptionFr: "Validation terrain et faisabilité de votre projet solaire. Ne comprend pas l'ingénierie détaillée ni les plans de construction.",
    descriptionEn: "On-site validation and feasibility assessment for your solar project. Does not include detailed engineering or construction plans.",
    includes: [
      { labelFr: "Visite de site avec technicien kWh qualifié", labelEn: "On-site visit with qualified kWh technician" },
      { labelFr: "Validation de l'état de la toiture et de la structure", labelEn: "Roof and structural condition validation" },
      { labelFr: "Évaluation de la salle électrique et de la capacité", labelEn: "Electrical room assessment and capacity evaluation" },
      { labelFr: "Layout préliminaire du système", labelEn: "Preliminary system layout" },
      { labelFr: "Validation des hypothèses de l'étude initiale", labelEn: "Validation of initial study assumptions" },
      { labelFr: "Photos et documentation du site", labelEn: "Site photos and documentation" },
      { labelFr: "Confirmation de faisabilité (go / no-go)", labelEn: "Feasibility confirmation (go / no-go)" },
    ],
    excludes: [
      { labelFr: "Ingénierie structurelle détaillée", labelEn: "Detailed structural engineering" },
      { labelFr: "Plans et devis pour construction", labelEn: "Construction plans and specifications" },
      { labelFr: "Demande d'interconnexion Hydro-Québec", labelEn: "Hydro-Québec interconnection application" },
      { labelFr: "Permis de construction", labelEn: "Building permits" },
    ],
    creditPolicyFr: "Montant crédité intégralement sur le contrat EPC si vous procédez avec kWh Québec.",
    creditPolicyEn: "Amount fully credited toward the EPC contract if you proceed with kWh Québec.",
    valuePropositionFr: "Étape essentielle pour valider la faisabilité avant de s'engager dans un contrat EPC complet. Montant crédité si vous procédez.",
    valuePropositionEn: "Essential step to validate feasibility before committing to a full EPC contract. Amount credited if you proceed.",
  },

  clientProvides: [
    { labelFr: "Données de consommation Hydro-Québec (CSV ou procuration)", labelEn: "Hydro-Québec consumption data (CSV or authorization)" },
    { labelFr: "Informations toiture (âge, état)", labelEn: "Roof information (age, condition)" },
    { labelFr: "Schéma unifilaire (si disponible)", labelEn: "Single-line diagram (if available)" },
    { labelFr: "Confirmation propriété / bail", labelEn: "Ownership / lease confirmation" },
  ],

  clientReceives: [
    { labelFr: "Soumission forfaitaire avec prix garantis", labelEn: "Firm quote with guaranteed pricing" },
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
        labelFr: "Incitatifs Hydro-Québec (Solutions efficaces — OSE 6.0) — Jusqu'à 1 000 $/kW",
        labelEn: "Hydro-Québec Incentives (Solutions efficaces — OSE 6.0) — Up to $1,000/kW",
      },
      {
        labelFr: "Crédit d'impôt fédéral (CII) jusqu'à 30% pour les entreprises admissibles",
        labelEn: "Federal Investment Tax Credit (ITC) up to 30% for eligible businesses",
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
        labelFr: "Amortissement fiscal accéléré (DPA 43.1/43.2 — sous réserve d'éligibilité, consultez votre comptable)",
        labelEn: "Accelerated depreciation (CCA 43.1/43.2 — subject to eligibility, consult your accountant)",
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
        realityFr: "Étude NAIT (5 ans, Edmonton) : seulement ~5% de perte annuelle à 10°. Effet albédo = bonus 5-10%.",
        realityEn: "NAIT study (5 years, Edmonton): only ~5% annual loss at 10°. Albedo effect = 5-10% bonus.",
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

  // === MESSAGING LANES (Business Driver) ===
  messagingLanes: {
    cost_savings: {
      headlineFr: "Réduisez vos coûts énergétiques de façon permanente",
      headlineEn: "Permanently reduce your energy costs",
      sublineFr: "Un investissement qui génère des économies dès le premier jour, avec un retour garanti par les données réelles de votre bâtiment.",
      sublineEn: "An investment that generates savings from day one, with returns backed by your building's actual data.",
      iconEmoji: "💰",
      color: "#16A34A",
    },
    resilience: {
      headlineFr: "Protégez vos opérations contre les pannes et hausses tarifaires",
      headlineEn: "Protect your operations from outages and rate increases",
      sublineFr: "Le solaire avec stockage assure la continuité de vos activités critiques, peu importe ce qui arrive au réseau.",
      sublineEn: "Solar with storage ensures continuity of your critical operations, regardless of what happens to the grid.",
      iconEmoji: "🛡️",
      color: "#2563EB",
    },
    sustainability: {
      headlineFr: "Décarbonez vos opérations avec un impact mesurable",
      headlineEn: "Decarbonize your operations with measurable impact",
      sublineFr: "Atteignez vos objectifs ESG avec des données vérifiables et un plan d'action concret pour chaque bâtiment.",
      sublineEn: "Achieve your ESG goals with verifiable data and a concrete action plan for each building.",
      iconEmoji: "🌱",
      color: "#059669",
    },
    tax_capital: {
      headlineFr: "Optimisez votre fiscalité avec l'accélération de l'amortissement",
      headlineEn: "Optimize your tax position with accelerated depreciation",
      sublineFr: "Profitez de la DPA catégorie 43.1/43.2 (sous réserve des conditions d'éligibilité en vigueur — consultez votre comptable) et du crédit d'impôt fédéral (jusqu'à 30% pour les entreprises admissibles) pour maximiser le rendement net de votre investissement.",
      sublineEn: "Leverage CCA Class 43.1/43.2 (subject to current eligibility conditions — consult your accountant) and the federal ITC (up to 30% for eligible businesses) to maximize the net return on your investment.",
      iconEmoji: "📊",
      color: "#7C3AED",
    },
    other: {
      headlineFr: "Découvrez le potentiel solaire de votre bâtiment",
      headlineEn: "Discover your building's solar potential",
      sublineFr: "Une analyse personnalisée basée sur les données réelles de votre consommation et de votre toiture.",
      sublineEn: "A personalized analysis based on the actual data from your consumption and rooftop.",
      iconEmoji: "☀️",
      color: "#F59E0B",
    },
  },

  // === ASSURANCE DE LIVRAISON (Delivery Assurance) ===
  deliveryAssurance: [
    {
      phaseFr: "Pré-construction",
      phaseEn: "Pre-construction",
      durationFr: "2-4 semaines",
      durationEn: "2-4 weeks",
      deliverablesFr: ["Visite de site", "Évaluation structurelle", "Design préliminaire", "Demande Hydro-Québec"],
      deliverablesEn: ["Site visit", "Structural assessment", "Preliminary design", "Hydro-Québec application"],
      qaCheckpointFr: "Revue go/no-go avec client",
      qaCheckpointEn: "Go/no-go review with client",
    },
    {
      phaseFr: "Ingénierie",
      phaseEn: "Engineering",
      durationFr: "4-8 semaines",
      durationEn: "4-8 weeks",
      deliverablesFr: ["Plans électriques scellés", "Plans structurels", "Dossier de permis"],
      deliverablesEn: ["Sealed electrical plans", "Structural plans", "Permit package"],
      qaCheckpointFr: "Approbation P.Eng.",
      qaCheckpointEn: "P.Eng. approval",
    },
    {
      phaseFr: "Approvisionnement",
      phaseEn: "Procurement",
      durationFr: "4-6 semaines",
      durationEn: "4-6 weeks",
      deliverablesFr: ["Équipements commandés", "Fiches techniques confirmées", "Logistique planifiée"],
      deliverablesEn: ["Equipment ordered", "Datasheets confirmed", "Logistics planned"],
      qaCheckpointFr: "Inspection à réception",
      qaCheckpointEn: "Receiving inspection",
    },
    {
      phaseFr: "Installation",
      phaseEn: "Installation",
      durationFr: "2-6 semaines",
      durationEn: "2-6 weeks",
      deliverablesFr: ["Montage structure", "Câblage électrique", "Raccordements"],
      deliverablesEn: ["Racking installation", "Electrical wiring", "Connections"],
      qaCheckpointFr: "Inspection CNESST + ESA",
      qaCheckpointEn: "CNESST + ESA inspection",
    },
    {
      phaseFr: "Mise en service",
      phaseEn: "Commissioning",
      durationFr: "1-2 semaines",
      durationEn: "1-2 weeks",
      deliverablesFr: ["Tests de performance", "Formation opérateur", "Activation monitoring"],
      deliverablesEn: ["Performance testing", "Operator training", "Monitoring activation"],
      qaCheckpointFr: "Rapport de commissioning signé",
      qaCheckpointEn: "Signed commissioning report",
    },
  ],

  // === PARTENAIRES DE LIVRAISON ===
  deliveryPartners: [
    {
      roleFr: "Direction de projet",
      roleEn: "Project Management",
      nameFr: "kWh Québec",
      nameEn: "kWh Québec",
      qualificationFr: "RBQ 1.3 | 15+ ans exp.",
      qualificationEn: "RBQ 1.3 | 15+ yrs exp.",
    },
    {
      roleFr: "Ingénierie électrique",
      roleEn: "Electrical Engineering",
      nameFr: "CIMA+",
      nameEn: "CIMA+",
      qualificationFr: "OIQ | Plans scellés",
      qualificationEn: "PEO/OIQ | Sealed plans",
    },
    {
      roleFr: "Ingénierie structure",
      roleEn: "Structural Engineering",
      nameFr: "RJC Engineers",
      nameEn: "RJC Engineers",
      qualificationFr: "OIQ | Attestation capacité portante",
      qualificationEn: "PEO/OIQ | Load capacity cert.",
    },
    {
      roleFr: "Installation électrique",
      roleEn: "Electrical Installation",
      nameFr: "Sélectronix",
      nameEn: "Sélectronix",
      qualificationFr: "CCQ, CNESST & CMEQ",
      qualificationEn: "CCQ, CNESST & CMEQ",
    },
    {
      roleFr: "Monitoring & O&M",
      roleEn: "Monitoring & O&M",
      nameFr: "kWh Québec",
      nameEn: "kWh Québec",
      qualificationFr: "Suivi temps réel 24/7",
      qualificationEn: "24/7 Real-time monitoring",
    },
  ],

  // === FEUILLE DE ROUTE GARANTIES ===
  warrantyRoadmap: [
    {
      periodFr: "Mois 1",
      periodEn: "Month 1",
      itemsFr: ["Visite post-installation", "Vérification performance", "Ajustements monitoring"],
      itemsEn: ["Post-install visit", "Performance check", "Monitoring adjustments"],
    },
    {
      periodFr: "Année 1",
      periodEn: "Year 1",
      itemsFr: ["Rapport performance annuel", "Inspection visuelle", "Nettoyage panneaux"],
      itemsEn: ["Annual performance report", "Visual inspection", "Panel cleaning"],
    },
    {
      periodFr: "Années 2-10",
      periodEn: "Years 2-10",
      itemsFr: ["Garantie main d'œuvre 10 ans", "Garantie onduleur 10-15 ans", "Support technique continu"],
      itemsEn: ["10-yr workmanship warranty", "10-15 yr inverter warranty", "Ongoing tech support"],
    },
    {
      periodFr: "Années 10-25",
      periodEn: "Years 10-25",
      itemsFr: ["Garantie panneaux 25-30 ans", "Garantie puissance ≥85%", "Options remplacement onduleur"],
      itemsEn: ["25-30 yr panel warranty", "≥85% power guarantee", "Inverter replacement options"],
    },
  ],
};

// === HELPER FUNCTIONS ===

type Lang = "fr" | "en";

export function getAllStats(lang: Lang) {
  return Object.values(BRAND_CONTENT.stats).map(stat => ({
    value: stat.value,
    label: lang === "fr" ? stat.labelFr : stat.labelEn,
  }));
}

export function getValues(lang: Lang) {
  return BRAND_CONTENT.values.map(v => ({
    id: v.id,
    label: lang === "fr" ? v.labelFr : v.labelEn,
    description: lang === "fr" ? v.descFr : v.descEn,
  }));
}

export function getCredibilityDescription(lang: Lang): string {
  return BRAND_CONTENT.credibilityDescription[lang];
}

export function getCredibilityBenefits(lang: Lang) {
  return BRAND_CONTENT.credibilityBenefits.map(b => (lang === "fr" ? b.labelFr : b.labelEn));
}

export function getFirstTestimonial(lang: Lang) {
  return {
    quote: lang === "fr"
      ? BRAND_CONTENT.credibilityDescription.fr
      : BRAND_CONTENT.credibilityDescription.en,
    author: "kWh Québec",
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
    tierLabel: lang === "fr" ? e.tierLabelFr : e.tierLabelEn,
    tierDesc: lang === "fr" ? e.tierDescFr : e.tierDescEn,
    tier: e.tier,
    manufacturer: e.manufacturer,
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

export function getBatteryEquipment(lang: Lang) {
  const b = BRAND_CONTENT.batteryEquipment;
  return {
    label: lang === "fr" ? b.labelFr : b.labelEn,
    manufacturer: b.manufacturer,
    warranty: lang === "fr" ? b.warrantyFr : b.warrantyEn,
    specs: lang === "fr" ? b.specsFr : b.specsEn,
    weightKg: b.weightKg,
    dimensionsMm: b.dimensionsMm,
    certifications: b.certifications,
    iconCode: b.iconCode,
  };
}

export function getEquipmentTechnicalSummary(lang: Lang) {
  const s = BRAND_CONTENT.equipmentTechnicalSummary;
  return {
    panelWeightKgPerM2: { value: s.panelWeightKgPerM2.value, label: lang === "fr" ? s.panelWeightKgPerM2.labelFr : s.panelWeightKgPerM2.labelEn, unit: s.panelWeightKgPerM2.unit },
    rackingWeightKgPerM2: { value: s.rackingWeightKgPerM2.value, label: lang === "fr" ? s.rackingWeightKgPerM2.labelFr : s.rackingWeightKgPerM2.labelEn, unit: s.rackingWeightKgPerM2.unit },
    totalSystemWeightKgPerM2: { value: s.totalSystemWeightKgPerM2.value, label: lang === "fr" ? s.totalSystemWeightKgPerM2.labelFr : s.totalSystemWeightKgPerM2.labelEn, unit: s.totalSystemWeightKgPerM2.unit },
    totalSystemWeightPsfPerSf: { value: s.totalSystemWeightPsfPerSf.value, label: lang === "fr" ? s.totalSystemWeightPsfPerSf.labelFr : s.totalSystemWeightPsfPerSf.labelEn, unit: lang === "fr" ? s.totalSystemWeightPsfPerSf.unitFr : s.totalSystemWeightPsfPerSf.unitEn, unitFr: s.totalSystemWeightPsfPerSf.unitFr, unitEn: s.totalSystemWeightPsfPerSf.unitEn },
    windLoadDesign: lang === "fr" ? s.windLoadDesign.labelFr : s.windLoadDesign.labelEn,
    snowLoadNote: lang === "fr" ? s.snowLoadNote.labelFr : s.snowLoadNote.labelEn,
  };
}

export function getTimeline(lang: Lang) {
  return BRAND_CONTENT.timeline.map(t => ({
    step: lang === "fr" ? t.stepFr : t.stepEn,
    duration: lang === "fr" ? t.durationFr : t.durationEn,
    iconCode: t.iconCode,
    phase: t.phase,
    bullets: lang === "fr" ? (t.bulletsFr || []) : (t.bulletsEn || []),
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

export function getDesignMandateExcludes(lang: Lang): string[] {
  return BRAND_CONTENT.designMandate.excludes.map(i => (lang === "fr" ? i.labelFr : i.labelEn));
}

// === MESSAGING LANES ===

export type BusinessDriver = "cost_savings" | "resilience" | "sustainability" | "tax_capital" | "other";

export function getMessagingLane(driver: BusinessDriver | null | undefined, lang: Lang) {
  const lane = BRAND_CONTENT.messagingLanes[driver || "other"];
  return {
    headline: lang === "fr" ? lane.headlineFr : lane.headlineEn,
    subline: lang === "fr" ? lane.sublineFr : lane.sublineEn,
    iconEmoji: lane.iconEmoji,
    color: lane.color,
  };
}

export function getDesignMandateCreditPolicy(lang: Lang): string {
  return lang === "fr" ? BRAND_CONTENT.designMandate.creditPolicyFr : BRAND_CONTENT.designMandate.creditPolicyEn;
}

// === DELIVERY ASSURANCE ===

export function getDeliveryAssurance(lang: Lang) {
  return BRAND_CONTENT.deliveryAssurance.map(d => ({
    phase: lang === "fr" ? d.phaseFr : d.phaseEn,
    duration: lang === "fr" ? d.durationFr : d.durationEn,
    deliverables: lang === "fr" ? d.deliverablesFr : d.deliverablesEn,
    qaCheckpoint: lang === "fr" ? d.qaCheckpointFr : d.qaCheckpointEn,
  }));
}

export function getDeliveryPartners(lang: Lang) {
  return BRAND_CONTENT.deliveryPartners.map(p => ({
    role: lang === "fr" ? p.roleFr : p.roleEn,
    name: lang === "fr" ? p.nameFr : p.nameEn,
    qualification: lang === "fr" ? p.qualificationFr : p.qualificationEn,
  }));
}

export function getWarrantyRoadmap(lang: Lang) {
  return BRAND_CONTENT.warrantyRoadmap.map(w => ({
    period: lang === "fr" ? w.periodFr : w.periodEn,
    items: lang === "fr" ? w.itemsFr : w.itemsEn,
  }));
}


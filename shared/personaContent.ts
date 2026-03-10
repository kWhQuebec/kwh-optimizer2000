/**
 * Persona-specific content for targeted landing pages.
 * Based on reverse-engineering of the Optimizer financial engine.
 * Source: PERSONAS-CLIENTS-IDEAUX.md (6 mars 2026)
 *
 * 3 personas: Commerçant Tarif G, Industriel Tarif M, Gestionnaire Multi-Sites
 */

export interface FinancialScenario {
  title: { fr: string; en: string };
  subtitle: { fr: string; en: string };
  params: Array<{ label: { fr: string; en: string }; value: string }>;
  capexCascade: Array<{ label: { fr: string; en: string }; amount: string; isSubtract?: boolean }>;
  metrics: Array<{ label: { fr: string; en: string }; value: string; highlight?: boolean }>;
  footnote?: { fr: string; en: string };
}

export interface PersonaFAQ {
  question: { fr: string; en: string };
  answer: { fr: string; en: string };
}

export interface PersonaSignal {
  icon: string; // emoji
  text: { fr: string; en: string };
}

export interface PersonaData {
  id: string;
  slug: string;
  name: { fr: string; en: string };
  tagline: { fr: string; en: string };
  heroTitle: { fr: string; en: string };
  heroSubtitle: { fr: string; en: string };
  heroDescription: { fr: string; en: string };
  heroBadge: { fr: string; en: string };
  heroStatPrimary: { label: { fr: string; en: string }; value: string };
  heroStatSecondary: { label: { fr: string; en: string }; value: string };
  heroStatTertiary: { label: { fr: string; en: string }; value: string };
  tariff: string;
  tariffRate: string;
  systemSize: string;
  typicalTRI: string;
  typicalPayback: string;
  sectors: Array<{ fr: string; en: string }>;
  whyBest: Array<{ title: { fr: string; en: string }; description: { fr: string; en: string } }>;
  scenario: FinancialScenario;
  signals: PersonaSignal[];
  marketingMessage: { fr: string; en: string };
  faq: PersonaFAQ[];
  ctaText: { fr: string; en: string };
  ctaSecondary: { fr: string; en: string };
  seo: {
    title: { fr: string; en: string };
    description: { fr: string; en: string };
    keywords: { fr: string; en: string };
  };
}

// =========================================================================
// PERSONA 1 — Le Commerçant Rentable (Tarif G)
// =========================================================================
export const PERSONA_COMMERCIAL: PersonaData = {
  id: "commercial",
  slug: "commerces",
  name: { fr: "Le Commerçant Rentable", en: "The Profitable Retailer" },
  tagline: { fr: "Tarif G · TRI 18-25% · Payback 4-6 ans", en: "Rate G · 18-25% IRR · 4-6yr Payback" },
  heroTitle: {
    fr: "Votre facture à 12¢/kWh est votre meilleur atout solaire",
    en: "Your 12¢/kWh bill is your best solar asset",
  },
  heroSubtitle: {
    fr: "Les commerces sur Tarif G obtiennent le meilleur rendement solaire au Québec",
    en: "Businesses on Rate G get the best solar returns in Quebec",
  },
  heroDescription: {
    fr: "À 11,93¢/kWh, chaque kWh que vous produisez vaut presque le double d'un client industriel. Résultat : un retour sur investissement en 5 ans et un TRI supérieur à 19%. Sans batterie.",
    en: "At 11.93¢/kWh, every kWh you produce is worth nearly double that of an industrial client. Result: 5-year payback and over 19% IRR. No battery needed.",
  },
  heroBadge: { fr: "Meilleur TRI au Québec", en: "Best IRR in Quebec" },
  heroStatPrimary: { label: { fr: "TRI typique", en: "Typical IRR" }, value: "19%+" },
  heroStatSecondary: { label: { fr: "Payback", en: "Payback" }, value: "5 ans" },
  heroStatTertiary: { label: { fr: "Batterie requise", en: "Battery required" }, value: "Non" },
  tariff: "G",
  tariffRate: "11,93¢/kWh",
  systemSize: "50-150 kWc (100-300 panneaux)",
  typicalTRI: "18-25%",
  typicalPayback: "4-6 ans",
  sectors: [
    { fr: "Concessionnaires automobiles", en: "Car dealerships" },
    { fr: "Commerces de détail avec entrepôt", en: "Retail with warehouse" },
    { fr: "Centres de conditionnement physique", en: "Fitness centers" },
    { fr: "Restaurants et chaînes", en: "Restaurants and chains" },
    { fr: "Cliniques médicales et dentaires", en: "Medical and dental clinics" },
    { fr: "Garages et ateliers mécaniques", en: "Garages and mechanical shops" },
    { fr: "Bureaux avec serveurs/climatisation", en: "Offices with servers/HVAC" },
  ],
  whyBest: [
    {
      title: { fr: "Le taux le plus élevé au Québec", en: "Highest rate in Quebec" },
      description: {
        fr: "À 11,93¢/kWh, chaque kWh autoconsommé vaut presque le double d'un client Tarif M (6,06¢). L'autoconsommation frôle 90-95%.",
        en: "At 11.93¢/kWh, each self-consumed kWh is worth nearly double a Rate M client (6.06¢). Self-consumption nears 90-95%.",
      },
    },
    {
      title: { fr: "Aucune batterie nécessaire", en: "No battery needed" },
      description: {
        fr: "La composante puissance ne s'applique qu'au-dessus de 50 kW. Le gain potentiel du demand shaving ($0-$3 800/an) ne justifie pas un investissement batterie de $30k-$60k.",
        en: "The demand charge only applies above 50 kW. Potential demand shaving gains ($0-$3,800/yr) don't justify a $30k-$60k battery investment.",
      },
    },
    {
      title: { fr: "Projet simple, cycle court", en: "Simple project, short cycle" },
      description: {
        fr: "PV + raccordement + mesurage net. Pas de simulation horaire complexe. Conception en 3 semaines, installation en 2-4 semaines.",
        en: "PV + connection + net metering. No complex hourly simulation. Design in 3 weeks, installation in 2-4 weeks.",
      },
    },
  ],
  scenario: {
    title: { fr: "Scénario réel : Concessionnaire auto, 100 kWc (≈200 panneaux)", en: "Real scenario: Car dealership, 100 kW (≈200 panels)" },
    subtitle: {
      fr: "Consommation 350 000 kWh/an · Toit 1 200 m² (12 900 pi²) plat TPO blanc · Bifacial",
      en: "350,000 kWh/yr consumption · 1,200 m² (12,900 ft²) flat white TPO roof · Bifacial",
    },
    params: [
      { label: { fr: "Consommation annuelle", en: "Annual consumption" }, value: "350 000 kWh" },
      { label: { fr: "Appel de puissance", en: "Demand" }, value: "55 kW" },
      { label: { fr: "Tarif HQ", en: "HQ Rate" }, value: "G — 11,93¢/kWh" },
      { label: { fr: "Système PV", en: "PV System" }, value: "100 kWc bifacial (≈200 panneaux)" },
      { label: { fr: "Production annuelle", en: "Annual production" }, value: "132 200 kWh" },
      { label: { fr: "Autoconsommation", en: "Self-consumption" }, value: "~93%" },
    ],
    capexCascade: [
      { label: { fr: "CAPEX brut", en: "Gross CAPEX" }, amount: "230 000 $" },
      { label: { fr: "HQ OSE 6.0 (40%)", en: "HQ OSE 6.0 (40%)" }, amount: "−92 000 $", isSubtract: true },
      { label: { fr: "CII fédéral (30%)", en: "Federal ITC (30%)" }, amount: "−41 400 $", isSubtract: true },
      { label: { fr: "Bouclier fiscal DPA", en: "CCA Tax Shield" }, amount: "−23 054 $", isSubtract: true },
      { label: { fr: "CAPEX net", en: "Net CAPEX" }, amount: "73 546 $" },
    ],
    metrics: [
      { label: { fr: "Économies énergie An 1", en: "Energy Savings Yr 1" }, value: "14 675 $/an", highlight: true },
      { label: { fr: "Cash-flow net An 1", en: "Net Cash Flow Yr 1" }, value: "12 375 $/an" },
      { label: { fr: "Payback simple", en: "Simple Payback" }, value: "5,9 ans", highlight: true },
      { label: { fr: "TRI (25 ans)", en: "IRR (25 yrs)" }, value: "~19%", highlight: true },
      { label: { fr: "VAN (25 ans, 7%)", en: "NPV (25 yrs, 7%)" }, value: "~110 000 $" },
      { label: { fr: "Profit cumulé 25 ans", en: "25-yr cumulative profit" }, value: "~350 000 $" },
    ],
    footnote: {
      fr: "Avec inflation énergie 3,5%/an : économies de ~17 300 $/an en année 5 et ~24 800 $/an en année 15.",
      en: "With 3.5%/yr energy inflation: savings of ~$17,300/yr in year 5 and ~$24,800/yr in year 15.",
    },
  },
  signals: [
    { icon: "🏢", text: { fr: "Bâtiment commercial avec grand stationnement asphalté", en: "Commercial building with large paved parking lot" } },
    { icon: "📐", text: { fr: "Toit plat 400+ m² (4 300+ pi²) sans résidentiel au-dessus", en: "400+ m² (4,300+ ft²) flat roof with no residential above" } },
    { icon: "🔌", text: { fr: "Facture HQ mensuelle entre 1 500 $ et 5 000 $", en: "Monthly HQ bill between $1,500 and $5,000" } },
    { icon: "☀️", text: { fr: "Toit clair ou blanc (bonus bifacial)", en: "Light or white roof (bifacial bonus)" } },
    { icon: "🏪", text: { fr: "Enseigne visible = consommation diurne active", en: "Visible signage = active daytime consumption" } },
  ],
  marketingMessage: {
    fr: "Votre facture d'électricité à 12¢/kWh est la plus chère au Québec commercial. C'est aussi ce qui rend le solaire ultra-rentable pour vous : payback en 5 ans, 20% de rendement, zéro batterie requise.",
    en: "Your 12¢/kWh electricity bill is the most expensive in commercial Quebec. It's also what makes solar ultra-profitable for you: 5-year payback, 20% return, zero battery required.",
  },
  faq: [
    {
      question: { fr: "Mon toit est trop petit", en: "My roof is too small" },
      answer: {
        fr: "50 kWc (≈100 panneaux) sur 400 m² (4 300 pi²) fonctionne déjà très bien. Et chaque kWh vaut 12¢ — même un petit système est rentable rapidement.",
        en: "50 kW (≈100 panels) on 400 m² (4,300 ft²) works very well. And each kWh is worth 12¢ — even a small system pays back quickly.",
      },
    },
    {
      question: { fr: "Je suis locataire", en: "I'm a tenant" },
      answer: {
        fr: "Structure PPA ou bail solaire disponible si votre bail dépasse 7 ans. Sinon, on peut aider à convaincre le propriétaire avec les chiffres.",
        en: "PPA or solar lease available if your lease exceeds 7 years. Otherwise, we can help convince the landlord with the numbers.",
      },
    },
    {
      question: { fr: "L'électricité est peu coûteuse au Québec", en: "Electricity is inexpensive in Quebec" },
      answer: {
        fr: "Pas au Tarif G. Vous payez 12¢/kWh — comparable à l'Ontario. C'est exactement pourquoi le solaire est si rentable pour vous.",
        en: "Not on Rate G. You pay 12¢/kWh — comparable to Ontario. That's exactly why solar is so profitable for you.",
      },
    },
    {
      question: { fr: "C'est risqué comme investissement", en: "It's a risky investment" },
      answer: {
        fr: "Garantie panneau 25 ans. Hydro-Québec paie le surplus. Le soleil est prévisible au Québec. TRI > 18% — meilleur que la plupart des placements.",
        en: "25-year panel warranty. Hydro-Québec pays for surplus. Quebec sun is predictable. IRR > 18% — better than most investments.",
      },
    },
  ],
  ctaText: { fr: "Vérifier mon potentiel solaire", en: "Check my solar potential" },
  ctaSecondary: { fr: "Réserver un appel découverte (10 min)", en: "Book a discovery call (10 min)" },
  seo: {
    title: {
      fr: "Solaire pour commerces Tarif G | TRI 20%+ | kWh Québec",
      en: "Solar for Rate G Businesses | 20%+ IRR | kWh Québec",
    },
    description: {
      fr: "Les commerces sur Tarif G obtiennent le meilleur rendement solaire au Québec : TRI 19%+, payback 5 ans, sans batterie. Découvrez votre scénario.",
      en: "Rate G businesses get the best solar returns in Quebec: 19%+ IRR, 5-year payback, no battery. Discover your scenario.",
    },
    keywords: {
      fr: "solaire commercial tarif G, panneaux solaires commerce, retour investissement solaire québec, concessionnaire solaire",
      en: "commercial solar rate G, business solar panels, solar ROI quebec, dealership solar",
    },
  },
};

// =========================================================================
// PERSONA 2 — L'Industriel Volumique (Tarif M)
// =========================================================================
export const PERSONA_INDUSTRIAL: PersonaData = {
  id: "industrial",
  slug: "industriel",
  name: { fr: "L'Industriel Volumique", en: "The Volume Industrial" },
  tagline: { fr: "Tarif M · CAPEX $140k-$450k · Volume = marge", en: "Rate M · $140k-$450k CAPEX · Volume = margin" },
  heroTitle: {
    fr: "Votre facture M à 300k$/an finance un actif rentable sur 25 ans",
    en: "Your $300k/yr Rate M bill finances a 25-year profitable asset",
  },
  heroSubtitle: {
    fr: "Les industriels Tarif M transforment leur plus gros poste de dépense en investissement",
    en: "Rate M industrials turn their biggest expense into an investment",
  },
  heroDescription: {
    fr: "Un système de 350 kWc (≈700 panneaux) avec les incitatifs actuels (HQ + fédéral) coûte $0,96/W net — un tiers du prix catalogue. Avec un toit de 3 500 m² (37 700 pi²), vous générez $1,5M de profit sur 25 ans.",
    en: "A 350 kW (≈700 panels) system with current incentives (HQ + federal) costs $0.96/W net — a third of list price. With a 3,500 m² (37,700 ft²) roof, you generate $1.5M profit over 25 years.",
  },
  heroBadge: { fr: "Deals $140k-$450k+", en: "Deals $140k-$450k+" },
  heroStatPrimary: { label: { fr: "TRI typique", en: "Typical IRR" }, value: "12-18%" },
  heroStatSecondary: { label: { fr: "Payback", en: "Payback" }, value: "6-9 ans" },
  heroStatTertiary: { label: { fr: "Coût net", en: "Net cost" }, value: "0,96$/W" },
  tariff: "M",
  tariffRate: "6,06¢/kWh",
  systemSize: "200-700 kWc (400-1 400 panneaux)",
  typicalTRI: "12-18%",
  typicalPayback: "6-9 ans",
  sectors: [
    { fr: "Entrepôts frigorifiques et chambres froides", en: "Cold storage and freezer warehouses" },
    { fr: "Centres de distribution", en: "Distribution centers" },
    { fr: "Manufacturiers légers", en: "Light manufacturers" },
    { fr: "Usines de transformation alimentaire", en: "Food processing plants" },
    { fr: "Data centers et colocation", en: "Data centers and colocation" },
    { fr: "Supermarchés à grand volume", en: "High-volume supermarkets" },
    { fr: "Imprimeries et centres de tri postal", en: "Print shops and mail sorting centers" },
  ],
  whyBest: [
    {
      title: { fr: "Volume = marge absolue élevée", en: "Volume = high absolute margin" },
      description: {
        fr: "Un deal de 500 kWc génère un CAPEX brut > $1M et un contrat O&M récurrent de $10k/an pendant 25 ans. C'est le revenu récurrent de la business.",
        en: "A 500 kW deal generates gross CAPEX > $1M and a recurring O&M contract of $10k/yr for 25 years. That's recurring business revenue.",
      },
    },
    {
      title: { fr: "Batterie optionnelle, pas obligatoire", en: "Battery optional, not required" },
      description: {
        fr: "La batterie ajoute ~$9 500/an de demand savings pour un surcoût net de ~$97k. TRI marginal ≈ 10%. Pour les charges stables (frigo, data center), le PV seul offre un meilleur TRI.",
        en: "Battery adds ~$9,500/yr in demand savings for ~$97k net cost. Marginal IRR ≈ 10%. For stable loads (cold storage, data center), PV alone offers better IRR.",
      },
    },
    {
      title: { fr: "Charge 24/7 = autoconsommation maximale", en: "24/7 load = maximum self-consumption" },
      description: {
        fr: "Les charges industrielles continues (réfrigération, process) consomment même pendant les heures solaires. Autoconsommation typique de 95%.",
        en: "Continuous industrial loads (refrigeration, process) consume even during solar hours. Typical self-consumption of 95%.",
      },
    },
  ],
  scenario: {
    title: { fr: "Scénario réel : Entrepôt frigorifique, 350 kWc", en: "Real scenario: Cold storage warehouse, 350 kW" },
    subtitle: {
      fr: "Consommation 1 800 000 kWh/an · Toit 3 500 m² (37 700 pi²) plat TPO blanc · Sans batterie (meilleur TRI)",
      en: "1,800,000 kWh/yr consumption · 3,500 m² (37,700 ft²) flat white TPO roof · No battery (better IRR)",
    },
    params: [
      { label: { fr: "Consommation annuelle", en: "Annual consumption" }, value: "1 800 000 kWh" },
      { label: { fr: "Appel de puissance", en: "Demand" }, value: "450 kW" },
      { label: { fr: "Tarif HQ", en: "HQ Rate" }, value: "M — 6,06¢/kWh + 17,57$/kW" },
      { label: { fr: "Système PV", en: "PV System" }, value: "350 kWc bifacial (≈700 panneaux, PV seul)" },
      { label: { fr: "Production annuelle", en: "Annual production" }, value: "462 700 kWh" },
      { label: { fr: "Autoconsommation", en: "Self-consumption" }, value: "~95%" },
    ],
    capexCascade: [
      { label: { fr: "CAPEX brut PV", en: "Gross PV CAPEX" }, amount: "752 500 $" },
      { label: { fr: "HQ OSE 6.0 (40%)", en: "HQ OSE 6.0 (40%)" }, amount: "−301 000 $", isSubtract: true },
      { label: { fr: "CII fédéral (30%)", en: "Federal ITC (30%)" }, amount: "−135 450 $", isSubtract: true },
      { label: { fr: "Bouclier fiscal DPA", en: "CCA Tax Shield" }, amount: "−75 126 $", isSubtract: true },
      { label: { fr: "CAPEX net", en: "Net CAPEX" }, amount: "240 924 $" },
    ],
    metrics: [
      { label: { fr: "Économies énergie An 1", en: "Energy Savings Yr 1" }, value: "26 642 $/an", highlight: true },
      { label: { fr: "Cash-flow net An 1", en: "Net Cash Flow Yr 1" }, value: "19 117 $/an" },
      { label: { fr: "Payback simple", en: "Simple Payback" }, value: "12,6 ans" },
      { label: { fr: "TRI (25 ans)", en: "IRR (25 yrs)" }, value: "~14%", highlight: true },
      { label: { fr: "VAN (25 ans, 7%)", en: "NPV (25 yrs, 7%)" }, value: "~160 000 $" },
      { label: { fr: "Profit cumulé 25 ans", en: "25-yr cumulative profit" }, value: "~1 500 000 $", highlight: true },
    ],
    footnote: {
      fr: "Option batterie disponible (+135 kW / 270 kWh) pour demand shaving. Ajoute ~$9 500/an de savings puissance, mais allonge le payback de 3 ans. Recommandé uniquement si profil de pointe très variable.",
      en: "Battery option available (+135 kW / 270 kWh) for demand shaving. Adds ~$9,500/yr in demand savings but extends payback by 3 years. Recommended only for highly variable peak profiles.",
    },
  },
  signals: [
    { icon: "🏭", text: { fr: "Bâtiment industriel/logistique > 3 000 m² (32 300 pi²)", en: "Industrial/logistics building > 3,000 m² (32,300 ft²)" } },
    { icon: "🚚", text: { fr: "Quais de chargement visibles (= distribution)", en: "Visible loading docks (= distribution)" } },
    { icon: "❄️", text: { fr: "Unités de réfrigération sur le toit (= charge 24/7)", en: "Rooftop refrigeration units (= 24/7 load)" } },
    { icon: "📊", text: { fr: "Facture HQ annuelle $100k-$600k", en: "Annual HQ bill $100k-$600k" } },
    { icon: "🏗️", text: { fr: "Zone industrielle / parc technologique", en: "Industrial zone / technology park" } },
  ],
  marketingMessage: {
    fr: "Votre facture M à 300k$/an finance un investissement qui se rembourse en 9 ans et génère 1,5M$ de profit sur 25 ans. Avec les incitatifs actuels (HQ + fédéral), votre coût net est de 0,96$/W — un tiers du prix catalogue.",
    en: "Your $300k/yr Rate M bill finances an investment that pays back in 9 years and generates $1.5M profit over 25 years. With current incentives (HQ + federal), your net cost is $0.96/W — a third of list price.",
  },
  faq: [
    {
      question: { fr: "Le payback est trop long", en: "The payback is too long" },
      answer: {
        fr: "Regardez le TRI, pas le payback. 12-14% sur un actif physique garanti 25 ans — c'est supérieur à n'importe quel placement financier comparable.",
        en: "Look at the IRR, not the payback. 12-14% on a 25-year guaranteed physical asset — that's better than any comparable financial investment.",
      },
    },
    {
      question: { fr: "On pourrait déménager", en: "We might relocate" },
      answer: {
        fr: "Le solaire augmente la valeur de revente du bâtiment. C'est un actif immobilier qui améliore votre propriété, pas un coût opérationnel.",
        en: "Solar increases the building's resale value. It's a real estate asset that improves your property, not an operational cost.",
      },
    },
    {
      question: { fr: "On n'a pas le budget", en: "We don't have the budget" },
      answer: {
        fr: "Modèle PPA ou leasing disponible — économies dès le jour 1, zéro investissement initial. Ou financement classique : le cash-flow est positif dès l'an 1.",
        en: "PPA or leasing model available — savings from day 1, zero upfront investment. Or traditional financing: cash flow is positive from year 1.",
      },
    },
    {
      question: { fr: "La batterie coûte trop cher", en: "The battery costs too much" },
      answer: {
        fr: "On est d'accord. On peut faire PV seul — le TRI est même meilleur sans batterie dans la plupart des cas industriels. La batterie est proposée en option.",
        en: "We agree. We can do PV only — IRR is actually better without battery in most industrial cases. Battery is offered as an option.",
      },
    },
  ],
  ctaText: { fr: "Calculer mon retour sur investissement", en: "Calculate my ROI" },
  ctaSecondary: { fr: "Demander une analyse financière complète", en: "Request a full financial analysis" },
  seo: {
    title: {
      fr: "Solaire industriel Tarif M | CAPEX net $240k | kWh Québec",
      en: "Industrial Solar Rate M | $240k Net CAPEX | kWh Québec",
    },
    description: {
      fr: "Entrepôts, usines, centres de distribution : un système solaire de 350 kWc génère $1,5M de profit sur 25 ans. Coût net $0,96/W avec incitatifs.",
      en: "Warehouses, factories, distribution centers: a 350 kW solar system generates $1.5M profit over 25 years. Net cost $0.96/W with incentives.",
    },
    keywords: {
      fr: "solaire industriel tarif M, panneaux solaires entrepôt, solaire usine québec, demand shaving batterie",
      en: "industrial solar rate M, warehouse solar panels, factory solar quebec, battery demand shaving",
    },
  },
};

// =========================================================================
// PERSONA 3 — Le Gestionnaire Multi-Sites
// =========================================================================
export const PERSONA_PORTFOLIO: PersonaData = {
  id: "portfolio",
  slug: "multi-sites",
  name: { fr: "Le Gestionnaire Multi-Sites", en: "The Multi-Site Manager" },
  tagline: { fr: "5-30 sites · CAPEX $500k-$3M+ · TRI portfolio 14-20%", en: "5-30 sites · $500k-$3M+ CAPEX · 14-20% portfolio IRR" },
  heroTitle: {
    fr: "5 de vos bâtiments génèrent un TRI de 22% — voulez-vous voir lesquels?",
    en: "5 of your buildings generate a 22% IRR — want to see which ones?",
  },
  heroSubtitle: {
    fr: "Programme solaire multi-sites : audit de portefeuille gratuit, déploiement par vagues",
    en: "Multi-site solar program: free portfolio audit, wave deployment",
  },
  heroDescription: {
    fr: "On scanne vos 15-100 bâtiments, on priorise par TRI, et on déploie en 3 phases. Les meilleurs sites Tarif G d'abord (payback < 5 ans), puis les Tarif M à forte autoconsommation.",
    en: "We scan your 15-100 buildings, prioritize by IRR, and deploy in 3 phases. Best Rate G sites first (< 5yr payback), then high self-consumption Rate M sites.",
  },
  heroBadge: { fr: "Audit de portefeuille gratuit", en: "Free portfolio audit" },
  heroStatPrimary: { label: { fr: "TRI Phase 1", en: "Phase 1 IRR" }, value: "22%" },
  heroStatSecondary: { label: { fr: "Profit 25 ans", en: "25-yr profit" }, value: "6,3M$" },
  heroStatTertiary: { label: { fr: "Sites analysés", en: "Sites analyzed" }, value: "15-100" },
  tariff: "Mix G + M",
  tariffRate: "Variable",
  systemSize: "Portfolio 5-30 sites",
  typicalTRI: "14-20%",
  typicalPayback: "5-8 ans (pondéré)",
  sectors: [
    { fr: "REIT industriels (Dream, Granite, Summit)", en: "Industrial REITs (Dream, Granite, Summit)" },
    { fr: "REIT commerciaux (RioCan, CT REIT, Crombie)", en: "Commercial REITs (RioCan, CT REIT, Crombie)" },
    { fr: "Chaînes de franchises (Couche-Tard, Dollarama)", en: "Franchise chains (Couche-Tard, Dollarama)" },
    { fr: "Grands groupes immobiliers privés", en: "Large private real estate groups" },
    { fr: "Entreprises multi-usines (Cascades, Saputo)", en: "Multi-plant companies (Cascades, Saputo)" },
    { fr: "Commissions scolaires et CÉGEP", en: "School boards and CEGEPs" },
    { fr: "Municipalités (arénas, bibliothèques)", en: "Municipalities (arenas, libraries)" },
  ],
  whyBest: [
    {
      title: { fr: "Un seul coût d'acquisition pour 10-50 sites", en: "Single acquisition cost for 10-50 sites" },
      description: {
        fr: "Un seul processus de vente, un seul contrat-cadre, un seul interlocuteur. Le coût par site chute de 80% vs des deals individuels.",
        en: "Single sales process, single framework agreement, single point of contact. Cost per site drops 80% vs individual deals.",
      },
    },
    {
      title: { fr: "Pricing volume : 10-15% de rabais", en: "Volume pricing: 10-15% discount" },
      description: {
        fr: "À 1 MW+ cumulé, le coût $/W descend à $1,85-2,00/W vs $2,15-2,30 au détail. Même fournisseur, mêmes specs, même qualité.",
        en: "At 1 MW+ cumulative, $/W cost drops to $1.85-2.00/W vs $2.15-2.30 retail. Same supplier, same specs, same quality.",
      },
    },
    {
      title: { fr: "Priorisez les meilleurs sites d'abord", en: "Prioritize best sites first" },
      description: {
        fr: "Phase 1 = les 5 meilleurs toits Tarif G (TRI 22%). Résultats prouvés avant d'engager les phases suivantes. Zéro risque.",
        en: "Phase 1 = top 5 Rate G roofs (22% IRR). Proven results before committing to next phases. Zero risk.",
      },
    },
  ],
  scenario: {
    title: { fr: "Scénario réel : REIT commercial, 15 sites sur 3 ans", en: "Real scenario: Commercial REIT, 15 sites over 3 years" },
    subtitle: {
      fr: "Phase 1 : 5 meilleurs sites Tarif G (630 kWc) · Phase 2-3 : 10 sites mix G+M (1 200 kWc)",
      en: "Phase 1: 5 best Rate G sites (630 kW) · Phase 2-3: 10 sites G+M mix (1,200 kW)",
    },
    params: [
      { label: { fr: "Sites Phase 1", en: "Phase 1 Sites" }, value: "5 sites Tarif G" },
      { label: { fr: "Capacité Phase 1", en: "Phase 1 Capacity" }, value: "630 kWc (≈1 260 panneaux)" },
      { label: { fr: "Prix volume", en: "Volume price" }, value: "2,10 $/W (-5%)" },
      { label: { fr: "Sites Phase 2-3", en: "Phase 2-3 Sites" }, value: "10 sites mix G+M" },
      { label: { fr: "Capacité totale", en: "Total Capacity" }, value: "1 830 kWc (≈3 660 panneaux / 1,83 MW)" },
      { label: { fr: "CO₂ évité (25 ans)", en: "CO₂ avoided (25 yrs)" }, value: "~850 tonnes" },
    ],
    capexCascade: [
      { label: { fr: "CAPEX brut Phase 1", en: "Phase 1 Gross CAPEX" }, amount: "1 323 000 $" },
      { label: { fr: "HQ OSE 6.0 (40%)", en: "HQ OSE 6.0 (40%)" }, amount: "−529 200 $", isSubtract: true },
      { label: { fr: "CII fédéral (30%)", en: "Federal ITC (30%)" }, amount: "−238 140 $", isSubtract: true },
      { label: { fr: "Bouclier fiscal DPA", en: "CCA Tax Shield" }, amount: "−132 441 $", isSubtract: true },
      { label: { fr: "CAPEX net Phase 1", en: "Phase 1 Net CAPEX" }, amount: "423 219 $" },
    ],
    metrics: [
      { label: { fr: "Savings Phase 1 An 1", en: "Phase 1 Savings Yr 1" }, value: "~88 000 $/an", highlight: true },
      { label: { fr: "Payback Phase 1", en: "Phase 1 Payback" }, value: "~4,8 ans", highlight: true },
      { label: { fr: "TRI Phase 1", en: "Phase 1 IRR" }, value: "~22%", highlight: true },
      { label: { fr: "Investissement total net (15 sites)", en: "Total Net Investment (15 sites)" }, value: "~1 153 000 $" },
      { label: { fr: "Savings cumulés 25 ans", en: "25-yr cumulative savings" }, value: "~7 500 000 $" },
      { label: { fr: "Profit net 25 ans", en: "25-yr net profit" }, value: "~6 350 000 $", highlight: true },
    ],
    footnote: {
      fr: "⚠️ OBNL et municipalités : pas de CII/DPA. Le payback passe à ~10-12 ans. Modèle PPA recommandé.",
      en: "⚠️ Non-profits and municipalities: no ITC/CCA. Payback extends to ~10-12 years. PPA model recommended.",
    },
  },
  signals: [
    { icon: "🏢", text: { fr: "Portefeuille de 5+ bâtiments commerciaux/industriels", en: "Portfolio of 5+ commercial/industrial buildings" } },
    { icon: "📋", text: { fr: "VP immobilier, directeur énergie, ou CFO", en: "VP Real Estate, Energy Director, or CFO" } },
    { icon: "🌿", text: { fr: "Objectifs ESG ou développement durable formels", en: "Formal ESG or sustainability goals" } },
    { icon: "💰", text: { fr: "Budget programme de $1M-$20M sur 3-5 ans", en: "Program budget of $1M-$20M over 3-5 years" } },
    { icon: "🗂️", text: { fr: "Besoin d'un plan de déploiement, pas d'un devis", en: "Need a deployment plan, not a quote" } },
  ],
  marketingMessage: {
    fr: "Nous avons analysé vos 15 bâtiments : 5 sites à eux seuls peuvent générer un TRI de 22% avec un payback de moins de 5 ans. Voulez-vous voir le plan de déploiement complet?",
    en: "We analyzed your 15 buildings: 5 sites alone can generate a 22% IRR with under 5-year payback. Want to see the full deployment plan?",
  },
  faq: [
    {
      question: { fr: "C'est un gros engagement", en: "It's a big commitment" },
      answer: {
        fr: "Phase 1 = 5 sites seulement. Résultats prouvés avant Phase 2. Vous contrôlez le rythme à chaque étape.",
        en: "Phase 1 = 5 sites only. Proven results before Phase 2. You control the pace at every step.",
      },
    },
    {
      question: { fr: "Nos sites sont tous différents", en: "Our sites are all different" },
      answer: {
        fr: "C'est un avantage : on priorise les meilleurs toits et on optimise le mix tarif G/M. L'hétérogénéité permet de sélectionner les quick wins.",
        en: "That's an advantage: we prioritize the best roofs and optimize the G/M rate mix. Heterogeneity lets us select quick wins.",
      },
    },
    {
      question: { fr: "On veut faire un appel d'offres (RFP)", en: "We want to run an RFP" },
      answer: {
        fr: "Parfait. On fournit l'audit de portefeuille gratuit. Vous décidez ensuite du processus. L'audit vous donne les données pour évaluer toute offre.",
        en: "Perfect. We provide the free portfolio audit. You then decide on the process. The audit gives you data to evaluate any offer.",
      },
    },
    {
      question: { fr: "On est un OBNL ou une municipalité", en: "We're a non-profit or municipality" },
      answer: {
        fr: "⚠️ Pas de CII/DPA. Le payback passe à ~10-12 ans au lieu de 5-6. On peut regarder un modèle PPA (achat d'énergie) pour contourner ça.",
        en: "⚠️ No ITC/CCA. Payback extends to ~10-12 years instead of 5-6. We can explore a PPA model (energy purchase) to work around this.",
      },
    },
  ],
  ctaText: { fr: "Demander un audit de portefeuille gratuit", en: "Request a free portfolio audit" },
  ctaSecondary: { fr: "Voir notre approche multi-sites", en: "See our multi-site approach" },
  seo: {
    title: {
      fr: "Programme solaire multi-sites | Audit gratuit | kWh Québec",
      en: "Multi-Site Solar Program | Free Audit | kWh Québec",
    },
    description: {
      fr: "REIT, chaînes, municipalités : audit de portefeuille gratuit, déploiement par vagues, TRI de 22% en Phase 1. Programme solaire pour 5-100 bâtiments.",
      en: "REITs, chains, municipalities: free portfolio audit, wave deployment, 22% Phase 1 IRR. Solar program for 5-100 buildings.",
    },
    keywords: {
      fr: "solaire multi-sites, programme solaire REIT, audit portefeuille solaire, solaire municipalité québec",
      en: "multi-site solar, REIT solar program, solar portfolio audit, municipality solar quebec",
    },
  },
};

export const ALL_PERSONAS = [PERSONA_COMMERCIAL, PERSONA_INDUSTRIAL, PERSONA_PORTFOLIO] as const;

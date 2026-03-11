import { useEffect } from "react";
import { useLocation } from "wouter";
import logoImage from "@assets/kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png";

interface StructuredData {
  "@context": string;
  "@type": string;
  [key: string]: any;
}

interface SEOHeadProps {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
  ogUrl?: string;
  ogType?: "website" | "article";
  canonical?: string;
  noIndex?: boolean;
  structuredData?: StructuredData | StructuredData[];
  locale?: "fr" | "en";
  includeHreflang?: boolean;
}

export function SEOHead({
  title,
  description,
  keywords,
  ogImage = logoImage,
  ogUrl,
  ogType = "website",
  canonical,
  noIndex = false,
  structuredData,
  locale = "fr",
  includeHreflang = false,
}: SEOHeadProps) {
  const [location] = useLocation();

  useEffect(() => {
    document.title = title;

    const setMeta = (name: string, content: string, property?: boolean) => {
      const attr = property ? "property" : "name";
      let meta = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute(attr, name);
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    // Standard meta tags
    setMeta("description", description);
    if (keywords) setMeta("keywords", keywords);

    // Open Graph tags
    setMeta("og:title", title, true);
    setMeta("og:description", description, true);
    setMeta("og:type", ogType, true);
    const absoluteOgImage = ogImage.startsWith("http") ? ogImage : `https://www.kwh.quebec${ogImage}`;
    setMeta("og:image", absoluteOgImage, true);
    setMeta("og:url", ogUrl || `https://www.kwh.quebec${location}`, true);
    setMeta("og:site_name", "kWh Québec", true);
    setMeta("og:locale", locale === "fr" ? "fr_CA" : "en_CA", true);

    // Twitter Card tags
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", title);
    setMeta("twitter:description", description);
    setMeta("twitter:image", absoluteOgImage);

    // Additional SEO tags
    if (noIndex) {
      setMeta("robots", "noindex, nofollow");
    } else {
      setMeta("robots", "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1");
    }

    // Canonical URL
    if (canonical) {
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (!link) {
        link = document.createElement("link");
        link.rel = "canonical";
        document.head.appendChild(link);
      }
      link.href = canonical;
    }

    // Hreflang tags for multilingual pages
    if (includeHreflang) {
      const basePath = location.replace(/\/$/, "");
      const frLink = document.querySelector('link[hreflang="fr-CA"]') as HTMLLinkElement;
      const enLink = document.querySelector('link[hreflang="en-CA"]') as HTMLLinkElement;
      const defaultLink = document.querySelector('link[hreflang="x-default"]') as HTMLLinkElement;

      const updateOrCreateLink = (hreflang: string, href: string) => {
        let link = document.querySelector(`link[hreflang="${hreflang}"]`) as HTMLLinkElement;
        if (!link) {
          link = document.createElement("link");
          link.rel = "alternate";
          link.setAttribute("hreflang", hreflang);
          document.head.appendChild(link);
        }
        link.href = href;
      };

      if (basePath === "" || basePath === "/") {
        updateOrCreateLink("fr-CA", "https://www.kwh.quebec");
        updateOrCreateLink("en-CA", "https://www.kwh.quebec/en");
        updateOrCreateLink("x-default", "https://www.kwh.quebec");
      } else {
        updateOrCreateLink("fr-CA", `https://www.kwh.quebec${basePath}`);
        updateOrCreateLink("en-CA", `https://www.kwh.quebec/en${basePath}`);
        updateOrCreateLink("x-default", `https://www.kwh.quebec${basePath}`);
      }
    }

    // JSON-LD Schema markup
    if (structuredData) {
      // Remove old scripts
      document.querySelectorAll('script[data-seo-ld]').forEach(s => s.remove());

      // Add new schemas
      const schemas = Array.isArray(structuredData) ? structuredData : [structuredData];
      schemas.forEach((schema, index) => {
        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.setAttribute("data-seo-ld", "true");
        script.setAttribute("data-seo-index", index.toString());
        script.textContent = JSON.stringify(schema);
        document.head.appendChild(script);
      });
    }

    return () => {
      document.querySelectorAll('script[data-seo-ld]').forEach(s => s.remove());
    };
  }, [title, description, keywords, ogImage, ogUrl, ogType, canonical, noIndex, structuredData, includeHreflang, location]);

  return null;
}

export const organizationSchema: StructuredData = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "kWh Québec",
  "description": "Solutions solaires et stockage clé en main pour bâtiments commerciaux et industriels au Québec",
  "url": "https://www.kwh.quebec",
  "logo": "https://www.kwh.quebec/logo.png",
  "areaServed": {
    "@type": "AdministrativeArea",
    "name": "Québec, Canada"
  },
  "serviceType": ["Solar Panel Installation", "Energy Storage", "Energy Analysis"],
  "knowsAbout": ["Solar Energy", "Energy Storage", "Hydro-Québec Tariffs", "Commercial Solar"],
  "sameAs": []
};

export const getLocalBusinessSchema = (lang: "fr" | "en"): StructuredData => ({
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "kWh Québec",
  "description": lang === "fr"
    ? "Installation solaire commerciale et industrielle au Québec"
    : "Commercial and industrial solar installation in Quebec",
  "@id": "https://www.kwh.quebec",
  "url": "https://www.kwh.quebec",
  "telephone": "+1-514-427-8871",
  "email": "info@kwh.quebec",
  "priceRange": "$$$",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Montréal",
    "addressRegion": "QC",
    "addressCountry": "CA"
  },
  "areaServed": {
    "@type": "Province",
    "name": "Québec"
  },
  "serviceType": [
    "Installation solaire commerciale",
    "Conception de systèmes photovoltaïques",
    "Ingénierie solaire"
  ]
});

export const getServiceSchema = (lang: "fr" | "en"): StructuredData => ({
  "@context": "https://schema.org",
  "@type": "Service",
  "name": lang === "fr" ? "Mandat de conception préliminaire" : "Preliminary Design Mandate",
  "description": lang === "fr"
    ? "Validation technique et financière d'un projet solaire commercial"
    : "Technical and financial validation of a commercial solar project",
  "provider": {
    "@type": "LocalBusiness",
    "name": "kWh Québec"
  },
  "areaServed": {
    "@type": "AdministrativeArea",
    "name": "Québec"
  },
  "offers": {
    "@type": "Offer",
    "price": "2500",
    "priceCurrency": "CAD",
    "description": lang === "fr"
      ? "Crédité intégralement sur le contrat EPC si vous procédez"
      : "Fully credited toward EPC contract if you proceed"
  }
});

export const getHowToSchema = (lang: "fr" | "en"): StructuredData => ({
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": lang === "fr" ? "Comment obtenir une analyse solaire" : "How to get a solar analysis",
  "description": lang === "fr"
    ? "Processus simple en 5 étapes pour votre projet solaire commercial"
    : "Simple 5-step process for your commercial solar project",
  "step": [
    {
      "@type": "HowToStep",
      "position": 1,
      "name": lang === "fr" ? "Analyse rapide du potentiel" : "Quick Potential Analysis",
      "text": lang === "fr" ? "Estimation gratuite basée sur votre facture Hydro-Québec" : "Free estimate based on your Hydro-Québec bill"
    },
    {
      "@type": "HowToStep",
      "position": 2,
      "name": lang === "fr" ? "Validation économique" : "Economic Validation",
      "text": lang === "fr" ? "Rapport détaillé des impacts financiers et environnementaux" : "Detailed financial and environmental impact report"
    },
    {
      "@type": "HowToStep",
      "position": 3,
      "name": lang === "fr" ? "Validation technique" : "Technical Validation",
      "text": lang === "fr" ? "Visite de site, conception détaillée et soumission forfaitaire" : "Site visit, detailed design and fixed-price quote"
    },
    {
      "@type": "HowToStep",
      "position": 4,
      "name": lang === "fr" ? "Ingénierie, plans et devis" : "Engineering, Plans and Quotes",
      "text": lang === "fr" ? "Plans d'ingénieur et dossier de financement" : "Engineer plans and financing dossier"
    },
    {
      "@type": "HowToStep",
      "position": 5,
      "name": lang === "fr" ? "Permis et installation clé en main" : "Permits and Turnkey Installation",
      "text": lang === "fr" ? "Permis municipal, installation et mise en service" : "Municipal permits, installation and commissioning"
    }
  ]
});

export const getLandingFAQSchema = (lang: "fr" | "en"): StructuredData => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": lang === "fr"
        ? "Combien coûte une installation solaire commerciale?"
        : "How much does a commercial solar installation cost?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "Le coût varie selon la taille du système et le bâtiment, mais en général de 1,800$ à 2,500$ par kW. Avec les incitatifs gouvernementaux couvrant jusqu'à 60% du projet, votre investissement net tombe à 700$ à 1,000$ par kW. Les systèmes plus grands bénéficient généralement de meilleurs prix unitaires."
          : "Cost varies by system size and building, but typically ranges from $1,800 to $2,500 per kW. With government incentives covering up to 60% of the project, your net investment drops to $700 to $1,000 per kW. Larger systems generally benefit from better unit pricing."
      }
    },
    {
      "@type": "Question",
      "name": lang === "fr"
        ? "Quels incitatifs sont disponibles au Québec?"
        : "What incentives are available in Quebec?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "Trois niveaux d'incitatifs: (1) Crédit Hydro-Québec jusqu'à 40% du projet, (2) Crédit d'impôt fédéral 30% pour technologies propres, (3) Traitement fiscal avantageux avec 100% déductible en première année. Ces incitatifs peuvent être combinés pour un soutien total de jusqu'à 60% du coût du projet."
          : "Three levels of incentives: (1) Hydro-Québec credit up to 40% of the project, (2) Federal 30% investment tax credit for clean technology, (3) Favorable tax treatment with 100% deductible in year 1. These incentives can be combined for total support up to 60% of project cost."
      }
    },
    {
      "@type": "Question",
      "name": lang === "fr"
        ? "Combien de temps prend l'installation?"
        : "How long does installation take?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "Le processus complet prend généralement 4-8 mois selon la complexité du projet: estimation gratuite (quelques minutes), étude personnalisée avec données Hydro-Québec réelles (7 jours), conception préliminaire et visite technique (2 semaines), plans et soumission forfaitaire (4-8 semaines), et permis et installation clé en main (10-18 semaines)."
          : "The complete process typically takes 4-8 months depending on project complexity: free estimate (a few minutes), personalized study with real Hydro-Québec data (7 days), preliminary design and site visit (2 weeks), plans and fixed-price quote (4-8 weeks), and permits and turnkey installation (10-18 weeks)."
      }
    },
    {
      "@type": "Question",
      "name": lang === "fr"
        ? "Quelle est la durée de vie des panneaux solaires?"
        : "What is the lifespan of solar panels?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "Les panneaux solaires modernes (TOPCon N-type) ont une durée de vie de 25-30 ans avec une garantie de performance. Avec une dégradation de seulement 0,35-0,5% par année après la première année, ils produisent encore environ 90% de leur capacité initiale après 25 ans."
          : "Modern solar panels (TOPCon N-type) have a lifespan of 25-30 years with a performance warranty. With degradation of only 0.35-0.5% per year after Year 1, they still produce about 90% of initial capacity after 25 years."
      }
    },
    {
      "@type": "Question",
      "name": lang === "fr"
        ? "Le solaire augmente-t-il la valeur de mon bâtiment?"
        : "Does solar increase my building's property value?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "Oui. Les études montrent que les bâtiments avec systèmes solaires se vendent entre 3-4% plus cher, soit environ 1 000$/kW installé en valeur ajoutée. Au-delà de la valeur immédiate, les acheteurs apprécient les factures énergétiques réduites et les faibles coûts d'exploitation."
          : "Yes. Studies show that buildings with solar systems sell for 3-4% more, representing approximately $1,000/kW installed in added value. Beyond immediate value, buyers appreciate reduced energy bills and low operating costs."
      }
    }
  ]
});

export const getFAQSchema = (lang: "fr" | "en"): StructuredData => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": lang === "fr"
        ? "Quels sont les incitatifs disponibles pour le solaire au Québec?"
        : "What incentives are available for solar in Quebec?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "Au Québec, les principaux incitatifs incluent: l'appui financier de 1 000 $/kW du programme Solutions efficaces d'Hydro-Québec (OSE 6.0, en vigueur depuis le 31 mars 2026, plafonné à 40% du CAPEX et 1 MW), le programme de mesurage net (crédits sur votre facture), le crédit d'impôt fédéral de 30% pour les technologies propres (ITC, sous conditions d'éligibilité), et la déduction pour amortissement accéléré (CCA Catégorie 43.2, sous réserve des conditions d'éligibilité en vigueur — consultez votre comptable)."
          : "In Quebec, main incentives include: the $1,000/kW financial support from Hydro-Québec's Solutions efficaces program (OSE 6.0, effective March 31, 2026, capped at 40% of CAPEX and 1 MW), the net metering program (credits on your bill), the 30% federal clean technology investment tax credit (ITC, subject to eligibility), and accelerated capital cost allowance (CCA Class 43.2, subject to current eligibility conditions — consult your accountant)."
      }
    },
    {
      "@type": "Question",
      "name": lang === "fr"
        ? "Les systèmes de stockage sont-ils admissibles aux incitatifs?"
        : "Are storage systems eligible for incentives?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "Le stockage d'énergie peut être éligible au crédit d'impôt fédéral de 30% lorsqu'il est jumelé à un système solaire et répond aux critères d'éligibilité. Le programme d'autoproduction Hydro-Québec n'offre pas d'incitatif spécifique au stockage, mais celui-ci peut optimiser votre autoconsommation et réduire vos frais de pointe (Tarif M)."
          : "Energy storage may be eligible for the 30% federal tax credit when paired with a solar system and meeting eligibility criteria. The Hydro-Québec self-generation program doesn't offer storage-specific incentives, but storage can optimize self-consumption and reduce peak demand charges (Rate M)."
      }
    },
    {
      "@type": "Question",
      "name": lang === "fr"
        ? "Comment fonctionne la déduction pour amortissement (CCA 43.2)?"
        : "How does capital cost allowance (CCA Class 43.2) work?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "La Catégorie 43.2 permet une déduction accélérée à un taux de 50% par année (solde dégressif), sous réserve des conditions d'éligibilité en vigueur. Des mesures temporaires d'amortissement immédiat peuvent permettre une déduction plus rapide sous certaines conditions. Consultez votre comptable pour les règles actuelles applicables à votre entreprise."
          : "Class 43.2 allows accelerated depreciation at 50% per year (declining balance), subject to current eligibility conditions. Temporary immediate expensing measures may allow faster deduction under certain conditions. Consult your accountant for current rules applicable to your business."
      }
    },
    {
      "@type": "Question",
      "name": lang === "fr"
        ? "Le crédit d'impôt fédéral de 30% s'applique-t-il à mon projet?"
        : "Does the 30% federal tax credit apply to my project?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "Le crédit d'impôt à l'investissement (ITC) de 30% pour les technologies propres est disponible pour les entreprises canadiennes imposables. Des conditions s'appliquent, notamment des exigences de main-d'œuvre pour les projets plus importants. Les organismes exonérés d'impôt ne sont généralement pas éligibles. Notre analyse identifie votre éligibilité potentielle."
          : "The 30% clean technology investment tax credit (ITC) is available to taxable Canadian businesses. Conditions apply, including labour requirements for larger projects. Tax-exempt organizations are generally not eligible. Our analysis identifies your potential eligibility."
      }
    },
    {
      "@type": "Question",
      "name": lang === "fr"
        ? "Qu'est-ce que le programme d'autoproduction d'Hydro-Québec?"
        : "What is Hydro-Québec's self-generation program?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "Le programme d'autoproduction (mesurage net) permet d'injecter votre surplus solaire sur le réseau et de le récupérer sous forme de crédits sur votre facture (jusqu'à 24 mois). Le solde de la banque de surplus est rémunéré au coût moyen de fourniture d'électricité. Depuis 2025, le Tarif M est admissible et la capacité maximale est passée de 50 kW à 1 MW."
          : "The self-generation program (net metering) lets you inject solar surplus onto the grid and recover it as credits on your bill (up to 24 months). The surplus bank balance is compensated at the average cost of electricity supply. Since 2025, Rate M is eligible and maximum capacity increased from 50 kW to 1 MW."
      }
    },
    {
      "@type": "Question",
      "name": lang === "fr"
        ? "Qu'est-ce que le programme Solutions efficaces d'Hydro-Québec?"
        : "What is Hydro-Québec's Solutions efficaces program?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "Le programme Solutions efficaces d'Hydro-Québec (anciennement lié à ÉcoPerformance / TEQ) offre des appuis financiers pour l'efficacité énergétique et l'autoproduction solaire. Pour le solaire PV, l'appui est de 1 000 $/kW installé, plafonné à 40% des coûts admissibles et à 1 MW (OSE 6.0, en vigueur le 31 mars 2026)."
          : "Hydro-Québec's Solutions efficaces program (formerly linked to ÉcoPerformance / TEQ) provides financial support for energy efficiency and solar self-generation. For solar PV, the incentive is $1,000/kW installed, capped at 40% of admissible costs and 1 MW (OSE 6.0, effective March 31, 2026)."
      }
    },
    {
      "@type": "Question",
      "name": lang === "fr"
        ? "Quelles sont les exigences pour l'incitatif solaire OSE 6.0?"
        : "What are the requirements for the OSE 6.0 solar incentive?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "Panneaux certifiés CSA 22.2 No 61730 et CAN/CAS-IEC 61215. Installateur avec licence RBQ. Achat d'équipements après le 31 mars 2026. Acceptation conditionnelle d'Hydro-Québec recommandée avant achat. Tous les tarifs admissibles sauf tarif L et contrats particuliers."
          : "Panels must be CSA 22.2 No 61730 and CAN/CAS-IEC 61215 certified. Installer must hold proper RBQ license. Equipment purchase after March 31, 2026. Hydro-Québec conditional acceptance recommended before purchase. All tariffs eligible except Rate L and special contracts."
      }
    },
    {
      "@type": "Question",
      "name": lang === "fr"
        ? "Quelle est la production solaire typique au Québec?"
        : "What is typical solar production in Quebec?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "Au Québec, la production solaire moyenne est d'environ 1 150-1 300 kWh/kW/an selon la région et l'orientation. Montréal produit environ 1 200 kWh/kW/an. Notre analyse utilise des données satellitaires Google Solar et des simulations horaires sur une année complète (8 760 heures) pour estimer précisément votre production."
          : "In Quebec, average solar production is approximately 1,150-1,300 kWh/kW/year depending on region and orientation. Montreal produces about 1,200 kWh/kW/year. Our analysis uses Google Solar satellite data and hourly simulations over a full year (8,760 hours) to precisely estimate your production."
      }
    },
    {
      "@type": "Question",
      "name": lang === "fr"
        ? "Combien d'espace de toit faut-il pour un système solaire?"
        : "How much roof space is needed for a solar system?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "En règle générale, il faut environ 3,5 m² par kW installé pour des panneaux modernes de haute puissance (625W). Un système de 100 kW nécessiterait donc environ 350 m² de surface de toit utilisable. Notre analyse satellite évalue automatiquement la capacité de votre toiture en tenant compte des obstacles et de l'orientation."
          : "As a general rule, about 3.5 m² per installed kW is needed for modern high-power panels (625W). A 100 kW system would require approximately 350 m² of usable roof space. Our satellite analysis automatically evaluates your roof capacity accounting for obstacles and orientation."
      }
    },
    {
      "@type": "Question",
      "name": lang === "fr"
        ? "Les panneaux solaires fonctionnent-ils en hiver au Québec?"
        : "Do solar panels work in winter in Quebec?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "Absolument! Les panneaux produisent toute l'année. Le froid améliore leur efficacité (+0,4%/°C sous 25°C). Selon l'étude NAIT Edmonton (5 ans, panneaux identiques à tous les angles), les racks ballastés à 10° ne perdent que ~5% annuellement à cause de la neige. Notre simulateur intègre ce profil validé par défaut."
          : "Absolutely! Panels produce year-round. Cold improves efficiency (+0.4%/°C below 25°C). Per the NAIT Edmonton study (5 years, identical panels at all angles), ballasted racks at 10° only lose ~5% annually due to snow. Our simulator integrates this validated profile by default."
      }
    },
    {
      "@type": "Question",
      "name": lang === "fr"
        ? "Quelle est la différence entre le Tarif G et le Tarif M?"
        : "What's the difference between Rate G and Rate M?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "Le Tarif G (petit) s'applique aux puissances appelées <65 kW - facturation simple basée sur l'énergie (~11,3¢/kWh). Le Tarif M (moyen) s'applique aux puissances >100 kW - inclut des frais de puissance (~18$/kW/mois) plus l'énergie (~5¢/kWh). Avec le Tarif M, le stockage par batterie devient intéressant pour réduire la pointe de demande."
          : "Rate G (small) applies to demand <65 kW - simple billing based on energy (~11.3¢/kWh). Rate M (medium) applies to demand >100 kW - includes power charges (~$18/kW/month) plus energy (~5¢/kWh). With Rate M, battery storage becomes attractive to reduce peak demand."
      }
    },
    {
      "@type": "Question",
      "name": lang === "fr"
        ? "Mon toit doit-il être remplacé avant d'installer des panneaux?"
        : "Does my roof need to be replaced before installing panels?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "Si votre toiture a moins de 10 ans de vie restante, il est recommandé de la remplacer avant l'installation. Les panneaux solaires durent 25-30 ans - vous voulez éviter de les démonter pour refaire le toit. Notre visite technique évalue l'état de votre toiture et nous pouvons coordonner le remplacement si nécessaire."
          : "If your roof has less than 10 years of remaining life, it's recommended to replace it before installation. Solar panels last 25-30 years - you want to avoid removing them to redo the roof. Our technical visit evaluates your roof condition and we can coordinate replacement if needed."
      }
    },
    {
      "@type": "Question",
      "name": lang === "fr"
        ? "Quel est le retour sur investissement typique?"
        : "What is the typical return on investment?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "Avec les incitatifs actuels, le temps de retour typique est de 5-9 ans avec incitatifs pour les projets commerciaux au Québec. Le TRI (taux de rendement interne) se situe généralement entre 12% et 20%, selon la taille du système et le profil de consommation. La VAN sur 25 ans peut atteindre 2-3x l'investissement initial."
          : "With current incentives, typical payback is 5-9 years with incentives for commercial projects in Quebec. IRR (internal rate of return) generally ranges between 12% and 20%, depending on system size and consumption profile. NPV over 25 years can reach 2-3x the initial investment."
      }
    },
    {
      "@type": "Question",
      "name": lang === "fr"
        ? "Quelles options d'acquisition sont disponibles?"
        : "What acquisition options are available?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "Trois options principales: 1) Achat comptant - meilleur rendement long terme, 2) Prêt - conservation de tous les incitatifs avec paiements étalés, 3) Crédit-bail/location - flux de trésorerie positif dès le jour 1 en conservant tous les incitatifs. Notre analyse compare ces trois options pour votre situation."
          : "Three main options: 1) Cash purchase - best long-term return, 2) Loan - keep all incentives with spread payments, 3) Capital lease - positive cash flow from day 1 while retaining all incentives. Our analysis compares these three options for your situation."
      }
    },
    {
      "@type": "Question",
      "name": lang === "fr"
        ? "Combien coûte un système solaire commercial au Québec?"
        : "How much does a commercial solar system cost in Quebec?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "Le coût installé varie de 1,50$ à 2,50$/W selon la taille et la complexité. Un système de 100 kW coûte typiquement 150 000$ - 200 000$ avant incitatifs. Après tous les incitatifs (Hydro-Québec, fédéral, fiscal), le coût net peut être réduit de 40-60%. Notre analyse fournit une estimation précise pour votre projet."
          : "Installed cost ranges from $1.50 to $2.50/W depending on size and complexity. A 100 kW system typically costs $150,000 - $200,000 before incentives. After all incentives (Hydro-Québec, federal, tax), net cost can be reduced by 40-60%. Our analysis provides a precise estimate for your project."
      }
    },
    {
      "@type": "Question",
      "name": lang === "fr"
        ? "Le solaire augmente-t-il la valeur de mon bâtiment?"
        : "Does solar increase my building's value?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "Oui! Des études montrent que les bâtiments commerciaux avec solaire se vendent en moyenne 3-4% plus cher. De plus, vous bénéficiez d'une protection contre les hausses de tarifs d'électricité, d'une image de durabilité attractive pour les locataires/clients, et de flux de trésorerie prévisibles sur 25+ ans."
          : "Yes! Studies show commercial buildings with solar sell for 3-4% more on average. Additionally, you benefit from protection against electricity rate increases, an attractive sustainability image for tenants/clients, and predictable cash flows over 25+ years."
      }
    },
    {
      "@type": "Question",
      "name": lang === "fr"
        ? "Pourquoi le PPA (contrat d'achat d'énergie) n'est-il pas offert au Québec?"
        : "Why are Power Purchase Agreements (PPAs) not available in Quebec?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "Au Québec, la Loi sur Hydro-Québec (RLRQ, c. H-5) confère à Hydro-Québec le rôle exclusif de distributeur d'électricité. La Loi sur la Régie de l'énergie (RLRQ, c. R-6.01) encadre la vente d'électricité aux consommateurs finals — dans le cadre réglementaire actuel, la vente d'électricité par un tiers via un PPA n'est pas permise, contrairement à l'Ontario, l'Alberta ou les États-Unis. kWh Québec propose trois modes d'acquisition adaptés: l'achat comptant, le prêt et le crédit-bail. Vous êtes propriétaire du système et conservez 100% des incitatifs gouvernementaux."
          : "In Quebec, the Hydro-Québec Act (CQLR, c. H-5) grants Hydro-Québec the exclusive role of electricity distributor. The Act Respecting the Régie de l'énergie (CQLR, c. R-6.01) regulates electricity sales to end consumers — under the current regulatory framework, electricity sales by a third party through a PPA are not permitted, unlike in Ontario, Alberta, or the United States. kWh Québec offers three acquisition modes adapted to Quebec's framework: cash purchase, loan, and capital lease. You own the system and retain 100% of government incentives."
      }
    },
    {
      "@type": "Question",
      "name": lang === "fr"
        ? "Combien de temps prend un projet solaire complet?"
        : "How long does a complete solar project take?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "Du premier contact à la mise en service: Analyse préliminaire (1-2 semaines), Visite technique et design (2-4 semaines), Ingénierie et permis (4-8 semaines), Construction (4-12 semaines selon la taille). Total: 3-6 mois typiquement pour un projet commercial de 50-500 kW."
          : "From first contact to commissioning: Preliminary analysis (1-2 weeks), Technical visit and design (2-4 weeks), Engineering and permits (4-8 weeks), Construction (4-12 weeks depending on size). Total: 3-6 months typically for a 50-500 kW commercial project."
      }
    },
    {
      "@type": "Question",
      "name": lang === "fr"
        ? "Qu'est-ce que la procuration Hydro-Québec?"
        : "What is the Hydro-Québec authorization?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "La procuration Hydro-Québec est un formulaire standard qui nous autorise à accéder à votre historique de consommation électrique détaillé (données 15 minutes). Ces données sont essentielles pour effectuer une analyse précise de dimensionnement et calculer l'autoconsommation. Le processus est 100% électronique, sécurisé et gratuit."
          : "The Hydro-Québec authorization is a standard form that allows us to access your detailed electricity consumption history (15-minute data). This data is essential for accurate sizing analysis and calculating self-consumption. The process is 100% electronic, secure and free."
      }
    },
    {
      "@type": "Question",
      "name": lang === "fr"
        ? "Ai-je besoin d'une licence RBQ pour installer du solaire?"
        : "Do I need an RBQ license to install solar?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "L'installateur doit détenir une licence RBQ (Régie du bâtiment du Québec) avec les sous-catégories appropriées (électricité, installation d'équipements). kWh Québec détient les licences nécessaires et réalise les installations avec son équipe qualifiée. Vous n'avez pas besoin de licence vous-même en tant que propriétaire."
          : "The installer must hold an RBQ (Régie du bâtiment du Québec) license with appropriate sub-categories (electricity, equipment installation). kWh Québec holds the necessary licenses and performs installations with its own qualified team. You don't need a license yourself as the property owner."
      }
    },
    {
      "@type": "Question",
      "name": lang === "fr"
        ? "Quelle maintenance est requise pour un système solaire?"
        : "What maintenance is required for a solar system?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "Les systèmes solaires nécessitent très peu de maintenance. Inspection visuelle annuelle, nettoyage occasionnel si accumulation importante de débris, et vérification des connexions électriques tous les 2-3 ans. Les panneaux sont garantis 25 ans avec dégradation de 0,35-0,5%/an après la première année (dégradation initiale ~1-2% selon le fabricant). Le monitoring à distance permet de détecter rapidement tout problème."
          : "Solar systems require very little maintenance. Annual visual inspection, occasional cleaning if significant debris accumulation, and electrical connection check every 2-3 years. Panels are warranted 25 years with degradation of 0.35-0.5%/yr after Year 1 (initial degradation ~1-2% per manufacturer). Remote monitoring allows quick detection of any issues."
      }
    },
    {
      "@type": "Question",
      "name": lang === "fr"
        ? "Que se passe-t-il si je vends mon bâtiment?"
        : "What happens if I sell my building?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "Le système solaire peut être transféré au nouveau propriétaire comme équipement fixe - c'est généralement un argument de vente positif. Les garanties sont transférables. Si vous avez un prêt ou crédit-bail, les conditions de transfert dépendent du contrat. Dans tous les cas, un système performant ajoute de la valeur à votre propriété."
          : "The solar system can be transferred to the new owner as fixed equipment - this is generally a positive selling point. Warranties are transferable. If you have a loan or lease, transfer conditions depend on the contract. In all cases, a performing system adds value to your property."
      }
    }
  ]
});

export const seoContent = {
  home: {
    fr: {
      title: "kWh Québec | Réduisez votre facture énergétique de 30-50% — Solaire C&I au Québec",
      description: "Réduisez votre facture énergétique de 30-50% avec le solaire commercial et industriel. Analyse gratuite, incitatifs jusqu'à 60%. Partenaire Hydro-Québec.",
      keywords: "solaire commercial québec, panneaux solaires entreprise, stockage batterie industriel, hydro-québec autoproduction, incitatifs solaire québec",
    },
    en: {
      title: "kWh Québec | Cut Your Energy Bill by 30-50% — C&I Solar in Quebec",
      description: "Cut your energy bill by 30-50% with commercial and industrial solar. Free analysis, incentives up to 60%. Hydro-Québec partner.",
      keywords: "commercial solar quebec, business solar panels, industrial battery storage, hydro-quebec self-generation, quebec solar incentives",
    },
  },
  services: {
    fr: {
      title: "Services EPC Solaire | kWh Québec",
      description: "Services clé en main pour projets solaires commerciaux: analyse, ingénierie, construction et maintenance. Expertise québécoise en énergie solaire.",
      keywords: "EPC solaire québec, installation panneaux solaires, ingénierie solaire, maintenance système solaire",
    },
    en: {
      title: "Solar EPC Services | kWh Québec",
      description: "Turnkey services for commercial solar projects: analysis, engineering, construction and maintenance. Quebec solar energy expertise.",
      keywords: "solar EPC quebec, solar panel installation, solar engineering, solar system maintenance",
    },
  },
  howItWorks: {
    fr: {
      title: "Comment ça marche | Processus d'analyse solaire | kWh Québec",
      description: "Découvrez notre processus en 5 étapes: de l'analyse gratuite à l'installation clé en main. Analyse GRATUITE en 2 minutes.",
      keywords: "processus solaire, analyse gratuite, installation solaire étapes, projet solaire commercial",
    },
    en: {
      title: "How It Works | Solar Analysis Process | kWh Québec",
      description: "Discover our 5-step process: from free analysis to turnkey installation. FREE analysis in 2 minutes.",
      keywords: "solar process, free analysis, solar installation steps, commercial solar project",
    },
  },
  resources: {
    fr: {
      title: "Ressources et FAQ Solaire | kWh Québec",
      description: "Guides, FAQ et informations sur le solaire commercial au Québec: incitatifs, tarifs Hydro-Québec, retour sur investissement.",
      keywords: "FAQ solaire québec, guide incitatifs solaire, tarifs hydro-québec, ROI solaire commercial",
    },
    en: {
      title: "Solar Resources and FAQ | kWh Québec",
      description: "Guides, FAQ and information about commercial solar in Quebec: incentives, Hydro-Québec rates, return on investment.",
      keywords: "quebec solar FAQ, solar incentives guide, hydro-quebec rates, commercial solar ROI",
    },
  },
};

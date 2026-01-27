import { useEffect } from "react";
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
  ogType?: "website" | "article";
  canonical?: string;
  noIndex?: boolean;
  structuredData?: StructuredData;
  locale?: "fr" | "en";
}

export function SEOHead({
  title,
  description,
  keywords,
  ogImage = logoImage,
  ogType = "website",
  canonical,
  noIndex = false,
  structuredData,
  locale = "fr",
}: SEOHeadProps) {
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

    setMeta("description", description);
    if (keywords) setMeta("keywords", keywords);
    
    setMeta("og:title", title, true);
    setMeta("og:description", description, true);
    setMeta("og:type", ogType, true);
    setMeta("og:image", ogImage, true);
    setMeta("twitter:image", ogImage);
    setMeta("og:site_name", "kWh Québec", true);
    setMeta("og:locale", locale === "fr" ? "fr_CA" : "en_CA", true);
    
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", title);
    setMeta("twitter:description", description);

    if (noIndex) {
      setMeta("robots", "noindex, nofollow");
    } else {
      setMeta("robots", "index, follow");
    }

    if (canonical) {
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (!link) {
        link = document.createElement("link");
        link.rel = "canonical";
        document.head.appendChild(link);
      }
      link.href = canonical;
    }

    if (structuredData) {
      const existingScript = document.querySelector('script[data-seo-ld]');
      if (existingScript) {
        existingScript.remove();
      }
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.setAttribute("data-seo-ld", "true");
      script.textContent = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }

    return () => {
      const ldScript = document.querySelector('script[data-seo-ld]');
      if (ldScript) ldScript.remove();
    };
  }, [title, description, keywords, ogImage, ogType, canonical, noIndex, structuredData]);

  return null;
}

export const organizationSchema: StructuredData = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "kWh Québec",
  "description": "Solutions solaires et stockage clé en main pour bâtiments commerciaux et industriels au Québec",
  "url": "https://kwhquebec.com",
  "logo": "https://kwhquebec.com/logo.png",
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
    ? "Solutions solaires et stockage clé en main pour bâtiments commerciaux et industriels au Québec"
    : "Turnkey solar and storage solutions for commercial and industrial buildings in Quebec",
  "@id": "https://kwhquebec.com",
  "url": "https://kwhquebec.com",
  "priceRange": "$$",
  "address": {
    "@type": "PostalAddress",
    "addressRegion": "QC",
    "addressCountry": "CA"
  },
  "areaServed": {
    "@type": "AdministrativeArea",
    "name": "Québec"
  },
  "hasOfferCatalog": {
    "@type": "OfferCatalog",
    "name": lang === "fr" ? "Services solaires" : "Solar Services",
    "itemListElement": [
      {
        "@type": "Offer",
        "itemOffered": {
          "@type": "Service",
          "name": lang === "fr" ? "Analyse solaire gratuite" : "Free Solar Analysis"
        }
      },
      {
        "@type": "Offer",
        "itemOffered": {
          "@type": "Service",
          "name": lang === "fr" ? "Installation clé en main" : "Turnkey Installation"
        }
      }
    ]
  }
});

export const getServiceSchema = (lang: "fr" | "en"): StructuredData => ({
  "@context": "https://schema.org",
  "@type": "Service",
  "serviceType": lang === "fr" ? "Installation solaire commerciale" : "Commercial Solar Installation",
  "provider": {
    "@type": "Organization",
    "name": "kWh Québec"
  },
  "areaServed": {
    "@type": "AdministrativeArea",
    "name": "Québec, Canada"
  },
  "description": lang === "fr"
    ? "Services EPC complets: analyse, ingénierie, construction et maintenance de systèmes solaires commerciaux"
    : "Complete EPC services: analysis, engineering, construction and maintenance of commercial solar systems",
  "offers": {
    "@type": "Offer",
    "description": lang === "fr" ? "Analyse gratuite" : "Free analysis"
  }
});

export const getHowToSchema = (lang: "fr" | "en"): StructuredData => ({
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": lang === "fr" ? "Comment obtenir une analyse solaire" : "How to get a solar analysis",
  "description": lang === "fr" 
    ? "Processus simple en 6 étapes pour votre projet solaire commercial"
    : "Simple 6-step process for your commercial solar project",
  "step": [
    {
      "@type": "HowToStep",
      "position": 1,
      "name": lang === "fr" ? "Analyse rapide" : "Quick Analysis",
      "text": lang === "fr" ? "Obtenez une estimation en 2 minutes" : "Get an estimate in 2 minutes"
    },
    {
      "@type": "HowToStep",
      "position": 2,
      "name": lang === "fr" ? "Analyse détaillée" : "Detailed Analysis",
      "text": lang === "fr" ? "Signez la procuration HQ" : "Sign HQ authorization"
    },
    {
      "@type": "HowToStep",
      "position": 3,
      "name": lang === "fr" ? "Rapport" : "Report",
      "text": lang === "fr" ? "Recevez votre rapport personnalisé" : "Receive your personalized report"
    },
    {
      "@type": "HowToStep",
      "position": 4,
      "name": lang === "fr" ? "Proposition" : "Proposal",
      "text": lang === "fr" ? "Obtenez votre soumission détaillée" : "Get your detailed quote"
    },
    {
      "@type": "HowToStep",
      "position": 5,
      "name": lang === "fr" ? "Installation" : "Installation",
      "text": lang === "fr" ? "Installation clé en main" : "Turnkey installation"
    },
    {
      "@type": "HowToStep",
      "position": 6,
      "name": lang === "fr" ? "Économies" : "Savings",
      "text": lang === "fr" ? "Commencez à économiser" : "Start saving"
    }
  ]
});

export const getFAQSchema = (lang: "fr" | "en"): StructuredData => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": lang === "fr" ? "Quels sont les incitatifs disponibles au Québec?" : "What incentives are available in Quebec?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr" 
          ? "Hydro-Québec offre jusqu'à 40% du coût en crédit, le fédéral offre 30% pour technologies propres, et l'amortissement accéléré permet une déduction de 100% en première année."
          : "Hydro-Québec offers up to 40% of cost as credit, federal offers 30% for clean technology, and accelerated depreciation allows 100% deduction in year one."
      }
    },
    {
      "@type": "Question",
      "name": lang === "fr" ? "Combien de temps prend l'analyse détaillée?" : "How long does the detailed analysis take?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr" 
          ? "L'analyse détaillée prend environ 5 jours ouvrables après la signature de la procuration Hydro-Québec."
          : "The detailed analysis takes about 5 business days after signing the Hydro-Québec authorization."
      }
    },
    {
      "@type": "Question",
      "name": lang === "fr" ? "Quel est le retour sur investissement typique?" : "What is the typical return on investment?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr" 
          ? "Le retour sur investissement typique pour un projet solaire commercial au Québec est de 4 à 7 ans, avec un TRI de 15% à 25%."
          : "The typical payback for a commercial solar project in Quebec is 4 to 7 years, with an IRR of 15% to 25%."
      }
    }
  ]
});

export const seoContent = {
  home: {
    fr: {
      title: "kWh Québec | Panneaux solaires + stockage pour entreprises au Québec",
      description: "Solutions solaires et stockage clé en main pour bâtiments commerciaux et industriels au Québec. Analyse gratuite, incitatifs jusqu'à 60%. Partenaire Hydro-Québec.",
      keywords: "solaire commercial québec, panneaux solaires entreprise, stockage batterie industriel, hydro-québec autoproduction, incitatifs solaire québec",
    },
    en: {
      title: "kWh Québec | Solar + Storage for Commercial Buildings in Quebec",
      description: "Turnkey solar and storage solutions for commercial and industrial buildings in Quebec. Free analysis, incentives up to 60%. Hydro-Québec partner.",
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
      description: "Découvrez notre processus en 6 étapes: de l'analyse gratuite à l'installation clé en main. Analyse GRATUITE en 2 minutes.",
      keywords: "processus solaire, analyse gratuite, installation solaire étapes, projet solaire commercial",
    },
    en: {
      title: "How It Works | Solar Analysis Process | kWh Québec",
      description: "Discover our 6-step process: from free analysis to turnkey installation. FREE analysis in 2 minutes.",
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

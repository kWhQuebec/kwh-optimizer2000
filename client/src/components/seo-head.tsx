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
    setMeta("og:image", ogImage, true);
    setMeta("og:url", ogUrl || `https://kwh.quebec${location}`, true);
    setMeta("og:site_name", "kWh Québec", true);
    setMeta("og:locale", locale === "fr" ? "fr_CA" : "en_CA", true);

    // Twitter Card tags
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", title);
    setMeta("twitter:description", description);
    setMeta("twitter:image", ogImage);

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
        updateOrCreateLink("fr-CA", "https://kwh.quebec");
        updateOrCreateLink("en-CA", "https://kwh.quebec/en");
        updateOrCreateLink("x-default", "https://kwh.quebec");
      } else {
        updateOrCreateLink("fr-CA", `https://kwh.quebec${basePath}`);
        updateOrCreateLink("en-CA", `https://kwh.quebec/en${basePath}`);
        updateOrCreateLink("x-default", `https://kwh.quebec${basePath}`);
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
  "url": "https://kwh.quebec",
  "logo": "https://kwh.quebec/logo.png",
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
  "@id": "https://kwh.quebec",
  "url": "https://kwh.quebec",
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
      "text": lang === "fr" ? "Signez la procuration Hydro-Québec" : "Sign Hydro-Québec authorization"
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
      "name": lang === "fr"
        ? "Quel est le retour sur investissement typique pour un projet solaire commercial au Québec?"
        : "What is the typical return on investment for a commercial solar project in Quebec?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "Le retour sur investissement typique pour un projet solaire commercial au Québec est de 4 à 7 ans, avec un TRI (taux de rendement interne) de 15% à 25%, en tenant compte des incitatifs Hydro-Québec et du crédit d'impôt fédéral."
          : "The typical payback for a commercial solar project in Quebec is 4 to 7 years, with an IRR of 15% to 25%, considering Hydro-Québec incentives and federal tax credits."
      }
    },
    {
      "@type": "Question",
      "name": lang === "fr"
        ? "Est-ce que le solaire fonctionne en hiver au Québec?"
        : "Does solar work in winter in Quebec?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "Oui, absolument. Les panneaux solaires sont dimensionnés sur la production annuelle complète. Bien que la production soit plus basse en hiver, le système bénéficie du mesurage net qui accumule les crédits sur 24 mois. Le froid améliore en fait l'efficacité des panneaux (+0,4% par degré sous 25°C), et l'effet albédo de la neige ajoute 5-10% de production supplémentaire."
          : "Yes, absolutely. Panels are sized on annual production. While winter output is lower, net metering accumulates credits over 24 months. Cold actually improves panel efficiency (+0.4% per degree below 25°C), and snow albedo adds 5-10% extra production."
      }
    },
    {
      "@type": "Question",
      "name": lang === "fr"
        ? "Quels sont les incitatifs disponibles au Québec pour les projets solaires commerciaux?"
        : "What incentives are available in Quebec for commercial solar projects?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "Le Québec offre plusieurs incitatifs: Hydro-Québec offre jusqu'à 1 000 $/kW de crédit d'autoproduction, le gouvernement fédéral offre 30% de crédit d'impôt pour les investissements dans les technologies propres (CII), et l'amortissement accéléré (DPA 43.1/43.2) permet une déduction de 100% en première année pour fins fiscales."
          : "Quebec offers multiple incentives: Hydro-Québec offers up to $1,000/kW self-generation credit, federal government offers 30% investment tax credit for clean technology (ITC), and accelerated depreciation (CCA 43.1/43.2) allows 100% first-year deduction for tax purposes."
      }
    },
    {
      "@type": "Question",
      "name": lang === "fr"
        ? "Combien de temps prend le processus complet d'un projet solaire?"
        : "How long does the complete solar project process take?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "Le processus complet prend généralement 4-8 mois selon la complexité du projet: estimation gratuite (quelques minutes), étude personnalisée avec données HQ réelles (7 jours), conception préliminaire et visite technique (2 semaines), plans et soumission forfaitaire (4-8 semaines), et permis et installation clé en main (10-18 semaines). Chaque projet est unique — l'appel découverte de 10 minutes permet de vous donner un échéancier précis."
          : "The complete process typically takes 4-8 months depending on project complexity: free estimate (a few minutes), personalized study with real HQ data (7 days), preliminary design and site visit (2 weeks), plans and fixed-price quote (4-8 weeks), and permits and turnkey installation (10-18 weeks). Every project is unique — the 10-minute discovery call lets us give you a precise timeline."
      }
    },
    {
      "@type": "Question",
      "name": lang === "fr"
        ? "Quel est le coût d'un mandat de conception préliminaire?"
        : "What is the cost of a preliminary design mandate?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "Le mandat de conception préliminaire coûte 2 500$ plus taxes. Cependant, ce montant est crédité intégralement sur le contrat EPC (ingénierie-approvisionnement-construction) si vous décidez de procéder avec kWh Québec."
          : "The preliminary design mandate costs $2,500 plus taxes. However, this amount is fully credited toward the EPC contract (engineering-procurement-construction) if you decide to proceed with kWh Québec."
      }
    },
    {
      "@type": "Question",
      "name": lang === "fr"
        ? "Avez-vous une expérience avec des projets industriels et commerciaux?"
        : "Do you have experience with industrial and commercial projects?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": lang === "fr"
          ? "Oui, nous avons plus de 15 ans d'expérience avec 120+ MW installés et 25+ projets C&I (commercial & industriel) complétés au Québec. Nous travaillons avec des partenaires comme dream Industrial REIT et d'autres gestionnaires immobiliers majeurs."
          : "Yes, we have over 15 years of experience with 120+ MW installed and 25+ C&I (commercial & industrial) projects completed in Quebec. We work with partners like dream Industrial REIT and other major real estate managers."
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

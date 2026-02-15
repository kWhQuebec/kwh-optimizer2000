/**
 * SEO Utilities for kWh Québec Platform
 * Central repository for SEO configurations, schemas, and utilities
 */

import { organizationSchema, getLocalBusinessSchema, getServiceSchema, getFAQSchema } from "@/components/seo-head";

export type Language = "fr" | "en";

interface SEOConfig {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
  canonical?: string;
  locale: Language;
  noIndex?: boolean;
}

/**
 * SEO Content Dictionary
 * Centralized SEO metadata for all pages
 */
export const SEO_PAGES = {
  home: {
    fr: {
      title: "Installation Solaire Commerciale Québec | kWh Québec",
      description: "Réduisez vos coûts d'énergie avec le solaire commercial. Estimation gratuite en 2 minutes. Plus de 47 projets complétés au Québec.",
      keywords: "solaire commercial québec, panneaux solaires entreprise, stockage batterie industriel, hydro-québec autoproduction, incitatifs solaire québec, installation solaire",
      canonical: "https://kwh.quebec",
    },
    en: {
      title: "Commercial Solar Installation Quebec | kWh Québec",
      description: "Reduce your energy costs with commercial solar. Free estimate in 2 minutes. 47+ projects completed in Quebec.",
      keywords: "commercial solar quebec, business solar panels, industrial battery storage, hydro-quebec self-generation, quebec solar incentives, solar installation",
      canonical: "https://kwh.quebec/en",
    },
  },
  services: {
    fr: {
      title: "Services EPC Solaire | kWh Québec",
      description: "Services clé en main pour projets solaires commerciaux: analyse, ingénierie, construction et maintenance. Expertise québécoise en énergie solaire.",
      keywords: "EPC solaire québec, installation panneaux solaires, ingénierie solaire, maintenance système solaire, conception système PV",
      canonical: "https://kwh.quebec/services",
    },
    en: {
      title: "Solar EPC Services | kWh Québec",
      description: "Turnkey services for commercial solar projects: analysis, engineering, construction and maintenance. Quebec solar energy expertise.",
      keywords: "solar EPC quebec, solar panel installation, solar engineering, solar system maintenance, PV system design",
      canonical: "https://kwh.quebec/en/services",
    },
  },
  howItWorks: {
    fr: {
      title: "Comment ça marche | Processus d'analyse solaire | kWh Québec",
      description: "Découvrez notre processus en 6 étapes: de l'analyse gratuite à l'installation clé en main. Analyse GRATUITE en 2 minutes.",
      keywords: "processus solaire, analyse gratuite, installation solaire étapes, projet solaire commercial, how solar works",
      canonical: "https://kwh.quebec/comment-ca-marche",
    },
    en: {
      title: "How It Works | Solar Analysis Process | kWh Québec",
      description: "Discover our 6-step process: from free analysis to turnkey installation. FREE analysis in 2 minutes.",
      keywords: "solar process, free analysis, solar installation steps, commercial solar project, how solar works",
      canonical: "https://kwh.quebec/en/how-it-works",
    },
  },
  resources: {
    fr: {
      title: "Ressources et FAQ Solaire | kWh Québec",
      description: "Guides, FAQ et informations sur le solaire commercial au Québec: incitatifs, tarifs Hydro-Québec, retour sur investissement.",
      keywords: "FAQ solaire québec, guide incitatifs solaire, tarifs hydro-québec, ROI solaire commercial, ressources énergie",
      canonical: "https://kwh.quebec/ressources",
    },
    en: {
      title: "Solar Resources and FAQ | kWh Québec",
      description: "Guides, FAQ and information about commercial solar in Quebec: incentives, Hydro-Québec rates, return on investment.",
      keywords: "quebec solar FAQ, solar incentives guide, hydro-quebec rates, commercial solar ROI, energy resources",
      canonical: "https://kwh.quebec/en/resources",
    },
  },
  mandat: {
    fr: {
      title: "Mandat de Conception Préliminaire | kWh Québec",
      description: "Validation technique et financière de votre projet solaire commercial. Montant crédité intégralement sur contrat EPC.",
      keywords: "mandat conception, faisabilité solaire, étude préliminaire, analyse site solaire, devis gratuit",
      canonical: "https://kwh.quebec/mandat-conception",
    },
    en: {
      title: "Preliminary Design Mandate | kWh Québec",
      description: "Technical and financial validation of your commercial solar project. Amount fully credited toward EPC contract.",
      keywords: "design mandate, solar feasibility, preliminary study, site analysis, free quote",
      canonical: "https://kwh.quebec/en/design-mandate",
    },
  },
} as const;

/**
 * Get SEO configuration for a given page
 */
export function getSEOConfig(page: keyof typeof SEO_PAGES, language: Language): SEOConfig {
  const pageData = SEO_PAGES[page]?.[language] || SEO_PAGES.home[language];
  return {
    ...pageData,
    locale: language,
  } as SEOConfig;
}

/**
 * Build complete schema array for a page
 * Includes organization, local business, service, and FAQ schemas
 */
export function buildPageSchemas(language: Language) {
  return [
    organizationSchema,
    getLocalBusinessSchema(language),
    getServiceSchema(language),
    getFAQSchema(language),
  ];
}

/**
 * Generate structured data for breadcrumb navigation
 */
export function generateBreadcrumbs(items: Array<{ label: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.label,
      "item": item.url,
    })),
  };
}

/**
 * Utility to construct hreflang URL alternatives
 */
export function getAlternateLanguageUrls(basePath: string = "") {
  const cleanPath = basePath.replace(/\/$/, "");
  return {
    fr: `https://kwh.quebec${cleanPath || "/"}`,
    en: `https://kwh.quebec/en${cleanPath || "/"}`,
    default: `https://kwh.quebec${cleanPath || "/"}`,
  };
}

/**
 * Meta description length validation
 * Google recommends 150-160 characters
 */
export function isValidMetaDescription(description: string): boolean {
  const length = description.length;
  return length >= 120 && length <= 160;
}

/**
 * Meta title length validation
 * Google recommends 50-60 characters
 */
export function isValidMetaTitle(title: string): boolean {
  const length = title.length;
  return length >= 30 && length <= 60;
}

/**
 * Generate meta description for dynamic content
 */
export function generateMetaDescription(
  mainMessage: string,
  cta: string,
  suffix: string = "| kWh Québec"
): string {
  const description = `${mainMessage} ${cta} ${suffix}`;
  return description.substring(0, 160);
}

/**
 * Structured data for company contact information
 */
export const COMPANY_INFO = {
  name: "kWh Québec",
  email: "info@kwh.quebec",
  phone: "+1-514-427-8871",
  address: {
    city: "Montréal",
    region: "QC",
    country: "CA",
  },
  website: "https://kwh.quebec",
  languages: ["fr", "en"],
};

/**
 * Social media links (for sameAs schema)
 */
export const SOCIAL_MEDIA = {
  linkedin: "https://linkedin.com/company/kwh-quebec",
  twitter: "https://twitter.com/kwhquebec",
  facebook: "https://facebook.com/kwhquebec",
  instagram: "https://instagram.com/kwhquebec",
};

/**
 * Generate JSON-LD for local business with all contact info
 */
export function generateCompleteLocalBusinessSchema(language: Language) {
  const baseSchema = getLocalBusinessSchema(language);
  return {
    ...baseSchema,
    contactPoint: {
      "@type": "ContactPoint",
      "telephone": COMPANY_INFO.phone,
      "contactType": language === "fr" ? "Service Clientèle" : "Customer Service",
      "email": COMPANY_INFO.email,
    },
    sameAs: Object.values(SOCIAL_MEDIA),
  };
}

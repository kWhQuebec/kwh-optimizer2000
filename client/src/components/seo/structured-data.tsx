import { useEffect } from "react";

interface StructuredData {
  "@context": string;
  "@type": string;
  [key: string]: any;
}

interface StructuredDataProps {
  data: StructuredData | StructuredData[];
}

/**
 * StructuredData Component
 * Renders JSON-LD schema markup in the document head
 * Supports single schema or array of schemas
 */
export function StructuredData({ data }: StructuredDataProps) {
  useEffect(() => {
    // Ensure data is an array
    const schemas = Array.isArray(data) ? data : [data];

    // Create script tag for each schema
    const scriptIds = schemas.map((schema, index) => {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.id = `structured-data-${index}`;
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
      return `structured-data-${index}`;
    });

    // Cleanup
    return () => {
      scriptIds.forEach(id => {
        const script = document.getElementById(id);
        if (script) script.remove();
      });
    };
  }, [data]);

  return null;
}

// ==============================================================================
// SCHEMA BUILDERS - DYNAMIC, DATA-DRIVEN SCHEMAS
// ==============================================================================

export const localBusinessSchema = (config?: {
  phone?: string;
  email?: string;
  city?: string;
  region?: string;
}): StructuredData => ({
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "kWh Québec",
  "description": "Installation solaire commerciale et industrielle au Québec",
  "url": "https://kwh.quebec",
  "telephone": config?.phone || "+1-514-427-8871",
  "email": config?.email || "info@kwh.quebec",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": config?.city || "Montréal",
    "addressRegion": config?.region || "QC",
    "addressCountry": "CA"
  },
  "areaServed": {
    "@type": "Province",
    "name": "Québec"
  },
  "priceRange": "$$$",
  "serviceType": [
    "Installation solaire commerciale",
    "Conception de systèmes photovoltaïques",
    "Ingénierie solaire",
    "Stockage d'énergie"
  ]
});

export const serviceSchema = (): StructuredData => ({
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "Mandat de conception préliminaire",
  "description": "Validation technique et financière d'un projet solaire commercial",
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
    "description": "Crédité intégralement sur le contrat EPC si vous procédez"
  }
});

export const faqPageSchema = (): StructuredData => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Quel est le retour sur investissement typique pour un projet solaire commercial au Québec?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Le retour sur investissement typique pour un projet solaire commercial au Québec est de 4 à 7 ans, avec un TRI (taux de rendement interne) de 15% à 25%, en tenant compte des incitatifs Hydro-Québec et du crédit d'impôt fédéral."
      }
    },
    {
      "@type": "Question",
      "name": "Est-ce que le solaire fonctionne en hiver au Québec?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Oui, absolument. Les panneaux solaires sont dimensionnés sur la production annuelle complète. Bien que la production soit plus basse en hiver, le système bénéficie du mesurage net qui accumule les crédits sur 24 mois. Le froid améliore en fait l'efficacité des panneaux (+0,4% par degré sous 25°C), et l'effet albédo de la neige ajoute 5-10% de production supplémentaire."
      }
    },
    {
      "@type": "Question",
      "name": "Quels sont les incitatifs disponibles au Québec pour les projets solaires commerciaux?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Le Québec offre plusieurs incitatifs: Hydro-Québec offre jusqu'à 1 000 $/kW de crédit d'autoproduction, le gouvernement fédéral offre 30% de crédit d'impôt pour les investissements dans les technologies propres (CII), et l'amortissement accéléré (DPA 43.1/43.2) permet une déduction de 100% en première année pour fins fiscales."
      }
    },
    {
      "@type": "Question",
      "name": "Combien de temps prend le processus complet d'un projet solaire?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Le processus typique prend 4 à 6 mois: analyse gratuite (2 min), analyse détaillée (5-7 jours), rapport personnalisé (1-2 semaines), soumission (1-2 semaines), et finalement l'installation (2-4 mois selon la complexité du projet)."
      }
    },
    {
      "@type": "Question",
      "name": "Quel est le coût d'un mandat de conception préliminaire?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Le mandat de conception préliminaire coûte 2 500$ plus taxes. Cependant, ce montant est crédité intégralement sur le contrat EPC (ingénierie-approvisionnement-construction) si vous décidez de procéder avec kWh Québec."
      }
    },
    {
      "@type": "Question",
      "name": "Avez-vous une expérience avec des projets industriels et commerciaux?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Oui, nous avons plus de 15 ans d'expérience avec 120+ MW installés et 25+ projets C&I (commercial & industriel) complétés au Québec. Nous travaillons avec des partenaires comme dream Industrial REIT et d'autres gestionnaires immobiliers majeurs."
      }
    }
  ]
});

export const organizationSchema = (): StructuredData => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "kWh Québec",
  "url": "https://kwh.quebec",
  "logo": "https://kwh.quebec/logo.png",
  "description": "Solutions solaires et stockage clé en main pour bâtiments commerciaux et industriels au Québec",
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+1-514-427-8871",
    "contactType": "Customer Service",
    "email": "info@kwh.quebec"
  },
  "areaServed": {
    "@type": "AdministrativeArea",
    "name": "Québec, Canada"
  },
  "sameAs": []
});

export const breadcrumbSchema = (items: Array<{ name: string; url: string }>): StructuredData => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": items.map((item, index) => ({
    "@type": "ListItem",
    "position": index + 1,
    "name": item.name,
    "item": item.url
  }))
});

export const howToSchema = (steps: Array<{ position: number; name: string; description: string }>): StructuredData => ({
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "Comment obtenir une analyse solaire gratuite",
  "description": "Processus simple pour valider la viabilité de votre projet solaire commercial",
  "totalTime": "PT2M",
  "step": steps.map(step => ({
    "@type": "HowToStep",
    "position": step.position,
    "name": step.name,
    "text": step.description
  }))
});

export const aggregateRatingSchema = (): StructuredData => ({
  "@context": "https://schema.org",
  "@type": "AggregateRating",
  "ratingValue": "4.9",
  "ratingCount": "47",
  "bestRating": "5",
  "worstRating": "1"
});

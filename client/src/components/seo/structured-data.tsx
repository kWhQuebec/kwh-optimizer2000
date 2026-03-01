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
  "url": "https://www.kwh.quebec",
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
      "name": "Quels sont les incitatifs disponibles pour le solaire au Québec?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Au Québec, les principaux incitatifs incluent: le programme d'autoproduction d'Hydro-Québec (mesurage net), le crédit d'impôt fédéral de 30% pour les technologies propres (ITC, sous conditions d'éligibilité), et la déduction pour amortissement accéléré (CCA Catégorie 43.2, sous réserve des conditions d'éligibilité en vigueur — consultez votre comptable). L'éligibilité et les montants varient selon votre situation - notre analyse calcule les incitatifs applicables à votre projet."
      }
    },
    {
      "@type": "Question",
      "name": "Les systèmes de stockage sont-ils admissibles aux incitatifs?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Le stockage d'énergie peut être éligible au crédit d'impôt fédéral de 30% lorsqu'il est jumelé à un système solaire et répond aux critères d'éligibilité. Le programme d'autoproduction Hydro-Québec n'offre pas d'incitatif spécifique au stockage, mais celui-ci peut optimiser votre autoconsommation et réduire vos frais de pointe (Tarif M)."
      }
    },
    {
      "@type": "Question",
      "name": "Comment fonctionne la déduction pour amortissement (CCA 43.2)?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "La Catégorie 43.2 permet une déduction accélérée à un taux de 50% par année (solde dégressif), sous réserve des conditions d'éligibilité en vigueur. Des mesures temporaires d'amortissement immédiat peuvent permettre une déduction plus rapide sous certaines conditions. Consultez votre comptable pour les règles actuelles applicables à votre entreprise."
      }
    },
    {
      "@type": "Question",
      "name": "Le crédit d'impôt fédéral de 30% s'applique-t-il à mon projet?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Le crédit d'impôt à l'investissement (ITC) de 30% pour les technologies propres est disponible pour les entreprises canadiennes imposables. Des conditions s'appliquent, notamment des exigences de main-d'œuvre pour les projets plus importants. Les organismes exonérés d'impôt ne sont généralement pas éligibles. Notre analyse identifie votre éligibilité potentielle."
      }
    },
    {
      "@type": "Question",
      "name": "Qu'est-ce que le programme d'autoproduction d'Hydro-Québec?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Le programme d'autoproduction permet d'injecter votre surplus solaire sur le réseau et de le récupérer sous forme de crédits sur votre facture (jusqu'à 24 mois). Le surplus non utilisé après cette période est compensé au tarif de référence. La capacité maximale est de 1 MW par site. C'est un programme de mesurage net, pas une subvention directe."
      }
    },
    {
      "@type": "Question",
      "name": "Qu'est-ce que le programme ÉcoPerformance de TEQ?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Le programme ÉcoPerformance de Transition énergétique Québec (TEQ) peut couvrir jusqu'à 75% des coûts d'efficacité énergétique complémentaires au solaire, comme l'amélioration de l'enveloppe du bâtiment ou la mise à niveau des systèmes mécaniques. C'est un incitatif provincial distinct du crédit fédéral ITC et du programme d'autoproduction Hydro-Québec."
      }
    },
    {
      "@type": "Question",
      "name": "Quelle est la production solaire typique au Québec?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Au Québec, la production solaire moyenne est d'environ 1 150-1 300 kWh/kW/an selon la région et l'orientation. Montréal produit environ 1 200 kWh/kW/an. Notre analyse utilise des données satellitaires Google Solar et des simulations horaires sur une année complète (8 760 heures) pour estimer précisément votre production."
      }
    },
    {
      "@type": "Question",
      "name": "Combien d'espace de toit faut-il pour un système solaire?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "En règle générale, il faut environ 3,5 m² par kW installé pour des panneaux modernes de haute puissance (625W). Un système de 100 kW nécessiterait donc environ 350 m² de surface de toit utilisable. Notre analyse satellite évalue automatiquement la capacité de votre toiture en tenant compte des obstacles et de l'orientation."
      }
    },
    {
      "@type": "Question",
      "name": "Les panneaux solaires fonctionnent-ils en hiver au Québec?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Absolument! Les panneaux produisent toute l'année. Le froid améliore leur efficacité (+0,4%/°C sous 25°C). Selon l'étude NAIT Edmonton (5 ans, panneaux identiques à tous les angles), les racks ballastés à 10° ne perdent que ~5% annuellement à cause de la neige. Notre simulateur intègre ce profil validé par défaut."
      }
    },
    {
      "@type": "Question",
      "name": "Quelle est la différence entre le Tarif G et le Tarif M?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Le Tarif G (petit) s'applique aux puissances appelées <65 kW - facturation simple basée sur l'énergie (~11,3¢/kWh). Le Tarif M (moyen) s'applique aux puissances >100 kW - inclut des frais de puissance (~18$/kW/mois) plus l'énergie (~5¢/kWh). Avec le Tarif M, le stockage par batterie devient intéressant pour réduire la pointe de demande."
      }
    },
    {
      "@type": "Question",
      "name": "Mon toit doit-il être remplacé avant d'installer des panneaux?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Si votre toiture a moins de 10 ans de vie restante, il est recommandé de la remplacer avant l'installation. Les panneaux solaires durent 25-30 ans - vous voulez éviter de les démonter pour refaire le toit. Notre visite technique évalue l'état de votre toiture et nous pouvons coordonner le remplacement si nécessaire."
      }
    },
    {
      "@type": "Question",
      "name": "Quel est le retour sur investissement typique?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Avec les incitatifs actuels, le temps de retour typique est de 5-9 ans avec incitatifs pour les projets commerciaux au Québec. Le TRI (taux de rendement interne) se situe généralement entre 12% et 20%, selon la taille du système et le profil de consommation. La VAN sur 25 ans peut atteindre 2-3x l'investissement initial."
      }
    },
    {
      "@type": "Question",
      "name": "Quelles options d'acquisition sont disponibles?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Trois options principales: 1) Achat comptant - meilleur rendement long terme, 2) Prêt - conservation de tous les incitatifs avec paiements étalés, 3) Crédit-bail/location - flux de trésorerie positif dès le jour 1 en conservant tous les incitatifs. Notre analyse compare ces trois options pour votre situation."
      }
    },
    {
      "@type": "Question",
      "name": "Combien coûte un système solaire commercial au Québec?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Le coût installé varie de 1,50$ à 2,50$/W selon la taille et la complexité. Un système de 100 kW coûte typiquement 150 000$ - 200 000$ avant incitatifs. Après tous les incitatifs (Hydro-Québec, fédéral, fiscal), le coût net peut être réduit de 40-60%. Notre analyse fournit une estimation précise pour votre projet."
      }
    },
    {
      "@type": "Question",
      "name": "Le solaire augmente-t-il la valeur de mon bâtiment?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Oui! Des études montrent que les bâtiments commerciaux avec solaire se vendent en moyenne 3-4% plus cher. De plus, vous bénéficiez d'une protection contre les hausses de tarifs d'électricité, d'une image de durabilité attractive pour les locataires/clients, et de flux de trésorerie prévisibles sur 25+ ans."
      }
    },
    {
      "@type": "Question",
      "name": "Qu'est-ce qu'un PPA et est-ce une bonne option?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Un PPA (Power Purchase Agreement) est un contrat où un tiers installe et possède le système - vous achetez l'électricité à tarif fixe. Avantage: 0$ d'investissement. Inconvénient: le tiers garde les incitatifs et une grande partie des économies. Pour les entreprises qui peuvent investir ou financer, l'achat direct offre généralement un meilleur rendement."
      }
    },
    {
      "@type": "Question",
      "name": "Combien de temps prend un projet solaire complet?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Du premier contact à la mise en service: Analyse préliminaire (1-2 semaines), Visite technique et design (2-4 semaines), Ingénierie et permis (4-8 semaines), Construction (4-12 semaines selon la taille). Total: 3-6 mois typiquement pour un projet commercial de 50-500 kW."
      }
    },
    {
      "@type": "Question",
      "name": "Qu'est-ce que la procuration Hydro-Québec?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "La procuration Hydro-Québec est un formulaire standard qui nous autorise à accéder à votre historique de consommation électrique détaillé (données 15 minutes). Ces données sont essentielles pour effectuer une analyse précise de dimensionnement et calculer l'autoconsommation. Le processus est 100% électronique, sécurisé et gratuit."
      }
    },
    {
      "@type": "Question",
      "name": "Ai-je besoin d'une licence RBQ pour installer du solaire?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "L'installateur doit détenir une licence RBQ (Régie du bâtiment du Québec) avec les sous-catégories appropriées (électricité, installation d'équipements). kWh Québec détient les licences nécessaires et réalise les installations avec son équipe qualifiée. Vous n'avez pas besoin de licence vous-même en tant que propriétaire."
      }
    },
    {
      "@type": "Question",
      "name": "Quelle maintenance est requise pour un système solaire?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Les systèmes solaires nécessitent très peu de maintenance. Inspection visuelle annuelle, nettoyage occasionnel si accumulation importante de débris, et vérification des connexions électriques tous les 2-3 ans. Les panneaux sont garantis 25 ans avec dégradation de 0,35-0,5%/an après la première année (dégradation initiale ~1-2% selon le fabricant). Le monitoring à distance permet de détecter rapidement tout problème."
      }
    },
    {
      "@type": "Question",
      "name": "Que se passe-t-il si je vends mon bâtiment?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Le système solaire peut être transféré au nouveau propriétaire comme équipement fixe - c'est généralement un argument de vente positif. Les garanties sont transférables. Si vous avez un prêt ou crédit-bail, les conditions de transfert dépendent du contrat. Dans tous les cas, un système performant ajoute de la valeur à votre propriété."
      }
    }
  ]
});

export const organizationSchema = (): StructuredData => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "kWh Québec",
  "url": "https://www.kwh.quebec",
  "logo": "https://www.kwh.quebec/logo.png",
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

import { storage } from "./storage";
import { createLogger } from "./lib/logger";

const log = createLogger("ContentSeed");

const DEFAULT_CONTENT = [
  {
    contentKey: "testimonials",
    contentType: "json",
    label: "Témoignages clients",
    category: "social_proof",
    sortOrder: 1,
    isActive: true,
    value: [
      {
        name: "Martin Tremblay",
        role: { fr: "Directeur des opérations", en: "Operations Director" },
        company: "Entrepôts Québec Inc.",
        text: {
          fr: "En 6 mois, notre facture d'énergie a baissé de 38%. Le retour sur investissement est même meilleur que ce que kWh Québec avait projeté.",
          en: "In 6 months, our energy bill dropped 38%. The ROI is even better than what kWh Québec projected."
        },
        savings: "$42,000/an",
        system: "185 kW"
      },
      {
        name: "Sophie Lavoie",
        role: { fr: "Propriétaire", en: "Owner" },
        company: "Centre Commercial Rive-Sud",
        text: {
          fr: "Le processus était transparent du début à la fin. L'équipe de kWh Québec a géré les incitatifs, la procuration Hydro-Québec, tout. On n'a presque rien eu à faire.",
          en: "The process was transparent from start to finish. The kWh Québec team handled incentives, Hydro-Québec procuration, everything. We barely had to do anything."
        },
        savings: "$67,000/an",
        system: "320 kW"
      },
      {
        name: "Jean-François Bouchard",
        role: { fr: "VP Finance", en: "VP Finance" },
        company: "Industries Beauce Ltée",
        text: {
          fr: "Le stockage combiné au solaire nous a permis de réduire notre appel de puissance de 22%. C'est un impact direct sur la facture que je n'avais pas anticipé.",
          en: "Combined storage and solar allowed us to reduce our peak demand by 22%. That's a direct bill impact I hadn't anticipated."
        },
        savings: "$89,000/an",
        system: "450 kW + 200 kWh"
      }
    ],
  },
  {
    contentKey: "faq",
    contentType: "json",
    label: "Questions fréquentes (FAQ)",
    category: "landing",
    sortOrder: 2,
    isActive: true,
    value: [
      {
        question: { fr: "Combien coûte une installation solaire commerciale au Québec?", en: "How much does a commercial solar installation cost in Quebec?" },
        answer: { fr: "Le coût varie entre 1.50$ et 2.50$ par watt installé avant incitatifs. Avec les crédits Hydro-Québec (40%), fédéral (30%) et l'amortissement accéléré, le coût net peut descendre à 0.60-1.00$/W. Pour un système de 200 kW, ça représente 120 000$ à 200 000$ net.", en: "Cost ranges from $1.50 to $2.50 per watt before incentives. With Hydro-Québec credits (40%), federal (30%) and accelerated depreciation, net cost can drop to $0.60-1.00/W. For a 200 kW system, that's $120,000 to $200,000 net." }
      },
      {
        question: { fr: "Quels incitatifs sont disponibles au Québec en 2026?", en: "What incentives are available in Quebec in 2026?" },
        answer: { fr: "Trois incitatifs cumulables: le crédit Hydro-Québec (jusqu'à 40%), le crédit d'impôt fédéral pour technologies propres (30%), et l'amortissement accéléré en catégorie 43.1/43.2 (100% déductible en année 1). Total potentiel: jusqu'à 60% du projet.", en: "Three stackable incentives: Hydro-Québec credit (up to 40%), federal clean technology tax credit (30%), and accelerated depreciation in category 43.1/43.2 (100% deductible in year 1). Total potential: up to 60% of the project." }
      },
      {
        question: { fr: "Le solaire fonctionne-t-il en hiver au Québec?", en: "Does solar work in winter in Quebec?" },
        answer: { fr: "Oui. Les panneaux produisent 25-30% de leur capacité en hiver. Les journées froides et ensoleillées sont idéales — le froid améliore l'efficacité. La neige cause 5-10% de perte saisonnière, mais les panneaux sont conçus pour la rejeter.", en: "Yes. Panels produce 25-30% of capacity in winter. Cold, sunny days are ideal — cold improves efficiency. Snow causes 5-10% seasonal loss, but panels are designed to shed it." }
      },
      {
        question: { fr: "Combien de temps prend le projet complet?", en: "How long does the full project take?" },
        answer: { fr: "Du mandat de conception à la mise en service: 3-5 mois selon la taille du projet. La visite et proposition prennent 2-3 semaines, les permis 6-10 semaines, et l'installation + mise en service 4-8 semaines.", en: "From design mandate to commissioning: 3-5 months depending on project size. Visit and proposal take 2-3 weeks, permits 6-10 weeks, and installation + commissioning 4-8 weeks." }
      },
      {
        question: { fr: "Qu'est-ce que la procuration Hydro-Québec?", en: "What is the Hydro-Québec procuration?" },
        answer: { fr: "La procuration autorise kWh Québec à accéder à vos données de consommation Hydro-Québec pour une analyse précise. C'est un document sécurisé, révocable à tout moment.", en: "The procuration authorizes kWh Québec to access your Hydro-Québec consumption data for accurate analysis. It's a secure document, revocable at any time." }
      },
      {
        question: { fr: "Quelle est la durée de vie des panneaux solaires?", en: "What is the lifespan of solar panels?" },
        answer: { fr: "Les panneaux sont garantis 25 ans par le fabricant et ont une durée de vie réelle de 30-35 ans. Après 25 ans, ils produisent encore ~85% de leur capacité initiale.", en: "Panels are warranted 25 years by the manufacturer and have a real lifespan of 30-35 years. After 25 years, they still produce ~85% of initial capacity." }
      },
      {
        question: { fr: "Le solaire augmente-t-il la valeur de mon bâtiment?", en: "Does solar increase my building's value?" },
        answer: { fr: "Oui. Les études montrent une augmentation de 3-4% de la valeur commerciale. Un bâtiment avec des coûts d'énergie réduits est plus attractif pour les acheteurs et locataires.", en: "Yes. Studies show a 3-4% increase in commercial value. A building with reduced energy costs is more attractive to buyers and tenants." }
      },
      {
        question: { fr: "Que se passe-t-il si je vends mon bâtiment?", en: "What happens if I sell my building?" },
        answer: { fr: "Le système solaire reste avec le bâtiment et est transféré au nouveau propriétaire. C'est un argument de vente: le nouveau propriétaire hérite d'économies d'énergie immédiates.", en: "The solar system stays with the building and transfers to the new owner. It's a selling point: the new owner inherits immediate energy savings." }
      }
    ],
  },
  {
    contentKey: "tripwire",
    contentType: "json",
    label: "Tripwire — Étude de design",
    category: "pricing",
    sortOrder: 3,
    isActive: true,
    value: {
      price: 2500,
      currency: "CAD",
      title: { fr: "Mandat de conception préliminaire", en: "Preliminary Design Mandate" },
      subtitle: { fr: "L'étape intelligente avant d'investir — rapport complet et utilisable", en: "The smart step before investing — complete and usable report" },
      items: {
        fr: [
          "Visite sur site par un ingénieur certifié",
          "Analyse d'ombrage 3D (LiDAR + satellite)",
          "Modélisation 3D de votre toiture",
          "Design optimal du système PV + stockage",
          "Projections ROI sur 25 ans",
          "Comparaison Cash vs Lease vs PPA",
          "Optimisation des incitatifs (Hydro-Québec + fédéral)"
        ],
        en: [
          "On-site visit by certified engineer",
          "3D shade analysis (LiDAR + satellite)",
          "3D roof modeling",
          "Optimal PV + storage system design",
          "25-year ROI projections",
          "Cash vs Lease vs PPA comparison",
          "Incentive optimization (Hydro-Québec + federal)"
        ]
      },
      guarantee: {
        fr: "Le rapport de conception est complet et utilisable indépendamment du fournisseur choisi pour l'installation.",
        en: "The design report is complete and usable regardless of which provider you choose for installation."
      },
      cta: { fr: "Réserver mon mandat de conception", en: "Book my design mandate" }
    },
  },
  {
    contentKey: "referral",
    contentType: "json",
    label: "Programme de référence",
    category: "pricing",
    sortOrder: 4,
    isActive: true,
    value: {
      amount: 1000,
      currency: "CAD",
      title: { fr: "Référez un collègue, gagnez 1,000$", en: "Refer a colleague, earn $1,000" },
      subtitle: { fr: "Pour chaque entreprise référée qui signe un contrat d'installation, vous recevez 1,000$ en carte-cadeau.", en: "For every referred business that signs an installation contract, you receive a $1,000 gift card." },
      steps: {
        fr: ["Partagez votre lien unique avec un collègue", "Ils obtiennent une analyse gratuite", "Quand ils signent, vous recevez 1,000$"],
        en: ["Share your unique link with a colleague", "They get a free analysis", "When they sign, you get $1,000"]
      },
      cta: { fr: "Référer maintenant", en: "Refer now" }
    },
  },
  {
    contentKey: "landing_hero",
    contentType: "json",
    label: "Hero — Landing page",
    category: "landing",
    sortOrder: 0,
    isActive: true,
    value: {
      title: { fr: "Réduisez vos coûts d'énergie avec le solaire commercial", en: "Reduce your energy costs with commercial solar" },
      description: { fr: "Vos coûts d'énergie augmentent chaque année. Découvrez combien vous pourriez économiser avec une installation solaire optimisée pour votre bâtiment.", en: "Your energy costs increase every year. Discover how much you could save with a solar installation optimized for your building." },
      cta: { fr: "Calculer mes économies gratuitement", en: "Calculate my savings for free" }
    },
  }
];

export async function seedDefaultContent() {
  try {
    const existing = await storage.getSiteContentAll();
    if (existing.length > 0) {
      log.info(`Site content already has ${existing.length} entries, skipping seed`);
      return;
    }

    log.info("Seeding default site content...");
    for (const item of DEFAULT_CONTENT) {
      await storage.createSiteContent(item as any);
    }
    log.info(`Seeded ${DEFAULT_CONTENT.length} default content items`);
  } catch (error) {
    log.error("Failed to seed default content:", error);
    // Don't throw - this is not critical
  }
}

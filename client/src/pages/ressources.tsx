import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { 
  BookOpen, FileText, HelpCircle, TrendingUp, Zap, DollarSign,
  ArrowRight, ChevronDown, ChevronUp, Search, Tag, CheckCircle, XCircle, AlertCircle, Book
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";
import { SEOHead, seoContent, getFAQSchema } from "@/components/seo-head";
import logoFr from "@assets/kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png";
import logoEn from "@assets/kWh_Quebec_Logo-02_-_Rectangle_1764799021536.png";

export default function RessourcesPage() {
  const { language } = useI18n();
  const currentLogo = language === "fr" ? logoFr : logoEn;
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = [
    { id: "incentives", label: language === "fr" ? "Incitatifs" : "Incentives", icon: DollarSign },
    { id: "technical", label: language === "fr" ? "Technique" : "Technical", icon: Zap },
    { id: "financial", label: language === "fr" ? "Financier" : "Financial", icon: TrendingUp },
    { id: "process", label: language === "fr" ? "Processus" : "Process", icon: FileText },
  ];

  const faqItems = [
    // INCENTIVES (5 questions)
    {
      category: "incentives",
      question: language === "fr" 
        ? "Quels sont les incitatifs disponibles pour le solaire au Québec?"
        : "What incentives are available for solar in Quebec?",
      answer: language === "fr"
        ? "Au Québec, les principaux incitatifs incluent: le programme d'autoproduction d'Hydro-Québec (mesurage net), le crédit d'impôt fédéral de 30% pour les technologies propres (ITC, sous conditions d'éligibilité), et la déduction pour amortissement accéléré (CCA Catégorie 43.2). L'éligibilité et les montants varient selon votre situation - notre analyse calcule les incitatifs applicables à votre projet."
        : "In Quebec, main incentives include: Hydro-Québec's self-generation program (net metering), the 30% federal clean technology investment tax credit (ITC, subject to eligibility), and accelerated capital cost allowance (CCA Class 43.2). Eligibility and amounts vary by situation - our analysis calculates incentives applicable to your project."
    },
    {
      category: "incentives",
      question: language === "fr"
        ? "Les batteries de stockage sont-elles admissibles aux incitatifs?"
        : "Are battery storage systems eligible for incentives?",
      answer: language === "fr"
        ? "Le stockage par batterie peut être éligible au crédit d'impôt fédéral de 30% lorsqu'il est jumelé à un système solaire et répond aux critères d'éligibilité. Le programme d'autoproduction HQ n'offre pas d'incitatif spécifique aux batteries, mais celles-ci peuvent optimiser votre autoconsommation et réduire vos frais de pointe (Tarif M)."
        : "Battery storage may be eligible for the 30% federal tax credit when paired with a solar system and meeting eligibility criteria. The HQ self-generation program doesn't offer battery-specific incentives, but batteries can optimize self-consumption and reduce peak demand charges (Rate M)."
    },
    {
      category: "incentives",
      question: language === "fr"
        ? "Comment fonctionne la déduction pour amortissement (CCA 43.2)?"
        : "How does capital cost allowance (CCA Class 43.2) work?",
      answer: language === "fr"
        ? "La Catégorie 43.2 permet une déduction accélérée à un taux de 50% par année (solde dégressif). Des mesures temporaires d'amortissement immédiat peuvent permettre une déduction plus rapide sous certaines conditions. Consultez votre comptable pour les règles actuelles applicables à votre entreprise."
        : "Class 43.2 allows accelerated depreciation at 50% per year (declining balance). Temporary immediate expensing measures may allow faster deduction under certain conditions. Consult your accountant for current rules applicable to your business."
    },
    {
      category: "incentives",
      question: language === "fr"
        ? "Le crédit d'impôt fédéral de 30% s'applique-t-il à mon projet?"
        : "Does the 30% federal tax credit apply to my project?",
      answer: language === "fr"
        ? "Le crédit d'impôt à l'investissement (ITC) de 30% pour les technologies propres est disponible pour les entreprises canadiennes imposables. Des conditions s'appliquent, notamment des exigences de main-d'œuvre pour les projets plus importants. Les organismes exonérés d'impôt ne sont généralement pas éligibles. Notre analyse identifie votre éligibilité potentielle."
        : "The 30% clean technology investment tax credit (ITC) is available to taxable Canadian businesses. Conditions apply, including labour requirements for larger projects. Tax-exempt organizations are generally not eligible. Our analysis identifies your potential eligibility."
    },
    {
      category: "incentives",
      question: language === "fr"
        ? "Qu'est-ce que le programme d'autoproduction d'Hydro-Québec?"
        : "What is Hydro-Québec's self-generation program?",
      answer: language === "fr"
        ? "Le programme d'autoproduction permet d'injecter votre surplus solaire sur le réseau et de le récupérer sous forme de crédits sur votre facture (jusqu'à 24 mois). Le surplus non utilisé après cette période est compensé au tarif de référence. La capacité maximale est de 1 MW par site. C'est un programme de mesurage net, pas une subvention directe."
        : "The self-generation program lets you inject solar surplus onto the grid and recover it as credits on your bill (up to 24 months). Unused surplus after this period is compensated at the reference rate. Maximum capacity is 1 MW per site. This is a net metering program, not a direct subsidy."
    },

    // TECHNICAL (5 questions)
    {
      category: "technical",
      question: language === "fr"
        ? "Quelle est la production solaire typique au Québec?"
        : "What is typical solar production in Quebec?",
      answer: language === "fr"
        ? "Au Québec, la production solaire moyenne est d'environ 1 150-1 300 kWh/kW/an selon la région et l'orientation. Montréal produit environ 1 200 kWh/kW/an. Notre analyse utilise des données satellitaires Google Solar et des simulations horaires sur 8 760 heures pour estimer précisément votre production."
        : "In Quebec, average solar production is approximately 1,150-1,300 kWh/kW/year depending on region and orientation. Montreal produces about 1,200 kWh/kW/year. Our analysis uses Google Solar satellite data and 8,760-hour simulations to precisely estimate your production."
    },
    {
      category: "technical",
      question: language === "fr"
        ? "Combien d'espace de toit faut-il pour un système solaire?"
        : "How much roof space is needed for a solar system?",
      answer: language === "fr"
        ? "En règle générale, il faut environ 5-6 m² par kW installé pour des panneaux modernes (400-500W). Un système de 100 kW nécessiterait donc environ 500-600 m² de surface de toit utilisable. Notre analyse satellite évalue automatiquement la capacité de votre toiture en tenant compte des obstacles et de l'orientation."
        : "As a general rule, about 5-6 m² per installed kW is needed for modern panels (400-500W). A 100 kW system would require approximately 500-600 m² of usable roof space. Our satellite analysis automatically evaluates your roof capacity accounting for obstacles and orientation."
    },
    {
      category: "technical",
      question: language === "fr"
        ? "Les panneaux solaires fonctionnent-ils en hiver au Québec?"
        : "Do solar panels work in winter in Quebec?",
      answer: language === "fr"
        ? "Absolument! Les panneaux produisent toute l'année. En fait, le froid améliore leur efficacité. La production hivernale représente environ 15-20% de la production annuelle. La neige glisse généralement des panneaux inclinés et le système est dimensionné pour l'année complète, pas juste l'été."
        : "Absolutely! Panels produce year-round. In fact, cold temperatures improve their efficiency. Winter production represents about 15-20% of annual production. Snow typically slides off tilted panels and the system is sized for the full year, not just summer."
    },
    {
      category: "technical",
      question: language === "fr"
        ? "Quelle est la différence entre le Tarif G et le Tarif M?"
        : "What's the difference between Rate G and Rate M?",
      answer: language === "fr"
        ? "Le Tarif G (petit) s'applique aux puissances appelées <65 kW - facturation simple basée sur l'énergie (~11,3¢/kWh). Le Tarif M (moyen) s'applique aux puissances >100 kW - inclut des frais de puissance (~18$/kW/mois) plus l'énergie (~5¢/kWh). Avec le Tarif M, le stockage par batterie devient intéressant pour réduire la pointe de demande."
        : "Rate G (small) applies to demand <65 kW - simple billing based on energy (~11.3¢/kWh). Rate M (medium) applies to demand >100 kW - includes power charges (~$18/kW/month) plus energy (~5¢/kWh). With Rate M, battery storage becomes attractive to reduce peak demand."
    },
    {
      category: "technical",
      question: language === "fr"
        ? "Mon toit doit-il être remplacé avant d'installer des panneaux?"
        : "Does my roof need to be replaced before installing panels?",
      answer: language === "fr"
        ? "Si votre toiture a moins de 10 ans de vie restante, il est recommandé de la remplacer avant l'installation. Les panneaux solaires durent 25-30 ans - vous voulez éviter de les démonter pour refaire le toit. Notre visite technique évalue l'état de votre toiture et nous pouvons coordonner le remplacement si nécessaire."
        : "If your roof has less than 10 years of remaining life, it's recommended to replace it before installation. Solar panels last 25-30 years - you want to avoid removing them to redo the roof. Our technical visit evaluates your roof condition and we can coordinate replacement if needed."
    },

    // FINANCIAL (5 questions)
    {
      category: "financial",
      question: language === "fr"
        ? "Quel est le retour sur investissement typique?"
        : "What is the typical return on investment?",
      answer: language === "fr"
        ? "Avec les incitatifs actuels, le temps de retour typique est de 4-7 ans pour les projets commerciaux au Québec. Le TRI (taux de rendement interne) se situe généralement entre 12% et 20%, selon la taille du système et le profil de consommation. La VAN sur 25 ans peut atteindre 2-3x l'investissement initial."
        : "With current incentives, typical payback is 4-7 years for commercial projects in Quebec. IRR (internal rate of return) generally ranges between 12% and 20%, depending on system size and consumption profile. NPV over 25 years can reach 2-3x the initial investment."
    },
    {
      category: "financial",
      question: language === "fr"
        ? "Quelles options de financement sont disponibles?"
        : "What financing options are available?",
      answer: language === "fr"
        ? "Trois options principales: 1) Achat comptant - meilleur rendement long terme, 2) Prêt - conservation de tous les incitatifs avec paiements étalés, 3) Crédit-bail/location - flux de trésorerie positif dès le jour 1 en conservant tous les incitatifs. Notre analyse compare ces trois options pour votre situation."
        : "Three main options: 1) Cash purchase - best long-term return, 2) Loan - keep all incentives with spread payments, 3) Capital lease - positive cash flow from day 1 while retaining all incentives. Our analysis compares these three options for your situation."
    },
    {
      category: "financial",
      question: language === "fr"
        ? "Combien coûte un système solaire commercial au Québec?"
        : "How much does a commercial solar system cost in Quebec?",
      answer: language === "fr"
        ? "Le coût installé varie de 1,50$ à 2,50$/W selon la taille et la complexité. Un système de 100 kW coûte typiquement 150 000$ - 200 000$ avant incitatifs. Après tous les incitatifs (HQ, fédéral, fiscal), le coût net peut être réduit de 40-60%. Notre analyse fournit une estimation précise pour votre projet."
        : "Installed cost ranges from $1.50 to $2.50/W depending on size and complexity. A 100 kW system typically costs $150,000 - $200,000 before incentives. After all incentives (HQ, federal, tax), net cost can be reduced by 40-60%. Our analysis provides a precise estimate for your project."
    },
    {
      category: "financial",
      question: language === "fr"
        ? "Le solaire augmente-t-il la valeur de mon bâtiment?"
        : "Does solar increase my building's value?",
      answer: language === "fr"
        ? "Oui! Des études montrent que les bâtiments commerciaux avec solaire se vendent en moyenne 3-4% plus cher. De plus, vous bénéficiez d'une protection contre les hausses de tarifs d'électricité, d'une image de durabilité attractive pour les locataires/clients, et de flux de trésorerie prévisibles sur 25+ ans."
        : "Yes! Studies show commercial buildings with solar sell for 3-4% more on average. Additionally, you benefit from protection against electricity rate increases, an attractive sustainability image for tenants/clients, and predictable cash flows over 25+ years."
    },
    {
      category: "financial",
      question: language === "fr"
        ? "Qu'est-ce qu'un PPA et est-ce une bonne option?"
        : "What is a PPA and is it a good option?",
      answer: language === "fr"
        ? "Un PPA (Power Purchase Agreement) est un contrat où un tiers installe et possède le système - vous achetez l'électricité à tarif fixe. Avantage: 0$ d'investissement. Inconvénient: le tiers garde les incitatifs et une grande partie des économies. Pour les entreprises qui peuvent investir ou financer, l'achat direct offre généralement un meilleur rendement."
        : "A PPA (Power Purchase Agreement) is a contract where a third party installs and owns the system - you buy electricity at a fixed rate. Advantage: $0 investment. Disadvantage: the third party keeps the incentives and most of the savings. For businesses that can invest or finance, direct purchase generally offers better returns."
    },

    // PROCESS (5 questions)
    {
      category: "process",
      question: language === "fr"
        ? "Combien de temps prend un projet solaire complet?"
        : "How long does a complete solar project take?",
      answer: language === "fr"
        ? "Du premier contact à la mise en service: Analyse préliminaire (1-2 semaines), Visite technique et design (2-4 semaines), Ingénierie et permis (4-8 semaines), Construction (4-12 semaines selon la taille). Total: 3-6 mois typiquement pour un projet commercial de 50-500 kW."
        : "From first contact to commissioning: Preliminary analysis (1-2 weeks), Technical visit and design (2-4 weeks), Engineering and permits (4-8 weeks), Construction (4-12 weeks depending on size). Total: 3-6 months typically for a 50-500 kW commercial project."
    },
    {
      category: "process",
      question: language === "fr"
        ? "Qu'est-ce que la procuration Hydro-Québec?"
        : "What is the Hydro-Québec authorization?",
      answer: language === "fr"
        ? "La procuration HQ est un formulaire standard qui nous autorise à accéder à votre historique de consommation électrique détaillé (données 15 minutes). Ces données sont essentielles pour effectuer une analyse précise de dimensionnement et calculer l'autoconsommation. Le processus est 100% électronique, sécurisé et gratuit."
        : "The HQ authorization is a standard form that allows us to access your detailed electricity consumption history (15-minute data). This data is essential for accurate sizing analysis and calculating self-consumption. The process is 100% electronic, secure and free."
    },
    {
      category: "process",
      question: language === "fr"
        ? "Ai-je besoin d'une licence RBQ pour installer du solaire?"
        : "Do I need an RBQ license to install solar?",
      answer: language === "fr"
        ? "L'installateur doit détenir une licence RBQ (Régie du bâtiment du Québec) avec les sous-catégories appropriées (électricité, installation d'équipements). kWh Québec travaille exclusivement avec des installateurs qualifiés et licenciés. Vous n'avez pas besoin de licence vous-même en tant que propriétaire."
        : "The installer must hold an RBQ (Régie du bâtiment du Québec) license with appropriate sub-categories (electricity, equipment installation). kWh Québec works exclusively with qualified and licensed installers. You don't need a license yourself as the property owner."
    },
    {
      category: "process",
      question: language === "fr"
        ? "Quelle maintenance est requise pour un système solaire?"
        : "What maintenance is required for a solar system?",
      answer: language === "fr"
        ? "Les systèmes solaires nécessitent très peu de maintenance. Inspection visuelle annuelle, nettoyage occasionnel si accumulation importante de débris, et vérification des connexions électriques tous les 2-3 ans. Les panneaux sont garantis 25 ans avec dégradation <0,5%/an. Le monitoring à distance permet de détecter rapidement tout problème."
        : "Solar systems require very little maintenance. Annual visual inspection, occasional cleaning if significant debris accumulation, and electrical connection check every 2-3 years. Panels are warranted 25 years with degradation <0.5%/year. Remote monitoring allows quick detection of any issues."
    },
    {
      category: "process",
      question: language === "fr"
        ? "Que se passe-t-il si je vends mon bâtiment?"
        : "What happens if I sell my building?",
      answer: language === "fr"
        ? "Le système solaire peut être transféré au nouveau propriétaire comme équipement fixe - c'est généralement un argument de vente positif. Les garanties sont transférables. Si vous avez un prêt ou crédit-bail, les conditions de transfert dépendent du contrat. Dans tous les cas, un système performant ajoute de la valeur à votre propriété."
        : "The solar system can be transferred to the new owner as fixed equipment - this is generally a positive selling point. Warranties are transferable. If you have a loan or lease, transfer conditions depend on the contract. In all cases, a performing system adds value to your property."
    },
  ];

  const guides = [
    {
      title: language === "fr" ? "Guide actuel des incitatifs solaires" : "Current Solar Incentives Guide",
      description: language === "fr"
        ? "Tout ce que vous devez savoir sur le programme HQ, le crédit fédéral et les avantages fiscaux."
        : "Everything you need to know about the HQ program, federal credit, and tax benefits.",
      category: "incentives",
      readTime: "8 min",
      slug: "incitatifs-solaires-quebec-2025"
    },
    {
      title: language === "fr" ? "Comprendre votre facture Hydro-Québec" : "Understanding Your Hydro-Québec Bill",
      description: language === "fr"
        ? "Décodez les tarifs G, M et L et comprenez comment le solaire impacte votre facture."
        : "Decode G, M, and L rates and understand how solar impacts your bill.",
      category: "technical",
      readTime: "5 min",
      slug: "comprendre-facture-hydro-quebec"
    },
    {
      title: language === "fr" ? "Solaire commercial vs résidentiel" : "Commercial vs Residential Solar",
      description: language === "fr"
        ? "Les différences clés entre les projets résidentiels et commerciaux."
        : "Key differences between residential and commercial projects.",
      category: "financial",
      readTime: "6 min",
      slug: "solaire-commercial-vs-residentiel"
    },
  ];

  // Glossaire solaire bilingue
  const glossaryTerms = [
    {
      term: language === "fr" ? "kW (kilowatt)" : "kW (kilowatt)",
      definition: language === "fr"
        ? "Unité de puissance. Mesure la capacité instantanée d'un système. Ex: Un système de 100 kW peut produire jusqu'à 100 kW à un moment donné."
        : "Unit of power. Measures instantaneous system capacity. Ex: A 100 kW system can produce up to 100 kW at any given moment."
    },
    {
      term: language === "fr" ? "kWh (kilowatt-heure)" : "kWh (kilowatt-hour)",
      definition: language === "fr"
        ? "Unité d'énergie. Mesure la quantité d'électricité produite ou consommée sur une période. Ex: 100 kWh = 100 kW pendant 1 heure."
        : "Unit of energy. Measures electricity produced or consumed over time. Ex: 100 kWh = 100 kW for 1 hour."
    },
    {
      term: language === "fr" ? "Autoconsommation" : "Self-consumption",
      definition: language === "fr"
        ? "Pourcentage de la production solaire consommée directement sur place. Une autoconsommation de 70% signifie que 70% de l'électricité produite est utilisée immédiatement."
        : "Percentage of solar production consumed directly on-site. 70% self-consumption means 70% of electricity produced is used immediately."
    },
    {
      term: language === "fr" ? "Autosuffisance" : "Self-sufficiency",
      definition: language === "fr"
        ? "Pourcentage de votre consommation totale couverte par le solaire. Ex: 30% d'autosuffisance = 30% de vos besoins sont satisfaits par votre production solaire."
        : "Percentage of your total consumption covered by solar. Ex: 30% self-sufficiency = 30% of your needs are met by your solar production."
    },
    {
      term: language === "fr" ? "Net metering (mesurage net)" : "Net metering",
      definition: language === "fr"
        ? "Système où votre surplus solaire injecté au réseau est crédité sur votre facture. Au Québec, les crédits sont valides 24 mois via le programme d'autoproduction HQ."
        : "System where your solar surplus injected to the grid is credited on your bill. In Quebec, credits are valid 24 months via the HQ self-generation program."
    },
    {
      term: language === "fr" ? "Tarif G" : "Rate G",
      definition: language === "fr"
        ? "Tarif d'électricité pour les clients à faible puissance (<65 kW). Facturation simple basée principalement sur l'énergie (kWh) consommée."
        : "Electricity rate for low-power customers (<65 kW). Simple billing based primarily on energy (kWh) consumed."
    },
    {
      term: language === "fr" ? "Tarif M" : "Rate M",
      definition: language === "fr"
        ? "Tarif d'électricité pour les clients à puissance moyenne (>100 kW). Inclut des frais de puissance ($/kW) basés sur votre pointe de demande mensuelle."
        : "Electricity rate for medium-power customers (>100 kW). Includes power charges ($/kW) based on your monthly peak demand."
    },
    {
      term: language === "fr" ? "Pointe de demande" : "Peak demand",
      definition: language === "fr"
        ? "La puissance maximale (kW) que vous tirez du réseau sur une période de 15 minutes. Les clients Tarif M paient des frais mensuels basés sur cette pointe."
        : "The maximum power (kW) you draw from the grid over a 15-minute period. Rate M customers pay monthly charges based on this peak."
    },
    {
      term: language === "fr" ? "VAN (Valeur Actuelle Nette)" : "NPV (Net Present Value)",
      definition: language === "fr"
        ? "Indicateur financier qui calcule la valeur totale des flux de trésorerie futurs en dollars d'aujourd'hui. Une VAN positive signifie un investissement rentable."
        : "Financial indicator that calculates total value of future cash flows in today's dollars. A positive NPV means a profitable investment."
    },
    {
      term: language === "fr" ? "TRI (Taux de Rendement Interne)" : "IRR (Internal Rate of Return)",
      definition: language === "fr"
        ? "Taux de rendement annuel d'un investissement. Un TRI de 15% signifie que votre investissement génère un rendement équivalent à 15%/an."
        : "Annual rate of return on an investment. An IRR of 15% means your investment generates returns equivalent to 15%/year."
    },
    {
      term: language === "fr" ? "Période de retour (payback)" : "Payback period",
      definition: language === "fr"
        ? "Temps nécessaire pour récupérer votre investissement initial grâce aux économies générées. Ex: Payback de 5 ans = investissement remboursé en 5 ans."
        : "Time needed to recover your initial investment through generated savings. Ex: 5-year payback = investment recovered in 5 years."
    },
    {
      term: language === "fr" ? "CCA Catégorie 43.2" : "CCA Class 43.2",
      definition: language === "fr"
        ? "Catégorie de déduction pour amortissement accéléré au Canada. Taux de base de 50%/an (solde dégressif). Des mesures temporaires peuvent permettre une déduction plus rapide sous conditions."
        : "Accelerated capital cost allowance category in Canada. Base rate of 50%/year (declining balance). Temporary measures may allow faster deduction under certain conditions."
    },
  ];

  // Checklist d'éligibilité
  const eligibilityCriteria = [
    {
      criterion: language === "fr" ? "Propriétaire du bâtiment ou bail long terme (10+ ans)" : "Building owner or long-term lease (10+ years)",
      required: true,
      info: language === "fr" 
        ? "Nécessaire pour justifier l'investissement et bénéficier des incitatifs."
        : "Necessary to justify investment and benefit from incentives."
    },
    {
      criterion: language === "fr" ? "Toiture en bon état (10+ ans de vie restante)" : "Roof in good condition (10+ years remaining life)",
      required: true,
      info: language === "fr"
        ? "Les panneaux durent 25 ans - la toiture doit supporter cette durée."
        : "Panels last 25 years - roof must support this duration."
    },
    {
      criterion: language === "fr" ? "Facture Hydro-Québec disponible (12 mois)" : "Hydro-Québec bill available (12 months)",
      required: true,
      info: language === "fr"
        ? "Nécessaire pour l'analyse de votre profil de consommation et le dimensionnement optimal."
        : "Necessary for consumption profile analysis and optimal sizing."
    },
    {
      criterion: language === "fr" ? "Espace de toit dégagé (peu d'obstacles)" : "Clear roof space (few obstacles)",
      required: false,
      info: language === "fr"
        ? "Idéalement 500+ m² pour un projet significatif. L'analyse satellite évalue automatiquement."
        : "Ideally 500+ m² for a significant project. Satellite analysis evaluates automatically."
    },
    {
      criterion: language === "fr" ? "Entreprise imposable (pour le crédit fiscal)" : "Taxable business (for tax credit)",
      required: false,
      info: language === "fr"
        ? "Le bouclier fiscal CCA 43.2 ne s'applique qu'aux entreprises payant de l'impôt."
        : "CCA 43.2 tax shield only applies to businesses paying taxes."
    },
    {
      criterion: language === "fr" ? "Capacité d'investissement ou accès au financement" : "Investment capacity or financing access",
      required: false,
      info: language === "fr"
        ? "Options: achat comptant, prêt bancaire, ou crédit-bail. Plusieurs options disponibles."
        : "Options: cash purchase, bank loan, or capital lease. Several options available."
    },
  ];

  const filteredFAQ = faqItems.filter(item => {
    const matchesSearch = searchQuery === "" || 
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === null || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const seo = language === "fr" ? seoContent.resources.fr : seoContent.resources.en;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead 
        title={seo.title} 
        description={seo.description} 
        keywords={seo.keywords}
        structuredData={getFAQSchema(language)}
        locale={language}
      />
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/">
              <img 
                src={currentLogo} 
                alt="kWh Québec" 
                className="h-10 w-auto cursor-pointer"
                data-testid="logo-header"
              />
            </Link>
            
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {language === "fr" ? "Accueil" : "Home"}
              </Link>
              <Link href="/services" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {language === "fr" ? "Services" : "Services"}
              </Link>
              <Link href="/comment-ca-marche" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {language === "fr" ? "Comment ça marche" : "How it works"}
              </Link>
              <Link href="/ressources" className="text-sm font-medium text-foreground">
                {language === "fr" ? "Ressources" : "Resources"}
              </Link>
            </nav>

            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
              <Link href="/login">
                <Button variant="outline" size="sm" data-testid="button-login">
                  {language === "fr" ? "Connexion" : "Login"}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary/5 via-background to-background">
        <div className="max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              {language === "fr" ? "Centre de ressources" : "Resource Center"}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              {language === "fr" 
                ? "Guides, FAQ et informations pour vous aider à comprendre le solaire commercial au Québec."
                : "Guides, FAQ and information to help you understand commercial solar in Quebec."}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Guides Section */}
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">
            {language === "fr" ? "Guides et articles" : "Guides & Articles"}
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {guides.map((guide, index) => (
              <motion.div
                key={guide.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Link href={`/blog/${guide.slug}`}>
                  <Card className="h-full hover-elevate cursor-pointer">
                    <CardHeader>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          {categories.find(c => c.id === guide.category)?.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{guide.readTime}</span>
                      </div>
                      <CardTitle className="text-lg">{guide.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{guide.description}</p>
                      <Button variant="ghost" className="mt-4 p-0 h-auto text-primary">
                        {language === "fr" ? "Lire la suite" : "Read more"} <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-4">
              {language === "fr" ? "Questions fréquentes" : "Frequently Asked Questions"}
            </h2>
            
            {/* Search and filters */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-6">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder={language === "fr" ? "Rechercher..." : "Search..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-faq-search"
                />
              </div>
              
              <div className="flex gap-2 flex-wrap justify-center">
                <Button 
                  variant={selectedCategory === null ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                >
                  {language === "fr" ? "Tous" : "All"}
                </Button>
                {categories.map((cat) => (
                  <Button
                    key={cat.id}
                    variant={selectedCategory === cat.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(cat.id)}
                    className="gap-1"
                  >
                    <cat.icon className="w-3 h-3" />
                    {cat.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          
          <Accordion type="single" collapsible className="space-y-2">
            {filteredFAQ.map((item, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="bg-background rounded-lg border px-4">
                <AccordionTrigger className="text-left hover:no-underline">
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="shrink-0 mt-0.5 text-xs">
                      {categories.find(c => c.id === item.category)?.label}
                    </Badge>
                    <span>{item.question}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pl-12">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          
          {filteredFAQ.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {language === "fr" 
                ? "Aucune question ne correspond à votre recherche."
                : "No questions match your search."}
            </div>
          )}
        </div>
      </section>

      {/* Glossary Section */}
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Book className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold">
                {language === "fr" ? "Glossaire solaire" : "Solar Glossary"}
              </h2>
            </div>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {language === "fr" 
                ? "Les termes clés pour comprendre les projets solaires commerciaux."
                : "Key terms to understand commercial solar projects."}
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            {glossaryTerms.map((item, index) => (
              <motion.div
                key={item.term}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="h-full">
                  <CardContent className="pt-4">
                    <h3 className="font-semibold text-primary mb-1">{item.term}</h3>
                    <p className="text-sm text-muted-foreground">{item.definition}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Eligibility Checklist Section */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-4">
              {language === "fr" ? "Êtes-vous éligible au solaire commercial?" : "Are you eligible for commercial solar?"}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {language === "fr" 
                ? "Vérifiez rapidement si votre bâtiment répond aux critères de base pour un projet solaire rentable."
                : "Quickly check if your building meets the basic criteria for a profitable solar project."}
            </p>
          </div>
          
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {eligibilityCriteria.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-background"
                  >
                    <div className={`mt-0.5 ${item.required ? "text-primary" : "text-muted-foreground"}`}>
                      {item.required ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <AlertCircle className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{item.criterion}</span>
                        <Badge variant={item.required ? "default" : "secondary"} className="text-xs">
                          {item.required 
                            ? (language === "fr" ? "Requis" : "Required")
                            : (language === "fr" ? "Recommandé" : "Recommended")
                          }
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{item.info}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              
              <div className="mt-6 p-4 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm text-center">
                  {language === "fr" 
                    ? "Vous cochez les critères requis? "
                    : "You meet the required criteria? "}
                  <Link href="/#paths" className="text-primary font-medium hover:underline">
                    {language === "fr" ? "Obtenez votre analyse gratuite →" : "Get your free analysis →"}
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            {language === "fr" ? "Vous avez d'autres questions?" : "Have more questions?"}
          </h2>
          <p className="text-muted-foreground mb-8">
            {language === "fr" 
              ? "Notre équipe est disponible pour répondre à toutes vos questions."
              : "Our team is available to answer all your questions."}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/#paths">
              <Button size="lg" className="gap-2" data-testid="button-get-analysis">
                {language === "fr" ? "Obtenir mon analyse gratuite" : "Get my free analysis"}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <a href="mailto:info@kwhquebec.com">
              <Button size="lg" variant="outline" className="gap-2">
                {language === "fr" ? "Nous contacter" : "Contact us"}
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img src={currentLogo} alt="kWh Québec" className="h-8 w-auto" />
              <span className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} kWh Québec. {language === "fr" ? "Tous droits réservés." : "All rights reserved."}
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/services" className="hover:text-foreground transition-colors">Services</Link>
              <Link href="/comment-ca-marche" className="hover:text-foreground transition-colors">
                {language === "fr" ? "Comment ça marche" : "How it works"}
              </Link>
              <Link href="/ressources" className="hover:text-foreground transition-colors">
                {language === "fr" ? "Ressources" : "Resources"}
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

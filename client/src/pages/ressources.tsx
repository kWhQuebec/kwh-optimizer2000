import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  BookOpen, FileText, HelpCircle, TrendingUp, Zap, DollarSign, Building2,
  ArrowRight, ChevronDown, ChevronUp, Search, Tag, CheckCircle, XCircle, AlertCircle, Book,
  Newspaper, Calendar, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import roofOverlay from "@assets/rona_lasalle_roof_visualization.png";
import { SEOHead, seoContent, getFAQSchema } from "@/components/seo-head";
import { PublicHeader, PublicFooter } from "@/components/public-header";
import type { BlogArticle, NewsArticle } from "@shared/schema";

const NEWS_CATEGORY_LABELS: Record<string, { fr: string; en: string }> = {
  politique: { fr: "Politique", en: "Policy" },
  technologie: { fr: "Technologie", en: "Technology" },
  financement: { fr: "Financement", en: "Financing" },
  "marché": { fr: "Marché", en: "Market" },
  "réglementation": { fr: "Réglementation", en: "Regulation" },
};

const NEWS_CATEGORY_FILTERS = [
  { value: "", fr: "Tout", en: "All" },
  { value: "politique", fr: "Politique", en: "Policy" },
  { value: "technologie", fr: "Technologie", en: "Technology" },
  { value: "financement", fr: "Financement", en: "Financing" },
  { value: "marché", fr: "Marché", en: "Market" },
  { value: "réglementation", fr: "Réglementation", en: "Regulation" },
];

const categoryIcons: Record<string, typeof BookOpen> = {
  guide: BookOpen,
  news: Newspaper,
  "case-study": FileText,
};

function BlogArticleCard({ article }: { article: BlogArticle }) {
  const { t, language } = useI18n();
  const title = language === "fr" ? article.titleFr : article.titleEn;
  const excerpt = language === "fr" ? article.excerptFr : article.excerptEn;
  const CategoryIcon = categoryIcons[article.category || "guide"] || BookOpen;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Link href={`/blog/${article.slug}`}>
        <Card className="h-full hover-elevate cursor-pointer group" data-testid={`card-article-${article.slug}`}>
          {article.featuredImage && (
            <div className="aspect-video overflow-hidden rounded-t-lg">
              <img 
                src={article.featuredImage} 
                alt={title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          )}
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {article.category && (
                <Badge variant="secondary" className="gap-1">
                  <CategoryIcon aria-hidden="true" className="w-3 h-3" />
                  {t(`blog.category.${article.category}`)}
                </Badge>
              )}
              {article.publishedAt && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar aria-hidden="true" className="w-3 h-3" />
                  {new Date(article.publishedAt).toLocaleDateString(language === "fr" ? "fr-CA" : "en-CA")}
                </span>
              )}
            </div>
            <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors" data-testid={`text-article-title-${article.slug}`}>
              {title}
            </h3>
            {excerpt && (
              <p className="text-muted-foreground line-clamp-3 mb-4" data-testid={`text-article-excerpt-${article.slug}`}>
                {excerpt}
              </p>
            )}
            <div className="flex items-center text-primary font-medium">
              {t("blog.readMore")}
              <ArrowRight aria-hidden="true" className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}

function NewsArticleCard({ article }: { article: NewsArticle }) {
  const { language } = useI18n();
  const comment = article.editedCommentFr || article.aiCommentFr;
  const catLabel = article.category ? NEWS_CATEGORY_LABELS[article.category] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="h-full hover-elevate" data-testid={`card-news-${article.id}`}>
        {article.imageUrl && (
          <div className="aspect-video overflow-hidden rounded-t-lg">
            <img
              src={article.imageUrl}
              alt={article.originalTitle}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        )}
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Badge variant="secondary" className="text-xs" data-testid={`badge-source-${article.id}`}>
              {article.sourceName}
            </Badge>
            {catLabel && (
              <Badge variant="outline" className="text-xs" data-testid={`badge-category-${article.id}`}>
                {language === "fr" ? catLabel.fr : catLabel.en}
              </Badge>
            )}
            {article.publishedAt && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar aria-hidden="true" className="w-3 h-3" />
                {new Date(article.publishedAt).toLocaleDateString(
                  language === "fr" ? "fr-CA" : "en-CA",
                  { year: "numeric", month: "short", day: "numeric" }
                )}
              </span>
            )}
          </div>
          <div className="flex items-start gap-2 mb-2">
            <Link href={`/nouvelles/${article.slug}`} className="group flex-1" data-testid={`link-news-${article.id}`}>
              <h3 className="text-lg font-semibold group-hover:underline" data-testid={`text-news-title-${article.id}`}>
                {article.originalTitle}
              </h3>
            </Link>
            <Button size="icon" variant="ghost" asChild data-testid={`link-external-${article.id}`}>
              <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden="true" className="w-4 h-4" />
              </a>
            </Button>
          </div>
          {comment && (
            <p className="text-muted-foreground text-sm mb-3 line-clamp-4" data-testid={`text-news-comment-${article.id}`}>
              {comment}
            </p>
          )}
          {article.aiTags && article.aiTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {article.aiTags.slice(0, 4).map((tag, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function RessourcesPage() {
  const { language, t } = useI18n();
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [newsCategory, setNewsCategory] = useState("");

  const searchParams = new URLSearchParams(location.split("?")[1] || "");
  const tabParam = searchParams.get("tab");
  const initialTab = tabParam === "nouvelles" ? "nouvelles" : tabParam === "faq" ? "faq" : tabParam === "glossaire" ? "glossaire" : "guides";
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const sp = new URLSearchParams(location.split("?")[1] || "");
    const t = sp.get("tab");
    if (t === "nouvelles" || t === "faq" || t === "glossaire" || t === "guides") {
      setActiveTab(t);
    }
  }, [location]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setLocation(tab === "guides" ? "/ressources" : `/ressources?tab=${tab}`, { replace: true });
  };

  const { data: blogArticles, isLoading: blogLoading } = useQuery<BlogArticle[]>({
    queryKey: ["/api/blog"],
  });

  const { data: newsArticles, isLoading: newsLoading } = useQuery<NewsArticle[]>({
    queryKey: ["/api/public/news"],
  });

  const filteredNews = newsCategory
    ? newsArticles?.filter((a) => a.category === newsCategory)
    : newsArticles;

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
        ? "Au Québec, les principaux incitatifs incluent: l'appui financier de 1 000 $/kW du programme Solutions efficaces d'Hydro-Québec (OSE 6.0, en vigueur depuis le 31 mars 2026, plafonné à 40% du CAPEX et 1 MW), le programme de mesurage net (crédits sur votre facture), le crédit d'impôt fédéral de 30% pour les technologies propres (ITC, sous conditions d'éligibilité), et la déduction pour amortissement accéléré (CCA Catégorie 43.2, sous réserve des conditions d'éligibilité en vigueur — consultez votre comptable). L'éligibilité et les montants varient selon votre situation - notre analyse calcule les incitatifs applicables à votre projet."
        : "In Quebec, main incentives include: the $1,000/kW financial support from Hydro-Québec's Solutions efficaces program (OSE 6.0, effective March 31, 2026, capped at 40% of CAPEX and 1 MW), the net metering program (credits on your bill), the 30% federal clean technology investment tax credit (ITC, subject to eligibility), and accelerated capital cost allowance (CCA Class 43.2, subject to current eligibility conditions — consult your accountant). Eligibility and amounts vary by situation - our analysis calculates incentives applicable to your project."
    },
    {
      category: "incentives",
      question: language === "fr"
        ? "Les systèmes de stockage sont-ils admissibles aux incitatifs?"
        : "Are storage systems eligible for incentives?",
      answer: language === "fr"
        ? "Le stockage d'énergie peut être éligible au crédit d'impôt fédéral de 30% lorsqu'il est jumelé à un système solaire et répond aux critères d'éligibilité. Le programme d'autoproduction Hydro-Québec n'offre pas d'incitatif spécifique au stockage, mais celui-ci peut optimiser votre autoconsommation et réduire vos frais de pointe (Tarif M)."
        : "Energy storage may be eligible for the 30% federal tax credit when paired with a solar system and meeting eligibility criteria. The Hydro-Québec self-generation program doesn't offer storage-specific incentives, but storage can optimize self-consumption and reduce peak demand charges (Rate M)."
    },
    {
      category: "incentives",
      question: language === "fr"
        ? "Comment fonctionne la déduction pour amortissement (CCA 43.2)?"
        : "How does capital cost allowance (CCA Class 43.2) work?",
      answer: language === "fr"
        ? "La Catégorie 43.2 permet une déduction accélérée à un taux de 50% par année (solde dégressif), sous réserve des conditions d'éligibilité en vigueur. Des mesures temporaires d'amortissement immédiat peuvent permettre une déduction plus rapide sous certaines conditions. Consultez votre comptable pour les règles actuelles applicables à votre entreprise."
        : "Class 43.2 allows accelerated depreciation at 50% per year (declining balance), subject to current eligibility conditions. Temporary immediate expensing measures may allow faster deduction under certain conditions. Consult your accountant for current rules applicable to your business."
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
        ? "Le programme d'autoproduction (mesurage net) permet d'injecter votre surplus solaire sur le réseau et de le récupérer sous forme de crédits sur votre facture (jusqu'à 24 mois). Le solde de la banque de surplus est rémunéré au coût moyen de fourniture d'électricité le 31 mars de l'année paire suivante. Depuis 2025, le Tarif M est admissible et la capacité maximale est passée de 50 kW à 1 MW (sans dépasser la puissance maximale appelée de l'abonnement). L'adhésion au mesurage net n'est pas obligatoire pour recevoir l'appui financier de 1 000 $/kW du programme Solutions efficaces."
        : "The self-generation program (net metering) lets you inject solar surplus onto the grid and recover it as credits on your bill (up to 24 months). The surplus bank balance is compensated at the average cost of electricity supply on March 31 of the following even year. Since 2025, Rate M is eligible and maximum capacity increased from 50 kW to 1 MW (not exceeding the subscription's peak demand). Net metering enrollment is not required to receive the $1,000/kW financial support from the Solutions efficaces program."
    },

    {
      category: "incentives",
      question: language === "fr"
        ? "Qu'est-ce que le programme Solutions efficaces d'Hydro-Québec?"
        : "What is Hydro-Québec's Solutions efficaces program?",
      answer: language === "fr"
        ? "Le programme Solutions efficaces d'Hydro-Québec (anciennement lié à ÉcoPerformance / TEQ) offre des appuis financiers pour l'efficacité énergétique et l'autoproduction solaire. Pour le solaire photovoltaïque, l'appui est de 1 000 $/kW installé, plafonné à 40% des coûts admissibles et à 1 MW par abonnement (OSE 6.0, en vigueur le 31 mars 2026). Le programme couvre aussi d'autres mesures d'efficacité énergétique (enveloppe thermique, récupération de chaleur, automatisation) pouvant atteindre 75-100% des coûts admissibles selon la mesure. Notre équipe peut vous accompagner dans le processus de demande."
        : "Hydro-Québec's Solutions efficaces program (formerly linked to ÉcoPerformance / TEQ) provides financial support for energy efficiency and solar self-generation. For solar PV, the incentive is $1,000/kW installed, capped at 40% of admissible costs and 1 MW per subscription (OSE 6.0, effective March 31, 2026). The program also covers other energy efficiency measures (building envelope, heat recovery, automation) that can cover 75-100% of admissible costs depending on the measure. Our team can assist you through the application process."
    },
    {
      category: "incentives",
      question: language === "fr"
        ? "Quelles sont les exigences pour l'incitatif solaire OSE 6.0?"
        : "What are the requirements for the OSE 6.0 solar incentive?",
      answer: language === "fr"
        ? "Pour bénéficier de l'appui financier de 1 000 $/kW (plafonné à 40% des coûts admissibles), les panneaux doivent être certifiés CSA 22.2 No 61730 et CAN/CAS-IEC 61215. L'installateur doit détenir une licence adéquate de la RBQ (Régie du bâtiment du Québec). L'achat d'équipements doit être effectué après le 31 mars 2026 (date de lancement). Il est fortement recommandé d'attendre l'acceptation conditionnelle d'Hydro-Québec avant tout achat. Tous les tarifs sont admissibles sauf le tarif L et les contrats particuliers. L'autorisation officielle de raccordement au réseau est requise."
        : "To receive the $1,000/kW financial support (capped at 40% of admissible costs), panels must be CSA 22.2 No 61730 and CAN/CAS-IEC 61215 certified. The installer must hold a proper RBQ (Régie du bâtiment du Québec) license. Equipment purchase must be made after March 31, 2026 (launch date). It is strongly recommended to wait for Hydro-Québec's conditional acceptance before purchasing. All tariffs are eligible except Rate L and special contracts. Official grid connection authorization is required."
    },

    // TECHNICAL (5 questions)
    {
      category: "technical",
      question: language === "fr"
        ? "Quelle est la production solaire typique au Québec?"
        : "What is typical solar production in Quebec?",
      answer: language === "fr"
        ? "Au Québec, la production solaire moyenne est d'environ 1 150-1 300 kWh/kW/an selon la région et l'orientation. Montréal produit environ 1 200 kWh/kW/an. Notre analyse utilise des données satellitaires Google Solar et des simulations horaires sur une année complète (8 760 heures) pour estimer précisément votre production."
        : "In Quebec, average solar production is approximately 1,150-1,300 kWh/kW/year depending on region and orientation. Montreal produces about 1,200 kWh/kW/year. Our analysis uses Google Solar satellite data and hourly simulations over a full year (8,760 hours) to precisely estimate your production."
    },
    {
      category: "technical",
      question: language === "fr"
        ? "Combien d'espace de toit faut-il pour un système solaire?"
        : "How much roof space is needed for a solar system?",
      answer: language === "fr"
        ? "En règle générale, il faut environ 3,5 m² par kW installé pour des panneaux modernes de haute puissance (625W). Un système de 100 kW nécessiterait donc environ 350 m² de surface de toit utilisable. Notre analyse satellite évalue automatiquement la capacité de votre toiture en tenant compte des obstacles et de l'orientation."
        : "As a general rule, about 3.5 m² per installed kW is needed for modern high-power panels (625W). A 100 kW system would require approximately 350 m² of usable roof space. Our satellite analysis automatically evaluates your roof capacity accounting for obstacles and orientation."
    },
    {
      category: "technical",
      question: language === "fr"
        ? "Les panneaux solaires fonctionnent-ils en hiver au Québec?"
        : "Do solar panels work in winter in Quebec?",
      answer: language === "fr"
        ? "Absolument! Les panneaux produisent toute l'année. Le froid améliore leur efficacité (+0,4%/°C sous 25°C). Selon l'étude NAIT Edmonton (5 ans, panneaux identiques à tous les angles), les racks ballastés à 10° ne perdent que ~5% annuellement à cause de la neige. Notre simulateur intègre ce profil validé par défaut."
        : "Absolutely! Panels produce year-round. Cold improves efficiency (+0.4%/°C below 25°C). Per the NAIT Edmonton study (5 years, identical panels at all angles), ballasted racks at 10° only lose ~5% annually due to snow. Our simulator integrates this validated profile by default."
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
        ? "Avec les incitatifs actuels, le temps de retour typique est de 5-9 ans avec incitatifs pour les projets commerciaux au Québec. Le TRI (taux de rendement interne) se situe généralement entre 12% et 20%, selon la taille du système et le profil de consommation. La VAN sur 25 ans peut atteindre 2-3x l'investissement initial."
        : "With current incentives, typical payback is 5-9 years with incentives for commercial projects in Quebec. IRR (internal rate of return) generally ranges between 12% and 20%, depending on system size and consumption profile. NPV over 25 years can reach 2-3x the initial investment."
    },
    {
      category: "financial",
      question: language === "fr"
        ? "Quelles options d'acquisition sont disponibles?"
        : "What acquisition options are available?",
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
        ? "Le coût installé varie de 1,50$ à 2,50$/W selon la taille et la complexité. Un système de 100 kW coûte typiquement 150 000$ - 200 000$ avant incitatifs. Après tous les incitatifs (Hydro-Québec, fédéral, fiscal), le coût net peut être réduit de 40-60%. Notre analyse fournit une estimation précise pour votre projet."
        : "Installed cost ranges from $1.50 to $2.50/W depending on size and complexity. A 100 kW system typically costs $150,000 - $200,000 before incentives. After all incentives (Hydro-Québec, federal, tax), net cost can be reduced by 40-60%. Our analysis provides a precise estimate for your project."
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
        ? "La procuration Hydro-Québec est un formulaire standard qui nous autorise à accéder à votre historique de consommation électrique détaillé (données 15 minutes). Ces données sont essentielles pour effectuer une analyse précise de dimensionnement et calculer l'autoconsommation. Le processus est 100% électronique, sécurisé et gratuit."
        : "The Hydro-Québec authorization is a standard form that allows us to access your detailed electricity consumption history (15-minute data). This data is essential for accurate sizing analysis and calculating self-consumption. The process is 100% electronic, secure and free."
    },
    {
      category: "process",
      question: language === "fr"
        ? "Ai-je besoin d'une licence RBQ pour installer du solaire?"
        : "Do I need an RBQ license to install solar?",
      answer: language === "fr"
        ? "L'installateur doit détenir une licence RBQ (Régie du bâtiment du Québec) avec les sous-catégories appropriées (électricité, installation d'équipements). kWh Québec détient les licences nécessaires et réalise les installations avec son équipe qualifiée. Vous n'avez pas besoin de licence vous-même en tant que propriétaire."
        : "The installer must hold an RBQ (Régie du bâtiment du Québec) license with appropriate sub-categories (electricity, equipment installation). kWh Québec holds the necessary licenses and performs installations with its own qualified team. You don't need a license yourself as the property owner."
    },
    {
      category: "process",
      question: language === "fr"
        ? "Quelle maintenance est requise pour un système solaire?"
        : "What maintenance is required for a solar system?",
      answer: language === "fr"
        ? "Les systèmes solaires nécessitent très peu de maintenance. Inspection visuelle annuelle, nettoyage occasionnel si accumulation importante de débris, et vérification des connexions électriques tous les 2-3 ans. Les panneaux sont garantis 25 ans avec dégradation de 0,35-0,5%/an après la première année (dégradation initiale ~1-2% selon le fabricant). Le monitoring à distance permet de détecter rapidement tout problème."
        : "Solar systems require very little maintenance. Annual visual inspection, occasional cleaning if significant debris accumulation, and electrical connection check every 2-3 years. Panels are warranted 25 years with degradation of 0.35-0.5%/yr after Year 1 (initial degradation ~1-2% per manufacturer). Remote monitoring allows quick detection of any issues."
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
        ? "Tout ce que vous devez savoir sur le programme Hydro-Québec, le crédit fédéral et les avantages fiscaux."
        : "Everything you need to know about the Hydro-Québec program, federal credit, and tax benefits.",
      category: "incentives",
      readTime: "8 min",
      slug: "incitatifs-solaires-quebec-2026"
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
    {
      title: language === "fr" ? "Télécharger vos données depuis l'Espace Client Hydro-Québec" : "Download Your Data from Hydro-Québec's Online Portal",
      description: language === "fr"
        ? "Guide étape par étape pour télécharger vos 12-24 fichiers CSV de consommation (~30 min)."
        : "Step-by-step guide to downloading your 12-24 consumption CSV files (~30 min).",
      category: "technical",
      readTime: "5 min",
      slug: "telecharger-donnees-espace-client-hydro-quebec"
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
        ? "Système où votre surplus solaire injecté au réseau est crédité sur votre facture. Au Québec, les crédits sont valides 24 mois via le programme d'autoproduction Hydro-Québec."
        : "System where your solar surplus injected to the grid is credited on your bill. In Quebec, credits are valid 24 months via the Hydro-Québec self-generation program."
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
        ? "Catégorie de déduction pour amortissement accéléré au Canada. Taux de base de 50%/an (solde dégressif). Des mesures temporaires peuvent permettre une déduction plus rapide sous conditions. Sous réserve des conditions d'éligibilité en vigueur — consultez votre comptable."
        : "Accelerated capital cost allowance category in Canada. Base rate of 50%/year (declining balance). Temporary measures may allow faster deduction under certain conditions. Subject to current eligibility conditions — consult your accountant."
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
        ? "Le bouclier fiscal CCA 43.2 ne s'applique qu'aux entreprises payant de l'impôt. Sous réserve des conditions d'éligibilité en vigueur — consultez votre comptable."
        : "CCA 43.2 tax shield only applies to businesses paying taxes. Subject to current eligibility conditions — consult your accountant."
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
    <div className="public-page min-h-screen bg-background">
      <SEOHead 
        title={seo.title} 
        description={seo.description} 
        keywords={seo.keywords}
        structuredData={getFAQSchema(language)}
        locale={language}
      />
      <PublicHeader />
      <main>

      {/* Hero */}
      <section className="relative py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary/5 via-background to-background overflow-hidden">
        <div className="absolute right-0 top-0 w-1/3 h-full opacity-[0.07] pointer-events-none hidden lg:block">
          <img src={roofOverlay} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="relative max-w-6xl mx-auto text-center">
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
                ? "Guides, FAQ, actualités et informations pour vous aider à comprendre le solaire commercial au Québec."
                : "Guides, FAQ, news and information to help you understand commercial solar in Quebec."}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Tabbed Content */}
      <section className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-4 mb-8" data-testid="tabs-resources">
              <TabsTrigger value="guides" data-testid="tab-guides">
                <BookOpen aria-hidden="true" className="w-4 h-4 mr-2 hidden sm:inline" />
                {language === "fr" ? "Guides" : "Guides"}
              </TabsTrigger>
              <TabsTrigger value="faq" data-testid="tab-faq">
                <HelpCircle aria-hidden="true" className="w-4 h-4 mr-2 hidden sm:inline" />
                FAQ
              </TabsTrigger>
              <TabsTrigger value="nouvelles" data-testid="tab-nouvelles">
                <Newspaper aria-hidden="true" className="w-4 h-4 mr-2 hidden sm:inline" />
                {language === "fr" ? "Nouvelles" : "News"}
              </TabsTrigger>
              <TabsTrigger value="glossaire" data-testid="tab-glossaire">
                <Book aria-hidden="true" className="w-4 h-4 mr-2 hidden sm:inline" />
                {language === "fr" ? "Glossaire" : "Glossary"}
              </TabsTrigger>
            </TabsList>

            {/* Guides Tab */}
            <TabsContent value="guides">
              <div className="grid md:grid-cols-3 gap-6 mb-8">
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
                            {language === "fr" ? "Lire la suite" : "Read more"} <ArrowRight aria-hidden="true" className="w-4 h-4 ml-1" />
                          </Button>
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                ))}
              </div>

              {blogLoading ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="h-full">
                      <Skeleton className="aspect-video rounded-t-lg" />
                      <CardContent className="p-6 space-y-4">
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-20 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : blogArticles && blogArticles.length > 0 ? (
                <>
                  <h3 className="text-xl font-semibold mb-4 mt-8">
                    {language === "fr" ? "Articles" : "Articles"}
                  </h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {blogArticles.map((article) => (
                      <BlogArticleCard key={article.id} article={article} />
                    ))}
                  </div>
                </>
              ) : null}
            </TabsContent>

            {/* FAQ Tab */}
            <TabsContent value="faq">
              <div className="max-w-4xl mx-auto">
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
                  <div className="relative w-full sm:w-80">
                    <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      placeholder={language === "fr" ? "Filtrer..." : "Filter..."}
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
                        <cat.icon aria-hidden="true" className="w-3 h-3" />
                        {cat.label}
                      </Button>
                    ))}
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

                <div className="mt-8 p-4 rounded-lg bg-primary/5 border border-primary/20 text-center" data-testid="link-faq-portfolio">
                  <p className="text-sm mb-3">
                    {language === "fr"
                      ? "Vous voulez voir des exemples concrets de projets solaires au Québec?"
                      : "Want to see real examples of solar projects in Quebec?"}
                  </p>
                  <Link href="/portfolio">
                    <Button variant="outline" className="gap-2">
                      <Building2 aria-hidden="true" className="w-4 h-4" />
                      {language === "fr" ? "Voir des exemples — Portfolio" : "See examples — Portfolio"}
                      <ArrowRight aria-hidden="true" className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </TabsContent>

            {/* Nouvelles Tab */}
            <TabsContent value="nouvelles">
              <div className="flex flex-wrap gap-2 mb-8 justify-center">
                {NEWS_CATEGORY_FILTERS.map((cat) => (
                  <Button
                    key={cat.value}
                    variant="outline"
                    className={newsCategory === cat.value ? "toggle-elevate toggle-elevated" : "toggle-elevate"}
                    onClick={() => setNewsCategory(cat.value)}
                    data-testid={`filter-news-category-${cat.value || "all"}`}
                  >
                    {language === "fr" ? cat.fr : cat.en}
                  </Button>
                ))}
              </div>

              {newsLoading ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="h-full">
                      <Skeleton className="aspect-video rounded-t-lg" />
                      <CardContent className="p-6 space-y-4">
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-20 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredNews && filteredNews.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredNews.map((article) => (
                    <NewsArticleCard key={article.id} article={article} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <Newspaper aria-hidden="true" className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-xl text-muted-foreground" data-testid="text-no-news">
                    {language === "fr"
                      ? "Aucune nouvelle pour le moment. Revenez bientôt!"
                      : "No news at the moment. Check back soon!"}
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Glossaire Tab */}
            <TabsContent value="glossaire">
              <div className="max-w-4xl mx-auto">
                <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-8">
                  {language === "fr" 
                    ? "Les termes clés pour comprendre les projets solaires commerciaux."
                    : "Key terms to understand commercial solar projects."}
                </p>
                
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
            </TabsContent>
          </Tabs>
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
                        <CheckCircle aria-hidden="true" className="w-5 h-5" />
                      ) : (
                        <AlertCircle aria-hidden="true" className="w-5 h-5" />
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
                  <Link href="/#analyse" className="text-primary font-medium hover:underline">
                    {language === "fr" ? "Obtenez votre analyse gratuite →" : "Get your free analysis →"}
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-24 px-4 sm:px-6 lg:px-8">
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
            <Link href="/#analyse">
              <Button size="lg" className="gap-2" data-testid="button-get-analysis">
                {language === "fr" ? "Voir mon potentiel solaire — Gratuit" : "See my solar potential — Free"}
                <ArrowRight aria-hidden="true" className="w-4 h-4" />
              </Button>
            </Link>
            <a href="mailto:info@kwh.quebec">
              <Button size="lg" variant="outline" className="gap-2">
                {language === "fr" ? "Nous contacter" : "Contact us"}
              </Button>
            </a>
          </div>
        </div>
      </section>

      </main>
      <PublicFooter />
    </div>
  );
}

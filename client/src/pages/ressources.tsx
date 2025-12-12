import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { 
  BookOpen, FileText, HelpCircle, TrendingUp, Zap, DollarSign,
  ArrowRight, ChevronDown, ChevronUp, Search, Tag
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
    {
      category: "incentives",
      question: language === "fr" 
        ? "Quels sont les incitatifs disponibles pour le solaire au Québec?"
        : "What incentives are available for solar in Quebec?",
      answer: language === "fr"
        ? "Au Québec, plusieurs incitatifs sont disponibles: le crédit Hydro-Québec jusqu'à 40% du coût du projet (plafonné), le crédit d'impôt fédéral de 30% pour les technologies propres, et la déduction fiscale accélérée permettant d'amortir 100% en première année. Ces incitatifs peuvent couvrir jusqu'à 60% du coût total du projet."
        : "In Quebec, several incentives are available: the Hydro-Québec credit up to 40% of project cost (capped), the 30% federal tax credit for clean technologies, and accelerated capital cost allowance allowing 100% deduction in year one. These incentives can cover up to 60% of total project cost."
    },
    {
      category: "incentives",
      question: language === "fr"
        ? "Le crédit Hydro-Québec s'applique-t-il aux batteries?"
        : "Does the Hydro-Québec credit apply to batteries?",
      answer: language === "fr"
        ? "Le stockage par batterie peut bénéficier du crédit HQ uniquement lorsqu'il est jumelé à un système solaire et qu'il reste de la marge dans le plafond de 40% après l'incitatif solaire. Il n'y a pas d'incitatif HQ autonome pour les batteries seules."
        : "Battery storage can benefit from the HQ credit only when paired with a solar system and there's remaining room in the 40% cap after the solar incentive. There is no standalone HQ incentive for batteries alone."
    },
    {
      category: "technical",
      question: language === "fr"
        ? "Quelle est la production solaire typique au Québec?"
        : "What is typical solar production in Quebec?",
      answer: language === "fr"
        ? "Au Québec, la production solaire moyenne est d'environ 1 100 kWh/kW/an. Cette valeur varie légèrement selon la région et l'orientation du toit. Notre analyse utilise des données satellitaires et des simulations horaires pour estimer précisément votre production."
        : "In Quebec, average solar production is approximately 1,100 kWh/kW/year. This varies slightly by region and roof orientation. Our analysis uses satellite data and hourly simulations to precisely estimate your production."
    },
    {
      category: "technical",
      question: language === "fr"
        ? "Combien d'espace de toit faut-il pour un système solaire?"
        : "How much roof space is needed for a solar system?",
      answer: language === "fr"
        ? "En règle générale, il faut environ 5-6 m² par kW installé pour des panneaux modernes. Un système de 100 kW nécessiterait donc environ 500-600 m² de surface de toit utilisable. Notre analyse satellite évalue automatiquement la capacité de votre toiture."
        : "As a general rule, about 5-6 m² per installed kW is needed for modern panels. A 100 kW system would require approximately 500-600 m² of usable roof space. Our satellite analysis automatically evaluates your roof capacity."
    },
    {
      category: "financial",
      question: language === "fr"
        ? "Quel est le retour sur investissement typique?"
        : "What is the typical return on investment?",
      answer: language === "fr"
        ? "Avec les incitatifs actuels, le temps de retour typique est de 4-7 ans pour les projets commerciaux au Québec. Le TRI (taux de rendement interne) se situe généralement entre 15% et 25%, selon la taille du système et le profil de consommation."
        : "With current incentives, typical payback is 4-7 years for commercial projects in Quebec. IRR (internal rate of return) generally ranges between 15% and 25%, depending on system size and consumption profile."
    },
    {
      category: "financial",
      question: language === "fr"
        ? "Quelles options de financement sont disponibles?"
        : "What financing options are available?",
      answer: language === "fr"
        ? "Trois options principales: Achat comptant (meilleur rendement long terme), Prêt (conservation des incitatifs avec paiements étalés), et Crédit-bail/location (flux de trésorerie positif dès le jour 1, tous les incitatifs conservés). Notre analyse compare ces trois options."
        : "Three main options: Cash purchase (best long-term return), Loan (keep incentives with spread payments), and Capital lease (positive cash flow from day 1, all incentives retained). Our analysis compares these three options."
    },
    {
      category: "process",
      question: language === "fr"
        ? "Combien de temps prend un projet solaire complet?"
        : "How long does a complete solar project take?",
      answer: language === "fr"
        ? "Du premier contact à la mise en service: Analyse (1-2 semaines), Ingénierie et permis (4-8 semaines), Construction (4-12 semaines selon la taille). Total: 3-6 mois typiquement pour un projet commercial."
        : "From first contact to commissioning: Analysis (1-2 weeks), Engineering and permits (4-8 weeks), Construction (4-12 weeks depending on size). Total: 3-6 months typically for a commercial project."
    },
    {
      category: "process",
      question: language === "fr"
        ? "Qu'est-ce que la procuration Hydro-Québec?"
        : "What is the Hydro-Québec authorization?",
      answer: language === "fr"
        ? "La procuration HQ est un formulaire standard qui nous autorise à accéder à votre historique de consommation électrique. Ces données sont essentielles pour effectuer une analyse précise de votre système optimal. Le processus est 100% électronique et sécurisé."
        : "The HQ authorization is a standard form that allows us to access your electricity consumption history. This data is essential for accurate analysis of your optimal system. The process is 100% electronic and secure."
    },
  ];

  const guides = [
    {
      title: language === "fr" ? "Guide des incitatifs 2024-2025" : "2024-2025 Incentives Guide",
      description: language === "fr"
        ? "Tout ce que vous devez savoir sur les crédits HQ, le crédit fédéral et les avantages fiscaux."
        : "Everything you need to know about HQ credits, federal credits, and tax benefits.",
      category: "incentives",
      readTime: "8 min"
    },
    {
      title: language === "fr" ? "Comprendre votre facture Hydro-Québec" : "Understanding Your Hydro-Québec Bill",
      description: language === "fr"
        ? "Décodez les tarifs G, M et L et comprenez comment le solaire impacte votre facture."
        : "Decode G, M, and L rates and understand how solar impacts your bill.",
      category: "technical",
      readTime: "5 min"
    },
    {
      title: language === "fr" ? "Solaire vs Stockage: Quand combiner?" : "Solar vs Storage: When to Combine?",
      description: language === "fr"
        ? "Analyse des cas où le stockage par batterie améliore le rendement de votre projet."
        : "Analysis of cases where battery storage improves your project's return.",
      category: "financial",
      readTime: "6 min"
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

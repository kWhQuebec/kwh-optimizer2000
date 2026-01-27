import { motion } from "framer-motion";
import { Link } from "wouter";
import { 
  MapPin, FileSignature, BarChart3, FileCheck, Wrench, HardHat,
  ArrowRight, CheckCircle2, Clock, Zap, Shield, Award
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";
import { SEOHead, seoContent, getHowToSchema } from "@/components/seo-head";
import logoFr from "@assets/kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png";
import logoEn from "@assets/kWh_Quebec_Logo-02_-_Rectangle_1764799021536.png";

export default function CommentCaMarchePage() {
  const { language } = useI18n();
  const currentLogo = language === "fr" ? logoFr : logoEn;

  const steps = [
    {
      number: 1,
      icon: MapPin,
      title: language === "fr" ? "Analyse RAPIDE" : "Quick Analysis",
      duration: "2 min",
      description: language === "fr"
        ? "Entrez l'adresse de votre bâtiment et votre facture mensuelle moyenne. Notre système analyse automatiquement votre toiture via satellite et estime votre potentiel solaire."
        : "Enter your building address and average monthly bill. Our system automatically analyzes your roof via satellite and estimates your solar potential.",
      deliverables: language === "fr"
        ? ["Capacité solaire estimée", "Économies annuelles approximatives", "Retour sur investissement estimé"]
        : ["Estimated solar capacity", "Approximate annual savings", "Estimated ROI"],
      accuracy: "~75%",
      free: true
    },
    {
      number: 2,
      icon: FileSignature,
      title: language === "fr" ? "Procuration Hydro-Québec" : "Hydro-Québec Authorization",
      duration: language === "fr" ? "Signature électronique" : "E-signature",
      description: language === "fr"
        ? "Pour une analyse précise, nous avons besoin d'accéder à votre historique de consommation Hydro-Québec. Une simple signature électronique nous autorise à récupérer vos données."
        : "For accurate analysis, we need access to your Hydro-Québec consumption history. A simple e-signature authorizes us to retrieve your data.",
      deliverables: language === "fr"
        ? ["Formulaire pré-rempli", "Signature 100% électronique", "Données sécurisées"]
        : ["Pre-filled form", "100% electronic signature", "Secure data"],
      accuracy: null,
      free: true
    },
    {
      number: 3,
      icon: BarChart3,
      title: language === "fr" ? "Analyse DÉTAILLÉE" : "Detailed Analysis",
      duration: language === "fr" ? "5 jours ouvrables" : "5 business days",
      description: language === "fr"
        ? "Analyse heure par heure de votre système optimal basée sur vos données de consommation réelles. Nous optimisons la taille du solaire et du stockage pour maximiser votre retour sur investissement."
        : "Hour-by-hour analysis of your optimal system based on your real consumption data. We optimize solar and storage sizing to maximize your ROI.",
      deliverables: language === "fr"
        ? ["Configuration optimale solaire + stockage", "Projections financières 25 ans", "Comparaison options de financement", "Rapport PDF professionnel"]
        : ["Optimal solar + storage configuration", "25-year financial projections", "Financing options comparison", "Professional PDF report"],
      accuracy: "~95%",
      free: true
    },
    {
      number: 4,
      icon: FileCheck,
      title: language === "fr" ? "Visite & Devis" : "Site Visit & Quote",
      duration: language === "fr" ? "~1 semaine" : "~1 week",
      description: language === "fr"
        ? "Notre équipe visite votre site pour valider les conditions techniques et préparer un devis détaillé à prix fixe."
        : "Our team visits your site to validate technical conditions and prepare a detailed fixed-price quote.",
      deliverables: language === "fr"
        ? ["Inspection technique sur site", "Dessins préliminaires", "Devis ferme et détaillé"]
        : ["On-site technical inspection", "Preliminary drawings", "Firm and detailed quote"],
      accuracy: null,
      free: false
    },
    {
      number: 5,
      icon: Wrench,
      title: language === "fr" ? "Ingénierie" : "Engineering",
      duration: language === "fr" ? "2-4 semaines" : "2-4 weeks",
      description: language === "fr"
        ? "Conception détaillée par nos ingénieurs: plans électriques, structuraux, demandes de permis et coordination avec Hydro-Québec."
        : "Detailed design by our engineers: electrical plans, structural plans, permit applications, and Hydro-Québec coordination.",
      deliverables: language === "fr"
        ? ["Plans complets", "Permis obtenus", "Entente de raccordement Hydro-Québec"]
        : ["Complete plans", "Permits obtained", "Hydro-Québec connection agreement"],
      accuracy: null,
      free: false
    },
    {
      number: 6,
      icon: HardHat,
      title: language === "fr" ? "Construction & Mise en service" : "Construction & Commissioning",
      duration: language === "fr" ? "4-8 semaines" : "4-8 weeks",
      description: language === "fr"
        ? "Installation clé en main par notre équipe certifiée, suivie des tests de performance et de la mise en service officielle."
        : "Turnkey installation by our certified team, followed by performance testing and official commissioning.",
      deliverables: language === "fr"
        ? ["Installation complète", "Tests de performance", "Formation opérateur", "Garanties et documentation"]
        : ["Complete installation", "Performance testing", "Operator training", "Warranties and documentation"],
      accuracy: null,
      free: false
    }
  ];

  const seo = language === "fr" ? seoContent.howItWorks.fr : seoContent.howItWorks.en;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead 
        title={seo.title} 
        description={seo.description} 
        keywords={seo.keywords}
        structuredData={getHowToSchema(language)}
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
              <Link href="/comment-ca-marche" className="text-sm font-medium text-foreground">
                {language === "fr" ? "Comment ça marche" : "How it works"}
              </Link>
              <Link href="/ressources" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
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
              {language === "fr" ? "Comment ça marche?" : "How does it work?"}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              {language === "fr" 
                ? "De l'estimation initiale à la mise en service, découvrez notre processus étape par étape."
                : "From initial estimate to commissioning, discover our step-by-step process."}
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Badge variant="outline" className="text-base py-1 px-3">
                <Clock className="w-4 h-4 mr-1" />
                {language === "fr" ? "Analyse gratuite en 2 min" : "Free analysis in 2 min"}
              </Badge>
              <Badge variant="outline" className="text-base py-1 px-3">
                <Shield className="w-4 h-4 mr-1" />
                {language === "fr" ? "Sans engagement" : "No commitment"}
              </Badge>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Timeline Steps */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="relative"
              >
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="absolute left-6 top-20 bottom-0 w-0.5 bg-border" style={{ height: 'calc(100% - 2rem)' }} />
                )}
                
                <Card className={`relative ${step.free ? 'border-primary/30' : 'border-muted'}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      {/* Step number and icon */}
                      <div className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${step.free ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                        <step.icon className="w-6 h-6" />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 space-y-3">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {language === "fr" ? "Étape" : "Step"} {step.number}
                              </Badge>
                              <h3 className="text-xl font-bold">{step.title}</h3>
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge className={step.free ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-muted'}>
                                {step.duration}
                              </Badge>
                              {step.accuracy && (
                                <Badge variant="outline" className="text-muted-foreground">
                                  {step.accuracy} {language === "fr" ? "précision" : "accuracy"}
                                </Badge>
                              )}
                              {step.free && (
                                <Badge className="bg-primary/10 text-primary border-primary/20">
                                  {language === "fr" ? "GRATUIT" : "FREE"}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <p className="text-muted-foreground">{step.description}</p>
                        
                        <div className="pt-2">
                          <p className="text-sm font-medium mb-2">
                            {language === "fr" ? "Ce que vous obtenez:" : "What you get:"}
                          </p>
                          <ul className="grid sm:grid-cols-2 gap-1">
                            {step.deliverables.map((item) => (
                              <li key={item} className="flex items-center gap-2 text-sm">
                                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            {language === "fr" ? "Prêt à commencer?" : "Ready to get started?"}
          </h2>
          <p className="text-lg opacity-90 mb-8">
            {language === "fr" 
              ? "Les 3 premières étapes sont entièrement gratuites et sans engagement."
              : "The first 3 steps are completely free with no commitment."}
          </p>
          <Link href="/#paths">
            <Button size="lg" variant="secondary" className="gap-2" data-testid="button-start">
              {language === "fr" ? "Commencer maintenant" : "Start now"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img src={currentLogo} alt="kWh Québec" className="h-10 w-auto" />
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

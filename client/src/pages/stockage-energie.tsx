import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  Battery, BatteryCharging, Zap, TrendingUp, DollarSign,
  ArrowRight, CheckCircle2, BarChart3, Shield, Clock,
  Sun, Building2, Factory, Phone, Mail
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";
import { SEOHead } from "@/components/seo-head";
import { BRAND_CONTENT } from "@shared/brandContent";
import logoFr from "@assets/kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png";
import logoEn from "@assets/kWh_Quebec_Logo-02_-_Rectangle_1764799021536.png";

export default function StockageEnergiePage() {
  const { language } = useI18n();
  const currentLogo = language === "fr" ? logoFr : logoEn;

  const seoTitle = language === "fr"
    ? "Stockage d'énergie par batterie pour entreprises | kWh Québec"
    : "Battery Energy Storage for Businesses | kWh Québec";
  const seoDescription = language === "fr"
    ? "Solutions de stockage par batterie pour bâtiments commerciaux et industriels au Québec. Écrêtage de pointe, alimentation de secours et intégration solaire+batterie."
    : "Battery storage solutions for commercial and industrial buildings in Quebec. Peak shaving, backup power, and solar+battery integration.";
  const seoKeywords = language === "fr"
    ? "stockage batterie commercial québec, écrêtage de pointe tarif M, batterie solaire entreprise, BESS québec, alimentation de secours"
    : "commercial battery storage quebec, peak shaving rate M, business solar battery, BESS quebec, backup power";

  const useCases = [
    {
      icon: BarChart3,
      title: language === "fr" ? "Écrêtage de pointe (Tarif M)" : "Peak Shaving (Rate M)",
      description: language === "fr"
        ? "Les frais de puissance représentent 30-50% de la facture des clients au Tarif M d'Hydro-Québec. Le stockage par batterie réduit les pics de demande en déchargeant pendant les heures de pointe, diminuant significativement la composante puissance de votre facture."
        : "Demand charges represent 30-50% of the bill for Hydro-Québec Rate M customers. Battery storage reduces demand peaks by discharging during peak hours, significantly lowering the power component of your bill.",
      benefits: language === "fr"
        ? ["Réduction des frais de puissance de 15-30%", "Algorithme d'optimisation intelligent", "Retour sur investissement accéléré", "Applicable dès 50 kW de puissance appelée"]
        : ["15-30% reduction in demand charges", "Intelligent optimization algorithm", "Accelerated ROI", "Applicable from 50 kW demand"],
    },
    {
      icon: Shield,
      title: language === "fr" ? "Alimentation de secours" : "Backup Power",
      description: language === "fr"
        ? "Protégez vos opérations critiques lors de pannes de courant. Un système de stockage dimensionné adéquatement maintient vos équipements essentiels en fonction pendant des heures, sans les inconvénients d'une génératrice diesel."
        : "Protect your critical operations during power outages. A properly sized storage system keeps your essential equipment running for hours, without the drawbacks of a diesel generator.",
      benefits: language === "fr"
        ? ["Transition automatique en millisecondes", "Aucune émission sur site", "Entretien minimal vs génératrice", "Opération silencieuse"]
        : ["Automatic transition in milliseconds", "Zero on-site emissions", "Minimal maintenance vs generator", "Silent operation"],
    },
    {
      icon: Sun,
      title: language === "fr" ? "Intégration solaire + batterie" : "Solar + Battery Integration",
      description: language === "fr"
        ? "Maximisez la valeur de votre système solaire en stockant l'énergie excédentaire produite le jour pour l'utiliser lors des pics de consommation du soir. L'intégration solaire+batterie optimise l'autoconsommation et réduit votre dépendance au réseau."
        : "Maximize the value of your solar system by storing excess daytime energy for use during evening consumption peaks. Solar+battery integration optimizes self-consumption and reduces your grid dependence.",
      benefits: language === "fr"
        ? ["Autoconsommation solaire maximisée", "Réduction de l'injection au réseau", "Synergie avec le mesurage net (24 mois)", "Un seul système intégré"]
        : ["Maximized solar self-consumption", "Reduced grid injection", "Synergy with net metering (24 months)", "Single integrated system"],
    },
  ];

  const roiFactors = [
    {
      icon: DollarSign,
      title: language === "fr" ? "Économies sur les frais de puissance" : "Demand Charge Savings",
      description: language === "fr"
        ? "Les frais de puissance au Tarif M sont facturés sur le pic de 15 minutes le plus élevé du mois. Le stockage lisse ces pics et réduit la facture."
        : "Rate M demand charges are billed on the highest 15-minute peak of the month. Storage smooths these peaks and reduces the bill.",
    },
    {
      icon: TrendingUp,
      title: language === "fr" ? "Valeur combinée solaire+stockage" : "Combined Solar+Storage Value",
      description: language === "fr"
        ? "L'ajout de stockage à un système solaire améliore le TRI global du projet en capturant plus de valeur de chaque kWh produit."
        : "Adding storage to a solar system improves the overall project IRR by capturing more value from each kWh produced.",
    },
    {
      icon: Clock,
      title: language === "fr" ? "Durée de vie et garanties" : "Lifespan and Warranties",
      description: language === "fr"
        ? "Les systèmes BESS modernes offrent des garanties de 10-15 ans avec une dégradation prévisible. La durée de vie utile dépasse souvent 20 ans."
        : "Modern BESS systems offer 10-15 year warranties with predictable degradation. Useful lifespan often exceeds 20 years.",
    },
  ];

  const faqs = [
    {
      q: language === "fr"
        ? "Quel est le retour sur investissement typique du stockage par batterie?"
        : "What is the typical ROI for battery storage?",
      a: language === "fr"
        ? "Le retour sur investissement varie selon l'application. Pour l'écrêtage de pointe au Tarif M, le retour est typiquement de 7 à 12 ans selon le profil de charge. Combiné au solaire, le projet global peut atteindre un retour de 5 à 9 ans avec les incitatifs disponibles."
        : "ROI varies by application. For peak shaving on Rate M, payback is typically 7 to 12 years depending on the load profile. Combined with solar, the overall project can achieve a 5 to 9 year payback with available incentives.",
    },
    {
      q: language === "fr"
        ? "Le stockage est-il éligible aux incitatifs?"
        : "Is storage eligible for incentives?",
      a: language === "fr"
        ? "Oui. Le crédit d'impôt fédéral à l'investissement pour technologies propres (jusqu'à 30% pour les entreprises admissibles) couvre les systèmes de stockage d'énergie. L'amortissement accéléré (DPA 43.1/43.2, sous réserve des conditions d'éligibilité — consultez votre comptable) s'applique également."
        : "Yes. The federal clean technology investment tax credit (up to 30% for eligible businesses) covers energy storage systems. Accelerated depreciation (CCA 43.1/43.2, subject to eligibility conditions — consult your accountant) also applies.",
    },
    {
      q: language === "fr"
        ? "Quelle est la différence entre le stockage et une génératrice?"
        : "What is the difference between storage and a generator?",
      a: language === "fr"
        ? "Le stockage par batterie offre une transition instantanée (millisecondes vs secondes), aucune émission, un fonctionnement silencieux, un entretien minimal, et peut générer des revenus via l'écrêtage de pointe. Une génératrice diesel nécessite du carburant, de l'entretien régulier, et ne peut servir qu'en cas de panne."
        : "Battery storage offers instant transition (milliseconds vs seconds), zero emissions, silent operation, minimal maintenance, and can generate revenue via peak shaving. A diesel generator requires fuel, regular maintenance, and only serves during outages.",
    },
    {
      q: language === "fr"
        ? "Quelle taille de système ai-je besoin?"
        : "What size system do I need?",
      a: language === "fr"
        ? "La taille optimale dépend de votre profil de charge, de votre tarif Hydro-Québec, et de vos objectifs (écrêtage, secours, ou les deux). Notre analyse heure par heure détermine le dimensionnement qui maximise votre retour sur investissement."
        : "The optimal size depends on your load profile, Hydro-Québec rate, and objectives (peak shaving, backup, or both). Our hour-by-hour analysis determines the sizing that maximizes your ROI.",
    },
    {
      q: language === "fr"
        ? "Le stockage fonctionne-t-il en hiver au Québec?"
        : "Does storage work in winter in Quebec?",
      a: language === "fr"
        ? "Oui. Les systèmes BESS commerciaux sont installés dans des enceintes climatisées ou à l'intérieur du bâtiment. La gestion thermique intégrée maintient les batteries dans leur plage de température optimale toute l'année."
        : "Yes. Commercial BESS systems are installed in climate-controlled enclosures or inside the building. Integrated thermal management keeps batteries within their optimal temperature range year-round.",
    },
  ];

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": language === "fr" ? "Stockage d'énergie par batterie" : "Battery Energy Storage",
    "description": seoDescription,
    "provider": {
      "@type": "LocalBusiness",
      "name": "kWh Québec",
      "telephone": "+1-514-427-8871",
      "email": "info@kwh.quebec",
    },
    "areaServed": {
      "@type": "AdministrativeArea",
      "name": "Québec",
    },
    "serviceType": language === "fr"
      ? ["Stockage par batterie", "Écrêtage de pointe", "Intégration solaire+batterie"]
      : ["Battery Storage", "Peak Shaving", "Solar+Battery Integration"],
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        keywords={seoKeywords}
        structuredData={structuredData}
        locale={language}
        canonical={`https://www.kwh.quebec/stockage-energie`}
      />

      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/">
              <img
                src={currentLogo}
                alt={language === "fr" ? "Logo kWh Québec" : "kWh Québec Logo"}
                className="h-10 w-auto cursor-pointer"
                data-testid="logo-header"
              />
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {language === "fr" ? "Accueil" : "Home"}
              </Link>
              <Link href="/stockage-energie" className="text-sm font-medium text-foreground">
                {language === "fr" ? "Stockage" : "Storage"}
              </Link>
              <Link href="/ressources" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {language === "fr" ? "Ressources" : "Resources"}
              </Link>
              <Link href="/portfolio" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Portfolio
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

      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary/5 via-background to-background">
        <div className="max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge className="mb-4" data-testid="badge-storage">
              {language === "fr" ? "Stockage d'énergie" : "Energy Storage"}
            </Badge>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4" data-testid="text-hero-title">
              {language === "fr"
                ? "Stockage par batterie pour entreprises"
                : "Battery Storage for Businesses"}
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-4" data-testid="text-hero-subtitle">
              {language === "fr"
                ? "Réduisez vos frais de puissance, sécurisez vos opérations et maximisez la valeur de votre solaire avec le stockage par batterie."
                : "Reduce your demand charges, secure your operations and maximize your solar value with battery storage."}
            </p>
            <p className="text-base text-muted-foreground max-w-2xl mx-auto mb-8">
              {language === "fr"
                ? "Solutions BESS clé en main pour les bâtiments commerciaux et industriels au Québec."
                : "Turnkey BESS solutions for commercial and industrial buildings in Quebec."}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/#paths">
                <Button size="lg" className="gap-2" data-testid="button-get-analysis">
                  {language === "fr" ? "Voir mon potentiel — Gratuit" : "See my potential — Free"}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <a href={`tel:${BRAND_CONTENT.contact.phone.replace(/\./g, "-")}`}>
                <Button size="lg" variant="outline" className="gap-2" data-testid="button-call">
                  <Phone className="w-4 h-4" />
                  {BRAND_CONTENT.contact.phone}
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8" id="applications">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4" data-testid="text-use-cases-title">
              {language === "fr" ? "Applications du stockage" : "Storage Applications"}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {language === "fr"
                ? "Le stockage par batterie génère de la valeur de trois façons principales pour les entreprises québécoises."
                : "Battery storage generates value in three main ways for Quebec businesses."}
            </p>
          </div>

          <div className="space-y-8">
            {useCases.map((useCase, index) => (
              <motion.div
                key={useCase.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card data-testid={`card-use-case-${index}`}>
                  <CardContent className="p-6 sm:p-8">
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="shrink-0">
                        <div className="p-3 rounded-xl bg-primary/10 w-fit">
                          <useCase.icon className="w-8 h-8 text-primary" />
                        </div>
                      </div>
                      <div className="space-y-4 flex-1">
                        <h3 className="text-xl font-bold" data-testid={`text-use-case-title-${index}`}>{useCase.title}</h3>
                        <p className="text-muted-foreground">{useCase.description}</p>
                        <ul className="grid sm:grid-cols-2 gap-2">
                          {useCase.benefits.map((benefit) => (
                            <li key={benefit} className="flex items-center gap-2 text-sm">
                              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                              {benefit}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4" data-testid="text-roi-title">
              {language === "fr" ? "Retour sur investissement" : "Return on Investment"}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {language === "fr"
                ? "Comprendre la valeur financière du stockage pour votre bâtiment."
                : "Understanding the financial value of storage for your building."}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {roiFactors.map((factor, index) => (
              <motion.div
                key={factor.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full" data-testid={`card-roi-factor-${index}`}>
                  <CardContent className="p-6">
                    <div className="p-3 rounded-xl bg-primary/10 w-fit mb-4">
                      <factor.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-bold mb-2">{factor.title}</h3>
                    <p className="text-sm text-muted-foreground">{factor.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <Card className="mt-8">
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col md:flex-row items-start gap-6">
                <div className="p-3 rounded-xl bg-primary/10 shrink-0">
                  <BatteryCharging className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-3">
                  <h3 className="text-xl font-bold" data-testid="text-tarif-m-title">
                    {language === "fr" ? "Focus: Écrêtage de pointe au Tarif M" : "Focus: Peak Shaving on Rate M"}
                  </h3>
                  <p className="text-muted-foreground">
                    {language === "fr"
                      ? "Le Tarif M d'Hydro-Québec facture la puissance appelée (kW) en plus de l'énergie consommée (kWh). La composante puissance est basée sur le pic de demande de 15 minutes le plus élevé du mois. Un système de batterie stratégiquement dimensionné surveille la demande en temps réel et se décharge automatiquement pour limiter ces pics, réduisant les frais de puissance de 15 à 30%."
                      : "Hydro-Québec's Rate M charges for demand (kW) in addition to energy consumed (kWh). The demand component is based on the highest 15-minute peak of the month. A strategically sized battery system monitors demand in real-time and automatically discharges to limit these peaks, reducing demand charges by 15 to 30%."}
                  </p>
                  <div className="grid sm:grid-cols-3 gap-4 pt-2">
                    <div className="text-center p-3 rounded-md bg-muted/50">
                      <div className="text-2xl font-bold text-primary" data-testid="text-demand-reduction">15-30%</div>
                      <div className="text-xs text-muted-foreground">
                        {language === "fr" ? "Réduction des frais de puissance" : "Demand charge reduction"}
                      </div>
                    </div>
                    <div className="text-center p-3 rounded-md bg-muted/50">
                      <div className="text-2xl font-bold text-primary" data-testid="text-payback-period">7-12 {language === "fr" ? "ans" : "yrs"}</div>
                      <div className="text-xs text-muted-foreground">
                        {language === "fr" ? "Retour sur investissement" : "Payback period"}
                      </div>
                    </div>
                    <div className="text-center p-3 rounded-md bg-muted/50">
                      <div className="text-2xl font-bold text-primary" data-testid="text-lifespan">20+ {language === "fr" ? "ans" : "yrs"}</div>
                      <div className="text-xs text-muted-foreground">
                        {language === "fr" ? "Durée de vie utile" : "Useful lifespan"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4" data-testid="text-how-it-works-title">
              {language === "fr" ? "Comment ça fonctionne" : "How It Works"}
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: "1",
                icon: BarChart3,
                title: language === "fr" ? "Analyse du profil" : "Profile Analysis",
                desc: language === "fr"
                  ? "Analyse heure par heure de vos données Hydro-Québec pour identifier le potentiel d'écrêtage."
                  : "Hour-by-hour analysis of your Hydro-Québec data to identify shaving potential.",
              },
              {
                step: "2",
                icon: Battery,
                title: language === "fr" ? "Dimensionnement optimal" : "Optimal Sizing",
                desc: language === "fr"
                  ? "Calcul de la taille de batterie qui maximise le retour sur investissement."
                  : "Calculation of the battery size that maximizes ROI.",
              },
              {
                step: "3",
                icon: Zap,
                title: language === "fr" ? "Installation intégrée" : "Integrated Installation",
                desc: language === "fr"
                  ? "Installation clé en main avec intégration au système solaire existant ou nouveau."
                  : "Turnkey installation with integration to existing or new solar system.",
              },
              {
                step: "4",
                icon: TrendingUp,
                title: language === "fr" ? "Optimisation continue" : "Continuous Optimization",
                desc: language === "fr"
                  ? "Monitoring en temps réel et algorithmes d'optimisation pour maximiser les économies."
                  : "Real-time monitoring and optimization algorithms to maximize savings.",
              },
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="relative mb-4">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <item.icon className="w-7 h-7 text-primary" />
                  </div>
                  <Badge className="absolute -top-1 -right-1 left-auto mx-auto" style={{ position: "absolute", left: "calc(50% + 14px)" }}>
                    {item.step}
                  </Badge>
                </div>
                <h3 className="font-semibold mb-2" data-testid={`text-step-title-${index}`}>{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4" data-testid="text-sectors-title">
              {language === "fr" ? "Secteurs ciblés" : "Target Sectors"}
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <Card className="text-center" data-testid="card-sector-commercial">
              <CardContent className="p-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-bold mb-2">{language === "fr" ? "Commercial" : "Commercial"}</h3>
                <p className="text-sm text-muted-foreground">
                  {language === "fr"
                    ? "Centres d'achat, immeubles de bureaux, hôtels — réduction des frais de puissance et alimentation de secours."
                    : "Shopping centers, office buildings, hotels — demand charge reduction and backup power."}
                </p>
              </CardContent>
            </Card>
            <Card className="text-center" data-testid="card-sector-industrial">
              <CardContent className="p-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Factory className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-bold mb-2">{language === "fr" ? "Industriel" : "Industrial"}</h3>
                <p className="text-sm text-muted-foreground">
                  {language === "fr"
                    ? "Usines, entrepôts, centres de distribution — écrêtage de pointe au Tarif M et continuité des opérations."
                    : "Factories, warehouses, distribution centers — Rate M peak shaving and operational continuity."}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4" data-testid="text-faq-title">
              {language === "fr" ? "Questions fréquentes — Stockage" : "FAQ — Storage"}
            </h2>
          </div>

          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`faq-${index}`} className="border rounded-md px-4">
                <AccordionTrigger className="text-left font-medium" data-testid={`button-faq-${index}`}>
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground" data-testid={`text-faq-answer-${index}`}>
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4" data-testid="text-cta-title">
            {language === "fr" ? "Découvrez le potentiel de stockage pour votre bâtiment" : "Discover the storage potential for your building"}
          </h2>
          <p className="text-lg opacity-90 mb-8">
            {language === "fr"
              ? "Notre analyse gratuite inclut une évaluation du potentiel solaire et stockage, avec projections financières détaillées."
              : "Our free analysis includes a solar and storage potential assessment, with detailed financial projections."}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/#paths">
              <Button size="lg" variant="secondary" className="gap-2" data-testid="button-cta-analysis">
                {language === "fr" ? "Commencer mon analyse — Gratuit" : "Start my analysis — Free"}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <a href={`mailto:${BRAND_CONTENT.contact.email}`}>
              <Button size="lg" variant="outline" className="gap-2 border-primary-foreground/30 text-primary-foreground">
                <Mail className="w-4 h-4" />
                {language === "fr" ? "Nous contacter" : "Contact us"}
              </Button>
            </a>
          </div>
        </div>
      </section>

      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <img src={currentLogo} alt={language === "fr" ? "Logo kWh Québec" : "kWh Québec Logo"} className="h-10 w-auto" />
              <span className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} kWh Québec. {language === "fr" ? "Tous droits réservés." : "All rights reserved."}
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground flex-wrap">
              <Link href="/" className="hover:text-foreground transition-colors">
                {language === "fr" ? "Accueil" : "Home"}
              </Link>
              <Link href="/stockage-energie" className="hover:text-foreground transition-colors">
                {language === "fr" ? "Stockage" : "Storage"}
              </Link>
              <Link href="/ressources" className="hover:text-foreground transition-colors">
                {language === "fr" ? "Ressources" : "Resources"}
              </Link>
              <Link href="/portfolio" className="hover:text-foreground transition-colors">
                Portfolio
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

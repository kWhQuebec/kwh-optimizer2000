import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  Sun, TrendingUp, DollarSign, ArrowRight, CheckCircle2,
  BarChart3, Shield, Building2, Factory, Phone, Mail,
  Zap, Leaf, Wrench, Award, FileCheck, HardHat, XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PublicHeader, PublicFooter } from "@/components/public-header";
import { useI18n } from "@/lib/i18n";
import { SEOHead } from "@/components/seo-head";
import { BRAND_CONTENT } from "@shared/brandContent";

export default function SolaireCommercialPage() {
  const { language } = useI18n();
  function t(fr: string, en: string): string;
  function t<T>(fr: T, en: T): T;
  function t(fr: unknown, en: unknown) { return language === "fr" ? fr : en; }

  const seoTitle = t(
    "Solaire commercial et industriel au Québec | kWh Québec",
    "Commercial & Industrial Solar in Quebec | kWh Québec"
  );
  const seoDescription = t(
    "Installation solaire clé en main pour bâtiments commerciaux et industriels au Québec. Incitatifs OSE 6.0, crédit d'impôt fédéral 30%, retour sur investissement en 5-9 ans.",
    "Turnkey solar installation for commercial and industrial buildings in Quebec. OSE 6.0 incentives, 30% federal tax credit, 5-9 year payback."
  );
  const seoKeywords = t(
    "solaire commercial québec, panneaux solaires entreprise, installation solaire industriel, OSE 6.0, incitatifs solaires québec, énergie solaire C&I",
    "commercial solar quebec, business solar panels, industrial solar installation, OSE 6.0, solar incentives quebec, C&I solar energy"
  );

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": t("Installation solaire commerciale et industrielle", "Commercial & Industrial Solar Installation"),
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
    "serviceType": t(
      ["Installation solaire", "Analyse de potentiel solaire", "Conception et ingénierie", "Installation clé en main"],
      ["Solar Installation", "Solar Potential Analysis", "Design & Engineering", "Turnkey Installation"]
    ),
  };

  const incentives = [
    {
      icon: Sun,
      title: t("Hydro-Québec — OSE 6.0", "Hydro-Québec — OSE 6.0"),
      amount: t("Jusqu'à 1 000 $/kW", "Up to $1,000/kW"),
      description: t(
        "Le programme Solutions efficaces d'Hydro-Québec offre un crédit allant jusqu'à 40% du coût du projet, plafonné à 1 MW. Certifications CSA et licence RBQ requises.",
        "Hydro-Québec's Solutions efficaces program offers a credit of up to 40% of project cost, capped at 1 MW. CSA certifications and RBQ license required."
      ),
      benefits: t(
        ["Crédit sur la facture HQ", "Jusqu'à 40% du projet", "Maximum 1 MW par site", "En vigueur mars 2026"],
        ["Credit on HQ bill", "Up to 40% of project", "Maximum 1 MW per site", "Effective March 2026"]
      ),
    },
    {
      icon: DollarSign,
      title: t("Crédit d'impôt fédéral (CII)", "Federal Investment Tax Credit (ITC)"),
      amount: t("Jusqu'à 30%", "Up to 30%"),
      description: t(
        "Le crédit d'impôt à l'investissement pour technologies propres du gouvernement fédéral couvre jusqu'à 30% du coût pour les entreprises admissibles. Cumulable avec OSE 6.0.",
        "The federal clean technology investment tax credit covers up to 30% of cost for eligible businesses. Stackable with OSE 6.0."
      ),
      benefits: t(
        ["Cumulable avec Hydro-Québec", "Jusqu'à 30% du coût", "Technologies propres admissibles", "Applicable dès l'année d'installation"],
        ["Stackable with Hydro-Québec", "Up to 30% of cost", "Eligible clean technologies", "Applicable from year of installation"]
      ),
    },
    {
      icon: TrendingUp,
      title: t("Amortissement accéléré (DPA)", "Accelerated Depreciation (CCA)"),
      amount: t("100% an 1", "100% Year 1"),
      description: t(
        "Les catégories DPA 43.1/43.2 permettent une déduction fiscale accélérée, potentiellement 100% en première année (sous réserve d'éligibilité — consultez votre comptable).",
        "CCA classes 43.1/43.2 allow accelerated tax deduction, potentially 100% in year one (subject to eligibility — consult your accountant)."
      ),
      benefits: t(
        ["Déduction accélérée", "Optimisation fiscale", "Sous réserve d'éligibilité", "Consultez votre comptable"],
        ["Accelerated deduction", "Tax optimization", "Subject to eligibility", "Consult your accountant"]
      ),
    },
  ];

  const benefits = [
    {
      icon: DollarSign,
      title: t("Réduisez vos coûts énergétiques", "Reduce Your Energy Costs"),
      description: t(
        "Un système solaire réduit votre facture Hydro-Québec de façon permanente. Le mesurage net vous permet de créditer vos surplus sur 24 mois.",
        "A solar system permanently reduces your Hydro-Québec bill. Net metering lets you credit surplus energy over 24 months."
      ),
      points: t(
        ["Économies dès le premier jour", "Mesurage net — crédits sur 24 mois", "Protection contre les hausses tarifaires", "Retour sur investissement en 5 à 9 ans"],
        ["Savings from day one", "Net metering — 24-month credits", "Protection from rate increases", "5-9 year payback"]
      ),
    },
    {
      icon: Leaf,
      title: t("Leadership environnemental", "Environmental Leadership"),
      description: t(
        "Atteignez vos objectifs ESG avec un impact mesurable et vérifiable. Chaque kWh solaire produit réduit votre empreinte carbone.",
        "Achieve your ESG goals with a measurable, verifiable impact. Each solar kWh produced reduces your carbon footprint."
      ),
      points: t(
        ["Réduction certifiable des GES", "Rapports ESG avec données réelles", "Image de marque responsable", "Engagement concret dans la transition"],
        ["Certifiable GHG reduction", "ESG reports with real data", "Responsible brand image", "Concrete commitment to the transition"]
      ),
    },
    {
      icon: Building2,
      title: t("Augmentez la valeur de votre immeuble", "Increase Your Property Value"),
      description: t(
        "Un système solaire augmente la valeur marchande et l'attractivité de votre immeuble auprès des locataires et investisseurs.",
        "A solar system increases the market value and attractiveness of your building to tenants and investors."
      ),
      points: t(
        ["Hausse de la valeur marchande", "Attractivité pour les locataires", "Actif de longue durée (25+ ans)", "Avantage concurrentiel sur le marché"],
        ["Increased market value", "Tenant attraction", "Long-life asset (25+ years)", "Competitive advantage"]
      ),
    },
  ];

  const equipment = BRAND_CONTENT.equipment;

  const equipmentIcons: Record<string, typeof Sun> = {
    panel: Sun,
    inverter: Zap,
    mounting: Shield,
    workmanship: HardHat,
  };

  const winterMyths = BRAND_CONTENT.whySolarNow.winterMyths;

  const processSteps = BRAND_CONTENT.timeline;

  const processIcons: Record<string, typeof Sun> = {
    analysis: BarChart3,
    study: FileCheck,
    design: Wrench,
    plans: Award,
    install: HardHat,
  };

  const faqs = [
    {
      q: t(
        "Combien coûte une installation solaire commerciale?",
        "How much does a commercial solar installation cost?"
      ),
      a: t(
        "Le coût varie selon la taille du système et le bâtiment, mais se situe généralement entre 1 800 $ et 2 500 $ par kW. Avec les incitatifs gouvernementaux pouvant couvrir jusqu'à 60% du projet (OSE 6.0 + CII fédéral), votre investissement net tombe à 700 $ à 1 000 $ par kW. Les systèmes plus grands bénéficient de meilleurs prix unitaires.",
        "Cost varies by system size and building, but typically ranges from $1,800 to $2,500 per kW. With government incentives covering up to 60% of the project (OSE 6.0 + federal ITC), your net investment drops to $700 to $1,000 per kW. Larger systems benefit from better unit pricing."
      ),
    },
    {
      q: t(
        "Combien de temps dure le processus du premier appel à la mise en service?",
        "How long does the process take from first call to commissioning?"
      ),
      a: t(
        "Le processus complet prend généralement de 4 à 8 mois : analyse rapide (quelques minutes), validation économique (7 jours), validation technique (2-3 semaines), ingénierie (4-8 semaines), et permis + installation (10-18 semaines). Les étapes initiales sont rapides et sans engagement.",
        "The complete process typically takes 4 to 8 months: quick analysis (a few minutes), economic validation (7 days), technical validation (2-3 weeks), engineering (4-8 weeks), and permits + installation (10-18 weeks). Initial steps are fast and no-commitment."
      ),
    },
    {
      q: t(
        "Le solaire fonctionne-t-il en hiver au Québec?",
        "Does solar work in winter in Quebec?"
      ),
      a: t(
        "Oui. Le système est dimensionné sur la production annuelle totale, pas sur un mois spécifique. Le froid améliore l'efficacité des panneaux (+0,4%/°C sous 25°C), les longs étés québécois (15h+ d'ensoleillement) compensent l'hiver, et le mesurage net permet de créditer les surplus sur 24 mois. L'étude NAIT (5 ans, Edmonton) montre seulement ~5% de perte annuelle due à la neige à 10°.",
        "Yes. The system is sized on total annual production, not a specific month. Cold improves panel efficiency (+0.4%/°C below 25°C), long Quebec summers (15h+ daylight) offset winter, and net metering credits surplus over 24 months. The NAIT study (5 years, Edmonton) shows only ~5% annual loss from snow at 10°."
      ),
    },
    {
      q: t(
        "Mon toit peut-il supporter des panneaux solaires?",
        "Can my roof support solar panels?"
      ),
      a: t(
        "La plupart des toits commerciaux plats peuvent supporter un système solaire. Le poids total du système (panneaux + structure) est d'environ 16,5 kg/m² (3,4 lb/pi²), ce qui est comparable à une légère couche de neige. Notre validation technique inclut une évaluation structurelle par un ingénieur pour confirmer la capacité portante de votre toit.",
        "Most flat commercial roofs can support a solar system. The total system weight (panels + racking) is approximately 16.5 kg/m² (3.4 lb/sf), which is comparable to a light layer of snow. Our technical validation includes a structural assessment by an engineer to confirm your roof's load capacity."
      ),
    },
    {
      q: t(
        "Qu'est-ce que le mandat de conception préliminaire?",
        "What is the preliminary design mandate?"
      ),
      a: t(
        "C'est un investissement de 2 500 $ + taxes par bâtiment qui couvre la visite technique sur site, la validation de la toiture et de la structure, l'évaluation de la salle électrique, et un layout préliminaire. Ce montant est intégralement crédité sur le contrat EPC si vous procédez avec kWh Québec.",
        "It's a $2,500 + tax investment per building that covers the on-site technical visit, roof and structural validation, electrical room assessment, and a preliminary layout. This amount is fully credited toward the EPC contract if you proceed with kWh Québec."
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        keywords={seoKeywords}
        structuredData={structuredData}
        locale={language}
        canonical="https://www.kwh.quebec/solaire-commercial"
      />

      <PublicHeader />

      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary/5 via-background to-background">
        <div className="max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge className="mb-4" data-testid="badge-solar">
              {t("Solaire commercial", "Commercial Solar")}
            </Badge>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4" data-testid="text-hero-title">
              {t(
                "Énergie solaire pour bâtiments commerciaux et industriels",
                "Solar Energy for Commercial & Industrial Buildings"
              )}
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-4" data-testid="text-hero-subtitle">
              {t(
                "Réduisez vos coûts énergétiques jusqu'à 70% avec un système solaire clé en main, rentabilisé en 5 à 9 ans grâce aux incitatifs disponibles.",
                "Reduce your energy costs by up to 70% with a turnkey solar system, paying for itself in 5 to 9 years thanks to available incentives."
              )}
            </p>
            <p className="text-base text-muted-foreground max-w-2xl mx-auto mb-8">
              {t(
                "Licence RBQ, équipe certifiée CCQ & CNESST, ingénierie scellée — partout au Québec.",
                "RBQ licensed, CCQ & CNESST certified team, sealed engineering — across Quebec."
              )}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/#paths">
                <Button size="lg" className="gap-2" data-testid="button-get-analysis">
                  {t("Voir mon potentiel — Gratuit", "See my potential — Free")}
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

      <section className="py-16 px-4 sm:px-6 lg:px-8" id="incentives">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4" data-testid="text-incentives-title">
              {t("Pourquoi le solaire au Québec maintenant?", "Why Solar in Quebec Now?")}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t(
                "Trois niveaux d'incitatifs combinables rendent le solaire commercial plus accessible que jamais au Québec.",
                "Three stackable incentive levels make commercial solar more accessible than ever in Quebec."
              )}
            </p>
          </div>

          <div className="space-y-8">
            {incentives.map((incentive, index) => (
              <motion.div
                key={incentive.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card data-testid={`card-incentive-${index}`}>
                  <CardContent className="p-6 sm:p-8">
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="shrink-0">
                        <div className="p-3 rounded-xl bg-primary/10 w-fit">
                          <incentive.icon className="w-8 h-8 text-primary" />
                        </div>
                      </div>
                      <div className="space-y-4 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-xl font-bold" data-testid={`text-incentive-title-${index}`}>{incentive.title}</h3>
                          <Badge variant="secondary" data-testid={`badge-incentive-amount-${index}`}>{incentive.amount}</Badge>
                        </div>
                        <p className="text-muted-foreground">{incentive.description}</p>
                        <ul className="grid sm:grid-cols-2 gap-2">
                          {incentive.benefits.map((benefit) => (
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

          <Card className="mt-8">
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col md:flex-row items-start gap-6">
                <div className="p-3 rounded-xl bg-primary/10 shrink-0">
                  <TrendingUp className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-3">
                  <h3 className="text-xl font-bold" data-testid="text-combined-title">
                    {t("Résultat : jusqu'à 60% du projet couvert", "Result: Up to 60% of the project covered")}
                  </h3>
                  <p className="text-muted-foreground">
                    {t(
                      "En combinant l'incitatif Hydro-Québec (OSE 6.0), le crédit d'impôt fédéral (CII) et l'amortissement accéléré (DPA), les entreprises admissibles peuvent couvrir jusqu'à 60% du coût total de leur projet solaire. Votre investissement net tombe à 700 $ - 1 000 $ par kW installé.",
                      "By combining the Hydro-Québec incentive (OSE 6.0), federal investment tax credit (ITC), and accelerated depreciation (CCA), eligible businesses can cover up to 60% of total solar project cost. Your net investment drops to $700-$1,000 per installed kW."
                    )}
                  </p>
                  <div className="grid sm:grid-cols-3 gap-4 pt-2">
                    <div className="text-center p-3 rounded-md bg-muted/50">
                      <div className="text-2xl font-bold text-primary" data-testid="text-stat-savings">5-9 {t("ans", "yrs")}</div>
                      <div className="text-xs text-muted-foreground">
                        {t("Retour sur investissement", "Payback period")}
                      </div>
                    </div>
                    <div className="text-center p-3 rounded-md bg-muted/50">
                      <div className="text-2xl font-bold text-primary" data-testid="text-stat-coverage">~70%</div>
                      <div className="text-xs text-muted-foreground">
                        {t("Couverture énergétique typique", "Typical energy coverage")}
                      </div>
                    </div>
                    <div className="text-center p-3 rounded-md bg-muted/50">
                      <div className="text-2xl font-bold text-primary" data-testid="text-stat-lifespan">25+ {t("ans", "yrs")}</div>
                      <div className="text-xs text-muted-foreground">
                        {t("Durée de vie système", "System lifespan")}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4" data-testid="text-benefits-title">
              {t("Avantages du solaire commercial", "Benefits of Commercial Solar")}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t(
                "Au-delà des économies, le solaire transforme votre bâtiment en actif stratégique.",
                "Beyond savings, solar transforms your building into a strategic asset."
              )}
            </p>
          </div>

          <div className="space-y-8">
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card data-testid={`card-benefit-${index}`}>
                  <CardContent className="p-6 sm:p-8">
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="shrink-0">
                        <div className="p-3 rounded-xl bg-primary/10 w-fit">
                          <benefit.icon className="w-8 h-8 text-primary" />
                        </div>
                      </div>
                      <div className="space-y-4 flex-1">
                        <h3 className="text-xl font-bold" data-testid={`text-benefit-title-${index}`}>{benefit.title}</h3>
                        <p className="text-muted-foreground">{benefit.description}</p>
                        <ul className="grid sm:grid-cols-2 gap-2">
                          {benefit.points.map((point) => (
                            <li key={point} className="flex items-center gap-2 text-sm">
                              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                              {point}
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

      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4" data-testid="text-equipment-title">
              {t("Équipement de qualité industrielle", "Industrial-Grade Equipment")}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t(
                "Nous utilisons des composants certifiés et éprouvés, sélectionnés pour la performance et la durabilité en climat québécois.",
                "We use certified, proven components selected for performance and durability in Quebec's climate."
              )}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {equipment.map((item, index) => {
              const IconComp = equipmentIcons[item.iconCode] || Sun;
              const label = t(item.labelFr, item.labelEn);
              const specs = t(item.specsFr || "", item.specsEn || "");
              const warranty = t(item.warrantyFr, item.warrantyEn);

              return (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="h-full" data-testid={`card-equipment-${index}`}>
                    <CardContent className="p-6">
                      <div className="p-3 rounded-xl bg-primary/10 w-fit mb-4">
                        <IconComp className="w-6 h-6 text-primary" />
                      </div>
                      <h3 className="text-base font-bold mb-2" data-testid={`text-equipment-name-${index}`}>{label}</h3>
                      {specs && (
                        <p className="text-sm text-muted-foreground mb-3">{specs}</p>
                      )}
                      <div className="space-y-1.5 text-sm">
                        <div className="flex items-center gap-2">
                          <Shield className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="text-muted-foreground">{t("Garantie", "Warranty")}: {warranty}</span>
                        </div>
                        {item.certifications && item.certifications.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {item.certifications.slice(0, 3).map((cert) => (
                              <Badge key={cert} variant="outline" className="text-xs">
                                {cert}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          <Card className="mt-8">
            <CardContent className="p-6">
              <div className="grid sm:grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-primary">{BRAND_CONTENT.equipmentTechnicalSummary.totalSystemWeightKgPerM2.value} kg/m²</div>
                  <div className="text-xs text-muted-foreground">{t(BRAND_CONTENT.equipmentTechnicalSummary.totalSystemWeightKgPerM2.labelFr, BRAND_CONTENT.equipmentTechnicalSummary.totalSystemWeightKgPerM2.labelEn)}</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-primary">{BRAND_CONTENT.equipmentTechnicalSummary.totalSystemWeightPsfPerSf.value} {t("lb/p²", "lb/sf")}</div>
                  <div className="text-xs text-muted-foreground">{t(BRAND_CONTENT.equipmentTechnicalSummary.totalSystemWeightPsfPerSf.labelFr!, BRAND_CONTENT.equipmentTechnicalSummary.totalSystemWeightPsfPerSf.labelEn!)}</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-primary">NBCC 2020</div>
                  <div className="text-xs text-muted-foreground">{t(BRAND_CONTENT.equipmentTechnicalSummary.windLoadDesign.labelFr, BRAND_CONTENT.equipmentTechnicalSummary.windLoadDesign.labelEn)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4" data-testid="text-process-title">
              {t("Notre processus en 5 étapes", "Our 5-Step Process")}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t(
                "Du premier appel à la mise en service, un accompagnement complet et structuré.",
                "From first call to commissioning, comprehensive and structured support."
              )}
            </p>
          </div>

          <div className="space-y-6">
            {processSteps.map((step, index) => {
              const IconComp = processIcons[step.iconCode] || Sun;
              const title = t(step.stepFr, step.stepEn);
              const duration = t(step.durationFr, step.durationEn);
              const bullets = t(step.bulletsFr, step.bulletsEn);

              return (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card data-testid={`card-step-${index}`}>
                    <CardContent className="p-6">
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex items-start gap-4 shrink-0">
                          <div className="relative">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                              <IconComp className="w-6 h-6 text-primary" />
                            </div>
                            <Badge className="absolute -top-1 -right-2">{index + 1}</Badge>
                          </div>
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-lg font-bold">{title}</h3>
                            <Badge variant="outline" className="text-xs">{duration}</Badge>
                          </div>
                          <ul className="space-y-1.5">
                            {bullets.map((bullet) => (
                              <li key={bullet} className="flex items-start gap-2 text-sm text-muted-foreground">
                                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                {bullet}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          <Card className="mt-8 border-primary/30">
            <CardContent className="p-6 text-center">
              <h3 className="font-bold mb-2" data-testid="text-mandate-title">
                {t(BRAND_CONTENT.designMandate.labelFr, BRAND_CONTENT.designMandate.labelEn)}
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                {t(BRAND_CONTENT.designMandate.descriptionFr, BRAND_CONTENT.designMandate.descriptionEn)}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Badge variant="secondary">{t(BRAND_CONTENT.designMandate.priceLabelFr, BRAND_CONTENT.designMandate.priceLabelEn)}</Badge>
                <span className="text-xs text-muted-foreground">{t(BRAND_CONTENT.designMandate.creditPolicyFr, BRAND_CONTENT.designMandate.creditPolicyEn)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4" data-testid="text-winter-title">
              {t(BRAND_CONTENT.whySolarNow.winterTitle.fr, BRAND_CONTENT.whySolarNow.winterTitle.en)}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t(BRAND_CONTENT.whySolarNow.winterSubtitle.fr, BRAND_CONTENT.whySolarNow.winterSubtitle.en)}
            </p>
          </div>

          <div className="space-y-4 max-w-3xl mx-auto">
            {winterMyths.map((myth, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
              >
                <Card data-testid={`card-myth-${index}`}>
                  <CardContent className="p-5">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                        <div>
                          <span className="text-xs font-medium text-destructive uppercase">{t("Mythe", "Myth")}</span>
                          <p className="font-medium">{t(myth.mythFr, myth.mythEn)}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-xs font-medium text-green-600 uppercase">{t("Réalité", "Reality")}</span>
                          <p className="text-sm text-muted-foreground">{t(myth.realityFr, myth.realityEn)}</p>
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

      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4" data-testid="text-sectors-title">
              {t("Secteurs ciblés", "Target Sectors")}
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <Card className="text-center" data-testid="card-sector-commercial">
              <CardContent className="p-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-bold mb-2">{t("Commercial", "Commercial")}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t(
                    "Immeubles de bureaux, centres commerciaux, hôtels, institutions — toits plats avec forte consommation diurne.",
                    "Office buildings, shopping centers, hotels, institutions — flat roofs with high daytime consumption."
                  )}
                </p>
                <ul className="text-sm text-left space-y-1.5">
                  {t(
                    ["Consommation en journée = autoconsommation élevée", "Toits plats larges et accessibles", "Factures mensuelles > 1 500 $"],
                    ["Daytime consumption = high self-consumption", "Large, accessible flat roofs", "Monthly bills > $1,500"]
                  ).map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card className="text-center" data-testid="card-sector-industrial">
              <CardContent className="p-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Factory className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-bold mb-2">{t("Industriel", "Industrial")}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t(
                    "Entrepôts, centres de distribution, usines — grandes superficies de toiture et consommation élevée.",
                    "Warehouses, distribution centers, factories — large roof areas and high consumption."
                  )}
                </p>
                <ul className="text-sm text-left space-y-1.5">
                  {t(
                    ["Grande superficie de toiture disponible", "Synergie avec stockage (Tarif M)", "Potentiel de systèmes > 500 kW"],
                    ["Large available roof area", "Synergy with storage (Rate M)", "Potential for systems > 500 kW"]
                  ).map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4" data-testid="text-faq-title">
              {t("Questions fréquentes — Solaire commercial", "FAQ — Commercial Solar")}
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

          <div className="text-center mt-8">
            <Link href="/ressources?tab=faq">
              <Button variant="outline" className="gap-2" data-testid="link-faq-see-all">
                {t("Voir toutes les FAQ", "See all FAQs")}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="grid sm:grid-cols-2 gap-6">
            <Link href="/portfolio">
              <Card className="h-full hover-elevate cursor-pointer" data-testid="link-solar-portfolio">
                <CardContent className="p-6 flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-primary/10 shrink-0">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">
                      {t("Voir nos projets", "View our projects")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t(
                        "Découvrez notre portfolio de projets solaires commerciaux et industriels au Québec.",
                        "Explore our portfolio of commercial and industrial solar projects in Quebec."
                      )}
                    </p>
                    <span className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-primary">
                      {t("Portfolio", "Portfolio")} <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/stockage-energie">
              <Card className="h-full hover-elevate cursor-pointer" data-testid="link-solar-stockage">
                <CardContent className="p-6 flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-primary/10 shrink-0">
                    <Zap className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">
                      {t("Stockage par batterie", "Battery Storage")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t(
                        "Maximisez votre investissement solaire avec le stockage d'énergie — écrêtage de pointe, secours et optimisation.",
                        "Maximize your solar investment with energy storage — peak shaving, backup, and optimization."
                      )}
                    </p>
                    <span className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-primary">
                      {t("En savoir plus", "Learn more")} <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4" data-testid="text-cta-title">
            {t("Découvrez le potentiel solaire de votre bâtiment", "Discover your building's solar potential")}
          </h2>
          <p className="text-lg opacity-90 mb-8">
            {t(
              "Notre analyse gratuite inclut une estimation des économies, du retour sur investissement et des incitatifs disponibles — en quelques minutes.",
              "Our free analysis includes an estimate of savings, ROI, and available incentives — in just minutes."
            )}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/#paths">
              <Button size="lg" variant="secondary" className="gap-2" data-testid="button-cta-analysis">
                {t("Commencer mon analyse — Gratuit", "Start my analysis — Free")}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <a href={`mailto:${BRAND_CONTENT.contact.email}`}>
              <Button size="lg" variant="outline" className="gap-2 border-primary-foreground/30 text-primary-foreground">
                <Mail className="w-4 h-4" />
                {t("Nous contacter", "Contact us")}
              </Button>
            </a>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}

import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  CheckCircle2, ArrowRight, Users, FileText, Zap, Shield,
  Building2, Wrench, HelpCircle, Phone, Mail
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";
import { FunnelEvents } from "@/lib/analytics";
import { BRAND_CONTENT } from "@shared/brandContent";
import logoFr from "@assets/kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png";
import logoEn from "@assets/kWh_Quebec_Logo-02_-_Rectangle_1764799021536.png";

export default function MandatConceptionPage() {
  const { t, language } = useI18n();
  const [, navigate] = useLocation();

  const currentLogo = language === "fr" ? logoFr : logoEn;
  const designMandate = BRAND_CONTENT.designMandate;

  // Track page view
  useEffect(() => {
    FunnelEvents.ctaClicked("page_view", "design-mandate-landing");
  }, []);

  const openCalendly = () => {
    const calendlyUrl = process.env.VITE_CALENDLY_URL || BRAND_CONTENT.calendly.fallbackUrl;
    window.open(calendlyUrl, "_blank");
  };

  const heroContent = language === "fr"
    ? {
        title: "Validez votre projet solaire",
        subtitle: "Mandat de conception préliminaire",
        description: "Une étude terrain complète pour confirmer la faisabilité de votre projet avant de vous engager dans un contrat EPC complet.",
        price: "2 500$ + taxes",
        credit: "Montant crédité intégralement sur le contrat EPC si vous procédez",
      }
    : {
        title: "Validate your solar project",
        subtitle: "Preliminary Design Mandate",
        description: "A comprehensive site study to confirm the feasibility of your project before committing to a full EPC contract.",
        price: "$2,500 + taxes",
        credit: "Amount fully credited toward the EPC contract if you proceed",
      };

  const faqItems = language === "fr"
    ? [
        {
          question: "Quelle est la différence entre ce mandat et une analyse détaillée?",
          answer: "L'analyse détaillée (gratuite) valide le potentiel solaire global de votre bâtiment en analysant vos données de consommation Hydro-Québec et votre toiture. Le mandat de conception préliminaire approfondit cette analyse avec une visite terrain complète, des mesures précises, l'évaluation structurelle et électrique, et la confirmation de faisabilité. C'est l'étape essentielle avant la conception détaillée et la construction.",
        },
        {
          question: "Que se passe-t-il si vous confirmez que le projet n'est pas viable?",
          answer: "Si le projet n'est pas viable (toiture à remplacer, structure insuffisante, obstacles insurmontables), nous vous le confirmerons avec un rapport détaillé expliquant les raisons. Les frais du mandat seront remboursés à 100%. Votre satisfaction et transparence sont prioritaires.",
        },
        {
          question: "Combien de temps prend le mandat de conception?",
          answer: "Généralement 2-3 semaines après la signature. Cela inclut la planification de la visite, l'inspection terrain (1-2 jours selon la taille), l'analyse des données collectées, et la rédaction du rapport final avec les recommandations.",
        },
        {
          question: "Pouvez-vous procéder avec un autre entrepreneur si le rapport est positif?",
          answer: "Techniquement oui, c'est votre droit. Mais si vous procédez avec kWh Québec, le montant du mandat ($2,500) est crédité intégralement sur votre contrat EPC. Le rapport devient également propriété intellectuelle partagée pour la conception détaillée.",
        },
        {
          question: "Est-ce que ce mandat inclut les plans de construction?",
          answer: "Non. Le mandat produit un layout préliminaire, des photos, des mesures, et une confirmation de faisabilité. Les plans détaillés (ingénierie, permis) sont développés lors de la phase EPC suivante si vous décidez de procéder.",
        },
        {
          question: "Quels documents dois-je préparer?",
          answer: "Préparez: 1) Factures Hydro-Québec (12-24 mois), 2) Informations sur la toiture (âge, état), 3) Schéma unifilaire si disponible, 4) Confirmation si propriétaire ou locataire avec autorisation du propriétaire. Notre équipe vous guidera.",
        },
      ]
    : [
        {
          question: "What is the difference between this mandate and a detailed analysis?",
          answer: "The detailed analysis (free) validates your building's overall solar potential by analyzing your Hydro-Québec consumption data and roof. The preliminary design mandate deepens this analysis with a comprehensive site visit, precise measurements, structural and electrical assessment, and feasibility confirmation. It's the essential step before detailed design and construction.",
        },
        {
          question: "What happens if you confirm the project is not viable?",
          answer: "If the project is not viable (roof needs replacement, insufficient structure, insurmountable obstacles), we'll confirm this with a detailed report explaining the reasons. The mandate fees will be refunded 100%. Your satisfaction and transparency are priorities.",
        },
        {
          question: "How long does the design mandate take?",
          answer: "Generally 2-3 weeks after signing. This includes scheduling the visit, field inspection (1-2 days depending on size), analysis of collected data, and drafting the final report with recommendations.",
        },
        {
          question: "Can you proceed with another contractor if the report is positive?",
          answer: "Technically yes, it's your right. But if you proceed with kWh Québec, the mandate amount ($2,500) is fully credited to your EPC contract. The report also becomes shared intellectual property for detailed design.",
        },
        {
          question: "Does this mandate include construction plans?",
          answer: "No. The mandate produces a preliminary layout, photos, measurements, and feasibility confirmation. Detailed plans (engineering, permits) are developed during the EPC phase if you decide to proceed.",
        },
        {
          question: "What documents should I prepare?",
          answer: "Prepare: 1) Hydro-Québec bills (12-24 months), 2) Roof information (age, condition), 3) Single-line diagram if available, 4) Confirmation of ownership or tenant with landlord authorization. Our team will guide you.",
        },
      ];

  const responsibilities = language === "fr"
    ? {
        title: "Responsabilités",
        kwhHandles: "kWh Québec fournit:",
        clientProvides: "Vous fournissez:",
      }
    : {
        title: "Responsibilities",
        kwhHandles: "kWh Québec provides:",
        clientProvides: "You provide:",
      };

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-background backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <Link href="/">
              <img
                src={currentLogo}
                alt={language === "fr" ? "Logo kWh Québec – Énergie solaire commerciale" : "kWh Québec Logo – Commercial Solar Energy"}
                className="h-[50px] sm:h-[3.75rem] w-auto"
              />
            </Link>

            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 pb-16">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-primary/10 to-transparent py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <motion.div
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Badge className="mb-4" variant="secondary">
                {language === "fr" ? "Prochaine étape du processus" : "Next step in the process"}
              </Badge>

              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
                {heroContent.title}
              </h1>

              <p className="text-xl text-muted-foreground mb-2">
                {heroContent.subtitle}
              </p>

              <p className="text-lg text-foreground/80 max-w-2xl mx-auto mb-8">
                {heroContent.description}
              </p>

              {/* Price Section */}
              <motion.div
                className="bg-white dark:bg-slate-950 rounded-lg p-8 mb-8 border-2 border-primary/20"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <div className="flex items-baseline justify-center gap-2 mb-2">
                  <span className="text-5xl font-bold text-primary">
                    {language === "fr" ? "2 500$" : "$2,500"}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {language === "fr" ? "+ taxes" : "+ taxes"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {language === "fr" ? "par bâtiment" : "per building"}
                </p>
                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded p-4 text-sm">
                  <div className="flex gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <p className="text-green-800 dark:text-green-300">
                      {heroContent.credit}
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* CTA Buttons */}
              <motion.div
                className="flex flex-col sm:flex-row gap-4 justify-center"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <Button
                  size="lg"
                  onClick={openCalendly}
                  className="gap-2 text-base h-12"
                >
                  <Calendar className="w-5 h-5" />
                  {language === "fr" ? "Réserver une consultation" : "Book a consultation"}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate("/")}
                  className="gap-2 text-base h-12"
                >
                  <ArrowRight className="w-5 h-5" />
                  {language === "fr" ? "Retour à l'accueil" : "Back to home"}
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Main Content Area */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          {/* What's Included */}
          <motion.section
            className="mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
              <Zap className="w-8 h-8 text-primary" />
              {language === "fr" ? "Ce qui est inclus" : "What's included"}
            </h2>

            <div className="grid sm:grid-cols-2 gap-6">
              {designMandate.includes.map((item, idx) => (
                <Card key={idx} className="border-primary/10">
                  <CardContent className="p-6">
                    <div className="flex gap-4">
                      <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                      <div>
                        <p className="font-semibold">
                          {language === "fr" ? item.labelFr : item.labelEn}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.section>

          {/* What's Excluded */}
          <motion.section
            className="mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
              <Shield className="w-8 h-8 text-amber-600" />
              {language === "fr" ? "Ce qui n'est pas inclus" : "What's excluded"}
            </h2>

            <Card className="border-amber-200/30 bg-amber-50/50 dark:bg-amber-950/20">
              <CardContent className="p-6">
                <div className="grid sm:grid-cols-2 gap-6">
                  {designMandate.excludes.map((item, idx) => (
                    <div key={idx} className="flex gap-4">
                      <div className="w-2 h-2 rounded-full bg-amber-600 mt-2 flex-shrink-0" />
                      <p className="text-sm">
                        {language === "fr" ? item.labelFr : item.labelEn}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* Responsibilities Table */}
          <motion.section
            className="mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
              <Users className="w-8 h-8 text-primary" />
              {responsibilities.title}
            </h2>

            <div className="grid sm:grid-cols-2 gap-8">
              {/* kWh Provides */}
              <Card className="border-green-200/50 bg-green-50/30 dark:bg-green-950/20">
                <CardContent className="p-8">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-green-700 dark:text-green-400">
                    <Wrench className="w-5 h-5" />
                    {responsibilities.kwhHandles}
                  </h3>
                  <ul className="space-y-4">
                    {designMandate.includes.map((item, idx) => (
                      <li key={idx} className="flex gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">
                          {language === "fr" ? item.labelFr : item.labelEn}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Client Provides */}
              <Card className="border-blue-200/50 bg-blue-50/30 dark:bg-blue-950/20">
                <CardContent className="p-8">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-blue-700 dark:text-blue-400">
                    <Building2 className="w-5 h-5" />
                    {responsibilities.clientProvides}
                  </h3>
                  <ul className="space-y-4">
                    {BRAND_CONTENT.clientProvides.map((item, idx) => (
                      <li key={idx} className="flex gap-3">
                        <div className="w-5 h-5 rounded border-2 border-blue-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">
                          {language === "fr" ? item.labelFr : item.labelEn}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </motion.section>

          {/* Timeline Section */}
          <motion.section
            className="mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
              <FileText className="w-8 h-8 text-primary" />
              {language === "fr" ? "Calendrier et prochaines étapes" : "Timeline and next steps"}
            </h2>

            <div className="space-y-4">
              {[
                {
                  step: "1",
                  title: language === "fr" ? "Signature du mandat" : "Sign the mandate",
                  timeline: language === "fr" ? "Immédiat" : "Immediate",
                  desc: language === "fr" ? "Accord signé et paiement reçu" : "Agreement signed and payment received",
                },
                {
                  step: "2",
                  title: language === "fr" ? "Visite terrain" : "Site visit",
                  timeline: language === "fr" ? "1-2 semaines" : "1-2 weeks",
                  desc: language === "fr" ? "Inspection, mesures, photos, évaluation structurelle et électrique" : "Inspection, measurements, photos, structural and electrical assessment",
                },
                {
                  step: "3",
                  title: language === "fr" ? "Analyse et rapport" : "Analysis and report",
                  timeline: language === "fr" ? "1 semaine" : "1 week",
                  desc: language === "fr" ? "Compilation des données et rédaction du rapport final" : "Data compilation and final report writing",
                },
                {
                  step: "4",
                  title: language === "fr" ? "Livraison" : "Delivery",
                  timeline: language === "fr" ? "2-3 semaines total" : "2-3 weeks total",
                  desc: language === "fr" ? "Rapport complet avec recommandations et layout préliminaire" : "Complete report with recommendations and preliminary layout",
                },
              ].map((item, idx) => (
                <Card key={idx} className="border-primary/10">
                  <CardContent className="p-6">
                    <div className="flex gap-6">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-white font-bold text-lg flex-shrink-0">
                        {item.step}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-lg">{item.title}</h3>
                        <p className="text-sm text-primary font-semibold mb-1">{item.timeline}</p>
                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.section>

          {/* FAQ Section */}
          <motion.section
            className="mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
          >
            <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
              <HelpCircle className="w-8 h-8 text-primary" />
              {language === "fr" ? "Questions fréquentes" : "Frequently asked questions"}
            </h2>

            <Card>
              <CardContent className="p-6">
                <Accordion type="single" collapsible className="w-full">
                  {faqItems.map((item, idx) => (
                    <AccordionItem key={idx} value={`item-${idx}`} className="border-b last:border-0">
                      <AccordionTrigger className="text-left py-4">
                        <span className="font-semibold text-foreground">
                          {item.question}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground pb-4">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </motion.section>

          {/* Contact CTA */}
          <motion.section
            className="mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.9 }}
          >
            <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
              <CardContent className="p-8 sm:p-12">
                <div className="text-center">
                  <h2 className="text-3xl font-bold mb-4">
                    {language === "fr" ? "Des questions?" : "Questions?"}
                  </h2>
                  <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                    {language === "fr"
                      ? "Notre équipe est disponible pour discuter de votre projet et répondre à vos questions."
                      : "Our team is available to discuss your project and answer your questions."}
                  </p>

                  <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                    <a href={`mailto:${BRAND_CONTENT.contact.email}`} className="flex items-center justify-center gap-2">
                      <Button variant="outline" size="lg">
                        <Mail className="w-5 h-5" />
                        {BRAND_CONTENT.contact.email}
                      </Button>
                    </a>
                    <a href={`tel:${BRAND_CONTENT.contact.phone.replace(/\./g, '')}`} className="flex items-center justify-center gap-2">
                      <Button variant="outline" size="lg">
                        <Phone className="w-5 h-5" />
                        {BRAND_CONTENT.contact.phone}
                      </Button>
                    </a>
                  </div>

                  <Button size="lg" onClick={openCalendly} className="gap-2 text-base h-12">
                    <Calendar className="w-5 h-5" />
                    {language === "fr" ? "Réserver une consultation" : "Book a consultation"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.section>
        </div>

        {/* Footer Links */}
        <motion.footer
          className="text-center space-y-4 py-8 border-t max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1 }}
        >
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground flex-wrap">
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              {language === "fr" ? "Confidentialité" : "Privacy"}
            </Link>
            <span>•</span>
            <Link href="/conditions" className="hover:text-foreground transition-colors">
              {language === "fr" ? "Conditions" : "Terms"}
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            {language === "fr"
              ? "© 2026 kWh Québec. Tous droits réservés."
              : "© 2026 kWh Québec. All rights reserved."}
          </p>
        </motion.footer>
      </main>
    </div>
  );
}

// Utility icon component for calendar
function Calendar(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

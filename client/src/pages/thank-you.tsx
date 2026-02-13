import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight, Clock, Users, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";
import { FunnelEvents } from "@/lib/analytics";
import { BRAND_CONTENT } from "@shared/brandContent";
import logoFr from "@assets/kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png";
import logoEn from "@assets/kWh_Quebec_Logo-02_-_Rectangle_1764799021536.png";

export default function ThankYouPage() {
  const { t, language } = useI18n();
  const [location] = useLocation();

  // Parse query parameters
  const searchParams = new URLSearchParams(window.location.search);
  const type = searchParams.get("type") || "default";
  const name = searchParams.get("name") ? decodeURIComponent(searchParams.get("name")!) : "";

  const currentLogo = language === "fr" ? logoFr : logoEn;

  // Track GA4 event
  useEffect(() => {
    FunnelEvents.thankYouViewed(type);
  }, [type]);

  // Determine subtitle based on type
  const getSubtitle = () => {
    switch (type) {
      case "quick":
        return language === "fr"
          ? "Votre estimation rapide a été envoyée par courriel!"
          : "Your quick estimate has been sent by email!";
      case "detailed":
        return language === "fr"
          ? "Votre demande d'analyse détaillée a été reçue!"
          : "Your detailed analysis request has been received!";
      case "lead":
        return language === "fr"
          ? "Votre demande a été reçue avec succès!"
          : "Your request has been received successfully!";
      default:
        return language === "fr"
          ? "Merci pour votre intérêt!"
          : "Thank you for your interest!";
    }
  };

  const nextSteps = language === "fr"
    ? [
        {
          step: "1",
          title: "Nous analysons votre dossier",
          description: "Notre équipe examine votre profil énergétique",
        },
        {
          step: "2",
          title: "Rapport envoyé par courriel",
          description: "Délai: 48-72 heures",
        },
        {
          step: "3",
          title: "Un expert vous contacte",
          description: "Pour discuter des résultats et options",
        },
      ]
    : [
        {
          step: "1",
          title: "We're analyzing your file",
          description: "Our team reviews your energy profile",
        },
        {
          step: "2",
          title: "Report sent by email",
          description: "Timeline: 48-72 hours",
        },
        {
          step: "3",
          title: "An expert contacts you",
          description: "To discuss results and options",
        },
      ];

  const stats = [
    {
      value: BRAND_CONTENT.stats.yearsExperience.value,
      label: language === "fr"
        ? BRAND_CONTENT.stats.yearsExperience.labelFr
        : BRAND_CONTENT.stats.yearsExperience.labelEn,
    },
    {
      value: BRAND_CONTENT.stats.mwInstalled.value,
      label: language === "fr"
        ? BRAND_CONTENT.stats.mwInstalled.labelFr
        : BRAND_CONTENT.stats.mwInstalled.labelEn,
    },
    {
      value: BRAND_CONTENT.stats.projectsCI.value,
      label: language === "fr"
        ? BRAND_CONTENT.stats.projectsCI.labelFr
        : BRAND_CONTENT.stats.projectsCI.labelEn,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-background backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <Link href="/">
              <img
                src={currentLogo}
                alt="kWh Québec"
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Thank You Section */}
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              className="flex justify-center mb-8"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="relative">
                <div className="absolute inset-0 bg-green-200 dark:bg-green-900/30 blur-xl"></div>
                <CheckCircle2 className="w-24 h-24 text-green-600 relative" />
              </div>
            </motion.div>

            <motion.h1
              className="text-4xl sm:text-5xl font-bold tracking-tight mb-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              {language === "fr" ? "Merci" : "Thank you"}{name && `, ${name}`}!
            </motion.h1>

            <motion.p
              className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              {getSubtitle()}
            </motion.p>
          </motion.div>

          {/* Next Steps Card */}
          <motion.div
            className="mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Card className="border-primary/20 shadow-lg">
              <CardContent className="p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-8">
                  <Clock className="w-6 h-6 text-primary" />
                  <h2 className="text-2xl font-bold">
                    {language === "fr" ? "Prochaines étapes" : "Next Steps"}
                  </h2>
                </div>

                {/* Timeline */}
                <div className="space-y-6">
                  {nextSteps.map((item, index) => (
                    <motion.div
                      key={index}
                      className="flex gap-6"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: 0.6 + index * 0.1 }}
                    >
                      {/* Step Number */}
                      <div className="shrink-0">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-white font-bold text-lg">
                          {item.step}
                        </div>
                      </div>

                      {/* Step Content */}
                      <div className="flex-1 pt-2">
                        <h3 className="font-semibold text-lg mb-1">{item.title}</h3>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>

                      {/* Connector Line (except last) */}
                      {index < nextSteps.length - 1 && (
                        <div className="absolute left-[23px] top-[100px] w-1 h-8 bg-gradient-to-b from-primary to-primary/30 -ml-1" />
                      )}
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            className="grid sm:grid-cols-2 gap-4 mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.9 }}
          >
            <Link href="/">
              <Button size="lg" className="w-full gap-2" data-testid="button-back-home">
                <ArrowRight className="w-4 h-4" />
                {language === "fr" ? "Retour à l'accueil" : "Back to home"}
              </Button>
            </Link>

            <Link href="/#process">
              <Button variant="outline" size="lg" className="w-full gap-2" data-testid="button-learn-more">
                <FileText className="w-4 h-4" />
                {language === "fr"
                  ? "En savoir plus sur notre processus"
                  : "Learn more about our process"}
              </Button>
            </Link>
          </motion.div>

          {/* Social Proof Stats */}
          <motion.div
            className="mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1 }}
          >
            <div className="bg-muted/50 rounded-xl p-8 border border-border">
              <div className="text-center mb-8">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <Users className="w-6 h-6 text-primary" />
                  <h3 className="text-xl font-bold">
                    {language === "fr" ? "Ils nous font confiance" : "They trust us"}
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {language === "fr"
                    ? "Des entreprises québécoises de toutes tailles nous font confiance"
                    : "Quebec businesses of all sizes trust us"}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {stats.map((stat, index) => (
                  <motion.div
                    key={index}
                    className="text-center p-4"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 1.1 + index * 0.1 }}
                  >
                    <div className="text-3xl sm:text-4xl font-bold text-primary mb-2">
                      {stat.value}
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground">
                      {stat.label}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Footer Links */}
          <motion.footer
            className="text-center space-y-4 pt-8 border-t"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.3 }}
          >
            <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
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
        </div>
      </main>
    </div>
  );
}

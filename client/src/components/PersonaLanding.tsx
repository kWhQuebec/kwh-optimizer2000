import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import {
  ArrowRight, CheckCircle2, TrendingUp, DollarSign,
  Building2, Phone, Mail, ChevronDown, Zap, Target,
  BarChart3, Shield, HelpCircle, Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PublicHeader, PublicFooter } from "@/components/public-header";
import { useI18n } from "@/lib/i18n";
import { SEOHead } from "@/components/seo-head";
import { BRAND_CONTENT } from "@shared/brandContent";
import type { PersonaData } from "@shared/personaContent";

// Accent color map per persona
const PERSONA_COLORS: Record<string, { primary: string; bg: string; border: string; badge: string; text: string }> = {
  commercial: {
    primary: "text-green-600",
    bg: "bg-green-50 dark:bg-green-950/20",
    border: "border-green-200 dark:border-green-800",
    badge: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    text: "text-green-700 dark:text-green-400",
  },
  industrial: {
    primary: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/20",
    border: "border-blue-200 dark:border-blue-800",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    text: "text-blue-700 dark:text-blue-400",
  },
  portfolio: {
    primary: "text-violet-600",
    bg: "bg-violet-50 dark:bg-violet-950/20",
    border: "border-violet-200 dark:border-violet-800",
    badge: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
    text: "text-violet-700 dark:text-violet-400",
  },
};

function t(language: string, content: { fr: string; en: string }): string {
  return language === "fr" ? content.fr : content.en;
}

export default function PersonaLanding({ persona }: { persona: PersonaData }) {
  const { language } = useI18n();
  const [, navigate] = useLocation();
  const colors = PERSONA_COLORS[persona.id] || PERSONA_COLORS.commercial;

  const openCalendly = () => {
    const url = process.env.VITE_CALENDLY_URL || BRAND_CONTENT.calendly.fallbackUrl;
    window.open(url, "_blank");
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={t(language, persona.seo.title)}
        description={t(language, persona.seo.description)}
        keywords={t(language, persona.seo.keywords)}
        canonicalUrl={`https://kwh.quebec/${persona.slug}`}
      />
      <PublicHeader />

      <main className="pt-24 pb-16">
        {/* ============================================================ */}
        {/* HERO */}
        {/* ============================================================ */}
        <section className={`py-16 px-4 sm:px-6 lg:px-8 ${colors.bg}`}>
          <div className="max-w-5xl mx-auto">
            <motion.div
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Badge className={`mb-4 ${colors.badge}`}>
                {t(language, persona.heroBadge)}
              </Badge>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4 max-w-4xl mx-auto">
                {t(language, persona.heroTitle)}
              </h1>

              <p className="text-lg sm:text-xl text-muted-foreground mb-2 max-w-3xl mx-auto">
                {t(language, persona.heroSubtitle)}
              </p>

              <p className="text-base text-foreground/80 max-w-2xl mx-auto mb-8">
                {t(language, persona.heroDescription)}
              </p>

              {/* Hero stats */}
              <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mb-8">
                {[persona.heroStatPrimary, persona.heroStatSecondary, persona.heroStatTertiary].map((stat, i) => (
                  <motion.div
                    key={i}
                    className="bg-white dark:bg-slate-950 rounded-lg p-4 border shadow-sm"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 + i * 0.1 }}
                  >
                    <p className={`text-2xl sm:text-3xl font-bold ${colors.primary}`}>{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t(language, stat.label)}</p>
                  </motion.div>
                ))}
              </div>

              {/* CTA */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  size="lg"
                  className="gap-2 text-base h-12"
                  onClick={() => navigate("/#analyse")}
                >
                  <Zap className="w-5 h-5" />
                  {t(language, persona.ctaText)}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2 text-base h-12"
                  onClick={openCalendly}
                >
                  <Phone className="w-5 h-5" />
                  {t(language, persona.ctaSecondary)}
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-20">

          {/* ============================================================ */}
          {/* QUOTE BLOCK */}
          {/* ============================================================ */}
          <motion.section
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <blockquote className={`relative rounded-xl p-8 ${colors.bg} ${colors.border} border-l-4`}>
              <p className="text-lg sm:text-xl italic leading-relaxed">
                "{t(language, persona.marketingMessage)}"
              </p>
            </blockquote>
          </motion.section>

          {/* ============================================================ */}
          {/* WHY BEST — 3 arguments */}
          {/* ============================================================ */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-8 flex items-center gap-3">
              <Target className={`w-7 h-7 ${colors.primary}`} />
              {language === "fr" ? "Pourquoi ce profil est idéal pour le solaire" : "Why this profile is ideal for solar"}
            </h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {persona.whyBest.map((item, i) => (
                <Card key={i} className={`${colors.border} border`}>
                  <CardContent className="p-6 space-y-3">
                    <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center`}>
                      <Star className={`w-5 h-5 ${colors.primary}`} />
                    </div>
                    <h3 className="font-bold text-lg">{t(language, item.title)}</h3>
                    <p className="text-sm text-foreground/80 leading-relaxed">{t(language, item.description)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.section>

          {/* ============================================================ */}
          {/* SECTORS — self-identification */}
          {/* ============================================================ */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-6 flex items-center gap-3">
              <Building2 className={`w-7 h-7 ${colors.primary}`} />
              {language === "fr" ? "Êtes-vous ce profil?" : "Is this your profile?"}
            </h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {persona.sectors.map((sector, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-background border">
                  <CheckCircle2 className={`w-5 h-5 ${colors.primary} shrink-0`} />
                  <span className="text-sm font-medium">{t(language, sector)}</span>
                </div>
              ))}
            </div>

            {/* Identification signals */}
            <div className={`mt-6 rounded-xl p-6 ${colors.bg} ${colors.border} border`}>
              <h3 className="font-semibold mb-4 text-sm uppercase tracking-wide text-muted-foreground">
                {language === "fr" ? "Signaux d'identification" : "Identification signals"}
              </h3>
              <div className="space-y-2">
                {persona.signals.map((signal, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="text-lg">{signal.icon}</span>
                    <span>{t(language, signal.text)}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>

          {/* ============================================================ */}
          {/* FINANCIAL SCENARIO */}
          {/* ============================================================ */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-3">
              <BarChart3 className={`w-7 h-7 ${colors.primary}`} />
              {t(language, persona.scenario.title)}
            </h2>
            <p className="text-sm text-muted-foreground mb-8">{t(language, persona.scenario.subtitle)}</p>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* Left: params + CAPEX cascade */}
              <div className="space-y-6">
                {/* Params */}
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-semibold mb-4 text-sm uppercase tracking-wide text-muted-foreground">
                      {language === "fr" ? "Paramètres du projet" : "Project parameters"}
                    </h3>
                    <div className="space-y-2">
                      {persona.scenario.params.map((p, i) => (
                        <div key={i} className="flex justify-between text-sm py-1.5 border-b border-dashed last:border-0">
                          <span className="text-muted-foreground">{t(language, p.label)}</span>
                          <span className="font-semibold">{p.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* CAPEX cascade */}
                <Card className={`${colors.border} border-2`}>
                  <CardContent className="p-6">
                    <h3 className="font-semibold mb-4 text-sm uppercase tracking-wide text-muted-foreground">
                      {language === "fr" ? "Cascade CAPEX (incitatifs empilés)" : "CAPEX cascade (stacked incentives)"}
                    </h3>
                    <div className="space-y-2">
                      {persona.scenario.capexCascade.map((item, i) => {
                        const isNet = i === persona.scenario.capexCascade.length - 1;
                        return (
                          <div
                            key={i}
                            className={`flex justify-between text-sm py-2 ${isNet ? `mt-2 pt-3 border-t-2 ${colors.border}` : "border-b border-dashed"}`}
                          >
                            <span className={isNet ? "font-bold text-base" : item.isSubtract ? `${colors.text} font-medium` : ""}>
                              {t(language, item.label)}
                            </span>
                            <span className={isNet ? `font-bold text-lg ${colors.primary}` : item.isSubtract ? `${colors.text} font-semibold` : "font-semibold"}>
                              {item.amount}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right: metrics */}
              <div className="space-y-6">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-semibold mb-4 text-sm uppercase tracking-wide text-muted-foreground">
                      {language === "fr" ? "Résultats financiers" : "Financial results"}
                    </h3>
                    <div className="space-y-3">
                      {persona.scenario.metrics.map((m, i) => (
                        <div
                          key={i}
                          className={`flex justify-between items-center py-2 px-3 rounded-lg ${m.highlight ? `${colors.bg} ${colors.border} border` : "border-b border-dashed"}`}
                        >
                          <span className={`text-sm ${m.highlight ? "font-semibold" : "text-muted-foreground"}`}>
                            {t(language, m.label)}
                          </span>
                          <span className={`font-bold ${m.highlight ? `text-lg ${colors.primary}` : ""}`}>
                            {m.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {persona.scenario.footnote && (
                  <div className={`text-sm p-4 rounded-lg ${colors.bg} ${colors.border} border`}>
                    <p className="leading-relaxed">{t(language, persona.scenario.footnote)}</p>
                  </div>
                )}

                {/* Mid-section CTA */}
                <Button
                  size="lg"
                  className="w-full gap-2 h-12"
                  onClick={() => navigate("/#analyse")}
                >
                  <TrendingUp className="w-5 h-5" />
                  {language === "fr" ? "Calculer mon scénario personnalisé" : "Calculate my personalized scenario"}
                </Button>
              </div>
            </div>
          </motion.section>

          {/* ============================================================ */}
          {/* FAQ / OBJECTIONS */}
          {/* ============================================================ */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-8 flex items-center gap-3">
              <HelpCircle className={`w-7 h-7 ${colors.primary}`} />
              {language === "fr" ? "Questions fréquentes" : "Frequently asked questions"}
            </h2>
            <Card>
              <CardContent className="p-6">
                <Accordion type="single" collapsible className="w-full">
                  {persona.faq.map((item, i) => (
                    <AccordionItem key={i} value={`faq-${i}`} className="border-b last:border-0">
                      <AccordionTrigger className="text-left py-4">
                        <span className="font-semibold text-foreground">{t(language, item.question)}</span>
                      </AccordionTrigger>
                      <AccordionContent className="text-foreground/80 pb-4 leading-relaxed">
                        {t(language, item.answer)}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </motion.section>

          {/* ============================================================ */}
          {/* BOTTOM CTA */}
          {/* ============================================================ */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Card className={`${colors.bg} ${colors.border} border-2`}>
              <CardContent className="p-8 sm:p-12 text-center">
                <h2 className="text-2xl sm:text-3xl font-bold mb-4">
                  {language === "fr" ? "Prêt à voir votre scénario?" : "Ready to see your scenario?"}
                </h2>
                <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                  {language === "fr"
                    ? "Téléversez votre facture Hydro-Québec et obtenez une analyse personnalisée en 2 minutes. Gratuit, sans engagement."
                    : "Upload your Hydro-Québec bill and get a personalized analysis in 2 minutes. Free, no commitment."}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
                  <Button
                    size="lg"
                    className="gap-2 text-base h-12"
                    onClick={() => navigate("/#analyse")}
                  >
                    <Zap className="w-5 h-5" />
                    {t(language, persona.ctaText)}
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="gap-2 text-base h-12"
                    onClick={openCalendly}
                  >
                    <Phone className="w-5 h-5" />
                    {t(language, persona.ctaSecondary)}
                  </Button>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 justify-center text-sm">
                  <a href={`mailto:${BRAND_CONTENT.contact.email}`} className="flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground">
                    <Mail className="w-4 h-4" />
                    {BRAND_CONTENT.contact.email}
                  </a>
                  <a href={`tel:${BRAND_CONTENT.contact.phone.replace(/\./g, '')}`} className="flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground">
                    <Phone className="w-4 h-4" />
                    {BRAND_CONTENT.contact.phone}
                  </a>
                </div>
              </CardContent>
            </Card>
          </motion.section>

        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

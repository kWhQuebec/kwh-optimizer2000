import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import {
  ArrowRight, CheckCircle2, TrendingUp, DollarSign,
  Building2, Phone, Mail, ChevronDown, Zap, Target,
  BarChart3, Shield, HelpCircle, Star, Store, Factory, Building, Send, Loader2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

// Hero icon per persona
const PERSONA_ICONS: Record<string, React.ReactNode> = {
  commercial: <Store className="w-16 h-16" />,
  industrial: <Factory className="w-16 h-16" />,
  portfolio: <Building className="w-16 h-16" />,
};

const PERSONA_HERO_QUESTION: Record<string, { fr: string; en: string }> = {
  commercial: { fr: "Vous êtes un commerce sur Tarif G?", en: "Are you a business on Rate G?" },
  industrial: { fr: "Vous avez un entrepôt ou une usine?", en: "Do you own a warehouse or factory?" },
  portfolio: { fr: "Vous gérez 5+ bâtiments?", en: "Do you manage 5+ buildings?" },
};

export default function PersonaLanding({ persona, heroImage }: { persona: PersonaData; heroImage?: string }) {
  const { language } = useI18n();
  const [, navigate] = useLocation();
  const colors = PERSONA_COLORS[persona.id] || PERSONA_COLORS.commercial;

  // Lead form state
  const [formData, setFormData] = useState({ company: "", email: "", phone: "" });
  const [formStatus, setFormStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const openCalendly = () => {
    const url = process.env.VITE_CALENDLY_URL || BRAND_CONTENT.calendly.fallbackUrl;
    window.open(url, "_blank");
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.company || !formData.email) return;
    setFormStatus("submitting");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: formData.company,
          contactEmail: formData.email,
          contactPhone: formData.phone,
          source: `persona-${persona.slug}`,
          notes: `Lead from ${persona.slug} landing page`,
        }),
      });
      if (res.ok) {
        setFormStatus("success");
      } else {
        setFormStatus("error");
      }
    } catch {
      setFormStatus("error");
    }
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
        <section className={`relative py-16 px-4 sm:px-6 lg:px-8 ${heroImage ? '' : colors.bg}`}>
          {heroImage && (
            <>
              <div className="absolute inset-0">
                <img src={heroImage} alt="" className="w-full h-full object-cover" aria-hidden="true" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/70" />
            </>
          )}
          <div className={`max-w-5xl mx-auto ${heroImage ? 'relative z-10' : ''}`}>
            <motion.div
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Persona icon + self-identification */}
              <div className={`inline-flex items-center gap-3 mb-6 ${heroImage ? 'text-white' : colors.primary}`}>
                {PERSONA_ICONS[persona.id]}
              </div>
              <p className={`text-lg font-semibold mb-3 ${heroImage ? 'text-white/90' : colors.text}`}>
                {t(language, PERSONA_HERO_QUESTION[persona.id] || PERSONA_HERO_QUESTION.commercial)}
              </p>

              <Badge className={`mb-4 ${colors.badge}`}>
                {t(language, persona.heroBadge)}
              </Badge>

              <h1 className={`text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4 max-w-4xl mx-auto ${heroImage ? 'text-white' : ''}`}>
                {t(language, persona.heroTitle)}
              </h1>

              <p className={`text-lg sm:text-xl mb-2 max-w-3xl mx-auto ${heroImage ? 'text-white/80' : 'text-muted-foreground'}`}>
                {t(language, persona.heroSubtitle)}
              </p>

              <p className={`text-base max-w-2xl mx-auto mb-8 ${heroImage ? 'text-white/70' : 'text-foreground/80'}`}>
                {t(language, persona.heroDescription)}
              </p>

              {/* Hero stats */}
              <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mb-8">
                {[persona.heroStatPrimary, persona.heroStatSecondary, persona.heroStatTertiary].map((stat, i) => (
                  <motion.div
                    key={i}
                    className={`rounded-lg p-4 border shadow-sm ${heroImage ? 'bg-white/10 backdrop-blur-sm border-white/20' : 'bg-white dark:bg-slate-950'}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 + i * 0.1 }}
                  >
                    <p className={`text-2xl sm:text-3xl font-bold ${heroImage ? 'text-yellow-400' : colors.primary}`}>{stat.value}</p>
                    <p className={`text-xs mt-1 ${heroImage ? 'text-white/70' : 'text-muted-foreground'}`}>{t(language, stat.label)}</p>
                  </motion.div>
                ))}
              </div>

              {/* CTA */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  size="lg"
                  className="gap-2 text-base h-12"
                  onClick={() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })}
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
                {language === "fr" ? "Votre bâtiment ressemble à ça?" : "Does your building look like this?"}
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
                  onClick={() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })}
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
          {/* BOTTOM CTA — EMBEDDED LEAD FORM */}
          {/* ============================================================ */}
          <motion.section
            id="contact"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Card className={`${colors.bg} ${colors.border} border-2`}>
              <CardContent className="p-8 sm:p-12">
                <div className="text-center mb-8">
                  <h2 className="text-2xl sm:text-3xl font-bold mb-4">
                    {language === "fr" ? "Prêt à voir votre scénario?" : "Ready to see your scenario?"}
                  </h2>
                  <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    {language === "fr"
                      ? "Laissez vos coordonnées et recevez une analyse personnalisée en 24h. Gratuit, sans engagement."
                      : "Leave your contact info and receive a personalized analysis within 24h. Free, no commitment."}
                  </p>
                </div>

                {formStatus === "success" ? (
                  <motion.div
                    className="text-center py-8"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <CheckCircle2 className={`w-16 h-16 mx-auto mb-4 ${colors.primary}`} />
                    <h3 className="text-xl font-bold mb-2">
                      {language === "fr" ? "Merci! Votre demande est envoyée." : "Thank you! Your request has been sent."}
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      {language === "fr"
                        ? "Un spécialiste vous contactera dans les 24h avec votre analyse personnalisée."
                        : "A specialist will contact you within 24h with your personalized analysis."}
                    </p>
                    <Button variant="outline" className="gap-2" onClick={openCalendly}>
                      <Phone className="w-4 h-4" />
                      {language === "fr" ? "Ou réservez un appel maintenant" : "Or book a call now"}
                    </Button>
                  </motion.div>
                ) : (
                  <form onSubmit={handleFormSubmit} className="max-w-md mx-auto space-y-4">
                    <div>
                      <Label htmlFor="company" className="text-sm font-medium">
                        {language === "fr" ? "Nom de l'entreprise *" : "Company name *"}
                      </Label>
                      <Input
                        id="company"
                        type="text"
                        required
                        placeholder={language === "fr" ? "ex: Garage Tremblay inc." : "e.g. Tremblay Garage Inc."}
                        value={formData.company}
                        onChange={(e) => setFormData((p) => ({ ...p, company: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email" className="text-sm font-medium">
                        {language === "fr" ? "Courriel *" : "Email *"}
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        placeholder="vous@entreprise.com"
                        value={formData.email}
                        onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone" className="text-sm font-medium">
                        {language === "fr" ? "Téléphone" : "Phone"}
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="514-555-1234"
                        value={formData.phone}
                        onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                        className="mt-1"
                      />
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      className="w-full gap-2 h-12 text-base"
                      disabled={formStatus === "submitting"}
                    >
                      {formStatus === "submitting" ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                      {language === "fr" ? "Recevoir mon analyse gratuite" : "Get my free analysis"}
                    </Button>

                    {formStatus === "error" && (
                      <p className="text-sm text-red-600 text-center">
                        {language === "fr" ? "Erreur. Réessayez ou appelez-nous directement." : "Error. Please try again or call us directly."}
                      </p>
                    )}

                    <div className="text-center pt-4">
                      <p className="text-xs text-muted-foreground mb-3">
                        {language === "fr" ? "Ou contactez-nous directement :" : "Or contact us directly:"}
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3 justify-center text-sm">
                        <a href={`mailto:${BRAND_CONTENT.contact.email}`} className="flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground">
                          <Mail className="w-4 h-4" />
                          {BRAND_CONTENT.contact.email}
                        </a>
                        <a href={`tel:${BRAND_CONTENT.contact.phone.replace(/\./g, '')}`} className="flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground">
                          <Phone className="w-4 h-4" />
                          {BRAND_CONTENT.contact.phone}
                        </a>
                      </div>
                    </div>

                    <p className="text-center">
                      <button
                        type="button"
                        className={`text-sm underline ${colors.text} hover:opacity-80`}
                        onClick={() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })}
                      >
                        {language === "fr" ? "Téléverser ma facture HQ pour une analyse instantanée" : "Upload my HQ bill for instant analysis"}
                      </button>
                    </p>
                  </form>
                )}
              </CardContent>
            </Card>
          </motion.section>

        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

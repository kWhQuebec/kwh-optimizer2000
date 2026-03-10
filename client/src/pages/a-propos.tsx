import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  ArrowRight, Phone, Linkedin, Award, Sparkles,
  Heart, Shield, Star, Building2, Wrench, Users,
  Target, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PublicHeader, PublicFooter } from "@/components/public-header";
import { useI18n } from "@/lib/i18n";
import { SEOHead } from "@/components/seo-head";
import { BRAND_CONTENT } from "@shared/brandContent";

import heroImage from "@assets/dynamic-teamwork-solar-energy-diverse-technicians-installing-p_1764967501352.jpg";
import brandImage from "@assets/kWh__Quebec_Brand_Guideline_1764967501349.jpg";
import foundersImage from "@assets/Screenshot_2026-03-07_at_5.15.34_PM_1773105406548.png";

const TEAM_MEMBERS = [
  {
    nameFr: "Étienne Lecompte",
    nameEn: "Étienne Lecompte",
    roleFr: "Président",
    roleEn: "President",
    linkedin: "https://www.linkedin.com/in/elecompte/",
  },
  {
    nameFr: "Marc-André La Barre",
    nameEn: "Marc-André La Barre",
    roleFr: "Chef des opérations",
    roleEn: "Chief Operating Officer",
    linkedin: "https://www.linkedin.com/in/marcandrelabarre/",
  },
  {
    nameFr: "Mike Yan",
    nameEn: "Mike Yan",
    roleFr: "Chef des technologies",
    roleEn: "Chief Technology Officer",
    linkedin: "",
  },
  {
    nameFr: "Christine Bertrand",
    nameEn: "Christine Bertrand",
    roleFr: "Dir. des opérations",
    roleEn: "Director of Operations",
    linkedin: "",
  },
  {
    nameFr: "James Pagonis",
    nameEn: "James Pagonis",
    roleFr: "Dir. approvisionnements",
    roleEn: "Director of Procurement",
    linkedin: "https://www.linkedin.com/in/pagonisjames/",
  },
  {
    nameFr: "Patrick Langlois",
    nameEn: "Patrick Langlois",
    roleFr: "Dir. développement des affaires",
    roleEn: "Director of Business Development",
    linkedin: "",
  },
  {
    nameFr: "Oleg Popovski",
    nameEn: "Oleg Popovski",
    roleFr: "Dir. stockage",
    roleEn: "Director of Storage",
    linkedin: "https://www.linkedin.com/in/oleg-popovsky/",
  },
  {
    nameFr: "Natacha Mc Vie",
    nameEn: "Natacha Mc Vie",
    roleFr: "Dir. gestion de projets",
    roleEn: "Director of Project Management",
    linkedin: "https://www.linkedin.com/in/natacha-mc-vie-4a4ab4a6/",
  },
];

export default function AProposPage() {
  const { language } = useI18n();
  function t(fr: string, en: string): string;
  function t<T>(fr: T, en: T): T;
  function t(fr: unknown, en: unknown) { return language === "fr" ? fr : en; }

  const seoTitle = t(
    "À propos de kWh Québec | Énergie solaire commerciale",
    "About kWh Québec | Commercial Solar Energy"
  );
  const seoDescription = t(
    "Découvrez l'équipe derrière kWh Québec. Plus de 20 ans d'expérience combinée en énergie renouvelable et construction pour réduire les coûts énergétiques des bâtiments commerciaux et industriels au Québec.",
    "Meet the team behind kWh Québec. Over 20 years of combined experience in renewable energy and construction to reduce energy costs for commercial and industrial buildings in Quebec."
  );
  const seoKeywords = t(
    "kWh Québec, à propos, équipe solaire québec, énergie renouvelable québec, EPC solaire, installation solaire commerciale",
    "kWh Québec, about us, solar team quebec, renewable energy quebec, solar EPC, commercial solar installation"
  );

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "kWh Québec inc.",
    "url": "https://www.kwh.quebec",
    "telephone": "+1-514-427-8871",
    "email": "info@kwh.quebec",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Montréal",
      "addressRegion": "QC",
      "addressCountry": "CA",
    },
    "description": seoDescription,
    "foundingDate": "2024",
    "numberOfEmployees": {
      "@type": "QuantitativeValue",
      "value": 8,
    },
    "sameAs": [
      "https://www.linkedin.com/company/kwhquebec",
      "https://www.facebook.com/profile.php?id=61580851595122",
      "https://www.instagram.com/kwhquebec/",
    ],
  };

  const values = [
    {
      icon: Sparkles,
      titleFr: "Simplicité",
      titleEn: "Simplicity",
      descFr: "Solution clé en main — on s'occupe de tout !",
      descEn: "Turnkey solution — we handle everything!",
    },
    {
      icon: Shield,
      titleFr: "Fiabilité",
      titleEn: "Reliability",
      descFr: "Performance garantie. On respecte nos engagements, toujours !",
      descEn: "Guaranteed performance. We keep our commitments, always!",
    },
    {
      icon: Heart,
      titleFr: "Pérennité",
      titleEn: "Sustainability",
      descFr: "On bâtit des relations et des solutions pour le long terme.",
      descEn: "We build relationships and solutions for the long term.",
    },
    {
      icon: Star,
      titleFr: "Fierté",
      titleEn: "Pride",
      descFr: "On est fier des projets que nous réalisons et de l'impact qu'ils ont sur nos clients et sur l'environnement.",
      descEn: "We're proud of the projects we deliver and the impact they have on our clients and the environment.",
    },
  ];

  const certifications = [
    {
      icon: Award,
      titleFr: "Licence RBQ",
      titleEn: "RBQ License",
      descFr: "5656-6136-01",
      descEn: "5656-6136-01",
    },
    {
      icon: Award,
      titleFr: "NABCEP",
      titleEn: "NABCEP",
      descFr: "Certification professionnelle en énergie solaire",
      descEn: "Professional solar energy certification",
    },
    {
      icon: Building2,
      titleFr: "Hydro-Québec",
      titleEn: "Hydro-Québec",
      descFr: "Formation continue et programme Solutions efficaces",
      descEn: "Continuing education and Solutions efficaces program",
    },
  ];

  const partners = [
    {
      titleFr: "SoluSolaire",
      titleEn: "SoluSolaire",
      descFr: "Installateur partenaire certifié",
      descEn: "Certified partner installer",
      url: "https://solusolaire.ca/",
    },
  ];

  const programs = [
    {
      titleFr: "Renoclimat",
      titleEn: "Renoclimat",
    },
    {
      titleFr: "Écopack Industriel — Expert Conseil",
      titleEn: "Écopack Industriel — Expert Conseil",
    },
    {
      titleFr: "Hydro-Québec — Programme d'aide à l'efficacité énergétique",
      titleEn: "Hydro-Québec — Energy Efficiency Assistance Program",
    },
  ];

  function getInitials(name: string): string {
    return name
      .split(" ")
      .filter(w => w.length > 1 || w === w.toUpperCase())
      .map(w => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  return (
    <div className="public-page min-h-screen bg-background">
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        keywords={seoKeywords}
        ogImage={heroImage}
        structuredData={structuredData}
        locale={language}
        canonical="https://www.kwh.quebec/a-propos"
      />

      <PublicHeader />
      <main>

      <section
        className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 overflow-hidden"
        data-testid="section-hero-about"
      >
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt={t("Équipe kWh Québec sur un chantier solaire", "kWh Québec team on a solar job site")}
            className="w-full h-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />
        </div>
        <div className="relative max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge className="mb-4" data-testid="badge-about">
              {t("À propos", "About Us")}
            </Badge>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 text-white" data-testid="text-hero-title-about">
              {t(
                "Réduire massivement les coûts d'énergie des bâtiments C&I au Québec",
                "Massively Reducing Energy Costs for C&I Buildings in Quebec"
              )}
            </h1>
            <p className="text-xl text-white/90 max-w-3xl mx-auto mb-8" data-testid="text-hero-subtitle-about">
              {t(
                "Nous accompagnons les entreprises du monde entier dans leurs projets d'énergie renouvelable depuis 2011. En tant que Québécois, nous sommes fiers de rendre l'énergie solaire rentable ici aussi.",
                "We've been helping businesses worldwide with renewable energy projects since 2011. As Quebecers, we're proud to make solar energy profitable here too."
              )}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/#analyse">
                <Button size="lg" className="gap-2" data-testid="button-get-analysis-about">
                  {t("Voir mon potentiel solaire — Gratuit", "See my solar potential — Free")}
                  <ArrowRight aria-hidden="true" className="w-4 h-4" />
                </Button>
              </Link>
              <a href={`tel:${BRAND_CONTENT.contact.phone.replace(/\./g, "-")}`}>
                <Button size="lg" variant="outline" className="gap-2 bg-white/10 backdrop-blur-sm border-white/30 text-white" data-testid="button-call-about">
                  <Phone aria-hidden="true" className="w-4 h-4" />
                  {BRAND_CONTENT.contact.phone}
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-20 md:py-24 px-4 sm:px-6 lg:px-8" data-testid="section-mission">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Target aria-hidden="true" className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold" data-testid="text-mission-title">
                  {t("Notre mission", "Our Mission")}
                </h2>
              </div>
              <p className="text-lg text-muted-foreground mb-6" data-testid="text-mission-desc">
                {t(
                  "Réduire massivement les coûts d'énergie et l'empreinte carbone des bâtiments commerciaux et industriels au Québec.",
                  "Massively reduce energy costs and the carbon footprint of commercial and industrial buildings in Quebec."
                )}
              </p>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Eye aria-hidden="true" className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold" data-testid="text-vision-title">
                  {t("Notre vision", "Our Vision")}
                </h2>
              </div>
              <p className="text-lg text-muted-foreground" data-testid="text-vision-desc">
                {t(
                  "Tous les immeubles du Québec devraient pouvoir profiter de l'énergie que nous offre gratuitement le soleil. Non seulement c'est important pour l'environnement, mais en plus c'est rentable !",
                  "Every building in Quebec should be able to benefit from the energy the sun gives us for free. Not only is it important for the environment, but it's profitable too!"
                )}
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex justify-center"
            >
              <img
                src={brandImage}
                alt={t("Identité de marque kWh Québec", "kWh Québec brand identity")}
                className="rounded-md max-w-full h-auto shadow-sm"
                loading="lazy"
                data-testid="img-brand"
              />
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-20 md:py-24 px-4 sm:px-6 lg:px-8 bg-muted/30" data-testid="section-story">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-4" data-testid="text-story-title">
              {t("Notre histoire", "Our Story")}
            </h2>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="space-y-6 text-muted-foreground"
          >
            <p data-testid="text-story-p1">
              {t(
                "kWh Québec, c'est la rencontre de deux amis de longue date, Étienne et Marc-André, qui ont décidé de joindre leurs efforts et leur expérience respective afin de concrétiser leur vision : réduire massivement les coûts d'énergie et l'empreinte carbone des bâtiments commerciaux et industriels au Québec.",
                "kWh Québec is the story of two longtime friends, Étienne and Marc-André, who decided to combine their efforts and respective expertise to realize their vision: massively reducing energy costs and the carbon footprint of commercial and industrial buildings in Quebec."
              )}
            </p>
            <p>
              {t(
                "Chacun apporte plus de 20 ans d'expérience dans son champ d'expertise, en plus de ses équipes expérimentées.",
                "Each brings over 20 years of experience in their field of expertise, along with their experienced teams."
              )}
            </p>
            <div className="flex justify-center pt-4 pb-2">
              <img
                src={foundersImage}
                alt={t("Étienne Lecompte et Marc-André La Barre, co-fondateurs de kWh Québec", "Étienne Lecompte and Marc-André La Barre, co-founders of kWh Québec")}
                className="rounded-md w-full max-w-2xl object-cover"
                data-testid="img-founders"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-6 pt-4">
              <Card>
                <CardContent className="p-6">
                  <p className="font-semibold text-foreground mb-2" data-testid="text-etienne-name">Étienne Lecompte</p>
                  <p className="text-sm" data-testid="text-etienne-bio">
                    {t(
                      "Entrepreneur visionnaire dans l'industrie des technologies propres. Son parcours l'a mené à fonder et développer trois entreprises innovantes. Animé par un engagement fort en faveur du développement durable et de l'innovation technologique, Étienne s'est imposé comme une figure de proue en faisant progresser des solutions logicielles à la pointe qui allient conformité et performance.",
                      "Visionary entrepreneur in the cleantech industry. His journey led him to found and develop three innovative companies. Driven by a strong commitment to sustainable development and technological innovation, Étienne has established himself as a leading figure by advancing cutting-edge software solutions that combine compliance and performance."
                    )}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="font-semibold text-foreground mb-2" data-testid="text-marcandre-name">Marc-André La Barre</p>
                  <p className="text-sm" data-testid="text-marcandre-bio">
                    {t(
                      "Entrepreneur depuis près de 25 ans, dont maintenant plus de 16 ans comme entrepreneur général en construction. Fondateur de Lab.Space Construction, spécialisée dans la conception et la construction de projets techniques, tels que des laboratoires biotech, des cliniques médicales et des bureaux.",
                      "Entrepreneur for nearly 25 years, including over 16 years as a general construction contractor. Founder of Lab.Space Construction, specializing in the design and construction of technical projects such as biotech laboratories, medical clinics, and offices."
                    )}
                  </p>
                </CardContent>
              </Card>
            </div>
            <p className="text-center pt-2">
              {t(
                "C'est ainsi qu'en combinant énergie renouvelable et gestion de projets techniques, ils ont co-fondé kWh Québec afin d'offrir des solutions simples, clé en main, pour les propriétaires immobiliers commerciaux et industriels du Québec.",
                "By combining renewable energy and technical project management, they co-founded kWh Québec to offer simple, turnkey solutions for commercial and industrial property owners in Quebec."
              )}
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-20 md:py-24 px-4 sm:px-6 lg:px-8" data-testid="section-team">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-6"
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Users aria-hidden="true" className="w-6 h-6 text-primary" />
              </div>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-4" data-testid="text-team-title">
              {t("Notre équipe", "Our Team")}
            </h2>
            <p className="text-muted-foreground max-w-3xl mx-auto" data-testid="text-team-philosophy">
              {t(
                "Notre philosophie est simple : le succès repose sur des projets solides et des personnes exceptionnelles. Nous sommes convaincus que les grands talents ne sont pas seulement compétents — ce sont ceux qui apportent une vraie richesse d'expérience et d'expertise.",
                "Our philosophy is simple: success rests on solid projects and exceptional people. We believe that great talent isn't just about competence — it's about the wealth of experience and expertise they bring."
              )}
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12">
            {TEAM_MEMBERS.map((member, i) => (
              <motion.div
                key={member.nameFr}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              >
                <Card className="text-center" data-testid={`card-team-member-${i}`}>
                  <CardContent className="p-6">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <span className="text-xl font-bold text-primary" data-testid={`text-initials-${i}`}>
                        {getInitials(language === "fr" ? member.nameFr : member.nameEn)}
                      </span>
                    </div>
                    <p className="font-semibold text-foreground text-sm" data-testid={`text-member-name-${i}`}>
                      {language === "fr" ? member.nameFr : member.nameEn}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1" data-testid={`text-member-role-${i}`}>
                      {language === "fr" ? member.roleFr : member.roleEn}
                    </p>
                    {member.linkedin && (
                      <a
                        href={member.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary mt-3 hover:underline"
                        aria-label={`${t("Profil LinkedIn de", "LinkedIn profile of")} ${member.nameFr}`}
                        data-testid={`link-linkedin-${i}`}
                      >
                        <Linkedin aria-hidden="true" className="w-3.5 h-3.5" />
                        LinkedIn
                      </a>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 md:py-24 px-4 sm:px-6 lg:px-8 bg-muted/30" data-testid="section-values">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-4" data-testid="text-values-title">
              {t("Nos valeurs", "Our Values")}
            </h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, i) => (
              <motion.div
                key={value.titleFr}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <Card className="h-full" data-testid={`card-value-${i}`}>
                  <CardContent className="p-6 text-center">
                    <div className="p-3 rounded-xl bg-primary/10 inline-flex mb-4">
                      <value.icon aria-hidden="true" className="w-6 h-6 text-primary" />
                    </div>
                    <p className="font-semibold text-foreground mb-2">
                      {language === "fr" ? value.titleFr : value.titleEn}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {language === "fr" ? value.descFr : value.descEn}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 md:py-24 px-4 sm:px-6 lg:px-8" data-testid="section-certifications">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-4" data-testid="text-certifications-title">
              {t("Certifications et partenariats", "Certifications & Partnerships")}
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Wrench aria-hidden="true" className="w-5 h-5 text-primary" />
                {t("Certifications techniques", "Technical Certifications")}
              </h3>
              <div className="space-y-4">
                {certifications.map((cert, i) => (
                  <Card key={i}>
                    <CardContent className="p-4 flex items-start gap-3">
                      <div className="p-2 rounded-md bg-primary/10 shrink-0">
                        <cert.icon aria-hidden="true" className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-foreground">
                          {language === "fr" ? cert.titleFr : cert.titleEn}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {language === "fr" ? cert.descFr : cert.descEn}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Users aria-hidden="true" className="w-5 h-5 text-primary" />
                {t("Installateurs partenaires", "Partner Installers")}
              </h3>
              <div className="space-y-4">
                {partners.map((partner, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <a
                        href={partner.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-sm text-primary hover:underline"
                        data-testid={`link-partner-${i}`}
                      >
                        {language === "fr" ? partner.titleFr : partner.titleEn}
                      </a>
                      <p className="text-xs text-muted-foreground mt-1">
                        {language === "fr" ? partner.descFr : partner.descEn}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Building2 aria-hidden="true" className="w-5 h-5 text-primary" />
                {t("Programmes d'aide", "Assistance Programs")}
              </h3>
              <div className="space-y-4">
                {programs.map((prog, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <p className="font-medium text-sm text-foreground">
                        {language === "fr" ? prog.titleFr : prog.titleEn}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 md:py-24 px-4 sm:px-6 lg:px-8 bg-muted/30" data-testid="section-cta-about">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-2xl sm:text-3xl font-bold mb-4" data-testid="text-cta-title">
              {t(
                "Faites un investissement rentable et modernisez votre immeuble",
                "Make a profitable investment and modernize your building"
              )}
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              {t(
                "Grâce à l'énergie solaire et au stockage, réduisez vos coûts tout en contribuant à la transition énergétique du Québec.",
                "With solar energy and storage, reduce your costs while contributing to Quebec's energy transition."
              )}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/#analyse">
                <Button size="lg" className="gap-2" data-testid="button-cta-analysis">
                  {t("Voir mon potentiel solaire — Gratuit", "See my solar potential — Free")}
                  <ArrowRight aria-hidden="true" className="w-4 h-4" />
                </Button>
              </Link>
              <a href={`tel:${BRAND_CONTENT.contact.phone.replace(/\./g, "-")}`}>
                <Button size="lg" variant="outline" className="gap-2" data-testid="button-cta-call">
                  <Phone aria-hidden="true" className="w-4 h-4" />
                  {BRAND_CONTENT.contact.phone}
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      </main>
      <PublicFooter />
    </div>
  );
}

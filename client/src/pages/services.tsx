import { motion } from "framer-motion";
import { Link } from "wouter";
import { 
  Sun, Battery, Wrench, HardHat, FileBarChart, Shield, 
  CheckCircle2, ArrowRight, Building2, Factory, School,
  Zap, Clock, DollarSign, Award, Phone, Mail
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";
import { SEOHead, seoContent, getServiceSchema } from "@/components/seo-head";
import logoFr from "@assets/kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png";
import logoEn from "@assets/kWh_Quebec_Logo-02_-_Rectangle_1764799021536.png";

export default function ServicesPage() {
  const { language } = useI18n();
  const currentLogo = language === "fr" ? logoFr : logoEn;

  const services = [
    {
      icon: FileBarChart,
      title: language === "fr" ? "Analyse & Design" : "Analysis & Design",
      description: language === "fr" 
        ? "Simulation 8 760 heures de votre système optimal basée sur vos données de consommation réelles Hydro-Québec."
        : "8,760-hour simulation of your optimal system based on your real Hydro-Québec consumption data.",
      features: language === "fr" 
        ? ["Profil de consommation détaillé", "Optimisation PV + stockage", "Projections financières 25 ans", "Analyse de sensibilité"]
        : ["Detailed consumption profile", "PV + storage optimization", "25-year financial projections", "Sensitivity analysis"]
    },
    {
      icon: Wrench,
      title: language === "fr" ? "Ingénierie" : "Engineering",
      description: language === "fr"
        ? "Conception technique complète par nos ingénieurs certifiés selon les normes québécoises."
        : "Complete technical design by our certified engineers according to Quebec standards.",
      features: language === "fr"
        ? ["Plans électriques et structuraux", "Études de connexion réseau", "Permis et approbations", "Coordination Hydro-Québec"]
        : ["Electrical and structural plans", "Grid connection studies", "Permits and approvals", "Hydro-Québec coordination"]
    },
    {
      icon: HardHat,
      title: language === "fr" ? "Construction" : "Construction",
      description: language === "fr"
        ? "Installation clé en main par notre équipe d'installateurs certifiés et assurés."
        : "Turnkey installation by our certified and insured installation team.",
      features: language === "fr"
        ? ["Gestion de projet complète", "Installation professionnelle", "Tests et mise en service", "Documentation as-built"]
        : ["Complete project management", "Professional installation", "Testing and commissioning", "As-built documentation"]
    },
    {
      icon: Shield,
      title: language === "fr" ? "Opération & Maintenance" : "Operation & Maintenance",
      description: language === "fr"
        ? "Suivi de performance et maintenance préventive pour maximiser votre retour sur investissement."
        : "Performance monitoring and preventive maintenance to maximize your ROI.",
      features: language === "fr"
        ? ["Monitoring en temps réel", "Rapports de performance", "Maintenance préventive", "Support technique 24/7"]
        : ["Real-time monitoring", "Performance reports", "Preventive maintenance", "24/7 technical support"]
    }
  ];

  const sectors = [
    { icon: Building2, name: language === "fr" ? "Commercial" : "Commercial", examples: language === "fr" ? "Bureaux, centres d'achat, hôtels" : "Offices, shopping centers, hotels" },
    { icon: Factory, name: language === "fr" ? "Industriel" : "Industrial", examples: language === "fr" ? "Usines, entrepôts, centres de distribution" : "Factories, warehouses, distribution centers" },
    { icon: School, name: language === "fr" ? "Institutionnel" : "Institutional", examples: language === "fr" ? "Écoles, hôpitaux, bâtiments gouvernementaux" : "Schools, hospitals, government buildings" },
  ];

  const seo = language === "fr" ? seoContent.services.fr : seoContent.services.en;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead 
        title={seo.title} 
        description={seo.description} 
        keywords={seo.keywords}
        structuredData={getServiceSchema(language)}
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
              <Link href="/services" className="text-sm font-medium text-foreground">
                {language === "fr" ? "Services" : "Services"}
              </Link>
              <Link href="/comment-ca-marche" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
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
            <Badge className="mb-4">EPC</Badge>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              {language === "fr" ? "Services clé en main" : "Turnkey Services"}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              {language === "fr" 
                ? "De l'analyse initiale à la mise en service, nous gérons l'ensemble de votre projet solaire + stockage."
                : "From initial analysis to commissioning, we manage your entire solar + storage project."}
            </p>
            <Link href="/#paths">
              <Button size="lg" className="gap-2" data-testid="button-get-analysis">
                {language === "fr" ? "Obtenir mon analyse gratuite" : "Get my free analysis"}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            {services.map((service, index) => (
              <motion.div
                key={service.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-primary/10 shrink-0">
                        <service.icon className="w-6 h-6 text-primary" />
                      </div>
                      <div className="space-y-3">
                        <h3 className="text-xl font-bold">{service.title}</h3>
                        <p className="text-muted-foreground">{service.description}</p>
                        <ul className="space-y-2">
                          {service.features.map((feature) => (
                            <li key={feature} className="flex items-center gap-2 text-sm">
                              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                              {feature}
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

      {/* Sectors */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              {language === "fr" ? "Secteurs desservis" : "Sectors Served"}
            </h2>
            <p className="text-muted-foreground">
              {language === "fr" 
                ? "Nous accompagnons les entreprises de toutes tailles au Québec"
                : "We support businesses of all sizes across Quebec"}
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {sectors.map((sector) => (
              <Card key={sector.name} className="text-center">
                <CardContent className="p-6">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <sector.icon className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">{sector.name}</h3>
                  <p className="text-sm text-muted-foreground">{sector.examples}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              {language === "fr" ? "Pourquoi kWh Québec?" : "Why kWh Québec?"}
            </h2>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Award, title: language === "fr" ? "Expertise locale" : "Local expertise", desc: language === "fr" ? "Spécialistes du marché québécois" : "Quebec market specialists" },
              { icon: Shield, title: language === "fr" ? "Partenaire HQ" : "HQ Partner", desc: language === "fr" ? "Accès aux programmes d'incitatifs" : "Access to incentive programs" },
              { icon: Zap, title: language === "fr" ? "Analyse avancée" : "Advanced analysis", desc: language === "fr" ? "Simulation 8 760h précise" : "Precise 8,760h simulation" },
              { icon: Clock, title: language === "fr" ? "Clé en main" : "Turnkey", desc: language === "fr" ? "Un seul interlocuteur" : "Single point of contact" },
            ].map((item) => (
              <div key={item.title} className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <item.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            {language === "fr" ? "Prêt à démarrer votre projet?" : "Ready to start your project?"}
          </h2>
          <p className="text-lg opacity-90 mb-8">
            {language === "fr" 
              ? "Obtenez une analyse gratuite de votre potentiel solaire en quelques minutes."
              : "Get a free analysis of your solar potential in minutes."}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/#paths">
              <Button size="lg" variant="secondary" className="gap-2" data-testid="button-cta-analysis">
                {language === "fr" ? "Commencer mon analyse" : "Start my analysis"}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <a href="mailto:info@kwhquebec.com">
              <Button size="lg" variant="outline" className="gap-2 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                <Mail className="w-4 h-4" />
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

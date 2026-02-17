import { Link } from "wouter";
import { ArrowLeft, FileText, Shield, Lock, AlertCircle, Gavel, Mail, Phone, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import logoFr from "@assets/kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png";
import logoEn from "@assets/kWh_Quebec_Logo-02_-_Rectangle_1764799021536.png";

export default function TermsPage() {
  const { language } = useI18n();
  const currentLogo = language === "fr" ? logoFr : logoEn;

  const content = {
    fr: {
      title: "Conditions d'utilisation",
      lastUpdated: "Dernière mise à jour: Janvier 2026",
      intro: "Ces conditions d'utilisation régissent l'accès et l'utilisation du site web et des services offerts par kWh Québec inc.",
      sections: [
        {
          icon: FileText,
          title: "Acceptation des conditions",
          content: [
            "En accédant et en utilisant ce site, vous acceptez d'être lié par les présentes conditions d'utilisation.",
            "Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser ce site.",
            "kWh Québec inc. se réserve le droit de modifier ces conditions à tout moment. Les modifications entrent en vigueur dès leur publication.",
            "Votre utilisation continue du site constitue votre acceptation des conditions modifiées.",
          ]
        },
        {
          icon: Shield,
          title: "Description des services",
          content: [
            "kWh Québec inc. offre des analyses d'énergie solaire personnalisées basées sur vos données de consommation énergétique.",
            "Les analyses sont fournies à titre informatif et ne constituent pas une garantie de rendement ou de productivité.",
            "Les résultats dépendent de nombreux facteurs incluant les conditions météorologiques, l'orientation du toit et d'autres variables.",
            "Nous ne garantissons pas l'exactitude complète des données d'entrée ni des résultats des simulations.",
          ]
        },
        {
          icon: Lock,
          title: "Propriété intellectuelle",
          content: [
            "Tout le contenu du site, y compris les textes, graphiques, logos et images, est la propriété de kWh Québec inc.",
            "Vous ne pouvez pas reproduire, distribuer ou transmettre ce contenu sans permission écrite préalable.",
            "L'utilisation non autorisée du contenu peut entraîner des poursuites légales.",
            "Les données et analyses que vous recevez sont pour votre usage personnel uniquement.",
          ]
        },
        {
          icon: AlertCircle,
          title: "Limitation de responsabilité",
          content: [
            "kWh Québec inc. ne sera pas responsable des dommages directs, indirects ou consécutifs découlant de l'utilisation du site.",
            "Le site est fourni « tel quel » sans garanties d'aucune sorte, expresses ou implicites.",
            "kWh Québec inc. n'est pas responsable des pertes de données, interruptions de service ou erreurs.",
            "Votre responsabilité se limite au montant payé pour les services, s'il y a lieu.",
          ]
        },
        {
          icon: Shield,
          title: "Confidentialité et protection des données",
          content: [
            "Veuillez vous référer à notre Politique de confidentialité pour plus de détails sur la collecte et l'utilisation de vos données.",
            "En fournissant vos informations personnelles, vous consentez au traitement décrit dans la Politique de confidentialité.",
            "Vos données sont protégées conformément à la Loi 25 sur la protection des renseignements personnels.",
          ]
        },
        {
          icon: FileText,
          title: "Modifications du service",
          content: [
            "kWh Québec inc. se réserve le droit de modifier, suspendre ou cesser les services à tout moment.",
            "Nous nous efforcerons de vous informer des changements importants, mais ne garantissons pas un préavis.",
            "Votre utilisation continue du site après des modifications constitue votre acceptation de ces changements.",
          ]
        },
        {
          icon: Gavel,
          title: "Droit applicable et juridiction",
          content: [
            "Ces conditions sont régies par les lois de la province de Québec, Canada.",
            "Tous les litiges découlant de ces conditions seront soumis aux tribunaux compétents du Québec.",
            "Vous acceptez la juridiction exclusive des tribunaux québécois.",
            "Les dispositions qui peuvent être inapplicables seront supprimées, les autres restant en vigueur.",
          ]
        },
      ],
      contact: {
        title: "Nous contacter",
        intro: "Pour toute question concernant ces conditions d'utilisation:",
        company: "kWh Québec inc.",
      },
      backToHome: "Retour à l'accueil",
    },
    en: {
      title: "Terms of Service",
      lastUpdated: "Last updated: January 2026",
      intro: "These terms of service govern your access to and use of the website and services offered by kWh Québec inc.",
      sections: [
        {
          icon: FileText,
          title: "Acceptance of Terms",
          content: [
            "By accessing and using this website, you agree to be bound by these terms of service.",
            "If you do not agree to these terms, please do not use this website.",
            "kWh Québec inc. reserves the right to modify these terms at any time. Modifications take effect upon publication.",
            "Your continued use of the website constitutes your acceptance of the modified terms.",
          ]
        },
        {
          icon: Shield,
          title: "Description of Services",
          content: [
            "kWh Québec inc. offers personalized solar energy analyses based on your energy consumption data.",
            "Analyses are provided for informational purposes and do not constitute a guarantee of performance or productivity.",
            "Results depend on many factors including weather conditions, roof orientation and other variables.",
            "We do not guarantee the complete accuracy of input data or simulation results.",
          ]
        },
        {
          icon: Lock,
          title: "Intellectual Property",
          content: [
            "All website content, including text, graphics, logos and images, is the property of kWh Québec inc.",
            "You may not reproduce, distribute or transmit this content without prior written permission.",
            "Unauthorized use of content may result in legal action.",
            "Data and analyses you receive are for your personal use only.",
          ]
        },
        {
          icon: AlertCircle,
          title: "Limitation of Liability",
          content: [
            "kWh Québec inc. is not responsible for direct, indirect or consequential damages arising from website use.",
            "The website is provided 'as is' without any warranties, express or implied.",
            "kWh Québec inc. is not responsible for data loss, service interruptions or errors.",
            "Your liability is limited to the amount paid for services, if any.",
          ]
        },
        {
          icon: Shield,
          title: "Privacy and Data Protection",
          content: [
            "Please refer to our Privacy Policy for details on the collection and use of your data.",
            "By providing your personal information, you consent to the processing described in the Privacy Policy.",
            "Your data is protected in accordance with Quebec's Law 25 on the protection of personal information.",
          ]
        },
        {
          icon: FileText,
          title: "Service Modifications",
          content: [
            "kWh Québec inc. reserves the right to modify, suspend or discontinue services at any time.",
            "We will endeavor to inform you of significant changes, but do not guarantee notice.",
            "Your continued use of the website after modifications constitutes your acceptance of such changes.",
          ]
        },
        {
          icon: Gavel,
          title: "Applicable Law and Jurisdiction",
          content: [
            "These terms are governed by the laws of the Province of Quebec, Canada.",
            "Any disputes arising from these terms shall be submitted to the competent courts of Quebec.",
            "You accept the exclusive jurisdiction of Quebec courts.",
            "Provisions that may be unenforceable will be severed, with all other provisions remaining in force.",
          ]
        },
      ],
      contact: {
        title: "Contact Us",
        intro: "For any questions about these terms of service:",
        company: "kWh Québec inc.",
      },
      backToHome: "Back to Home",
    }
  };

  const t = content[language];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link href="/">
            <img src={currentLogo} alt={language === "fr" ? "Logo kWh Québec – Énergie solaire commerciale" : "kWh Québec Logo – Commercial Solar Energy"} className="h-10 w-auto cursor-pointer" />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Link href="/">
          <Button variant="ghost" className="gap-2 mb-6" data-testid="button-back-home">
            <ArrowLeft className="w-4 h-4" />
            {t.backToHome}
          </Button>
        </Link>

        <div className="space-y-8">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
              <FileText className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold" data-testid="text-terms-title">{t.title}</h1>
            <p className="text-sm text-muted-foreground">{t.lastUpdated}</p>
            <p className="text-muted-foreground max-w-2xl mx-auto">{t.intro}</p>
          </div>

          <div className="grid gap-6">
            {t.sections.map((section, index) => {
              const Icon = section.icon;
              return (
                <Card key={index}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-3 text-lg">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      {section.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {section.content.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="text-primary mt-1">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                {t.contact.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{t.contact.intro}</p>
              <div className="space-y-3">
                <p className="font-semibold">{t.contact.company}</p>
                <div className="flex flex-col gap-2 text-sm">
                  <a href="mailto:info@kwh.quebec" className="flex items-center gap-2 text-primary hover:underline">
                    <Mail className="w-4 h-4" />
                    info@kwh.quebec
                  </a>
                  <a href="tel:5144278871" className="flex items-center gap-2 text-primary hover:underline">
                    <Phone className="w-4 h-4" />
                    514.427.8871
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="border-t py-6 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} kWh Québec. {language === "fr" ? "Tous droits réservés." : "All rights reserved."}</p>
        </div>
      </footer>
    </div>
  );
}

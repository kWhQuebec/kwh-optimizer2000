import { Link } from "wouter";
import { ArrowLeft, Shield, Mail, Phone, MapPin, Calendar, FileText, UserCheck, Trash2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import logoFr from "@assets/kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png";
import logoEn from "@assets/kWh_Quebec_Logo-02_-_Rectangle_1764799021536.png";

export default function PrivacyPage() {
  const { language } = useI18n();
  const currentLogo = language === "fr" ? logoFr : logoEn;

  const content = {
    fr: {
      title: "Politique de confidentialité",
      lastUpdated: "Dernière mise à jour: Janvier 2026",
      intro: "kWh Québec s'engage à protéger vos renseignements personnels conformément à la Loi 25 sur la protection des renseignements personnels dans le secteur privé du Québec.",
      sections: [
        {
          icon: FileText,
          title: "Renseignements collectés",
          content: [
            "Nom et coordonnées (courriel, téléphone, adresse)",
            "Données de consommation énergétique (factures Hydro-Québec)",
            "Informations sur votre bâtiment (type, superficie, emplacement)",
            "Données de navigation sur notre site web",
          ]
        },
        {
          icon: UserCheck,
          title: "Finalités de la collecte",
          content: [
            "Vous envoyer votre analyse solaire personnalisée par courriel",
            "Vous contacter pour discuter de solutions solaires adaptées à vos besoins",
            "Améliorer nos services et personnaliser votre expérience",
            "Respecter nos obligations légales et réglementaires",
          ]
        },
        {
          icon: Calendar,
          title: "Durée de conservation",
          content: [
            "Vos données sont conservées pendant 3 ans après votre dernière interaction avec nous",
            "Les données de prospects non convertis sont supprimées après 12 mois",
            "Vous pouvez demander la suppression de vos données à tout moment",
          ]
        },
        {
          icon: Lock,
          title: "Sécurité des données",
          content: [
            "Vos données sont stockées sur des serveurs sécurisés avec chiffrement",
            "L'accès est limité aux employés autorisés uniquement",
            "Nous ne vendons jamais vos renseignements personnels à des tiers",
          ]
        },
        {
          icon: Shield,
          title: "Vos droits (Loi 25)",
          content: [
            "Droit d'accès: Obtenir une copie de vos renseignements personnels",
            "Droit de rectification: Corriger des informations inexactes",
            "Droit à l'effacement: Demander la suppression de vos données",
            "Droit de retrait: Retirer votre consentement à tout moment",
            "Droit de portabilité: Recevoir vos données dans un format lisible",
          ]
        },
      ],
      contact: {
        title: "Nous contacter",
        intro: "Pour exercer vos droits ou pour toute question concernant vos renseignements personnels:",
        responsible: "Responsable de la protection des renseignements personnels",
        company: "kWh Québec",
      },
      backToHome: "Retour à l'accueil",
    },
    en: {
      title: "Privacy Policy",
      lastUpdated: "Last updated: January 2026",
      intro: "kWh Québec is committed to protecting your personal information in accordance with Quebec's Law 25 on the protection of personal information in the private sector.",
      sections: [
        {
          icon: FileText,
          title: "Information Collected",
          content: [
            "Name and contact information (email, phone, address)",
            "Energy consumption data (Hydro-Québec bills)",
            "Building information (type, area, location)",
            "Website browsing data",
          ]
        },
        {
          icon: UserCheck,
          title: "Purpose of Collection",
          content: [
            "Send you your personalized solar analysis by email",
            "Contact you to discuss solar solutions tailored to your needs",
            "Improve our services and personalize your experience",
            "Comply with our legal and regulatory obligations",
          ]
        },
        {
          icon: Calendar,
          title: "Data Retention",
          content: [
            "Your data is retained for 3 years after your last interaction with us",
            "Unconverted prospect data is deleted after 12 months",
            "You can request deletion of your data at any time",
          ]
        },
        {
          icon: Lock,
          title: "Data Security",
          content: [
            "Your data is stored on secure encrypted servers",
            "Access is limited to authorized employees only",
            "We never sell your personal information to third parties",
          ]
        },
        {
          icon: Shield,
          title: "Your Rights (Law 25)",
          content: [
            "Right of access: Obtain a copy of your personal information",
            "Right of rectification: Correct inaccurate information",
            "Right to erasure: Request deletion of your data",
            "Right of withdrawal: Withdraw your consent at any time",
            "Right to portability: Receive your data in a readable format",
          ]
        },
      ],
      contact: {
        title: "Contact Us",
        intro: "To exercise your rights or for any questions about your personal information:",
        responsible: "Privacy Officer",
        company: "kWh Québec",
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
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold" data-testid="text-privacy-title">{t.title}</h1>
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
                <p className="text-sm font-medium">{t.contact.responsible}</p>
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

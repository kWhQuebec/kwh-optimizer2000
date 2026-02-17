import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";
import logoFr from "@assets/kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png";
import logoEn from "@assets/kWh_Quebec_Logo-02_-_Rectangle_1764799021536.png";

interface NavItem {
  href: string;
  labelFr: string;
  labelEn: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", labelFr: "Accueil", labelEn: "Home" },
  { href: "/ressources", labelFr: "Ressources", labelEn: "Resources" },
  { href: "/portfolio", labelFr: "Portfolio", labelEn: "Portfolio" },
];

export function PublicHeader() {
  const { language, t } = useI18n();
  const [location] = useLocation();
  const logo = language === "fr" ? logoFr : logoEn;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <Link href="/">
            <img 
              src={logo} 
              alt={language === "fr" ? "Logo kWh Québec – Énergie solaire commerciale" : "kWh Québec Logo – Commercial Solar Energy"} 
              className="h-[50px] sm:h-[3.75rem] w-auto"
              data-testid="logo-header"
            />
          </Link>
          
          <nav className="hidden md:flex items-center gap-6">
            {NAV_ITEMS.map((item) => {
              const isActive = location === item.href || 
                (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link 
                  key={item.href}
                  href={item.href} 
                  className={`text-sm transition-colors ${
                    isActive 
                      ? "font-medium text-foreground" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`link-nav-${item.href.replace(/\//g, "") || "home"}`}
                >
                  {language === "fr" ? item.labelFr : item.labelEn}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            <Link href="/login">
              <Button variant="outline" size="sm" data-testid="button-login">
                {t("nav.login")}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  const { language } = useI18n();

  return (
    <footer className="bg-muted/30 border-t mt-16">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <h3 className="font-semibold text-lg mb-4">kWh Québec</h3>
            <p className="text-sm text-muted-foreground">
              {language === "fr" 
                ? "Solutions solaires et stockage clé en main pour le secteur commercial et industriel québécois."
                : "Turnkey solar and storage solutions for Québec's commercial and industrial sector."}
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-lg mb-4">Contact</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <a 
                href="mailto:info@kwh.quebec" 
                className="flex items-center gap-2 hover:text-foreground transition-colors"
                data-testid="link-email"
              >
                info@kwh.quebec
              </a>
              <a 
                href="tel:+15144278871" 
                className="flex items-center gap-2 hover:text-foreground transition-colors"
                data-testid="link-phone"
              >
                514.427.8871
              </a>
              <a 
                href="https://www.kwh.quebec" 
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-foreground transition-colors"
                data-testid="link-website"
              >
                www.kwh.quebec
              </a>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-lg mb-4">
              {language === "fr" ? "Adresse" : "Address"}
            </h3>
            <p className="text-sm text-muted-foreground">
              Montréal, Québec, Canada
            </p>
          </div>
        </div>
        <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} kWh Québec Inc. {language === "fr" ? "Tous droits réservés." : "All rights reserved."}</p>
        </div>
      </div>
    </footer>
  );
}

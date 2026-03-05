import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";
import { Phone, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import logoFr from "@assets/kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png";
import logoEn from "@assets/kWh_Quebec_Logo-02_-_Rectangle_1764799021536.png";

interface NavItem {
  href: string;
  labelFr: string;
  labelEn: string;
}

interface DropdownNavItem {
  labelFr: string;
  labelEn: string;
  children: NavItem[];
}

const SERVICES_DROPDOWN: DropdownNavItem = {
  labelFr: "Services",
  labelEn: "Services",
  children: [
    { href: "/solaire-commercial", labelFr: "Solaire commercial", labelEn: "Commercial Solar" },
    { href: "/stockage-energie", labelFr: "Stockage par batterie", labelEn: "Battery Storage" },
  ],
};

const NAV_ITEMS: NavItem[] = [
  { href: "/portfolio", labelFr: "Portfolio", labelEn: "Portfolio" },
  { href: "/ressources", labelFr: "Ressources", labelEn: "Resources" },
];

function ServicesDropdown({ language, location }: { language: string; location: string }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isChildActive = SERVICES_DROPDOWN.children.some((child) => {
    const p = child.href.split("#")[0].split("?")[0];
    return p !== "/" && location.startsWith(p);
  });

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={`flex items-center gap-1 text-sm transition-colors ${
          isChildActive ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
        data-testid="button-nav-services"
      >
        {language === "fr" ? SERVICES_DROPDOWN.labelFr : SERVICES_DROPDOWN.labelEn}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div
        className={`absolute top-full left-0 mt-2 w-52 rounded-md border bg-popover shadow-md py-1 ${
          open ? "opacity-100 visible" : "opacity-0 invisible"
        } transition-all`}
      >
        {SERVICES_DROPDOWN.children.map((child) => {
          const label = language === "fr" ? child.labelFr : child.labelEn;
          const testId = `link-nav-${child.href.replace(/[\/#]/g, "") || "services"}`;
          return (
            <Link
              key={child.href}
              href={child.href}
              className="block px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              data-testid={testId}
              onClick={() => setOpen(false)}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function PublicHeader() {
  const { language, t } = useI18n();
  const [location] = useLocation();
  const logo = language === "fr" ? logoFr : logoEn;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b">
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
            <ServicesDropdown language={language} location={location} />
            {NAV_ITEMS.map((item) => {
              const hrefPath = item.href.split("?")[0];
              const isActive = location === item.href || 
                location === hrefPath ||
                (hrefPath !== "/" && location.startsWith(hrefPath));
              const className = `text-sm transition-colors ${
                isActive 
                  ? "font-medium text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              }`;
              const testId = `link-nav-${hrefPath.replace(/\//g, "") || "home"}`;
              const label = language === "fr" ? item.labelFr : item.labelEn;
              return (
                <Link key={item.href} href={item.href} className={className} data-testid={testId}>
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 flex-wrap">
            <a
              href="tel:+15144278871"
              className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-header-phone"
            >
              <Phone className="h-4 w-4" />
              <span>514.427.8871</span>
            </a>
            <a
              href="tel:+15144278871"
              className="sm:hidden"
              aria-label={language === "fr" ? "Appeler 514.427.8871" : "Call 514.427.8871"}
              data-testid="link-header-phone-mobile"
            >
              <Button variant="ghost" size="icon">
                <Phone className="h-4 w-4" />
              </Button>
            </a>
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
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
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
                data-testid="link-footer-email"
              >
                info@kwh.quebec
              </a>
              <a 
                href="tel:+15144278871" 
                className="flex items-center gap-2 hover:text-foreground transition-colors"
                data-testid="link-footer-phone"
              >
                514.427.8871
              </a>
              <p>Montréal, Québec, Canada</p>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-lg mb-4">
              {language === "fr" ? "Navigation" : "Navigation"}
            </h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <Link href="/solaire-commercial" className="block hover:text-foreground transition-colors" data-testid="link-footer-solaire">
                {language === "fr" ? "Solaire commercial" : "Commercial Solar"}
              </Link>
              <Link href="/stockage-energie" className="block hover:text-foreground transition-colors" data-testid="link-footer-stockage">
                {language === "fr" ? "Stockage par batterie" : "Battery Storage"}
              </Link>
              <Link href="/portfolio" className="block hover:text-foreground transition-colors" data-testid="link-footer-portfolio">
                Portfolio
              </Link>
              <Link href="/ressources" className="block hover:text-foreground transition-colors" data-testid="link-footer-ressources">
                {language === "fr" ? "Ressources" : "Resources"}
              </Link>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-lg mb-4">
              {language === "fr" ? "Légal" : "Legal"}
            </h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <Link href="/privacy" className="block hover:text-foreground transition-colors" data-testid="link-footer-privacy">
                {language === "fr" ? "Confidentialité" : "Privacy"}
              </Link>
              <Link href="/conditions" className="block hover:text-foreground transition-colors" data-testid="link-footer-terms">
                {language === "fr" ? "Conditions d'utilisation" : "Terms of Service"}
              </Link>
              <a 
                href="https://www.kwh.quebec" 
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:text-foreground transition-colors"
                data-testid="link-footer-website"
              >
                www.kwh.quebec
              </a>
            </div>
          </div>
        </div>
        <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} kWh Québec Inc. {language === "fr" ? "Tous droits réservés." : "All rights reserved."}</p>
          <p className="mt-1">RBQ: 5656-6136-01</p>
        </div>
      </div>
    </footer>
  );
}

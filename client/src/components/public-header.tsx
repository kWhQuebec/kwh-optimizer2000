import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/lib/i18n";
import { Phone, ChevronDown, Menu, X } from "lucide-react";
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
    { href: "/solaire-commercial", labelFr: "Solaire", labelEn: "Solar" },
    { href: "/stockage-energie", labelFr: "Stockage", labelEn: "Storage" },
  ],
};

const NAV_ITEMS: NavItem[] = [
  { href: "/portfolio", labelFr: "Portfolio", labelEn: "Portfolio" },
  { href: "/ressources", labelFr: "Ressources", labelEn: "Resources" },
  { href: "/a-propos", labelFr: "À propos", labelEn: "About" },
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
        <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const logo = language === "fr" ? logoFr : logoEn;

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

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
          
          <nav className="hidden md:flex items-center gap-6" aria-label="Navigation principale">
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

          <div className="flex items-center gap-2">
            <a
              href="tel:+15144278871"
              className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-header-phone"
            >
              <Phone aria-hidden="true" className="h-4 w-4" />
              <span>514.427.8871</span>
            </a>
            <a
              href="tel:+15144278871"
              className="md:hidden"
              aria-label={language === "fr" ? "Appeler 514.427.8871" : "Call 514.427.8871"}
              data-testid="link-header-phone-mobile"
            >
              <Button variant="ghost" size="icon">
                <Phone aria-hidden="true" className="h-4 w-4" />
              </Button>
            </a>
            <div className="hidden md:flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
            </div>
            <Link href="/login">
              <Button variant="outline" size="sm" data-testid="button-login">
                {t("nav.login")}
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-label={language === "fr" ? "Ouvrir le menu" : "Open menu"}
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? (
                <X aria-hidden="true" className="h-5 w-5" />
              ) : (
                <Menu aria-hidden="true" className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 top-16 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          data-testid="mobile-menu-backdrop"
        />
      )}

      <nav
        className={`fixed top-16 right-0 bottom-0 w-72 z-50 bg-background border-l shadow-lg transform transition-transform duration-200 ease-in-out md:hidden ${
          mobileMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label={language === "fr" ? "Menu mobile" : "Mobile menu"}
        data-testid="nav-mobile-menu"
      >
        <div className="flex flex-col py-4 px-4 gap-1 overflow-y-auto h-full">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-1">
            {language === "fr" ? SERVICES_DROPDOWN.labelFr : SERVICES_DROPDOWN.labelEn}
          </p>
          {SERVICES_DROPDOWN.children.map((child) => {
            const label = language === "fr" ? child.labelFr : child.labelEn;
            const p = child.href.split("#")[0].split("?")[0];
            const isActive = p !== "/" && location.startsWith(p);
            return (
              <Link
                key={child.href}
                href={child.href}
                className={`block px-3 py-2.5 rounded-md text-sm transition-colors ${
                  isActive ? "font-medium text-foreground bg-muted" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
                data-testid={`link-mobile-${child.href.replace(/[\/#]/g, "") || "services"}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {label}
              </Link>
            );
          })}

          <div className="h-px bg-border my-2" />

          {NAV_ITEMS.map((item) => {
            const hrefPath = item.href.split("?")[0];
            const isActive = location === item.href || 
              location === hrefPath ||
              (hrefPath !== "/" && location.startsWith(hrefPath));
            const label = language === "fr" ? item.labelFr : item.labelEn;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-3 py-2.5 rounded-md text-sm transition-colors ${
                  isActive ? "font-medium text-foreground bg-muted" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
                data-testid={`link-mobile-${hrefPath.replace(/\//g, "") || "home"}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {label}
              </Link>
            );
          })}

          <div className="h-px bg-border my-2" />

          <a
            href="tel:+15144278871"
            className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            data-testid="link-mobile-phone"
          >
            <Phone aria-hidden="true" className="h-4 w-4" />
            514.427.8871
          </a>

          <div className="h-px bg-border my-2" />

          <div className="flex items-center gap-2 px-3 py-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </nav>
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
                aria-label="Envoyer un courriel à info@kwh.quebec"
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
                {language === "fr" ? "Solaire" : "Solar"}
              </Link>
              <Link href="/stockage-energie" className="block hover:text-foreground transition-colors" data-testid="link-footer-stockage">
                {language === "fr" ? "Stockage" : "Storage"}
              </Link>
              <Link href="/portfolio" className="block hover:text-foreground transition-colors" data-testid="link-footer-portfolio">
                Portfolio
              </Link>
              <Link href="/ressources" className="block hover:text-foreground transition-colors" data-testid="link-footer-ressources">
                {language === "fr" ? "Ressources" : "Resources"}
              </Link>
              <Link href="/a-propos" className="block hover:text-foreground transition-colors" data-testid="link-footer-about">
                {language === "fr" ? "À propos" : "About"}
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

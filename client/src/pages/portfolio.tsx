import { useQuery } from "@tanstack/react-query";
import { Sun, MapPin, Zap, Mail, Phone, Building2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import logoFr from "@assets/kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png";
import logoEn from "@assets/kWh_Quebec_Logo-02_-_Rectangle_1764799021536.png";

interface PortfolioSite {
  id: string;
  city: string;
  kb_kw_dc: number | null;
  latitude: number;
  longitude: number;
  roof_area_sqm: number | null;
}

function PortfolioHeader() {
  const { language } = useI18n();
  const logo = language === "fr" ? logoFr : logoEn;

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-2" data-testid="link-home">
            <img src={logo} alt="kWh Québec" className="h-[50px] sm:h-[3.75rem] w-auto" />
          </a>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}

function PortfolioFooter() {
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
            <h3 className="font-semibold text-lg mb-4">
              {language === "fr" ? "Contact" : "Contact"}
            </h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <a 
                href="mailto:info@kwhquebec.com" 
                className="flex items-center gap-2 hover:text-foreground transition-colors"
                data-testid="link-email"
              >
                <Mail className="w-4 h-4" />
                info@kwhquebec.com
              </a>
              <a 
                href="tel:+15149001234" 
                className="flex items-center gap-2 hover:text-foreground transition-colors"
                data-testid="link-phone"
              >
                <Phone className="w-4 h-4" />
                +1 (514) 900-1234
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

function ProjectCard({ site }: { site: PortfolioSite }) {
  const { language } = useI18n();
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  
  const satelliteUrl = apiKey 
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${site.latitude},${site.longitude}&zoom=19&size=400x300&maptype=satellite&key=${apiKey}`
    : null;

  const hasSystemSize = site.kb_kw_dc != null && site.kb_kw_dc > 0;
  const status = hasSystemSize ? "in_development" : "planned";

  return (
    <Card className="overflow-hidden hover-elevate transition-all" data-testid={`card-project-${site.id}`}>
      <div className="aspect-[4/3] relative bg-muted">
        {satelliteUrl ? (
          <img 
            src={satelliteUrl} 
            alt={`${language === "fr" ? "Vue satellite" : "Satellite view"} - ${site.city}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building2 className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
        <Badge 
          className={`absolute top-3 right-3 ${
            status === "in_development" 
              ? "bg-amber-500/90 hover:bg-amber-500 text-white" 
              : "bg-primary/90 hover:bg-primary text-primary-foreground"
          }`}
        >
          {status === "in_development" 
            ? (language === "fr" ? "En développement" : "In Development")
            : (language === "fr" ? "Planifié" : "Planned")}
        </Badge>
      </div>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="w-4 h-4 shrink-0" />
            <span className="font-medium text-foreground">{site.city}</span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3 pt-2">
          {hasSystemSize && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {language === "fr" ? "Puissance" : "Capacity"}
                </p>
                <p className="font-semibold text-sm">
                  {site.kb_kw_dc?.toFixed(0)} kW
                </p>
              </div>
            </div>
          )}
          
          {site.roof_area_sqm && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Sun className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {language === "fr" ? "Surface" : "Area"}
                </p>
                <p className="font-semibold text-sm">
                  {site.roof_area_sqm.toLocaleString(language === "fr" ? "fr-CA" : "en-CA", { maximumFractionDigits: 0 })} m²
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PortfolioGrid({ sites }: { sites: PortfolioSite[] }) {
  const { language } = useI18n();

  if (sites.length === 0) {
    return (
      <div className="text-center py-16">
        <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">
          {language === "fr" ? "Aucun projet disponible" : "No projects available"}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {sites.map((site) => (
        <ProjectCard key={site.id} site={site} />
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i} className="overflow-hidden">
          <Skeleton className="aspect-[4/3]" />
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-5 w-32" />
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Portfolio() {
  const { language } = useI18n();
  
  const { data: sites, isLoading, error } = useQuery<PortfolioSite[]>({
    queryKey: ["/api/public/portfolio"],
  });

  const totalCapacity = sites?.reduce((sum, site) => sum + (site.kb_kw_dc || 0), 0) || 0;
  const projectCount = sites?.length || 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PortfolioHeader />
      
      <main className="flex-1">
        <section className="py-12 md:py-16 bg-gradient-to-b from-primary/5 to-background">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto space-y-4">
              <Badge variant="secondary" className="mb-2">
                {language === "fr" ? "Portefeuille" : "Portfolio"}
              </Badge>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
                {language === "fr" 
                  ? "Portefeuille de projets solaires" 
                  : "Solar Projects Portfolio"}
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {language === "fr"
                  ? "Découvrez notre portefeuille de projets solaires commerciaux et industriels en développement au Québec."
                  : "Explore our portfolio of commercial and industrial solar projects in development across Québec."}
              </p>
            </div>
            
            {!isLoading && sites && (
              <div className="flex flex-wrap justify-center gap-8 mt-8">
                <div className="text-center">
                  <p className="text-3xl md:text-4xl font-bold text-primary">{projectCount}</p>
                  <p className="text-sm text-muted-foreground">
                    {language === "fr" ? "Sites" : "Sites"}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-3xl md:text-4xl font-bold text-primary">
                    {totalCapacity.toLocaleString(language === "fr" ? "fr-CA" : "en-CA", { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-sm text-muted-foreground">kW DC</p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="py-12">
          <div className="container mx-auto px-4">
            {isLoading ? (
              <LoadingSkeleton />
            ) : error ? (
              <div className="text-center py-16">
                <p className="text-destructive">
                  {language === "fr" 
                    ? "Erreur lors du chargement des projets" 
                    : "Error loading projects"}
                </p>
              </div>
            ) : (
              <PortfolioGrid sites={sites || []} />
            )}
          </div>
        </section>
      </main>

      <PortfolioFooter />
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sun, MapPin, Zap, Building2, ArrowRight, ChevronDown, DollarSign, BarChart3, BookOpen, BatteryCharging } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { Link } from "wouter";
import { PublicHeader, PublicFooter } from "@/components/public-header";
import { SEOHead } from "@/components/seo-head";
import heroImage from "@assets/hero-optimized.jpg";

interface PortfolioSite {
  id: string;
  city: string;
  address: string | null;
  kb_kw_dc: number | null;
  latitude: number;
  longitude: number;
  roof_area_sqm: number | null;
  visualization_url: string | null;
  annual_production_kwh: number | null;
  estimated_annual_savings: number | null;
}

const ITEMS_PER_PAGE = 6;

function LazyImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef} className="w-full h-full relative">
      {!isLoaded && (
        <div className="absolute inset-0 bg-muted animate-pulse flex items-center justify-center">
          <Building2 className="w-8 h-8 text-muted-foreground/50" />
        </div>
      )}
      {isInView && (
        <img
          src={src}
          alt={alt}
          className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
          onLoad={() => setIsLoaded(true)}
        />
      )}
    </div>
  );
}

function ProjectCard({ site }: { site: PortfolioSite }) {
  const { language } = useI18n();
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  
  // Use smaller image size for faster loading (300x225 instead of 400x300)
  const imageUrl = apiKey 
    ? (site.visualization_url 
        ? `${site.visualization_url}&key=${apiKey}&size=300x225` 
        : `https://maps.googleapis.com/maps/api/staticmap?center=${site.latitude},${site.longitude}&zoom=19&size=300x225&maptype=satellite&key=${apiKey}`)
    : null;

  const hasSystemSize = site.kb_kw_dc != null && site.kb_kw_dc > 0;

  return (
    <Card className="overflow-hidden hover-elevate transition-all" data-testid={`card-project-${site.id}`}>
      <div className="aspect-[4/3] relative bg-muted">
        {imageUrl ? (
          <LazyImage 
            src={imageUrl} 
            alt={`${language === "fr" ? "Vue satellite" : "Satellite view"} - ${site.city}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building2 className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
      </div>
      <CardContent className="p-4 space-y-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="w-4 h-4 shrink-0" />
            <span className="font-medium text-foreground">{site.city}</span>
          </div>
          {site.address && (
            <p className="text-sm text-muted-foreground pl-6 line-clamp-2" data-testid={`text-address-${site.id}`}>
              {site.address}
            </p>
          )}
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
                <p className="font-semibold text-sm" data-testid={`text-capacity-${site.id}`}>
                  {Math.round((site.kb_kw_dc || 0) / 100) * 100} kW
                </p>
              </div>
            </div>
          )}
          
          {site.annual_production_kwh && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <BarChart3 className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {language === "fr" ? "Production/an" : "Annual prod."}
                </p>
                <p className="font-semibold text-sm" data-testid={`text-production-${site.id}`}>
                  {(site.annual_production_kwh / 1000).toLocaleString(language === "fr" ? "fr-CA" : "en-CA", { maximumFractionDigits: 0 })} MWh
                </p>
              </div>
            </div>
          )}

          {site.estimated_annual_savings && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <DollarSign className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {language === "fr" ? "Valeur/an" : "Annual value"}
                </p>
                <p className="font-semibold text-sm" data-testid={`text-savings-${site.id}`}>
                  {site.estimated_annual_savings.toLocaleString(language === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 })}
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
        
        <Link href={`/portfolio/${site.id}`}>
          <Button variant="outline" size="sm" className="w-full mt-2" data-testid={`button-view-project-${site.id}`}>
            {language === "fr" ? "Voir les détails" : "View details"}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function PortfolioGrid({ sites, visibleCount, onLoadMore }: { 
  sites: PortfolioSite[]; 
  visibleCount: number;
  onLoadMore: () => void;
}) {
  const { language } = useI18n();
  const visibleSites = sites.slice(0, visibleCount);
  const hasMore = visibleCount < sites.length;

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
    <div className="space-y-8">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visibleSites.map((site) => (
          <ProjectCard key={site.id} site={site} />
        ))}
      </div>
      
      {hasMore && (
        <div className="text-center">
          <Button 
            variant="outline" 
            size="lg" 
            onClick={onLoadMore}
            className="gap-2"
            data-testid="button-load-more"
          >
            <ChevronDown className="w-4 h-4" />
            {language === "fr" 
              ? `Voir plus (${sites.length - visibleCount} restants)` 
              : `Load more (${sites.length - visibleCount} remaining)`}
          </Button>
        </div>
      )}
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
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  
  const { data: sites, isLoading, error } = useQuery<PortfolioSite[]>({
    queryKey: ["/api/public/portfolio"],
  });

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + ITEMS_PER_PAGE);
  };

  const totalCapacity = sites?.reduce((sum, site) => sum + (site.kb_kw_dc || 0), 0) || 0;
  const totalProductionMwh = sites?.reduce((sum, site) => sum + (site.annual_production_kwh || 0), 0) || 0;
  const projectCount = sites?.length || 0;

  return (
    <div className="public-page min-h-screen flex flex-col bg-background">
      <SEOHead 
        title={language === "fr" ? "Portfolio de projets solaires | kWh Québec" : "Solar Projects Portfolio | kWh Québec"}
        description={language === "fr"
          ? "Découvrez notre portfolio de projets solaires commerciaux et industriels en développement au Québec."
          : "Explore our portfolio of commercial and industrial solar projects in development across Québec."}
        ogImage={heroImage}
      />
      <PublicHeader />
      
      <main className="flex-1 pt-16">
        <section className="relative py-16 md:py-24 overflow-hidden">
          <img
            src={heroImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80" />
          <div className="relative container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto space-y-4">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white">
                {language === "fr" 
                  ? "Portfolio de projets solaires" 
                  : "Solar Projects Portfolio"}
              </h1>
              <p className="text-lg text-white/70 max-w-2xl mx-auto">
                {language === "fr"
                  ? "Découvrez notre portfolio de projets solaires commerciaux et industriels en développement au Québec."
                  : "Explore our portfolio of commercial and industrial solar projects in development across Québec."}
              </p>
            </div>
            
            {!isLoading && sites && (
              <div className="flex flex-wrap justify-center gap-8 mt-8">
                <div className="text-center">
                  <p className="text-3xl md:text-4xl font-bold text-white">{projectCount}</p>
                  <p className="text-sm text-white/70">
                    {language === "fr" ? "Sites" : "Sites"}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-3xl md:text-4xl font-bold text-white">
                    {totalCapacity.toLocaleString(language === "fr" ? "fr-CA" : "en-CA", { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-sm text-white/70">kW DC</p>
                </div>
                {totalProductionMwh > 0 && (
                  <div className="text-center">
                    <p className="text-3xl md:text-4xl font-bold text-white" data-testid="text-total-production">
                      {Math.round(totalProductionMwh / 1000).toLocaleString(language === "fr" ? "fr-CA" : "en-CA")}
                    </p>
                    <p className="text-sm text-white/70">
                      {language === "fr" ? "MWh/an estimés" : "Est. MWh/year"}
                    </p>
                  </div>
                )}
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
              <PortfolioGrid 
                sites={sites || []} 
                visibleCount={visibleCount}
                onLoadMore={handleLoadMore}
              />
            )}
          </div>
        </section>

        <section className="py-12 border-t">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto text-center space-y-4">
              <h2 className="text-xl font-semibold" data-testid="text-portfolio-crosslink-title">
                {language === "fr"
                  ? "Comment ça fonctionne?"
                  : "How does it work?"}
              </h2>
              <p className="text-muted-foreground text-sm">
                {language === "fr"
                  ? "Consultez nos guides et ressources pour comprendre le processus d'un projet solaire commercial."
                  : "Browse our guides and resources to understand the commercial solar project process."}
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link href="/ressources?tab=guides">
                  <Button variant="outline" className="gap-2" data-testid="link-portfolio-guides">
                    <BookOpen className="w-4 h-4" />
                    {language === "fr" ? "Guides & ressources" : "Guides & resources"}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/stockage-energie">
                  <Button variant="outline" className="gap-2" data-testid="link-portfolio-stockage">
                    <BatteryCharging className="w-4 h-4" />
                    {language === "fr" ? "Stockage par batterie" : "Battery storage"}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

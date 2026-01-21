import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { ArrowLeft, Building2, MapPin, Zap, Ruler, Calendar, Users, Building, Loader2, Sun } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { PublicHeader, PublicFooter } from "@/components/public-header";
import { SEOHead } from "@/components/seo-head";

interface ProjectDetails {
  id: string;
  city: string | null;
  address: string | null;
  province: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  systemSizeKwDc: number | null;
  roofAreaSqM: number | null;
  buildingType: string | null;
  roofType: string | null;
  visualizationUrl: string | null;
  constructionStart: { fr: string; en: string };
  developer: { fr: string; en: string };
  buildingSponsor: { fr: string; en: string };
  electricityOfftake: { fr: string; en: string };
}

function DetailItem({ 
  icon: Icon, 
  label, 
  value, 
  highlight = false 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: string | null; 
  highlight?: boolean;
}) {
  const { language } = useI18n();
  const displayValue = value || (language === "fr" ? "À déterminer" : "TBD");
  
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${highlight ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`font-medium ${highlight ? "text-lg" : ""}`}>{displayValue}</p>
      </div>
    </div>
  );
}

function SolarInfoSection() {
  const { language } = useI18n();
  
  const texts = {
    fr: {
      title: "L'énergie solaire au Québec",
      paragraph1: `Le solaire devient rapidement l'une des sources d'électricité les moins chères pour la nouvelle génération à l'échelle mondiale. Dans son dernier appel d'offres, Hydro-Québec a lancé un processus pour acquérir jusqu'à 300 MW de nouvelle production solaire.`,
      paragraph2: `La construction de nouvelles installations solaires sur les toitures industrielles est l'une des meilleures façons d'utiliser cette technologie. Non seulement le solaire occupe un espace de toiture sous-utilisé, mais il génère également de l'énergie là où elle est nécessaire.`,
      paragraph3: `Ce projet fera partie de ce processus d'appel d'offres compétitif. Les soumissions seront présentées en mars 2026 et les projets retenus seront notifiés en janvier 2027.`,
    },
    en: {
      title: "Solar Energy in Quebec",
      paragraph1: `Solar is quickly becoming one of the cheapest new electricity sources for new generation globally. In its latest call for new generation, Hydro-Québec has released an Appel d'offres to acquire up to 300 MW of new solar generation.`,
      paragraph2: `Building new solar generation on industrial rooftops is one of the best ways to utilize the technology. Not only does the solar take up underutilized roof space, but it also generates energy right where the energy is needed.`,
      paragraph3: `This project will be part of that competitive bidding process. Bids will be submitted in March 2026 and projects awarded will be notified in January 2027.`,
    },
  };
  
  const t = texts[language];
  
  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sun className="w-5 h-5 text-yellow-500" />
          {t.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-muted-foreground">
        <p>{t.paragraph1}</p>
        <p>{t.paragraph2}</p>
        <p>{t.paragraph3}</p>
      </CardContent>
    </Card>
  );
}

export default function PortfolioProjectPage() {
  const { language } = useI18n();
  const [, params] = useRoute("/portfolio/:id");
  const projectId = params?.id;
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  
  const { data: project, isLoading, error } = useQuery<ProjectDetails>({
    queryKey: ["/api/public/portfolio", projectId],
    queryFn: async () => {
      const response = await fetch(`/api/public/portfolio/${projectId}`);
      if (!response.ok) {
        throw new Error("Project not found");
      }
      return response.json();
    },
    enabled: !!projectId,
  });
  
  const texts = {
    fr: {
      backToPortfolio: "Retour au portfolio",
      projectDetails: "Détails du projet",
      projectAddress: "Adresse du projet",
      projectSize: "Taille du projet",
      roofArea: "Surface de toiture",
      buildingType: "Type de bâtiment",
      constructionStart: "Début de construction prévu",
      developer: "Développeur / Constructeur",
      buildingSponsor: "Propriétaire / Commanditaire",
      electricityOfftake: "Acheteur d'électricité",
      loading: "Chargement...",
      notFound: "Projet non trouvé",
      notFoundDesc: "Le projet demandé n'existe pas ou n'est plus disponible.",
      kWdc: "kW DC",
      sqm: "m²",
    },
    en: {
      backToPortfolio: "Back to Portfolio",
      projectDetails: "Project Details",
      projectAddress: "Project Address",
      projectSize: "Project Size",
      roofArea: "Roof Area",
      buildingType: "Building Type",
      constructionStart: "Planned Construction Start",
      developer: "Developer / Constructor",
      buildingSponsor: "Building Sponsor / Owner",
      electricityOfftake: "Electricity Offtake",
      loading: "Loading...",
      notFound: "Project Not Found",
      notFoundDesc: "The requested project does not exist or is no longer available.",
      kWdc: "kW DC",
      sqm: "m²",
    },
  };
  
  const t = texts[language];
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader />
        <main className="pt-24 pb-16">
          <div className="container mx-auto px-4 max-w-4xl">
            <Skeleton className="h-8 w-48 mb-8" />
            <Skeleton className="h-64 w-full mb-8 rounded-xl" />
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          </div>
        </main>
        <PublicFooter />
      </div>
    );
  }
  
  if (error || !project) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader />
        <main className="pt-24 pb-16">
          <div className="container mx-auto px-4 max-w-4xl text-center py-16">
            <Building2 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h1 className="text-2xl font-bold mb-2">{t.notFound}</h1>
            <p className="text-muted-foreground mb-8">{t.notFoundDesc}</p>
            <Link href="/portfolio">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t.backToPortfolio}
              </Button>
            </Link>
          </div>
        </main>
        <PublicFooter />
      </div>
    );
  }
  
  const fullAddress = [
    project.address,
    [project.city, project.province].filter(Boolean).join(", "),
    project.postalCode,
  ].filter(Boolean).join(", ");
  
  const imageUrl = apiKey && project.latitude && project.longitude
    ? (project.visualizationUrl 
        ? `${project.visualizationUrl}&key=${apiKey}` 
        : `https://maps.googleapis.com/maps/api/staticmap?center=${project.latitude},${project.longitude}&zoom=19&size=800x400&maptype=satellite&key=${apiKey}`)
    : null;
  
  const systemSizeDisplay = project.systemSizeKwDc 
    ? `${project.systemSizeKwDc.toLocaleString()} ${t.kWdc}` 
    : null;
  
  const roofAreaDisplay = project.roofAreaSqM 
    ? `${project.roofAreaSqM.toLocaleString()} ${t.sqm}` 
    : null;
  
  return (
    <div className="min-h-screen bg-background">
      <SEOHead 
        title={`${project.city || "Project"} - Portfolio | kWh Québec`}
        description={language === "fr" 
          ? `Projet solaire à ${project.city || "Québec"} - ${systemSizeDisplay || "Installation solaire commerciale"}`
          : `Solar project in ${project.city || "Quebec"} - ${systemSizeDisplay || "Commercial solar installation"}`
        }
      />
      <PublicHeader />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <Link href="/portfolio">
            <Button variant="ghost" size="sm" className="mb-6" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t.backToPortfolio}
            </Button>
          </Link>
          
          <div className="mb-8">
            <Badge className="mb-2 bg-primary/10 text-primary hover:bg-primary/20">
              {project.city}
            </Badge>
            <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-project-title">
              {t.projectAddress}
            </h1>
            <p className="text-lg text-muted-foreground mt-2" data-testid="text-project-address">
              {fullAddress || project.city}
            </p>
          </div>
          
          {imageUrl && (
            <div className="aspect-[2/1] relative rounded-xl overflow-hidden mb-8 bg-muted">
              <img 
                src={imageUrl} 
                alt={`${language === "fr" ? "Vue satellite" : "Satellite view"} - ${project.city}`}
                className="w-full h-full object-cover"
                data-testid="img-satellite"
              />
            </div>
          )}
          
          <Card>
            <CardHeader>
              <CardTitle>{t.projectDetails}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <DetailItem 
                  icon={Zap} 
                  label={t.projectSize} 
                  value={systemSizeDisplay}
                  highlight
                />
                <DetailItem 
                  icon={Ruler} 
                  label={t.roofArea} 
                  value={roofAreaDisplay}
                />
                <DetailItem 
                  icon={Building} 
                  label={t.buildingType} 
                  value={project.buildingType}
                />
                <DetailItem 
                  icon={Calendar} 
                  label={t.constructionStart} 
                  value={project.constructionStart[language]}
                />
                <DetailItem 
                  icon={Users} 
                  label={t.developer} 
                  value={project.developer[language]}
                />
                <DetailItem 
                  icon={Building2} 
                  label={t.buildingSponsor} 
                  value={project.buildingSponsor[language]}
                />
                <DetailItem 
                  icon={Zap} 
                  label={t.electricityOfftake} 
                  value={project.electricityOfftake[language]}
                />
              </div>
            </CardContent>
          </Card>
          
          <SolarInfoSection />
        </div>
      </main>
      
      <PublicFooter />
    </div>
  );
}

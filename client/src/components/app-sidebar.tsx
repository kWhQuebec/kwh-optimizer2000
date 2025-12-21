import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  BarChart3, 
  PenTool,
  Package,
  FileText,
  LogOut,
  FolderOpen,
  UserCog,
  FolderKanban,
  FileSignature,
  Target,
  FileCheck,
  HardHat,
  Wrench,
  Activity,
  Handshake,
  Upload
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import sidebarLogoFr from "@assets/solaire_fr_1764778573075.png";
import sidebarLogoEn from "@assets/solaire_en_1764778591753.png";

export function AppSidebar() {
  const { t, language } = useI18n();
  const { user, logout, isStaff, isClient, isAdmin } = useAuth();
  const [location] = useLocation();
  const currentLogo = language === "fr" ? sidebarLogoFr : sidebarLogoEn;

  const staffMainItems = [
    {
      title: t("nav.dashboard"),
      url: "/app",
      icon: LayoutDashboard,
      tooltip: language === "fr" ? "Vue d'ensemble du pipeline et des opportunités" : "Pipeline and opportunities overview",
    },
    {
      title: t("nav.clients"),
      url: "/app/clients",
      icon: Users,
      tooltip: language === "fr" ? "Gérer les entreprises clientes" : "Manage client companies",
    },
    {
      title: t("nav.sites"),
      url: "/app/sites",
      icon: Building2,
      tooltip: language === "fr" ? "Bâtiments à analyser pour projets solaires" : "Buildings to analyze for solar projects",
    },
    {
      title: language === "fr" ? "Portfolios" : "Portfolios",
      url: "/app/portfolios",
      icon: FolderKanban,
      tooltip: language === "fr" ? "Regroupements multi-sites" : "Multi-site project groups",
    },
    {
      title: language === "fr" ? "Pipeline ventes" : "Sales Pipeline",
      url: "/app/pipeline",
      icon: Target,
      tooltip: language === "fr" ? "Suivi des opportunités et prévisions" : "Opportunity tracking and forecasting",
    },
    {
      title: language === "fr" ? "Partenariats" : "Partnerships",
      url: "/app/partnerships",
      icon: Handshake,
      tooltip: language === "fr" ? "Partenaires stratégiques et développement d'affaires" : "Strategic partners and business development",
    },
  ];

  const staffAnalysisItems = [
    {
      title: t("nav.analyses"),
      url: "/app/analyses",
      icon: BarChart3,
      tooltip: language === "fr" ? "Résultats des simulations solaires" : "Solar simulation results",
    },
    {
      title: t("nav.designs"),
      url: "/app/designs",
      icon: PenTool,
      tooltip: language === "fr" ? "Configurations d'équipement et devis" : "Equipment configurations and quotes",
    },
    {
      title: language === "fr" ? "Ententes construction" : "Construction Agreements",
      url: "/app/construction-agreements",
      icon: HardHat,
      tooltip: language === "fr" ? "Contrats et jalons de construction" : "Construction contracts and milestones",
    },
    {
      title: language === "fr" ? "Contrats O&M" : "O&M Contracts",
      url: "/app/om-contracts",
      icon: FileCheck,
      tooltip: language === "fr" ? "Entretien et exploitation des systèmes" : "System maintenance and operations",
    },
    {
      title: language === "fr" ? "Visites maintenance" : "Maintenance Visits",
      url: "/app/om-visits",
      icon: Wrench,
      tooltip: language === "fr" ? "Historique des interventions terrain" : "Field intervention history",
    },
    {
      title: t("nav.catalog"),
      url: "/app/catalog",
      icon: Package,
      tooltip: language === "fr" ? "Composants solaires et prix" : "Solar components and pricing",
    },
  ];

  const adminItems = [
    {
      title: t("nav.userManagement") || "User Management",
      url: "/app/users",
      icon: UserCog,
      tooltip: language === "fr" ? "Gestion des comptes utilisateurs" : "User account management",
    },
    {
      title: t("nav.procurations") || "Procurations",
      url: "/app/procurations",
      icon: FileSignature,
      tooltip: language === "fr" ? "Autorisations d'accès aux données HQ" : "Hydro-Québec data access authorizations",
    },
    {
      title: language === "fr" ? "Import en lot" : "Batch Import",
      url: "/app/import",
      icon: Upload,
      tooltip: language === "fr" ? "Importer des prospects via fichier CSV" : "Import prospects from CSV files",
    },
    {
      title: language === "fr" ? "Intelligence marché" : "Market Intelligence",
      url: "/app/market-intelligence",
      icon: Target,
      tooltip: language === "fr" ? "Analyses concurrentielles et tendances" : "Competitive analysis and trends",
    },
    {
      title: t("nav.methodology"),
      url: "/app/methodology",
      icon: FileText,
      tooltip: language === "fr" ? "Documentation technique et calculs" : "Technical documentation and calculations",
    },
  ];

  const clientItems = [
    {
      title: t("nav.mySites") || "My Sites",
      url: "/app/portal",
      icon: FolderOpen,
    },
  ];

  const isActive = (url: string) => {
    if (url === "/app" || url === "/app/portal") {
      return location === url;
    }
    return location.startsWith(url);
  };

  const getRoleBadge = () => {
    if (isAdmin) return { label: "Admin", variant: "default" as const };
    if (isStaff) return { label: "Analyst", variant: "secondary" as const };
    if (isClient) return { label: "Client", variant: "outline" as const };
    return { label: "User", variant: "outline" as const };
  };

  const roleBadge = getRoleBadge();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link href={isClient ? "/app/portal" : "/app"}>
          <img 
            src={currentLogo} 
            alt="kWh Québec" 
            className="h-12 w-auto"
            data-testid="logo-sidebar"
          />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {isClient && (
          <SidebarGroup>
            <SidebarGroupLabel>{t("sidebar.portal") || "Portal"}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {clientItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive(item.url)}
                      data-testid={`sidebar-link-${item.url.split("/").pop()}`}
                    >
                      <Link href={item.url}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isStaff && (
          <>
            <SidebarGroup>
              <SidebarGroupLabel>{t("sidebar.main")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {staffMainItems.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={isActive(item.url)}
                        data-testid={`sidebar-link-${item.url.split("/").pop()}`}
                        title={item.tooltip}
                      >
                        <Link href={item.url}>
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>{language === "fr" ? "Projets" : "Projects"}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {staffAnalysisItems.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={isActive(item.url)}
                        data-testid={`sidebar-link-${item.url.split("/").pop()}`}
                        title={item.tooltip}
                      >
                        <Link href={item.url}>
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {isAdmin && (
              <SidebarGroup>
                <SidebarGroupLabel>{t("sidebar.admin") || "Administration"}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {adminItems.map((item) => (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton 
                          asChild 
                          isActive={isActive(item.url)}
                          data-testid={`sidebar-link-${item.url.split("/").pop()}`}
                          title={item.tooltip}
                        >
                          <Link href={item.url}>
                            <item.icon className="w-4 h-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
              <span className="text-sm font-medium">
                {(user?.name || user?.email)?.charAt(0).toUpperCase() || "U"}
              </span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">
                {user?.name || user?.email || "User"}
              </div>
              <div className="flex items-center gap-1">
                <Badge variant={roleBadge.variant} className="text-[10px] h-4 px-1">
                  {roleBadge.label}
                </Badge>
                {user?.clientName && (
                  <span className="text-xs text-muted-foreground truncate">
                    {user.clientName}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="p-2 rounded-md hover:bg-muted transition-colors shrink-0"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

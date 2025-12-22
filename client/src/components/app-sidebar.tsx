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
  Upload,
  GanttChart,
  ListTodo,
  Settings2,
  Gauge,
  ClipboardList
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

  // SECTION 1: Développement Commercial
  const businessDevItems = [
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

  // SECTION 2: Ingénierie (pré-construction)
  const engineeringItems = [
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
      title: language === "fr" ? "Ententes de services" : "Service Agreements",
      url: "/app/construction-agreements",
      icon: ClipboardList,
      tooltip: language === "fr" ? "Contrats construction + O&M intégrés" : "Integrated construction + O&M contracts",
    },
  ];

  // SECTION 3: Construction (exécution)
  const constructionItems = [
    {
      title: language === "fr" ? "Projets" : "Projects",
      url: "/app/construction-projects",
      icon: HardHat,
      tooltip: language === "fr" ? "Projets de construction en cours" : "Active construction projects",
    },
    {
      title: language === "fr" ? "Diagramme GANTT" : "GANTT Chart",
      url: "/app/construction-gantt",
      icon: GanttChart,
      tooltip: language === "fr" ? "Planification et échéanciers" : "Scheduling and timelines",
    },
    {
      title: language === "fr" ? "Tâches" : "Tasks",
      url: "/app/construction-tasks",
      icon: ListTodo,
      tooltip: language === "fr" ? "Suivi des tâches et assignations" : "Task tracking and assignments",
    },
  ];

  // SECTION 4: Exploitation (O&M post-construction)
  const operationsItems = [
    {
      title: language === "fr" ? "Contrats O&M" : "O&M Contracts",
      url: "/app/om-contracts",
      icon: FileCheck,
      tooltip: language === "fr" ? "Contrats d'exploitation actifs" : "Active operations contracts",
    },
    {
      title: language === "fr" ? "Visites maintenance" : "Maintenance Visits",
      url: "/app/om-visits",
      icon: Wrench,
      tooltip: language === "fr" ? "Historique des interventions terrain" : "Field intervention history",
    },
    {
      title: language === "fr" ? "Performance" : "Performance",
      url: "/app/om-performance",
      icon: Gauge,
      tooltip: language === "fr" ? "Tableau de bord performance systèmes" : "System performance dashboard",
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
            {/* Section 1: Développement Commercial */}
            <SidebarGroup>
              <SidebarGroupLabel>{language === "fr" ? "Développement" : "Business Dev"}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {businessDevItems.map((item) => (
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

            {/* Section 2: Ingénierie */}
            <SidebarGroup>
              <SidebarGroupLabel>{language === "fr" ? "Ingénierie" : "Engineering"}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {engineeringItems.map((item) => (
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

            {/* Section 3: Construction */}
            <SidebarGroup>
              <SidebarGroupLabel>{language === "fr" ? "Construction" : "Construction"}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {constructionItems.map((item) => (
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

            {/* Section 4: Exploitation */}
            <SidebarGroup>
              <SidebarGroupLabel>{language === "fr" ? "Exploitation" : "Operations"}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {operationsItems.map((item) => (
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

            {/* Section 5: Administration */}
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

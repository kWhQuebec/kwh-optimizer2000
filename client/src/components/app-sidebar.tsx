import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";
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
  Handshake,
  Upload,
  GanttChart,
  ListTodo,
  Gauge,
  ClipboardList,
  ChevronDown,
  Cog,
  Hammer,
  Settings,
  BookOpen
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import sidebarLogoFr from "@assets/solaire_fr-removebg-preview_1767985380511.png";
import sidebarLogoEn from "@assets/solaire_en-removebg-preview_1767985380510.png";

export function AppSidebar() {
  const { t, language } = useI18n();
  const { user, logout, isStaff, isClient, isAdmin } = useAuth();
  const [location] = useLocation();
  const isMobile = useIsMobile();
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
      title: language === "fr" ? "Tâches à faire" : "To-Do List",
      url: "/app/work-queue",
      icon: ClipboardList,
      tooltip: language === "fr" ? "Tâches internes à compléter (toits, analyses, rapports)" : "Internal tasks to complete (roofs, analyses, reports)",
    },
    {
      title: t("nav.clients"),
      url: "/app/clients",
      icon: Users,
      tooltip: language === "fr" ? "Entreprises avec projets actifs (leads convertis)" : "Companies with active projects (converted leads)",
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
      tooltip: language === "fr" ? "Commencez ici pour un nouveau lead – suivi des opportunités" : "Start here for new leads – opportunity tracking",
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
      title: t("nav.catalog"),
      url: "/app/catalog",
      icon: Package,
      tooltip: language === "fr" ? "Composants solaires et prix" : "Solar components and pricing",
    },
    {
      title: language === "fr" ? "Entente construction + O&M" : "Construction + O&M Agreement",
      url: "/app/construction-agreements",
      icon: ClipboardList,
      tooltip: language === "fr" ? "Contrats construction avec annexe O&M intégrée" : "Construction contracts with integrated O&M annex",
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
      tooltip: language === "fr" ? "Autorisations d'accès aux données Hydro-Québec" : "Hydro-Québec data access authorizations",
    },
    {
      title: language === "fr" ? "Import en lot" : "Batch Import",
      url: "/app/import",
      icon: Upload,
      tooltip: language === "fr" ? "Importer des prospects via fichier CSV" : "Import prospects from CSV files",
    },
    {
      title: language === "fr" ? "Intelligence marché" : "Market Intelligence",
      url: "/app/market-intelligence/pricing",
      icon: Target,
      tooltip: language === "fr" ? "Prix fournisseurs, historique et tendances" : "Supplier pricing, history and trends",
    },
    {
      title: language === "fr" ? "Méthodologie" : "Methodology",
      url: "/app/methodology",
      icon: BookOpen,
      tooltip: language === "fr" ? "Hypothèses et explications des calculs" : "Calculation assumptions and explanations",
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

  // Collapsible state for each section - collapse more on mobile
  const getDefaultSections = (mobile: boolean) => ({
    development: true,
    engineering: !mobile, // Collapse on mobile
    construction: false,
    operations: false,
    admin: false,
  });

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(getDefaultSections(false));

  // Update collapsed state when switching to/from mobile
  useEffect(() => {
    setOpenSections(getDefaultSections(isMobile));
  }, [isMobile]);

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Check if any item in a section is active
  const hasSectionActiveItem = (items: typeof businessDevItems) => {
    return items.some(item => isActive(item.url));
  };

  // Collapsible Section Component
  const CollapsibleSection = ({ 
    id, 
    label, 
    icon: Icon, 
    items 
  }: { 
    id: string; 
    label: string; 
    icon: typeof Cog; 
    items: typeof businessDevItems;
  }) => {
    const isOpen = openSections[id] || hasSectionActiveItem(items);
    const sectionRef = useRef<HTMLDivElement>(null);
    
    const handleOpenChange = (open: boolean) => {
      setOpenSections(prev => ({ ...prev, [id]: open }));
      
      // If opening (not closing), scroll to show the expanded content
      if (open) {
        // Wait for animation to complete then scroll the last item into view
        setTimeout(() => {
          if (!sectionRef.current) return;
          
          // Find the last menu item in the collapsible content
          const menuItems = sectionRef.current.querySelectorAll('[data-sidebar="menu-item"]');
          const lastItem = menuItems[menuItems.length - 1];
          
          if (lastItem) {
            lastItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 350);
      }
    };
    
    return (
      <div ref={sectionRef}>
        <SidebarGroup>
          <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
          <CollapsibleTrigger asChild>
            <button 
              className="flex items-center justify-between w-full px-2 py-1.5 text-xs font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 rounded-md transition-colors"
              data-testid={`sidebar-section-${id}`}
            >
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarGroupContent className="mt-1">
              <SidebarMenu>
                {items.map((item) => (
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
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>
      </div>
    );
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3 md:px-4 md:py-4">
        <Link href={isClient ? "/app/portal" : "/app"}>
          <img 
            src={currentLogo} 
            alt="kWh Québec" 
            className="h-[3.75rem] w-auto"
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
            {/* Section 1: Développement Commercial - Always visible, not collapsible */}
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

            {/* Section 2: Ingénierie - Collapsible */}
            <CollapsibleSection 
              id="engineering"
              label={language === "fr" ? "Ingénierie" : "Engineering"}
              icon={Cog}
              items={engineeringItems}
            />

            {/* Section 3: Construction - Collapsible */}
            <CollapsibleSection 
              id="construction"
              label={language === "fr" ? "Construction" : "Construction"}
              icon={Hammer}
              items={constructionItems}
            />

            {/* Section 4: O&M - Collapsible */}
            <CollapsibleSection 
              id="operations"
              label="O&M"
              icon={Wrench}
              items={operationsItems}
            />

            {/* Section 5: Administration - Collapsible */}
            {isAdmin && (
              <CollapsibleSection 
                id="admin"
                label={t("sidebar.admin") || "Administration"}
                icon={Settings}
                items={adminItems}
              />
            )}
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t px-3 py-2 md:px-4 md:py-3">
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

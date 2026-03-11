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
  LogOut,
  FolderOpen,
  FolderKanban,
  UserCog,
  Target,
  FileCheck,
  HardHat,
  Wrench,
  GanttChart,
  ListTodo,
  Gauge,
  ClipboardList,
  ChevronDown,
  Settings,
  Settings2,
  BookOpen,
  FileEdit,
  Rocket,
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
import { useSectionStats, type SectionLevel } from "@/hooks/use-section-stats";
import sidebarLogoFr from "@assets/solaire_fr-removebg-preview_1767985380511.png";
import sidebarLogoEn from "@assets/solaire_en-removebg-preview_1767985380510.png";

interface NavItem {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  tooltip: string;
}

export function AppSidebar({ forceClientView, previewClientName }: { forceClientView?: boolean; previewClientName?: string } = {}) {
  const { t, language } = useI18n();
  const { user, logout, isStaff: rawIsStaff, isClient: rawIsClient, isAdmin } = useAuth();
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const currentLogo = language === "fr" ? sidebarLogoFr : sidebarLogoEn;
  const sectionStats = useSectionStats();

  const isStaff = forceClientView ? false : rawIsStaff;
  const isClient = forceClientView ? true : rawIsClient;

  // ─── Dashboard + EOS (always visible, not collapsible) ────────────
  const dashboardItems: NavItem[] = [
    {
      title: t("nav.dashboard"),
      url: "/app",
      icon: LayoutDashboard,
      tooltip: language === "fr" ? "Vue d'ensemble du pipeline et des opportunités" : "Pipeline and opportunities overview",
    },
    {
      title: "EOS",
      url: "/app/eos",
      icon: Rocket,
      tooltip: language === "fr" ? "Entrepreneurial Operating System — Scorecard, Rocks, L10" : "Entrepreneurial Operating System — Scorecard, Rocks, L10",
    },
  ];

  // ─── SECTION 1: Exploration ───────────────────────────────────────
  const explorationItems: NavItem[] = [
    {
      title: language === "fr" ? "Pipeline ventes" : "Sales Pipeline",
      url: "/app/pipeline",
      icon: Target,
      tooltip: language === "fr" ? "Commencez ici pour un nouveau lead – suivi des opportunités" : "Start here for new leads – opportunity tracking",
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
      tooltip: language === "fr" ? "Regroupements de sites pour appels d'offres" : "Site groupings for RFPs and proposals",
    },
  ];

  // ─── SECTION 2: Conception ────────────────────────────────────────
  const designItems: NavItem[] = [
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
      title: language === "fr" ? "Pricing & Catalogue" : "Pricing & Catalog",
      url: "/app/pricing-catalog",
      icon: Package,
      tooltip: language === "fr" ? "Composants, prix internes, fournisseurs et concurrence" : "Components, internal pricing, suppliers and competitive intel",
    },
  ];

  // ─── SECTION 3: Réalisation ───────────────────────────────────────
  const constructionItems: NavItem[] = [
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
    {
      title: language === "fr" ? "Entente construction + O&M" : "Construction + O&M Agreement",
      url: "/app/construction-agreements",
      icon: ClipboardList,
      tooltip: language === "fr" ? "Contrats construction avec annexe O&M intégrée" : "Construction contracts with integrated O&M annex",
    },
  ];

  // ─── SECTION 4: Opération ─────────────────────────────────────────
  const operationsItems: NavItem[] = [
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

  // ─── SECTION 5: Admin (cleaned up) ───────────────────────────────
  // Removed: Procurations, HQ Data (→ Site Detail), Import, News, Market Intel (→ merged)
  const adminItems: NavItem[] = [
    {
      title: t("nav.userManagement") || "User Management",
      url: "/app/users",
      icon: UserCog,
      tooltip: language === "fr" ? "Gestion des comptes utilisateurs" : "User account management",
    },
    {
      title: language === "fr" ? "Contenu" : "Content",
      url: "/app/content-manager",
      icon: FileEdit,
      tooltip: language === "fr" ? "Gestion du contenu du site" : "Site content management",
    },
    {
      title: language === "fr" ? "Méthodologie" : "Methodology",
      url: "/app/methodology",
      icon: BookOpen,
      tooltip: language === "fr" ? "Hypothèses et explications des calculs" : "Calculation assumptions and explanations",
    },
    {
      title: language === "fr" ? "Paramètres" : "Settings",
      url: "/app/admin/settings",
      icon: Settings2,
      tooltip: language === "fr" ? "Paramètres système" : "System settings",
    },
  ];

  const clientItems: NavItem[] = [
    {
      title: t("nav.mySites") || "My Sites",
      url: "/app/portal",
      icon: FolderOpen,
      tooltip: language === "fr" ? "Mes sites et projets" : "My sites and projects",
    },
  ];

  const isActive = (url: string) => {
    if (url === "/app" || url === "/app/portal") {
      return location === url;
    }
    // Handle pricing-catalog matching for old URLs too
    if (url === "/app/pricing-catalog") {
      return location.startsWith("/app/pricing-catalog") ||
        location.startsWith("/app/catalog") ||
        location.startsWith("/app/admin/pricing") ||
        location.startsWith("/app/market-intelligence");
    }
    return location.startsWith(url);
  };

  // ─── Dynamic Spotlight Logic ──────────────────────────────────────
  const sectionRouteMap: Record<string, NavItem[]> = {
    exploration: explorationItems,
    conception: designItems,
    construction: constructionItems,
    operations: operationsItems,
  };

  const hasSectionActiveRoute = (sectionId: string): boolean => {
    const items = sectionRouteMap[sectionId];
    return items ? items.some((item) => isActive(item.url)) : false;
  };

  const getSectionLevel = (sectionId: string): SectionLevel => {
    return sectionStats.getLevel(sectionId, hasSectionActiveRoute(sectionId));
  };

  // ─── UI Helpers ───────────────────────────────────────────────────
  const getRoleBadge = () => {
    if (isAdmin) return { label: "Admin", variant: "default" as const };
    if (isStaff) return { label: "Analyst", variant: "secondary" as const };
    if (isClient) return { label: "Client", variant: "outline" as const };
    return { label: "User", variant: "outline" as const };
  };

  const roleBadge = getRoleBadge();

  const getDefaultSections = (mobile: boolean) => ({
    exploration: true,
    design: !mobile,
    construction: false,
    operations: false,
    admin: false,
  });

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(getDefaultSections(false));

  useEffect(() => {
    setOpenSections(getDefaultSections(isMobile));
  }, [isMobile]);

  // ─── Collapsible Section with Spotlight Styling ───────────────────
  const CollapsibleSection = ({
    id,
    label,
    icon: Icon,
    items,
    labelColor = "text-sidebar-foreground",
    sectionId,
    futureLabel,
  }: {
    id: string;
    label: string;
    icon: typeof Settings;
    items: NavItem[];
    labelColor?: string;
    sectionId?: string; // for spotlight logic (exploration, conception, etc.)
    futureLabel?: string; // shown as badge when section is "future"
  }) => {
    const level = sectionId ? getSectionLevel(sectionId) : "available";
    const count = sectionId ? sectionStats.counts[sectionId as keyof typeof sectionStats.counts] : undefined;
    const isOpen = openSections[id] || items.some((item) => isActive(item.url));
    const sectionRef = useRef<HTMLDivElement>(null);

    const handleOpenChange = (open: boolean) => {
      setOpenSections((prev) => ({ ...prev, [id]: open }));
      if (open) {
        setTimeout(() => {
          if (!sectionRef.current) return;
          const menuItems = sectionRef.current.querySelectorAll('[data-sidebar="menu-item"]');
          const lastItem = menuItems[menuItems.length - 1];
          if (lastItem) {
            lastItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        }, 350);
      }
    };

    // Visual styles per level
    const triggerClass =
      level === "spotlight"
        ? "font-semibold text-sidebar-foreground"
        : level === "future"
          ? "text-sidebar-foreground/40"
          : "text-sidebar-foreground/70";

    const iconClass =
      level === "spotlight"
        ? `${labelColor} opacity-100`
        : level === "future"
          ? "text-sidebar-foreground/30"
          : `${labelColor} opacity-70`;

    const itemTextClass =
      level === "future" ? "text-muted-foreground/50 text-[13px]" : "";

    return (
      <div ref={sectionRef}>
        <SidebarGroup>
          <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
            <CollapsibleTrigger asChild>
              <button
                className={`flex items-center justify-between w-full px-2 py-1.5 text-xs font-medium hover:text-sidebar-foreground hover:bg-sidebar-accent/50 rounded-md transition-colors ${triggerClass}`}
                data-testid={`sidebar-section-${id}`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${iconClass}`} />
                  <span>{label}</span>
                  {level === "spotlight" && count !== undefined && count > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-1 bg-primary/10 text-primary">
                      {count}
                    </Badge>
                  )}
                  {level === "future" && futureLabel && (
                    <span className="text-[10px] text-muted-foreground/40 ml-1">
                      {futureLabel}
                    </span>
                  )}
                </div>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""} ${
                    level === "future" ? "opacity-40" : ""
                  }`}
                />
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
                          <item.icon className={`w-4 h-4 ${level === "future" ? "opacity-40" : ""}`} />
                          <span className={itemTextClass}>{item.title}</span>
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
        <a href="/" data-testid="link-logo-home">
          <img
            src={currentLogo}
            alt={language === "fr" ? "Logo kWh Québec – CRM solaire" : "kWh Québec Logo – Solar CRM"}
            className="h-[3.75rem] w-auto"
            data-testid="logo-sidebar"
          />
        </a>
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
            {/* Dashboard + EOS — Always visible at top, not collapsible */}
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {dashboardItems.map((item) => (
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

            {/* Section 1: Exploration — Dynamic Spotlight */}
            <CollapsibleSection
              id="exploration"
              label={language === "fr" ? "Exploration" : "Exploration"}
              icon={Target}
              items={explorationItems}
              labelColor="text-emerald-500"
              sectionId="exploration"
            />

            {/* Section 2: Conception — Dynamic Spotlight */}
            <CollapsibleSection
              id="design"
              label={language === "fr" ? "Conception" : "Design"}
              icon={PenTool}
              items={designItems}
              labelColor="text-blue-500"
              sectionId="conception"
            />

            {/* Section 3: Réalisation — Dynamic Spotlight */}
            <CollapsibleSection
              id="construction"
              label={language === "fr" ? "Réalisation" : "Construction"}
              icon={HardHat}
              items={constructionItems}
              labelColor="text-amber-500"
              sectionId="construction"
              futureLabel={language === "fr" ? "bientôt" : "coming soon"}
            />

            {/* Section 4: Opération — Dynamic Spotlight */}
            <CollapsibleSection
              id="operations"
              label={language === "fr" ? "Opération" : "Operations"}
              icon={Wrench}
              items={operationsItems}
              labelColor="text-green-500"
              sectionId="operations"
              futureLabel={language === "fr" ? "bientôt" : "coming soon"}
            />

            {/* Section 5: Administration (admin only, cleaned up) */}
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
                {forceClientView
                  ? previewClientName?.charAt(0).toUpperCase() || "C"
                  : (user?.name || user?.email)?.charAt(0).toUpperCase() || "U"}
              </span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">
                {forceClientView ? previewClientName || "Client" : user?.name || user?.email || "User"}
              </div>
              <div className="flex items-center gap-1">
                <Badge variant={roleBadge.variant} className="text-[10px] h-4 px-1">
                  {roleBadge.label}
                </Badge>
                {(forceClientView ? previewClientName : user?.clientName) && (
                  <span className="text-xs text-muted-foreground truncate">
                    {forceClientView ? previewClientName : user?.clientName}
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

import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  BarChart3, 
  PenTool,
  Package,
  LogOut,
  Zap
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
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

export function AppSidebar() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const mainItems = [
    {
      title: t("nav.dashboard"),
      url: "/app",
      icon: LayoutDashboard,
    },
    {
      title: t("nav.clients"),
      url: "/app/clients",
      icon: Users,
    },
    {
      title: t("nav.sites"),
      url: "/app/sites",
      icon: Building2,
    },
  ];

  const analysisItems = [
    {
      title: t("nav.analyses"),
      url: "/app/analyses",
      icon: BarChart3,
    },
    {
      title: t("nav.designs"),
      url: "/app/designs",
      icon: PenTool,
    },
    {
      title: t("nav.catalog"),
      url: "/app/catalog",
      icon: Package,
    },
  ];

  const isActive = (url: string) => {
    if (url === "/app") {
      return location === "/app";
    }
    return location.startsWith(url);
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <Link href="/app" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold">kWh Québec</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("sidebar.main")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
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

        <SidebarGroup>
          <SidebarGroupLabel>{t("sidebar.analysis")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {analysisItems.map((item) => (
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
      </SidebarContent>

      <SidebarFooter className="border-t px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
              <span className="text-sm font-medium">
                {user?.email?.charAt(0).toUpperCase() || "U"}
              </span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{user?.email || "User"}</div>
              <div className="text-xs text-muted-foreground">Admin</div>
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

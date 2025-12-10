import { Switch, Route, useLocation, Redirect } from "wouter";
import { Suspense, lazy } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { GlobalSearch } from "@/components/global-search";
import { AppSidebar } from "@/components/app-sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import ClientsPage from "@/pages/clients";
import SitesPage from "@/pages/sites";
import NotFound from "@/pages/not-found";

const SiteDetailPage = lazy(() => import("@/pages/site-detail"));
const AnalysesPage = lazy(() => import("@/pages/analyses"));
const DesignPage = lazy(() => import("@/pages/design"));
const DesignsPage = lazy(() => import("@/pages/designs"));
const CatalogPage = lazy(() => import("@/pages/catalog"));
const MethodologyPage = lazy(() => import("@/pages/methodology"));
const ClientPortalPage = lazy(() => import("@/pages/client-portal"));
const UsersPage = lazy(() => import("@/pages/users"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <Skeleton className="h-12 w-12 rounded-xl mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    setLocation("/login");
    return null;
  }

  return <>{children}</>;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-4 px-4 h-14 border-b shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex-1 flex items-center justify-center max-w-xl">
              <GlobalSearch />
            </div>
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppRoutes() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />

      {/* Protected routes */}
      <Route path="/app">
        <ProtectedRoute>
          <AppLayout>
            <DashboardPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/app/clients">
        <ProtectedRoute>
          <AppLayout>
            <ClientsPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/app/clients/:clientId/sites">
        <ProtectedRoute>
          <AppLayout>
            <SitesPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/app/sites">
        <ProtectedRoute>
          <AppLayout>
            <SitesPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/app/sites/:id">
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <SiteDetailPage />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/app/analyses">
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <AnalysesPage />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/app/analyses/:simulationId/design">
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <DesignPage />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/app/designs">
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <DesignsPage />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/app/catalog">
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <CatalogPage />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/app/methodology">
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <MethodologyPage />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>

      {/* Client Portal */}
      <Route path="/app/portal">
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <ClientPortalPage />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>

      {/* Admin User Management */}
      <Route path="/app/users">
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <UsersPage />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>

      {/* Fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <AppRoutes />
          </TooltipProvider>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

export default App;

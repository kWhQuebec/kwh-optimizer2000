import { Switch, Route, useLocation, Redirect } from "wouter";
import { Suspense, lazy, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { I18nProvider } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { initGA4, captureUTMParams } from "@/lib/analytics";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { GlobalSearch } from "@/components/global-search";
import { GlobalActionBar } from "@/components/global-action-bar";
import { AppSidebar } from "@/components/app-sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { AIChatWidget } from "@/components/ai-chat-widget";

import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import ForgotPasswordPage from "@/pages/forgot-password";
import ChangePasswordPage from "@/pages/change-password";
import AnalyseDetailleePage from "@/pages/analyse-detaillee";
import AutorisationHQPage from "@/pages/autorisation-hq";
import DashboardPage from "@/pages/dashboard";
import ClientsPage from "@/pages/clients";
import SitesPage from "@/pages/sites";
import RessourcesPage from "@/pages/ressources";
import BlogPage from "@/pages/blog";
import BlogArticlePage from "@/pages/blog-article";
import PortfolioPage from "@/pages/portfolio";
import PortfolioProjectPage from "@/pages/portfolio-project";
import PrivacyPage from "@/pages/privacy";
import TermsPage from "@/pages/terms";
import NotFound from "@/pages/not-found";

const SiteDetailPage = lazy(() => import("@/pages/site-detail"));
const AnalysesPage = lazy(() => import("@/pages/analyses"));
const DesignPage = lazy(() => import("@/pages/design"));
const DesignsPage = lazy(() => import("@/pages/designs"));
const CatalogPage = lazy(() => import("@/pages/catalog"));
const MethodologyPage = lazy(() => import("@/pages/methodology"));
const ClientPortalPage = lazy(() => import("@/pages/client-portal"));
const UsersPage = lazy(() => import("@/pages/users"));
const ProcurationsPage = lazy(() => import("@/pages/procurations"));
const SignAgreementPage = lazy(() => import("@/pages/sign-agreement"));
const PortfoliosPage = lazy(() => import("@/pages/portfolios"));
const PortfolioDetailPage = lazy(() => import("@/pages/portfolio-detail"));
const MarketIntelligencePage = lazy(() => import("@/pages/market-intelligence"));
const ConstructionAgreementsPage = lazy(() => import("@/pages/construction-agreements"));
const ConstructionProjectsPage = lazy(() => import("@/pages/construction-projects"));
const ConstructionGanttPage = lazy(() => import("@/pages/construction-gantt"));
const ConstructionTasksPage = lazy(() => import("@/pages/construction-tasks"));
const OmContractsPage = lazy(() => import("@/pages/om-contracts"));
const OmVisitsPage = lazy(() => import("@/pages/om-visits"));
const OmPerformancePage = lazy(() => import("@/pages/om-performance"));
const PipelinePage = lazy(() => import("@/pages/pipeline"));
const PartnershipsPage = lazy(() => import("@/pages/partnerships"));
const SiteVisitFormPage = lazy(() => import("@/pages/site-visit-form"));
const BatchImportPage = lazy(() => import("@/pages/batch-import"));
const PresentationPage = lazy(() => import("@/pages/presentation"));
const AdminPricingPage = lazy(() => import("@/pages/admin-pricing"));
const MarketIntelligencePricingPage = lazy(() => import("@/pages/market-intelligence-pricing"));
const WorkQueuePage = lazy(() => import("@/pages/work-queue"));
const ContentManager = lazy(() => import("@/pages/content-manager"));
const AdminSettingsPage = lazy(() => import("@/pages/admin-settings"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
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

  if (user?.forcePasswordChange) {
    setLocation("/change-password");
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
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-background focus:text-foreground focus:border">
        Skip to main content
      </a>
      <SidebarProvider style={style as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-col flex-1 min-w-0">
            <header className="flex items-center justify-between gap-4 px-4 h-14 border-b shrink-0" aria-label="Top bar">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div className="flex-1 flex items-center justify-center max-w-xl">
                <GlobalSearch />
              </div>
              <div className="flex items-center gap-2">
                <LanguageToggle />
                <ThemeToggle />
              </div>
            </header>
            <main id="main-content" className="flex-1 overflow-auto p-6">
              {children}
            </main>
        </div>
      </div>
        <GlobalActionBar />
        <AIChatWidget />
      </SidebarProvider>
    </>
  );
}

// Scroll to top on route changes for public pages only
// Also handles hash-based anchor navigation for SPAs
function ScrollToTop() {
  const [location] = useLocation();
  
  // Handle scroll on route changes
  useEffect(() => {
    // Only process public routes (not /app/* dashboard routes)
    const isPublicRoute = !location.startsWith('/app');
    if (!isPublicRoute) return;
    
    // Capture hash synchronously
    const currentHash = window.location.hash;
    
    if (currentHash) {
      // Hash navigation: wait for the target element to exist, then scroll
      const elementId = currentHash.slice(1); // Remove the '#'
      let attempts = 0;
      const maxAttempts = 20; // Max ~1 second of polling
      
      const tryScroll = () => {
        const targetElement = document.getElementById(elementId);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (attempts < maxAttempts) {
          attempts++;
          requestAnimationFrame(tryScroll);
        }
        // If element not found after max attempts, don't scroll to top - stay where we are
      };
      
      requestAnimationFrame(tryScroll);
    } else {
      // No hash: scroll to top immediately
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [location]);
  
  // Listen for hash changes (same-page anchor clicks)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash) {
        const elementId = hash.slice(1);
        const targetElement = document.getElementById(elementId);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };
    
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  
  return null;
}

function AppRoutes() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={LandingPage} />
      {/* Redirect old pages to landing page */}
      <Route path="/services">{() => <Redirect to="/" />}</Route>
      <Route path="/comment-ca-marche">{() => <Redirect to="/" />}</Route>
      <Route path="/ressources" component={RessourcesPage} />
      <Route path="/blog" component={BlogPage} />
      <Route path="/blog/:slug" component={BlogArticlePage} />
      <Route path="/analyse-detaillee" component={AnalyseDetailleePage} />
      <Route path="/autorisation-hq" component={AutorisationHQPage} />
      <Route path="/portfolio" component={PortfolioPage} />
      <Route path="/portfolio/:id" component={PortfolioProjectPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/conditions" component={TermsPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/change-password" component={ChangePasswordPage} />
      <Route path="/sign/:token">
        <Suspense fallback={<PageLoader />}>
          <SignAgreementPage />
        </Suspense>
      </Route>

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

      {/* Mobile-friendly site visit form - no sidebar for field use */}
      <Route path="/app/site-visit/:siteId">
        <ProtectedRoute>
          <Suspense fallback={<PageLoader />}>
            <SiteVisitFormPage />
          </Suspense>
        </ProtectedRoute>
      </Route>

      {/* Presentation mode - full screen, no sidebar for projection */}
      <Route path="/app/presentation/:id">
        <ProtectedRoute>
          <Suspense fallback={<PageLoader />}>
            <PresentationPage />
          </Suspense>
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

      <Route path="/app/construction-agreements">
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <ConstructionAgreementsPage />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/app/construction-projects">
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <ConstructionProjectsPage />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/app/construction-gantt">
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <ConstructionGanttPage />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/app/construction-tasks">
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <ConstructionTasksPage />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/app/om-contracts">
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <OmContractsPage />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/app/om-visits">
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <OmVisitsPage />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/app/om-performance/:siteId">
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <OmPerformancePage />
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

      {/* Work Queue */}
      <Route path="/app/work-queue">
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <WorkQueuePage />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>

      {/* Admin Procurations */}
      <Route path="/app/procurations">
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <ProcurationsPage />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>

      {/* Admin Market Intelligence */}
      <Route path="/app/market-intelligence">
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <MarketIntelligencePage />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>

      {/* Market Intelligence - Pricing (Suppliers & Price History) */}
      <Route path="/app/market-intelligence/pricing">
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <MarketIntelligencePricingPage />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>

      {/* Admin Pricing Components */}
      <Route path="/app/admin/pricing">
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <AdminPricingPage />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>

      {/* Admin Settings */}
      <Route path="/app/admin/settings">
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <AdminSettingsPage />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>

      {/* Admin Content Manager */}
      <Route path="/app/content-manager">
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <ContentManager />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>

      {/* Portfolios */}
      <Route path="/app/portfolios">
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <PortfoliosPage />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/app/portfolios/:id">
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <PortfolioDetailPage />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>

      {/* Sales Pipeline */}
      <Route path="/app/pipeline">
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <PipelinePage />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>

      {/* Partnerships */}
      <Route path="/app/partnerships">
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <PartnershipsPage />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>

      {/* Batch Import */}
      <Route path="/app/import">
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <BatchImportPage />
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
  useEffect(() => {
    initGA4();
    captureUTMParams();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <TooltipProvider>
            <ScrollToTop />
            <Toaster />
            <AppRoutes />
          </TooltipProvider>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

export default App;

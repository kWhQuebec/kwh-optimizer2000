import { Switch, Route, useLocation, useParams, Redirect } from "wouter";
import { Suspense, lazy, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { I18nProvider, useI18n } from "@/lib/i18n";
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
import { CookieConsent, getCookieConsent } from "@/components/cookie-consent";
import { HQJobNotifier } from "@/components/HQJobNotifier";

import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import ForgotPasswordPage from "@/pages/forgot-password";
import ChangePasswordPage from "@/pages/change-password";
import AnalyseDetailleePage from "@/pages/analyse-detaillee";
import AutorisationHQPage from "@/pages/autorisation-hq";
import ThankYouPage from "@/pages/thank-you";
import MandatConceptionPage from "@/pages/mandat-conception";
import DashboardPage from "@/pages/dashboard";
import ClientsPage from "@/pages/clients";
import SitesPage from "@/pages/sites";
import RessourcesPage from "@/pages/ressources";
import CalculateurROIPage from "@/pages/calculateur-roi";
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
const HQDataFetchPage = lazy(() => import("@/pages/hq-data-fetch"));
const CallScriptPage = lazy(() => import("@/pages/call-script"));
const ConversionDashboardPage = lazy(() => import("@/pages/conversion-dashboard").then(m => ({ default: m.ConversionDashboard })));
const LcoeComparisonPage = lazy(() => import("@/pages/lcoe-comparison"));
const EOSPage = lazy(() => import("@/pages/eos"));
const AdminNewsPage = lazy(() => import("@/pages/admin-news"));
const NouvelleDetailPage = lazy(() => import("@/pages/nouvelle-detail"));

import NouvellesPage from "@/pages/nouvelles";

function PortalPreviewRoute() {
  const params = useParams<{ clientId: string }>();
  const { language } = useI18n();
  const { data: clientData } = useQuery<{ id: string; name: string }>({
    queryKey: ["/api/clients", params.clientId],
    enabled: !!params.clientId,
  });
  const previewClientName = clientData?.name || "Client";

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-background focus:text-foreground focus:border">
        {language === "fr" ? "Aller au contenu principal" : "Skip to main content"}
      </a>
      <SidebarProvider style={style as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar forceClientView previewClientName={previewClientName} />
          <div className="flex flex-col flex-1 min-w-0">
            <header className="flex items-center justify-between gap-4 px-4 h-14 border-b shrink-0" aria-label="Top bar">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div className="flex-1" />
              <div className="flex items-center gap-2">
                <LanguageToggle />
                <ThemeToggle />
              </div>
            </header>
            <main id="main-content" className="flex-1 overflow-auto p-6 pb-24">
              <Suspense fallback={<PageLoader />}>
                <ClientPortalPage previewClientId={params.clientId} />
              </Suspense>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </>
  );
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();

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
    return <Redirect to="/login" />;
  }

  if (user?.forcePasswordChange) {
    return <Redirect to="/change-password" />;
  }

  return <>{children}</>;
}

function StaffRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return null;
  
  if (user?.role === "client") {
    return <Redirect to="/app/portal" />;
  }

  return <>{children}</>;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const { language } = useI18n();
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-background focus:text-foreground focus:border">
        {language === "fr" ? "Aller au contenu principal" : "Skip to main content"}
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
            <main id="main-content" className="flex-1 overflow-auto p-6 pb-24">
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
      <Route path="/apropos">{() => <Redirect to="/" />}</Route>
      <Route path="/contact">{() => <Redirect to="/#analyse" />}</Route>
      <Route path="/ressources" component={RessourcesPage} />
      <Route path="/ressources/calculateur-roi-solaire" component={CalculateurROIPage} />
      <Route path="/blog" component={BlogPage} />
      <Route path="/blog/:slug" component={BlogArticlePage} />
      <Route path="/nouvelles/:slug">
        <Suspense fallback={<PageLoader />}>
          <NouvelleDetailPage />
        </Suspense>
      </Route>
      <Route path="/nouvelles" component={NouvellesPage} />
      <Route path="/analyse-detaillee" component={AnalyseDetailleePage} />
      <Route path="/autorisation-hq" component={AutorisationHQPage} />
      <Route path="/merci" component={ThankYouPage} />
      <Route path="/mandat-de-conception-preliminaire" component={MandatConceptionPage} />
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

      {/* Protected routes - Staff only */}
      <Route path="/app">
        <ProtectedRoute>
          <StaffRoute>
            <AppLayout>
              <DashboardPage />
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/app/clients">
        <ProtectedRoute>
          <StaffRoute>
            <AppLayout>
              <ClientsPage />
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/app/clients/:clientId/portal-preview">
        <ProtectedRoute>
          <StaffRoute>
            <PortalPreviewRoute />
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/app/clients/:clientId/sites">
        <ProtectedRoute>
          <StaffRoute>
            <AppLayout>
              <SitesPage />
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/app/sites">
        <ProtectedRoute>
          <StaffRoute>
            <AppLayout>
              <SitesPage />
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      {/* Site detail - accessible by both staff and clients (API filters by ownership) */}
      <Route path="/app/sites/:id">
        <ProtectedRoute>
          <AppLayout>
            <Suspense fallback={<PageLoader />}>
              <SiteDetailPage />
            </Suspense>
          </AppLayout>
        </ProtectedRoute>
      </Route>

      {/* Mobile-friendly site visit form - staff only */}
      <Route path="/app/site-visit/:siteId">
        <ProtectedRoute>
          <StaffRoute>
            <Suspense fallback={<PageLoader />}>
              <SiteVisitFormPage />
            </Suspense>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      {/* Presentation mode - staff only */}
      <Route path="/app/presentation/:id">
        <ProtectedRoute>
          <StaffRoute>
            <Suspense fallback={<PageLoader />}>
              <PresentationPage />
            </Suspense>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/app/analyses">
        <ProtectedRoute>
          <StaffRoute>
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <AnalysesPage />
              </Suspense>
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/app/analyses/:simulationId/design">
        <ProtectedRoute>
          <StaffRoute>
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <DesignPage />
              </Suspense>
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/app/designs">
        <ProtectedRoute>
          <StaffRoute>
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <DesignsPage />
              </Suspense>
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/app/construction-agreements">
        <ProtectedRoute>
          <StaffRoute>
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <ConstructionAgreementsPage />
              </Suspense>
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/app/construction-projects">
        <ProtectedRoute>
          <StaffRoute>
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <ConstructionProjectsPage />
              </Suspense>
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/app/construction-gantt">
        <ProtectedRoute>
          <StaffRoute>
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <ConstructionGanttPage />
              </Suspense>
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/app/construction-tasks">
        <ProtectedRoute>
          <StaffRoute>
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <ConstructionTasksPage />
              </Suspense>
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/app/om-contracts">
        <ProtectedRoute>
          <StaffRoute>
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <OmContractsPage />
              </Suspense>
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/app/om-visits">
        <ProtectedRoute>
          <StaffRoute>
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <OmVisitsPage />
              </Suspense>
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/app/om-performance/:siteId">
        <ProtectedRoute>
          <StaffRoute>
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <OmPerformancePage />
              </Suspense>
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/app/catalog">
        <ProtectedRoute>
          <StaffRoute>
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <CatalogPage />
              </Suspense>
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/app/methodology">
        <ProtectedRoute>
          <StaffRoute>
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <MethodologyPage />
              </Suspense>
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      {/* Client Portal - accessible by all authenticated users */}
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
          <StaffRoute>
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <UsersPage />
              </Suspense>
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      {/* Work Queue */}
      <Route path="/app/work-queue">
        <ProtectedRoute>
          <StaffRoute>
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <WorkQueuePage />
              </Suspense>
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      {/* Admin Procurations */}
      <Route path="/app/procurations">
        <ProtectedRoute>
          <StaffRoute>
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <ProcurationsPage />
              </Suspense>
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      {/* Admin Market Intelligence */}
      <Route path="/app/market-intelligence">
        <ProtectedRoute>
          <StaffRoute>
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <MarketIntelligencePage />
              </Suspense>
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      {/* Market Intelligence - Pricing */}
      <Route path="/app/market-intelligence/pricing">
        <ProtectedRoute>
          <StaffRoute>
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <MarketIntelligencePricingPage />
              </Suspense>
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      {/* Admin Pricing Components */}
      <Route path="/app/admin/pricing">
        <ProtectedRoute>
          <StaffRoute>
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <AdminPricingPage />
              </Suspense>
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      {/* Admin Settings */}
      <Route path="/app/admin/settings">
        <ProtectedRoute>
          <StaffRoute>
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <AdminSettingsPage />
              </Suspense>
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      {/* HQ Data Retrieval */}
      <Route path="/app/admin/hq-data">
        <ProtectedRoute>
          <StaffRoute>
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <HQDataFetchPage />
              </Suspense>
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      {/* Admin News Curation */}
      <Route path="/app/admin/news">
        <ProtectedRoute>
          <StaffRoute>
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <AdminNewsPage />
              </Suspense>
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      {/* Admin Content Manager */}
      <Route path="/app/content-manager">
        <ProtectedRoute>
          <StaffRoute>
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <ContentManager />
              </Suspense>
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      {/* Portfolios */}
      <Route path="/app/portfolios">
        <ProtectedRoute>
          <StaffRoute>
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <PortfoliosPage />
              </Suspense>
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      <Route path="/app/portfolios/:id">
        <ProtectedRoute>
          <StaffRoute>
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <PortfolioDetailPage />
              </Suspense>
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      {/* Sales Pipeline */}
      <Route path="/app/pipeline">
        <ProtectedRoute>
          <StaffRoute>
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <PipelinePage />
              </Suspense>
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      {/* LCOE Comparison Tool */}
      <Route path="/app/tools/lcoe-comparison">
        <ProtectedRoute>
          <StaffRoute>
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <LcoeComparisonPage />
              </Suspense>
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      {/* Partnerships */}
      <Route path="/app/partnerships">
        <ProtectedRoute>
          <StaffRoute>
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <PartnershipsPage />
              </Suspense>
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      {/* Batch Import */}
      <Route path="/app/import">
        <ProtectedRoute>
          <StaffRoute>
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <BatchImportPage />
              </Suspense>
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      {/* Call Script Wizard - Staff only */}
      <Route path="/app/leads/:id/call-script">
        <ProtectedRoute>
          <StaffRoute>
            <Suspense fallback={<PageLoader />}>
              <CallScriptPage />
            </Suspense>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      {/* Conversion Dashboard - Staff only */}
      <Route path="/app/analytics/conversion">
        <ProtectedRoute>
          <StaffRoute>
            <Suspense fallback={<PageLoader />}>
              <ConversionDashboardPage />
            </Suspense>
          </StaffRoute>
        </ProtectedRoute>
      </Route>


      {/* EOS - Entrepreneurial Operating System */}
      <Route path="/app/eos">
        <ProtectedRoute>
          <StaffRoute>
            <AppLayout>
              <Suspense fallback={<PageLoader />}>
                <EOSPage />
              </Suspense>
            </AppLayout>
          </StaffRoute>
        </ProtectedRoute>
      </Route>

      {/* Fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const initAnalytics = () => {
    if (getCookieConsent() === "accepted") {
      initGA4();
    }
  };

  useEffect(() => {
    initAnalytics();
    captureUTMParams();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <TooltipProvider>
            <ScrollToTop />
            <CookieConsent onAccept={initAnalytics} />
            <HQJobNotifier />
            <Toaster />
            <AppRoutes />
          </TooltipProvider>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

export default App;

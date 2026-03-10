import { Suspense, lazy, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n";
import { Package, DollarSign, TrendingUp, Swords, Loader2 } from "lucide-react";

const CatalogPage = lazy(() => import("@/pages/catalog"));
const AdminPricingPage = lazy(() => import("@/pages/admin-pricing"));
const MarketIntelligencePricingPage = lazy(() => import("@/pages/market-intelligence-pricing"));
const MarketIntelligencePage = lazy(() => import("@/pages/market-intelligence"));

function TabLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

const TAB_KEYS = ["catalog", "pricing", "suppliers", "competitive"] as const;
type TabKey = (typeof TAB_KEYS)[number];

export default function PricingCatalogPage() {
  const { language } = useI18n();

  // Sync tab with URL search params for deep-linking
  const getInitialTab = (): TabKey => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && TAB_KEYS.includes(tab as TabKey)) return tab as TabKey;
    return "catalog";
  };

  const [activeTab, setActiveTab] = useState<TabKey>(getInitialTab);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (activeTab === "catalog") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", activeTab);
    }
    window.history.replaceState({}, "", url.toString());
  }, [activeTab]);

  const tabs = [
    {
      key: "catalog" as TabKey,
      label: language === "fr" ? "Catalogue" : "Catalog",
      icon: Package,
    },
    {
      key: "pricing" as TabKey,
      label: language === "fr" ? "Prix internes" : "Internal Pricing",
      icon: DollarSign,
    },
    {
      key: "suppliers" as TabKey,
      label: language === "fr" ? "Fournisseurs" : "Suppliers",
      icon: TrendingUp,
    },
    {
      key: "competitive" as TabKey,
      label: language === "fr" ? "Concurrence" : "Competitive",
      icon: Swords,
    },
  ];

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="w-full">
      <TabsList className="grid w-full grid-cols-4 mb-4">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.key} value={tab.key} className="flex items-center gap-2 text-xs sm:text-sm">
            <tab.icon className="w-4 h-4 hidden sm:block" />
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="catalog">
        <Suspense fallback={<TabLoader />}>
          <CatalogPage />
        </Suspense>
      </TabsContent>

      <TabsContent value="pricing">
        <Suspense fallback={<TabLoader />}>
          <AdminPricingPage />
        </Suspense>
      </TabsContent>

      <TabsContent value="suppliers">
        <Suspense fallback={<TabLoader />}>
          <MarketIntelligencePricingPage />
        </Suspense>
      </TabsContent>

      <TabsContent value="competitive">
        <Suspense fallback={<TabLoader />}>
          <MarketIntelligencePage />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}

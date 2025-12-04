import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Search, Building2, Users, BarChart3, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useI18n } from "@/lib/i18n";
import type { Client, Site } from "@shared/schema";

interface SiteWithClient extends Site {
  client?: Client;
}

interface SimulationWithSite {
  id: string;
  siteId: string;
  label?: string | null;
  type: string;
  createdAt: string | Date | null;
  site?: Site;
}

export function GlobalSearch() {
  const { t, language } = useI18n();
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: sites } = useQuery<SiteWithClient[]>({
    queryKey: ["/api/sites"],
  });

  const { data: simulations } = useQuery<SimulationWithSite[]>({
    queryKey: ["/api/simulations"],
  });

  // Keyboard shortcut to open search
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (path: string) => {
    setOpen(false);
    setLocation(path);
  };

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-full justify-start text-sm text-muted-foreground sm:pr-12 md:w-40 lg:w-64"
        onClick={() => setOpen(true)}
        data-testid="button-global-search"
      >
        <Search className="mr-2 h-4 w-4" />
        <span className="hidden lg:inline-flex">
          {language === "fr" ? "Rechercher..." : "Search..."}
        </span>
        <span className="inline-flex lg:hidden">
          {language === "fr" ? "Rechercher" : "Search"}
        </span>
        <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput 
          placeholder={language === "fr" ? "Rechercher clients, sites, analyses..." : "Search clients, sites, analyses..."} 
          data-testid="input-global-search"
        />
        <CommandList>
          <CommandEmpty>
            {language === "fr" ? "Aucun résultat trouvé." : "No results found."}
          </CommandEmpty>

          {/* Clients */}
          {clients && clients.length > 0 && (
            <CommandGroup heading={t("nav.clients")}>
              {clients.slice(0, 5).map((client) => (
                <CommandItem
                  key={`client-${client.id}`}
                  value={`client ${client.name} ${client.email || ""}`}
                  onSelect={() => handleSelect(`/app/clients/${client.id}/sites`)}
                  data-testid={`search-result-client-${client.id}`}
                >
                  <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span>{client.name}</span>
                    {client.mainContactName && (
                      <span className="text-xs text-muted-foreground">{client.mainContactName}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandSeparator />

          {/* Sites */}
          {sites && sites.length > 0 && (
            <CommandGroup heading={t("nav.sites")}>
              {sites.slice(0, 5).map((site) => (
                <CommandItem
                  key={`site-${site.id}`}
                  value={`site ${site.name} ${site.client?.name || ""} ${site.city || ""}`}
                  onSelect={() => handleSelect(`/app/sites/${site.id}`)}
                  data-testid={`search-result-site-${site.id}`}
                >
                  <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span>{site.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {site.client?.name} {site.city && `• ${site.city}`}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandSeparator />

          {/* Simulations / Analyses */}
          {simulations && simulations.length > 0 && (
            <CommandGroup heading={t("nav.analyses")}>
              {simulations.slice(0, 5).map((sim) => (
                <CommandItem
                  key={`sim-${sim.id}`}
                  value={`analyse simulation ${sim.label || sim.id} ${sim.site?.name || ""}`}
                  onSelect={() => handleSelect(`/app/sites/${sim.siteId}`)}
                  data-testid={`search-result-sim-${sim.id}`}
                >
                  <BarChart3 className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span>{sim.label || `Analyse ${sim.createdAt ? new Date(sim.createdAt).toLocaleDateString() : sim.id.slice(0, 8)}`}</span>
                    <span className="text-xs text-muted-foreground">
                      {sim.site?.name}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandSeparator />

          {/* Quick Actions */}
          <CommandGroup heading={language === "fr" ? "Actions rapides" : "Quick Actions"}>
            <CommandItem
              onSelect={() => handleSelect("/app/clients")}
              data-testid="search-action-clients"
            >
              <Users className="mr-2 h-4 w-4" />
              {language === "fr" ? "Voir tous les clients" : "View all clients"}
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelect("/app/sites")}
              data-testid="search-action-sites"
            >
              <Building2 className="mr-2 h-4 w-4" />
              {language === "fr" ? "Voir tous les sites" : "View all sites"}
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelect("/app/analyses")}
              data-testid="search-action-analyses"
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              {language === "fr" ? "Voir toutes les analyses" : "View all analyses"}
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelect("/app/methodology")}
              data-testid="search-action-methodology"
            >
              <FileText className="mr-2 h-4 w-4" />
              {language === "fr" ? "Documentation méthodologique" : "Methodology Documentation"}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

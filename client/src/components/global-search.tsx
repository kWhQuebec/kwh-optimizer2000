import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Search, Building2, Users, Target } from "lucide-react";
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

interface SearchClient {
  id: string;
  name: string;
  mainContactName?: string | null;
  email?: string | null;
}

interface SearchSite {
  id: string;
  name: string;
  city?: string | null;
  clientName?: string | null;
}

interface SearchOpportunity {
  id: string;
  name: string;
  stage: string;
  estimatedValue?: number | null;
}

interface SearchResults {
  clients: SearchClient[];
  sites: SearchSite[];
  opportunities: SearchOpportunity[];
}

export function GlobalSearch() {
  const { t, language } = useI18n();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();

  const { data: searchResults, isLoading } = useQuery<SearchResults>({
    queryKey: ["/api/search", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) {
        return { clients: [], sites: [], opportunities: [] };
      }
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: open && searchQuery.length > 0,
    staleTime: 1000,
  });

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
    setSearchQuery("");
    setLocation(path);
  };

  const clients = searchResults?.clients || [];
  const sites = searchResults?.sites || [];
  const opportunities = searchResults?.opportunities || [];

  const hasResults = clients.length > 0 || sites.length > 0 || opportunities.length > 0;

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
          placeholder={language === "fr" ? "Rechercher clients, sites, opportunités..." : "Search clients, sites, opportunities..."} 
          value={searchQuery}
          onValueChange={setSearchQuery}
          data-testid="input-global-search"
        />
        <CommandList>
          {searchQuery.length === 0 ? (
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
                onSelect={() => handleSelect("/app/pipeline")}
                data-testid="search-action-pipeline"
              >
                <Target className="mr-2 h-4 w-4" />
                {language === "fr" ? "Voir toutes les opportunités" : "View all opportunities"}
              </CommandItem>
            </CommandGroup>
          ) : isLoading ? (
            <CommandEmpty>
              <div className="flex items-center justify-center py-6" data-testid="search-loading">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent mr-2" />
                {language === "fr" ? "Recherche en cours..." : "Searching..."}
              </div>
            </CommandEmpty>
          ) : !hasResults ? (
            <CommandEmpty data-testid="search-no-results">
              {language === "fr" ? "Aucun résultat trouvé." : "No results found."}
            </CommandEmpty>
          ) : (
            <>
              {clients.length > 0 && (
                <CommandGroup heading={language === "fr" ? "Clients" : "Clients"}>
                  {clients.map((client) => (
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

              {clients.length > 0 && (sites.length > 0 || opportunities.length > 0) && <CommandSeparator />}

              {sites.length > 0 && (
                <CommandGroup heading={language === "fr" ? "Sites" : "Sites"}>
                  {sites.map((site) => (
                    <CommandItem
                      key={`site-${site.id}`}
                      value={`site ${site.name} ${site.clientName || ""} ${site.city || ""}`}
                      onSelect={() => handleSelect(`/app/sites/${site.id}`)}
                      data-testid={`search-result-site-${site.id}`}
                    >
                      <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span>{site.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {site.clientName} {site.city && `• ${site.city}`}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {sites.length > 0 && opportunities.length > 0 && <CommandSeparator />}

              {opportunities.length > 0 && (
                <CommandGroup heading={language === "fr" ? "Opportunités" : "Opportunities"}>
                  {opportunities.map((opp) => (
                    <CommandItem
                      key={`opp-${opp.id}`}
                      value={`opportunity ${opp.name} ${opp.stage}`}
                      onSelect={() => handleSelect(`/app/pipeline`)}
                      data-testid={`search-result-opportunity-${opp.id}`}
                    >
                      <Target className="mr-2 h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span>{opp.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {opp.stage} {opp.estimatedValue && `• $${opp.estimatedValue.toLocaleString()}`}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}

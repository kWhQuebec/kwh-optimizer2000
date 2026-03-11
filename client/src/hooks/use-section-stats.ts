import { useQuery } from "@tanstack/react-query";

/**
 * Lightweight hook to check which workflow sections have data.
 * Used by the sidebar to dynamically spotlight active sections
 * and gray out future/empty ones.
 *
 * Each query uses a long staleTime (10 min) to avoid unnecessary
 * refetches. Failures gracefully default to "has data" so sections
 * never appear broken.
 */

interface SectionCounts {
  exploration: number;
  conception: number;
  construction: number;
  operations: number;
}

export type SectionLevel = "spotlight" | "available" | "future";

export function useSectionStats() {
  // Pipeline leads → Exploration phase
  const { data: leadsData } = useQuery<any[]>({
    queryKey: ["/api/leads"],
    staleTime: 10 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Simulations → Conception phase
  const { data: simulationsData } = useQuery<any[]>({
    queryKey: ["/api/simulations"],
    staleTime: 10 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Construction projects → Réalisation phase
  const { data: constructionData } = useQuery<any[]>({
    queryKey: ["/api/construction-projects"],
    staleTime: 10 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // O&M contracts → Opération phase
  const { data: omData } = useQuery<any[]>({
    queryKey: ["/api/om-contracts"],
    staleTime: 10 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const safeLen = (d: unknown): number => {
    if (Array.isArray(d)) return d.length;
    if (d && typeof d === "object" && "length" in d) return (d as any).length;
    // If data loaded but format unexpected, assume "has data"
    if (d !== undefined && d !== null) return 1;
    return 0;
  };

  const counts: SectionCounts = {
    exploration: safeLen(leadsData),
    conception: safeLen(simulationsData),
    construction: safeLen(constructionData),
    operations: safeLen(omData),
  };

  // Find the most advanced phase with data → that's the spotlight.
  // Earlier phases with data → available. Empty phases → future.
  const phases: (keyof SectionCounts)[] = [
    "operations",
    "construction",
    "conception",
    "exploration",
  ];

  let spotlightPhase: keyof SectionCounts = "exploration";
  for (const phase of phases) {
    if (counts[phase] > 0) {
      spotlightPhase = phase;
      break;
    }
  }

  /**
   * Determine visual level for a sidebar section.
   * @param sectionId - one of exploration, conception, construction, operations
   * @param isCurrentRoute - true if user is currently navigating this section
   */
  const getLevel = (
    sectionId: string,
    isCurrentRoute: boolean = false
  ): SectionLevel => {
    // Current route always gets spotlight
    if (isCurrentRoute) return "spotlight";
    // The most advanced active phase
    if (sectionId === spotlightPhase) return "spotlight";
    // Has data but not the main focus
    if (counts[sectionId as keyof SectionCounts] > 0) return "available";
    // No data yet
    return "future";
  };

  return { counts, spotlight: spotlightPhase, getLevel };
}

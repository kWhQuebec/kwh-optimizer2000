import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { RoofVisualization } from "@/components/RoofVisualization";

declare global {
  interface Window {
    __captureReady?: boolean;
    __captureToken?: string;
  }
}

export default function RoofCapturePage() {
  const params = new URLSearchParams(window.location.search);
  const siteId = params.get("siteId") || "";
  const pvSizeKW = parseFloat(params.get("pvSizeKW") || "0");

  const [authReady, setAuthReady] = useState(false);
  const readySignaled = useRef(false);

  useEffect(() => {
    const injectedToken = window.__captureToken;
    if (injectedToken) {
      localStorage.setItem("token", injectedToken);
    }
    setAuthReady(true);
    return () => {
      localStorage.removeItem("token");
    };
  }, []);

  const { data: site, isLoading: siteLoading, isError: siteError } = useQuery<any>({
    queryKey: ["/api/sites", siteId],
    enabled: authReady && !!siteId,
    retry: 1,
  });

  const signalReady = () => {
    if (readySignaled.current) return;
    readySignaled.current = true;
    window.__captureReady = true;
  };

  const handleVisualizationReady = () => {
    if (readySignaled.current) return;
    readySignaled.current = true;
    setTimeout(() => {
      window.__captureReady = true;
    }, 2000);
  };

  if (siteError || (!siteLoading && authReady && !site && siteId)) {
    signalReady();
    return <div id="capture-error" style={{ width: "100vw", height: "100vh", background: "#000", color: "#fff" }}>Error loading site</div>;
  }

  if (!authReady || siteLoading || !site) {
    return <div id="capture-loading" style={{ width: "100vw", height: "100vh", background: "#000" }} />;
  }

  if (!site.latitude || !site.longitude) {
    signalReady();
    return <div id="capture-error" style={{ width: "100vw", height: "100vh", background: "#000", color: "#fff" }}>No coordinates</div>;
  }

  return (
    <div id="capture-container" style={{ width: "100vw", height: "100vh", overflow: "hidden", position: "relative" }}>
      <style>{`
        body { margin: 0; padding: 0; overflow: hidden; }
        [data-testid="button-fullscreen"],
        [data-testid="button-open-roof-drawing"],
        [data-testid="button-export-image"],
        [data-testid="button-save-snapshot"],
        [data-testid="north-arrow-indicator"] {
          display: none !important;
        }
        [data-testid="capacity-slider-section"] {
          display: none !important;
        }
        [data-testid="roof-visualization"] {
          border-radius: 0 !important;
        }
        [data-testid="roof-visualization"] > div:first-child {
          height: 100vh !important;
          min-height: 100vh !important;
        }
      `}</style>
      <RoofVisualization
        siteId={siteId}
        siteName={site.name || ""}
        address={`${site.address || ""}${site.city ? `, ${site.city}` : ""}`}
        latitude={site.latitude}
        longitude={site.longitude}
        roofAreaSqFt={site.roofAreaSqFt || undefined}
        maxPVCapacityKW={pvSizeKW * 2 || 5000}
        currentPVSizeKW={pvSizeKW || undefined}
        onVisualizationReady={handleVisualizationReady}
        captureMode={true}
      />
    </div>
  );
}

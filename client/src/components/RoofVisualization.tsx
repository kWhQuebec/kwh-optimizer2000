import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Home, Sun, Zap, Maximize2, Layers, AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { RoofPolygon } from "@shared/schema";

interface RoofVisualizationProps {
  siteId: string;
  siteName: string;
  address: string;
  latitude: number;
  longitude: number;
  roofAreaSqFt?: number;
  maxPVCapacityKW?: number;
  currentPVSizeKW?: number;
}

export function RoofVisualization({
  siteId,
  siteName,
  address,
  latitude,
  longitude,
  roofAreaSqFt,
  maxPVCapacityKW,
  currentPVSizeKW,
}: RoofVisualizationProps) {
  const { language } = useI18n();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const polygonOverlaysRef = useRef<google.maps.Polygon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);

  const { data: roofPolygons = [] } = useQuery<RoofPolygon[]>({
    queryKey: ["/api/sites", siteId, "roof-polygons"],
  });

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const initializeMap = useCallback(() => {
    if (!mapContainerRef.current || !window.google) return;

    try {
      const map = new google.maps.Map(mapContainerRef.current, {
        center: { lat: latitude, lng: longitude },
        zoom: 19,
        mapTypeId: "satellite",
        disableDefaultUI: true,
        zoomControl: true,
        scaleControl: true,
        gestureHandling: "cooperative",
      });

      mapRef.current = map;
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to initialize map:", error);
      setMapError(language === "fr" ? "Erreur de chargement de la carte" : "Failed to load map");
      setIsLoading(false);
    }
  }, [latitude, longitude, language]);

  useEffect(() => {
    if (!apiKey) {
      setMapError(language === "fr" ? "Clé API Google Maps non configurée" : "Google Maps API key not configured");
      setIsLoading(false);
      return;
    }

    const scriptId = "google-maps-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=drawing,geometry`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const checkAndInit = () => {
      if (window.google && window.google.maps) {
        initializeMap();
      } else {
        setTimeout(checkAndInit, 100);
      }
    };

    if (script.getAttribute("data-loaded") === "true") {
      checkAndInit();
    } else {
      script.onload = () => {
        script!.setAttribute("data-loaded", "true");
        checkAndInit();
      };
      script.onerror = () => {
        setMapError(language === "fr" ? "Erreur de chargement Google Maps" : "Failed to load Google Maps");
        setIsLoading(false);
      };
    }
  }, [apiKey, initializeMap, language]);

  useEffect(() => {
    if (!mapRef.current || !window.google || roofPolygons.length === 0) return;

    polygonOverlaysRef.current.forEach((p) => p.setMap(null));
    polygonOverlaysRef.current = [];

    roofPolygons.forEach((polygon) => {
      const coords = polygon.coordinates as [number, number][];
      if (!coords || coords.length < 3) return;

      const path = coords.map(([lng, lat]) => ({ lat, lng }));

      const isConstraint = polygon.color === "#f97316" ||
                          polygon.label?.toLowerCase().includes("constraint") ||
                          polygon.label?.toLowerCase().includes("contrainte") ||
                          polygon.label?.toLowerCase().includes("hvac") ||
                          polygon.label?.toLowerCase().includes("obstacle");

      const color = isConstraint ? "#f97316" : (polygon.color || "#3b82f6");

      const googlePolygon = new google.maps.Polygon({
        paths: path,
        strokeColor: color,
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: color,
        fillOpacity: isConstraint ? 0.4 : 0.3,
        map: mapRef.current,
      });

      polygonOverlaysRef.current.push(googlePolygon);
    });

    return () => {
      polygonOverlaysRef.current.forEach((p) => {
        try { p.setMap(null); } catch (e) {}
      });
      polygonOverlaysRef.current = [];
    };
  }, [roofPolygons]);

  const isConstraintPolygon = (p: RoofPolygon) => {
    if (p.color === "#f97316") return true;
    const label = p.label?.toLowerCase() || "";
    return label.includes("constraint") || label.includes("contrainte") || 
           label.includes("hvac") || label.includes("obstacle");
  };

  const totalUsableArea = roofPolygons
    .filter((p) => !isConstraintPolygon(p))
    .reduce((sum, p) => sum + p.areaSqM, 0);

  const constraintArea = roofPolygons
    .filter((p) => isConstraintPolygon(p))
    .reduce((sum, p) => sum + p.areaSqM, 0);

  const handleFullscreen = () => {
    if (mapContainerRef.current?.parentElement) {
      mapContainerRef.current.parentElement.requestFullscreen?.();
    }
  };

  const hasPolygons = roofPolygons.length > 0;

  return (
    <div className="relative rounded-xl overflow-hidden" data-testid="roof-visualization">
      <div className="relative w-full h-56 md:h-72">
        <div ref={mapContainerRef} className="absolute inset-0" />
        
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
            <Skeleton className="h-full w-full" />
          </div>
        )}
        
        {mapError && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground z-10">
            <div className="flex flex-col items-center gap-2">
              <AlertTriangle className="w-8 h-8" />
              <p>{mapError}</p>
            </div>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
        
        <div className="absolute top-3 right-3 z-20">
          <Button
            size="icon"
            variant="secondary"
            className="bg-white/20 text-white border-white/30 backdrop-blur-sm hover:bg-white/30"
            onClick={handleFullscreen}
            data-testid="button-fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 z-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-white mb-1">{siteName}</h2>
              <p className="text-sm text-white/80">{address}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {hasPolygons && totalUsableArea > 0 && (
                <Badge variant="secondary" className="bg-blue-500/80 text-white border-blue-400/50 backdrop-blur-sm">
                  <Layers className="w-3 h-3 mr-1" />
                  {Math.round(totalUsableArea).toLocaleString()} m² {language === "fr" ? "utilisable" : "usable"}
                </Badge>
              )}
              {hasPolygons && constraintArea > 0 && (
                <Badge variant="secondary" className="bg-orange-500/80 text-white border-orange-400/50 backdrop-blur-sm">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {Math.round(constraintArea).toLocaleString()} m² {language === "fr" ? "contraintes" : "constraints"}
                </Badge>
              )}
              {roofAreaSqFt && (
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                  <Home className="w-3 h-3 mr-1" />
                  {roofAreaSqFt.toLocaleString()} pi²
                </Badge>
              )}
              {maxPVCapacityKW && (
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                  <Sun className="w-3 h-3 mr-1" />
                  {Math.round(maxPVCapacityKW)} kWc max
                </Badge>
              )}
              {currentPVSizeKW && (
                <Badge variant="secondary" className="bg-primary/80 text-white border-primary backdrop-blur-sm">
                  <Zap className="w-3 h-3 mr-1" />
                  {Math.round(currentPVSizeKW)} kWc
                </Badge>
              )}
            </div>
          </div>
        </div>

        {hasPolygons && (
          <div className="absolute top-3 left-3 z-20 flex flex-col gap-1">
            <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm px-2 py-1 rounded text-xs text-white">
              <div className="w-3 h-3 bg-blue-500/60 border border-blue-400 rounded-sm" />
              <span>{language === "fr" ? "Zone solaire" : "Solar area"}</span>
            </div>
            {constraintArea > 0 && (
              <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm px-2 py-1 rounded text-xs text-white">
                <div className="w-3 h-3 bg-orange-500/60 border border-orange-400 rounded-sm" />
                <span>{language === "fr" ? "Contraintes" : "Constraints"}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

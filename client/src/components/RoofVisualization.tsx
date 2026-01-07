import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
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

interface PanelPosition {
  lat: number;
  lng: number;
  widthDeg: number;
  heightDeg: number;
}

const PANEL_KW = 0.5; // Each 2m x 1m panel = ~500W

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
  const panelOverlaysRef = useRef<google.maps.Rectangle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [allPanelPositions, setAllPanelPositions] = useState<PanelPosition[]>([]);
  
  // Selected capacity defaults to recommended system, or max if no recommendation
  const defaultCapacity = currentPVSizeKW || maxPVCapacityKW || 100;
  const [selectedCapacityKW, setSelectedCapacityKW] = useState<number>(defaultCapacity);

  const { data: roofPolygons = [] } = useQuery<RoofPolygon[]>({
    queryKey: ["/api/sites", siteId, "roof-polygons"],
  });

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Calculate min/max for slider
  const minCapacity = Math.max(100, Math.round((maxPVCapacityKW || 1000) * 0.1));
  const maxCapacity = maxPVCapacityKW || 5000;

  // Update default when props change
  useEffect(() => {
    if (currentPVSizeKW) {
      setSelectedCapacityKW(currentPVSizeKW);
    }
  }, [currentPVSizeKW]);

  const initializeMap = useCallback(() => {
    if (!mapContainerRef.current || !window.google) return;

    try {
      const map = new google.maps.Map(mapContainerRef.current, {
        center: { lat: latitude, lng: longitude },
        zoom: 17,
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

  // Center map on solar (blue) polygons when they load
  useEffect(() => {
    if (!mapRef.current || !window.google || roofPolygons.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    let hasValidCoords = false;

    const solarPolygons = roofPolygons.filter((p) => {
      if (p.color === "#f97316") return false;
      const label = p.label?.toLowerCase() || "";
      return !label.includes("constraint") && !label.includes("contrainte") && 
             !label.includes("hvac") && !label.includes("obstacle");
    });

    solarPolygons.forEach((polygon) => {
      const coords = polygon.coordinates as [number, number][];
      if (!coords || coords.length < 3) return;
      
      coords.forEach(([lng, lat]) => {
        bounds.extend({ lat, lng });
        hasValidCoords = true;
      });
    });

    if (hasValidCoords) {
      // Calculate the center of the polygon bounds
      const center = bounds.getCenter();
      // First fit the bounds with equal padding
      mapRef.current.fitBounds(bounds, 60);
      // Then pan to center on the polygon center
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.panTo(center);
        }
      }, 100);
    }
  }, [roofPolygons]);

  useEffect(() => {
    if (!apiKey) {
      setMapError(language === "fr" ? "Clé API Google Maps non configurée" : "Google Maps API key not configured");
      setIsLoading(false);
      return;
    }

    if (window.google && window.google.maps) {
      initializeMap();
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

    if (window.google && window.google.maps) {
      initializeMap();
    } else {
      script.onload = () => {
        checkAndInit();
      };
      script.onerror = () => {
        setMapError(language === "fr" ? "Erreur de chargement Google Maps" : "Failed to load Google Maps");
        setIsLoading(false);
      };
      checkAndInit();
    }
  }, [apiKey, initializeMap, language]);

  // Draw roof polygons
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
  }, [roofPolygons, isLoading]); // Re-run when map loads

  // Calculate all valid panel positions with CNESST-compliant optimization
  // - 2m edge setback from bounding box (CNESST "ligne d'avertissement" - no harness required)
  // - South-to-north filling (optimal for Quebec, northern hemisphere)
  // - Inter-row spacing for winter sun angle (~20° at solstice, 30° panel tilt)
  useEffect(() => {
    if (!window.google || !google.maps?.geometry || roofPolygons.length === 0) {
      setAllPanelPositions([]);
      return;
    }

    // Panel dimensions (standard commercial modules)
    const panelWidthM = 2.0;  // East-West dimension
    const panelHeightM = 1.0; // North-South dimension
    const gapBetweenPanelsM = 0.3; // Gap between panels in same row
    
    // CNESST compliance: 2m setback from roof edge (no harness required)
    const edgeSetbackM = 2.0;
    
    // Inter-row spacing for winter shading avoidance
    // At Quebec latitude (~45°N), winter sun angle is ~20°
    // Panel tilted at 30°, effective height = 1m * sin(30°) = 0.5m
    // Shadow length = 0.5m / tan(20°) = 1.37m
    // Total row spacing = panel height + shadow clearance + gap
    const rowSpacingM = panelHeightM + 1.4 + gapBetweenPanelsM; // ~2.7m between rows

    const solarPolygons = roofPolygons.filter((p) => {
      if (p.color === "#f97316") return false;
      const label = p.label?.toLowerCase() || "";
      return !label.includes("constraint") && !label.includes("contrainte") && 
             !label.includes("hvac") && !label.includes("obstacle");
    });

    const constraintPolygonPaths = roofPolygons
      .filter((p) => {
        if (p.color === "#f97316") return true;
        const label = p.label?.toLowerCase() || "";
        return label.includes("constraint") || label.includes("contrainte") || 
               label.includes("hvac") || label.includes("obstacle");
      })
      .map((p) => {
        const coords = p.coordinates as [number, number][];
        return new google.maps.Polygon({
          paths: coords.map(([lng, lat]) => ({ lat, lng }))
        });
      });

    const positions: PanelPosition[] = [];

    solarPolygons.forEach((polygon) => {
      const coords = polygon.coordinates as [number, number][];
      if (!coords || coords.length < 3) return;

      let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
      coords.forEach(([lng, lat]) => {
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
      });

      const metersPerDegreeLat = 111320;
      const metersPerDegreeLng = 111320 * Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
      
      const panelWidthDeg = panelWidthM / metersPerDegreeLng;
      const panelHeightDeg = panelHeightM / metersPerDegreeLat;
      const gapLngDeg = gapBetweenPanelsM / metersPerDegreeLng;
      const rowSpacingDeg = rowSpacingM / metersPerDegreeLat;
      const edgeSetbackDeg = edgeSetbackM / metersPerDegreeLat;
      const edgeSetbackLngDeg = edgeSetbackM / metersPerDegreeLng;

      const solarPolygonPath = new google.maps.Polygon({
        paths: coords.map(([lng, lat]) => ({ lat, lng }))
      });

      // Fill from SOUTH to NORTH (lower lat to higher lat)
      // This prioritizes south-facing positions which get more sun in Quebec
      for (let lat = minLat + edgeSetbackDeg; lat < maxLat - panelHeightDeg - edgeSetbackDeg; lat += rowSpacingDeg) {
        // Fill each row from west to east
        for (let lng = minLng + edgeSetbackLngDeg; lng < maxLng - panelWidthDeg - edgeSetbackLngDeg; lng += panelWidthDeg + gapLngDeg) {
          // 9-point containment test: 4 corners + 4 edge midpoints + center
          const testPoints = [
            new google.maps.LatLng(lat, lng),
            new google.maps.LatLng(lat, lng + panelWidthDeg),
            new google.maps.LatLng(lat + panelHeightDeg, lng),
            new google.maps.LatLng(lat + panelHeightDeg, lng + panelWidthDeg),
            new google.maps.LatLng(lat, lng + panelWidthDeg / 2),
            new google.maps.LatLng(lat + panelHeightDeg, lng + panelWidthDeg / 2),
            new google.maps.LatLng(lat + panelHeightDeg / 2, lng),
            new google.maps.LatLng(lat + panelHeightDeg / 2, lng + panelWidthDeg),
            new google.maps.LatLng(lat + panelHeightDeg / 2, lng + panelWidthDeg / 2),
          ];

          const allPointsInSolar = testPoints.every((point) => 
            google.maps.geometry.poly.containsLocation(point, solarPolygonPath)
          );
          if (!allPointsInSolar) continue;

          const anyPointInConstraint = constraintPolygonPaths.some((cp) => 
            testPoints.some((point) => google.maps.geometry.poly.containsLocation(point, cp))
          );
          if (anyPointInConstraint) continue;

          positions.push({ lat, lng, widthDeg: panelWidthDeg, heightDeg: panelHeightDeg });
        }
      }
    });

    setAllPanelPositions(positions);
  }, [roofPolygons, isLoading]); // Re-run when map loads (isLoading becomes false)

  // Number of panels to display based on selected capacity
  const panelsToShow = useMemo(() => {
    const targetPanels = Math.ceil(selectedCapacityKW / PANEL_KW);
    return Math.min(targetPanels, allPanelPositions.length);
  }, [selectedCapacityKW, allPanelPositions.length]);

  // Draw panels based on selected capacity
  useEffect(() => {
    if (!mapRef.current || !window.google) return;

    // Clear existing panels
    panelOverlaysRef.current.forEach((p) => {
      try { p.setMap(null); } catch (e) {}
    });
    panelOverlaysRef.current = [];

    // Draw only the number of panels needed for selected capacity
    for (let i = 0; i < panelsToShow; i++) {
      const pos = allPanelPositions[i];
      const panelRect = new google.maps.Rectangle({
        bounds: {
          north: pos.lat + pos.heightDeg,
          south: pos.lat,
          east: pos.lng + pos.widthDeg,
          west: pos.lng,
        },
        strokeColor: "#1e40af",
        strokeOpacity: 0.8,
        strokeWeight: 1,
        fillColor: "#3b82f6",
        fillOpacity: 0.7,
        map: mapRef.current,
      });

      panelOverlaysRef.current.push(panelRect);
    }

    return () => {
      panelOverlaysRef.current.forEach((p) => {
        try { p.setMap(null); } catch (e) {}
      });
      panelOverlaysRef.current = [];
    };
  }, [panelsToShow, allPanelPositions]);

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

  const netUsableArea = Math.max(0, totalUsableArea - constraintArea);

  const handleFullscreen = () => {
    if (mapContainerRef.current?.parentElement) {
      mapContainerRef.current.parentElement.requestFullscreen?.();
    }
  };

  const hasPolygons = roofPolygons.length > 0;

  // Slider markers
  const sliderMarkers = useMemo(() => {
    const markers: { value: number; label: string }[] = [];
    markers.push({ value: minCapacity, label: "Min" });
    if (currentPVSizeKW && currentPVSizeKW > minCapacity && currentPVSizeKW < maxCapacity) {
      markers.push({ value: currentPVSizeKW, label: language === "fr" ? "Recommandé" : "Recommended" });
    }
    markers.push({ value: maxCapacity, label: "Max" });
    return markers;
  }, [minCapacity, maxCapacity, currentPVSizeKW, language]);

  // Calculate displayed capacity (actual kW based on panels shown)
  const displayedCapacityKW = Math.round(panelsToShow * PANEL_KW);

  return (
    <div className="relative rounded-xl overflow-hidden" data-testid="roof-visualization">
      <div className="relative w-full h-72 md:h-96">
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
              {hasPolygons && constraintArea > 0 && totalUsableArea > 0 && (
                <Badge variant="secondary" className="bg-green-500/80 text-white border-green-400/50 backdrop-blur-sm">
                  <Layers className="w-3 h-3 mr-1" />
                  {Math.round(netUsableArea).toLocaleString()} m² {language === "fr" ? "net utilisable" : "net usable"}
                </Badge>
              )}
              {hasPolygons && totalUsableArea > 0 && constraintArea === 0 && (
                <Badge variant="secondary" className="bg-blue-500/80 text-white border-blue-400/50 backdrop-blur-sm">
                  <Layers className="w-3 h-3 mr-1" />
                  {Math.round(totalUsableArea).toLocaleString()} m² {language === "fr" ? "utilisable" : "usable"}
                </Badge>
              )}
              {hasPolygons && constraintArea > 0 && (
                <Badge variant="secondary" className="bg-orange-500/80 text-white border-orange-400/50 backdrop-blur-sm">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  -{Math.round(constraintArea).toLocaleString()} m² {language === "fr" ? "contraintes" : "constraints"}
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
              <div className="w-3 h-3 bg-blue-500 border border-blue-300 rounded-sm" />
              <span>{language === "fr" ? "Panneaux solaires" : "Solar panels"}</span>
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

      {/* Capacity Slider */}
      {hasPolygons && allPanelPositions.length > 0 && (
        <div className="bg-card border-t p-4 pb-6" data-testid="capacity-slider-section">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">
                {language === "fr" ? "Taille du système" : "System Size"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="font-mono" data-testid="panel-count-badge">
                {panelsToShow.toLocaleString()} {language === "fr" ? "panneaux" : "panels"}
              </Badge>
              <Badge className="bg-primary text-primary-foreground font-mono" data-testid="capacity-badge">
                {displayedCapacityKW.toLocaleString()} kWc
              </Badge>
            </div>
          </div>
          
          <div className="relative pt-1 pb-8">
            <Slider
              value={[selectedCapacityKW]}
              onValueChange={(values) => setSelectedCapacityKW(values[0])}
              min={minCapacity}
              max={maxCapacity}
              step={10}
              className="w-full"
              data-testid="capacity-slider"
            />
            
            {/* Slider markers */}
            <div className="absolute left-0 right-0 bottom-0 flex justify-between text-xs text-muted-foreground">
              {sliderMarkers.map((marker, idx) => {
                const position = ((marker.value - minCapacity) / (maxCapacity - minCapacity)) * 100;
                const isRecommended = marker.value === currentPVSizeKW;
                return (
                  <div 
                    key={idx}
                    className="absolute flex flex-col items-center"
                    style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
                  >
                    <div className={`h-1.5 w-0.5 ${isRecommended ? 'bg-primary' : 'bg-muted-foreground/50'}`} />
                    <span className={`mt-0.5 whitespace-nowrap ${isRecommended ? 'text-primary font-medium' : ''}`}>
                      {marker.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

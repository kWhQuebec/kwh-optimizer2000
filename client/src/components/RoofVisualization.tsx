import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Home, Sun, Zap, Maximize2, Layers, AlertTriangle, Download, Camera } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
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
  polygonId: string; // Track which polygon this panel belongs to (UUID)
}

const PANEL_KW = 0.59; // 590W modern bifacial panel (2.0m × 1.0m)

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
  const { toast } = useToast();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const polygonOverlaysRef = useRef<google.maps.Polygon[]>([]);
  const panelOverlaysRef = useRef<google.maps.Rectangle[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [allPanelPositions, setAllPanelPositions] = useState<PanelPosition[]>([]);
  
  // Selected capacity defaults to recommended system, or 70% of max if no recommendation
  // 70% is a typical commercial utilization rate accounting for setbacks and equipment
  const defaultCapacity = currentPVSizeKW || Math.round((maxPVCapacityKW || 100) * 0.7);
  const [selectedCapacityKW, setSelectedCapacityKW] = useState<number>(defaultCapacity);
  const [hasUserAdjusted, setHasUserAdjusted] = useState(false);

  const { data: roofPolygons = [] } = useQuery<RoofPolygon[]>({
    queryKey: ["/api/sites", siteId, "roof-polygons"],
  });

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Calculate min/max for slider based on geometry, not backend estimate
  // The geometry-derived maximum ensures slider goes up to actual placeable panels
  const geometryMaxKW = Math.round(allPanelPositions.length * PANEL_KW);
  const minCapacity = Math.max(100, Math.round((geometryMaxKW || maxPVCapacityKW || 1000) * 0.1));
  const maxCapacity = geometryMaxKW > 0 ? geometryMaxKW : (maxPVCapacityKW || 5000);

  // Update capacity when recommended size is provided or when geometry max is calculated
  useEffect(() => {
    if (currentPVSizeKW) {
      // Always update to recommended size when analysis provides one
      setSelectedCapacityKW(currentPVSizeKW);
    } else if (!hasUserAdjusted && geometryMaxKW > 0) {
      // Default to geometry max (all available space) when no recommendation
      setSelectedCapacityKW(geometryMaxKW);
    } else if (!hasUserAdjusted && maxPVCapacityKW) {
      // Fallback to backend estimate if geometry not yet calculated
      setSelectedCapacityKW(maxPVCapacityKW);
    }
  }, [currentPVSizeKW, maxPVCapacityKW, geometryMaxKW, hasUserAdjusted]);

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
      // Use setTimeout to ensure map is fully rendered before setting ready
      setTimeout(() => setMapReady(true), 100);
    } catch (error) {
      console.error("Failed to initialize map:", error);
      setMapError(language === "fr" ? "Erreur de chargement de la carte" : "Failed to load map");
      setIsLoading(false);
    }
  }, [latitude, longitude, language]);

  // Center map on solar (blue) polygons when they load - wait for map to be ready
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google || roofPolygons.length === 0) return;

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

    if (hasValidCoords && mapRef.current) {
      // Fit bounds with small padding for tight framing
      mapRef.current.fitBounds(bounds, { top: 40, right: 40, bottom: 80, left: 40 });
      
      // After fitBounds, ensure we have appropriate zoom level
      // Use idle event to wait for fitBounds to complete
      const listener = google.maps.event.addListenerOnce(mapRef.current, "idle", () => {
        if (!mapRef.current) return;
        const currentZoom = mapRef.current.getZoom();
        // Ensure minimum zoom of 17 for good detail, max of 19 to avoid over-zoom
        if (currentZoom && currentZoom < 17) {
          mapRef.current.setZoom(17);
        } else if (currentZoom && currentZoom > 19) {
          mapRef.current.setZoom(19);
        }
      });
      
      return () => {
        google.maps.event.removeListener(listener);
      };
    }
  }, [roofPolygons, mapReady]);

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

  // Draw roof polygons - wait for map to be ready
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google || roofPolygons.length === 0) return;

    // Clear existing polygons first
    polygonOverlaysRef.current.forEach((p) => {
      try { p.setMap(null); } catch (e) {}
    });
    polygonOverlaysRef.current = [];

    roofPolygons.forEach((polygon) => {
      const coords = polygon.coordinates as [number, number][];
      if (!coords || !Array.isArray(coords) || coords.length < 3) return;

      const path = coords.map(([lng, lat]) => ({ lat, lng }));

      const isConstraint = polygon.color === "#f97316" ||
                          polygon.label?.toLowerCase().includes("constraint") ||
                          polygon.label?.toLowerCase().includes("contrainte") ||
                          polygon.label?.toLowerCase().includes("hvac") ||
                          polygon.label?.toLowerCase().includes("obstacle");

      const color = isConstraint ? "#f97316" : (polygon.color || "#3b82f6");

      try {
        const googlePolygon = new google.maps.Polygon({
          paths: path,
          strokeColor: color,
          strokeOpacity: 0.9,
          strokeWeight: 2,
          fillColor: color,
          fillOpacity: isConstraint ? 0.4 : 0.3,
          map: mapRef.current,
          zIndex: isConstraint ? 2 : 1, // Constraints on top
        });

        polygonOverlaysRef.current.push(googlePolygon);
      } catch (e) {
        console.error("Error creating polygon:", e);
      }
    });

    return () => {
      polygonOverlaysRef.current.forEach((p) => {
        try { p.setMap(null); } catch (e) {}
      });
      polygonOverlaysRef.current = [];
    };
  }, [roofPolygons, mapReady]); // Re-run when map is ready or polygons change

  // Calculate all valid panel positions with CNESST-compliant optimization
  // - 2m edge setback from bounding box (CNESST "ligne d'avertissement" - no harness required)
  // - South-to-north filling (optimal for Quebec, northern hemisphere)
  // - Inter-row spacing for winter sun angle (~20° at solstice, 30° panel tilt)
  useEffect(() => {
    if (!mapReady || !window.google || !google.maps?.geometry || roofPolygons.length === 0) {
      setAllPanelPositions([]);
      return;
    }

    // Panel dimensions (standard commercial modules - 590W bifacial)
    const panelWidthM = 2.0;  // East-West dimension
    const panelHeightM = 1.0; // North-South dimension
    const gapBetweenPanelsM = 0.1; // Gap between panels (thermal expansion + maintenance access)
    
    // IFC compliant perimeter setback for fire access (4 feet = 1.2m)
    const edgeSetbackM = 1.2;
    
    // Inter-row spacing for Quebec ballast systems (10° tilt typical)
    // At 10° tilt, minimal winter shading - primarily for maintenance access
    // Row spacing = panel height + clearance for ballast/maintenance
    const rowSpacingM = panelHeightM + 0.5; // 1.5m total row pitch

    // Filter solar polygons and sort by creation date (oldest first)
    // This ensures panels fill the original polygon before newer ones
    const solarPolygons = roofPolygons
      .filter((p) => {
        if (p.color === "#f97316") return false;
        const label = p.label?.toLowerCase() || "";
        return !label.includes("constraint") && !label.includes("contrainte") && 
               !label.includes("hvac") && !label.includes("obstacle");
      })
      .sort((a, b) => {
        // Sort by createdAt ascending (oldest first)
        // Fall back to id (UUID string) if createdAt is not available
        if (a.createdAt && b.createdAt) {
          const dateA = typeof a.createdAt === 'string' ? new Date(a.createdAt) : a.createdAt;
          const dateB = typeof b.createdAt === 'string' ? new Date(b.createdAt) : b.createdAt;
          return dateA.getTime() - dateB.getTime();
        }
        // UUIDs are not sortable by order, but at least consistent
        return a.id.localeCompare(b.id);
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

      // Calculate usable spans after setbacks
      const usableLatSpan = (maxLat - minLat) - 2 * edgeSetbackDeg - panelHeightDeg;
      const usableLngSpan = (maxLng - minLng) - 2 * edgeSetbackLngDeg - panelWidthDeg;
      
      // Skip if polygon too small for even one panel
      if (usableLatSpan < 0 || usableLngSpan < 0) return;
      
      // Calculate how many rows/columns fit
      const colStep = panelWidthDeg + gapLngDeg;
      const numRows = Math.max(1, Math.floor(usableLatSpan / rowSpacingDeg) + 1);
      const numCols = Math.max(1, Math.floor(usableLngSpan / colStep) + 1);
      
      // Calculate remainder and center the grid
      const latRemainder = usableLatSpan - (numRows - 1) * rowSpacingDeg;
      const lngRemainder = usableLngSpan - (numCols - 1) * colStep;
      const latOffset = Math.max(0, latRemainder / 2);
      const lngOffset = Math.max(0, lngRemainder / 2);
      
      // Starting positions centered in the polygon
      const startLat = minLat + edgeSetbackDeg + latOffset;
      const startLng = minLng + edgeSetbackLngDeg + lngOffset;

      // Fill grid using count-based iteration to ensure all positions are tried
      // South to North (row 0 = south), West to East (col 0 = west)
      for (let row = 0; row < numRows; row++) {
        const lat = startLat + row * rowSpacingDeg;
        for (let col = 0; col < numCols; col++) {
          const lng = startLng + col * colStep;
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

          positions.push({ 
            lat, 
            lng, 
            widthDeg: panelWidthDeg, 
            heightDeg: panelHeightDeg,
            polygonId: polygon.id 
          });
        }
      }
    });

    // Keep natural south-to-north, west-to-east order
    // This is optimal for Quebec (northern hemisphere - south-facing receives most sun)
    // User controls capacity via slider which now reflects actual geometric maximum
    const sortedPositions = [...positions].sort((a, b) => {
      // Primary sort: south to north (lower lat first)
      if (Math.abs(a.lat - b.lat) > 0.000001) {
        return a.lat - b.lat;
      }
      // Secondary sort: west to east (lower lng first)
      return a.lng - b.lng;
    });
    
    setAllPanelPositions(sortedPositions);
  }, [roofPolygons, mapReady]); // Re-run when map is ready

  // Number of panels to display based on selected capacity
  const panelsToShow = useMemo(() => {
    const targetPanels = Math.ceil(selectedCapacityKW / PANEL_KW);
    return Math.min(targetPanels, allPanelPositions.length);
  }, [selectedCapacityKW, allPanelPositions.length]);

  // Draw panels based on selected capacity
  // Depends on mapReady to ensure map is ready before drawing
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google) return;

    // Clear existing panels
    panelOverlaysRef.current.forEach((p) => {
      try { p.setMap(null); } catch (e) {}
    });
    panelOverlaysRef.current = [];

    // Draw only the number of panels needed for selected capacity
    for (let i = 0; i < panelsToShow; i++) {
      const pos = allPanelPositions[i];
      if (!pos) continue; // Safety check
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
        zIndex: 3, // Panels on top of polygons
      });

      panelOverlaysRef.current.push(panelRect);
    }

    return () => {
      panelOverlaysRef.current.forEach((p) => {
        try { p.setMap(null); } catch (e) {}
      });
      panelOverlaysRef.current = [];
    };
  }, [panelsToShow, allPanelPositions, mapReady]);

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

  // Export map as PNG image for presentations and PDF reports
  const handleExportImage = useCallback(async () => {
    if (!mapRef.current || !window.google) {
      toast({
        title: language === "fr" ? "Erreur" : "Error",
        description: language === "fr" ? "La carte n'est pas prête" : "Map is not ready",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);

    try {
      // Use Google Maps Static API for high-quality export
      const center = mapRef.current.getCenter();
      const zoom = mapRef.current.getZoom() || 18;
      
      if (!center) {
        throw new Error("Map center not available");
      }

      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      const lat = center.lat();
      const lng = center.lng();
      
      // Build paths for polygons (solar areas in blue, constraints in orange)
      let pathParams = "";
      
      // Add solar polygons (blue)
      const solarPolygons = roofPolygons.filter((p) => !isConstraintPolygon(p));
      solarPolygons.forEach((polygon) => {
        const coords = polygon.coordinates as [number, number][];
        if (coords && coords.length >= 3) {
          const pathCoords = coords.map(([pLng, pLat]) => `${pLat},${pLng}`).join("|");
          pathParams += `&path=fillcolor:0x3b82f660|color:0x1e40af|weight:2|${pathCoords}`;
        }
      });
      
      // Add constraint polygons (orange)
      const constraintPolygons = roofPolygons.filter((p) => isConstraintPolygon(p));
      constraintPolygons.forEach((polygon) => {
        const coords = polygon.coordinates as [number, number][];
        if (coords && coords.length >= 3) {
          const pathCoords = coords.map(([pLng, pLat]) => `${pLat},${pLng}`).join("|");
          pathParams += `&path=fillcolor:0xf9731660|color:0xf97316|weight:2|${pathCoords}`;
        }
      });
      
      // Add panel positions as small blue rectangles (markers)
      // Static Maps API has limits, so we'll add key positions
      const panelsToExport = allPanelPositions.slice(0, panelsToShow);
      
      // For large panel counts, sample every Nth panel for markers
      const maxMarkers = 50;
      const step = Math.max(1, Math.floor(panelsToExport.length / maxMarkers));
      const sampledPanels = panelsToExport.filter((_, idx) => idx % step === 0);
      
      let markerParams = "";
      sampledPanels.forEach((pos) => {
        const centerLat = pos.lat + pos.heightDeg / 2;
        const centerLng = pos.lng + pos.widthDeg / 2;
        markerParams += `&markers=size:tiny|color:0x1e40af|${centerLat},${centerLng}`;
      });

      // Build static map URL
      const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=800x600&scale=2&maptype=satellite${pathParams}${markerParams}&key=${apiKey}`;

      // Fetch the image and convert to blob for download
      const response = await fetch(staticMapUrl);
      if (!response.ok) {
        throw new Error("Failed to fetch static map");
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement("a");
      link.href = url;
      link.download = `${siteName.replace(/\s+/g, "-")}-solar-layout.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: language === "fr" ? "Image exportée" : "Image Exported",
        description: language === "fr" 
          ? "L'image a été téléchargée avec succès" 
          : "The image has been downloaded successfully",
      });

    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: language === "fr" ? "Erreur d'export" : "Export Error",
        description: language === "fr" 
          ? "Impossible d'exporter l'image. Veuillez réessayer." 
          : "Unable to export image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  }, [mapRef, roofPolygons, allPanelPositions, panelsToShow, siteName, language, toast]);

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
        
        <div className="absolute top-3 right-3 z-20 flex gap-2">
          <Button
            size="icon"
            variant="secondary"
            className="bg-white/20 text-white border-white/30 backdrop-blur-sm hover:bg-white/30"
            onClick={handleExportImage}
            disabled={isExporting || !hasPolygons}
            data-testid="button-export-image"
            title={language === "fr" ? "Exporter l'image" : "Export image"}
          >
            {isExporting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
          </Button>
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
              onValueChange={(values) => {
                setSelectedCapacityKW(values[0]);
                setHasUserAdjusted(true);
              }}
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

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
  onGeometryCalculated?: (data: { maxCapacityKW: number; panelCount: number; realisticCapacityKW: number; constraintAreaSqM: number }) => void;
}

interface PanelPosition {
  lat: number;
  lng: number;
  widthDeg: number;
  heightDeg: number;
  polygonId: string; // Track which polygon this panel belongs to (UUID)
  // For rotated panels, store all 4 corners (optional for backward compatibility)
  corners?: { lat: number; lng: number }[];
}

const PANEL_KW = 0.59; // 590W modern bifacial panel (2.0m × 1.0m)

// ============================================================================
// GEOMETRY HELPERS for rotated polygon panel placement
// These functions enable placing panels aligned to the polygon's natural orientation
// rather than axis-aligned lat/lng, which fixes coverage on angled/rotated roofs
// ============================================================================

interface Point2D {
  x: number;
  y: number;
}

// Calculate the centroid (center of mass) of a polygon
function computeCentroid(coords: [number, number][]): Point2D {
  let sumX = 0, sumY = 0;
  for (const [lng, lat] of coords) {
    sumX += lng;
    sumY += lat;
  }
  return { x: sumX / coords.length, y: sumY / coords.length };
}

// Find the principal axis angle of a polygon (orientation of longest edge)
// Returns angle in radians where 0 = east, PI/2 = north
function computePrincipalAxisAngle(coords: [number, number][]): number {
  if (coords.length < 2) return 0;
  
  // Find the longest edge and use its angle as the principal axis
  let maxLen = 0;
  let bestAngle = 0;
  
  for (let i = 0; i < coords.length; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[(i + 1) % coords.length];
    
    const dx = lng2 - lng1;
    const dy = lat2 - lat1;
    const len = Math.sqrt(dx * dx + dy * dy);
    
    if (len > maxLen) {
      maxLen = len;
      bestAngle = Math.atan2(dy, dx);
    }
  }
  
  // Normalize to [0, PI) since we want rows parallel to this edge
  // (panels can face either direction along the edge)
  while (bestAngle < 0) bestAngle += Math.PI;
  while (bestAngle >= Math.PI) bestAngle -= Math.PI;
  
  return bestAngle;
}

// Rotate a point around a center by the given angle (radians)
function rotatePoint(p: Point2D, center: Point2D, angle: number): Point2D {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

// Rotate polygon coordinates by angle around centroid
function rotatePolygonCoords(coords: [number, number][], centroid: Point2D, angle: number): Point2D[] {
  return coords.map(([lng, lat]) => rotatePoint({ x: lng, y: lat }, centroid, angle));
}

// Get axis-aligned bounding box of rotated polygon
function getBoundingBox(points: Point2D[]): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, maxX, minY, maxY };
}

// Check if a point is inside a polygon using ray casting algorithm
function pointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  let inside = false;
  const n = polygon.length;
  
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    
    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

// ============================================================================

// Format numbers with proper locale separators
// French: space for thousands, comma for decimals (e.g., 3 294,5)
// English: comma for thousands, period for decimals (e.g., 3,294.5)
function formatNumber(value: number, lang: string, decimals?: number): string {
  const locale = lang === "fr" ? "fr-CA" : "en-CA";
  const options: Intl.NumberFormatOptions = decimals !== undefined 
    ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
    : {};
  return new Intl.NumberFormat(locale, options).format(value);
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
  onGeometryCalculated,
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
  
  // Selected capacity defaults to recommended system, or 90% of max if no recommendation
  // 90% accounts for unseen obstacles (HVAC, skylights, access paths)
  const defaultCapacity = currentPVSizeKW || Math.round((maxPVCapacityKW || 100) * 0.9);
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

  // Realistic capacity estimate: 90% of geometry max to account for unseen obstacles
  const estimatedMaxKW = Math.round(geometryMaxKW * 0.9);
  
  // Update capacity when recommended size is provided or when geometry max is calculated
  useEffect(() => {
    if (currentPVSizeKW) {
      // Always update to recommended size when analysis provides one
      setSelectedCapacityKW(currentPVSizeKW);
    } else if (!hasUserAdjusted && geometryMaxKW > 0) {
      // Default to estimated max (90% of geometry) when no recommendation
      setSelectedCapacityKW(Math.round(geometryMaxKW * 0.9));
    } else if (!hasUserAdjusted && maxPVCapacityKW) {
      // Fallback to 90% of backend estimate if geometry not yet calculated
      setSelectedCapacityKW(Math.round(maxPVCapacityKW * 0.9));
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
  // Uses ROTATED COORDINATE SYSTEM to properly fill angled/irregular polygons
  // - IFC 1.2m edge setback for fire access
  // - Grid aligned to polygon's principal axis (longest edge)
  // - South-to-north filling priority for optimal Quebec solar exposure
  useEffect(() => {
    if (!mapReady || !window.google || !google.maps?.geometry || roofPolygons.length === 0) {
      setAllPanelPositions([]);
      return;
    }

    // Panel dimensions (standard commercial modules - 590W bifacial)
    const panelWidthM = 2.0;  // Along principal axis
    const panelHeightM = 1.0; // Perpendicular to principal axis
    const gapBetweenPanelsM = 0.1; // Gap between panels (thermal expansion + maintenance access)
    
    // IFC compliant perimeter setback for fire access (4 feet = 1.2m)
    const edgeSetbackM = 1.2;
    
    // Inter-row spacing for Quebec ballast systems (10° tilt typical)
    const rowSpacingM = panelHeightM + 0.5; // 1.5m total row pitch

    // Filter solar polygons and sort by creation date (oldest first)
    const solarPolygons = roofPolygons
      .filter((p) => {
        if (p.color === "#f97316") return false;
        const label = p.label?.toLowerCase() || "";
        return !label.includes("constraint") && !label.includes("contrainte") && 
               !label.includes("hvac") && !label.includes("obstacle");
      })
      .sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          const dateA = typeof a.createdAt === 'string' ? new Date(a.createdAt) : a.createdAt;
          const dateB = typeof b.createdAt === 'string' ? new Date(b.createdAt) : b.createdAt;
          return dateA.getTime() - dateB.getTime();
        }
        return a.id.localeCompare(b.id);
      });

    // Create constraint polygon paths for containment testing
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

      // Calculate average latitude for meter-to-degree conversion
      const avgLat = coords.reduce((sum, [, lat]) => sum + lat, 0) / coords.length;
      const metersPerDegreeLat = 111320;
      const metersPerDegreeLng = 111320 * Math.cos(avgLat * Math.PI / 180);
      
      // Convert dimensions to degrees
      const panelWidthDeg = panelWidthM / metersPerDegreeLng;
      const panelHeightDeg = panelHeightM / metersPerDegreeLat;
      const gapDeg = gapBetweenPanelsM / metersPerDegreeLng;
      const rowSpacingDeg = rowSpacingM / metersPerDegreeLat;
      const edgeSetbackDegX = edgeSetbackM / metersPerDegreeLng;
      const edgeSetbackDegY = edgeSetbackM / metersPerDegreeLat;

      // =========================================================
      // NORMALIZED ROTATED COORDINATE SYSTEM APPROACH
      // =========================================================
      // Key insight: 1° longitude ≠ 1° latitude due to Earth's curvature
      // We must normalize coordinates to meters before rotation, then convert back
      
      const aspectRatio = metersPerDegreeLng / metersPerDegreeLat; // ~0.7 at 45°N
      
      // 1. Compute centroid
      const centroid = computeCentroid(coords);
      
      // 2. Normalize coordinates to equal aspect ratio (scale lng to match lat)
      const normalizedCoords: [number, number][] = coords.map(([lng, lat]) => [
        (lng - centroid.x) / aspectRatio + centroid.x,
        lat
      ]);
      
      // 3. Compute principal axis angle in normalized space
      const axisAngle = computePrincipalAxisAngle(normalizedCoords);
      const normalizedCentroid = computeCentroid(normalizedCoords);
      
      // 4. Rotate normalized polygon to axis-aligned space
      const rotatedPolygon = rotatePolygonCoords(normalizedCoords, normalizedCentroid, -axisAngle);
      
      // 5. Get bounding box in rotated normalized space
      const bbox = getBoundingBox(rotatedPolygon);
      
      // Convert panel dimensions to normalized degrees
      const panelWidthNorm = panelWidthM / metersPerDegreeLat; // Use lat scale for both
      const panelHeightNorm = panelHeightM / metersPerDegreeLat;
      const gapNorm = gapBetweenPanelsM / metersPerDegreeLat;
      const rowSpacingNorm = rowSpacingM / metersPerDegreeLat;
      const edgeSetbackNorm = edgeSetbackM / metersPerDegreeLat;
      
      // 6. Apply setbacks to bounding box
      const usableMinX = bbox.minX + edgeSetbackNorm;
      const usableMaxX = bbox.maxX - edgeSetbackNorm;
      const usableMinY = bbox.minY + edgeSetbackNorm;
      const usableMaxY = bbox.maxY - edgeSetbackNorm;
      
      const usableWidth = usableMaxX - usableMinX - panelWidthNorm;
      const usableHeight = usableMaxY - usableMinY - panelHeightNorm;
      
      // Skip if polygon too small for even one panel
      if (usableWidth < 0 || usableHeight < 0) return;
      
      // 7. Calculate grid dimensions
      const colStep = panelWidthNorm + gapNorm;
      const numCols = Math.max(1, Math.floor(usableWidth / colStep) + 1);
      const numRows = Math.max(1, Math.floor(usableHeight / rowSpacingNorm) + 1);
      
      // Center the grid within usable area
      const xRemainder = usableWidth - (numCols - 1) * colStep;
      const yRemainder = usableHeight - (numRows - 1) * rowSpacingNorm;
      const startX = usableMinX + Math.max(0, xRemainder / 2);
      const startY = usableMinY + Math.max(0, yRemainder / 2);
      
      // Create Google Maps polygon for containment testing (original coordinates)
      const solarPolygonPath = new google.maps.Polygon({
        paths: coords.map(([lng, lat]) => ({ lat, lng }))
      });
      
      // DEBUG: Log grid calculation details
      console.log(`[RoofVisualization] Polygon ${polygon.label || polygon.id}:`, {
        axisAngleDeg: Math.round(axisAngle * 180 / Math.PI),
        aspectRatio: aspectRatio.toFixed(3),
        numRows,
        numCols,
        expectedPanels: numRows * numCols,
        bboxWidthM: Math.round((bbox.maxX - bbox.minX) * metersPerDegreeLat),
        bboxHeightM: Math.round((bbox.maxY - bbox.minY) * metersPerDegreeLat),
      });

      let acceptedCount = 0;
      let rejectedBySolar = 0;
      let rejectedByConstraint = 0;
      
      // 8. Iterate through grid in rotated normalized space
      for (let row = 0; row < numRows; row++) {
        const rotY = startY + row * rowSpacingNorm;
        for (let col = 0; col < numCols; col++) {
          const rotX = startX + col * colStep;
          
          // Panel corners in rotated normalized space
          const rotatedCorners: Point2D[] = [
            { x: rotX, y: rotY },
            { x: rotX + panelWidthNorm, y: rotY },
            { x: rotX + panelWidthNorm, y: rotY + panelHeightNorm },
            { x: rotX, y: rotY + panelHeightNorm },
          ];
          
          // 9. Rotate corners back to normalized geographic coordinates
          const normalizedGeoCorners = rotatedCorners.map(p => 
            rotatePoint(p, normalizedCentroid, axisAngle)
          );
          
          // 10. Denormalize to actual geographic coordinates (reverse the aspect ratio scaling)
          const geoCorners = normalizedGeoCorners.map(p => ({
            x: (p.x - centroid.x) * aspectRatio + centroid.x, // Denormalize lng
            y: p.y // lat stays the same
          }));
          
          // 11. Test all corners are within solar polygon
          const testPoints = geoCorners.map(c => new google.maps.LatLng(c.y, c.x));
          
          const allPointsInSolar = testPoints.every((point) => 
            google.maps.geometry.poly.containsLocation(point, solarPolygonPath)
          );
          if (!allPointsInSolar) {
            rejectedBySolar++;
            continue;
          }

          // 12. Test no corners are in constraint polygons
          const anyPointInConstraint = constraintPolygonPaths.some((cp) => 
            testPoints.some((point) => google.maps.geometry.poly.containsLocation(point, cp))
          );
          if (anyPointInConstraint) {
            rejectedByConstraint++;
            continue;
          }

          // 13. Accept panel - store all 4 corners in geographic coords for rotated rendering
          acceptedCount++;
          const bottomLeft = geoCorners[0];
          positions.push({ 
            lat: bottomLeft.y, 
            lng: bottomLeft.x, 
            widthDeg: panelWidthDeg, 
            heightDeg: panelHeightDeg,
            polygonId: polygon.id,
            corners: geoCorners.map(c => ({ lat: c.y, lng: c.x }))
          });
        }
      }
      
      // DEBUG: Log rejection stats
      console.log(`[RoofVisualization] Polygon ${polygon.label || polygon.id} placement:`, {
        attempted: numRows * numCols,
        accepted: acceptedCount,
        rejectedBySolar,
        rejectedByConstraint,
        acceptanceRate: `${Math.round(acceptedCount / (numRows * numCols) * 100)}%`
      });
    });

    // Sort by latitude (south to north) for optimal solar filling in Quebec
    const sortedPositions = [...positions].sort((a, b) => {
      if (Math.abs(a.lat - b.lat) > 0.000001) {
        return a.lat - b.lat;
      }
      return a.lng - b.lng;
    });
    
    setAllPanelPositions(sortedPositions);
  }, [roofPolygons, mapReady]);

  // Number of panels to display based on selected capacity
  const panelsToShow = useMemo(() => {
    const targetPanels = Math.ceil(selectedCapacityKW / PANEL_KW);
    return Math.min(targetPanels, allPanelPositions.length);
  }, [selectedCapacityKW, allPanelPositions.length]);

  // Notify parent component when geometry is calculated
  // Calculate constraint area for realistic estimate
  const constraintAreaForCallback = useMemo(() => {
    return roofPolygons
      .filter((p) => {
        if (p.color === "#f97316") return true;
        const label = p.label?.toLowerCase() || "";
        return label.includes("constraint") || label.includes("contrainte") || 
               label.includes("hvac") || label.includes("obstacle");
      })
      .reduce((sum, p) => sum + p.areaSqM, 0);
  }, [roofPolygons]);

  useEffect(() => {
    if (allPanelPositions.length > 0 && onGeometryCalculated) {
      const maxCapacityKW = Math.round(allPanelPositions.length * PANEL_KW);
      // Realistic estimate: subtract 10% for unseen obstacles (HVAC, skylights, access paths)
      const realisticCapacityKW = Math.round(maxCapacityKW * 0.9);
      
      onGeometryCalculated({
        maxCapacityKW,
        panelCount: allPanelPositions.length,
        realisticCapacityKW,
        constraintAreaSqM: constraintAreaForCallback,
      });
    }
  }, [allPanelPositions.length, onGeometryCalculated, constraintAreaForCallback]);

  // Draw panels based on selected capacity
  // Supports both axis-aligned (Rectangle) and rotated (Polygon) panels
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
      
      // Use Polygon for rotated panels (with corners), Rectangle for axis-aligned
      if (pos.corners && pos.corners.length === 4) {
        // Rotated panel - render as polygon
        const panelPoly = new google.maps.Polygon({
          paths: pos.corners,
          strokeColor: "#1e40af",
          strokeOpacity: 0.8,
          strokeWeight: 1,
          fillColor: "#3b82f6",
          fillOpacity: 0.7,
          map: mapRef.current,
          zIndex: 3,
        });
        panelOverlaysRef.current.push(panelPoly as unknown as google.maps.Rectangle);
      } else {
        // Axis-aligned panel - render as rectangle (backward compatibility)
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
          zIndex: 3,
        });
        panelOverlaysRef.current.push(panelRect);
      }
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
                  {formatNumber(Math.round(netUsableArea), language)} m² {language === "fr" ? "net utilisable" : "net usable"}
                </Badge>
              )}
              {hasPolygons && totalUsableArea > 0 && constraintArea === 0 && (
                <Badge variant="secondary" className="bg-blue-500/80 text-white border-blue-400/50 backdrop-blur-sm">
                  <Layers className="w-3 h-3 mr-1" />
                  {formatNumber(Math.round(totalUsableArea * 0.85), language)} m² {language === "fr" ? "utilisable (85%)" : "usable (85%)"}
                </Badge>
              )}
              {hasPolygons && constraintArea > 0 && (
                <Badge variant="secondary" className="bg-orange-500/80 text-white border-orange-400/50 backdrop-blur-sm">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  -{formatNumber(Math.round(constraintArea), language)} m² {language === "fr" ? "contraintes" : "constraints"}
                </Badge>
              )}
              {roofAreaSqFt && (
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                  <Home className="w-3 h-3 mr-1" />
                  {formatNumber(roofAreaSqFt, language)} pi²
                </Badge>
              )}
              {maxPVCapacityKW && (
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                  <Sun className="w-3 h-3 mr-1" />
                  {formatNumber(Math.round(maxCapacity * 0.9), language)} kWc {language === "fr" ? "estimé" : "estimated"}
                </Badge>
              )}
              {currentPVSizeKW && (
                <Badge variant="secondary" className="bg-primary/80 text-white border-primary backdrop-blur-sm">
                  <Zap className="w-3 h-3 mr-1" />
                  {formatNumber(Math.round(currentPVSizeKW), language)} kWc
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
                {formatNumber(panelsToShow, language)} {language === "fr" ? "panneaux" : "panels"}
              </Badge>
              <Badge className="bg-primary text-primary-foreground font-mono" data-testid="capacity-badge">
                {formatNumber(displayedCapacityKW, language)} kWc
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
              max={Math.round(maxCapacity * 0.9)}
              step={10}
              className="w-full"
              data-testid="capacity-slider"
            />
            
            {/* Slider markers */}
            <div className="absolute left-0 right-0 bottom-0 flex justify-between text-xs text-muted-foreground">
              {sliderMarkers.filter(m => m.value <= Math.round(maxCapacity * 0.9)).map((marker, idx) => {
                const estimatedMax = Math.round(maxCapacity * 0.9);
                const position = ((marker.value - minCapacity) / (estimatedMax - minCapacity)) * 100;
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

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
  // Grid indices for rectangularization post-processing
  gridRow?: number;
  gridCol?: number;
  quadrant?: string; // 'EN', 'ES', 'WN', 'WS' (East/West + North/South)
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

// Calculate X intersections of a horizontal scanline with polygon edges
// Returns array of X values where the scanline crosses polygon edges
function getPolygonRowIntersections(polygon: Point2D[], y: number): number[] {
  const intersections: number[] = [];
  const n = polygon.length;
  
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const yi = polygon[i].y, yj = polygon[j].y;
    const xi = polygon[i].x, xj = polygon[j].x;
    
    // Check if this edge crosses the scanline Y
    if ((yi <= y && yj > y) || (yj <= y && yi > y)) {
      // Calculate X intersection using linear interpolation
      const t = (y - yi) / (yj - yi);
      const xIntersect = xi + t * (xj - xi);
      intersections.push(xIntersect);
    }
  }
  
  // Sort intersections left to right
  return intersections.sort((a, b) => a - b);
}

// Get contiguous X spans from intersection pairs
// For a simple polygon, intersections come in pairs (entry/exit)
function getRowSpans(intersections: number[], setback: number): Array<{minX: number, maxX: number}> {
  const spans: Array<{minX: number, maxX: number}> = [];
  
  // Process intersections in pairs (entry, exit)
  for (let i = 0; i < intersections.length - 1; i += 2) {
    const rawMinX = intersections[i];
    const rawMaxX = intersections[i + 1];
    
    // Apply setback to shrink the span from both ends
    const minX = rawMinX + setback;
    const maxX = rawMaxX - setback;
    
    // Only add span if it has positive width after setback
    if (maxX > minX) {
      spans.push({ minX, maxX });
    }
  }
  
  return spans;
}

// ============================================================================
// CONCAVE POLYGON DECOMPOSITION
// For L/U/T shaped roofs, decompose into rectangular sub-regions
// Industry practice: Helioscope/Aurora model complex roofs as multiple faces
// ============================================================================

// Calculate signed area of polygon (positive = CCW, negative = CW)
function signedPolygonArea(polygon: Point2D[]): number {
  let area = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i].x * polygon[j].y;
    area -= polygon[j].x * polygon[i].y;
  }
  return area / 2;
}

// Calculate cross product of vectors (p1->p2) and (p2->p3)
// Positive = left turn, Negative = right turn, Zero = collinear
function crossProduct(p1: Point2D, p2: Point2D, p3: Point2D): number {
  return (p2.x - p1.x) * (p3.y - p2.y) - (p2.y - p1.y) * (p3.x - p2.x);
}

// Find reflex (concave) vertices in a polygon
// A vertex is reflex if its interior angle > 180° (convex hull would skip it)
function findReflexVertices(polygon: Point2D[]): number[] {
  const reflexIndices: number[] = [];
  const n = polygon.length;
  const area = signedPolygonArea(polygon);
  const isCCW = area > 0;
  
  for (let i = 0; i < n; i++) {
    const prev = polygon[(i - 1 + n) % n];
    const curr = polygon[i];
    const next = polygon[(i + 1) % n];
    
    const cross = crossProduct(prev, curr, next);
    // For CCW polygon, reflex vertices have negative cross product
    // For CW polygon, reflex vertices have positive cross product
    const isReflex = isCCW ? cross < -1e-10 : cross > 1e-10;
    
    if (isReflex) {
      reflexIndices.push(i);
    }
  }
  
  return reflexIndices;
}

// Check if polygon is concave (has any reflex vertices)
function isPolygonConcave(polygon: Point2D[]): boolean {
  return findReflexVertices(polygon).length > 0;
}

// Decompose a concave polygon into convex/rectangular sub-polygons
// Uses axis-aligned cuts through reflex vertices for L/U/T shaped roofs
function decomposePolygon(polygon: Point2D[]): Point2D[][] {
  if (polygon.length < 3) return [polygon];
  
  const reflexIndices = findReflexVertices(polygon);
  
  // If polygon is already convex, return as-is
  if (reflexIndices.length === 0) {
    return [polygon];
  }
  
  // For each reflex vertex, try to find a valid cut
  // We use horizontal or vertical cuts for rectangular sub-regions
  for (const reflexIdx of reflexIndices) {
    const reflexPoint = polygon[reflexIdx];
    
    // Try horizontal cut first (more common for L-shapes)
    const horizontalCut = tryHorizontalCut(polygon, reflexIdx, reflexPoint.y);
    if (horizontalCut) {
      // Recursively decompose the resulting sub-polygons
      const [poly1, poly2] = horizontalCut;
      return [...decomposePolygon(poly1), ...decomposePolygon(poly2)];
    }
    
    // Try vertical cut
    const verticalCut = tryVerticalCut(polygon, reflexIdx, reflexPoint.x);
    if (verticalCut) {
      const [poly1, poly2] = verticalCut;
      return [...decomposePolygon(poly1), ...decomposePolygon(poly2)];
    }
  }
  
  // If no valid cuts found, return original polygon
  // (Algorithm falls back to existing row-wise fill with final containment check)
  return [polygon];
}

// Try to cut polygon with a horizontal line at y-coordinate
function tryHorizontalCut(polygon: Point2D[], reflexIdx: number, cutY: number): [Point2D[], Point2D[]] | null {
  const n = polygon.length;
  
  // Find all edges that cross the cut line
  const crossings: { x: number; edgeIdx: number; entering: boolean }[] = [];
  
  for (let i = 0; i < n; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % n];
    
    // Check if edge crosses the cut Y
    if ((p1.y < cutY && p2.y > cutY) || (p1.y > cutY && p2.y < cutY)) {
      // Calculate X intersection
      const t = (cutY - p1.y) / (p2.y - p1.y);
      const x = p1.x + t * (p2.x - p1.x);
      const entering = p2.y > p1.y; // entering upper region
      crossings.push({ x, edgeIdx: i, entering });
    }
  }
  
  // Sort crossings by X
  crossings.sort((a, b) => a.x - b.x);
  
  // Need at least 2 crossings for a valid cut
  if (crossings.length < 2) return null;
  
  // Find the crossing pair that creates a valid cut through the reflex vertex
  // For L-shaped roofs, we want the cut that separates the two rectangular regions
  const reflexPoint = polygon[reflexIdx];
  
  // Find crossings on either side of the reflex point
  let leftCrossing: typeof crossings[0] | null = null;
  let rightCrossing: typeof crossings[0] | null = null;
  
  for (const crossing of crossings) {
    if (crossing.x < reflexPoint.x) {
      leftCrossing = crossing;
    } else if (crossing.x > reflexPoint.x && !rightCrossing) {
      rightCrossing = crossing;
    }
  }
  
  if (!leftCrossing || !rightCrossing) return null;
  
  // Build two sub-polygons from the cut
  return buildSubPolygonsFromHorizontalCut(polygon, cutY, leftCrossing, rightCrossing);
}

// Try to cut polygon with a vertical line at x-coordinate
function tryVerticalCut(polygon: Point2D[], reflexIdx: number, cutX: number): [Point2D[], Point2D[]] | null {
  const n = polygon.length;
  
  // Find all edges that cross the cut line
  const crossings: { y: number; edgeIdx: number; entering: boolean }[] = [];
  
  for (let i = 0; i < n; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % n];
    
    // Check if edge crosses the cut X
    if ((p1.x < cutX && p2.x > cutX) || (p1.x > cutX && p2.x < cutX)) {
      // Calculate Y intersection
      const t = (cutX - p1.x) / (p2.x - p1.x);
      const y = p1.y + t * (p2.y - p1.y);
      const entering = p2.x > p1.x; // entering right region
      crossings.push({ y, edgeIdx: i, entering });
    }
  }
  
  // Sort crossings by Y
  crossings.sort((a, b) => a.y - b.y);
  
  // Need at least 2 crossings for a valid cut
  if (crossings.length < 2) return null;
  
  // Find the crossing pair that creates a valid cut through the reflex vertex
  const reflexPoint = polygon[reflexIdx];
  
  // Find crossings on either side of the reflex point
  let bottomCrossing: typeof crossings[0] | null = null;
  let topCrossing: typeof crossings[0] | null = null;
  
  for (const crossing of crossings) {
    if (crossing.y < reflexPoint.y) {
      bottomCrossing = crossing;
    } else if (crossing.y > reflexPoint.y && !topCrossing) {
      topCrossing = crossing;
    }
  }
  
  if (!bottomCrossing || !topCrossing) return null;
  
  // Build two sub-polygons from the cut
  return buildSubPolygonsFromVerticalCut(polygon, cutX, bottomCrossing, topCrossing);
}

// Build sub-polygons from a horizontal cut
function buildSubPolygonsFromHorizontalCut(
  polygon: Point2D[], 
  cutY: number,
  leftCrossing: { x: number; edgeIdx: number },
  rightCrossing: { x: number; edgeIdx: number }
): [Point2D[], Point2D[]] {
  const n = polygon.length;
  const upperPoly: Point2D[] = [];
  const lowerPoly: Point2D[] = [];
  
  // Create cut points
  const leftCutPoint: Point2D = { x: leftCrossing.x, y: cutY };
  const rightCutPoint: Point2D = { x: rightCrossing.x, y: cutY };
  
  // Walk around polygon, assigning vertices to upper or lower
  for (let i = 0; i < n; i++) {
    const p = polygon[i];
    if (p.y >= cutY - 1e-10) {
      upperPoly.push(p);
    }
    if (p.y <= cutY + 1e-10) {
      lowerPoly.push(p);
    }
    
    // Add cut points at edge crossings
    const nextIdx = (i + 1) % n;
    const nextP = polygon[nextIdx];
    
    // Check if this edge crosses the cut
    if ((p.y < cutY && nextP.y > cutY) || (p.y > cutY && nextP.y < cutY)) {
      const t = (cutY - p.y) / (nextP.y - p.y);
      const cutPoint: Point2D = {
        x: p.x + t * (nextP.x - p.x),
        y: cutY
      };
      upperPoly.push(cutPoint);
      lowerPoly.push(cutPoint);
    }
  }
  
  // Remove duplicates and ensure valid polygons
  const cleanUpper = removeDuplicatePoints(upperPoly);
  const cleanLower = removeDuplicatePoints(lowerPoly);
  
  if (cleanUpper.length < 3 || cleanLower.length < 3) {
    // Invalid cut, return original as single polygon
    return [polygon, []];
  }
  
  return [cleanUpper, cleanLower];
}

// Build sub-polygons from a vertical cut
function buildSubPolygonsFromVerticalCut(
  polygon: Point2D[], 
  cutX: number,
  bottomCrossing: { y: number; edgeIdx: number },
  topCrossing: { y: number; edgeIdx: number }
): [Point2D[], Point2D[]] {
  const n = polygon.length;
  const leftPoly: Point2D[] = [];
  const rightPoly: Point2D[] = [];
  
  // Walk around polygon, assigning vertices to left or right
  for (let i = 0; i < n; i++) {
    const p = polygon[i];
    if (p.x <= cutX + 1e-10) {
      leftPoly.push(p);
    }
    if (p.x >= cutX - 1e-10) {
      rightPoly.push(p);
    }
    
    // Add cut points at edge crossings
    const nextIdx = (i + 1) % n;
    const nextP = polygon[nextIdx];
    
    // Check if this edge crosses the cut
    if ((p.x < cutX && nextP.x > cutX) || (p.x > cutX && nextP.x < cutX)) {
      const t = (cutX - p.x) / (nextP.x - p.x);
      const cutPoint: Point2D = {
        x: cutX,
        y: p.y + t * (nextP.y - p.y)
      };
      leftPoly.push(cutPoint);
      rightPoly.push(cutPoint);
    }
  }
  
  // Remove duplicates and ensure valid polygons
  const cleanLeft = removeDuplicatePoints(leftPoly);
  const cleanRight = removeDuplicatePoints(rightPoly);
  
  if (cleanLeft.length < 3 || cleanRight.length < 3) {
    // Invalid cut, return original as single polygon
    return [polygon, []];
  }
  
  return [cleanLeft, cleanRight];
}

// Remove duplicate consecutive points from polygon
function removeDuplicatePoints(polygon: Point2D[]): Point2D[] {
  if (polygon.length === 0) return [];
  
  const result: Point2D[] = [polygon[0]];
  const epsilon = 1e-10;
  
  for (let i = 1; i < polygon.length; i++) {
    const prev = result[result.length - 1];
    const curr = polygon[i];
    
    if (Math.abs(curr.x - prev.x) > epsilon || Math.abs(curr.y - prev.y) > epsilon) {
      result.push(curr);
    }
  }
  
  // Check if last point equals first
  if (result.length > 1) {
    const first = result[0];
    const last = result[result.length - 1];
    if (Math.abs(last.x - first.x) < epsilon && Math.abs(last.y - first.y) < epsilon) {
      result.pop();
    }
  }
  
  return result;
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
      // ROW-WISE POLYGON INTERSECTION ALGORITHM
      // =========================================================
      // This algorithm produces clean, contiguous rows of panels instead of clumps:
      // 1. Convert polygon to meters (local ENU centered on centroid)
      // 2. Rotate polygon to align with principal axis
      // 3. For each row Y, calculate actual polygon intersections
      // 4. Place panels continuously within each row span (with setback)
      // 5. Convert accepted panels back to geo coordinates
      
      // 1. Compute centroid in geographic coordinates
      const centroid = computeCentroid(coords);
      
      // 2. Convert polygon to meters (local ENU - East-North centered on centroid)
      const meterCoords: [number, number][] = coords.map(([lng, lat]) => [
        (lng - centroid.x) * metersPerDegreeLng,  // East (meters)
        (lat - centroid.y) * metersPerDegreeLat   // North (meters)
      ]);
      
      // 3. Compute principal axis angle in meter space (no distortion)
      const axisAngle = computePrincipalAxisAngle(meterCoords);
      const meterCentroid = { x: 0, y: 0 }; // Centroid is origin in local system
      
      // 4. Rotate polygon to axis-aligned space for easier grid scanning
      const rotatedPolygonPoints = rotatePolygonCoords(meterCoords, meterCentroid, -axisAngle);
      
      // Check if polygon is concave (L/U/T shaped)
      const isConcave = isPolygonConcave(rotatedPolygonPoints);
      
      if (isConcave) {
        console.log(`[RoofVisualization] Concave polygon ${polygon.label || polygon.id} detected - using grid-based fill with containment check`);
      }
      
      // Create Google Maps polygon for final containment verification
      // This is the PRIMARY filter for concave polygons
      const solarPolygonPath = new google.maps.Polygon({
        paths: coords.map(([lng, lat]) => ({ lat, lng }))
      });

      let acceptedCount = 0;
      let rejectedByConstraint = 0;
      let rejectedByContainment = 0;
        
      // 5. Get bounding box - for concave polygons, use UNROTATED bbox to ensure full coverage
      // The issue: rotation can cause the bounding box to not cover all parts of L-shaped roofs
      const bboxRotated = getBoundingBox(rotatedPolygonPoints);
      const bboxUnrotated = getBoundingBox(meterCoords.map(([x, y]) => ({ x, y })));
      
      // For concave polygons, use the larger of the two bounding boxes
      const bbox = isConcave ? {
        minX: Math.min(bboxRotated.minX, bboxUnrotated.minX),
        maxX: Math.max(bboxRotated.maxX, bboxUnrotated.maxX),
        minY: Math.min(bboxRotated.minY, bboxUnrotated.minY),
        maxY: Math.max(bboxRotated.maxY, bboxUnrotated.maxY),
      } : bboxRotated;
      
      // Calculate grid parameters
      const colStep = panelWidthM + gapBetweenPanelsM;  // 2.1m horizontal step
      const rowStep = rowSpacingM;                      // 1.5m vertical step
      
      const roofWidthM = bbox.maxX - bbox.minX;
      const roofHeightM = bbox.maxY - bbox.minY;
      
      // =========================================================
      // IFC FIRE CODE: Central pathways for large roofs (> 40m)
      // =========================================================
      const needsNorthSouthPathway = roofWidthM > 40;
      const needsEastWestPathway = roofHeightM > 40;
      const halfPathway = 0.6; // 1.2m total pathway width
      
      // Calculate row range with vertical setback
      const minRowY = bbox.minY + edgeSetbackM + panelHeightM / 2;
      const maxRowY = bbox.maxY - edgeSetbackM - panelHeightM / 2;
      const numRows = Math.floor((maxRowY - minRowY) / rowStep) + 1;
      
      // DEBUG: Log grid calculation details
      console.log(`[RoofVisualization] Polygon ${polygon.label || polygon.id}:`, {
        axisAngleDeg: Math.round(axisAngle * 180 / Math.PI),
        numRows,
        bboxWidthM: Math.round(roofWidthM),
        bboxHeightM: Math.round(roofHeightM),
        needsPathways: needsNorthSouthPathway || needsEastWestPathway,
        isConcave,
      });
      
      // 6. PANEL PLACEMENT: Different strategies for convex vs concave polygons
      // =========================================================
      // CONCAVE (L/U/T shapes): Grid-based scan with containment check
      // - Scans entire bounding box
      // - Checks each panel position against Google Maps containsLocation
      // - Guaranteed to fill all usable areas
      //
      // CONVEX (simple rectangles): Row-wise intersection (more efficient)
      // - Uses polygon edge intersections for precise span calculation
      // - Only considers positions within calculated spans
      // =========================================================
      
      if (isConcave) {
        // =========================================================
        // UNROTATED GRID APPROACH for concave polygons (L/U/T shapes)
        // =========================================================
        // Key insight: Rotating the grid to align with the building axis can miss
        // diagonal sections of L-shaped roofs. Instead, we scan in UNROTATED 
        // (cardinal-aligned) space which guarantees coverage of all roof sections.
        // Panels will align to N-S/E-W directions rather than the building axis,
        // which is acceptable for complex shapes with no single "correct" alignment.
        
        // Use UNROTATED bounding box (in meter space centered on centroid)
        const unrotatedBbox = getBoundingBox(meterCoords.map(([x, y]) => ({ x, y })));
        
        const unrotatedMinX = unrotatedBbox.minX + edgeSetbackM + panelWidthM / 2;
        const unrotatedMaxX = unrotatedBbox.maxX - edgeSetbackM - panelWidthM / 2;
        const unrotatedMinY = unrotatedBbox.minY + edgeSetbackM + panelHeightM / 2;
        const unrotatedMaxY = unrotatedBbox.maxY - edgeSetbackM - panelHeightM / 2;
        
        const unrotatedNumCols = Math.floor((unrotatedMaxX - unrotatedMinX) / colStep) + 1;
        const unrotatedNumRows = Math.floor((unrotatedMaxY - unrotatedMinY) / rowStep) + 1;
        
        const unrotatedWidthM = unrotatedBbox.maxX - unrotatedBbox.minX;
        const unrotatedHeightM = unrotatedBbox.maxY - unrotatedBbox.minY;
        const unrotatedNeedsNSPathway = unrotatedWidthM > 40;
        const unrotatedNeedsEWPathway = unrotatedHeightM > 40;
        
        console.log(`[RoofVisualization] UNROTATED grid scan for concave polygon: ${unrotatedNumRows} rows × ${unrotatedNumCols} cols = ${unrotatedNumRows * unrotatedNumCols} candidates`);
        console.log(`[RoofVisualization] Unrotated bbox: X[${Math.round(unrotatedBbox.minX)} to ${Math.round(unrotatedBbox.maxX)}], Y[${Math.round(unrotatedBbox.minY)} to ${Math.round(unrotatedBbox.maxY)}]`);
        
        for (let rowIdx = 0; rowIdx < unrotatedNumRows; rowIdx++) {
          const rowCenterY = unrotatedMinY + rowIdx * rowStep;
          
          // Skip row if it falls in the east-west central pathway
          if (unrotatedNeedsEWPathway && Math.abs(rowCenterY) < halfPathway + panelHeightM / 2) {
            continue;
          }
          
          for (let colIdx = 0; colIdx < unrotatedNumCols; colIdx++) {
            const colCenterX = unrotatedMinX + colIdx * colStep;
            
            // Skip panel if it falls in the north-south central pathway
            if (unrotatedNeedsNSPathway && Math.abs(colCenterX) < halfPathway + panelWidthM / 2) {
              continue;
            }
            
            // Panel corners in UNROTATED meter space (no rotation needed!)
            const panelX = colCenterX - panelWidthM / 2;
            const panelY = rowCenterY - panelHeightM / 2;
            
            const meterCorners: Point2D[] = [
              { x: panelX, y: panelY },
              { x: panelX + panelWidthM, y: panelY },
              { x: panelX + panelWidthM, y: panelY + panelHeightM },
              { x: panelX, y: panelY + panelHeightM },
            ];
            
            // Convert meters DIRECTLY to geographic coordinates (no rotation!)
            const geoCorners = meterCorners.map(p => ({
              x: p.x / metersPerDegreeLng + centroid.x,  // lng
              y: p.y / metersPerDegreeLat + centroid.y   // lat
            }));
            
            // Create test points for panel center
            const panelCenterGeo = {
              lat: (geoCorners[0].y + geoCorners[2].y) / 2,
              lng: (geoCorners[0].x + geoCorners[2].x) / 2
            };
            const centerPoint = new google.maps.LatLng(panelCenterGeo.lat, panelCenterGeo.lng);
            
            // CONTAINMENT CHECK: Panel center must be inside polygon
            // For concave polygons with diagonal sections, center-point check ensures
            // all usable areas are filled. Slight edge overhang is acceptable for visualization.
            if (!google.maps.geometry.poly.containsLocation(centerPoint, solarPolygonPath)) {
              rejectedByContainment++;
              continue;
            }
            
            // Also create test points for constraint checking
            const testPoints = geoCorners.map(c => new google.maps.LatLng(c.y, c.x));
            
            // Test no corners are in constraint polygons
            const anyPointInConstraint = constraintPolygonPaths.some((cp) => 
              testPoints.some((point) => google.maps.geometry.poly.containsLocation(point, cp))
            );
            if (anyPointInConstraint) {
              rejectedByConstraint++;
              continue;
            }

            // Accept panel
            acceptedCount++;
            const bottomLeft = geoCorners[0];
            
            // Determine quadrant based on unrotated position
            const quadrant = (colCenterX >= 0 ? 'E' : 'W') + (rowCenterY >= 0 ? 'N' : 'S');
            
            positions.push({ 
              lat: bottomLeft.y, 
              lng: bottomLeft.x, 
              widthDeg: panelWidthDeg, 
              heightDeg: panelHeightDeg,
              polygonId: polygon.id,
              corners: geoCorners.map(c => ({ lat: c.y, lng: c.x })),
              gridRow: rowIdx,
              gridCol: colIdx,
              quadrant: quadrant,
            });
          }
        }
      } else {
        // ROW-WISE APPROACH for convex polygons (more efficient)
        for (let rowIdx = 0; rowIdx < numRows; rowIdx++) {
          // Row center Y position (in rotated meter space)
          const rowCenterY = minRowY + rowIdx * rowStep;
          
          // Skip row if it falls in the east-west central pathway
          if (needsEastWestPathway && Math.abs(rowCenterY) < halfPathway + panelHeightM / 2) {
            continue;
          }
          
          // Calculate polygon intersection points for this row
          const rowTopY = rowCenterY + panelHeightM / 2;
          const rowBottomY = rowCenterY - panelHeightM / 2;
          
          // Get intersections at both top and bottom of panel row
          const intersectionsTop = getPolygonRowIntersections(rotatedPolygonPoints, rowTopY);
          const intersectionsBottom = getPolygonRowIntersections(rotatedPolygonPoints, rowBottomY);
          
          // Get spans with setback applied
          const spansTop = getRowSpans(intersectionsTop, edgeSetbackM);
          const spansBottom = getRowSpans(intersectionsBottom, edgeSetbackM);
          
          // CONVEX POLYGON: Use INTERSECTION of top and bottom spans
          const rowSpans: Array<{minX: number, maxX: number}> = [];
          for (const spanB of spansBottom) {
            for (const spanT of spansTop) {
              const overlapMin = Math.max(spanB.minX, spanT.minX);
              const overlapMax = Math.min(spanB.maxX, spanT.maxX);
              if (overlapMax > overlapMin) {
                rowSpans.push({ minX: overlapMin, maxX: overlapMax });
              }
            }
          }
          
          // Fill each span with panels
          for (const span of rowSpans) {
          // Calculate how many panels fit in this span
          const spanWidth = span.maxX - span.minX;
          const numPanelsInSpan = Math.floor((spanWidth + gapBetweenPanelsM) / colStep);
          
          if (numPanelsInSpan <= 0) continue;
          
          // Center the panels within the span
          const totalPanelWidth = numPanelsInSpan * colStep - gapBetweenPanelsM;
          const startX = span.minX + (spanWidth - totalPanelWidth) / 2;
          
          for (let panelIdx = 0; panelIdx < numPanelsInSpan; panelIdx++) {
            const rotX = startX + panelIdx * colStep;
            const rotY = rowCenterY - panelHeightM / 2;
            
            const panelCenterX = rotX + panelWidthM / 2;
            
            // Skip panel if it falls in the north-south central pathway
            if (needsNorthSouthPathway && Math.abs(panelCenterX) < halfPathway + panelWidthM / 2) {
              continue;
            }
            
            // Panel corners in rotated meter space
            const rotatedCorners: Point2D[] = [
              { x: rotX, y: rotY },
              { x: rotX + panelWidthM, y: rotY },
              { x: rotX + panelWidthM, y: rotY + panelHeightM },
              { x: rotX, y: rotY + panelHeightM },
            ];
            
            // 7. Rotate panel corners back to local ENU meter coordinates
            const meterGeoCorners = rotatedCorners.map(p => 
              rotatePoint(p, meterCentroid, axisAngle)
            );
            
            // 8. Convert meters back to geographic coordinates
            const geoCorners = meterGeoCorners.map(p => ({
              x: p.x / metersPerDegreeLng + centroid.x,  // lng
              y: p.y / metersPerDegreeLat + centroid.y   // lat
            }));
            
            // 9. Create test points for all 4 panel corners
            const testPoints = geoCorners.map(c => new google.maps.LatLng(c.y, c.x));
            
            // 10. HYBRID CONTAINMENT CHECK: At least 3 of 4 corners must be inside polygon
            // This allows panels along angled edges (1 corner may slightly overhang)
            // while preventing major protrusions (2+ corners outside = rejected)
            const cornersInsideCount = testPoints.filter((point) => 
              google.maps.geometry.poly.containsLocation(point, solarPolygonPath)
            ).length;
            if (cornersInsideCount < 3) {
              rejectedByContainment++;
              continue; // Too many corners outside polygon boundary
            }
            
            // 11. Test no corners are in constraint polygons
            const anyPointInConstraint = constraintPolygonPaths.some((cp) => 
              testPoints.some((point) => google.maps.geometry.poly.containsLocation(point, cp))
            );
            if (anyPointInConstraint) {
              rejectedByConstraint++;
              continue;
            }

            // 12. Accept panel
            acceptedCount++;
            const bottomLeft = geoCorners[0];
            
            // Determine quadrant based on rotated position
            const quadrant = (panelCenterX >= 0 ? 'E' : 'W') + (rowCenterY >= 0 ? 'N' : 'S');
            
            positions.push({ 
              lat: bottomLeft.y, 
              lng: bottomLeft.x, 
              widthDeg: panelWidthDeg, 
              heightDeg: panelHeightDeg,
              polygonId: polygon.id,
              corners: geoCorners.map(c => ({ lat: c.y, lng: c.x })),
              gridRow: rowIdx,
              gridCol: panelIdx,
              quadrant: quadrant,
            });
          }
        }
        } // end row loop
      } // end else (convex polygon)
      
      // DEBUG: Log placement stats
      console.log(`[RoofVisualization] Polygon ${polygon.label || polygon.id} placement:`, {
        accepted: acceptedCount,
        rejectedByContainment,
        rejectedByConstraint,
        estimatedCapacityKW: Math.round(acceptedCount * 0.59),
        isConcave,
      });
    });
    
    // =========================================================
    // POST-PROCESSING: Organize panels by quadrant for visualization
    // =========================================================
    // The central access pathways already create 4 sub-arrays
    // Edge cleaning has been disabled to preserve accurate capacity counts
    // (Future enhancement: connected-component based cleanup for cleaner edges)
    
    const rectangularizedPositions = positions;
    
    // Log quadrant distribution for debugging
    const quadrantCounts = { EN: 0, ES: 0, WN: 0, WS: 0 };
    positions.forEach(p => {
      if (p.quadrant && p.quadrant in quadrantCounts) {
        quadrantCounts[p.quadrant as keyof typeof quadrantCounts]++;
      }
    });
    console.log(`[RoofVisualization] Panel distribution by quadrant:`, quadrantCounts);

    // Sort by latitude (south to north) for optimal solar filling in Quebec
    // Use rectangularized positions for clean commercial sub-arrays
    const sortedPositions = [...rectangularizedPositions].sort((a, b) => {
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

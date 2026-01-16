import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Home, Sun, Zap, Maximize2, Layers, AlertTriangle, Camera } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import type { RoofPolygon } from "@shared/schema";

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve();
      return;
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => reject(new Error('Google Maps script failed to load')));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=drawing,geometry&callback=initGoogleMaps`;
    script.async = true;
    script.defer = true;

    (window as any).initGoogleMaps = () => {
      delete (window as any).initGoogleMaps;
      resolve();
    };

    script.onerror = () => {
      reject(new Error('Google Maps script failed to load'));
    };

    document.head.appendChild(script);
  });
}

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
  polygonId: string;
  corners?: { lat: number; lng: number }[];
  rowIndex?: number;  // Row position for straight-row layout
  colIndex?: number;  // Column position within row
  priority?: number;  // Higher = more central, should be kept when reducing
}

// ═══════════════════════════════════════════════════════════════════════════════
// KB RACKING VALIDATED SPECIFICATIONS - Based on 18 real projects (~40 MW)
// Product: AeroGrid 10° Landscape with Jinko 625W bifacial panels
// Source: KB Racking engineering drawings & quotes (Oct-Dec 2025)
// ═══════════════════════════════════════════════════════════════════════════════

// Panel specifications - Jinko Solar 625W bifacial
const PANEL_KW = 0.625;                   // 625W = 0.625 kW
const PANEL_WIDTH_M = 2.382;              // Length in landscape orientation (mm: 2382)
const PANEL_HEIGHT_M = 1.134;             // Width in landscape orientation (mm: 1134)
const PANEL_THICKNESS_MM = 30;            // Panel thickness
const PANEL_WEIGHT_KG = 32.4;             // Per KB Racking specs
const PANEL_CELL_TYPE = 72;               // 72-cell bifacial

// Racking specifications - AeroGrid 10° Landscape
const RACKING_WEIGHT_KG_PER_PANEL = 12.838644;  // Per KB Racking ballast reports
const PANEL_GAP_M = 0.10;                 // Thermal expansion gap between panels
const PERIMETER_SETBACK_M = 1.22;         // KB standard edge setback (was 1.2m)

// Fixed row geometry - KB Racking standard for Quebec (validated across 18 sites)
const KB_ROW_SPACING_M = 1.557;           // Row-to-row distance (center to center)
const KB_INTER_ROW_SPACING_M = 0.435;     // Gap between back of row 1 and front of row 2
const PANEL_TILT_DEG = 10.0;              // AeroGrid 10° system
const SUN_ALTITUDE_WINTER_SOLSTICE_DEG = 21.5; // Quebec winter sun angle

// Maintenance corridor constants (IFC fire code compliance)
const MAINTENANCE_CORRIDOR_WIDTH_M = 1.22; // 4 feet (1.22m) minimum for firefighter access
const MAINTENANCE_CORRIDOR_SPACING_M = 40; // Maximum array section before corridor required

// Quebec solar yield constants (based on RNCan data for ~45-48° latitude)
const QUEBEC_BASE_YIELD_KWH_KWP = 1150;   // kWh/kWp/year for south-facing at optimal tilt
const YIELD_LOSS_10DEG_TILT = 0.06;       // ~6% loss for 10° vs 35-45° optimal tilt
const BIFACIAL_GAIN_PERCENT = 0.08;       // ~8% additional yield for bifacial panels

// Ballast system structural load constants (KB Racking ballast reports)
// AeroGrid uses concrete pavers, weight varies by wind zone (36.75 lb factor typical)
const BALLAST_KG_PER_SQM = 30;            // Average ballast for Quebec wind zones (q50=0.40-0.44 kPa)

// Calculate yield adjustment based on panel orientation deviation from true south
// South = 180° azimuth, East-West rows have panels facing south
function calculateOrientationYieldFactor(panelRowAngleRad: number): { factor: number; deviationDeg: number } {
  // Panel row angle: 0 = east-west rows (panels face south) = optimal
  // π/2 = north-south rows (panels face east or west) = worst
  const deviationFromOptimal = Math.min(panelRowAngleRad, Math.PI - panelRowAngleRad);
  const deviationDeg = deviationFromOptimal * 180 / Math.PI;
  
  // Yield loss: approximately 0.5% per degree of azimuth deviation from south
  // Max loss at 90° deviation (east or west facing): ~25-30%
  const lossPercent = Math.min(30, deviationDeg * 0.35);
  const factor = 1 - (lossPercent / 100);
  
  return { factor, deviationDeg };
}

// Calculate estimated annual yield in kWh/kWp
function calculateEstimatedYield(panelRowAngleRad: number, tiltDeg: number): number {
  const baseYield = QUEBEC_BASE_YIELD_KWH_KWP;
  const { factor: orientationFactor } = calculateOrientationYieldFactor(panelRowAngleRad);
  
  // Tilt loss: 10° is suboptimal vs 35-45° for Quebec latitude
  const tiltFactor = tiltDeg < 15 ? (1 - YIELD_LOSS_10DEG_TILT) : 1.0;
  
  return Math.round(baseYield * orientationFactor * tiltFactor);
}

// Calculate structural load in kg/m²
function calculateStructuralLoad(panelCount: number, roofAreaSqM: number): number {
  if (roofAreaSqM <= 0) return 0;
  
  const totalPanelWeight = panelCount * PANEL_WEIGHT_KG;
  const totalRackingWeight = panelCount * RACKING_WEIGHT_KG_PER_PANEL;
  const panelAreaSqM = panelCount * PANEL_WIDTH_M * PANEL_HEIGHT_M;
  const totalBallastWeight = panelAreaSqM * BALLAST_KG_PER_SQM;
  
  // Distribute weight over the usable roof area (where panels are installed)
  const totalWeight = totalPanelWeight + totalRackingWeight + totalBallastWeight;
  return Math.round(totalWeight / panelAreaSqM * 10) / 10; // kg/m² with 1 decimal
}

// KB Racking uses fixed row geometry validated for Quebec winter shading
// This replaces dynamic calculation with industry-validated constants
// Total row pitch = inter-row gap + panel width in direction of tilt
// KB standard: 1.557m row spacing provides optimal winter shading with 10° tilt
const ROW_SPACING_M = KB_ROW_SPACING_M;  // Use KB Racking validated value (1.557m)

// Legacy anti-shading calculation (kept for reference/comparison)
function calculateAntiShadingRowSpacing(panelHeightM: number, tiltDeg: number, sunAltitudeDeg: number): number {
  const tiltRad = tiltDeg * Math.PI / 180;
  const sunAltRad = sunAltitudeDeg * Math.PI / 180;
  const panelVerticalHeight = panelHeightM * Math.sin(tiltRad);
  const shadowLength = panelVerticalHeight / Math.tan(sunAltRad);
  return Math.max(0.3, shadowLength);
}

function formatNumber(num: number, language: string): string {
  return num.toLocaleString(language === "fr" ? "fr-CA" : "en-CA");
}

function isConstraintPolygon(polygon: RoofPolygon): boolean {
  const label = polygon.label?.toLowerCase() || "";
  return label.includes("constraint") || label.includes("obstacle") || 
         label.includes("hvac") || label.includes("skylight") || 
         label.includes("contrainte") || label.includes("obstruction");
}

function computeCentroid(coords: [number, number][]): { lat: number; lng: number } {
  let sumLat = 0, sumLng = 0;
  for (const [lng, lat] of coords) {
    sumLat += lat;
    sumLng += lng;
  }
  return { lat: sumLat / coords.length, lng: sumLng / coords.length };
}

// Find the longest edge within a SINGLE polygon and return its angle and length in meters
function computeLongestEdgeOfPolygon(coords: [number, number][], centroidLat: number): { angle: number; lengthM: number } {
  if (coords.length < 2) return { angle: 0, lengthM: 0 };
  
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos(centroidLat * Math.PI / 180);
  
  let maxLenM = 0;
  let bestAngle = 0;
  
  // Find the longest TRUE edge in this polygon (consecutive vertices only)
  for (let i = 0; i < coords.length; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[(i + 1) % coords.length];
    
    // Convert to meters for accurate length comparison
    const dxM = (lng2 - lng1) * metersPerDegreeLng;
    const dyM = (lat2 - lat1) * metersPerDegreeLat;
    const lenM = Math.sqrt(dxM * dxM + dyM * dyM);
    
    if (lenM > maxLenM) {
      maxLenM = lenM;
      bestAngle = Math.atan2(dyM, dxM);
    }
  }
  
  // Normalize to [0, π) - we only care about orientation, not direction
  while (bestAngle < 0) bestAngle += Math.PI;
  while (bestAngle >= Math.PI) bestAngle -= Math.PI;
  
  return { angle: bestAngle, lengthM: maxLenM };
}

// Find the longest edge across MULTIPLE polygons (evaluating each polygon separately)
// This avoids creating spurious edges between disjoint polygons
function findLongestEdgeAcrossPolygons(polygonCoordsList: [number, number][][]): { angle: number; lengthM: number } {
  let globalMaxLenM = 0;
  let globalBestAngle = 0;
  
  for (const coords of polygonCoordsList) {
    if (coords.length < 3) continue;
    const centroid = computeCentroid(coords);
    const { angle, lengthM } = computeLongestEdgeOfPolygon(coords, centroid.lat);
    
    if (lengthM > globalMaxLenM) {
      globalMaxLenM = lengthM;
      globalBestAngle = angle;
    }
  }
  
  return { angle: globalBestAngle, lengthM: globalMaxLenM };
}

// Hybrid approach: Use longest edge angle, but fall back to south-facing if edge deviates > 45° from east-west
// South-facing panels have rows running east-west (angle = 0 or π)
function computeHybridPanelOrientationFromPolygons(polygonCoordsList: [number, number][][]): { angle: number; source: string } {
  if (polygonCoordsList.length === 0) return { angle: 0, source: "default" };
  
  const { angle: longestEdgeAngle, lengthM } = findLongestEdgeAcrossPolygons(polygonCoordsList);
  
  if (lengthM === 0) return { angle: 0, source: "default" };
  
  // South-facing means rows run east-west, which is angle = 0 or π (normalized to 0)
  // An angle of π/2 (90°) means rows run north-south (not optimal for solar)
  
  // Calculate deviation from east-west (0 or π)
  // Since angle is normalized to [0, π), check distance to 0 and to π
  const deviationFromEastWest = Math.min(longestEdgeAngle, Math.PI - longestEdgeAngle);
  
  // Convert to degrees for logging
  const deviationDegrees = deviationFromEastWest * 180 / Math.PI;
  const longestEdgeDegrees = longestEdgeAngle * 180 / Math.PI;
  
  // If deviation is more than 45° from east-west, use true south orientation
  const MAX_DEVIATION_RAD = Math.PI / 4; // 45 degrees
  
  if (deviationFromEastWest > MAX_DEVIATION_RAD) {
    console.log(`[Orientation] Longest edge at ${longestEdgeDegrees.toFixed(1)}° (${lengthM.toFixed(1)}m) deviates ${deviationDegrees.toFixed(1)}° from E-W (>45°) → using TRUE SOUTH (0°)`);
    return { angle: 0, source: "south-facing (fallback)" };
  }
  
  console.log(`[Orientation] Longest edge at ${longestEdgeDegrees.toFixed(1)}° (${lengthM.toFixed(1)}m) deviates ${deviationDegrees.toFixed(1)}° from E-W (≤45°) → using BUILDING EDGE`);
  return { angle: longestEdgeAngle, source: "building edge" };
}

// Legacy wrapper for single polygon (used by generatePanelPositions)
function computeHybridPanelOrientation(coords: [number, number][]): { angle: number; source: string } {
  return computeHybridPanelOrientationFromPolygons([coords]);
}

function rotatePoint(
  lat: number, 
  lng: number, 
  centerLat: number, 
  centerLng: number, 
  angleRad: number
): { lat: number; lng: number } {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dLat = lat - centerLat;
  const dLng = lng - centerLng;
  return {
    lat: centerLat + dLat * cos - dLng * sin,
    lng: centerLng + dLat * sin + dLng * cos
  };
}

function metersToDegreesLat(meters: number): number {
  return meters / 111320;
}

function metersToDegreesLng(meters: number, latitude: number): number {
  return meters / (111320 * Math.cos(latitude * Math.PI / 180));
}

function computeSignedArea(coords: { x: number; y: number }[]): number {
  let area = 0;
  const n = coords.length;
  for (let i = 0; i < n; i++) {
    const curr = coords[i];
    const next = coords[(i + 1) % n];
    area += curr.x * next.y - next.x * curr.y;
  }
  return area / 2;
}

function insetPolygonCoords(
  coords: [number, number][],
  offsetMeters: number,
  centroidLat: number
): [number, number][] | null {
  if (coords.length < 3) return null;
  
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos(centroidLat * Math.PI / 180);
  
  const meterCoords = coords.map(([lng, lat]) => ({
    x: lng * metersPerDegreeLng,
    y: lat * metersPerDegreeLat
  }));
  
  const signedArea = computeSignedArea(meterCoords);
  const windingSign = signedArea >= 0 ? 1 : -1;
  
  const n = meterCoords.length;
  const insetPoints: { x: number; y: number }[] = [];
  
  for (let i = 0; i < n; i++) {
    const prev = meterCoords[(i - 1 + n) % n];
    const curr = meterCoords[i];
    const next = meterCoords[(i + 1) % n];
    
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    if (len1 < 0.001) continue;
    const nx1 = (-dy1 / len1) * windingSign;
    const ny1 = (dx1 / len1) * windingSign;
    
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    if (len2 < 0.001) continue;
    const nx2 = (-dy2 / len2) * windingSign;
    const ny2 = (dx2 / len2) * windingSign;
    
    const avgNx = (nx1 + nx2) / 2;
    const avgNy = (ny1 + ny2) / 2;
    const avgLen = Math.sqrt(avgNx * avgNx + avgNy * avgNy);
    
    if (avgLen < 0.01) {
      insetPoints.push({ x: curr.x + nx1 * offsetMeters, y: curr.y + ny1 * offsetMeters });
    } else {
      const scale = offsetMeters / avgLen;
      const maxScale = 3.0;
      const clampedScale = Math.min(scale, offsetMeters * maxScale);
      insetPoints.push({ x: curr.x + avgNx * clampedScale, y: curr.y + avgNy * clampedScale });
    }
  }
  
  if (insetPoints.length < 3) return null;
  
  const insetArea = Math.abs(computeSignedArea(insetPoints));
  const originalArea = Math.abs(signedArea);
  // Allow more tolerance for complex polygons - inset can be 50% smaller for L-shapes
  if (insetArea > originalArea * 1.05 || insetArea < originalArea * 0.005) {
    console.log(`[RoofVisualization] Inset polygon invalid: original=${originalArea.toFixed(0)}m², inset=${insetArea.toFixed(0)}m²`);
    return null;
  }
  
  return insetPoints.map(p => [
    p.x / metersPerDegreeLng,
    p.y / metersPerDegreeLat
  ] as [number, number]);
}

// Calculate minimum distance from a point to any edge of a polygon (in meters)
function pointToPolygonDistance(
  pointLat: number,
  pointLng: number,
  coords: [number, number][],
  centroidLat: number
): number {
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos(centroidLat * Math.PI / 180);
  
  const px = pointLng * metersPerDegreeLng;
  const py = pointLat * metersPerDegreeLat;
  
  let minDistance = Infinity;
  const n = coords.length;
  
  for (let i = 0; i < n; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[(i + 1) % n];
    
    const x1 = lng1 * metersPerDegreeLng;
    const y1 = lat1 * metersPerDegreeLat;
    const x2 = lng2 * metersPerDegreeLng;
    const y2 = lat2 * metersPerDegreeLat;
    
    // Distance from point to line segment
    const dx = x2 - x1;
    const dy = y2 - y1;
    const segmentLenSq = dx * dx + dy * dy;
    
    let distance: number;
    if (segmentLenSq < 0.0001) {
      // Degenerate segment (essentially a point)
      distance = Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    } else {
      // Project point onto line and clamp to segment
      const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / segmentLenSq));
      const closestX = x1 + t * dx;
      const closestY = y1 + t * dy;
      distance = Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
    }
    
    minDistance = Math.min(minDistance, distance);
  }
  
  return minDistance;
}

function expandPolygonCoords(
  coords: [number, number][],
  offsetMeters: number,
  centroidLat: number
): [number, number][] | null {
  // Expand polygon outward (opposite of inset) for obstacle clearance zones
  if (coords.length < 3) return null;
  
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos(centroidLat * Math.PI / 180);
  
  const meterCoords = coords.map(([lng, lat]) => ({
    x: lng * metersPerDegreeLng,
    y: lat * metersPerDegreeLat
  }));
  
  const signedArea = computeSignedArea(meterCoords);
  const windingSign = signedArea >= 0 ? 1 : -1;
  const expandSign = -windingSign; // Opposite direction for expansion
  
  const n = meterCoords.length;
  const expandedPoints: { x: number; y: number }[] = [];
  
  for (let i = 0; i < n; i++) {
    const prev = meterCoords[(i - 1 + n) % n];
    const curr = meterCoords[i];
    const next = meterCoords[(i + 1) % n];
    
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    if (len1 < 0.001) continue;
    const nx1 = (-dy1 / len1) * expandSign;
    const ny1 = (dx1 / len1) * expandSign;
    
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    if (len2 < 0.001) continue;
    const nx2 = (-dy2 / len2) * expandSign;
    const ny2 = (dx2 / len2) * expandSign;
    
    const avgNx = (nx1 + nx2) / 2;
    const avgNy = (ny1 + ny2) / 2;
    const avgLen = Math.sqrt(avgNx * avgNx + avgNy * avgNy);
    
    if (avgLen < 0.01) {
      expandedPoints.push({ x: curr.x + nx1 * offsetMeters, y: curr.y + ny1 * offsetMeters });
    } else {
      const scale = offsetMeters / avgLen;
      const maxScale = 3.0;
      const clampedScale = Math.min(scale, offsetMeters * maxScale);
      expandedPoints.push({ x: curr.x + avgNx * clampedScale, y: curr.y + avgNy * clampedScale });
    }
  }
  
  if (expandedPoints.length < 3) return null;
  
  return expandedPoints.map(p => [
    p.x / metersPerDegreeLng,
    p.y / metersPerDegreeLat
  ] as [number, number]);
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
  const panelPolygonsRef = useRef<google.maps.Polygon[]>([]);
  const roofPolygonObjectsRef = useRef<google.maps.Polygon[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [allPanelPositions, setAllPanelPositions] = useState<PanelPosition[]>([]);
  const [selectedCapacityKW, setSelectedCapacityKW] = useState(currentPVSizeKW || 100);
  const [hasUserAdjusted, setHasUserAdjusted] = useState(false);
  const [totalUsableArea, setTotalUsableArea] = useState(0);
  const [constraintArea, setConstraintArea] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [panelsPerZone, setPanelsPerZone] = useState<Record<string, { count: number; label: string }>>({});
  const [zoneCount, setZoneCount] = useState(0);
  const [panelOrientationAngle, setPanelOrientationAngle] = useState(0); // Radians
  const [orientationSource, setOrientationSource] = useState<string>("default");
  
  // Dual orientation comparison state
  const [buildingAlignedPanels, setBuildingAlignedPanels] = useState<PanelPosition[]>([]);
  const [trueSouthPanels, setTrueSouthPanels] = useState<PanelPosition[]>([]);
  const [buildingAlignedAngle, setBuildingAlignedAngle] = useState(0);
  const [trueSouthAngle, setTrueSouthAngle] = useState(0);
  const [selectedOrientation, setSelectedOrientation] = useState<"building" | "south">("building");

  const { data: roofPolygons = [] } = useQuery<RoofPolygon[]>({
    queryKey: ["/api/sites", siteId, "roof-polygons"],
    enabled: !!siteId,
  });

  const netUsableArea = Math.max(0, totalUsableArea - constraintArea);
  const maxCapacity = allPanelPositions.length > 0 
    ? Math.round(allPanelPositions.length * PANEL_KW)
    : Math.round((netUsableArea > 0 ? netUsableArea : (roofAreaSqFt ? roofAreaSqFt * 0.0929 : 1000)) * 0.85 * 0.187);
  const minCapacity = Math.round(maxCapacity * 0.1);

  const panelsToShow = useMemo(() => {
    const targetPanels = Math.round(selectedCapacityKW / PANEL_KW);
    return Math.min(targetPanels, allPanelPositions.length);
  }, [selectedCapacityKW, allPanelPositions.length]);

  useEffect(() => {
    if (!hasUserAdjusted && currentPVSizeKW) {
      setSelectedCapacityKW(currentPVSizeKW);
    }
  }, [currentPVSizeKW, hasUserAdjusted]);

  useEffect(() => {
    if (!hasUserAdjusted && maxCapacity > 0) {
      // If currentPVSizeKW is provided (detailed analysis), use it
      // If NOT provided (quick potential mode), show 100% of max capacity
      const defaultCapacity = currentPVSizeKW || maxCapacity;
      setSelectedCapacityKW(Math.min(defaultCapacity, maxCapacity));
    }
  }, [maxCapacity, currentPVSizeKW, hasUserAdjusted]);

  // NEW: Generate panels with UNIFIED axis but PER-POLYGON iteration for performance
  // This calculates a shared axis from all polygons but iterates each polygon's bbox separately
  // forceOrientationAngle: if provided, use this angle instead of calculating from building edges
  const generateUnifiedPanelPositions = useCallback((
    solarPolygonData: { polygon: google.maps.Polygon; id: string; coords: [number, number][] }[],
    constraintPolygons: google.maps.Polygon[],
    constraintCoordsData: [number, number][][],
    forceOrientationAngle?: number // Optional: force specific orientation (radians)
  ): { panels: PanelPosition[]; orientationAngle: number; orientationSource: string } => {
    if (solarPolygonData.length === 0) return { panels: [], orientationAngle: 0, orientationSource: "default" };
    
    // Step 1: Extract polygon coordinates list for unified axis calculation
    // IMPORTANT: Keep polygons separate to avoid creating spurious edges between them
    const polygonCoordsList = solarPolygonData.map(({ coords }) => coords);
    
    // Combine vertices only for centroid calculation (not for edge detection)
    const allCoords: [number, number][] = [];
    for (const coords of polygonCoordsList) {
      allCoords.push(...coords);
    }
    
    const globalCentroid = computeCentroid(allCoords);
    
    // Use forced orientation if provided, otherwise calculate from building edges
    let unifiedAxisAngle: number;
    let orientationSourceLabel: string;
    
    if (forceOrientationAngle !== undefined) {
      unifiedAxisAngle = forceOrientationAngle;
      orientationSourceLabel = "true south";
      console.log(`[RoofVisualization] FORCED AXIS: ${(unifiedAxisAngle * 180 / Math.PI).toFixed(1)}° (true south)`);
    } else {
      // NEW: Use per-polygon edge detection to find the longest TRUE edge
      const orientationResult = computeHybridPanelOrientationFromPolygons(polygonCoordsList);
      unifiedAxisAngle = orientationResult.angle;
      orientationSourceLabel = orientationResult.source;
      console.log(`[RoofVisualization] UNIFIED AXIS: ${(unifiedAxisAngle * 180 / Math.PI).toFixed(1)}° (${orientationResult.source}) from ${solarPolygonData.length} polygon(s)`);
    }
    
    // Step 1.5: Expand constraint polygons for obstacle clearance (1.2m setback)
    const expandedConstraintPolygons: google.maps.Polygon[] = [];
    for (let i = 0; i < constraintCoordsData.length; i++) {
      const constraintCoords = constraintCoordsData[i];
      if (constraintCoords.length < 3) {
        expandedConstraintPolygons.push(constraintPolygons[i]);
        continue;
      }
      const constraintCentroid = computeCentroid(constraintCoords);
      const expandedCoords = expandPolygonCoords(constraintCoords, PERIMETER_SETBACK_M, constraintCentroid.lat);
      if (expandedCoords) {
        const expandedPath = expandedCoords.map(([lng, lat]) => ({ lat, lng }));
        expandedConstraintPolygons.push(new google.maps.Polygon({ paths: expandedPath }));
      } else {
        // Fallback: use original constraint polygon
        expandedConstraintPolygons.push(constraintPolygons[i]);
      }
    }
    console.log(`[RoofVisualization] Expanded ${expandedConstraintPolygons.length} constraint polygons for 1.2m clearance`);
    
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = 111320 * Math.cos(globalCentroid.lat * Math.PI / 180);
    
    const panelPitchX = PANEL_WIDTH_M + PANEL_GAP_M;
    // KB_ROW_SPACING_M (1.557m) is already the center-to-center row pitch
    // Do NOT add PANEL_HEIGHT_M - that was doubling the row spacing!
    const panelPitchY = ROW_SPACING_M; // 1.557m center-to-center (KB validated)
    
    const cos = Math.cos(-unifiedAxisAngle);
    const sin = Math.sin(-unifiedAxisAngle);
    const cosPos = Math.cos(unifiedAxisAngle);
    const sinPos = Math.sin(unifiedAxisAngle);
    
    // Step 2: Process each polygon separately with its own bbox but unified axis
    const allPanels: PanelPosition[] = [];
    let totalAccepted = 0;
    let totalRejectedByRoof = 0;
    let totalRejectedByConstraint = 0;
    
    for (const { polygon, id, coords } of solarPolygonData) {
      // Use THIS polygon's centroid for distance calculations
      const localCentroid = computeCentroid(coords);
      
      // NEW: Use distance-based validation instead of inset polygon
      // This works correctly for L-shaped and concave polygons where inset fails
      console.log(`[RoofVisualization] Polygon ${id.slice(0,8)}: using distance-based validation (1.2m setback)`);
      
      // The original polygon for containment check
      const originalPath = coords.map(([lng, lat]) => ({ lat, lng }));
      const originalPolygon = new google.maps.Polygon({ paths: originalPath });
      
      // Compute THIS polygon's bounding box in unified rotated space
      let minXRot = Infinity, maxXRot = -Infinity, minYRot = Infinity, maxYRot = -Infinity;
      for (const [lng, lat] of coords) {
        const x = (lng - globalCentroid.lng) * metersPerDegreeLng;
        const y = (lat - globalCentroid.lat) * metersPerDegreeLat;
        const rx = x * cos - y * sin;
        const ry = x * sin + y * cos;
        minXRot = Math.min(minXRot, rx);
        maxXRot = Math.max(maxXRot, rx);
        minYRot = Math.min(minYRot, ry);
        maxYRot = Math.max(maxYRot, ry);
      }
      
      // Add proportional margin for this polygon only
      const rawWidth = maxXRot - minXRot;
      const rawHeight = maxYRot - minYRot;
      const maxDimension = Math.max(rawWidth, rawHeight);
      const MARGIN_M = Math.max(50, maxDimension * 0.3);
      
      minXRot -= MARGIN_M;
      maxXRot += MARGIN_M;
      minYRot -= MARGIN_M;
      maxYRot += MARGIN_M;
      
      // Snap grid origin to global alignment so panels align across polygons
      const gridOriginX = Math.floor(minXRot / panelPitchX) * panelPitchX;
      const gridOriginY = Math.floor(minYRot / panelPitchY) * panelPitchY;
      
      // Generate grid positions for this polygon
      const xPositions: number[] = [];
      const yPositions: number[] = [];
      
      for (let x = gridOriginX; x + PANEL_WIDTH_M <= maxXRot; x += panelPitchX) {
        if (x >= minXRot - panelPitchX) xPositions.push(x);
      }
      for (let y = gridOriginY; y + PANEL_HEIGHT_M <= maxYRot; y += panelPitchY) {
        if (y >= minYRot - panelPitchY) yPositions.push(y);
      }
      
      console.log(`[RoofVisualization] Polygon ${id.slice(0,8)}: bbox=${Math.round(rawWidth)}×${Math.round(rawHeight)}m, grid=${xPositions.length}×${yPositions.length}`);
      
      let accepted = 0;
      let rejectedByRoof = 0;
      let rejectedByConstraint = 0;
      
      // Iterate this polygon's grid
      for (let colIdx = 0; colIdx < xPositions.length; colIdx++) {
        for (let rowIdx = 0; rowIdx < yPositions.length; rowIdx++) {
          const gridX = xPositions[colIdx];
          const gridY = yPositions[rowIdx];
          
          // Panel corners in rotated space
          const panelCornersRotated = [
            { x: gridX, y: gridY },
            { x: gridX + PANEL_WIDTH_M, y: gridY },
            { x: gridX + PANEL_WIDTH_M, y: gridY + PANEL_HEIGHT_M },
            { x: gridX, y: gridY + PANEL_HEIGHT_M }
          ];
          
          // Convert back to geographic coordinates using GLOBAL centroid
          const panelCornersGeo = panelCornersRotated.map(corner => {
            const unrotatedX = corner.x * cosPos - corner.y * sinPos;
            const unrotatedY = corner.x * sinPos + corner.y * cosPos;
            return {
              lat: globalCentroid.lat + unrotatedY / metersPerDegreeLat,
              lng: globalCentroid.lng + unrotatedX / metersPerDegreeLng
            };
          });
          
          // Panel center for validation
          const panelCenterLat = (panelCornersGeo[0].lat + panelCornersGeo[2].lat) / 2;
          const panelCenterLng = (panelCornersGeo[0].lng + panelCornersGeo[2].lng) / 2;
          const panelCenter = new google.maps.LatLng(panelCenterLat, panelCenterLng);
          
          // NEW: Distance-based validation (works for L-shapes, concave polygons)
          // Step 1: Check if panel center is inside the ORIGINAL polygon
          if (!google.maps.geometry.poly.containsLocation(panelCenter, originalPolygon)) {
            rejectedByRoof++;
            continue;
          }
          
          // Step 2: Check if panel center is at least 1.2m from polygon boundary
          // Note: This matches original inset polygon behavior where center must be inside inset
          // The 1.2m is measured from panel CENTER (same as original approach) for consistency
          const distanceToBoundary = pointToPolygonDistance(panelCenterLat, panelCenterLng, coords, localCentroid.lat);
          if (distanceToBoundary < PERIMETER_SETBACK_M) {
            rejectedByRoof++;
            continue;
          }
          
          // Check constraints (using expanded polygons for 1.2m obstacle clearance)
          let inConstraint = false;
          for (const constraint of expandedConstraintPolygons) {
            if (google.maps.geometry.poly.containsLocation(panelCenter, constraint)) {
              inConstraint = true;
              break;
            }
          }
          
          if (inConstraint) {
            rejectedByConstraint++;
            continue;
          }
          
          // Maintenance corridor check (IFC fire code for large roofs)
          // Create corridors every 40m for firefighter access and maintenance
          if (rawWidth > MAINTENANCE_CORRIDOR_SPACING_M || rawHeight > MAINTENANCE_CORRIDOR_SPACING_M) {
            // Check if panel falls in a maintenance corridor
            const panelCenterX = gridX + PANEL_WIDTH_M / 2;
            const panelCenterY = gridY + PANEL_HEIGHT_M / 2;
            
            // Corridors run perpendicular to row direction, spaced every 40m
            // Calculate distance from corridor center lines
            const corridorSpacingWithGap = MAINTENANCE_CORRIDOR_SPACING_M + MAINTENANCE_CORRIDOR_WIDTH_M;
            
            // X-axis corridors (if width > 40m)
            if (rawWidth > MAINTENANCE_CORRIDOR_SPACING_M) {
              const distFromCorridorX = Math.abs(((panelCenterX - minXRot + MARGIN_M) % corridorSpacingWithGap) - corridorSpacingWithGap / 2);
              if (distFromCorridorX < MAINTENANCE_CORRIDOR_WIDTH_M / 2 && 
                  panelCenterX > minXRot + MARGIN_M + 20 && 
                  panelCenterX < maxXRot - MARGIN_M - 20) {
                rejectedByConstraint++;
                continue;
              }
            }
            
            // Y-axis corridors (if height > 40m)
            if (rawHeight > MAINTENANCE_CORRIDOR_SPACING_M) {
              const distFromCorridorY = Math.abs(((panelCenterY - minYRot + MARGIN_M) % corridorSpacingWithGap) - corridorSpacingWithGap / 2);
              if (distFromCorridorY < MAINTENANCE_CORRIDOR_WIDTH_M / 2 &&
                  panelCenterY > minYRot + MARGIN_M + 20 &&
                  panelCenterY < maxYRot - MARGIN_M - 20) {
                rejectedByConstraint++;
                continue;
              }
            }
          }
          
          // Priority based on global grid position (for consistent slider behavior)
          const globalRowIdx = Math.round(gridY / panelPitchY);
          const globalColIdx = Math.round(gridX / panelPitchX);
          const priority = 1000000 - Math.abs(globalRowIdx) * 1000 - Math.abs(globalColIdx);
          
          allPanels.push({
            lat: panelCornersGeo[0].lat,
            lng: panelCornersGeo[0].lng,
            widthDeg: metersToDegreesLng(PANEL_WIDTH_M, globalCentroid.lat),
            heightDeg: metersToDegreesLat(PANEL_HEIGHT_M),
            polygonId: id,
            corners: panelCornersGeo,
            rowIndex: globalRowIdx,
            colIndex: globalColIdx,
            priority
          });
          
          accepted++;
        }
      }
      
      totalAccepted += accepted;
      totalRejectedByRoof += rejectedByRoof;
      totalRejectedByConstraint += rejectedByConstraint;
      
      console.log(`[RoofVisualization] Polygon ${id.slice(0,8)}: ${accepted} panels accepted, ${rejectedByRoof} outside, ${rejectedByConstraint} constraints`);
      
      // Warn if polygon generated 0 panels
      if (accepted === 0) {
        console.warn(`[RoofVisualization] WARNING: Polygon ${id.slice(0,8)} generated 0 panels! Grid positions checked: ${xPositions.length * yPositions.length}, rejected by roof: ${rejectedByRoof}, rejected by constraints: ${rejectedByConstraint}`);
      }
    }
    
    console.log(`[RoofVisualization] UNIFIED TOTAL: ${totalAccepted} panels, ${totalRejectedByRoof} outside roof, ${totalRejectedByConstraint} in constraints`);
    
    return { panels: allPanels, orientationAngle: unifiedAxisAngle, orientationSource: orientationSourceLabel };
  }, []);

  // LEGACY: Single polygon version (kept for backward compatibility)
  const generatePanelPositions = useCallback((
    solarPolygon: google.maps.Polygon,
    constraintPolygons: google.maps.Polygon[],
    polygonId: string,
    coords: [number, number][]
  ): PanelPosition[] => {
    const panels: PanelPosition[] = [];
    
    const centroid = computeCentroid(coords);
    const orientationResult = computeHybridPanelOrientation(coords);
    const axisAngle = orientationResult.angle;
    
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = 111320 * Math.cos(centroid.lat * Math.PI / 180);
    
    // Create inset polygon for 1.2m perimeter setback
    const insetCoords = insetPolygonCoords(coords, PERIMETER_SETBACK_M, centroid.lat);
    
    let validationPolygon: google.maps.Polygon;
    if (insetCoords) {
      const insetPath = insetCoords.map(([lng, lat]) => ({ lat, lng }));
      validationPolygon = new google.maps.Polygon({ paths: insetPath });
    } else {
      validationPolygon = solarPolygon;
    }
    
    // ===== ROBUST APPROACH: Polygon vertices → Rotated bbox + fixed margin =====
    // Step 1: Convert ALL polygon vertices to rotated meter space
    const cos = Math.cos(-axisAngle);
    const sin = Math.sin(-axisAngle);
    
    let minXRot = Infinity, maxXRot = -Infinity, minYRot = Infinity, maxYRot = -Infinity;
    for (const [lng, lat] of coords) {
      const x = (lng - centroid.lng) * metersPerDegreeLng;
      const y = (lat - centroid.lat) * metersPerDegreeLat;
      const rx = x * cos - y * sin;
      const ry = x * sin + y * cos;
      minXRot = Math.min(minXRot, rx);
      maxXRot = Math.max(maxXRot, rx);
      minYRot = Math.min(minYRot, ry);
      maxYRot = Math.max(maxYRot, ry);
    }
    
    // Step 2: Add PROPORTIONAL margin to guarantee all corners are covered
    // For skewed polygons, rotated bbox vertices can miss corners - use 50% of max dimension
    const rawWidth = maxXRot - minXRot;
    const rawHeight = maxYRot - minYRot;
    const maxDimension = Math.max(rawWidth, rawHeight);
    const MARGIN_M = Math.max(100, maxDimension * 0.5); // At least 100m, or 50% of max dimension
    console.log(`[RoofVisualization] Polygon ${polygonId.slice(0,8)}: raw bbox=${Math.round(rawWidth)}×${Math.round(rawHeight)}m, margin=${Math.round(MARGIN_M)}m`);
    minXRot -= MARGIN_M;
    maxXRot += MARGIN_M;
    minYRot -= MARGIN_M;
    maxYRot += MARGIN_M;
    
    const bboxWidth = maxXRot - minXRot;
    const bboxHeight = maxYRot - minYRot;
    
    if (bboxWidth < PANEL_WIDTH_M || bboxHeight < PANEL_HEIGHT_M) {
      console.log(`[RoofVisualization] Polygon ${polygonId.slice(0,8)} too small for panels`);
      return panels;
    }
    
    // Step 3: Generate grid in ROTATED space (correct spacing)
    const panelPitchX = PANEL_WIDTH_M + PANEL_GAP_M;
    // KB_ROW_SPACING_M (1.557m) is already the center-to-center row pitch
    const panelPitchY = ROW_SPACING_M; // 1.557m center-to-center (KB validated)
    
    const xPositions: number[] = [];
    const yPositions: number[] = [];
    
    for (let x = minXRot; x + PANEL_WIDTH_M <= maxXRot; x += panelPitchX) {
      xPositions.push(x);
    }
    for (let y = minYRot; y + PANEL_HEIGHT_M <= maxYRot; y += panelPitchY) {
      yPositions.push(y);
    }
    
    console.log(`[RoofVisualization] Polygon ${polygonId.slice(0,8)}: rotated bbox=${Math.round(bboxWidth)}×${Math.round(bboxHeight)}m, axis=${(axisAngle * 180 / Math.PI).toFixed(1)}°`);
    console.log(`[RoofVisualization] Grid: ${xPositions.length} cols × ${yPositions.length} rows = ${xPositions.length * yPositions.length} potential positions`);
    
    let accepted = 0;
    let rejectedByRoof = 0;
    let rejectedByConstraint = 0;
    
    const cosPos = Math.cos(axisAngle);
    const sinPos = Math.sin(axisAngle);
    
    // Step 4: For each grid position, create panel and validate
    for (let colIdx = 0; colIdx < xPositions.length; colIdx++) {
      for (let rowIdx = 0; rowIdx < yPositions.length; rowIdx++) {
        const gridX = xPositions[colIdx];
        const gridY = yPositions[rowIdx];
        
        // Panel corners in rotated space
        const panelCornersRotated = [
          { x: gridX, y: gridY },
          { x: gridX + PANEL_WIDTH_M, y: gridY },
          { x: gridX + PANEL_WIDTH_M, y: gridY + PANEL_HEIGHT_M },
          { x: gridX, y: gridY + PANEL_HEIGHT_M }
        ];
        
        // Convert back to geographic coordinates
        const panelCornersGeo = panelCornersRotated.map(corner => {
          const unrotatedX = corner.x * cosPos - corner.y * sinPos;
          const unrotatedY = corner.x * sinPos + corner.y * cosPos;
          return {
            lat: centroid.lat + unrotatedY / metersPerDegreeLat,
            lng: centroid.lng + unrotatedX / metersPerDegreeLng
          };
        });
        
        // Panel center for validation
        const panelCenterLat = (panelCornersGeo[0].lat + panelCornersGeo[2].lat) / 2;
        const panelCenterLng = (panelCornersGeo[0].lng + panelCornersGeo[2].lng) / 2;
        const panelCenter = new google.maps.LatLng(panelCenterLat, panelCenterLng);
        
        if (!google.maps.geometry.poly.containsLocation(panelCenter, validationPolygon)) {
          rejectedByRoof++;
          continue;
        }
        
        // Check constraints
        let inConstraint = false;
        for (const constraint of constraintPolygons) {
          if (google.maps.geometry.poly.containsLocation(panelCenter, constraint)) {
            inConstraint = true;
            break;
          }
        }
        
        if (inConstraint) {
          rejectedByConstraint++;
          continue;
        }
        
        // Priority: center rows first (for slider behavior)
        const centerRowIdx = (yPositions.length - 1) / 2;
        const centerColIdx = (xPositions.length - 1) / 2;
        const maxRowDist = Math.max(centerRowIdx, yPositions.length - 1 - centerRowIdx) || 1;
        const maxColDist = Math.max(centerColIdx, xPositions.length - 1 - centerColIdx) || 1;
        
        const rowDistNorm = Math.abs(rowIdx - centerRowIdx) / maxRowDist;
        const colDistNorm = Math.abs(colIdx - centerColIdx) / maxColDist;
        
        const priority = Math.round((1 - rowDistNorm) * 1000000 + (1 - colDistNorm) * 1000);
        
        panels.push({
          lat: panelCornersGeo[0].lat,
          lng: panelCornersGeo[0].lng,
          widthDeg: metersToDegreesLng(PANEL_WIDTH_M, centroid.lat),
          heightDeg: metersToDegreesLat(PANEL_HEIGHT_M),
          polygonId,
          corners: panelCornersGeo,
          rowIndex: rowIdx,
          colIndex: colIdx,
          priority
        });
        
        accepted++;
      }
    }
    
    console.log(`[RoofVisualization] Polygon ${polygonId.slice(0,8)}: ${accepted} panels accepted, ${rejectedByRoof} outside roof, ${rejectedByConstraint} in constraints`);
    
    return panels;
  }, []);

  // Sort panels by priority (center rows first, then center columns)
  // This creates straight parallel rows instead of circular quadrant-based layout
  const sortPanelsByRowPriority = useCallback((panels: PanelPosition[]): PanelPosition[] => {
    // Global sort by priority - highest first (center rows/columns)
    // This ensures all polygons fill uniformly based on their panel positions
    const sorted = [...panels].sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    // Count polygons for logging
    const polygonIds = new Set(panels.map(p => p.polygonId));
    console.log(`[RoofVisualization] Sorted ${sorted.length} panels by row priority across ${polygonIds.size} polygon(s)`);
    
    return sorted;
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current) {
      setIsLoading(false);
      return;
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setMapError(language === "fr" ? "Clé API Google Maps manquante" : "Google Maps API key missing");
      setIsLoading(false);
      return;
    }

    const initMap = async () => {
      try {
        await loadGoogleMapsScript(apiKey);

        if (!mapContainerRef.current || !window.google) {
          setMapError(language === "fr" ? "Google Maps non disponible" : "Google Maps not available");
          setIsLoading(false);
          return;
        }

        const map = new google.maps.Map(mapContainerRef.current!, {
          center: { lat: latitude, lng: longitude },
          zoom: 18,
          mapTypeId: "satellite",
          tilt: 0,
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        mapRef.current = map;

        panelPolygonsRef.current.forEach(p => p.setMap(null));
        panelPolygonsRef.current = [];
        roofPolygonObjectsRef.current.forEach(p => p.setMap(null));
        roofPolygonObjectsRef.current = [];

        if (roofPolygons.length === 0) {
          setIsLoading(false);
          return;
        }

        const solarPolygons: RoofPolygon[] = [];
        const constraintPolygonData: RoofPolygon[] = [];
        let totalSolarArea = 0;
        let totalConstraintArea = 0;

        for (const polygon of roofPolygons) {
          const coords = polygon.coordinates as [number, number][];
          if (!coords || coords.length < 3) continue;

          if (isConstraintPolygon(polygon)) {
            constraintPolygonData.push(polygon);
            totalConstraintArea += polygon.areaSqM || 0;
          } else {
            solarPolygons.push(polygon);
            totalSolarArea += polygon.areaSqM || 0;
          }
        }

        setTotalUsableArea(totalSolarArea);
        setConstraintArea(totalConstraintArea);

        const constraintGooglePolygons: google.maps.Polygon[] = [];
        const constraintCoordsArray: [number, number][][] = [];
        for (const polygon of constraintPolygonData) {
          const coords = polygon.coordinates as [number, number][];
          constraintCoordsArray.push(coords);
          const path = coords.map(([lng, lat]) => ({ lat, lng }));
          
          const googlePolygon = new google.maps.Polygon({
            paths: path,
            strokeColor: "#f97316",
            strokeOpacity: 0.9,
            strokeWeight: 2,
            fillColor: "#f97316",
            fillOpacity: 0.4,
            map,
          });
          
          constraintGooglePolygons.push(googlePolygon);
          roofPolygonObjectsRef.current.push(googlePolygon);
        }

        // Create Google polygon objects for all solar polygons
        const solarPolygonDataForUnified: { polygon: google.maps.Polygon; id: string; coords: [number, number][] }[] = [];
        
        for (const polygon of solarPolygons) {
          const coords = polygon.coordinates as [number, number][];
          const path = coords.map(([lng, lat]) => ({ lat, lng }));
          
          const solarGooglePolygon = new google.maps.Polygon({
            paths: path,
            strokeColor: "#14b8a6",
            strokeOpacity: 0.9,
            strokeWeight: 2,
            fillColor: "#14b8a6",
            fillOpacity: 0.15,
            map,
          });
          
          roofPolygonObjectsRef.current.push(solarGooglePolygon);
          solarPolygonDataForUnified.push({
            polygon: solarGooglePolygon,
            id: polygon.id,
            coords
          });
        }

        // Generate panels using UNIFIED approach - DUAL ORIENTATION (building + true south)
        // 1. Building-aligned orientation (default)
        const buildingResult = generateUnifiedPanelPositions(
          solarPolygonDataForUnified,
          constraintGooglePolygons,
          constraintCoordsArray
        );
        
        // 2. True south orientation (0 radians = east-west rows, panels face south)
        const trueSouthResult = generateUnifiedPanelPositions(
          solarPolygonDataForUnified,
          constraintGooglePolygons,
          constraintCoordsArray,
          0 // Force 0° = east-west rows = panels facing true south
        );
        
        const sortedBuildingPanels = sortPanelsByRowPriority(buildingResult.panels);
        const sortedSouthPanels = sortPanelsByRowPriority(trueSouthResult.panels);
        
        // Store both layouts
        setBuildingAlignedPanels(sortedBuildingPanels);
        setTrueSouthPanels(sortedSouthPanels);
        setBuildingAlignedAngle(buildingResult.orientationAngle);
        setTrueSouthAngle(0);
        
        // Default to building-aligned view
        const sortedPanels = sortedBuildingPanels;
        setAllPanelPositions(sortedPanels);
        setPanelOrientationAngle(buildingResult.orientationAngle);
        setOrientationSource(buildingResult.orientationSource);
        
        console.log(`[RoofVisualization] Dual layouts generated: Building=${sortedBuildingPanels.length} panels, TrueSouth=${sortedSouthPanels.length} panels`);
        
        // Track panels per zone for legend display
        const zoneStats: Record<string, { count: number; label: string }> = {};
        for (const panel of sortedPanels) {
          if (!zoneStats[panel.polygonId]) {
            const polygon = solarPolygons.find(p => p.id === panel.polygonId);
            zoneStats[panel.polygonId] = { 
              count: 0, 
              label: polygon?.label || `Zone ${Object.keys(zoneStats).length + 1}` 
            };
          }
          zoneStats[panel.polygonId].count++;
        }
        setPanelsPerZone(zoneStats);
        setZoneCount(Object.keys(zoneStats).length);

        console.log(`[RoofVisualization] Total panels generated: ${sortedPanels.length}, capacity: ${Math.round(sortedPanels.length * PANEL_KW)} kWc, zones: ${Object.keys(zoneStats).length}`);

        if (onGeometryCalculated && sortedPanels.length > 0) {
          onGeometryCalculated({
            maxCapacityKW: Math.round(sortedPanels.length * PANEL_KW),
            panelCount: sortedPanels.length,
            realisticCapacityKW: Math.round(sortedPanels.length * PANEL_KW * 0.9),
            constraintAreaSqM: totalConstraintArea
          });
        }

        if (solarPolygons.length > 0) {
          const bounds = new google.maps.LatLngBounds();
          for (const polygon of solarPolygons) {
            const coords = polygon.coordinates as [number, number][];
            for (const [lng, lat] of coords) {
              bounds.extend({ lat, lng });
            }
          }
          map.fitBounds(bounds, 50);
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Map initialization error:", error);
        setMapError(language === "fr" ? "Erreur de chargement de la carte" : "Map loading error");
        setIsLoading(false);
      }
    };

    initMap();
  }, [latitude, longitude, roofPolygons, language, generateUnifiedPanelPositions, sortPanelsByRowPriority, onGeometryCalculated]);

  useEffect(() => {
    if (!mapRef.current || allPanelPositions.length === 0) return;

    panelPolygonsRef.current.forEach(p => p.setMap(null));
    panelPolygonsRef.current = [];

    const panelsToRender = allPanelPositions.slice(0, panelsToShow);

    for (const panel of panelsToRender) {
      let path: google.maps.LatLngLiteral[];
      
      if (panel.corners && panel.corners.length === 4) {
        path = panel.corners;
      } else {
        path = [
          { lat: panel.lat, lng: panel.lng },
          { lat: panel.lat, lng: panel.lng + panel.widthDeg },
          { lat: panel.lat + panel.heightDeg, lng: panel.lng + panel.widthDeg },
          { lat: panel.lat + panel.heightDeg, lng: panel.lng }
        ];
      }

      const panelPolygon = new google.maps.Polygon({
        paths: path,
        strokeColor: "#1e40af",
        strokeOpacity: 0.9,
        strokeWeight: 0.5,
        fillColor: "#3b82f6",
        fillOpacity: 0.85,
        map: mapRef.current,
      });

      panelPolygonsRef.current.push(panelPolygon);
    }
  }, [allPanelPositions, panelsToShow]);

  // Effect to switch panel layout when orientation selection changes
  useEffect(() => {
    if (buildingAlignedPanels.length === 0 && trueSouthPanels.length === 0) return;
    
    if (selectedOrientation === "building" && buildingAlignedPanels.length > 0) {
      setAllPanelPositions(buildingAlignedPanels);
      setPanelOrientationAngle(buildingAlignedAngle);
      setOrientationSource("building edge");
    } else if (selectedOrientation === "south" && trueSouthPanels.length > 0) {
      setAllPanelPositions(trueSouthPanels);
      setPanelOrientationAngle(trueSouthAngle);
      setOrientationSource("true south");
    }
  }, [selectedOrientation, buildingAlignedPanels, trueSouthPanels, buildingAlignedAngle, trueSouthAngle]);

  const handleFullscreen = useCallback(() => {
    if (mapContainerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        mapContainerRef.current.requestFullscreen();
      }
    }
  }, []);

  const handleExportImage = useCallback(async () => {
    if (!mapRef.current) return;

    setIsExporting(true);

    try {
      const center = mapRef.current.getCenter();
      const zoom = mapRef.current.getZoom() || 18;
      
      if (!center) {
        throw new Error("Map center not available");
      }

      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      const lat = center.lat();
      const lng = center.lng();
      
      let pathParams = "";
      
      const solarPolygonsList = roofPolygons.filter((p) => !isConstraintPolygon(p));
      solarPolygonsList.forEach((polygon) => {
        const coords = polygon.coordinates as [number, number][];
        if (coords && coords.length >= 3) {
          const pathCoords = coords.map(([pLng, pLat]) => `${pLat},${pLng}`).join("|");
          pathParams += `&path=fillcolor:0x3b82f660|color:0x1e40af|weight:2|${pathCoords}`;
        }
      });
      
      const constraintPolygonsList = roofPolygons.filter((p) => isConstraintPolygon(p));
      constraintPolygonsList.forEach((polygon) => {
        const coords = polygon.coordinates as [number, number][];
        if (coords && coords.length >= 3) {
          const pathCoords = coords.map(([pLng, pLat]) => `${pLat},${pLng}`).join("|");
          pathParams += `&path=fillcolor:0xf9731660|color:0xf97316|weight:2|${pathCoords}`;
        }
      });
      
      const panelsToExport = allPanelPositions.slice(0, panelsToShow);
      const maxMarkers = 50;
      const step = Math.max(1, Math.floor(panelsToExport.length / maxMarkers));
      const sampledPanels = panelsToExport.filter((_, idx) => idx % step === 0);
      
      let markerParams = "";
      sampledPanels.forEach((pos) => {
        const centerLat = pos.lat + pos.heightDeg / 2;
        const centerLng = pos.lng + pos.widthDeg / 2;
        markerParams += `&markers=size:tiny|color:0x1e40af|${centerLat},${centerLng}`;
      });

      const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=800x600&scale=2&maptype=satellite${pathParams}${markerParams}&key=${apiKey}`;

      const response = await fetch(staticMapUrl);
      if (!response.ok) {
        throw new Error("Failed to fetch static map");
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
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

  const sliderMarkers = useMemo(() => {
    const markers: { value: number; label: string }[] = [];
    markers.push({ value: minCapacity, label: "Min" });
    if (currentPVSizeKW && currentPVSizeKW > minCapacity && currentPVSizeKW < maxCapacity) {
      markers.push({ value: currentPVSizeKW, label: language === "fr" ? "Recommandé" : "Recommended" });
    }
    markers.push({ value: maxCapacity, label: "Max" });
    return markers;
  }, [minCapacity, maxCapacity, currentPVSizeKW, language]);

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
          {/* North Arrow Indicator */}
          <div 
            className="flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm rounded px-2 py-1"
            title={language === "fr" ? "Nord" : "North"}
            data-testid="north-arrow-indicator"
          >
            <svg 
              width="20" 
              height="24" 
              viewBox="0 0 20 24" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
              className="text-white"
            >
              <path 
                d="M10 2L4 14H10V22L16 10H10V2Z" 
                fill="currentColor" 
                stroke="currentColor" 
                strokeWidth="1"
              />
              <path 
                d="M10 2L4 14H10V2Z" 
                fill="white"
              />
              <path 
                d="M10 14V22L16 10H10V14Z" 
                fill="rgba(255,255,255,0.5)"
              />
            </svg>
            <span className="text-[10px] font-bold text-white -mt-0.5">N</span>
          </div>
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
                  {formatNumber(Math.round(maxCapacity), language)} kWc {language === "fr" ? "potentiel max" : "max potential"}
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
            {zoneCount > 1 && (
              <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm px-2 py-1 rounded text-xs text-white">
                <div className="w-3 h-3 bg-teal-500/60 border border-teal-400 rounded-sm" />
                <span>{zoneCount} {language === "fr" ? "zones unifiées" : "unified zones"}</span>
              </div>
            )}
            {constraintArea > 0 && (
              <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm px-2 py-1 rounded text-xs text-white">
                <div className="w-3 h-3 bg-orange-500/60 border border-orange-400 rounded-sm" />
                <span>{language === "fr" ? "Contraintes" : "Constraints"}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {hasPolygons && allPanelPositions.length > 0 && (
        <div className="bg-card border-t p-4 pb-6" data-testid="capacity-slider-section">
          <div className="flex flex-col gap-2 mb-3">
            <div className="flex items-center justify-between">
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
            {/* Technical Parameters Row 1 */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-blue-500 rounded-full" />
                {PANEL_WIDTH_M}×{PANEL_HEIGHT_M}m @ {PANEL_KW * 1000}W
              </span>
              <span>•</span>
              <span>{language === "fr" ? "Inclinaison" : "Tilt"}: {PANEL_TILT_DEG}°</span>
              <span>•</span>
              <span>{language === "fr" ? "Espacement rangées" : "Row spacing"}: {ROW_SPACING_M.toFixed(2)}m</span>
              <span>•</span>
              <span>{language === "fr" ? "Marge périmètre" : "Perimeter setback"}: {PERIMETER_SETBACK_M}m</span>
            </div>
            {/* Performance Metrics Row 2 */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Estimated Yield */}
              <Badge variant="secondary" className="text-xs font-normal gap-1" data-testid="badge-yield">
                <Zap className="w-3 h-3" />
                {language === "fr" ? "Rendement" : "Yield"}: {calculateEstimatedYield(panelOrientationAngle, PANEL_TILT_DEG)} kWh/kWp
              </Badge>
              
              {/* Orientation info */}
              {(() => {
                const { deviationDeg } = calculateOrientationYieldFactor(panelOrientationAngle);
                const lossPercent = Math.round(deviationDeg * 0.35);
                return deviationDeg > 0 ? (
                  <Badge variant={lossPercent > 10 ? "destructive" : "outline"} className="text-xs font-normal gap-1" data-testid="badge-orientation">
                    {language === "fr" ? "Orientation" : "Orientation"}: {orientationSource === "building edge" 
                      ? (language === "fr" ? "aligné bâtiment" : "building-aligned")
                      : (language === "fr" ? "plein sud" : "true south")}
                    {lossPercent > 0 && ` (-${lossPercent}%)`}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs font-normal gap-1 border-green-500 text-green-700" data-testid="badge-orientation">
                    {language === "fr" ? "Orientation optimale (Sud)" : "Optimal orientation (South)"}
                  </Badge>
                );
              })()}
              
              {/* Structural Load */}
              {panelsToShow > 0 && netUsableArea > 0 && (
                <Badge variant="outline" className="text-xs font-normal gap-1" data-testid="badge-load">
                  <Layers className="w-3 h-3" />
                  {language === "fr" ? "Charge" : "Load"}: {calculateStructuralLoad(panelsToShow, panelsToShow * PANEL_WIDTH_M * PANEL_HEIGHT_M)} kg/m²
                </Badge>
              )}
              
              {/* Utilization */}
              {allPanelPositions.length > 0 && (
                <span className="text-muted-foreground">
                  {language === "fr" ? "Utilisation" : "Utilization"}: {((panelsToShow / allPanelPositions.length) * 100).toFixed(0)}%
                </span>
              )}
            </div>
            
            {/* Orientation Comparison Panel */}
            {buildingAlignedPanels.length > 0 && trueSouthPanels.length > 0 && (
              <div className="mt-3 p-3 bg-muted/50 rounded-lg border" data-testid="orientation-comparison">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    {language === "fr" ? "Comparaison d'orientation" : "Orientation Comparison"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {/* Building-aligned option */}
                  <button
                    onClick={() => setSelectedOrientation("building")}
                    className={`p-2 rounded-md border text-left transition-all ${
                      selectedOrientation === "building" 
                        ? "border-primary bg-primary/10 ring-1 ring-primary" 
                        : "border-muted-foreground/30 hover:border-muted-foreground/50"
                    }`}
                    data-testid="btn-orientation-building"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Home className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        {language === "fr" ? "Aligné bâtiment" : "Building-aligned"}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div>{buildingAlignedPanels.length} {language === "fr" ? "panneaux" : "panels"} • {Math.round(buildingAlignedPanels.length * PANEL_KW)} kWc</div>
                      <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        {calculateEstimatedYield(buildingAlignedAngle, PANEL_TILT_DEG)} kWh/kWp
                        {(() => {
                          const { deviationDeg } = calculateOrientationYieldFactor(buildingAlignedAngle);
                          const loss = Math.round(deviationDeg * 0.35);
                          return loss > 0 ? <span className="text-amber-600">(-{loss}%)</span> : null;
                        })()}
                      </div>
                    </div>
                  </button>
                  
                  {/* True south option */}
                  <button
                    onClick={() => setSelectedOrientation("south")}
                    className={`p-2 rounded-md border text-left transition-all ${
                      selectedOrientation === "south" 
                        ? "border-green-500 bg-green-500/10 ring-1 ring-green-500" 
                        : "border-muted-foreground/30 hover:border-muted-foreground/50"
                    }`}
                    data-testid="btn-orientation-south"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Sun className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-medium">
                        {language === "fr" ? "Plein sud" : "True South"}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div>{trueSouthPanels.length} {language === "fr" ? "panneaux" : "panels"} • {Math.round(trueSouthPanels.length * PANEL_KW)} kWc</div>
                      <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        {calculateEstimatedYield(0, PANEL_TILT_DEG)} kWh/kWp
                        <span className="text-green-600">(optimal)</span>
                      </div>
                    </div>
                  </button>
                </div>
                
                {/* Production difference summary */}
                {(() => {
                  const buildingYield = calculateEstimatedYield(buildingAlignedAngle, PANEL_TILT_DEG);
                  const southYield = calculateEstimatedYield(0, PANEL_TILT_DEG);
                  const buildingProduction = buildingAlignedPanels.length * PANEL_KW * buildingYield;
                  const southProduction = trueSouthPanels.length * PANEL_KW * southYield;
                  const difference = southProduction - buildingProduction;
                  const percentDiff = buildingProduction > 0 ? ((difference / buildingProduction) * 100) : 0;
                  
                  return (
                    <div className="mt-2 pt-2 border-t text-xs">
                      {difference > 0 ? (
                        <span className="text-green-700">
                          {language === "fr" 
                            ? `Plein sud produirait +${formatNumber(Math.round(difference), language)} kWh/an (+${percentDiff.toFixed(1)}%)`
                            : `True south would produce +${formatNumber(Math.round(difference), language)} kWh/yr (+${percentDiff.toFixed(1)}%)`
                          }
                        </span>
                      ) : difference < 0 ? (
                        <span className="text-amber-700">
                          {language === "fr"
                            ? `Aligné bâtiment produit ${formatNumber(Math.round(Math.abs(difference)), language)} kWh/an de plus grâce à ${buildingAlignedPanels.length - trueSouthPanels.length} panneaux additionnels`
                            : `Building-aligned produces ${formatNumber(Math.round(Math.abs(difference)), language)} kWh/yr more due to ${buildingAlignedPanels.length - trueSouthPanels.length} additional panels`
                          }
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          {language === "fr" ? "Production équivalente" : "Equivalent production"}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
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
            
            <div className="absolute left-0 right-0 bottom-0 flex justify-between text-xs text-muted-foreground">
              {sliderMarkers.filter(m => m.value <= maxCapacity).map((marker, idx) => {
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

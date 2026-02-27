import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Home, Sun, Zap, Maximize2, Layers, AlertTriangle, RefreshCw, PencilRuler, ChevronDown } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import type { RoofPolygon } from "@shared/schema";
import html2canvas from "html2canvas";

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
  onGeometryCalculated?: (data: { 
    maxCapacityKW: number; 
    panelCount: number; 
    realisticCapacityKW: number; 
    constraintAreaSqM: number;
    arrays?: ArrayInfo[];  // Panel arrays (sections separated by fire corridors)
  }) => void;
  onVisualizationReady?: (captureFunction: () => Promise<string | null>) => void;
  onOpenRoofDrawing?: () => void;
  captureMode?: boolean;
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
  arrayId?: number;   // Array number (1, 2, 3...) based on fire corridors
  gridX?: number;     // X position in rotated grid space (meters)
  gridY?: number;     // Y position in rotated grid space (meters)
}

// Array information (sections separated by fire corridors)
interface ArrayInfo {
  id: number;           // Array number (1, 2, 3...)
  panelCount: number;   // Total panels in this array
  rows: number;         // Number of rows in Y direction
  columns: number;      // Number of columns in X direction
  capacityKW: number;   // Total capacity of this array
  polygonId: string;    // Which roof polygon this array belongs to
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULAR ARRAY PLACEMENT — Top-down approach
// Instead of placing individual panels then filtering, we define standard
// rectangular array modules and tile the roof with them.
// Each module = N rows × M columns, identical and interchangeable.
// ═══════════════════════════════════════════════════════════════════════════════

interface ModulePlacement {
  moduleId: number;         // Sequential ID (1, 2, 3...)
  rows: number;             // Rows in this module
  cols: number;             // Columns in this module
  polygonId: string;        // Which roof polygon
  originX: number;          // Module origin in rotated space (meters)
  originY: number;
  panels: PanelPosition[];  // Individual panels inside this module
  capacityKW: number;       // cols × rows × PANEL_KW
  priority: number;         // For slider ordering (larger + interior = higher)
}

// Module size candidate for auto-optimization
interface ModuleSizeCandidate {
  rows: number;
  cols: number;
  widthM: number;    // Physical width including gaps
  depthM: number;    // Physical depth including row spacing
  panelCount: number;
  capacityKW: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// KB RACKING VALIDATED SPECIFICATIONS - Based on 18 real projects (~40 MW)
// Product: AeroGrid 10° Landscape with Jinko 660W bifacial panels
// Source: KB Racking engineering drawings & quotes (Oct-Dec 2025)
// ═══════════════════════════════════════════════════════════════════════════════

// Panel specifications - Jinko Solar JKM660N-66QL6-BDV 660W bifacial
const PANEL_KW = 0.660;                   // 660W = 0.660 kW
const PANEL_WIDTH_M = 2.382;              // Length in landscape orientation (mm: 2382)
const PANEL_HEIGHT_M = 1.134;             // Width in landscape orientation (mm: 1134)
const PANEL_THICKNESS_MM = 30;            // Panel thickness
const PANEL_WEIGHT_KG = 32.5;             // Per KB Racking specs
const PANEL_CELL_TYPE = 264;              // 264-cell (66×4) N-type TOPCon bifacial

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

// ═══════════════════════════════════════════════════════════════════════════════
// MODULAR ARRAY PLACEMENT ENGINE
// Top-down approach: define standard module sizes, tile the roof with them.
// Each module is a perfect rectangle by construction — no post-processing needed.
// ═══════════════════════════════════════════════════════════════════════════════

// Module inter-spacing (gap between adjacent modules for maintenance access)
const MODULE_GAP_M = 1.22; // IFC fire code: 1.22m (4 ft) between array sections

/**
 * Generate candidate module sizes to test for auto-optimization.
 * Returns realistic commercial array dimensions sorted by panel count (largest first).
 */
function defineModuleCandidates(): ModuleSizeCandidate[] {
  const panelPitchX = PANEL_WIDTH_M + PANEL_GAP_M; // 2.482m
  const panelPitchY = KB_ROW_SPACING_M;             // 1.557m center-to-center

  const candidates: ModuleSizeCandidate[] = [];
  // Test realistic commercial sizes: rows 2-5, cols 4-16
  const rowOptions = [2, 3, 4, 5];
  const colOptions = [4, 6, 8, 10, 12, 14, 16];

  for (const rows of rowOptions) {
    for (const cols of colOptions) {
      const widthM = cols * panelPitchX - PANEL_GAP_M; // No trailing gap
      const depthM = (rows - 1) * panelPitchY + PANEL_HEIGHT_M; // Last row uses panel height
      candidates.push({
        rows,
        cols,
        widthM,
        depthM,
        panelCount: rows * cols,
        capacityKW: Math.round(rows * cols * PANEL_KW * 100) / 100,
      });
    }
  }

  // Sort by panel count descending (try largest first)
  candidates.sort((a, b) => b.panelCount - a.panelCount);
  return candidates;
}

/**
 * Check if a module-sized rectangle fits at a given position on a roof polygon.
 * Validates all 4 corners of the module (not individual panels) against:
 * - Roof polygon containment with perimeter setback
 * - Obstacle/constraint clearance
 *
 * Returns true if the module fits cleanly.
 */
function modulePositionIsValid(
  moduleOriginX: number,
  moduleOriginY: number,
  moduleWidthM: number,
  moduleDepthM: number,
  cosPos: number,
  sinPos: number,
  localCentroid: { lat: number; lng: number },
  metersPerDegreeLat: number,
  localMetersPerDegreeLng: number,
  originalPolygon: google.maps.Polygon,
  coords: [number, number][],
  expandedConstraintPolygons: google.maps.Polygon[]
): boolean {
  // Module corners in rotated space (with setback margin included)
  const corners = [
    { x: moduleOriginX, y: moduleOriginY },
    { x: moduleOriginX + moduleWidthM, y: moduleOriginY },
    { x: moduleOriginX + moduleWidthM, y: moduleOriginY + moduleDepthM },
    { x: moduleOriginX, y: moduleOriginY + moduleDepthM },
  ];

  // Convert all 4 corners to geographic coordinates
  for (const corner of corners) {
    const unrotatedX = corner.x * cosPos - corner.y * sinPos;
    const unrotatedY = corner.x * sinPos + corner.y * cosPos;
    const lat = localCentroid.lat + unrotatedY / metersPerDegreeLat;
    const lng = localCentroid.lng + unrotatedX / localMetersPerDegreeLng;

    // Check containment: corner must be inside polygon
    const latLng = new google.maps.LatLng(lat, lng);
    if (!google.maps.geometry.poly.containsLocation(latLng, originalPolygon)) {
      return false;
    }

    // Check setback: corner must be at least PERIMETER_SETBACK_M from polygon edge
    const dist = pointToPolygonDistance(lat, lng, coords, localCentroid.lat);
    if (dist < PERIMETER_SETBACK_M) {
      return false;
    }

    // Check constraints: corner must be outside all expanded obstacle zones
    for (const constraint of expandedConstraintPolygons) {
      if (google.maps.geometry.poly.containsLocation(latLng, constraint)) {
        return false;
      }
    }
  }

  // Also check module center against constraints (catches obstacles fully inside module)
  const centerX = moduleOriginX + moduleWidthM / 2;
  const centerY = moduleOriginY + moduleDepthM / 2;
  const unrotCX = centerX * cosPos - centerY * sinPos;
  const unrotCY = centerX * sinPos + centerY * cosPos;
  const centerLat = localCentroid.lat + unrotCY / metersPerDegreeLat;
  const centerLng = localCentroid.lng + unrotCX / localMetersPerDegreeLng;
  const centerLatLng = new google.maps.LatLng(centerLat, centerLng);

  for (const constraint of expandedConstraintPolygons) {
    if (google.maps.geometry.poly.containsLocation(centerLatLng, constraint)) {
      return false;
    }
  }

  return true;
}

/**
 * Place modules of a given size on a single polygon.
 * Returns array of valid module placements with their individual panels.
 */
function placeModulesOnPolygon(
  moduleSize: ModuleSizeCandidate,
  polygonId: string,
  coords: [number, number][],
  originalPolygon: google.maps.Polygon,
  expandedConstraintPolygons: google.maps.Polygon[],
  localCentroid: { lat: number; lng: number },
  metersPerDegreeLat: number,
  localMetersPerDegreeLng: number,
  cos: number,
  sin: number,
  cosPos: number,
  sinPos: number,
  minXRot: number,
  maxXRot: number,
  minYRot: number,
  maxYRot: number,
  shadowZones: google.maps.Polygon[],
): ModulePlacement[] {
  const panelPitchX = PANEL_WIDTH_M + PANEL_GAP_M;
  const panelPitchY = KB_ROW_SPACING_M;

  // Module pitch = module size + inter-module gap
  const modulePitchX = moduleSize.widthM + MODULE_GAP_M;
  const modulePitchY = moduleSize.depthM + MODULE_GAP_M;

  // Grid origin for modules (snap to module pitch)
  const gridOriginX = Math.ceil(minXRot / modulePitchX) * modulePitchX;
  const gridOriginY = Math.ceil(minYRot / modulePitchY) * modulePitchY;

  const modules: ModulePlacement[] = [];
  let moduleId = 1;

  // Iterate module-sized slots across the polygon
  for (let mx = gridOriginX; mx + moduleSize.widthM <= maxXRot; mx += modulePitchX) {
    for (let my = gridOriginY; my + moduleSize.depthM <= maxYRot; my += modulePitchY) {
      // Validate the entire module footprint
      if (!modulePositionIsValid(
        mx, my, moduleSize.widthM, moduleSize.depthM,
        cosPos, sinPos,
        localCentroid, metersPerDegreeLat, localMetersPerDegreeLng,
        originalPolygon, coords, expandedConstraintPolygons
      )) {
        continue;
      }

      // Module is valid — generate individual panels inside it
      const panels: PanelPosition[] = [];
      for (let col = 0; col < moduleSize.cols; col++) {
        for (let row = 0; row < moduleSize.rows; row++) {
          const gridX = mx + col * panelPitchX;
          const gridY = my + row * panelPitchY;

          // Panel corners in rotated space
          const panelCornersRotated = [
            { x: gridX, y: gridY },
            { x: gridX + PANEL_WIDTH_M, y: gridY },
            { x: gridX + PANEL_WIDTH_M, y: gridY + PANEL_HEIGHT_M },
            { x: gridX, y: gridY + PANEL_HEIGHT_M },
          ];

          // Convert to geographic coordinates
          const panelCornersGeo = panelCornersRotated.map(corner => {
            const unrotatedX = corner.x * cosPos - corner.y * sinPos;
            const unrotatedY = corner.x * sinPos + corner.y * cosPos;
            return {
              lat: localCentroid.lat + unrotatedY / metersPerDegreeLat,
              lng: localCentroid.lng + unrotatedX / localMetersPerDegreeLng,
            };
          });

          const panelCenterLat = (panelCornersGeo[0].lat + panelCornersGeo[2].lat) / 2;
          const panelCenterLng = (panelCornersGeo[0].lng + panelCornersGeo[2].lng) / 2;

          // Shadow check for priority scoring
          let shadowPenalty = 0;
          const panelCenter = new google.maps.LatLng(panelCenterLat, panelCenterLng);
          for (const shadowPoly of shadowZones) {
            if (google.maps.geometry.poly.containsLocation(panelCenter, shadowPoly)) {
              shadowPenalty = 1.0;
              break;
            }
          }

          const distToEdge = pointToPolygonDistance(panelCenterLat, panelCenterLng, coords, localCentroid.lat);
          const approxMaxEdgeDist = Math.min(maxXRot - minXRot, maxYRot - minYRot) / 2;
          const edgeScore = approxMaxEdgeDist > 0 ? Math.min(1, distToEdge / approxMaxEdgeDist) : 0.5;

          const qualityScore = Math.round(
            (1 - shadowPenalty * 0.7) * 5000 +
            edgeScore * 3000 +
            2000
          );

          panels.push({
            lat: panelCornersGeo[0].lat,
            lng: panelCornersGeo[0].lng,
            widthDeg: (panelCornersGeo[1].lng - panelCornersGeo[0].lng),
            heightDeg: (panelCornersGeo[3].lat - panelCornersGeo[0].lat),
            polygonId,
            corners: panelCornersGeo,
            rowIndex: row,
            colIndex: col,
            priority: qualityScore,
            arrayId: moduleId,
            gridX: gridX + PANEL_WIDTH_M / 2,
            gridY: gridY + PANEL_HEIGHT_M / 2,
          });
        }
      }

      // Module priority: distance from polygon centroid center (interior modules first)
      const moduleCenterX = mx + moduleSize.widthM / 2;
      const moduleCenterY = my + moduleSize.depthM / 2;
      const roofCenterX = (minXRot + maxXRot) / 2;
      const roofCenterY = (minYRot + maxYRot) / 2;
      const distFromCenter = Math.sqrt(
        (moduleCenterX - roofCenterX) ** 2 + (moduleCenterY - roofCenterY) ** 2
      );
      const maxDist = Math.sqrt(
        ((maxXRot - minXRot) / 2) ** 2 + ((maxYRot - minYRot) / 2) ** 2
      ) || 1;
      // Interior modules get higher priority (20000 base, minus distance penalty)
      const modulePriority = Math.round(20000 * (1 - distFromCenter / maxDist));

      // Set all panels in this module to the same priority (module-level)
      for (const p of panels) {
        p.priority = modulePriority;
      }

      modules.push({
        moduleId: moduleId++,
        rows: moduleSize.rows,
        cols: moduleSize.cols,
        polygonId,
        originX: mx,
        originY: my,
        panels,
        capacityKW: Math.round(panels.length * PANEL_KW * 100) / 100,
        priority: modulePriority,
      });
    }
  }

  return modules;
}

/**
 * Auto-optimize module size: test multiple sizes and pick the one that
 * maximizes total panel count across all polygons.
 */
function autoOptimizeModuleSize(
  polygonData: {
    polygonId: string;
    coords: [number, number][];
    originalPolygon: google.maps.Polygon;
    localCentroid: { lat: number; lng: number };
    localMetersPerDegreeLng: number;
    minXRot: number; maxXRot: number;
    minYRot: number; maxYRot: number;
  }[],
  expandedConstraintPolygons: google.maps.Polygon[],
  metersPerDegreeLat: number,
  cos: number, sin: number, cosPos: number, sinPos: number,
  shadowZones: google.maps.Polygon[],
): { bestSize: ModuleSizeCandidate; bestModules: ModulePlacement[]; allResults: { size: ModuleSizeCandidate; totalPanels: number; moduleCount: number }[] } {
  const candidates = defineModuleCandidates();

  let bestTotalPanels = 0;
  let bestSize = candidates[0];
  let bestModules: ModulePlacement[] = [];
  const allResults: { size: ModuleSizeCandidate; totalPanels: number; moduleCount: number }[] = [];

  for (const size of candidates) {
    let totalPanels = 0;
    let totalModules = 0;
    const modules: ModulePlacement[] = [];

    for (const poly of polygonData) {
      const polyModules = placeModulesOnPolygon(
        size, poly.polygonId, poly.coords, poly.originalPolygon,
        expandedConstraintPolygons, poly.localCentroid,
        metersPerDegreeLat, poly.localMetersPerDegreeLng,
        cos, sin, cosPos, sinPos,
        poly.minXRot, poly.maxXRot, poly.minYRot, poly.maxYRot,
        shadowZones
      );
      totalPanels += polyModules.reduce((sum, m) => sum + m.panels.length, 0);
      totalModules += polyModules.length;
      modules.push(...polyModules);
    }

    allResults.push({ size, totalPanels, moduleCount: totalModules });

    if (totalPanels > bestTotalPanels) {
      bestTotalPanels = totalPanels;
      bestSize = size;
      bestModules = modules;
    }
  }

  return { bestSize, bestModules, allResults };
}

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

// Get the RAW building edge angle without any fallback logic
// Used when explicitly requesting building-aligned orientation
function getRawBuildingEdgeAngle(polygonCoordsList: [number, number][][]): { angle: number; source: string } {
  if (polygonCoordsList.length === 0) return { angle: 0, source: "default" };
  
  const { angle: longestEdgeAngle, lengthM } = findLongestEdgeAcrossPolygons(polygonCoordsList);
  
  if (lengthM === 0) return { angle: 0, source: "default" };
  
  const longestEdgeDegrees = longestEdgeAngle * 180 / Math.PI;
  console.log(`[Orientation] RAW building edge at ${longestEdgeDegrees.toFixed(1)}° (${lengthM.toFixed(1)}m) - NO FALLBACK`);
  return { angle: longestEdgeAngle, source: "building edge" };
}

// Hybrid approach: Use longest edge angle, but fall back to south-facing if edge deviates > 45° from east-west
// South-facing panels have rows running east-west (angle = 0 or π)
// NOTE: This is used for AUTO/DEFAULT mode only. For explicit building-aligned, use getRawBuildingEdgeAngle
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

function calculateShadowZones(
  constraintCoordsData: [number, number][][],
  centroidLat: number
): google.maps.Polygon[] {
  const SHADOW_PROJECTION_M = 5.0;
  const shadowDegLat = SHADOW_PROJECTION_M / 111320;

  const shadowPolygons: google.maps.Polygon[] = [];

  for (const coords of constraintCoordsData) {
    if (coords.length < 3) continue;

    const originalPath = coords.map(([lng, lat]) => ({ lat, lng }));
    const shiftedPath = coords.map(([lng, lat]) => ({ lat: lat + shadowDegLat, lng }));

    const shadowPath = [
      ...originalPath,
      ...shiftedPath.reverse(),
    ];

    shadowPolygons.push(new google.maps.Polygon({ paths: shadowPath }));
  }

  return shadowPolygons;
}

interface PolygonScore {
  polygonId: string;
  score: number;
  areaScore: number;
  exposureScore: number;
  centralityScore: number;
  southScore: number;
}

function scorePolygons(
  solarPolygonData: { id: string; coords: [number, number][] }[],
  shadowZones: google.maps.Polygon[],
  globalCentroid: { lat: number; lng: number }
): PolygonScore[] {
  if (solarPolygonData.length === 0) return [];

  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos(globalCentroid.lat * Math.PI / 180);

  const areas = solarPolygonData.map(({ coords }) => {
    const mCoords = coords.map(([lng, lat]) => ({
      x: lng * metersPerDegreeLng,
      y: lat * metersPerDegreeLat
    }));
    return Math.abs(computeSignedArea(mCoords));
  });
  const maxArea = Math.max(...areas);

  const centroids = solarPolygonData.map(({ coords }) => computeCentroid(coords));

  const distances = centroids.map(c => {
    const dx = (c.lng - globalCentroid.lng) * metersPerDegreeLng;
    const dy = (c.lat - globalCentroid.lat) * metersPerDegreeLat;
    return Math.sqrt(dx * dx + dy * dy);
  });
  const maxDistance = Math.max(...distances, 1);

  const lats = centroids.map(c => c.lat);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const latRange = maxLat - minLat || 1;

  const exposureScores = solarPolygonData.map(({ coords }) => {
    if (shadowZones.length === 0) return 1.0;

    const centroid = computeCentroid(coords);
    let totalSamples = 0;
    let shadedSamples = 0;

    const samplePoints = [...coords.map(([lng, lat]) => ({ lat, lng })), centroid];

    for (const point of samplePoints) {
      totalSamples++;
      const latLng = new google.maps.LatLng(point.lat, point.lng);
      for (const shadow of shadowZones) {
        if (google.maps.geometry.poly.containsLocation(latLng, shadow)) {
          shadedSamples++;
          break;
        }
      }
    }

    return totalSamples > 0 ? 1 - (shadedSamples / totalSamples) : 1.0;
  });

  return solarPolygonData.map(({ id }, i) => {
    const areaScore = maxArea > 0 ? (areas[i] / maxArea) * 100 : 50;
    const exposureScore = exposureScores[i] * 100;
    const centralityScore = (1 - distances[i] / maxDistance) * 100;
    const southScore = latRange > 0 ? (1 - (centroids[i].lat - minLat) / latRange) * 100 : 50;
    const adjustedSouthScore = solarPolygonData.length === 1 ? 50 : southScore;

    const score =
      exposureScore * 0.40 +
      areaScore * 0.35 +
      centralityScore * 0.15 +
      adjustedSouthScore * 0.10;

    return { polygonId: id, score, areaScore, exposureScore, centralityScore, southScore: adjustedSouthScore };
  });
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
  onVisualizationReady,
  onOpenRoofDrawing,
  captureMode,
}: RoofVisualizationProps) {
  const { language } = useI18n();
  const { toast } = useToast();
  const sectionRef = useRef<HTMLDivElement>(null);
  const mapAreaRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const sliderContainerRef = useRef<HTMLDivElement>(null);
  const [recommendedMarkerLeft, setRecommendedMarkerLeft] = useState<string | null>(null);
  const panelPolygonsRef = useRef<google.maps.Polygon[]>([]);
  const roofPolygonObjectsRef = useRef<google.maps.Polygon[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [allPanelPositions, setAllPanelPositions] = useState<PanelPosition[]>([]);
  const [selectedCapacityKW, setSelectedCapacityKW] = useState(currentPVSizeKW || 100);
  const [hasUserAdjusted, setHasUserAdjusted] = useState(false);
  const [totalUsableArea, setTotalUsableArea] = useState(0);
  const [constraintArea, setConstraintArea] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [panelsPerZone, setPanelsPerZone] = useState<Record<string, { count: number; label: string }>>({});
  const [zoneCount, setZoneCount] = useState(0);
  const [panelArrays, setPanelArrays] = useState<ArrayInfo[]>([]); // Panel arrays (numbered 1, 2, 3...)
  const [panelOrientationAngle, setPanelOrientationAngle] = useState(0); // Radians
  const [orientationSource, setOrientationSource] = useState<string>("default");
  const [arraysExpanded, setArraysExpanded] = useState(false);
  
  // Dual orientation comparison state
  const [buildingAlignedPanels, setBuildingAlignedPanels] = useState<PanelPosition[]>([]);
  const [trueSouthPanels, setTrueSouthPanels] = useState<PanelPosition[]>([]);
  const [buildingAlignedAngle, setBuildingAlignedAngle] = useState(0);
  const [trueSouthAngle, setTrueSouthAngle] = useState(0);
  const [selectedOrientation, setSelectedOrientation] = useState<"building" | "south">("building");
  const [hasUserSelectedOrientation, setHasUserSelectedOrientation] = useState(false);
  const prevSiteIdRef = useRef(siteId);
  const onGeometryCalculatedRef = useRef(onGeometryCalculated);
  onGeometryCalculatedRef.current = onGeometryCalculated;

  useEffect(() => {
    if (prevSiteIdRef.current !== siteId) {
      prevSiteIdRef.current = siteId;
      setHasUserSelectedOrientation(false);
    }
  }, [siteId]);

  const { data: roofPolygons = [] } = useQuery<RoofPolygon[]>({
    queryKey: ["/api/sites", siteId, "roof-polygons"],
    enabled: !!siteId,
  });

  const netUsableArea = Math.max(0, totalUsableArea - constraintArea);
  const maxCapacity = allPanelPositions.length > 0 
    ? Math.round(allPanelPositions.length * PANEL_KW)
    : Math.round((netUsableArea > 0 ? netUsableArea : (roofAreaSqFt ? roofAreaSqFt * 0.0929 : 1000)) * 0.85 / 3.71 * PANEL_KW);
  const minCapacity = Math.round(maxCapacity * 0.1);

  // Panels are grouped by module (arrayId). Detect module size from the data.
  const modulePanelCount = useMemo(() => {
    if (allPanelPositions.length === 0) return 1;
    // Count panels in the first module (all modules have the same size)
    const firstModuleId = allPanelPositions[0]?.arrayId;
    if (firstModuleId === undefined) return 1;
    let count = 0;
    for (const p of allPanelPositions) {
      if (p.arrayId === firstModuleId) count++;
      else break; // Panels are ordered by module, so first non-match = done
    }
    return Math.max(1, count);
  }, [allPanelPositions]);

  const totalModuleCount = useMemo(() => {
    return Math.max(1, Math.round(allPanelPositions.length / modulePanelCount));
  }, [allPanelPositions.length, modulePanelCount]);

  const moduleCapacityKW = Math.round(modulePanelCount * PANEL_KW * 100) / 100;

  // Slider snaps to whole modules
  const panelsToShow = useMemo(() => {
    const targetPanels = Math.round(selectedCapacityKW / PANEL_KW);
    // Snap to nearest whole module
    const targetModules = Math.max(1, Math.round(targetPanels / modulePanelCount));
    const cappedModules = Math.min(targetModules, totalModuleCount);
    return cappedModules * modulePanelCount;
  }, [selectedCapacityKW, allPanelPositions.length, modulePanelCount, totalModuleCount]);

  // visiblePanelArrays: each module = 1 array (simple, no heuristic grouping needed)
  const visiblePanelArrays = useMemo(() => {
    const visiblePanels = allPanelPositions.slice(0, panelsToShow);

    // Group by arrayId (= moduleId)
    const byModule = new Map<number, { panels: PanelPosition[]; polygonId: string }>();
    for (const p of visiblePanels) {
      const mid = p.arrayId ?? 0;
      if (!byModule.has(mid)) {
        byModule.set(mid, { panels: [], polygonId: p.polygonId });
      }
      byModule.get(mid)!.panels.push(p);
    }

    const arrays: ArrayInfo[] = [];
    // Sort by module ID
    const sortedModuleIds = Array.from(byModule.keys()).sort((a, b) => a - b);

    let arrayNumber = 1;
    for (const mid of sortedModuleIds) {
      const { panels, polygonId } = byModule.get(mid)!;
      if (panels.length === 0) continue;

      // Get rows/cols from module structure
      const rowIndices = panels.map(p => p.rowIndex ?? 0);
      const colIndices = panels.map(p => p.colIndex ?? 0);
      const rows = Math.max(...rowIndices) - Math.min(...rowIndices) + 1;
      const columns = Math.max(...colIndices) - Math.min(...colIndices) + 1;

      arrays.push({
        id: arrayNumber++,
        panelCount: panels.length,
        rows,
        columns,
        capacityKW: Math.round(panels.length * PANEL_KW * 10) / 10,
        polygonId,
      });
    }

    return arrays;
  }, [allPanelPositions, panelsToShow]);

  const prevPVSizeRef = useRef(currentPVSizeKW);
  useEffect(() => {
    if (currentPVSizeKW && currentPVSizeKW !== prevPVSizeRef.current) {
      prevPVSizeRef.current = currentPVSizeKW;
      setSelectedCapacityKW(currentPVSizeKW);
      setHasUserAdjusted(false);
      // Reset orientation so it re-evaluates at the new recommended size
      setHasUserSelectedOrientation(false);
    } else if (!hasUserAdjusted && currentPVSizeKW) {
      setSelectedCapacityKW(currentPVSizeKW);
    }
  }, [currentPVSizeKW, hasUserAdjusted]);

  useEffect(() => {
    if (!hasUserAdjusted && maxCapacity > 0) {
      const defaultCapacity = currentPVSizeKW || maxCapacity;
      setSelectedCapacityKW(Math.min(defaultCapacity, maxCapacity));
    }
  }, [maxCapacity, currentPVSizeKW, hasUserAdjusted]);

  // Dynamic orientation re-evaluation: follows the slider in real time when no manual choice has been made
  useEffect(() => {
    if (hasUserSelectedOrientation) return;
    if (buildingAlignedPanels.length === 0 || trueSouthPanels.length === 0) return;
    const buildingYieldFactor = calculateOrientationYieldFactor(buildingAlignedAngle).factor;
    const southYieldFactor = calculateOrientationYieldFactor(0).factor;
    const effectiveBuildingCount = Math.min(panelsToShow, buildingAlignedPanels.length);
    const effectiveSouthCount = Math.min(panelsToShow, trueSouthPanels.length);
    const buildingProduction = effectiveBuildingCount * PANEL_KW * buildingYieldFactor;
    const southProduction = effectiveSouthCount * PANEL_KW * southYieldFactor;
    setSelectedOrientation(southProduction >= buildingProduction ? "south" : "building");
  }, [panelsToShow, buildingAlignedPanels, trueSouthPanels, buildingAlignedAngle, hasUserSelectedOrientation]);

  useEffect(() => {
    if (!currentPVSizeKW || !sliderContainerRef.current || maxCapacity <= minCapacity) {
      setRecommendedMarkerLeft(null);
      return;
    }
    const snapped = Math.round(currentPVSizeKW / 10) * 10;
    const clamped = Math.max(minCapacity, Math.min(maxCapacity, snapped));
    if (clamped <= minCapacity || clamped >= maxCapacity) {
      setRecommendedMarkerLeft(null);
      return;
    }
    const computeMarkerLeft = () => {
      const container = sliderContainerRef.current;
      if (!container) return;
      const thumb = container.querySelector<HTMLElement>('[role="slider"]');
      if (!thumb) return;
      const thumbWidth = thumb.getBoundingClientRect().width || 20;
      const halfWidth = thumbWidth / 2;
      const pct = ((clamped - minCapacity) / (maxCapacity - minCapacity)) * 100;
      const offset = halfWidth - (pct / 50) * halfWidth;
      setRecommendedMarkerLeft(`calc(${pct}% + ${offset}px)`);
    };
    const timer = setTimeout(computeMarkerLeft, 150);
    return () => clearTimeout(timer);
  }, [currentPVSizeKW, minCapacity, maxCapacity, allPanelPositions.length]);

  // NEW: Generate panels with UNIFIED axis but PER-POLYGON iteration for performance
  // This calculates a shared axis from all polygons but iterates each polygon's bbox separately
  // forceOrientationAngle: if provided, use this angle instead of calculating from building edges
  // useBuildingEdgeOnly: if true, use raw building edge angle WITHOUT fallback to south (for explicit building-aligned mode)
  const generateUnifiedPanelPositions = useCallback((
    solarPolygonData: { polygon: google.maps.Polygon; id: string; coords: [number, number][] }[],
    constraintPolygons: google.maps.Polygon[],
    constraintCoordsData: [number, number][][],
    forceOrientationAngle?: number, // Optional: force specific orientation (radians)
    useBuildingEdgeOnly?: boolean // Optional: use raw building edge angle without fallback
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
    } else if (useBuildingEdgeOnly) {
      // Use raw building edge angle WITHOUT the 45° fallback
      // This is for explicit "building-aligned" mode
      const orientationResult = getRawBuildingEdgeAngle(polygonCoordsList);
      unifiedAxisAngle = orientationResult.angle;
      orientationSourceLabel = orientationResult.source;
      console.log(`[RoofVisualization] BUILDING EDGE AXIS (no fallback): ${(unifiedAxisAngle * 180 / Math.PI).toFixed(1)}° from ${solarPolygonData.length} polygon(s)`);
    } else {
      // NEW: Use per-polygon edge detection to find the longest TRUE edge (with fallback)
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

    const cos = Math.cos(-unifiedAxisAngle);
    const sin = Math.sin(-unifiedAxisAngle);
    const cosPos = Math.cos(unifiedAxisAngle);
    const sinPos = Math.sin(unifiedAxisAngle);
    
    // Step 1.6: Calculate shadow zones from constraint obstacles
    const shadowZones = calculateShadowZones(constraintCoordsData, globalCentroid.lat);
    console.log(`[RoofVisualization] Calculated ${shadowZones.length} shadow zones from ${constraintCoordsData.length} constraints`);
    
    // Step 1.7: Score polygons for inter-polygon priority ranking
    const polygonScores = scorePolygons(
      solarPolygonData.map(({ id, coords }) => ({ id, coords })),
      shadowZones,
      globalCentroid
    );
    const polygonScoreMap: Record<string, number> = {};
    for (const ps of polygonScores) {
      polygonScoreMap[ps.polygonId] = ps.score;
      console.log(`[RoofVisualization] Polygon ${ps.polygonId.slice(0,8)} score: ${ps.score.toFixed(1)} (area=${ps.areaScore.toFixed(0)}, exposure=${ps.exposureScore.toFixed(0)}, central=${ps.centralityScore.toFixed(0)}, south=${ps.southScore.toFixed(0)})`);
    }
    
    // Step 2: Prepare polygon data for modular placement
    const polygonData: {
      polygonId: string;
      coords: [number, number][];
      originalPolygon: google.maps.Polygon;
      localCentroid: { lat: number; lng: number };
      localMetersPerDegreeLng: number;
      minXRot: number; maxXRot: number;
      minYRot: number; maxYRot: number;
    }[] = [];

    for (const { polygon, id, coords } of solarPolygonData) {
      const localCentroid = computeCentroid(coords);
      const localMetersPerDegreeLng = 111320 * Math.cos(localCentroid.lat * Math.PI / 180);

      const originalPath = coords.map(([lng, lat]) => ({ lat, lng }));
      const originalPolygon = new google.maps.Polygon({ paths: originalPath });

      // Compute rotated bounding box
      let minXRot = Infinity, maxXRot = -Infinity, minYRot = Infinity, maxYRot = -Infinity;
      for (const [lng, lat] of coords) {
        const x = (lng - localCentroid.lng) * localMetersPerDegreeLng;
        const y = (lat - localCentroid.lat) * metersPerDegreeLat;
        const rx = x * cos - y * sin;
        const ry = x * sin + y * cos;
        minXRot = Math.min(minXRot, rx);
        maxXRot = Math.max(maxXRot, rx);
        minYRot = Math.min(minYRot, ry);
        maxYRot = Math.max(maxYRot, ry);
      }

      const rawWidth = maxXRot - minXRot;
      const rawHeight = maxYRot - minYRot;
      console.log(`[RoofVisualization] Polygon ${id.slice(0,8)}: bbox=${Math.round(rawWidth)}×${Math.round(rawHeight)}m`);

      polygonData.push({
        polygonId: id,
        coords,
        originalPolygon,
        localCentroid,
        localMetersPerDegreeLng,
        minXRot, maxXRot, minYRot, maxYRot,
      });
    }

    // Step 3: Auto-optimize module size across all polygons
    const { bestSize, bestModules, allResults } = autoOptimizeModuleSize(
      polygonData, expandedConstraintPolygons, metersPerDegreeLat,
      cos, sin, cosPos, sinPos, shadowZones
    );

    // Log optimization results
    const topResults = allResults
      .sort((a, b) => b.totalPanels - a.totalPanels)
      .slice(0, 5);
    console.log(`[RoofVisualization] Module auto-optimization results (top 5):`);
    for (const r of topResults) {
      console.log(`  ${r.size.rows}×${r.size.cols} (${r.size.panelCount} panels/module): ${r.moduleCount} modules = ${r.totalPanels} total panels = ${Math.round(r.totalPanels * PANEL_KW)} kW`);
    }
    console.log(`[RoofVisualization] BEST: ${bestSize.rows}×${bestSize.cols} module (${bestSize.capacityKW} kW/module), ${bestModules.length} modules, ${bestModules.reduce((s, m) => s + m.panels.length, 0)} panels total`);

    // Step 4: Sort modules by priority (interior first) and assign sequential IDs
    bestModules.sort((a, b) => b.priority - a.priority);
    for (let i = 0; i < bestModules.length; i++) {
      bestModules[i].moduleId = i + 1;
      // Update arrayId on all panels to match module ID
      for (const p of bestModules[i].panels) {
        p.arrayId = i + 1;
      }
    }

    // Step 5: Flatten modules into panel list (ordered by module priority)
    const allPanels: PanelPosition[] = [];
    for (const mod of bestModules) {
      for (const p of mod.panels) {
        allPanels.push(p);
      }
    }

    console.log(`[RoofVisualization] MODULAR TOTAL: ${allPanels.length} panels in ${bestModules.length} modules (${bestSize.rows}×${bestSize.cols})`);

    return { panels: allPanels, orientationAngle: unifiedAxisAngle, orientationSource: orientationSourceLabel };
  }, []);

  // LEGACY: Single polygon version — delegates to modular unified system
  const generatePanelPositions = useCallback((
    solarPolygon: google.maps.Polygon,
    constraintPolygons: google.maps.Polygon[],
    polygonId: string,
    coords: [number, number][]
  ): PanelPosition[] => {
    // Delegate to unified modular system with single polygon
    const result = generateUnifiedPanelPositions(
      [{ polygon: solarPolygon, id: polygonId, coords }],
      constraintPolygons,
      [coords]
    );
    return result.panels;
  }, [generateUnifiedPanelPositions]);

  // Sort panels with SEQUENTIAL POLYGON FILLING (realistic EPC approach)
  // Fill the largest/easiest polygon first (most panels = most open area),
  // then move to the next one. Within each polygon, panels away from obstacle
  // shadows are prioritized. This mimics how a real EPC would stage installation:
  // start with the biggest open section, then work on smaller/constrained sections.
  const sortPanelsByRowPriority = useCallback((panels: PanelPosition[]): PanelPosition[] => {
    // Step 1: Group panels by polygon and sort each group internally by priority
    const byPolygon = new Map<string, PanelPosition[]>();
    for (const p of panels) {
      const pid = p.polygonId || "default";
      if (!byPolygon.has(pid)) byPolygon.set(pid, []);
      byPolygon.get(pid)!.push(p);
    }
    
    // Sort each polygon's panels by priority (best positions first within that polygon)
    byPolygon.forEach((group) => {
      group.sort((a: PanelPosition, b: PanelPosition) => (b.priority || 0) - (a.priority || 0));
    });
    
    const polygonGroups = Array.from(byPolygon.entries());
    
    if (polygonGroups.length <= 1) {
      const sorted = polygonGroups.length === 1 ? polygonGroups[0][1] : [];
      console.log(`[RoofVisualization] Sorted ${sorted.length} panels (single polygon)`);
      return sorted;
    }
    
    // Step 2: Rank polygons by ease/size — largest (most panels) first
    // More accepted panels = bigger usable area = fewer constraints relative to size
    polygonGroups.sort((a, b) => b[1].length - a[1].length);
    
    // Step 3: Concatenate — fill best polygon completely, then next, etc.
    const result: PanelPosition[] = [];
    for (const [pid, group] of polygonGroups) {
      result.push(...group);
    }
    
    console.log(`[RoofVisualization] Sorted ${result.length} panels sequentially across ${polygonGroups.length} polygon(s): ${polygonGroups.map(([pid, g]) => `${pid.slice(0,8)}=${g.length}`).join(" → ")}`);
    
    return result;
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
        
        // Check geometry library is loaded (required for polygon containment checks)
        if (!google.maps.geometry?.poly?.containsLocation) {
          setMapError(language === "fr" 
            ? "Librairie geometry non chargée - réessayez" 
            : "Geometry library not loaded - please retry");
          setIsLoading(false);
          return;
        }

        const map = new google.maps.Map(mapContainerRef.current!, {
          center: { lat: latitude, lng: longitude },
          zoom: 20,
          mapTypeId: captureMode ? "satellite" : "hybrid",
          tilt: 0,
          disableDefaultUI: true,
          zoomControl: !captureMode,
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
            strokeColor: "#FFB005",
            strokeOpacity: 0.9,
            strokeWeight: 2,
            fillColor: "#FFB005",
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
            strokeColor: "#16A34A",
            strokeOpacity: 0.9,
            strokeWeight: 2,
            fillColor: "#16A34A",
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

        const polyBounds = new google.maps.LatLngBounds();
        let hasPolyPoints = false;
        for (const polygon of roofPolygons) {
          const coords = polygon.coordinates as [number, number][];
          for (const [lng, lat] of coords) {
            polyBounds.extend({ lat, lng });
            hasPolyPoints = true;
          }
        }
        if (hasPolyPoints) {
          map.fitBounds(polyBounds, 40);
        }

        // Generate panels using UNIFIED approach - DUAL ORIENTATION (building + true south)
        // 1. Building-aligned orientation - use RAW building edge angle (no 45° fallback)
        const buildingResult = generateUnifiedPanelPositions(
          solarPolygonDataForUnified,
          constraintGooglePolygons,
          constraintCoordsArray,
          undefined, // Don't force orientation angle
          true // useBuildingEdgeOnly = true: always follow building edge, no fallback
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
        
        // Log diagnostic: orientation will be set dynamically by the slider useEffect
        const buildingYieldFactor = calculateOrientationYieldFactor(buildingResult.orientationAngle).factor;
        const southYieldFactor = calculateOrientationYieldFactor(0).factor;
        console.log(`[RoofVisualization] Dual layouts generated: Building=${sortedBuildingPanels.length} panels (yield ${(buildingYieldFactor*100).toFixed(1)}%), TrueSouth=${sortedSouthPanels.length} panels (yield ${(southYieldFactor*100).toFixed(1)}%) — orientation follows slider dynamically`);
        
        // Initial panel positions: start with building-aligned; the dynamic orientation useEffect will switch
        // to the optimal orientation for the current slider position
        setAllPanelPositions(sortedBuildingPanels);
        setPanelOrientationAngle(buildingResult.orientationAngle);
        setOrientationSource(buildingResult.orientationSource);
        
        // Track panels per zone for legend display
        const zoneStats: Record<string, { count: number; label: string }> = {};
        for (const panel of sortedBuildingPanels) {
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

        // Calculate panel arrays (sections separated by fire corridors)
        // Use composite key: polygonId + arrayId to avoid merging arrays from different polygons
        const arrayStats: Map<string, { panels: PanelPosition[]; polygonId: string; localArrayId: number }> = new Map();
        for (const panel of sortedBuildingPanels) {
          if (panel.arrayId !== undefined) {
            // Composite key ensures arrays from different polygons don't merge
            const compositeKey = `${panel.polygonId}:${panel.arrayId}`;
            if (!arrayStats.has(compositeKey)) {
              arrayStats.set(compositeKey, { panels: [], polygonId: panel.polygonId, localArrayId: panel.arrayId });
            }
            arrayStats.get(compositeKey)!.panels.push(panel);
          }
        }
        
        // Convert to ArrayInfo format with row/column counts
        const arrays: ArrayInfo[] = [];
        // Sort by polygonId first, then by local arrayId within each polygon
        const sortedKeys = Array.from(arrayStats.keys()).sort((a, b) => {
          const [polyA, idA] = a.split(':');
          const [polyB, idB] = b.split(':');
          if (polyA !== polyB) return polyA.localeCompare(polyB);
          return parseInt(idA) - parseInt(idB);
        });
        
        // Renumber arrays sequentially (1, 2, 3...) across all polygons
        // Filter out small arrays (< 6 panels) as they are likely artifacts
        const MIN_ARRAY_PANELS = 6;
        let arrayNumber = 1;
        for (const key of sortedKeys) {
          const { panels, polygonId } = arrayStats.get(key)!;
          if (panels.length < MIN_ARRAY_PANELS) continue; // Skip small arrays
          
          // Calculate LOCAL rows and columns for this array
          // Use min/max of indices to get actual array dimensions, not global grid
          const rowIndices = panels.map(p => p.rowIndex).filter(r => r !== undefined) as number[];
          const colIndices = panels.map(p => p.colIndex).filter(c => c !== undefined) as number[];
          
          let rows = 1;
          let columns = panels.length;
          
          if (rowIndices.length > 0 && colIndices.length > 0) {
            // Calculate local dimensions from index ranges
            const minRow = Math.min(...rowIndices);
            const maxRow = Math.max(...rowIndices);
            const minCol = Math.min(...colIndices);
            const maxCol = Math.max(...colIndices);
            
            rows = maxRow - minRow + 1;
            columns = maxCol - minCol + 1;
            
            // Verify: rows × columns should be close to panel count (allow for irregular shapes)
            const gridSize = rows * columns;
            const fillRate = panels.length / gridSize;
            
            // If fill rate is very low (< 30%), the grid dimensions are misleading
            // In that case, estimate based on panel count
            if (fillRate < 0.3) {
              // Estimate more compact dimensions
              const sqrtPanels = Math.sqrt(panels.length);
              rows = Math.ceil(sqrtPanels);
              columns = Math.ceil(panels.length / rows);
            }
          }
          
          arrays.push({
            id: arrayNumber++,
            panelCount: panels.length,
            rows,
            columns,
            capacityKW: Math.round(panels.length * PANEL_KW * 10) / 10,
            polygonId
          });
        }
        
        setPanelArrays(arrays);
        console.log(`[RoofVisualization] Arrays generated: ${arrays.length}`, arrays.map(a => `Array ${a.id}: ${a.panelCount} panels (${a.rows}×${a.columns})`));

        console.log(`[RoofVisualization] Total panels generated: ${sortedBuildingPanels.length}, capacity: ${Math.round(sortedBuildingPanels.length * PANEL_KW)} kWc, zones: ${Object.keys(zoneStats).length}, arrays: ${arrays.length}`);

        if (onGeometryCalculatedRef.current && sortedBuildingPanels.length > 0) {
          onGeometryCalculatedRef.current({
            maxCapacityKW: Math.round(sortedBuildingPanels.length * PANEL_KW),
            panelCount: sortedBuildingPanels.length,
            realisticCapacityKW: Math.round(sortedBuildingPanels.length * PANEL_KW * 0.9),
            constraintAreaSqM: totalConstraintArea,
            arrays: arrays.length > 0 ? arrays : undefined
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
          map.fitBounds(bounds, 0);
          google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
            const currentZoom = map.getZoom();
            if (currentZoom && currentZoom < 21) {
              map.setZoom(currentZoom + 1);
            }
          });
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Map initialization error:", error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        setMapError(language === "fr" 
          ? `Erreur de chargement: ${errorMsg}` 
          : `Map loading error: ${errorMsg}`);
        setIsLoading(false);
      }
    };

    initMap();
  }, [latitude, longitude, roofPolygons, language, generateUnifiedPanelPositions, sortPanelsByRowPriority, retryKey]);

  useEffect(() => {
    if (!mapRef.current || allPanelPositions.length === 0) return;

    panelPolygonsRef.current.forEach(p => p.setMap(null));
    panelPolygonsRef.current = [];

    // Panels are already filtered to clean rectangles by applyProfessionalLayoutFilters().
    // No additional row-count filter needed — it would break rectangle edges.
    const panelsToRender = allPanelPositions.slice(0, panelsToShow);

    for (let i = 0; i < panelsToRender.length; i++) {
      const panel = panelsToRender[i];
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

      const positionRatio = panelsToRender.length > 1 ? i / (panelsToRender.length - 1) : 0;
      const fillOpacity = 0.9 - positionRatio * 0.35;
      const fillColor = positionRatio < 0.3 ? "#2563eb" : positionRatio < 0.7 ? "#3b82f6" : "#60a5fa";

      const panelPolygon = new google.maps.Polygon({
        paths: path,
        strokeColor: "#1e40af",
        strokeOpacity: 0.9,
        strokeWeight: 0.5,
        fillColor,
        fillOpacity,
        map: mapRef.current,
      });

      panelPolygonsRef.current.push(panelPolygon);
    }
  }, [allPanelPositions, panelsToShow]);

  // Effect to switch panel layout when orientation selection changes
  useEffect(() => {
    if (buildingAlignedPanels.length === 0 && trueSouthPanels.length === 0) return;
    
    let newPanels: PanelPosition[] = [];
    
    if (selectedOrientation === "building" && buildingAlignedPanels.length > 0) {
      newPanels = buildingAlignedPanels;
      setAllPanelPositions(newPanels);
      setPanelOrientationAngle(buildingAlignedAngle);
      setOrientationSource("building edge");
    } else if (selectedOrientation === "south" && trueSouthPanels.length > 0) {
      newPanels = trueSouthPanels;
      setAllPanelPositions(newPanels);
      setPanelOrientationAngle(trueSouthAngle);
      setOrientationSource("true south");
    }
    
    // Notify parent of capacity change when orientation switches
    // Note: Only send panel count/capacity - arrays are recalculated on render, not per-orientation
    if (onGeometryCalculatedRef.current && newPanels.length > 0) {
      onGeometryCalculatedRef.current({
        maxCapacityKW: Math.round(newPanels.length * PANEL_KW),
        panelCount: newPanels.length,
        realisticCapacityKW: Math.round(newPanels.length * PANEL_KW * 0.9),
        constraintAreaSqM: constraintArea
      });
    }
  }, [selectedOrientation, buildingAlignedPanels, trueSouthPanels, buildingAlignedAngle, trueSouthAngle, constraintArea]);

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

  const captureVisualization = useCallback(async (): Promise<string | null> => {
    const target = mapAreaRef.current;
    const map = mapRef.current;
    if (!target) return null;

    try {
      await new Promise(resolve => setTimeout(resolve, 500));

      // --- Draw panel polygons as a DOM canvas overlay (html2canvas can't capture WebGL google.maps.Polygon) ---
      let panelOverlay: HTMLCanvasElement | null = null;
      if (map && panelPolygonsRef.current.length > 0) {
        try {
          const mapDiv = map.getDiv();
          const rect = mapDiv.getBoundingClientRect();
          const targetRect = target.getBoundingClientRect();

          panelOverlay = document.createElement('canvas');
          panelOverlay.width = rect.width * 2;
          panelOverlay.height = rect.height * 2;
          panelOverlay.style.position = 'absolute';
          panelOverlay.style.left = `${rect.left - targetRect.left}px`;
          panelOverlay.style.top = `${rect.top - targetRect.top}px`;
          panelOverlay.style.width = `${rect.width}px`;
          panelOverlay.style.height = `${rect.height}px`;
          panelOverlay.style.pointerEvents = 'none';
          panelOverlay.style.zIndex = '1';
          target.appendChild(panelOverlay);

          const ctx = panelOverlay.getContext('2d');
          if (ctx) {
            ctx.scale(2, 2);
            const bounds = map.getBounds();
            const projection = map.getProjection();

            if (bounds && projection) {
              const ne = bounds.getNorthEast();
              const sw = bounds.getSouthWest();
              const topRight = projection.fromLatLngToPoint(ne)!;
              const bottomLeft = projection.fromLatLngToPoint(sw)!;
              const scale = Math.pow(2, map.getZoom()!);

              const toPixel = (lat: number, lng: number) => {
                const worldPoint = projection.fromLatLngToPoint(new google.maps.LatLng(lat, lng))!;
                return {
                  x: (worldPoint.x - bottomLeft.x) * scale,
                  y: (worldPoint.y - topRight.y) * scale,
                };
              };

              // Draw roof zone polygons (green outlines)
              for (const polygon of roofPolygons) {
                const coords = polygon.coordinates as [number, number][];
                if (!coords || coords.length < 3) continue;
                const isConstraint = isConstraintPolygon(polygon);
                ctx.beginPath();
                coords.forEach(([pLng, pLat], idx) => {
                  const px = toPixel(pLat, pLng);
                  if (idx === 0) ctx.moveTo(px.x, px.y);
                  else ctx.lineTo(px.x, px.y);
                });
                ctx.closePath();
                ctx.globalAlpha = 0.25;
                ctx.fillStyle = isConstraint ? "#f97316" : "#22c55e";
                ctx.fill();
                ctx.globalAlpha = 0.9;
                ctx.strokeStyle = isConstraint ? "#f97316" : "#22c55e";
                ctx.lineWidth = 2;
                ctx.stroke();
              }

              // Draw solar panels (blue rectangles)
              const panelsToRender = allPanelPositions.slice(0, panelsToShow);
              for (let i = 0; i < panelsToRender.length; i++) {
                const panel = panelsToRender[i];
                let corners: { lat: number; lng: number }[];
                if (panel.corners && panel.corners.length === 4) {
                  corners = panel.corners;
                } else {
                  corners = [
                    { lat: panel.lat, lng: panel.lng },
                    { lat: panel.lat, lng: panel.lng + panel.widthDeg },
                    { lat: panel.lat + panel.heightDeg, lng: panel.lng + panel.widthDeg },
                    { lat: panel.lat + panel.heightDeg, lng: panel.lng },
                  ];
                }

                const positionRatio = panelsToRender.length > 1 ? i / (panelsToRender.length - 1) : 0;
                const fillOpacity = 0.9 - positionRatio * 0.35;
                const fillColor = positionRatio < 0.3 ? "#2563eb" : positionRatio < 0.7 ? "#3b82f6" : "#60a5fa";

                ctx.beginPath();
                corners.forEach((c, idx) => {
                  const px = toPixel(c.lat, c.lng);
                  if (idx === 0) ctx.moveTo(px.x, px.y);
                  else ctx.lineTo(px.x, px.y);
                });
                ctx.closePath();
                ctx.fillStyle = fillColor;
                ctx.globalAlpha = fillOpacity;
                ctx.fill();
                ctx.globalAlpha = 0.9;
                ctx.strokeStyle = "#1e40af";
                ctx.lineWidth = 0.5;
                ctx.stroke();
              }
              ctx.globalAlpha = 1;
            }
          }
        } catch (overlayErr) {
          console.warn('Panel overlay drawing failed (non-blocking):', overlayErr);
        }
      }
      // --- End panel overlay ---

      const hideSelectors = [
        '[data-testid="button-export-image"]',
        '[data-testid="button-fullscreen"]',
        '[data-testid="button-open-roof-drawing"]',
        '[data-testid="button-save-snapshot"]',
      ];
      const hidden: HTMLElement[] = [];
      hideSelectors.forEach(sel => {
        target.querySelectorAll<HTMLElement>(sel).forEach(el => {
          hidden.push(el);
          el.style.visibility = 'hidden';
        });
      });

      const prevOverflow = target.style.overflow;
      target.style.overflow = 'visible';

      const canvas = await html2canvas(target, {
        useCORS: true,
        allowTaint: true,
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
      });

      target.style.overflow = prevOverflow;
      hidden.forEach(el => { el.style.visibility = ''; });

      if (panelOverlay && panelOverlay.parentNode) {
        panelOverlay.parentNode.removeChild(panelOverlay);
      }

      const dataUrl = canvas.toDataURL('image/png');
      return dataUrl;
    } catch (error) {
      console.error('Failed to capture visualization:', error);
      return null;
    }
  }, [allPanelPositions, panelsToShow, roofPolygons]);

  // Notify parent when visualization is ready for capture
  useEffect(() => {
    if (onVisualizationReady && !isLoading && allPanelPositions.length > 0) {
      onVisualizationReady(captureVisualization);
    }
  }, [onVisualizationReady, isLoading, allPanelPositions.length, captureVisualization]);


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
    <div ref={sectionRef} className="relative rounded-xl overflow-hidden" data-testid="roof-visualization">
      <div ref={mapAreaRef} className="relative w-full h-72 md:h-96">
        <div ref={mapContainerRef} className="absolute inset-0" />
        
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
            <Skeleton className="h-full w-full" />
          </div>
        )}
        
        {mapError && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground z-10">
            <div className="flex flex-col items-center gap-3 text-center px-4">
              <AlertTriangle className="w-8 h-8" />
              <p className="text-sm max-w-xs">{mapError}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setMapError(null);
                  setIsLoading(true);
                  setHasUserSelectedOrientation(false);
                  setRetryKey(k => k + 1);
                }}
                data-testid="button-retry-map"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {language === "fr" ? "Réessayer" : "Retry"}
              </Button>
            </div>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
        
        <div className="absolute top-3 right-3 z-20 flex gap-2">
          {/* North Arrow Indicator */}
          <div 
            className="flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm rounded px-1.5 py-1"
            title={language === "fr" ? "Nord" : "North"}
            data-testid="north-arrow-indicator"
          >
            <span className="text-[10px] font-bold text-white leading-none">N</span>
            <svg 
              width="16" 
              height="18" 
              viewBox="0 0 16 18" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
              className="mt-0.5"
            >
              <path 
                d="M8 1L3 10H8V1Z" 
                fill="white"
              />
              <path 
                d="M8 10V17L13 8H8V10Z" 
                fill="rgba(255,255,255,0.4)"
              />
              <path 
                d="M8 1L3 10H8V17L13 8H8V1Z" 
                stroke="white" 
                strokeWidth="0.5"
                fill="none"
              />
            </svg>
          </div>
          {onOpenRoofDrawing && (
            <Button
              size="icon"
              variant="secondary"
              className="bg-white/20 text-white border-white/30 backdrop-blur-sm hover:bg-white/30"
              onClick={onOpenRoofDrawing}
              data-testid="button-open-roof-drawing"
              title={language === "fr" ? "Dessiner le toit" : "Draw Roof"}
            >
              <PencilRuler className="w-4 h-4" />
            </Button>
          )}
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
              {currentPVSizeKW && Math.round(currentPVSizeKW) !== Math.round(maxCapacity) && (
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
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">
                {language === "fr" ? "Taille du système" : "System Size"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="font-mono" data-testid="panel-count-badge">
                {Math.round(panelsToShow / modulePanelCount)} {language === "fr" ? "modules" : "modules"} ({formatNumber(panelsToShow, language)} {language === "fr" ? "pan." : "pan."})
              </Badge>
              <Badge className="bg-primary text-primary-foreground font-mono" data-testid="capacity-badge">
                {formatNumber(displayedCapacityKW, language)} kWc
              </Badge>
            </div>
          </div>

          <div className="pt-1" ref={sliderContainerRef}>
            <Slider
              value={[selectedCapacityKW]}
              onValueChange={(values) => {
                // Snap to nearest module boundary
                const rawKW = values[0];
                const snappedKW = Math.round(rawKW / moduleCapacityKW) * moduleCapacityKW;
                setSelectedCapacityKW(Math.max(moduleCapacityKW, snappedKW));
                setHasUserAdjusted(true);
              }}
              min={minCapacity}
              max={maxCapacity}
              step={Math.round(moduleCapacityKW)}
              className="w-full"
              data-testid="capacity-slider"
            />
            <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground">
              <span>Min</span>
              <span>Max</span>
            </div>
            {recommendedMarkerLeft && (
              <div className="relative h-6 mt-0.5">
                <div
                  className="absolute flex flex-col items-center"
                  style={{
                    left: recommendedMarkerLeft,
                    transform: "translateX(-50%)",
                    top: 0,
                  }}
                  data-testid="slider-recommended-label"
                >
                  <span className="text-[10px] text-primary leading-none">▲</span>
                  <span className="text-[10px] text-primary font-medium whitespace-nowrap leading-tight">
                    {language === "fr" ? "Recommandé" : "Recommended"}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 mt-1">
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
              
              {/* Panel Arrays count */}
              {visiblePanelArrays.length > 0 && (
                <Badge variant="outline" className="text-xs font-normal gap-1 border-teal-500 text-teal-700" data-testid="badge-arrays">
                  <Layers className="w-3 h-3" />
                  {visiblePanelArrays.length} arrays
                </Badge>
              )}
            </div>
            
            {/* Panel Arrays Detail Panel */}
            {visiblePanelArrays.length > 1 && (
              <div className="mt-3 p-3 bg-teal-50 dark:bg-teal-950/30 rounded-lg border border-teal-200 dark:border-teal-800" data-testid="arrays-panel">
                <button
                  onClick={() => setArraysExpanded(!arraysExpanded)}
                  className="flex items-center gap-2 w-full text-left"
                  data-testid="btn-toggle-arrays"
                >
                  <Layers className="w-4 h-4 text-teal-600" />
                  <span className="text-sm font-medium text-teal-800 dark:text-teal-300">
                    {language === "fr" ? "Sections de panneaux" : "Panel Arrays"}
                  </span>
                  <span className="text-xs text-teal-600 dark:text-teal-400">
                    ({language === "fr" ? "séparées par corridors de feu" : "separated by fire corridors"})
                  </span>
                  <ChevronDown className={`w-4 h-4 ml-auto text-teal-600 transition-transform ${arraysExpanded ? 'rotate-180' : ''}`} />
                </button>
                {arraysExpanded && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 mt-2">
                    {visiblePanelArrays.map((array) => (
                      <div 
                        key={array.id} 
                        className="bg-white dark:bg-teal-900/50 rounded px-2 py-1 border border-teal-200 dark:border-teal-700"
                        data-testid={`array-${array.id}`}
                      >
                        <div className="font-medium text-sm text-teal-800 dark:text-teal-200">
                          Array {array.id}
                        </div>
                        <div className="text-xs text-teal-600 dark:text-teal-400">
                          {array.panelCount} {language === "fr" ? "pan." : "pan."} • {array.capacityKW} kWc
                        </div>
                        <div className="text-xs text-teal-500 dark:text-teal-500">
                          {array.rows}×{array.columns}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Orientation Comparison Panel */}
            {buildingAlignedPanels.length > 0 && trueSouthPanels.length > 0 && (
              <div className="mt-3 p-3 bg-muted/50 rounded-lg border" data-testid="orientation-comparison">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    {language === "fr" ? "Comparaison d'orientation" : "Orientation Comparison"}
                  </span>
                </div>
                {(() => {
                  const buildingPanelCount = Math.min(panelsToShow, buildingAlignedPanels.length);
                  const southPanelCount = Math.min(panelsToShow, trueSouthPanels.length);
                  const buildingCapacityKW = Math.round(buildingPanelCount * PANEL_KW);
                  const southCapacityKW = Math.round(southPanelCount * PANEL_KW);
                  const buildingYield = calculateEstimatedYield(buildingAlignedAngle, PANEL_TILT_DEG);
                  const southYield = calculateEstimatedYield(0, PANEL_TILT_DEG);
                  const buildingProduction = buildingPanelCount * PANEL_KW * buildingYield;
                  const southProduction = southPanelCount * PANEL_KW * southYield;
                  const difference = southProduction - buildingProduction;
                  const percentDiff = buildingProduction > 0 ? ((difference / buildingProduction) * 100) : 0;

                  return (
                    <>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { setSelectedOrientation("building"); setHasUserSelectedOrientation(true); }}
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
                      <div>{buildingPanelCount} {language === "fr" ? "panneaux" : "panels"} • {buildingCapacityKW} kWc</div>
                      <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        {buildingYield} kWh/kWp
                        {(() => {
                          const { deviationDeg } = calculateOrientationYieldFactor(buildingAlignedAngle);
                          const loss = Math.round(deviationDeg * 0.35);
                          return loss > 0 ? <span className="text-amber-600">(-{loss}%)</span> : null;
                        })()}
                      </div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => { setSelectedOrientation("south"); setHasUserSelectedOrientation(true); }}
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
                      <div>{southPanelCount} {language === "fr" ? "panneaux" : "panels"} • {southCapacityKW} kWc</div>
                      <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        {southYield} kWh/kWp
                        <span className="text-green-600">(optimal)</span>
                      </div>
                    </div>
                  </button>
                </div>
                
                <div className="mt-2 pt-2 border-t text-xs">
                      {(() => {
                        // When the slider count fits in both orientations → same capacity, south wins on yield/kWp
                        const sliderFitsInSouth = panelsToShow <= trueSouthPanels.length;
                        if (sliderFitsInSouth && difference > 0) {
                          const yieldGainPct = buildingProduction > 0 ? ((difference / buildingProduction) * 100) : 0;
                          return (
                            <span className="text-green-700">
                              {language === "fr"
                                ? `Plein sud : même capacité (${southPanelCount} panneaux), rendement +${yieldGainPct.toFixed(1)}%`
                                : `True south: same capacity (${southPanelCount} panels), yield +${yieldGainPct.toFixed(1)}%`
                              }
                            </span>
                          );
                        } else if (sliderFitsInSouth && difference <= 0) {
                          return (
                            <span className="text-muted-foreground">
                              {language === "fr" ? "Production équivalente" : "Equivalent production"}
                            </span>
                          );
                        } else if (difference > 0) {
                          return (
                            <span className="text-green-700">
                              {language === "fr"
                                ? `Plein sud produirait +${formatNumber(Math.round(difference), language)} kWh/an (+${percentDiff.toFixed(1)}%)`
                                : `True south would produce +${formatNumber(Math.round(difference), language)} kWh/yr (+${percentDiff.toFixed(1)}%)`
                              }
                            </span>
                          );
                        } else if (difference < 0) {
                          return (
                            <span className="text-amber-700">
                              {language === "fr"
                                ? `Aligné bâtiment produit ${formatNumber(Math.round(Math.abs(difference)), language)} kWh/an de plus grâce à ${buildingPanelCount - southPanelCount} panneaux additionnels`
                                : `Building-aligned produces ${formatNumber(Math.round(Math.abs(difference)), language)} kWh/yr more due to ${buildingPanelCount - southPanelCount} additional panels`
                              }
                            </span>
                          );
                        } else {
                          return (
                            <span className="text-muted-foreground">
                              {language === "fr" ? "Production équivalente" : "Equivalent production"}
                            </span>
                          );
                        }
                      })()}
                    </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

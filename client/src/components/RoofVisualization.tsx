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

// Constraint polygon with optional metadata for distance-based fallback checking
interface ConstraintPolygonPath {
  polygon: google.maps.Polygon;
  failed: boolean;
  meterCoords?: Point2D[];
  centroid?: Point2D;
  metersPerDegreeLat?: number;
  metersPerDegreeLng?: number;
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

// Find the principal axis angle of a polygon using PCA (covariance-based)
// This correctly handles triangular faces where the longest edge may not align with spread direction
// Returns angle in radians where 0 = east, PI/2 = north
function computePrincipalAxisAngle(coords: [number, number][]): number {
  if (coords.length < 2) return 0;
  
  // Compute centroid
  let cx = 0, cy = 0;
  for (const [x, y] of coords) {
    cx += x;
    cy += y;
  }
  cx /= coords.length;
  cy /= coords.length;
  
  // Build 2x2 covariance matrix of vertex offsets from centroid
  // Cov = [[Sxx, Sxy], [Sxy, Syy]]
  let Sxx = 0, Syy = 0, Sxy = 0;
  for (const [x, y] of coords) {
    const dx = x - cx;
    const dy = y - cy;
    Sxx += dx * dx;
    Syy += dy * dy;
    Sxy += dx * dy;
  }
  
  // Find principal axis from leading eigenvector of covariance matrix
  // For 2x2 symmetric matrix, use closed-form solution
  const diff = Sxx - Syy;
  const discriminant = Math.sqrt(diff * diff + 4 * Sxy * Sxy);
  
  // If variance is nearly isotropic (circular shape), fall back to longest edge
  if (discriminant < 1e-9) {
    let maxLen = 0;
    let bestAngle = 0;
    for (let i = 0; i < coords.length; i++) {
      const [x1, y1] = coords[i];
      const [x2, y2] = coords[(i + 1) % coords.length];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > maxLen) {
        maxLen = len;
        bestAngle = Math.atan2(dy, dx);
      }
    }
    // Normalize to [0, PI)
    while (bestAngle < 0) bestAngle += Math.PI;
    while (bestAngle >= Math.PI) bestAngle -= Math.PI;
    return bestAngle;
  }
  
  // Principal axis angle from eigenvector: atan2(2*Sxy, Sxx - Syy) / 2
  // This gives the angle of maximum variance (principal axis)
  let angle = 0.5 * Math.atan2(2 * Sxy, diff);
  
  // Normalize to [0, PI) since we want rows parallel to this axis
  while (angle < 0) angle += Math.PI;
  while (angle >= Math.PI) angle -= Math.PI;
  
  return angle;
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

// Inset a polygon by moving each edge inward by the specified distance
// This creates a smaller polygon suitable for setback checking
// IMPROVED: Validates inset vertices to handle narrow triangular protrusions
function insetPolygon(polygon: Point2D[], insetDistance: number): Point2D[] {
  const n = polygon.length;
  if (n < 3) return polygon;
  
  // For each edge, compute the inward-facing normal and offset the edge
  const offsetEdges: Array<{ p1: Point2D; p2: Point2D; normal: Point2D; originalIdx: number }> = [];
  
  for (let i = 0; i < n; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % n];
    
    // Edge direction
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    
    if (len < 1e-10) continue;
    
    // Inward normal (perpendicular to edge, pointing into polygon)
    // For CCW polygon, inward normal is (-dy, dx) / len
    const nx = -dy / len;
    const ny = dx / len;
    
    // Offset edge by insetDistance along normal
    offsetEdges.push({
      p1: { x: p1.x + nx * insetDistance, y: p1.y + ny * insetDistance },
      p2: { x: p2.x + nx * insetDistance, y: p2.y + ny * insetDistance },
      normal: { x: nx, y: ny },
      originalIdx: i
    });
  }
  
  if (offsetEdges.length < 3) return polygon;
  
  // Find intersections of consecutive offset edges to form inset polygon
  const rawInsetPoints: Array<{ point: Point2D; originalIdx: number }> = [];
  
  for (let i = 0; i < offsetEdges.length; i++) {
    const edge1 = offsetEdges[i];
    const edge2 = offsetEdges[(i + 1) % offsetEdges.length];
    
    const intersection = lineLineIntersection(edge1.p1, edge1.p2, edge2.p1, edge2.p2);
    if (intersection) {
      rawInsetPoints.push({ point: intersection, originalIdx: edge1.originalIdx });
    }
  }
  
  // If inset failed (polygon too small), return empty array
  if (rawInsetPoints.length < 3) return [];
  
  // CRITICAL FIX: Filter out vertices that are OUTSIDE the original polygon
  // This happens at narrow protrusions (like triangular tips) where offset edges cross over
  // For inset (positive distance): vertices must be inside original polygon
  // For expansion (negative distance): original vertices must be inside result
  const validInsetPoints: Point2D[] = [];
  
  // Check if original polygon is convex - convex polygons don't need vertex filtering
  // since all inset vertices will be inside by mathematical necessity
  const isConvex = !isPolygonConcave(polygon.map(p => ({ x: p.x, y: p.y })));
  
  if (insetDistance > 0) {
    // Shrinking: each inset vertex must be inside (or very close to) the original polygon
    for (const { point } of rawInsetPoints) {
      // For CONVEX polygons (like parallelograms), skip the strict containment check
      // The inset vertices are mathematically guaranteed to be inside for convex shapes
      // This fixes false rejections at acute angles due to floating-point precision
      if (isConvex) {
        validInsetPoints.push(point);
      } else if (pointInPolygon(point, polygon)) {
        validInsetPoints.push(point);
      } else {
        // Check if point is very close to boundary (tolerance for floating point)
        const distToEdge = distanceToPolygonEdges(point, polygon);
        if (distToEdge < 2.0) { // Increased tolerance to 2m for concave polygons
          validInsetPoints.push(point);
        }
        // Otherwise skip this vertex - it's from a collapsed narrow section
      }
    }
  } else {
    // Expanding: all raw points should be valid for expansion
    for (const { point } of rawInsetPoints) {
      validInsetPoints.push(point);
    }
  }
  
  // If too many vertices were filtered out, inset failed
  if (validInsetPoints.length < 3) return [];
  
  // Verify the inset polygon is valid (reasonable area based on direction)
  const originalArea = Math.abs(signedPolygonArea(polygon));
  const resultArea = Math.abs(signedPolygonArea(validInsetPoints));
  
  // For positive inset (shrinking): result should be smaller but not collapsed
  // For negative inset (expansion): result should be larger but not unreasonably so
  // Added tolerance for floating-point precision issues
  const areaTolerance = 1.05; // 5% tolerance for floating-point noise
  
  if (insetDistance > 0) {
    // Shrinking: result must be smaller (with tolerance) and at least 1% of original
    if (resultArea < originalArea * 0.01 || resultArea > originalArea * areaTolerance) {
      return [];
    }
  } else {
    // Expanding: result must be larger (with tolerance) but no more than 10x original
    if (resultArea < originalArea / areaTolerance || resultArea > originalArea * 10) {
      return [];
    }
  }
  
  return validInsetPoints;
}

// Find intersection point of two lines (each defined by two points)
function lineLineIntersection(p1: Point2D, p2: Point2D, p3: Point2D, p4: Point2D): Point2D | null {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;
  
  const cross = d1x * d2y - d1y * d2x;
  
  if (Math.abs(cross) < 1e-10) {
    // Lines are parallel
    return null;
  }
  
  const dx = p3.x - p1.x;
  const dy = p3.y - p1.y;
  
  const t = (dx * d2y - dy * d2x) / cross;
  
  return {
    x: p1.x + t * d1x,
    y: p1.y + t * d1y
  };
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

// Calculate the minimum distance from a point to any edge of a polygon
// Returns the shortest distance to any polygon edge or vertex
function distanceToPolygonEdges(point: Point2D, polygon: Point2D[]): number {
  let minDist = Infinity;
  const n = polygon.length;
  
  for (let i = 0; i < n; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % n];
    
    // Calculate distance from point to line segment (p1, p2)
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lenSq = dx * dx + dy * dy;
    
    if (lenSq < 1e-10) {
      // Degenerate edge (point), just use distance to vertex
      const dist = Math.sqrt((point.x - p1.x) ** 2 + (point.y - p1.y) ** 2);
      minDist = Math.min(minDist, dist);
      continue;
    }
    
    // Parameter t for closest point on the line segment
    let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t)); // Clamp to [0, 1] for segment
    
    // Closest point on the segment
    const closestX = p1.x + t * dx;
    const closestY = p1.y + t * dy;
    
    // Distance to closest point
    const dist = Math.sqrt((point.x - closestX) ** 2 + (point.y - closestY) ** 2);
    minDist = Math.min(minDist, dist);
  }
  
  return minDist;
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

// ============================================================================
// EDGE BEARING ANALYSIS for sectional panel placement
// Analyzes polygon edges to detect distinct orientation clusters (main body vs wings)
// ============================================================================

interface EdgeInfo {
  startIdx: number;
  endIdx: number;
  bearing: number;  // Angle in radians [0, PI)
  length: number;   // Edge length in meters
  midpoint: Point2D;
}

// Calculate bearing (angle) of each polygon edge
function analyzeEdgeBearings(polygon: Point2D[]): EdgeInfo[] {
  const edges: EdgeInfo[] = [];
  const n = polygon.length;
  
  for (let i = 0; i < n; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % n];
    
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length < 0.1) continue; // Skip tiny edges
    
    // Calculate bearing [0, 2*PI) then normalize to [0, PI)
    let bearing = Math.atan2(dy, dx);
    while (bearing < 0) bearing += Math.PI;
    while (bearing >= Math.PI) bearing -= Math.PI;
    
    edges.push({
      startIdx: i,
      endIdx: (i + 1) % n,
      bearing,
      length,
      midpoint: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
    });
  }
  
  return edges;
}

// Cluster edges by similar bearings to detect main axis vs wing axis
// Returns up to 2 dominant orientations (main body and wing)
function findDominantOrientations(edges: EdgeInfo[]): number[] {
  if (edges.length === 0) return [0];
  
  // Weight edges by length (longer edges are more significant)
  const totalLength = edges.reduce((sum, e) => sum + e.length, 0);
  
  // Find primary orientation (longest edges' weighted average)
  let primaryBearing = 0;
  let primaryWeight = 0;
  
  // Sort edges by length descending
  const sortedEdges = [...edges].sort((a, b) => b.length - a.length);
  
  // Take top 50% of edges by length for primary orientation
  const primaryEdges = sortedEdges.slice(0, Math.max(1, Math.floor(sortedEdges.length / 2)));
  
  for (const edge of primaryEdges) {
    primaryBearing += edge.bearing * edge.length;
    primaryWeight += edge.length;
  }
  primaryBearing /= primaryWeight;
  
  // Find secondary orientation (edges significantly different from primary)
  const ANGLE_THRESHOLD = Math.PI / 6; // 30 degrees difference threshold
  let secondaryBearing = 0;
  let secondaryWeight = 0;
  
  for (const edge of edges) {
    const angleDiff = Math.abs(edge.bearing - primaryBearing);
    const normalizedDiff = Math.min(angleDiff, Math.PI - angleDiff);
    
    if (normalizedDiff > ANGLE_THRESHOLD) {
      secondaryBearing += edge.bearing * edge.length;
      secondaryWeight += edge.length;
    }
  }
  
  if (secondaryWeight > totalLength * 0.1) {
    // Significant secondary orientation found
    secondaryBearing /= secondaryWeight;
    console.log(`[RoofVisualization] Found 2 dominant orientations: ${Math.round(primaryBearing * 180 / Math.PI)}° and ${Math.round(secondaryBearing * 180 / Math.PI)}°`);
    return [primaryBearing, secondaryBearing];
  }
  
  return [primaryBearing];
}

// Determine which orientation is best for a given point in the polygon
// Returns the index of the orientation that has the most edge length nearby
function getBestOrientationForPoint(
  point: Point2D,
  edges: EdgeInfo[],
  orientations: number[]
): number {
  if (orientations.length === 1) return 0;
  
  const ANGLE_THRESHOLD = Math.PI / 6;
  const weights = orientations.map(() => 0);
  
  // Weight by inverse distance to edge midpoints
  for (const edge of edges) {
    const dx = point.x - edge.midpoint.x;
    const dy = point.y - edge.midpoint.y;
    const dist = Math.sqrt(dx * dx + dy * dy) + 0.1; // Avoid division by zero
    
    // Find which orientation this edge belongs to
    for (let i = 0; i < orientations.length; i++) {
      const angleDiff = Math.abs(edge.bearing - orientations[i]);
      const normalizedDiff = Math.min(angleDiff, Math.PI - angleDiff);
      
      if (normalizedDiff < ANGLE_THRESHOLD || (i === orientations.length - 1)) {
        weights[i] += edge.length / dist;
        break;
      }
    }
  }
  
  // Return index of highest weight
  let bestIdx = 0;
  let bestWeight = weights[0];
  for (let i = 1; i < weights.length; i++) {
    if (weights[i] > bestWeight) {
      bestWeight = weights[i];
      bestIdx = i;
    }
  }
  
  return bestIdx;
}

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

// Normalize polygon winding to CCW (counter-clockwise)
// insetPolygon requires CCW winding for correct inward normal direction
function normalizeToCCW(polygon: Point2D[]): Point2D[] {
  const area = signedPolygonArea(polygon);
  if (area < 0) {
    // CW winding, reverse to make CCW
    return [...polygon].reverse();
  }
  return polygon;
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
  // Triangles (3 vertices) and quadrilaterals (4 vertices) are ALWAYS convex
  // when they form simple (non-self-intersecting) polygons.
  // Parallelograms, rectangles, and any 4-vertex roof polygons fall into this category.
  // This avoids false positives from floating-point noise in cross product calculations.
  if (polygon.length <= 4) {
    return false;
  }
  return findReflexVertices(polygon).length > 0;
}

// Decompose a concave polygon into convex/rectangular sub-polygons
// Uses diagonal cuts through reflex vertices for L/U/T shaped roofs with diagonal wings
function decomposePolygon(polygon: Point2D[]): Point2D[][] {
  if (polygon.length < 3) return [polygon];
  
  const reflexIndices = findReflexVertices(polygon);
  
  // If polygon is already convex, return as-is
  if (reflexIndices.length === 0) {
    return [polygon];
  }
  
  console.log(`[decomposePolygon] Found ${reflexIndices.length} reflex vertices at indices: ${reflexIndices.join(', ')}`);
  
  // For each reflex vertex, try to find a valid cut
  for (const reflexIdx of reflexIndices) {
    const reflexPoint = polygon[reflexIdx];
    
    // Try DIAGONAL cut first (following edge direction from reflex vertex)
    // This handles L-shapes with diagonal wings
    const diagonalCut = tryDiagonalCut(polygon, reflexIdx);
    if (diagonalCut) {
      const [poly1, poly2] = diagonalCut;
      console.log(`[decomposePolygon] Diagonal cut at vertex ${reflexIdx}: created ${poly1.length}-gon and ${poly2.length}-gon`);
      return [...decomposePolygon(poly1), ...decomposePolygon(poly2)];
    }
    
    // Try horizontal cut
    const horizontalCut = tryHorizontalCut(polygon, reflexIdx, reflexPoint.y);
    if (horizontalCut) {
      const [poly1, poly2] = horizontalCut;
      console.log(`[decomposePolygon] Horizontal cut at y=${reflexPoint.y.toFixed(1)}: created ${poly1.length}-gon and ${poly2.length}-gon`);
      return [...decomposePolygon(poly1), ...decomposePolygon(poly2)];
    }
    
    // Try vertical cut
    const verticalCut = tryVerticalCut(polygon, reflexIdx, reflexPoint.x);
    if (verticalCut) {
      const [poly1, poly2] = verticalCut;
      console.log(`[decomposePolygon] Vertical cut at x=${reflexPoint.x.toFixed(1)}: created ${poly1.length}-gon and ${poly2.length}-gon`);
      return [...decomposePolygon(poly1), ...decomposePolygon(poly2)];
    }
  }
  
  console.log(`[decomposePolygon] No valid cuts found, returning original polygon`);
  // If no valid cuts found, return original polygon
  return [polygon];
}

// Try to cut polygon with a diagonal line from reflex vertex
// This handles L-shapes with diagonal wings by cutting along the reflex vertex's bisector
function tryDiagonalCut(polygon: Point2D[], reflexIdx: number): [Point2D[], Point2D[]] | null {
  const n = polygon.length;
  const reflex = polygon[reflexIdx];
  const prev = polygon[(reflexIdx - 1 + n) % n];
  const next = polygon[(reflexIdx + 1) % n];
  
  // Calculate the bisector direction at the reflex vertex
  // The bisector points "into" the polygon
  const toPrev = normalize({ x: prev.x - reflex.x, y: prev.y - reflex.y });
  const toNext = normalize({ x: next.x - reflex.x, y: next.y - reflex.y });
  const bisector = normalize({ x: toPrev.x + toNext.x, y: toPrev.y + toNext.y });
  
  // For reflex vertex, the bisector points OUT of the polygon
  // We need to flip it to point INTO the polygon
  const inwardBisector = { x: -bisector.x, y: -bisector.y };
  
  // Find the edge that the bisector intersects
  let bestIntersection: { point: Point2D; edgeIdx: number; t: number } | null = null;
  let bestDist = Infinity;
  
  for (let i = 0; i < n; i++) {
    // Skip edges adjacent to the reflex vertex
    if (i === reflexIdx || i === (reflexIdx - 1 + n) % n) continue;
    
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % n];
    
    // Find intersection of ray from reflex in bisector direction with edge p1-p2
    const intersection = rayEdgeIntersection(reflex, inwardBisector, p1, p2);
    if (intersection && intersection.t > 0.01) { // t > 0 means in front of reflex
      const dist = Math.sqrt(
        (intersection.point.x - reflex.x) ** 2 + 
        (intersection.point.y - reflex.y) ** 2
      );
      if (dist < bestDist) {
        bestDist = dist;
        bestIntersection = { ...intersection, edgeIdx: i };
      }
    }
  }
  
  if (!bestIntersection) return null;
  
  // Build two sub-polygons from the diagonal cut
  return buildSubPolygonsFromDiagonalCut(polygon, reflexIdx, bestIntersection.point, bestIntersection.edgeIdx);
}

// Helper: normalize a vector
function normalize(v: Point2D): Point2D {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len < 1e-10) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

// Helper: ray-edge intersection
function rayEdgeIntersection(
  rayOrigin: Point2D, 
  rayDir: Point2D, 
  edgeP1: Point2D, 
  edgeP2: Point2D
): { point: Point2D; t: number; u: number } | null {
  const edgeDir = { x: edgeP2.x - edgeP1.x, y: edgeP2.y - edgeP1.y };
  const cross = rayDir.x * edgeDir.y - rayDir.y * edgeDir.x;
  
  if (Math.abs(cross) < 1e-10) return null; // Parallel
  
  const dx = edgeP1.x - rayOrigin.x;
  const dy = edgeP1.y - rayOrigin.y;
  
  const t = (dx * edgeDir.y - dy * edgeDir.x) / cross;
  const u = (dx * rayDir.y - dy * rayDir.x) / cross;
  
  // t is distance along ray, u is position along edge (0-1)
  if (u < 0 || u > 1) return null; // Intersection not on edge
  
  return {
    point: { x: rayOrigin.x + t * rayDir.x, y: rayOrigin.y + t * rayDir.y },
    t,
    u
  };
}

// Build sub-polygons from a diagonal cut
function buildSubPolygonsFromDiagonalCut(
  polygon: Point2D[],
  reflexIdx: number,
  cutPoint: Point2D,
  cutEdgeIdx: number
): [Point2D[], Point2D[]] {
  const n = polygon.length;
  
  // Polygon 1: from reflex vertex forward to cut edge, then cut point back to reflex
  const poly1: Point2D[] = [];
  let i = reflexIdx;
  while (true) {
    poly1.push(polygon[i]);
    if (i === cutEdgeIdx) break;
    i = (i + 1) % n;
    if (i === reflexIdx) break; // Safety: prevent infinite loop
  }
  poly1.push(cutPoint);
  
  // Polygon 2: from cut point forward to reflex vertex
  const poly2: Point2D[] = [cutPoint];
  i = (cutEdgeIdx + 1) % n;
  while (i !== reflexIdx) {
    poly2.push(polygon[i]);
    i = (i + 1) % n;
  }
  poly2.push(polygon[reflexIdx]);
  
  // Validate polygons
  if (poly1.length < 3 || poly2.length < 3) return null as any;
  
  // Clean up duplicates
  const clean1 = removeDuplicatePoints(poly1);
  const clean2 = removeDuplicatePoints(poly2);
  
  if (clean1.length < 3 || clean2.length < 3) return null as any;
  
  return [clean1, clean2];
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

    // Create EXPANDED constraint polygon paths for containment testing
    // Constraints are expanded by edgeSetbackM (1.2m) so panels don't sit too close to obstacles
    const constraintPolygonPaths: ConstraintPolygonPath[] = roofPolygons
      .filter((p) => {
        if (p.color === "#f97316") return true;
        const label = p.label?.toLowerCase() || "";
        return label.includes("constraint") || label.includes("contrainte") || 
               label.includes("hvac") || label.includes("obstacle");
      })
      .flatMap((p) => {
        const coords = p.coordinates as [number, number][];
        if (!coords || coords.length < 3) return [];
        
        // Calculate meter conversion at constraint location
        const avgLat = coords.reduce((sum, [, lat]) => sum + lat, 0) / coords.length;
        const metersPerDegreeLat = 111320;
        const metersPerDegreeLng = 111320 * Math.cos(avgLat * Math.PI / 180);
        
        // Compute centroid
        const centroid = computeCentroid(coords);
        
        // Convert to meter space
        const meterCoords: Point2D[] = coords.map(([lng, lat]) => ({
          x: (lng - centroid.x) * metersPerDegreeLng,
          y: (lat - centroid.y) * metersPerDegreeLat
        }));
        
        // Normalize to CCW winding - required for correct outward normal direction
        const normalizedMeterCoords = normalizeToCCW(meterCoords);
        
        // EXPAND constraint by setback (negative inset = expansion)
        // This ensures panels stay edgeSetbackM away from obstacles
        const expandedPolygonM = insetPolygon(normalizedMeterCoords, -edgeSetbackM);
        
        if (expandedPolygonM.length >= 3) {
          // Convert back to geographic coordinates
          const expandedGeoCoords = expandedPolygonM.map(pt => ({
            lat: pt.y / metersPerDegreeLat + centroid.y,
            lng: pt.x / metersPerDegreeLng + centroid.x
          }));
          console.log(`[RoofVisualization] Expanded constraint ${p.label || p.id} by ${edgeSetbackM}m`);
          return [{ polygon: new google.maps.Polygon({ paths: expandedGeoCoords }), failed: false }];
        } else {
          // Expansion failed - mark this constraint as problematic
          // Panels near this constraint will need distance-based validation
          console.warn(`[RoofVisualization] Constraint ${p.label || p.id} expansion failed, using original + distance check`);
          return [{ 
            polygon: new google.maps.Polygon({ paths: coords.map(([lng, lat]) => ({ lat, lng })) }),
            failed: true, // Flag for additional distance checking
            meterCoords: normalizedMeterCoords,
            centroid,
            metersPerDegreeLat,
            metersPerDegreeLng
          }];
        }
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
      let acceptedByPrimary = 0;
      let acceptedByFallback = 0;
      let rejectedByConstraint = 0;
      let rejectedByContainment = 0;
        
      // 5. Get bounding box in ROTATED space only
      // The grid operates in rotated coordinates, so bbox must also be in rotated coordinates
      const bbox = getBoundingBox(rotatedPolygonPoints);
      
      // DEBUG: Log bounding box and polygon vertices to understand coverage
      console.log(`[RoofVisualization] Bounding box for ${polygon.label || polygon.id}:`, {
        minX: Math.round(bbox.minX), maxX: Math.round(bbox.maxX),
        minY: Math.round(bbox.minY), maxY: Math.round(bbox.maxY),
        width: Math.round(bbox.maxX - bbox.minX),
        height: Math.round(bbox.maxY - bbox.minY),
      });
      
      // Log original polygon vertices for comparison
      console.log(`[RoofVisualization] Original polygon vertices (meter space):`, 
        meterCoords.slice(0, 6).map(([x, y]) => `(${Math.round(x)},${Math.round(y)})`).join(', ') + 
        (meterCoords.length > 6 ? `... (${meterCoords.length} total)` : '')
      );
      
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
      
      // =========================================================
      // SIMPLE GRID-BASED PANEL PLACEMENT (C&I Best Practice)
      // =========================================================
      // 1. Align to building's principal axis (from PCA)
      // 2. Inset polygon by 1.2m for fire code setbacks
      // 3. Create uniform grid over rotated bounding box
      // 4. Accept panels with ALL 4 corners inside INSET polygon
      // 5. Skip panels overlapping constraints
      // 6. Enforce fire corridors for large roofs
      // =========================================================
      
      console.log(`[RoofVisualization] Simple grid fill: ${Math.round(roofWidthM)}×${Math.round(roofHeightM)}m, axis=${Math.round(axisAngle * 180 / Math.PI)}°`);
      console.log(`[RoofVisualization] Fire pathways: N/S=${needsNorthSouthPathway}, E/W=${needsEastWestPathway}`);
      
      // Grid origin is at (0,0) = polygon centroid in meter space
      const gridOrigin = { x: 0, y: 0 };
      
      // Create INSET polygon for proper edge setbacks (1.2m from all edges)
      // This handles concave edges correctly, not just bounding box
      const polygonPointsM = meterCoords.map(([x, y]) => ({ x, y }));
      
      // DEBUG: Log winding direction before and after normalization
      const preNormArea = signedPolygonArea(polygonPointsM);
      console.log(`[RoofVisualization] Pre-normalization: signedArea=${Math.round(preNormArea)}m², winding=${preNormArea > 0 ? 'CCW' : 'CW'}`);
      
      // Normalize to CCW winding - required for correct inward normal direction
      const normalizedPolygonM = normalizeToCCW(polygonPointsM);
      
      const postNormArea = signedPolygonArea(normalizedPolygonM);
      console.log(`[RoofVisualization] Post-normalization: signedArea=${Math.round(postNormArea)}m², winding=${postNormArea > 0 ? 'CCW' : 'CW'}`);
      
      const insetPolygonM = insetPolygon(normalizedPolygonM, edgeSetbackM);
      
      // =========================================================
      // CRITICAL FIX: Create ROTATED inset polygon for containment checks
      // =========================================================
      // The grid operates in ROTATED space (axis-aligned).
      // Previously, we checked rotated corners against ORIGINAL-space inset polygon,
      // requiring rotation back which introduced numerical drift (~1m at edges).
      // 
      // NEW APPROACH: Create inset polygon directly in ROTATED space.
      // Containment check uses rotated corners against rotated inset polygon.
      // No coordinate conversion = no numerical drift.
      //
      // CRITICAL: We must rotate the NORMALIZED polygon (CCW), not raw meterCoords.
      // Otherwise, if meterCoords was CW, the rotated polygon would also be CW,
      // and normalizeToCCW would flip it, reversing the inset direction.
      // By rotating the already-normalized polygon, we preserve the CCW winding.
      // =========================================================
      
      // Convert normalized polygon back to tuple format for rotation
      const normalizedMeterCoords: [number, number][] = normalizedPolygonM.map(p => [p.x, p.y]);
      
      // Rotate the NORMALIZED (CCW) polygon - winding is preserved by rotation
      const rotatedNormalizedPoints = rotatePolygonCoords(normalizedMeterCoords, meterCentroid, -axisAngle);
      
      // DEBUG: Verify winding direction of rotated normalized polygon
      const rotatedNormArea = signedPolygonArea(rotatedNormalizedPoints);
      console.log(`[RoofVisualization] Rotated normalized polygon: signedArea=${Math.round(rotatedNormArea)}m², winding=${rotatedNormArea > 0 ? 'CCW' : 'CW'}`);
      
      // Use rotated normalized polygon directly - it's already CCW
      const normalizedRotatedPolygon = rotatedNormalizedPoints;
      const rotatedInsetPolygonM = insetPolygon(normalizedRotatedPolygon, edgeSetbackM);
      
      // DEBUG: Verify rotated inset polygon
      const rotatedInsetArea = signedPolygonArea(rotatedInsetPolygonM);
      console.log(`[RoofVisualization] Rotated inset polygon: ${rotatedInsetPolygonM.length} vertices, area=${Math.round(Math.abs(rotatedInsetArea))}m² for containment in rotated space`);
      
      // DEBUG: Log inset polygon vertices 
      if (insetPolygonM.length > 0) {
        console.log(`[RoofVisualization] Inset polygon vertices (m):`, insetPolygonM.map(p => `(${p.x.toFixed(0)},${p.y.toFixed(0)})`).join(', '));
        // Check if inset polygon looks reasonable
        const insetBbox = getBoundingBox(insetPolygonM);
        const origBbox = getBoundingBox(normalizedPolygonM);
        console.log(`[RoofVisualization] Original bbox: X[${origBbox.minX.toFixed(0)},${origBbox.maxX.toFixed(0)}] Y[${origBbox.minY.toFixed(0)},${origBbox.maxY.toFixed(0)}]`);
        console.log(`[RoofVisualization] Inset bbox: X[${insetBbox.minX.toFixed(0)},${insetBbox.maxX.toFixed(0)}] Y[${insetBbox.minY.toFixed(0)},${insetBbox.maxY.toFixed(0)}]`);
      }
      
      // Also create ORIGINAL polygon path for fallback distance-based checking
      // This is used when inset collapses narrow sections (like triangular protrusions)
      // Use the original coords directly (already in geographic format)
      const originalGeoCoords = coords.map(([lng, lat]) => ({ lat, lng }));
      const originalPolygonPath = new google.maps.Polygon({ paths: originalGeoCoords });
      
      // Convert inset polygon to geographic coordinates for containment checks
      let insetPolygonPath: google.maps.Polygon | null = null;
      let insetCollapseDetected = false;
      
      if (insetPolygonM.length >= 3) {
        const insetGeoCoords = insetPolygonM.map(p => ({
          lat: p.y / metersPerDegreeLat + centroid.y,
          lng: p.x / metersPerDegreeLng + centroid.x
        }));
        insetPolygonPath = new google.maps.Polygon({ paths: insetGeoCoords });
        
        // Check if inset polygon is significantly smaller than expected
        // This indicates some sections may have collapsed
        const insetArea = Math.abs(signedPolygonArea(insetPolygonM));
        const originalPolygonArea = Math.abs(signedPolygonArea(normalizedPolygonM));
        const expectedInsetArea = originalPolygonArea * 0.7; // Rough estimate
        if (insetArea < expectedInsetArea * 0.5) {
          insetCollapseDetected = true;
          console.warn(`[RoofVisualization] Inset polygon may have collapsed sections (area ${Math.round(insetArea)}m² vs expected ${Math.round(expectedInsetArea)}m²)`);
        }
        console.log(`[RoofVisualization] Inset polygon: ${insetPolygonM.length} vertices (original: ${normalizedPolygonM.length}), area: ${Math.round(insetArea)}m² (original: ${Math.round(originalPolygonArea)}m²)`);
        
        // DEBUG: Log vertex coordinates to understand what was lost
        if (normalizedPolygonM.length > insetPolygonM.length) {
          console.warn(`[RoofVisualization] LOST ${normalizedPolygonM.length - insetPolygonM.length} vertices during inset - triangular sections may have collapsed!`);
        }
      } else {
        // CRITICAL: If inset fails completely, use distance-based checking only
        insetCollapseDetected = true;
        console.warn(`[RoofVisualization] Inset failed for polygon ${polygon.label || polygon.id} - will use distance-based fallback`);
      }
      
      // Use inset polygon for primary containment, with fallback to distance checking
      const containmentPolygon = insetPolygonPath;
      
      // Calculate grid bounds from rotated bounding box
      const gridMinX = bbox.minX;
      const gridMaxX = bbox.maxX;
      const gridMinY = bbox.minY;
      const gridMaxY = bbox.maxY;
      
      // Calculate number of columns and rows
      const numCols = Math.floor((gridMaxX - gridMinX) / colStep) + 1;
      const gridNumRows = Math.floor((gridMaxY - gridMinY) / rowStep) + 1;
      
      console.log(`[RoofVisualization] Grid: ${numCols} cols × ${gridNumRows} rows, bounds: X[${gridMinX.toFixed(0)},${gridMaxX.toFixed(0)}] Y[${gridMinY.toFixed(0)},${gridMaxY.toFixed(0)}]`);
      console.log(`[RoofVisualization] Original polygon vertices (m):`, normalizedPolygonM.map(p => `(${p.x.toFixed(0)},${p.y.toFixed(0)})`).join(', '));
      console.log(`[RoofVisualization] Axis angle: ${(axisAngle * 180 / Math.PI).toFixed(1)}°`);
      
      // Iterate over grid positions
      for (let rowIdx = 0; rowIdx < gridNumRows; rowIdx++) {
        const rotY = gridMinY + rowIdx * rowStep;
        
        for (let colIdx = 0; colIdx < numCols; colIdx++) {
          const rotX = gridMinX + colIdx * colStep;
          
          // Panel corners in rotated (axis-aligned) space
          const rotatedCorners: Point2D[] = [
            { x: rotX, y: rotY },
            { x: rotX + panelWidthM, y: rotY },
            { x: rotX + panelWidthM, y: rotY + panelHeightM },
            { x: rotX, y: rotY + panelHeightM },
          ];
          
          // Rotate back to original meter space
          const meterCorners = rotatedCorners.map(p => 
            rotatePoint(p, gridOrigin, axisAngle)
          );
          
          // Panel center in meter space
          const panelCenterM = {
            x: (meterCorners[0].x + meterCorners[2].x) / 2,
            y: (meterCorners[0].y + meterCorners[2].y) / 2
          };
          
          // FIRE PATHWAY CHECK (in rotated space - simpler)
          const rotCenterX = rotX + panelWidthM / 2;
          const rotCenterY = rotY + panelHeightM / 2;
          
          // N-S pathway: vertical corridor at X=0 in rotated space
          if (needsNorthSouthPathway) {
            if (Math.abs(rotCenterX) < halfPathway + panelWidthM / 2) {
              continue;
            }
          }
          // E-W pathway: horizontal corridor at Y=0 in rotated space
          if (needsEastWestPathway) {
            if (Math.abs(rotCenterY) < halfPathway + panelHeightM / 2) {
              continue;
            }
          }
          
          // Convert to geographic coordinates
          const geoCorners = meterCorners.map(p => ({
            x: p.x / metersPerDegreeLng + centroid.x,
            y: p.y / metersPerDegreeLat + centroid.y
          }));
          
          // CONTAINMENT CHECK with HYBRID FALLBACK
          // =========================================================
          // CRITICAL FIX: Check rotated corners against ROTATED inset polygon
          // =========================================================
          // Both the grid and the inset polygon are in the SAME ROTATED space.
          // This eliminates ALL coordinate conversions for containment,
          // preventing numerical drift that caused panels to be rejected
          // in the top-left section of parallelogram roofs.
          // =========================================================
          const testPoints = geoCorners.map(c => new google.maps.LatLng(c.y, c.x));
          
          let passesContainment = false;
          
          // Primary check: ROTATED-SPACE inset polygon containment
          // rotatedCorners are already in rotated space (no conversion needed)
          // rotatedInsetPolygonM is the inset polygon in rotated space
          if (rotatedInsetPolygonM.length >= 3) {
            const allCornersInRotatedInset = rotatedCorners.every(corner => 
              pointInPolygon(corner, rotatedInsetPolygonM)
            );
            if (allCornersInRotatedInset) {
              passesContainment = true;
              acceptedByPrimary++;
            }
          }
          
          // Fallback check: rotated polygon + distance-based setback (all in ROTATED space)
          // Only used if primary check failed (inset may have collapsed in narrow sections)
          // Uses ROTATED space for consistency - no coordinate conversion drift
          let rejectionReason = '';
          if (!passesContainment) {
            // Check if ALL 4 corners are inside the ROTATED (non-inset) polygon
            // Using pointInPolygon in rotated space for consistency
            const allCornersInRotatedPolygon = rotatedCorners.every(corner => 
              pointInPolygon(corner, normalizedRotatedPolygon)
            );
            
            if (allCornersInRotatedPolygon) {
              // Verify all panel corners are at least edgeSetbackM from rotated polygon edges
              // Use rotated space distance calculation for accuracy
              let allCornersHaveSetback = true;
              let minDistToEdge = Infinity;
              
              for (const corner of rotatedCorners) {
                const distToEdge = distanceToPolygonEdges(corner, normalizedRotatedPolygon);
                minDistToEdge = Math.min(minDistToEdge, distToEdge);
                if (distToEdge < edgeSetbackM - 0.1) { // 0.1m tolerance for floating point
                  allCornersHaveSetback = false;
                  rejectionReason = `distance=${distToEdge.toFixed(1)}m < ${edgeSetbackM}m`;
                  break;
                }
              }
              
              if (allCornersHaveSetback) {
                passesContainment = true;
                acceptedByFallback++;
              }
            } else {
              rejectionReason = 'outside rotated polygon';
            }
          }
          
          if (!passesContainment) {
            rejectedByContainment++;
            // Log sample of rejected panels to understand the pattern
            if (rejectedByContainment <= 5 || rejectedByContainment % 1000 === 0) {
              console.log(`[RoofVisualization] Rejected panel at meter(${Math.round(panelCenterM.x)},${Math.round(panelCenterM.y)}), reason: ${rejectionReason || 'failed inset check'}`);
            }
            continue;
          }
          
          // CONSTRAINT CHECK: No corners in constraint polygons (with distance fallback)
          let violatesConstraint = false;
          
          for (const cp of constraintPolygonPaths) {
            // First check: containment in the (expanded) constraint polygon
            const anyCornerInConstraint = testPoints.some(point => 
              google.maps.geometry.poly.containsLocation(point, cp.polygon)
            );
            
            if (anyCornerInConstraint) {
              violatesConstraint = true;
              break;
            }
            
            // Second check: for failed expansions, verify distance-based setback
            if (cp.failed && cp.meterCoords && cp.centroid) {
              // Convert panel corners to this constraint's meter space
              for (const geoCorner of geoCorners) {
                const cornerInConstraintSpace: Point2D = {
                  x: (geoCorner.x - cp.centroid.x) * cp.metersPerDegreeLng,
                  y: (geoCorner.y - cp.centroid.y) * cp.metersPerDegreeLat
                };
                
                // Check distance from panel corner to constraint edges
                const distToConstraint = distanceToPolygonEdges(cornerInConstraintSpace, cp.meterCoords);
                
                if (distToConstraint < edgeSetbackM) {
                  violatesConstraint = true;
                  break;
                }
              }
              
              if (violatesConstraint) break;
            }
          }
          
          if (violatesConstraint) {
            rejectedByConstraint++;
            continue;
          }
          
          // Accept panel
          acceptedCount++;
          const bottomLeft = geoCorners[0];
          const quadrant = (panelCenterM.x >= 0 ? 'E' : 'W') + (panelCenterM.y >= 0 ? 'N' : 'S');
          
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
      
      console.log(`[RoofVisualization] Grid fill complete: ${acceptedCount} panels (${acceptedByPrimary} primary, ${acceptedByFallback} fallback), ${rejectedByContainment} rejected by containment`);
      
      // SKIP THE OLD CONVEX-ONLY CODE PATH - unified approach handles all shapes
      if (false) {
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

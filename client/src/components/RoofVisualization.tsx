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

const PANEL_KW = 0.59;
const PANEL_WIDTH_M = 2.0;
const PANEL_HEIGHT_M = 1.0;
const PANEL_GAP_M = 0.1;
const PERIMETER_SETBACK_M = 1.2;

const PANEL_TILT_DEG = 10.0;
const SUN_ALTITUDE_WINTER_SOLSTICE_DEG = 21.5;

function calculateAntiShadingRowSpacing(panelHeightM: number, tiltDeg: number, sunAltitudeDeg: number): number {
  const tiltRad = tiltDeg * Math.PI / 180;
  const sunAltRad = sunAltitudeDeg * Math.PI / 180;
  const panelVerticalHeight = panelHeightM * Math.sin(tiltRad);
  const shadowLength = panelVerticalHeight / Math.tan(sunAltRad);
  return Math.max(0.3, shadowLength);
}

const ROW_SPACING_M = calculateAntiShadingRowSpacing(PANEL_HEIGHT_M, PANEL_TILT_DEG, SUN_ALTITUDE_WINTER_SOLSTICE_DEG);

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

function computePrincipalAxisAngle(coords: [number, number][]): number {
  if (coords.length < 2) return 0;
  
  let cx = 0, cy = 0;
  for (const [x, y] of coords) {
    cx += x;
    cy += y;
  }
  cx /= coords.length;
  cy /= coords.length;
  
  let Sxx = 0, Syy = 0, Sxy = 0;
  for (const [x, y] of coords) {
    const dx = x - cx;
    const dy = y - cy;
    Sxx += dx * dx;
    Syy += dy * dy;
    Sxy += dx * dy;
  }
  
  const diff = Sxx - Syy;
  const discriminant = Math.sqrt(diff * diff + 4 * Sxy * Sxy);
  
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
    while (bestAngle < 0) bestAngle += Math.PI;
    while (bestAngle >= Math.PI) bestAngle -= Math.PI;
    return bestAngle;
  }
  
  let angle = 0.5 * Math.atan2(2 * Sxy, diff);
  while (angle < 0) angle += Math.PI;
  while (angle >= Math.PI) angle -= Math.PI;
  
  return angle;
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
  if (insetArea > originalArea || insetArea < originalArea * 0.01) {
    console.log(`[RoofVisualization] Inset polygon invalid: original=${originalArea.toFixed(0)}m², inset=${insetArea.toFixed(0)}m²`);
    return null;
  }
  
  return insetPoints.map(p => [
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
      const defaultCapacity = currentPVSizeKW || Math.round(maxCapacity * 0.7);
      setSelectedCapacityKW(Math.min(defaultCapacity, maxCapacity));
    }
  }, [maxCapacity, currentPVSizeKW, hasUserAdjusted]);

  const generatePanelPositions = useCallback((
    solarPolygon: google.maps.Polygon,
    constraintPolygons: google.maps.Polygon[],
    polygonId: string,
    coords: [number, number][]
  ): PanelPosition[] => {
    const panels: PanelPosition[] = [];
    
    const centroid = computeCentroid(coords);
    const axisAngle = computePrincipalAxisAngle(coords);
    
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
    
    // Step 2: Add FIXED margin (100m) to guarantee all corners are covered
    // This works regardless of polygon shape or rotation angle
    const FIXED_MARGIN_M = 100;
    minXRot -= FIXED_MARGIN_M;
    maxXRot += FIXED_MARGIN_M;
    minYRot -= FIXED_MARGIN_M;
    maxYRot += FIXED_MARGIN_M;
    
    const bboxWidth = maxXRot - minXRot;
    const bboxHeight = maxYRot - minYRot;
    
    if (bboxWidth < PANEL_WIDTH_M || bboxHeight < PANEL_HEIGHT_M) {
      console.log(`[RoofVisualization] Polygon ${polygonId.slice(0,8)} too small for panels`);
      return panels;
    }
    
    // Step 3: Generate grid in ROTATED space (correct spacing)
    const panelPitchX = PANEL_WIDTH_M + PANEL_GAP_M;
    const panelPitchY = PANEL_HEIGHT_M + ROW_SPACING_M;
    
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
        for (const polygon of constraintPolygonData) {
          const coords = polygon.coordinates as [number, number][];
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

        const allPanels: PanelPosition[] = [];

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

          const panels = generatePanelPositions(
            solarGooglePolygon,
            constraintGooglePolygons,
            polygon.id,
            coords
          );
          
          allPanels.push(...panels);
        }

        const sortedPanels = sortPanelsByRowPriority(allPanels);
        setAllPanelPositions(sortedPanels);

        console.log(`[RoofVisualization] Total panels generated: ${sortedPanels.length}, capacity: ${Math.round(sortedPanels.length * PANEL_KW)} kWc`);

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
  }, [latitude, longitude, roofPolygons, language, generatePanelPositions, sortPanelsByRowPriority, onGeometryCalculated]);

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
              {allPanelPositions.length > 0 && (
                <>
                  <span>•</span>
                  <span>{language === "fr" ? "Utilisation" : "Utilization"}: {((panelsToShow / allPanelPositions.length) * 100).toFixed(0)}%</span>
                </>
              )}
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

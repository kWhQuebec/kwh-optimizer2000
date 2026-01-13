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
  quadrant?: string;
}

const PANEL_KW = 0.59;
const PANEL_WIDTH_M = 2.0;
const PANEL_HEIGHT_M = 1.0;
const PANEL_GAP_M = 0.1;
const ROW_SPACING_M = 0.5;
const PERIMETER_SETBACK_M = 1.2;
const FIRE_PATHWAY_WIDTH_M = 1.2;
const FIRE_PATHWAY_THRESHOLD_M = 40;

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
    
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [lng, lat] of coords) {
      const x = (lng - centroid.lng) * metersPerDegreeLng;
      const y = (lat - centroid.lat) * metersPerDegreeLat;
      const cos = Math.cos(-axisAngle);
      const sin = Math.sin(-axisAngle);
      const rx = x * cos - y * sin;
      const ry = x * sin + y * cos;
      minX = Math.min(minX, rx);
      maxX = Math.max(maxX, rx);
      minY = Math.min(minY, ry);
      maxY = Math.max(maxY, ry);
    }
    
    const bboxWidth = maxX - minX;
    const bboxHeight = maxY - minY;
    
    const effectiveMinX = minX + PERIMETER_SETBACK_M;
    const effectiveMaxX = maxX - PERIMETER_SETBACK_M;
    const effectiveMinY = minY + PERIMETER_SETBACK_M;
    const effectiveMaxY = maxY - PERIMETER_SETBACK_M;
    
    if (effectiveMaxX <= effectiveMinX || effectiveMaxY <= effectiveMinY) {
      console.log(`[RoofVisualization] Polygon ${polygonId.slice(0,8)} too small after setback`);
      return panels;
    }
    
    const needsNSPathway = bboxHeight > FIRE_PATHWAY_THRESHOLD_M;
    const needsEWPathway = bboxWidth > FIRE_PATHWAY_THRESHOLD_M;
    
    const panelPitchX = PANEL_WIDTH_M + PANEL_GAP_M;
    const panelPitchY = PANEL_HEIGHT_M + ROW_SPACING_M;
    
    const centerX = (effectiveMinX + effectiveMaxX) / 2;
    const centerY = (effectiveMinY + effectiveMaxY) / 2;
    
    const halfPathway = FIRE_PATHWAY_WIDTH_M / 2;
    
    const xPositions: number[] = [];
    const yPositions: number[] = [];
    
    if (needsEWPathway) {
      for (let x = centerX + halfPathway; x + PANEL_WIDTH_M <= effectiveMaxX; x += panelPitchX) {
        xPositions.push(x);
      }
      for (let x = centerX - halfPathway - PANEL_WIDTH_M; x >= effectiveMinX; x -= panelPitchX) {
        xPositions.push(x);
      }
    } else {
      for (let x = effectiveMinX; x + PANEL_WIDTH_M <= effectiveMaxX; x += panelPitchX) {
        xPositions.push(x);
      }
    }
    
    if (needsNSPathway) {
      for (let y = centerY + halfPathway; y + PANEL_HEIGHT_M <= effectiveMaxY; y += panelPitchY) {
        yPositions.push(y);
      }
      for (let y = centerY - halfPathway - PANEL_HEIGHT_M; y >= effectiveMinY; y -= panelPitchY) {
        yPositions.push(y);
      }
    } else {
      for (let y = effectiveMinY; y + PANEL_HEIGHT_M <= effectiveMaxY; y += panelPitchY) {
        yPositions.push(y);
      }
    }
    
    console.log(`[RoofVisualization] Polygon ${polygonId.slice(0,8)}: bbox=${Math.round(bboxWidth)}×${Math.round(bboxHeight)}m, axis=${(axisAngle * 180 / Math.PI).toFixed(1)}°`);
    console.log(`[RoofVisualization] Grid: ${xPositions.length} cols × ${yPositions.length} rows = ${xPositions.length * yPositions.length} potential positions`);
    console.log(`[RoofVisualization] Fire pathways: N/S=${needsNSPathway}, E/W=${needsEWPathway}`);
    
    let accepted = 0;
    let rejectedByRoof = 0;
    let rejectedByConstraint = 0;
    
    for (const gridX of xPositions) {
      for (const gridY of yPositions) {
        const panelCornersRotated = [
          { x: gridX, y: gridY },
          { x: gridX + PANEL_WIDTH_M, y: gridY },
          { x: gridX + PANEL_WIDTH_M, y: gridY + PANEL_HEIGHT_M },
          { x: gridX, y: gridY + PANEL_HEIGHT_M }
        ];
        
        const panelCornersGeo = panelCornersRotated.map(corner => {
          const cos = Math.cos(axisAngle);
          const sin = Math.sin(axisAngle);
          const unrotatedX = corner.x * cos - corner.y * sin;
          const unrotatedY = corner.x * sin + corner.y * cos;
          return {
            lat: centroid.lat + unrotatedY / metersPerDegreeLat,
            lng: centroid.lng + unrotatedX / metersPerDegreeLng
          };
        });
        
        const panelCenterLat = (panelCornersGeo[0].lat + panelCornersGeo[2].lat) / 2;
        const panelCenterLng = (panelCornersGeo[0].lng + panelCornersGeo[2].lng) / 2;
        const panelCenter = new google.maps.LatLng(panelCenterLat, panelCenterLng);
        
        if (!google.maps.geometry.poly.containsLocation(panelCenter, solarPolygon)) {
          rejectedByRoof++;
          continue;
        }
        
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
        
        const quadrant = 
          (panelCenterLng >= centroid.lng ? "E" : "W") +
          (panelCenterLat >= centroid.lat ? "N" : "S");
        
        panels.push({
          lat: panelCornersGeo[0].lat,
          lng: panelCornersGeo[0].lng,
          widthDeg: metersToDegreesLng(PANEL_WIDTH_M, centroid.lat),
          heightDeg: metersToDegreesLat(PANEL_HEIGHT_M),
          polygonId,
          corners: panelCornersGeo,
          quadrant
        });
        
        accepted++;
      }
    }
    
    console.log(`[RoofVisualization] Polygon ${polygonId.slice(0,8)}: ${accepted} panels accepted, ${rejectedByRoof} outside roof, ${rejectedByConstraint} in constraints`);
    
    const quadrantCounts = { EN: 0, ES: 0, WN: 0, WS: 0 };
    for (const p of panels) {
      if (p.quadrant) quadrantCounts[p.quadrant as keyof typeof quadrantCounts]++;
    }
    console.log(`[RoofVisualization] Polygon ${polygonId.slice(0,8)} quadrants: EN=${quadrantCounts.EN}, ES=${quadrantCounts.ES}, WN=${quadrantCounts.WN}, WS=${quadrantCounts.WS}`);
    
    return panels;
  }, []);

  const interleavePanelsByQuadrant = useCallback((panels: PanelPosition[]): PanelPosition[] => {
    const quadrants: Record<string, PanelPosition[]> = { EN: [], ES: [], WN: [], WS: [] };
    
    for (const panel of panels) {
      const q = panel.quadrant || "EN";
      if (quadrants[q]) quadrants[q].push(panel);
    }
    
    const interleaved: PanelPosition[] = [];
    const order = ["WN", "EN", "WS", "ES"];
    let added = true;
    
    while (added) {
      added = false;
      for (const q of order) {
        if (quadrants[q].length > 0) {
          interleaved.push(quadrants[q].shift()!);
          added = true;
        }
      }
    }
    
    return interleaved;
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || !window.google) {
      if (!window.google) {
        setMapError(language === "fr" ? "Google Maps non disponible" : "Google Maps not available");
      }
      setIsLoading(false);
      return;
    }

    const initMap = async () => {
      try {
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

        const interleavedPanels = interleavePanelsByQuadrant(allPanels);
        setAllPanelPositions(interleavedPanels);

        console.log(`[RoofVisualization] Total panels generated: ${interleavedPanels.length}, capacity: ${Math.round(interleavedPanels.length * PANEL_KW)} kWc`);

        if (onGeometryCalculated && interleavedPanels.length > 0) {
          onGeometryCalculated({
            maxCapacityKW: Math.round(interleavedPanels.length * PANEL_KW),
            panelCount: interleavedPanels.length,
            realisticCapacityKW: Math.round(interleavedPanels.length * PANEL_KW * 0.9),
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
  }, [latitude, longitude, roofPolygons, language, generatePanelPositions, interleavePanelsByQuadrant, onGeometryCalculated]);

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

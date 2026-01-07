/// <reference types="google.maps" />
import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Edit2, Check, X, Square, Pentagon, Loader2, MapPin, AlertTriangle, Sun } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { RoofPolygon, InsertRoofPolygon } from '@shared/schema';

interface RoofDrawingModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteId: string;
  latitude: number;
  longitude: number;
  existingPolygons?: RoofPolygon[];
  onSave: (polygons: InsertRoofPolygon[]) => void;
}

interface DrawnPolygon {
  id: string;
  label: string;
  coordinates: [number, number][];
  areaSqM: number;
  color: string;
  googlePolygon: google.maps.Polygon | null;
}

const SOLAR_COLOR = '#3b82f6';      // Blue for solar areas
const CONSTRAINT_COLOR = '#f97316'; // Orange for constraint areas
const GOOGLE_MAPS_SCRIPT_ID = 'google-maps-script';

type PolygonType = 'solar' | 'constraint';

declare global {
  interface Window {
    initGoogleMaps?: () => void;
    google?: typeof google;
  }
}

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve();
      return;
    }

    const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID);
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=drawing,geometry&callback=initGoogleMaps`;
    script.async = true;
    script.defer = true;

    window.initGoogleMaps = () => {
      resolve();
    };

    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
}

function generateId(): string {
  return `polygon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function RoofDrawingModal({
  isOpen,
  onClose,
  siteId,
  latitude,
  longitude,
  existingPolygons = [],
  onSave,
}: RoofDrawingModalProps) {
  const { language } = useI18n();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [polygons, setPolygons] = useState<DrawnPolygon[]>([]);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingLabelValue, setEditingLabelValue] = useState('');
  const [activeDrawingMode, setActiveDrawingMode] = useState<'polygon' | 'rectangle' | null>(null);
  const [currentPolygonType, setCurrentPolygonType] = useState<PolygonType>('solar');
  const polygonTypeRef = useRef<PolygonType>('solar');

  const initializeMap = useCallback(async () => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setMapError(language === 'fr' ? 'Clé API Google Maps manquante' : 'Google Maps API key missing');
      setIsLoading(false);
      return;
    }

    try {
      await loadGoogleMapsScript(apiKey);

      if (!mapContainerRef.current || !window.google) return;

      const map = new google.maps.Map(mapContainerRef.current, {
        center: { lat: latitude, lng: longitude },
        zoom: 19,
        mapTypeId: google.maps.MapTypeId.SATELLITE,
        tilt: 0,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      mapRef.current = map;

      const currentColor = polygonTypeRef.current === 'constraint' ? CONSTRAINT_COLOR : SOLAR_COLOR;
      
      const drawingManager = new google.maps.drawing.DrawingManager({
        drawingMode: null,
        drawingControl: false,
        polygonOptions: {
          fillColor: currentColor,
          fillOpacity: 0.4,
          strokeColor: currentColor,
          strokeWeight: 2,
          editable: true,
          draggable: false,
        },
        rectangleOptions: {
          fillColor: currentColor,
          fillOpacity: 0.4,
          strokeColor: currentColor,
          strokeWeight: 2,
          editable: true,
          draggable: false,
        },
      });

      drawingManager.setMap(map);
      drawingManagerRef.current = drawingManager;

      google.maps.event.addListener(drawingManager, 'polygoncomplete', (polygon: google.maps.Polygon) => {
        handlePolygonComplete(polygon);
        drawingManager.setDrawingMode(null);
        setActiveDrawingMode(null);
      });

      google.maps.event.addListener(drawingManager, 'rectanglecomplete', (rectangle: google.maps.Rectangle) => {
        const bounds = rectangle.getBounds();
        if (!bounds) return;

        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();

        const rectColor = polygonTypeRef.current === 'constraint' ? CONSTRAINT_COLOR : SOLAR_COLOR;
        const polygon = new google.maps.Polygon({
          paths: [
            { lat: ne.lat(), lng: ne.lng() },
            { lat: ne.lat(), lng: sw.lng() },
            { lat: sw.lat(), lng: sw.lng() },
            { lat: sw.lat(), lng: ne.lng() },
          ],
          fillColor: rectColor,
          fillOpacity: 0.4,
          strokeColor: rectColor,
          strokeWeight: 2,
          editable: true,
          map: map,
        });

        rectangle.setMap(null);
        handlePolygonComplete(polygon);
        drawingManager.setDrawingMode(null);
        setActiveDrawingMode(null);
      });

      if (existingPolygons.length > 0) {
        const loadedPolygons: DrawnPolygon[] = existingPolygons.map((ep) => {
          const coords = (ep.coordinates as [number, number][]).map(([lng, lat]) => ({
            lat,
            lng,
          }));

          const googlePolygon = new google.maps.Polygon({
            paths: coords,
            fillColor: ep.color || SOLAR_COLOR,
            fillOpacity: 0.4,
            strokeColor: ep.color || SOLAR_COLOR,
            strokeWeight: 2,
            editable: true,
            map: map,
          });

          const drawnPolygon: DrawnPolygon = {
            id: ep.id,
            label: ep.label || '',
            coordinates: ep.coordinates as [number, number][],
            areaSqM: ep.areaSqM,
            color: ep.color || SOLAR_COLOR,
            googlePolygon,
          };

          setupPolygonListeners(googlePolygon, drawnPolygon.id);

          return drawnPolygon;
        });

        setPolygons(loadedPolygons);
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Error initializing Google Maps:', err);
      setMapError(language === 'fr' ? 'Erreur lors du chargement de Google Maps' : 'Error loading Google Maps');
      setIsLoading(false);
    }
  }, [latitude, longitude, existingPolygons, language]);

  const handlePolygonComplete = (polygon: google.maps.Polygon) => {
    const path = polygon.getPath();
    const coordinates: [number, number][] = [];

    for (let i = 0; i < path.getLength(); i++) {
      const point = path.getAt(i);
      coordinates.push([point.lng(), point.lat()]);
    }

    const areaSqM = google.maps.geometry.spherical.computeArea(path);
    const isConstraint = polygonTypeRef.current === 'constraint';
    const color = isConstraint ? CONSTRAINT_COLOR : SOLAR_COLOR;
    const defaultLabel = isConstraint 
      ? (language === 'fr' ? 'Contrainte' : 'Constraint')
      : '';

    const newPolygon: DrawnPolygon = {
      id: generateId(),
      label: defaultLabel,
      coordinates,
      areaSqM,
      color,
      googlePolygon: polygon,
    };

    setupPolygonListeners(polygon, newPolygon.id);
    setPolygons((prev) => [...prev, newPolygon]);
  };

  const setupPolygonListeners = (polygon: google.maps.Polygon, polygonId: string) => {
    const path = polygon.getPath();

    const updatePolygon = () => {
      const newCoords: [number, number][] = [];
      for (let i = 0; i < path.getLength(); i++) {
        const point = path.getAt(i);
        newCoords.push([point.lng(), point.lat()]);
      }
      const newArea = google.maps.geometry.spherical.computeArea(path);

      setPolygons((prev) =>
        prev.map((p) =>
          p.id === polygonId ? { ...p, coordinates: newCoords, areaSqM: newArea } : p
        )
      );
    };

    google.maps.event.addListener(path, 'set_at', updatePolygon);
    google.maps.event.addListener(path, 'insert_at', updatePolygon);
    google.maps.event.addListener(path, 'remove_at', updatePolygon);
  };

  const handleDeletePolygon = (polygonId: string) => {
    const polygon = polygons.find((p) => p.id === polygonId);
    if (polygon?.googlePolygon) {
      polygon.googlePolygon.setMap(null);
    }
    setPolygons((prev) => prev.filter((p) => p.id !== polygonId));
  };

  const handleStartEditLabel = (polygon: DrawnPolygon) => {
    setEditingLabelId(polygon.id);
    setEditingLabelValue(polygon.label);
  };

  const handleSaveLabel = () => {
    if (editingLabelId) {
      setPolygons((prev) =>
        prev.map((p) =>
          p.id === editingLabelId ? { ...p, label: editingLabelValue } : p
        )
      );
      setEditingLabelId(null);
      setEditingLabelValue('');
    }
  };

  const handleCancelEditLabel = () => {
    setEditingLabelId(null);
    setEditingLabelValue('');
  };

  const setDrawingMode = (mode: 'polygon' | 'rectangle' | null) => {
    if (!drawingManagerRef.current) return;

    if (mode === 'polygon') {
      drawingManagerRef.current.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
    } else if (mode === 'rectangle') {
      drawingManagerRef.current.setDrawingMode(google.maps.drawing.OverlayType.RECTANGLE);
    } else {
      drawingManagerRef.current.setDrawingMode(null);
    }
    setActiveDrawingMode(mode);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const polygonsToSave: InsertRoofPolygon[] = polygons.map((p) => ({
        siteId,
        label: p.label || null,
        coordinates: p.coordinates,
        areaSqM: p.areaSqM,
        color: p.color,
      }));

      await onSave(polygonsToSave);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = useCallback(() => {
    // Remove polygon overlays from the map but don't touch any other DOM elements
    polygons.forEach((p) => {
      if (p.googlePolygon) {
        try {
          p.googlePolygon.setMap(null);
        } catch (e) {
          // Ignore errors
        }
      }
    });
    
    setPolygons([]);
    setActiveDrawingMode(null);
    // Just call onClose - keep map intact for reuse
    onClose();
  }, [polygons, onClose]);

  const totalArea = polygons.reduce((sum, p) => sum + p.areaSqM, 0);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setMapError(null);
      const timer = setTimeout(() => {
        initializeMap();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initializeMap]);

  // Minimal cleanup - just remove polygon overlays, keep map intact
  const cleanupMap = useCallback(() => {
    polygons.forEach((p) => {
      if (p.googlePolygon) {
        try {
          p.googlePolygon.setMap(null);
        } catch (e) {
          // Ignore errors
        }
      }
    });
  }, [polygons]);

  useEffect(() => {
    if (!isOpen) {
      cleanupMap();
      setPolygons([]);
    }
  }, [isOpen, cleanupMap]);

  // Keep mounted but hidden to avoid DOM cleanup issues with Google Maps
  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center ${isOpen ? '' : 'hidden pointer-events-none'}`}
      data-testid="roof-drawing-modal"
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80"
        onClick={handleClose}
      />
      
      {/* Modal Content */}
      <div className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-background border rounded-lg shadow-lg p-6 m-4">
        {/* Header */}
        <div className="flex flex-col space-y-1.5 mb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold leading-none tracking-tight flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {language === 'fr' ? 'Dessiner les zones de toit' : 'Draw Roof Areas'}
            </h2>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleClose}
              data-testid="button-close-modal"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {language === 'fr'
              ? 'Tracez les zones de toit utilisables pour les panneaux solaires. Utilisez les outils pour dessiner des polygones ou des rectangles.'
              : 'Trace usable roof areas for solar panels. Use the tools to draw polygons or rectangles.'}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
          <div className="flex-1 flex flex-col gap-3">
            {/* Polygon Type Selector */}
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
              <span className="text-xs text-muted-foreground mr-1">
                {language === 'fr' ? 'Type:' : 'Type:'}
              </span>
              <Button
                size="sm"
                variant={currentPolygonType === 'solar' ? 'default' : 'outline'}
                className={currentPolygonType === 'solar' ? 'bg-blue-500 hover:bg-blue-600' : ''}
                onClick={() => {
                  setCurrentPolygonType('solar');
                  polygonTypeRef.current = 'solar';
                  if (drawingManagerRef.current) {
                    drawingManagerRef.current.setOptions({
                      polygonOptions: { fillColor: SOLAR_COLOR, strokeColor: SOLAR_COLOR, fillOpacity: 0.4, strokeWeight: 2, editable: true },
                      rectangleOptions: { fillColor: SOLAR_COLOR, strokeColor: SOLAR_COLOR, fillOpacity: 0.4, strokeWeight: 2, editable: true }
                    });
                  }
                }}
                data-testid="button-type-solar"
              >
                <Sun className="h-4 w-4 mr-1" />
                {language === 'fr' ? 'Zone solaire' : 'Solar Area'}
              </Button>
              <Button
                size="sm"
                variant={currentPolygonType === 'constraint' ? 'default' : 'outline'}
                className={currentPolygonType === 'constraint' ? 'bg-orange-500 hover:bg-orange-600' : ''}
                onClick={() => {
                  setCurrentPolygonType('constraint');
                  polygonTypeRef.current = 'constraint';
                  if (drawingManagerRef.current) {
                    drawingManagerRef.current.setOptions({
                      polygonOptions: { fillColor: CONSTRAINT_COLOR, strokeColor: CONSTRAINT_COLOR, fillOpacity: 0.4, strokeWeight: 2, editable: true },
                      rectangleOptions: { fillColor: CONSTRAINT_COLOR, strokeColor: CONSTRAINT_COLOR, fillOpacity: 0.4, strokeWeight: 2, editable: true }
                    });
                  }
                }}
                data-testid="button-type-constraint"
              >
                <AlertTriangle className="h-4 w-4 mr-1" />
                {language === 'fr' ? 'Contrainte' : 'Constraint'}
              </Button>
            </div>

            {/* Drawing Tools */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={activeDrawingMode === 'polygon' ? 'default' : 'outline'}
                onClick={() => setDrawingMode(activeDrawingMode === 'polygon' ? null : 'polygon')}
                data-testid="button-draw-polygon"
              >
                <Pentagon className="h-4 w-4 mr-2" />
                {language === 'fr' ? 'Polygone' : 'Polygon'}
              </Button>
              <Button
                size="sm"
                variant={activeDrawingMode === 'rectangle' ? 'default' : 'outline'}
                onClick={() => setDrawingMode(activeDrawingMode === 'rectangle' ? null : 'rectangle')}
                data-testid="button-draw-rectangle"
              >
                <Square className="h-4 w-4 mr-2" />
                {language === 'fr' ? 'Rectangle' : 'Rectangle'}
              </Button>
            </div>

            {/* Outer wrapper for React - inner div for Google Maps */}
            <div className="flex-1 min-h-[300px] rounded-lg border bg-muted relative" data-testid="map-container">
              <div 
                ref={mapContainerRef}
                className="absolute inset-0"
              />
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
                  <Skeleton className="h-full w-full" />
                </div>
              )}
              {mapError && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground z-10">
                  {mapError}
                </div>
              )}
            </div>
          </div>

          <div className="w-full lg:w-72 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">
                {language === 'fr' ? 'Zones tracées' : 'Drawn Areas'}
              </h3>
              <Badge variant="secondary" data-testid="badge-total-area">
                {totalArea.toFixed(0)} m²
              </Badge>
            </div>

            <ScrollArea className="flex-1 max-h-[250px] lg:max-h-[400px]">
              <div className="space-y-2 pr-2">
                {polygons.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {language === 'fr'
                      ? 'Aucune zone tracée. Utilisez les outils ci-dessus.'
                      : 'No areas drawn. Use the tools above.'}
                  </p>
                )}

                {polygons.map((polygon, index) => {
                  const isConstraintPolygon = polygon.color === CONSTRAINT_COLOR || 
                    polygon.label?.toLowerCase().includes('constraint') ||
                    polygon.label?.toLowerCase().includes('contrainte');
                  
                  return (
                  <div
                    key={polygon.id}
                    className="p-3 rounded-lg border bg-card hover-elevate flex gap-2"
                    data-testid={`polygon-item-${index}`}
                  >
                    <div 
                      className={`w-1 rounded-full shrink-0 ${isConstraintPolygon ? 'bg-orange-500' : 'bg-blue-500'}`} 
                    />
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {editingLabelId === polygon.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={editingLabelValue}
                              onChange={(e) => setEditingLabelValue(e.target.value)}
                              placeholder={language === 'fr' ? 'Nom de la zone' : 'Area name'}
                              className="h-7 text-sm"
                              autoFocus
                              data-testid={`input-label-${index}`}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveLabel();
                                if (e.key === 'Escape') handleCancelEditLabel();
                              }}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={handleSaveLabel}
                              data-testid={`button-save-label-${index}`}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={handleCancelEditLabel}
                              data-testid={`button-cancel-label-${index}`}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">
                              {polygon.label || (language === 'fr' ? `Zone ${index + 1}` : `Area ${index + 1}`)}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => handleStartEditLabel(polygon)}
                              data-testid={`button-edit-label-${index}`}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-1" data-testid={`text-area-${index}`}>
                          {polygon.areaSqM.toFixed(1)} m²
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDeletePolygon(polygon.id)}
                        data-testid={`button-delete-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4 gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel">
            {language === 'fr' ? 'Annuler' : 'Cancel'}
          </Button>
          <Button
            onClick={handleSave}
            disabled={polygons.length === 0 || isSaving}
            data-testid="button-save"
          >
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {language === 'fr' ? 'Enregistrer' : 'Save'}
            {polygons.length > 0 && ` (${polygons.length})`}
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Sun, AlertTriangle, ZoomIn, ZoomOut, Eye, EyeOff, Info, Cpu, Grid3X3 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

interface SolarMockupData {
  success: boolean;
  siteId: string;
  siteName: string;
  satelliteImageUrl?: string;
  buildingCenter: { latitude: number; longitude: number };
  panels: Array<{
    center: { latitude: number; longitude: number };
    orientation: "LANDSCAPE" | "PORTRAIT";
    segmentIndex: number;
  }>;
  roofSegments: Array<{
    index: number;
    center?: { latitude: number; longitude: number };
    boundingBox?: {
      sw: { latitude: number; longitude: number };
      ne: { latitude: number; longitude: number };
    };
    areaMeters2: number;
    azimuthDegrees: number;
    pitchDegrees: number;
  }>;
  panelDimensions: {
    widthMeters: number;
    heightMeters: number;
  };
  imageryDate?: string;
  imageryQuality?: string;
  maxPanelsCount: number;
  roofAreaSqM?: number;
  error?: string;
}

interface SolarMockupProps {
  siteId: string;
  targetPanelCount?: number;
  systemSizeKW?: number;
  roofAreaSqM?: number;
}

// Panel dimensions in meters (590W commercial bifacial panel - IFC compliant)
const PANEL_WIDTH_M = 2.0;  // East-West dimension
const PANEL_HEIGHT_M = 1.0; // North-South dimension
const PANEL_SPACING_M = 0.1; // Gap between panels
const ROW_SPACING_M = 0.5;   // Additional spacing between rows (10° ballast systems)
const PANEL_WATT = 590;      // Modern commercial panel wattage

// Generate algorithmic panel positions in a grid pattern
function generateAlgorithmicPanels(
  centerLat: number,
  centerLng: number,
  roofAreaSqM: number,
  targetPanels: number,
  metersPerDegLat: number,
  metersPerDegLng: number
): Array<{ center: { latitude: number; longitude: number }; orientation: "LANDSCAPE" | "PORTRAIT" }> {
  const panels: Array<{ center: { latitude: number; longitude: number }; orientation: "LANDSCAPE" | "PORTRAIT" }> = [];
  
  // Calculate grid dimensions based on roof area
  // Assume square-ish roof for simplicity
  const roofSideM = Math.sqrt(roofAreaSqM);
  const usableRatio = 0.85; // 85% usable after 1.2m IFC perimeter setback
  const usableSideM = roofSideM * usableRatio;
  
  // Calculate how many panels fit (IFC-compliant spacing)
  const panelWithSpacing = PANEL_WIDTH_M + PANEL_SPACING_M; // 2.1m E-W cell
  const panelHeightWithSpacing = PANEL_HEIGHT_M + ROW_SPACING_M; // 1.5m N-S row pitch
  
  const cols = Math.floor(usableSideM / panelWithSpacing);
  const rows = Math.floor(usableSideM / panelHeightWithSpacing);
  
  // Start from top-left of the grid
  const startX = -((cols - 1) * panelWithSpacing) / 2;
  const startY = -((rows - 1) * panelHeightWithSpacing) / 2;
  
  let panelIndex = 0;
  for (let row = 0; row < rows && panelIndex < targetPanels; row++) {
    for (let col = 0; col < cols && panelIndex < targetPanels; col++) {
      const offsetX = startX + col * panelWithSpacing;
      const offsetY = startY + row * panelHeightWithSpacing;
      
      // Convert meters to degrees
      const dLat = offsetY / metersPerDegLat;
      const dLng = offsetX / metersPerDegLng;
      
      panels.push({
        center: {
          latitude: centerLat + dLat,
          longitude: centerLng + dLng
        },
        orientation: "PORTRAIT" as const
      });
      
      panelIndex++;
    }
  }
  
  return panels;
}

export function SolarMockup({ siteId, targetPanelCount, systemSizeKW, roofAreaSqM: propRoofArea }: SolarMockupProps) {
  const { language } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [panelCount, setPanelCount] = useState<number>(targetPanelCount || 0);
  const [zoom, setZoom] = useState<number>(1);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showConstraints, setShowConstraints] = useState(false);
  const [coveragePercent, setCoveragePercent] = useState(70);

  // Fetch mockup data
  const { data: mockupData, isLoading, error } = useQuery<SolarMockupData>({
    queryKey: [`/api/sites/${siteId}/solar-mockup`],
  });

  // Determine if we should use fallback mode
  // Fallback when: API success with <10 panels, OR API failure but we have roof area from props
  const useFallbackMode = useMemo(() => {
    // If we have propRoofArea and API failed or has insufficient panels, use fallback
    if (propRoofArea && propRoofArea > 0) {
      if (!mockupData?.success) return true;
      if (mockupData.panels.length < 10) return true;
    }
    // If API succeeded but has insufficient panels, use fallback
    if (mockupData?.success && mockupData.panels.length < 10) return true;
    return false;
  }, [mockupData, propRoofArea]);

  // Calculate available roof area for fallback mode
  const effectiveRoofArea = useMemo(() => {
    if (propRoofArea) return propRoofArea;
    if (mockupData?.roofAreaSqM) return mockupData.roofAreaSqM;
    // Sum from roof segments
    if (mockupData?.roofSegments?.length) {
      return mockupData.roofSegments.reduce((sum, seg) => sum + seg.areaMeters2, 0);
    }
    return 1000; // Default 1000 m² if nothing available
  }, [mockupData, propRoofArea]);

  // Calculate max panels for fallback mode (IFC-compliant spacing)
  const fallbackMaxPanels = useMemo(() => {
    // Effective panel footprint: (2.0 + 0.1) × (1.0 + 0.5) = 3.15 m² per panel
    const effectivePanelArea = (PANEL_WIDTH_M + PANEL_SPACING_M) * (PANEL_HEIGHT_M + ROW_SPACING_M);
    const usableArea = effectiveRoofArea * (coveragePercent / 100);
    return Math.floor(usableArea / effectivePanelArea);
  }, [effectiveRoofArea, coveragePercent]);

  // Calculate panel count from system size if provided
  useEffect(() => {
    // Initialize panel count when we have data (either from API or fallback mode)
    if (mockupData?.success || useFallbackMode) {
      const maxPanels = useFallbackMode ? fallbackMaxPanels : (mockupData?.maxPanelsCount || 0);
      
      if (targetPanelCount) {
        setPanelCount(Math.min(targetPanelCount, maxPanels));
      } else if (systemSizeKW) {
        const estimatedPanels = Math.round(systemSizeKW * 1000 / PANEL_WATT);
        setPanelCount(Math.min(estimatedPanels, maxPanels));
      } else {
        setPanelCount(Math.min(maxPanels, useFallbackMode ? 100 : (mockupData?.maxPanelsCount || 0)));
      }
    }
  }, [mockupData, targetPanelCount, systemSizeKW, useFallbackMode, fallbackMaxPanels]);

  // Draw the mockup on canvas
  useEffect(() => {
    if (!mockupData?.success || !mockupData.satelliteImageUrl || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      setImageLoaded(true);
      
      // Set canvas size
      const displayWidth = 640;
      const displayHeight = 640;
      canvas.width = displayWidth;
      canvas.height = displayHeight;

      // Clear and draw satellite image
      ctx.clearRect(0, 0, displayWidth, displayHeight);
      ctx.drawImage(img, 0, 0, displayWidth, displayHeight);

      // Calculate geo to pixel conversion
      // For zoom level 19, roughly 0.3 meters per pixel at equator
      // Adjusted for latitude
      const metersPerPixel = 0.3 / zoom;
      const lat = mockupData.buildingCenter.latitude;
      const latRadians = lat * Math.PI / 180;
      const metersPerDegLat = 111320;
      const metersPerDegLng = 111320 * Math.cos(latRadians);

      const centerX = displayWidth / 2;
      const centerY = displayHeight / 2;

      // Function to convert lat/lng to canvas coordinates
      const geoToCanvas = (geoLat: number, geoLng: number): { x: number; y: number } => {
        const dLat = geoLat - mockupData.buildingCenter.latitude;
        const dLng = geoLng - mockupData.buildingCenter.longitude;
        
        const dMetersY = dLat * metersPerDegLat;
        const dMetersX = dLng * metersPerDegLng;
        
        return {
          x: centerX + (dMetersX / metersPerPixel),
          y: centerY - (dMetersY / metersPerPixel) // Y is inverted
        };
      };

      // FIRST: Draw constraint areas (orange) - so panels appear on top
      if (showConstraints && !useFallbackMode) {
        ctx.fillStyle = 'rgba(249, 115, 22, 0.4)';
        ctx.strokeStyle = 'rgba(234, 88, 12, 0.7)';
        ctx.lineWidth = 1;

        mockupData.roofSegments.forEach(segment => {
          const isConstraint = 
            segment.pitchDegrees > 60 ||
            segment.areaMeters2 < 5;

          if (isConstraint && segment.boundingBox) {
            const sw = geoToCanvas(segment.boundingBox.sw.latitude, segment.boundingBox.sw.longitude);
            const ne = geoToCanvas(segment.boundingBox.ne.latitude, segment.boundingBox.ne.longitude);
            
            const width = Math.abs(ne.x - sw.x);
            const height = Math.abs(ne.y - sw.y);
            const x = Math.min(sw.x, ne.x);
            const y = Math.min(sw.y, ne.y);
            
            ctx.fillRect(x, y, width, height);
            ctx.strokeRect(x, y, width, height);
          }
        });
      }

      // Determine panels to draw
      let panelsToShow: Array<{ center: { latitude: number; longitude: number }; orientation: "LANDSCAPE" | "PORTRAIT" }>;
      
      if (useFallbackMode) {
        // Generate algorithmic panels - use full roof area for the grid, 
        // panelCount controls how many we actually show (up to max based on coverage)
        panelsToShow = generateAlgorithmicPanels(
          mockupData.buildingCenter.latitude,
          mockupData.buildingCenter.longitude,
          effectiveRoofArea, // Use full roof area for grid generation
          panelCount,         // Number of panels to actually draw (controlled by slider)
          metersPerDegLat,
          metersPerDegLng
        );
      } else {
        panelsToShow = mockupData.panels.slice(0, panelCount);
      }

      // Draw panels (blue with transparency)
      const panelWidth = (useFallbackMode ? PANEL_WIDTH_M : mockupData.panelDimensions.widthMeters) / metersPerPixel;
      const panelHeight = (useFallbackMode ? PANEL_HEIGHT_M : mockupData.panelDimensions.heightMeters) / metersPerPixel;

      // Different color for fallback mode (green-blue to distinguish)
      if (useFallbackMode) {
        ctx.fillStyle = 'rgba(20, 184, 166, 0.7)'; // Teal for estimated
        ctx.strokeStyle = 'rgba(13, 148, 136, 0.9)';
      } else {
        ctx.fillStyle = 'rgba(30, 64, 175, 0.7)'; // Blue for Google AI
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.9)';
      }
      ctx.lineWidth = 1;

      panelsToShow.forEach(panel => {
        const { x, y } = geoToCanvas(panel.center.latitude, panel.center.longitude);
        
        const w = panel.orientation === 'LANDSCAPE' ? panelHeight : panelWidth;
        const h = panel.orientation === 'LANDSCAPE' ? panelWidth : panelHeight;
        
        ctx.fillRect(x - w/2, y - h/2, w, h);
        ctx.strokeRect(x - w/2, y - h/2, w, h);
      });

      // Add legend
      const legendHeight = showConstraints && !useFallbackMode ? 50 : 30;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, displayHeight - legendHeight - 10, 200, legendHeight);
      
      ctx.font = '12px sans-serif';
      
      if (useFallbackMode) {
        ctx.fillStyle = 'rgba(20, 184, 166, 1)'; // Teal
        ctx.fillRect(20, displayHeight - legendHeight, 15, 15);
        ctx.fillStyle = 'white';
        ctx.fillText(language === 'fr' ? 'Panneaux (estimé)' : 'Panels (estimated)', 42, displayHeight - legendHeight + 11);
      } else {
        ctx.fillStyle = 'rgba(30, 64, 175, 1)'; // Blue
        ctx.fillRect(20, displayHeight - legendHeight, 15, 15);
        ctx.fillStyle = 'white';
        ctx.fillText(language === 'fr' ? 'Panneaux (Google AI)' : 'Panels (Google AI)', 42, displayHeight - legendHeight + 11);
      }
      
      if (showConstraints && !useFallbackMode) {
        ctx.fillStyle = 'rgba(249, 115, 22, 1)';
        ctx.fillRect(20, displayHeight - legendHeight + 20, 15, 15);
        ctx.fillStyle = 'white';
        ctx.fillText(language === 'fr' ? 'Contraintes' : 'Constraints', 42, displayHeight - legendHeight + 31);
      }
    };

    img.onerror = () => {
      console.error('Failed to load satellite image');
      setImageLoaded(false);
    };

    img.src = mockupData.satelliteImageUrl;
  }, [mockupData, panelCount, zoom, language, showConstraints, useFallbackMode, effectiveRoofArea, coveragePercent]);

  // Export function
  const handleExport = () => {
    if (!canvasRef.current) return;
    
    const link = document.createElement('a');
    link.download = `solar-mockup-${mockupData?.siteName || siteId}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="h-5 w-5" />
            {language === 'fr' ? 'Visualisation du système' : 'System Visualization'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  // Only show error state if we truly can't render anything
  // Don't show error if we have fallback mode available (propRoofArea exists)
  if ((error || !mockupData?.success) && !useFallbackMode) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="h-5 w-5" />
            {language === 'fr' ? 'Visualisation du système' : 'System Visualization'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertTriangle className="h-5 w-5" />
            <span>
              {language === 'fr' 
                ? 'Visualisation non disponible pour ce site' 
                : 'Visualization not available for this site'}
            </span>
          </div>
          {mockupData?.error && (
            <p className="text-sm text-muted-foreground mt-2">{mockupData.error}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  const maxPanels = useFallbackMode ? fallbackMaxPanels : (mockupData?.maxPanelsCount || 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <Sun className="h-5 w-5" />
            {language === 'fr' ? 'Visualisation du système' : 'System Visualization'}
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Mode indicator badge */}
            {useFallbackMode ? (
              <Badge variant="secondary" className="gap-1">
                <Grid3X3 className="h-3 w-3" />
                {language === 'fr' ? 'Disposition estimée' : 'Estimated Layout'}
              </Badge>
            ) : (
              <Badge variant="default" className="gap-1">
                <Cpu className="h-3 w-3" />
                {language === 'fr' ? 'Google AI' : 'Google AI'}
              </Badge>
            )}
            {mockupData?.imageryDate && (
              <Badge variant="outline">
                {mockupData.imageryDate}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-[200px]">
            <span className="text-sm font-medium whitespace-nowrap">
              {language === 'fr' ? 'Panneaux:' : 'Panels:'} {panelCount}
            </span>
            <Slider
              data-testid="slider-panel-count"
              value={[panelCount]}
              onValueChange={([value]) => setPanelCount(value)}
              max={maxPanels}
              min={0}
              step={1}
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground">
              / {maxPanels}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {!useFallbackMode && (
              <Button
                size="sm"
                variant={showConstraints ? "default" : "outline"}
                onClick={() => setShowConstraints(!showConstraints)}
                data-testid="button-toggle-constraints"
              >
                {showConstraints ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                {language === 'fr' ? 'Contraintes' : 'Constraints'}
              </Button>
            )}
            <Button
              size="icon"
              variant="outline"
              onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
              data-testid="button-zoom-out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setZoom(Math.min(2, zoom + 0.25))}
              data-testid="button-zoom-in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Coverage slider for fallback mode */}
        {useFallbackMode && (
          <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium whitespace-nowrap">
              {language === 'fr' ? 'Couverture toit:' : 'Roof coverage:'} {coveragePercent}%
            </span>
            <Slider
              data-testid="slider-coverage"
              value={[coveragePercent]}
              onValueChange={([value]) => setCoveragePercent(value)}
              max={90}
              min={30}
              step={5}
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground">
              ({Math.round(effectiveRoofArea * coveragePercent / 100)} m²)
            </span>
          </div>
        )}

        {/* Info message for fallback mode */}
        {useFallbackMode && (
          <div className="flex items-start gap-2 p-3 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-md text-sm">
            <Info className="h-4 w-4 text-teal-600 dark:text-teal-400 mt-0.5 shrink-0" />
            <span className="text-teal-800 dark:text-teal-200">
              {language === 'fr' 
                ? `Mode estimation: Google Solar API n'a pas de données de panneaux pour ce bâtiment. Disposition générée algorithmiquement basée sur ${Math.round(effectiveRoofArea)} m² de surface de toit.` 
                : `Estimation mode: Google Solar API has no panel data for this building. Layout generated algorithmically based on ${Math.round(effectiveRoofArea)} m² roof area.`}
            </span>
          </div>
        )}

        {/* Warning for limited Google data (but not in fallback mode) */}
        {!useFallbackMode && mockupData && mockupData.maxPanelsCount < 50 && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md text-sm">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <span className="text-amber-800 dark:text-amber-200">
              {language === 'fr' 
                ? `Google Solar API a des données limitées pour ce bâtiment (${mockupData.maxPanelsCount} panneaux max).` 
                : `Google Solar API has limited data for this building (${mockupData.maxPanelsCount} panels max).`}
            </span>
          </div>
        )}

        <div className="relative border rounded-lg overflow-hidden bg-muted">
          <canvas
            ref={canvasRef}
            className="w-full max-w-[640px] mx-auto block"
            style={{ aspectRatio: '1/1' }}
            data-testid="canvas-solar-mockup"
          />
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Skeleton className="h-full w-full" />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm text-muted-foreground">
            {language === 'fr' ? 'Capacité estimée: ' : 'Estimated capacity: '}
            <span className="font-medium">
              {((panelCount * PANEL_WATT) / 1000).toFixed(1)} kW
            </span>
            {' '}({panelCount} × {PANEL_WATT}W)
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={!imageLoaded}
            data-testid="button-export-mockup"
          >
            <Download className="h-4 w-4 mr-2" />
            {language === 'fr' ? 'Exporter PNG' : 'Export PNG'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

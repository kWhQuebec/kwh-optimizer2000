import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Sun, AlertTriangle, ZoomIn, ZoomOut } from 'lucide-react';
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
  error?: string;
}

interface SolarMockupProps {
  siteId: string;
  targetPanelCount?: number;
  systemSizeKW?: number;
}

export function SolarMockup({ siteId, targetPanelCount, systemSizeKW }: SolarMockupProps) {
  const { language } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [panelCount, setPanelCount] = useState<number>(targetPanelCount || 0);
  const [zoom, setZoom] = useState<number>(1);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Fetch mockup data
  const { data: mockupData, isLoading, error } = useQuery<SolarMockupData>({
    queryKey: [`/api/sites/${siteId}/solar-mockup`],
  });

  // Calculate panel count from system size if provided
  useEffect(() => {
    if (mockupData?.success) {
      if (targetPanelCount) {
        setPanelCount(Math.min(targetPanelCount, mockupData.maxPanelsCount));
      } else if (systemSizeKW) {
        // Assume ~400W panels
        const estimatedPanels = Math.round(systemSizeKW * 1000 / 400);
        setPanelCount(Math.min(estimatedPanels, mockupData.maxPanelsCount));
      } else {
        setPanelCount(mockupData.maxPanelsCount);
      }
    }
  }, [mockupData, targetPanelCount, systemSizeKW]);

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

      // Draw panels (blue with transparency)
      const panelsToShow = mockupData.panels.slice(0, panelCount);
      const panelWidth = mockupData.panelDimensions.widthMeters / metersPerPixel;
      const panelHeight = mockupData.panelDimensions.heightMeters / metersPerPixel;

      ctx.fillStyle = 'rgba(30, 64, 175, 0.7)'; // Blue with transparency
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.9)';
      ctx.lineWidth = 1;

      panelsToShow.forEach(panel => {
        const { x, y } = geoToCanvas(panel.center.latitude, panel.center.longitude);
        
        const w = panel.orientation === 'LANDSCAPE' ? panelHeight : panelWidth;
        const h = panel.orientation === 'LANDSCAPE' ? panelWidth : panelHeight;
        
        ctx.fillRect(x - w/2, y - h/2, w, h);
        ctx.strokeRect(x - w/2, y - h/2, w, h);
      });

      // Draw constraint areas (orange) - unused roof segments
      // Only show segments that are NOT south-facing (azimuth not between 135-225)
      ctx.fillStyle = 'rgba(249, 115, 22, 0.5)'; // Orange with transparency
      ctx.strokeStyle = 'rgba(234, 88, 12, 0.8)';
      ctx.lineWidth = 2;

      mockupData.roofSegments.forEach(segment => {
        // Mark as constraint if:
        // - Too steep (> 45 degrees)
        // - North-facing (azimuth < 90 or > 270)
        // - Very small area (< 10 m²)
        const isConstraint = 
          segment.pitchDegrees > 45 ||
          segment.azimuthDegrees < 90 ||
          segment.azimuthDegrees > 270 ||
          segment.areaMeters2 < 10;

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

      // Add legend
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, displayHeight - 60, 180, 50);
      
      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(30, 64, 175, 1)';
      ctx.fillRect(20, displayHeight - 50, 15, 15);
      ctx.fillStyle = 'white';
      ctx.fillText(language === 'fr' ? 'Panneaux solaires' : 'Solar panels', 42, displayHeight - 39);
      
      ctx.fillStyle = 'rgba(249, 115, 22, 1)';
      ctx.fillRect(20, displayHeight - 30, 15, 15);
      ctx.fillStyle = 'white';
      ctx.fillText(language === 'fr' ? 'Contraintes' : 'Constraints', 42, displayHeight - 19);
    };

    img.onerror = () => {
      console.error('Failed to load satellite image');
      setImageLoaded(false);
    };

    img.src = mockupData.satelliteImageUrl;
  }, [mockupData, panelCount, zoom, language]);

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

  if (error || !mockupData?.success) {
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <Sun className="h-5 w-5" />
            {language === 'fr' ? 'Visualisation du système' : 'System Visualization'}
          </CardTitle>
          <div className="flex items-center gap-2">
            {mockupData.imageryQuality && (
              <Badge variant="outline">
                {mockupData.imageryQuality}
              </Badge>
            )}
            {mockupData.imageryDate && (
              <Badge variant="secondary">
                {language === 'fr' ? 'Image: ' : 'Imagery: '}{mockupData.imageryDate}
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
              max={mockupData.maxPanelsCount}
              min={0}
              step={1}
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground">
              / {mockupData.maxPanelsCount}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
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
              {((panelCount * 400) / 1000).toFixed(1)} kW
            </span>
            {' '}({panelCount} × 400W)
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

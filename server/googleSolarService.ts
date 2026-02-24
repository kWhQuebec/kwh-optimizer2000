import type { IStorage } from "./storage";
import { createLogger } from "./lib/logger";
import { detectRoofConstraints } from "./roofConstraintDetector";

const log = createLogger("GoogleSolar");

function getGoogleSolarApiKey(): string | undefined {
  return process.env.GOOGLE_SOLAR_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
}

const GOOGLE_SOLAR_API_BASE = "https://solar.googleapis.com/v1";
const GOOGLE_GEOCODING_API_BASE = "https://maps.googleapis.com/maps/api/geocode/json";

// Timeout for Google API calls (15 seconds)
const API_TIMEOUT_MS = 15000;

// Round coordinates to 5 decimal places (~1m precision)
function roundCoord(val: number): number {
  return Math.round(val * 100000) / 100000;
}

// Helper function to fetch with timeout
async function fetchWithTimeout(
  url: string, 
  timeoutMs: number = API_TIMEOUT_MS,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { 
      ...init,
      signal: controller.signal 
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`API request timed out after ${timeoutMs / 1000} seconds`);
    }
    throw error;
  }
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

export interface RoofSegment {
  stats: {
    areaMeters2: number;
    sunshineQuantiles?: number[];
    groundAreaMeters2?: number;
  };
  center?: {
    latitude: number;
    longitude: number;
  };
  boundingBox?: {
    sw: { latitude: number; longitude: number };
    ne: { latitude: number; longitude: number };
  };
  planeHeightAtCenterMeters?: number;
  azimuthDegrees?: number;
  pitchDegrees?: number;
}

export interface SolarPanel {
  center: {
    latitude: number;
    longitude: number;
  };
  orientation: "LANDSCAPE" | "PORTRAIT";
  yearlyEnergyDcKwh: number;
  segmentIndex: number;
}

export interface SolarPotential {
  maxArrayPanelsCount: number;
  maxArrayAreaMeters2: number;
  maxSunshineHoursPerYear: number;
  carbonOffsetFactorKgPerMwh?: number;
  wholeRoofStats?: {
    areaMeters2: number;
    sunshineQuantiles?: number[];
    groundAreaMeters2?: number;
  };
  roofSegmentStats?: RoofSegment[];
  solarPanelConfigs?: Array<{
    panelsCount: number;
    yearlyEnergyDcKwh: number;
    roofSegmentSummaries?: Array<{
      pitchDegrees: number;
      azimuthDegrees: number;
      panelsCount: number;
      yearlyEnergyDcKwh: number;
      segmentIndex: number;
    }>;
  }>;
  solarPanels?: SolarPanel[];
  panelCapacityWatts?: number;
  panelHeightMeters?: number;
  panelWidthMeters?: number;
  panelLifetimeYears?: number;
}

export interface BuildingInsights {
  name?: string;
  center: GeoLocation;
  imageryDate?: {
    year: number;
    month: number;
    day: number;
  };
  imageryProcessedDate?: {
    year: number;
    month: number;
    day: number;
  };
  postalCode?: string;
  administrativeArea?: string;
  statisticalArea?: string;
  regionCode?: string;
  solarPotential?: SolarPotential;
  imageryQuality?: string;
}

export interface RoofSegmentDetail {
  index: number;
  areaMeters2: number;
  azimuthDegrees: number;
  pitchDegrees: number;
  orientationLabel: string;
  sunshineHoursPerYear?: number;
}

export interface GoogleProductionEstimate {
  panelsCount: number;
  yearlyEnergyDcKwh: number;
  yearlyEnergyAcKwh: number;
  systemSizeKw: number;
}

export interface RoofEstimateResult {
  success: boolean;
  latitude: number;
  longitude: number;
  roofAreaSqM: number;
  maxArrayAreaSqM: number;
  maxSunshineHoursPerYear?: number;
  imageryDate?: string;
  imageryQuality?: string;
  roofSegmentsCount: number;
  roofSegments: RoofSegmentDetail[];
  googleProductionEstimate?: GoogleProductionEstimate;
  panelCapacityWatts?: number;
  carbonOffsetFactorKgPerMwh?: number;
  details: BuildingInsights;
  error?: string;
}

export async function geocodeAddress(address: string): Promise<GeoLocation | null> {
  if (!getGoogleSolarApiKey()) {
    log.error("GOOGLE_SOLAR_API_KEY not configured");
    return null;
  }

  try {
    log.info(`Starting geocode for address: ${address}`);
    const encodedAddress = encodeURIComponent(address);
    const url = `${GOOGLE_GEOCODING_API_BASE}?address=${encodedAddress}&key=${getGoogleSolarApiKey()}`;
    
    const response = await fetchWithTimeout(url);
    const data = await response.json();
    
    if (data.status === "OK" && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      log.info(`Success: lat=${location.lat}, lng=${location.lng}`);
      return {
        latitude: location.lat,
        longitude: location.lng
      };
    }
    
    log.error("Failed:", data.status, data.error_message);
    return null;
  } catch (error) {
    log.error("Error:", error instanceof Error ? error.message : error);
    return null;
  }
}

export async function getBuildingInsights(location: GeoLocation, storage?: IStorage): Promise<BuildingInsights | null> {
  if (!getGoogleSolarApiKey()) {
    log.error("GOOGLE_SOLAR_API_KEY not configured");
    return null;
  }

  const roundedLat = roundCoord(location.latitude);
  const roundedLng = roundCoord(location.longitude);

  try {
    // Check cache first if storage is provided
    if (storage) {
      try {
        const cached = await storage.getGoogleSolarCacheByLocation(roundedLat, roundedLng);
        if (cached) {
          const now = new Date();
          if (cached.expiresAt && new Date(cached.expiresAt) > now) {
            // Cache hit and not expired
            log.info(`Cache HIT for lat=${roundedLat}, lng=${roundedLng}, hit count: ${(cached.hitCount || 0) + 1}`);
            
            // Increment hit count asynchronously (don't await to avoid blocking response)
            storage.incrementCacheHitCount(cached.id).catch(err =>
              log.error("Failed to increment hit count:", err)
            );
            
            return cached.buildingInsights as BuildingInsights;
          } else {
            log.info(`Cache EXPIRED for lat=${roundedLat}, lng=${roundedLng}`);
          }
        } else {
          log.info(`Cache MISS for lat=${roundedLat}, lng=${roundedLng}`);
        }
      } catch (cacheError) {
        log.error("Cache read error (will try API):", cacheError instanceof Error ? cacheError.message : cacheError);
        // Continue with API call if cache fails
      }
    }

    // Call Google Solar API
    log.info(`Starting API request for lat=${location.latitude}, lng=${location.longitude}`);
    const url = `${GOOGLE_SOLAR_API_BASE}/buildingInsights:findClosest?location.latitude=${location.latitude}&location.longitude=${location.longitude}&requiredQuality=HIGH&key=${getGoogleSolarApiKey()}`;
    
    const response = await fetchWithTimeout(url);
    
    let buildingInsights: BuildingInsights | null = null;
    
    if (!response.ok) {
      const errorText = await response.text();
      log.error("Solar API error:", response.status, errorText);
      
      if (response.status === 404) {
        log.info("Trying MEDIUM quality...");
        const mediumQualityUrl = `${GOOGLE_SOLAR_API_BASE}/buildingInsights:findClosest?location.latitude=${location.latitude}&location.longitude=${location.longitude}&requiredQuality=MEDIUM&key=${getGoogleSolarApiKey()}`;
        const mediumResponse = await fetchWithTimeout(mediumQualityUrl);
        
        if (mediumResponse.ok) {
          log.info("MEDIUM quality success");
          buildingInsights = await mediumResponse.json();
        }
      }
      
      if (!buildingInsights) {
        return null;
      }
    } else {
      log.info("HIGH quality success");
      buildingInsights = await response.json();
    }

    // Extract summary data for the cache
    const solarPotential = buildingInsights?.solarPotential;
    let roofAreaSqM: number | undefined;
    let maxPanelCount: number | undefined;
    let maxSystemSizeKw: number | undefined;
    let yearlyEnergyDcKwh: number | undefined;

    if (solarPotential) {
      roofAreaSqM = solarPotential.wholeRoofStats?.areaMeters2;
      maxPanelCount = solarPotential.maxArrayPanelsCount;
      
      if (solarPotential.solarPanelConfigs && solarPotential.solarPanelConfigs.length > 0) {
        const bestConfig = solarPotential.solarPanelConfigs[solarPotential.solarPanelConfigs.length - 1];
        yearlyEnergyDcKwh = bestConfig.yearlyEnergyDcKwh;
        
        const panelWatts = solarPotential.panelCapacityWatts || 400;
        maxSystemSizeKw = (maxPanelCount * panelWatts) / 1000;
      }
    }

    // Format imagery date
    let imageryDate: string | undefined;
    if (buildingInsights?.imageryDate) {
      const { year, month, day } = buildingInsights.imageryDate;
      imageryDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    // Store in cache if storage is provided
    if (storage && buildingInsights) {
      try {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 90); // 90-day expiry

        await storage.setGoogleSolarCache({
          latitude: roundedLat,
          longitude: roundedLng,
          buildingInsights: buildingInsights as any,
          roofAreaSqM,
          maxArrayAreaSqM: solarPotential?.maxArrayAreaMeters2,
          maxPanelCount,
          maxSystemSizeKw,
          yearlyEnergyDcKwh,
          imageryQuality: buildingInsights.imageryQuality,
          imageryDate,
          expiresAt,
          hitCount: 1,
        });

        log.info(`Cached result for lat=${roundedLat}, lng=${roundedLng}`);
      } catch (cacheError) {
        log.error("Cache write error (API result still returned):", cacheError instanceof Error ? cacheError.message : cacheError);
        // Continue - we still have the API result
      }
    }

    return buildingInsights;
  } catch (error) {
    log.error("Error:", error instanceof Error ? error.message : error);
    return null;
  }
}

function getOrientationLabel(azimuth: number): string {
  if (azimuth >= 337.5 || azimuth < 22.5) return "N";
  if (azimuth >= 22.5 && azimuth < 67.5) return "NE";
  if (azimuth >= 67.5 && azimuth < 112.5) return "E";
  if (azimuth >= 112.5 && azimuth < 157.5) return "SE";
  if (azimuth >= 157.5 && azimuth < 202.5) return "S";
  if (azimuth >= 202.5 && azimuth < 247.5) return "SW";
  if (azimuth >= 247.5 && azimuth < 292.5) return "W";
  if (azimuth >= 292.5 && azimuth < 337.5) return "NW";
  return "?";
}

export async function estimateRoofFromAddress(address: string, storage?: IStorage): Promise<RoofEstimateResult> {
  const location = await geocodeAddress(address);
  
  if (!location) {
    return {
      success: false,
      latitude: 0,
      longitude: 0,
      roofAreaSqM: 0,
      maxArrayAreaSqM: 0,
      roofSegmentsCount: 0,
      roofSegments: [],
      details: {} as BuildingInsights,
      error: "Could not geocode address"
    };
  }
  
  return estimateRoofFromLocation(location, storage);
}

export async function estimateRoofFromLocation(location: GeoLocation, storage?: IStorage): Promise<RoofEstimateResult> {
  const insights = await getBuildingInsights(location, storage);
  
  if (!insights) {
    return {
      success: false,
      latitude: location.latitude,
      longitude: location.longitude,
      roofAreaSqM: 0,
      maxArrayAreaSqM: 0,
      roofSegmentsCount: 0,
      roofSegments: [],
      details: {} as BuildingInsights,
      error: "No building data available for this location"
    };
  }
  
  const solarPotential = insights.solarPotential;
  
  let totalRoofAreaSqM = 0;
  let roofSegmentsCount = 0;
  const roofSegments: RoofSegmentDetail[] = [];
  
  if (solarPotential?.wholeRoofStats?.areaMeters2) {
    totalRoofAreaSqM = solarPotential.wholeRoofStats.areaMeters2;
  }
  
  if (solarPotential?.roofSegmentStats) {
    roofSegmentsCount = solarPotential.roofSegmentStats.length;
    if (totalRoofAreaSqM === 0) {
      totalRoofAreaSqM = solarPotential.roofSegmentStats.reduce(
        (sum, seg) => sum + (seg.stats?.areaMeters2 || 0),
        0
      );
    }
    
    solarPotential.roofSegmentStats.forEach((seg, index) => {
      const azimuth = seg.azimuthDegrees || 0;
      const sunshineQuantiles = seg.stats?.sunshineQuantiles;
      const avgSunshine = sunshineQuantiles && sunshineQuantiles.length > 0
        ? sunshineQuantiles.reduce((a, b) => a + b, 0) / sunshineQuantiles.length
        : undefined;
      
      roofSegments.push({
        index,
        areaMeters2: seg.stats?.areaMeters2 || 0,
        azimuthDegrees: azimuth,
        pitchDegrees: seg.pitchDegrees || 0,
        orientationLabel: getOrientationLabel(azimuth),
        sunshineHoursPerYear: avgSunshine
      });
    });
  }
  
  const maxArrayAreaSqM = solarPotential?.maxArrayAreaMeters2 || 0;
  
  let imageryDate: string | undefined;
  if (insights.imageryDate) {
    const { year, month, day } = insights.imageryDate;
    imageryDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  
  let googleProductionEstimate: GoogleProductionEstimate | undefined;
  if (solarPotential?.solarPanelConfigs && solarPotential.solarPanelConfigs.length > 0) {
    const bestConfig = solarPotential.solarPanelConfigs[solarPotential.solarPanelConfigs.length - 1];
    const panelWatts = solarPotential.panelCapacityWatts || 400;
    const systemSizeKw = (bestConfig.panelsCount * panelWatts) / 1000;
    const yearlyEnergyAcKwh = bestConfig.yearlyEnergyDcKwh * 0.85;
    
    googleProductionEstimate = {
      panelsCount: bestConfig.panelsCount,
      yearlyEnergyDcKwh: bestConfig.yearlyEnergyDcKwh,
      yearlyEnergyAcKwh: Math.round(yearlyEnergyAcKwh),
      systemSizeKw: Math.round(systemSizeKw * 10) / 10
    };
  }
  
  return {
    success: true,
    latitude: location.latitude,
    longitude: location.longitude,
    roofAreaSqM: totalRoofAreaSqM,
    maxArrayAreaSqM,
    maxSunshineHoursPerYear: solarPotential?.maxSunshineHoursPerYear,
    imageryDate,
    imageryQuality: insights.imageryQuality,
    roofSegmentsCount,
    roofSegments,
    googleProductionEstimate,
    panelCapacityWatts: solarPotential?.panelCapacityWatts,
    carbonOffsetFactorKgPerMwh: solarPotential?.carbonOffsetFactorKgPerMwh,
    details: insights
  };
}

export function isGoogleSolarConfigured(): boolean {
  return !!getGoogleSolarApiKey();
}

/**
 * Generate a Google Maps Static API URL for satellite imagery of a location
 * This provides a simple satellite image that can be directly displayed in the browser
 */
export function getSatelliteImageUrl(location: GeoLocation, options?: {
  width?: number;
  height?: number;
  zoom?: number;
}): string | null {
  if (!getGoogleSolarApiKey()) {
    return null;
  }
  
  const width = options?.width || 400;
  const height = options?.height || 300;
  const zoom = options?.zoom || 18; // Zoom 18 for good roof detail
  
  return `https://maps.googleapis.com/maps/api/staticmap?center=${location.latitude},${location.longitude}&zoom=${zoom}&size=${width}x${height}&maptype=satellite&key=${getGoogleSolarApiKey()}`;
}

/**
 * Generate satellite image URL with roof polygons drawn on it for PDF reports
 * Uses Google Static Maps API with path parameters to overlay polygon shapes
 */
export function getRoofVisualizationUrl(
  location: GeoLocation,
  roofPolygons: Array<{ coordinates: [number, number][]; color: string; label?: string }>,
  options?: {
    width?: number;
    height?: number;
    zoom?: number;
    skipPolygons?: boolean;
  }
): string | null {
  const apiKey = getGoogleSolarApiKey();
  if (!apiKey) {
    log.warn("getRoofVisualizationUrl: No Google API key configured");
    return null;
  }
  
  const width = options?.width || 800;
  const height = options?.height || 600;
  const zoom = options?.zoom || 18;
  
  const MAX_URL_LENGTH = 8192;
  
  let baseUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${location.latitude},${location.longitude}&zoom=${zoom}&size=${width}x${height}&scale=2&maptype=satellite`;
  
  let polygonParams = "";
  
  if (!options?.skipPolygons) {
    roofPolygons.forEach((polygon) => {
      if (!polygon.coordinates || polygon.coordinates.length < 3) return;
      
      const isConstraint = polygon.color === "#f97316" ||
        (polygon.label?.toLowerCase().includes("constraint") ||
         polygon.label?.toLowerCase().includes("contrainte") ||
         polygon.label?.toLowerCase().includes("hvac") ||
         polygon.label?.toLowerCase().includes("obstacle"));
      
      const fillColor = isConstraint ? "0xf9731680" : "0x0054A880";
      const strokeColor = isConstraint ? "0xf97316" : "0x0054A8";
      const strokeWeight = isConstraint ? 2 : 3;
      
      const pathCoords = polygon.coordinates
        .map(([lng, lat]) => `${lat},${lng}`)
        .join("|");
      
      polygonParams += `&path=fillcolor:${fillColor}|color:${strokeColor}|weight:${strokeWeight}|${pathCoords}`;
    });
  }
  
  let url = baseUrl + polygonParams + `&key=${apiKey}`;
  
  if (url.length > MAX_URL_LENGTH && polygonParams.length > 0) {
    log.warn(`Static Maps URL too long (${url.length} chars > ${MAX_URL_LENGTH}), dropping polygon overlays`);
    url = baseUrl + `&key=${apiKey}`;
  }
  
  log.info(`getRoofVisualizationUrl: Generated URL (${url.length} chars, ${roofPolygons.length} polygons, skipPolygons=${!!options?.skipPolygons})`);
  
  return url;
}

/**
 * Generate satellite image URL from an address
 */
export async function getSatelliteImageFromAddress(address: string, options?: {
  width?: number;
  height?: number;
  zoom?: number;
}): Promise<{ success: boolean; imageUrl?: string; latitude?: number; longitude?: number; error?: string }> {
  const location = await geocodeAddress(address);
  
  if (!location) {
    return {
      success: false,
      error: "Could not geocode address"
    };
  }
  
  const imageUrl = getSatelliteImageUrl(location, options);
  
  if (!imageUrl) {
    return {
      success: false,
      error: "API key not configured"
    };
  }
  
  return {
    success: true,
    imageUrl,
    latitude: location.latitude,
    longitude: location.longitude
  };
}

export interface DataLayersResult {
  success: boolean;
  rgbUrl?: string;
  maskUrl?: string;
  dsmUrl?: string;
  annualFluxUrl?: string;
  imageryDate?: string;
  imageryQuality?: string;
  imageryProcessedDate?: string;
  error?: string;
}

export async function getDataLayers(location: GeoLocation, radiusMeters: number = 50): Promise<DataLayersResult> {
  if (!getGoogleSolarApiKey()) {
    return {
      success: false,
      error: "GOOGLE_SOLAR_API_KEY not configured"
    };
  }

  try {
    const params = new URLSearchParams({
      "location.latitude": location.latitude.toFixed(6),
      "location.longitude": location.longitude.toFixed(6),
      "radiusMeters": radiusMeters.toString(),
      "view": "IMAGERY_AND_ANNUAL_FLUX_LAYERS",
      "requiredQuality": "HIGH",
      "key": getGoogleSolarApiKey() || ""
    });

    const url = `${GOOGLE_SOLAR_API_BASE}/dataLayers:get?${params}`;
    log.info(`DataLayers starting request for lat=${location.latitude}, lng=${location.longitude}`);
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      const errorText = await response.text();
      log.error("DataLayers Solar API error:", response.status, errorText);
      
      if (response.status === 404) {
        log.info("DataLayers trying MEDIUM quality...");
        const mediumParams = new URLSearchParams({
          "location.latitude": location.latitude.toFixed(6),
          "location.longitude": location.longitude.toFixed(6),
          "radiusMeters": radiusMeters.toString(),
          "view": "IMAGERY_AND_ANNUAL_FLUX_LAYERS",
          "requiredQuality": "MEDIUM",
          "key": getGoogleSolarApiKey() || ""
        });
        const mediumUrl = `${GOOGLE_SOLAR_API_BASE}/dataLayers:get?${mediumParams}`;
        const mediumResponse = await fetchWithTimeout(mediumUrl);
        
        if (mediumResponse.ok) {
          const data = await mediumResponse.json();
          return formatDataLayersResponse(data);
        }
      }
      
      return {
        success: false,
        error: `API error: ${response.status}`
      };
    }

    const data = await response.json();
    return formatDataLayersResponse(data);
  } catch (error) {
    log.error("DataLayers error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

function formatDataLayersResponse(data: any): DataLayersResult {
  let imageryDate: string | undefined;
  if (data.imageryDate) {
    const { year, month, day } = data.imageryDate;
    imageryDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  
  let imageryProcessedDate: string | undefined;
  if (data.imageryProcessedDate) {
    const { year, month, day } = data.imageryProcessedDate;
    imageryProcessedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  
  return {
    success: true,
    rgbUrl: data.rgbUrl,
    maskUrl: data.maskUrl,
    dsmUrl: data.dsmUrl,
    annualFluxUrl: data.annualFluxUrl,
    imageryDate,
    imageryQuality: data.imageryQuality,
    imageryProcessedDate
  };
}

export async function getRoofImagery(address: string): Promise<DataLayersResult> {
  const location = await geocodeAddress(address);
  
  if (!location) {
    return {
      success: false,
      error: "Could not geocode address"
    };
  }
  
  return getDataLayers(location);
}

// Solar Mockup Generation
export interface SolarMockupData {
  success: boolean;
  satelliteImageUrl?: string;
  buildingCenter: GeoLocation;
  boundingBox?: {
    sw: { latitude: number; longitude: number };
    ne: { latitude: number; longitude: number };
  };
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

export async function getSolarMockupData(location: GeoLocation, panelCount?: number): Promise<SolarMockupData> {
  if (!getGoogleSolarApiKey()) {
    return {
      success: false,
      buildingCenter: location,
      panels: [],
      roofSegments: [],
      panelDimensions: { widthMeters: 1.0, heightMeters: 1.65 },
      maxPanelsCount: 0,
      error: "GOOGLE_SOLAR_API_KEY not configured"
    };
  }

  try {
    log.info(`SolarMockup fetching data for lat=${location.latitude}, lng=${location.longitude}`);
    
    // Get building insights with full panel data
    const insights = await getBuildingInsights(location);
    
    if (!insights || !insights.solarPotential) {
      return {
        success: false,
        buildingCenter: location,
        panels: [],
        roofSegments: [],
        panelDimensions: { widthMeters: 1.0, heightMeters: 1.65 },
        maxPanelsCount: 0,
        error: "No solar data available for this location"
      };
    }

    const solarPotential = insights.solarPotential;
    
    // Panel dimensions from API or defaults
    const panelDimensions = {
      widthMeters: solarPotential.panelWidthMeters || 1.0,
      heightMeters: solarPotential.panelHeightMeters || 1.65
    };
    
    // Extract individual panel positions
    const allPanels = solarPotential.solarPanels || [];
    
    // If panelCount is specified, only return that many panels (sorted by energy production)
    const targetPanels = panelCount 
      ? allPanels
          .sort((a, b) => b.yearlyEnergyDcKwh - a.yearlyEnergyDcKwh)
          .slice(0, panelCount)
      : allPanels;
    
    // Extract roof segments with boundaries
    const roofSegments = (solarPotential.roofSegmentStats || []).map((seg, index) => ({
      index,
      center: seg.center,
      boundingBox: seg.boundingBox,
      areaMeters2: seg.stats?.areaMeters2 || 0,
      azimuthDegrees: seg.azimuthDegrees || 0,
      pitchDegrees: seg.pitchDegrees || 0
    }));
    
    // Generate satellite image URL
    const satelliteImageUrl = getSatelliteImageUrl(location, {
      width: 640,
      height: 640,
      zoom: 19 // Higher zoom for better detail
    });
    
    // Format imagery date
    let imageryDate: string | undefined;
    if (insights.imageryDate) {
      const { year, month, day } = insights.imageryDate;
      imageryDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    // Calculate total roof area from segments
    const totalRoofAreaSqM = roofSegments.reduce((sum, seg) => sum + seg.areaMeters2, 0);

    return {
      success: true,
      satelliteImageUrl: satelliteImageUrl || undefined,
      buildingCenter: insights.center,
      panels: targetPanels.map(p => ({
        center: p.center,
        orientation: p.orientation,
        segmentIndex: p.segmentIndex
      })),
      roofSegments,
      panelDimensions,
      imageryDate,
      imageryQuality: insights.imageryQuality,
      maxPanelsCount: solarPotential.maxArrayPanelsCount || 0,
      roofAreaSqM: totalRoofAreaSqM > 0 ? totalRoofAreaSqM : undefined
    };
  } catch (error) {
    log.error("SolarMockup error:", error);
    return {
      success: false,
      buildingCenter: location,
      panels: [],
      roofSegments: [],
      panelDimensions: { widthMeters: 1.0, heightMeters: 1.65 },
      maxPanelsCount: 0,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

// Roof color detection types
export interface RoofColorResult {
  success: boolean;
  colorType: "white_membrane" | "light" | "dark" | "gravel" | "unknown";
  confidence: number; // 0-1
  averageBrightness: number; // 0-255
  suggestBifacial: boolean;
  error?: string;
}

// Analyze roof color from RGB imagery URL
// Returns color classification based on average brightness of roof pixels
export async function analyzeRoofColor(location: GeoLocation): Promise<RoofColorResult> {
  if (!getGoogleSolarApiKey()) {
    return {
      success: false,
      colorType: "unknown",
      confidence: 0,
      averageBrightness: 0,
      suggestBifacial: false,
      error: "GOOGLE_SOLAR_API_KEY not configured"
    };
  }

  try {
    // Get data layers to get the RGB and mask URLs
    const dataLayers = await getDataLayers(location, 50);
    
    if (!dataLayers.success || !dataLayers.rgbUrl) {
      return {
        success: false,
        colorType: "unknown",
        confidence: 0,
        averageBrightness: 0,
        suggestBifacial: false,
        error: dataLayers.error || "No RGB imagery available"
      };
    }

    // Fetch the RGB imagery (GeoTIFF format)
    // Add API key to the URL if not already present
    const rgbUrlWithKey = dataLayers.rgbUrl.includes('key=') 
      ? dataLayers.rgbUrl 
      : `${dataLayers.rgbUrl}&key=${getGoogleSolarApiKey()}`;
    
    log.info("RoofColor fetching RGB imagery...");
    const response = await fetchWithTimeout(rgbUrlWithKey, 30000); // 30s for image download
    
    if (!response.ok) {
      log.error("RoofColor failed to fetch RGB imagery:", response.status);
      return {
        success: false,
        colorType: "unknown",
        confidence: 0,
        averageBrightness: 0,
        suggestBifacial: false,
        error: `Failed to fetch imagery: ${response.status}`
      };
    }

    // Get the image data as an ArrayBuffer
    const imageBuffer = await response.arrayBuffer();
    const imageData = new Uint8Array(imageBuffer);
    
    // Simple brightness analysis on the raw image data
    // GeoTIFF has complex headers, but we can sample pixel values from the data portion
    // For a more robust solution, we'd use a proper GeoTIFF parser
    // Here we'll analyze the byte distribution to estimate overall brightness
    
    let totalBrightness = 0;
    let pixelCount = 0;
    
    // Skip the first ~1000 bytes (header) and sample every 3 bytes (RGB triplets)
    // This is a simplified analysis - for production, use a proper GeoTIFF library
    const startOffset = Math.min(1000, imageData.length / 4);
    const sampleStep = 12; // Sample every 4th pixel for efficiency
    
    for (let i = startOffset; i < imageData.length - 2; i += sampleStep) {
      const r = imageData[i];
      const g = imageData[i + 1];
      const b = imageData[i + 2];
      
      // Calculate perceived brightness (luminosity formula)
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      
      // Filter out very dark pixels (likely shadows or non-roof areas)
      // and very saturated pixels (likely vegetation or special surfaces)
      if (brightness > 30 && brightness < 255) {
        totalBrightness += brightness;
        pixelCount++;
      }
    }
    
    if (pixelCount === 0) {
      return {
        success: false,
        colorType: "unknown",
        confidence: 0,
        averageBrightness: 0,
        suggestBifacial: false,
        error: "Could not analyze image pixels"
      };
    }
    
    const averageBrightness = totalBrightness / pixelCount;
    
    // Classify roof color based on average brightness
    // White membrane: typically 180-255 average brightness
    // Light (beige/tan): 140-180
    // Gravel: 100-140
    // Dark (asphalt, etc): 40-100
    let colorType: RoofColorResult["colorType"];
    let confidence: number;
    let suggestBifacial = false;
    
    if (averageBrightness >= 175) {
      colorType = "white_membrane";
      confidence = Math.min(0.9, (averageBrightness - 175) / 80 + 0.6);
      suggestBifacial = true; // Excellent for bifacial!
    } else if (averageBrightness >= 140) {
      colorType = "light";
      confidence = 0.7;
      suggestBifacial = true; // Good for bifacial
    } else if (averageBrightness >= 100) {
      colorType = "gravel";
      confidence = 0.6;
      suggestBifacial = false; // Marginal benefit
    } else {
      colorType = "dark";
      confidence = 0.7;
      suggestBifacial = false; // Not suitable
    }
    
    log.info(`Roof color analysis: avg brightness ${averageBrightness.toFixed(1)}, type: ${colorType}, suggest bifacial: ${suggestBifacial}`);
    
    return {
      success: true,
      colorType,
      confidence,
      averageBrightness,
      suggestBifacial
    };
  } catch (error) {
    log.error("Roof color analysis error:", error);
    return {
      success: false,
      colorType: "unknown",
      confidence: 0,
      averageBrightness: 0,
      suggestBifacial: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

// --- Suggest Constraints (DSM + Flux + Gemini hybrid) ---

export interface SuggestConstraintsInput {
  latitude: number;
  longitude: number;
  existingPolygons: Array<{
    coordinates: [number, number][];
    label?: string;
    color?: string;
  }>;
}

export interface SuggestConstraintsResult {
  success: boolean;
  suggestedConstraints?: Array<{
    coordinates: [number, number][];
    areaSqM: number;
    label: string;
    source: string;
  }>;
  analysisNotes?: string;
  error?: string;
}

export async function suggestConstraints(
  input: SuggestConstraintsInput
): Promise<SuggestConstraintsResult> {
  try {
    // Get data layers (DSM, flux, RGB URLs)
    const dataLayers = await getDataLayers(
      { latitude: input.latitude, longitude: input.longitude },
      75
    );

    if (!dataLayers.success || !dataLayers.dsmUrl) {
      return {
        success: false,
        error: dataLayers.error || "DSM data not available for this location",
      };
    }

    // Filter to only solar polygons (blue) for analysis
    const solarPolygons = input.existingPolygons
      .filter((p) => p.color !== "#f97316")
      .map((p) => ({ coordinates: p.coordinates, label: p.label }));

    if (solarPolygons.length === 0) {
      return {
        success: false,
        error: "No solar polygons found to analyze",
      };
    }

    const result = await detectRoofConstraints({
      latitude: input.latitude,
      longitude: input.longitude,
      solarPolygons,
      dsmUrl: dataLayers.dsmUrl,
      annualFluxUrl: dataLayers.annualFluxUrl,
      rgbUrl: dataLayers.rgbUrl,
    });

    return {
      success: true,
      suggestedConstraints: result.constraints.map((c) => ({
        coordinates: c.coordinates,
        areaSqM: c.areaSqM,
        label: c.label,
        source: c.source,
      })),
      analysisNotes: result.analysisNotes,
    };
  } catch (error) {
    log.error("suggestConstraints error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

const GOOGLE_SOLAR_API_KEY = process.env.GOOGLE_SOLAR_API_KEY;
const GOOGLE_SOLAR_API_BASE = "https://solar.googleapis.com/v1";
const GOOGLE_GEOCODING_API_BASE = "https://maps.googleapis.com/maps/api/geocode/json";

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
  details: BuildingInsights;
  error?: string;
}

export async function geocodeAddress(address: string): Promise<GeoLocation | null> {
  if (!GOOGLE_SOLAR_API_KEY) {
    console.error("GOOGLE_SOLAR_API_KEY not configured");
    return null;
  }

  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `${GOOGLE_GEOCODING_API_BASE}?address=${encodedAddress}&key=${GOOGLE_SOLAR_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === "OK" && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return {
        latitude: location.lat,
        longitude: location.lng
      };
    }
    
    console.error("Geocoding failed:", data.status, data.error_message);
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

export async function getBuildingInsights(location: GeoLocation): Promise<BuildingInsights | null> {
  if (!GOOGLE_SOLAR_API_KEY) {
    console.error("GOOGLE_SOLAR_API_KEY not configured");
    return null;
  }

  try {
    const url = `${GOOGLE_SOLAR_API_BASE}/buildingInsights:findClosest?location.latitude=${location.latitude}&location.longitude=${location.longitude}&requiredQuality=HIGH&key=${GOOGLE_SOLAR_API_KEY}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Solar API error:", response.status, errorText);
      
      if (response.status === 404) {
        const mediumQualityUrl = `${GOOGLE_SOLAR_API_BASE}/buildingInsights:findClosest?location.latitude=${location.latitude}&location.longitude=${location.longitude}&requiredQuality=MEDIUM&key=${GOOGLE_SOLAR_API_KEY}`;
        const mediumResponse = await fetch(mediumQualityUrl);
        
        if (mediumResponse.ok) {
          return await mediumResponse.json();
        }
      }
      
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error("Building insights error:", error);
    return null;
  }
}

export async function estimateRoofFromAddress(address: string): Promise<RoofEstimateResult> {
  const location = await geocodeAddress(address);
  
  if (!location) {
    return {
      success: false,
      latitude: 0,
      longitude: 0,
      roofAreaSqM: 0,
      maxArrayAreaSqM: 0,
      roofSegmentsCount: 0,
      details: {} as BuildingInsights,
      error: "Could not geocode address"
    };
  }
  
  return estimateRoofFromLocation(location);
}

export async function estimateRoofFromLocation(location: GeoLocation): Promise<RoofEstimateResult> {
  const insights = await getBuildingInsights(location);
  
  if (!insights) {
    return {
      success: false,
      latitude: location.latitude,
      longitude: location.longitude,
      roofAreaSqM: 0,
      maxArrayAreaSqM: 0,
      roofSegmentsCount: 0,
      details: {} as BuildingInsights,
      error: "No building data available for this location"
    };
  }
  
  const solarPotential = insights.solarPotential;
  
  let totalRoofAreaSqM = 0;
  let roofSegmentsCount = 0;
  
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
  }
  
  const maxArrayAreaSqM = solarPotential?.maxArrayAreaMeters2 || 0;
  
  let imageryDate: string | undefined;
  if (insights.imageryDate) {
    const { year, month, day } = insights.imageryDate;
    imageryDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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
    details: insights
  };
}

export function isGoogleSolarConfigured(): boolean {
  return !!GOOGLE_SOLAR_API_KEY;
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
  if (!GOOGLE_SOLAR_API_KEY) {
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
      "view": "IMAGERY_LAYERS",
      "requiredQuality": "HIGH",
      "key": GOOGLE_SOLAR_API_KEY
    });

    const url = `${GOOGLE_SOLAR_API_BASE}/dataLayers:get?${params}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Solar API dataLayers error:", response.status, errorText);
      
      if (response.status === 404) {
        const mediumParams = new URLSearchParams({
          "location.latitude": location.latitude.toFixed(6),
          "location.longitude": location.longitude.toFixed(6),
          "radiusMeters": radiusMeters.toString(),
          "view": "IMAGERY_LAYERS",
          "requiredQuality": "MEDIUM",
          "key": GOOGLE_SOLAR_API_KEY
        });
        const mediumUrl = `${GOOGLE_SOLAR_API_BASE}/dataLayers:get?${mediumParams}`;
        const mediumResponse = await fetch(mediumUrl);
        
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
    console.error("DataLayers error:", error);
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

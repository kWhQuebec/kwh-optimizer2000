/**
 * KB Racking vs Google Solar Comparison Tool
 * 
 * Compares validated KB Racking designs with Google Solar API estimates
 * to validate Quick Analysis parameters.
 */

import { storage } from "./storage";
import { createLogger } from "./lib/logger";

const log = createLogger("KBGoogleSolar");

const GOOGLE_SOLAR_API_KEY = process.env.GOOGLE_SOLAR_API_KEY;
const GOOGLE_MAPS_API_KEY = process.env.VITE_GOOGLE_MAPS_API_KEY;

interface GoogleSolarData {
  maxPanelCount: number;
  maxCapacityWatts: number;
  roofAreaSqM: number;
  yearlyEnergyDcKwh: number;
  carbonOffsetKg: number;
}

interface ComparisonResult {
  siteId: string;
  siteName: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  
  // KB Racking (validated design)
  kbPanelCount: number;
  kbKwDc: number;
  kbPricePerPanel: number;
  
  // Google Solar estimates
  googlePanelCount: number | null;
  googleKwDc: number | null;
  googleRoofAreaSqM: number | null;
  googleYearlyEnergyKwh: number | null;
  
  // Quick Analysis simulation (what our tool would estimate)
  quickAnalysisPanelCount: number | null;
  quickAnalysisKwDc: number | null;
  
  // Comparison metrics
  kbVsGooglePanelRatio: number | null;  // KB panels / Google panels
  kbVsGoogleCapacityRatio: number | null;
  kbVsQuickAnalysisRatio: number | null;
  
  // Status
  status: 'success' | 'geocode_failed' | 'solar_api_failed' | 'no_data';
  error?: string;
}

/**
 * Geocode an address using Google Geocoding API
 */
async function geocodeAddress(address: string, city: string): Promise<{ lat: number; lng: number } | null> {
  const apiKey = GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    log.error("No Google Maps API key available");
    return null;
  }
  
  const fullAddress = `${address}, ${city}, Quebec, Canada`;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${apiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return { lat: location.lat, lng: location.lng };
    }
    log.info(`Geocoding failed for ${fullAddress}: ${data.status}`);
    return null;
  } catch (error) {
    log.error(`Geocoding error for ${fullAddress}:`, error);
    return null;
  }
}

/**
 * Get Google Solar API building insights
 */
async function getGoogleSolarData(lat: number, lng: number): Promise<GoogleSolarData | null> {
  const apiKey = GOOGLE_SOLAR_API_KEY || GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    log.error("No Google Solar/Maps API key available");
    return null;
  }
  
  const url = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=HIGH&key=${apiKey}`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      log.info(`Google Solar API error (${response.status}): ${errorText}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.solarPotential) {
      log.info("No solar potential data in response");
      return null;
    }
    
    const sp = data.solarPotential;
    
    return {
      maxPanelCount: sp.maxArrayPanelsCount || 0,
      maxCapacityWatts: (sp.maxArrayPanelsCount || 0) * (sp.panelCapacityWatts || 400),
      roofAreaSqM: sp.maxArrayAreaMeters2 || 0,
      yearlyEnergyDcKwh: sp.maxSunshineHoursPerYear * (sp.maxArrayPanelsCount * sp.panelCapacityWatts / 1000) || 0,
      carbonOffsetKg: sp.carbonOffsetFactorKgPerMwh || 0,
    };
  } catch (error) {
    log.error(`Google Solar API error:`, error);
    return null;
  }
}

/**
 * Simulate Quick Analysis estimate based on roof area
 * Uses current parameters: 660W panels, 85% utilization, 3.15 m²/panel
 */
function simulateQuickAnalysis(roofAreaSqM: number): { panelCount: number; kwDc: number } {
  const PANEL_POWER_W = 660;
  const UTILIZATION_RATIO = 0.85;
  const EFFECTIVE_PANEL_AREA_SQM = 3.15; // 2.1m x 1.5m grid cell
  
  const usableArea = roofAreaSqM * UTILIZATION_RATIO;
  const panelCount = Math.floor(usableArea / EFFECTIVE_PANEL_AREA_SQM);
  const kwDc = (panelCount * PANEL_POWER_W) / 1000;
  
  return { panelCount, kwDc };
}

/**
 * Run comparison for all KB Racking sites
 */
export async function runKBGoogleSolarComparison(): Promise<{
  results: ComparisonResult[];
  summary: {
    totalSites: number;
    successfulComparisons: number;
    failedComparisons: number;
    avgKbVsGooglePanelRatio: number;
    avgKbVsGoogleCapacityRatio: number;
    avgKbVsQuickAnalysisRatio: number;
    recommendedCorrectionFactor: number;
  };
}> {
  // Get all KB Racking sites
  const allSites = await storage.getSites();
  const kbSites = allSites.filter((s: any) => s.kbDesignStatus === 'complete');
  
  log.info(`Found ${kbSites.length} KB Racking sites to compare`);
  
  const results: ComparisonResult[] = [];
  
  for (const site of kbSites) {
    const s = site as any;
    log.info(`Processing: ${s.name}`);
    
    const result: ComparisonResult = {
      siteId: s.id,
      siteName: s.name,
      address: `${s.address}, ${s.city || ''}`,
      latitude: s.latitude,
      longitude: s.longitude,
      kbPanelCount: s.kbPanelCount || 0,
      kbKwDc: s.kbKwDc || 0,
      kbPricePerPanel: s.kbPricePerPanel || 0,
      googlePanelCount: null,
      googleKwDc: null,
      googleRoofAreaSqM: null,
      googleYearlyEnergyKwh: null,
      quickAnalysisPanelCount: null,
      quickAnalysisKwDc: null,
      kbVsGooglePanelRatio: null,
      kbVsGoogleCapacityRatio: null,
      kbVsQuickAnalysisRatio: null,
      status: 'no_data',
    };
    
    // Step 1: Get coordinates (geocode if needed)
    let lat = s.latitude;
    let lng = s.longitude;
    
    if (!lat || !lng) {
      log.info(`Geocoding address: ${s.address}, ${s.city}`);
      const coords = await geocodeAddress(s.address || '', s.city || 'Montreal');
      if (coords) {
        lat = coords.lat;
        lng = coords.lng;
        result.latitude = lat;
        result.longitude = lng;
        log.info(`Found coordinates: ${lat}, ${lng}`);
        
        // Update database with coordinates
        await storage.updateSite(s.id, { latitude: lat, longitude: lng });
      } else {
        result.status = 'geocode_failed';
        result.error = 'Could not geocode address';
        results.push(result);
        continue;
      }
    }
    
    // Step 2: Get Google Solar data
    log.info(`Fetching Google Solar data...`);
    const solarData = await getGoogleSolarData(lat, lng);
    
    if (!solarData || solarData.maxPanelCount === 0) {
      result.status = 'solar_api_failed';
      result.error = 'No Google Solar data available';
      results.push(result);
      continue;
    }
    
    result.googlePanelCount = solarData.maxPanelCount;
    result.googleKwDc = solarData.maxCapacityWatts / 1000;
    result.googleRoofAreaSqM = solarData.roofAreaSqM;
    result.googleYearlyEnergyKwh = solarData.yearlyEnergyDcKwh;
    
    // Step 3: Simulate Quick Analysis
    if (solarData.roofAreaSqM > 0) {
      const quickAnalysis = simulateQuickAnalysis(solarData.roofAreaSqM);
      result.quickAnalysisPanelCount = quickAnalysis.panelCount;
      result.quickAnalysisKwDc = quickAnalysis.kwDc;
    }
    
    // Step 4: Calculate comparison ratios
    if (solarData.maxPanelCount > 0) {
      result.kbVsGooglePanelRatio = result.kbPanelCount / solarData.maxPanelCount;
      result.kbVsGoogleCapacityRatio = result.kbKwDc / (solarData.maxCapacityWatts / 1000);
    }
    
    if (result.quickAnalysisPanelCount && result.quickAnalysisPanelCount > 0) {
      result.kbVsQuickAnalysisRatio = result.kbPanelCount / result.quickAnalysisPanelCount;
    }
    
    result.status = 'success';
    results.push(result);
    
    log.info(`KB: ${result.kbPanelCount} panels (${result.kbKwDc} kW)`);
    log.info(`Google: ${result.googlePanelCount} panels (${result.googleKwDc?.toFixed(1)} kW)`);
    log.info(`Quick Analysis: ${result.quickAnalysisPanelCount} panels (${result.quickAnalysisKwDc?.toFixed(1)} kW)`);
    log.info(`KB/Google ratio: ${result.kbVsGooglePanelRatio?.toFixed(2)}`);
    
    // Rate limiting - wait 500ms between API calls
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Calculate summary statistics
  const successfulResults = results.filter(r => r.status === 'success');
  
  const avgKbVsGooglePanelRatio = successfulResults.length > 0
    ? successfulResults.reduce((sum, r) => sum + (r.kbVsGooglePanelRatio || 0), 0) / successfulResults.length
    : 0;
    
  const avgKbVsGoogleCapacityRatio = successfulResults.length > 0
    ? successfulResults.reduce((sum, r) => sum + (r.kbVsGoogleCapacityRatio || 0), 0) / successfulResults.length
    : 0;
    
  const avgKbVsQuickAnalysisRatio = successfulResults.filter(r => r.kbVsQuickAnalysisRatio).length > 0
    ? successfulResults.reduce((sum, r) => sum + (r.kbVsQuickAnalysisRatio || 0), 0) / 
      successfulResults.filter(r => r.kbVsQuickAnalysisRatio).length
    : 0;
  
  return {
    results,
    summary: {
      totalSites: kbSites.length,
      successfulComparisons: successfulResults.length,
      failedComparisons: results.filter(r => r.status !== 'success').length,
      avgKbVsGooglePanelRatio: Math.round(avgKbVsGooglePanelRatio * 100) / 100,
      avgKbVsGoogleCapacityRatio: Math.round(avgKbVsGoogleCapacityRatio * 100) / 100,
      avgKbVsQuickAnalysisRatio: Math.round(avgKbVsQuickAnalysisRatio * 100) / 100,
      recommendedCorrectionFactor: Math.round(avgKbVsGooglePanelRatio * 100) / 100,
    },
  };
}

/**
 * Generate a formatted comparison report
 */
export function generateComparisonReport(comparison: Awaited<ReturnType<typeof runKBGoogleSolarComparison>>): string {
  const { results, summary } = comparison;
  
  let report = `
# KB Racking vs Google Solar Comparison Report
Generated: ${new Date().toISOString()}

## Summary
- Total KB Sites: ${summary.totalSites}
- Successful Comparisons: ${summary.successfulComparisons}
- Failed Comparisons: ${summary.failedComparisons}

## Key Findings
- **Average KB/Google Panel Ratio**: ${summary.avgKbVsGooglePanelRatio}
  - Values > 1.0 mean KB installs MORE panels than Google estimates
  - Values < 1.0 mean KB installs FEWER panels than Google estimates
  
- **Average KB/Google Capacity Ratio**: ${summary.avgKbVsGoogleCapacityRatio}
  
- **Average KB/Quick Analysis Ratio**: ${summary.avgKbVsQuickAnalysisRatio}
  - This tells us how much our Quick Analysis under/overestimates vs real designs

## Recommended Correction Factor
**${summary.recommendedCorrectionFactor}** - Multiply Quick Analysis results by this factor to align with KB designs

## Detailed Results

| Site | KB Panels | Google Panels | Quick Analysis | KB/Google Ratio | Status |
|------|-----------|---------------|----------------|-----------------|--------|
`;

  for (const r of results) {
    const shortName = r.siteName.length > 30 ? r.siteName.substring(0, 30) + '...' : r.siteName;
    report += `| ${shortName} | ${r.kbPanelCount} | ${r.googlePanelCount || 'N/A'} | ${r.quickAnalysisPanelCount || 'N/A'} | ${r.kbVsGooglePanelRatio?.toFixed(2) || 'N/A'} | ${r.status} |\n`;
  }

  return report;
}

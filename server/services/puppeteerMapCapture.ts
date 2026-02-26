import puppeteer from "puppeteer";
import { createLogger } from "../lib/logger";

const log = createLogger("PuppeteerMapCapture");

interface RoofPolygonInput {
  coordinates: [number, number][];
  color: string;
  label?: string;
  areaSqM: number;
}

interface CaptureParams {
  latitude: number;
  longitude: number;
  roofPolygons: RoofPolygonInput[];
  pvSizeKW?: number;
  zoom?: number;
  width?: number;
  height?: number;
}

export async function captureRoofVisualization(params: CaptureParams): Promise<Buffer | null> {
  const {
    latitude,
    longitude,
    roofPolygons,
    pvSizeKW = 0,
    width = 800,
    height = 500,
  } = params;

  const apiKey = process.env.GOOGLE_SOLAR_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    log.warn("No Google Maps API key available for Puppeteer map capture");
    return null;
  }

  if (!latitude || !longitude) {
    log.warn("No coordinates available for Puppeteer map capture");
    return null;
  }

  const solarPolygons = roofPolygons.filter(p => {
    const lbl = (p.label || "").toLowerCase();
    return !lbl.includes("contrainte") && !lbl.includes("constraint") &&
           !lbl.includes("hvac") && !lbl.includes("obstacle");
  });

  const constraintPolygons = roofPolygons.filter(p => {
    const lbl = (p.label || "").toLowerCase();
    return lbl.includes("contrainte") || lbl.includes("constraint") ||
           lbl.includes("hvac") || lbl.includes("obstacle");
  });

  const zoom = params.zoom || computeZoom(roofPolygons, latitude, longitude, width, height);

  const targetPanelCount = pvSizeKW > 0 ? Math.round(pvSizeKW / 0.660) : 999999;

  const html = buildMapHtml({
    apiKey,
    latitude,
    longitude,
    zoom,
    width,
    height,
    solarPolygons,
    constraintPolygons,
    targetPanelCount,
  });

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });

    await page.waitForFunction("window.__mapReady === true", { timeout: 20000 }).catch(() => {
      log.warn("Map ready signal not received within 20s, proceeding anyway");
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    const screenshot = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width, height },
    });

    log.info(`Puppeteer map capture successful: ${screenshot.length} bytes`);
    return Buffer.from(screenshot);
  } catch (err) {
    log.error("Puppeteer map capture failed:", err);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

function computeZoom(
  polygons: RoofPolygonInput[],
  lat: number,
  lng: number,
  imgW: number,
  imgH: number
): number {
  if (polygons.length === 0) return 19;

  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of polygons) {
    for (const [pLng, pLat] of p.coordinates) {
      minLat = Math.min(minLat, pLat);
      maxLat = Math.max(maxLat, pLat);
      minLng = Math.min(minLng, pLng);
      maxLng = Math.max(maxLng, pLng);
    }
  }

  const latSpan = (maxLat - minLat) * 1.4;
  const lngSpan = (maxLng - minLng) * 1.4;

  if (latSpan <= 0 && lngSpan <= 0) return 19;

  const WORLD_DIM = 256 * 2;
  const latZoom = latSpan > 0 ? Math.floor(Math.log2((180 * imgH) / (latSpan * WORLD_DIM))) : 20;
  const lngZoom = lngSpan > 0 ? Math.floor(Math.log2((360 * imgW) / (lngSpan * WORLD_DIM))) : 20;
  return Math.max(Math.min(latZoom, lngZoom, 20), 15);
}

interface BuildMapHtmlParams {
  apiKey: string;
  latitude: number;
  longitude: number;
  zoom: number;
  width: number;
  height: number;
  solarPolygons: RoofPolygonInput[];
  constraintPolygons: RoofPolygonInput[];
  targetPanelCount: number;
}

function buildMapHtml(params: BuildMapHtmlParams): string {
  const {
    apiKey, latitude, longitude, zoom, width, height,
    solarPolygons, constraintPolygons, targetPanelCount,
  } = params;

  const solarPolygonsJson = JSON.stringify(solarPolygons.map(p => ({
    coords: p.coordinates,
    areaSqM: p.areaSqM,
  })));

  const constraintPolygonsJson = JSON.stringify(constraintPolygons.map(p => ({
    coords: p.coordinates,
  })));

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: ${width}px; height: ${height}px; overflow: hidden; }
  #map { width: ${width}px; height: ${height}px; }
</style>
</head>
<body>
<div id="map"></div>
<script>
window.__mapReady = false;

function initMap() {
  var map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: ${latitude}, lng: ${longitude} },
    zoom: ${zoom},
    mapTypeId: 'satellite',
    disableDefaultUI: true,
    gestureHandling: 'none',
    tilt: 0,
    rotateControl: false,
    fullscreenControl: false,
    mapTypeControl: false,
    streetViewControl: false,
    zoomControl: false,
  });

  var solarPolygons = ${solarPolygonsJson};
  var constraintPolygons = ${constraintPolygonsJson};
  var targetPanelCount = ${targetPanelCount};

  // Draw solar zone polygons
  solarPolygons.forEach(function(poly) {
    var paths = poly.coords.map(function(c) { return { lat: c[1], lng: c[0] }; });
    new google.maps.Polygon({
      paths: paths,
      strokeColor: '#22c55e',
      strokeWeight: 2,
      strokeOpacity: 0.9,
      fillColor: '#22c55e',
      fillOpacity: 0.12,
      map: map,
    });
  });

  // Draw constraint polygons
  constraintPolygons.forEach(function(poly) {
    var paths = poly.coords.map(function(c) { return { lat: c[1], lng: c[0] }; });
    new google.maps.Polygon({
      paths: paths,
      strokeColor: '#f97316',
      strokeWeight: 1.5,
      strokeOpacity: 0.9,
      fillColor: '#f97316',
      fillOpacity: 0.15,
      map: map,
    });
  });

  // Panel placement — simplified grid within solar zones
  var PANEL_W_M = 1.134;
  var PANEL_H_M = 2.382;
  var ROW_SPACING_M = 1.557;
  var COL_SPACING_M = 0.02;
  var SETBACK_M = 1.22;
  var METERS_PER_DEG_LAT = 111320;

  function pointInPolygon(lat, lng, coords) {
    var inside = false;
    for (var i = 0, j = coords.length - 1; i < coords.length; j = i++) {
      var xi = coords[i][1], yi = coords[i][0];
      var xj = coords[j][1], yj = coords[j][0];
      var intersect = ((yi > lng) !== (yj > lng)) &&
        (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function pointInAnyConstraint(lat, lng) {
    for (var c = 0; c < constraintPolygons.length; c++) {
      if (pointInPolygon(lat, lng, constraintPolygons[c].coords)) return true;
    }
    return false;
  }

  var panelCount = 0;
  var allPanels = [];

  solarPolygons.forEach(function(poly) {
    var coords = poly.coords;
    if (coords.length < 3) return;

    var minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    coords.forEach(function(c) {
      minLat = Math.min(minLat, c[1]);
      maxLat = Math.max(maxLat, c[1]);
      minLng = Math.min(minLng, c[0]);
      maxLng = Math.max(maxLng, c[0]);
    });

    var centerLat = (minLat + maxLat) / 2;
    var metersPerDegLng = METERS_PER_DEG_LAT * Math.cos(centerLat * Math.PI / 180);

    var setbackLat = SETBACK_M / METERS_PER_DEG_LAT;
    var setbackLng = SETBACK_M / metersPerDegLng;

    var stepLat = ROW_SPACING_M / METERS_PER_DEG_LAT;
    var stepLng = (PANEL_W_M + COL_SPACING_M) / metersPerDegLng;
    var panelHDeg = PANEL_H_M / METERS_PER_DEG_LAT;
    var panelWDeg = PANEL_W_M / metersPerDegLng;

    for (var lat = minLat + setbackLat; lat + panelHDeg <= maxLat - setbackLat; lat += stepLat) {
      for (var lng = minLng + setbackLng; lng + panelWDeg <= maxLng - setbackLng; lng += stepLng) {
        var cLat = lat + panelHDeg / 2;
        var cLng = lng + panelWDeg / 2;

        var c1 = pointInPolygon(lat, lng, coords);
        var c2 = pointInPolygon(lat + panelHDeg, lng, coords);
        var c3 = pointInPolygon(lat, lng + panelWDeg, coords);
        var c4 = pointInPolygon(lat + panelHDeg, lng + panelWDeg, coords);
        if (!(c1 && c2 && c3 && c4)) continue;

        if (pointInAnyConstraint(cLat, cLng)) continue;

        allPanels.push({ lat: lat, lng: lng, hDeg: panelHDeg, wDeg: panelWDeg });
      }
    }
  });

  // Limit to target panel count
  var panelsToRender = allPanels.slice(0, targetPanelCount);

  // Draw panels
  panelsToRender.forEach(function(p, i) {
    var ratio = panelsToRender.length > 1 ? i / (panelsToRender.length - 1) : 0;
    var fillColor = ratio < 0.3 ? '#2563eb' : ratio < 0.7 ? '#3b82f6' : '#60a5fa';
    var fillOpacity = 0.9 - ratio * 0.35;

    new google.maps.Rectangle({
      bounds: {
        north: p.lat + p.hDeg,
        south: p.lat,
        east: p.lng + p.wDeg,
        west: p.lng,
      },
      strokeColor: '#1e40af',
      strokeWeight: 0.5,
      strokeOpacity: 0.9,
      fillColor: fillColor,
      fillOpacity: fillOpacity,
      map: map,
      clickable: false,
    });
  });

  // Signal ready after tiles load
  google.maps.event.addListenerOnce(map, 'tilesloaded', function() {
    setTimeout(function() { window.__mapReady = true; }, 1000);
  });
}
</script>
<script src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap" async defer></script>
</body>
</html>`;
}

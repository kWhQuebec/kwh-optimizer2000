/**
 * SLD (Single Line Diagram) — Schéma unifilaire professionnel
 *
 * Vertical top-to-bottom layout matching IEC/IEEE engineering drawing standards.
 * Flow: Grid → Meter → Transformer → AC Combiner → Inverters → DC Combiner → PV Strings
 *
 * Conventions:
 * - Jinko 660W panels, Voc = 49.85V, Isc = 17.28A
 * - String inverters: max 1000V DC (CSA), ~13 panels/string max
 * - Micro-inverters: 1 per panel, AC bus daisy-chain
 * - IEC/CSA compliant labeling, monochrome engineering style
 */

import { useMemo, useRef, useCallback } from "react";
import { KWH_LOGO_DATA_URI } from "./sld-logo-data";

export interface SLDArrayInfo {
  id: number;
  panelCount: number;
  rows: number;
  columns: number;
  capacityKW: number;
  polygonId: string;
}

export interface SLDElectricalConfig {
  inverterType: "string" | "micro";
  stringInverterModelName?: string;
  stringInverterPowerKW?: number;
  microInverterModelName?: string;
  microInverterPowerW?: number;
  serviceVoltage?: number;
  serviceAmperage?: number;
  mainBreakerA?: number;
  siteName?: string;
  siteAddress?: string;
  systemCapacityKW?: number;
  totalPanels?: number;
}

interface SLDInverterAssignment {
  inverterId: number;
  inverterLabel: string;
  powerKW: number;
  strings: {
    stringId: number;
    panelsInString: number;
    vocString: number;
    iscString: number;
    arrayId: number;
  }[];
  totalPanels: number;
  totalCapacityKW: number;
}

interface SLDMicroInverterGroup {
  arrayId: number;
  panelCount: number;
  capacityKW: number;
  acBranchCircuitA: number;
}

export interface SLDDiagramProps {
  arrays: SLDArrayInfo[];
  config: SLDElectricalConfig;
  language?: "fr" | "en";
  width?: number;
  height?: number;
}

const PANEL_WATT = 660;
const PANEL_VOC = 49.85;
const PANEL_ISC = 17.28;
const MAX_SYSTEM_VOLTAGE_DC = 1000;
const TEMP_CORRECTION_VOC = 1.165;
const MAX_PANELS_PER_STRING = Math.floor(MAX_SYSTEM_VOLTAGE_DC / (PANEL_VOC * TEMP_CORRECTION_VOC));

const DEFAULT_STRING_INV_KW = 50;
const DEFAULT_STRING_INV_NAME = "Onduleur string 50 kW";
const DEFAULT_STRING_INV_MAX_STRINGS = 10;

const DEFAULT_MICRO_INV_W = 800;
const DEFAULT_MICRO_INV_NAME = "Micro-onduleur 800W";
const DEFAULT_MICRO_INV_MAX_PER_BRANCH = 16;

const FONT = "Inter, system-ui, sans-serif";
const STROKE = "#1e293b";
const STROKE_LIGHT = "#475569";
const STROKE_FAINT = "#94a3b8";

function calculateStringInverterLayout(
  arrays: SLDArrayInfo[],
  invPowerKW: number = DEFAULT_STRING_INV_KW,
  invName: string = DEFAULT_STRING_INV_NAME
): SLDInverterAssignment[] {
  const panelsPerString = Math.min(MAX_PANELS_PER_STRING, 13);
  const allStrings: { panelsInString: number; arrayId: number }[] = [];

  for (const arr of arrays) {
    let remaining = arr.panelCount;
    while (remaining > 0) {
      const n = Math.min(remaining, panelsPerString);
      if (n >= Math.ceil(panelsPerString * 0.6)) {
        allStrings.push({ panelsInString: n, arrayId: arr.id });
      } else if (allStrings.length > 0 && allStrings[allStrings.length - 1].arrayId === arr.id) {
        allStrings[allStrings.length - 1].panelsInString += n;
      } else {
        allStrings.push({ panelsInString: n, arrayId: arr.id });
      }
      remaining -= n;
    }
  }

  const maxStringsPerInv = DEFAULT_STRING_INV_MAX_STRINGS;
  const inverters: SLDInverterAssignment[] = [];
  let strIdx = 0;
  let invId = 1;

  while (strIdx < allStrings.length) {
    const invStrings: SLDInverterAssignment["strings"] = [];
    let invPanels = 0;
    let stringInInv = 0;

    while (strIdx < allStrings.length && stringInInv < maxStringsPerInv) {
      const s = allStrings[strIdx];
      const newCapKW = (invPanels + s.panelsInString) * PANEL_WATT / 1000;
      if (invStrings.length > 0 && newCapKW > invPowerKW * 1.3) break;

      invStrings.push({
        stringId: stringInInv + 1,
        panelsInString: s.panelsInString,
        vocString: Math.round(s.panelsInString * PANEL_VOC * 10) / 10,
        iscString: PANEL_ISC,
        arrayId: s.arrayId,
      });
      invPanels += s.panelsInString;
      stringInInv++;
      strIdx++;
    }

    if (invStrings.length > 0) {
      inverters.push({
        inverterId: invId++,
        inverterLabel: `${invName} #${invId - 1}`,
        powerKW: invPowerKW,
        strings: invStrings,
        totalPanels: invPanels,
        totalCapacityKW: Math.round(invPanels * PANEL_WATT / 10) / 100,
      });
    }
  }

  return inverters;
}

function calculateMicroInverterLayout(
  arrays: SLDArrayInfo[],
  microPowerW: number = DEFAULT_MICRO_INV_W
): SLDMicroInverterGroup[] {
  return arrays.map((arr) => ({
    arrayId: arr.id,
    panelCount: arr.panelCount,
    capacityKW: Math.round(arr.panelCount * Math.min(PANEL_WATT, microPowerW) / 10) / 100,
    acBranchCircuitA: Math.round(
      Math.ceil(arr.panelCount / DEFAULT_MICRO_INV_MAX_PER_BRANCH) *
      (microPowerW / 240) * 1.25 * 10
    ) / 10,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// IEC SYMBOL COMPONENTS — Monochrome engineering style
// ═══════════════════════════════════════════════════════════════════════════════

function IECMeterV({ cx, cy, r = 16 }: { cx: number; cy: number; r?: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="white" stroke={STROKE} strokeWidth={1.5} />
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize={r * 0.7} fontWeight={700} fill={STROKE} fontFamily={FONT}>M</text>
    </g>
  );
}

function IECTransformerV({ cx, cy, size = 50 }: { cx: number; cy: number; size?: number }) {
  const coilW = size * 0.6;
  const coilH = size * 0.3;
  const gap = 4;
  return (
    <g>
      <line x1={cx} y1={cy - size/2} x2={cx} y2={cy - gap - coilH/2} stroke={STROKE} strokeWidth={1.5} />
      {/* Primary winding (top) */}
      <path d={`M${cx - coilW/2},${cy - gap - coilH/2} Q${cx - coilW/4},${cy - gap - coilH} ${cx},${cy - gap - coilH/2} Q${cx + coilW/4},${cy - gap} ${cx + coilW/2},${cy - gap - coilH/2}`}
        fill="none" stroke={STROKE} strokeWidth={1.5} />
      <path d={`M${cx - coilW/2},${cy - gap - coilH/2 + coilH*0.35} Q${cx - coilW/4},${cy - gap - coilH + coilH*0.35} ${cx},${cy - gap - coilH/2 + coilH*0.35} Q${cx + coilW/4},${cy - gap + coilH*0.35} ${cx + coilW/2},${cy - gap - coilH/2 + coilH*0.35}`}
        fill="none" stroke={STROKE} strokeWidth={1.5} />
      {/* Secondary winding (bottom) */}
      <path d={`M${cx - coilW/2},${cy + gap + coilH/2} Q${cx - coilW/4},${cy + gap} ${cx},${cy + gap + coilH/2} Q${cx + coilW/4},${cy + gap + coilH} ${cx + coilW/2},${cy + gap + coilH/2}`}
        fill="none" stroke={STROKE} strokeWidth={1.5} />
      <path d={`M${cx - coilW/2},${cy + gap + coilH/2 - coilH*0.35} Q${cx - coilW/4},${cy + gap - coilH*0.35} ${cx},${cy + gap + coilH/2 - coilH*0.35} Q${cx + coilW/4},${cy + gap + coilH - coilH*0.35} ${cx + coilW/2},${cy + gap + coilH/2 - coilH*0.35}`}
        fill="none" stroke={STROKE} strokeWidth={1.5} />
      <line x1={cx} y1={cy + gap + coilH/2} x2={cx} y2={cy + size/2} stroke={STROKE} strokeWidth={1.5} />
    </g>
  );
}

function IECBreakerV({ cx, y1, length = 24 }: { cx: number; y1: number; length?: number }) {
  const dotR = 2.5;
  return (
    <g>
      <circle cx={cx} cy={y1 + dotR} r={dotR} fill={STROKE} />
      <line x1={cx} y1={y1 + dotR * 2} x2={cx + 8} y2={y1 + length - dotR * 2} stroke={STROKE} strokeWidth={1.8} />
      <circle cx={cx} cy={y1 + length - dotR} r={dotR} fill="none" stroke={STROKE} strokeWidth={1.2} />
    </g>
  );
}

function IECGroundV({ cx, topY }: { cx: number; topY: number }) {
  return (
    <g>
      <line x1={cx} y1={topY} x2={cx} y2={topY + 6} stroke={STROKE} strokeWidth={1.5} />
      <line x1={cx - 10} y1={topY + 6} x2={cx + 10} y2={topY + 6} stroke={STROKE} strokeWidth={1.8} />
      <line x1={cx - 6} y1={topY + 10} x2={cx + 6} y2={topY + 10} stroke={STROKE} strokeWidth={1.5} />
      <line x1={cx - 3} y1={topY + 14} x2={cx + 3} y2={topY + 14} stroke={STROKE} strokeWidth={1.2} />
    </g>
  );
}

function IECFuseV({ cx, y, length = 16 }: { cx: number; y: number; length?: number }) {
  const capH = length * 0.5;
  const capW = 6;
  return (
    <g>
      <line x1={cx} y1={y} x2={cx} y2={y + (length - capH) / 2} stroke={STROKE} strokeWidth={1.2} />
      <rect x={cx - capW/2} y={y + (length - capH) / 2} width={capW} height={capH}
        fill="none" stroke={STROKE} strokeWidth={1.2} rx={capW/2} />
      <line x1={cx} y1={y + (length + capH) / 2} x2={cx} y2={y + length} stroke={STROKE} strokeWidth={1.2} />
    </g>
  );
}

function IECInverterV({ cx, cy, size = 36 }: { cx: number; cy: number; size?: number }) {
  const hs = size / 2;
  return (
    <g>
      <rect x={cx - hs} y={cy - hs} width={size} height={size} fill="white" stroke={STROKE} strokeWidth={1.5} rx={2} />
      <polygon points={`${cx - hs*0.45},${cy + hs*0.4} ${cx},${cy - hs*0.4} ${cx + hs*0.45},${cy + hs*0.4}`}
        fill="none" stroke={STROKE} strokeWidth={1.2} />
      <text x={cx - hs*0.3} y={cy + hs*0.6} fontSize={size*0.2} fill={STROKE} fontFamily={FONT}>~</text>
      <text x={cx + hs*0.15} y={cy - hs*0.25} fontSize={size*0.18} fill={STROKE} fontFamily={FONT}>=</text>
    </g>
  );
}

function IECPVModuleV({ cx, cy, w = 28, h = 22 }: { cx: number; cy: number; w?: number; h?: number }) {
  return (
    <g>
      <rect x={cx - w/2} y={cy - h/2} width={w} height={h} fill="white" stroke={STROKE} strokeWidth={1.2} rx={1} />
      <line x1={cx - w*0.3} y1={cy + h*0.35} x2={cx + w*0.3} y2={cy - h*0.35} stroke={STROKE} strokeWidth={1} />
      <polygon points={`${cx + w*0.25},${cy - h*0.35} ${cx + w*0.3},${cy - h*0.35} ${cx + w*0.3},${cy - h*0.15}`} fill={STROKE} />
      <line x1={cx - w*0.55} y1={cy - h*0.2} x2={cx - w*0.25} y2={cy - h*0.05} stroke={STROKE} strokeWidth={0.8} />
      <polygon points={`${cx - w*0.28},${cy - h*0.1} ${cx - w*0.25},${cy - h*0.05} ${cx - w*0.32},${cy + h*0.02}`} fill={STROKE} />
    </g>
  );
}

function IECCombinerBoxV({ x, y, w, h, label, fuseCount = 2 }: {
  x: number; y: number; w: number; h: number; label?: string; fuseCount?: number;
}) {
  const fc = Math.min(fuseCount, 6);
  const spacing = w / (fc + 1);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="white" stroke={STROKE} strokeWidth={1.5}
        strokeDasharray="6 3" rx={2} />
      {Array.from({ length: fc }).map((_, i) => {
        const fx = x + spacing * (i + 1);
        return <IECFuseV key={i} cx={fx} y={y + h * 0.25} length={h * 0.5} />;
      })}
      {label && (
        <text x={x + w / 2} y={y + h + 12} textAnchor="middle" fontSize={7} fill={STROKE_LIGHT}
          fontFamily={FONT}>{label}</text>
      )}
    </g>
  );
}

function UtilityPole({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <line x1={cx} y1={cy - 25} x2={cx} y2={cy + 15} stroke={STROKE} strokeWidth={2} />
      <line x1={cx - 18} y1={cy - 18} x2={cx + 18} y2={cy - 18} stroke={STROKE} strokeWidth={1.5} />
      <line x1={cx - 14} y1={cy - 12} x2={cx + 14} y2={cy - 12} stroke={STROKE} strokeWidth={1.5} />
      <circle cx={cx - 12} cy={cy - 18} r={2} fill="white" stroke={STROKE} strokeWidth={1} />
      <circle cx={cx + 12} cy={cy - 18} r={2} fill="white" stroke={STROKE} strokeWidth={1} />
      <circle cx={cx - 8} cy={cy - 12} r={2} fill="white" stroke={STROKE} strokeWidth={1} />
      <circle cx={cx + 8} cy={cy - 12} r={2} fill="white" stroke={STROKE} strokeWidth={1} />
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRID COORDINATES BORDER
// ═══════════════════════════════════════════════════════════════════════════════

function GridBorder({ width, height, marginLeft, marginTop, innerW, innerH }: {
  width: number; height: number; marginLeft: number; marginTop: number; innerW: number; innerH: number;
}) {
  const rowLabels = "ABCDEFGHJKLMNPQR".split("");
  const colCount = 13;
  const cellW = innerW / colCount;
  const cellH = innerH / Math.min(rowLabels.length, Math.ceil(innerH / 50));
  const rowCount = Math.floor(innerH / cellH);
  const tickLen = marginLeft - 4;

  return (
    <g>
      <rect x={0} y={0} width={width} height={height} fill="none" stroke={STROKE} strokeWidth={2} />
      <rect x={marginLeft} y={marginTop} width={innerW} height={innerH} fill="none" stroke={STROKE} strokeWidth={1} />

      {Array.from({ length: colCount }).map((_, i) => {
        const x = marginLeft + cellW * (i + 0.5);
        return (
          <g key={`col-${i}`}>
            <line x1={marginLeft + cellW * i} y1={marginTop} x2={marginLeft + cellW * i} y2={marginTop - 2}
              stroke={STROKE_FAINT} strokeWidth={0.5} />
            <text x={x} y={marginTop - 5} textAnchor="middle" fontSize={6} fill={STROKE_LIGHT} fontFamily={FONT}>
              {i + 1}
            </text>
            <text x={x} y={height - 4} textAnchor="middle" fontSize={6} fill={STROKE_LIGHT} fontFamily={FONT}>
              {i + 1}
            </text>
          </g>
        );
      })}

      {Array.from({ length: Math.min(rowCount, rowLabels.length) }).map((_, i) => {
        const y = marginTop + cellH * (i + 0.5);
        return (
          <g key={`row-${i}`}>
            <line x1={marginLeft} y1={marginTop + cellH * i} x2={marginLeft - 2} y2={marginTop + cellH * i}
              stroke={STROKE_FAINT} strokeWidth={0.5} />
            <text x={marginLeft - tickLen / 2 - 2} y={y} textAnchor="middle" dominantBaseline="middle"
              fontSize={6} fill={STROKE_LIGHT} fontFamily={FONT}>{rowLabels[i]}</text>
          </g>
        );
      })}
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TITLE BLOCK (bottom-right cartouche)
// ═══════════════════════════════════════════════════════════════════════════════

function TitleBlock({ x, y, w, h, config, fr, totalStrings, panelsPerString, inverterCount }: {
  x: number; y: number; w: number; h: number;
  config: SLDElectricalConfig; fr: boolean;
  totalStrings: number; panelsPerString: number; inverterCount: number;
}) {
  const col1W = w * 0.4;
  const col2W = w * 0.6;
  const rowH = 11;
  const topSection = h * 0.35;

  const invModelName = config.inverterType === "string"
    ? (config.stringInverterModelName || DEFAULT_STRING_INV_NAME)
    : (config.microInverterModelName || DEFAULT_MICRO_INV_NAME);
  const invPower = config.inverterType === "string"
    ? `${config.stringInverterPowerKW || DEFAULT_STRING_INV_KW} kW`
    : `${config.microInverterPowerW || DEFAULT_MICRO_INV_W} W`;

  const summaryRows = fr ? [
    ["Module PV", "Jinko JKM660N-78HL4-BDV (660W)"],
    ["Modules totaux", `${config.totalPanels || 0}`],
    ["Modules/chaîne", `${panelsPerString}`],
    ["Chaînes totales", `${totalStrings}`],
    ["Onduleur", invModelName],
    ["Puissance ond.", invPower],
    ["Puissance totale", `${config.systemCapacityKW || 0} kWc`],
    ["Onduleurs", `${inverterCount}`],
  ] : [
    ["PV Module", "Jinko JKM660N-78HL4-BDV (660W)"],
    ["Total Modules", `${config.totalPanels || 0}`],
    ["Modules/String", `${panelsPerString}`],
    ["Total Strings", `${totalStrings}`],
    ["Inverter", invModelName],
    ["Inv. Power", invPower],
    ["Total Capacity", `${config.systemCapacityKW || 0} kWp`],
    ["Inverters", `${inverterCount}`],
  ];

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="white" stroke={STROKE} strokeWidth={1.5} />

      {/* Top: Logo + title */}
      <line x1={x} y1={y + topSection} x2={x + w} y2={y + topSection} stroke={STROKE} strokeWidth={0.5} />
      <image href={KWH_LOGO_DATA_URI} x={x + 6} y={y + 4} width={70} height={28} preserveAspectRatio="xMidYMid meet" />
      <text x={x + w / 2 + 20} y={y + 12} textAnchor="middle" fontSize={8} fontWeight={700} fill={STROKE} fontFamily={FONT}>
        {fr ? "SCHÉMA UNIFILAIRE" : "SINGLE LINE DIAGRAM"}
      </text>
      <text x={x + w / 2 + 20} y={y + 22} textAnchor="middle" fontSize={7} fill={STROKE_LIGHT} fontFamily={FONT}>
        {config.siteName || config.siteAddress || ""}
      </text>
      <text x={x + w - 8} y={y + topSection - 4} textAnchor="end" fontSize={6} fill={STROKE_LIGHT} fontFamily={FONT}>
        SLD-001 | {fr ? "Rév. 0" : "Rev. 0"} | {new Date().toISOString().slice(0, 10)}
      </text>

      {/* Bottom: Summary table */}
      <rect x={x} y={y + topSection} width={w} height={12} fill={STROKE} />
      <text x={x + w / 2} y={y + topSection + 8} textAnchor="middle" fontSize={6.5} fontWeight={700}
        fill="white" fontFamily={FONT}>
        {fr ? "RÉCAPITULATIF" : "SUMMARY"}
      </text>
      {summaryRows.map((row, i) => {
        const ry = y + topSection + 12 + i * rowH;
        return (
          <g key={i}>
            {i % 2 === 0 && <rect x={x} y={ry} width={w} height={rowH} fill="#f8fafc" />}
            <line x1={x + col1W} y1={ry} x2={x + col1W} y2={ry + rowH} stroke="#e2e8f0" strokeWidth={0.3} />
            <text x={x + 4} y={ry + rowH / 2 + 1} fontSize={6} fill={STROKE_LIGHT} fontFamily={FONT}
              dominantBaseline="middle">{row[0]}</text>
            <text x={x + col1W + 4} y={ry + rowH / 2 + 1} fontSize={6} fill={STROKE} fontWeight={600}
              fontFamily={FONT} dominantBaseline="middle">{row[1]}</text>
          </g>
        );
      })}

      {/* Warning */}
      <text x={x + w / 2} y={y + h - 10} textAnchor="middle" fontSize={6} fontWeight={700}
        fill="#dc2626" fontFamily={FONT}>
        {fr ? "CONCEPTION PRÉLIMINAIRE — PAS POUR LA CONSTRUCTION" : "PRELIMINARY DESIGN — NOT FOR CONSTRUCTION"}
      </text>
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STRING INVERTER SLD — VERTICAL LAYOUT
// ═══════════════════════════════════════════════════════════════════════════════

function StringInverterSLD({
  inverters, config, arrays, language = "fr"
}: {
  inverters: SLDInverterAssignment[];
  config: SLDElectricalConfig;
  arrays: SLDArrayInfo[];
  language: "fr" | "en";
}) {
  const fr = language === "fr";
  const serviceV = config.serviceVoltage || 600;
  const serviceA = config.serviceAmperage || 400;
  const mainBreakerA = config.mainBreakerA || 200;

  const showMax = 3;
  const showAll = inverters.length <= showMax;
  const displayInverters = showAll ? inverters : [inverters[0], inverters[Math.floor(inverters.length / 2)], inverters[inverters.length - 1]];
  const hiddenCount = showAll ? 0 : inverters.length - showMax;

  const invColW = 120;
  const gapCol = hiddenCount > 0 ? 60 : 0;
  const displayCount = displayInverters.length;

  const marginLeft = 20;
  const marginTop = 18;
  const titleBlockW = 220;
  const titleBlockH = 140;

  const pvZoneW = Math.max(displayCount * invColW + gapCol, 300);
  const innerW = pvZoneW + 60;
  const totalW = innerW + marginLeft * 2 + titleBlockW;

  const rowGrid = marginTop + 30;
  const rowBreaker1 = rowGrid + 55;
  const rowMeter = rowBreaker1 + 50;
  const rowTransformer = rowMeter + 65;
  const rowGround = rowTransformer + 40;
  const rowACCombiner = rowGround + 55;
  const rowACBreakerTop = rowACCombiner + 60;
  const rowPVZoneTop = rowACBreakerTop + 45;
  const rowInverter = rowPVZoneTop + 55;
  const rowDCCombiner = rowInverter + 65;
  const rowDCFuse = rowDCCombiner + 55;
  const rowPVStrings = rowDCFuse + 55;
  const rowPVZoneBottom = rowPVStrings + 45;

  const totalH = rowPVZoneBottom + 30 + marginTop;
  const centerX = marginLeft + innerW / 2;

  const panelsPerString = inverters.length > 0 && inverters[0].strings.length > 0
    ? inverters[0].strings[0].panelsInString : MAX_PANELS_PER_STRING;
  const totalStrings = inverters.reduce((s, inv) => s + inv.strings.length, 0);

  const getInvX = (dispIdx: number) => {
    if (showAll) {
      const blockStart = marginLeft + (innerW - displayCount * invColW) / 2;
      return blockStart + dispIdx * invColW + invColW / 2;
    }
    const blockStart = marginLeft + (innerW - (displayCount * invColW + gapCol)) / 2;
    if (dispIdx === 0) return blockStart + invColW / 2;
    if (dispIdx === 1 && hiddenCount > 0) return blockStart + invColW + gapCol / 2;
    if (dispIdx === 1 && hiddenCount === 0) return blockStart + invColW + invColW / 2;
    return blockStart + (displayCount - 1) * invColW + gapCol + invColW / 2;
  };

  return (
    <svg
      viewBox={`0 0 ${totalW} ${totalH}`}
      width="100%"
      style={{ maxWidth: totalW, background: "white" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <GridBorder width={totalW - titleBlockW} height={totalH} marginLeft={marginLeft} marginTop={marginTop}
        innerW={innerW} innerH={totalH - marginTop * 2} />

      {/* ═══ ROW 1: UTILITY POLE + GRID CONNECTION ═══ */}
      <UtilityPole cx={centerX + 80} cy={rowGrid} />
      <text x={centerX + 80} y={rowGrid + 26} textAnchor="middle" fontSize={7} fill={STROKE_LIGHT} fontFamily={FONT}>
        {fr ? "Nouveau Poteau" : "Utility Pole"}
      </text>
      <text x={centerX + 80} y={rowGrid + 34} textAnchor="middle" fontSize={6} fill={STROKE_LIGHT} fontFamily={FONT}>
        MT
      </text>
      <line x1={centerX + 80} y1={rowGrid + 15} x2={centerX + 80} y2={rowGrid + 45}
        stroke={STROKE} strokeWidth={1} strokeDasharray="4 2" />

      {/* ═══ ROW 2: MAIN BREAKER ═══ */}
      <text x={centerX - 30} y={rowBreaker1 - 5} textAnchor="end" fontSize={7} fill={STROKE} fontWeight={600} fontFamily={FONT}>
        {`${serviceA}A`}
      </text>
      <IECBreakerV cx={centerX} y1={rowBreaker1 - 12} length={24} />
      <line x1={centerX} y1={rowGrid + 45} x2={centerX} y2={rowBreaker1 - 12} stroke={STROKE} strokeWidth={1.5} />

      {/* ═══ ROW 3: PRODUCTION METER ═══ */}
      <line x1={centerX} y1={rowBreaker1 + 12} x2={centerX} y2={rowMeter - 16} stroke={STROKE} strokeWidth={1.5} />
      <IECMeterV cx={centerX} cy={rowMeter} r={16} />
      <text x={centerX + 24} y={rowMeter} fontSize={7} fill={STROKE_LIGHT} fontFamily={FONT} dominantBaseline="middle">
        {`${serviceA}A`}
      </text>

      {/* ═══ ROW 4: TRANSFORMER ═══ */}
      <line x1={centerX} y1={rowMeter + 16} x2={centerX} y2={rowTransformer - 25} stroke={STROKE} strokeWidth={1.5} />
      <IECTransformerV cx={centerX} cy={rowTransformer} size={50} />
      <text x={centerX + 35} y={rowTransformer} fontSize={7} fill={STROKE_LIGHT} fontFamily={FONT} dominantBaseline="middle">
        {`${Math.round((config.systemCapacityKW || 100) * 1.2)}kVA`}
      </text>

      {/* ═══ AUXILIARY SERVICE + GROUND ═══ */}
      <line x1={centerX - 35} y1={rowTransformer} x2={centerX - 60} y2={rowTransformer}
        stroke={STROKE} strokeWidth={1} />
      <IECBreakerV cx={centerX - 60} y1={rowTransformer} length={18} />
      <IECGroundV cx={centerX - 60} topY={rowTransformer + 20} />
      <text x={centerX - 60} y={rowGround + 15} textAnchor="middle" fontSize={6} fill={STROKE_LIGHT} fontFamily={FONT}>
        {fr ? "Service auxiliaire" : "Auxiliary service"}
      </text>

      {/* ═══ ROW 5: AC COMBINER BOX ═══ */}
      <line x1={centerX} y1={rowTransformer + 25} x2={centerX} y2={rowACCombiner - 5} stroke={STROKE} strokeWidth={1.5} />
      <text x={marginLeft + 10} y={rowACCombiner - 10} fontSize={8} fontWeight={600} fill={STROKE} fontFamily={FONT}>
        {fr ? "Boîte de combinaison AC" : "AC Combiner Box"}
      </text>
      {(() => {
        const acBoxW = Math.min(pvZoneW - 20, displayCount * invColW + (hiddenCount > 0 ? gapCol : 0) + 40);
        const acBoxX = centerX - acBoxW / 2;
        const acBoxH = 40;
        return (
          <g>
            <rect x={acBoxX} y={rowACCombiner} width={acBoxW} height={acBoxH}
              fill="white" stroke={STROKE} strokeWidth={1.5} rx={2} />
            <text x={centerX} y={rowACCombiner - 2} textAnchor="middle" fontSize={7} fill={STROKE_LIGHT} fontFamily={FONT}>
              {`${Math.round((config.systemCapacityKW || 100) * 1000 / serviceV * 1.25)}A`}
            </text>

            <line x1={centerX} y1={rowACCombiner - 5} x2={centerX} y2={rowACCombiner} stroke={STROKE} strokeWidth={1.5} />

            {displayInverters.map((inv, dispIdx) => {
              const ix = getInvX(dispIdx);
              const breakerA = Math.round(inv.powerKW * 1000 / serviceV * 1.25);
              return (
                <g key={inv.inverterId}>
                  <text x={ix} y={rowACCombiner + 12} textAnchor="middle" fontSize={7} fill={STROKE_LIGHT} fontFamily={FONT}>
                    {`${breakerA}A`}
                  </text>
                  <IECBreakerV cx={ix} y1={rowACCombiner + 15} length={18} />
                  <line x1={ix} y1={rowACCombiner + acBoxH} x2={ix} y2={rowACBreakerTop}
                    stroke={STROKE} strokeWidth={1.2} />
                </g>
              );
            })}

            {hiddenCount > 0 && (() => {
              const gapCx = getInvX(1);
              return (
                <g>
                  <text x={gapCx} y={rowACCombiner + acBoxH / 2 + 2} textAnchor="middle" fontSize={14}
                    fill={STROKE_FAINT} fontFamily={FONT}>{"..."}</text>
                </g>
              );
            })()}
          </g>
        );
      })()}

      {/* ═══ ZONE CHAMPS PV (dashed box) ═══ */}
      {(() => {
        const zoneMargin = 15;
        const zoneX = marginLeft + zoneMargin;
        const zoneW = innerW - zoneMargin * 2;
        return (
          <g>
            <rect x={zoneX} y={rowPVZoneTop - 15} width={zoneW} height={rowPVZoneBottom - rowPVZoneTop + 30}
              fill="none" stroke={STROKE} strokeWidth={1} strokeDasharray="8 4" rx={4} />
            <text x={zoneX + 8} y={rowPVZoneTop - 3} fontSize={8} fontWeight={600} fill={STROKE} fontFamily={FONT}>
              ZONE CHAMPS PV
            </text>
          </g>
        );
      })()}

      {/* ═══ INVERTER COLUMNS ═══ */}
      {displayInverters.map((inv, dispIdx) => {
        const ix = getInvX(dispIdx);
        const isMiddleGap = !showAll && dispIdx === 1;

        if (isMiddleGap) {
          return (
            <g key={`gap-${inv.inverterId}`}>
              <text x={ix} y={rowInverter} textAnchor="middle" fontSize={14}
                fill={STROKE_FAINT} fontFamily={FONT}>{"..."}</text>
              <text x={ix} y={rowInverter + 16} textAnchor="middle" fontSize={7}
                fill={STROKE_LIGHT} fontFamily={FONT}>
                {fr ? `× ${inverters.length} onduleurs` : `× ${inverters.length} inverters`}
              </text>
              <text x={ix} y={rowInverter + 26} textAnchor="middle" fontSize={6}
                fill={STROKE_LIGHT} fontFamily={FONT}>
                {fr ? "identiques" : "identical"}
              </text>
            </g>
          );
        }

        const breakerA = Math.round(inv.powerKW * 1000 / serviceV * 1.25);

        return (
          <g key={inv.inverterId}>
            {/* AC Breaker for this inverter */}
            <IECBreakerV cx={ix} y1={rowACBreakerTop} length={20} />
            <text x={ix + 18} y={rowACBreakerTop + 10} fontSize={6} fill={STROKE_LIGHT} fontFamily={FONT}>
              {`${breakerA}A`}
            </text>

            {/* Vertical line to inverter */}
            <line x1={ix} y1={rowACBreakerTop + 20} x2={ix} y2={rowInverter - 18} stroke={STROKE} strokeWidth={1.2} />

            {/* Inverter */}
            <IECInverterV cx={ix} cy={rowInverter} size={36} />
            <text x={ix} y={rowInverter + 24} textAnchor="middle" fontSize={7} fontWeight={600} fill={STROKE} fontFamily={FONT}>
              {`Onduleur H-${inv.inverterId}`}
            </text>
            <text x={ix} y={rowInverter + 33} textAnchor="middle" fontSize={6} fill={STROKE_LIGHT} fontFamily={FONT}>
              {`${inv.powerKW}kW`}
            </text>

            {/* Vertical line to DC Combiner */}
            <line x1={ix} y1={rowInverter + 36} x2={ix} y2={rowDCCombiner - 5} stroke={STROKE} strokeWidth={1.2} />

            {/* DC Combiner Box */}
            <IECCombinerBoxV
              x={ix - 40} y={rowDCCombiner} w={80} h={30}
              label={fr ? `Boîte de combinaison CC` : "DC Combiner Box"}
              fuseCount={Math.min(inv.strings.length, 4)}
            />
            <text x={ix} y={rowDCCombiner - 7} textAnchor="middle" fontSize={6} fill={STROKE_LIGHT} fontFamily={FONT}>
              {`${Math.round(inv.totalCapacityKW * 1000 / serviceV)}A`}
            </text>
            <text x={ix} y={rowDCCombiner + 42 + 10} textAnchor="middle" fontSize={6} fill={STROKE_LIGHT} fontFamily={FONT}>
              {`${inv.totalCapacityKW}kWc`}
            </text>

            {/* DC Fuses */}
            {(() => {
              const maxShow = 2;
              const showAllStr = inv.strings.length <= maxShow;
              const displayStr = showAllStr ? inv.strings : [inv.strings[0], inv.strings[inv.strings.length - 1]];
              const strSpacing = 30;
              const startX = ix - ((displayStr.length - 1) * strSpacing) / 2;

              return (
                <g>
                  {displayStr.map((str, si) => {
                    const sx = startX + si * strSpacing;
                    return (
                      <g key={str.stringId}>
                        <line x1={sx} y1={rowDCCombiner + 30} x2={sx} y2={rowDCFuse} stroke={STROKE} strokeWidth={1} />
                        <IECFuseV cx={sx} y={rowDCFuse} length={14} />
                        <text x={sx + 10} y={rowDCFuse + 7} fontSize={5.5} fill={STROKE_LIGHT} fontFamily={FONT}>
                          {`${Math.round(PANEL_ISC * 1.56)}A`}
                        </text>
                        <line x1={sx} y1={rowDCFuse + 14} x2={sx} y2={rowPVStrings - 12} stroke={STROKE} strokeWidth={1} strokeDasharray="4 2" />
                        <text x={sx} y={rowDCFuse + 26} textAnchor="middle" fontSize={5} fill={STROKE_LIGHT} fontFamily={FONT}>2×</text>
                        <IECPVModuleV cx={sx} cy={rowPVStrings} />
                        <text x={sx} y={rowPVStrings + 16} textAnchor="middle" fontSize={6} fill={STROKE_LIGHT} fontFamily={FONT}>
                          {fr ? `Chaîne` : "String"}
                        </text>
                        <text x={sx} y={rowPVStrings + 24} textAnchor="middle" fontSize={6} fill={STROKE_LIGHT} fontFamily={FONT}>
                          PV-{str.stringId}
                        </text>
                      </g>
                    );
                  })}

                  {!showAllStr && (
                    <g>
                      <text x={ix} y={rowDCFuse + 7} textAnchor="middle" fontSize={10} fill={STROKE_FAINT} fontFamily={FONT}>
                        {"..."}
                      </text>
                      <text x={ix} y={rowPVStrings + 24} textAnchor="middle" fontSize={6} fill={STROKE_LIGHT} fontFamily={FONT}>
                        {fr ? `× ${inv.strings.length} chaînes` : `× ${inv.strings.length} strings`}
                      </text>
                    </g>
                  )}
                </g>
              );
            })()}
          </g>
        );
      })}

      {/* ═══ TITLE BLOCK ═══ */}
      <TitleBlock
        x={totalW - titleBlockW - 1} y={totalH - titleBlockH - 1}
        w={titleBlockW} h={titleBlockH}
        config={config} fr={fr}
        totalStrings={totalStrings}
        panelsPerString={panelsPerString}
        inverterCount={inverters.length}
      />

      {/* NOTE block top-right */}
      <g>
        <rect x={totalW - titleBlockW - 1} y={1} width={titleBlockW} height={40} fill="white" stroke={STROKE} strokeWidth={1} />
        <text x={totalW - titleBlockW + 8} y={14} fontSize={7} fontWeight={700} fill={STROKE} fontFamily={FONT}>NOTE</text>
        <line x1={totalW - titleBlockW + 8} y1={17} x2={totalW - titleBlockW + 35} y2={17} stroke={STROKE} strokeWidth={0.5} />
        <text x={totalW - titleBlockW + 8} y={28} fontSize={6} fill={STROKE_LIGHT} fontFamily={FONT}>
          {fr ? "Ce document est un document type et" : "This is a typical drawing and"}
        </text>
        <text x={totalW - titleBlockW + 8} y={36} fontSize={6} fill={STROKE_LIGHT} fontFamily={FONT}>
          {fr ? "non pas pour la construction." : "not for construction."}
        </text>
      </g>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MICRO INVERTER SLD — VERTICAL LAYOUT
// ═══════════════════════════════════════════════════════════════════════════════

function MicroInverterSLD({
  groups, config, arrays, language = "fr"
}: {
  groups: SLDMicroInverterGroup[];
  config: SLDElectricalConfig;
  arrays: SLDArrayInfo[];
  language: "fr" | "en";
}) {
  const fr = language === "fr";
  const serviceV = config.serviceVoltage || 240;
  const serviceA = config.serviceAmperage || 200;
  const mainBreakerA = config.mainBreakerA || 200;
  const microW = config.microInverterPowerW || DEFAULT_MICRO_INV_W;

  const showMax = 3;
  const showAll = groups.length <= showMax;
  const displayGroups = showAll ? groups : [groups[0], groups[Math.floor(groups.length / 2)], groups[groups.length - 1]];
  const hiddenCount = showAll ? 0 : groups.length - showMax;
  const displayCount = displayGroups.length;

  const grpColW = 120;
  const gapCol = hiddenCount > 0 ? 60 : 0;

  const marginLeft = 20;
  const marginTop = 18;
  const titleBlockW = 220;
  const titleBlockH = 140;

  const pvZoneW = Math.max(displayCount * grpColW + gapCol, 300);
  const innerW = pvZoneW + 60;
  const totalW = innerW + marginLeft * 2 + titleBlockW;

  const rowGrid = marginTop + 30;
  const rowBreaker1 = rowGrid + 55;
  const rowMeter = rowBreaker1 + 50;
  const rowACPanel = rowMeter + 55;
  const rowPVZoneTop = rowACPanel + 55;
  const rowBranchBreaker = rowPVZoneTop + 40;
  const rowMicroInv = rowBranchBreaker + 55;
  const rowPVArrays = rowMicroInv + 55;
  const rowPVZoneBottom = rowPVArrays + 45;

  const totalH = rowPVZoneBottom + 30 + marginTop;
  const centerX = marginLeft + innerW / 2;

  const getGrpX = (dispIdx: number) => {
    if (showAll) {
      const blockStart = marginLeft + (innerW - displayCount * grpColW) / 2;
      return blockStart + dispIdx * grpColW + grpColW / 2;
    }
    const blockStart = marginLeft + (innerW - (displayCount * grpColW + gapCol)) / 2;
    if (dispIdx === 0) return blockStart + grpColW / 2;
    if (dispIdx === 1 && hiddenCount > 0) return blockStart + grpColW + gapCol / 2;
    if (dispIdx === 1 && hiddenCount === 0) return blockStart + grpColW + grpColW / 2;
    return blockStart + (displayCount - 1) * grpColW + gapCol + grpColW / 2;
  };

  return (
    <svg
      viewBox={`0 0 ${totalW} ${totalH}`}
      width="100%"
      style={{ maxWidth: totalW, background: "white" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <GridBorder width={totalW - titleBlockW} height={totalH} marginLeft={marginLeft} marginTop={marginTop}
        innerW={innerW} innerH={totalH - marginTop * 2} />

      {/* Grid connection */}
      <UtilityPole cx={centerX + 60} cy={rowGrid} />
      <text x={centerX + 60} y={rowGrid + 28} textAnchor="middle" fontSize={7} fill={STROKE_LIGHT} fontFamily={FONT}>
        {fr ? "Réseau" : "Grid"}
      </text>

      {/* Main breaker */}
      <line x1={centerX} y1={rowGrid + 20} x2={centerX} y2={rowBreaker1 - 12} stroke={STROKE} strokeWidth={1.5} />
      <IECBreakerV cx={centerX} y1={rowBreaker1 - 12} length={24} />
      <text x={centerX - 24} y={rowBreaker1} fontSize={7} fill={STROKE} fontWeight={600} fontFamily={FONT} textAnchor="end">
        {`${serviceA}A`}
      </text>

      {/* Meter */}
      <line x1={centerX} y1={rowBreaker1 + 12} x2={centerX} y2={rowMeter - 16} stroke={STROKE} strokeWidth={1.5} />
      <IECMeterV cx={centerX} cy={rowMeter} r={16} />

      {/* Main panel */}
      <line x1={centerX} y1={rowMeter + 16} x2={centerX} y2={rowACPanel - 20} stroke={STROKE} strokeWidth={1.5} />
      <rect x={centerX - 40} y={rowACPanel - 20} width={80} height={35}
        fill="white" stroke={STROKE} strokeWidth={1.5} rx={2} />
      <text x={centerX} y={rowACPanel} textAnchor="middle" dominantBaseline="middle" fontSize={7} fontWeight={600}
        fill={STROKE} fontFamily={FONT}>{fr ? "Panneau principal" : "Main Panel"}</text>
      <text x={centerX} y={rowACPanel + 10} textAnchor="middle" fontSize={6} fill={STROKE_LIGHT} fontFamily={FONT}>
        {`${mainBreakerA}A / ${serviceV}V`}
      </text>
      <IECGroundV cx={centerX + 50} topY={rowACPanel - 5} />

      {/* Bus line to branches */}
      <line x1={centerX} y1={rowACPanel + 15} x2={centerX} y2={rowPVZoneTop} stroke={STROKE} strokeWidth={1.5} />

      {/* ZONE CHAMPS PV */}
      {(() => {
        const zoneMargin = 15;
        const zoneX = marginLeft + zoneMargin;
        const zoneW = innerW - zoneMargin * 2;
        return (
          <g>
            <rect x={zoneX} y={rowPVZoneTop - 12} width={zoneW} height={rowPVZoneBottom - rowPVZoneTop + 24}
              fill="none" stroke={STROKE} strokeWidth={1} strokeDasharray="8 4" rx={4} />
            <text x={zoneX + 8} y={rowPVZoneTop} fontSize={8} fontWeight={600} fill={STROKE} fontFamily={FONT}>
              ZONE CHAMPS PV
            </text>
          </g>
        );
      })()}

      {/* Horizontal bus */}
      {(() => {
        const firstX = getGrpX(0);
        const lastX = getGrpX(displayCount - 1);
        return (
          <line x1={firstX} y1={rowBranchBreaker - 10} x2={lastX} y2={rowBranchBreaker - 10}
            stroke={STROKE} strokeWidth={1.5} />
        );
      })()}
      <line x1={centerX} y1={rowPVZoneTop} x2={centerX} y2={rowBranchBreaker - 10}
        stroke={STROKE} strokeWidth={1.5} />

      {/* Branch groups */}
      {displayGroups.map((grp, dispIdx) => {
        const gx = getGrpX(dispIdx);
        const isMiddleGap = !showAll && dispIdx === 1;

        if (isMiddleGap) {
          return (
            <g key={`gap-${grp.arrayId}`}>
              <text x={gx} y={rowMicroInv} textAnchor="middle" fontSize={14}
                fill={STROKE_FAINT} fontFamily={FONT}>{"..."}</text>
              <text x={gx} y={rowMicroInv + 16} textAnchor="middle" fontSize={7}
                fill={STROKE_LIGHT} fontFamily={FONT}>
                {fr ? `× ${groups.length} groupes` : `× ${groups.length} groups`}
              </text>
            </g>
          );
        }

        return (
          <g key={grp.arrayId}>
            <line x1={gx} y1={rowBranchBreaker - 10} x2={gx} y2={rowBranchBreaker} stroke={STROKE} strokeWidth={1.2} />
            <IECBreakerV cx={gx} y1={rowBranchBreaker} length={20} />
            <text x={gx + 16} y={rowBranchBreaker + 10} fontSize={6} fill={STROKE_LIGHT} fontFamily={FONT}>
              {`${Math.ceil(grp.acBranchCircuitA)}A`}
            </text>

            <line x1={gx} y1={rowBranchBreaker + 20} x2={gx} y2={rowMicroInv - 18} stroke={STROKE} strokeWidth={1.2} />

            <IECInverterV cx={gx} cy={rowMicroInv} size={36} />
            <text x={gx} y={rowMicroInv + 24} textAnchor="middle" fontSize={7} fontWeight={600} fill={STROKE} fontFamily={FONT}>
              {`${grp.panelCount}× μINV`}
            </text>
            <text x={gx} y={rowMicroInv + 33} textAnchor="middle" fontSize={6} fill={STROKE_LIGHT} fontFamily={FONT}>
              {`${microW}W ${fr ? "chaque" : "each"}`}
            </text>

            <line x1={gx} y1={rowMicroInv + 36} x2={gx} y2={rowPVArrays - 14} stroke={STROKE} strokeWidth={1.2} strokeDasharray="4 2" />

            <IECPVModuleV cx={gx} cy={rowPVArrays} />
            <text x={gx} y={rowPVArrays + 16} textAnchor="middle" fontSize={6} fill={STROKE_LIGHT} fontFamily={FONT}>
              {`Array #${grp.arrayId}`}
            </text>
            <text x={gx} y={rowPVArrays + 24} textAnchor="middle" fontSize={6} fill={STROKE_LIGHT} fontFamily={FONT}>
              {`${grp.panelCount} pan. / ${grp.capacityKW}kW`}
            </text>
          </g>
        );
      })}

      {/* Title block */}
      <TitleBlock
        x={totalW - titleBlockW - 1} y={totalH - titleBlockH - 1}
        w={titleBlockW} h={titleBlockH}
        config={config} fr={fr}
        totalStrings={groups.length}
        panelsPerString={groups.length > 0 ? groups[0].panelCount : 0}
        inverterCount={groups.reduce((s, g) => s + g.panelCount, 0)}
      />

      <g>
        <rect x={totalW - titleBlockW - 1} y={1} width={titleBlockW} height={40} fill="white" stroke={STROKE} strokeWidth={1} />
        <text x={totalW - titleBlockW + 8} y={14} fontSize={7} fontWeight={700} fill={STROKE} fontFamily={FONT}>NOTE</text>
        <line x1={totalW - titleBlockW + 8} y1={17} x2={totalW - titleBlockW + 35} y2={17} stroke={STROKE} strokeWidth={0.5} />
        <text x={totalW - titleBlockW + 8} y={28} fontSize={6} fill={STROKE_LIGHT} fontFamily={FONT}>
          {fr ? "Ce document est un document type et" : "This is a typical drawing and"}
        </text>
        <text x={totalW - titleBlockW + 8} y={36} fontSize={6} fill={STROKE_LIGHT} fontFamily={FONT}>
          {fr ? "non pas pour la construction." : "not for construction."}
        </text>
      </g>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function SLDDiagram({ arrays, config, language = "fr", width, height }: SLDDiagramProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const fr = language === "fr";

  const inverterLayout = useMemo(() => {
    if (config.inverterType === "string") {
      return calculateStringInverterLayout(
        arrays,
        config.stringInverterPowerKW || DEFAULT_STRING_INV_KW,
        config.stringInverterModelName || DEFAULT_STRING_INV_NAME
      );
    }
    return null;
  }, [arrays, config]);

  const microLayout = useMemo(() => {
    if (config.inverterType === "micro") {
      return calculateMicroInverterLayout(
        arrays,
        config.microInverterPowerW || DEFAULT_MICRO_INV_W
      );
    }
    return null;
  }, [arrays, config]);

  const getSVGString = useCallback((): string | null => {
    const container = svgRef.current;
    if (!container) return null;
    const svgEl = container.querySelector?.("svg") || container;
    if (!svgEl) return null;
    const serializer = new XMLSerializer();
    return serializer.serializeToString(svgEl);
  }, []);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      (node as any).__getSVGString = getSVGString;
    }
    (svgRef as any).current = node;
  }, [getSVGString]);

  if (!arrays || arrays.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {fr
          ? "Aucun array PV défini. Configurez d'abord le système sur l'onglet Analyse."
          : "No PV arrays defined. Configure the system in the Analysis tab first."}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="sld-diagram-container overflow-x-auto">
      {config.inverterType === "string" && inverterLayout && (
        <StringInverterSLD
          inverters={inverterLayout}
          config={config}
          arrays={arrays}
          language={language}
        />
      )}
      {config.inverterType === "micro" && microLayout && (
        <MicroInverterSLD
          groups={microLayout}
          config={config}
          arrays={arrays}
          language={language}
        />
      )}

      <div className="mt-4 text-xs text-muted-foreground space-y-1 px-2">
        <div className="flex justify-between border-b pb-1">
          <span className="font-medium">{fr ? "Résumé électrique" : "Electrical Summary"}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-0.5">
          <span>{fr ? "Puissance DC totale" : "Total DC Power"}: <strong>{config.systemCapacityKW} kWc</strong></span>
          <span>{fr ? "Panneaux" : "Panels"}: <strong>{config.totalPanels}× Jinko 660W</strong></span>
          <span>{fr ? "Type onduleur" : "Inverter Type"}: <strong>{config.inverterType === "string"
            ? (fr ? "String (centralisé)" : "String (central)")
            : (fr ? "Micro-onduleurs" : "Microinverters")}</strong></span>
          {config.inverterType === "string" && inverterLayout && (
            <>
              <span>{fr ? "Nombre d'onduleurs" : "Inverter Count"}: <strong>{inverterLayout.length}× {config.stringInverterPowerKW || DEFAULT_STRING_INV_KW} kW</strong></span>
              <span>{fr ? "Strings totaux" : "Total Strings"}: <strong>{inverterLayout.reduce((s, inv) => s + inv.strings.length, 0)}</strong></span>
              <span>Voc max/string: <strong>{Math.round(MAX_PANELS_PER_STRING * PANEL_VOC * TEMP_CORRECTION_VOC)}V</strong> ({"<"} {MAX_SYSTEM_VOLTAGE_DC}V)</span>
            </>
          )}
          {config.inverterType === "micro" && microLayout && (
            <>
              <span>{fr ? "Micro-onduleurs" : "Microinverters"}: <strong>{microLayout.reduce((s, g) => s + g.panelCount, 0)}× {config.microInverterPowerW || DEFAULT_MICRO_INV_W}W</strong></span>
              <span>{fr ? "Circuits branche" : "Branch Circuits"}: <strong>{microLayout.length}</strong></span>
            </>
          )}
          <span>{fr ? "Tension service" : "Service Voltage"}: <strong>{config.serviceVoltage || 600}V / {config.serviceAmperage || 400}A</strong></span>
        </div>
      </div>
    </div>
  );
}

/**
 * SLD (Single Line Diagram) — Schéma unifilaire interactif
 *
 * Génère automatiquement un SLD basé sur les arrays modulaires du système PV.
 * Supporte string inverters et micro-inverters.
 *
 * Conventions:
 * - Jinko 660W panels, Voc = 49.85V, Isc = 17.28A
 * - String inverters: max 1000V DC (CSA), ~13 panels/string max
 * - Micro-inverters: 1 per panel, AC bus daisy-chain
 * - IFC/CSA compliant labeling
 */

import React, { useMemo, useRef, useCallback } from "react";
import { KWH_LOGO_DATA_URI } from "./sld-logo-data";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

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
  // String inverter config
  stringInverterModelName?: string;
  stringInverterPowerKW?: number;
  // Micro inverter config
  microInverterModelName?: string;
  microInverterPowerW?: number;
  // Electrical service
  serviceVoltage?: number; // 120/240, 347/600, etc.
  serviceAmperage?: number;
  mainBreakerA?: number;
  // Site info
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
    vocString: number; // Voc × panels
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

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS — Jinko 660W JKM660N-78HL4-BDV
// ═══════════════════════════════════════════════════════════════════════════════

const PANEL_WATT = 660;
const PANEL_VOC = 49.85; // V — Open circuit voltage at STC
const PANEL_ISC = 17.28; // A — Short circuit current at STC
const PANEL_VMP = 41.69; // V — Max power voltage
const PANEL_IMP = 15.84; // A — Max power current

// String sizing — CSA/NEC: max system voltage 1000V DC
const MAX_SYSTEM_VOLTAGE_DC = 1000;
// Temperature correction factor for cold climate (Quebec, -30°C)
// Voc increases ~0.3%/°C below 25°C → factor ≈ 1.165 for -30°C
const TEMP_CORRECTION_VOC = 1.165;
const MAX_PANELS_PER_STRING = Math.floor(MAX_SYSTEM_VOLTAGE_DC / (PANEL_VOC * TEMP_CORRECTION_VOC)); // ~17

// Default string inverter specs (generic 50kW commercial)
const DEFAULT_STRING_INV_KW = 50;
const DEFAULT_STRING_INV_NAME = "Onduleur string 50 kW";
const DEFAULT_STRING_INV_MAX_STRINGS = 10;
const DEFAULT_STRING_INV_MPPT = 4;

// Default micro inverter specs
const DEFAULT_MICRO_INV_W = 800;
const DEFAULT_MICRO_INV_NAME = "Micro-onduleur 800W";
const DEFAULT_MICRO_INV_MAX_PER_BRANCH = 16; // Max micros per AC branch circuit

// SVG layout constants
const SVG_MARGIN = 30;
const ELEMENT_H = 40;
const ELEMENT_W = 120;
const STRING_BOX_W = 90;
const STRING_BOX_H = 32;
const ARRAY_BOX_W = 100;
const ARRAY_BOX_H = 36;
const INV_BOX_W = 110;
const INV_BOX_H = 44;
const COMBINER_W = 80;
const COMBINER_H = 36;
const METER_R = 22;
const PANEL_BOX_W = 70;
const PANEL_BOX_H = 50;
const ROW_GAP = 60;
const COL_GAP = 40;

// ═══════════════════════════════════════════════════════════════════════════════
// ELECTRICAL CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════════

function calculateStringInverterLayout(
  arrays: SLDArrayInfo[],
  invPowerKW: number = DEFAULT_STRING_INV_KW,
  invName: string = DEFAULT_STRING_INV_NAME
): SLDInverterAssignment[] {
  const totalPanels = arrays.reduce((sum, a) => sum + a.panelCount, 0);
  const totalCapacityKW = totalPanels * PANEL_WATT / 1000;

  // Optimal panels per string: maximize without exceeding voltage
  const panelsPerString = Math.min(MAX_PANELS_PER_STRING, 13); // Conservative: 13 panels × 49.85V × 1.165 = 755V

  // Build all strings from all arrays
  const allStrings: { panelsInString: number; arrayId: number }[] = [];

  for (const arr of arrays) {
    let remaining = arr.panelCount;
    while (remaining > 0) {
      const n = Math.min(remaining, panelsPerString);
      if (n >= Math.ceil(panelsPerString * 0.6)) { // Min 60% of target string length
        allStrings.push({ panelsInString: n, arrayId: arr.id });
      } else if (allStrings.length > 0 && allStrings[allStrings.length - 1].arrayId === arr.id) {
        // Add remainder to last string of same array if possible
        allStrings[allStrings.length - 1].panelsInString += n;
      } else {
        allStrings.push({ panelsInString: n, arrayId: arr.id });
      }
      remaining -= n;
    }
  }

  // Assign strings to inverters
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
      // Check if adding this string exceeds inverter DC capacity (typically 1.3× AC rating)
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
    ) / 10, // 125% continuous load factor
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG DRAWING HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function SLDBox({ x, y, w, h, label, sublabel, fill = "#f8fafc", stroke = "#334155", fontSize = 10, bold = false }: {
  x: number; y: number; w: number; h: number; label: string; sublabel?: string;
  fill?: string; stroke?: string; fontSize?: number; bold?: boolean;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={4} fill={fill} stroke={stroke} strokeWidth={1.5} />
      <text x={x + w / 2} y={y + (sublabel ? h / 2 - 5 : h / 2 + 1)} textAnchor="middle" dominantBaseline="middle"
        fontSize={fontSize} fontWeight={bold ? 700 : 500} fill="#1e293b" fontFamily="Inter, system-ui, sans-serif">
        {label}
      </text>
      {sublabel && (
        <text x={x + w / 2} y={y + h / 2 + 8} textAnchor="middle" dominantBaseline="middle"
          fontSize={8} fill="#64748b" fontFamily="Inter, system-ui, sans-serif">
          {sublabel}
        </text>
      )}
    </g>
  );
}

function SLDCircle({ cx, cy, r, label, sublabel, fill = "#f8fafc", stroke = "#334155" }: {
  cx: number; cy: number; r: number; label: string; sublabel?: string;
  fill?: string; stroke?: string;
}) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={1.5} />
      <text x={cx} y={cy - (sublabel ? 4 : 0)} textAnchor="middle" dominantBaseline="middle"
        fontSize={10} fontWeight={600} fill="#1e293b" fontFamily="Inter, system-ui, sans-serif">
        {label}
      </text>
      {sublabel && (
        <text x={cx} y={cy + 10} textAnchor="middle" dominantBaseline="middle"
          fontSize={7} fill="#64748b" fontFamily="Inter, system-ui, sans-serif">
          {sublabel}
        </text>
      )}
    </g>
  );
}

function SLDLine({ x1, y1, x2, y2, dashed = false, color = "#475569" }: {
  x1: number; y1: number; x2: number; y2: number; dashed?: boolean; color?: string;
}) {
  return (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1.5}
      strokeDasharray={dashed ? "4 3" : undefined} />
  );
}

function SLDLabel({ x, y, text, fontSize = 8, color = "#64748b", anchor = "middle" as const }: {
  x: number; y: number; text: string; fontSize?: number; color?: string; anchor?: "start" | "middle" | "end";
}) {
  return (
    <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle"
      fontSize={fontSize} fill={color} fontFamily="Inter, system-ui, sans-serif">
      {text}
    </text>
  );
}

// Wire label annotation
function WireLabel({ x1, y1, x2, y2, label }: {
  x1: number; y1: number; x2: number; y2: number; label: string;
}) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <text x={mx} y={my - 6} textAnchor="middle" dominantBaseline="middle"
      fontSize={7} fill="#94a3b8" fontFamily="Inter, system-ui, sans-serif" fontStyle="italic">
      {label}
    </text>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARTOUCHE (TITLE BLOCK) — Professional engineering drawing border
// ═══════════════════════════════════════════════════════════════════════════════

const CARTOUCHE_RIGHT_PANEL_W = 280;
const CARTOUCHE_BOTTOM_H = 70;
const FONT = "Inter, system-ui, sans-serif";
const BRAND_BLUE = "#003DA6";
const DARK = "#1e293b";

interface SLDCartoucheProps {
  rightPanelX: number;
  rightPanelWidth: number;
  topY: number;
  bottomStripY: number;
  totalWidth: number;
  totalHeight: number;
  config: SLDElectricalConfig;
  arrays: SLDArrayInfo[];
  inverterLayout?: SLDInverterAssignment[] | null;
  microLayout?: SLDMicroInverterGroup[] | null;
  language: "fr" | "en";
}

function SLDCartouche({
  rightPanelX, rightPanelWidth, topY, bottomStripY,
  totalWidth, totalHeight, config, arrays,
  inverterLayout, microLayout, language
}: SLDCartoucheProps) {
  const fr = language === "fr";
  const rpX = rightPanelX;
  const rpW = rightPanelWidth;
  const innerLeft = 4;
  const innerTop = topY;
  const innerRight = totalWidth - 4;
  const innerBottom = totalHeight - 4;

  const companyBlockH = 80;
  const noteBlockH = 50;
  const summaryBlockH = 140;
  const legendBlockStartY = innerTop + companyBlockH + noteBlockH + summaryBlockH;
  const legendBlockH = bottomStripY - legendBlockStartY;

  const totalStrings = inverterLayout
    ? inverterLayout.reduce((s, inv) => s + inv.strings.length, 0)
    : 0;
  const panelsPerString = inverterLayout && inverterLayout.length > 0 && inverterLayout[0].strings.length > 0
    ? inverterLayout[0].strings[0].panelsInString
    : MAX_PANELS_PER_STRING;

  const invModelName = config.inverterType === "string"
    ? (config.stringInverterModelName || DEFAULT_STRING_INV_NAME)
    : (config.microInverterModelName || DEFAULT_MICRO_INV_NAME);

  const invPower = config.inverterType === "string"
    ? `${config.stringInverterPowerKW || DEFAULT_STRING_INV_KW} kW`
    : `${config.microInverterPowerW || DEFAULT_MICRO_INV_W} W`;

  const serviceV = config.serviceVoltage || 600;

  const summaryRows = fr ? [
    ["Modèle de module PV", "Jinko JKM660N-78HL4-BDV (660W)"],
    ["Nombre total des modules PV", `${config.totalPanels || arrays.reduce((s, a) => s + a.panelCount, 0)}`],
    ["Nombre des modules par chaîne", `${panelsPerString}`],
    ["Nombre totale des chaînes", `${totalStrings || arrays.length}`],
    ["Modèle d'onduleur", invModelName],
    ["Puissance/Tension de l'onduleur", `${invPower} / ${serviceV}V`],
    ["Puissance totale de la centrale", `${config.systemCapacityKW || 0} kWc`],
  ] : [
    ["PV Module Model", "Jinko JKM660N-78HL4-BDV (660W)"],
    ["Total PV Modules", `${config.totalPanels || arrays.reduce((s, a) => s + a.panelCount, 0)}`],
    ["Modules per String", `${panelsPerString}`],
    ["Total Strings", `${totalStrings || arrays.length}`],
    ["Inverter Model", invModelName],
    ["Inverter Power/Voltage", `${invPower} / ${serviceV}V`],
    ["Total Plant Capacity", `${config.systemCapacityKW || 0} kWp`],
  ];

  const bottomY = bottomStripY;
  const bH = CARTOUCHE_BOTTOM_H;
  const warnW = totalWidth * 0.35;
  const revW = totalWidth * 0.18;
  const siteW = totalWidth * 0.22;
  const titleW = totalWidth - warnW - revW - siteW;

  return (
    <g>
      <rect x={0} y={0} width={totalWidth} height={totalHeight} fill="none" stroke={DARK} strokeWidth={2} />
      <rect x={4} y={4} width={totalWidth - 8} height={totalHeight - 8} fill="none" stroke={DARK} strokeWidth={0.5} />

      <line x1={rpX} y1={innerTop} x2={rpX} y2={bottomStripY} stroke={DARK} strokeWidth={0.5} />
      <line x1={innerLeft} y1={bottomStripY} x2={innerRight} y2={bottomStripY} stroke={DARK} strokeWidth={0.75} />

      {/* ===== A. COMPANY BLOCK ===== */}
      <line x1={rpX} y1={innerTop + companyBlockH} x2={innerRight} y2={innerTop + companyBlockH} stroke={DARK} strokeWidth={0.5} />
      <image href={KWH_LOGO_DATA_URI} x={rpX + rpW/2 - 60} y={innerTop + 8} width={120} height={48} preserveAspectRatio="xMidYMid meet" />
      <text x={rpX + rpW / 2} y={innerTop + 64} textAnchor="middle" fontSize={7.5} fill="#64748b" fontFamily={FONT}>
        Montréal, QC, Canada — info@kwhquebec.com</text>

      {/* ===== B. NOTE BLOCK ===== */}
      {(() => {
        const noteY = innerTop + companyBlockH;
        return (
          <g>
            <line x1={rpX} y1={noteY + noteBlockH} x2={innerRight} y2={noteY + noteBlockH} stroke={DARK} strokeWidth={0.5} />
            <text x={rpX + 10} y={noteY + 16} fontSize={9} fontWeight={700} fill={DARK} fontFamily={FONT}>NOTE</text>
            <line x1={rpX + 10} y1={noteY + 19} x2={rpX + 42} y2={noteY + 19} stroke={DARK} strokeWidth={0.5} />
            <text x={rpX + 10} y={noteY + 32} fontSize={7.5} fill="#64748b" fontFamily={FONT}>
              {fr ? "Ce document est un document type et" : "This document is a typical drawing and"}
            </text>
            <text x={rpX + 10} y={noteY + 42} fontSize={7.5} fill="#64748b" fontFamily={FONT}>
              {fr ? "non pas pour la construction." : "not for construction."}
            </text>
          </g>
        );
      })()}

      {/* ===== C. SYSTEM SUMMARY TABLE ===== */}
      {(() => {
        const tableY = innerTop + companyBlockH + noteBlockH;
        const headerH = 18;
        const rowH = 17;
        const labelW = rpW * 0.55;
        return (
          <g>
            <rect x={rpX} y={tableY} width={rpW} height={headerH} fill={DARK} />
            <text x={rpX + rpW / 2} y={tableY + 12} textAnchor="middle" fontSize={8} fontWeight={700}
              fill="white" fontFamily={FONT}>
              {fr ? "TABLEAU RÉCAPITULATIF DU SYSTÈME" : "SYSTEM SUMMARY TABLE"}
            </text>
            {summaryRows.map((row, i) => {
              const ry = tableY + headerH + i * rowH;
              const bgFill = i % 2 === 0 ? "#f8fafc" : "white";
              return (
                <g key={i}>
                  <rect x={rpX} y={ry} width={rpW} height={rowH} fill={bgFill} />
                  <line x1={rpX + labelW} y1={ry} x2={rpX + labelW} y2={ry + rowH} stroke="#e2e8f0" strokeWidth={0.5} />
                  <line x1={rpX} y1={ry + rowH} x2={rpX + rpW} y2={ry + rowH} stroke="#e2e8f0" strokeWidth={0.5} />
                  <text x={rpX + 6} y={ry + rowH / 2 + 1} fontSize={7.5} fill="#334155" fontFamily={FONT}
                    dominantBaseline="middle">{row[0]}</text>
                  <text x={rpX + labelW + 6} y={ry + rowH / 2 + 1} fontSize={7.5} fill="#0f172a" fontWeight={600}
                    fontFamily={FONT} dominantBaseline="middle">{row[1]}</text>
                </g>
              );
            })}
            <line x1={rpX} y1={tableY + headerH + summaryRows.length * rowH}
              x2={innerRight} y2={tableY + headerH + summaryRows.length * rowH} stroke={DARK} strokeWidth={0.5} />
          </g>
        );
      })()}

      {/* ===== D. LEGEND BLOCK ===== */}
      {(() => {
        const legY = legendBlockStartY;
        const headerH = 18;
        const entryH = 20;
        const colW = rpW / 2;
        const legendEntries = fr ? [
          { col: 0, row: 0, label: "COURANT CONTINU (DC)", type: "dc" },
          { col: 0, row: 1, label: "COURANT ALTERNATIF (AC)", type: "ac" },
          { col: 0, row: 2, label: "MODULE PV", type: "pv" },
          { col: 0, row: 3, label: "ONDULEUR (DC/AC)", type: "inv" },
          { col: 0, row: 4, label: "TRANSFORMATEUR", type: "transformer" },
          { col: 1, row: 0, label: "COMPTEUR", type: "meter" },
          { col: 1, row: 1, label: "PANNEAU PRINCIPAL", type: "panel" },
          { col: 1, row: 2, label: "MISE À LA TERRE", type: "ground" },
          { col: 1, row: 3, label: "DISJONCTEUR / SECTIONNEUR", type: "breaker" },
          { col: 1, row: 4, label: "FUSIBLE", type: "fuse" },
        ] : [
          { col: 0, row: 0, label: "DIRECT CURRENT (DC)", type: "dc" },
          { col: 0, row: 1, label: "ALTERNATING CURRENT (AC)", type: "ac" },
          { col: 0, row: 2, label: "PV MODULE", type: "pv" },
          { col: 0, row: 3, label: "INVERTER (DC/AC)", type: "inv" },
          { col: 0, row: 4, label: "TRANSFORMER", type: "transformer" },
          { col: 1, row: 0, label: "METER", type: "meter" },
          { col: 1, row: 1, label: "MAIN PANEL", type: "panel" },
          { col: 1, row: 2, label: "GROUNDING", type: "ground" },
          { col: 1, row: 3, label: "BREAKER / DISCONNECT", type: "breaker" },
          { col: 1, row: 4, label: "FUSE", type: "fuse" },
        ];

        return (
          <g>
            <rect x={rpX} y={legY} width={rpW} height={headerH} fill={DARK} />
            <text x={rpX + rpW / 2} y={legY + 12} textAnchor="middle" fontSize={8} fontWeight={700}
              fill="white" fontFamily={FONT}>
              {fr ? "LÉGENDE" : "LEGEND"}
            </text>
            {legendEntries.map((entry, i) => {
              const ex = rpX + entry.col * colW + 8;
              const ey = legY + headerH + entry.row * entryH + entryH / 2;
              return (
                <g key={i}>
                  {entry.type === "dc" && (
                    <>
                      <line x1={ex} y1={ey-3} x2={ex+20} y2={ey-3} stroke="#dc2626" strokeWidth={1.8} />
                      <line x1={ex+2} y1={ey+1} x2={ex+7} y2={ey+1} stroke="#dc2626" strokeWidth={1.8} />
                      <line x1={ex+9} y1={ey+1} x2={ex+14} y2={ey+1} stroke="#dc2626" strokeWidth={1.8} />
                      <line x1={ex+16} y1={ey+1} x2={ex+20} y2={ey+1} stroke="#dc2626" strokeWidth={1.8} />
                    </>
                  )}
                  {entry.type === "ac" && (
                    <path d={`M${ex},${ey} C${ex+3},${ey-7} ${ex+7},${ey-7} ${ex+10},${ey} C${ex+13},${ey+7} ${ex+17},${ey+7} ${ex+20},${ey}`} fill="none" stroke="#2563eb" strokeWidth={1.8} />
                  )}
                  {entry.type === "pv" && (
                    <g>
                      <rect x={ex+1} y={ey-7} width={18} height={14} fill="none" stroke="#d97706" strokeWidth={1.2} rx={1} />
                      <line x1={ex+5} y1={ey+5} x2={ex+15} y2={ey-5} stroke="#d97706" strokeWidth={1.2} />
                      <polygon points={`${ex+13},${ey-5} ${ex+15},${ey-5} ${ex+15},${ey-3}`} fill="#d97706" stroke="none" />
                      <line x1={ex-2} y1={ey-4} x2={ex+3} y2={ey-2} stroke="#d97706" strokeWidth={0.9} />
                      <polygon points={`${ex+2},${ey-3} ${ex+3},${ey-2} ${ex+1},${ey-1}`} fill="#d97706" stroke="none" />
                      <line x1={ex-2} y1={ey} x2={ex+3} y2={ey+2} stroke="#d97706" strokeWidth={0.9} />
                      <polygon points={`${ex+2},${ey+1} ${ex+3},${ey+2} ${ex+1},${ey+3}`} fill="#d97706" stroke="none" />
                    </g>
                  )}
                  {entry.type === "inv" && (
                    <g>
                      <rect x={ex+1} y={ey-7} width={18} height={14} fill="none" stroke="#16a34a" strokeWidth={1.2} rx={1} />
                      <polygon points={`${ex+5},${ey+5} ${ex+10},${ey-5} ${ex+15},${ey+5}`} fill="none" stroke="#16a34a" strokeWidth={1} />
                    </g>
                  )}
                  {entry.type === "meter" && (
                    <g>
                      <circle cx={ex+10} cy={ey} r={8} fill="none" stroke="#16a34a" strokeWidth={1.2} />
                      <text x={ex+10} y={ey+1} textAnchor="middle" dominantBaseline="middle" fontSize={5.5} fill="#16a34a" fontFamily={FONT} fontWeight={700}>kWh</text>
                    </g>
                  )}
                  {entry.type === "panel" && (
                    <g>
                      <rect x={ex+1} y={ey-7} width={18} height={14} fill="none" stroke="#334155" strokeWidth={1.2} rx={1} />
                      <line x1={ex+5} y1={ey-5} x2={ex+5} y2={ey+5} stroke="#334155" strokeWidth={1} />
                      <line x1={ex+10} y1={ey-5} x2={ex+10} y2={ey+5} stroke="#334155" strokeWidth={1} />
                      <line x1={ex+15} y1={ey-5} x2={ex+15} y2={ey+5} stroke="#334155" strokeWidth={1} />
                    </g>
                  )}
                  {entry.type === "ground" && (
                    <g>
                      <line x1={ex+10} y1={ey-7} x2={ex+10} y2={ey-2} stroke="#475569" strokeWidth={1.2} />
                      <line x1={ex+3} y1={ey-2} x2={ex+17} y2={ey-2} stroke="#475569" strokeWidth={1.5} />
                      <line x1={ex+5} y1={ey+1} x2={ex+15} y2={ey+1} stroke="#475569" strokeWidth={1.3} />
                      <line x1={ex+7} y1={ey+4} x2={ex+13} y2={ey+4} stroke="#475569" strokeWidth={1.1} />
                      <line x1={ex+9} y1={ey+7} x2={ex+11} y2={ey+7} stroke="#475569" strokeWidth={0.9} />
                    </g>
                  )}
                  {entry.type === "breaker" && (
                    <g>
                      <line x1={ex} y1={ey} x2={ex+5} y2={ey} stroke="#475569" strokeWidth={1.2} />
                      <circle cx={ex+6} cy={ey} r={1.5} fill="#475569" stroke="#475569" strokeWidth={0.5} />
                      <line x1={ex+7.5} y1={ey} x2={ex+16} y2={ey-7} stroke="#475569" strokeWidth={1.5} />
                      <circle cx={ex+17} cy={ey} r={1.5} fill="none" stroke="#475569" strokeWidth={1} />
                      <line x1={ex+18.5} y1={ey} x2={ex+22} y2={ey} stroke="#475569" strokeWidth={1.2} />
                    </g>
                  )}
                  {entry.type === "transformer" && (
                    <g>
                      <line x1={ex} y1={ey} x2={ex+4} y2={ey} stroke="#475569" strokeWidth={1.2} />
                      <circle cx={ex+8} cy={ey} r={4.5} fill="none" stroke="#475569" strokeWidth={1.2} />
                      <circle cx={ex+14} cy={ey} r={4.5} fill="none" stroke="#475569" strokeWidth={1.2} />
                      <line x1={ex+18.5} y1={ey} x2={ex+22} y2={ey} stroke="#475569" strokeWidth={1.2} />
                    </g>
                  )}
                  {entry.type === "fuse" && (
                    <g>
                      <line x1={ex} y1={ey} x2={ex+5} y2={ey} stroke="#475569" strokeWidth={1.2} />
                      <rect x={ex+5} y={ey-3} width={12} height={6} fill="none" stroke="#475569" strokeWidth={1.2} rx={3} />
                      <line x1={ex+8} y1={ey} x2={ex+14} y2={ey} stroke="#475569" strokeWidth={0.8} />
                      <line x1={ex+17} y1={ey} x2={ex+22} y2={ey} stroke="#475569" strokeWidth={1.2} />
                    </g>
                  )}
                  <text x={ex + 26} y={ey + 1} fontSize={7} fill="#334155" fontFamily={FONT}
                    dominantBaseline="middle">{entry.label}</text>
                </g>
              );
            })}
          </g>
        );
      })()}

      {/* ===== BOTTOM CARTOUCHE STRIP ===== */}
      {(() => {
        const bY = bottomY;
        const warnX = innerLeft;
        const revX = warnX + warnW;
        const siteX = revX + revW;
        const titleX = siteX + siteW;

        return (
          <g>
            <line x1={revX} y1={bY} x2={revX} y2={innerBottom} stroke={DARK} strokeWidth={0.5} />
            <line x1={siteX} y1={bY} x2={siteX} y2={innerBottom} stroke={DARK} strokeWidth={0.5} />
            <line x1={titleX} y1={bY} x2={titleX} y2={innerBottom} stroke={DARK} strokeWidth={0.5} />

            {/* 1. Warning text */}
            <text x={warnX + warnW / 2} y={bY + bH / 2 - 4} textAnchor="middle" fontSize={8} fontWeight={700}
              fill="#dc2626" fontFamily={FONT}>
              {fr ? "CONCEPTION PRÉLIMINAIRE" : "PRELIMINARY DESIGN"}
            </text>
            <text x={warnX + warnW / 2} y={bY + bH / 2 + 10} textAnchor="middle" fontSize={8} fontWeight={700}
              fill="#dc2626" fontFamily={FONT}>
              {fr ? "PAS POUR LA CONSTRUCTION" : "NOT FOR CONSTRUCTION"}
            </text>

            {/* 2. Revision table */}
            <text x={revX + revW / 2} y={bY + 12} textAnchor="middle" fontSize={7} fontWeight={700}
              fill={DARK} fontFamily={FONT}>
              {fr ? "RÉVISIONS" : "REVISIONS"}
            </text>
            <line x1={revX + 4} y1={bY + 16} x2={revX + revW - 4} y2={bY + 16} stroke="#e2e8f0" strokeWidth={0.5} />
            <text x={revX + 8} y={bY + 26} fontSize={6.5} fill="#64748b" fontFamily={FONT}>
              {fr ? "Rév." : "Rev."}</text>
            <text x={revX + 30} y={bY + 26} fontSize={6.5} fill="#64748b" fontFamily={FONT}>Date</text>
            <text x={revX + 70} y={bY + 26} fontSize={6.5} fill="#64748b" fontFamily={FONT}>Description</text>
            <line x1={revX + 4} y1={bY + 30} x2={revX + revW - 4} y2={bY + 30} stroke="#e2e8f0" strokeWidth={0.5} />
            <text x={revX + 8} y={bY + 42} fontSize={6.5} fill="#0f172a" fontFamily={FONT}>0</text>
            <text x={revX + 30} y={bY + 42} fontSize={6.5} fill="#0f172a" fontFamily={FONT}>2026-02-24</text>
            <text x={revX + 70} y={bY + 42} fontSize={6.5} fill="#0f172a" fontFamily={FONT}>
              {fr ? "Émission initiale" : "Initial issue"}</text>

            {/* 3. Company + Site info */}
            <image href={KWH_LOGO_DATA_URI} x={siteX + siteW/2 - 40} y={bY + 6} width={80} height={32} preserveAspectRatio="xMidYMid meet" />
            <text x={siteX + siteW / 2} y={bY + 44} textAnchor="middle" fontSize={7} fill="#64748b" fontFamily={FONT}>
              {config.siteAddress || config.siteName || ""}</text>
            <text x={siteX + siteW / 2} y={bY + 56} textAnchor="middle" fontSize={7} fill="#64748b" fontFamily={FONT}>
              {config.systemCapacityKW ? `${config.systemCapacityKW} kWc` : ""}</text>

            {/* 4. Drawing title + number */}
            <text x={titleX + titleW / 2} y={bY + 18} textAnchor="middle" fontSize={8.5} fontWeight={700}
              fill={DARK} fontFamily={FONT}>
              {fr ? "SCHÉMA UNIFILAIRE TYPIQUE" : "TYPICAL SINGLE LINE DIAGRAM"}
            </text>
            <text x={titleX + titleW / 2} y={bY + 30} textAnchor="middle" fontSize={8} fontWeight={600}
              fill={DARK} fontFamily={FONT}>
              {fr ? "POUR LA CENTRALE PV" : "FOR PV PLANT"}
            </text>
            <line x1={titleX + 6} y1={bY + 38} x2={titleX + titleW - 6} y2={bY + 38} stroke="#e2e8f0" strokeWidth={0.5} />
            <text x={titleX + titleW / 2 - 30} y={bY + 52} textAnchor="middle" fontSize={7} fill="#64748b" fontFamily={FONT}>
              SLD-001</text>
            <text x={titleX + titleW / 2 + 10} y={bY + 52} textAnchor="middle" fontSize={7} fill="#64748b" fontFamily={FONT}>
              {fr ? "Rév. 0" : "Rev. 0"}</text>
            <text x={titleX + titleW / 2 + 40} y={bY + 52} textAnchor="middle" fontSize={7} fill="#64748b" fontFamily={FONT}>
              1/1</text>
          </g>
        );
      })()}
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STRING INVERTER SLD RENDERER
// ═══════════════════════════════════════════════════════════════════════════════

function StringInverterSLD({
  inverters,
  config,
  arrays,
  language = "fr"
}: {
  inverters: SLDInverterAssignment[];
  config: SLDElectricalConfig;
  arrays: SLDArrayInfo[];
  language: "fr" | "en";
}) {
  const fr = language === "fr";

  const showAll = inverters.length <= 2;
  const displayInverters = showAll ? inverters : [inverters[0], inverters[inverters.length - 1]];
  const hiddenCount = showAll ? 0 : inverters.length - 2;

  const maxStringsPerInv = Math.max(...inverters.map(inv => inv.strings.length), 1);
  const invBlockH = Math.max(INV_BOX_H + 10, maxStringsPerInv * (STRING_BOX_H + 8) + 20);
  const gapBlockH = hiddenCount > 0 ? 50 : 0;
  const displayCount = displayInverters.length;

  const colPV = SVG_MARGIN + 10;
  const colCombiner = colPV + STRING_BOX_W + COL_GAP + 20;
  const colInverter = colCombiner + COMBINER_W + COL_GAP;
  const colACDisconnect = colInverter + INV_BOX_W + COL_GAP;
  const colMeter = colACDisconnect + ELEMENT_W + COL_GAP;
  const colMainPanel = colMeter + METER_R * 2 + COL_GAP + 20;
  const colGrid = colMainPanel + ELEMENT_W + COL_GAP;
  const diagramW = colGrid + ELEMENT_W + SVG_MARGIN;

  const rightPanelW = CARTOUCHE_RIGHT_PANEL_W;
  const totalW = diagramW + rightPanelW + 20;
  const diagramContentH = displayCount * invBlockH + gapBlockH + SVG_MARGIN * 2 + 50;
  const minH = 500;
  const bottomStripH = CARTOUCHE_BOTTOM_H;
  const totalH = Math.max(diagramContentH, minH) + bottomStripH + 20;
  const bottomStripY = totalH - bottomStripH - 10;
  const rightPanelX = diagramW + 10;

  const startY = 30;

  const serviceV = config.serviceVoltage || 600;
  const serviceA = config.serviceAmperage || 400;
  const mainBreakerA = config.mainBreakerA || 200;

  const getBlockY = (dispIdx: number) => {
    if (dispIdx === 0) return startY;
    if (hiddenCount > 0) return startY + invBlockH + gapBlockH;
    return startY + dispIdx * invBlockH;
  };

  const gapY = startY + invBlockH;

  return (
    <svg
      viewBox={`0 0 ${totalW} ${totalH}`}
      width="100%"
      style={{ maxWidth: totalW, background: "white" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <SLDLabel x={colPV + STRING_BOX_W / 2} y={startY - 12} text={fr ? "STRINGS PV" : "PV STRINGS"} fontSize={8} color="#475569" />
      <SLDLabel x={colCombiner + COMBINER_W / 2} y={startY - 12} text={fr ? "BOÎTE COMB." : "COMBINER"} fontSize={8} color="#475569" />
      <SLDLabel x={colInverter + INV_BOX_W / 2} y={startY - 12} text={fr ? "ONDULEUR" : "INVERTER"} fontSize={8} color="#475569" />
      <SLDLabel x={colACDisconnect + ELEMENT_W / 2} y={startY - 12} text={fr ? "SECTIONNEUR AC" : "AC DISCONNECT"} fontSize={8} color="#475569" />

      {displayInverters.map((inv, dispIdx) => {
        const blockY = getBlockY(dispIdx);
        const invCenterY = blockY + invBlockH / 2;

        const showAllStrings = inv.strings.length <= 4;
        const displayStrings = showAllStrings ? inv.strings : [inv.strings[0], inv.strings[1], inv.strings[inv.strings.length - 1]];
        const hiddenStrings = showAllStrings ? 0 : inv.strings.length - 3;

        return (
          <g key={inv.inverterId}>
            {displayStrings.map((str, sIdx) => {
              let visualIdx = sIdx;
              if (!showAllStrings && sIdx === 2) {
                visualIdx = inv.strings.length - 1;
              }
              const strY = blockY + 10 + visualIdx * (STRING_BOX_H + 8);
              const strCenterY = strY + STRING_BOX_H / 2;

              return (
                <g key={str.stringId}>
                  <SLDBox
                    x={colPV} y={strY} w={STRING_BOX_W} h={STRING_BOX_H}
                    label={`${str.panelsInString}× PV`}
                    sublabel={`${str.vocString}V / ${str.iscString}A`}
                    fill="#fef3c7" stroke="#d97706"
                  />
                  <SLDLine
                    x1={colPV + STRING_BOX_W} y1={strCenterY}
                    x2={colCombiner} y2={strCenterY}
                    color="#dc2626"
                  />
                  {sIdx === 0 && (
                    <WireLabel
                      x1={colPV + STRING_BOX_W} y1={strCenterY}
                      x2={colCombiner} y2={strCenterY}
                      label="DC"
                    />
                  )}
                </g>
              );
            })}

            {hiddenStrings > 0 && (
              <g>
                <text x={colPV + STRING_BOX_W / 2} y={blockY + 10 + 2 * (STRING_BOX_H + 8) + 12} textAnchor="middle" fontSize={12} fill="#94a3b8" fontFamily={FONT}>
                  {"⋮"}
                </text>
                <text x={colPV + STRING_BOX_W / 2} y={blockY + 10 + 2 * (STRING_BOX_H + 8) + 26} textAnchor="middle" fontSize={7} fill="#64748b" fontFamily={FONT}>
                  {fr ? `× ${inv.strings.length} chaînes` : `× ${inv.strings.length} strings`}
                </text>
              </g>
            )}

            <SLDBox
              x={colCombiner} y={invCenterY - COMBINER_H / 2} w={COMBINER_W} h={COMBINER_H}
              label={fr ? `Comb. #${inv.inverterId}` : `Comb. #${inv.inverterId}`}
              sublabel={`${inv.strings.length} str.`}
              fill="#e0f2fe" stroke="#0284c7"
            />

            <SLDLine
              x1={colCombiner + COMBINER_W} y1={invCenterY}
              x2={colInverter} y2={invCenterY}
              color="#dc2626"
            />
            <WireLabel
              x1={colCombiner + COMBINER_W} y1={invCenterY}
              x2={colInverter} y2={invCenterY}
              label={`DC ${Math.round(inv.totalCapacityKW * 1000 / (serviceV || 600))}A`}
            />

            <SLDBox
              x={colInverter} y={invCenterY - INV_BOX_H / 2} w={INV_BOX_W} h={INV_BOX_H}
              label={`INV-${inv.inverterId}`}
              sublabel={`${inv.powerKW} kW | ${inv.totalPanels} pan.`}
              fill="#dcfce7" stroke="#16a34a"
              bold
            />

            <SLDLine
              x1={colInverter + INV_BOX_W} y1={invCenterY}
              x2={colACDisconnect} y2={invCenterY}
              color="#2563eb"
            />
            <WireLabel
              x1={colInverter + INV_BOX_W} y1={invCenterY}
              x2={colACDisconnect} y2={invCenterY}
              label="AC"
            />

            <SLDBox
              x={colACDisconnect} y={invCenterY - ELEMENT_H / 2} w={ELEMENT_W} h={ELEMENT_H}
              label={fr ? `Sectionneur #${inv.inverterId}` : `Disconnect #${inv.inverterId}`}
              sublabel={`${Math.round(inv.powerKW * 1000 / (serviceV || 600) * 1.25)}A`}
              fill="#fef9c3" stroke="#ca8a04"
            />

            {inv.strings.length > 1 && (
              <SLDLine
                x1={colCombiner} y1={blockY + 10 + STRING_BOX_H / 2}
                x2={colCombiner} y2={blockY + 10 + ((showAllStrings ? inv.strings.length : inv.strings.length) - 1) * (STRING_BOX_H + 8) + STRING_BOX_H / 2}
                color="#0284c7"
              />
            )}
          </g>
        );
      })}

      {hiddenCount > 0 && (
        <g>
          <text x={colInverter + INV_BOX_W / 2} y={gapY + 15} textAnchor="middle" fontSize={16} fill="#94a3b8" fontFamily={FONT}>{"⋮"}</text>
          <text x={colInverter + INV_BOX_W / 2} y={gapY + 32} textAnchor="middle" fontSize={9} fill="#64748b" fontFamily={FONT}>
            {fr ? `× ${inverters.length} onduleurs identiques` : `× ${inverters.length} identical inverters`}
          </text>
          <line x1={colPV} y1={gapY + 2} x2={colACDisconnect + ELEMENT_W} y2={gapY + 2} stroke="#e2e8f0" strokeWidth={0.5} strokeDasharray="4 3" />
          <line x1={colPV} y1={gapY + gapBlockH - 2} x2={colACDisconnect + ELEMENT_W} y2={gapY + gapBlockH - 2} stroke="#e2e8f0" strokeWidth={0.5} strokeDasharray="4 3" />
        </g>
      )}

      {(() => {
        const busX = colACDisconnect + ELEMENT_W + 20;
        const busTopY = getBlockY(0) + invBlockH / 2;
        const busBottomY = getBlockY(displayCount - 1) + invBlockH / 2;
        const busMidY = (busTopY + busBottomY) / 2;

        return (
          <g>
            {displayCount > 1 && (
              <SLDLine x1={busX} y1={busTopY} x2={busX} y2={busBottomY} color="#2563eb" />
            )}

            {displayInverters.map((_inv, dispIdx) => {
              const cy = getBlockY(dispIdx) + invBlockH / 2;
              return (
                <SLDLine key={_inv.inverterId}
                  x1={colACDisconnect + ELEMENT_W} y1={cy}
                  x2={busX} y2={cy}
                  color="#2563eb"
                />
              );
            })}

            {hiddenCount > 0 && (
              <g>
                <line x1={busX} y1={gapY + 5} x2={busX} y2={gapY + gapBlockH - 5} stroke="#2563eb" strokeWidth={1.5} strokeDasharray="4 3" />
              </g>
            )}

            <SLDLine x1={busX} y1={busMidY} x2={colMeter} y2={busMidY} color="#2563eb" />
            <WireLabel x1={busX} y1={busMidY} x2={colMeter} y2={busMidY}
              label={`${serviceV}V`} />

            <SLDCircle
              cx={colMeter + METER_R} cy={busMidY} r={METER_R}
              label="kWh" sublabel={fr ? "Prod." : "Prod."}
              fill="#f0fdf4" stroke="#16a34a"
            />

            <SLDLine
              x1={colMeter + METER_R * 2} y1={busMidY}
              x2={colMainPanel} y2={busMidY}
              color="#2563eb"
            />

            <SLDBox
              x={colMainPanel} y={busMidY - ELEMENT_H / 2} w={ELEMENT_W} h={ELEMENT_H}
              label={fr ? "Panneau principal" : "Main Panel"}
              sublabel={`${mainBreakerA}A / ${serviceV}V`}
              fill="#f1f5f9" stroke="#334155"
              bold
            />

            <SLDLine
              x1={colMainPanel + ELEMENT_W} y1={busMidY}
              x2={colGrid} y2={busMidY}
              color="#475569"
            />
            <WireLabel
              x1={colMainPanel + ELEMENT_W} y1={busMidY}
              x2={colGrid} y2={busMidY}
              label={fr ? "Réseau HQ" : "Grid"}
            />

            <SLDBox
              x={colGrid} y={busMidY - ELEMENT_H / 2} w={ELEMENT_W} h={ELEMENT_H}
              label={fr ? "RÉSEAU" : "GRID"}
              sublabel={`${serviceV}V / ${serviceA}A`}
              fill="#e2e8f0" stroke="#1e293b"
              bold
            />

            <SLDLine x1={colMainPanel + ELEMENT_W / 2} y1={busMidY + ELEMENT_H / 2}
              x2={colMainPanel + ELEMENT_W / 2} y2={busMidY + ELEMENT_H / 2 + 15} color="#475569" />
            <SLDLine x1={colMainPanel + ELEMENT_W / 2 - 10} y1={busMidY + ELEMENT_H / 2 + 15}
              x2={colMainPanel + ELEMENT_W / 2 + 10} y2={busMidY + ELEMENT_H / 2 + 15} color="#475569" />
            <SLDLine x1={colMainPanel + ELEMENT_W / 2 - 6} y1={busMidY + ELEMENT_H / 2 + 19}
              x2={colMainPanel + ELEMENT_W / 2 + 6} y2={busMidY + ELEMENT_H / 2 + 19} color="#475569" />
            <SLDLine x1={colMainPanel + ELEMENT_W / 2 - 2} y1={busMidY + ELEMENT_H / 2 + 23}
              x2={colMainPanel + ELEMENT_W / 2 + 2} y2={busMidY + ELEMENT_H / 2 + 23} color="#475569" />
            <SLDLabel x={colMainPanel + ELEMENT_W / 2 + 15} y={busMidY + ELEMENT_H / 2 + 19}
              text="GND" fontSize={7} color="#475569" anchor="start" />
          </g>
        );
      })()}

      <SLDCartouche
        rightPanelX={rightPanelX}
        rightPanelWidth={rightPanelW}
        topY={4}
        bottomStripY={bottomStripY}
        totalWidth={totalW}
        totalHeight={totalH}
        config={config}
        arrays={arrays}
        inverterLayout={inverters}
        language={language}
      />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MICRO INVERTER SLD RENDERER
// ═══════════════════════════════════════════════════════════════════════════════

function MicroInverterSLD({
  groups,
  config,
  arrays,
  language = "fr"
}: {
  groups: SLDMicroInverterGroup[];
  config: SLDElectricalConfig;
  arrays: SLDArrayInfo[];
  language: "fr" | "en";
}) {
  const fr = language === "fr";

  const blockH = 70;
  const startY = 30;

  const showAll = groups.length <= 2;
  const displayGroups = showAll ? groups : [groups[0], groups[groups.length - 1]];
  const hiddenGroupCount = showAll ? 0 : groups.length - 2;
  const gapBlockH = hiddenGroupCount > 0 ? 50 : 0;
  const displayCount = displayGroups.length;

  const colPV = SVG_MARGIN + 10;
  const colMicro = colPV + ARRAY_BOX_W + COL_GAP;
  const colBranch = colMicro + INV_BOX_W + COL_GAP;
  const colMeter = colBranch + ELEMENT_W + COL_GAP;
  const colMainPanel = colMeter + METER_R * 2 + COL_GAP + 20;
  const colGrid = colMainPanel + ELEMENT_W + COL_GAP;
  const diagramW = colGrid + ELEMENT_W + SVG_MARGIN;

  const rightPanelW = CARTOUCHE_RIGHT_PANEL_W;
  const totalW = diagramW + rightPanelW + 20;
  const diagramContentH = startY + displayCount * blockH + gapBlockH + 50;
  const minH = 500;
  const bottomStripH = CARTOUCHE_BOTTOM_H;
  const totalH = Math.max(diagramContentH, minH) + bottomStripH + 20;
  const bottomStripY = totalH - bottomStripH - 10;
  const rightPanelX = diagramW + 10;

  const microW = config.microInverterPowerW || DEFAULT_MICRO_INV_W;
  const serviceV = config.serviceVoltage || 240;
  const serviceA = config.serviceAmperage || 200;
  const mainBreakerA = config.mainBreakerA || 200;

  const getGroupY = (dispIdx: number) => {
    if (dispIdx === 0) return startY;
    if (hiddenGroupCount > 0) return startY + blockH + gapBlockH;
    return startY + dispIdx * blockH;
  };

  const gapY = startY + blockH;

  return (
    <svg
      viewBox={`0 0 ${totalW} ${totalH}`}
      width="100%"
      style={{ maxWidth: totalW, background: "white" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <SLDLabel x={colPV + ARRAY_BOX_W / 2} y={startY - 12} text={fr ? "ARRAY PV" : "PV ARRAY"} fontSize={8} color="#475569" />
      <SLDLabel x={colMicro + INV_BOX_W / 2} y={startY - 12} text={fr ? "MICRO-ONDULEURS" : "MICROINVERTERS"} fontSize={8} color="#475569" />
      <SLDLabel x={colBranch + ELEMENT_W / 2} y={startY - 12} text={fr ? "CIRCUIT BRANCHE" : "BRANCH CIRCUIT"} fontSize={8} color="#475569" />

      {displayGroups.map((grp, dispIdx) => {
        const baseY = getGroupY(dispIdx);
        const cy = baseY + blockH / 2;

        return (
          <g key={grp.arrayId}>
            <SLDBox
              x={colPV} y={cy - ARRAY_BOX_H / 2} w={ARRAY_BOX_W} h={ARRAY_BOX_H}
              label={`Array #${grp.arrayId}`}
              sublabel={`${grp.panelCount} pan. / ${grp.capacityKW} kW`}
              fill="#fef3c7" stroke="#d97706"
            />

            <SLDLine x1={colPV + ARRAY_BOX_W} y1={cy} x2={colMicro} y2={cy} color="#dc2626" />
            <WireLabel x1={colPV + ARRAY_BOX_W} y1={cy} x2={colMicro} y2={cy} label="DC 1:1" />

            <SLDBox
              x={colMicro} y={cy - INV_BOX_H / 2} w={INV_BOX_W} h={INV_BOX_H}
              label={`${grp.panelCount}× μINV`}
              sublabel={`${microW}W ${fr ? "chaque" : "each"}`}
              fill="#dcfce7" stroke="#16a34a"
              bold
            />

            <SLDLine x1={colMicro + INV_BOX_W} y1={cy} x2={colBranch} y2={cy} color="#2563eb" />
            <WireLabel x1={colMicro + INV_BOX_W} y1={cy} x2={colBranch} y2={cy} label="AC Bus" />

            <SLDBox
              x={colBranch} y={cy - ELEMENT_H / 2} w={ELEMENT_W} h={ELEMENT_H}
              label={fr ? `Disj. #${grp.arrayId}` : `Brkr #${grp.arrayId}`}
              sublabel={`${Math.ceil(grp.acBranchCircuitA)}A`}
              fill="#fef9c3" stroke="#ca8a04"
            />
          </g>
        );
      })}

      {hiddenGroupCount > 0 && (
        <g>
          <text x={colMicro + INV_BOX_W / 2} y={gapY + 15} textAnchor="middle" fontSize={16} fill="#94a3b8" fontFamily={FONT}>{"⋮"}</text>
          <text x={colMicro + INV_BOX_W / 2} y={gapY + 32} textAnchor="middle" fontSize={9} fill="#64748b" fontFamily={FONT}>
            {fr ? `× ${groups.length} groupes identiques` : `× ${groups.length} identical groups`}
          </text>
          <line x1={colPV} y1={gapY + 2} x2={colBranch + ELEMENT_W} y2={gapY + 2} stroke="#e2e8f0" strokeWidth={0.5} strokeDasharray="4 3" />
          <line x1={colPV} y1={gapY + gapBlockH - 2} x2={colBranch + ELEMENT_W} y2={gapY + gapBlockH - 2} stroke="#e2e8f0" strokeWidth={0.5} strokeDasharray="4 3" />
        </g>
      )}

      {(() => {
        const busX = colBranch + ELEMENT_W + 20;
        const busTopY = getGroupY(0) + blockH / 2;
        const busBottomY = getGroupY(displayCount - 1) + blockH / 2;
        const busMidY = (busTopY + busBottomY) / 2;

        return (
          <g>
            {displayCount > 1 && (
              <SLDLine x1={busX} y1={busTopY} x2={busX} y2={busBottomY} color="#2563eb" />
            )}

            {displayGroups.map((grp, dispIdx) => {
              const cy = getGroupY(dispIdx) + blockH / 2;
              return (
                <SLDLine key={grp.arrayId}
                  x1={colBranch + ELEMENT_W} y1={cy} x2={busX} y2={cy} color="#2563eb"
                />
              );
            })}

            {hiddenGroupCount > 0 && (
              <line x1={busX} y1={gapY + 5} x2={busX} y2={gapY + gapBlockH - 5} stroke="#2563eb" strokeWidth={1.5} strokeDasharray="4 3" />
            )}

            <SLDLine x1={busX} y1={busMidY} x2={colMeter} y2={busMidY} color="#2563eb" />

            <SLDCircle
              cx={colMeter + METER_R} cy={busMidY} r={METER_R}
              label="kWh" sublabel={fr ? "Prod." : "Prod."}
              fill="#f0fdf4" stroke="#16a34a"
            />

            <SLDLine x1={colMeter + METER_R * 2} y1={busMidY} x2={colMainPanel} y2={busMidY} color="#2563eb" />

            <SLDBox
              x={colMainPanel} y={busMidY - ELEMENT_H / 2} w={ELEMENT_W} h={ELEMENT_H}
              label={fr ? "Panneau principal" : "Main Panel"}
              sublabel={`${mainBreakerA}A / ${serviceV}V`}
              fill="#f1f5f9" stroke="#334155"
              bold
            />

            <SLDLine x1={colMainPanel + ELEMENT_W} y1={busMidY} x2={colGrid} y2={busMidY} color="#475569" />

            <SLDBox
              x={colGrid} y={busMidY - ELEMENT_H / 2} w={ELEMENT_W} h={ELEMENT_H}
              label={fr ? "RÉSEAU" : "GRID"}
              sublabel={`${serviceV}V / ${serviceA}A`}
              fill="#e2e8f0" stroke="#1e293b"
              bold
            />

            <SLDLine x1={colMainPanel + ELEMENT_W / 2} y1={busMidY + ELEMENT_H / 2}
              x2={colMainPanel + ELEMENT_W / 2} y2={busMidY + ELEMENT_H / 2 + 15} color="#475569" />
            <SLDLine x1={colMainPanel + ELEMENT_W / 2 - 10} y1={busMidY + ELEMENT_H / 2 + 15}
              x2={colMainPanel + ELEMENT_W / 2 + 10} y2={busMidY + ELEMENT_H / 2 + 15} color="#475569" />
            <SLDLine x1={colMainPanel + ELEMENT_W / 2 - 6} y1={busMidY + ELEMENT_H / 2 + 19}
              x2={colMainPanel + ELEMENT_W / 2 + 6} y2={busMidY + ELEMENT_H / 2 + 19} color="#475569" />
            <SLDLine x1={colMainPanel + ELEMENT_W / 2 - 2} y1={busMidY + ELEMENT_H / 2 + 23}
              x2={colMainPanel + ELEMENT_W / 2 + 2} y2={busMidY + ELEMENT_H / 2 + 23} color="#475569" />
            <SLDLabel x={colMainPanel + ELEMENT_W / 2 + 15} y={busMidY + ELEMENT_H / 2 + 19}
              text="GND" fontSize={7} color="#475569" anchor="start" />
          </g>
        );
      })()}

      {/* Cartouche */}
      <SLDCartouche
        rightPanelX={rightPanelX}
        rightPanelWidth={rightPanelW}
        topY={4}
        bottomStripY={bottomStripY}
        totalWidth={totalW}
        totalHeight={totalH}
        config={config}
        arrays={arrays}
        microLayout={groups}
        language={language}
      />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function SLDDiagram({ arrays, config, language = "fr", width, height }: SLDDiagramProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const fr = language === "fr";

  // Compute electrical layout
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

  // Export SVG as string (for PDF generation)
  const getSVGString = useCallback((): string | null => {
    // Find the actual SVG element inside the wrapper
    const container = svgRef.current;
    if (!container) return null;

    // The rendered SVG is a child since we wrap in a div
    const svgEl = container.querySelector?.("svg") || container;
    if (!svgEl) return null;

    const serializer = new XMLSerializer();
    return serializer.serializeToString(svgEl);
  }, []);

  // Expose getSVGString for parent components
  // Store on the ref div as a property for parent access
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

      {/* Summary table below diagram */}
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

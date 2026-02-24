/**
 * SLD (Single Line Diagram) — Schéma unifilaire professionnel
 *
 * Vertical top-to-bottom layout matching IEC/IEEE engineering drawing standards.
 * Reference: Rematek Énergie professional SLD drawings.
 * Flow: Existing Infrastructure → New Pole → Breakers → Meter → Transformer →
 *       AC Combiner Box → Inverters → DC Combiner Boxes → PV Strings
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

const FONT = "'Courier New', Courier, monospace";
const STROKE = "#000000";
const STROKE_LIGHT = "#333333";
const STROKE_FAINT = "#888888";
const STROKE_VFAINT = "#bbbbbb";

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

function IECMeterV({ cx, cy, r = 14, label }: { cx: number; cy: number; r?: number; label?: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="white" stroke={STROKE} strokeWidth={1.5} />
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize={r * 0.75} fontWeight={700} fill={STROKE} fontFamily={FONT}>M</text>
      {label && (
        <text x={cx + r + 6} y={cy + 1} fontSize={7} fill={STROKE_LIGHT} fontFamily={FONT}
          dominantBaseline="middle">{label}</text>
      )}
    </g>
  );
}

function IECTransformerCoils({ cx, cy, size = 40 }: { cx: number; cy: number; size?: number }) {
  const r = size * 0.22;
  return (
    <g>
      <circle cx={cx} cy={cy - r * 0.6} r={r} fill="white" stroke={STROKE} strokeWidth={1.5} />
      <circle cx={cx} cy={cy + r * 0.6} r={r} fill="white" stroke={STROKE} strokeWidth={1.5} />
    </g>
  );
}

function IECBreakerV({ cx, y1, length = 22 }: { cx: number; y1: number; length?: number }) {
  const dotR = 2.5;
  return (
    <g>
      <circle cx={cx} cy={y1 + dotR} r={dotR} fill={STROKE} />
      <line x1={cx} y1={y1 + dotR * 2} x2={cx + 7} y2={y1 + length - dotR * 2} stroke={STROKE} strokeWidth={1.8} />
      <circle cx={cx} cy={y1 + length - dotR} r={dotR} fill="none" stroke={STROKE} strokeWidth={1.2} />
    </g>
  );
}

function IECDisconnectV({ cx, y1, length = 20 }: { cx: number; y1: number; length?: number }) {
  const dotR = 2;
  return (
    <g>
      <circle cx={cx} cy={y1 + dotR} r={dotR} fill={STROKE} />
      <line x1={cx} y1={y1 + dotR * 2} x2={cx + 6} y2={y1 + length - dotR * 2} stroke={STROKE} strokeWidth={1.5} />
      <line x1={cx - 4} y1={y1 + length - dotR * 2} x2={cx + 4} y2={y1 + length - dotR * 2} stroke={STROKE} strokeWidth={1.5} />
    </g>
  );
}

function IECGroundV({ cx, topY }: { cx: number; topY: number }) {
  return (
    <g>
      <line x1={cx} y1={topY} x2={cx} y2={topY + 6} stroke={STROKE} strokeWidth={1.5} />
      <line x1={cx - 9} y1={topY + 6} x2={cx + 9} y2={topY + 6} stroke={STROKE} strokeWidth={1.8} />
      <line x1={cx - 5} y1={topY + 10} x2={cx + 5} y2={topY + 10} stroke={STROKE} strokeWidth={1.5} />
      <line x1={cx - 2} y1={topY + 14} x2={cx + 2} y2={topY + 14} stroke={STROKE} strokeWidth={1.2} />
    </g>
  );
}

function IECFuseV({ cx, y, length = 14 }: { cx: number; y: number; length?: number }) {
  const capH = length * 0.55;
  const capW = 5;
  return (
    <g>
      <line x1={cx} y1={y} x2={cx} y2={y + (length - capH) / 2} stroke={STROKE} strokeWidth={1.2} />
      <rect x={cx - capW / 2} y={y + (length - capH) / 2} width={capW} height={capH}
        fill="none" stroke={STROKE} strokeWidth={1.2} rx={capW / 2} />
      <line x1={cx} y1={y + (length + capH) / 2} x2={cx} y2={y + length} stroke={STROKE} strokeWidth={1.2} />
    </g>
  );
}

function IECFusibleInterrupteur({ cx, y1, length = 22 }: { cx: number; y1: number; length?: number }) {
  const dotR = 2;
  const fuseH = 6;
  const fuseW = 4;
  return (
    <g>
      <circle cx={cx} cy={y1 + dotR} r={dotR} fill={STROKE} />
      <line x1={cx} y1={y1 + dotR * 2} x2={cx + 5} y2={y1 + length * 0.45} stroke={STROKE} strokeWidth={1.5} />
      <rect x={cx - fuseW / 2} y={y1 + length * 0.45} width={fuseW} height={fuseH}
        fill="none" stroke={STROKE} strokeWidth={1} rx={fuseW / 2} />
      <line x1={cx} y1={y1 + length * 0.45 + fuseH} x2={cx} y2={y1 + length} stroke={STROKE} strokeWidth={1.2} />
    </g>
  );
}

function IECInverterV({ cx, cy, size = 32 }: { cx: number; cy: number; size?: number }) {
  const hs = size / 2;
  return (
    <g>
      <rect x={cx - hs} y={cy - hs} width={size} height={size} fill="white" stroke={STROKE} strokeWidth={1.5} rx={1} />
      <line x1={cx - hs} y1={cy + hs} x2={cx + hs} y2={cy - hs} stroke={STROKE} strokeWidth={0.8} />
      <text x={cx - hs * 0.35} y={cy + hs * 0.55} fontSize={size * 0.22} fill={STROKE} fontFamily={FONT}>~</text>
      <text x={cx + hs * 0.15} y={cy - hs * 0.2} fontSize={size * 0.2} fill={STROKE} fontFamily={FONT}>=</text>
    </g>
  );
}

function IECPVModuleV({ cx, cy, w = 24, h = 18 }: { cx: number; cy: number; w?: number; h?: number }) {
  return (
    <g>
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} fill="white" stroke={STROKE} strokeWidth={1.2} rx={1} />
      <line x1={cx - w * 0.3} y1={cy + h * 0.3} x2={cx + w * 0.3} y2={cy - h * 0.3} stroke={STROKE} strokeWidth={0.8} />
      <polygon points={`${cx + w * 0.22},${cy - h * 0.3} ${cx + w * 0.3},${cy - h * 0.3} ${cx + w * 0.3},${cy - h * 0.12}`} fill={STROKE} />
    </g>
  );
}

function IECSurgeArrester({ cx, cy, size = 12 }: { cx: number; cy: number; size?: number }) {
  return (
    <g>
      <line x1={cx} y1={cy - size / 2} x2={cx} y2={cy + size / 2} stroke={STROKE} strokeWidth={1.2} />
      <line x1={cx - size * 0.4} y1={cy + size / 2} x2={cx + size * 0.4} y2={cy + size / 2} stroke={STROKE} strokeWidth={1.2} />
      <line x1={cx - size * 0.25} y1={cy + size * 0.7} x2={cx + size * 0.25} y2={cy + size * 0.7} stroke={STROKE} strokeWidth={1} />
    </g>
  );
}

function IECCurrentTransformer({ cx, cy, r = 6 }: { cx: number; cy: number; r?: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="white" stroke={STROKE} strokeWidth={1.2} />
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize={r * 0.9} fontWeight={700} fill={STROKE} fontFamily={FONT}>CT</text>
    </g>
  );
}

function UtilityPole({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <line x1={cx} y1={cy - 22} x2={cx} y2={cy + 15} stroke={STROKE} strokeWidth={2.5} />
      <line x1={cx - 16} y1={cy - 16} x2={cx + 16} y2={cy - 16} stroke={STROKE} strokeWidth={1.5} />
      <line x1={cx - 12} y1={cy - 10} x2={cx + 12} y2={cy - 10} stroke={STROKE} strokeWidth={1.5} />
      <circle cx={cx - 10} cy={cy - 16} r={2} fill="white" stroke={STROKE} strokeWidth={1} />
      <circle cx={cx + 10} cy={cy - 16} r={2} fill="white" stroke={STROKE} strokeWidth={1} />
      <circle cx={cx - 7} cy={cy - 10} r={2} fill="white" stroke={STROKE} strokeWidth={1} />
      <circle cx={cx + 7} cy={cy - 10} r={2} fill="white" stroke={STROKE} strokeWidth={1} />
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
      <rect x={marginLeft} y={marginTop} width={innerW} height={innerH} fill="none" stroke={STROKE} strokeWidth={0.8} />

      {Array.from({ length: colCount }).map((_, i) => {
        const x = marginLeft + cellW * (i + 0.5);
        return (
          <g key={`col-${i}`}>
            <line x1={marginLeft + cellW * i} y1={marginTop} x2={marginLeft + cellW * i} y2={marginTop - 2}
              stroke={STROKE_VFAINT} strokeWidth={0.3} />
            <text x={x} y={marginTop - 5} textAnchor="middle" fontSize={5.5} fill={STROKE_FAINT} fontFamily={FONT}>
              {i + 1}
            </text>
            <text x={x} y={height - 4} textAnchor="middle" fontSize={5.5} fill={STROKE_FAINT} fontFamily={FONT}>
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
              stroke={STROKE_VFAINT} strokeWidth={0.3} />
            <text x={marginLeft - tickLen / 2 - 2} y={y} textAnchor="middle" dominantBaseline="middle"
              fontSize={5.5} fill={STROKE_FAINT} fontFamily={FONT}>{rowLabels[i]}</text>
          </g>
        );
      })}
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LÉGENDE — IEC Symbol Legend (right panel)
// ═══════════════════════════════════════════════════════════════════════════════

function LegendBox({ x, y, w, fr }: { x: number; y: number; w: number; fr: boolean }) {
  const rowH = 18;
  const colW = w / 2;
  const symbolSize = 12;

  const legends: { labelFr: string; labelEn: string; render: (sx: number, sy: number) => JSX.Element }[] = [
    {
      labelFr: "TRANSFORMATEUR DE\nPUISSANCE",
      labelEn: "POWER\nTRANSFORMER",
      render: (sx, sy) => <IECTransformerCoils cx={sx} cy={sy} size={24} />,
    },
    {
      labelFr: "MESURAGE",
      labelEn: "METERING",
      render: (sx, sy) => <IECMeterV cx={sx} cy={sy} r={7} />,
    },
    {
      labelFr: "TRANSFORMATEUR DE\nCOURANT",
      labelEn: "CURRENT\nTRANSFORMER",
      render: (sx, sy) => <IECCurrentTransformer cx={sx} cy={sy} r={6} />,
    },
    {
      labelFr: "ONDULEUR (DC/AC)",
      labelEn: "INVERTER (DC/AC)",
      render: (sx, sy) => <IECInverterV cx={sx} cy={sy} size={14} />,
    },
    {
      labelFr: "COURANT CONTINU",
      labelEn: "DC CURRENT",
      render: (sx, sy) => (
        <g>
          <line x1={sx - 6} y1={sy - 2} x2={sx + 6} y2={sy - 2} stroke={STROKE} strokeWidth={1} />
          <line x1={sx - 6} y1={sy + 2} x2={sx + 6} y2={sy + 2} stroke={STROKE} strokeWidth={1} strokeDasharray="2 1.5" />
        </g>
      ),
    },
    {
      labelFr: "COURANT ALTERNATIF",
      labelEn: "AC CURRENT",
      render: (sx, sy) => (
        <text x={sx} y={sy + 3} textAnchor="middle" fontSize={12} fill={STROKE} fontFamily={FONT}>~</text>
      ),
    },
    {
      labelFr: "DISJONCTEUR",
      labelEn: "CIRCUIT BREAKER",
      render: (sx, sy) => <IECBreakerV cx={sx} y1={sy - 6} length={12} />,
    },
    {
      labelFr: "SECTIONNEUR",
      labelEn: "DISCONNECT",
      render: (sx, sy) => <IECDisconnectV cx={sx} y1={sy - 6} length={12} />,
    },
    {
      labelFr: "INTERRUPTEUR FUSIBLE",
      labelEn: "FUSE SWITCH",
      render: (sx, sy) => <IECFusibleInterrupteur cx={sx} y1={sy - 6} length={12} />,
    },
    {
      labelFr: "FUSIBLE",
      labelEn: "FUSE",
      render: (sx, sy) => <IECFuseV cx={sx} y={sy - 5} length={10} />,
    },
    {
      labelFr: "MISE À LA TERRE",
      labelEn: "GROUND",
      render: (sx, sy) => <IECGroundV cx={sx} topY={sy - 5} />,
    },
    {
      labelFr: "PARAFOUDRE",
      labelEn: "SURGE ARRESTER",
      render: (sx, sy) => <IECSurgeArrester cx={sx} cy={sy} size={10} />,
    },
    {
      labelFr: "PANNEAU SOLAIRE",
      labelEn: "SOLAR PANEL",
      render: (sx, sy) => <IECPVModuleV cx={sx} cy={sy} w={14} h={10} />,
    },
  ];

  const rows = Math.ceil(legends.length / 2);
  const totalH = rows * rowH + 18;

  return (
    <g>
      <rect x={x} y={y} width={w} height={totalH} fill="white" stroke={STROKE} strokeWidth={1} />
      <rect x={x} y={y} width={w} height={14} fill="#f0f0f0" stroke={STROKE} strokeWidth={0.5} />
      <text x={x + w / 2} y={y + 10} textAnchor="middle" fontSize={6.5} fontWeight={700} fill={STROKE} fontFamily={FONT}>
        {fr ? "LÉGENDE" : "LEGEND"}
      </text>

      {legends.map((leg, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const cx = x + col * colW;
        const ry = y + 14 + row * rowH;

        const label = fr ? leg.labelFr : leg.labelEn;
        const lines = label.split("\n");

        return (
          <g key={i}>
            <line x1={cx} y1={ry} x2={cx + colW} y2={ry} stroke={STROKE_VFAINT} strokeWidth={0.3} />
            {col === 1 && <line x1={cx} y1={ry} x2={cx} y2={ry + rowH} stroke={STROKE_VFAINT} strokeWidth={0.3} />}
            <g transform={`translate(${cx + symbolSize + 2}, ${ry + rowH / 2})`}>
              {leg.render(0, 0)}
            </g>
            {lines.length === 1 ? (
              <text x={cx + symbolSize * 2 + 6} y={ry + rowH / 2 + 1} fontSize={5} fill={STROKE_LIGHT}
                fontFamily={FONT} dominantBaseline="middle">{lines[0]}</text>
            ) : (
              <>
                <text x={cx + symbolSize * 2 + 6} y={ry + rowH / 2 - 3} fontSize={5} fill={STROKE_LIGHT}
                  fontFamily={FONT} dominantBaseline="middle">{lines[0]}</text>
                <text x={cx + symbolSize * 2 + 6} y={ry + rowH / 2 + 5} fontSize={5} fill={STROKE_LIGHT}
                  fontFamily={FONT} dominantBaseline="middle">{lines[1]}</text>
              </>
            )}
          </g>
        );
      })}
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM SUMMARY TABLE (right panel)
// ═══════════════════════════════════════════════════════════════════════════════

function SystemSummaryTable({ x, y, w, config, fr, totalStrings, panelsPerString, inverterCount }: {
  x: number; y: number; w: number;
  config: SLDElectricalConfig; fr: boolean;
  totalStrings: number; panelsPerString: number; inverterCount: number;
}) {
  const rowH = 12;
  const invModelName = config.inverterType === "string"
    ? (config.stringInverterModelName || DEFAULT_STRING_INV_NAME)
    : (config.microInverterModelName || DEFAULT_MICRO_INV_NAME);
  const invPowerStr = config.inverterType === "string"
    ? `${config.stringInverterPowerKW || DEFAULT_STRING_INV_KW} kW`
    : `${config.microInverterPowerW || DEFAULT_MICRO_INV_W} W`;

  const summaryRows = fr ? [
    ["Modèle de module PV", "Jinko JKM660N-78HL4-BDV"],
    ["Nombre total des modules PV", `${config.totalPanels || 0}`],
    ["Nombre des modules par chaîne", `${panelsPerString}`],
    ["Nombre totale des chaînes", `${totalStrings}`],
    ["Modèle d'onduleur", `${inverterCount} X ${invModelName}`],
    ["Puissance/Tension de l'onduleur", `${invPowerStr} / ${config.serviceVoltage || 600}V`],
    ["Puissance totale de la centrale", `${config.systemCapacityKW || 0} kWc`],
  ] : [
    ["PV Module Model", "Jinko JKM660N-78HL4-BDV"],
    ["Total PV Modules", `${config.totalPanels || 0}`],
    ["Modules per String", `${panelsPerString}`],
    ["Total Strings", `${totalStrings}`],
    ["Inverter Model", `${inverterCount} X ${invModelName}`],
    ["Inverter Power/Voltage", `${invPowerStr} / ${config.serviceVoltage || 600}V`],
    ["Total Plant Capacity", `${config.systemCapacityKW || 0} kWp`],
  ];

  const totalH = summaryRows.length * rowH + 16;
  const col1W = w * 0.55;

  return (
    <g>
      <rect x={x} y={y} width={w} height={totalH} fill="white" stroke={STROKE} strokeWidth={1} />
      <rect x={x} y={y} width={w} height={14} fill="#f0f0f0" stroke={STROKE} strokeWidth={0.5} />
      <text x={x + w / 2} y={y + 10} textAnchor="middle" fontSize={6.5} fontWeight={700} fill={STROKE} fontFamily={FONT}>
        {fr ? "TABLEAU RÉCAPITULATIF DU SYSTÈME" : "SYSTEM SUMMARY TABLE"}
      </text>
      {summaryRows.map((row, i) => {
        const ry = y + 14 + i * rowH;
        return (
          <g key={i}>
            {i % 2 === 0 && <rect x={x + 0.5} y={ry} width={w - 1} height={rowH} fill="#fafafa" />}
            <line x1={x + col1W} y1={ry} x2={x + col1W} y2={ry + rowH} stroke={STROKE_VFAINT} strokeWidth={0.3} />
            <line x1={x} y1={ry} x2={x + w} y2={ry} stroke={STROKE_VFAINT} strokeWidth={0.3} />
            <text x={x + 4} y={ry + rowH / 2 + 1} fontSize={5.5} fill={STROKE_LIGHT} fontFamily={FONT}
              dominantBaseline="middle">{row[0]}</text>
            <text x={x + col1W + 4} y={ry + rowH / 2 + 1} fontSize={5.5} fill={STROKE} fontWeight={600}
              fontFamily={FONT} dominantBaseline="middle">{row[1]}</text>
          </g>
        );
      })}
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TITLE BLOCK (bottom-right cartouche) — Rematek style
// ═══════════════════════════════════════════════════════════════════════════════

function TitleBlock({ x, y, w, h, config, fr }: {
  x: number; y: number; w: number; h: number;
  config: SLDElectricalConfig; fr: boolean;
}) {
  const midH = h * 0.45;
  const botH = h - midH;

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="white" stroke={STROKE} strokeWidth={1.5} />

      <image href={KWH_LOGO_DATA_URI} x={x + 6} y={y + 4} width={60} height={24} preserveAspectRatio="xMidYMid meet" />

      <line x1={x + w * 0.4} y1={y} x2={x + w * 0.4} y2={y + midH} stroke={STROKE} strokeWidth={0.5} />

      <text x={x + w * 0.7} y={y + 10} textAnchor="middle" fontSize={6} fill={STROKE_LIGHT} fontFamily={FONT}>
        {config.siteName || ""}
      </text>
      <text x={x + w * 0.7} y={y + 20} textAnchor="middle" fontSize={5.5} fill={STROKE_FAINT} fontFamily={FONT}>
        {config.siteAddress || ""}
      </text>

      <line x1={x} y1={y + midH} x2={x + w} y2={y + midH} stroke={STROKE} strokeWidth={0.5} />

      <text x={x + w / 2} y={y + midH + 12} textAnchor="middle" fontSize={7} fontWeight={700} fill={STROKE} fontFamily={FONT}>
        {fr ? "SCHÉMA UNIFILAIRE TYPIQUE POUR LA CENTRALE PV" : "TYPICAL SINGLE LINE DIAGRAM FOR PV PLANT"}
      </text>

      <line x1={x} y1={y + midH + 18} x2={x + w} y2={y + midH + 18} stroke={STROKE_VFAINT} strokeWidth={0.3} />

      <text x={x + 8} y={y + midH + 28} fontSize={5.5} fill={STROKE_LIGHT} fontFamily={FONT}>
        SLD-001
      </text>
      <text x={x + w / 2} y={y + midH + 28} textAnchor="middle" fontSize={5.5} fill={STROKE_LIGHT} fontFamily={FONT}>
        {fr ? "Rév. 0" : "Rev. 0"}
      </text>
      <text x={x + w - 8} y={y + midH + 28} textAnchor="end" fontSize={5.5} fill={STROKE_LIGHT} fontFamily={FONT}>
        {new Date().toISOString().slice(0, 10)}
      </text>

      <rect x={x + 4} y={y + h - 14} width={w - 8} height={10} fill="none" stroke="#cc0000" strokeWidth={0.8} rx={1} />
      <text x={x + w / 2} y={y + h - 7} textAnchor="middle" fontSize={5.5} fontWeight={700}
        fill="#cc0000" fontFamily={FONT}>
        {fr ? "CONCEPTION PRÉLIMINAIRE / PAS POUR LA CONSTRUCTION" : "PRELIMINARY DESIGN / NOT FOR CONSTRUCTION"}
      </text>
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXISTING INSTALLATION (top-right area) — Rematek style
// ═══════════════════════════════════════════════════════════════════════════════

function ExistingInstallation({ x, y, w, h, config, fr }: {
  x: number; y: number; w: number; h: number;
  config: SLDElectricalConfig; fr: boolean;
}) {
  const serviceV = config.serviceVoltage || 600;
  const serviceA = config.serviceAmperage || 400;
  const xfrmKVA = Math.round((config.systemCapacityKW || 100) * 0.8);
  const cx = x + w * 0.5;
  const poleY = y + 35;
  const xfrmY = poleY + 45;
  const meterY = xfrmY + 55;
  const breakerY = meterY + 40;

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={STROKE} strokeWidth={0.8} strokeDasharray="6 3" rx={3} />
      <text x={x + w / 2} y={y + 12} textAnchor="middle" fontSize={7} fontWeight={700} fill={STROKE} fontFamily={FONT}>
        {fr ? "Installation existante" : "Existing Installation"}
      </text>

      <UtilityPole cx={cx - 30} cy={poleY} />
      <text x={cx - 30} y={poleY + 22} textAnchor="middle" fontSize={5.5} fill={STROKE_LIGHT} fontFamily={FONT}>
        {fr ? "Poteau existant" : "Existing pole"}
      </text>

      <line x1={cx - 30} y1={poleY + 15} x2={cx - 30} y2={xfrmY - 12} stroke={STROKE} strokeWidth={1.5} />

      <IECTransformerCoils cx={cx - 30} cy={xfrmY} size={30} />
      <text x={cx + 5} y={xfrmY - 5} fontSize={5.5} fill={STROKE_LIGHT} fontFamily={FONT}>
        {fr ? `Transformateur` : `Transformer`}
      </text>
      <text x={cx + 5} y={xfrmY + 4} fontSize={5.5} fill={STROKE_LIGHT} fontFamily={FONT}>
        {`${xfrmKVA}kVA`}
      </text>

      <line x1={cx - 30} y1={xfrmY + 12} x2={cx - 30} y2={meterY - 14} stroke={STROKE} strokeWidth={1.5} />

      <line x1={cx - 30} y1={meterY + 14} x2={cx - 30} y2={breakerY} stroke={STROKE} strokeWidth={1.5} />

      <IECMeterV cx={cx - 30} cy={meterY} r={12} />
      <text x={cx + 5} y={meterY - 3} fontSize={5.5} fill={STROKE_LIGHT} fontFamily={FONT}>
        {fr ? "Compteur Distribution" : "Distribution Meter"}
      </text>
      <text x={cx + 5} y={meterY + 6} fontSize={5.5} fill={STROKE_LIGHT} fontFamily={FONT}>
        {fr ? "client" : "client"}
      </text>

      <IECBreakerV cx={cx - 30} y1={breakerY} length={18} />
      <text x={cx + 5} y={breakerY + 8} fontSize={5.5} fill={STROKE_LIGHT} fontFamily={FONT}>
        {fr ? "Principal" : "Main"}
      </text>
      <text x={cx + 5} y={breakerY + 17} fontSize={5.5} fill={STROKE_LIGHT} fontFamily={FONT}>
        {`${serviceA}A/${serviceV}V`}
      </text>

      <line x1={cx - 30} y1={breakerY + 18} x2={cx - 30} y2={y + h - 5} stroke={STROKE} strokeWidth={1.5} />
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STRING INVERTER SLD — VERTICAL LAYOUT (Rematek style)
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

  const showMax = 3;
  const showAll = inverters.length <= showMax;
  const displayInverters = showAll ? inverters : [inverters[0], inverters[Math.floor(inverters.length / 2)], inverters[inverters.length - 1]];
  const hiddenCount = showAll ? 0 : inverters.length - showMax;

  const invColW = 130;
  const gapCol = hiddenCount > 0 ? 50 : 0;
  const displayCount = displayInverters.length;

  const marginLeft = 18;
  const marginTop = 16;
  const rightPanelW = 220;

  const pvZoneW = Math.max(displayCount * invColW + gapCol, 320);
  const mainAreaW = pvZoneW + 100;
  const totalW = mainAreaW + marginLeft * 2 + rightPanelW;

  const rowExistTop = marginTop + 5;
  const existH = 200;
  const rowNewPole = marginTop + 30;
  const rowBreaker1 = rowNewPole + 55;
  const rowMeter = rowBreaker1 + 40;
  const rowTransformer = rowMeter + 55;
  const rowGround = rowTransformer + 45;
  const rowACCombiner = rowGround + 50;
  const rowPVZoneTop = rowACCombiner + 65;
  const rowInverter = rowPVZoneTop + 50;
  const rowDCCombiner = rowInverter + 70;
  const rowDCFuse = rowDCCombiner + 50;
  const rowPVStrings = rowDCFuse + 50;
  const rowPVZoneBottom = rowPVStrings + 40;

  const totalH = rowPVZoneBottom + 30 + marginTop;
  const innerW = mainAreaW;
  const innerH = totalH - marginTop * 2;
  const centerX = marginLeft + 60;

  const panelsPerString = inverters.length > 0 && inverters[0].strings.length > 0
    ? inverters[0].strings[0].panelsInString : MAX_PANELS_PER_STRING;
  const totalStrings = inverters.reduce((s, inv) => s + inv.strings.length, 0);

  const pvZoneStartX = marginLeft + 80;
  const getInvX = (dispIdx: number) => {
    if (showAll) {
      const blockStart = pvZoneStartX + (pvZoneW - displayCount * invColW) / 2;
      return blockStart + dispIdx * invColW + invColW / 2;
    }
    const blockStart = pvZoneStartX + (pvZoneW - (displayCount * invColW + gapCol)) / 2;
    if (dispIdx === 0) return blockStart + invColW / 2;
    if (dispIdx === 1 && hiddenCount > 0) return blockStart + invColW + gapCol / 2;
    if (dispIdx === 1 && hiddenCount === 0) return blockStart + invColW + invColW / 2;
    return blockStart + (displayCount - 1) * invColW + gapCol + invColW / 2;
  };

  const acCombinerRating = Math.round((config.systemCapacityKW || 100) * 1000 / serviceV * 1.25);
  const xfrmKVA = Math.round((config.systemCapacityKW || 100) * 1.2);

  return (
    <svg
      viewBox={`0 0 ${totalW} ${totalH}`}
      width="100%"
      style={{ maxWidth: totalW, background: "white" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <GridBorder width={totalW - rightPanelW} height={totalH} marginLeft={marginLeft} marginTop={marginTop}
        innerW={innerW} innerH={innerH} />

      {/* ═══ EXISTING INSTALLATION (top-right of drawing area) ═══ */}
      <ExistingInstallation
        x={mainAreaW - 150} y={rowExistTop} w={160} h={existH}
        config={config} fr={fr}
      />

      {/* ═══ NEW UTILITY POLE (left side) ═══ */}
      <UtilityPole cx={centerX} cy={rowNewPole} />
      <text x={centerX} y={rowNewPole + 24} textAnchor="middle" fontSize={6.5} fontWeight={600} fill={STROKE} fontFamily={FONT}>
        {fr ? "Nouveau Poteau" : "New Pole"}
      </text>
      <text x={centerX} y={rowNewPole + 33} textAnchor="middle" fontSize={6} fill={STROKE_LIGHT} fontFamily={FONT}>
        MT
      </text>

      {/* Connection from new pole down */}
      <line x1={centerX} y1={rowNewPole + 15} x2={centerX} y2={rowBreaker1 - 3}
        stroke={STROKE} strokeWidth={1.5} />

      {/* ═══ MAIN BREAKER ═══ */}
      <IECBreakerV cx={centerX} y1={rowBreaker1} length={22} />
      <text x={centerX - 20} y={rowBreaker1 + 10} textAnchor="end" fontSize={7} fontWeight={600} fill={STROKE} fontFamily={FONT}>
        {`${serviceA}A`}
      </text>

      {/* ═══ PRODUCTION METER ═══ */}
      <line x1={centerX} y1={rowBreaker1 + 22} x2={centerX} y2={rowMeter - 14}
        stroke={STROKE} strokeWidth={1.5} />
      <IECMeterV cx={centerX} cy={rowMeter} r={14} />
      <IECCurrentTransformer cx={centerX + 22} cy={rowMeter - 8} r={5} />

      {/* ═══ TRANSFORMER ═══ */}
      <line x1={centerX} y1={rowMeter + 14} x2={centerX} y2={rowTransformer - 14}
        stroke={STROKE} strokeWidth={1.5} />
      <IECTransformerCoils cx={centerX} cy={rowTransformer} size={34} />
      <text x={centerX - 28} y={rowTransformer} fontSize={7} fill={STROKE_LIGHT} fontFamily={FONT}
        textAnchor="end" dominantBaseline="middle">
        {`${xfrmKVA}kVA`}
      </text>

      {/* ═══ AUXILIARY SERVICE + GROUND ═══ */}
      <line x1={centerX} y1={rowTransformer + 14} x2={centerX} y2={rowGround}
        stroke={STROKE} strokeWidth={1.5} />
      <line x1={centerX} y1={rowGround} x2={centerX - 45} y2={rowGround}
        stroke={STROKE} strokeWidth={1} />
      <IECBreakerV cx={centerX - 45} y1={rowGround} length={16} />
      <IECGroundV cx={centerX - 45} topY={rowGround + 18} />
      <text x={centerX - 45} y={rowGround + 40} textAnchor="middle" fontSize={5.5} fill={STROKE_LIGHT} fontFamily={FONT}>
        {fr ? "Service" : "Aux."}
      </text>
      <text x={centerX - 45} y={rowGround + 48} textAnchor="middle" fontSize={5.5} fill={STROKE_LIGHT} fontFamily={FONT}>
        {fr ? "auxiliaire" : "service"}
      </text>
      <IECSurgeArrester cx={centerX - 20} cy={rowGround + 12} size={10} />

      {/* ═══ MAIN BUS DOWN TO AC COMBINER ═══ */}
      <line x1={centerX} y1={rowGround} x2={centerX} y2={rowACCombiner}
        stroke={STROKE} strokeWidth={2} />

      {/* ═══ AC COMBINER BOX ═══ */}
      {(() => {
        const acBoxW = Math.min(pvZoneW, displayCount * invColW + (hiddenCount > 0 ? gapCol : 0) + 50);
        const acBoxX = pvZoneStartX + (pvZoneW - acBoxW) / 2;
        const acBoxH = 42;

        const firstInvX = getInvX(0);
        const lastInvX = getInvX(displayCount - 1);
        const busY = rowACCombiner;

        return (
          <g>
            <text x={pvZoneStartX} y={rowACCombiner - 12} fontSize={7} fontWeight={600} fill={STROKE} fontFamily={FONT}>
              {fr ? "Boîte de combinaison AC" : "AC Combiner Box"}
            </text>

            <line x1={centerX} y1={busY} x2={acBoxX + acBoxW / 2} y2={busY}
              stroke={STROKE} strokeWidth={2} />

            <text x={acBoxX + acBoxW / 2} y={busY - 4} textAnchor="middle" fontSize={7} fontWeight={600} fill={STROKE} fontFamily={FONT}>
              {`${acCombinerRating}A`}
            </text>

            <rect x={acBoxX} y={busY + 3} width={acBoxW} height={acBoxH}
              fill="white" stroke={STROKE} strokeWidth={1.5} rx={2} />

            {displayInverters.map((inv, dispIdx) => {
              const ix = getInvX(dispIdx);
              const isMiddleGap = !showAll && dispIdx === 1;
              if (isMiddleGap) return null;
              const breakerA = Math.round(inv.powerKW * 1000 / serviceV * 1.25);
              return (
                <g key={inv.inverterId}>
                  <line x1={ix} y1={busY + 3} x2={ix} y2={busY + 10} stroke={STROKE} strokeWidth={1.2} />
                  <IECFusibleInterrupteur cx={ix} y1={busY + 10} length={18} />
                  <text x={ix} y={busY + acBoxH - 2} textAnchor="middle" fontSize={6} fill={STROKE_LIGHT} fontFamily={FONT}>
                    {`${breakerA}A`}
                  </text>
                </g>
              );
            })}

            {hiddenCount > 0 && (() => {
              const gapCx = getInvX(1);
              return (
                <text x={gapCx} y={busY + acBoxH / 2 + 5} textAnchor="middle" fontSize={12}
                  fill={STROKE_FAINT} fontFamily={FONT}>{"..."}</text>
              );
            })()}

            {displayInverters.map((inv, dispIdx) => {
              const ix = getInvX(dispIdx);
              const isMiddleGap = !showAll && dispIdx === 1;
              if (isMiddleGap) return null;
              return (
                <line key={`line-${inv.inverterId}`} x1={ix} y1={busY + 3 + acBoxH} x2={ix} y2={rowPVZoneTop + 5}
                  stroke={STROKE} strokeWidth={1.2} />
              );
            })}
          </g>
        );
      })()}

      {/* ═══ ZONE CHAMPS PV (dashed box) ═══ */}
      {(() => {
        const zoneX = pvZoneStartX - 15;
        const zoneW = pvZoneW + 30;
        return (
          <g>
            <rect x={zoneX} y={rowPVZoneTop - 10} width={zoneW} height={rowPVZoneBottom - rowPVZoneTop + 20}
              fill="none" stroke={STROKE} strokeWidth={1.2} strokeDasharray="8 4" rx={3} />
            <text x={zoneX + 8} y={rowPVZoneTop + 2} fontSize={8} fontWeight={700} fill={STROKE} fontFamily={FONT}>
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
              <text x={ix} y={rowInverter + 18} textAnchor="middle" fontSize={6.5}
                fill={STROKE_LIGHT} fontFamily={FONT}>
                {fr ? `× ${inverters.length} onduleurs` : `× ${inverters.length} inverters`}
              </text>
            </g>
          );
        }

        const fuseA = Math.round(PANEL_ISC * 1.56);
        const dcCombBoxW = 80;

        return (
          <g key={inv.inverterId}>
            <IECInverterV cx={ix} cy={rowInverter} size={34} />
            <text x={ix} y={rowInverter - 22} textAnchor="middle" fontSize={7} fontWeight={600} fill={STROKE} fontFamily={FONT}>
              {fr ? `Onduleur H-${inv.inverterId}` : `Inverter H-${inv.inverterId}`}
            </text>
            <text x={ix} y={rowInverter + 24} textAnchor="middle" fontSize={6} fill={STROKE_LIGHT} fontFamily={FONT}>
              {`${inv.powerKW}kW`}
            </text>

            <line x1={ix} y1={rowInverter + 17} x2={ix} y2={rowDCCombiner - 18} stroke={STROKE} strokeWidth={1.2} />

            <rect x={ix - dcCombBoxW / 2} y={rowDCCombiner - 15} width={dcCombBoxW} height={30}
              fill="white" stroke={STROKE} strokeWidth={1.2} strokeDasharray="5 2" rx={2} />

            {(() => {
              const fc = Math.min(inv.strings.length, 4);
              const spacing = dcCombBoxW / (fc + 1);
              return Array.from({ length: fc }).map((_, i) => {
                const fx = ix - dcCombBoxW / 2 + spacing * (i + 1);
                return <IECFuseV key={i} cx={fx} y={rowDCCombiner - 8} length={12} />;
              });
            })()}

            <text x={ix} y={rowDCCombiner + 24} textAnchor="middle" fontSize={5.5} fill={STROKE_LIGHT} fontFamily={FONT}>
              {fr ? "Boîte de combinaison CC" : "DC Combiner Box"}
            </text>

            {(() => {
              const maxShow = 2;
              const showAllStr = inv.strings.length <= maxShow;
              const displayStr = showAllStr ? inv.strings : [inv.strings[0], inv.strings[inv.strings.length - 1]];
              const strSpacing = 32;
              const startX = ix - ((displayStr.length - 1) * strSpacing) / 2;

              return (
                <g>
                  {displayStr.map((str, si) => {
                    const sx = startX + si * strSpacing;
                    return (
                      <g key={str.stringId}>
                        <line x1={sx} y1={rowDCCombiner + 15} x2={sx} y2={rowDCFuse - 2} stroke={STROKE} strokeWidth={1} />
                        <IECFuseV cx={sx} y={rowDCFuse} length={12} />
                        <text x={sx + 10} y={rowDCFuse + 6} fontSize={5} fill={STROKE_LIGHT} fontFamily={FONT}>
                          {`${fuseA}A`}
                        </text>
                        <line x1={sx} y1={rowDCFuse + 12} x2={sx} y2={rowPVStrings - 10} stroke={STROKE} strokeWidth={1} strokeDasharray="3 2" />
                        <IECPVModuleV cx={sx} cy={rowPVStrings} />
                        <text x={sx} y={rowPVStrings + 14} textAnchor="middle" fontSize={5.5} fill={STROKE_LIGHT} fontFamily={FONT}>
                          PV-{String(((inv.inverterId - 1) * inv.strings.length + str.stringId)).padStart(2, "0")}
                        </text>
                      </g>
                    );
                  })}

                  {!showAllStr && (
                    <text x={ix} y={rowDCFuse + 6} textAnchor="middle" fontSize={9} fill={STROKE_FAINT} fontFamily={FONT}>
                      {"..."}
                    </text>
                  )}
                </g>
              );
            })()}
          </g>
        );
      })}

      {/* ═══ RIGHT PANEL: NOTE + SUMMARY TABLE + LÉGENDE + TITLE BLOCK ═══ */}
      {(() => {
        const rpX = totalW - rightPanelW;

        return (
          <g>
            <rect x={rpX} y={0} width={rightPanelW} height={totalH} fill="white" stroke={STROKE} strokeWidth={1.5} />

            {/* NOTE */}
            <rect x={rpX} y={0} width={rightPanelW} height={40} fill="white" stroke={STROKE} strokeWidth={0.8} />
            <text x={rpX + 8} y={13} fontSize={7} fontWeight={700} fill={STROKE} fontFamily={FONT}>NOTE</text>
            <line x1={rpX + 8} y1={16} x2={rpX + 35} y2={16} stroke={STROKE} strokeWidth={0.5} />
            <text x={rpX + 8} y={27} fontSize={5.5} fill={STROKE_LIGHT} fontFamily={FONT}>
              {fr ? "Ce document est un document type et" : "This is a typical drawing and"}
            </text>
            <text x={rpX + 8} y={35} fontSize={5.5} fill={STROKE_LIGHT} fontFamily={FONT}>
              {fr ? "non pas pour la construction." : "not for construction."}
            </text>

            {/* SYSTEM SUMMARY TABLE */}
            <SystemSummaryTable
              x={rpX} y={45} w={rightPanelW}
              config={config} fr={fr}
              totalStrings={totalStrings} panelsPerString={panelsPerString}
              inverterCount={inverters.length}
            />

            {/* LÉGENDE */}
            <LegendBox x={rpX} y={155} w={rightPanelW} fr={fr} />

            {/* TITLE BLOCK */}
            <TitleBlock
              x={rpX} y={totalH - 70}
              w={rightPanelW} h={70}
              config={config} fr={fr}
            />
          </g>
        );
      })()}
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

  const grpColW = 130;
  const gapCol = hiddenCount > 0 ? 50 : 0;

  const marginLeft = 18;
  const marginTop = 16;
  const rightPanelW = 220;

  const pvZoneW = Math.max(displayCount * grpColW + gapCol, 320);
  const mainAreaW = pvZoneW + 100;
  const totalW = mainAreaW + marginLeft * 2 + rightPanelW;

  const rowGrid = marginTop + 30;
  const rowBreaker1 = rowGrid + 55;
  const rowMeter = rowBreaker1 + 45;
  const rowACPanel = rowMeter + 55;
  const rowPVZoneTop = rowACPanel + 55;
  const rowBranchBreaker = rowPVZoneTop + 40;
  const rowMicroInv = rowBranchBreaker + 55;
  const rowPVArrays = rowMicroInv + 55;
  const rowPVZoneBottom = rowPVArrays + 40;

  const totalH = rowPVZoneBottom + 30 + marginTop;
  const centerX = marginLeft + 60;
  const innerW = mainAreaW;
  const innerH = totalH - marginTop * 2;

  const pvZoneStartX = marginLeft + 80;
  const getGrpX = (dispIdx: number) => {
    if (showAll) {
      const blockStart = pvZoneStartX + (pvZoneW - displayCount * grpColW) / 2;
      return blockStart + dispIdx * grpColW + grpColW / 2;
    }
    const blockStart = pvZoneStartX + (pvZoneW - (displayCount * grpColW + gapCol)) / 2;
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
      <GridBorder width={totalW - rightPanelW} height={totalH} marginLeft={marginLeft} marginTop={marginTop}
        innerW={innerW} innerH={innerH} />

      <UtilityPole cx={centerX} cy={rowGrid} />
      <text x={centerX} y={rowGrid + 24} textAnchor="middle" fontSize={6.5} fill={STROKE_LIGHT} fontFamily={FONT}>
        {fr ? "Réseau" : "Grid"}
      </text>

      <line x1={centerX} y1={rowGrid + 15} x2={centerX} y2={rowBreaker1 - 3} stroke={STROKE} strokeWidth={1.5} />
      <IECBreakerV cx={centerX} y1={rowBreaker1} length={22} />
      <text x={centerX - 20} y={rowBreaker1 + 10} fontSize={7} fill={STROKE} fontWeight={600} fontFamily={FONT} textAnchor="end">
        {`${serviceA}A`}
      </text>

      <line x1={centerX} y1={rowBreaker1 + 22} x2={centerX} y2={rowMeter - 14} stroke={STROKE} strokeWidth={1.5} />
      <IECMeterV cx={centerX} cy={rowMeter} r={14} />

      <line x1={centerX} y1={rowMeter + 14} x2={centerX} y2={rowACPanel - 20} stroke={STROKE} strokeWidth={1.5} />
      <rect x={centerX - 40} y={rowACPanel - 20} width={80} height={35}
        fill="white" stroke={STROKE} strokeWidth={1.5} rx={2} />
      <text x={centerX} y={rowACPanel} textAnchor="middle" dominantBaseline="middle" fontSize={7} fontWeight={600}
        fill={STROKE} fontFamily={FONT}>{fr ? "Panneau principal" : "Main Panel"}</text>
      <text x={centerX} y={rowACPanel + 10} textAnchor="middle" fontSize={6} fill={STROKE_LIGHT} fontFamily={FONT}>
        {`${mainBreakerA}A / ${serviceV}V`}
      </text>
      <IECGroundV cx={centerX + 50} topY={rowACPanel - 5} />

      <line x1={centerX} y1={rowACPanel + 15} x2={centerX} y2={rowPVZoneTop} stroke={STROKE} strokeWidth={1.5} />

      {/* ZONE CHAMPS PV */}
      {(() => {
        const zoneX = pvZoneStartX - 15;
        const zoneW = pvZoneW + 30;
        return (
          <g>
            <rect x={zoneX} y={rowPVZoneTop - 10} width={zoneW} height={rowPVZoneBottom - rowPVZoneTop + 20}
              fill="none" stroke={STROKE} strokeWidth={1.2} strokeDasharray="8 4" rx={3} />
            <text x={zoneX + 8} y={rowPVZoneTop + 2} fontSize={8} fontWeight={700} fill={STROKE} fontFamily={FONT}>
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

      {displayGroups.map((grp, dispIdx) => {
        const gx = getGrpX(dispIdx);
        const isMiddleGap = !showAll && dispIdx === 1;

        if (isMiddleGap) {
          return (
            <g key={`gap-${grp.arrayId}`}>
              <text x={gx} y={rowMicroInv} textAnchor="middle" fontSize={14}
                fill={STROKE_FAINT} fontFamily={FONT}>{"..."}</text>
              <text x={gx} y={rowMicroInv + 18} textAnchor="middle" fontSize={6.5}
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

            <line x1={gx} y1={rowBranchBreaker + 20} x2={gx} y2={rowMicroInv - 17} stroke={STROKE} strokeWidth={1.2} />

            <IECInverterV cx={gx} cy={rowMicroInv} size={34} />
            <text x={gx} y={rowMicroInv + 24} textAnchor="middle" fontSize={7} fontWeight={600} fill={STROKE} fontFamily={FONT}>
              {`${grp.panelCount}× μINV`}
            </text>
            <text x={gx} y={rowMicroInv + 33} textAnchor="middle" fontSize={6} fill={STROKE_LIGHT} fontFamily={FONT}>
              {`${microW}W ${fr ? "chaque" : "each"}`}
            </text>

            <line x1={gx} y1={rowMicroInv + 17} x2={gx} y2={rowPVArrays - 10} stroke={STROKE} strokeWidth={1.2} strokeDasharray="3 2" />

            <IECPVModuleV cx={gx} cy={rowPVArrays} />
            <text x={gx} y={rowPVArrays + 14} textAnchor="middle" fontSize={6} fill={STROKE_LIGHT} fontFamily={FONT}>
              {`Array #${grp.arrayId}`}
            </text>
            <text x={gx} y={rowPVArrays + 23} textAnchor="middle" fontSize={5.5} fill={STROKE_LIGHT} fontFamily={FONT}>
              {`${grp.panelCount} pan. / ${grp.capacityKW}kW`}
            </text>
          </g>
        );
      })}

      {/* ═══ RIGHT PANEL ═══ */}
      {(() => {
        const rpX = totalW - rightPanelW;
        return (
          <g>
            <rect x={rpX} y={0} width={rightPanelW} height={totalH} fill="white" stroke={STROKE} strokeWidth={1.5} />

            <rect x={rpX} y={0} width={rightPanelW} height={40} fill="white" stroke={STROKE} strokeWidth={0.8} />
            <text x={rpX + 8} y={13} fontSize={7} fontWeight={700} fill={STROKE} fontFamily={FONT}>NOTE</text>
            <line x1={rpX + 8} y1={16} x2={rpX + 35} y2={16} stroke={STROKE} strokeWidth={0.5} />
            <text x={rpX + 8} y={27} fontSize={5.5} fill={STROKE_LIGHT} fontFamily={FONT}>
              {fr ? "Ce document est un document type et" : "This is a typical drawing and"}
            </text>
            <text x={rpX + 8} y={35} fontSize={5.5} fill={STROKE_LIGHT} fontFamily={FONT}>
              {fr ? "non pas pour la construction." : "not for construction."}
            </text>

            <LegendBox x={rpX} y={45} w={rightPanelW} fr={fr} />

            <TitleBlock
              x={rpX} y={totalH - 70}
              w={rightPanelW} h={70}
              config={config} fr={fr}
            />
          </g>
        );
      })()}
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

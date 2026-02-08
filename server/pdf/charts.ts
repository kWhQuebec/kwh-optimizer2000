import type { CashflowEntry, PeakWeekEntry, FrontierPoint } from "@shared/schema";
import type { PDFContext } from "./types";
import { COLORS } from "./types";
import { formatCurrency, formatSmartCurrency, drawRoundedRect } from "./helpers";

export function drawBarChart(
  ctx: PDFContext,
  x: number,
  y: number,
  width: number,
  height: number,
  data: Array<{ label: string; value: number; color: string }>,
  title: string,
  maxValue?: number
) {
  const { doc, t } = ctx;
  const chartHeight = height - 40;
  const barWidth = (width - 40) / data.length - 10;
  const max = maxValue || Math.max(...data.map((d) => Math.abs(d.value))) * 1.1;

  doc.fontSize(11).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(title, x, y, { width });
  doc.font("Helvetica");

  const chartY = y + 25;
  const baselineY = chartY + chartHeight * 0.7;

  data.forEach((item, i) => {
    const barX = x + 20 + i * (barWidth + 10);
    const barHeight = (Math.abs(item.value) / max) * (chartHeight * 0.6);
    const barY = item.value >= 0 ? baselineY - barHeight : baselineY;

    drawRoundedRect(doc, barX, barY, barWidth, barHeight, 3, item.color);

    doc.fontSize(8).fillColor(COLORS.darkGray);
    doc.text(formatCurrency(item.value, true), barX, barY - 12, { width: barWidth, align: "center" });

    doc.fontSize(7).fillColor(COLORS.mediumGray);
    doc.text(item.label, barX - 5, baselineY + 5, { width: barWidth + 10, align: "center" });
  });

  doc.strokeColor(COLORS.lightGray).lineWidth(1);
  doc.moveTo(x + 10, baselineY).lineTo(x + width - 10, baselineY).stroke();
}

export function drawCashflowChart(
  ctx: PDFContext,
  x: number,
  y: number,
  width: number,
  height: number,
  cashflows: CashflowEntry[],
  title: string
) {
  const { doc, t } = ctx;
  const chartHeight = height - 50;
  const chartWidth = width - 60;
  const chartX = x + 40;
  const chartY = y + 30;

  doc.fontSize(11).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(title, x, y, { width });
  doc.font("Helvetica");

  if (!cashflows || cashflows.length === 0) return;

  const years = cashflows
    .filter((c) => c.year >= 0)
    .map(c => ({
      ...c,
      netCashflow: isFinite(c.netCashflow) ? c.netCashflow : 0,
      cumulative: isFinite(c.cumulative) ? c.cumulative : 0,
    }));
  if (years.length === 0) return;

  const maxCumul = Math.max(...years.map((c) => c.cumulative));
  const minCumul = Math.min(...years.map((c) => c.cumulative));
  const range = maxCumul - minCumul || 1;

  const barWidth = chartWidth / years.length - 2;
  const baselineY = chartY + chartHeight * 0.6;

  const cumulPoints: Array<{ x: number; y: number }> = [];

  years.forEach((cf, i) => {
    const barX = chartX + i * (barWidth + 2);
    const netValue = cf.netCashflow;
    const barH = Math.abs(netValue) / (range / 2) * (chartHeight * 0.3);
    const barY = netValue >= 0 ? baselineY - barH : baselineY;

    const barColor = netValue >= 0 ? COLORS.green : COLORS.red;
    doc.rect(barX, barY, barWidth, Math.max(barH, 2)).fillColor(barColor).fill();

    const cumulY = chartY + chartHeight - ((cf.cumulative - minCumul) / range) * chartHeight;
    cumulPoints.push({ x: barX + barWidth / 2, y: cumulY });

    if (cf.year % 5 === 0) {
      doc.fontSize(7).fillColor(COLORS.mediumGray);
      doc.text(cf.year.toString(), barX - 5, baselineY + chartHeight * 0.35, { width: barWidth + 10, align: "center" });
    }
  });

  if (cumulPoints.length > 1) {
    doc.strokeColor(COLORS.blue).lineWidth(2);
    doc.moveTo(cumulPoints[0].x, cumulPoints[0].y);
    for (let i = 1; i < cumulPoints.length; i++) {
      doc.lineTo(cumulPoints[i].x, cumulPoints[i].y);
    }
    doc.stroke();

    cumulPoints.forEach((p) => {
      doc.circle(p.x, p.y, 2).fillColor(COLORS.blue).fill();
    });
  }

  const zeroY = chartY + chartHeight - ((0 - minCumul) / range) * chartHeight;
  doc.strokeColor(COLORS.lightGray).lineWidth(0.5);
  doc.moveTo(chartX, zeroY).lineTo(chartX + chartWidth, zeroY).stroke();

  doc.strokeColor(COLORS.mediumGray).lineWidth(1);
  doc.moveTo(chartX, baselineY).lineTo(chartX + chartWidth, baselineY).stroke();

  const legendY = y + height - 15;
  doc.fontSize(7).fillColor(COLORS.mediumGray);
  doc.rect(x + 20, legendY, 10, 8).fillColor(COLORS.green).fill();
  doc.text(t("Flux annuel", "Annual cashflow"), x + 35, legendY);
  doc.strokeColor(COLORS.blue).lineWidth(2).moveTo(x + 120, legendY + 4).lineTo(x + 140, legendY + 4).stroke();
  doc.text(t("Cumulatif", "Cumulative"), x + 145, legendY);
}

export function drawPeakImpactChart(
  ctx: PDFContext,
  x: number,
  y: number,
  width: number,
  height: number,
  peakWeekData: PeakWeekEntry[] | undefined,
  title: string
) {
  const { doc, t, simulation } = ctx;
  doc.fontSize(11).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(title, x, y, { width });
  doc.font("Helvetica");

  if (!peakWeekData || peakWeekData.length === 0) {
    doc.fontSize(9).fillColor(COLORS.lightGray);
    doc.text(t("Données non disponibles", "Data not available"), x + 20, y + 40);
    return;
  }

  const chartHeight = height - 50;
  const chartWidth = width - 20;
  const chartX = x + 10;
  const chartY = y + 30;

  const maxDemand = Math.max(...peakWeekData.map((d) => d.peakBefore || 0)) * 1.1;
  const points = peakWeekData.slice(0, Math.min(168, peakWeekData.length));

  doc.strokeColor(COLORS.red).lineWidth(1.5);
  points.forEach((p, i) => {
    const px = chartX + (i / points.length) * chartWidth;
    const py = chartY + chartHeight - ((p.peakBefore || 0) / maxDemand) * chartHeight;
    if (i === 0) doc.moveTo(px, py);
    else doc.lineTo(px, py);
  });
  doc.stroke();

  doc.strokeColor(COLORS.green).lineWidth(1.5);
  points.forEach((p, i) => {
    const px = chartX + (i / points.length) * chartWidth;
    const py = chartY + chartHeight - ((p.peakAfter || 0) / maxDemand) * chartHeight;
    if (i === 0) doc.moveTo(px, py);
    else doc.lineTo(px, py);
  });
  doc.stroke();

  if (simulation.demandShavingSetpointKW > 0) {
    const setpointY = chartY + chartHeight - (simulation.demandShavingSetpointKW / maxDemand) * chartHeight;
    doc.strokeColor(COLORS.gold).lineWidth(1).dash(4, { space: 2 });
    doc.moveTo(chartX, setpointY).lineTo(chartX + chartWidth, setpointY).stroke();
    doc.undash();
  }

  const legendY = y + height - 15;
  doc.fontSize(7).fillColor(COLORS.mediumGray);
  doc.strokeColor(COLORS.red).lineWidth(2).moveTo(x + 10, legendY + 4).lineTo(x + 30, legendY + 4).stroke();
  doc.text(t("Demande actuelle", "Current demand"), x + 35, legendY);
  doc.strokeColor(COLORS.green).lineWidth(2).moveTo(x + 130, legendY + 4).lineTo(x + 150, legendY + 4).stroke();
  doc.text(t("Après PV+Batterie", "After PV+Battery"), x + 155, legendY);
}

export function drawFrontierScatterChart(
  ctx: PDFContext,
  x: number,
  y: number,
  width: number,
  height: number,
  frontier: FrontierPoint[],
  title: string
) {
  const { doc, t } = ctx;
  doc.fontSize(10).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(title, x, y, { width });
  doc.font("Helvetica");

  if (!frontier || frontier.length === 0) {
    doc.fontSize(8).fillColor(COLORS.lightGray);
    doc.text(t("Données non disponibles", "Data not available"), x + 20, y + 30);
    return;
  }

  const chartHeight = height - 40;
  const chartWidth = width - 60;
  const chartX = x + 50;
  const chartY = y + 25;

  const capexValues = frontier.map(p => p.capexNet || 0);
  const npvValues = frontier.map(p => p.npv25 || 0);
  const maxCapex = Math.max(...capexValues) * 1.1 || 1;
  const minCapex = Math.min(...capexValues, 0) * 0.9;
  const maxNpv = Math.max(...npvValues) * 1.1;
  const minNpv = Math.min(...npvValues, 0) * 1.1;
  const npvRange = maxNpv - minNpv || 1;
  const capexRange = maxCapex - minCapex || 1;

  doc.strokeColor(COLORS.lightGray).lineWidth(0.5);
  doc.moveTo(chartX, chartY).lineTo(chartX, chartY + chartHeight).stroke();
  doc.moveTo(chartX, chartY + chartHeight).lineTo(chartX + chartWidth, chartY + chartHeight).stroke();

  doc.fontSize(7).fillColor(COLORS.mediumGray);
  doc.text(t("CAPEX ($)", "CAPEX ($)"), chartX + chartWidth / 2 - 20, chartY + chartHeight + 8);
  doc.save();
  doc.translate(x + 8, chartY + chartHeight / 2);
  doc.rotate(-90);
  doc.text(t("VAN 25 ans ($)", "NPV 25yr ($)"), -30, 0);
  doc.restore();

  frontier.forEach((point) => {
    const px = chartX + ((point.capexNet - minCapex) / capexRange) * chartWidth;
    const py = chartY + chartHeight - ((point.npv25 - minNpv) / npvRange) * chartHeight;

    let color = COLORS.lightGray;
    if (point.type === "solar") color = COLORS.gold;
    else if (point.type === "battery") color = COLORS.blue;
    else if (point.type === "hybrid") color = COLORS.green;

    doc.circle(px, py, point.isOptimal ? 5 : 3).fillColor(color).fill();
    if (point.isOptimal) {
      doc.circle(px, py, 6).strokeColor(COLORS.darkGray).lineWidth(1.5).stroke();
    }
  });

  const legendY = y + height - 8;
  doc.fontSize(6).fillColor(COLORS.mediumGray);
  doc.circle(x + 15, legendY, 3).fillColor(COLORS.gold).fill();
  doc.text(t("Solaire", "Solar"), x + 22, legendY - 3);
  doc.circle(x + 60, legendY, 3).fillColor(COLORS.blue).fill();
  doc.text(t("Batterie", "Battery"), x + 67, legendY - 3);
  doc.circle(x + 115, legendY, 3).fillColor(COLORS.green).fill();
  doc.text(t("Hybride", "Hybrid"), x + 122, legendY - 3);
  doc.circle(x + 170, legendY, 5).strokeColor(COLORS.darkGray).lineWidth(1).stroke();
  doc.text(t("Optimal", "Optimal"), x + 180, legendY - 3);
}

export function drawOptimizationLineChart(
  ctx: PDFContext,
  x: number,
  y: number,
  width: number,
  height: number,
  data: Array<{ x: number; y: number; isOptimal?: boolean }>,
  title: string,
  xLabel: string,
  yLabel: string,
  lineColor: string = COLORS.blue
) {
  const { doc, t } = ctx;
  doc.fontSize(10).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(title, x, y, { width });
  doc.font("Helvetica");

  if (!data || data.length === 0) {
    doc.fontSize(8).fillColor(COLORS.lightGray);
    doc.text(t("Données non disponibles", "Data not available"), x + 20, y + 30);
    return;
  }

  const chartHeight = height - 40;
  const chartWidth = width - 60;
  const chartX = x + 50;
  const chartY = y + 25;

  const xValues = data.map(p => p.x);
  const yValues = data.map(p => p.y);
  const maxX = Math.max(...xValues) * 1.05 || 1;
  const minX = Math.min(...xValues) * 0.95;
  const maxY = Math.max(...yValues) * 1.1;
  const minY = Math.min(...yValues, 0) * 1.1;
  const xRange = maxX - minX || 1;
  const yRange = maxY - minY || 1;

  doc.strokeColor(COLORS.lightGray).lineWidth(0.5);
  doc.moveTo(chartX, chartY).lineTo(chartX, chartY + chartHeight).stroke();
  doc.moveTo(chartX, chartY + chartHeight).lineTo(chartX + chartWidth, chartY + chartHeight).stroke();

  doc.fontSize(7).fillColor(COLORS.mediumGray);
  doc.text(xLabel, chartX + chartWidth / 2 - 20, chartY + chartHeight + 8);
  doc.save();
  doc.translate(x + 8, chartY + chartHeight / 2);
  doc.rotate(-90);
  doc.text(yLabel, -30, 0);
  doc.restore();

  doc.strokeColor(lineColor).lineWidth(1.5);
  const sortedData = [...data].sort((a, b) => a.x - b.x);
  sortedData.forEach((point, i) => {
    const px = chartX + ((point.x - minX) / xRange) * chartWidth;
    const py = chartY + chartHeight - ((point.y - minY) / yRange) * chartHeight;
    if (i === 0) doc.moveTo(px, py);
    else doc.lineTo(px, py);
  });
  doc.stroke();

  sortedData.forEach((point) => {
    const px = chartX + ((point.x - minX) / xRange) * chartWidth;
    const py = chartY + chartHeight - ((point.y - minY) / yRange) * chartHeight;
    doc.circle(px, py, 2).fillColor(lineColor).fill();
    if (point.isOptimal) {
      doc.circle(px, py, 5).strokeColor(COLORS.darkGray).lineWidth(1.5).stroke();
    }
  });

  const optimalPoint = sortedData.find(p => p.isOptimal);
  if (optimalPoint) {
    const px = chartX + ((optimalPoint.x - minX) / xRange) * chartWidth;
    const py = chartY + chartHeight - ((optimalPoint.y - minY) / yRange) * chartHeight;
    doc.fontSize(7).fillColor(COLORS.green).font("Helvetica-Bold");
    doc.text(t("Optimal", "Optimal"), px + 8, py - 10);
    doc.font("Helvetica");
  }
}

export function drawWaterfallChart(
  ctx: PDFContext,
  x: number,
  y: number,
  width: number,
  height: number,
  items: Array<{ label: string; value: number; isDeduction: boolean }>,
  resultLabel: string,
  resultValue: number
) {
  const { doc, t } = ctx;
  const chartHeight = height - 50;
  const chartWidth = width - 20;
  const chartX = x + 10;
  const chartY = y + 10;

  const allValues = items.map(i => i.value);
  allValues.push(resultValue);
  const maxVal = Math.max(...allValues) * 1.15;

  const numBars = items.length + 1; // +1 for result
  const barWidth = Math.min(60, (chartWidth - 20) / numBars - 8);
  const gap = (chartWidth - numBars * barWidth) / (numBars + 1);

  const scaleY = (val: number) => (val / maxVal) * chartHeight;
  const baseY = chartY + chartHeight;

  // Running total for waterfall
  let runningTop = scaleY(items[0]?.value || 0);

  items.forEach((item, i) => {
    const bx = chartX + gap + i * (barWidth + gap);

    if (i === 0) {
      // First bar starts from baseline
      const barH = scaleY(item.value);
      doc.rect(bx, baseY - barH, barWidth, barH).fillColor(COLORS.mediumGray).fill();
      runningTop = barH;
    } else {
      // Deduction bars hang from current running total
      const deductH = scaleY(item.value);
      const newTop = runningTop - deductH;
      doc.rect(bx, baseY - runningTop, barWidth, deductH).fillColor(COLORS.green).fill();
      // Connector line from previous bar
      doc.strokeColor(COLORS.lightGray).lineWidth(0.5).dash(2, { space: 2 });
      doc.moveTo(bx - gap / 2, baseY - runningTop).lineTo(bx + barWidth / 2, baseY - runningTop).stroke();
      doc.undash();
      runningTop = newTop;
    }

    // Value label above/inside bar
    doc.fontSize(8).fillColor(COLORS.darkGray).font("Helvetica-Bold");
    const valText = i === 0 ? formatSmartCurrency(item.value) : `- ${formatSmartCurrency(item.value)}`;
    doc.text(valText, bx - 5, baseY - runningTop - (i === 0 ? scaleY(item.value) : 0) - 14, { width: barWidth + 10, align: "center" });
    doc.font("Helvetica");

    // Label below
    doc.fontSize(6).fillColor(COLORS.mediumGray);
    doc.text(item.label, bx - 10, baseY + 4, { width: barWidth + 20, align: "center" });
  });

  // Result bar
  const resultIdx = items.length;
  const rx = chartX + gap + resultIdx * (barWidth + gap);
  const resultH = scaleY(resultValue);
  doc.rect(rx, baseY - resultH, barWidth, resultH).fillColor(COLORS.blue).fill();

  // Connector
  doc.strokeColor(COLORS.lightGray).lineWidth(0.5).dash(2, { space: 2 });
  doc.moveTo(rx - gap / 2, baseY - runningTop).lineTo(rx + barWidth / 2, baseY - runningTop).stroke();
  doc.undash();

  doc.fontSize(9).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(formatSmartCurrency(resultValue), rx - 5, baseY - resultH - 14, { width: barWidth + 10, align: "center" });
  doc.font("Helvetica");

  doc.fontSize(7).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(resultLabel, rx - 10, baseY + 4, { width: barWidth + 20, align: "center" });
  doc.font("Helvetica");

  // Baseline
  doc.strokeColor(COLORS.lightGray).lineWidth(1);
  doc.moveTo(chartX, baseY).lineTo(chartX + chartWidth, baseY).stroke();
}

export function drawCostOfInactionChart(
  ctx: PDFContext,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const { doc, t, simulation } = ctx;

  const years = 25;
  const inflationRate = 0.035; // HQ tariff escalation standard
  let cumulWithout = 0;
  let cumulWith = 0;
  const costData: Array<{ year: number; without: number; with: number }> = [];

  for (let yr = 0; yr <= years; yr++) {
    const yearCost = simulation.annualCostBefore * Math.pow(1 + inflationRate, yr);
    const yearCostAfter = simulation.annualCostAfter * Math.pow(1 + inflationRate, yr);
    cumulWithout += yearCost;
    cumulWith += yearCostAfter + (yr === 0 ? simulation.capexNet : 0);
    costData.push({ year: yr, without: cumulWithout, with: cumulWith });
  }

  const maxCost = Math.max(cumulWithout, cumulWith);

  // "Without solar" line
  doc.strokeColor(COLORS.red).lineWidth(2);
  costData.forEach((d, i) => {
    const px = x + 40 + (d.year / years) * (width - 60);
    const py = y + height - (d.without / maxCost) * (height - 20);
    if (i === 0) doc.moveTo(px, py);
    else doc.lineTo(px, py);
  });
  doc.stroke();

  // "With solar" line
  doc.strokeColor(COLORS.green).lineWidth(2);
  costData.forEach((d, i) => {
    const px = x + 40 + (d.year / years) * (width - 60);
    const py = y + height - (d.with / maxCost) * (height - 20);
    if (i === 0) doc.moveTo(px, py);
    else doc.lineTo(px, py);
  });
  doc.stroke();

  // Shade the savings gap between the two lines
  doc.save();
  doc.strokeColor("transparent");
  const fillPath = doc;
  costData.forEach((d, i) => {
    const px = x + 40 + (d.year / years) * (width - 60);
    const py = y + height - (d.without / maxCost) * (height - 20);
    if (i === 0) fillPath.moveTo(px, py);
    else fillPath.lineTo(px, py);
  });
  for (let i = costData.length - 1; i >= 0; i--) {
    const d = costData[i];
    const px = x + 40 + (d.year / years) * (width - 60);
    const py = y + height - (d.with / maxCost) * (height - 20);
    fillPath.lineTo(px, py);
  }
  fillPath.fillColor(COLORS.green).fillOpacity(0.1).fill();
  doc.restore();
  doc.fillOpacity(1);

  // Savings at year 25
  const savingsAt25 = cumulWithout - cumulWith;
  doc.fontSize(10).fillColor(COLORS.green).font("Helvetica-Bold");
  doc.text(`${t("Économies", "Savings")}: ${formatCurrency(savingsAt25)}`, x + width - 150, y + 20);
  doc.font("Helvetica");

  // Legend
  doc.fontSize(8).fillColor(COLORS.mediumGray);
  doc.strokeColor(COLORS.red).lineWidth(2).moveTo(x + 40, y + height + 10).lineTo(x + 60, y + height + 10).stroke();
  doc.text(t("Sans solaire", "Without solar"), x + 65, y + height + 7);
  doc.strokeColor(COLORS.green).lineWidth(2).moveTo(x + 160, y + height + 10).lineTo(x + 180, y + height + 10).stroke();
  doc.text(t("Avec solaire + stockage", "With solar + storage"), x + 185, y + height + 7);
}

/**
 * Diagnose battery dispatch bug — why is demand reduction stuck at 3.9 kW?
 *
 * Usage: npx tsx scripts/diagnose-battery.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { buildHourlyData } from '../server/routes/siteAnalysisHelpers';

const __filename2 = fileURLToPath(import.meta.url);
const __dirname2 = path.dirname(__filename2);

// Parse HQ 15-min CSV files
function parseHQ15minCSV(filePath: string): Array<{ kWh: number | null; kW: number | null; timestamp: Date }> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const readings: Array<{ kWh: number | null; kW: number | null; timestamp: Date }> = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(';');
    if (parts.length < 3) continue;
    const dateStr = parts[1]?.trim();
    const kwStr = parts[2]?.trim().replace(',', '.');
    if (!dateStr || !kwStr) continue;
    const timestamp = new Date(dateStr);
    if (isNaN(timestamp.getTime())) continue;
    const kW = parseFloat(kwStr);
    if (isNaN(kW)) continue;
    readings.push({ kWh: null, kW, timestamp });
  }
  return readings;
}

// Load data
const assetsDir = path.join(__dirname2, '..', 'attached_assets');
const files = fs.readdirSync(assetsDir)
  .filter(f => f.startsWith('0300164754_15min_') && f.endsWith('.csv') && !f.includes(' 2.csv'))
  .sort();

let allReadings: Array<{ kWh: number | null; kW: number | null; timestamp: Date }> = [];
for (const file of files) {
  const readings = parseHQ15minCSV(path.join(assetsDir, file));
  allReadings.push(...readings);
}
allReadings.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
const seen = new Set<string>();
allReadings = allReadings.filter(r => {
  const key = r.timestamp.toISOString();
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

const rawPeakKW = Math.max(...allReadings.map(r => r.kW || 0));
console.log(`\nRaw readings: ${allReadings.length}, rawPeakKW: ${rawPeakKW.toFixed(1)} kW\n`);

// ── Build hourly data ──
const { hourlyData, interpolatedMonths, usedRealDailyProfiles } = buildHourlyData(allReadings);
console.log(`Hourly data: ${hourlyData.length} entries`);
console.log(`Used real daily profiles: ${usedRealDailyProfiles}`);
console.log(`Interpolated months: ${interpolatedMonths.join(', ') || 'none'}\n`);

// ── Analyze peak distribution in hourly profile ──
const peaks = hourlyData.map(h => h.peak);
const maxProfilePeak = Math.max(...peaks);
const peaksAbove100 = peaks.filter(p => p > 100).length;
const peaksAbove129 = peaks.filter(p => p > 129).length;
const peaksAbove150 = peaks.filter(p => p > 150).length;
const peaksAbove180 = peaks.filter(p => p > 180).length;
const peaksAbove190 = peaks.filter(p => p > 190).length;
const peaksAbove195 = peaks.filter(p => p > 195).length;

console.log(`═══════════════════════════════════════════════`);
console.log(`  PEAK DISTRIBUTION IN HOURLY PROFILE`);
console.log(`═══════════════════════════════════════════════`);
console.log(`  Max peak in profile: ${maxProfilePeak.toFixed(1)} kW`);
console.log(`  Hours > 100 kW: ${peaksAbove100} / ${hourlyData.length}`);
console.log(`  Hours > 129 kW (threshold): ${peaksAbove129} / ${hourlyData.length}`);
console.log(`  Hours > 150 kW: ${peaksAbove150}`);
console.log(`  Hours > 180 kW: ${peaksAbove180}`);
console.log(`  Hours > 190 kW: ${peaksAbove190}`);
console.log(`  Hours > 195 kW: ${peaksAbove195}`);

// ── Top 20 peak hours ──
console.log(`\n  TOP 20 PEAK HOURS:`);
const indexed = hourlyData.map((h, i) => ({ ...h, index: i }));
indexed.sort((a, b) => b.peak - a.peak);
for (let i = 0; i < 20; i++) {
  const h = indexed[i];
  const dayIndex = Math.floor(h.index / 24);
  console.log(`    #${i + 1}: month=${h.month}, hour=${h.hour}, day~${dayIndex}, peak=${h.peak.toFixed(1)} kW, consumption=${h.consumption.toFixed(1)} kWh`);
}

// ── Monthly peak analysis ──
console.log(`\n═══════════════════════════════════════════════`);
console.log(`  MONTHLY PEAKS IN HOURLY PROFILE`);
console.log(`═══════════════════════════════════════════════`);
for (let m = 1; m <= 12; m++) {
  const monthHours = hourlyData.filter(h => h.month === m);
  const monthPeak = Math.max(...monthHours.map(h => h.peak));
  const hoursAboveThreshold = monthHours.filter(h => h.peak > 129).length;
  console.log(`  Month ${m}: peak=${monthPeak.toFixed(1)} kW, hours>129kW: ${hoursAboveThreshold}/${monthHours.length}`);
}

// ── Daily analysis: how many days have >1 hour above threshold? ──
console.log(`\n═══════════════════════════════════════════════`);
console.log(`  DAILY PEAK PATTERNS (hours > 129 kW per day)`);
console.log(`═══════════════════════════════════════════════`);
const dayMap = new Map<number, { peaks: number[]; hours: number[] }>();
for (let i = 0; i < hourlyData.length; i++) {
  const dayIndex = Math.floor(i / 24);
  const h = hourlyData[i];
  if (h.peak > 129) {
    const day = dayMap.get(dayIndex) || { peaks: [], hours: [] };
    day.peaks.push(h.peak);
    day.hours.push(h.hour);
    dayMap.set(dayIndex, day);
  }
}
let daysWithMultiple = 0;
let maxConsecutive = 0;
for (const [dayIdx, day] of dayMap) {
  if (day.peaks.length > 1) {
    daysWithMultiple++;
    maxConsecutive = Math.max(maxConsecutive, day.peaks.length);
  }
}
console.log(`  Days with >1 hour above threshold: ${daysWithMultiple} / ${dayMap.size} days with peaks`);
console.log(`  Max hours above threshold in single day: ${maxConsecutive}`);

// Show the worst days
const dayEntries = [...dayMap.entries()].sort((a, b) => Math.max(...b[1].peaks) - Math.max(...a[1].peaks));
console.log(`\n  TOP 10 WORST DAYS:`);
for (let i = 0; i < Math.min(10, dayEntries.length); i++) {
  const [dayIdx, day] = dayEntries[i];
  const maxP = Math.max(...day.peaks);
  const secondP = day.peaks.length > 1 ? day.peaks.sort((a, b) => b - a)[1] : 0;
  const month = hourlyData[dayIdx * 24]?.month;
  console.log(`    Day ${dayIdx} (month ${month}): maxPeak=${maxP.toFixed(1)}, 2ndPeak=${secondP.toFixed(1)}, count=${day.peaks.length}, hours=[${day.hours.join(',')}]`);
}

// ── Simulate battery dispatch manually for the worst month ──
console.log(`\n═══════════════════════════════════════════════`);
console.log(`  MANUAL BATTERY SIMULATION (BESS-only 200/100)`);
console.log(`═══════════════════════════════════════════════`);

const battEnergyKWh = 200;
const battPowerKW = 100;
const threshold = 129; // Math.round(Math.max(198.5 - 100, 198.5 * 0.65))

// Replicate the dailyPeakHours logic
const dailyPeakHours = new Map<string, { index: number; peak: number; hour: number }>();
for (let i = 0; i < hourlyData.length; i++) {
  const { hour, month, peak } = hourlyData[i];
  const dayIndex = Math.floor(i / 24);
  const dayKey = `${month}-${dayIndex}`;
  const existing = dailyPeakHours.get(dayKey);
  if (!existing || peak > existing.peak) {
    dailyPeakHours.set(dayKey, { index: i, peak, hour });
  }
}
const priorityPeakIndices = new Set<number>();
dailyPeakHours.forEach((dayPeak) => {
  if (dayPeak.peak > threshold) {
    priorityPeakIndices.add(dayPeak.index);
  }
});

console.log(`  Priority peak indices: ${priorityPeakIndices.size}`);
console.log(`  Total daily peak hours: ${dailyPeakHours.size}`);

// Run dispatch
let soc = battEnergyKWh * 0.5;
const monthlyPeaksBefore: number[] = new Array(12).fill(0);
const monthlyPeaksAfter: number[] = new Array(12).fill(0);
let peakAfter = 0;
let totalGridCharging = 0;
let totalDischarge = 0;
let dischargeEvents = 0;
let skippedDueToLookahead = 0;
let gridChargingEvents = 0;
let gridChargingPeakIncrease = 0;
let maxGridChargePeakFinal = 0;

for (let i = 0; i < hourlyData.length; i++) {
  const { hour, month, consumption, peak } = hourlyData[i];

  // No PV for BESS-only
  const net = consumption;

  let battAction = 0;
  let peakFinal = peak;
  let isGridCharging = false;

  if (battPowerKW > 0 && battEnergyKWh > 0) {
    const isPriorityPeak = priorityPeakIndices.has(i);

    let higherPeakComing = false;
    if (!isPriorityPeak && peak > threshold) {
      for (let lookahead = 1; lookahead <= 6 && i + lookahead < hourlyData.length; lookahead++) {
        if (hourlyData[i + lookahead].peak > peak) {
          higherPeakComing = true;
          break;
        }
      }
    }

    const shouldDischarge = peak > threshold && soc > 0 && (isPriorityPeak || !higherPeakComing);

    if (peak > threshold && soc > 0 && !shouldDischarge) {
      skippedDueToLookahead++;
    }

    if (shouldDischarge) {
      const maxDischarge = isPriorityPeak
        ? Math.min(peak - threshold, battPowerKW, soc)
        : Math.min(peak - threshold, battPowerKW, soc * 0.5);
      battAction = -maxDischarge;
      dischargeEvents++;
      totalDischarge += maxDischarge;
    } else if (hour >= 22 && soc < battEnergyKWh * 0.5) {
      const targetSoc = battEnergyKWh * 0.5;
      battAction = Math.min(battPowerKW, targetSoc - soc);
      if (battAction > 0) {
        isGridCharging = true;
        gridChargingEvents++;
        totalGridCharging += battAction;
      }
    }

    soc += battAction;
    if (battAction < 0) {
      peakFinal = Math.max(0, peak + battAction);
    } else if (isGridCharging) {
      peakFinal = peak + battAction;
      if (peakFinal > peak) {
        gridChargingPeakIncrease++;
        maxGridChargePeakFinal = Math.max(maxGridChargePeakFinal, peakFinal);
      }
    }
  }

  monthlyPeaksBefore[month - 1] = Math.max(monthlyPeaksBefore[month - 1], peak);
  monthlyPeaksAfter[month - 1] = Math.max(monthlyPeaksAfter[month - 1], peakFinal);
  peakAfter = Math.max(peakAfter, peakFinal);
}

console.log(`\n  DISPATCH RESULTS:`);
console.log(`  peakAfter: ${peakAfter.toFixed(1)} kW`);
console.log(`  demandReduction: ${(rawPeakKW - peakAfter).toFixed(1)} kW`);
console.log(`  discharge events: ${dischargeEvents}`);
console.log(`  total discharge: ${totalDischarge.toFixed(1)} kWh`);
console.log(`  skipped due to lookahead: ${skippedDueToLookahead}`);
console.log(`  grid charging events: ${gridChargingEvents}`);
console.log(`  total grid charging: ${totalGridCharging.toFixed(1)} kWh`);
console.log(`  grid charging peak increases: ${gridChargingPeakIncrease}`);
console.log(`  max peak from grid charging: ${maxGridChargePeakFinal.toFixed(1)} kW`);

console.log(`\n  MONTHLY PEAKS BEFORE vs AFTER:`);
for (let m = 0; m < 12; m++) {
  const reduction = monthlyPeaksBefore[m] - monthlyPeaksAfter[m];
  console.log(`    Month ${m + 1}: before=${monthlyPeaksBefore[m].toFixed(1)}, after=${monthlyPeaksAfter[m].toFixed(1)}, reduction=${reduction.toFixed(1)} kW`);
}

// ── Find THE hour that determines peakAfter ──
console.log(`\n  CRITICAL: HOUR THAT DETERMINES peakAfter:`);
soc = battEnergyKWh * 0.5;
for (let i = 0; i < hourlyData.length; i++) {
  const { hour, month, consumption, peak } = hourlyData[i];
  const net = consumption;

  let battAction = 0;
  let peakFinal = peak;
  let isGridCharging = false;

  const isPriorityPeak = priorityPeakIndices.has(i);
  let higherPeakComing = false;
  if (!isPriorityPeak && peak > threshold) {
    for (let lookahead = 1; lookahead <= 6 && i + lookahead < hourlyData.length; lookahead++) {
      if (hourlyData[i + lookahead].peak > peak) {
        higherPeakComing = true;
        break;
      }
    }
  }
  const shouldDischarge = peak > threshold && soc > 0 && (isPriorityPeak || !higherPeakComing);

  if (shouldDischarge) {
    const maxDischarge = isPriorityPeak
      ? Math.min(peak - threshold, battPowerKW, soc)
      : Math.min(peak - threshold, battPowerKW, soc * 0.5);
    battAction = -maxDischarge;
  } else if (hour >= 22 && soc < battEnergyKWh * 0.5) {
    const targetSoc = battEnergyKWh * 0.5;
    battAction = Math.min(battPowerKW, targetSoc - soc);
    if (battAction > 0) isGridCharging = true;
  }

  soc += battAction;
  if (battAction < 0) {
    peakFinal = Math.max(0, peak + battAction);
  } else if (isGridCharging) {
    peakFinal = peak + battAction;
  }

  // Print THE critical hours
  if (peakFinal >= peakAfter - 1) {
    const dayIndex = Math.floor(i / 24);
    const reason = isPriorityPeak ? 'PRIORITY' : (higherPeakComing ? 'SKIPPED(lookahead)' : 'NON-PRIORITY');
    console.log(`    idx=${i}, day=${dayIndex}, month=${month}, hour=${hour}, peak=${peak.toFixed(1)}, peakFinal=${peakFinal.toFixed(1)}, soc=${soc.toFixed(1)}, reason=${reason}, isGridCharge=${isGridCharging}`);
  }
}

// Format numbers with proper locale separators
// French: space for thousands, comma for decimals (e.g., 3 294,5)
// English: comma for thousands, period for decimals (e.g., 3,294.5)
export function formatNumber(value: number, lang: string, decimals?: number): string {
  const locale = lang === "fr" ? "fr-CA" : "en-CA";
  const options: Intl.NumberFormatOptions = decimals !== undefined
    ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
    : {};
  return new Intl.NumberFormat(locale, options).format(value);
}

// HQ Tariff rates (April 2025) - Weighted average rates for simplified analysis
// Source: Hydro-Québec official rate schedule April 1, 2025
export function getTariffRates(code: string): { energyRate: number; demandRate: number } {
  switch (code) {
    case "D":
      // Domestic: 46.154¢/day access + 6.905¢/kWh first 40kWh/day + 10.652¢/kWh rest
      // Using tier 1 rate as most residential consumption is in this tier
      return { energyRate: 0.06905, demandRate: 0 };
    case "G":
      // Small Power (<65kW): $14.86/mo access + $21.261/kW above 50kW
      // Energy: 11.933¢/kWh first 15,090 kWh/mo + 9.184¢/kWh rest
      // Using tier 1 rate and demand only above 50kW threshold
      return { energyRate: 0.11933, demandRate: 21.261 };
    case "M":
      // Medium Power (65kW-5MW): $17.573/kW (all power billed)
      // Energy: 6.061¢/kWh first 210,000 kWh/mo + 4.495¢/kWh rest
      return { energyRate: 0.06061, demandRate: 17.573 };
    case "L":
      // Large Power (>5MW): $14.476/kW + 3.681¢/kWh flat rate
      return { energyRate: 0.03681, demandRate: 14.476 };
    default:
      return { energyRate: 0.06061, demandRate: 17.573 }; // Default to M
  }
}

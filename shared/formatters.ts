type Lang = 'fr' | 'en' | string;

function loc(v: number, lang: Lang, decimals?: number): string {
  const locale = lang === 'fr' ? 'fr-CA' : 'en-CA';
  const opts: Intl.NumberFormatOptions = decimals !== undefined
    ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
    : { maximumFractionDigits: 1 };
  return new Intl.NumberFormat(locale, opts).format(v);
}

export function formatSmartPower(kw: number | null | undefined, lang: Lang = 'fr', unit: 'kWc' | 'kW' = 'kWc'): string {
  if (kw === null || kw === undefined || isNaN(kw)) return `0 ${unit}`;
  const abs = Math.abs(kw);
  const sign = kw < 0 ? '-' : '';
  const mwUnit = unit === 'kWc' ? 'MWc' : 'MW';
  if (abs >= 1000) {
    const mw = abs / 1000;
    const dec = mw >= 10 ? 0 : 1;
    return `${sign}${loc(mw, lang, dec)} ${mwUnit}`;
  }
  return `${sign}${loc(abs, lang, abs >= 100 ? 0 : 1)} ${unit}`;
}

export function formatSmartEnergy(kwh: number | null | undefined, lang: Lang = 'fr', unit: 'kWh' | 'Wh' = 'kWh'): string {
  if (kwh === null || kwh === undefined || isNaN(kwh)) return `0 ${unit}`;
  const abs = Math.abs(kwh);
  const sign = kwh < 0 ? '-' : '';
  if (unit === 'kWh') {
    if (abs >= 1_000_000) {
      const gwh = abs / 1_000_000;
      return `${sign}${loc(gwh, lang, gwh >= 10 ? 0 : 1)} GWh`;
    }
    if (abs >= 1_000) {
      const mwh = abs / 1_000;
      return `${sign}${loc(mwh, lang, mwh >= 100 ? 0 : 1)} MWh`;
    }
    return `${sign}${loc(abs, lang, 0)} kWh`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${loc(abs / 1_000_000, lang, 1)} MWh`;
  }
  if (abs >= 1_000) {
    return `${sign}${loc(abs / 1_000, lang, 1)} kWh`;
  }
  return `${sign}${loc(abs, lang, 0)} Wh`;
}

export function formatSmartCurrency(value: number | null | undefined, lang: Lang = 'fr'): string {
  if (value === null || value === undefined || isNaN(value)) return '0 $';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}$${loc(m, lang, m >= 10 ? 0 : 1)}M`;
  }
  if (abs >= 10_000) {
    return `${sign}$${Math.round(abs / 1000)}k`;
  }
  return `${sign}${Math.round(abs).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA')} $`;
}

export function formatSmartCurrencyFull(value: number | null | undefined, lang: Lang = 'fr'): string {
  if (value === null || value === undefined || isNaN(value)) return '0 $';
  return `${Math.round(value).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA')} $`;
}

export function formatSmartNumber(value: number | null | undefined, lang: Lang = 'fr', decimals?: number): string {
  if (value === null || value === undefined || isNaN(value)) return '0';
  const locale = lang === 'fr' ? 'fr-CA' : 'en-CA';
  const opts: Intl.NumberFormatOptions = decimals !== undefined
    ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
    : {};
  return new Intl.NumberFormat(locale, opts).format(value);
}

export function formatSmartPercent(value: number | null | undefined, alreadyPercent = false): string {
  if (value === null || value === undefined || isNaN(value)) return '0 %';
  const pct = alreadyPercent ? value : value * 100;
  return `${pct.toFixed(1)} %`;
}

export function formatSmartYield(kwhPerKwp: number | null | undefined, lang: Lang = 'fr'): string {
  if (kwhPerKwp === null || kwhPerKwp === undefined || isNaN(kwhPerKwp)) return '0 kWh/kWc';
  return `${loc(kwhPerKwp, lang, 0)} kWh/kWc`;
}

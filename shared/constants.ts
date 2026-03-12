/**
 * Shared business constants for kWh Optimizer 2000
 * Single source of truth — never hardcode these values elsewhere.
 *
 * Updated: March 2026
 * Source: James (solar expert), HQ tariff schedules, EPC industry standards
 */

// ─── HQ Tariff Escalation ────────────────────────────────────────
/** Long-term HQ energy tariff escalation rate (3.5%/yr) */
export const HQ_TARIFF_ESCALATION_RATE = 0.035;

/** Initial HQ tariff escalation for first 3 years (4.8%/yr per HQ 2024 announcement) */
export const HQ_TARIFF_ESCALATION_INITIAL = 0.048;

/** Year when escalation transitions from initial to long-term rate */
export const HQ_TARIFF_ESCALATION_TRANSITION_YEAR = 3;

/** Monte Carlo tariff escalation range [min, max] per James */
export const TARIFF_ESCALATION_RANGE: [number, number] = [0.025, 0.035];

// ─── HQ Incentive (Hydro-Québec Autoproduction) ─────────────────
/** HQ ITC cap per kW of installed capacity ($/kW) */
export const HQ_ITC_CAP_PER_KW = 1000;

/** Max eligible capacity for HQ ITC (kW) — i.e. 1 MW */
export const HQ_ITC_MAX_CAPACITY_KW = 1000;

/** HQ ITC as percentage of admissible CAPEX */
export const HQ_ITC_PERCENT = 0.40;

// ─── System Performance ─────────────────────────────────────────
/** Standard system lifetime for financial analysis (years) */
export const SYSTEM_LIFETIME_YEARS = 25;

/** Annual panel degradation rate (0.4%/yr) */
export const DEGRADATION_RATE_ANNUAL = 0.004;

/** Cumulative degradation factor over 25 years (average ~94% of year-1 output) */
export const DEGRADATION_FACTOR_25Y = 0.94;

/** Temperature coefficient for crystalline silicon panels (%/°C) */
export const TEMPERATURE_COEFFICIENT = -0.004;

// ─── Financial Defaults ─────────────────────────────────────────
/** Default discount rate for NPV calculations */
export const DEFAULT_DISCOUNT_RATE = 0.05;

/** Default O&M cost escalation rate */
export const OM_ESCALATION_RATE = 0.02;

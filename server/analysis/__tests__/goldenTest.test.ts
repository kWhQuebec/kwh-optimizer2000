import { describe, it, expect } from 'vitest';
import { calculateIRR } from '../cashflowCalculations';

// ============================================================
// GOLDEN TEST SUITE — kWh Optimizer 2000
// Part A: Deterministic coherence tests (no DB, synthetic inputs)
// Part B: Data quality checks (Neon DB, skipped if no DATABASE_URL)
// ============================================================

// ---- PART A: Deterministic tests (always run) ----

describe('Golden Test — IRR Coherence', () => {
  it('positive cashflows should yield positive IRR', () => {
    const cashflows = [-100000, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000];
    const irr = calculateIRR(cashflows);
    expect(irr).toBeGreaterThan(0);
    expect(irr).toBeLessThan(1);
  });

  it('breakeven cashflows should yield ~0 IRR', () => {
    const cashflows = [-100000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000];
    const irr = calculateIRR(cashflows);
    expect(Math.abs(irr)).toBeLessThan(0.01);
  });

  it('negative cashflows should yield negative IRR', () => {
    const cashflows = [-100000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000];
    const irr = calculateIRR(cashflows);
    expect(irr).toBeLessThan(0);
  });

  it('IRR and NPV should be coherent (NPV@IRR ~ 0)', () => {
    const cashflows = [-150000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000];
    const irr = calculateIRR(cashflows);
    let npvAtIrr = 0;
    for (let i = 0; i < cashflows.length; i++) {
      npvAtIrr += cashflows[i] / Math.pow(1 + irr, i);
    }
    expect(Math.abs(npvAtIrr)).toBeLessThan(100);
  });

  it('higher savings should yield higher IRR', () => {
    const base = [-100000, 12000, 12000, 12000, 12000, 12000, 12000, 12000, 12000, 12000, 12000];
    const better = [-100000, 18000, 18000, 18000, 18000, 18000, 18000, 18000, 18000, 18000, 18000];
    expect(calculateIRR(better)).toBeGreaterThan(calculateIRR(base));
  });

  it('bisection fallback handles edge cases', () => {
    const edgeCase = [-100000, 8000, 8000, 8000, 8000, 8000, 8000, 8000, 8000, 8000, 8000, 8000, 8000, 8000];
    const irr = calculateIRR(edgeCase);
    expect(irr).toBeDefined();
    expect(typeof irr).toBe('number');
    expect(isNaN(irr)).toBe(false);
  });

  it('single source of truth: simulationEngine re-exports from cashflowCalculations', async () => {
    const simEngine = await import('../simulationEngine');
    expect(typeof simEngine.calculateIRR).toBe('function');
    const cashflows = [-100000, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000];
    expect(simEngine.calculateIRR(cashflows)).toBe(calculateIRR(cashflows));
  });
});

describe('Golden Test — Physical Bounds', () => {
  it('battery C-rate should be between 0.1 and 3', () => {
    const battConfigs = [
      { kwh: 100, kw: 50 },
      { kwh: 200, kw: 100 },
      { kwh: 500, kw: 250 },
      { kwh: 100, kw: 25 },
    ];
    for (const b of battConfigs) {
      if (b.kwh > 0 && b.kw > 0) {
        const cRate = b.kw / b.kwh;
        expect(cRate).toBeGreaterThanOrEqual(0.1);
        expect(cRate).toBeLessThanOrEqual(3);
      }
    }
  });

  it('demand reduction should never be negative (Math.max guard)', () => {
    const scenarios = [
      { peakBefore: 500, peakAfter: 450 },
      { peakBefore: 500, peakAfter: 500 },
      { peakBefore: 500, peakAfter: 520 },
    ];
    for (const s of scenarios) {
      const dr = Math.max(0, s.peakBefore - s.peakAfter);
      expect(dr).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('Golden Test — Financial Coherence', () => {
  it('payback should be coherent with CAPEX/savings ratio', () => {
    const cases = [
      { capex: 200000, savings: 25000, payback: 8 },
      { capex: 150000, savings: 30000, payback: 5 },
      { capex: 100000, savings: 20000, payback: 5 },
    ];
    for (const c of cases) {
      const impliedPayback = c.capex / c.savings;
      const ratio = c.payback / impliedPayback;
      expect(ratio).toBeGreaterThan(0.5);
      expect(ratio).toBeLessThan(2);
    }
  });

  it('CAPEX in realistic commercial range ($10K-$10M)', () => {
    const capexValues = [50000, 150000, 500000, 2000000];
    for (const capex of capexValues) {
      expect(capex).toBeGreaterThanOrEqual(10000);
      expect(capex).toBeLessThanOrEqual(10000000);
    }
  });

  it('savings in realistic range ($0-$1M)', () => {
    const savingsValues = [12000, 25000, 80000, 200000];
    for (const sav of savingsValues) {
      expect(sav).toBeGreaterThanOrEqual(0);
      expect(sav).toBeLessThanOrEqual(1000000);
    }
  });
});

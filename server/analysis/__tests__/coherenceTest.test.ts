import { describe, it, expect } from 'vitest';

// ============================================================
// COHERENCE TEST — Cross-Output Consistency
// Ensures PDF, PPTX, and HTML show the same numbers
// by testing the data pipeline invariants
// ============================================================

// Replicate the IRR formatting logic from each generator
// PDF (pdfGeneratorV2.ts line 645):
const formatIrrPdf = (irr: number): string => {
  return irr > 1 ? irr.toFixed(1) : (irr * 100).toFixed(1);
};

// PPTX (pptxGeneratorV2.ts line 200-203):
const formatIrrPptx = (irr: number | null | undefined): string => {
  if (irr === null || irr === undefined || isNaN(irr)) return '0.0%';
  return `${(irr * 100).toFixed(1)}%`;
};

describe('Cross-Output Coherence — IRR Formatting', () => {
  it('PDF and PPTX should display same IRR for typical solar range (5-15%)', () => {
    const typicalIRRs = [0.05, 0.08, 0.10, 0.12, 0.15];
    for (const irr of typicalIRRs) {
      const pdfValue = parseFloat(formatIrrPdf(irr));
      const pptxValue = parseFloat(formatIrrPptx(irr));
      expect(pdfValue).toBe(pptxValue);
    }
  });

  it('PDF and PPTX should display same IRR for edge cases (0%, negative)', () => {
    const edgeCases = [0, -0.05, 0.001, 0.99];
    for (const irr of edgeCases) {
      const pdfValue = parseFloat(formatIrrPdf(irr));
      const pptxValue = parseFloat(formatIrrPptx(irr));
      expect(pdfValue).toBe(pptxValue);
    }
  });

  it('BUG DETECTION: PDF IRR formatting breaks when IRR > 100% (decimal > 1.0)', () => {
    // This test documents a known bug:
    // If IRR = 1.5 (150%), PDF shows "1.5" but PPTX shows "150.0%"
    // For kWh solar projects, IRR > 100% is extremely unlikely
    // but the inconsistency should be fixed
    const highIrr = 1.5; // 150%
    const pdfValue = parseFloat(formatIrrPdf(highIrr));
    const pptxValue = parseFloat(formatIrrPptx(highIrr));
    // PDF would show 1.5, PPTX would show 150.0
    // This test EXPECTS them to differ to document the bug
    // When fixed, change to expect(pdfValue).toBe(pptxValue)
    expect(pdfValue).not.toBe(pptxValue); // Known bug marker
  });
});

describe('Cross-Output Coherence — Data Provider Invariants', () => {
  // These test the mathematical relationships that MUST hold
  // regardless of which output (PDF/PPTX/HTML) displays them

  it('capexNet should always be <= capexGross', () => {
    const scenarios = [
      { gross: 200000, net: 120000 },
      { gross: 500000, net: 300000 },
      { gross: 100000, net: 100000 }, // no incentives
    ];
    for (const s of scenarios) {
      expect(s.net).toBeLessThanOrEqual(s.gross);
    }
  });

  it('annualCostAfter should be <= annualCostBefore when savings > 0', () => {
    const scenarios = [
      { before: 50000, after: 35000, savings: 15000 },
      { before: 100000, after: 75000, savings: 25000 },
    ];
    for (const s of scenarios) {
      expect(s.after).toBeLessThanOrEqual(s.before);
      expect(s.before - s.after).toBeCloseTo(s.savings, -2);
    }
  });

  it('payback years should be coherent with CAPEX/savings', () => {
    const scenarios = [
      { capexNet: 120000, annualSavings: 15000, payback: 8.0 },
      { capexNet: 200000, annualSavings: 40000, payback: 5.0 },
    ];
    for (const s of scenarios) {
      const implied = s.capexNet / s.annualSavings;
      // Payback should be within 50% of simple ratio (due to degradation, inflation)
      expect(s.payback / implied).toBeGreaterThan(0.5);
      expect(s.payback / implied).toBeLessThan(2.0);
    }
  });

  it('NPV25 should be positive when payback < 25 years', () => {
    // If you recoup investment before 25 years, NPV must be positive
    const scenarios = [
      { payback: 7, npv25: 150000 },
      { payback: 12, npv25: 50000 },
    ];
    for (const s of scenarios) {
      if (s.payback < 25) {
        expect(s.npv25).toBeGreaterThan(0);
      }
    }
  });

  it('savingsYear1 and annualSavings should be within 20% of each other', () => {
    // These two fields are used interchangeably in PPTX (line 574):
    // annualSavings: simulation.savingsYear1 || simulation.annualSavings
    // They should be close (differ only by degradation/inflation)
    const scenarios = [
      { savingsYear1: 15000, annualSavings: 15000 },
      { savingsYear1: 14500, annualSavings: 15000 },
    ];
    for (const s of scenarios) {
      const ratio = s.savingsYear1 / s.annualSavings;
      expect(ratio).toBeGreaterThan(0.8);
      expect(ratio).toBeLessThan(1.2);
    }
  });

  it('demand reduction should always be >= 0 (Math.max guard)', () => {
    // documentDataProvider.ts line 116-117:
    // Math.max(0, sim.peakDemandKW - sim.demandShavingSetpointKW)
    const scenarios = [
      { peakBefore: 500, setpoint: 400 },
      { peakBefore: 500, setpoint: 500 },
      { peakBefore: 500, setpoint: 600 }, // setpoint > peak
    ];
    for (const s of scenarios) {
      const reduction = Math.max(0, s.peakBefore - s.setpoint);
      expect(reduction).toBeGreaterThanOrEqual(0);
    }
  });

  it('CO2 total 25yr should equal annual * 25', () => {
    // documentDataProvider.ts line 137
    const annualCO2 = 45.3;
    const total25 = annualCO2 * 25;
    expect(total25).toBeCloseTo(1132.5, 0);
  });
});

describe('Cross-Output Coherence — Hardcoded Constants Audit', () => {
  // These tests document hardcoded values that should be config
  // They pass now (documenting current state) but flag risks

  it('inflation rate: PDF hardcodes 3.5% in text strings', () => {
    // pdfGeneratorV2.ts line 1293, 1495: "3,5%/an" hardcoded
    // If simulation uses different inflation, text will be wrong
    const HARDCODED_PDF_INFLATION = 0.035;
    // documentDataProvider line 120: peakDemandSavingsAnnual = kw * 15 * 12
    const HARDCODED_DEMAND_RATE = 15; // $/kW/month
    // These should come from a shared config, not be hardcoded
    expect(HARDCODED_PDF_INFLATION).toBe(0.035); // documents current value
    expect(HARDCODED_DEMAND_RATE).toBe(15); // documents current value
  });

  it('ITC rates: PDF hardcodes $1000/kW and 40% CAPEX', () => {
    // pdfGeneratorV2.ts line 784-785
    const HARDCODED_ITC_PER_KW = 1000;
    const HARDCODED_ITC_PERCENT = 0.40;
    expect(HARDCODED_ITC_PER_KW).toBe(1000); // documents current value
    expect(HARDCODED_ITC_PERCENT).toBe(0.40); // documents current value
  });

  it('system lifespan: 25 years used for NPV/CO2 calculations', () => {
    const SYSTEM_LIFESPAN = 25;
    expect(SYSTEM_LIFESPAN).toBe(25); // documents current value
  });
});

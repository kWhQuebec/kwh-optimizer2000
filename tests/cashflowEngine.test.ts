/**
 * Tests unitaires — cashflowEngine.ts
 * Moteur financier 25 ans: Cash, Lease, PPA
 *
 * Ces tests protègent les calculs financiers critiques.
 * JAMAIS de modification auto par le QA Agent Loop.
 */
import { describe, it, expect } from 'vitest';
import { buildCashflowModel, DEFAULT_CASHFLOW_INPUTS, type CashflowInputs } from '../shared/finance/cashflowEngine';

// === FIXTURE: Projet type 200kW commercial québécois ===
const BASE_INPUTS: CashflowInputs = {
  systemSizeKW: 200,
  annualProductionKWh: 200 * 1150, // 1150 kWh/kWp baseline
  kwhCostPerWatt: 2.80,
  hqIncentivePerKw: 1000,
  itcRate: 0.30,
  gridRateY1: 0.08, // $0.08/kWh HQ rate M
  kwhInflation: 0.035,
  trcInflation: 0.03,
  degradation: 0.004,
  omRate: 0.01,
  omEscalation: 0.025,
  ccaRate: 0.50,
  taxRate: 0.265,
  leaseTerm: 7,
  leasePremium: 0.15,
  ppaTerm: 16,
  ppaDiscount: 0.40,
  ppaOmRate: 0.07,
};

describe('cashflowEngine — buildCashflowModel', () => {

  // ========================================
  // CAPEX & Incentives
  // ========================================

  describe('Gross CAPEX calculation', () => {
    it('calcule le CAPEX brut correctement (systemSizeKW * 1000 * costPerWatt)', () => {
      const model = buildCashflowModel(BASE_INPUTS);
      // 200 kW * 1000 W/kW * $2.80/W = $560,000
      expect(model.grossCapex).toBe(560000);
    });
  });

  describe('HQ Incentive', () => {
    it('applique $1000/kW pour un système de 200kW', () => {
      const model = buildCashflowModel(BASE_INPUTS);
      // 200 kW * $1000 = $200,000 — mais cap à 40% CAPEX
      // 40% de $560,000 = $224,000 → $200,000 < $224,000 → pas capé
      expect(model.hqIncentive).toBe(200000);
    });

    it('cap HQ incentive à 40% du CAPEX pour petits systèmes chers', () => {
      const inputs: CashflowInputs = {
        ...BASE_INPUTS,
        systemSizeKW: 50,
        annualProductionKWh: 50 * 1150,
        kwhCostPerWatt: 2.00, // $2.00/W → CAPEX = $100,000
      };
      const model = buildCashflowModel(inputs);
      // 50 kW * $1000 = $50,000
      // 40% de $100,000 = $40,000 → capé à $40,000
      expect(model.hqIncentive).toBe(40000);
    });

    it('cap HQ incentive à 1MW (1000 kW) pour gros systèmes', () => {
      const inputs: CashflowInputs = {
        ...BASE_INPUTS,
        systemSizeKW: 1500,
        annualProductionKWh: 1500 * 1150,
      };
      const model = buildCashflowModel(inputs);
      // Eligible: min(1500, 1000) = 1000 kW → $1,000,000
      // CAPEX: 1500 * 1000 * 2.80 = $4,200,000
      // 40% cap: $1,680,000 → $1,000,000 < $1,680,000 → pas capé
      expect(model.hqIncentive).toBe(1000000);
    });
  });

  describe('ITC (30% federal)', () => {
    it('applique 30% ITC sur le net après HQ', () => {
      const model = buildCashflowModel(BASE_INPUTS);
      // Net après HQ: $560,000 - $200,000 = $360,000
      // ITC: $360,000 * 0.30 = $108,000
      expect(model.netAfterHQ).toBe(360000);
      expect(model.itc).toBe(108000);
    });
  });

  describe('Net client investment', () => {
    it('calcule l\'investissement net correct', () => {
      const model = buildCashflowModel(BASE_INPUTS);
      // $360,000 - $108,000 = $252,000
      expect(model.netClientInvestment).toBe(252000);
    });
  });

  // ========================================
  // 25-year cashflow structure
  // ========================================

  describe('Cashflow structure', () => {
    it('génère exactement 25 années de cashflow pour chaque scénario', () => {
      const model = buildCashflowModel(BASE_INPUTS);
      expect(model.cash.yearlyCashflows).toHaveLength(25);
      expect(model.lease.yearlyCashflows).toHaveLength(25);
      expect(model.ppa.yearlyCashflows).toHaveLength(25);
    });

    it('année 1 production = annualProductionKWh (pas de dégradation)', () => {
      const model = buildCashflowModel(BASE_INPUTS);
      // Year 1: degradation^0 = 1.0 → full production
      expect(model.cash.yearlyCashflows[0].production).toBe(230000);
    });

    it('la production diminue chaque année (dégradation)', () => {
      const model = buildCashflowModel(BASE_INPUTS);
      const y1 = model.cash.yearlyCashflows[0].production;
      const y25 = model.cash.yearlyCashflows[24].production;
      expect(y25).toBeLessThan(y1);
      // 24 years of 0.4% degradation: y1 * (1-0.004)^24 ≈ 0.908 * y1
      expect(y25).toBeGreaterThan(y1 * 0.85);
    });

    it('le grid rate augmente chaque année (inflation)', () => {
      const model = buildCashflowModel(BASE_INPUTS);
      const y1Rate = model.cash.yearlyCashflows[0].gridRate;
      const y25Rate = model.cash.yearlyCashflows[24].gridRate;
      expect(y25Rate).toBeGreaterThan(y1Rate);
    });
  });

  // ========================================
  // Cash scenario
  // ========================================

  describe('Cash scenario', () => {
    it('cash investment = net client investment', () => {
      const model = buildCashflowModel(BASE_INPUTS);
      expect(model.cash.investment).toBe(model.netClientInvestment);
    });

    it('cash payback est entre 4 et 15 ans pour un projet type 200kW', () => {
      const model = buildCashflowModel(BASE_INPUTS);
      expect(model.cash.paybackYear).not.toBeNull();
      expect(model.cash.paybackYear!).toBeGreaterThanOrEqual(4);
      expect(model.cash.paybackYear!).toBeLessThanOrEqual(15);
    });

    it('total savings sur 25 ans est positif', () => {
      const model = buildCashflowModel(BASE_INPUTS);
      expect(model.cash.totalSavings).toBeGreaterThan(0);
    });

    it('CCA benefit existe en année 1 (demi-année)', () => {
      const model = buildCashflowModel(BASE_INPUTS);
      const y1 = model.cash.yearlyCashflows[0];
      expect(y1.ccaBenefit).toBeDefined();
      expect(y1.ccaBenefit!).toBeGreaterThan(0);
    });

    it('ownership commence année 1 pour cash', () => {
      const model = buildCashflowModel(BASE_INPUTS);
      expect(model.cash.ownershipYear).toBe(1);
    });
  });

  // ========================================
  // Lease scenario
  // ========================================

  describe('Lease scenario', () => {
    it('lease investment = 0 (pas de cash upfront)', () => {
      const model = buildCashflowModel(BASE_INPUTS);
      expect(model.lease.investment).toBe(0);
    });

    it('lease payments existent seulement pendant le terme (7 ans)', () => {
      const model = buildCashflowModel(BASE_INPUTS);
      const y7 = model.lease.yearlyCashflows[6]; // year 7
      const y8 = model.lease.yearlyCashflows[7]; // year 8
      expect(y7.leasePayment).toBeGreaterThan(0);
      expect(y8.leasePayment).toBe(0);
    });

    it('ownership commence après le terme + 1', () => {
      const model = buildCashflowModel(BASE_INPUTS);
      expect(model.lease.ownershipYear).toBe(8); // 7 + 1
    });
  });

  // ========================================
  // PPA scenario
  // ========================================

  describe('PPA scenario', () => {
    it('PPA investment = 0', () => {
      const model = buildCashflowModel(BASE_INPUTS);
      expect(model.ppa.investment).toBe(0);
    });

    it('PPA payments existent pendant le terme (16 ans)', () => {
      const model = buildCashflowModel(BASE_INPUTS);
      const y16 = model.ppa.yearlyCashflows[15]; // year 16
      const y17 = model.ppa.yearlyCashflows[16]; // year 17
      expect(y16.ppaPayment).toBeGreaterThan(0);
      expect(y17.ppaPayment).toBeGreaterThan(0); // O&M post-PPA
    });

    it('ownership commence après le terme PPA + 1', () => {
      const model = buildCashflowModel(BASE_INPUTS);
      expect(model.ppa.ownershipYear).toBe(17); // 16 + 1
    });

    it('PPA total savings sur 25 ans est positif', () => {
      const model = buildCashflowModel(BASE_INPUTS);
      expect(model.ppa.totalSavings).toBeGreaterThan(0);
    });
  });

  // ========================================
  // Provider economics
  // ========================================

  describe('Provider economics', () => {
    it('actual investment du provider est inférieur au gross cost', () => {
      const model = buildCashflowModel(BASE_INPUTS);
      expect(model.providerEconomics.actualInvestment).toBeLessThan(model.providerEconomics.grossCost);
    });

    it('total incentives = HQ + ITC + CCA shield', () => {
      const model = buildCashflowModel(BASE_INPUTS);
      const pe = model.providerEconomics;
      expect(pe.totalIncentives).toBe(
        pe.hqIncentive + pe.itc + pe.ccaShield
      );
    });
  });

  // ========================================
  // Edge cases
  // ========================================

  describe('Edge cases', () => {
    it('système de 0 kW retourne CAPEX 0', () => {
      const inputs: CashflowInputs = { ...BASE_INPUTS, systemSizeKW: 0, annualProductionKWh: 0 };
      const model = buildCashflowModel(inputs);
      expect(model.grossCapex).toBe(0);
    });

    it('les 3 scénarios (cash, lease, PPA) ont des savings positifs sur 25 ans', () => {
      const model = buildCashflowModel(BASE_INPUTS);
      // Les 3 scénarios doivent être rentables sur 25 ans
      expect(model.cash.totalSavings).toBeGreaterThan(0);
      expect(model.lease.totalSavings).toBeGreaterThan(0);
      expect(model.ppa.totalSavings).toBeGreaterThan(0);
    });
  });

  // ========================================
  // Defaults
  // ========================================

  describe('DEFAULT_CASHFLOW_INPUTS', () => {
    it('contient les bonnes valeurs par défaut québécoises', () => {
      expect(DEFAULT_CASHFLOW_INPUTS.hqIncentivePerKw).toBe(1000);
      expect(DEFAULT_CASHFLOW_INPUTS.itcRate).toBe(0.30);
      expect(DEFAULT_CASHFLOW_INPUTS.taxRate).toBe(0.265);
      expect(DEFAULT_CASHFLOW_INPUTS.leaseTerm).toBe(7);
      expect(DEFAULT_CASHFLOW_INPUTS.ppaTerm).toBe(16);
    });
  });
});

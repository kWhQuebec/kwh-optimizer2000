/**
 * Tests unitaires — qualification/engine.ts
 * Système de qualification 4 gates (100 points)
 *
 * Ces tests protègent le scoring de qualification critique.
 * JAMAIS de modification auto par le QA Agent Loop.
 */
import { describe, it, expect } from 'vitest';
import {
  calculateEconomicStatus,
  calculateQualification,
  quickQualificationScore,
  computeLeadColor,
} from '../shared/qualification/engine';
import type { QualificationData, QualificationResult } from '../shared/qualification/types';

// === FIXTURES ===

/** Prospect parfait: propriétaire, grosse facture, toit neuf, décideur, budget prêt */
const PERFECT_LEAD: QualificationData = {
  estimatedMonthlyBill: 15000,
  economicStatus: 'high',
  propertyRelationship: 'owner',
  roofCondition: 'excellent',
  roofAge: 'new',
  decisionAuthority: 'decision_maker',
  budgetReadiness: 'budget_allocated',
  timelineUrgency: 'immediate',
};

/** Prospect moyen: locataire autorisé, facture moyenne, toit correct */
const AVERAGE_LEAD: QualificationData = {
  estimatedMonthlyBill: 6000,
  economicStatus: 'medium',
  propertyRelationship: 'tenant_authorized',
  roofCondition: 'good',
  roofAge: 'recent',
  decisionAuthority: 'influencer',
  budgetReadiness: 'budget_possible',
  timelineUrgency: 'this_year',
};

/** Prospect faible: locataire sans auth, petite facture, toit vieux */
const WEAK_LEAD: QualificationData = {
  estimatedMonthlyBill: 2000,
  economicStatus: 'low',
  propertyRelationship: 'tenant_no_auth',
  roofCondition: 'needs_repair',
  roofAge: 'old',
  decisionAuthority: 'researcher',
  budgetReadiness: 'no_budget',
  timelineUrgency: 'exploring',
};

/** Prospect disqualifié: facture trop basse */
const DISQUALIFIED_LEAD: QualificationData = {
  estimatedMonthlyBill: 800,
  economicStatus: 'insufficient',
  propertyRelationship: 'owner',
  roofCondition: 'good',
  roofAge: 'recent',
  decisionAuthority: 'decision_maker',
  budgetReadiness: 'budget_allocated',
  timelineUrgency: 'immediate',
};

describe('qualificationEngine', () => {

  // ========================================
  // calculateEconomicStatus
  // ========================================

  describe('calculateEconomicStatus', () => {
    it('$10k+ = high', () => {
      expect(calculateEconomicStatus(10000)).toBe('high');
      expect(calculateEconomicStatus(25000)).toBe('high');
    });

    it('$5k-$10k = medium', () => {
      expect(calculateEconomicStatus(5000)).toBe('medium');
      expect(calculateEconomicStatus(7500)).toBe('medium');
      expect(calculateEconomicStatus(9999)).toBe('medium');
    });

    it('$2.5k-$5k = low', () => {
      expect(calculateEconomicStatus(2500)).toBe('low');
      expect(calculateEconomicStatus(4999)).toBe('low');
    });

    it('< $1.5k ou null = insufficient', () => {
      expect(calculateEconomicStatus(1499)).toBe('insufficient');
      expect(calculateEconomicStatus(0)).toBe('insufficient');
      expect(calculateEconomicStatus(null)).toBe('insufficient');
    });

    it('$1.5k-$2.5k = insufficient (sous le seuil LOW)', () => {
      expect(calculateEconomicStatus(1500)).toBe('insufficient');
      expect(calculateEconomicStatus(2499)).toBe('insufficient');
    });
  });

  // ========================================
  // calculateQualification — scoring
  // ========================================

  describe('calculateQualification — scoring', () => {
    it('prospect parfait obtient le score maximum (100/100)', () => {
      const result = calculateQualification(PERFECT_LEAD);
      expect(result.score).toBe(100);
      expect(result.gateScores.economic).toBe(25);
      expect(result.gateScores.property).toBe(25);
      expect(result.gateScores.roof).toBe(25); // 15 condition + 10 age
      expect(result.gateScores.decision).toBe(25); // 10 authority + 8 budget + 7 timeline
    });

    it('gate scores s\'additionnent correctement au total', () => {
      const result = calculateQualification(AVERAGE_LEAD);
      const sum = result.gateScores.economic + result.gateScores.property +
                  result.gateScores.roof + result.gateScores.decision;
      expect(result.score).toBe(sum);
    });

    it('chaque gate est sur 25 points max', () => {
      const result = calculateQualification(PERFECT_LEAD);
      expect(result.gateScores.economic).toBeLessThanOrEqual(25);
      expect(result.gateScores.property).toBeLessThanOrEqual(25);
      expect(result.gateScores.roof).toBeLessThanOrEqual(25);
      expect(result.gateScores.decision).toBeLessThanOrEqual(25);
    });

    it('prospect moyen a un score entre 40 et 85', () => {
      const result = calculateQualification(AVERAGE_LEAD);
      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.score).toBeLessThanOrEqual(85);
    });

    it('prospect faible a un score bas', () => {
      const result = calculateQualification(WEAK_LEAD);
      expect(result.score).toBeLessThan(50);
    });
  });

  // ========================================
  // Status classification
  // ========================================

  describe('calculateQualification — status', () => {
    it('prospect parfait = hot', () => {
      const result = calculateQualification(PERFECT_LEAD);
      expect(result.status).toBe('hot');
    });

    it('facture insuffisante = disqualified', () => {
      const result = calculateQualification(DISQUALIFIED_LEAD);
      expect(result.status).toBe('disqualified');
    });

    it('locataire sans auth avec critical blocker = cold', () => {
      const result = calculateQualification(WEAK_LEAD);
      // tenant_no_auth + no_budget = critical blockers → cold
      expect(result.status).toBe('cold');
    });

    it('prospect moyen (pas de critical blocker) = warm ou nurture', () => {
      const result = calculateQualification(AVERAGE_LEAD);
      expect(['warm', 'nurture', 'hot']).toContain(result.status);
    });
  });

  // ========================================
  // Blockers
  // ========================================

  describe('calculateQualification — blockers', () => {
    it('prospect parfait n\'a aucun blocage', () => {
      const result = calculateQualification(PERFECT_LEAD);
      expect(result.blockers).toHaveLength(0);
    });

    it('facture insuffisante crée un blocage critical', () => {
      const result = calculateQualification(DISQUALIFIED_LEAD);
      const critical = result.blockers.filter(b => b.severity === 'critical');
      expect(critical.length).toBeGreaterThanOrEqual(1);
      expect(critical.some(b => b.type === 'insufficient_bill')).toBe(true);
    });

    it('locataire sans auth = blocage critical property_authorization', () => {
      const data: QualificationData = { ...PERFECT_LEAD, propertyRelationship: 'tenant_no_auth' };
      const result = calculateQualification(data);
      expect(result.blockers.some(b => b.type === 'property_authorization' && b.severity === 'critical')).toBe(true);
    });

    it('locataire pending = blocage major property_authorization', () => {
      const data: QualificationData = { ...PERFECT_LEAD, propertyRelationship: 'tenant_pending' };
      const result = calculateQualification(data);
      expect(result.blockers.some(b => b.type === 'property_authorization' && b.severity === 'major')).toBe(true);
    });

    it('toit needs_replacement = blocage critical', () => {
      const data: QualificationData = { ...PERFECT_LEAD, roofCondition: 'needs_replacement' };
      const result = calculateQualification(data);
      expect(result.blockers.some(b => b.type === 'roof_replacement_needed' && b.severity === 'critical')).toBe(true);
    });

    it('toit needs_repair = blocage major', () => {
      const data: QualificationData = { ...PERFECT_LEAD, roofCondition: 'needs_repair' };
      const result = calculateQualification(data);
      expect(result.blockers.some(b => b.type === 'roof_repair_needed' && b.severity === 'major')).toBe(true);
    });

    it('no_budget = blocage critical', () => {
      const data: QualificationData = { ...PERFECT_LEAD, budgetReadiness: 'no_budget' };
      const result = calculateQualification(data);
      expect(result.blockers.some(b => b.type === 'no_budget' && b.severity === 'critical')).toBe(true);
    });

    it('budget_needed = blocage major', () => {
      const data: QualificationData = { ...PERFECT_LEAD, budgetReadiness: 'budget_needed' };
      const result = calculateQualification(data);
      expect(result.blockers.some(b => b.type === 'no_budget' && b.severity === 'major')).toBe(true);
    });

    it('researcher = blocage major no_decision_authority', () => {
      const data: QualificationData = { ...PERFECT_LEAD, decisionAuthority: 'researcher' };
      const result = calculateQualification(data);
      expect(result.blockers.some(b => b.type === 'no_decision_authority' && b.severity === 'major')).toBe(true);
    });

    it('exploring = blocage minor long_timeline', () => {
      const data: QualificationData = { ...PERFECT_LEAD, timelineUrgency: 'exploring' };
      const result = calculateQualification(data);
      expect(result.blockers.some(b => b.type === 'long_timeline' && b.severity === 'minor')).toBe(true);
    });

    it('chaque blocage a des solutions suggérées', () => {
      const result = calculateQualification(WEAK_LEAD);
      for (const blocker of result.blockers) {
        expect(blocker.suggestedSolutions.length).toBeGreaterThan(0);
      }
    });
  });

  // ========================================
  // Next steps
  // ========================================

  describe('calculateQualification — next steps', () => {
    it('prospect hot a des étapes de proposition', () => {
      const result = calculateQualification(PERFECT_LEAD);
      expect(result.suggestedNextSteps.length).toBeGreaterThan(0);
    });

    it('prospect disqualifié est classé non-viable', () => {
      const result = calculateQualification(DISQUALIFIED_LEAD);
      expect(result.suggestedNextSteps.some(s => s.includes('non-viable'))).toBe(true);
    });

    it('résultat contient qualifiedAt', () => {
      const result = calculateQualification(PERFECT_LEAD);
      expect(result.qualifiedAt).toBeDefined();
      expect(result.qualifiedAt).toBeInstanceOf(Date);
    });
  });

  // ========================================
  // quickQualificationScore
  // ========================================

  describe('quickQualificationScore', () => {
    it('$10k/mois = high + viable', () => {
      const result = quickQualificationScore(10000);
      expect(result.status).toBe('high');
      expect(result.viable).toBe(true);
    });

    it('$5k/mois = medium + viable', () => {
      const result = quickQualificationScore(5000);
      expect(result.status).toBe('medium');
      expect(result.viable).toBe(true);
    });

    it('$1k/mois = insufficient + non-viable', () => {
      const result = quickQualificationScore(1000);
      expect(result.status).toBe('insufficient');
      expect(result.viable).toBe(false);
    });

    it('null = insufficient + non-viable', () => {
      const result = quickQualificationScore(null);
      expect(result.status).toBe('insufficient');
      expect(result.viable).toBe(false);
      expect(result.estimatedPotentialKw).toBeNull();
    });

    it('estime le potentiel kW correctement ($1000/mois ≈ 100 kW)', () => {
      const result = quickQualificationScore(10000);
      expect(result.estimatedPotentialKw).toBe(1000); // 10000/10
    });

    it('$3000/mois ≈ 300 kW potentiel', () => {
      const result = quickQualificationScore(3000);
      expect(result.estimatedPotentialKw).toBe(300);
    });
  });

  // ========================================
  // computeLeadColor
  // ========================================

  describe('computeLeadColor', () => {
    it('prospect parfait sans contexte = green', () => {
      const result = calculateQualification(PERFECT_LEAD);
      const color = computeLeadColor(result);
      expect(color.color).toBe('green');
    });

    it('prospect disqualifié = red (score < 30 ou critical blocker)', () => {
      const result = calculateQualification(DISQUALIFIED_LEAD);
      const color = computeLeadColor(result);
      expect(color.color).toBe('red');
    });

    // === RED flags (context-based) ===

    it('tenant_no_auth dans le contexte = red', () => {
      const result = calculateQualification(PERFECT_LEAD);
      const color = computeLeadColor(result, { propertyRelationship: 'tenant_no_auth' });
      expect(color.color).toBe('red');
      expect(color.reason).toContain('autorisation');
    });

    it('landlord paie la facture + locataire = red', () => {
      const result = calculateQualification(PERFECT_LEAD);
      const color = computeLeadColor(result, {
        billPayer: 'landlord',
        propertyRelationship: 'tenant_authorized',
      });
      expect(color.color).toBe('red');
    });

    it('landlord paie la facture + propriétaire = PAS red', () => {
      const result = calculateQualification(PERFECT_LEAD);
      const color = computeLeadColor(result, {
        billPayer: 'landlord',
        propertyRelationship: 'owner',
      });
      expect(color.color).not.toBe('red');
    });

    it('toit > 25 ans + needs_replacement + pas de plan = red', () => {
      // Ajuster le scoring pour que le score ne soit pas le problème
      const data: QualificationData = { ...PERFECT_LEAD, roofCondition: 'needs_replacement', roofAge: 'old' };
      const result = calculateQualification(data);
      const color = computeLeadColor(result, {
        roofAgeYears: 30,
        roofCondition: 'needs_replacement',
      });
      expect(color.color).toBe('red');
    });

    it('vie utile restante < 5 ans sans plan = red', () => {
      const result = calculateQualification(PERFECT_LEAD);
      const color = computeLeadColor(result, {
        roofRemainingLifeYears: 3,
      });
      expect(color.color).toBe('red');
    });

    it('vie utile restante < 5 ans AVEC plan de réfection = PAS red', () => {
      const result = calculateQualification(PERFECT_LEAD);
      const color = computeLeadColor(result, {
        roofRemainingLifeYears: 3,
        plannedRoofWork: 'Réfection complète prévue printemps 2026',
      });
      expect(color.color).not.toBe('red');
    });

    // === YELLOW flags ===

    it('tenant_pending = yellow', () => {
      const result = calculateQualification(PERFECT_LEAD);
      const color = computeLeadColor(result, { propertyRelationship: 'tenant_pending' });
      expect(color.color).toBe('yellow');
    });

    it('toit 10-20 ans = yellow flag', () => {
      const result = calculateQualification(PERFECT_LEAD);
      const color = computeLeadColor(result, { roofAgeYears: 15 });
      expect(color.color).toBe('yellow');
    });

    it('toit steep = yellow flag', () => {
      const result = calculateQualification(PERFECT_LEAD);
      const color = computeLeadColor(result, { roofSlope: 'steep' });
      expect(color.color).toBe('yellow');
    });

    it('facture partagée (shared) = yellow', () => {
      const result = calculateQualification(PERFECT_LEAD);
      const color = computeLeadColor(result, { billPayer: 'shared' });
      expect(color.color).toBe('yellow');
    });

    // === GREEN ===

    it('score ≥ 70, aucun blocage, aucun yellow flag contexte = green', () => {
      const result = calculateQualification(PERFECT_LEAD);
      const color = computeLeadColor(result, {
        propertyRelationship: 'owner',
        billPayer: 'tenant',
        roofCondition: 'excellent',
        roofAgeYears: 3,
        roofSlope: 'flat',
      });
      expect(color.color).toBe('green');
    });
  });

  // ========================================
  // Edge cases
  // ========================================

  describe('Edge cases', () => {
    it('tous les champs "unknown" donne un score intermédiaire', () => {
      const unknownLead: QualificationData = {
        estimatedMonthlyBill: 8000,
        economicStatus: 'medium',
        propertyRelationship: 'unknown',
        roofCondition: 'unknown',
        roofAge: 'unknown',
        decisionAuthority: 'unknown',
        budgetReadiness: 'unknown',
        timelineUrgency: 'unknown',
      };
      const result = calculateQualification(unknownLead);
      // economic(20) + property(10) + roof(8+4=12) + decision(4+3+2=9) = 51
      expect(result.score).toBe(51);
      expect(result.status).toBe('nurture');
    });

    it('score minimum théorique: all worst values', () => {
      const worstLead: QualificationData = {
        estimatedMonthlyBill: 0,
        economicStatus: 'insufficient',
        propertyRelationship: 'tenant_no_auth',
        roofCondition: 'needs_replacement',
        roofAge: 'old',
        decisionAuthority: 'researcher',
        budgetReadiness: 'no_budget',
        timelineUrgency: 'exploring',
      };
      const result = calculateQualification(worstLead);
      // economic(0) + property(5) + roof(0+2=2) + decision(3+1+1=5) = 12
      expect(result.score).toBe(12);
    });

    it('score maximum théorique = 100', () => {
      const result = calculateQualification(PERFECT_LEAD);
      expect(result.score).toBe(100);
    });

    it('computeLeadColor sans contexte retourne quand même une couleur valide', () => {
      const result = calculateQualification(AVERAGE_LEAD);
      const color = computeLeadColor(result);
      expect(['green', 'yellow', 'red']).toContain(color.color);
      expect(color.reason).toBeTruthy();
    });

    it('computeLeadColor avec contexte vide = même résultat que sans contexte', () => {
      const result = calculateQualification(AVERAGE_LEAD);
      const c1 = computeLeadColor(result);
      const c2 = computeLeadColor(result, {});
      expect(c1.color).toBe(c2.color);
    });
  });
});

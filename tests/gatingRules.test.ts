import { describe, it, expect } from 'vitest';
import { validateStageTransition, OLEG_STAGE_MAP, VALID_TRANSITIONS } from '../shared/pipeline';

describe('Pipeline Gating Rules', () => {
  describe('Stage transition validation', () => {
    it('should allow prospect to contacted with email', () => {
      const result = validateStageTransition({
        currentStage: 'prospect',
        targetStage: 'contacted',
        lead: { email: 'test@example.com' },
      });
      expect(result.allowed).toBe(true);
      expect(result.blockers).toHaveLength(0);
    });

    it('should block prospect to contacted without email', () => {
      const result = validateStageTransition({
        currentStage: 'prospect',
        targetStage: 'contacted',
        lead: {},
      });
      expect(result.allowed).toBe(false);
      expect(result.blockers.length).toBeGreaterThan(0);
    });

    it('should block contacted to qualified without phone', () => {
      const result = validateStageTransition({
        currentStage: 'contacted',
        targetStage: 'qualified',
        lead: {
          email: 'test@example.com',
          propertyRelationship: 'owner',
          roofAge: 'recent',
        },
      });
      expect(result.allowed).toBe(false);
      expect(result.blockers.some(b => b.includes('Numéro de téléphone'))).toBe(true);
    });

    it('should block qualified to analysis_done without simulation', () => {
      const result = validateStageTransition({
        currentStage: 'qualified',
        targetStage: 'analysis_done',
        lead: { qualificationStatus: 'green' },
        hasSimulation: false,
      });
      expect(result.allowed).toBe(false);
      expect(result.blockers.some(b => b.includes('simulation'))).toBe(true);
    });

    it('should warn about yellow qualification', () => {
      const result = validateStageTransition({
        currentStage: 'qualified',
        targetStage: 'analysis_done',
        lead: { qualificationStatus: 'yellow' },
        hasSimulation: true,
      });
      expect(result.allowed).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should block analysis_done to design_mandate_signed without accepted agreement', () => {
      const result = validateStageTransition({
        currentStage: 'analysis_done',
        targetStage: 'design_mandate_signed',
        hasDesignAgreement: true,
        designAgreementStatus: 'draft',
      });
      expect(result.allowed).toBe(false);
    });

    it('should allow backwards transition to reopen', () => {
      const result = validateStageTransition({
        currentStage: 'lost',
        targetStage: 'prospect',
      });
      expect(result.allowed).toBe(true);
      expect(result.blockers).toHaveLength(0);
    });

    it('should block invalid stage transition', () => {
      const result = validateStageTransition({
        currentStage: 'prospect',
        targetStage: 'analysis_done',
      });
      expect(result.allowed).toBe(false);
    });
  });

  describe('Constants', () => {
    it('should have Oleg stage mapping', () => {
      expect(OLEG_STAGE_MAP.stage1).toContain('prospect');
      expect(OLEG_STAGE_MAP.stage2).toContain('qualified');
      expect(OLEG_STAGE_MAP.stage3).toContain('analysis_done');
      expect(OLEG_STAGE_MAP.stage4).toContain('design_mandate_signed');
    });

    it('should define valid transitions', () => {
      expect(VALID_TRANSITIONS['prospect']).toContain('contacted');
      expect(VALID_TRANSITIONS['contacted']).toContain('qualified');
      expect(VALID_TRANSITIONS['qualified']).toContain('analysis_done');
      expect(VALID_TRANSITIONS['analysis_done']).toContain('design_mandate_signed');
    });
  });

  describe('Qualification status normalization', () => {
    it('should normalize green status', () => {
      const result = validateStageTransition({
        currentStage: 'qualified',
        targetStage: 'analysis_done',
        lead: { qualificationStatus: 'green' },
        hasSimulation: true,
      });
      expect(result.allowed).toBe(true);
    });

    it('should normalize hot status to green', () => {
      const result = validateStageTransition({
        currentStage: 'qualified',
        targetStage: 'analysis_done',
        lead: { qualificationStatus: 'hot' },
        hasSimulation: true,
      });
      expect(result.allowed).toBe(true);
    });

    it('should block red status', () => {
      const result = validateStageTransition({
        currentStage: 'qualified',
        targetStage: 'analysis_done',
        lead: { qualificationStatus: 'red' },
        hasSimulation: true,
      });
      expect(result.allowed).toBe(false);
    });
  });
});

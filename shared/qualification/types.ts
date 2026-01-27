/**
 * Lead Qualification System Types
 *
 * Four qualification gates:
 * 1. Economic Potential - Monthly bill viability
 * 2. Right to Install - Property ownership/authorization
 * 3. Roof Condition - Age, repairs needed
 * 4. Decision Capacity - Authority, timeline, budget
 */

// Gate 1: Economic Potential
export type EconomicPotentialStatus = 'high' | 'medium' | 'low' | 'insufficient';

// Gate 2: Right to Install
export type PropertyRelationship = 'owner' | 'tenant_authorized' | 'tenant_pending' | 'tenant_no_auth' | 'unknown';

// Gate 3: Roof Condition
export type RoofCondition = 'excellent' | 'good' | 'needs_repair' | 'needs_replacement' | 'unknown';
export type RoofAge = 'new' | 'recent' | 'mature' | 'old' | 'unknown';

// Gate 4: Decision Capacity
export type DecisionAuthority = 'decision_maker' | 'influencer' | 'researcher' | 'unknown';
export type BudgetReadiness = 'budget_allocated' | 'budget_possible' | 'budget_needed' | 'no_budget' | 'unknown';
export type TimelineUrgency = 'immediate' | 'this_year' | 'next_year' | 'exploring' | 'unknown';

// Overall qualification status
export type QualificationStatus =
  | 'hot'           // All gates passed, ready for proposal
  | 'warm'          // Most gates passed, minor blockers
  | 'nurture'       // Potential but significant blockers
  | 'cold'          // Multiple blockers, long-term nurture
  | 'disqualified'  // Not a fit (insufficient potential or no path forward)
  | 'pending';      // Not yet qualified

// Blocker types
export type BlockerType =
  | 'insufficient_bill'
  | 'property_authorization'
  | 'roof_repair_needed'
  | 'roof_replacement_needed'
  | 'no_decision_authority'
  | 'no_budget'
  | 'long_timeline'
  | 'other';

// Solution types
export type SolutionType =
  | 'landlord_template'      // Template letter for landlord authorization
  | 'roof_partner_referral'  // Connect with roofing partner
  | 'ppa_financing'          // PPA option if no upfront budget
  | 'lease_financing'        // Lease option
  | 'executive_intro'        // Help connect with decision maker
  | 'education_content'      // Send educational content
  | 'follow_up_later'        // Schedule future follow-up
  | 'other';

export interface Blocker {
  type: BlockerType;
  description: string;
  severity: 'critical' | 'major' | 'minor';
  suggestedSolutions: SolutionType[];
}

export interface QualificationData {
  // Gate 1: Economic Potential
  estimatedMonthlyBill: number | null;
  economicStatus: EconomicPotentialStatus;

  // Gate 2: Right to Install
  propertyRelationship: PropertyRelationship;
  landlordName?: string;
  landlordContact?: string;
  authorizationStatus?: string;

  // Gate 3: Roof Condition
  roofCondition: RoofCondition;
  roofAge: RoofAge;
  roofAgeYears?: number;
  lastRoofInspection?: Date;
  plannedRoofWork?: string;

  // Gate 4: Decision Capacity
  decisionAuthority: DecisionAuthority;
  decisionMakerName?: string;
  decisionMakerTitle?: string;
  budgetReadiness: BudgetReadiness;
  timelineUrgency: TimelineUrgency;
  targetDecisionDate?: Date;

  // Notes
  qualificationNotes?: string;
}

export interface QualificationResult {
  status: QualificationStatus;
  score: number;              // 0-100
  gateScores: {
    economic: number;         // 0-25
    property: number;         // 0-25
    roof: number;             // 0-25
    decision: number;         // 0-25
  };
  blockers: Blocker[];
  suggestedNextSteps: string[];
  qualifiedAt?: Date;
  qualifiedBy?: string;
}

// Pre-qualification form data structure
export interface PreQualificationFormData {
  // Section A: Economic (auto-filled if available)
  estimatedMonthlyBill: number | null;

  // Section B: Property Rights
  propertyRelationship: PropertyRelationship;
  landlordName?: string;
  landlordEmail?: string;
  landlordPhone?: string;
  hasAuthorizationLetter: boolean;

  // Section C: Roof Condition
  roofAge: RoofAge;
  roofAgeYearsApprox?: number;
  roofCondition: RoofCondition;
  plannedRoofWorkNext5Years: boolean;
  plannedRoofWorkDescription?: string;

  // Section D: Decision Capacity
  contactIsDecisionMaker: boolean;
  decisionMakerName?: string;
  decisionMakerTitle?: string;
  decisionMakerEmail?: string;
  budgetReadiness: BudgetReadiness;
  timelineUrgency: TimelineUrgency;
  targetDecisionQuarter?: string;
}

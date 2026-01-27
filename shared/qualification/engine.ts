/**
 * Qualification Scoring Engine
 *
 * Calculates qualification score and status based on the 4 gates:
 * 1. Economic Potential (25 pts) - Based on monthly bill
 * 2. Right to Install (25 pts) - Property ownership/authorization
 * 3. Roof Condition (25 pts) - Age and condition
 * 4. Decision Capacity (25 pts) - Authority, budget, timeline
 */

import {
  QualificationData,
  QualificationResult,
  QualificationStatus,
  Blocker,
  EconomicPotentialStatus,
  PropertyRelationship,
  RoofCondition,
  RoofAge,
  DecisionAuthority,
  BudgetReadiness,
  TimelineUrgency,
  SolutionType,
} from './types';

// Thresholds for economic potential (monthly HQ bill)
const BILL_THRESHOLDS = {
  HIGH: 10000,      // $10k+/month = excellent potential
  MEDIUM: 5000,     // $5k-10k = good potential
  LOW: 2500,        // $2.5k-5k = possible but marginal
  MINIMUM: 1500,    // Below $1.5k = probably not viable for C&I
};

// Score mappings
const ECONOMIC_SCORES: Record<EconomicPotentialStatus, number> = {
  high: 25,
  medium: 20,
  low: 12,
  insufficient: 0,
};

const PROPERTY_SCORES: Record<PropertyRelationship, number> = {
  owner: 25,
  tenant_authorized: 22,
  tenant_pending: 12,
  tenant_no_auth: 5,
  unknown: 10,
};

const ROOF_CONDITION_SCORES: Record<RoofCondition, number> = {
  excellent: 15,
  good: 12,
  needs_repair: 6,
  needs_replacement: 0,
  unknown: 8,
};

const ROOF_AGE_SCORES: Record<RoofAge, number> = {
  new: 10,         // 0-5 years
  recent: 8,       // 5-10 years
  mature: 5,       // 10-20 years
  old: 2,          // 20+ years
  unknown: 4,
};

const DECISION_AUTHORITY_SCORES: Record<DecisionAuthority, number> = {
  decision_maker: 10,
  influencer: 6,
  researcher: 3,
  unknown: 4,
};

const BUDGET_SCORES: Record<BudgetReadiness, number> = {
  budget_allocated: 8,
  budget_possible: 6,
  budget_needed: 3,
  no_budget: 1,
  unknown: 3,
};

const TIMELINE_SCORES: Record<TimelineUrgency, number> = {
  immediate: 7,
  this_year: 5,
  next_year: 3,
  exploring: 1,
  unknown: 2,
};

/**
 * Calculate economic potential status based on monthly bill
 */
export function calculateEconomicStatus(monthlyBill: number | null): EconomicPotentialStatus {
  if (monthlyBill === null || monthlyBill === undefined) {
    return 'insufficient';
  }
  if (monthlyBill >= BILL_THRESHOLDS.HIGH) return 'high';
  if (monthlyBill >= BILL_THRESHOLDS.MEDIUM) return 'medium';
  if (monthlyBill >= BILL_THRESHOLDS.LOW) return 'low';
  return 'insufficient';
}

/**
 * Identify blockers based on qualification data
 */
function identifyBlockers(data: QualificationData): Blocker[] {
  const blockers: Blocker[] = [];

  // Gate 1: Economic blockers
  if (data.economicStatus === 'insufficient') {
    blockers.push({
      type: 'insufficient_bill',
      description: 'Facture mensuelle insuffisante pour un projet C&I viable',
      severity: 'critical',
      suggestedSolutions: ['education_content', 'follow_up_later'],
    });
  }

  // Gate 2: Property blockers
  if (data.propertyRelationship === 'tenant_no_auth') {
    blockers.push({
      type: 'property_authorization',
      description: 'Locataire sans autorisation du propriétaire',
      severity: 'critical',
      suggestedSolutions: ['landlord_template', 'follow_up_later'],
    });
  } else if (data.propertyRelationship === 'tenant_pending') {
    blockers.push({
      type: 'property_authorization',
      description: 'Autorisation du propriétaire en attente',
      severity: 'major',
      suggestedSolutions: ['landlord_template', 'follow_up_later'],
    });
  }

  // Gate 3: Roof blockers
  if (data.roofCondition === 'needs_replacement') {
    blockers.push({
      type: 'roof_replacement_needed',
      description: 'Toiture nécessite un remplacement complet',
      severity: 'critical',
      suggestedSolutions: ['roof_partner_referral', 'follow_up_later'],
    });
  } else if (data.roofCondition === 'needs_repair') {
    blockers.push({
      type: 'roof_repair_needed',
      description: 'Toiture nécessite des réparations',
      severity: 'major',
      suggestedSolutions: ['roof_partner_referral'],
    });
  }

  // Gate 4: Decision blockers
  if (data.decisionAuthority === 'researcher') {
    blockers.push({
      type: 'no_decision_authority',
      description: 'Contact n\'est pas le décideur',
      severity: 'major',
      suggestedSolutions: ['executive_intro', 'education_content'],
    });
  }

  if (data.budgetReadiness === 'no_budget') {
    blockers.push({
      type: 'no_budget',
      description: 'Aucun budget disponible',
      severity: 'critical',
      suggestedSolutions: ['ppa_financing', 'lease_financing', 'follow_up_later'],
    });
  } else if (data.budgetReadiness === 'budget_needed') {
    blockers.push({
      type: 'no_budget',
      description: 'Budget doit être approuvé',
      severity: 'major',
      suggestedSolutions: ['ppa_financing', 'lease_financing', 'education_content'],
    });
  }

  if (data.timelineUrgency === 'exploring') {
    blockers.push({
      type: 'long_timeline',
      description: 'Client en phase d\'exploration seulement',
      severity: 'minor',
      suggestedSolutions: ['education_content', 'follow_up_later'],
    });
  }

  return blockers;
}

/**
 * Determine overall status based on score and blockers
 */
function determineStatus(score: number, blockers: Blocker[]): QualificationStatus {
  const criticalBlockers = blockers.filter(b => b.severity === 'critical');
  const majorBlockers = blockers.filter(b => b.severity === 'major');

  // If any critical blocker, can't be hot/warm
  if (criticalBlockers.length > 0) {
    // Insufficient bill = disqualified (no path forward)
    if (criticalBlockers.some(b => b.type === 'insufficient_bill')) {
      return 'disqualified';
    }
    // Other critical blockers = cold (potential but major work needed)
    return 'cold';
  }

  // Score-based with major blocker consideration
  if (score >= 80 && majorBlockers.length === 0) {
    return 'hot';
  }
  if (score >= 65 || (score >= 55 && majorBlockers.length <= 1)) {
    return 'warm';
  }
  if (score >= 40) {
    return 'nurture';
  }
  return 'cold';
}

/**
 * Generate suggested next steps based on status and blockers
 */
function generateNextSteps(
  status: QualificationStatus,
  blockers: Blocker[],
  data: QualificationData
): string[] {
  const steps: string[] = [];

  if (status === 'hot') {
    steps.push('Planifier une rencontre pour présenter la proposition');
    steps.push('Préparer l\'analyse solaire détaillée');
    return steps;
  }

  if (status === 'warm') {
    steps.push('Résoudre les blocages mineurs identifiés');
    if (data.decisionAuthority === 'influencer') {
      steps.push('Demander une introduction au décideur');
    }
    steps.push('Envoyer une proposition préliminaire');
    return steps;
  }

  // Address specific blockers
  for (const blocker of blockers) {
    switch (blocker.type) {
      case 'property_authorization':
        steps.push('Envoyer le modèle de lettre d\'autorisation au propriétaire');
        steps.push('Offrir de participer à une rencontre avec le propriétaire');
        break;
      case 'roof_replacement_needed':
      case 'roof_repair_needed':
        steps.push('Référer à notre partenaire couvreur pour évaluation');
        steps.push('Proposer un projet combiné toiture + solaire');
        break;
      case 'no_budget':
        steps.push('Présenter les options PPA et crédit-bail (0$ initial)');
        break;
      case 'no_decision_authority':
        steps.push('Demander une introduction au décideur');
        steps.push('Envoyer du contenu éducatif pour partager en interne');
        break;
      case 'long_timeline':
        steps.push('Planifier un suivi dans 3-6 mois');
        steps.push('Ajouter à la liste de nurturing');
        break;
    }
  }

  if (status === 'disqualified') {
    steps.push('Classer comme non-viable pour le moment');
    steps.push('Considérer pour projets résidentiels ou référence à partenaire');
  }

  return [...new Set(steps)]; // Remove duplicates
}

/**
 * Main qualification scoring function
 */
export function calculateQualification(data: QualificationData): QualificationResult {
  // Calculate individual gate scores
  const economicScore = ECONOMIC_SCORES[data.economicStatus];
  const propertyScore = PROPERTY_SCORES[data.propertyRelationship];
  const roofScore = ROOF_CONDITION_SCORES[data.roofCondition] + ROOF_AGE_SCORES[data.roofAge];
  const decisionScore =
    DECISION_AUTHORITY_SCORES[data.decisionAuthority] +
    BUDGET_SCORES[data.budgetReadiness] +
    TIMELINE_SCORES[data.timelineUrgency];

  const totalScore = economicScore + propertyScore + roofScore + decisionScore;

  // Identify blockers
  const blockers = identifyBlockers(data);

  // Determine overall status
  const status = determineStatus(totalScore, blockers);

  // Generate next steps
  const suggestedNextSteps = generateNextSteps(status, blockers, data);

  return {
    status,
    score: totalScore,
    gateScores: {
      economic: economicScore,
      property: propertyScore,
      roof: roofScore,
      decision: decisionScore,
    },
    blockers,
    suggestedNextSteps,
    qualifiedAt: new Date(),
  };
}

/**
 * Quick qualification check based on minimal data
 * Used for initial lead scoring before full qualification
 */
export function quickQualificationScore(monthlyBill: number | null): {
  status: EconomicPotentialStatus;
  estimatedPotentialKw: number | null;
  viable: boolean;
} {
  const status = calculateEconomicStatus(monthlyBill);

  // Rough estimate: $1000/month ≈ 100 kW potential (very approximate)
  const estimatedPotentialKw = monthlyBill ? Math.round(monthlyBill / 10) : null;

  return {
    status,
    estimatedPotentialKw,
    viable: status !== 'insufficient',
  };
}

/**
 * Solution templates and resources
 */
export const SOLUTION_RESOURCES: Record<SolutionType, { fr: string; en: string; templatePath?: string }> = {
  landlord_template: {
    fr: 'Modèle de lettre d\'autorisation pour le propriétaire',
    en: 'Landlord authorization letter template',
    templatePath: '/templates/landlord-authorization-letter.pdf',
  },
  roof_partner_referral: {
    fr: 'Référence à notre partenaire couvreur certifié',
    en: 'Referral to our certified roofing partner',
  },
  ppa_financing: {
    fr: 'Option PPA - 0$ initial, économies dès le jour 1',
    en: 'PPA option - $0 upfront, savings from day 1',
  },
  lease_financing: {
    fr: 'Option crédit-bail - Propriété après 7 ans',
    en: 'Lease option - Ownership after 7 years',
  },
  executive_intro: {
    fr: 'Faciliter une introduction au niveau exécutif',
    en: 'Facilitate executive-level introduction',
  },
  education_content: {
    fr: 'Envoyer du contenu éducatif sur le solaire C&I',
    en: 'Send educational content about C&I solar',
  },
  follow_up_later: {
    fr: 'Planifier un suivi ultérieur',
    en: 'Schedule follow-up for later',
  },
  other: {
    fr: 'Autre solution personnalisée',
    en: 'Other custom solution',
  },
};

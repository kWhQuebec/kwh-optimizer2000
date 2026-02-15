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

  return Array.from(new Set(steps)); // Remove duplicates
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
 * Compute lead color classification based on qualification result + business context.
 *
 * VERT (viable) :
 *   - Propriétaire (ou locataire autorisé bail > 10 ans)
 *   - L'entreprise paie la facture
 *   - Toiture < 10 ans ou bon état, toit plat
 *   - Score qualification ≥ 70, aucun blocage critique/majeur
 *
 * JAUNE (à explorer) :
 *   - Locataire avec autorisation partielle, ou bail mixte
 *   - Toiture 10-20 ans, ou infos manquantes
 *   - Toit incliné (faisable mais plus complexe)
 *   - Score 30-69, ou blocages majeurs
 *
 * ROUGE (non viable) :
 *   - Locataire sans autorisation possible
 *   - Le propriétaire paie la facture (zéro incitatif prospect)
 *   - Toiture > 25 ans en mauvais état sans plan de réfection
 *   - Score < 30 ou blocages critiques
 */
export interface LeadBusinessContext {
  propertyRelationship?: string | null;
  billPayer?: string | null;
  roofCondition?: string | null;
  roofAgeYears?: number | null;
  roofSlope?: string | null;
  roofRemainingLifeYears?: number | null;
  plannedRoofWork?: string | null;
}

export function computeLeadColor(
  result: QualificationResult,
  context?: LeadBusinessContext
): { color: 'green' | 'yellow' | 'red'; reason: string } {
  const criticalBlockers = result.blockers.filter(b => b.severity === 'critical');
  const majorBlockers = result.blockers.filter(b => b.severity === 'major');
  const reasons: string[] = [];

  // === RED FLAGS (any one = rouge) ===

  // Locataire sans autorisation
  if (context?.propertyRelationship === 'tenant_no_auth') {
    reasons.push('Locataire sans autorisation du propriétaire');
    return { color: 'red', reason: reasons.join('. ') };
  }

  // Propriétaire paie la facture (zéro incitatif pour le prospect locataire)
  if (context?.billPayer === 'landlord' && context?.propertyRelationship !== 'owner') {
    reasons.push('Le propriétaire paie la facture — aucun incitatif économique pour le prospect');
    return { color: 'red', reason: reasons.join('. ') };
  }

  // Toiture > 25 ans en mauvais état sans plan de réfection
  if (context?.roofAgeYears && context.roofAgeYears > 25 && context?.roofCondition === 'needs_replacement' && !context?.plannedRoofWork) {
    reasons.push('Toiture > 25 ans nécessitant remplacement, sans plan de réfection');
    return { color: 'red', reason: reasons.join('. ') };
  }

  // Vie utile restante < 5 ans (pas assez pour justifier le solaire)
  if (context?.roofRemainingLifeYears != null && context.roofRemainingLifeYears < 5 && !context?.plannedRoofWork) {
    reasons.push(`Vie utile de la toiture restante insuffisante (${context.roofRemainingLifeYears} ans)`);
    return { color: 'red', reason: reasons.join('. ') };
  }

  // Score très bas ou blocages critiques
  if (result.score < 30 || criticalBlockers.length > 0) {
    if (result.score < 30) reasons.push(`Score insuffisant (${result.score}/100)`);
    if (criticalBlockers.length > 0) reasons.push(`${criticalBlockers.length} blocage(s) critique(s)`);
    return { color: 'red', reason: reasons.join('. ') };
  }

  // === YELLOW FLAGS (accumulate) ===
  const yellowFlags: string[] = [];

  // Locataire avec autorisation partielle ou bail mixte
  if (context?.propertyRelationship === 'tenant_pending') {
    yellowFlags.push('Autorisation du propriétaire en attente');
  }
  if (context?.billPayer === 'shared') {
    yellowFlags.push('Facture partagée — vérifier la répartition');
  }

  // Toiture 10-20 ans ou condition moyenne
  if (context?.roofAgeYears && context.roofAgeYears >= 10 && context.roofAgeYears <= 20) {
    yellowFlags.push(`Toiture de ${context.roofAgeYears} ans — vérifier état`);
  }
  if (context?.roofCondition === 'needs_repair') {
    yellowFlags.push('Toiture nécessitant des réparations');
  }

  // Vie utile restante 5-15 ans
  if (context?.roofRemainingLifeYears != null && context.roofRemainingLifeYears >= 5 && context.roofRemainingLifeYears < 15) {
    yellowFlags.push(`Vie utile restante de ${context.roofRemainingLifeYears} ans — coordonner avec réfection`);
  }

  // Toit incliné (faisable mais plus complexe/coûteux)
  if (context?.roofSlope === 'steep') {
    yellowFlags.push('Toit à forte pente — installation plus complexe');
  }

  // Blocages majeurs du scoring
  if (majorBlockers.length > 0) {
    yellowFlags.push(`${majorBlockers.length} blocage(s) majeur(s)`);
  }
  if (result.score < 70) {
    yellowFlags.push(`Score modéré (${result.score}/100)`);
  }
  if (result.status === 'nurture') {
    yellowFlags.push('En phase de nurturing');
  }

  // Si on a des yellow flags, c'est jaune
  if (yellowFlags.length > 0) {
    return { color: 'yellow', reason: yellowFlags.join('. ') };
  }

  // === GREEN (tout est bon) ===
  if (result.score >= 70 && criticalBlockers.length === 0 && majorBlockers.length === 0) {
    return { color: 'green', reason: `Prospect qualifié (score: ${result.score}/100)` };
  }

  // Default: yellow si on ne peut pas confirmer vert
  return { color: 'yellow', reason: 'Qualification en cours — informations à compléter' };
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

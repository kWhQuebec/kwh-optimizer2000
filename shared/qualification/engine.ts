/**
 * Qualification Scoring Engine
 *
 * Calculates qualification score and status based on the 4 gates:
 * 1. Economic Potential (25 pts) - Based on monthly bill
 * 2. Right to Install (25 pts) - Property ownership/authorization
 * 3. Roof Condition (25 pts) - Age and condition
 * 4. Decision Capacity (25 pts) - Authority, budget, timeline
 *
 * Plus 6 risk flag categories (Oleg blueprint):
 * 1. Lease complexity
 * 2. Roof risk / warranty
 * 3. Electrical upgrade potential
 * 4. HQ interconnect uncertainty
 * 5. Load change risk
 * 6. Structural building capacity
 */

import {
  QualificationData,
  QualificationResult,
  QualificationStatus,
  Blocker,
  RiskFlag,
  RiskFlagCategory,
  EconomicPotentialStatus,
  PropertyRelationship,
  RoofCondition,
  RoofAge,
  DecisionAuthority,
  BudgetReadiness,
  TimelineUrgency,
  SolutionType,
  LeadBusinessContext,
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
      category: 'lease',
    });
  }

  // Gate 2: Property blockers
  if (data.propertyRelationship === 'tenant_no_auth') {
    blockers.push({
      type: 'property_authorization',
      description: 'Locataire sans autorisation du propriétaire',
      severity: 'critical',
      suggestedSolutions: ['landlord_template', 'follow_up_later'],
      category: 'lease',
    });
  } else if (data.propertyRelationship === 'tenant_pending') {
    blockers.push({
      type: 'property_authorization',
      description: 'Autorisation du propriétaire en attente',
      severity: 'major',
      suggestedSolutions: ['landlord_template', 'follow_up_later'],
      category: 'lease',
    });
  }

  // Gate 3: Roof blockers
  if (data.roofCondition === 'needs_replacement') {
    blockers.push({
      type: 'roof_replacement_needed',
      description: 'Toiture nécessite un remplacement complet',
      severity: 'critical',
      suggestedSolutions: ['roof_partner_referral', 'follow_up_later'],
      category: 'roof',
    });
  } else if (data.roofCondition === 'needs_repair') {
    blockers.push({
      type: 'roof_repair_needed',
      description: 'Toiture nécessite des réparations',
      severity: 'major',
      suggestedSolutions: ['roof_partner_referral'],
      category: 'roof',
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
 * Identify risk flags from extended business context (Oleg blueprint 6 categories).
 * These are separate from blockers — risk flags inform the Design Agreement scope
 * and highlight areas needing investigation during the site visit.
 */
function identifyRiskFlags(context?: LeadBusinessContext): RiskFlag[] {
  if (!context) return [];
  const flags: RiskFlag[] = [];

  // ── Category 1: Lease complexity ──
  if (context.propertyRelationship === 'tenant_pending') {
    flags.push({
      category: 'lease',
      label: 'Bail à clarifier',
      severity: 'major',
      description: 'Autorisation du propriétaire en attente — impact sur le financement et l\'assurance.',
      mitigation: 'Obtenir une lettre d\'autorisation signée avant le Design Agreement.',
    });
  }
  if (context.billPayer === 'shared') {
    flags.push({
      category: 'lease',
      label: 'Facture partagée',
      severity: 'minor',
      description: 'Facture d\'électricité partagée — modèle économique à valider.',
      mitigation: 'Clarifier la répartition des coûts et bénéfices avant la proposition.',
    });
  }

  // ── Category 2: Roof risk / warranty ──
  if (context.roofCondition === 'needs_repair') {
    flags.push({
      category: 'roof',
      label: 'Réparations toiture requises',
      severity: 'major',
      description: 'Toiture nécessitant des réparations — risque de garantie et de délais.',
      mitigation: 'Coordonner avec couvreur certifié. Projet combiné toiture + solaire possible.',
    });
  }
  if (context.roofAgeYears != null && context.roofAgeYears >= 15 && context.roofAgeYears < 25) {
    flags.push({
      category: 'roof',
      label: 'Toiture mature',
      severity: 'minor',
      description: `Toiture de ${context.roofAgeYears} ans — garantie manufacturier à vérifier.`,
      mitigation: 'Valider la garantie existante. Considérer membrane overlay si applicable.',
    });
  }
  if (context.roofRemainingLifeYears != null && context.roofRemainingLifeYears >= 5 && context.roofRemainingLifeYears < 15) {
    flags.push({
      category: 'roof',
      label: 'Vie utile limitée',
      severity: 'major',
      description: `Vie utile restante de ${context.roofRemainingLifeYears} ans — synchroniser avec cycle de remplacement.`,
      mitigation: 'Planifier le remplacement de toiture en parallèle du projet solaire.',
    });
  }

  // ── Category 3: Electrical upgrade potential ──
  if (context.electricalUpgradeNeeded === true) {
    flags.push({
      category: 'electrical',
      label: 'Upgrade électrique requis',
      severity: 'critical',
      description: 'Mise à niveau du panneau électrique confirmée nécessaire.',
      mitigation: 'Évaluation professionnelle requise. Coût estimé $5k-$25k selon l\'ampleur.',
    });
  } else if (context.electricalServiceAmps != null && context.electricalServiceAmps < 200) {
    flags.push({
      category: 'electrical',
      label: 'Service électrique limité',
      severity: 'major',
      description: `Service actuel de ${context.electricalServiceAmps}A — possiblement insuffisant pour l'injection solaire.`,
      mitigation: 'Évaluation électrique lors de la visite de site. Upgrade potentiel à budgéter.',
    });
  } else if (context.electricalServiceAmps != null && context.electricalServiceAmps >= 200 && context.electricalServiceAmps < 400) {
    flags.push({
      category: 'electrical',
      label: 'Capacité électrique à valider',
      severity: 'minor',
      description: `Service de ${context.electricalServiceAmps}A — suffisant pour petit système, à valider pour installation > 100 kW.`,
      mitigation: 'Confirmer la capacité résiduelle lors de l\'évaluation électrique.',
    });
  }
  if (context.electricalPanelAge != null && context.electricalPanelAge > 25) {
    flags.push({
      category: 'electrical',
      label: 'Panneau électrique vieillissant',
      severity: 'minor',
      description: `Panneau électrique de ${context.electricalPanelAge} ans — peut nécessiter mise à niveau pour conformité.`,
      mitigation: 'Inspection électrique recommandée pendant la visite de site.',
    });
  }

  // ── Category 4: HQ interconnect uncertainty ──
  if (context.hqInterconnectStatus === 'denied') {
    flags.push({
      category: 'interconnect',
      label: 'Interconnexion HQ refusée',
      severity: 'critical',
      description: 'Hydro-Québec a déjà refusé une demande d\'interconnexion pour ce site.',
      mitigation: 'Analyser la raison du refus. Possibilité de demande révisée selon les modifications.',
    });
  } else if (context.hqInterconnectStatus === 'pending') {
    flags.push({
      category: 'interconnect',
      label: 'Interconnexion HQ en attente',
      severity: 'major',
      description: 'Demande d\'interconnexion en cours — délai HQ typique: 4-12 semaines.',
      mitigation: 'Suivre la demande avec HQ. Ajuster le calendrier du projet en conséquence.',
    });
  } else if (context.hqInterconnectStatus === 'unknown') {
    flags.push({
      category: 'interconnect',
      label: 'Interconnexion HQ à valider',
      severity: 'minor',
      description: 'Statut d\'interconnexion HQ inconnu — à vérifier pendant le Design Agreement.',
      mitigation: 'La demande d\'interconnexion fait partie du scope A du Design Agreement.',
    });
  }
  // Large systems (> 1 MW) have more complex HQ approval
  if (context.systemSizeKw != null && context.systemSizeKw > 1000) {
    flags.push({
      category: 'interconnect',
      label: 'Système > 1 MW — approbation complexe',
      severity: 'major',
      description: `Système de ${context.systemSizeKw} kW — étude de réseau HQ requise (délai 8-16 semaines, coût variable).`,
      mitigation: 'Initier la demande d\'étude HQ dès la signature du Design Agreement.',
    });
  }
  // Underground distribution = more complex interconnection
  if (context.hqDistributionType === 'underground') {
    flags.push({
      category: 'interconnect',
      label: 'Distribution souterraine',
      severity: 'minor',
      description: 'Réseau HQ souterrain — interconnexion potentiellement plus complexe et coûteuse.',
      mitigation: 'Valider le point de raccordement lors de la visite de site.',
    });
  }

  // ── Category 5: Load change risk ──
  if (context.plannedLoadChanges === true) {
    const desc = context.loadChangeDescription
      ? `Changements prévus: ${context.loadChangeDescription}`
      : 'Changements de consommation prévus — dimensionnement à adapter.';
    flags.push({
      category: 'load',
      label: 'Changement de charge prévu',
      severity: 'major',
      description: desc,
      mitigation: 'Dimensionner le système en tenant compte de la charge future. Possibilité de design en phases.',
    });
  }

  // ── Category 6: Structural building capacity ──
  if (context.structuralAssessment === 'insufficient') {
    flags.push({
      category: 'structural',
      label: 'Capacité structurale insuffisante',
      severity: 'critical',
      description: 'Structure du bâtiment ne supporte pas le poids des panneaux solaires.',
      mitigation: 'Évaluation structurale professionnelle requise. Renforcement possible mais coûteux.',
    });
  } else if (context.structuralAssessment === 'marginal') {
    flags.push({
      category: 'structural',
      label: 'Capacité structurale marginale',
      severity: 'major',
      description: 'Capacité structurale à la limite — nombre de panneaux possiblement réduit.',
      mitigation: 'Évaluation par ingénieur structural. Considérer panneaux légers ou configuration réduite.',
    });
  } else if (context.structuralAssessment === 'unknown') {
    flags.push({
      category: 'structural',
      label: 'Capacité structurale inconnue',
      severity: 'minor',
      description: 'Aucune évaluation structurale disponible — à vérifier.',
      mitigation: 'L\'évaluation structurale fait partie du scope du Design Agreement.',
    });
  }
  // Old wood buildings = higher structural risk
  if (context.buildingType === 'wood' && context.buildingAge != null && context.buildingAge > 30) {
    flags.push({
      category: 'structural',
      label: 'Bâtiment bois ancien',
      severity: 'major',
      description: `Bâtiment en bois de ${context.buildingAge} ans — capacité portante potentiellement limitée.`,
      mitigation: 'Évaluation structurale obligatoire avant design. Renforcement probable.',
    });
  }
  // Low roof load capacity
  if (context.roofLoadCapacity != null && context.roofLoadCapacity < 15) {
    flags.push({
      category: 'structural',
      label: 'Capacité portante faible',
      severity: 'major',
      description: `Capacité portante de ${context.roofLoadCapacity} PSF — sous le seuil recommandé de 15 PSF pour le solaire.`,
      mitigation: 'Panneaux légers ou ballast réduit. Évaluation ingénieur requise.',
    });
  }

  return flags;
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
      case 'electrical_upgrade':
        steps.push('Planifier une évaluation électrique lors de la visite de site');
        steps.push('Budgéter la mise à niveau du panneau électrique si nécessaire');
        break;
      case 'hq_interconnect':
        steps.push('Initier la demande d\'interconnexion HQ dès que possible');
        steps.push('Vérifier le type de réseau de distribution (souterrain/aérien)');
        break;
      case 'load_change':
        steps.push('Documenter les changements de charge prévus pour dimensionnement');
        steps.push('Considérer un design en phases pour s\'adapter à l\'évolution de la charge');
        break;
      case 'structural_capacity':
        steps.push('Obtenir une évaluation structurale par un ingénieur');
        steps.push('Considérer des panneaux légers ou une configuration réduite');
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
export function calculateQualification(
  data: QualificationData,
  context?: LeadBusinessContext
): QualificationResult {
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

  // Identify risk flags from extended context
  const riskFlags = identifyRiskFlags(context);

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
    riskFlags,
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
 *   - Drapeaux: upgrade électrique, interconnexion HQ incertaine,
 *     changement de charge, capacité structurale marginale
 *
 * ROUGE (non viable) :
 *   - Locataire sans autorisation possible
 *   - Le propriétaire paie la facture (zéro incitatif prospect)
 *   - Toiture > 25 ans en mauvais état sans plan de réfection
 *   - Score < 30 ou blocages critiques
 *   - Interconnexion HQ refusée, capacité structurale insuffisante
 */
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

  // HQ interconnection denied
  if (context?.hqInterconnectStatus === 'denied') {
    reasons.push('Interconnexion HQ refusée — analyse requise avant de procéder');
    return { color: 'red', reason: reasons.join('. ') };
  }

  // Structural capacity insufficient
  if (context?.structuralAssessment === 'insufficient') {
    reasons.push('Capacité structurale insuffisante pour supporter les panneaux solaires');
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

  // Electrical upgrade needed or limited service
  if (context?.electricalUpgradeNeeded === true) {
    yellowFlags.push('Mise à niveau électrique requise — coût additionnel à budgéter');
  } else if (context?.electricalServiceAmps != null && context.electricalServiceAmps < 200) {
    yellowFlags.push(`Service électrique de ${context.electricalServiceAmps}A — possiblement insuffisant`);
  }

  // HQ interconnection pending or unknown
  if (context?.hqInterconnectStatus === 'pending') {
    yellowFlags.push('Interconnexion HQ en attente — délai 4-12 semaines');
  } else if (context?.hqInterconnectStatus === 'unknown' && context?.systemSizeKw && context.systemSizeKw > 100) {
    yellowFlags.push('Interconnexion HQ à valider pour système > 100 kW');
  }

  // Large system = complex HQ approval
  if (context?.systemSizeKw != null && context.systemSizeKw > 1000) {
    yellowFlags.push(`Système de ${context.systemSizeKw} kW — étude de réseau HQ requise`);
  }

  // Planned load changes
  if (context?.plannedLoadChanges === true) {
    yellowFlags.push('Changements de charge prévus — dimensionnement à adapter');
  }

  // Structural concerns
  if (context?.structuralAssessment === 'marginal') {
    yellowFlags.push('Capacité structurale marginale — évaluation requise');
  } else if (context?.structuralAssessment === 'unknown') {
    yellowFlags.push('Capacité structurale inconnue — à vérifier lors de la visite');
  }

  // Old wood building
  if (context?.buildingType === 'wood' && context?.buildingAge != null && context.buildingAge > 30) {
    yellowFlags.push(`Bâtiment bois de ${context.buildingAge} ans — évaluation structurale requise`);
  }

  // Low roof load capacity
  if (context?.roofLoadCapacity != null && context.roofLoadCapacity < 15) {
    yellowFlags.push(`Capacité portante faible (${context.roofLoadCapacity} PSF) — panneaux légers requis`);
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
  electrical_assessment: {
    fr: 'Évaluation professionnelle du service électrique',
    en: 'Professional electrical service assessment',
  },
  hq_preapproval: {
    fr: 'Assistance pour la demande de pré-approbation HQ',
    en: 'HQ pre-approval application assistance',
  },
  structural_assessment: {
    fr: 'Évaluation structurale par ingénieur professionnel',
    en: 'Professional structural engineering assessment',
  },
  load_study: {
    fr: 'Étude de profil de charge et consommation future',
    en: 'Load profile and future consumption study',
  },
  other: {
    fr: 'Autre solution personnalisée',
    en: 'Other custom solution',
  },
};

/**
 * Risk flag category labels for UI display
 */
export const RISK_FLAG_CATEGORY_LABELS: Record<RiskFlagCategory, { fr: string; en: string; icon: string }> = {
  lease: { fr: 'Bail & Propriété', en: 'Lease & Property', icon: '📋' },
  roof: { fr: 'Toiture & Garantie', en: 'Roof & Warranty', icon: '🏠' },
  electrical: { fr: 'Électrique', en: 'Electrical', icon: '⚡' },
  interconnect: { fr: 'Interconnexion HQ', en: 'HQ Interconnection', icon: '🔌' },
  load: { fr: 'Profil de charge', en: 'Load Profile', icon: '📊' },
  structural: { fr: 'Structure bâtiment', en: 'Building Structure', icon: '🏗️' },
};

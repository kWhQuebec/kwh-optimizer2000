/**
 * Pipeline Gating Rules for Oleg's 4-Stage Funnel
 *
 * Implements validation logic for stage transitions in the kWh sales pipeline.
 * This is a pure function module with no DB dependencies — enables easy testing.
 *
 * Stage mapping:
 * - Oleg Stage 1 (Instant Indicative): prospect → contacted (email required)
 * - Oleg Stage 2 (Qualification Gate): contacted → qualified (email + phone + property + roof)
 * - Oleg Stage 3 (Proposal v1): qualified → analysis_done (green lead + simulation)
 * - Oleg Stage 4 (Design Validation): analysis_done → design_mandate_signed (signed agreement + payment)
 * - Firm EPC: design_mandate_signed → epc_proposal_sent (design validation complete)
 */

/**
 * Context required for gating validation.
 * Maps to lead, site, simulation, and design agreement data from the database.
 */
export interface GatingContext {
  currentStage: string;
  targetStage: string;
  lead?: {
    email?: string | null;
    phone?: string | null;
    propertyRelationship?: string | null; // owner | tenant_authorized | tenant_pending | tenant_no_auth | unknown
    roofAge?: string | null; // new | recent | mature | old | unknown
    whoPaysElectricity?: string | null; // owner | tenant | unknown (legacy from schema, maps to billPayer)
    qualificationScore?: number | null; // 0-100
    qualificationStatus?: string | null; // green | yellow | red | (or hot | warm | nurture | cold | pending)
    businessDriver?: string | null; // cost_savings | resilience | sustainability | tax_capital | other
  };
  hasSimulation?: boolean;
  hasDesignAgreement?: boolean;
  designAgreementStatus?: string | null; // draft | sent | accepted | declined | expired
  designAgreementPaid?: boolean; // true if deposit paid
}

/**
 * Result of gating validation.
 */
export interface GatingResult {
  allowed: boolean;
  blockers: string[]; // Reasons why transition is blocked (French primary, bilingual)
  warnings: string[]; // Non-blocking warnings (things user should be aware of)
  requiredActions: string[]; // Specific steps the user needs to take
}

/**
 * Oleg's 4-stage mapping to database stages.
 * Used by frontend to display Oleg funnel alignment.
 */
export const OLEG_STAGE_MAP = {
  stage1: ['prospect', 'contacted'], // Instant Indicative
  stage2: ['qualified'], // Qualification Gate
  stage3: ['analysis_done'], // Proposal v1
  stage4: ['design_mandate_signed'], // Design Validation
  firmEpc: ['epc_proposal_sent', 'negotiation', 'won_to_be_delivered', 'won_in_construction', 'won_delivered'], // Firm EPC
};

/**
 * Valid stage transitions.
 * Defines which stages can transition to which stages.
 */
export const VALID_TRANSITIONS: Record<string, string[]> = {
  prospect: ['contacted', 'lost', 'disqualified'],
  contacted: ['qualified', 'lost', 'disqualified'],
  qualified: ['analysis_done', 'lost', 'disqualified'],
  analysis_done: ['design_mandate_signed', 'lost', 'disqualified'],
  design_mandate_signed: ['epc_proposal_sent', 'lost'],
  epc_proposal_sent: ['negotiation', 'lost'],
  negotiation: ['won_to_be_delivered', 'lost'],
  won_to_be_delivered: ['won_in_construction'],
  won_in_construction: ['won_delivered'],
  // Terminal states
  won_delivered: [],
  lost: ['prospect'], // Can reopen
  disqualified: ['prospect'], // Can reopen
};

/**
 * Normalize qualification status to a consistent format.
 * Supports both old (hot/warm/nurture/cold) and new (green/yellow/red) formats.
 */
function normalizeQualificationStatus(status?: string | null): string | null {
  if (!status) return null;
  const s = status.toLowerCase().trim();
  // New format (green/yellow/red)
  if (['green', 'yellow', 'red'].includes(s)) return s;
  // Old format (hot/warm/nurture/cold)
  if (s === 'hot') return 'green'; // hot = green (ready to move forward)
  if (s === 'warm') return 'yellow'; // warm = yellow (needs work but qualifies)
  if (['nurture', 'cold'].includes(s)) return 'red'; // nurture/cold = red (not qualified)
  return null;
}

/**
 * Main validation function: checks if a stage transition is allowed.
 *
 * Returns:
 * - allowed=false if transition violates gating rules (blocker conditions)
 * - allowed=true if transition is allowed (may have warnings)
 */
export function validateStageTransition(ctx: GatingContext): GatingResult {
  const result: GatingResult = {
    allowed: true,
    blockers: [],
    warnings: [],
    requiredActions: [],
  };

  // Validate that transition is in the allowed list
  const validTargets = VALID_TRANSITIONS[ctx.currentStage];
  if (!validTargets || !validTargets.includes(ctx.targetStage)) {
    result.allowed = false;
    result.blockers.push(
      `Transition from '${ctx.currentStage}' to '${ctx.targetStage}' is not allowed in the pipeline.`
    );
    return result;
  }

  // Backward transitions (reopening from lost/disqualified) — always allowed
  const isBackwardTransition =
    (ctx.currentStage === 'lost' || ctx.currentStage === 'disqualified') &&
    ctx.targetStage === 'prospect';
  if (isBackwardTransition) {
    return result; // No gating rules for reopening
  }

  // ===== GATING RULES BY TARGET STAGE =====

  // prospect → contacted: Email required
  if (ctx.currentStage === 'prospect' && ctx.targetStage === 'contacted') {
    if (!ctx.lead?.email) {
      result.allowed = false;
      result.blockers.push("L'adresse email du prospect est requise pour passer au stade 'Contacted'.");
      result.requiredActions.push('Ajouter l\'adresse email du prospect');
    }
  }

  // contacted → qualified: Email + phone + property relationship + roof age
  if (ctx.currentStage === 'contacted' && ctx.targetStage === 'qualified') {
    if (!ctx.lead?.email) {
      result.allowed = false;
      result.blockers.push('Email requis.');
      result.requiredActions.push('Ajouter l\'adresse email');
    }
    if (!ctx.lead?.phone) {
      result.allowed = false;
      result.blockers.push('Numéro de téléphone requis pour la qualification.');
      result.requiredActions.push('Ajouter le numéro de téléphone');
    }
    if (!ctx.lead?.propertyRelationship || ctx.lead.propertyRelationship === 'unknown') {
      result.allowed = false;
      result.blockers.push('Relation de propriété (propriétaire/locataire) doit être confirmée.');
      result.requiredActions.push('Confirmer si propriétaire ou locataire autorisé');
    }
    if (!ctx.lead?.roofAge || ctx.lead.roofAge === 'unknown') {
      result.allowed = false;
      result.blockers.push('L\'âge du toit doit être déterminé pour la qualification.');
      result.requiredActions.push('Évaluer l\'âge du toit (nouveau/récent/mature/ancien)');
    }

    // Non-blocking warning: tenant without authorization is a risk
    if (
      ctx.lead?.propertyRelationship === 'tenant_pending' ||
      ctx.lead?.propertyRelationship === 'tenant_no_auth'
    ) {
      result.warnings.push(
        'Avertissement: Le locataire n\'a pas encore l\'autorisation du propriétaire. Ceci doit être obtenu avant de progresser.'
      );
      result.requiredActions.push('Obtenir l\'autorisation écrite du propriétaire (lettre standard fournie)');
    }
  }

  // qualified → analysis_done: Qualification status must be green (or yellow with warning) + simulation must exist
  if (ctx.currentStage === 'qualified' && ctx.targetStage === 'analysis_done') {
    const normStatus = normalizeQualificationStatus(ctx.lead?.qualificationStatus);

    // Red status is a blocker
    if (normStatus === 'red') {
      result.allowed = false;
      result.blockers.push(
        'Qualification rouge: le prospect ne satisfait pas aux critères minimaux. La progression est bloquée.'
      );
      result.requiredActions.push('Vérifier les blocages de qualification et résoudre avant de progresser');
    }

    // Yellow status is a warning (not a blocker)
    if (normStatus === 'yellow') {
      result.warnings.push(
        'Qualification jaune: il y a des avertissements ou des risques mineures. Procédez avec prudence.'
      );
      result.requiredActions.push('Vérifier les notes de qualification pour comprendre les risques');
    }

    // Simulation is required
    if (!ctx.hasSimulation) {
      result.allowed = false;
      result.blockers.push('Une simulation technique doit être complétée avant de passer à Analyse Done.');
      result.requiredActions.push('Créer une simulation de conception dans l\'outil d\'optimisation');
    }
  }

  // analysis_done → design_mandate_signed: Design agreement must be signed (accepted status) + should be paid
  if (ctx.currentStage === 'analysis_done' && ctx.targetStage === 'design_mandate_signed') {
    if (!ctx.hasDesignAgreement || ctx.designAgreementStatus !== 'accepted') {
      result.allowed = false;
      result.blockers.push(
        'La proposition de conception doit être acceptée et signée avant de passer à Design Mandate Signed.'
      );
      result.requiredActions.push('Envoyer la proposition de conception', 'Attendre l\'acceptation du client');
    }

    // Payment is recommended but not blocking (added as warning)
    if (!ctx.designAgreementPaid) {
      result.warnings.push(
        'Avertissement: Le dépôt de conception n\'a pas encore été reçu. Il est recommandé de recevoir le paiement avant de commencer les travaux.'
      );
      result.requiredActions.push('Traiter le paiement du dépôt via Stripe');
    }
  }

  // design_mandate_signed → epc_proposal_sent: Design validation must be complete (implies agreement + payment)
  if (ctx.currentStage === 'design_mandate_signed' && ctx.targetStage === 'epc_proposal_sent') {
    // By this point, agreement should be accepted and paid (checked in previous gate)
    if (!ctx.designAgreementPaid) {
      result.warnings.push(
        'Le dépôt de conception n\'a pas été reçu. Assurez-vous que le paiement est traité avant l\'ingénierie.'
      );
    }
  }

  // Transition to "lost": always allowed (no gating needed)
  if (ctx.targetStage === 'lost') {
    return result;
  }

  // Transition to "disqualified": always allowed (no gating needed)
  if (ctx.targetStage === 'disqualified') {
    return result;
  }

  return result;
}

/**
 * Helper: Get human-readable name for Oleg stage from database stage.
 * Used for UI display.
 */
export function getOlegStageName(dbStage: string): string {
  const stageMap = {
    prospect: 'Stage 1: Instant Indicative',
    contacted: 'Stage 1: Instant Indicative',
    qualified: 'Stage 2: Qualification Gate',
    analysis_done: 'Stage 3: Proposal v1',
    design_mandate_signed: 'Stage 4: Design Validation',
    epc_proposal_sent: 'Firm EPC',
    negotiation: 'Firm EPC',
    won_to_be_delivered: 'Firm EPC',
    won_in_construction: 'Firm EPC',
    won_delivered: 'Firm EPC',
    lost: 'Lost',
    disqualified: 'Disqualified',
  };
  return stageMap[dbStage as keyof typeof stageMap] || dbStage;
}

/**
 * Helper: Check if a stage is a "gating" stage (requires validation on entry).
 */
export function isGatingStage(stage: string): boolean {
  return ['contacted', 'qualified', 'analysis_done', 'design_mandate_signed', 'epc_proposal_sent'].includes(
    stage
  );
}

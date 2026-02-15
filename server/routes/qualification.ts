import { Router } from "express";
import { authMiddleware, requireStaff, AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import { qualificationFormSchema } from "@shared/schema";
import {
  calculateQualification,
  calculateEconomicStatus,
  computeLeadColor,
  QualificationData,
} from "@shared/qualification";
import { asyncHandler, BadRequestError, NotFoundError } from "../middleware/errorHandler";
import { createLogger } from "../lib/logger";

const log = createLogger("Qualification");
const router = Router();

/**
 * Get qualification data for a lead
 */
router.get("/api/leads/:id/qualification", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;
  const lead = await storage.getLead(id);

  if (!lead) {
    throw new NotFoundError("Lead");
  }

  // Build qualification data from lead
  const qualificationData: QualificationData = {
    estimatedMonthlyBill: lead.estimatedMonthlyBill,
    economicStatus: (lead as any).economicStatus || calculateEconomicStatus(lead.estimatedMonthlyBill),
    propertyRelationship: (lead as any).propertyRelationship || 'unknown',
    landlordName: (lead as any).landlordName,
    landlordContact: (lead as any).landlordContact,
    authorizationStatus: (lead as any).authorizationStatus,
    roofCondition: (lead as any).roofCondition || 'unknown',
    roofAge: (lead as any).roofAge || 'unknown',
    roofAgeYears: (lead as any).roofAgeYears,
    lastRoofInspection: (lead as any).lastRoofInspection,
    plannedRoofWork: (lead as any).plannedRoofWork,
    decisionAuthority: (lead as any).decisionAuthority || 'unknown',
    decisionMakerName: (lead as any).decisionMakerName,
    decisionMakerTitle: (lead as any).decisionMakerTitle,
    budgetReadiness: (lead as any).budgetReadiness || 'unknown',
    timelineUrgency: (lead as any).timelineUrgency || 'unknown',
    targetDecisionDate: (lead as any).targetDecisionDate,
    qualificationNotes: (lead as any).qualificationNotes,
  };

  // Calculate current qualification
  const result = calculateQualification(qualificationData);

  res.json({
    lead: {
      id: lead.id,
      companyName: lead.companyName,
      contactName: lead.contactName,
      email: lead.email,
      estimatedMonthlyBill: lead.estimatedMonthlyBill,
    },
    qualificationData,
    result,
    savedResult: {
      score: (lead as any).qualificationScore,
      status: (lead as any).qualificationStatus,
      blockers: (lead as any).qualificationBlockers,
      nextSteps: (lead as any).qualificationNextSteps,
      qualifiedAt: (lead as any).qualifiedAt,
      qualifiedBy: (lead as any).qualifiedBy,
    },
  });
}));

/**
 * Update qualification data for a lead
 */
router.put("/api/leads/:id/qualification", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params;

  // Validate request body with Zod schema
  const parseResult = qualificationFormSchema.safeParse(req.body);
  if (!parseResult.success) {
    throw new BadRequestError("Invalid qualification data", parseResult.error.errors);
  }
  const formData = parseResult.data;

  const lead = await storage.getLead(id);
  if (!lead) {
    throw new NotFoundError("Lead");
  }

  // Calculate economic status from bill
  const economicStatus = calculateEconomicStatus(formData.estimatedMonthlyBill);

  // Build qualification data
  const qualificationData: QualificationData = {
    estimatedMonthlyBill: formData.estimatedMonthlyBill,
    economicStatus,
    propertyRelationship: formData.propertyRelationship,
    landlordName: formData.landlordName,
    landlordContact: formData.landlordEmail || formData.landlordPhone,
    roofCondition: formData.roofCondition,
    roofAge: formData.roofAge,
    roofAgeYears: formData.roofAgeYearsApprox,
    plannedRoofWork: formData.plannedRoofWorkNext5Years ? formData.plannedRoofWorkDescription : undefined,
    decisionAuthority: formData.contactIsDecisionMaker ? 'decision_maker' :
      (formData.decisionMakerName ? 'influencer' : 'unknown'),
    decisionMakerName: formData.decisionMakerName,
    decisionMakerTitle: formData.decisionMakerTitle,
    budgetReadiness: formData.budgetReadiness,
    timelineUrgency: formData.timelineUrgency,
  };

  // Calculate qualification result
  const result = calculateQualification(qualificationData);

  // Compute lead color classification
  const { color: leadColor, reason: leadColorReason } = computeLeadColor(result);

  // Update lead with qualification data
  const updatedLead = await storage.updateLead(id, {
    estimatedMonthlyBill: formData.estimatedMonthlyBill,
    economicStatus,
    propertyRelationship: formData.propertyRelationship,
    landlordName: formData.landlordName,
    landlordContact: formData.landlordEmail || formData.landlordPhone,
    roofCondition: formData.roofCondition,
    roofAge: formData.roofAge,
    roofAgeYears: formData.roofAgeYearsApprox,
    plannedRoofWork: formData.plannedRoofWorkNext5Years ? formData.plannedRoofWorkDescription : undefined,
    decisionAuthority: formData.contactIsDecisionMaker ? 'decision_maker' :
      (formData.decisionMakerName ? 'influencer' : 'unknown'),
    decisionMakerName: formData.decisionMakerName,
    decisionMakerTitle: formData.decisionMakerTitle,
    budgetReadiness: formData.budgetReadiness,
    timelineUrgency: formData.timelineUrgency,
    qualificationScore: result.score,
    qualificationStatus: result.status,
    qualificationBlockers: result.blockers,
    qualificationNextSteps: result.suggestedNextSteps,
    leadColor,
    leadColorReason,
    qualifiedAt: new Date(),
    qualifiedBy: req.userId,
  } as any);

  // Update lead status if appropriate
  if (result.status === 'hot' || result.status === 'warm') {
    await storage.updateLead(id, { status: 'qualified' });
  } else if (result.status === 'disqualified') {
    await storage.updateLead(id, { status: 'disqualified' });
  }

  res.json({
    success: true,
    lead: updatedLead,
    result,
  });
}));

/**
 * Get solution resources
 */
router.get("/api/qualification/solutions", authMiddleware, requireStaff, asyncHandler(async (req: AuthRequest, res) => {
  const { SOLUTION_RESOURCES } = await import("@shared/qualification");
  res.json(SOLUTION_RESOURCES);
}));

export default router;

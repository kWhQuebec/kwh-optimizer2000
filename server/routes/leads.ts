import express, { type Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authMiddleware, requireStaff, type AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import { insertLeadSchema } from "@shared/schema";
import { sendQuickAnalysisEmail, sendProcurationCompletedNotification, sendNewLeadNotification } from "../emailService";
import { sendEmail } from "../gmail";
import * as googleSolar from "../googleSolarService";
import { generateProcurationPDF, createProcurationData } from "../procurationPdfGenerator";
import { parseHQBill, type HQBillData } from "../hqBillParser";
import { getTieredSolarCostPerW, BASELINE_YIELD, QUEBEC_MONTHLY_TEMPS } from "../analysis/potentialAnalysis";
import { objectStorageClient } from "../replit_integrations/object_storage";
import { createLogger } from "../lib/logger";

const log = createLogger("Leads");

const router = express.Router();

const upload = multer({ 
  dest: "uploads/",
  limits: {
    files: 200,
    fileSize: 50 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'text/csv',
      'application/vnd.ms-excel',
    ];
    if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

// ==================== LEAD ROUTES (PUBLIC) ====================

// Quick estimate endpoint for landing page calculator (no auth required)
// Consumption-based sizing with 3 offset scenarios (70%, 85%, 100%)
router.post("/api/quick-estimate", async (req, res) => {
  try {
    const { address, email, clientName, monthlyBill, buildingType, tariffCode, annualConsumptionKwh, roofAgeYears, ownershipType } = req.body;
    
    // Either annualConsumptionKwh or monthlyBill is required
    if (!annualConsumptionKwh && !monthlyBill) {
      return res.status(400).json({ error: "Annual consumption or monthly bill is required" });
    }
    
    // HQ energy rates ($/kWh) - energy portion only
    const HQ_ENERGY_RATES: Record<string, number> = {
      G: 0.11933, // Small power (<65 kW)
      M: 0.06061, // Medium power (65kW-5MW)
      L: 0.03681, // Large power (>5MW)
    };
    
    // Energy portion factor (what % of bill is energy vs demand charges)
    const ENERGY_PORTION_FACTORS: Record<string, number> = {
      G: 0.85, // G tariff: mostly energy
      M: 0.60, // M tariff: significant demand charges
      L: 0.50, // L tariff: high demand charges
    };
    
    // Building type load factors (for seasonal adjustment)
    const BUILDING_FACTORS: Record<string, number> = {
      office: 1.0,
      warehouse: 0.85,
      retail: 1.1,
      industrial: 0.9,
      healthcare: 1.15,
      education: 0.95,
    };
    
    // Use provided tariff or default to M (medium power)
    const tariff = tariffCode || "M";
    const energyRate = HQ_ENERGY_RATES[tariff] || 0.06061;
    const energyPortion = ENERGY_PORTION_FACTORS[tariff] || 0.60;
    const buildingFactor = BUILDING_FACTORS[buildingType] || 1.0;
    
    // Calculate annual consumption - prefer direct input over bill estimation
    let annualKWh: number;
    let monthlyKWh: number;
    let estimatedMonthlyBill = monthlyBill || 0;
    
    if (annualConsumptionKwh && annualConsumptionKwh > 0) {
      // Direct annual consumption provided (from bill parsing or manual entry)
      annualKWh = annualConsumptionKwh;
      monthlyKWh = annualKWh / 12;
      // Estimate monthly bill if not provided
      if (!monthlyBill) {
        estimatedMonthlyBill = Math.round((annualKWh * energyRate) / energyPortion / 12);
      }
    } else {
      // Calculate from monthly bill
      const monthlyEnergyBill = monthlyBill * energyPortion;
      monthlyKWh = monthlyEnergyBill / energyRate;
      annualKWh = monthlyKWh * 12 * buildingFactor;
    }
    
    // ============================================================
    // UNIFIED METHODOLOGY - Matches Detailed Analysis (potentialAnalysis.ts)
    // ============================================================
    
    // Solar yield: 1150 kWh/kWp (Quebec baseline from detailed analysis)
    // This is the SAME constant used in potentialAnalysis.ts
    const SOLAR_YIELD = BASELINE_YIELD; // 1150 kWh/kWp
    
    // System losses (simplified annual average, matching detailed analysis)
    // - Temperature coefficient: -0.4%/°C above 25°C STC
    // - Quebec annual average cell temp ~35°C (ambient + cell rise)
    // - Wire losses: ~2%
    // - Inverter efficiency: ~96%
    const TEMP_COEFF = -0.004; // -0.4%/°C
    const AVERAGE_CELL_TEMP = 35; // °C (annual average including cell rise)
    const STC_CELL_TEMP = 25; // °C
    const WIRE_LOSS_PERCENT = 0.02;
    const INVERTER_EFFICIENCY = 0.96;
    
    // Combined system efficiency factor
    const tempLossFactor = 1 + TEMP_COEFF * (AVERAGE_CELL_TEMP - STC_CELL_TEMP); // ~0.96
    const systemEfficiency = tempLossFactor * (1 - WIRE_LOSS_PERCENT) * INVERTER_EFFICIENCY; // ~0.90
    
    // Effective yield after all losses
    const EFFECTIVE_YIELD = SOLAR_YIELD * systemEfficiency; // ~1035 kWh/kWp
    
    // Cost per watt: Use tiered pricing from detailed analysis
    // This will be calculated per scenario based on system size
    
    // Hydro-Québec Autoproduction incentive: $1000/kW, max 40% of CAPEX, limited to 1 MW
    const HQ_INCENTIVE_PER_KW = 1000;
    const HQ_INCENTIVE_MAX_PERCENT = 0.40;
    const HQ_MW_LIMIT = 1000; // Only first 1000 kW eligible for Net Metering
    
    // Federal Investment Tax Credit (ITC): 30% of eligible project cost
    // For simplicity, applied to gross CAPEX (before HQ subsidy) as per CRA guidelines
    // In practice, interaction with provincial grants can reduce eligible base
    const FEDERAL_ITC_RATE = 0.30;
    
    // System lifetime for LCOE calculation
    const SYSTEM_LIFETIME_YEARS = 25;
    const DEGRADATION_FACTOR = 0.94; // Average over 25 years with 0.5%/year degradation
    
    // Helper function to calculate scenario metrics
    const calculateScenario = (offsetPercent: number) => {
      // Size based on target offset using effective (post-loss) yield
      const systemSizeKW = Math.max(10, Math.round((annualKWh * offsetPercent) / EFFECTIVE_YIELD));
      
      // Production calculation matches detailed analysis methodology
      const annualProductionKWh = Math.round(systemSizeKW * EFFECTIVE_YIELD);
      const annualSavings = Math.round(annualProductionKWh * energyRate);
      
      // Tiered pricing from detailed analysis (getTieredSolarCostPerW)
      const costPerW = getTieredSolarCostPerW(systemSizeKW);
      const grossCAPEX = systemSizeKW * costPerW * 1000; // costPerW is $/W, convert to $/kW
      
      // Hydro-Québec incentive: $1000/kW for first 1MW, capped at 40% of CAPEX
      const eligibleKW = Math.min(systemSizeKW, HQ_MW_LIMIT);
      const hqIncentiveRaw = eligibleKW * HQ_INCENTIVE_PER_KW;
      const hqIncentive = Math.min(hqIncentiveRaw, grossCAPEX * HQ_INCENTIVE_MAX_PERCENT);
      
      // Federal ITC: 30% of gross CAPEX (before provincial subsidies)
      const federalITC = Math.round(grossCAPEX * FEDERAL_ITC_RATE);
      
      // Total direct incentives
      const totalIncentives = hqIncentive + federalITC;
      
      // Net CAPEX after direct incentives
      const netCAPEX = grossCAPEX - totalIncentives;
      
      // Simple payback based on net cost after direct incentives
      const paybackYears = annualSavings > 0 ? Math.round((netCAPEX / annualSavings) * 10) / 10 : 99;
      
      // LCOE calculation (25-year lifetime with degradation)
      const lifetimeProductionKWh = annualProductionKWh * SYSTEM_LIFETIME_YEARS * DEGRADATION_FACTOR;
      const lcoePerKWh = lifetimeProductionKWh > 0 ? netCAPEX / lifetimeProductionKWh : 0;
      
      // LCOE savings vs HQ rate (percentage cheaper than grid)
      const lcoeSavingsPercent = energyRate > 0 
        ? Math.round(((energyRate - lcoePerKWh) / energyRate) * 100) 
        : 0;
      
      // Check if system exceeds Net Metering limit (1 MW)
      const exceedsNetMeteringLimit = systemSizeKW > HQ_MW_LIMIT;
      
      return {
        offsetPercent,
        systemSizeKW,
        annualProductionKWh,
        annualSavings,
        grossCAPEX: Math.round(grossCAPEX),
        hqIncentive: Math.round(hqIncentive),
        federalITC,
        totalIncentives: Math.round(totalIncentives),
        netCAPEX: Math.round(netCAPEX),
        paybackYears,
        lcoePerKWh: Math.round(lcoePerKWh * 1000) / 1000,
        lcoeSavingsPercent,
        exceedsNetMeteringLimit,
      };
    };
    
    // DYNAMIC OPTIMIZATION: Calculate scenarios from 20% to 120% in 10% increments
    // Use integer math to avoid floating-point precision issues
    // Range 20-120 ensures we hit 100% exactly (20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120)
    const allScenarios = [];
    for (let pctInt = 20; pctInt <= 120; pctInt += 10) {
      allScenarios.push(calculateScenario(pctInt / 100));
    }
    
    // Find best payback scenario (shortest payback period)
    const bestPaybackScenario = [...allScenarios].sort((a, b) => a.paybackYears - b.paybackYears)[0];
    
    // Find best LCOE scenario (lowest cost per kWh)
    const bestLcoeScenario = [...allScenarios].sort((a, b) => a.lcoePerKWh - b.lcoePerKWh)[0];
    
    // Maximum scenario (100% offset)
    const maximumScenario = allScenarios.find(s => Math.abs(s.offsetPercent - 1.0) < 0.01)!;
    
    // Build final 3 scenarios with proper keys and deduplication
    // Strategy: 100% ALWAYS appears with key "maximum", plus best payback and one other option
    const buildCalculatedScenarios = () => {
      const scenarios: Array<{
        key: string;
        offsetPercent: number;
        recommended: boolean;
        systemSizeKW: number;
        annualProductionKWh: number;
        annualSavings: number;
        grossCAPEX: number;
        hqIncentive: number;
        federalITC: number;
        totalIncentives: number;
        netCAPEX: number;
        paybackYears: number;
        lcoePerKWh: number;
        lcoeSavingsPercent: number;
        exceedsNetMeteringLimit: boolean;
      }> = [];
      
      const usedOffsets = new Set<number>();
      
      // Helper to check if offset is already used (within 5% tolerance)
      const isOffsetUsed = (pct: number) => {
        for (const used of usedOffsets) {
          if (Math.abs(used - pct) < 0.05) return true;
        }
        return false;
      };
      
      // Check if best payback is at 100%
      const bestPaybackIs100 = Math.abs(bestPaybackScenario.offsetPercent - 1.0) < 0.05;
      
      // Slot 1: 100% Maximum - ALWAYS included with key "maximum"
      // If best payback is at 100%, this also gets the "recommended" badge
      scenarios.push({
        key: "maximum",
        ...maximumScenario,
        recommended: bestPaybackIs100, // Recommended only if 100% is also the best payback
      });
      usedOffsets.add(1.0);
      
      // Slot 2: Best Payback (if not 100%)
      if (!bestPaybackIs100) {
        scenarios.push({
          key: "bestPayback",
          ...bestPaybackScenario,
          recommended: true, // Recommended when it's a different % than 100%
        });
        usedOffsets.add(bestPaybackScenario.offsetPercent);
      }
      
      // Slot 3: Best LCOE if different, or an intermediate option
      if (!isOffsetUsed(bestLcoeScenario.offsetPercent)) {
        scenarios.push({
          key: "bestLcoe",
          ...bestLcoeScenario,
          recommended: false,
        });
        usedOffsets.add(bestLcoeScenario.offsetPercent);
      }
      
      // If we still need more scenarios (didn't reach 3), add intermediate options
      if (scenarios.length < 3) {
        const alternateScenario = 
          allScenarios.find(s => Math.abs(s.offsetPercent - 0.75) < 0.01 && !isOffsetUsed(s.offsetPercent)) ||
          allScenarios.find(s => Math.abs(s.offsetPercent - 0.50) < 0.01 && !isOffsetUsed(s.offsetPercent)) ||
          allScenarios.find(s => Math.abs(s.offsetPercent - 0.65) < 0.01 && !isOffsetUsed(s.offsetPercent)) ||
          allScenarios.find(s => !isOffsetUsed(s.offsetPercent));
        
        if (alternateScenario) {
          scenarios.push({
            key: "optimal",
            ...alternateScenario,
            recommended: false,
          });
        }
      }
      
      // Sort by offset percent for consistent display order (lowest to highest)
      return scenarios.sort((a, b) => a.offsetPercent - b.offsetPercent);
    };
    
    const calculatedScenarios = buildCalculatedScenarios();
    
    // Primary scenario is the recommended one (best payback)
    const primaryScenario = calculatedScenarios.find(s => s.recommended) || calculatedScenarios[0];
    
    log.info(`Consumption: ${Math.round(annualKWh)} kWh/yr, Dynamic optimization: Best Payback @ ${Math.round(bestPaybackScenario.offsetPercent * 100)}%, Best LCOE @ ${Math.round(bestLcoeScenario.offsetPercent * 100)}%`);
    
    // Storage (Battery) Recommendation
    // Storage is most valuable for:
    // 1. Tariff M/L clients (demand charges make peak shaving valuable)
    // 2. Large systems (>100 kW) that generate excess daytime production
    // 3. Buildings with evening/weekend consumption patterns
    const hasDemandCharges = tariff === 'M' || tariff === 'L';
    const isLargeSystem = primaryScenario.systemSizeKW >= 100;
    const estimatedPeakDemandKW = Math.round(annualKWh / (8760 * 0.3)); // Estimated peak from load factor
    
    // Recommend storage if demand charges exist or system is large enough to benefit
    const storageRecommended = hasDemandCharges || isLargeSystem;
    
    // Sizing: Battery power = 20-30% of solar system size for peak shaving
    // Battery energy = 2-4 hours of storage at rated power
    const recommendedBatteryPowerKW = storageRecommended 
      ? Math.round(primaryScenario.systemSizeKW * 0.25) 
      : 0;
    const recommendedBatteryEnergyKWh = recommendedBatteryPowerKW * 3; // 3 hours storage
    
    // Estimated additional savings from peak shaving (for M/L tariffs)
    // HQ Rate M demand charge: ~$17.57/kW/month = ~$210/kW/year
    const demandChargeRate = tariff === 'M' ? 17.573 : (tariff === 'L' ? 14.521 : 0);
    const estimatedDemandSavings = hasDemandCharges 
      ? Math.round(recommendedBatteryPowerKW * demandChargeRate * 12 * 0.5) // Assume 50% peak reduction
      : 0;
    
    // Storage CAPEX estimate: ~$500/kWh (installed)
    const storageCAPEX = recommendedBatteryEnergyKWh * 500;
    
    const storageRecommendation = {
      recommended: storageRecommended,
      reason: hasDemandCharges 
        ? (tariff === 'M' ? 'demand_charges_m' : 'demand_charges_l')
        : (isLargeSystem ? 'large_system' : 'not_applicable'),
      batteryPowerKW: recommendedBatteryPowerKW,
      batteryEnergyKWh: recommendedBatteryEnergyKWh,
      estimatedCost: storageCAPEX,
      estimatedAnnualSavings: estimatedDemandSavings,
      paybackYears: estimatedDemandSavings > 0 ? Math.round((storageCAPEX / estimatedDemandSavings) * 10) / 10 : 0,
      tariffHasDemandCharges: hasDemandCharges,
    };
    
    // CO2 reduction (based on conservative scenario)
    const co2ReductionTons = Math.round(primaryScenario.annualProductionKWh * 0.0012 * 10) / 10;
    
    // Calculate before/after HQ bill comparison (based on conservative scenario)
    const annualBillBefore = estimatedMonthlyBill * 12;
    const annualBillAfter = Math.max(0, annualBillBefore - primaryScenario.annualSavings);
    const monthlyBillAfter = Math.round(annualBillAfter / 12);
    const monthlySavings = estimatedMonthlyBill - monthlyBillAfter;
    
    // Send email if email is provided
    let emailSent = false;
    if (email && typeof email === "string" && email.includes("@")) {
      const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
      const host = req.get("host") || "localhost:5000";
      const baseUrl = `${protocol}://${host}`;
      
      sendQuickAnalysisEmail(email, {
        address: address || "",
        annualConsumptionKWh: annualKWh,
        monthlyBill: estimatedMonthlyBill,
        buildingType: buildingType || "office",
        tariffCode: tariff,
        scenarios: calculatedScenarios.map(s => ({
          key: s.key,
          offsetPercent: s.offsetPercent,
          systemSizeKW: s.systemSizeKW,
          annualProductionKWh: s.annualProductionKWh,
          annualSavings: s.annualSavings,
          paybackYears: s.paybackYears,
          hqIncentive: s.hqIncentive,
          federalITC: s.federalITC,
          totalIncentives: s.totalIncentives,
          grossCAPEX: s.grossCAPEX,
          netCAPEX: s.netCAPEX,
          lcoePerKWh: s.lcoePerKWh,
          lcoeSavingsPercent: s.lcoeSavingsPercent,
          recommended: s.recommended,
        })),
        monthlyBillBefore: estimatedMonthlyBill,
        hasRoofData: false,
        roofAreaM2: undefined,
      }, baseUrl).catch(err => {
        log.error("Email sending failed:", err);
      });
      emailSent = true;
    }
    
    // Create lead, client, site, and opportunity for CRM tracking
    let leadId: string | null = null;
    let clientId: string | null = null;
    let siteId: string | null = null;
    try {
      // Create lead with available information - use fallbacks for required fields
      const companyName = clientName || (address ? `Quick Estimate - ${address}` : `Quick Estimate - ${email || 'Anonymous'}`);
      const contactName = clientName || email || 'Quick Estimate Lead';
      const leadEmail = email || 'quick-estimate@placeholder.local';
      
      const lead = await storage.createLead({
        companyName,
        contactName,
        email: leadEmail,
        phone: null,
        streetAddress: address || null,
        city: null,
        province: "Québec",
        postalCode: null,
        estimatedMonthlyBill: estimatedMonthlyBill || null,
        buildingType: buildingType || "office",
        notes: `Quick Estimate: ${Math.round(annualKWh).toLocaleString()} kWh/year, ${primaryScenario.systemSizeKW} kW system, ${tariff} tariff`,
        source: "quick_estimate",
        // Add qualification fields to lead
        roofAge: roofAgeYears ? (roofAgeYears <= 5 ? 'new' : roofAgeYears <= 10 ? 'recent' : roofAgeYears <= 15 ? 'mature' : 'old') : 'unknown',
        roofAgeYears: roofAgeYears || null,
        propertyRelationship: ownershipType === 'owner' ? 'owner' : ownershipType === 'tenant' ? 'tenant_pending' : 'unknown',
      });
      leadId = lead.id;
      
      // Create client for CRM management
      const client = await storage.createClient({
        name: companyName,
        mainContactName: contactName,
        email: leadEmail !== 'quick-estimate@placeholder.local' ? leadEmail : null,
        phone: null,
        address: address || null,
        city: null,
        province: "Québec",
        postalCode: null,
        notes: `Auto-created from Quick Estimate`,
      });
      clientId = client.id;
      
      // Create site with address and qualification fields
      const site = await storage.createSite({
        clientId: client.id,
        name: address || `Site - ${companyName}`,
        address: address || null,
        city: null,
        province: "Québec",
        postalCode: null,
        buildingType: buildingType || "commercial",
        roofAgeYears: roofAgeYears || null,
        ownershipType: ownershipType || null,
        quickAnalysisSystemSizeKw: primaryScenario.systemSizeKW,
        quickAnalysisAnnualProductionKwh: primaryScenario.annualProductionKWh,
        quickAnalysisAnnualSavings: primaryScenario.annualSavings,
        quickAnalysisPaybackYears: primaryScenario.paybackYears,
        quickAnalysisGrossCapex: primaryScenario.grossCAPEX,
        quickAnalysisNetCapex: primaryScenario.netCAPEX,
        quickAnalysisHqIncentive: primaryScenario.hqIncentive,
        quickAnalysisMonthlyBill: estimatedMonthlyBill || null,
        quickAnalysisCompletedAt: new Date(),
      });
      siteId = site.id;
      
      // Auto-create opportunity linked to client and site
      const opportunityName = clientName || address || email || 'Quick Estimate Lead';
      await storage.createOpportunity({
        name: opportunityName,
        description: `Auto-created from Quick Estimate. ${Math.round(annualKWh).toLocaleString()} kWh/year, ${primaryScenario.systemSizeKW} kW potential.`,
        leadId: lead.id,
        clientId: client.id,
        siteId: site.id,
        stage: 'prospect', // Start as prospect for nurturing
        probability: 5,
        source: 'quick_estimate',
        estimatedValue: primaryScenario.netCAPEX || null,
        expectedCloseDate: null,
        ownerId: null,
      });
      log.info(`Created lead ${lead.id}, client ${client.id}, site ${site.id}, and opportunity for: ${companyName}`);
      
      // Send notification to Account Manager about new lead (only if email was provided - real lead)
      if (email && typeof email === "string" && email.includes("@")) {
        sendNewLeadNotification(
          'malabarre@kwh.quebec',
          {
            companyName,
            contactName,
            email,
            address: address || undefined,
            annualConsumptionKWh: annualKWh,
            estimatedMonthlyBill: estimatedMonthlyBill || undefined,
            buildingType: buildingType || undefined,
            formType: 'quick_estimate',
            roofAgeYears: roofAgeYears || undefined,
            ownershipType: ownershipType || undefined,
          },
          'fr'
        ).catch(err => {
          log.error("Failed to send manager notification:", err);
        });
      }
    } catch (leadErr) {
      log.error("Lead creation failed (non-blocking):", leadErr);
      // Continue - lead creation failure should not block the estimate response
    }
    
    res.json({
      success: true,
      emailSent,
      leadId,
      clientId,
      siteId,
      inputs: {
        address: address || null,
        monthlyBill: estimatedMonthlyBill,
        annualConsumptionKwh: Math.round(annualKWh),
        buildingType: buildingType || "office",
        tariffCode: tariff,
      },
      consumption: {
        annualKWh: Math.round(annualKWh),
        monthlyKWh: Math.round(monthlyKWh),
      },
      scenarios: calculatedScenarios,
      system: {
        sizeKW: primaryScenario.systemSizeKW,
        annualProductionKWh: primaryScenario.annualProductionKWh,
        selfConsumptionRate: 0.70,
      },
      financial: {
        annualSavings: primaryScenario.annualSavings,
        grossCAPEX: primaryScenario.grossCAPEX,
        hqIncentive: primaryScenario.hqIncentive,
        federalITC: primaryScenario.federalITC,
        totalIncentives: primaryScenario.totalIncentives,
        netCAPEX: primaryScenario.netCAPEX,
        paybackYears: primaryScenario.paybackYears,
      },
      billing: {
        monthlyBillBefore: estimatedMonthlyBill,
        monthlyBillAfter,
        monthlySavings,
        annualBillBefore,
        annualBillAfter: Math.round(annualBillAfter),
        annualSavings: primaryScenario.annualSavings,
      },
      environmental: {
        co2ReductionTons,
      },
      storage: storageRecommendation,
      warnings: calculatedScenarios.some(s => s.exceedsNetMeteringLimit) ? [{
        type: 'net_metering_limit',
        message: {
          fr: "Un ou plusieurs scénarios dépassent 1 MW. Le programme de mesurage net d'Hydro-Québec est limité aux systèmes de 1 MW et moins. Les projets plus grands nécessitent une entente d'autoproduction ou un contrat spécial avec Hydro-Québec.",
          en: "One or more scenarios exceed 1 MW. Hydro-Québec's net metering program is limited to systems of 1 MW or less. Larger projects require a self-generation agreement or special contract with Hydro-Québec."
        }
      }] : [],
    });
  } catch (error) {
    log.error("Quick estimate error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Detailed analysis request with procuration and file uploads
router.post("/api/detailed-analysis-request", upload.any(), async (req, res) => {
  try {
    const {
      companyName,
      firstName,
      lastName,
      email,
      phone,
      streetAddress,
      city,
      province,
      postalCode,
      estimatedMonthlyBill,
      buildingType,
      roofAgeYears,
      ownershipType,
      tariffCode,
      hqClientNumber,
      notes,
      procurationAccepted,
      procurationDate,
      language,
      clientId, // If provided, this is an existing CRM client - skip Lead/Opportunity creation
    } = req.body;

    const contactName = `${firstName || ''} ${lastName || ''}`.trim();
    const formattedSignerName = `${lastName || ''}, ${firstName || ''}`.trim().replace(/^,\s*/, '').replace(/,\s*$/, '');
    const isExistingClient = !!clientId;
    let createdOpportunityId: string | null = null;

    if (!companyName || !firstName || !lastName || !email || !streetAddress || !city) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (procurationAccepted !== 'true') {
      return res.status(400).json({ error: "Procuration must be accepted" });
    }

    const files = req.files as Express.Multer.File[];
    const savedBillPath = req.body.savedBillPath as string | undefined;
    
    // Accept if: files uploaded OR savedBillPath provided OR hqClientNumber exists (bill was already parsed and saved)
    const hasFiles = files && files.length > 0;
    const hasSavedPath = !!savedBillPath;
    const hasParsedBillData = !!(hqClientNumber && hqClientNumber.length > 5);
    
    if (!hasFiles && !hasSavedPath && !hasParsedBillData) {
      return res.status(400).json({ error: "At least one Hydro-Québec bill file is required" });
    }

    // Verify existing client if clientId is provided
    let existingClient = null;
    if (isExistingClient) {
      existingClient = await storage.getClient(clientId);
      if (!existingClient) {
        return res.status(404).json({ error: "Client not found" });
      }
      log.info(`Existing client submission for: ${existingClient.name} (${clientId})`);
    }

    const procurationInfo = language === 'fr'
      ? `[PROCURATION SIGNÉE] Acceptée le ${new Date(procurationDate).toLocaleString('fr-CA')} par ${contactName}`
      : `[AUTHORIZATION SIGNED] Accepted on ${new Date(procurationDate).toLocaleString('en-CA')} by ${contactName}`;
    
    const fileInfo = files && files.length > 0 
      ? files.map((f, i) => `Fichier ${i + 1}: ${f.originalname}`).join('\n')
      : savedBillPath 
        ? `Facture pré-téléversée: ${savedBillPath.split('/').pop()}`
        : hasParsedBillData
          ? `Facture déjà analysée (No client HQ: ${hqClientNumber})`
          : '';
    
    const combinedNotes = [
      '[Analyse Détaillée avec Procuration]',
      procurationInfo,
      '',
      `No de client HQ: ${hqClientNumber || 'Non fourni'}`,
      tariffCode ? `Tarif HQ: ${tariffCode}` : '',
      '',
      'Factures téléversées:',
      fileInfo,
      '',
      notes || ''
    ].filter(Boolean).join('\n').trim();

    let lead = null;
    
    // Only create Lead/Opportunity for NEW website visitors (no clientId)
    if (!isExistingClient) {
      const leadData = {
        companyName,
        contactName,
        email,
        phone: phone || null,
        streetAddress,
        city,
        province: province || 'Québec',
        postalCode: postalCode || null,
        estimatedMonthlyBill: estimatedMonthlyBill ? parseFloat(estimatedMonthlyBill) : null,
        buildingType: buildingType || null,
        roofAge: roofAgeYears ? (parseInt(roofAgeYears) <= 5 ? 'new' : parseInt(roofAgeYears) <= 10 ? 'recent' : parseInt(roofAgeYears) <= 15 ? 'mature' : 'old') : 'unknown',
        roofAgeYears: roofAgeYears ? parseInt(roofAgeYears) : null,
        propertyRelationship: ownershipType === 'owner' ? 'owner' : ownershipType === 'tenant' ? 'tenant_pending' : 'unknown',
        notes: combinedNotes,
        source: 'detailed-analysis-form',
        status: 'qualified',
      };

      const parsed = insertLeadSchema.safeParse(leadData);
      if (!parsed.success) {
        log.error("Validation error:", parsed.error.errors);
        return res.status(400).json({ error: parsed.error.errors });
      }

      lead = await storage.createLead(parsed.data);
      
      // Auto-create opportunity when lead is submitted
      try {
        const opportunityName = `${companyName} - ${streetAddress || city || 'Solar Project'}`;
        const newOpportunity = await storage.createOpportunity({
          name: opportunityName,
          description: `Auto-created from detailed analysis request. Contact: ${contactName}`,
          leadId: lead.id,
          stage: 'qualified', // Detailed analysis = qualified (has procuration)
          probability: 15,
          source: 'website',
          estimatedValue: null,
          expectedCloseDate: null,
          ownerId: null,
        });
        createdOpportunityId = newOpportunity.id;
        log.info(`Auto-created opportunity ${createdOpportunityId} for lead: ${lead.id}`);
      } catch (oppError) {
        log.error(`Failed to auto-create opportunity:`, oppError);
      }
      
      // Note: Lead notification is now combined with procuration email below
    } else {
      log.info(`Skipping Lead/Opportunity creation - existing client: ${clientId}`);
    }

    // Use lead.id for new leads, or clientId for existing clients
    const referenceId = lead?.id || clientId;

    const uploadDir = path.join('uploads', 'bills', referenceId);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    let firstBillPath: string | undefined;
    
    // Process newly uploaded files
    if (files && files.length > 0) {
      for (const file of files) {
        const destPath = path.join(uploadDir, file.originalname);
        fs.renameSync(file.path, destPath);
        if (!firstBillPath) {
          firstBillPath = destPath;
        }
      }
    } else if (savedBillPath) {
      // Use the pre-saved bill path from AI parsing
      firstBillPath = savedBillPath;
      log.info(`Using pre-saved bill path: ${savedBillPath}`);
    }
    
    // Save the HQ bill path to the lead record so it appears in the CRM
    if (firstBillPath && lead) {
      try {
        await storage.updateLead(lead.id, { 
          hqBillPath: firstBillPath,
          hqBillUploadedAt: new Date()
        });
        log.info(`HQ bill path saved to lead: ${firstBillPath}`);
      } catch (billError) {
        log.error("Failed to save HQ bill path:", billError);
      }
    }

    const signatureImage = req.body.signatureImage;
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    try {
      await storage.createProcurationSignature({
        signerName: contactName,
        signerEmail: email,
        signerTitle: req.body.signerTitle || null,
        signatureCity: req.body.signatureCity || city || null,
        companyName: companyName,
        hqAccountNumber: hqClientNumber || null,
        leadId: lead?.id || null,
        clientId: isExistingClient ? clientId : null,
        status: 'signed',
        signedAt: new Date(),
        language: language === 'en' ? 'en' : 'fr',
        ipAddress: clientIp,
        userAgent: userAgent,
      });
      log.info(`Procuration signature recorded for ${isExistingClient ? 'client' : 'lead'}: ${referenceId}`);
      
      if (signatureImage && typeof signatureImage === 'string') {
        const isValidFormat = signatureImage.startsWith('data:image/png;base64,');
        const base64Data = signatureImage.replace(/^data:image\/\w+;base64,/, '');
        const sizeInBytes = Buffer.from(base64Data, 'base64').length;
        const maxSizeBytes = 500 * 1024;
        
        if (isValidFormat && sizeInBytes <= maxSizeBytes) {
          const signatureDir = path.join('uploads', 'signatures');
          if (!fs.existsSync(signatureDir)) {
            fs.mkdirSync(signatureDir, { recursive: true });
          }
          const signaturePath = path.join(signatureDir, `${referenceId}_signature.png`);
          fs.writeFileSync(signaturePath, Buffer.from(base64Data, 'base64'));
          log.info(`Signature image saved: ${signaturePath} (${Math.round(sizeInBytes / 1024)}KB)`);
        } else {
          log.warn(`Invalid signature format or size: format=${isValidFormat}, size=${Math.round(sizeInBytes / 1024)}KB`);
        }
      }
    } catch (sigError) {
      log.error("Failed to create signature record:", sigError);
    }

    try {
      const procurationData = createProcurationData(
        {
          companyName,
          contactName: formattedSignerName,
          signerTitle: req.body.signerTitle || '',
          hqAccountNumber: hqClientNumber || '',
          streetAddress,
          city,
          province: province || 'Québec',
          postalCode: postalCode || '',
          signatureCity: req.body.signatureCity || city || '',
          signatureImage,
          procurationDate,
        },
        clientIp,
        userAgent
      );

      const pdfBuffer = await generateProcurationPDF(procurationData);
      
      const procurationDir = path.join('uploads', 'procurations');
      if (!fs.existsSync(procurationDir)) {
        fs.mkdirSync(procurationDir, { recursive: true });
      }
      const pdfFilename = `procuration_${referenceId}_${Date.now()}.pdf`;
      const pdfPath = path.join(procurationDir, pdfFilename);
      fs.writeFileSync(pdfPath, pdfBuffer);
      log.info(`Procuration PDF saved: ${pdfPath}`);
      
      // Send only to Account Manager
      const staffRecipient = 'malabarre@kwh.quebec';
      const pdfAttachment = {
        filename: `procuration_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        content: pdfBuffer.toString('base64'),
        type: 'application/pdf',
      };
      
      // Build CRM link - use the opportunity if created, otherwise link to pipeline
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : 'https://kwh.quebec';
      const crmLink = createdOpportunityId 
        ? `${baseUrl}/pipeline?opportunityId=${createdOpportunityId}`
        : `${baseUrl}/pipeline`;
      
      // Combined staff email: Lead info + Procuration + CRM link (only one email instead of two)
      const isNewLead = !isExistingClient;
      const emailSubject = isNewLead
        ? `Nouveau Lead + Procuration - ${companyName}`
        : `Procuration HQ - ${companyName} (Client existant)`;
      
      const staffEmailResult = await sendEmail({
        to: staffRecipient,
        subject: emailSubject,
        htmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px;">
            ${isNewLead ? `
              <div style="background: linear-gradient(135deg, #003366 0%, #0066cc 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                <h2 style="margin: 0; font-size: 24px;">🎯 Nouveau Lead</h2>
                <span style="display: inline-block; background: #22c55e; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; margin-top: 8px;">Analyse Détaillée</span>
              </div>
            ` : `
              <div style="background: #003366; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                <h2 style="margin: 0; font-size: 24px;">📋 Procuration Signée</h2>
                <span style="display: inline-block; background: #f59e0b; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; margin-top: 8px;">Client Existant</span>
              </div>
            `}
            
            <div style="border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
              <div style="border-left: 4px solid #003366; padding-left: 16px; margin-bottom: 20px;">
                <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; text-transform: uppercase;">Entreprise / Contact</p>
                <p style="margin: 0; font-size: 18px; font-weight: bold;">${companyName}</p>
                <p style="margin: 4px 0 0 0; color: #374151;">${contactName}${req.body.signerTitle ? ` (${req.body.signerTitle})` : ''}</p>
              </div>
              
              <div style="border-left: 4px solid #e5e7eb; padding-left: 16px; margin-bottom: 16px;">
                <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; text-transform: uppercase;">Courriel</p>
                <p style="margin: 0;"><a href="mailto:${email}" style="color: #0066cc;">${email}</a></p>
              </div>
              
              ${phone ? `
                <div style="border-left: 4px solid #e5e7eb; padding-left: 16px; margin-bottom: 16px;">
                  <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; text-transform: uppercase;">Téléphone</p>
                  <p style="margin: 0;"><a href="tel:${phone}" style="color: #0066cc;">${phone}</a></p>
                </div>
              ` : ''}
              
              <div style="border-left: 4px solid #e5e7eb; padding-left: 16px; margin-bottom: 16px;">
                <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; text-transform: uppercase;">Adresse</p>
                <p style="margin: 0;">${streetAddress}, ${city}${province ? ', ' + province : ''}</p>
              </div>
              
              <div style="display: flex; gap: 24px; margin-bottom: 16px;">
                <div style="border-left: 4px solid #e5e7eb; padding-left: 16px;">
                  <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; text-transform: uppercase;">No client HQ</p>
                  <p style="margin: 0; font-weight: 500;">${hqClientNumber || 'Non fourni'}</p>
                </div>
                ${tariffCode ? `
                  <div style="border-left: 4px solid #e5e7eb; padding-left: 16px;">
                    <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; text-transform: uppercase;">Tarif</p>
                    <p style="margin: 0; font-weight: 500;">${tariffCode}</p>
                  </div>
                ` : ''}
              </div>
              
              <div style="display: flex; gap: 24px; margin-bottom: 20px;">
                <div style="border-left: 4px solid #e5e7eb; padding-left: 16px;">
                  <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; text-transform: uppercase;">Propriétaire?</p>
                  <p style="margin: 0;">${ownershipType === 'owner' ? 'Oui' : ownershipType === 'tenant' ? 'Non (locataire)' : 'Non spécifié'}</p>
                </div>
                <div style="border-left: 4px solid #e5e7eb; padding-left: 16px;">
                  <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; text-transform: uppercase;">Âge toiture</p>
                  <p style="margin: 0;">${roofAgeYears ? roofAgeYears + ' ans' : 'Non spécifié'}</p>
                </div>
              </div>
              
              <div style="background: #f0fdf4; border: 1px solid #22c55e; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                <p style="margin: 0; color: #166534;"><strong>✓ Procuration signée</strong> - PDF en pièce jointe</p>
              </div>
              
              <div style="text-align: center; margin-top: 24px;">
                <a href="${crmLink}" style="display: inline-block; background: #003366; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                  Voir le dossier →
                </a>
              </div>
            </div>
            
            <p style="text-align: center; margin-top: 20px; font-size: 14px; color: #6b7280;">
              <a href="https://kwh.quebec" style="color: #003366; font-weight: 600;">kWh Québec</a> | 514.427.8871 | info@kwh.quebec
            </p>
          </div>
        `,
        textBody: `${isNewLead ? 'Nouveau Lead' : 'Procuration signée'}: ${companyName}\nContact: ${contactName}\nCourriel: ${email}\nNo client HQ: ${hqClientNumber || 'N/A'}\n\nVoir le dossier: ${crmLink}`,
        attachments: [pdfAttachment],
      });
      
      if (staffEmailResult.success) {
        log.info(`Combined notification email sent to staff: ${staffRecipient}`);
      } else {
        log.error(`Failed to send combined notification email to staff:`, staffEmailResult.error);
      }
      
      // Send copy to client who signed
      if (email) {
        const lang = req.body.language === 'en' ? 'en' : 'fr';
        const clientSubject = lang === 'fr' 
          ? `Votre procuration signée - kWh Québec`
          : `Your signed authorization - kWh Québec`;
        const clientHtml = lang === 'fr' ? `
          <p>Bonjour ${formattedSignerName},</p>
          <p>Merci d'avoir signé la procuration nous autorisant à accéder à vos données de consommation Hydro-Québec.</p>
          <p>Veuillez trouver ci-joint une copie de votre procuration signée pour vos dossiers.</p>
          <p>Notre équipe procédera maintenant à l'analyse de votre potentiel solaire et vous contactera prochainement avec les résultats.</p>
          <p>Cordialement,<br>L'équipe kWh Québec<br>514.427.8871 | info@kwh.quebec</p>
        ` : `
          <p>Hello ${formattedSignerName},</p>
          <p>Thank you for signing the authorization allowing us to access your Hydro-Québec consumption data.</p>
          <p>Please find attached a copy of your signed authorization for your records.</p>
          <p>Our team will now proceed with analyzing your solar potential and will contact you shortly with the results.</p>
          <p>Best regards,<br>The kWh Québec Team<br>514.427.8871 | info@kwh.quebec</p>
        `;
        
        const clientEmailResult = await sendEmail({
          to: email,
          subject: clientSubject,
          htmlBody: clientHtml,
          textBody: lang === 'fr' 
            ? `Merci d'avoir signé la procuration. Vous trouverez ci-joint une copie pour vos dossiers.`
            : `Thank you for signing the authorization. Please find attached a copy for your records.`,
          attachments: [pdfAttachment],
        });
        
        if (clientEmailResult.success) {
          log.info(`Procuration copy sent to client: ${email}`);
        } else {
          log.error(`Failed to send procuration copy to client:`, clientEmailResult.error);
        }
      }
      
      // Note: Combined notification (lead info + procuration + CRM link) already sent to info@kwh.quebec above
      // No separate account manager notification needed
    } catch (pdfError) {
      log.error('Error generating/sending procuration PDF:', pdfError);
    }

    // Only trigger roof estimation for new leads (not existing clients)
    if (streetAddress && city && lead) {
      // Use the same data structure as lead creation for roof estimation
      const roofEstimationData = {
        companyName,
        contactName,
        email,
        phone: phone || null,
        streetAddress,
        city,
        province: province || 'Québec',
        postalCode: postalCode || null,
        estimatedMonthlyBill: estimatedMonthlyBill ? parseFloat(estimatedMonthlyBill) : null,
        buildingType: buildingType || null,
        notes: combinedNotes,
        source: 'detailed-analysis-form' as const,
        status: 'qualified' as const,
      };
      triggerRoofEstimation(lead.id, roofEstimationData).catch((err) => {
        log.error(`Roof estimation failed for lead ${lead.id}:`, err);
      });
    }

    const fileCount = files?.length || 0;
    const billSource = fileCount > 0 ? `${fileCount} new file(s)` : (savedBillPath ? 'pre-saved bill' : 'none');
    
    if (isExistingClient) {
      log.info(`Procuration received from existing client: ${clientId}, Bill source: ${billSource}`);
    } else {
      log.info(`Lead created: ${lead?.id}, Bill source: ${billSource}`);
    }
    
    res.status(201).json({ 
      success: true, 
      leadId: lead?.id || null,
      clientId: isExistingClient ? clientId : null,
      filesUploaded: fileCount,
      usedSavedBillPath: !fileCount && !!savedBillPath,
    });
  } catch (error) {
    log.error("Detailed analysis error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/leads", async (req, res) => {
  try {
    const parsed = insertLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }
    
    const lead = await storage.createLead(parsed.data);
    
    // Auto-create opportunity when lead is submitted
    try {
      const opportunityName = `${lead.companyName} - ${lead.streetAddress || lead.city || 'Solar Project'}`;
      await storage.createOpportunity({
        name: opportunityName,
        description: `Auto-created from website lead form. Contact: ${lead.contactName}`,
        leadId: lead.id,
        stage: 'prospect', // Website leads start as prospects
        probability: 5,
        source: 'website',
        estimatedValue: null,
        expectedCloseDate: null,
        ownerId: null,
      });
      log.info(`Auto-created opportunity for lead: ${lead.id}`);
    } catch (oppError) {
      log.error(`Failed to auto-create opportunity:`, oppError);
    }
    
    if (parsed.data.streetAddress && parsed.data.city) {
      triggerRoofEstimation(lead.id, parsed.data).catch((err) => {
        log.error(`Roof estimation failed for lead ${lead.id}:`, err);
      });
    }
    
    res.status(201).json(lead);
  } catch (error) {
    log.error("Create lead error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Background function to estimate roof potential and send email
async function triggerRoofEstimation(leadId: string, data: {
  streetAddress?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  companyName: string;
  contactName: string;
  email: string;
}) {
  try {
    const addressParts = [
      data.streetAddress,
      data.city,
      data.province || "Québec",
      data.postalCode,
      "Canada"
    ].filter(Boolean);
    const fullAddress = addressParts.join(", ");
    
    log.info(`Lead ${leadId}: Starting roof estimation for: ${fullAddress}`);
    
    const roofEstimate = await googleSolar.estimateRoofFromAddress(fullAddress, storage);
    
    if (roofEstimate.success) {
      const utilizationFactor = 0.70;
      const panelDensityWm2 = 185;
      const usableRoofArea = roofEstimate.roofAreaSqM * utilizationFactor;
      const roofPotentialKw = Math.round((usableRoofArea * panelDensityWm2) / 1000 * 10) / 10;
      
      const updatedLead = await storage.updateLead(leadId, {
        status: "roof_estimated",
        latitude: roofEstimate.latitude,
        longitude: roofEstimate.longitude,
        roofAreaSqM: roofEstimate.roofAreaSqM,
        roofPotentialKw: roofPotentialKw,
        estimateCompletedAt: new Date(),
      });
      
      log.info(`Lead ${leadId}: Roof estimate complete: ${roofEstimate.roofAreaSqM.toFixed(0)} m², potential ${roofPotentialKw} kW`);
      
      await sendRoofEstimateEmail(data.email, data.contactName, data.companyName, {
        address: fullAddress,
        roofAreaSqM: roofEstimate.roofAreaSqM,
        roofPotentialKw: roofPotentialKw,
      });
      
    } else {
      await storage.updateLead(leadId, {
        status: "estimate_failed",
        estimateError: roofEstimate.error || "Unknown error",
        estimateCompletedAt: new Date(),
      });
      
      log.warn(`Lead ${leadId}: Roof estimation failed: ${roofEstimate.error}`);
    }
  } catch (error) {
    log.error(`Lead ${leadId}: Error during roof estimation:`, error);
    await storage.updateLead(leadId, {
      status: "estimate_failed",
      estimateError: String(error),
      estimateCompletedAt: new Date(),
    });
  }
}

// Send bilingual roof estimate email
async function sendRoofEstimateEmail(
  toEmail: string,
  contactName: string,
  companyName: string,
  estimate: { address: string; roofAreaSqM: number; roofPotentialKw: number }
) {
  const subject = "Votre potentiel solaire / Your Solar Potential - kWh Québec";
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">kWh Québec</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">Solaire + Stockage | Solar + Storage</p>
      </div>
      
      <div style="padding: 32px; background: #f9fafb;">
        <p style="font-size: 16px; color: #374151;">Bonjour ${contactName},</p>
        
        <p style="font-size: 16px; color: #374151;">
          Merci de votre intérêt pour le solaire! Voici une estimation préliminaire du potentiel solaire 
          pour votre bâtiment situé au:
        </p>
        
        <div style="background: white; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #e5e7eb;">
          <p style="color: #6b7280; margin: 0 0 8px 0; font-size: 14px;">📍 ${estimate.address}</p>
          
          <div style="display: flex; gap: 24px; margin-top: 16px;">
            <div style="flex: 1; text-align: center; padding: 16px; background: #fff7ed; border-radius: 8px;">
              <div style="font-size: 32px; font-weight: bold; color: #ea580c;">${Math.round(estimate.roofAreaSqM)}</div>
              <div style="font-size: 14px; color: #9a3412;">m² de toiture</div>
            </div>
            <div style="flex: 1; text-align: center; padding: 16px; background: #ecfdf5; border-radius: 8px;">
              <div style="font-size: 32px; font-weight: bold; color: #059669;">${estimate.roofPotentialKw}</div>
              <div style="font-size: 14px; color: #047857;">kW potentiel</div>
            </div>
          </div>
        </div>
        
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0;">
          <p style="margin: 0; font-size: 14px; color: #92400e;">
            <strong>Prochaine étape:</strong> Pour une analyse complète avec vos données de consommation réelles, 
            nous devons obtenir un accès à votre historique Hydro-Québec. Un conseiller vous contactera 
            sous peu pour vous accompagner dans cette démarche simple.
          </p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
        
        <p style="font-size: 16px; color: #374151;">Hello ${contactName},</p>
        
        <p style="font-size: 16px; color: #374151;">
          Thank you for your interest in solar! Here is a preliminary estimate of the solar potential 
          for your building located at:
        </p>
        
        <div style="background: white; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #e5e7eb;">
          <p style="color: #6b7280; margin: 0 0 8px 0; font-size: 14px;">📍 ${estimate.address}</p>
          
          <div style="display: flex; gap: 24px; margin-top: 16px;">
            <div style="flex: 1; text-align: center; padding: 16px; background: #fff7ed; border-radius: 8px;">
              <div style="font-size: 32px; font-weight: bold; color: #ea580c;">${Math.round(estimate.roofAreaSqM)}</div>
              <div style="font-size: 14px; color: #9a3412;">m² roof area</div>
            </div>
            <div style="flex: 1; text-align: center; padding: 16px; background: #ecfdf5; border-radius: 8px;">
              <div style="font-size: 32px; font-weight: bold; color: #059669;">${estimate.roofPotentialKw}</div>
              <div style="font-size: 14px; color: #047857;">kW potential</div>
            </div>
          </div>
        </div>
        
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0;">
          <p style="margin: 0; font-size: 14px; color: #92400e;">
            <strong>Next step:</strong> For a complete analysis with your actual consumption data, 
            we need access to your Hydro-Québec history. An advisor will contact you shortly 
            to guide you through this simple process.
          </p>
        </div>
      </div>
      
      <div style="padding: 24px; background: #1f2937; text-align: center;">
        <p style="color: #9ca3af; margin: 0; font-size: 14px;">
          kWh Québec | Solaire + Stockage pour C&I | Solar + Storage for C&I
        </p>
      </div>
    </div>
  `;
  
  try {
    const result = await sendEmail({
      to: toEmail,
      subject,
      htmlBody: htmlContent,
    });
    
    if (result.success) {
      log.info(`Roof estimate sent to ${toEmail}`);
    } else {
      log.error(`Failed to send roof estimate to ${toEmail}:`, result.error);
    }
  } catch (error) {
    log.error(`Error sending roof estimate:`, error);
  }
}

// Staff-only leads access
router.get("/api/leads", authMiddleware, requireStaff, async (req, res) => {
  try {
    const leads = await storage.getLeads();
    res.json(leads);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ==================== DASHBOARD ROUTES ====================

// Staff-only dashboard
router.get("/api/dashboard/stats", authMiddleware, requireStaff, async (req, res) => {
  try {
    const stats = await storage.getDashboardStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Pipeline stats for sales dashboard
router.get("/api/dashboard/pipeline-stats", authMiddleware, requireStaff, async (req, res) => {
  try {
    const stats = await storage.getPipelineStats();
    res.json(stats);
  } catch (error) {
    log.error("Error fetching pipeline stats:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ==================== GLOBAL SEARCH ====================

// Global search across clients, sites, and opportunities
router.get("/api/search", authMiddleware, requireStaff, async (req, res) => {
  try {
    const query = (req.query.q as string || "").trim();
    
    if (!query) {
      return res.json({ clients: [], sites: [], opportunities: [] });
    }

    // Optimized: Use SQL queries with ILIKE instead of loading all data
    const [clients, sites, opportunities] = await Promise.all([
      storage.searchClients(query, 5),
      storage.searchSites(query, 5),
      storage.searchOpportunities(query, 5),
    ]);

    res.json({ clients, sites, opportunities });
  } catch (error) {
    log.error("Error in global search:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ==================== HQ BILL PARSING ====================

const billUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

router.post("/api/parse-hq-bill", billUpload.single('file'), async (req, res) => {
  try {
    let imageBase64: string | undefined;
    let mimeType = 'image/jpeg';
    let fileBuffer: Buffer | undefined;
    let originalFilename: string | undefined;

    if (req.file) {
      fileBuffer = req.file.buffer;
      imageBase64 = req.file.buffer.toString('base64');
      mimeType = req.file.mimetype;
      originalFilename = req.file.originalname;
      log.info(`Received file upload: ${req.file.originalname}, ${req.file.mimetype}, ${Math.round(req.file.size / 1024)}KB`);
    } else if (req.body.imageBase64) {
      imageBase64 = req.body.imageBase64;
      mimeType = req.body.mimeType || 'image/jpeg';
      log.info(`Received base64 image, mimeType: ${mimeType}`);
    } else {
      return res.status(400).json({ 
        error: "No image provided. Send a file upload or imageBase64 in body." 
      });
    }

    const result = await parseHQBill(imageBase64, mimeType);

    log.info(`Extraction complete, confidence: ${result.confidence}, fields: account=${!!result.accountNumber}, tariff=${result.tariffCode}, kWh=${result.annualConsumptionKwh}`);

    // Save the HQ bill to object storage for later access to Espace Client
    let savedBillPath: string | undefined;
    if (fileBuffer && process.env.PRIVATE_OBJECT_DIR) {
      try {
        const timestamp = Date.now();
        const sanitizedName = (originalFilename || 'hq-bill').replace(/[^a-zA-Z0-9.-]/g, '_');
        const extension = mimeType === 'application/pdf' ? '.pdf' : 
                          mimeType.includes('png') ? '.png' : 
                          mimeType.includes('gif') ? '.gif' : '.jpg';
        const objectName = `hq-bills/${timestamp}_${sanitizedName}${sanitizedName.includes('.') ? '' : extension}`;
        
        const privateDir = process.env.PRIVATE_OBJECT_DIR;
        const bucketPath = privateDir.startsWith('/') ? privateDir.slice(1) : privateDir;
        const [bucketName, ...pathParts] = bucketPath.split('/');
        const fullObjectPath = [...pathParts, objectName].join('/');
        
        const bucket = objectStorageClient.bucket(bucketName);
        const file = bucket.file(fullObjectPath);
        
        await file.save(fileBuffer, {
          contentType: mimeType,
          metadata: {
            originalFilename: originalFilename,
            uploadedAt: new Date().toISOString(),
            accountNumber: result.accountNumber || '',
            clientName: result.clientName || '',
          }
        });
        
        savedBillPath = `/${bucketName}/${fullObjectPath}`;
        log.info(`Bill saved to object storage: ${savedBillPath}`);
      } catch (storageError) {
        log.error("Failed to save bill to storage (non-critical):", storageError);
      }
    }

    res.json({
      success: true,
      data: {
        ...result,
        savedBillPath,
      },
    });
  } catch (error) {
    log.error("Error:", error);
    res.status(500).json({ 
      error: "Failed to parse bill",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;

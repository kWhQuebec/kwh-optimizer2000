import express, { type Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authMiddleware, requireStaff, type AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import { insertLeadSchema } from "@shared/schema";
import { sendQuickAnalysisEmail } from "../emailService";
import { sendEmail } from "../gmail";
import * as googleSolar from "../googleSolarService";
import { generateProcurationPDF, createProcurationData } from "../procurationPdfGenerator";
import { parseHQBill, type HQBillData } from "../hqBillParser";

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
    const { address, email, monthlyBill, buildingType, tariffCode, annualConsumptionKwh } = req.body;
    
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
    
    // Solar yield: 1000 kWh/kWp (conservative KB 10° baseline for Quebec)
    const SOLAR_YIELD = 1000;
    
    // Cost per watt for CAPEX calculation ($2.25/W = $2250/kW)
    const COST_PER_KW = 2250;
    
    // HQ incentive: 20% of gross CAPEX, capped at $1000/kW
    const HQ_INCENTIVE_RATE = 0.20;
    const HQ_INCENTIVE_CAP_PER_KW = 1000;
    
    // Define offset scenarios
    const scenarios = [
      { key: "conservative", offsetPercent: 0.70, recommended: true },
      { key: "optimal", offsetPercent: 0.85, recommended: false },
      { key: "maximum", offsetPercent: 1.00, recommended: false },
    ];
    
    // Calculate each scenario
    const calculatedScenarios = scenarios.map(scenario => {
      const systemSizeKW = Math.max(10, Math.round((annualKWh * scenario.offsetPercent) / SOLAR_YIELD));
      const annualProductionKWh = systemSizeKW * SOLAR_YIELD;
      const annualSavings = Math.round(annualProductionKWh * energyRate);
      const grossCAPEX = systemSizeKW * COST_PER_KW;
      const hqIncentive = Math.min(grossCAPEX * HQ_INCENTIVE_RATE, systemSizeKW * HQ_INCENTIVE_CAP_PER_KW);
      const netCAPEX = grossCAPEX - hqIncentive;
      const paybackYears = annualSavings > 0 ? Math.round((netCAPEX / annualSavings) * 10) / 10 : 99;
      
      return {
        key: scenario.key,
        offsetPercent: scenario.offsetPercent,
        recommended: scenario.recommended,
        systemSizeKW,
        annualProductionKWh,
        annualSavings,
        grossCAPEX: Math.round(grossCAPEX),
        hqIncentive: Math.round(hqIncentive),
        netCAPEX: Math.round(netCAPEX),
        paybackYears,
      };
    });
    
    // Use conservative (70%) scenario as the primary/highlighted result
    const primaryScenario = calculatedScenarios.find(s => s.key === "conservative")!;
    
    console.log(`[Quick Estimate] Consumption: ${Math.round(annualKWh)} kWh/yr, 3 scenarios calculated, Rate: ${energyRate} $/kWh`);
    
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
        monthlyBill: estimatedMonthlyBill,
        buildingType: buildingType || "office",
        tariffCode: tariff,
        systemSizeKW: primaryScenario.systemSizeKW,
        annualProductionKWh: primaryScenario.annualProductionKWh,
        annualSavings: primaryScenario.annualSavings,
        paybackYears: primaryScenario.paybackYears,
        hqIncentive: primaryScenario.hqIncentive,
        grossCAPEX: primaryScenario.grossCAPEX,
        netCAPEX: primaryScenario.netCAPEX,
        monthlyBillBefore: estimatedMonthlyBill,
        monthlyBillAfter,
        monthlySavings,
        hasRoofData: false,
        roofAreaM2: undefined,
      }, baseUrl).catch(err => {
        console.error("[Quick Estimate] Email sending failed:", err);
      });
      emailSent = true;
    }
    
    res.json({
      success: true,
      emailSent,
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
    });
  } catch (error) {
    console.error("Quick estimate error:", error);
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
      tariffCode,
      hqClientNumber,
      notes,
      procurationAccepted,
      procurationDate,
      language,
    } = req.body;

    const contactName = `${firstName || ''} ${lastName || ''}`.trim();
    const formattedSignerName = `${lastName || ''}, ${firstName || ''}`.trim().replace(/^,\s*/, '').replace(/,\s*$/, '');

    if (!companyName || !firstName || !lastName || !email || !streetAddress || !city) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (procurationAccepted !== 'true') {
      return res.status(400).json({ error: "Procuration must be accepted" });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "At least one HQ bill file is required" });
    }

    const procurationInfo = language === 'fr'
      ? `[PROCURATION SIGNÉE] Acceptée le ${new Date(procurationDate).toLocaleString('fr-CA')} par ${contactName}`
      : `[AUTHORIZATION SIGNED] Accepted on ${new Date(procurationDate).toLocaleString('en-CA')} by ${contactName}`;
    
    const fileInfo = files.map((f, i) => `Fichier ${i + 1}: ${f.originalname}`).join('\n');
    
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
      notes: combinedNotes,
      source: 'detailed-analysis-form',
      status: 'qualified',
    };

    const parsed = insertLeadSchema.safeParse(leadData);
    if (!parsed.success) {
      console.error("[Detailed Analysis] Validation error:", parsed.error.errors);
      return res.status(400).json({ error: parsed.error.errors });
    }

    let lead = await storage.createLead(parsed.data);
    
    // Auto-create opportunity when lead is submitted
    try {
      const opportunityName = `${companyName} - ${streetAddress || city || 'Solar Project'}`;
      await storage.createOpportunity({
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
      console.log(`[Detailed Analysis] Auto-created opportunity for lead: ${lead.id}`);
    } catch (oppError) {
      console.error(`[Detailed Analysis] Failed to auto-create opportunity:`, oppError);
    }

    const uploadDir = path.join('uploads', 'bills', lead.id);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    for (const file of files) {
      const destPath = path.join(uploadDir, file.originalname);
      fs.renameSync(file.path, destPath);
    }

    const signatureImage = req.body.signatureImage;
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    try {
      await storage.createProcurationSignature({
        signerName: contactName,
        signerEmail: email,
        companyName: companyName,
        hqAccountNumber: hqClientNumber || null,
        leadId: lead.id,
        status: 'signed',
        language: language === 'en' ? 'en' : 'fr',
        ipAddress: clientIp,
        userAgent: userAgent,
      });
      console.log(`[Detailed Analysis] Procuration signature recorded for lead: ${lead.id}`);
      
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
          const signaturePath = path.join(signatureDir, `${lead.id}_signature.png`);
          fs.writeFileSync(signaturePath, Buffer.from(base64Data, 'base64'));
          console.log(`[Detailed Analysis] Signature image saved: ${signaturePath} (${Math.round(sizeInBytes / 1024)}KB)`);
        } else {
          console.warn(`[Detailed Analysis] Invalid signature format or size: format=${isValidFormat}, size=${Math.round(sizeInBytes / 1024)}KB`);
        }
      }
    } catch (sigError) {
      console.error("[Detailed Analysis] Failed to create signature record:", sigError);
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
      const pdfFilename = `procuration_${lead.id}_${Date.now()}.pdf`;
      const pdfPath = path.join(procurationDir, pdfFilename);
      fs.writeFileSync(pdfPath, pdfBuffer);
      console.log(`[Detailed Analysis] Procuration PDF saved: ${pdfPath}`);
      
      const testRecipient = 'info@kwh.quebec';
      
      const emailResult = await sendEmail({
        to: testRecipient,
        subject: `Procuration HQ - ${companyName} (${hqClientNumber || 'N/A'})`,
        htmlBody: `
          <p>Bonjour,</p>
          <p>Veuillez trouver ci-joint la procuration signée électroniquement par le client suivant :</p>
          <ul>
            <li><strong>Entreprise :</strong> ${companyName}</li>
            <li><strong>Contact :</strong> ${formattedSignerName}</li>
            <li><strong>Titre :</strong> ${req.body.signerTitle || 'Non spécifié'}</li>
            <li><strong>No de client HQ :</strong> ${hqClientNumber || 'Non fourni'}</li>
            <li><strong>Courriel :</strong> ${email}</li>
          </ul>
          <p>Cette procuration autorise kWh Québec à obtenir les données de consommation détaillées du client.</p>
          <p>Cordialement,<br>kWh Québec</p>
        `,
        textBody: `Procuration signée pour ${companyName} (${formattedSignerName}) - No client HQ: ${hqClientNumber || 'N/A'}`,
        attachments: [{
          filename: `procuration_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
          content: pdfBuffer.toString('base64'),
          type: 'application/pdf',
        }],
      });
      
      if (emailResult.success) {
        console.log(`[Detailed Analysis] Procuration email sent to ${testRecipient}`);
      } else {
        console.error(`[Detailed Analysis] Failed to send procuration email:`, emailResult.error);
      }
    } catch (pdfError) {
      console.error('[Detailed Analysis] Error generating/sending procuration PDF:', pdfError);
    }

    if (streetAddress && city) {
      triggerRoofEstimation(lead.id, leadData).catch((err) => {
        console.error(`[Detailed Analysis ${lead.id}] Roof estimation failed:`, err);
      });
    }

    console.log(`[Detailed Analysis] Lead created: ${lead.id}, Files: ${files.length}`);
    
    res.status(201).json({ 
      success: true, 
      leadId: lead.id,
      filesUploaded: files.length,
    });
  } catch (error) {
    console.error("[Detailed Analysis] Error:", error);
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
      console.log(`[Lead] Auto-created opportunity for lead: ${lead.id}`);
    } catch (oppError) {
      console.error(`[Lead] Failed to auto-create opportunity:`, oppError);
    }
    
    if (parsed.data.streetAddress && parsed.data.city) {
      triggerRoofEstimation(lead.id, parsed.data).catch((err) => {
        console.error(`[Lead ${lead.id}] Roof estimation failed:`, err);
      });
    }
    
    res.status(201).json(lead);
  } catch (error) {
    console.error("Create lead error:", error);
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
    
    console.log(`[Lead ${leadId}] Starting roof estimation for: ${fullAddress}`);
    
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
      
      console.log(`[Lead ${leadId}] Roof estimate complete: ${roofEstimate.roofAreaSqM.toFixed(0)} m², potential ${roofPotentialKw} kW`);
      
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
      
      console.warn(`[Lead ${leadId}] Roof estimation failed: ${roofEstimate.error}`);
    }
  } catch (error) {
    console.error(`[Lead ${leadId}] Error during roof estimation:`, error);
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
      console.log(`[Email] Roof estimate sent to ${toEmail}`);
    } else {
      console.error(`[Email] Failed to send roof estimate to ${toEmail}:`, result.error);
    }
  } catch (error) {
    console.error(`[Email] Error sending roof estimate:`, error);
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
    console.error("Error fetching pipeline stats:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ==================== GLOBAL SEARCH ====================

// Global search across clients, sites, and opportunities
router.get("/api/search", authMiddleware, requireStaff, async (req, res) => {
  try {
    const query = (req.query.q as string || "").toLowerCase().trim();
    
    if (!query) {
      return res.json({ clients: [], sites: [], opportunities: [] });
    }

    const [allClients, allSites, allOpportunities] = await Promise.all([
      storage.getClients(),
      storage.getSites(),
      storage.getOpportunities(),
    ]);

    const clients = allClients
      .filter(client => 
        client.name.toLowerCase().includes(query) ||
        (client.mainContactName && client.mainContactName.toLowerCase().includes(query)) ||
        (client.email && client.email.toLowerCase().includes(query))
      )
      .slice(0, 5)
      .map(c => ({
        id: c.id,
        name: c.name,
        mainContactName: c.mainContactName,
        email: c.email,
      }));

    const sites = allSites
      .filter(site =>
        site.name.toLowerCase().includes(query) ||
        (site.city && site.city.toLowerCase().includes(query)) ||
        (site.address && site.address.toLowerCase().includes(query)) ||
        (site.client && site.client.name.toLowerCase().includes(query))
      )
      .slice(0, 5)
      .map(s => ({
        id: s.id,
        name: s.name,
        city: s.city,
        clientName: s.client?.name || null,
      }));

    const opportunities = allOpportunities
      .filter(opp =>
        opp.name.toLowerCase().includes(query) ||
        (opp.description && opp.description.toLowerCase().includes(query))
      )
      .slice(0, 5)
      .map(o => ({
        id: o.id,
        name: o.name,
        stage: o.stage,
        estimatedValue: o.estimatedValue,
      }));

    res.json({ clients, sites, opportunities });
  } catch (error) {
    console.error("Error in global search:", error);
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

    if (req.file) {
      imageBase64 = req.file.buffer.toString('base64');
      mimeType = req.file.mimetype;
      console.log(`[HQ Bill Parse] Received file upload: ${req.file.originalname}, ${req.file.mimetype}, ${Math.round(req.file.size / 1024)}KB`);
    } else if (req.body.imageBase64) {
      imageBase64 = req.body.imageBase64;
      mimeType = req.body.mimeType || 'image/jpeg';
      console.log(`[HQ Bill Parse] Received base64 image, mimeType: ${mimeType}`);
    } else {
      return res.status(400).json({ 
        error: "No image provided. Send a file upload or imageBase64 in body." 
      });
    }

    const result = await parseHQBill(imageBase64, mimeType);

    console.log(`[HQ Bill Parse] Extraction complete, confidence: ${result.confidence}, fields: account=${!!result.accountNumber}, tariff=${result.tariffCode}, kWh=${result.annualConsumptionKwh}`);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[HQ Bill Parse] Error:", error);
    res.status(500).json({ 
      error: "Failed to parse bill",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;

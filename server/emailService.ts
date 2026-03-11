import { sendEmail as sendEmailViaGmail } from "./gmail";
import { sendEmailViaOutlook } from "./outlook";
import { sendEmailViaResend } from "./resend-portable";
import { renderEmailTemplate } from "./emailTemplates";
import { createLogger } from "./lib/logger";
import { getBuildingTypeLabel } from "@shared/buildingTypes";
import { emailWrapper, ctaButton, sectionTitle, infoRow, brand } from "./emailStyles";

const log = createLogger("EmailService");

export { getLogoDataUri } from "./emailLogo";

// Primary: Resend (more reliable for transactional emails)
// Fallback chain: Resend -> Gmail -> Outlook
export async function sendEmail(options: { to: string; subject: string; htmlBody: string; textBody?: string; replyTo?: string; attachments?: Array<{ filename: string; content: string; type: string; cid?: string }> }): Promise<{ success: boolean; messageId?: string; error?: string }> {
  log.info('Attempting to send via Resend (primary)...');
  
  // Primary: Resend
  try {
    const resendResult = await sendEmailViaResend(options);
    if (resendResult.success) {
      log.info('Email sent successfully via Resend');
      return resendResult;
    }
    log.info('Resend failed, trying Gmail...');
    log.info('Resend error:', resendResult.error);
  } catch (error: any) {
    log.info('Resend threw exception, trying Gmail...');
    log.info('Exception:', error.message);
  }
  
  // Fallback: Gmail
  try {
    const gmailResult = await sendEmailViaGmail(options);
    if (gmailResult.success) {
      log.info('Email sent successfully via Gmail (fallback)');
      return gmailResult;
    }
    log.info('Gmail also failed, trying Outlook...');
    log.info('Gmail error:', gmailResult.error);
  } catch (error: any) {
    log.info('Gmail threw exception, trying Outlook...');
    log.info('Exception:', error.message);
  }
  
  // Final fallback: Outlook
  return sendEmailViaOutlook(options);
}

interface ScenarioData {
  key: string;
  offsetPercent: number;
  systemSizeKW: number;
  annualProductionKWh: number;
  annualSavings: number;
  paybackYears: number;
  hqIncentive: number;
  federalITC: number;
  totalIncentives: number;
  grossCAPEX: number;
  netCAPEX: number;
  lcoePerKWh: number;
  lcoeSavingsPercent: number;
  recommended?: boolean;
}

interface QuickAnalysisData {
  address: string;
  annualConsumptionKWh: number;
  monthlyBill: number;
  buildingType: string;
  tariffCode: string;
  scenarios: ScenarioData[];
  monthlyBillBefore: number;
  hasRoofData: boolean;
  roofAreaM2?: number;
}

function detectLanguage(tariffCode: string, address: string): 'fr' | 'en' {
  const frenchIndicators = ['rue', 'avenue', 'boulevard', 'chemin', 'montréal', 'québec', 'laval', 'sherbrooke', 'trois-rivières', 'saint-', 'sainte-'];
  const lowerAddress = address.toLowerCase();
  const hasFrenchIndicator = frenchIndicators.some(indicator => lowerAddress.includes(indicator));
  return hasFrenchIndicator ? 'fr' : 'en';
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function formatNumber(amount: number): string {
  return new Intl.NumberFormat('fr-CA').format(amount);
}

function getScenarioLabel(key: string, offsetPercent: number, lang: 'fr' | 'en'): { title: string; subtitle: string } {
  const offsetPct = Math.round(offsetPercent * 100);
  const subtitleFr = `${offsetPct}% de compensation`;
  const subtitleEn = `${offsetPct}% offset`;
  
  switch (key) {
    case "bestPayback":
      return {
        title: lang === 'fr' ? 'Économique' : 'Economic',
        subtitle: lang === 'fr' ? subtitleFr : subtitleEn,
      };
    case "bestLcoe":
      return {
        title: lang === 'fr' ? 'Équilibré' : 'Balanced',
        subtitle: lang === 'fr' ? subtitleFr : subtitleEn,
      };
    case "optimal":
      return {
        title: lang === 'fr' ? 'Équilibré' : 'Balanced',
        subtitle: lang === 'fr' ? subtitleFr : subtitleEn,
      };
    case "maximum":
      return {
        title: 'Maximum',
        subtitle: lang === 'fr' ? subtitleFr : subtitleEn,
      };
    default:
      return {
        title: lang === 'fr' ? 'Scénario' : 'Scenario',
        subtitle: lang === 'fr' ? subtitleFr : subtitleEn,
      };
  }
}

function generateQuickAnalysisEmailHtml(data: QuickAnalysisData, lang: 'fr' | 'en', baseUrl: string): string {
  const t = {
    fr: {
      subject: '[kWh Québec] Votre analyse rapide solaire',
      greeting: 'Bonjour,',
      intro: 'Merci de votre intérêt pour l\'énergie solaire! Voici le résumé de votre analyse rapide basée sur les informations fournies.',
      analysisTitle: 'Résumé de votre analyse',
      addressLabel: 'Adresse',
      consumptionLabel: 'Consommation annuelle',
      buildingTypeLabel: 'Type de bâtiment',
      tariffLabel: 'Tarif Hydro-Québec',
      currentBillLabel: 'Facture mensuelle actuelle',
      scenariosTitle: 'Vos 3 scénarios optimisés',
      scenariosIntro: 'Nous avons analysé 11 scénarios (de 20% à 120% de compensation) pour vous proposer les 3 meilleures options:',
      recommended: 'Recommandé',
      systemSize: 'Puissance',
      annualProduction: 'Production',
      annualSavings: 'Économies/an',
      paybackPeriod: 'Retour',
      netCost: 'Coût net',
      lcoeVsHQ: 'vs Hydro-Québec',
      years: 'ans',
      ctaTitle: 'Vous n\'avez pas encore réservé votre appel?',
      ctaText: 'Discutez gratuitement avec un spécialiste solaire pour valider ces chiffres avec vos données réelles et obtenir un design personnalisé.',
      ctaButton: 'Réserver mon appel découverte →',
      disclaimer: 'Cette analyse est une estimation préliminaire basée sur des moyennes régionales. Une validation avec vos données de consommation réelles fournira des projections plus précises. La "compensation" représente le bilan annuel via le programme de mesurage net d\'Hydro-Québec.',
      footer: 'kWh Québec - Solaire + Stockage',
      footerContact: '514.427.8871 | info@kwh.quebec',
      footerNote: 'Ce courriel a été envoyé automatiquement suite à votre demande d\'analyse rapide.',
    },
    en: {
      subject: '[kWh Québec] Your Quick Solar Analysis',
      greeting: 'Hello,',
      intro: 'Thank you for your interest in solar energy! Here is the summary of your quick analysis based on the information provided.',
      analysisTitle: 'Your Analysis Summary',
      addressLabel: 'Address',
      consumptionLabel: 'Annual consumption',
      buildingTypeLabel: 'Building Type',
      tariffLabel: 'Hydro-Québec Tariff',
      currentBillLabel: 'Current monthly bill',
      scenariosTitle: 'Your 3 Optimized Scenarios',
      scenariosIntro: 'We analyzed 11 scenarios (from 20% to 120% offset) to propose the 3 best options for you:',
      recommended: 'Recommended',
      systemSize: 'System size',
      annualProduction: 'Production',
      annualSavings: 'Savings/yr',
      paybackPeriod: 'Payback',
      netCost: 'Net cost',
      lcoeVsHQ: 'vs Hydro-Québec',
      years: 'years',
      ctaTitle: 'Haven\'t booked your call yet?',
      ctaText: 'Speak with a solar specialist for free to validate these numbers with your actual data and get a custom design.',
      ctaButton: 'Book my discovery call →',
      disclaimer: 'This analysis is a preliminary estimate based on regional averages. A validation with your actual consumption data will provide more accurate projections. "Offset" represents the annual balance via Hydro-Québec\'s net metering program.',
      footer: 'kWh Québec - Solar + Storage',
      footerContact: '514.427.8871 | info@kwh.quebec',
      footerNote: 'This email was sent automatically following your quick analysis request.',
    },
  };
  
  const txt = t[lang];
  
  const scenariosHtml = data.scenarios.map((scenario) => {
    const labels = getScenarioLabel(scenario.key, scenario.offsetPercent, lang);
    const isRecommended = scenario.recommended === true;
    
    return `
      <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 15px; border: 1px solid #e0e0e0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 8px;">
          <div>
            <span style="font-size: 18px; font-weight: 700; color: #003DA6;">${labels.title}</span>
            <span style="font-size: 14px; color: #666; margin-left: 8px;">(${labels.subtitle})</span>
          </div>
        </div>
        
        <div style="display: table; width: 100%; border-collapse: collapse;">
          <div style="display: table-row;">
            <div style="display: table-cell; padding: 6px 0; color: #666; font-size: 13px;">${txt.systemSize}</div>
            <div style="display: table-cell; padding: 6px 0; font-weight: 600; text-align: right;">${scenario.systemSizeKW} kW</div>
          </div>
          <div style="display: table-row;">
            <div style="display: table-cell; padding: 6px 0; color: #666; font-size: 13px;">${txt.annualProduction}</div>
            <div style="display: table-cell; padding: 6px 0; font-weight: 600; text-align: right;">${formatNumber(scenario.annualProductionKWh)} kWh</div>
          </div>
          <div style="display: table-row;">
            <div style="display: table-cell; padding: 6px 0; color: #666; font-size: 13px;">${txt.annualSavings}</div>
            <div style="display: table-cell; padding: 6px 0; font-weight: 700; color: #16A34A; text-align: right;">${formatCurrency(scenario.annualSavings)}</div>
          </div>
          <div style="display: table-row;">
            <div style="display: table-cell; padding: 6px 0; color: #666; font-size: 13px;">${txt.netCost}</div>
            <div style="display: table-cell; padding: 6px 0; font-weight: 600; text-align: right;">${formatCurrency(scenario.netCAPEX)}</div>
          </div>
          <div style="display: table-row;">
            <div style="display: table-cell; padding: 6px 0; color: #666; font-size: 13px;">${txt.paybackPeriod}</div>
            <div style="display: table-cell; padding: 6px 0; font-weight: 700; color: #003DA6; text-align: right;">${scenario.paybackYears} ${txt.years}</div>
          </div>
          <div style="display: table-row;">
            <div style="display: table-cell; padding: 6px 0; color: #666; font-size: 13px;">${txt.lcoeVsHQ}</div>
            <div style="display: table-cell; padding: 6px 0; font-weight: 600; color: #16A34A; text-align: right;">-${scenario.lcoeSavingsPercent}%</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  // Build body content
  const infoTableHtml = `
    <div style="margin-bottom:20px;">
      ${infoRow(txt.addressLabel, data.address || '-')}
      ${infoRow(txt.consumptionLabel, `${formatNumber(data.annualConsumptionKWh)} kWh`)}
      ${infoRow(txt.buildingTypeLabel, getBuildingTypeLabel(data.buildingType, lang))}
      ${infoRow(txt.tariffLabel, data.tariffCode)}
      ${infoRow(txt.currentBillLabel, formatCurrency(data.monthlyBillBefore), true)}
    </div>`;

  const ctaSectionHtml = `
    <div style="background:linear-gradient(135deg, ${brand.primaryBlue} 0%, ${brand.darkBlue} 100%);color:white;padding:25px;text-align:center;margin:20px -30px -30px;border-radius:0 0 0 0;">
      <h3 style="margin:0 0 10px;font-size:18px;font-weight:600;">${txt.ctaTitle}</h3>
      <p style="margin:0 0 20px;font-size:14px;opacity:0.9;">${txt.ctaText}</p>
      <a href="${process.env.CALENDLY_URL || 'https://calendly.com/kwh-quebec/decouverte'}" style="display:inline-block;background:${brand.accentYellow};color:${brand.darkBlue};padding:14px 30px;text-decoration:none;border-radius:6px;font-weight:700;font-size:15px;">${txt.ctaButton}</a>
    </div>`;

  const bodyContent = `
    <p style="font-size:15px;color:#555;margin-bottom:25px;">${txt.greeting}<br><br>${txt.intro}</p>
    ${infoTableHtml}
    <div style="margin-bottom:25px;">
      ${sectionTitle(txt.scenariosTitle)}
      <p style="font-size:14px;color:#555;margin-bottom:20px;">${txt.scenariosIntro}</p>
      ${scenariosHtml}
    </div>
    ${ctaSectionHtml}`;

  return emailWrapper({
    lang,
    body: bodyContent,
    showLogo: true,
    logoSize: 'large',
    headerTitle: txt.analysisTitle,
    disclaimer: txt.disclaimer,
    footerNote: txt.footerNote,
  });
}

// Notification to Account Manager when a new lead submits a form (Quick Estimate or Detailed Analysis)
export async function sendNewLeadNotification(
  accountManagerEmail: string,
  leadData: {
    companyName: string;
    contactName: string;
    email?: string;
    phone?: string;
    address?: string;
    annualConsumptionKWh?: number;
    estimatedMonthlyBill?: number;
    buildingType?: string;
    formType: 'quick_estimate' | 'detailed_analysis';
    roofAgeYears?: number;
    ownershipType?: string;
    siteId?: string;
  },
  language: 'fr' | 'en' = 'fr',
  baseUrl?: string
): Promise<{ success: boolean; error?: string }> {
  const formLabel = language === 'fr'
    ? (leadData.formType === 'quick_estimate' ? 'Estimation Rapide' : 'Analyse Détaillée')
    : (leadData.formType === 'quick_estimate' ? 'Quick Estimate' : 'Detailed Analysis');

  const subject = language === 'fr'
    ? `🔔 Nouveau lead — ${leadData.companyName} (${formLabel})`
    : `🔔 New Lead — ${leadData.companyName} (${formLabel})`;

  const ownerLabel = leadData.ownershipType === 'owner'
    ? (language === 'fr' ? 'Propriétaire' : 'Owner')
    : leadData.ownershipType === 'tenant'
      ? (language === 'fr' ? 'Locataire' : 'Tenant')
      : (language === 'fr' ? 'Non spécifié' : 'Not specified');

  const roofAgeLabel = leadData.roofAgeYears
    ? (leadData.roofAgeYears <= 5 ? (language === 'fr' ? '< 5 ans' : '< 5 years')
      : leadData.roofAgeYears <= 10 ? '5-10 ' + (language === 'fr' ? 'ans' : 'years')
      : leadData.roofAgeYears <= 15 ? '10-15 ' + (language === 'fr' ? 'ans' : 'years')
      : leadData.roofAgeYears <= 20 ? '15-20 ' + (language === 'fr' ? 'ans' : 'years')
      : '> 20 ' + (language === 'fr' ? 'ans' : 'years'))
    : (language === 'fr' ? 'Non spécifié' : 'Not specified');

  const buildingLabel = leadData.buildingType
    ? getBuildingTypeLabel(leadData.buildingType, language)
    : (language === 'fr' ? 'Non spécifié' : 'Not specified');

  // Build optimized lead card body
  const bodyContent = `
    <div style="margin-bottom:20px;">
      ${infoRow(language === 'fr' ? 'Entreprise / Contact' : 'Company / Contact', leadData.companyName, true)}
      ${leadData.email ? infoRow(language === 'fr' ? 'Courriel' : 'Email', `<a href="mailto:${leadData.email}" style="color:${brand.primaryBlue};text-decoration:none;">${leadData.email}</a>`) : ''}
      ${leadData.phone ? infoRow(language === 'fr' ? 'Téléphone' : 'Phone', `<a href="tel:${leadData.phone}" style="color:${brand.primaryBlue};text-decoration:none;">${leadData.phone}</a>`) : ''}
      ${leadData.address ? infoRow(language === 'fr' ? 'Adresse' : 'Address', leadData.address) : ''}
    </div>
    ${sectionTitle(language === 'fr' ? 'Profil énergétique' : 'Energy Profile')}
    <div style="margin-bottom:20px;">
      ${leadData.annualConsumptionKWh ? infoRow(language === 'fr' ? 'Consommation annuelle' : 'Annual Consumption', `${Math.round(leadData.annualConsumptionKWh).toLocaleString()} kWh`) : ''}
      ${leadData.estimatedMonthlyBill ? infoRow(language === 'fr' ? 'Facture mensuelle est.' : 'Est. Monthly Bill', `$${leadData.estimatedMonthlyBill.toFixed(0)}/mois`) : ''}
      ${infoRow(language === 'fr' ? 'Type de bâtiment' : 'Building Type', buildingLabel)}
      ${infoRow(language === 'fr' ? 'Propriétaire?' : 'Owner?', ownerLabel, leadData.ownershipType === 'owner')}
      ${infoRow(language === 'fr' ? 'Âge toiture' : 'Roof Age', roofAgeLabel)}
    </div>
    ${leadData.siteId && baseUrl ? ctaButton(
      language === 'fr' ? 'Voir le lead dans l\'Optimizer →' : 'View Lead in Optimizer →',
      `${baseUrl}/app/sites/${leadData.siteId}`,
      'primary'
    ) : ''}`;

  const htmlBody = emailWrapper({
    lang: language,
    body: bodyContent,
    showLogo: true,
    logoSize: 'small',
    headerTitle: language === 'fr' ? 'Nouveau Lead' : 'New Lead',
    headerBadge: formLabel,
    headerBadgeColor: brand.accentGreen,
    footerNote: language === 'fr'
      ? 'Notification automatique — kWh Optimizer 2000'
      : 'Automatic notification — kWh Optimizer 2000',
  });

  const textBody = language === 'fr'
    ? `🔔 NOUVEAU LEAD — ${formLabel}

Entreprise: ${leadData.companyName}
${leadData.email ? `Courriel: ${leadData.email}` : ''}
${leadData.phone ? `Téléphone: ${leadData.phone}` : ''}
${leadData.address ? `Adresse: ${leadData.address}` : ''}
${leadData.annualConsumptionKWh ? `Consommation: ${Math.round(leadData.annualConsumptionKWh).toLocaleString()} kWh/an` : ''}
${leadData.estimatedMonthlyBill ? `Facture mensuelle: $${leadData.estimatedMonthlyBill.toFixed(0)}/mois` : ''}
Type: ${buildingLabel}
Propriétaire: ${ownerLabel}
Âge toiture: ${roofAgeLabel}
${leadData.siteId && baseUrl ? `\nVoir le lead: ${baseUrl}/app/sites/${leadData.siteId}` : ''}

---
kWh Québec | 514.427.8871 | info@kwh.quebec`
    : `🔔 NEW LEAD — ${formLabel}

Company: ${leadData.companyName}
${leadData.email ? `Email: ${leadData.email}` : ''}
${leadData.phone ? `Phone: ${leadData.phone}` : ''}
${leadData.address ? `Address: ${leadData.address}` : ''}
${leadData.annualConsumptionKWh ? `Consumption: ${Math.round(leadData.annualConsumptionKWh).toLocaleString()} kWh/year` : ''}
${leadData.estimatedMonthlyBill ? `Monthly bill: $${leadData.estimatedMonthlyBill.toFixed(0)}/mo` : ''}
Type: ${buildingLabel}
Owner: ${ownerLabel}
Roof Age: ${roofAgeLabel}
${leadData.siteId && baseUrl ? `\nView lead: ${baseUrl}/app/sites/${leadData.siteId}` : ''}

---
kWh Québec | 514.427.8871 | info@kwh.quebec`;

  log.info(`Sending new lead notification to ${accountManagerEmail} for ${leadData.companyName}`);

  const result = await sendEmail({
    to: accountManagerEmail,
    subject,
    htmlBody,
    textBody,
  });

  if (result.success) {
    log.info(`New lead notification sent to ${accountManagerEmail}`);
  } else {
    log.error(`Failed to send new lead notification: ${result.error}`);
  }

  return result;
}

export async function sendQuickAnalysisEmail(
  email: string,
  data: QuickAnalysisData,
  baseUrl: string,
  explicitLanguage?: 'fr' | 'en'
): Promise<{ success: boolean; error?: string }> {
  try {
    log.info(`[QuickAnalysis] Starting email generation for ${email}`);
    log.info(`[QuickAnalysis] Data: address="${data.address}", tariff="${data.tariffCode}", buildingType="${data.buildingType}", scenarios=${data.scenarios?.length || 0}, monthlyBillBefore=${data.monthlyBillBefore}`);

    const lang = detectLanguage(data.tariffCode, data.address);
    log.info(`[QuickAnalysis] Detected language: ${lang}`);

    const subject = lang === 'fr'
      ? '[kWh Québec] Votre analyse rapide solaire'
      : '[kWh Québec] Your Quick Solar Analysis';

    log.info(`[QuickAnalysis] Generating HTML body...`);
    let htmlBody: string;
    try {
      htmlBody = generateQuickAnalysisEmailHtml(data, lang, baseUrl);
      log.info(`[QuickAnalysis] HTML generated successfully (${htmlBody.length} chars)`);
    } catch (htmlErr: any) {
      log.error(`[QuickAnalysis] HTML generation FAILED: ${htmlErr.message}`);
      log.error(`[QuickAnalysis] Stack: ${htmlErr.stack}`);
      return { success: false, error: `HTML generation failed: ${htmlErr.message}` };
    }

    log.info(`[QuickAnalysis] Sending email to ${email} (lang: ${lang}, subject: ${subject})`);

    const result = await sendEmail({
      to: email,
      subject,
      htmlBody,
    });

    if (result.success) {
      log.info(`[QuickAnalysis] Email sent successfully to ${email} (messageId: ${result.messageId})`);
    } else {
      log.error(`[QuickAnalysis] sendEmail failed: ${result.error}`);
    }

    return result;
  } catch (err: any) {
    log.error(`[QuickAnalysis] UNEXPECTED ERROR: ${err.message}`);
    log.error(`[QuickAnalysis] Stack: ${err.stack}`);
    return { success: false, error: `Unexpected: ${err.message}` };
  }
}

interface WelcomeEmailData {
  userEmail: string;
  userName: string;
  userRole: string;
  tempPassword?: string;
}

export async function sendPasswordResetEmail(
  email: string,
  tempPassword: string,
  language: 'fr' | 'en' = 'fr'
): Promise<{ success: boolean; error?: string }> {
  const host = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;
  const loginUrl = `${baseUrl}/login`;

  const rendered = renderEmailTemplate('passwordReset', language, {
    tempPassword,
    loginUrl,
  });
  
  log.info(`Sending password reset email to ${email} (lang: ${language})`);
  
  const result = await sendEmail({
    to: email,
    subject: rendered.subject,
    htmlBody: rendered.html,
  });
  
  if (result.success) {
    log.info(`Password reset email sent successfully to ${email}`);
  } else {
    log.error(`Failed to send password reset email: ${result.error}`);
  }
  
  return result;
}

function getRoleLabel(role: string, lang: 'fr' | 'en'): string {
  const labels: Record<string, { fr: string; en: string }> = {
    admin: { fr: 'Administrateur', en: 'Administrator' },
    analyst: { fr: 'Gestionnaire de projets', en: 'Project Manager' },
    client: { fr: 'Client', en: 'Client' },
  };
  return labels[role]?.[lang] || role;
}

export async function sendWelcomeEmail(
  data: WelcomeEmailData,
  baseUrl: string,
  language: 'fr' | 'en' = 'fr'
): Promise<{ success: boolean; error?: string }> {
  const loginUrl = `${baseUrl}/login`;

  const rendered = renderEmailTemplate('userWelcome', language, {
    userName: data.userName || data.userEmail.split('@')[0],
    userEmail: data.userEmail,
    userRole: getRoleLabel(data.userRole, language),
    tempPassword: data.tempPassword || '',
    loginUrl,
  });
  
  log.info(`Sending welcome email to ${data.userEmail} (lang: ${language})`);
  
  const result = await sendEmail({
    to: data.userEmail,
    subject: rendered.subject,
    htmlBody: rendered.html,
  });
  
  if (result.success) {
    log.info(`Welcome email sent successfully to ${data.userEmail}`);
  } else {
    log.error(`Failed to send welcome email: ${result.error}`);
  }
  
  return result;
}

function generateHqProcurationEmailHtml(clientName: string, lang: 'fr' | 'en', baseUrl: string, clientId?: string): string {
  const procurationUrl = clientId 
    ? `${baseUrl}/autorisation-hq?clientId=${clientId}&lang=${lang}`
    : `${baseUrl}/autorisation-hq?lang=${lang}`;
  const t = {
    fr: {
      greeting: `Bonjour ${clientName},`,
      intro: `Dans le cadre de votre projet d'analyse solaire avec kWh Québec, nous avons besoin d'accéder à vos données de consommation Hydro-Québec pour réaliser une analyse précise et personnalisée à votre bâtiment.`,
      whyTitle: 'Pourquoi avons-nous besoin de cette autorisation?',
      whyText: 'Les données de consommation horaires nous permettent de:',
      benefit1: 'Dimensionner précisément votre système solaire',
      benefit2: 'Calculer vos économies réelles basées sur votre profil de consommation',
      benefit3: 'Optimiser la taille de la batterie si applicable',
      benefit4: 'Fournir des projections financières fiables',
      actionTitle: 'Comment procéder?',
      actionText: 'Cliquez sur le bouton ci-dessous pour accéder au formulaire d\'autorisation. Vous devrez téléverser une facture Hydro-Québec récente (moins de 3 mois). Le processus complet prend moins de 2 minutes.',
      ctaButton: 'Signer la procuration',
      securityNote: 'Cette procuration autorise uniquement kWh Québec à consulter vos données de consommation auprès d\'Hydro-Québec. Elle peut être révoquée à tout moment.',
      questions: 'Des questions? N\'hésitez pas à nous contacter.',
      footer: 'kWh Québec - 514.427.8871 - info@kwh.quebec',
    },
    en: {
      greeting: `Hello ${clientName},`,
      intro: `As part of your solar analysis project with kWh Québec, we need access to your Hydro-Québec consumption data to provide an accurate and personalized analysis for your building.`,
      whyTitle: 'Why do we need this authorization?',
      whyText: 'Hourly consumption data allows us to:',
      benefit1: 'Precisely size your solar system',
      benefit2: 'Calculate your actual savings based on your consumption profile',
      benefit3: 'Optimize battery size if applicable',
      benefit4: 'Provide reliable financial projections',
      actionTitle: 'How to proceed?',
      actionText: 'Click the button below to access the authorization form. You will need to upload a recent (less than 3 month old) Hydro-Québec bill. The whole process should take less than 2 minutes.',
      ctaButton: 'Sign Authorization',
      securityNote: 'This authorization only allows kWh Québec to access your consumption data from Hydro-Québec. It can be revoked at any time.',
      questions: 'Questions? Feel free to contact us.',
      footer: 'kWh Québec - 514.427.8871 - info@kwh.quebec',
    },
  };
  
  const txt = t[lang];
  
  const bodyContent = `
    <p style="font-size:15px;color:#555;margin-bottom:8px;">${txt.greeting}</p>
    <p style="font-size:14px;color:#555;line-height:1.6;margin-bottom:20px;">${txt.intro}</p>

    ${sectionTitle(txt.whyTitle)}
    <p style="font-size:14px;color:#555;margin-bottom:8px;">${txt.whyText}</p>
    <div style="font-size:14px;color:#555;line-height:1.8;margin:0 0 20px 20px;">
      &bull; ${txt.benefit1}<br>
      &bull; ${txt.benefit2}<br>
      &bull; ${txt.benefit3}<br>
      &bull; ${txt.benefit4}
    </div>

    ${sectionTitle(txt.actionTitle)}
    <p style="font-size:14px;color:#555;line-height:1.6;margin-bottom:8px;">${txt.actionText}</p>

    ${ctaButton(txt.ctaButton, procurationUrl)}

    <p style="font-size:13px;color:#888;text-align:center;line-height:1.5;margin-top:0;">${txt.securityNote}</p>
    <p style="font-size:14px;color:#666;text-align:center;margin-top:16px;">${txt.questions}</p>`;

  return emailWrapper({
    lang,
    body: bodyContent,
    showLogo: true,
    logoSize: 'large',
  });
}

function generateHqProcurationTextEmail(clientName: string, lang: 'fr' | 'en', baseUrl: string, clientId?: string): string {
  const procurationUrl = clientId 
    ? `${baseUrl}/autorisation-hq?clientId=${clientId}&lang=${lang}`
    : `${baseUrl}/autorisation-hq?lang=${lang}`;
  
  if (lang === 'fr') {
    return `Bonjour ${clientName},

Dans le cadre de votre projet d'analyse solaire avec kWh Québec, nous avons besoin d'accéder à vos données de consommation Hydro-Québec pour réaliser une analyse précise et personnalisée à votre bâtiment.

POURQUOI AVONS-NOUS BESOIN DE CETTE AUTORISATION?

Les données de consommation horaires nous permettent de:
- Dimensionner précisément votre système solaire
- Calculer vos économies réelles basées sur votre profil de consommation
- Optimiser la taille de la batterie si applicable
- Fournir des projections financières fiables

COMMENT PROCÉDER?

Cliquez sur le lien ci-dessous pour accéder au formulaire d'autorisation. Vous devrez téléverser une facture Hydro-Québec récente (moins de 3 mois). Le processus complet prend moins de 2 minutes.

${procurationUrl}

Des questions? N'hésitez pas à nous contacter.

---
kWh Québec
514.427.8871
info@kwh.quebec`;
  }
  
  return `Hello ${clientName},

As part of your solar analysis project with kWh Québec, we need access to your Hydro-Québec consumption data to provide an accurate and personalized analysis for your building.

WHY DO WE NEED THIS?

Hourly consumption data allows us to:
- Precisely size your solar system
- Calculate your actual savings based on your consumption profile
- Optimize battery size if applicable
- Provide reliable financial projections

HOW TO PROCEED?

Click the link below to access the authorization form. You will need to upload a recent (less than 3 month old) Hydro-Québec bill. The whole process should take less than 2 minutes.

${procurationUrl}

Questions? Feel free to contact us.

---
kWh Québec
514.427.8871
info@kwh.quebec`;
}

export async function sendHqProcurationEmail(
  email: string,
  clientName: string,
  language: 'fr' | 'en',
  baseUrl: string,
  clientId?: string
): Promise<{ success: boolean; error?: string }> {
  // Subject without brackets - more personal, less likely to be flagged as spam
  const subject = language === 'fr' 
    ? `${clientName}, votre projet solaire avec kWh Québec`
    : `${clientName}, your solar project with kWh Québec`;
  
  const htmlBody = generateHqProcurationEmailHtml(clientName, language, baseUrl, clientId);
  const textBody = generateHqProcurationTextEmail(clientName, language, baseUrl, clientId);
  
  log.info(`Sending HQ procuration email to ${email} for ${clientName} (lang: ${language})`);
  
  const result = await sendEmail({
    to: email,
    subject,
    htmlBody,
    textBody,
  });
  
  if (result.success) {
    log.info(`HQ procuration email sent successfully to ${email}`);
  } else {
    log.error(`Failed to send HQ procuration email: ${result.error}`);
  }
  
  return result;
}

// Notification when client COMPLETES/SIGNS the procuration (ready for HQ submission)
export async function sendProcurationCompletedNotification(
  accountManagerEmail: string,
  clientData: {
    companyName: string;
    contactName: string;
    signerTitle?: string;
    email: string;
    phone?: string;
    hqAccountNumber?: string;
    streetAddress?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    signedAt: Date;
  },
  language: 'fr' | 'en',
  pdfAttachment?: { filename: string; content: string; type: string }
): Promise<{ success: boolean; error?: string }> {
  const signedDate = clientData.signedAt.toLocaleDateString(language === 'fr' ? 'fr-CA' : 'en-CA', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Montreal'
  });
  
  const subject = language === 'fr'
    ? `Procuration signée - ${clientData.companyName} - Prête pour Hydro-Québec`
    : `Signed Authorization - ${clientData.companyName} - Ready for Hydro-Québec`;
  
  const fullAddress = [clientData.streetAddress, clientData.city, clientData.province, clientData.postalCode].filter(Boolean).join(', ') || (language === 'fr' ? 'Non fournie' : 'Not provided');

  const bodyContent = `
    ${sectionTitle(language === 'fr' ? 'Informations du client' : 'Client Information')}
    ${infoRow(language === 'fr' ? 'Entreprise' : 'Company', clientData.companyName, true)}
    ${infoRow(language === 'fr' ? 'Signataire' : 'Signatory', `${clientData.contactName}${clientData.signerTitle ? ` - ${clientData.signerTitle}` : ''}`)}
    ${infoRow(language === 'fr' ? 'Courriel' : 'Email', clientData.email)}
    ${clientData.phone ? infoRow(language === 'fr' ? 'Téléphone' : 'Phone', clientData.phone) : ''}
    ${infoRow(language === 'fr' ? 'No Hydro-Québec' : 'HQ Account #', clientData.hqAccountNumber || (language === 'fr' ? 'Non fourni' : 'Not provided'))}

    <div style="margin-top:20px;">
    ${sectionTitle(language === 'fr' ? 'Adresse' : 'Address')}
    ${infoRow(language === 'fr' ? 'Adresse complète' : 'Full Address', fullAddress)}
    </div>

    <div style="margin-top:20px;">
    ${sectionTitle(language === 'fr' ? 'Signature' : 'Signature')}
    ${infoRow(language === 'fr' ? 'Date et heure' : 'Date & Time', signedDate)}
    </div>

    <div style="background:linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);padding:20px;border-radius:8px;border:1px solid #0284c7;margin-top:24px;">
      <div style="font-weight:600;color:#0369a1;margin-bottom:10px;font-size:15px;">${language === 'fr' ? 'Prochaines étapes' : 'Next Steps'}</div>
      <div style="color:#0c4a6e;font-size:14px;line-height:1.8;">
        1. ${language === 'fr' ? 'Vérifier les informations ci-dessus' : 'Review the information above'}<br>
        2. ${language === 'fr' ? 'Télécharger la procuration PDF ci-jointe' : 'Download the attached PDF authorization'}<br>
        3. ${language === 'fr' ? 'Soumettre à Hydro-Québec pour obtenir les données de consommation' : 'Submit to Hydro-Québec to obtain consumption data'}
      </div>
    </div>`;

  const htmlBody = emailWrapper({
    lang: language,
    body: bodyContent,
    showLogo: true,
    logoSize: 'small',
    headerTitle: language === 'fr' ? 'Procuration Hydro-Québec Signée' : 'Hydro-Québec Authorization Signed',
    headerBadge: language === 'fr' ? 'Action requise' : 'Action Required',
    headerBadgeColor: brand.accentGreen,
  });

  const textBody = language === 'fr'
    ? `PROCURATION HYDRO-QUÉBEC SIGNÉE - ACTION REQUISE

Entreprise: ${clientData.companyName}
Signataire: ${clientData.contactName}${clientData.signerTitle ? ` - ${clientData.signerTitle}` : ''}
Courriel: ${clientData.email}
${clientData.phone ? `Téléphone: ${clientData.phone}` : ''}
No de client Hydro-Québec: ${clientData.hqAccountNumber || 'Non fourni'}
Adresse: ${[clientData.streetAddress, clientData.city, clientData.province, clientData.postalCode].filter(Boolean).join(', ') || 'Non fournie'}
Date de signature: ${signedDate}

PROCHAINES ÉTAPES:
1. Vérifier les informations ci-dessus
2. Télécharger la procuration PDF ci-jointe
3. Soumettre à Hydro-Québec pour obtenir les données de consommation

---
kWh Québec | 514.427.8871 | info@kwh.quebec`
    : `HYDRO-QUÉBEC AUTHORIZATION SIGNED - ACTION REQUIRED

Company: ${clientData.companyName}
Signatory: ${clientData.contactName}${clientData.signerTitle ? ` - ${clientData.signerTitle}` : ''}
Email: ${clientData.email}
${clientData.phone ? `Phone: ${clientData.phone}` : ''}
Hydro-Québec Account Number: ${clientData.hqAccountNumber || 'Not provided'}
Address: ${[clientData.streetAddress, clientData.city, clientData.province, clientData.postalCode].filter(Boolean).join(', ') || 'Not provided'}
Signature Date: ${signedDate}

NEXT STEPS:
1. Review the information above
2. Download the attached PDF authorization
3. Submit to Hydro-Québec to obtain consumption data

---
kWh Québec | 514.427.8871 | info@kwh.quebec`;

  log.info(`Sending procuration COMPLETED notification to account manager ${accountManagerEmail}`);
  
  const result = await sendEmail({
    to: accountManagerEmail,
    subject,
    htmlBody,
    textBody,
    attachments: pdfAttachment ? [pdfAttachment] : undefined,
  });
  
  if (result.success) {
    log.info(`Procuration completed notification sent to ${accountManagerEmail}`);
  } else {
    log.error(`Failed to send procuration completed notification: ${result.error}`);
  }
  
  return result;
}

// Legacy function - notification when procuration REQUEST is sent (no longer used)
export async function sendProcurationNotificationToAccountManager(
  accountManagerEmail: string,
  clientName: string,
  clientEmail: string,
  language: 'fr' | 'en'
): Promise<{ success: boolean; error?: string }> {
  const subject = language === 'fr'
    ? `Procuration Hydro-Québec envoyée - ${clientName}`
    : `Hydro-Québec Procuration Sent - ${clientName}`;
  
  const bodyContent = `
    <p style="font-size:14px;color:#555;line-height:1.6;margin-bottom:16px;">${language === 'fr'
      ? 'Un courriel de demande de procuration Hydro-Québec a été envoyé au client suivant :'
      : 'A Hydro-Québec procuration request email has been sent to the following client:'}</p>
    ${infoRow('Client', clientName, true)}
    ${infoRow(language === 'fr' ? 'Courriel' : 'Email', clientEmail)}
    <p style="font-size:13px;color:#888;margin-top:20px;line-height:1.5;">${language === 'fr'
      ? 'Vous recevrez une notification lorsque le client aura signé la procuration.'
      : 'You will receive a notification when the client signs the procuration.'}</p>`;

  const htmlBody = emailWrapper({
    lang: language,
    body: bodyContent,
    showLogo: true,
    logoSize: 'small',
    headerTitle: language === 'fr' ? 'Procuration envoyée' : 'Procuration Sent',
  });

  const textBody = language === 'fr'
    ? `Notification: Procuration Hydro-Québec envoyée\n\nUn courriel de demande de procuration Hydro-Québec a été envoyé au client suivant:\n\nClient: ${clientName}\nCourriel: ${clientEmail}\n\nVous recevrez une notification lorsque le client aura signé la procuration.`
    : `Notification: Hydro-Québec Procuration Sent\n\nA Hydro-Québec procuration request email has been sent to the following client:\n\nClient: ${clientName}\nEmail: ${clientEmail}\n\nYou will receive a notification when the client signs the procuration.`;

  log.info(`Sending procuration notification to account manager ${accountManagerEmail}`);
  
  const result = await sendEmail({
    to: accountManagerEmail,
    subject,
    htmlBody,
    textBody,
  });
  
  if (result.success) {
    log.info(`Procuration notification sent to ${accountManagerEmail}`);
  } else {
    log.error(`Failed to send notification to account manager: ${result.error}`);
  }

  return result;
}

/**
 * Send a template-based email for nurture sequences
 * Uses renderEmailTemplate to substitute placeholders
 */
export async function sendTemplateEmail(
  templateKey: string,
  to: string,
  data: Record<string, string>,
  language: 'fr' | 'en' = 'fr'
): Promise<{ success: boolean; error?: string }> {
  try {
    const rendered = renderEmailTemplate(templateKey as any, language, data);

    log.info(`Sending template email ${templateKey} to ${to} (lang: ${language})`);

    const result = await sendEmail({
      to,
      subject: rendered.subject,
      htmlBody: rendered.html,
      textBody: rendered.text,
    });

    if (result.success) {
      log.info(`Template email ${templateKey} sent successfully to ${to}`);
    } else {
      log.error(`Failed to send template email ${templateKey}: ${result.error}`);
    }

    return result;
  } catch (error: any) {
    log.error(`Error sending template email ${templateKey}:`, error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

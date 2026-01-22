import { sendEmail as sendEmailViaGmail } from "./gmail";
import { sendEmailViaOutlook } from "./outlook";
import { renderEmailTemplate } from "./emailTemplates";

// Use Outlook as primary email service (sends from info@kwh.quebec)
// Fallback to Gmail if Outlook fails
async function sendEmail(options: { to: string; subject: string; htmlBody: string; textBody?: string }): Promise<{ success: boolean; messageId?: string; error?: string }> {
  console.log('[EmailService] Attempting to send via Outlook first...');
  
  try {
    const outlookResult = await sendEmailViaOutlook(options);
    if (outlookResult.success) {
      return outlookResult;
    }
    console.log('[EmailService] Outlook failed, falling back to Gmail...');
    console.log('[EmailService] Outlook error:', outlookResult.error);
  } catch (error: any) {
    console.log('[EmailService] Outlook threw exception, falling back to Gmail...');
    console.log('[EmailService] Exception:', error.message);
  }
  
  // Fallback to Gmail
  return sendEmailViaGmail(options);
}

interface QuickAnalysisData {
  address: string;
  monthlyBill: number;
  buildingType: string;
  tariffCode: string;
  systemSizeKW: number;
  annualProductionKWh: number;
  annualSavings: number;
  paybackYears: number;
  hqIncentive: number;
  grossCAPEX: number;
  netCAPEX: number;
  monthlyBillBefore: number;
  monthlyBillAfter: number;
  monthlySavings: number;
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

function getBuildingTypeLabel(buildingType: string, lang: 'fr' | 'en'): string {
  const labels: Record<string, { fr: string; en: string }> = {
    office: { fr: 'Bureau', en: 'Office' },
    warehouse: { fr: 'Entrepôt', en: 'Warehouse' },
    retail: { fr: 'Commerce', en: 'Retail' },
    industrial: { fr: 'Industriel', en: 'Industrial' },
    healthcare: { fr: 'Santé', en: 'Healthcare' },
    education: { fr: 'Éducation', en: 'Education' },
  };
  return labels[buildingType]?.[lang] || buildingType;
}

function generateQuickAnalysisEmailHtml(data: QuickAnalysisData, lang: 'fr' | 'en', baseUrl: string): string {
  const logoUrl = lang === 'fr' 
    ? `${baseUrl}/assets/logo-fr.png`
    : `${baseUrl}/assets/logo-en.png`;
  
  const t = {
    fr: {
      subject: '[kWh Québec] Votre analyse rapide solaire',
      greeting: 'Bonjour,',
      intro: 'Merci de votre intérêt pour l\'énergie solaire! Voici le résumé de votre analyse rapide basée sur les informations fournies.',
      analysisTitle: 'Résumé de votre analyse',
      addressLabel: 'Adresse',
      buildingTypeLabel: 'Type de bâtiment',
      tariffLabel: 'Tarif HQ',
      systemTitle: 'Système recommandé',
      systemSize: 'Puissance du système',
      annualProduction: 'Production annuelle',
      roofArea: 'Surface de toit disponible',
      financialTitle: 'Analyse financière',
      monthlyBillBefore: 'Facture mensuelle actuelle',
      monthlyBillAfter: 'Facture mensuelle estimée',
      monthlySavings: 'Économies mensuelles',
      annualSavings: 'Économies annuelles',
      hqIncentive: 'Incitatif Hydro-Québec',
      grossCost: 'Coût brut du système',
      netCost: 'Coût net après incitatif',
      paybackPeriod: 'Période de récupération',
      years: 'ans',
      ctaTitle: 'Prêt à passer à l\'étape suivante?',
      ctaText: 'Obtenez une analyse détaillée gratuite avec des données de consommation réelles et un design personnalisé pour votre bâtiment.',
      ctaButton: 'Demander une analyse détaillée',
      disclaimer: 'Cette analyse est une estimation préliminaire basée sur des moyennes régionales. Une analyse détaillée avec vos données de consommation réelles fournira des projections plus précises.',
      footer: 'kWh Québec - Solaire + Stockage',
      footerNote: 'Ce courriel a été envoyé automatiquement suite à votre demande d\'analyse rapide.',
    },
    en: {
      subject: '[kWh Québec] Your Quick Solar Analysis',
      greeting: 'Hello,',
      intro: 'Thank you for your interest in solar energy! Here is the summary of your quick analysis based on the information provided.',
      analysisTitle: 'Your Analysis Summary',
      addressLabel: 'Address',
      buildingTypeLabel: 'Building Type',
      tariffLabel: 'HQ Tariff',
      systemTitle: 'Recommended System',
      systemSize: 'System Size',
      annualProduction: 'Annual Production',
      roofArea: 'Available Roof Area',
      financialTitle: 'Financial Analysis',
      monthlyBillBefore: 'Current Monthly Bill',
      monthlyBillAfter: 'Estimated Monthly Bill',
      monthlySavings: 'Monthly Savings',
      annualSavings: 'Annual Savings',
      hqIncentive: 'Hydro-Québec Incentive',
      grossCost: 'Gross System Cost',
      netCost: 'Net Cost After Incentive',
      paybackPeriod: 'Payback Period',
      years: 'years',
      ctaTitle: 'Ready for the next step?',
      ctaText: 'Get a free detailed analysis with your actual consumption data and a custom design for your building.',
      ctaButton: 'Request Detailed Analysis',
      disclaimer: 'This analysis is a preliminary estimate based on regional averages. A detailed analysis with your actual consumption data will provide more accurate projections.',
      footer: 'kWh Québec - Solar + Storage',
      footerNote: 'This email was sent automatically following your quick analysis request.',
    },
  };
  
  const txt = t[lang];
  
  return `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: linear-gradient(135deg, #003DA6 0%, #1e5a9f 100%); color: white; padding: 30px; text-align: center; }
    .header img { max-width: 180px; height: auto; }
    .header h1 { margin: 15px 0 0; font-size: 22px; font-weight: 600; }
    .content { padding: 30px; }
    .intro { font-size: 15px; color: #555; margin-bottom: 25px; }
    .section { margin-bottom: 25px; }
    .section-title { font-size: 16px; font-weight: 600; color: #003DA6; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #FFB005; }
    .info-grid { display: table; width: 100%; }
    .info-row { display: table-row; }
    .info-label { display: table-cell; padding: 8px 10px 8px 0; color: #666; font-size: 14px; width: 50%; }
    .info-value { display: table-cell; padding: 8px 0; font-weight: 600; color: #333; font-size: 14px; text-align: right; }
    .highlight-box { background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); border-radius: 8px; padding: 20px; margin: 20px 0; }
    .highlight-title { font-size: 14px; color: #2e7d32; font-weight: 600; margin-bottom: 10px; }
    .highlight-value { font-size: 28px; font-weight: 700; color: #1b5e20; }
    .highlight-subtext { font-size: 13px; color: #388e3c; margin-top: 5px; }
    .savings-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #eee; }
    .savings-row:last-child { border-bottom: none; }
    .cta-section { background: #003DA6; color: white; padding: 25px; text-align: center; margin-top: 20px; }
    .cta-section h3 { margin: 0 0 10px; font-size: 18px; }
    .cta-section p { margin: 0 0 20px; font-size: 14px; opacity: 0.9; }
    .cta-button { display: inline-block; background: #FFB005; color: #003DA6; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 15px; }
    .disclaimer { font-size: 12px; color: #888; padding: 20px 30px; background: #fafafa; border-top: 1px solid #eee; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background: #f0f0f0; }
    .metric-card { background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 10px; }
    .metric-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
    .metric-value { font-size: 24px; font-weight: 700; color: #003DA6; margin-top: 5px; }
    .metric-unit { font-size: 14px; font-weight: 400; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${logoUrl}" alt="kWh Québec" />
      <h1>${txt.analysisTitle}</h1>
    </div>
    
    <div class="content">
      <p class="intro">${txt.greeting}<br><br>${txt.intro}</p>
      
      <div class="section">
        <div class="info-grid">
          <div class="info-row">
            <div class="info-label">${txt.addressLabel}</div>
            <div class="info-value">${data.address}</div>
          </div>
          <div class="info-row">
            <div class="info-label">${txt.buildingTypeLabel}</div>
            <div class="info-value">${getBuildingTypeLabel(data.buildingType, lang)}</div>
          </div>
          <div class="info-row">
            <div class="info-label">${txt.tariffLabel}</div>
            <div class="info-value">${data.tariffCode}</div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">${txt.systemTitle}</div>
        <div style="display: flex; gap: 15px; flex-wrap: wrap;">
          <div class="metric-card" style="flex: 1; min-width: 150px;">
            <div class="metric-label">${txt.systemSize}</div>
            <div class="metric-value">${data.systemSizeKW} <span class="metric-unit">kW</span></div>
          </div>
          <div class="metric-card" style="flex: 1; min-width: 150px;">
            <div class="metric-label">${txt.annualProduction}</div>
            <div class="metric-value">${formatNumber(data.annualProductionKWh)} <span class="metric-unit">kWh</span></div>
          </div>
        </div>
        ${data.hasRoofData && data.roofAreaM2 ? `
        <div class="info-grid" style="margin-top: 10px;">
          <div class="info-row">
            <div class="info-label">${txt.roofArea}</div>
            <div class="info-value">${formatNumber(data.roofAreaM2)} m²</div>
          </div>
        </div>
        ` : ''}
      </div>
      
      <div class="highlight-box">
        <div class="highlight-title">${txt.monthlySavings}</div>
        <div class="highlight-value">${formatCurrency(data.monthlySavings)}</div>
        <div class="highlight-subtext">${txt.monthlyBillBefore}: ${formatCurrency(data.monthlyBillBefore)} → ${txt.monthlyBillAfter}: ${formatCurrency(data.monthlyBillAfter)}</div>
      </div>
      
      <div class="section">
        <div class="section-title">${txt.financialTitle}</div>
        <div class="info-grid">
          <div class="info-row">
            <div class="info-label">${txt.annualSavings}</div>
            <div class="info-value" style="color: #2e7d32;">${formatCurrency(data.annualSavings)}</div>
          </div>
          <div class="info-row">
            <div class="info-label">${txt.grossCost}</div>
            <div class="info-value">${formatCurrency(data.grossCAPEX)}</div>
          </div>
          <div class="info-row">
            <div class="info-label">${txt.hqIncentive}</div>
            <div class="info-value" style="color: #2e7d32;">-${formatCurrency(data.hqIncentive)}</div>
          </div>
          <div class="info-row">
            <div class="info-label">${txt.netCost}</div>
            <div class="info-value" style="font-weight: 700;">${formatCurrency(data.netCAPEX)}</div>
          </div>
          <div class="info-row">
            <div class="info-label">${txt.paybackPeriod}</div>
            <div class="info-value">${data.paybackYears} ${txt.years}</div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="cta-section">
      <h3>${txt.ctaTitle}</h3>
      <p>${txt.ctaText}</p>
      <a href="${baseUrl}/#detailed" class="cta-button">${txt.ctaButton}</a>
    </div>
    
    <div class="disclaimer">
      ${txt.disclaimer}
    </div>
    
    <div class="footer">
      <p><strong>${txt.footer}</strong></p>
      <p>${txt.footerNote}</p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendQuickAnalysisEmail(
  email: string,
  data: QuickAnalysisData,
  baseUrl: string
): Promise<{ success: boolean; error?: string }> {
  const lang = detectLanguage(data.tariffCode, data.address);
  
  const subject = lang === 'fr' 
    ? '[kWh Québec] Votre analyse rapide solaire' 
    : '[kWh Québec] Your Quick Solar Analysis';
  
  const htmlBody = generateQuickAnalysisEmailHtml(data, lang, baseUrl);
  
  console.log(`[EmailService] Sending quick analysis email to ${email} (lang: ${lang})`);
  
  const result = await sendEmail({
    to: email,
    subject,
    htmlBody,
  });
  
  if (result.success) {
    console.log(`[EmailService] Quick analysis email sent successfully to ${email}`);
  } else {
    console.error(`[EmailService] Failed to send quick analysis email: ${result.error}`);
  }
  
  return result;
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
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const host = process.env.REPL_SLUG ? `${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : 'localhost:5000';
  const loginUrl = `${protocol}://${host}/login`;
  
  const rendered = renderEmailTemplate('passwordReset', language, {
    tempPassword,
    loginUrl,
  });
  
  console.log(`[EmailService] Sending password reset email to ${email} (lang: ${language})`);
  
  const result = await sendEmail({
    to: email,
    subject: rendered.subject,
    htmlBody: rendered.html,
  });
  
  if (result.success) {
    console.log(`[EmailService] Password reset email sent successfully to ${email}`);
  } else {
    console.error(`[EmailService] Failed to send password reset email: ${result.error}`);
  }
  
  return result;
}

function getRoleLabel(role: string, lang: 'fr' | 'en'): string {
  const labels: Record<string, { fr: string; en: string }> = {
    admin: { fr: 'Administrateur', en: 'Administrator' },
    analyst: { fr: 'Analyste', en: 'Analyst' },
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
  
  console.log(`[EmailService] Sending welcome email to ${data.userEmail} (lang: ${language})`);
  
  const result = await sendEmail({
    to: data.userEmail,
    subject: rendered.subject,
    htmlBody: rendered.html,
  });
  
  if (result.success) {
    console.log(`[EmailService] Welcome email sent successfully to ${data.userEmail}`);
  } else {
    console.error(`[EmailService] Failed to send welcome email: ${result.error}`);
  }
  
  return result;
}

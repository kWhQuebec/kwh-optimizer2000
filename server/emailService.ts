import { sendEmail as sendEmailViaGmail } from "./gmail";
import { sendEmailViaOutlook } from "./outlook";
import { sendEmailViaResend } from "./resend";
import { renderEmailTemplate } from "./emailTemplates";

// Primary: Resend (more reliable for transactional emails)
// Fallback chain: Resend -> Gmail -> Outlook
async function sendEmail(options: { to: string; subject: string; htmlBody: string; textBody?: string }): Promise<{ success: boolean; messageId?: string; error?: string }> {
  console.log('[EmailService] Attempting to send via Resend (primary)...');
  
  // Primary: Resend
  try {
    const resendResult = await sendEmailViaResend(options);
    if (resendResult.success) {
      console.log('[EmailService] Email sent successfully via Resend');
      return resendResult;
    }
    console.log('[EmailService] Resend failed, trying Gmail...');
    console.log('[EmailService] Resend error:', resendResult.error);
  } catch (error: any) {
    console.log('[EmailService] Resend threw exception, trying Gmail...');
    console.log('[EmailService] Exception:', error.message);
  }
  
  // Fallback: Gmail
  try {
    const gmailResult = await sendEmailViaGmail(options);
    if (gmailResult.success) {
      console.log('[EmailService] Email sent successfully via Gmail (fallback)');
      return gmailResult;
    }
    console.log('[EmailService] Gmail also failed, trying Outlook...');
    console.log('[EmailService] Gmail error:', gmailResult.error);
  } catch (error: any) {
    console.log('[EmailService] Gmail threw exception, trying Outlook...');
    console.log('[EmailService] Exception:', error.message);
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
      ctaTitle: 'Prêt à passer à l\'étape suivante?',
      ctaText: 'Obtenez une analyse détaillée gratuite avec des données de consommation réelles et un design personnalisé pour votre bâtiment.',
      ctaButton: 'Demander une analyse détaillée',
      disclaimer: 'Cette analyse est une estimation préliminaire basée sur des moyennes régionales. Une analyse détaillée avec vos données de consommation réelles fournira des projections plus précises. La "compensation" représente le bilan annuel via le programme de mesurage net d\'Hydro-Québec.',
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
      ctaTitle: 'Ready for the next step?',
      ctaText: 'Get a free detailed analysis with your actual consumption data and a custom design for your building.',
      ctaButton: 'Request Detailed Analysis',
      disclaimer: 'This analysis is a preliminary estimate based on regional averages. A detailed analysis with your actual consumption data will provide more accurate projections. "Offset" represents the annual balance via Hydro-Québec\'s net metering program.',
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
      <div style="background: ${isRecommended ? 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)' : '#f8f9fa'}; border-radius: 8px; padding: 20px; margin-bottom: 15px; ${isRecommended ? 'border: 2px solid #003DA6;' : 'border: 1px solid #e0e0e0;'}">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 8px;">
          <div>
            <span style="font-size: 18px; font-weight: 700; color: #003DA6;">${labels.title}</span>
            <span style="font-size: 14px; color: #666; margin-left: 8px;">(${labels.subtitle})</span>
          </div>
          ${isRecommended ? `<span style="background: #003DA6; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600;">${txt.recommended}</span>` : ''}
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
            <div style="display: table-cell; padding: 6px 0; font-weight: 700; color: #2e7d32; text-align: right;">${formatCurrency(scenario.annualSavings)}</div>
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
            <div style="display: table-cell; padding: 6px 0; font-weight: 600; color: #2e7d32; text-align: right;">-${scenario.lcoeSavingsPercent}%</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
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
    .section-title { font-size: 18px; font-weight: 600; color: #003DA6; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #FFB005; }
    .info-grid { display: table; width: 100%; margin-bottom: 20px; }
    .info-row { display: table-row; }
    .info-label { display: table-cell; padding: 8px 10px 8px 0; color: #666; font-size: 14px; width: 50%; }
    .info-value { display: table-cell; padding: 8px 0; font-weight: 600; color: #333; font-size: 14px; text-align: right; }
    .scenarios-intro { font-size: 14px; color: #555; margin-bottom: 20px; }
    .cta-section { background: #003DA6; color: white; padding: 25px; text-align: center; margin-top: 20px; }
    .cta-section h3 { margin: 0 0 10px; font-size: 18px; }
    .cta-section p { margin: 0 0 20px; font-size: 14px; opacity: 0.9; }
    .cta-button { display: inline-block; background: #FFB005; color: #003DA6; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 15px; }
    .disclaimer { font-size: 12px; color: #888; padding: 20px 30px; background: #fafafa; border-top: 1px solid #eee; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background: #f0f0f0; }
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
            <div class="info-value">${data.address || '-'}</div>
          </div>
          <div class="info-row">
            <div class="info-label">${txt.consumptionLabel}</div>
            <div class="info-value">${formatNumber(data.annualConsumptionKWh)} kWh</div>
          </div>
          <div class="info-row">
            <div class="info-label">${txt.buildingTypeLabel}</div>
            <div class="info-value">${getBuildingTypeLabel(data.buildingType, lang)}</div>
          </div>
          <div class="info-row">
            <div class="info-label">${txt.tariffLabel}</div>
            <div class="info-value">${data.tariffCode}</div>
          </div>
          <div class="info-row">
            <div class="info-label">${txt.currentBillLabel}</div>
            <div class="info-value">${formatCurrency(data.monthlyBillBefore)}</div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">${txt.scenariosTitle}</div>
        <p class="scenarios-intro">${txt.scenariosIntro}</p>
        ${scenariosHtml}
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
      <p>${txt.footerContact}</p>
      <p style="font-size: 11px; color: #999;">${txt.footerNote}</p>
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
  const baseUrl = `${protocol}://${host}`;
  const loginUrl = `${baseUrl}/login`;
  const logoUrl = `${baseUrl}/assets/${language === 'fr' ? 'logo-fr.png' : 'logo-en.png'}`;
  
  const rendered = renderEmailTemplate('passwordReset', language, {
    tempPassword,
    loginUrl,
    logoUrl,
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
  const logoUrl = `${baseUrl}/assets/${language === 'fr' ? 'logo-fr.png' : 'logo-en.png'}`;
  
  const rendered = renderEmailTemplate('userWelcome', language, {
    userName: data.userName || data.userEmail.split('@')[0],
    userEmail: data.userEmail,
    userRole: getRoleLabel(data.userRole, language),
    tempPassword: data.tempPassword || '',
    loginUrl,
    logoUrl,
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

function generateHqProcurationEmailHtml(clientName: string, lang: 'fr' | 'en', baseUrl: string, clientId?: string): string {
  const procurationUrl = clientId 
    ? `${baseUrl}/autorisation-hq?clientId=${clientId}`
    : `${baseUrl}/autorisation-hq`;
  
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
  
  return `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: white; padding: 15px 20px 5px; text-align: center; }
    .header img { max-width: 180px; height: auto; }
    .header h1 { display: none; }
    .content { padding: 10px 30px 20px; }
    .greeting { font-size: 14px; color: #555; margin-bottom: 12px; }
    .intro { font-size: 14px; color: #555; margin-bottom: 15px; line-height: 1.5; }
    .section { margin-bottom: 15px; }
    .section-title { font-size: 15px; font-weight: 600; color: #003DA6; margin-bottom: 8px; }
    .section-text { font-size: 14px; color: #555; margin-bottom: 6px; }
    .benefit-list { margin: 0; padding-left: 20px; font-size: 14px; }
    .benefit-list li { margin-bottom: 2px; color: #555; line-height: 1.4; }
    .cta-section { text-align: center; margin: 20px 0; }
    .cta-button { display: inline-block; background: #FFB005; color: #003DA6; padding: 16px 40px; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 16px; }
    .questions { font-size: 14px; color: #666; text-align: center; margin-top: 15px; }
    .footer { text-align: center; padding: 15px; color: #666; font-size: 13px; background: #f0f0f0; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${baseUrl}/assets/${lang === 'fr' ? 'logo-fr.png' : 'logo-en.png'}" alt="kWh Québec" />
      <h1>${lang === 'fr' ? 'Autorisation d\'accès aux données Hydro-Québec' : 'Hydro-Québec Data Access Authorization'}</h1>
    </div>
    
    <div class="content">
      <p class="greeting">${txt.greeting}</p>
      <p class="intro">${txt.intro}</p>
      
      <div class="section">
        <div class="section-title">${txt.whyTitle}</div>
        <p class="section-text">${txt.whyText}</p>
        <ul class="benefit-list">
          <li>${txt.benefit1}</li>
          <li>${txt.benefit2}</li>
          <li>${txt.benefit3}</li>
          <li>${txt.benefit4}</li>
        </ul>
      </div>
      
      <div class="section">
        <div class="section-title">${txt.actionTitle}</div>
        <p class="section-text">${txt.actionText}</p>
      </div>
      
      <div class="cta-section">
        <a href="${procurationUrl}" class="cta-button">${txt.ctaButton}</a>
      </div>
      
      <p class="questions">${txt.questions}</p>
    </div>
    
    <div class="footer">
      <strong>${txt.footer}</strong>
    </div>
  </div>
</body>
</html>`;
}

function generateHqProcurationTextEmail(clientName: string, lang: 'fr' | 'en', baseUrl: string, clientId?: string): string {
  const procurationUrl = clientId 
    ? `${baseUrl}/autorisation-hq?clientId=${clientId}`
    : `${baseUrl}/autorisation-hq`;
  
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
  // Plain text version - multipart emails are less likely to be flagged as spam
  const textBody = generateHqProcurationTextEmail(clientName, language, baseUrl, clientId);
  
  console.log(`[EmailService] Sending HQ procuration email to ${email} for ${clientName} (lang: ${language})`);
  
  const result = await sendEmail({
    to: email,
    subject,
    htmlBody,
    textBody,
  });
  
  if (result.success) {
    console.log(`[EmailService] HQ procuration email sent successfully to ${email}`);
  } else {
    console.error(`[EmailService] Failed to send HQ procuration email: ${result.error}`);
  }
  
  return result;
}

export async function sendProcurationNotificationToAccountManager(
  accountManagerEmail: string,
  clientName: string,
  clientEmail: string,
  language: 'fr' | 'en'
): Promise<{ success: boolean; error?: string }> {
  const subject = language === 'fr'
    ? `Procuration HQ envoyée - ${clientName}`
    : `HQ Procuration Sent - ${clientName}`;
  
  const htmlBody = `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f5f5f5; }
    .container { max-width: 500px; margin: 0 auto; background: white; padding: 25px; border-radius: 8px; }
    .header { color: #003DA6; font-size: 18px; font-weight: 600; margin-bottom: 15px; }
    .info { margin: 10px 0; padding: 12px; background: #f8f9fa; border-radius: 4px; }
    .label { font-size: 12px; color: #666; text-transform: uppercase; }
    .value { font-size: 15px; color: #333; font-weight: 500; }
    .footer { margin-top: 20px; font-size: 13px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">${language === 'fr' ? 'Notification: Procuration HQ envoyée' : 'Notification: HQ Procuration Sent'}</div>
    <p>${language === 'fr' 
      ? 'Un courriel de demande de procuration Hydro-Québec a été envoyé au client suivant:'
      : 'An HQ procuration request email has been sent to the following client:'}</p>
    <div class="info">
      <div class="label">${language === 'fr' ? 'Client' : 'Client'}</div>
      <div class="value">${clientName}</div>
    </div>
    <div class="info">
      <div class="label">${language === 'fr' ? 'Courriel' : 'Email'}</div>
      <div class="value">${clientEmail}</div>
    </div>
    <p class="footer">${language === 'fr' 
      ? 'Vous recevrez une notification lorsque le client aura signé la procuration.'
      : 'You will receive a notification when the client signs the procuration.'}</p>
  </div>
</body>
</html>`;

  const textBody = language === 'fr'
    ? `Notification: Procuration HQ envoyée\n\nUn courriel de demande de procuration Hydro-Québec a été envoyé au client suivant:\n\nClient: ${clientName}\nCourriel: ${clientEmail}\n\nVous recevrez une notification lorsque le client aura signé la procuration.`
    : `Notification: HQ Procuration Sent\n\nAn HQ procuration request email has been sent to the following client:\n\nClient: ${clientName}\nEmail: ${clientEmail}\n\nYou will receive a notification when the client signs the procuration.`;

  console.log(`[EmailService] Sending procuration notification to account manager ${accountManagerEmail}`);
  
  const result = await sendEmail({
    to: accountManagerEmail,
    subject,
    htmlBody,
    textBody,
  });
  
  if (result.success) {
    console.log(`[EmailService] Procuration notification sent to ${accountManagerEmail}`);
  } else {
    console.error(`[EmailService] Failed to send notification to account manager: ${result.error}`);
  }
  
  return result;
}

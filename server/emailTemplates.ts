/**
 * Email Templates for kWh Québec
 * 
 * Bilingual email templates for lead nurturing and notifications.
 * Templates are HTML-based with placeholder substitution.
 */

export interface EmailTemplateData {
  [key: string]: string | number | undefined;
}

export interface EmailTemplate {
  subject: {
    fr: string;
    en: string;
  };
  html: {
    fr: string;
    en: string;
  };
  text: {
    fr: string;
    en: string;
  };
}

// kWh Québec logo as base64 data URI (SVG logo with text)
const kwhLogoDataUri = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNDAgNjAiPjxyZWN0IHdpZHRoPSIyNDAiIGhlaWdodD0iNjAiIGZpbGw9IiMwMDU0QTgiIHJ4PSI0Ii8+PHRleHQgeD0iMTIwIiB5PSI0MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjI4IiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPmtXaCBRdcOpYmVjPC90ZXh0Pjwvc3ZnPg==`;

const baseStyles = `
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #0054A8; }
    .logo { height: 50px; width: auto; }
    .content { padding: 30px 0; }
    .button { display: inline-block; background: #0054A8; color: #ffffff !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; }
    .footer { padding: 20px 0; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center; }
    .highlight { background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .metric { font-size: 24px; font-weight: bold; color: #0054A8; }
    h1, h2 { color: #1f2937; }
    ul { padding-left: 20px; }
    li { margin: 8px 0; }
  </style>
`;

export const emailTemplates: Record<string, EmailTemplate> = {
  
  // Confirmation email after quick analysis request
  quickAnalysisConfirmation: {
    subject: {
      fr: "Votre estimation solaire - kWh Québec",
      en: "Your Solar Estimate - kWh Québec",
    },
    html: {
      fr: `<!DOCTYPE html><html><head>${baseStyles}</head><body>
        <div class="container">
          <div class="header">
            <h1>kWh Québec</h1>
          </div>
          <div class="content">
            <h2>Merci {{contactName}}!</h2>
            <p>Votre estimation rapide pour <strong>{{address}}</strong> a été générée avec succès.</p>
            
            <div class="highlight">
              <p><strong>Résultats préliminaires:</strong></p>
              <ul>
                <li>Capacité PV estimée: <span class="metric">{{pvSizeKW}} kW</span></li>
                <li>Économies annuelles: <span class="metric">{{annualSavings}} $</span></li>
                <li>Retour sur investissement: <span class="metric">{{paybackYears}} ans</span></li>
              </ul>
            </div>
            
            <p>Ces résultats sont basés sur notre analyse satellite et représentent une estimation à ~75% de précision.</p>
            
            <h3>Prochaine étape?</h3>
            <p>Pour une analyse détaillée (~95% précision) basée sur vos données réelles Hydro-Québec, demandez notre <strong>Analyse DÉTAILLÉE gratuite</strong>.</p>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="{{analysisUrl}}" class="button">Demander l'analyse détaillée</a>
            </p>
            
            <p>Des questions? Répondez simplement à ce courriel ou appelez-nous.</p>
          </div>
          <div class="footer">
            <p>kWh Québec - Solaire + stockage clé en main</p>
            <p>info@kwhquebec.com | (514) 555-1234</p>
          </div>
        </div>
      </body></html>`,
      en: `<!DOCTYPE html><html><head>${baseStyles}</head><body>
        <div class="container">
          <div class="header">
            <h1>kWh Québec</h1>
          </div>
          <div class="content">
            <h2>Thank you {{contactName}}!</h2>
            <p>Your quick estimate for <strong>{{address}}</strong> has been generated successfully.</p>
            
            <div class="highlight">
              <p><strong>Preliminary Results:</strong></p>
              <ul>
                <li>Estimated PV capacity: <span class="metric">{{pvSizeKW}} kW</span></li>
                <li>Annual savings: <span class="metric">\${{annualSavings}}</span></li>
                <li>Payback period: <span class="metric">{{paybackYears}} years</span></li>
              </ul>
            </div>
            
            <p>These results are based on our satellite analysis and represent an estimate with ~75% accuracy.</p>
            
            <h3>Next Step?</h3>
            <p>For a detailed analysis (~95% accuracy) based on your actual Hydro-Québec data, request our <strong>FREE Detailed Analysis</strong>.</p>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="{{analysisUrl}}" class="button">Request Detailed Analysis</a>
            </p>
            
            <p>Questions? Simply reply to this email or give us a call.</p>
          </div>
          <div class="footer">
            <p>kWh Québec - Turnkey solar + storage</p>
            <p>info@kwhquebec.com | (514) 555-1234</p>
          </div>
        </div>
      </body></html>`,
    },
    text: {
      fr: `Merci {{contactName}}!\n\nVotre estimation rapide pour {{address}} a été générée.\n\nRésultats préliminaires:\n- Capacité PV: {{pvSizeKW}} kW\n- Économies annuelles: {{annualSavings}} $\n- Retour: {{paybackYears}} ans\n\nPour une analyse détaillée gratuite: {{analysisUrl}}\n\nkWh Québec\ninfo@kwhquebec.com`,
      en: `Thank you {{contactName}}!\n\nYour quick estimate for {{address}} has been generated.\n\nPreliminary Results:\n- PV capacity: {{pvSizeKW}} kW\n- Annual savings: \${{annualSavings}}\n- Payback: {{paybackYears}} years\n\nFor a free detailed analysis: {{analysisUrl}}\n\nkWh Québec\ninfo@kwhquebec.com`,
    },
  },

  // Confirmation email after detailed analysis request
  detailedAnalysisConfirmation: {
    subject: {
      fr: "Demande d'analyse détaillée reçue - kWh Québec",
      en: "Detailed Analysis Request Received - kWh Québec",
    },
    html: {
      fr: `<!DOCTYPE html><html><head>${baseStyles}</head><body>
        <div class="container">
          <div class="header">
            <h1>kWh Québec</h1>
          </div>
          <div class="content">
            <h2>Merci {{contactName}}!</h2>
            <p>Nous avons bien reçu votre demande d'analyse détaillée pour <strong>{{companyName}}</strong>.</p>
            
            <div class="highlight">
              <h3>Prochaines étapes:</h3>
              <ol>
                <li><strong>Signature de la procuration HQ</strong> - Vous recevrez un lien de signature électronique dans les prochaines heures.</li>
                <li><strong>Récupération des données</strong> - Nous obtiendrons votre historique de consommation Hydro-Québec.</li>
                <li><strong>Analyse complète</strong> - Simulation 8 760 heures de votre système optimal.</li>
                <li><strong>Rapport</strong> - Vous recevrez votre rapport détaillé dans 5 jours ouvrables.</li>
              </ol>
            </div>
            
            <p><strong>Ce que vous obtiendrez:</strong></p>
            <ul>
              <li>Configuration optimale PV + batterie</li>
              <li>Projections financières sur 25 ans</li>
              <li>Comparaison des options de financement</li>
              <li>Rapport PDF professionnel</li>
            </ul>
            
            <p>Des questions? Répondez simplement à ce courriel.</p>
          </div>
          <div class="footer">
            <p>kWh Québec - Solaire + stockage clé en main</p>
            <p>info@kwhquebec.com | (514) 555-1234</p>
          </div>
        </div>
      </body></html>`,
      en: `<!DOCTYPE html><html><head>${baseStyles}</head><body>
        <div class="container">
          <div class="header">
            <h1>kWh Québec</h1>
          </div>
          <div class="content">
            <h2>Thank you {{contactName}}!</h2>
            <p>We have received your detailed analysis request for <strong>{{companyName}}</strong>.</p>
            
            <div class="highlight">
              <h3>Next Steps:</h3>
              <ol>
                <li><strong>HQ Authorization Signature</strong> - You will receive an e-signature link within the next few hours.</li>
                <li><strong>Data Retrieval</strong> - We will obtain your Hydro-Québec consumption history.</li>
                <li><strong>Complete Analysis</strong> - 8,760-hour simulation of your optimal system.</li>
                <li><strong>Report</strong> - You will receive your detailed report within 5 business days.</li>
              </ol>
            </div>
            
            <p><strong>What you will get:</strong></p>
            <ul>
              <li>Optimal PV + battery configuration</li>
              <li>25-year financial projections</li>
              <li>Financing options comparison</li>
              <li>Professional PDF report</li>
            </ul>
            
            <p>Questions? Simply reply to this email.</p>
          </div>
          <div class="footer">
            <p>kWh Québec - Turnkey solar + storage</p>
            <p>info@kwhquebec.com | (514) 555-1234</p>
          </div>
        </div>
      </body></html>`,
    },
    text: {
      fr: `Merci {{contactName}}!\n\nNous avons bien reçu votre demande d'analyse détaillée pour {{companyName}}.\n\nProchaines étapes:\n1. Signature de la procuration HQ\n2. Récupération des données\n3. Analyse complète (simulation 8 760h)\n4. Rapport dans 5 jours ouvrables\n\nkWh Québec\ninfo@kwhquebec.com`,
      en: `Thank you {{contactName}}!\n\nWe have received your detailed analysis request for {{companyName}}.\n\nNext Steps:\n1. HQ Authorization Signature\n2. Data Retrieval\n3. Complete Analysis (8,760h simulation)\n4. Report within 5 business days\n\nkWh Québec\ninfo@kwhquebec.com`,
    },
  },

  // Nurturing email 1: Incentives reminder (Day 3)
  nurturingIncentives: {
    subject: {
      fr: "Saviez-vous? Jusqu'à 60% de votre projet solaire couvert",
      en: "Did you know? Up to 60% of your solar project covered",
    },
    html: {
      fr: `<!DOCTYPE html><html><head>${baseStyles}</head><body>
        <div class="container">
          <div class="header">
            <h1>kWh Québec</h1>
          </div>
          <div class="content">
            <h2>Bonjour {{contactName}},</h2>
            <p>Suite à votre intérêt pour le solaire, voici un rappel des incitatifs disponibles au Québec:</p>
            
            <div class="highlight">
              <h3>💰 Incitatifs cumulables:</h3>
              <ul>
                <li><strong>Crédit Hydro-Québec:</strong> Jusqu'à 40% du coût (plafonné)</li>
                <li><strong>Crédit fédéral:</strong> 30% pour technologies propres</li>
                <li><strong>Amortissement accéléré:</strong> 100% déductible en 1ère année</li>
              </ul>
              <p><strong>Total potentiel: jusqu'à 60% du projet!</strong></p>
            </div>
            
            <p>Ces programmes peuvent changer à tout moment. Le meilleur moment pour agir, c'est maintenant.</p>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="{{analysisUrl}}" class="button">Obtenir mon analyse gratuite</a>
            </p>
          </div>
          <div class="footer">
            <p>kWh Québec - Solaire + stockage clé en main</p>
            <p><a href="{{unsubscribeUrl}}">Se désabonner</a></p>
          </div>
        </div>
      </body></html>`,
      en: `<!DOCTYPE html><html><head>${baseStyles}</head><body>
        <div class="container">
          <div class="header">
            <h1>kWh Québec</h1>
          </div>
          <div class="content">
            <h2>Hello {{contactName}},</h2>
            <p>Following your interest in solar, here's a reminder of available incentives in Quebec:</p>
            
            <div class="highlight">
              <h3>💰 Stackable Incentives:</h3>
              <ul>
                <li><strong>Hydro-Québec Credit:</strong> Up to 40% of cost (capped)</li>
                <li><strong>Federal Credit:</strong> 30% for clean technology</li>
                <li><strong>Accelerated Depreciation:</strong> 100% deductible in year 1</li>
              </ul>
              <p><strong>Total potential: up to 60% of the project!</strong></p>
            </div>
            
            <p>These programs can change at any time. The best time to act is now.</p>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="{{analysisUrl}}" class="button">Get My Free Analysis</a>
            </p>
          </div>
          <div class="footer">
            <p>kWh Québec - Turnkey solar + storage</p>
            <p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>
          </div>
        </div>
      </body></html>`,
    },
    text: {
      fr: `Bonjour {{contactName}},\n\nIncitatifs solaires au Québec:\n- Hydro-Québec: jusqu'à 40%\n- Fédéral: 30%\n- Amortissement: 100% an 1\n\nTotal: jusqu'à 60%!\n\nAnalyse gratuite: {{analysisUrl}}\n\nkWh Québec`,
      en: `Hello {{contactName}},\n\nQuebec Solar Incentives:\n- Hydro-Québec: up to 40%\n- Federal: 30%\n- Depreciation: 100% year 1\n\nTotal: up to 60%!\n\nFree analysis: {{analysisUrl}}\n\nkWh Québec`,
    },
  },

  // Nurturing email 2: Case study / social proof (Day 7)
  nurturingCaseStudy: {
    subject: {
      fr: "Comment une entreprise québécoise économise 45 000$/an avec le solaire",
      en: "How a Quebec business saves $45,000/year with solar",
    },
    html: {
      fr: `<!DOCTYPE html><html><head>${baseStyles}</head><body>
        <div class="container">
          <div class="header">
            <h1>kWh Québec</h1>
          </div>
          <div class="content">
            <h2>Bonjour {{contactName}},</h2>
            <p>Voici l'histoire d'un projet récent qui pourrait vous inspirer:</p>
            
            <div class="highlight">
              <h3>📍 Entrepôt industriel, Région de Montréal</h3>
              <ul>
                <li><strong>Système installé:</strong> 200 kW PV + 100 kWh stockage</li>
                <li><strong>Investissement net:</strong> 180 000$ (après incitatifs)</li>
                <li><strong>Économies annuelles:</strong> 45 000$</li>
                <li><strong>Retour sur investissement:</strong> 4 ans</li>
                <li><strong>TRI:</strong> 22%</li>
              </ul>
            </div>
            
            <p>Chaque bâtiment est unique. Votre potentiel pourrait être encore meilleur!</p>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="{{analysisUrl}}" class="button">Découvrir mon potentiel</a>
            </p>
          </div>
          <div class="footer">
            <p>kWh Québec - Solaire + stockage clé en main</p>
            <p><a href="{{unsubscribeUrl}}">Se désabonner</a></p>
          </div>
        </div>
      </body></html>`,
      en: `<!DOCTYPE html><html><head>${baseStyles}</head><body>
        <div class="container">
          <div class="header">
            <h1>kWh Québec</h1>
          </div>
          <div class="content">
            <h2>Hello {{contactName}},</h2>
            <p>Here's a recent project story that might inspire you:</p>
            
            <div class="highlight">
              <h3>📍 Industrial Warehouse, Montreal Region</h3>
              <ul>
                <li><strong>System installed:</strong> 200 kW PV + 100 kWh storage</li>
                <li><strong>Net investment:</strong> $180,000 (after incentives)</li>
                <li><strong>Annual savings:</strong> $45,000</li>
                <li><strong>Payback:</strong> 4 years</li>
                <li><strong>IRR:</strong> 22%</li>
              </ul>
            </div>
            
            <p>Every building is unique. Your potential could be even better!</p>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="{{analysisUrl}}" class="button">Discover My Potential</a>
            </p>
          </div>
          <div class="footer">
            <p>kWh Québec - Turnkey solar + storage</p>
            <p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>
          </div>
        </div>
      </body></html>`,
    },
    text: {
      fr: `Bonjour {{contactName}},\n\nÉtude de cas - Entrepôt Montréal:\n- Système: 200 kW + 100 kWh\n- Investissement net: 180 000$\n- Économies: 45 000$/an\n- Retour: 4 ans\n\nDécouvrez votre potentiel: {{analysisUrl}}\n\nkWh Québec`,
      en: `Hello {{contactName}},\n\nCase Study - Montreal Warehouse:\n- System: 200 kW + 100 kWh\n- Net investment: $180,000\n- Savings: $45,000/year\n- Payback: 4 years\n\nDiscover your potential: {{analysisUrl}}\n\nkWh Québec`,
    },
  },

  // Analysis report ready notification
  analysisReportReady: {
    subject: {
      fr: "Votre rapport d'analyse solaire est prêt! 🌞",
      en: "Your Solar Analysis Report is Ready! 🌞",
    },
    html: {
      fr: `<!DOCTYPE html><html><head>${baseStyles}</head><body>
        <div class="container">
          <div class="header">
            <h1>kWh Québec</h1>
          </div>
          <div class="content">
            <h2>Bonne nouvelle {{contactName}}!</h2>
            <p>Votre rapport d'analyse détaillée pour <strong>{{siteName}}</strong> est maintenant disponible.</p>
            
            <div class="highlight">
              <h3>Résumé de votre système optimal:</h3>
              <ul>
                <li><strong>PV recommandé:</strong> {{pvSizeKW}} kW</li>
                <li><strong>Stockage:</strong> {{batteryKWh}} kWh</li>
                <li><strong>VAN sur 25 ans:</strong> {{npv}} $</li>
                <li><strong>Retour sur investissement:</strong> {{paybackYears}} ans</li>
              </ul>
            </div>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="{{reportUrl}}" class="button">Voir mon rapport complet</a>
            </p>
            
            <p>Nous vous contacterons dans les prochains jours pour discuter des résultats et répondre à vos questions.</p>
          </div>
          <div class="footer">
            <p>kWh Québec - Solaire + stockage clé en main</p>
            <p>info@kwhquebec.com | (514) 555-1234</p>
          </div>
        </div>
      </body></html>`,
      en: `<!DOCTYPE html><html><head>${baseStyles}</head><body>
        <div class="container">
          <div class="header">
            <h1>kWh Québec</h1>
          </div>
          <div class="content">
            <h2>Great news {{contactName}}!</h2>
            <p>Your detailed analysis report for <strong>{{siteName}}</strong> is now available.</p>
            
            <div class="highlight">
              <h3>Your Optimal System Summary:</h3>
              <ul>
                <li><strong>Recommended PV:</strong> {{pvSizeKW}} kW</li>
                <li><strong>Storage:</strong> {{batteryKWh}} kWh</li>
                <li><strong>25-year NPV:</strong> \${{npv}}</li>
                <li><strong>Payback:</strong> {{paybackYears}} years</li>
              </ul>
            </div>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="{{reportUrl}}" class="button">View My Full Report</a>
            </p>
            
            <p>We will contact you in the coming days to discuss the results and answer your questions.</p>
          </div>
          <div class="footer">
            <p>kWh Québec - Turnkey solar + storage</p>
            <p>info@kwhquebec.com | (514) 555-1234</p>
          </div>
        </div>
      </body></html>`,
    },
    text: {
      fr: `Bonne nouvelle {{contactName}}!\n\nVotre rapport pour {{siteName}} est prêt.\n\nRésumé:\n- PV: {{pvSizeKW}} kW\n- Stockage: {{batteryKWh}} kWh\n- VAN 25 ans: {{npv}} $\n- Retour: {{paybackYears}} ans\n\nVoir le rapport: {{reportUrl}}\n\nkWh Québec`,
      en: `Great news {{contactName}}!\n\nYour report for {{siteName}} is ready.\n\nSummary:\n- PV: {{pvSizeKW}} kW\n- Storage: {{batteryKWh}} kWh\n- 25-year NPV: \${{npv}}\n- Payback: {{paybackYears}} years\n\nView report: {{reportUrl}}\n\nkWh Québec`,
    },
  },

  // Password reset email
  passwordReset: {
    subject: {
      fr: "Réinitialisation de votre mot de passe - kWh Québec",
      en: "Password Reset - kWh Québec",
    },
    html: {
      fr: `<!DOCTYPE html><html><head>${baseStyles}</head><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white;">
          <div style="text-align: center; padding: 25px 20px; background: linear-gradient(135deg, #003DA6 0%, #0054A8 100%);">
            <img src="${kwhLogoDataUri}" alt="kWh Québec" style="height: 50px; width: auto;" />
          </div>
          <div style="padding: 30px;">
            <h2 style="color: #1f2937; margin-top: 0;">Réinitialisation de mot de passe</h2>
            <p style="color: #555;">Votre mot de passe a été réinitialisé.</p>
            
            <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <p style="margin: 0 0 12px 0;"><strong>Votre nouveau mot de passe temporaire:</strong></p>
              <code style="background: #e5e7eb; padding: 8px 16px; border-radius: 4px; font-family: monospace; font-size: 18px; display: inline-block;">{{tempPassword}}</code>
            </div>
            
            <p><strong>Important:</strong> Lors de votre prochaine connexion, vous devrez choisir un nouveau mot de passe personnel pour sécuriser votre compte.</p>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="{{loginUrl}}" style="display: inline-block; background-color: #0054A8; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Se connecter</a>
            </p>
            
            <p style="font-size: 12px; color: #6b7280;">Si vous n'avez pas demandé cette réinitialisation, veuillez contacter immédiatement l'administrateur.</p>
          </div>
          <div style="padding: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center; background-color: #fafafa;">
            <p style="margin: 0 0 5px 0;"><strong>kWh Québec</strong> - Solaire + stockage clé en main</p>
            <p style="margin: 0;">Tel: 514.427.8871 | info@kwh.quebec | www.kwh.quebec</p>
          </div>
        </div>
      </body></html>`,
      en: `<!DOCTYPE html><html><head>${baseStyles}</head><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white;">
          <div style="text-align: center; padding: 25px 20px; background: linear-gradient(135deg, #003DA6 0%, #0054A8 100%);">
            <img src="${kwhLogoDataUri}" alt="kWh Québec" style="height: 50px; width: auto;" />
          </div>
          <div style="padding: 30px;">
            <h2 style="color: #1f2937; margin-top: 0;">Password Reset</h2>
            <p style="color: #555;">Your password has been reset.</p>
            
            <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <p style="margin: 0 0 12px 0;"><strong>Your new temporary password:</strong></p>
              <code style="background: #e5e7eb; padding: 8px 16px; border-radius: 4px; font-family: monospace; font-size: 18px; display: inline-block;">{{tempPassword}}</code>
            </div>
            
            <p><strong>Important:</strong> On your next login, you will need to choose a new personal password to secure your account.</p>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="{{loginUrl}}" style="display: inline-block; background-color: #0054A8; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Sign In</a>
            </p>
            
            <p style="font-size: 12px; color: #6b7280;">If you did not request this reset, please contact the administrator immediately.</p>
          </div>
          <div style="padding: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center; background-color: #fafafa;">
            <p style="margin: 0 0 5px 0;"><strong>kWh Québec</strong> - Turnkey solar + storage</p>
            <p style="margin: 0;">Tel: 514.427.8871 | info@kwh.quebec | www.kwh.quebec</p>
          </div>
        </div>
      </body></html>`,
    },
    text: {
      fr: `Réinitialisation de mot de passe\n\nVotre mot de passe a été réinitialisé.\n\nVotre nouveau mot de passe temporaire: {{tempPassword}}\n\nImportant: Lors de votre prochaine connexion, vous devrez choisir un nouveau mot de passe.\n\nConnectez-vous: {{loginUrl}}\n\nSi vous n'avez pas demandé cette réinitialisation, contactez immédiatement l'administrateur.\n\nkWh Québec\nTel: 514.427.8871 | info@kwh.quebec`,
      en: `Password Reset\n\nYour password has been reset.\n\nYour new temporary password: {{tempPassword}}\n\nImportant: On your next login, you will need to choose a new password.\n\nSign in: {{loginUrl}}\n\nIf you did not request this reset, please contact the administrator immediately.\n\nkWh Québec\nTel: 514.427.8871 | info@kwh.quebec`,
    },
  },

  // Welcome email for new user account
  userWelcome: {
    subject: {
      fr: "Bienvenue sur la plateforme kWh Québec",
      en: "Welcome to kWh Québec Platform",
    },
    html: {
      fr: `<!DOCTYPE html><html><head>${baseStyles}</head><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white;">
          <div style="text-align: center; padding: 25px 20px; background: linear-gradient(135deg, #003DA6 0%, #0054A8 100%);">
            <img src="${kwhLogoDataUri}" alt="kWh Québec" style="height: 50px; width: auto;" />
          </div>
          <div style="padding: 30px;">
            <h2 style="color: #1f2937; margin-top: 0;">Bienvenue {{userName}}!</h2>
            <p style="color: #555;">Un compte a été créé pour vous sur la plateforme kWh Québec.</p>
            
            <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 12px 0;"><strong>Vos informations de connexion:</strong></p>
              <ul style="padding-left: 20px; margin: 0;">
                <li style="margin: 8px 0;"><strong>Courriel:</strong> {{userEmail}}</li>
                <li style="margin: 8px 0;"><strong>Mot de passe temporaire:</strong> <code style="background: #e5e7eb; padding: 2px 8px; border-radius: 4px; font-family: monospace;">{{tempPassword}}</code></li>
                <li style="margin: 8px 0;"><strong>Rôle:</strong> {{userRole}}</li>
              </ul>
            </div>
            
            <p><strong>Important:</strong> Lors de votre première connexion, vous devrez choisir un nouveau mot de passe personnel pour sécuriser votre compte.</p>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="{{loginUrl}}" style="display: inline-block; background-color: #0054A8; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Se connecter</a>
            </p>
            
            <p style="color: #666;">Si vous avez des questions, n'hésitez pas à contacter l'administrateur ou à répondre à ce courriel.</p>
          </div>
          <div style="padding: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center; background-color: #fafafa;">
            <p style="margin: 0 0 5px 0;"><strong>kWh Québec</strong> - Solaire + stockage clé en main</p>
            <p style="margin: 0;">Tel: 514.427.8871 | info@kwh.quebec | www.kwh.quebec</p>
          </div>
        </div>
      </body></html>`,
      en: `<!DOCTYPE html><html><head>${baseStyles}</head><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white;">
          <div style="text-align: center; padding: 25px 20px; background: linear-gradient(135deg, #003DA6 0%, #0054A8 100%);">
            <img src="${kwhLogoDataUri}" alt="kWh Québec" style="height: 50px; width: auto;" />
          </div>
          <div style="padding: 30px;">
            <h2 style="color: #1f2937; margin-top: 0;">Welcome {{userName}}!</h2>
            <p style="color: #555;">An account has been created for you on the kWh Québec platform.</p>
            
            <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 12px 0;"><strong>Your login information:</strong></p>
              <ul style="padding-left: 20px; margin: 0;">
                <li style="margin: 8px 0;"><strong>Email:</strong> {{userEmail}}</li>
                <li style="margin: 8px 0;"><strong>Temporary password:</strong> <code style="background: #e5e7eb; padding: 2px 8px; border-radius: 4px; font-family: monospace;">{{tempPassword}}</code></li>
                <li style="margin: 8px 0;"><strong>Role:</strong> {{userRole}}</li>
              </ul>
            </div>
            
            <p><strong>Important:</strong> On your first login, you will need to choose a new personal password to secure your account.</p>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="{{loginUrl}}" style="display: inline-block; background-color: #0054A8; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Sign In</a>
            </p>
            
            <p style="color: #666;">If you have any questions, feel free to contact the administrator or reply to this email.</p>
          </div>
          <div style="padding: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center; background-color: #fafafa;">
            <p style="margin: 0 0 5px 0;"><strong>kWh Québec</strong> - Turnkey solar + storage</p>
            <p style="margin: 0;">Tel: 514.427.8871 | info@kwh.quebec | www.kwh.quebec</p>
          </div>
        </div>
      </body></html>`,
    },
    text: {
      fr: `Bienvenue {{userName}}!\n\nUn compte a été créé pour vous sur la plateforme kWh Québec.\n\nVos informations:\n- Courriel: {{userEmail}}\n- Mot de passe temporaire: {{tempPassword}}\n- Rôle: {{userRole}}\n\nImportant: Lors de votre première connexion, vous devrez choisir un nouveau mot de passe.\n\nConnectez-vous: {{loginUrl}}\n\nkWh Québec\nTel: 514.427.8871 | info@kwh.quebec`,
      en: `Welcome {{userName}}!\n\nAn account has been created for you on the kWh Québec platform.\n\nYour information:\n- Email: {{userEmail}}\n- Temporary password: {{tempPassword}}\n- Role: {{userRole}}\n\nImportant: On your first login, you will need to choose a new password.\n\nSign in: {{loginUrl}}\n\nkWh Québec\nTel: 514.427.8871 | info@kwh.quebec`,
    },
  },
};

/**
 * Render an email template with data substitution
 */
export function renderEmailTemplate(
  templateName: keyof typeof emailTemplates,
  language: "fr" | "en",
  data: EmailTemplateData
): { subject: string; html: string; text: string } {
  const template = emailTemplates[templateName];
  if (!template) {
    throw new Error(`Email template "${templateName}" not found`);
  }

  const substitute = (content: string): string => {
    let result = content;
    for (const [key, value] of Object.entries(data)) {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      result = result.replace(placeholder, String(value ?? ""));
    }
    return result;
  };

  return {
    subject: substitute(template.subject[language]),
    html: substitute(template.html[language]),
    text: substitute(template.text[language]),
  };
}

/**
 * Get list of available template names
 */
export function getAvailableTemplates(): string[] {
  return Object.keys(emailTemplates);
}

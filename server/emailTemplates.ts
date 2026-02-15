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

// Logo URL placeholder - will be replaced with actual public URL during rendering
const logoPlaceholder = `{{logoUrl}}`;

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
      <h2>{{contactName}}, votre bâtiment a du potentiel.</h2>
      <p>Chaque mois, votre facture d'électricité est un coût fixe que vous subissez. <strong>Et si une partie de cette énergie venait directement de votre toit?</strong></p>

      <p>Nous avons analysé le potentiel solaire de <strong>{{address}}</strong> par satellite. Voici ce que ça donne:</p>

      <div class="highlight">
        <p style="font-size:14px;color:#6b7280;margin-bottom:12px;">Estimation basée sur l'imagerie satellite</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">Système solaire recommandé</td>
            <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;"><span class="metric">{{pvSizeKW}} kW</span></td>
          </tr>
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">Économies annuelles estimées</td>
            <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;"><span class="metric">{{annualSavings}} $</span></td>
          </tr>
          <tr>
            <td style="padding:8px 0;">Investissement récupéré en</td>
            <td style="padding:8px 0;text-align:right;"><span class="metric">{{paybackYears}} ans</span></td>
          </tr>
        </table>
      </div>

      <div style="background:#FFF7E6;border-left:4px solid #FFB005;padding:16px;border-radius:0 8px 8px 0;margin:20px 0;">
        <p style="margin:0;"><strong>Ce qu'on ne peut pas encore calculer:</strong> votre vrai profil de consommation heure par heure. Avec vos données Hydro-Québec, on peut optimiser le système pour maximiser votre retour — et possiblement ajouter du stockage pour réduire vos pointes.</p>
      </div>

      <p style="text-align: center; margin: 30px 0;">
        <a href="{{analysisUrl}}" class="button">Découvrir mon vrai potentiel →</a>
      </p>

      <p style="font-size:13px;color:#6b7280;">Questions? Répondez directement à ce courriel — un humain vous répondra.</p>
    </div>
    <div class="footer">
      <p>kWh Québec - Solaire + Stockage C&I</p>
      <p>514.427.8871 | info@kwh.quebec</p>
    </div>
  </div>
</body></html>`,
      en: `<!DOCTYPE html><html><head>${baseStyles}</head><body>
  <div class="container">
    <div class="header">
      <h1>kWh Québec</h1>
    </div>
    <div class="content">
      <h2>{{contactName}}, your building has potential.</h2>
      <p>Every month, your electricity bill is a fixed cost you absorb. <strong>What if part of that energy came directly from your roof?</strong></p>

      <p>We analyzed the solar potential of <strong>{{address}}</strong> via satellite. Here's what we found:</p>

      <div class="highlight">
        <p style="font-size:14px;color:#6b7280;margin-bottom:12px;">Estimate based on satellite imagery</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">Recommended solar system</td>
            <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;"><span class="metric">{{pvSizeKW}} kW</span></td>
          </tr>
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">Estimated annual savings</td>
            <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;"><span class="metric">\${{annualSavings}}</span></td>
          </tr>
          <tr>
            <td style="padding:8px 0;">Investment recovered in</td>
            <td style="padding:8px 0;text-align:right;"><span class="metric">{{paybackYears}} years</span></td>
          </tr>
        </table>
      </div>

      <div style="background:#FFF7E6;border-left:4px solid #FFB005;padding:16px;border-radius:0 8px 8px 0;margin:20px 0;">
        <p style="margin:0;"><strong>What we can't calculate yet:</strong> your real hour-by-hour consumption profile. With your Hydro-Québec data, we can optimize the system to maximize your return — and potentially add storage to reduce your peak demand charges.</p>
      </div>

      <p style="text-align: center; margin: 30px 0;">
        <a href="{{analysisUrl}}" class="button">Discover my true potential →</a>
      </p>

      <p style="font-size:13px;color:#6b7280;">Questions? Reply directly to this email — a human will answer.</p>
    </div>
    <div class="footer">
      <p>kWh Québec - Turnkey C&I Solar + Storage</p>
      <p>514.427.8871 | info@kwh.quebec</p>
    </div>
  </div>
</body></html>`,
    },
    text: {
      fr: `{{contactName}}, votre bâtiment a du potentiel.\n\nChaque mois, votre facture d'électricité est un coût fixe que vous subissez. Et si une partie de cette énergie venait directement de votre toit?\n\nNous avons analysé le potentiel solaire de {{address}} par satellite.\n\nEstimation:\n- Système solaire: {{pvSizeKW}} kW\n- Économies annuelles: {{annualSavings}} $\n- Investissement récupéré en: {{paybackYears}} ans\n\nDécouvrez votre vrai potentiel: {{analysisUrl}}\n\nQuestions? Répondez directement à ce courriel.\n\nkWh Québec\n514.427.8871 | info@kwh.quebec`,
      en: `{{contactName}}, your building has potential.\n\nEvery month, your electricity bill is a fixed cost you absorb. What if part of that energy came directly from your roof?\n\nWe analyzed the solar potential of {{address}} via satellite.\n\nEstimate:\n- Solar system: {{pvSizeKW}} kW\n- Annual savings: \${{annualSavings}}\n- Investment recovered in: {{paybackYears}} years\n\nDiscover your true potential: {{analysisUrl}}\n\nQuestions? Reply directly to this email.\n\nkWh Québec\n514.427.8871 | info@kwh.quebec`,
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
              <li>Comparaison des options d'acquisition</li>
              <li>Rapport PDF professionnel</li>
            </ul>
            
            <p>Des questions? Répondez simplement à ce courriel.</p>
          </div>
          <div class="footer">
            <p>kWh Québec - Solaire + Stockage</p>
            <p>info@kwh.quebec | 514.427.8871</p>
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
            <p>info@kwh.quebec | 514.427.8871</p>
          </div>
        </div>
      </body></html>`,
    },
    text: {
      fr: `Merci {{contactName}}!\n\nNous avons bien reçu votre demande d'analyse détaillée pour {{companyName}}.\n\nProchaines étapes:\n1. Signature de la procuration HQ\n2. Récupération des données\n3. Analyse complète (simulation 8 760h)\n4. Rapport dans 5 jours ouvrables\n\nkWh Québec\ninfo@kwh.quebec`,
      en: `Thank you {{contactName}}!\n\nWe have received your detailed analysis request for {{companyName}}.\n\nNext Steps:\n1. HQ Authorization Signature\n2. Data Retrieval\n3. Complete Analysis (8,760h simulation)\n4. Report within 5 business days\n\nkWh Québec\ninfo@kwh.quebec`,
    },
  },

  // DAY 0: Welcome + Quick Results Summary
  nurtureWelcome: {
    subject: {
      fr: "{{contactName}}, votre potentiel solaire découvert - Résumé de l'estimation",
      en: "{{contactName}}, your solar potential uncovered - Estimate summary",
    },
    html: {
      fr: `<!DOCTYPE html><html><head>${baseStyles}</head><body>
  <div class="container">
    <div class="header">
      <h1>kWh Québec</h1>
    </div>
    <div class="content">
      <h2>Bienvenue {{contactName}},</h2>
      <p>Merci de votre intérêt envers le solaire pour {{companyName}}. Voici votre estimation rapide basée sur les données que vous avez fournies.</p>

      <div class="highlight">
        <p style="font-size:14px;color:#6b7280;margin-bottom:12px;">Votre potentiel solaire estimé</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">Taille du système</td>
            <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;"><span class="metric">{{estimatedSystemSize}}</span></td>
          </tr>
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">Économies annuelles estimées</td>
            <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;"><span class="metric">{{estimatedSavings}}</span></td>
          </tr>
          <tr>
            <td style="padding:8px 0;">Retour sur investissement</td>
            <td style="padding:8px 0;text-align:right;"><span class="metric">{{estimatedROI}}</span></td>
          </tr>
        </table>
      </div>

      <p style="text-align: center; margin: 30px 0;">
        <a href="{{calendlyUrl}}" class="button">Validons ensemble votre projet en 10 minutes →</a>
      </p>

      <p style="font-size:13px;color:#6b7280;">Cet appel nous permettra de confirmer nos estimations et de répondre à vos questions. Aucun engagement après l'appel.</p>
    </div>
    <div class="footer">
      <p>kWh Québec - Solaire + Stockage C&I</p>
      <p>514.427.8871 | info@kwh.quebec</p>
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
      <h2>Welcome {{contactName}},</h2>
      <p>Thank you for your interest in solar for {{companyName}}. Here is your quick estimate based on the data you provided.</p>

      <div class="highlight">
        <p style="font-size:14px;color:#6b7280;margin-bottom:12px;">Your estimated solar potential</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">System Size</td>
            <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;"><span class="metric">{{estimatedSystemSize}}</span></td>
          </tr>
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">Estimated Annual Savings</td>
            <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;"><span class="metric">{{estimatedSavings}}</span></td>
          </tr>
          <tr>
            <td style="padding:8px 0;">Return on Investment</td>
            <td style="padding:8px 0;text-align:right;"><span class="metric">{{estimatedROI}}</span></td>
          </tr>
        </table>
      </div>

      <p style="text-align: center; margin: 30px 0;">
        <a href="{{calendlyUrl}}" class="button">Let's validate your project in 10 minutes →</a>
      </p>

      <p style="font-size:13px;color:#6b7280;">This call will help us confirm our estimates and answer your questions. No commitment after the call.</p>
    </div>
    <div class="footer">
      <p>kWh Québec - Turnkey C&I Solar + Storage</p>
      <p>514.427.8871 | info@kwh.quebec</p>
      <p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>
    </div>
  </div>
</body></html>`,
    },
    text: {
      fr: `Bienvenue {{contactName}},\n\nVotre estimation rapide pour {{companyName}}:\n- Taille du système: {{estimatedSystemSize}}\n- Économies annuelles: {{estimatedSavings}}\n- Retour: {{estimatedROI}}\n\nProchaine étape: réservez un appel de 10 minutes pour valider ensemble.\n\nRéserver un appel: {{calendlyUrl}}\n\nkWh Québec\n514.427.8871 | info@kwh.quebec`,
      en: `Welcome {{contactName}},\n\nYour quick estimate for {{companyName}}:\n- System Size: {{estimatedSystemSize}}\n- Annual Savings: {{estimatedSavings}}\n- Payback: {{estimatedROI}}\n\nNext step: Book a 10-minute call to validate together.\n\nBook a call: {{calendlyUrl}}\n\nkWh Québec\n514.427.8871 | info@kwh.quebec`,
    },
  },

  // DAY 1: Discovery Call CTA
  nurtureCTA1: {
    subject: {
      fr: "Validons ensemble votre projet en 10 minutes",
      en: "Let's validate your project in 10 minutes",
    },
    html: {
      fr: `<!DOCTYPE html><html><head>${baseStyles}</head><body>
  <div class="container">
    <div class="header">
      <h1>kWh Québec</h1>
    </div>
    <div class="content">
      <h2>Bonjour {{contactName}},</h2>
      <p>Un appel rapide peut changer les choses. En 10 minutes, nous pouvons:</p>

      <ul style="padding-left: 20px;">
        <li>Confirmer notre estimation initiale</li>
        <li>Répondre à vos objections ou préoccupations</li>
        <li>Débloquer votre rapport personnalisé détaillé</li>
      </ul>

      <p style="text-align: center; margin: 30px 0;">
        <a href="{{calendlyUrl}}" class="button">Réserver mon appel de qualification →</a>
      </p>

      <p style="font-size:13px;color:#6b7280;">Pas maintenant? Pas de problème — nous continuerons à partager des insights utiles.</p>
    </div>
    <div class="footer">
      <p>kWh Québec - Solaire + Stockage C&I</p>
      <p>514.427.8871 | info@kwh.quebec</p>
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
      <p>A quick call can make a difference. In 10 minutes, we can:</p>

      <ul style="padding-left: 20px;">
        <li>Confirm our initial estimate</li>
        <li>Address any concerns or questions</li>
        <li>Unlock your detailed personalized report</li>
      </ul>

      <p style="text-align: center; margin: 30px 0;">
        <a href="{{calendlyUrl}}" class="button">Book my qualification call →</a>
      </p>

      <p style="font-size:13px;color:#6b7280;">Not now? No problem — we'll continue sharing useful insights.</p>
    </div>
    <div class="footer">
      <p>kWh Québec - Turnkey C&I Solar + Storage</p>
      <p>514.427.8871 | info@kwh.quebec</p>
      <p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>
    </div>
  </div>
</body></html>`,
    },
    text: {
      fr: `Bonjour {{contactName}},\n\nUn appel de 10 minutes peut valider votre projet et débloquer votre rapport personnalisé.\n\nRéserver: {{calendlyUrl}}\n\nkWh Québec`,
      en: `Hello {{contactName}},\n\nA 10-minute call can validate your project and unlock your personalized report.\n\nBook: {{calendlyUrl}}\n\nkWh Québec`,
    },
  },

  // DAY 3: Risk Flags / Blockers (if any)
  nurtureRiskFlags: {
    subject: {
      fr: "Points d'attention identifiés pour votre projet {{companyName}}",
      en: "Points of attention identified for {{companyName}}",
    },
    html: {
      fr: `<!DOCTYPE html><html><head>${baseStyles}</head><body>
  <div class="container">
    <div class="header">
      <h1>kWh Québec</h1>
    </div>
    <div class="content">
      <h2>Bonjour {{contactName}},</h2>
      <p>Dans notre analyse préliminaire, nous avons identifié quelques points à clarifier pour {{companyName}}:</p>

      <div class="highlight">
        <h3>Points à valider:</h3>
        <p>{{riskFlags}}</p>
      </div>

      <p>Aucun de ces points n'élimine votre projet — ils sont simplement des éléments que nous devons valider ensemble lors de notre appel de qualification.</p>

      <p style="text-align: center; margin: 30px 0;">
        <a href="{{calendlyUrl}}" class="button">Discutons de ces points en 10 minutes →</a>
      </p>
    </div>
    <div class="footer">
      <p>kWh Québec - Solaire + Stockage C&I</p>
      <p>514.427.8871 | info@kwh.quebec</p>
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
      <p>In our preliminary analysis, we identified a few points to clarify for {{companyName}}:</p>

      <div class="highlight">
        <h3>Points to validate:</h3>
        <p>{{riskFlags}}</p>
      </div>

      <p>None of these eliminate your project — they're simply items we need to validate together during our qualification call.</p>

      <p style="text-align: center; margin: 30px 0;">
        <a href="{{calendlyUrl}}" class="button">Let's discuss in 10 minutes →</a>
      </p>
    </div>
    <div class="footer">
      <p>kWh Québec - Turnkey C&I Solar + Storage</p>
      <p>514.427.8871 | info@kwh.quebec</p>
      <p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>
    </div>
  </div>
</body></html>`,
    },
    text: {
      fr: `Bonjour {{contactName}},\n\nPoints d'attention identifiés:\n\n{{riskFlags}}\n\nRéservons un appel pour en discuter: {{calendlyUrl}}\n\nkWh Québec`,
      en: `Hello {{contactName}},\n\nPoints of attention:\n\n{{riskFlags}}\n\nLet's book a call to discuss: {{calendlyUrl}}\n\nkWh Québec`,
    },
  },

  // DAY 7: Tripwire - Design Mandate Offer ($2,500 + taxes, credited on EPC)
  nurtureTripwire: {
    subject: {
      fr: "{{companyName}}: Passer à l'étape de conception - Mandat à 2 500$",
      en: "{{companyName}}: Move to design phase - Design Mandate $2,500",
    },
    html: {
      fr: `<!DOCTYPE html><html><head>${baseStyles}</head><body>
  <div class="container">
    <div class="header">
      <h1>kWh Québec</h1>
    </div>
    <div class="content">
      <h2>Bonjour {{contactName}},</h2>
      <p>Après notre appel de qualification, l'étape suivante est la <strong>validation sur terrain</strong>. Voici ce qui est inclus:</p>

      <div class="highlight">
        <h3>Mandat de conception préliminaire - 2 500$ + taxes</h3>
        <ul>
          <li>Visite technique sur site</li>
          <li>Validation de la toiture et structure</li>
          <li>Évaluation salle électrique</li>
          <li>Layout préliminaire et confirmation faisabilité</li>
          <li>Photos et documentation</li>
        </ul>
      </div>

      <div style="background:#FFF7E6;border-left:4px solid #FFB005;padding:16px;border-radius:0 8px 8px 0;margin:20px 0;">
        <p style="margin:0;"><strong>Montant crédité intégralement</strong> sur le contrat EPC si vous procédez avec kWh Québec. Aucune perte — c'est une validation essentielleavant de s'engager.</p>
      </div>

      <p style="text-align: center; margin: 30px 0;">
        <a href="{{calendlyUrl}}" class="button">Réserver ma visite technique →</a>
      </p>
    </div>
    <div class="footer">
      <p>kWh Québec - Solaire + Stockage C&I</p>
      <p>514.427.8871 | info@kwh.quebec</p>
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
      <p>After our qualification call, the next step is <strong>on-site validation</strong>. Here's what's included:</p>

      <div class="highlight">
        <h3>Preliminary Design Mandate - $2,500 + tax</h3>
        <ul>
          <li>On-site technical visit</li>
          <li>Roof and structural validation</li>
          <li>Electrical room assessment</li>
          <li>Preliminary layout and feasibility confirmation</li>
          <li>Photos and documentation</li>
        </ul>
      </div>

      <div style="background:#FFF7E6;border-left:4px solid #FFB005;padding:16px;border-radius:0 8px 8px 0;margin:20px 0;">
        <p style="margin:0;"><strong>Amount fully credited</strong> toward your EPC contract if you proceed with kWh Québec. No loss — it's essential validation before committing.</p>
      </div>

      <p style="text-align: center; margin: 30px 0;">
        <a href="{{calendlyUrl}}" class="button">Book my site visit →</a>
      </p>
    </div>
    <div class="footer">
      <p>kWh Québec - Turnkey C&I Solar + Storage</p>
      <p>514.427.8871 | info@kwh.quebec</p>
      <p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>
    </div>
  </div>
</body></html>`,
    },
    text: {
      fr: `Bonjour {{contactName}},\n\nProchaine étape: Mandat de conception préliminaire - 2 500$ + taxes\n\nInclus:\n- Visite technique\n- Validation toiture/structure\n- Évaluation électrique\n- Layout préliminaire\n- Feasibility confirmation\n\nMontant crédité sur l'EPC si vous procédez.\n\nRéserver: {{calendlyUrl}}\n\nkWh Québec`,
      en: `Hello {{contactName}},\n\nNext step: Preliminary Design Mandate - $2,500 + tax\n\nIncludes:\n- Site visit\n- Roof/structural validation\n- Electrical assessment\n- Preliminary layout\n- Feasibility confirmation\n\nAmount credited toward EPC if you proceed.\n\nBook: {{calendlyUrl}}\n\nkWh Québec`,
    },
  },

  // DAY 14: Case Study / Social Proof
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
              <a href="{{calendlyUrl}}" class="button">Découvrir mon potentiel</a>
            </p>
          </div>
          <div class="footer">
            <p>kWh Québec - Solaire + Stockage</p>
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
              <a href="{{calendlyUrl}}" class="button">Discover My Potential</a>
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
      fr: `Bonjour {{contactName}},\n\nÉtude de cas - Entrepôt Montréal:\n- Système: 200 kW + 100 kWh\n- Investissement net: 180 000$\n- Économies: 45 000$/an\n- Retour: 4 ans\n\nDécouvrez votre potentiel: {{calendlyUrl}}\n\nkWh Québec`,
      en: `Hello {{contactName}},\n\nCase Study - Montreal Warehouse:\n- System: 200 kW + 100 kWh\n- Net investment: $180,000\n- Savings: $45,000/year\n- Payback: 4 years\n\nDiscover your potential: {{calendlyUrl}}\n\nkWh Québec`,
    },
  },

  // DAY 21: Last Chance / FOMO + Incentive Expiry Warning
  nurturingLastChance: {
    subject: {
      fr: "Dernière question: est-ce le bon moment pour {{companyName}}?",
      en: "Last question: is it the right time for {{companyName}}?",
    },
    html: {
      fr: `<!DOCTYPE html><html><head>${baseStyles}</head><body>
  <div class="container">
    <div class="header">
      <h1>kWh Québec</h1>
    </div>
    <div class="content">
      <h2>Bonjour {{contactName}},</h2>
      <p>On va être honnête: le timing compte. Parfois, ce n'est pas le bon moment, et c'est OK.</p>

      <div class="highlight">
        <h3>Avant de vous décider:</h3>
        <ul>
          <li><strong>Chaque mois de délai:</strong> Vous laissez {{estimatedSavings}}/mois sur la table.</li>
          <li><strong>Les incitatifs actuels:</strong> Historiquement les plus généreux. Aucune garantie qu'ils restent.</li>
          <li><strong>L'appel est gratuit:</strong> 10 minutes. Zéro engagement.</li>
        </ul>
      </div>

      <p>Si maintenant n'est pas le bon moment — budgetaire, timing, ou autre — c'est totalement compréhensible. On respecte ça.</p>

      <p style="text-align: center; margin: 30px 0;">
        <a href="{{calendlyUrl}}" class="button">Réserver mon appel gratuit →</a>
      </p>

      <p style="font-size:13px;color:#6b7280;">Si vous décidez de ne pas continuer, nous n'enverrons plus de courriels. Pas de spam, pas de suivi agressif. Juste du respect.</p>
    </div>
    <div class="footer">
      <p>kWh Québec - Solaire + Stockage</p>
      <p><a href="{{unsubscribeUrl}}">Se désabonner définitivement</a></p>
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
      <p>Let's be honest: timing matters. Sometimes now isn't the right time, and that's OK.</p>

      <div class="highlight">
        <h3>Before you decide:</h3>
        <ul>
          <li><strong>Every month of delay:</strong> You're leaving {{estimatedSavings}}/month on the table.</li>
          <li><strong>Current incentives:</strong> Historically the most generous. Zero guarantee they stay.</li>
          <li><strong>The call is free:</strong> 10 minutes. Zero commitment.</li>
        </ul>
      </div>

      <p>If now isn't the right time for you — for budget, timing, or anything else — that's totally understandable. We respect that.</p>

      <p style="text-align: center; margin: 30px 0;">
        <a href="{{calendlyUrl}}" class="button">Book my free call →</a>
      </p>

      <p style="font-size:13px;color:#6b7280;">If you decide not to continue, we won't send more emails. No spam, no aggressive follow-up. Just respect.</p>
    </div>
    <div class="footer">
      <p>kWh Québec - Turnkey solar + storage</p>
      <p><a href="{{unsubscribeUrl}}">Unsubscribe permanently</a></p>
    </div>
  </div>
</body></html>`,
    },
    text: {
      fr: `Bonjour {{contactName}},\n\nLe timing compte. Parfois, ce n'est pas le bon moment, et c'est OK.\n\nMais avant de décider:\n- Chaque mois: {{estimatedSavings}}/mois de perdu\n- Les incitatifs actuels sont les plus généreux de l'histoire\n- L'appel est gratuit - 10 minutes, zéro engagement\n\nSi maintenant n'est pas le bon moment, on comprend. On respecte votre décision.\n\nRéserver: {{calendlyUrl}}\n\nkWh Québec`,
      en: `Hello {{contactName}},\n\nTiming matters. Sometimes now isn't the right time, and that's OK.\n\nBut before you decide:\n- Every month: {{estimatedSavings}}/month lost\n- Current incentives are the most generous ever\n- The call is free - 10 minutes, zero commitment\n\nIf now isn't right, we understand. We respect your decision.\n\nBook: {{calendlyUrl}}\n\nkWh Québec`,
    },
  },

  // DAY 30: Re-engagement — Check if still interested, offer updated analysis
  nurtureReengagement: {
    subject: {
      fr: "Une dernière mise à jour - Avez-vous des questions sur votre projet?",
      en: "One final update - Do you have questions about your project?",
    },
    html: {
      fr: `<!DOCTYPE html><html><head>${baseStyles}</head><body>
  <div class="container">
    <div class="header">
      <h1>kWh Québec</h1>
    </div>
    <div class="content">
      <h2>Bonjour {{contactName}},</h2>
      <p>Nous avons une question simple: êtes-vous toujours intéressé par le solaire pour {{companyName}}?</p>

      <p>Si oui, on aimerais vous aider. Voici trois façons de continuer:</p>

      <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:20px 0;">
        <p><strong>Option 1:</strong> Réservez un appel rapide — 10 minutes pour discuter de vos questions</p>
        <p style="margin-top: 12px;"><strong>Option 2:</strong> Envoyez un courriel — Posez vos questions directement</p>
        <p style="margin-top: 12px;"><strong>Option 3:</strong> Demandez une mise à jour — Les incitatifs et prix évoluent</p>
      </div>

      <p style="text-align: center; margin: 30px 0;">
        <a href="{{calendlyUrl}}" class="button">Réserver un appel</a>
      </p>

      <p style="font-size:13px;color:#6b7280;">Si vous ne souhaitez plus recevoir de courriels de notre part, <a href="{{unsubscribeUrl}}">cliquez ici</a>. Aucune question.</p>
    </div>
    <div class="footer">
      <p>kWh Québec - Solaire + Stockage</p>
      <p>514.427.8871 | info@kwh.quebec</p>
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
      <p>We have a simple question: are you still interested in solar for {{companyName}}?</p>

      <p>If yes, we'd like to help. Here are three ways to continue:</p>

      <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:20px 0;">
        <p><strong>Option 1:</strong> Book a quick call — 10 minutes to discuss your questions</p>
        <p style="margin-top: 12px;"><strong>Option 2:</strong> Send us an email — Ask your questions directly</p>
        <p style="margin-top: 12px;"><strong>Option 3:</strong> Get an update — Incentives and pricing evolve</p>
      </div>

      <p style="text-align: center; margin: 30px 0;">
        <a href="{{calendlyUrl}}" class="button">Book a call</a>
      </p>

      <p style="font-size:13px;color:#6b7280;">If you'd prefer not to receive emails from us, <a href="{{unsubscribeUrl}}">click here</a>. No questions asked.</p>
    </div>
    <div class="footer">
      <p>kWh Québec - Turnkey solar + storage</p>
      <p>514.427.8871 | info@kwh.quebec</p>
    </div>
  </div>
</body></html>`,
    },
    text: {
      fr: `Bonjour {{contactName}},\n\nSimple question: êtes-vous toujours intéressé par le solaire pour {{companyName}}?\n\nSi oui, on peut vous aider.\n\nOptions:\n1. Réservez un appel - {{calendlyUrl}}\n2. Envoyez un courriel - info@kwh.quebec\n3. Demandez une mise à jour\n\nSi non, <{{unsubscribeUrl}}> pour se désabonner.\n\nkWh Québec`,
      en: `Hello {{contactName}},\n\nSimple question: are you still interested in solar for {{companyName}}?\n\nIf yes, we can help.\n\nOptions:\n1. Book a call - {{calendlyUrl}}\n2. Send us an email - info@kwh.quebec\n3. Get an update\n\nIf not, click {{unsubscribeUrl}} to unsubscribe.\n\nkWh Québec`,
    },
  },

  // Nurturing email 3: Rising costs projection (Day 10)
  nurturingRisingCosts: {
    subject: {
      fr: "Vos coûts d'énergie dans 5 ans: la projection qui fait réfléchir",
      en: "Your energy costs in 5 years: the projection that makes you think",
    },
    html: {
      fr: `<!DOCTYPE html><html><head>${baseStyles}</head><body>
        <div class="container">
          <div class="header">
            <h1>kWh Québec</h1>
          </div>
          <div class="content">
            <h2>Bonjour {{contactName}},</h2>
            <p>Un chiffre que peu de gens ont envie de regarder en face: <strong>le coût de ne rien faire.</strong></p>

            <div class="highlight">
              <h3>Voici le calcul simple:</h3>
              <p>L'électricité augmente en moyenne de <strong>3,5% par année</strong> au Québec. Si vous payez {{currentAnnualBill}}$ en électricité aujourd'hui:</p>
              <ul>
                <li>Dans <strong>5 ans</strong>: {{bill5Years}}$ ({{increase5Years}}$ de plus)</li>
                <li>Dans <strong>10 ans</strong>: {{bill10Years}}$ ({{increase10Years}}$ de plus)</li>
                <li>Dans <strong>25 ans</strong>: {{bill25Years}}$ ({{increase25Years}}$ de plus)</li>
              </ul>
            </div>

            <div style="background:#FFF7E6;border-left:4px solid #FFB005;padding:16px;border-radius:0 8px 8px 0;margin:20px 0;">
              <p style="margin:0;"><strong>Avec le solaire?</strong> Vous fixez votre coût d'énergie au jour 1. Les 25 prochaines années, vos factures n'augmentent plus. C'est l'opposé de l'inflation — c'est une protection.</p>
            </div>

            <p style="text-align: center; margin: 30px 0;">
              <a href="{{analysisUrl}}" class="button">Voir mon impact d'ici 5 ans →</a>
            </p>

            <p style="font-size:13px;color:#6b7280;">Ces projections supposent une escalade constante. Historiquement, l'électricité a augmenté à 2-4% par année.</p>
          </div>
          <div class="footer">
            <p>kWh Québec - Solaire + Stockage</p>
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
            <p>A number most people don't want to face: <strong>the cost of doing nothing.</strong></p>

            <div class="highlight">
              <h3>Here's the simple math:</h3>
              <p>Electricity increases at an average of <strong>3.5% per year</strong> in Quebec. If you pay {{currentAnnualBill}}$ in electricity today:</p>
              <ul>
                <li>In <strong>5 years</strong>: {{bill5Years}}$ ({{increase5Years}}$ more)</li>
                <li>In <strong>10 years</strong>: {{bill10Years}}$ ({{increase10Years}}$ more)</li>
                <li>In <strong>25 years</strong>: {{bill25Years}}$ ({{increase25Years}}$ more)</li>
              </ul>
            </div>

            <div style="background:#FFF7E6;border-left:4px solid #FFB005;padding:16px;border-radius:0 8px 8px 0;margin:20px 0;">
              <p style="margin:0;"><strong>With solar?</strong> You lock in your energy cost on day 1. For the next 25 years, your bills don't increase. It's the opposite of inflation — it's protection.</p>
            </div>

            <p style="text-align: center; margin: 30px 0;">
              <a href="{{analysisUrl}}" class="button">See my impact over 5 years →</a>
            </p>

            <p style="font-size:13px;color:#6b7280;">These projections assume constant escalation. Historically, electricity has increased at 2-4% per year.</p>
          </div>
          <div class="footer">
            <p>kWh Québec - Turnkey solar + storage</p>
            <p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>
          </div>
        </div>
      </body></html>`,
    },
    text: {
      fr: `Bonjour {{contactName}},\n\nLe coût de ne rien faire:\n\nL'électricité augmente de 3,5% par année. Si vous payez {{currentAnnualBill}}$ aujourd'hui:\n- Dans 5 ans: {{bill5Years}}$\n- Dans 10 ans: {{bill10Years}}$\n- Dans 25 ans: {{bill25Years}}$\n\nAvec le solaire, vous fixez votre coût d'énergie maintenant. Pas d'augmentation pendant 25 ans.\n\nVoir mon impact: {{analysisUrl}}\n\nkWh Québec`,
      en: `Hello {{contactName}},\n\nThe cost of doing nothing:\n\nElectricity increases 3.5% per year. If you pay {{currentAnnualBill}}$ today:\n- In 5 years: {{bill5Years}}$\n- In 10 years: {{bill10Years}}$\n- In 25 years: {{bill25Years}}$\n\nWith solar, you lock in your energy cost now. No increases for 25 years.\n\nSee my impact: {{analysisUrl}}\n\nkWh Québec`,
    },
  },

  // Nurturing email 4: Myth busting (Day 14)
  nurturingMythBusting: {
    subject: {
      fr: "5 mythes sur le solaire au Québec qu'on entend encore en 2026",
      en: "5 myths about solar in Québec we still hear in 2026",
    },
    html: {
      fr: `<!DOCTYPE html><html><head>${baseStyles}</head><body>
        <div class="container">
          <div class="header">
            <h1>kWh Québec</h1>
          </div>
          <div class="content">
            <h2>Bonjour {{contactName}},</h2>
            <p>On entend souvent les mêmes objections au sujet du solaire au Québec. Voici la vérité:</p>

            <div class="highlight">
              <h3>Mythe #1: "Le solaire ne fonctionne pas l'hiver"</h3>
              <p><strong>Faux.</strong> Les panneaux produisent 25-30% de leur capacité même en hiver. Les journées froides et claires? Elles sont idéales — le froid améliore l'efficacité des panneaux.</p>
            </div>

            <div class="highlight">
              <h3>Mythe #2: "Ce n'est pas rentable au Québec parce que l'électricité est bon marché"</h3>
              <p><strong>Faux.</strong> Avec 60% d'incitatifs cumulés (HQ + fédéral + déductions), le retour sur investissement est de 3-6 ans. C'est mieux qu'une obligation d'épargne.</p>
            </div>

            <div class="highlight">
              <h3>Mythe #3: "Les panneaux ont besoin d'entretien constant"</h3>
              <p><strong>Faux.</strong> Garantie de 25 ans. Entretien minimal — la pluie lave les panneaux. Coût de maintenance: environ 0,5% du système par année.</p>
            </div>

            <div class="highlight">
              <h3>Mythe #4: "La neige bloque toute la production"</h3>
              <p><strong>Faux.</strong> Les panneaux sont conçus pour rejeter la neige. Impact moyen: 5-10% de perte saisonnière. Et vous profitez toujours de 25-30% de production en hiver.</p>
            </div>

            <div class="highlight">
              <h3>Mythe #5: "La technologie n'est pas éprouvée"</h3>
              <p><strong>Faux.</strong> Les panneaux solaires existent depuis 70 ans. kWh Québec seule a installé 120 MW de solaire au Québec. C'est la technologie la plus fiable en électricité.</p>
            </div>

            <p style="text-align: center; margin: 30px 0;">
              <a href="{{analysisUrl}}" class="button">Débuter mon analyse →</a>
            </p>
          </div>
          <div class="footer">
            <p>kWh Québec - Solaire + Stockage</p>
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
            <p>We hear the same solar objections in Quebec all the time. Here's the truth:</p>

            <div class="highlight">
              <h3>Myth #1: "Solar doesn't work in winter"</h3>
              <p><strong>False.</strong> Panels produce 25-30% of capacity even in winter. Cold, clear days? They're ideal — cold improves panel efficiency.</p>
            </div>

            <div class="highlight">
              <h3>Myth #2: "It's not profitable in Quebec because electricity is cheap"</h3>
              <p><strong>False.</strong> With 60% cumulative incentives (HQ + federal + deductions), payback is 3-6 years. That's better than a savings bond.</p>
            </div>

            <div class="highlight">
              <h3>Myth #3: "Panels need constant maintenance"</h3>
              <p><strong>False.</strong> 25-year warranty. Minimal maintenance — rain cleans the panels. Annual maintenance cost: about 0.5% of system.</p>
            </div>

            <div class="highlight">
              <h3>Myth #4: "Snow blocks all production"</h3>
              <p><strong>False.</strong> Panels are designed to shed snow. Average impact: 5-10% seasonal loss. And you still get 25-30% winter production.</p>
            </div>

            <div class="highlight">
              <h3>Myth #5: "The technology isn't proven"</h3>
              <p><strong>False.</strong> Solar panels have existed for 70 years. kWh Québec alone has installed 120 MW of solar in Quebec. It's the most reliable technology in electricity.</p>
            </div>

            <p style="text-align: center; margin: 30px 0;">
              <a href="{{analysisUrl}}" class="button">Start my analysis →</a>
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
      fr: `Bonjour {{contactName}},\n\n5 mythes sur le solaire au Québec:\n\n1. "Ne fonctionne pas l'hiver" — Faux. Produit 25-30% même en hiver.\n2. "Pas rentable au QC" — Faux. 3-6 ans de retour avec 60% d'incitatifs.\n3. "Entretien constant" — Faux. Garantie 25 ans, maintenance minimale.\n4. "La neige bloque tout" — Faux. Perte moyenne: 5-10%, panneaux rejettent la neige.\n5. "Technologie non éprouvée" — Faux. 70 ans d'histoire, 120 MW installés par kWh.\n\nDébuter mon analyse: {{analysisUrl}}\n\nkWh Québec`,
      en: `Hello {{contactName}},\n\n5 myths about solar in Quebec:\n\n1. "Doesn't work in winter" — False. Produces 25-30% even in winter.\n2. "Not profitable in Quebec" — False. 3-6 year payback with 60% incentives.\n3. "Constant maintenance" — False. 25-year warranty, minimal maintenance.\n4. "Snow blocks everything" — False. Average 5-10% seasonal loss, panels shed snow.\n5. "Technology isn't proven" — False. 70 years of history, 120 MW installed by kWh.\n\nStart my analysis: {{analysisUrl}}\n\nkWh Québec`,
    },
  },

  // Nurturing email 5: Time-sensitive incentives (Day 21)
  nurturingTimeSensitive: {
    subject: {
      fr: "Les incitatifs solaires au Québec: ce qui change en 2026",
      en: "Solar incentives in Québec: what's changing in 2026",
    },
    html: {
      fr: `<!DOCTYPE html><html><head>${baseStyles}</head><body>
        <div class="container">
          <div class="header">
            <h1>kWh Québec</h1>
          </div>
          <div class="content">
            <h2>Bonjour {{contactName}},</h2>
            <p>Les programmes d'incitatifs solaires au Québec changent régulièrement. Voici les faits:</p>

            <div class="highlight">
              <h3>L'historique des changements:</h3>
              <ul>
                <li>2019-2021: Programme HQ original (limité)</li>
                <li>2021-2023: Augmentation des crédits fédéraux</li>
                <li>2023-2024: Expansion des incitatifs HQ</li>
                <li>2024-2026: Configuration actuelle (la plus généreuse de l'histoire)</li>
              </ul>
            </div>

            <div style="background:#FFF7E6;border-left:4px solid #FFB005;padding:16px;border-radius:0 8px 8px 0;margin:20px 0;">
              <p style="margin:0;"><strong>Ce n'est pas une tactique de peur — c'est un fait:</strong> La combinaison actuelle des incitatifs HQ + fédéraux + amortissement accéléré est historiquement la plus généreuse jamais offerte au Québec. Aucune garantie qu'elle reste ainsi.</p>
            </div>

            <p>Pourquoi? Les gouvernements ajustent les programmes en fonction du volume d'installations, des budget déficitaires, ou des priorités politiques. On ne peut pas prédire l'avenir, mais on peut profiter du présent.</p>

            <p style="text-align: center; margin: 30px 0;">
              <a href="{{analysisUrl}}" class="button">Obtenir mon analyse avec les incitatifs actuels →</a>
            </p>

            <p style="font-size:13px;color:#6b7280;">Votre analyse incluera une comparaison de scénarios: avec les incitatifs actuels vs. une réduction future possible.</p>
          </div>
          <div class="footer">
            <p>kWh Québec - Solaire + Stockage</p>
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
            <p>Solar incentive programs in Quebec change regularly. Here are the facts:</p>

            <div class="highlight">
              <h3>History of changes:</h3>
              <ul>
                <li>2019-2021: Original HQ program (limited)</li>
                <li>2021-2023: Federal credit increases</li>
                <li>2023-2024: HQ incentive expansion</li>
                <li>2024-2026: Current configuration (most generous in history)</li>
              </ul>
            </div>

            <div style="background:#FFF7E6;border-left:4px solid #FFB005;padding:16px;border-radius:0 8px 8px 0;margin:20px 0;">
              <p style="margin:0;"><strong>This isn't fear-mongering — it's a fact:</strong> The current combination of HQ + federal incentives + accelerated depreciation is historically the most generous ever offered in Quebec. No guarantee it stays that way.</p>
            </div>

            <p>Why? Governments adjust programs based on installation volumes, budget deficits, or political priorities. We can't predict the future, but we can benefit from the present.</p>

            <p style="text-align: center; margin: 30px 0;">
              <a href="{{analysisUrl}}" class="button">Get my analysis with current incentives →</a>
            </p>

            <p style="font-size:13px;color:#6b7280;">Your analysis will include scenario comparisons: current incentives vs. a possible future reduction.</p>
          </div>
          <div class="footer">
            <p>kWh Québec - Turnkey solar + storage</p>
            <p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>
          </div>
        </div>
      </body></html>`,
    },
    text: {
      fr: `Bonjour {{contactName}},\n\nLes incitatifs solaires au Québec changent régulièrement:\n\n- 2019-2021: Programme original (limité)\n- 2021-2023: Augmentation fédérale\n- 2023-2024: Expansion HQ\n- 2024-2026: Configuration actuelle (plus généreuse que jamais)\n\nLa combinaison HQ + fédéral + amortissement est historiquement la plus généreuse. Aucune garantie qu'elle persiste.\n\nProfitez du présent: {{analysisUrl}}\n\nkWh Québec`,
      en: `Hello {{contactName}},\n\nSolar incentives in Quebec change regularly:\n\n- 2019-2021: Original program (limited)\n- 2021-2023: Federal increase\n- 2023-2024: HQ expansion\n- 2024-2026: Current (most generous ever)\n\nThe HQ + federal + depreciation combination is historically the most generous. No guarantee it stays.\n\nBenefit from now: {{analysisUrl}}\n\nkWh Québec`,
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
            <p>kWh Québec - Solaire + Stockage</p>
            <p>info@kwh.quebec | 514.427.8871</p>
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
            <p>info@kwh.quebec | 514.427.8871</p>
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
            <img src="${logoPlaceholder}" alt="kWh Québec" style="height: 60px; width: auto; max-width: 200px;" />
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
            <p style="margin: 0 0 5px 0;"><strong>kWh Québec</strong> - Solaire + Stockage</p>
            <p style="margin: 0;">Tel: 514.427.8871 | info@kwh.quebec | www.kwh.quebec</p>
          </div>
        </div>
      </body></html>`,
      en: `<!DOCTYPE html><html><head>${baseStyles}</head><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white;">
          <div style="text-align: center; padding: 25px 20px; background: linear-gradient(135deg, #003DA6 0%, #0054A8 100%);">
            <img src="${logoPlaceholder}" alt="kWh Québec" style="height: 60px; width: auto; max-width: 200px;" />
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

  // Personalized welcome email sent immediately after lead creation
  welcomePersonalized: {
    subject: {
      fr: "Votre rapport solaire est en route, {{contactName}}!",
      en: "Your solar report is on its way, {{contactName}}!",
    },
    html: {
      fr: `<!DOCTYPE html><html><head>${baseStyles}</head><body>
  <div class="container">
    <div class="header">
      <h1>kWh Québec</h1>
    </div>
    <div class="content">
      <h2>Bienvenue {{contactName}}!</h2>
      <p>Merci de votre confiance. Nous avons reçu votre demande d'analyse solaire et nous vous préparons un rapport personnalisé basé sur vos données.</p>

      <div style="background:#f0f9ff;border-left:4px solid #0054A8;padding:16px;border-radius:0 8px 8px 0;margin:20px 0;">
        <p style="margin:0;font-weight:bold;margin-bottom:12px;color:#0054A8;">Votre bâtiment analysé:</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="padding:6px 0;border-bottom:1px solid #e5e7eb;">Adresse</td>
            <td style="padding:6px 0;border-bottom:1px solid #e5e7eb;text-align:right;"><strong>{{address}}</strong></td>
          </tr>
          <tr>
            <td style="padding:6px 0;border-bottom:1px solid #e5e7eb;">Type de bâtiment</td>
            <td style="padding:6px 0;border-bottom:1px solid #e5e7eb;text-align:right;">{{buildingType}}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;">Consommation annuelle estimée</td>
            <td style="padding:6px 0;text-align:right;"><strong>{{annualConsumptionKwh}} kWh/an</strong></td>
          </tr>
        </table>
      </div>

      <h3 style="margin-top:24px;margin-bottom:12px;color:#1f2937;">Votre potentiel solaire:</h3>
      <p style="color:#666;margin-bottom:16px;">Basé sur l'analyse satellite et votre profil de consommation, voici ce que nous estimons:</p>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:20px 0;">
        <div style="background:#FFF7E6;padding:16px;border-radius:8px;text-align:center;border:1px solid #FFB005;">
          <p style="margin:0;font-size:12px;color:#999;margin-bottom:8px;">Taille du système</p>
          <p style="margin:0;font-size:24px;font-weight:bold;color:#0054A8;">{{systemSizeKw}} kW</p>
        </div>
        <div style="background:#FFF7E6;padding:16px;border-radius:8px;text-align:center;border:1px solid #FFB005;">
          <p style="margin:0;font-size:12px;color:#999;margin-bottom:8px;">Économies annuelles</p>
          <p style="margin:0;font-size:24px;font-weight:bold;color:#16A34A;">{{annualSavings}}$</p>
        </div>
        <div style="background:#FFF7E6;padding:16px;border-radius:8px;text-align:center;border:1px solid #FFB005;">
          <p style="margin:0;font-size:12px;color:#999;margin-bottom:8px;">Coût de l'inaction</p>
          <p style="margin:0;font-size:24px;font-weight:bold;color:#EF4444;">{{costOfInaction}}$</p>
        </div>
      </div>

      <h3 style="margin-top:24px;margin-bottom:12px;color:#1f2937;">Prochaines étapes:</h3>
      <ol style="padding-left:20px;color:#666;">
        <li style="margin:8px 0;"><strong>Données réelles Hydro-Québec:</strong> Avec votre procuration, nous accédons à votre profil de consommation heure par heure — la clé pour optimiser davantage.</li>
        <li style="margin:8px 0;"><strong>Analyse détaillée:</strong> Simulation 8 760 heures pour trouver votre configuration optimale (PV + stockage si applicable).</li>
        <li style="margin:8px 0;"><strong>Rapport complet:</strong> Projections financières, comparaison de scénarios d'acquisition, et stratégie d'incitatifs.</li>
      </ol>

      <p style="text-align:center;margin:30px 0;">
        <a href="{{procurationUrl}}" class="button">Obtenez votre analyse complète avec données réelles →</a>
      </p>

      <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:20px 0;">
        <p style="margin:0;font-size:13px;color:#666;"><strong>Pourquoi cette démarche en deux étapes?</strong> La première analyse utilise l'imagerie satellite — rapide et gratuit. La deuxième utilise vos vraies données de consommation heure par heure, ce qui change tout pour optimiser votre investissement et maximiser vos retours.</p>
      </div>

      <p style="font-size:13px;color:#6b7280;margin-top:24px;">Questions? Répondez simplement à ce courriel — un humain vous répondra dans les 24h.</p>
    </div>
    <div class="footer">
      <p>kWh Québec - Solaire + Stockage C&I</p>
      <p>514.427.8871 | info@kwh.quebec</p>
    </div>
  </div>
</body></html>`,
      en: `<!DOCTYPE html><html><head>${baseStyles}</head><body>
  <div class="container">
    <div class="header">
      <h1>kWh Québec</h1>
    </div>
    <div class="content">
      <h2>Welcome {{contactName}}!</h2>
      <p>Thank you for your interest. We've received your solar analysis request and we're preparing a personalized report based on your data.</p>

      <div style="background:#f0f9ff;border-left:4px solid #0054A8;padding:16px;border-radius:0 8px 8px 0;margin:20px 0;">
        <p style="margin:0;font-weight:bold;margin-bottom:12px;color:#0054A8;">Your building analyzed:</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="padding:6px 0;border-bottom:1px solid #e5e7eb;">Address</td>
            <td style="padding:6px 0;border-bottom:1px solid #e5e7eb;text-align:right;"><strong>{{address}}</strong></td>
          </tr>
          <tr>
            <td style="padding:6px 0;border-bottom:1px solid #e5e7eb;">Building Type</td>
            <td style="padding:6px 0;border-bottom:1px solid #e5e7eb;text-align:right;">{{buildingType}}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;">Estimated Annual Consumption</td>
            <td style="padding:6px 0;text-align:right;"><strong>{{annualConsumptionKwh}} kWh/year</strong></td>
          </tr>
        </table>
      </div>

      <h3 style="margin-top:24px;margin-bottom:12px;color:#1f2937;">Your Solar Potential:</h3>
      <p style="color:#666;margin-bottom:16px;">Based on satellite analysis and your consumption profile, here's what we estimate:</p>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:20px 0;">
        <div style="background:#FFF7E6;padding:16px;border-radius:8px;text-align:center;border:1px solid #FFB005;">
          <p style="margin:0;font-size:12px;color:#999;margin-bottom:8px;">System Size</p>
          <p style="margin:0;font-size:24px;font-weight:bold;color:#0054A8;">{{systemSizeKw}} kW</p>
        </div>
        <div style="background:#FFF7E6;padding:16px;border-radius:8px;text-align:center;border:1px solid #FFB005;">
          <p style="margin:0;font-size:12px;color:#999;margin-bottom:8px;">Annual Savings</p>
          <p style="margin:0;font-size:24px;font-weight:bold;color:#16A34A;">\${{annualSavings}}</p>
        </div>
        <div style="background:#FFF7E6;padding:16px;border-radius:8px;text-align:center;border:1px solid #FFB005;">
          <p style="margin:0;font-size:12px;color:#999;margin-bottom:8px;">Cost of Inaction</p>
          <p style="margin:0;font-size:24px;font-weight:bold;color:#EF4444;">\${{costOfInaction}}</p>
        </div>
      </div>

      <h3 style="margin-top:24px;margin-bottom:12px;color:#1f2937;">Next Steps:</h3>
      <ol style="padding-left:20px;color:#666;">
        <li style="margin:8px 0;"><strong>Real Hydro-Québec Data:</strong> With your authorization, we access your hour-by-hour consumption profile — the key to further optimization.</li>
        <li style="margin:8px 0;"><strong>Detailed Analysis:</strong> 8,760-hour simulation to find your optimal configuration (PV + storage if applicable).</li>
        <li style="margin:8px 0;"><strong>Complete Report:</strong> Financial projections, acquisition scenario comparison, and incentive strategy.</li>
      </ol>

      <p style="text-align:center;margin:30px 0;">
        <a href="{{procurationUrl}}" class="button">Get your complete analysis with real data →</a>
      </p>

      <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:20px 0;">
        <p style="margin:0;font-size:13px;color:#666;"><strong>Why this two-step approach?</strong> The first analysis uses satellite imagery — fast and free. The second uses your real hour-by-hour consumption data, which changes everything for optimization and maximizing your returns.</p>
      </div>

      <p style="font-size:13px;color:#6b7280;margin-top:24px;">Questions? Just reply to this email — a human will respond within 24 hours.</p>
    </div>
    <div class="footer">
      <p>kWh Québec - Turnkey C&I Solar + Storage</p>
      <p>514.427.8871 | info@kwh.quebec</p>
    </div>
  </div>
</body></html>`,
    },
    text: {
      fr: `Bienvenue {{contactName}}!\n\nMerci de votre confiance. Nous avons reçu votre demande d'analyse solaire.\n\nVotre bâtiment:\n- Adresse: {{address}}\n- Type: {{buildingType}}\n- Consommation: {{annualConsumptionKwh}} kWh/an\n\nVotre potentiel:\n- Système: {{systemSizeKw}} kW\n- Économies annuelles: {{annualSavings}}$\n- Coût de l'inaction (5 ans): {{costOfInaction}}$\n\nProchaines étapes:\n1. Procuration Hydro-Québec (données réelles heure par heure)\n2. Analyse détaillée (simulation 8 760 heures)\n3. Rapport complet avec projections financières\n\nObtenez votre analyse: {{procurationUrl}}\n\nQuestions? Répondez à ce courriel.\n\nkWh Québec\n514.427.8871 | info@kwh.quebec`,
      en: `Welcome {{contactName}}!\n\nThank you for your interest. We've received your solar analysis request.\n\nYour building:\n- Address: {{address}}\n- Type: {{buildingType}}\n- Consumption: {{annualConsumptionKwh}} kWh/year\n\nYour potential:\n- System: {{systemSizeKw}} kW\n- Annual savings: \${{annualSavings}}\n- Cost of inaction (5 years): \${{costOfInaction}}\n\nNext steps:\n1. Hydro-Québec authorization (real hour-by-hour data)\n2. Detailed analysis (8,760-hour simulation)\n3. Complete report with financial projections\n\nGet your analysis: {{procurationUrl}}\n\nQuestions? Reply to this email.\n\nkWh Québec\n514.427.8871 | info@kwh.quebec`,
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
            <img src="${logoPlaceholder}" alt="kWh Québec" style="height: 60px; width: auto; max-width: 200px;" />
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
            <p style="margin: 0 0 5px 0;"><strong>kWh Québec</strong> - Solaire + Stockage</p>
            <p style="margin: 0;">Tel: 514.427.8871 | info@kwh.quebec | www.kwh.quebec</p>
          </div>
        </div>
      </body></html>`,
      en: `<!DOCTYPE html><html><head>${baseStyles}</head><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white;">
          <div style="text-align: center; padding: 25px 20px; background: linear-gradient(135deg, #003DA6 0%, #0054A8 100%);">
            <img src="${logoPlaceholder}" alt="kWh Québec" style="height: 60px; width: auto; max-width: 200px;" />
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

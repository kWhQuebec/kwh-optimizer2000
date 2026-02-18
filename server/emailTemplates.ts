function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const emailTemplates: Record<string, {
  subject_fr: string;
  subject_en: string;
  body_fr: string;
  body_en: string;
}> = {
  passwordReset: {
    subject_fr: "Réinitialisation de votre mot de passe — kWh Québec",
    subject_en: "Password Reset — kWh Québec",
    body_fr: `
      <h2>Réinitialisation de mot de passe</h2>
      <p>Votre mot de passe temporaire est :</p>
      <div class="highlight"><p style="font-size:18px;font-weight:bold;letter-spacing:1px;">{{tempPassword}}</p></div>
      <p>Connectez-vous avec ce mot de passe temporaire. Vous serez invité à le changer lors de votre prochaine connexion.</p>
      <p style="text-align:center;margin:30px 0;"><a href="{{loginUrl}}" class="button">Se connecter</a></p>
    `,
    body_en: `
      <h2>Password Reset</h2>
      <p>Your temporary password is:</p>
      <div class="highlight"><p style="font-size:18px;font-weight:bold;letter-spacing:1px;">{{tempPassword}}</p></div>
      <p>Log in with this temporary password. You will be prompted to change it on your next login.</p>
      <p style="text-align:center;margin:30px 0;"><a href="{{loginUrl}}" class="button">Log In</a></p>
    `,
  },
  userWelcome: {
    subject_fr: "Bienvenue sur kWh Québec",
    subject_en: "Welcome to kWh Québec",
    body_fr: `
      <h2>Bienvenue {{userName}}!</h2>
      <p>Votre compte a été créé avec le rôle <strong>{{userRole}}</strong>.</p>
      <p>Votre courriel : <strong>{{userEmail}}</strong></p>
      <p>Votre mot de passe temporaire : <strong>{{tempPassword}}</strong></p>
      <p>Veuillez vous connecter et changer votre mot de passe lors de votre première connexion.</p>
      <p style="text-align:center;margin:30px 0;"><a href="{{loginUrl}}" class="button">Se connecter</a></p>
    `,
    body_en: `
      <h2>Welcome {{userName}}!</h2>
      <p>Your account has been created with the role <strong>{{userRole}}</strong>.</p>
      <p>Your email: <strong>{{userEmail}}</strong></p>
      <p>Your temporary password: <strong>{{tempPassword}}</strong></p>
      <p>Please log in and change your password on your first login.</p>
      <p style="text-align:center;margin:30px 0;"><a href="{{loginUrl}}" class="button">Log In</a></p>
    `,
  },
};

const emailBaseLayout = (body: string, logoUrl?: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;">
<div style="max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#003DA6;padding:20px;text-align:center;border-radius:8px 8px 0 0;">
    ${logoUrl ? `<img src="${logoUrl}" alt="kWh Québec" style="max-height:40px;" />` : '<span style="color:#fff;font-size:22px;font-weight:700;">kWh Québec</span>'}
  </div>
  <div style="background:#fff;padding:30px;border-radius:0 0 8px 8px;">
    ${body}
  </div>
  <p style="text-align:center;color:#888;font-size:12px;margin-top:20px;">kWh Québec Inc. | info@kwhquebec.ca</p>
</div>
</body>
</html>
`;

export function renderEmailTemplate(
  templateKey: string,
  language: 'fr' | 'en',
  data: Record<string, string>
): { subject: string; html: string; text?: string } {
  const allTemplates: Record<string, typeof emailTemplates[string]> = {
    ...emailTemplates,
    nurtureCTA1,
    nurtureReengagement,
  };

  const template = allTemplates[templateKey];
  if (!template) {
    throw new Error(`Email template "${templateKey}" not found`);
  }

  const subjectKey = `subject_${language}` as keyof typeof template;
  const bodyKey = `body_${language}` as keyof typeof template;

  let subject = template[subjectKey] || template.subject_fr;
  let body = template[bodyKey] || template.body_fr;

  const urlKeys = new Set(['loginUrl', 'logoUrl', 'calendlyUrl', 'portalUrl', 'dashboardUrl']);

  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{{${key}}}`;
    const safeValue = urlKeys.has(key) ? value : escapeHtml(value);
    subject = subject.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), safeValue);
    body = body.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), safeValue);
  }

  const html = emailBaseLayout(body, data.logoUrl);
  const text = body.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

  return { subject, html, text };
}

// Email template for nurtureCTA1 (Day 1)
export const nurtureCTA1 = {
  subject_fr: "Bonjour {{contactName}}, voici votre analyse solaire",
  body_fr: `
      <h2>Bonjour {{contactName}},</h2>
      <p>Vous avez reçu une analyse solaire personnalisée pour votre bâtiment.</p>
      
      <div class="highlight">
        <p>Avec un système estimé à {{estimatedSystemSize}} et des économies potentielles de {{estimatedSavings}}/an, une conversation de 10 minutes pourrait faire toute la différence.</p>
      </div>

      <ul style="padding-left: 20px;">
        <li>Confirmer notre estimation initiale</li>
        <li>Répondre à vos objections ou préoccupations</li>
        <li>Débloquer votre rapport personnalisé détaillé</li>
      </ul>

      <p style="text-align: center; margin: 30px 0;">
        <a href="{{calendlyUrl}}" class="button">Réserver mon appel découverte →</a>
      </p>
  `,
  subject_en: "Hello {{contactName}}, here's your solar analysis",
  body_en: `
      <h2>Hello {{contactName}},</h2>
      <p>You've received a personalized solar analysis for your building.</p>
      
      <div class="highlight">
        <p>With an estimated {{estimatedSystemSize}} system and potential savings of {{estimatedSavings}}/year, a 10-minute conversation could make all the difference.</p>
      </div>

      <ul style="padding-left: 20px;">
        <li>Confirm our initial estimate</li>
        <li>Address any concerns or questions</li>
        <li>Unlock your detailed personalized report</li>
      </ul>

      <p style="text-align: center; margin: 30px 0;">
        <a href="{{calendlyUrl}}" class="button">Book my discovery call →</a>
      </p>
  `
};

// Email template for nurtureReengagement (Day 30)
export const nurtureReengagement = {
  subject_fr: "{{contactName}}, une opportunité solaire vous attend",
  body_fr: `
      <h2>Bonjour {{contactName}},</h2>
      
      <div class="highlight">
        <p>Depuis notre dernière communication, votre bâtiment continue de payer le plein tarif d'Hydro-Québec — soit environ {{monthlyBill}}/mois. Avec le solaire, vous pourriez économiser {{estimatedSavings}}/an.</p>
      </div>

      <p>Nous avons une question simple: avez-vous pensé au solaire pour votre bâtiment?</p>
      <p>Votre bâtiment continue de payer le plein tarif d'Hydro-Québec.</p>
  `,
  subject_en: "{{contactName}}, a solar opportunity awaits",
  body_en: `
      <h2>Hello {{contactName}},</h2>
      
      <div class="highlight">
        <p>Since our last communication, your building continues to pay full Hydro-Québec rates — approximately {{monthlyBill}}/month. With solar, you could save {{estimatedSavings}}/year.</p>
      </div>

      <p>We have a simple question: have you considered solar for your building?</p>
      <p>Your building continues to pay full Hydro-Québec rates.</p>
  `
};

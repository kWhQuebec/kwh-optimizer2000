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

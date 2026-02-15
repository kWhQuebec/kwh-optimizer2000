/**
 * Helper functions for YELLOW lead follow-up emails
 * Maps leadColorReason to specific missing information items
 */

export interface MissingItems {
  missingItemsFr: string;
  missingItemsEn: string;
}

/**
 * Map leadColorReason to specific missing information items
 * Returns HTML-formatted bullet lists in French and English
 */
export function getMissingItemsFromReason(
  leadColorReason: string | null | undefined
): MissingItems {
  if (!leadColorReason) {
    // Default if no reason provided
    return {
      missingItemsFr: `<li>Détails de consommation d'électricité actuelle</li>
<li>État et âge de la toiture</li>
<li>Informations de financement souhaité</li>`,
      missingItemsEn: `<li>Current electricity consumption details</li>
<li>Roof condition and age</li>
<li>Preferred financing information</li>`,
    };
  }

  const reason = leadColorReason.toLowerCase();
  const items: MissingItems = {
    missingItemsFr: '',
    missingItemsEn: '',
  };

  // Parse the reason string and build missing items lists
  // The reason typically contains multiple flags separated by periods or commas
  const frItems: string[] = [];
  const enItems: string[] = [];

  // Roof age related
  if (reason.includes('toiture') && reason.includes('ans')) {
    frItems.push(
      '<li><strong>Documentation de toiture:</strong> Photos récentes, certificat d\'âge ou documents d\'installation</li>'
    );
    enItems.push(
      '<li><strong>Roof documentation:</strong> Recent photos, age certificate, or installation documents</li>'
    );
  }

  // Authorization/lease related
  if (reason.includes('propriétaire') || reason.includes('autorisation')) {
    frItems.push(
      '<li><strong>Autorisation du propriétaire:</strong> Lettre ou document confirmant l\'autorisation d\'installation</li>'
    );
    enItems.push(
      '<li><strong>Owner authorization:</strong> Letter or document confirming installation approval</li>'
    );
  }

  // Billing/shared consumption related
  if (reason.includes('facture') || reason.includes('répartition')) {
    frItems.push(
      '<li><strong>Facture d\'électricité récente:</strong> Dernière facture Hydro-Québec (3-6 mois) pour valider la consommation</li>'
    );
    enItems.push(
      '<li><strong>Recent electricity bill:</strong> Latest Hydro-Québec bill (3-6 months) to validate consumption</li>'
    );
  }

  // Load changes planned
  if (reason.includes('charge') || reason.includes('changement')) {
    frItems.push(
      '<li><strong>Calendrier des changements prévus:</strong> Dates et détails de tout changement de charge/procédé</li>'
    );
    enItems.push(
      '<li><strong>Planned changes timeline:</strong> Dates and details of any load/process changes</li>'
    );
  }

  // Roof condition
  if (reason.includes('état') || reason.includes('réparation') || reason.includes('pente')) {
    frItems.push(
      '<li><strong>Photos de la toiture:</strong> Images de l\'état actuel et du type de matériau</li>'
    );
    enItems.push(
      '<li><strong>Roof photos:</strong> Images of current condition and material type</li>'
    );
  }

  // Structural capacity
  if (reason.includes('structural') || reason.includes('structurale')) {
    frItems.push(
      '<li><strong>Évaluation structurale:</strong> Données techniques sur la capacité de la toiture ou plans du bâtiment</li>'
    );
    enItems.push(
      '<li><strong>Structural assessment:</strong> Technical data on roof capacity or building plans</li>'
    );
  }

  // Electrical capacity
  if (reason.includes('électrique') || reason.includes('capacité')) {
    frItems.push(
      '<li><strong>Évaluation électrique:</strong> Photos du panneau électrique et détails de la capacité d\'interconnexion</li>'
    );
    enItems.push(
      '<li><strong>Electrical evaluation:</strong> Photos of electrical panel and interconnection capacity details</li>'
    );
  }

  // Nurturing/qualification in progress
  if (reason.includes('nurturing') || reason.includes('qualification en cours')) {
    frItems.push(
      '<li><strong>Calendrier de décision:</strong> Quand prévoyez-vous de finaliser votre évaluation?</li>'
    );
    enItems.push(
      '<li><strong>Decision timeline:</strong> When do you plan to finalize your evaluation?</li>'
    );
  }

  // If we extracted items, use them; otherwise provide defaults
  if (frItems.length > 0) {
    items.missingItemsFr = frItems.join('\n');
    items.missingItemsEn = enItems.join('\n');
  } else {
    // Fallback to generic items if parsing didn't match anything
    items.missingItemsFr = `<li>Détails de consommation d'électricité actuels</li>
<li>État et documentation de la toiture</li>
<li>Informations sur votre chronologie de décision</li>`;
    items.missingItemsEn = `<li>Current electricity consumption details</li>
<li>Roof condition and documentation</li>
<li>Information about your decision timeline</li>`;
  }

  return items;
}

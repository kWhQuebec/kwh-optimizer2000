/**
 * PDF Report Enhancements — TOC + Glossary/Reference + Enhanced Methodology
 * 
 * Drop-in pages for pdfGeneratorV2.ts. Import and insert into the pages array.
 * Usage in pdfGeneratorV2.ts:
 *   import { buildTableOfContents, buildGlossaryPage, buildMethodologyPage } from './pdfEnhancements';
 *   // Insert TOC after cover: pages.splice(1, 0, buildTableOfContents(lang));
 *   // Append glossary + methodology before last page: pages.splice(-1, 0, buildGlossaryPage(lang), buildMethodologyPage(lang));
 */

// ─── Types ───────────────────────────────────────────────────────────────────

type Lang = 'fr' | 'en';

interface TocEntry {
  title: string;
  page: number;
  indent?: boolean;
}

// ─── Shared Styles ───────────────────────────────────────────────────────────

const pageStyle = `
  <style>
    .enhancement-page {
      page-break-before: always;
      padding: 60px 50px;
      font-family: 'Inter', 'Segoe UI', sans-serif;
      color: #1a1a2e;
      position: relative;
      min-height: 100vh;
    }
    .enhancement-page h2 {
      font-size: 28px;
      font-weight: 700;
      color: #0f4c81;
      margin-bottom: 30px;
      padding-bottom: 12px;
      border-bottom: 3px solid #f7941d;
    }
    .toc-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .toc-item {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 10px 0;
      border-bottom: 1px dotted #ccc;
      font-size: 15px;
    }
    .toc-item.indented {
      padding-left: 24px;
      font-size: 13px;
      color: #555;
    }
    .toc-item .toc-title { flex: 1; }
    .toc-item .toc-page {
      font-weight: 600;
      color: #0f4c81;
      min-width: 30px;
      text-align: right;
    }
    .glossary-grid {
      display: grid;
      grid-template-columns: 160px 1fr;
      gap: 8px 20px;
      font-size: 13px;
      line-height: 1.6;
    }
    .glossary-term {
      font-weight: 700;
      color: #0f4c81;
    }
    .glossary-def { color: #333; }
    .methodology-section {
      margin-bottom: 24px;
    }
    .methodology-section h3 {
      font-size: 16px;
      font-weight: 600;
      color: #0f4c81;
      margin-bottom: 8px;
    }
    .methodology-section p, .methodology-section ul {
      font-size: 13px;
      line-height: 1.7;
      color: #333;
      margin: 0 0 8px 0;
    }
    .methodology-section ul {
      padding-left: 20px;
    }
    .data-source-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-top: 12px;
    }
    .data-source-table th {
      background: #0f4c81;
      color: white;
      padding: 8px 12px;
      text-align: left;
      font-weight: 600;
    }
    .data-source-table td {
      padding: 8px 12px;
      border-bottom: 1px solid #e0e0e0;
    }
    .data-source-table tr:nth-child(even) td {
      background: #f8f9fa;
    }
    .disclaimer-box {
      background: #fff3cd;
      border-left: 4px solid #f7941d;
      padding: 16px 20px;
      margin-top: 24px;
      font-size: 12px;
      line-height: 1.6;
      color: #664d03;
      border-radius: 0 4px 4px 0;
    }
  </style>
`;

// ─── Table of Contents ───────────────────────────────────────────────────────

const tocEntries: Record<Lang, TocEntry[]> = {
  fr: [
    { title: 'Pourquoi le solaire maintenant', page: 3 },
    { title: 'Aperçu du projet', page: 4 },
    { title: 'Résultats financiers', page: 5 },
    { title: 'Investissement net', page: 6 },
    { title: 'Incitatifs et subventions', page: 6, indent: true },
    { title: 'Profil énergétique', page: 7 },
    { title: 'Stockage par batterie', page: 8 },
    { title: 'Projections financières 25 ans', page: 9 },
    { title: 'Équipements', page: 10 },
    { title: 'Livraison et assurances', page: 11 },
    { title: 'Score de compatibilité (Fit Score)', page: 12 },
    { title: 'Hypothèses et méthodologie', page: 13 },
    { title: 'Glossaire et références', page: 14 },
    { title: 'Prochaines étapes', page: 15 },
  ],
  en: [
    { title: 'Why Solar Now', page: 3 },
    { title: 'Project Snapshot', page: 4 },
    { title: 'Financial Results', page: 5 },
    { title: 'Net Investment', page: 6 },
    { title: 'Incentives & Rebates', page: 6, indent: true },
    { title: 'Energy Profile', page: 7 },
    { title: 'Battery Storage', page: 8 },
    { title: '25-Year Financial Projections', page: 9 },
    { title: 'Equipment', page: 10 },
    { title: 'Delivery Assurance', page: 11 },
    { title: 'Fit Score', page: 12 },
    { title: 'Assumptions & Methodology', page: 13 },
    { title: 'Glossary & References', page: 14 },
    { title: 'Next Steps', page: 15 },
  ],
};

export function buildTableOfContents(lang: Lang = 'fr'): string {
  const title = lang === 'fr' ? 'Table des matières' : 'Table of Contents';
  const entries = tocEntries[lang];

  const items = entries
    .map(
      (e) =>
        `<li class="toc-item${e.indent ? ' indented' : ''}">
          <span class="toc-title">${e.title}</span>
          <span class="toc-page">${e.page}</span>
        </li>`
    )
    .join('');

  return `
    ${pageStyle}
    <div class="enhancement-page">
      <h2>${title}</h2>
      <ul class="toc-list">${items}</ul>
    </div>
  `;
}

// ─── Glossary & References ───────────────────────────────────────────────────

interface GlossaryEntry {
  term: string;
  definition: string;
}

const glossary: Record<Lang, GlossaryEntry[]> = {
  fr: [
    { term: 'BESS', definition: "Battery Energy Storage System — système de stockage d'énergie par batterie, typiquement lithium-ion." },
    { term: 'BOM', definition: 'Bill of Materials — liste détaillée de tous les composants et matériaux nécessaires au projet.' },
    { term: 'EPC', definition: "Engineering, Procurement, Construction — contrat clé en main couvrant l'ingénierie, l'approvisionnement et la construction." },
    { term: 'Fit Score', definition: "Score de compatibilité projet (0-100). Green (70+): projet idéal. Yellow (40-69): viable avec ajustements. Red (<40): obstacles majeurs." },
    { term: 'HQ', definition: "Hydro-Québec — fournisseur d'électricité provincial et gestionnaire du réseau de distribution." },
    { term: 'ITC', definition: "Investment Tax Credit — crédit d'impôt fédéral de 30% sur le coût total du système solaire." },
    { term: 'IRR', definition: 'Internal Rate of Return — taux de rendement interne annualisé sur la durée de vie du système.' },
    { term: 'kWh/kWp', definition: "Kilowatt-heure produit par kilowatt-crête installé — mesure de productivité solaire (baseline Québec: 1 150 kWh/kWp)." },
    { term: 'LCOE', definition: "Levelized Cost of Energy — coût moyen actualisé de l'énergie sur 25 ans, en ¢/kWh." },
    { term: 'Mesurage net', definition: "Programme d'Hydro-Québec permettant d'injecter le surplus solaire sur le réseau et de recevoir des crédits sur la facture." },
    { term: 'NPV', definition: "Net Present Value — valeur actuelle nette du projet, actualisant tous les flux sur 25 ans au taux d'actualisation spécifié." },
    { term: 'PTO', definition: "Permission to Operate — autorisation officielle d'Hydro-Québec pour la mise en service et l'interconnexion au réseau." },
    { term: 'Risk Flags', definition: "Indicateurs de risque projet: Lease complexity, Roof risk, Electrical upgrade, HQ interconnect, Load change, Structure." },
    { term: 'Tarif D/M/G/DP', definition: "Tarifs d'Hydro-Québec: D (domestique), M (général <100kW), G (général 100-5000kW), DP (grande puissance)." },
  ],
  en: [
    { term: 'BESS', definition: 'Battery Energy Storage System — typically lithium-ion battery storage integrated with solar.' },
    { term: 'BOM', definition: 'Bill of Materials — detailed list of all components and materials required for the project.' },
    { term: 'EPC', definition: 'Engineering, Procurement, Construction — turnkey contract covering design through installation.' },
    { term: 'Fit Score', definition: 'Project compatibility score (0-100). Green (70+): ideal project. Yellow (40-69): viable with adjustments. Red (<40): major obstacles.' },
    { term: 'HQ', definition: "Hydro-Québec — Quebec's provincial electricity utility and grid operator." },
    { term: 'ITC', definition: 'Investment Tax Credit — 30% federal tax credit on total solar system cost.' },
    { term: 'IRR', definition: 'Internal Rate of Return — annualized return rate over the system lifetime.' },
    { term: 'kWh/kWp', definition: 'Kilowatt-hours produced per kilowatt-peak installed — solar productivity metric (Quebec baseline: 1,150 kWh/kWp).' },
    { term: 'LCOE', definition: 'Levelized Cost of Energy — average discounted energy cost over 25 years, in ¢/kWh.' },
    { term: 'Net Metering', definition: "Hydro-Québec program allowing solar surplus injection to the grid with bill credits." },
    { term: 'NPV', definition: 'Net Present Value — present value of all project cash flows discounted over 25 years.' },
    { term: 'PTO', definition: "Permission to Operate — Hydro-Québec's official authorization for grid interconnection and commissioning." },
    { term: 'Risk Flags', definition: 'Project risk indicators: Lease complexity, Roof risk, Electrical upgrade, HQ interconnect, Load change, Structure.' },
    { term: 'Rate D/M/G/DP', definition: "Hydro-Québec rates: D (domestic), M (general <100kW), G (general 100-5000kW), DP (large power)." },
  ],
};

const references: Record<Lang, string[]> = {
  fr: [
    'Hydro-Québec — Tarifs et conditions de service (2025)',
    "Hydro-Québec — Programme d'autoproduction (mesurage net)",
    "Gouvernement du Canada — Crédit d'impôt à l'investissement pour technologies propres (ITC 30%)",
    'NREL — PVWatts Calculator (rendement solaire estimé)',
    'Régie de l\'énergie du Québec — Décisions tarifaires',
    'CCQ — Convention collective de la construction',
    'RBQ — Exigences de licence entrepreneur en construction',
  ],
  en: [
    'Hydro-Québec — Rates and Conditions of Service (2025)',
    'Hydro-Québec — Self-Generation Program (Net Metering)',
    'Government of Canada — Clean Technology Investment Tax Credit (ITC 30%)',
    'NREL — PVWatts Calculator (estimated solar yield)',
    "Régie de l'énergie du Québec — Rate Decisions",
    'CCQ — Construction Industry Collective Agreement',
    'RBQ — Contractor License Requirements',
  ],
};

export function buildGlossaryPage(lang: Lang = 'fr'): string {
  const title = lang === 'fr' ? 'Glossaire et références' : 'Glossary & References';
  const refTitle = lang === 'fr' ? 'Sources et références' : 'Sources & References';
  const entries = glossary[lang];
  const refs = references[lang];

  const glossaryHtml = entries
    .map(
      (e) =>
        `<div class="glossary-term">${e.term}</div>
        <div class="glossary-def">${e.definition}</div>`
    )
    .join('');

  const refsHtml = refs.map((r) => `<li>${r}</li>`).join('');

  return `
    ${pageStyle}
    <div class="enhancement-page">
      <h2>${title}</h2>
      <div class="glossary-grid">${glossaryHtml}</div>
      <div class="methodology-section" style="margin-top: 36px;">
        <h3>${refTitle}</h3>
        <ul>${refsHtml}</ul>
      </div>
    </div>
  `;
}

// ─── Enhanced Methodology Page ───────────────────────────────────────────────

export function buildMethodologyPage(lang: Lang = 'fr'): string {
  const isFr = lang === 'fr';
  const title = isFr ? 'Méthodologie détaillée' : 'Detailed Methodology';

  const content = isFr
    ? `
      <div class="methodology-section">
        <h3>1. Dimensionnement solaire</h3>
        <p>Le système est dimensionné pour couvrir le maximum de consommation sans surproduction excessive.
           L'algorithme teste 11 scénarios (25% à 150% de couverture) et sélectionne le ratio optimal
           basé sur le meilleur NPV sur 25 ans.</p>
        <table class="data-source-table">
          <tr><th>Paramètre</th><th>Source</th><th>Valeur de base</th></tr>
          <tr><td>Rendement solaire</td><td>NREL PVWatts / Google Solar API</td><td>1 150 kWh/kWp (Québec)</td></tr>
          <tr><td>Dégradation panneaux</td><td>Spec fabricant (conservateur)</td><td>0.5%/an</td></tr>
          <tr><td>Pertes système</td><td>Standard industrie</td><td>14% (câblage, onduleur, ombrage)</td></tr>
          <tr><td>Tarif électricité</td><td>Hydro-Québec tarifs officiels</td><td>Variable selon tarif D/M/G/DP</td></tr>
          <tr><td>Escalade tarifaire</td><td>Historique HQ 10 ans</td><td>3%/an</td></tr>
        </table>
      </div>

      <div class="methodology-section">
        <h3>2. Analyse financière</h3>
        <p>Le moteur financier (cashflowEngine) projette les flux sur 25 ans en intégrant:</p>
        <ul>
          <li>ITC fédéral 30% (crédit d'impôt à l'investissement, technologies propres)</li>
          <li>Incitatif HQ de 1 000 $/kW (programme autoproduction)</li>
          <li>Amortissement fiscal accéléré (CCA classe 43.1/43.2)</li>
          <li>Coûts O&M estimés à 15 $/kW/an avec escalade de 2%/an</li>
          <li>Taux d'actualisation: 6% (par défaut, ajustable)</li>
        </ul>
      </div>

      <div class="methodology-section">
        <h3>3. Qualification du projet</h3>
        <p>Le score de compatibilité (Fit Score) évalue 4 portes indépendantes:</p>
        <ul>
          <li><strong>Porte 1 — Financière</strong> (40 pts): NPV, IRR, payback</li>
          <li><strong>Porte 2 — Technique</strong> (25 pts): toiture, structure, orientation, ombrage</li>
          <li><strong>Porte 3 — Réglementaire</strong> (20 pts): interconnexion HQ, permis, zoning</li>
          <li><strong>Porte 4 — Client</strong> (15 pts): motivation, timeline, budget, propriété</li>
        </ul>
      </div>

      <div class="disclaimer-box">
        <strong>Avertissement:</strong> Ce rapport est une estimation préliminaire basée sur les données disponibles.
        Les résultats réels peuvent varier selon les conditions du site, les tarifs en vigueur, et les approbations
        réglementaires. Une visite de site et une conception détaillée sont requises avant tout engagement contractuel.
        Ce document ne constitue pas une offre ferme.
      </div>
    `
    : `
      <div class="methodology-section">
        <h3>1. Solar Sizing</h3>
        <p>The system is sized to cover maximum consumption without excessive overproduction.
           The algorithm tests 11 scenarios (25% to 150% coverage) and selects the optimal ratio
           based on the best 25-year NPV.</p>
        <table class="data-source-table">
          <tr><th>Parameter</th><th>Source</th><th>Baseline Value</th></tr>
          <tr><td>Solar Yield</td><td>NREL PVWatts / Google Solar API</td><td>1,150 kWh/kWp (Quebec)</td></tr>
          <tr><td>Panel Degradation</td><td>Manufacturer spec (conservative)</td><td>0.5%/year</td></tr>
          <tr><td>System Losses</td><td>Industry standard</td><td>14% (wiring, inverter, shading)</td></tr>
          <tr><td>Electricity Rate</td><td>Hydro-Québec official rates</td><td>Variable by rate D/M/G/DP</td></tr>
          <tr><td>Rate Escalation</td><td>HQ 10-year historical</td><td>3%/year</td></tr>
        </table>
      </div>

      <div class="methodology-section">
        <h3>2. Financial Analysis</h3>
        <p>The financial engine (cashflowEngine) projects cash flows over 25 years including:</p>
        <ul>
          <li>Federal ITC 30% (Clean Technology Investment Tax Credit)</li>
          <li>HQ incentive of $1,000/kW (self-generation program)</li>
          <li>Accelerated capital cost allowance (CCA class 43.1/43.2)</li>
          <li>O&M costs estimated at $15/kW/year with 2%/year escalation</li>
          <li>Discount rate: 6% (default, adjustable)</li>
        </ul>
      </div>

      <div class="methodology-section">
        <h3>3. Project Qualification</h3>
        <p>The Fit Score evaluates 4 independent gates:</p>
        <ul>
          <li><strong>Gate 1 — Financial</strong> (40 pts): NPV, IRR, payback</li>
          <li><strong>Gate 2 — Technical</strong> (25 pts): roof, structure, orientation, shading</li>
          <li><strong>Gate 3 — Regulatory</strong> (20 pts): HQ interconnection, permits, zoning</li>
          <li><strong>Gate 4 — Client</strong> (15 pts): motivation, timeline, budget, ownership</li>
        </ul>
      </div>

      <div class="disclaimer-box">
        <strong>Disclaimer:</strong> This report is a preliminary estimate based on available data.
        Actual results may vary based on site conditions, applicable rates, and regulatory approvals.
        A site visit and detailed design are required before any contractual commitment.
        This document does not constitute a firm offer.
      </div>
    `;

  return `
    ${pageStyle}
    <div class="enhancement-page">
      <h2>${title}</h2>
      ${content}
    </div>
  `;
}

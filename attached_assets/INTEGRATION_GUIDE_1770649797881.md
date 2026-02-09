# Guide d'Intégration - PDF Generator V2

## Vue d'ensemble

Ce générateur PDF utilise **Puppeteer** pour convertir du HTML/CSS en PDF. Avantages:
- **Zéro page blanche** - CSS gère le layout automatiquement
- **Pas de contenu orphelin** - `page-break-inside: avoid` empêche les coupures
- **Pixel-perfect** - Le PDF ressemble exactement au HTML
- **Facile à modifier** - CSS standard, pas de calculs de position Y

---

## Installation

### 1. Installer Puppeteer sur Replit

Dans le Shell Replit:
```bash
npm install puppeteer
```

**Note Replit**: Puppeteer fonctionne sur Replit mais nécessite les flags `--no-sandbox`. C'est déjà inclus dans le code.

### 2. Copier le fichier

Copie `pdfGeneratorV2.ts` dans ton dossier `server/services/`

### 3. L'import original n'est plus nécessaire

Le fichier définit maintenant ses propres interfaces TypeScript. Si tu as déjà des types dans `../types`, tu peux les adapter ou utiliser directement ceux du fichier.

---

## Utilisation

### Dans ton API endpoint

```typescript
import { PDFGeneratorV2 } from './services/pdfGeneratorV2';

app.post('/api/generate-report', async (req, res) => {
  const { projectId } = req.body;

  // Récupère les données du projet
  const projectData = await getProjectData(projectId);
  const analysisResult = await getAnalysisResult(projectId);
  const financialProjections = await getFinancialProjections(projectId);
  const battery = await getBatteryConfig(projectId);
  const energyProfile = await getEnergyProfile(projectId);

  // Génère le PDF
  const generator = new PDFGeneratorV2();
  const pdfBuffer = await generator.generateReport({
    projectData,
    analysisResult,
    financialProjections,
    battery,
    energyProfile,
    roofConfig: projectData.roofConfig,
    equipment: projectData.equipment,
    assumptions: projectData.assumptions,
    exclusions: projectData.exclusions,
    // Images en base64 (optionnel)
    logoBase64: 'data:image/png;base64,...',
    satelliteImageBase64: analysisResult.satelliteImage,
    roofConfigImageBase64: analysisResult.roofConfigImage,
    clientLogos: ['data:image/png;base64,...'],
  });

  // Retourne le PDF
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="rapport-${projectData.name}.pdf"`);
  res.send(pdfBuffer);
});
```

---

## Interfaces TypeScript

### PDFGeneratorOptions (principal)

```typescript
interface PDFGeneratorOptions {
  projectData: {
    name?: string;
    address?: string;
    buildingType?: string;
    roofArea?: number;
    annualConsumption?: number;
    hqTariffCode?: string;          // NEW: Code tarifaire HQ (ex: "M")
    contactName?: string;
  };
  analysisResult: {
    systemSize?: number;
    annualProduction?: number;
    coveragePercent?: number;
    co2Avoided?: number;
    totalPanels?: number;
    usedArea?: number;
    specificYield?: number;         // NEW: kWh/kWc (ex: 1035)
    systemEfficiency?: number;      // NEW: % (ex: 90)
  };
  financialProjections: {
    grossCost?: number;
    federalItcPct?: number;         // NEW: 30 (%)
    federalItcAmount?: number;      // NEW: montant ITC calculé
    hqAutoproductionPerKw?: number; // NEW: 1000 ($/kW)
    hqAutoproductionAmount?: number;// NEW: montant HQ calculé
    netCost?: number;               // NEW: coût net après incitatifs
    totalSavings25yr?: number;
    roi?: number;
    paybackYears?: number;
    irr?: number;
    npv?: number;
    lcoe?: number;                  // NEW: coût actualisé $/kWh
    yearOneSavings?: number;
    yearTenSavings?: number;
    yearTwentyFiveSavings?: number;
    costOfInaction?: number;
    annualProduction?: number;
    depreciationBenefitMin?: number; // NEW: avantage amortissement min
    depreciationBenefitMax?: number; // NEW: avantage amortissement max
  };
  battery?: BatteryConfig;          // NEW: config batterie
  energyProfile?: EnergyProfile;    // NEW: profil énergétique
  roofConfig?: { segments?: RoofSegment[]; panelType?: string; };
  equipment?: EquipmentItem[];
  assumptions?: string[];
  exclusions?: string[];
  clientLogos?: string[];           // NEW: logos clients (text ou base64)
  satelliteImageBase64?: string;    // NEW: image satellite
  roofConfigImageBase64?: string;   // NEW: image config panneaux
  logoBase64?: string;              // NEW: logo kWh Québec
}
```

### BatteryConfig (nouveau)

```typescript
interface BatteryConfig {
  capacityKwh: number;              // ex: 100
  powerKw: number;                  // ex: 50
  dischargeDurationHrs: number;     // ex: 2
  technology: string;               // ex: "LFP (Lithium Fer Phosphate)"
  lifeYears: number;                // ex: 15
  cycles: number;                   // ex: 6000
  peakReductionPct: number;         // ex: 22
  additionalSavingsPerYear: number; // ex: 8400
  peakBefore: number;               // ex: 280 (kW)
  peakAfter: number;                // ex: 218 (kW)
}
```

### EnergyProfile (nouveau)

```typescript
interface EnergyProfile {
  selfConsumptionPct: number;       // ex: 85
  solarCoveragePct: number;         // ex: 72
  surplusPct: number;               // ex: 15
  dataAccuracyPct: number;          // ex: 95
}
```

---

## Personnalisation

### Modifier les couleurs (Brand)

Les couleurs suivent le **Brand Guideline kWh Québec**. Dans `getStyles()`, section `:root`:
```css
:root {
  --primary: #003DA6;      /* KWH Blue (brand primary) */
  --secondary: #002D7A;    /* Darker Blue */
  --accent: #FFB005;       /* KWH Gold/Yellow (brand primary) */
  --dark: #2A2A2B;         /* Texte foncé */
}
```

### Ajouter ton logo

Passe le logo en base64 dans les options:
```typescript
const pdfBuffer = await generator.generateReport({
  ...data,
  logoBase64: `data:image/png;base64,${fs.readFileSync('logo.png').toString('base64')}`,
});
```

Si `logoBase64` n'est pas fourni, un placeholder SVG est affiché.

### Intégrer les images satellite et config toiture

Même principe — passe-les en base64:
```typescript
{
  satelliteImageBase64: `data:image/png;base64,${satelliteBase64}`,
  roofConfigImageBase64: `data:image/png;base64,${configBase64}`,
}
```

### Intégrer les logos clients

Tu peux passer des noms (texte) ou des images base64:
```typescript
{
  clientLogos: [
    'Dream Industrial',                            // Affiche le texte
    'data:image/png;base64,LOGO_BASE64_HERE',      // Affiche l'image
  ]
}
```

### Intégrer les graphiques réels

Pour les graphiques (cashflow, waterfall, energy profile), 3 options:

**Option A: Graphiques CSS (inclus)**
Le waterfall chart et les barres d'énergie sont déjà en CSS pur. Simple et léger.

**Option B: Chart.js via canvas**
```typescript
// Remplace le placeholder dans buildFinancialProjectionsPage()
<canvas id="cashflowChart"></canvas>
<script>/* Chart.js config */</script>
```

**Option C: Images pré-générées**
Génère les graphiques côté serveur avec Chart.js/node-canvas et insère en base64.

---

## Structure des Pages (13 pages)

| # | Page | Builder | Contenu |
|---|------|---------|---------|
| 1 | Cover | `buildCoverPage()` | Logo, titre, nom projet, date |
| 2 | Qui Sommes-Nous | `buildAboutPage()` | Stats (120+ MW, 25+ projets), 4 piliers, logos clients, certifications |
| 3 | Aperçu du Projet | `buildProjectSnapshotPage()` | KPIs, infos site, code tarifaire HQ, image satellite |
| 4 | Vos Résultats | `buildYourResultsPage()` | Investissement net, économies 25 ans, payback, ROI, TRI, LCOE |
| 5 | Investissement Net | `buildNetInvestmentPage()` | Waterfall chart (ITC 30% + HQ Autoproduction), tableau incitatifs |
| 6 | Profil Énergétique | `buildEnergyProfilePage()` | Graphique 24h consommation vs production, autoconsommation, mensuel |
| 7 | Stockage & Optimisation | `buildStoragePage()` | Recommandation batterie BESS, demand shaving, synergie solaire+stockage |
| 8 | Projections Financières | `buildFinancialProjectionsPage()` | Cashflow cumulatif, coût inaction, tableau année par année |
| 9 | Configuration Toiture | `buildRoofConfigPage()` | Segments toiture, paramètres, rendement spécifique, image config |
| 10 | Équipements & Garanties | `buildEquipmentPage()` | Tableau équipements (+ batterie BYD, KB Racking), certifications |
| 11 | Hypothèses & Exclusions | `buildAssumptionsPage()` | Hypothèses (ITC 30%, HQ 1000$/kW), exclusions, sources données |
| 12 | Échéancier Type | `buildTimelinePage()` | 12 semaines, inclut installation batterie |
| 13 | Prochaines Étapes | `buildNextStepsPage()` | 4 étapes funnel, procuration HQ, FAQ, CTA (evaluation@kwh.quebec) |

---

## Incitatifs Fiscaux (Référence)

| Incitatif | Taux | Source | Plafond |
|-----------|------|--------|---------|
| ITC fédéral | 30% du CAPEX | Loi C-69 | Aucun |
| HQ Autoproduction | 1 000 $/kW | Hydro-Québec | Max 1 MW, 40% CAPEX |
| Amortissement accéléré | Cat. 43.1/43.2 APA | ARC | 100% année 1 |

---

## Dépannage

### Le PDF est vide ou ne génère pas
```bash
npx puppeteer browsers install chrome
```

### Erreur "No usable sandbox"
Les flags sont déjà inclus, mais vérifie:
```typescript
args: ['--no-sandbox', '--disable-setuid-sandbox']
```

### Les polices ne s'affichent pas bien
Le rapport utilise **Montserrat** (brand guideline kWh Québec). La police est importée via Google Fonts:
```css
@import url('https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;1,500&display=swap');
```
**Note:** La typographie secondaire du brand est **NoirPro** (non disponible sur Google Fonts). Si tu as la licence, tu peux l'intégrer en base64 ou via un CDN privé pour les titres.

### Le PDF prend trop de temps
Réduis le `waitUntil`:
```typescript
await page.setContent(html, { waitUntil: 'domcontentloaded' }); // Plus rapide
```

---

## Migration depuis l'ancienne version (11 pages)

1. **Sauvegarde** l'ancien fichier: `pdfGenerator.ts` → `pdfGenerator.old.ts`
2. **Remplace** par le nouveau `pdfGeneratorV2.ts`
3. **Ajuste les appels** — l'interface `PDFGeneratorOptions` a changé:
   - `federalCredit` → `federalItcAmount` (et ajoute `federalItcPct: 30`)
   - `depreciationBenefit` → `depreciationBenefitMin` / `depreciationBenefitMax`
   - Ajoute `netCost`, `lcoe`, `hqAutoproductionPerKw`, `hqAutoproductionAmount`
   - Ajoute `battery: BatteryConfig` et `energyProfile: EnergyProfile`
4. **Teste** avec un projet existant
5. **Supprime** l'ancien fichier une fois validé

### Changements majeurs v1 → v2

| Aspect | v1 (ancien) | v2 (nouveau) |
|--------|-------------|--------------|
| Pages | 11 | 13 |
| Incitatifs | 15% fédéral seulement | 30% ITC + HQ 1000$/kW |
| Contact | info@kwh.quebec | evaluation@kwh.quebec |
| Téléphone | 1-888-KWH-SOLAR | 514-427-8871 |
| Stats | 500+ installations, 15+ MW | 25+ projets, 120+ MW |
| Batterie | Non inclus | Page dédiée + équipement |
| Profil énergie | Non inclus | Simulation 24h |
| Page "About" | Non inclus | Qui Sommes-Nous (page 2) |
| Funnel | 3 étapes | 4 étapes alignées site web |

---

## Support

Si tu as des questions ou besoin d'ajustements, n'hésite pas!

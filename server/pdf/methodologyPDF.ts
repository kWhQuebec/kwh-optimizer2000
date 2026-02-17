import path from "path";
import { COLORS } from "./types";

export function generateMethodologyPDF(
  doc: PDFKit.PDFDocument,
  lang: "fr" | "en" = "fr"
): void {
  const t = (fr: string, en: string) => (lang === "fr" ? fr : en);
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 50;
  const contentWidth = pageWidth - 2 * margin;
  const dateStr = new Date().toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", { year: "numeric", month: "long", day: "numeric" });

  const drawSectionHeader = (title: string, pageNum: number) => {
    doc.fontSize(10).fillColor(COLORS.blue).font("Helvetica-Bold");
    doc.text("MÉTHODOLOGIE D'ANALYSE", margin, margin, { continued: false });
    doc.font("Helvetica");
    doc.fontSize(10).fillColor(COLORS.mediumGray);
    doc.text(dateStr, pageWidth - margin - 100, margin, { width: 100, align: "right" });
    doc.moveDown(1);

    doc.fontSize(16).fillColor(COLORS.blue).font("Helvetica-Bold");
    doc.text(title, margin, doc.y);
    doc.font("Helvetica");
    doc.moveDown(1);
  };

  const drawFooter = (pageNum: number) => {
    doc.fontSize(8).fillColor(COLORS.lightGray);
    doc.text(t(`Document technique | kWh Québec | Page ${pageNum}`, `Technical document | kWh Québec | Page ${pageNum}`), margin, pageHeight - 30, { align: "center", width: contentWidth });
  };

  // ==================== PAGE 1: COVER PAGE ====================
  doc.rect(0, 0, pageWidth, 160).fill(COLORS.blue);

  doc.fontSize(28).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text(t("DOCUMENTATION", "METHODOLOGY"), margin, 50, { width: contentWidth, align: "center" });
  doc.fontSize(24).fillColor(COLORS.gold);
  doc.text(t("MÉTHODOLOGIQUE", "DOCUMENTATION"), margin, 85, { width: contentWidth, align: "center" });
  doc.font("Helvetica");

  doc.fontSize(12).fillColor(COLORS.white);
  doc.text(t("Analyse Solaire + Stockage", "Solar + Storage Analysis"), margin, 125, { width: contentWidth, align: "center" });

  doc.fontSize(12).fillColor(COLORS.darkGray);
  doc.text(t(
    "Ce document présente la méthodologie complète utilisée par kWh Québec pour les analyses de potentiel solaire et stockage. Il détaille les hypothèses, formules et calculs utilisés dans nos simulations énergétiques et financières sur 25 ans.",
    "This document presents the complete methodology used by kWh Québec for solar and storage potential analyses. It details the assumptions, formulas and calculations used in our 25-year energy and financial simulations."
  ), margin, 200, { width: contentWidth, align: "justify" });

  doc.moveDown(3);
  doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("TABLE DES MATIÈRES", "TABLE OF CONTENTS"), margin, doc.y);
  doc.font("Helvetica");
  doc.moveDown(1);

  const tocItems = [
    [t("1. Aperçu et objectifs", "1. Overview and objectives"), "2"],
    [t("2. Données d'entrée et hypothèses", "2. Input data and assumptions"), "2"],
    [t("3. Simulation de production solaire", "3. Solar production simulation"), "3"],
    [t("4. Stockage et écrêtage de pointe", "4. Storage and peak shaving"), "4"],
    [t("5. Modélisation financière", "5. Financial modeling"), "5"],
    [t("6. Incitatifs et subventions", "6. Incentives and subsidies"), "6"],
    [t("7. Optimisation et sensibilité", "7. Optimization and sensitivity"), "7"],
    [t("8. Références et normes", "8. References and standards"), "8"],
  ];

  tocItems.forEach(([title, page]) => {
    doc.fontSize(11).fillColor(COLORS.darkGray);
    doc.text(title, margin + 20, doc.y, { continued: true });
    doc.text(page, { align: "right", width: contentWidth - 20 });
    doc.moveDown(0.5);
  });

  doc.moveDown(3);
  doc.fontSize(10).fillColor(COLORS.mediumGray);
  doc.text(t(`Version 1.0 | ${dateStr}`, `Version 1.0 | ${dateStr}`), margin, doc.y);
  doc.text(t("kWh Québec | info@kwh.quebec", "kWh Québec | info@kwh.quebec"));

  drawFooter(1);

  // ==================== PAGE 2: OVERVIEW ====================
  doc.addPage();
  drawSectionHeader(t("1. APERÇU ET OBJECTIFS", "1. OVERVIEW AND OBJECTIVES"), 2);

  doc.fontSize(11).fillColor(COLORS.darkGray);
  doc.text(t(
    "L'outil d'analyse kWh Québec effectue une simulation énergétique et financière complète sur 25 ans pour des systèmes solaires photovoltaïques avec ou sans stockage par batterie.",
    "The kWh Québec analysis tool performs a comprehensive 25-year energy and financial simulation for photovoltaic solar systems with or without battery storage."
  ), margin, doc.y, { width: contentWidth });
  doc.moveDown(1);

  doc.font("Helvetica-Bold").text(t("Objectifs de l'analyse:", "Analysis objectives:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  const objectives = lang === "fr" ? [
    "• Simulation horaire 8760 heures de la production solaire et consommation",
    "• Modélisation du comportement de la batterie avec suivi de l'état de charge",
    "• Calcul des économies d'énergie et de puissance selon les tarifs Hydro-Québec",
    "• Projection financière incluant tous les incitatifs gouvernementaux",
    "• Analyse de sensibilité multi-scénarios pour optimiser le dimensionnement",
  ] : [
    "• 8760-hour simulation of solar production and consumption",
    "• Battery behavior modeling with state of charge tracking",
    "• Energy and power savings calculation based on Hydro-Québec rates",
    "• Financial projection including all government incentives",
    "• Multi-scenario sensitivity analysis for sizing optimization",
  ];

  objectives.forEach(obj => {
    doc.text(obj, margin + 10, doc.y, { width: contentWidth - 20 });
    doc.moveDown(0.3);
  });

  doc.moveDown(1);
  doc.fontSize(14).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("2. DONNÉES D'ENTRÉE", "2. INPUT DATA"), margin, doc.y);
  doc.font("Helvetica");
  doc.moveDown(1);

  doc.fontSize(11).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(t("Données de consommation:", "Consumption data:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  const consumptionData = lang === "fr" ? [
    "• Fichiers CSV exportés d'Hydro-Québec",
    "• Données horaires en kWh (énergie)",
    "• Données 15-minutes en kW (puissance)",
    "• Format Latin-1, délimiteurs point-virgule",
    "• Jusqu'à 200 fichiers (24+ mois de données)",
  ] : [
    "• CSV files exported from Hydro-Québec",
    "• Hourly data in kWh (energy)",
    "• 15-minute data in kW (power)",
    "• Latin-1 format, semicolon delimiters",
    "• Up to 200 files (24+ months of data)",
  ];

  consumptionData.forEach(item => {
    doc.text(item, margin + 10, doc.y, { width: contentWidth - 20 });
    doc.moveDown(0.3);
  });

  doc.moveDown(1);
  doc.font("Helvetica-Bold");
  doc.text(t("Hypothèses par défaut:", "Default assumptions:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  const assumptions = [
    [t("Rendement système solaire", "Solar system efficiency"), "85%"],
    [t("Dégradation annuelle PV", "Annual PV degradation"), "0.4%/an"],
    [t("Efficacité batterie aller-retour", "Battery round-trip efficiency"), "90%"],
    [t("Profondeur de décharge", "Depth of discharge"), "90%"],
    [t("Taux d'actualisation (WACC)", "Discount rate (WACC)"), "8%"],
    [t("Inflation tarif Hydro-Québec", "Hydro-Québec rate inflation"), "4.8%/an"],
    [t("Taux d'imposition corporatif", "Corporate tax rate"), "26.5%"],
  ];

  assumptions.forEach(([label, value]) => {
    doc.fontSize(10).fillColor(COLORS.darkGray);
    doc.text(label, margin + 10, doc.y, { continued: true, width: 300 });
    doc.fillColor(COLORS.blue).text(value, { align: "right", width: contentWidth - 320 });
    doc.moveDown(0.3);
  });

  drawFooter(2);

  // ==================== PAGE 3: SOLAR PRODUCTION ====================
  doc.addPage();
  drawSectionHeader(t("3. SIMULATION DE PRODUCTION SOLAIRE", "3. SOLAR PRODUCTION SIMULATION"), 3);

  doc.fontSize(11).fillColor(COLORS.darkGray);
  doc.text(t(
    "La production solaire est simulée pour chaque heure de l'année (8760 heures) en utilisant un modèle gaussien ajusté selon la latitude du Québec et les variations saisonnières.",
    "Solar production is simulated for each hour of the year (8760 hours) using a Gaussian model adjusted for Quebec's latitude and seasonal variations."
  ), margin, doc.y, { width: contentWidth });
  doc.moveDown(1.5);

  doc.font("Helvetica-Bold");
  doc.text(t("Formule de production horaire:", "Hourly production formula:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  doc.rect(margin, doc.y, contentWidth, 40).fillAndStroke("#F0F4F8", COLORS.blue);
  doc.fontSize(12).fillColor(COLORS.darkGray).font("Courier");
  doc.text("P(h) = Pnom × Geff(h) / Gstc × ηsys × (1 - δ)^année", margin + 20, doc.y - 35);
  doc.font("Helvetica");
  doc.moveDown(2);

  doc.fontSize(10).fillColor(COLORS.mediumGray).font("Helvetica-Bold");
  doc.text(t("Où:", "Where:"));
  doc.font("Helvetica");
  doc.moveDown(0.3);

  const variables = lang === "fr" ? [
    ["P(h)", "Production à l'heure h (kWh)"],
    ["Pnom", "Puissance nominale du système (kWc)"],
    ["Geff(h)", "Irradiation effective à l'heure h (W/m²)"],
    ["Gstc", "Irradiation aux conditions standard (1000 W/m²)"],
    ["ηsys", "Rendement système global (85%)"],
    ["δ", "Taux de dégradation annuel (0.4%)"],
  ] : [
    ["P(h)", "Production at hour h (kWh)"],
    ["Pnom", "System nominal power (kWp)"],
    ["Geff(h)", "Effective irradiation at hour h (W/m²)"],
    ["Gstc", "Standard test conditions irradiation (1000 W/m²)"],
    ["ηsys", "Overall system efficiency (85%)"],
    ["δ", "Annual degradation rate (0.4%)"],
  ];

  variables.forEach(([symbol, desc]) => {
    doc.fontSize(10).fillColor(COLORS.blue).font("Courier").text(symbol, margin + 20, doc.y, { continued: true, width: 80 });
    doc.font("Helvetica").fillColor(COLORS.darkGray).text(`: ${desc}`, { width: contentWidth - 120 });
    doc.moveDown(0.2);
  });

  doc.moveDown(1);
  doc.fontSize(11).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(t("Ajustement saisonnier:", "Seasonal adjustment:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  doc.text(t(
    "Le modèle intègre les variations saisonnières typiques du Québec avec un pic de production en juin et une production minimale en décembre. L'amplitude de production varie d'un facteur 3-4x entre l'été et l'hiver.",
    "The model incorporates typical Quebec seasonal variations with peak production in June and minimum production in December. Production amplitude varies by a factor of 3-4x between summer and winter."
  ), margin, doc.y, { width: contentWidth });

  doc.moveDown(1.5);
  doc.font("Helvetica-Bold");
  doc.text(t("Dimensionnement du système:", "System sizing:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  doc.rect(margin, doc.y, contentWidth, 35).fillAndStroke("#F0F4F8", COLORS.blue);
  doc.fontSize(11).fillColor(COLORS.darkGray).font("Courier");
  doc.text("PV_max (kWc) = (Superficie × Ratio_utilisation) / 10", margin + 20, doc.y - 30);
  doc.font("Helvetica");
  doc.moveDown(2);

  doc.fontSize(10).fillColor(COLORS.darkGray);
  doc.text(t(
    "La densité de puissance standard est de 10 pi²/kWc. Le ratio d'utilisation typique varie de 60% à 80% selon les obstacles et contraintes de la toiture.",
    "Standard power density is 10 sq ft/kWp. Typical utilization ratio ranges from 60% to 80% depending on roof obstacles and constraints."
  ), margin, doc.y, { width: contentWidth });

  drawFooter(3);

  // ==================== PAGE 4: BATTERY STORAGE ====================
  doc.addPage();
  drawSectionHeader(t("4. STOCKAGE ET ÉCRÊTAGE DE POINTE", "4. STORAGE AND PEAK SHAVING"), 4);

  doc.fontSize(11).fillColor(COLORS.darkGray);
  doc.text(t(
    "L'algorithme de gestion de la batterie vise à réduire les pointes de puissance appelées du réseau, générant des économies sur les frais de puissance.",
    "The battery management algorithm aims to reduce power peaks drawn from the grid, generating savings on demand charges."
  ), margin, doc.y, { width: contentWidth });
  doc.moveDown(1.5);

  doc.font("Helvetica-Bold");
  doc.text(t("Algorithme de dispatch:", "Dispatch algorithm:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  const algorithm = lang === "fr" ? [
    "1. Calculer la charge nette: Load_net = Consommation - Production_solaire",
    "2. Si Load_net > Seuil_écrêtage ET SOC > SOC_min: Décharger la batterie",
    "3. Si Load_net < 0 ET SOC < SOC_max: Charger avec surplus solaire",
    "4. Respecter les limites de puissance C-rate de la batterie",
    "5. Mise à jour de l'état de charge (SOC) après chaque intervalle",
  ] : [
    "1. Calculate net load: Load_net = Consumption - Solar_production",
    "2. If Load_net > Shaving_threshold AND SOC > SOC_min: Discharge battery",
    "3. If Load_net < 0 AND SOC < SOC_max: Charge with solar surplus",
    "4. Respect battery C-rate power limits",
    "5. Update state of charge (SOC) after each interval",
  ];

  algorithm.forEach(step => {
    doc.fontSize(10).text(step, margin + 10, doc.y, { width: contentWidth - 20 });
    doc.moveDown(0.4);
  });

  doc.moveDown(1);
  doc.font("Helvetica-Bold");
  doc.text(t("Suivi de l'état de charge:", "State of charge tracking:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  doc.rect(margin, doc.y, contentWidth, 35).fillAndStroke("#F0F4F8", COLORS.blue);
  doc.fontSize(11).fillColor(COLORS.darkGray).font("Courier");
  doc.text("SOC(t+1) = SOC(t) ± (P_batt × Δt × η) / E_batt", margin + 20, doc.y - 30);
  doc.font("Helvetica");
  doc.moveDown(2);

  doc.fontSize(11).font("Helvetica-Bold");
  doc.text(t("Dimensionnement de la batterie:", "Battery sizing:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  const batteryParams = [
    [t("Capacité énergétique (kWh)", "Energy capacity (kWh)"), t("E_batt = Énergie_écrêtage × Facteur_sécurité / DoD", "E_batt = Shaving_energy × Safety_factor / DoD")],
    [t("Puissance (kW)", "Power (kW)"), t("P_batt = Réduction_pointe_cible × Facteur_sécurité", "P_batt = Target_peak_reduction × Safety_factor")],
  ];

  batteryParams.forEach(([param, formula]) => {
    doc.fontSize(10).fillColor(COLORS.darkGray).font("Helvetica-Bold").text(param, margin + 10, doc.y);
    doc.font("Courier").fontSize(9).fillColor(COLORS.mediumGray).text(formula, margin + 20, doc.y);
    doc.font("Helvetica");
    doc.moveDown(0.6);
  });

  doc.moveDown(1);
  doc.fontSize(11).font("Helvetica-Bold");
  doc.text(t("Dégradation et remplacement:", "Degradation and replacement:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  const degradation = lang === "fr" ? [
    "• Durée de vie typique: 10-15 ans selon l'utilisation",
    "• Coût de remplacement: % du coût initial avec déclin annuel",
    "• Inflation appliquée au coût de remplacement",
    "• Année de remplacement configurable dans les paramètres",
  ] : [
    "• Typical lifespan: 10-15 years depending on usage",
    "• Replacement cost: % of initial cost with annual decline",
    "• Inflation applied to replacement cost",
    "• Replacement year configurable in parameters",
  ];

  degradation.forEach(item => {
    doc.fontSize(10).text(item, margin + 10, doc.y, { width: contentWidth - 20 });
    doc.moveDown(0.3);
  });

  drawFooter(4);

  // ==================== PAGE 5: FINANCIAL MODELING ====================
  doc.addPage();
  drawSectionHeader(t("5. MODÉLISATION FINANCIÈRE", "5. FINANCIAL MODELING"), 5);

  doc.fontSize(11).fillColor(COLORS.darkGray);
  doc.text(t(
    "Le modèle génère un flux de trésorerie annuel sur 25 ans en considérant tous les revenus (économies) et coûts (O&M, remplacement batterie).",
    "The model generates annual cash flow over 25 years considering all revenues (savings) and costs (O&M, battery replacement)."
  ), margin, doc.y, { width: contentWidth });
  doc.moveDown(1.5);

  doc.font("Helvetica-Bold");
  doc.text(t("Calcul du CAPEX:", "CAPEX calculation:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  doc.rect(margin, doc.y, contentWidth, 50).fillAndStroke("#F0F4F8", COLORS.blue);
  doc.fontSize(10).fillColor(COLORS.darkGray).font("Courier");
  doc.text("CAPEX_total = (PV_kWc × Coût_PV) +", margin + 15, doc.y - 45);
  doc.text("              (Batt_kWh × Coût_kWh) +", margin + 15, doc.y - 30);
  doc.text("              (Batt_kW × Coût_kW)", margin + 15, doc.y - 15);
  doc.font("Helvetica");
  doc.moveDown(3);

  doc.font("Helvetica-Bold");
  doc.text(t("Revenus (économies annuelles):", "Revenue (annual savings):"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  doc.rect(margin, doc.y, contentWidth, 35).fillAndStroke("#F0F4F8", COLORS.green);
  doc.fontSize(10).fillColor(COLORS.darkGray).font("Courier");
  doc.text(t(
    "Économies = Énergie_éco × Tarif_énergie + Puissance_réduite × Tarif_puissance × 12",
    "Savings = Energy_saved × Energy_rate + Power_reduced × Power_rate × 12"
  ), margin + 10, doc.y - 30);
  doc.font("Helvetica");
  doc.moveDown(2.5);

  doc.font("Helvetica-Bold");
  doc.text(t("Coûts d'exploitation (O&M):", "Operating costs (O&M):"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  doc.rect(margin, doc.y, contentWidth, 35).fillAndStroke("#F0F4F8", "#DC2626");
  doc.fontSize(10).fillColor(COLORS.darkGray).font("Courier");
  doc.text(t(
    "O&M = CAPEX_PV × %O&M_PV + CAPEX_Batt × %O&M_Batt × (1 + inflation)^an",
    "O&M = CAPEX_PV × %O&M_PV + CAPEX_Batt × %O&M_Batt × (1 + inflation)^year"
  ), margin + 10, doc.y - 30);
  doc.font("Helvetica");
  doc.moveDown(2.5);

  doc.fontSize(11).font("Helvetica-Bold");
  doc.text(t("Métriques financières:", "Financial metrics:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  const metrics = [
    [t("VAN (Valeur Actuelle Nette)", "NPV (Net Present Value)"), t("VAN = -CAPEX_net + Σ(CF / (1+r)^an)", "NPV = -Net_CAPEX + Σ(CF / (1+r)^year)")],
    [t("TRI (Taux de Rendement Interne)", "IRR (Internal Rate of Return)"), t("VAN(TRI) = 0 → résoudre pour TRI", "NPV(IRR) = 0 → solve for IRR")],
    [t("Temps de Retour Simple", "Simple Payback"), t("Payback = CAPEX_net / Économies_moy", "Payback = Net_CAPEX / Avg_savings")],
    [t("LCOE (Coût Actualisé Énergie)", "LCOE (Levelized Cost of Energy)"), t("LCOE = Coûts_act / Prod_actualisée", "LCOE = Disc_costs / Disc_production")],
  ];

  metrics.forEach(([name, formula]) => {
    doc.fontSize(10).fillColor(COLORS.blue).font("Helvetica-Bold").text(name, margin + 10, doc.y);
    doc.font("Courier").fontSize(9).fillColor(COLORS.mediumGray).text(formula, margin + 20, doc.y);
    doc.font("Helvetica");
    doc.moveDown(0.6);
  });

  drawFooter(5);

  // ==================== PAGE 6: INCENTIVES ====================
  doc.addPage();
  drawSectionHeader(t("6. INCITATIFS ET SUBVENTIONS", "6. INCENTIVES AND SUBSIDIES"), 6);

  doc.fontSize(11).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(t("Incitatifs Hydro-Québec (Programme Autoproduction):", "Hydro-Québec Incentives (Self-Generation Program):"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  const hqIncentives = lang === "fr" ? [
    "• Solaire: 1 000 $/kWc installé",
    "• Stockage: 300 $/kW de capacité",
    "• Plafond: 40% du CAPEX brut",
  ] : [
    "• Solar: $1,000/kWp installed",
    "• Storage: $300/kW capacity",
    "• Cap: 40% of gross CAPEX",
  ];

  hqIncentives.forEach(item => {
    doc.fontSize(10).text(item, margin + 10, doc.y, { width: contentWidth - 20 });
    doc.moveDown(0.3);
  });

  doc.moveDown(0.5);
  doc.rect(margin, doc.y, contentWidth, 35).fillAndStroke("#F0F4F8", COLORS.blue);
  doc.fontSize(10).fillColor(COLORS.darkGray).font("Courier");
  doc.text(t(
    "Incitatif_HQ = min(PV_kWc × 1000 + Batt_kW × 300, CAPEX × 0.40)",
    "HQ_incentive = min(PV_kWp × 1000 + Batt_kW × 300, CAPEX × 0.40)"
  ), margin + 10, doc.y - 30);
  doc.font("Helvetica");
  doc.moveDown(2.5);

  doc.fontSize(11).font("Helvetica-Bold");
  doc.text(t("Crédit d'impôt fédéral (CII):", "Federal Investment Tax Credit (ITC):"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  doc.fontSize(10).text(t(
    "Crédit d'impôt à l'investissement de 30% sur le CAPEX net (après incitatifs Hydro-Québec).",
    "30% investment tax credit on net CAPEX (after Hydro-Québec incentives)."
  ), margin + 10, doc.y, { width: contentWidth - 20 });
  doc.moveDown(0.5);

  doc.rect(margin, doc.y, contentWidth, 35).fillAndStroke("#F0F4F8", COLORS.green);
  doc.fontSize(10).fillColor(COLORS.darkGray).font("Courier");
  doc.text(t(
    "CII = (CAPEX_brut - Incitatif_HQ) × 0.30",
    "ITC = (Gross_CAPEX - HQ_incentive) × 0.30"
  ), margin + 10, doc.y - 30);
  doc.font("Helvetica");
  doc.moveDown(2.5);

  doc.fontSize(11).font("Helvetica-Bold");
  doc.text(t("Bouclier fiscal (DPA/CCA):", "Tax Shield (CCA):"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  doc.fontSize(10).text(t(
    "Déductions pour amortissement accéléré sur les équipements solaires (Classe 43.2). Le bouclier fiscal réduit l'impôt à payer grâce aux déductions de capital.",
    "Accelerated capital cost allowance deductions on solar equipment (Class 43.2). The tax shield reduces taxes payable through capital deductions."
  ), margin + 10, doc.y, { width: contentWidth - 20 });
  doc.moveDown(0.5);

  doc.rect(margin, doc.y, contentWidth, 35).fillAndStroke("#F0F4F8", COLORS.gold);
  doc.fontSize(10).fillColor(COLORS.darkGray).font("Courier");
  doc.text(t(
    "Bouclier_fiscal = CAPEX_net × Taux_CCA × Taux_imposition",
    "Tax_shield = Net_CAPEX × CCA_rate × Tax_rate"
  ), margin + 10, doc.y - 30);
  doc.font("Helvetica");
  doc.moveDown(2.5);

  doc.fontSize(11).font("Helvetica-Bold");
  doc.text(t("CAPEX net final:", "Final net CAPEX:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  doc.rect(margin, doc.y, contentWidth, 35).fillAndStroke("#F0F4F8", COLORS.blue);
  doc.fontSize(10).fillColor(COLORS.darkGray).font("Courier");
  doc.text(t(
    "CAPEX_net = CAPEX_brut - Incitatif_HQ - CII - Bouclier_fiscal",
    "Net_CAPEX = Gross_CAPEX - HQ_incentive - ITC - Tax_shield"
  ), margin + 10, doc.y - 30);
  doc.font("Helvetica");

  drawFooter(6);

  // ==================== PAGE 7: OPTIMIZATION ====================
  doc.addPage();
  drawSectionHeader(t("7. OPTIMISATION ET SENSIBILITÉ", "7. OPTIMIZATION AND SENSITIVITY"), 7);

  doc.fontSize(11).fillColor(COLORS.darkGray);
  doc.text(t(
    "L'analyse de sensibilité explore différentes combinaisons de tailles de système pour identifier la configuration optimale maximisant la VAN.",
    "Sensitivity analysis explores different system size combinations to identify the optimal configuration maximizing NPV."
  ), margin, doc.y, { width: contentWidth });
  doc.moveDown(1.5);

  doc.font("Helvetica-Bold");
  doc.text(t("Types de scénarios analysés:", "Scenario types analyzed:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  const scenarios = lang === "fr" ? [
    ["Solaire seul", "Variation de la taille PV de 10% à 100% de la capacité maximale de toiture"],
    ["Batterie seule", "Variation de la capacité batterie de 0 à la capacité optimale pour écrêtage"],
    ["Hybride", "Combinaisons de PV et batterie à différentes échelles pour optimiser VAN"],
  ] : [
    ["Solar only", "PV size variation from 10% to 100% of maximum roof capacity"],
    ["Battery only", "Battery capacity variation from 0 to optimal capacity for shaving"],
    ["Hybrid", "PV and battery combinations at different scales to optimize NPV"],
  ];

  scenarios.forEach(([type, desc]) => {
    doc.fontSize(10).fillColor(COLORS.blue).font("Helvetica-Bold").text(`• ${type}`, margin + 10, doc.y);
    doc.font("Helvetica").fillColor(COLORS.darkGray).text(`  ${desc}`, margin + 20, doc.y, { width: contentWidth - 40 });
    doc.moveDown(0.5);
  });

  doc.moveDown(1);
  doc.fontSize(11).font("Helvetica-Bold");
  doc.text(t("Frontière d'efficience:", "Efficiency frontier:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  doc.fontSize(10).text(t(
    "Le graphique de frontière d'efficience visualise le compromis entre l'investissement (CAPEX) et le rendement (VAN). Chaque point représente une configuration système différente.",
    "The efficiency frontier chart visualizes the trade-off between investment (CAPEX) and return (NPV). Each point represents a different system configuration."
  ), margin, doc.y, { width: contentWidth });
  doc.moveDown(1);

  doc.font("Helvetica-Bold");
  doc.text(t("Axes du graphique:", "Chart axes:"));
  doc.font("Helvetica");
  doc.moveDown(0.3);
  doc.fontSize(10).text(t("• X: CAPEX net après incitatifs ($)", "• X: Net CAPEX after incentives ($)"), margin + 10, doc.y);
  doc.text(t("• Y: VAN sur 25 ans ($)", "• Y: 25-year NPV ($)"), margin + 10, doc.y);
  doc.moveDown(1);

  doc.fontSize(11).font("Helvetica-Bold");
  doc.text(t("Sélection du système optimal:", "Optimal system selection:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  doc.fontSize(10).text(t(
    "Le système recommandé est automatiquement sélectionné selon les critères suivants:",
    "The recommended system is automatically selected based on the following criteria:"
  ), margin, doc.y, { width: contentWidth });
  doc.moveDown(0.5);

  const criteria = lang === "fr" ? [
    "1. Maximisation de la VAN sur 25 ans",
    "2. Respect des contraintes de toiture et structurelles",
    "3. Équilibre entre taille du système et rendement marginal",
    "4. Considération du TRI minimum acceptable (si spécifié)",
  ] : [
    "1. Maximization of 25-year NPV",
    "2. Compliance with roof and structural constraints",
    "3. Balance between system size and marginal return",
    "4. Consideration of minimum acceptable IRR (if specified)",
  ];

  criteria.forEach(item => {
    doc.text(item, margin + 10, doc.y, { width: contentWidth - 20 });
    doc.moveDown(0.3);
  });

  drawFooter(7);

  // ==================== PAGE 8: REFERENCES ====================
  doc.addPage();
  drawSectionHeader(t("8. RÉFÉRENCES ET NORMES", "8. REFERENCES AND STANDARDS"), 8);

  doc.fontSize(11).fillColor(COLORS.darkGray).font("Helvetica-Bold");
  doc.text(t("Tarifs Hydro-Québec:", "Hydro-Québec Rates:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  const tariffs = [
    [t("Tarif D (Domestique)", "Rate D (Domestic)"), t("< 40 kW", "< 40 kW")],
    [t("Tarif G (Petite puissance)", "Rate G (Small Power)"), t("< 65 kW", "< 65 kW")],
    [t("Tarif M (Moyenne puissance)", "Rate M (Medium Power)"), t("65 kW - 5 MW", "65 kW - 5 MW")],
    [t("Tarif L (Grande puissance)", "Rate L (Large Power)"), t("> 5 MW", "> 5 MW")],
  ];

  tariffs.forEach(([name, range]) => {
    doc.fontSize(10).text(`• ${name}: ${range}`, margin + 10, doc.y, { width: contentWidth - 20 });
    doc.moveDown(0.3);
  });

  doc.moveDown(1);
  doc.font("Helvetica-Bold");
  doc.text(t("Sources des données:", "Data sources:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  const sources = lang === "fr" ? [
    "• Tarifs Hydro-Québec en vigueur (avril 2025)",
    "• Données d'irradiation: Ressources naturelles Canada (RNCan)",
    "• Programme Autoproduction Hydro-Québec: conditions et montants officiels",
    "• Crédit d'impôt fédéral: Agence du revenu du Canada",
    "• Classes CCA: Agence du revenu du Canada (Classe 43.2)",
  ] : [
    "• Hydro-Québec rates in effect (April 2025)",
    "• Irradiation data: Natural Resources Canada (NRCan)",
    "• Hydro-Québec Self-Generation Program: official conditions and amounts",
    "• Federal tax credit: Canada Revenue Agency",
    "• CCA Classes: Canada Revenue Agency (Class 43.2)",
  ];

  sources.forEach(source => {
    doc.fontSize(10).text(source, margin + 10, doc.y, { width: contentWidth - 20 });
    doc.moveDown(0.3);
  });

  doc.moveDown(2);
  doc.fontSize(11).font("Helvetica-Bold");
  doc.text(t("Normes et certifications:", "Standards and certifications:"));
  doc.font("Helvetica");
  doc.moveDown(0.5);

  const standards = lang === "fr" ? [
    "• CSA C22.1 - Code canadien de l'électricité",
    "• UL 1741 - Onduleurs solaires",
    "• IEC 61215 - Modules photovoltaïques",
    "• UL 9540A - Sécurité des systèmes de stockage d'énergie",
  ] : [
    "• CSA C22.1 - Canadian Electrical Code",
    "• UL 1741 - Solar inverters",
    "• IEC 61215 - Photovoltaic modules",
    "• UL 9540A - Energy storage system safety",
  ];

  standards.forEach(std => {
    doc.fontSize(10).text(std, margin + 10, doc.y, { width: contentWidth - 20 });
    doc.moveDown(0.3);
  });

  doc.moveDown(3);

  doc.rect(margin, doc.y, contentWidth, 80).fillAndStroke("#F0F4F8", COLORS.blue);
  doc.fontSize(12).fillColor(COLORS.blue).font("Helvetica-Bold");
  doc.text(t("Pour plus d'informations:", "For more information:"), margin + 20, doc.y - 70);
  doc.font("Helvetica").fontSize(10).fillColor(COLORS.darkGray);
  doc.text("kWh Québec", margin + 20, doc.y - 50);
  doc.text("info@kwh.quebec", margin + 20, doc.y - 35);
  doc.text("www.kwh.quebec", margin + 20, doc.y - 20);

  drawFooter(8);
}

import PptxGenJS from "pptxgenjs";

const COLORS = {
  blue: "003DA6",
  gold: "FFB005",
  darkGray: "333333",
  mediumGray: "666666",
  lightGray: "E0E0E0",
  green: "2D915F",
  white: "FFFFFF",
};

interface SimulationData {
  id: string;
  site: {
    name: string;
    address?: string;
    city?: string;
    province?: string;
    latitude?: number;
    longitude?: number;
    client: {
      name: string;
    };
  };
  pvSizeKW: number;
  battEnergyKWh: number;
  battPowerKW: number;
  demandShavingSetpointKW: number;
  annualConsumptionKWh: number;
  peakDemandKW: number;
  annualSavings: number;
  savingsYear1: number;
  capexGross: number;
  capexNet: number;
  totalIncentives: number;
  incentivesHQ: number;
  incentivesHQSolar: number;
  incentivesHQBattery: number;
  incentivesFederal: number;
  taxShield: number;
  npv25: number;
  npv10: number;
  npv20: number;
  irr25: number;
  irr10: number;
  irr20: number;
  simplePaybackYears: number;
  lcoe: number;
  co2AvoidedTonnesPerYear: number;
  selfSufficiencyPercent: number;
  annualCostBefore: number;
  annualCostAfter: number;
  cashflows?: Array<{
    year: number;
    cumulativeCashflow: number;
    netCashflow: number;
  }>;
}

export async function generatePresentationPPTX(
  simulation: SimulationData,
  roofImageBuffer: Buffer | undefined,
  lang: "fr" | "en" = "fr"
): Promise<Buffer> {
  const t = (fr: string, en: string) => (lang === "fr" ? fr : en);
  
  const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return "0 $";
    }
    return `${value.toLocaleString("fr-CA", { maximumFractionDigits: 0 })} $`;
  };

  const formatPercent = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return "0.0%";
    }
    return `${(value * 100).toFixed(1)}%`;
  };

  const pptx = new PptxGenJS();
  
  pptx.author = "kWh Québec";
  pptx.company = "kWh Québec";
  pptx.title = `${t("Étude Solaire", "Solar Study")} - ${simulation.site.name}`;
  pptx.subject = t("Proposition commerciale solaire + stockage", "Solar + Storage Commercial Proposal");
  
  pptx.defineSlideMaster({
    title: "KWHMAIN",
    background: { color: COLORS.white },
    objects: [
      { rect: { x: 0, y: 0, w: "100%", h: 0.6, fill: { color: COLORS.blue } } },
      { rect: { x: 0, y: 0.55, w: 1.5, h: 0.05, fill: { color: COLORS.gold } } },
      { 
        text: { 
          text: "kWh Québec", 
          options: { x: 0.3, y: 0.15, w: 2, h: 0.3, fontSize: 14, color: COLORS.white, bold: true }
        }
      },
      { 
        text: { 
          text: new Date().toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA"), 
          options: { x: 8, y: 0.15, w: 1.5, h: 0.3, fontSize: 10, color: COLORS.white, align: "right" }
        }
      },
      {
        text: {
          text: t("Document confidentiel | kWh Québec", "Confidential | kWh Québec"),
          options: { x: 0.3, y: 5.3, w: 9.4, h: 0.2, fontSize: 8, color: COLORS.mediumGray, align: "center" }
        }
      }
    ],
    margin: [0.8, 0.5, 0.5, 0.5]
  });

  const slide1 = pptx.addSlide({ masterName: "KWHMAIN" });
  
  slide1.addText(t("PROPOSITION SOLAIRE + STOCKAGE", "SOLAR + STORAGE PROPOSAL"), {
    x: 0.5, y: 1, w: 9, h: 0.6,
    fontSize: 28, bold: true, color: COLORS.blue
  });
  
  slide1.addShape("rect", {
    x: 0.5, y: 1.55, w: 3, h: 0.08, fill: { color: COLORS.gold }
  });
  
  slide1.addText(simulation.site.name, {
    x: 0.5, y: 1.8, w: 9, h: 0.5,
    fontSize: 22, bold: true, color: COLORS.darkGray
  });
  
  const address = [simulation.site.address, simulation.site.city, simulation.site.province].filter(Boolean).join(", ");
  slide1.addText(address || t("Adresse à confirmer", "Address to confirm"), {
    x: 0.5, y: 2.3, w: 9, h: 0.4,
    fontSize: 14, color: COLORS.mediumGray
  });
  
  slide1.addText(simulation.site.client.name, {
    x: 0.5, y: 2.7, w: 9, h: 0.4,
    fontSize: 16, bold: true, color: COLORS.darkGray
  });

  if (roofImageBuffer) {
    try {
      const base64Image = roofImageBuffer.toString("base64");
      slide1.addImage({
        data: `data:image/png;base64,${base64Image}`,
        x: 5, y: 1.8, w: 4.5, h: 2.8
      });
    } catch (imgError) {
      console.error("Failed to add roof image to PPTX:", imgError);
    }
  }

  const kpis = [
    { label: t("Puissance PV", "PV Power"), value: `${simulation.pvSizeKW.toFixed(0)} kWc`, highlight: false },
    { label: t("Batterie", "Battery"), value: `${simulation.battEnergyKWh.toFixed(0)} kWh`, highlight: false },
    { label: t("Économies An 1", "Year 1 Savings"), value: formatCurrency(simulation.savingsYear1), highlight: true },
    { label: t("VAN 25 ans", "NPV 25 yrs"), value: formatCurrency(simulation.npv25), highlight: true },
  ];
  
  kpis.forEach((kpi, i) => {
    const x = 0.5 + (i * 2.4);
    slide1.addShape("rect", {
      x, y: 3.5, w: 2.2, h: 1,
      fill: { color: kpi.highlight ? COLORS.gold : COLORS.lightGray }
    });
    slide1.addText(kpi.label, {
      x, y: 3.55, w: 2.2, h: 0.3,
      fontSize: 10, color: COLORS.mediumGray, align: "center"
    });
    slide1.addText(kpi.value, {
      x, y: 3.85, w: 2.2, h: 0.5,
      fontSize: 16, bold: true, color: kpi.highlight ? COLORS.blue : COLORS.darkGray, align: "center"
    });
  });

  const slide2 = pptx.addSlide({ masterName: "KWHMAIN" });
  
  slide2.addText(t("INDICATEURS FINANCIERS", "FINANCIAL HIGHLIGHTS"), {
    x: 0.5, y: 0.8, w: 9, h: 0.5,
    fontSize: 22, bold: true, color: COLORS.blue
  });

  const financialData: Array<Array<{ text: string; options?: { bold?: boolean; color?: string } }>> = [
    [
      { text: t("Métrique", "Metric"), options: { bold: true, color: COLORS.white } },
      { text: t("Valeur", "Value"), options: { bold: true, color: COLORS.white } },
      { text: t("Métrique", "Metric"), options: { bold: true, color: COLORS.white } },
      { text: t("Valeur", "Value"), options: { bold: true, color: COLORS.white } }
    ],
    [
      { text: t("Investissement brut", "Gross investment") },
      { text: formatCurrency(simulation.capexGross) },
      { text: t("TRI (25 ans)", "IRR (25 years)") },
      { text: formatPercent(simulation.irr25), options: { bold: true, color: COLORS.green } }
    ],
    [
      { text: t("Subventions Hydro-Québec", "Hydro-Québec Incentives") },
      { text: formatCurrency(simulation.totalIncentives), options: { color: COLORS.green } },
      { text: t("Retour simple", "Simple payback") },
      { text: `${simulation.simplePaybackYears.toFixed(1)} ${t("ans", "years")}` }
    ],
    [
      { text: t("Bouclier fiscal", "Tax shield") },
      { text: formatCurrency(simulation.taxShield), options: { color: COLORS.green } },
      { text: t("LCOE", "LCOE") },
      { text: `${simulation.lcoe.toFixed(2)} ¢/kWh` }
    ],
    [
      { text: t("Investissement net", "Net investment"), options: { bold: true } },
      { text: formatCurrency(simulation.capexNet), options: { bold: true, color: COLORS.blue } },
      { text: t("VAN (25 ans)", "NPV (25 years)"), options: { bold: true } },
      { text: formatCurrency(simulation.npv25), options: { bold: true, color: COLORS.green } }
    ]
  ];
  
  slide2.addTable(financialData, {
    x: 0.5, y: 1.5, w: 9.0,
    fill: { color: COLORS.white },
    border: { pt: 0.5, color: COLORS.lightGray },
    fontFace: "Arial",
    fontSize: 11,
    color: COLORS.darkGray,
    valign: "middle",
    align: "left",
    colW: [2.5, 2, 2.5, 2],
    rowH: 0.4
  });

  const slide3 = pptx.addSlide({ masterName: "KWHMAIN" });
  
  slide3.addText(t("SUBVENTIONS ET INCITATIFS", "INCENTIVES & SUBSIDIES"), {
    x: 0.5, y: 0.8, w: 9, h: 0.5,
    fontSize: 22, bold: true, color: COLORS.blue
  });

  const totalIncentives = (simulation.totalIncentives || 0) + (simulation.taxShield || 0);
  const hqWidth = totalIncentives > 0 ? ((simulation.totalIncentives || 0) / totalIncentives) * 7.5 : 3.75;
  const taxWidth = totalIncentives > 0 ? ((simulation.taxShield || 0) / totalIncentives) * 7.5 : 3.75;
  
  slide3.addShape("rect", {
    x: 0.5, y: 1.6, w: Math.max(0.1, hqWidth), h: 0.5, fill: { color: COLORS.blue }
  });
  slide3.addShape("rect", {
    x: 0.5 + hqWidth, y: 1.6, w: Math.max(0.1, taxWidth), h: 0.5, fill: { color: COLORS.green }
  });
  
  slide3.addText(formatCurrency(totalIncentives), {
    x: 8.2, y: 1.65, w: 1.5, h: 0.4,
    fontSize: 16, bold: true, color: COLORS.darkGray
  });

  slide3.addShape("rect", { x: 0.5, y: 2.3, w: 0.3, h: 0.2, fill: { color: COLORS.blue } });
  slide3.addText(t(`Hydro-Québec: ${formatCurrency(simulation.totalIncentives)}`, `Hydro-Québec: ${formatCurrency(simulation.totalIncentives)}`), {
    x: 0.9, y: 2.3, w: 4, h: 0.2, fontSize: 10, color: COLORS.darkGray
  });
  
  slide3.addShape("rect", { x: 5, y: 2.3, w: 0.3, h: 0.2, fill: { color: COLORS.green } });
  slide3.addText(t(`Bouclier fiscal: ${formatCurrency(simulation.taxShield)}`, `Tax shield: ${formatCurrency(simulation.taxShield)}`), {
    x: 5.4, y: 2.3, w: 4, h: 0.2, fontSize: 10, color: COLORS.darkGray
  });

  const incentiveBreakdown: Array<Array<{ text: string; options?: { bold?: boolean; color?: string } }>> = [
    [
      { text: t("Source", "Source"), options: { bold: true, color: COLORS.white } },
      { text: t("Description", "Description"), options: { bold: true, color: COLORS.white } },
      { text: t("Montant", "Amount"), options: { bold: true, color: COLORS.white } }
    ],
    [
      { text: "Hydro-Québec" },
      { text: t("Subvention panneaux solaires", "Solar panels incentive") },
      { text: formatCurrency(simulation.incentivesHQSolar), options: { color: COLORS.green } }
    ],
    [
      { text: "Hydro-Québec" },
      { text: t("Subvention stockage", "Storage incentive") },
      { text: formatCurrency(simulation.incentivesHQBattery), options: { color: COLORS.green } }
    ],
    [
      { text: t("Fédéral", "Federal") },
      { text: t("Crédit d'impôt à l'investissement (30%)", "Investment Tax Credit (30%)") },
      { text: formatCurrency(simulation.incentivesFederal), options: { color: COLORS.green } }
    ],
    [
      { text: t("Bouclier fiscal", "Tax shield") },
      { text: t("Amortissement accéléré (DPA Catégorie 43.2)", "Accelerated depreciation (CCA Class 43.2)") },
      { text: formatCurrency(simulation.taxShield), options: { color: COLORS.green } }
    ],
    [
      { text: t("TOTAL", "TOTAL"), options: { bold: true } },
      { text: "" },
      { text: formatCurrency(totalIncentives), options: { bold: true, color: COLORS.blue } }
    ]
  ];
  
  slide3.addTable(incentiveBreakdown, {
    x: 0.5, y: 2.8, w: 9.0,
    fill: { color: COLORS.white },
    border: { pt: 0.5, color: COLORS.lightGray },
    fontFace: "Arial",
    fontSize: 10,
    color: COLORS.darkGray,
    valign: "middle",
    align: "left",
    colW: [2, 5, 2],
    rowH: 0.35
  });

  if (simulation.cashflows && simulation.cashflows.length > 0) {
    const slide4 = pptx.addSlide({ masterName: "KWHMAIN" });
    
    slide4.addText(t("FLUX DE TRÉSORERIE CUMULATIF", "CUMULATIVE CASHFLOW"), {
      x: 0.5, y: 0.8, w: 9, h: 0.5,
      fontSize: 22, bold: true, color: COLORS.blue
    });
    
    const chartData = simulation.cashflows.slice(0, 26).map(cf => ({
      year: cf.year,
      value: Math.round((cf.cumulativeCashflow || 0) / 1000)
    }));
    
    const maxVal = Math.max(...chartData.map(d => Math.abs(d.value)), 1); // Minimum of 1 to avoid division by zero
    const scale = 3.5 / maxVal;
    const chartX = 0.5;
    const chartY = 1.5;
    const chartWidth = 9;
    const chartHeight = 3.5;
    const barWidth = (chartWidth / chartData.length) * 0.7;
    const zeroLine = chartY + chartHeight / 2;
    
    slide4.addShape("line", {
      x: chartX, y: zeroLine, w: chartWidth, h: 0,
      line: { color: COLORS.mediumGray, width: 1 }
    });
    
    chartData.forEach((d, i) => {
      const x = chartX + (i / chartData.length) * chartWidth + (chartWidth / chartData.length) * 0.15;
      const height = Math.max(0.02, Math.abs(d.value * scale)); // Minimum bar height to avoid invisible/zero-height rects
      const isNegative = d.value < 0;
      const y = isNegative ? zeroLine : zeroLine - height;
      
      slide4.addShape("rect", {
        x, y, w: barWidth, h: height,
        fill: { color: isNegative ? "DC2626" : COLORS.green }
      });
      
      if (i % 5 === 0 || i === chartData.length - 1) {
        slide4.addText(d.year.toString(), {
          x: x - 0.1, y: zeroLine + chartHeight / 2 + 0.1, w: 0.5, h: 0.2,
          fontSize: 8, color: COLORS.mediumGray, align: "center"
        });
      }
    });
    
    slide4.addText(t("Positif (vert) = profit cumulé | Négatif (rouge) = période de récupération", 
                     "Positive (green) = cumulative profit | Negative (red) = payback period"), {
      x: 0.5, y: 5, w: 9, h: 0.3,
      fontSize: 9, color: COLORS.mediumGray, align: "center"
    });
  }

  const slide5 = pptx.addSlide({ masterName: "KWHMAIN" });
  
  slide5.addText(t("PROCHAINES ÉTAPES", "NEXT STEPS"), {
    x: 0.5, y: 0.8, w: 9, h: 0.5,
    fontSize: 22, bold: true, color: COLORS.blue
  });

  const steps = [
    { num: "1", title: t("Visite de site", "Site visit"), desc: t("Évaluation technique sur place", "On-site technical assessment") },
    { num: "2", title: t("Conception détaillée", "Detailed design"), desc: t("Plans finaux et sélection d'équipement", "Final plans and equipment selection") },
    { num: "3", title: t("Proposition commerciale", "Commercial proposal"), desc: t("Contrat et échéancier de réalisation", "Contract and implementation schedule") },
    { num: "4", title: t("Installation", "Installation"), desc: t("Construction et mise en service", "Construction and commissioning") }
  ];
  
  steps.forEach((step, i) => {
    const y = 1.5 + i * 0.9;
    
    slide5.addShape("ellipse", {
      x: 0.5, y, w: 0.5, h: 0.5, fill: { color: COLORS.blue }
    });
    slide5.addText(step.num, {
      x: 0.5, y, w: 0.5, h: 0.5,
      fontSize: 16, bold: true, color: COLORS.white, align: "center", valign: "middle"
    });
    
    slide5.addText(step.title, {
      x: 1.2, y: y + 0.05, w: 8, h: 0.25,
      fontSize: 14, bold: true, color: COLORS.darkGray
    });
    slide5.addText(step.desc, {
      x: 1.2, y: y + 0.3, w: 8, h: 0.2,
      fontSize: 11, color: COLORS.mediumGray
    });
  });

  slide5.addShape("rect", {
    x: 0.5, y: 4.5, w: 9, h: 0.8, fill: { color: COLORS.blue }
  });
  slide5.addText(t("Contactez-nous pour planifier votre visite de site", "Contact us to schedule your site visit"), {
    x: 0.5, y: 4.65, w: 9, h: 0.25,
    fontSize: 14, bold: true, color: COLORS.white, align: "center"
  });
  slide5.addText("info@kwh.quebec | www.kwh.quebec", {
    x: 0.5, y: 4.95, w: 9, h: 0.2,
    fontSize: 11, color: COLORS.gold, align: "center"
  });

  const pptxData = await pptx.write({ outputType: "nodebuffer" });
  return pptxData as Buffer;
}

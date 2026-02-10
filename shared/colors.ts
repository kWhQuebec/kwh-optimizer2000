export const BRAND = {
  primaryBlue: "#003DA6",
  darkBlue: "#002B75",
  accentGold: "#FFB005",
} as const;

export const SEMANTIC = {
  positive: "#16A34A",
  negative: "#DC2626",
  neutral: "#6B7280",
  info: "#3B82F6",
} as const;

export const PIPELINE = {
  prospect: { bg: "#BFDBFE", text: "#1E3A5F", border: "#93C5FD", solid: "#93C5FD" },
  qualified: { bg: "#93C5FD", text: "#1E3A5F", border: "#60A5FA", solid: "#60A5FA" },
  proposal: { bg: "#003DA6", text: "#FFFFFF", border: "#003DA6", solid: "#003DA6" },
  design_signed: { bg: "#FEF3C7", text: "#92400E", border: "#FCD34D", solid: "#FFB005" },
  negotiation: { bg: "#FFB005", text: "#78350F", border: "#F59E0B", solid: "#F59E0B" },
  won_to_be_delivered: { bg: "#BBF7D0", text: "#14532D", border: "#86EFAC", solid: "#4ADE80" },
  won_in_construction: { bg: "#16A34A", text: "#FFFFFF", border: "#16A34A", solid: "#16A34A" },
  won_delivered: { bg: "#15803D", text: "#FFFFFF", border: "#15803D", solid: "#15803D" },
  lost: { bg: "#FECACA", text: "#991B1B", border: "#FCA5A5", solid: "#DC2626" },
} as const;

export const CHART = {
  series1: BRAND.primaryBlue,
  series2: BRAND.accentGold,
  series3: SEMANTIC.positive,
  series4: SEMANTIC.info,
  series5: "#F59E0B",
} as const;

export const WATERFALL = {
  gross: SEMANTIC.neutral,
  incentiveHQ: SEMANTIC.positive,
  incentiveITC: SEMANTIC.info,
  taxShield: SEMANTIC.info,
  net: BRAND.primaryBlue,
} as const;

export const CASHFLOW = {
  positive: BRAND.primaryBlue,
  negative: SEMANTIC.negative,
  cumulative: BRAND.accentGold,
  paybackLine: BRAND.accentGold,
} as const;

export const KPI = {
  primary: BRAND.primaryBlue,
  accent: BRAND.accentGold,
} as const;

export const PPTX_COLORS = {
  blue: BRAND.primaryBlue.replace("#", ""),
  darkBlue: BRAND.darkBlue.replace("#", ""),
  gold: BRAND.accentGold.replace("#", ""),
  positive: SEMANTIC.positive.replace("#", ""),
  negative: SEMANTIC.negative.replace("#", ""),
  neutral: SEMANTIC.neutral.replace("#", ""),
  info: SEMANTIC.info.replace("#", ""),
  white: "FFFFFF",
  darkGray: "333333",
  mediumGray: "666666",
  lightGray: "E0E0E0",
} as const;

export const TIMELINE_GRADIENT = {
  getStepColor(index: number, total: number): { bg: string; text: string } {
    if (total <= 1) return { bg: BRAND.primaryBlue, text: "#FFFFFF" };
    const opacity = 0.2 + (0.8 * index) / (total - 1);
    if (opacity >= 0.85) {
      return { bg: BRAND.primaryBlue, text: "#FFFFFF" };
    }
    const r = Math.round(255 - (255 - 0) * opacity);
    const g = Math.round(255 - (255 - 61) * opacity);
    const b = Math.round(255 - (255 - 166) * opacity);
    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    return { bg: hex, text: opacity > 0.55 ? "#FFFFFF" : "#1F2937" };
  },
  getStepHex(index: number, total: number): string {
    return this.getStepColor(index, total).bg;
  },
  getStepTextColor(index: number, total: number): string {
    return this.getStepColor(index, total).text;
  },
} as const;

export const TIMELINE_GRADIENT_PPTX = {
  getStepColor(index: number, total: number): { bg: string; text: string } {
    const c = TIMELINE_GRADIENT.getStepColor(index, total);
    return { bg: c.bg.replace("#", ""), text: c.text.replace("#", "") };
  },
} as const;

import PDFDocument from "pdfkit";

export const BRAND_COLORS = {
  primary: "#003DA6",
  primaryDark: "#002B75",
  primaryLight: "#1a5fc2",
  accent: "#FFB005",
  accentLight: "#FFD54F",
  dark: "#1a1a2e",
  darkText: "#2d3748",
  mediumText: "#4a5568",
  lightText: "#718096",
  ultraLight: "#f7fafc",
  lightBg: "#edf2f7",
  white: "#FFFFFF",
  border: "#e2e8f0",
  success: "#48bb78",
  warning: "#ed8936",
};

export const PAGE_SIZES = {
  letter: { width: 612, height: 792 },
  a4: { width: 595, height: 842 },
};

export interface PDFTheme {
  primaryColor: string;
  accentColor: string;
  headerHeight: number;
  footerHeight: number;
  margin: number;
  fontFamily: string;
}

export const DEFAULT_THEME: PDFTheme = {
  primaryColor: BRAND_COLORS.primary,
  accentColor: BRAND_COLORS.accent,
  headerHeight: 100,
  footerHeight: 50,
  margin: 50,
  fontFamily: "Helvetica",
};

export function drawModernHeader(
  doc: PDFKit.PDFDocument,
  options: {
    title?: string;
    subtitle?: string;
    logoBuffer?: Buffer | null;
    pageWidth: number;
    theme?: PDFTheme;
  }
): number {
  const theme = options.theme || DEFAULT_THEME;
  const { pageWidth } = options;
  
  doc.rect(0, 0, pageWidth, 6).fillColor(theme.accentColor).fill();
  
  let yPos = 25;
  
  if (options.logoBuffer) {
    try {
      doc.image(options.logoBuffer, pageWidth - theme.margin - 130, yPos, { width: 130 });
    } catch (e) {
      doc.fontSize(14).fillColor(theme.primaryColor).font("Helvetica-Bold");
      doc.text("kWh Québec", pageWidth - theme.margin - 130, yPos + 10);
    }
  }
  
  if (options.subtitle) {
    doc.fontSize(9).fillColor(theme.primaryColor).font("Helvetica-Bold");
    doc.text(options.subtitle.toUpperCase(), theme.margin, yPos);
    yPos += 16;
  }
  
  if (options.title) {
    doc.fontSize(22).fillColor(BRAND_COLORS.darkText).font("Helvetica-Bold");
    doc.text(options.title, theme.margin, yPos, { width: pageWidth - theme.margin * 2 - 150 });
    yPos += 32;
    
    doc.moveTo(theme.margin, yPos).lineTo(theme.margin + 60, yPos)
      .strokeColor(theme.accentColor).lineWidth(3).stroke();
    yPos += 8;
  }
  
  return yPos + 15;
}

export function drawModernFooter(
  doc: PDFKit.PDFDocument,
  options: {
    leftText?: string;
    centerText?: string;
    rightText?: string;
    pageWidth: number;
    pageHeight: number;
    theme?: PDFTheme;
  }
): void {
  const theme = options.theme || DEFAULT_THEME;
  const { pageWidth, pageHeight } = options;
  
  const footerY = pageHeight - theme.footerHeight;
  
  doc.rect(0, footerY, pageWidth, theme.footerHeight).fillColor(theme.primaryColor).fill();
  
  const textY = footerY + (theme.footerHeight - 10) / 2;
  const contentWidth = pageWidth - theme.margin * 2;
  
  doc.fontSize(9).fillColor(BRAND_COLORS.white).font("Helvetica");
  
  if (options.leftText) {
    doc.text(options.leftText, theme.margin, textY);
  }
  
  if (options.centerText) {
    doc.text(options.centerText, pageWidth / 2 - 60, textY, { width: 120, align: "center" });
  }
  
  if (options.rightText) {
    doc.font("Helvetica-Bold");
    doc.text(options.rightText, theme.margin, textY, { width: contentWidth, align: "right" });
    doc.font("Helvetica");
  }
}

export function drawInfoCard(
  doc: PDFKit.PDFDocument,
  options: {
    x: number;
    y: number;
    width: number;
    height: number;
    title: string;
    items: Array<{ label: string; value: string }>;
    theme?: PDFTheme;
  }
): number {
  const theme = options.theme || DEFAULT_THEME;
  const { x, y, width, height, title, items } = options;
  const padding = 18;
  const innerWidth = width - padding * 2;
  
  doc.roundedRect(x, y, width, height, 8).fillColor(theme.primaryColor).fill();
  
  let currentY = y + padding;
  
  doc.fontSize(14).fillColor(BRAND_COLORS.white).font("Helvetica-Bold");
  doc.text(title, x + padding, currentY, { width: innerWidth });
  currentY += 28;
  
  doc.moveTo(x + padding, currentY - 5)
    .lineTo(x + padding + 40, currentY - 5)
    .strokeColor(theme.accentColor)
    .lineWidth(2)
    .stroke();
  
  for (const item of items) {
    doc.circle(x + padding + 4, currentY + 5, 3).fillColor(theme.accentColor).fill();
    
    doc.fontSize(9).fillColor(theme.accentColor).font("Helvetica-Bold");
    doc.text(item.label.toUpperCase(), x + padding + 14, currentY, { width: innerWidth - 14 });
    currentY += 13;
    
    doc.fontSize(11).fillColor(BRAND_COLORS.white).font("Helvetica");
    doc.text(item.value, x + padding + 14, currentY, { width: innerWidth - 14 });
    currentY += 18;
  }
  
  return y + height;
}

export function drawSectionTitle(
  doc: PDFKit.PDFDocument,
  options: {
    x: number;
    y: number;
    title: string;
    width: number;
    theme?: PDFTheme;
  }
): number {
  const theme = options.theme || DEFAULT_THEME;
  
  doc.fontSize(16).fillColor(theme.primaryColor).font("Helvetica-Bold");
  doc.text(options.title, options.x, options.y, { width: options.width });
  
  const titleHeight = doc.heightOfString(options.title, { width: options.width });
  const underlineY = options.y + titleHeight + 4;
  
  doc.moveTo(options.x, underlineY)
    .lineTo(options.x + 50, underlineY)
    .strokeColor(theme.accentColor)
    .lineWidth(2)
    .stroke();
  
  return underlineY + 12;
}

export function drawParagraph(
  doc: PDFKit.PDFDocument,
  options: {
    x: number;
    y: number;
    text: string;
    width: number;
    fontSize?: number;
    color?: string;
    align?: "left" | "center" | "right" | "justify";
    lineGap?: number;
  }
): number {
  doc.fontSize(options.fontSize || 10)
    .fillColor(options.color || BRAND_COLORS.mediumText)
    .font("Helvetica");
  
  doc.text(options.text, options.x, options.y, {
    width: options.width,
    align: options.align || "justify",
    lineGap: options.lineGap || 3,
  });
  
  return doc.y + 12;
}

export function drawImageWithBorder(
  doc: PDFKit.PDFDocument,
  options: {
    imageBuffer: Buffer;
    x: number;
    y: number;
    width: number;
    height: number;
    borderRadius?: number;
    borderColor?: string;
    borderWidth?: number;
  }
): number {
  const { imageBuffer, x, y, width, height } = options;
  const borderRadius = options.borderRadius || 4;
  const borderColor = options.borderColor || BRAND_COLORS.border;
  const borderWidth = options.borderWidth || 1;
  
  try {
    doc.save();
    
    doc.image(imageBuffer, x, y, {
      width,
      height,
      cover: [width, height],
      align: "center",
      valign: "center",
    });
    
    doc.roundedRect(x, y, width, height, borderRadius)
      .strokeColor(borderColor)
      .lineWidth(borderWidth)
      .stroke();
    
    doc.restore();
    
    return y + height;
  } catch (e) {
    console.error("Failed to draw image:", e);
    return y;
  }
}

export function drawTable(
  doc: PDFKit.PDFDocument,
  options: {
    x: number;
    y: number;
    width: number;
    headers: string[];
    rows: string[][];
    columnWidths?: number[];
    theme?: PDFTheme;
  }
): number {
  const theme = options.theme || DEFAULT_THEME;
  const { x, y, width, headers, rows } = options;
  const rowHeight = 28;
  const headerHeight = 32;
  const padding = 10;
  
  const columnWidths = options.columnWidths || 
    headers.map(() => width / headers.length);
  
  doc.rect(x, y, width, headerHeight).fillColor(theme.primaryColor).fill();
  
  let colX = x;
  doc.fontSize(10).fillColor(BRAND_COLORS.white).font("Helvetica-Bold");
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], colX + padding, y + (headerHeight - 10) / 2, {
      width: columnWidths[i] - padding * 2,
    });
    colX += columnWidths[i];
  }
  
  let currentY = y + headerHeight;
  doc.font("Helvetica").fillColor(BRAND_COLORS.darkText).fontSize(9);
  
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const bgColor = rowIndex % 2 === 0 ? BRAND_COLORS.white : BRAND_COLORS.ultraLight;
    
    doc.rect(x, currentY, width, rowHeight).fillColor(bgColor).fill();
    
    colX = x;
    for (let i = 0; i < row.length; i++) {
      doc.fillColor(BRAND_COLORS.darkText);
      doc.text(row[i], colX + padding, currentY + (rowHeight - 9) / 2, {
        width: columnWidths[i] - padding * 2,
      });
      colX += columnWidths[i];
    }
    
    currentY += rowHeight;
  }
  
  doc.rect(x, y, width, headerHeight + rows.length * rowHeight)
    .strokeColor(BRAND_COLORS.border)
    .lineWidth(0.5)
    .stroke();
  
  return currentY;
}

export function drawStatBox(
  doc: PDFKit.PDFDocument,
  options: {
    x: number;
    y: number;
    width: number;
    height: number;
    value: string;
    label: string;
    icon?: string;
    theme?: PDFTheme;
  }
): void {
  const theme = options.theme || DEFAULT_THEME;
  const { x, y, width, height, value, label } = options;
  
  doc.roundedRect(x, y, width, height, 6)
    .fillColor(BRAND_COLORS.ultraLight)
    .fill();
  
  doc.roundedRect(x, y, width, height, 6)
    .strokeColor(BRAND_COLORS.border)
    .lineWidth(0.5)
    .stroke();
  
  const centerX = x + width / 2;
  const valueY = y + height * 0.3;
  const labelY = y + height * 0.65;
  
  doc.fontSize(20).fillColor(theme.primaryColor).font("Helvetica-Bold");
  const valueWidth = doc.widthOfString(value);
  doc.text(value, centerX - valueWidth / 2, valueY);
  
  doc.fontSize(9).fillColor(BRAND_COLORS.lightText).font("Helvetica");
  const labelWidth = doc.widthOfString(label);
  doc.text(label.toUpperCase(), centerX - labelWidth / 2, labelY);
}

export function createDocument(size: "letter" | "a4" = "letter"): PDFKit.PDFDocument {
  return new PDFDocument({
    size,
    margin: 0,
    bufferPages: true,
  });
}

export function collectBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  
  return new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

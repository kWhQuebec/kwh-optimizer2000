import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import logoFr from "@assets/solaire_fr_1764778573075.png";
import logoEn from "@assets/solaire_en_1764778591753.png";

interface PDFGeneratorOptions {
  siteName: string;
  clientName?: string;
  location?: string;
  language: "fr" | "en";
}

async function loadImageAsBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

const COLORS = {
  blue: [0, 61, 166] as [number, number, number],
  gold: [255, 176, 5] as [number, number, number],
  darkGray: [51, 51, 51] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  lightGray: [150, 150, 150] as [number, number, number],
  green: [22, 163, 74] as [number, number, number],
};

export async function generateClientSidePDF(options: PDFGeneratorOptions): Promise<Blob> {
  const { siteName, clientName, location, language } = options;
  const t = (fr: string, en: string) => (language === "fr" ? fr : en);

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "letter",
  });

  const pageWidth = 215.9;
  const pageHeight = 279.4;
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;

  let currentPage = 0;

  // ===== COVER PAGE =====
  const addCoverPage = async () => {
    // Full blue background
    pdf.setFillColor(...COLORS.blue);
    pdf.rect(0, 0, pageWidth, pageHeight, "F");

    // Add logo at top
    try {
      const logoUrl = language === "fr" ? logoFr : logoEn;
      const logoBase64 = await loadImageAsBase64(logoUrl);
      const logoWidth = 55;
      const logoHeight = 18;
      pdf.addImage(logoBase64, "PNG", margin, 20, logoWidth, logoHeight);
    } catch (error) {
      console.warn("Logo failed to load, using text fallback:", error);
      pdf.setTextColor(...COLORS.white);
      pdf.setFontSize(24);
      pdf.setFont("helvetica", "bold");
      pdf.text("kWh Québec", margin, 35);
    }

    // Center content
    const centerY = pageHeight / 2 - 40;

    // Gold accent line
    pdf.setFillColor(...COLORS.gold);
    pdf.rect(margin, centerY - 15, 50, 2, "F");

    // Main title
    pdf.setTextColor(...COLORS.white);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "normal");
    pdf.text(t("ÉTUDE PRÉLIMINAIRE", "PRELIMINARY STUDY"), margin, centerY);

    pdf.setFontSize(32);
    pdf.setFont("helvetica", "bold");
    pdf.text(t("SOLAIRE + STOCKAGE", "SOLAR + STORAGE"), margin, centerY + 15);

    // Site name
    pdf.setFontSize(20);
    pdf.setTextColor(...COLORS.gold);
    pdf.text(siteName, margin, centerY + 35);

    if (location) {
      pdf.setFontSize(12);
      pdf.setTextColor(...COLORS.white);
      pdf.setFont("helvetica", "normal");
      pdf.text(location, margin, centerY + 45);
    }

    // Bottom section
    const bottomY = pageHeight - 60;
    
    if (clientName) {
      pdf.setFontSize(10);
      pdf.setTextColor(...COLORS.lightGray);
      pdf.text(t("Préparé pour:", "Prepared for:"), margin, bottomY);
      pdf.setFontSize(14);
      pdf.setTextColor(...COLORS.white);
      pdf.setFont("helvetica", "bold");
      pdf.text(clientName, margin, bottomY + 8);
    }

    const dateStr = new Date().toLocaleDateString(language === "fr" ? "fr-CA" : "en-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...COLORS.lightGray);
    pdf.text(dateStr, margin, pageHeight - 20);
    
    // Confidential notice
    pdf.setFontSize(8);
    pdf.text(t("Document confidentiel", "Confidential Document"), pageWidth - margin, pageHeight - 20, { align: "right" });
  };

  // ===== PAGE HEADER =====
  const addHeader = (pageNum: number, sectionTitle?: string) => {
    // Header bar
    pdf.setFillColor(...COLORS.blue);
    pdf.rect(0, 0, pageWidth, 14, "F");
    
    // Gold accent
    pdf.setFillColor(...COLORS.gold);
    pdf.rect(0, 14, pageWidth, 1, "F");

    // Logo text
    pdf.setTextColor(...COLORS.white);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text("kWh Québec", margin, 9);

    // Site name
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.text(siteName, pageWidth - margin, 9, { align: "right" });
    
    // Section title under header
    if (sectionTitle) {
      pdf.setTextColor(...COLORS.darkGray);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.text(sectionTitle.toUpperCase(), margin, 22);
    }
  };

  // ===== PAGE FOOTER (called after all content is placed) =====
  const addFooter = (pageNum: number) => {
    // Draw a small white rectangle behind footer text to ensure visibility
    pdf.setFillColor(...COLORS.white);
    pdf.rect(0, pageHeight - 15, pageWidth, 15, "F");
    
    pdf.setTextColor(...COLORS.lightGray);
    pdf.setFontSize(8);
    pdf.text(`${pageNum}`, pageWidth / 2, pageHeight - 8, { align: "center" });
    pdf.text(t("© kWh Québec - Tous droits réservés", "© kWh Québec - All rights reserved"), margin, pageHeight - 8);
  };

  // ===== SECTION DIVIDER =====
  const addSectionNumber = (num: number, title: string, y: number): number => {
    // Section number circle
    pdf.setFillColor(...COLORS.blue);
    pdf.circle(margin + 4, y + 3, 4, "F");
    pdf.setTextColor(...COLORS.white);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.text(String(num), margin + 4, y + 4.5, { align: "center" });
    
    // Section title
    pdf.setTextColor(...COLORS.blue);
    pdf.setFontSize(12);
    pdf.text(title, margin + 12, y + 5);
    
    // Underline
    pdf.setDrawColor(...COLORS.gold);
    pdf.setLineWidth(0.5);
    pdf.line(margin + 12, y + 8, margin + 12 + pdf.getTextWidth(title), y + 8);
    
    return y + 15;
  };

  // ===== CAPTURE DOM ELEMENT =====
  const captureElement = async (elementId: string): Promise<HTMLCanvasElement | null> => {
    const element = document.getElementById(elementId);
    if (!element) {
      console.warn(`Element not found: ${elementId}`);
      return null;
    }

    // For hidden elements (like pdf-section-service-offer), temporarily make visible
    const wasHidden = element.style.position === 'absolute' && element.style.left === '-9999px';
    if (wasHidden) {
      element.style.position = 'static';
      element.style.left = 'auto';
    }

    try {
      const canvas = await html2canvas(element, {
        scale: 2.5,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: Math.max(element.scrollWidth, 800),
        windowHeight: element.scrollHeight,
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.getElementById(elementId);
          if (clonedElement) {
            clonedElement.style.backgroundColor = "#ffffff";
            clonedElement.style.padding = "16px";
            clonedElement.style.position = 'static';
            clonedElement.style.left = 'auto';
            
            // Sanitize color() function issues
            const allElements = clonedElement.querySelectorAll("*");
            allElements.forEach((el) => {
              const htmlEl = el as HTMLElement;
              const computed = window.getComputedStyle(htmlEl);
              
              if (computed.color && computed.color.includes("color(")) {
                htmlEl.style.color = "#333333";
              }
              if (computed.backgroundColor && computed.backgroundColor.includes("color(")) {
                htmlEl.style.backgroundColor = "transparent";
              }
              if (computed.borderColor && computed.borderColor.includes("color(")) {
                htmlEl.style.borderColor = "#e5e7eb";
              }
            });
            
            const cards = clonedElement.querySelectorAll("[class*='card']");
            cards.forEach((card) => {
              (card as HTMLElement).style.backgroundColor = "#ffffff";
            });
          }
        },
      });
      
      // Restore hidden state
      if (wasHidden) {
        element.style.position = 'absolute';
        element.style.left = '-9999px';
      }
      
      return canvas;
    } catch (error) {
      console.error(`Failed to capture element ${elementId}:`, error);
      // Restore hidden state on error
      if (wasHidden) {
        element.style.position = 'absolute';
        element.style.left = '-9999px';
      }
      return null;
    }
  };

  // ===== ADD IMAGE TO PDF =====
  const addImageToPDF = (
    imgData: string,
    imgWidth: number,
    imgHeight: number,
    currentY: number,
    maxWidthOverride?: number
  ): number => {
    const maxWidth = maxWidthOverride || contentWidth;
    const scaledWidth = maxWidth;
    const scaledHeight = (imgHeight / imgWidth) * scaledWidth;
    const maxHeight = pageHeight - currentY - 20;

    if (scaledHeight > maxHeight) {
      const fitHeight = maxHeight;
      const fitWidth = (fitHeight / scaledHeight) * scaledWidth;
      const xOffset = margin + (contentWidth - fitWidth) / 2;
      pdf.addImage(imgData, "PNG", xOffset, currentY, fitWidth, fitHeight);
      return currentY + fitHeight + 6;
    }

    const xOffset = margin + (contentWidth - scaledWidth) / 2;
    pdf.addImage(imgData, "PNG", xOffset, currentY, scaledWidth, scaledHeight);
    return currentY + scaledHeight + 6;
  };

  // ===== GENERATE PDF =====
  await addCoverPage();

  // Section definitions - streamlined for professional executive summary
  const sections = [
    { 
      id: "pdf-section-value-proposition", 
      title: t("Sommaire exécutif", "Executive Summary"),
      sectionNum: 1,
      description: t("Votre opportunité d'investissement", "Your Investment Opportunity")
    },
    { 
      id: "pdf-section-system-config", 
      title: t("Configuration recommandée", "Recommended Configuration"),
      sectionNum: 2,
      description: t("Système optimisé pour votre bâtiment", "System optimized for your building")
    },
    { 
      id: "pdf-section-kpis", 
      title: t("Indicateurs financiers", "Financial Indicators"),
      sectionNum: 3,
      description: t("Performance sur 25 ans", "25-Year Performance")
    },
    { 
      id: "pdf-section-financing", 
      title: t("Options de financement", "Financing Options"),
      sectionNum: 4,
      description: t("Comparez vos options", "Compare Your Options")
    },
    { 
      id: "pdf-section-financing-chart", 
      title: t("Projection financière", "Financial Projection"),
      sectionNum: 5,
      description: t("Flux de trésorerie sur 25 ans", "25-Year Cash Flow")
    },
    { 
      id: "pdf-section-service-offer", 
      title: t("Prochaines étapes", "Next Steps"),
      sectionNum: 6,
      description: t("Comment procéder", "How to Proceed")
    },
  ];

  console.log("Looking for PDF sections:", sections.map(s => s.id));
  
  let sectionsFound = 0;
  let currentY = 28;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    console.log(`Capturing section ${i + 1}/${sections.length}: ${section.id}`);
    
    const canvas = await captureElement(section.id);

    if (!canvas) {
      console.log(`Section not found or failed to capture: ${section.id}`);
      continue;
    }
    
    sectionsFound++;
    console.log(`Section captured: ${section.id}, canvas size: ${canvas.width}x${canvas.height}`);

    const imgData = canvas.toDataURL("image/png");
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const scaledHeight = (imgHeight / imgWidth) * contentWidth;

    // Start new page for first section or if content won't fit
    const needsNewPage = currentY + scaledHeight + 20 > pageHeight - 20 || sectionsFound === 1;

    if (needsNewPage) {
      pdf.addPage();
      currentPage++;
      addHeader(currentPage, section.title);
      currentY = 28;
    }
    
    // Add section number and title
    currentY = addSectionNumber(section.sectionNum, section.title, currentY);

    currentY = addImageToPDF(imgData, imgWidth, imgHeight, currentY);
  }

  // Add footers to all content pages after content is placed
  for (let pageNum = 1; pageNum <= currentPage; pageNum++) {
    pdf.setPage(pageNum + 1); // +1 because page 0 is cover
    addFooter(pageNum);
  }

  console.log(`PDF generation complete. ${sectionsFound}/${sections.length} sections captured.`);
  
  if (sectionsFound === 0) {
    throw new Error("No sections found. Please view the Analysis Results tab before downloading the report.");
  }

  return pdf.output("blob");
}

export async function downloadClientPDF(
  siteName: string,
  clientName: string | undefined,
  location: string | undefined,
  language: "fr" | "en"
): Promise<void> {
  console.log("Starting PDF generation for:", siteName);
  
  try {
    const blob = await generateClientSidePDF({
      siteName,
      clientName,
      location,
      language,
    });
    
    console.log("PDF blob generated, size:", blob.size);

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = siteName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-");
    a.download = `rapport-${safeName}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log("PDF download triggered");
  } catch (error) {
    console.error("PDF generation failed:", error);
    throw error;
  }
}

import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import logoUrl from "@assets/kWh_Quebec_Logo-01_-_Rectangulaire_1764799021536.png";

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
  const margin = 12;
  const contentWidth = pageWidth - 2 * margin;

  let currentPage = 0;

  const addCoverPage = async () => {
    pdf.setFillColor(...COLORS.blue);
    pdf.rect(0, 0, pageWidth, pageHeight, "F");

    // Add logo at top
    try {
      const logoBase64 = await loadImageAsBase64(logoUrl);
      // Logo dimensions: maintain aspect ratio, width ~60mm
      const logoWidth = 60;
      const logoHeight = 20; // Approximate height based on rectangular logo
      pdf.addImage(logoBase64, "PNG", margin, 15, logoWidth, logoHeight);
    } catch (error) {
      // Fallback to text if logo fails to load
      console.warn("Logo failed to load, using text fallback:", error);
      pdf.setTextColor(...COLORS.white);
      pdf.setFontSize(28);
      pdf.setFont("helvetica", "bold");
      pdf.text("kWh Québec", margin, 35);
    }

    const centerY = pageHeight / 2 - 30;

    pdf.setTextColor(...COLORS.white);
    pdf.setFontSize(26);
    pdf.setFont("helvetica", "bold");
    pdf.text(t("ÉTUDE PRÉLIMINAIRE", "PRELIMINARY STUDY"), pageWidth / 2, centerY, { align: "center" });

    pdf.setTextColor(...COLORS.gold);
    pdf.setFontSize(20);
    pdf.text(t("SOLAIRE + STOCKAGE", "SOLAR + STORAGE"), pageWidth / 2, centerY + 12, { align: "center" });

    pdf.setFillColor(...COLORS.gold);
    pdf.rect(pageWidth / 2 - 35, centerY + 20, 70, 1.5, "F");

    pdf.setTextColor(...COLORS.white);
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text(siteName, pageWidth / 2, centerY + 38, { align: "center" });

    if (location) {
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.text(location, pageWidth / 2, centerY + 48, { align: "center" });
    }

    const bottomY = pageHeight - 45;
    if (clientName) {
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(t("Préparé pour:", "Prepared for:"), pageWidth / 2, bottomY, { align: "center" });
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text(clientName, pageWidth / 2, bottomY + 7, { align: "center" });
    }

    const dateStr = new Date().toLocaleDateString(language === "fr" ? "fr-CA" : "en-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text(dateStr, pageWidth / 2, pageHeight - 18, { align: "center" });
  };

  const addHeader = () => {
    pdf.setFillColor(...COLORS.blue);
    pdf.rect(0, 0, pageWidth, 16, "F");

    pdf.setFillColor(...COLORS.gold);
    pdf.rect(0, 16, pageWidth, 1.2, "F");

    pdf.setTextColor(...COLORS.white);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text("kWh Québec", margin, 10);

    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.text(siteName, pageWidth - margin, 10, { align: "right" });
  };

  const addFooter = () => {
    pdf.setTextColor(...COLORS.lightGray);
    pdf.setFontSize(8);
    pdf.text(`${currentPage}`, pageWidth / 2, pageHeight - 8, { align: "center" });
  };

  const captureElement = async (elementId: string): Promise<HTMLCanvasElement | null> => {
    const element = document.getElementById(elementId);
    if (!element) {
      console.warn(`Element not found: ${elementId}`);
      return null;
    }

    try {
      const canvas = await html2canvas(element, {
        scale: 2.5,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.getElementById(elementId);
          if (clonedElement) {
            clonedElement.style.backgroundColor = "#ffffff";
            clonedElement.style.padding = "16px";
            const cards = clonedElement.querySelectorAll("[class*='card']");
            cards.forEach((card) => {
              (card as HTMLElement).style.backgroundColor = "#ffffff";
            });
          }
        },
      });
      return canvas;
    } catch (error) {
      console.error(`Failed to capture element ${elementId}:`, error);
      return null;
    }
  };

  const addImageToPDF = (
    imgData: string,
    imgWidth: number,
    imgHeight: number,
    currentY: number
  ): number => {
    const scaledWidth = contentWidth;
    const scaledHeight = (imgHeight / imgWidth) * scaledWidth;
    const maxHeight = pageHeight - currentY - 15;

    if (scaledHeight > maxHeight) {
      const fitHeight = maxHeight;
      const fitWidth = (fitHeight / scaledHeight) * scaledWidth;
      pdf.addImage(imgData, "PNG", margin + (contentWidth - fitWidth) / 2, currentY, fitWidth, fitHeight);
      return currentY + fitHeight + 8;
    }

    pdf.addImage(imgData, "PNG", margin, currentY, scaledWidth, scaledHeight);
    return currentY + scaledHeight + 8;
  };

  await addCoverPage();

  const sections = [
    { id: "pdf-section-system-config", title: t("Configuration du système", "System Configuration") },
    { id: "pdf-section-value-proposition", title: t("Proposition de valeur", "Value Proposition") },
    { id: "pdf-section-kpis", title: t("Indicateurs financiers", "Financial Indicators") },
    { id: "pdf-section-cashflow-chart", title: t("Flux de trésorerie", "Cash Flow") },
    { id: "pdf-section-financing", title: t("Options de financement", "Financing Options") },
    { id: "pdf-section-financing-chart", title: t("Comparaison financement", "Financing Comparison") },
  ];

  console.log("Looking for PDF sections:", sections.map(s => s.id));
  
  let sectionsFound = 0;
  let currentY = 25;

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

    const needsNewPage = currentY + scaledHeight > pageHeight - 20;

    if (needsNewPage || i === 0) {
      pdf.addPage();
      currentPage++;
      addHeader();
      addFooter();
      currentY = 25;
    }

    currentY = addImageToPDF(imgData, imgWidth, imgHeight, currentY);
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

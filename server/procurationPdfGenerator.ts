import PDFDocument from "pdfkit";

interface ProcurationData {
  companyName: string;
  contactName: string;
  signerTitle: string;
  hqAccountNumber: string;
  streetAddress: string;
  city: string;
  province: string;
  postalCode?: string;
  signatureImage?: string;
  procurationDate: Date;
  procurationEndDate: Date;
  ipAddress?: string;
  userAgent?: string;
}

const MANDATAIRE = {
  companyName: "kWh Québec",
  contactName: "Marc-André La Barre",
  title: "Chef des opérations",
  phone: "514-427-8871",
  fax: "514-891-8199",
};

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let addedDays = 0;
  while (addedDays < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      addedDays++;
    }
  }
  return result;
}

function formatDateFr(date: Date): string {
  const months = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre"
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export function generateProcurationPDF(
  doc: PDFKit.PDFDocument,
  data: ProcurationData
): void {
  const pageWidth = 612;
  const margin = 50;
  const contentWidth = pageWidth - 2 * margin;
  
  doc.font("Helvetica");

  doc.fontSize(14).font("Helvetica-Bold");
  doc.text("PROCURATION", margin, 50, { align: "center", width: contentWidth });
  doc.font("Helvetica");
  
  doc.moveDown(1.5);
  doc.fontSize(10);

  doc.text("Je soussigné(e),", margin);
  doc.moveDown(0.5);
  
  doc.font("Helvetica-Bold");
  doc.text(`Nom : ${data.contactName}`, margin);
  doc.text(`Titre/Fonction : ${data.signerTitle}`, margin);
  doc.text(`Entreprise : ${data.companyName}`, margin);
  doc.text(`No de compte Hydro-Québec : ${data.hqAccountNumber}`, margin);
  doc.font("Helvetica");
  
  const fullAddress = [data.streetAddress, data.city, data.province, data.postalCode]
    .filter(Boolean)
    .join(", ");
  doc.text(`Adresse : ${fullAddress}`, margin);
  
  doc.moveDown(1);
  doc.text("autorise par la présente,", margin);
  doc.moveDown(0.5);
  
  doc.font("Helvetica-Bold");
  doc.text(`Entreprise : ${MANDATAIRE.companyName}`, margin);
  doc.text(`Représentant : ${MANDATAIRE.contactName}`, margin);
  doc.text(`Titre : ${MANDATAIRE.title}`, margin);
  doc.text(`Téléphone : ${MANDATAIRE.phone}`, margin);
  doc.text(`Télécopieur : ${MANDATAIRE.fax}`, margin);
  doc.font("Helvetica");
  
  doc.moveDown(1);
  doc.text(
    "à effectuer en mon nom les démarches suivantes auprès d'Hydro-Québec :",
    margin,
    undefined,
    { width: contentWidth }
  );
  
  doc.moveDown(0.5);
  const permissions = [
    "• Obtenir l'historique de consommation d'électricité détaillé (données 15 minutes)",
    "• Demander les données techniques du compteur",
    "• Consulter les informations du compte client",
    "• Communiquer avec Hydro-Québec concernant ce dossier",
  ];
  permissions.forEach((p) => {
    doc.text(p, margin + 10, undefined, { width: contentWidth - 20 });
  });
  
  doc.moveDown(1);
  doc.text("Cette procuration est valide :", margin);
  doc.moveDown(0.3);
  doc.text(`Du : ${formatDateFr(data.procurationDate)}`, margin + 10);
  doc.text(`Au : ${formatDateFr(data.procurationEndDate)}`, margin + 10);
  
  doc.moveDown(1.5);
  
  doc.text("Signature du mandant :", margin);
  doc.moveDown(0.3);
  
  if (data.signatureImage) {
    try {
      const base64Data = data.signatureImage.replace(/^data:image\/\w+;base64,/, "");
      const imageBuffer = Buffer.from(base64Data, "base64");
      doc.image(imageBuffer, margin, doc.y, { width: 200, height: 60 });
      doc.y += 65;
    } catch (e) {
      doc.text("[Signature électronique]", margin);
    }
  }
  
  doc.moveDown(0.5);
  doc.fontSize(8).fillColor("#666666");
  doc.text(`Signé électroniquement le ${formatDateFr(data.procurationDate)}`, margin);
  
  if (data.ipAddress) {
    doc.text(`Adresse IP : ${data.ipAddress}`, margin);
  }
  if (data.userAgent) {
    const shortUA = data.userAgent.substring(0, 80);
    doc.text(`Navigateur : ${shortUA}...`, margin);
  }
  
  doc.moveDown(2);
  doc.fontSize(7).fillColor("#999999");
  doc.text(
    "Ce document a été généré électroniquement par la plateforme kWh Québec. " +
    "La signature électronique ci-dessus a été capturée en conformité avec la " +
    "Loi concernant le cadre juridique des technologies de l'information (RLRQ, c. C-1.1).",
    margin,
    undefined,
    { width: contentWidth, align: "justify" }
  );
}

export function createProcurationData(
  formData: {
    companyName: string;
    contactName: string;
    signerTitle: string;
    hqAccountNumber: string;
    streetAddress: string;
    city: string;
    province?: string;
    postalCode?: string;
    signatureImage?: string;
    procurationDate?: string;
  },
  ipAddress?: string,
  userAgent?: string
): ProcurationData {
  const signatureDate = formData.procurationDate 
    ? new Date(formData.procurationDate) 
    : new Date();
  
  const endDate = addBusinessDays(signatureDate, 15);
  
  return {
    companyName: formData.companyName,
    contactName: formData.contactName,
    signerTitle: formData.signerTitle,
    hqAccountNumber: formData.hqAccountNumber,
    streetAddress: formData.streetAddress,
    city: formData.city,
    province: formData.province || "Québec",
    postalCode: formData.postalCode,
    signatureImage: formData.signatureImage,
    procurationDate: signatureDate,
    procurationEndDate: endDate,
    ipAddress,
    userAgent,
  };
}

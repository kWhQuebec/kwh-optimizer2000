export const scheduleEmail = async (lead) => {
  const emailData = {
    leadId: lead.id,
    contactName: lead.contactName,
    companyName: lead.companyName,
    estimatedSystemSize: lead.estimatedSystemSize ? `${Math.round(lead.estimatedSystemSize)} kW` : "",
    estimatedSavings: lead.estimatedSavings ? `$${Math.round(lead.estimatedSavings).toLocaleString()}` : "",
    estimatedROI: lead.estimatedROI ? `${lead.estimatedROI.toFixed(1)}%` : "",
    leadColor: lead.qualificationStatus || "pending",
    annualConsumptionKwh: lead.annualConsumptionKwh ? `${Math.round(lead.annualConsumptionKwh).toLocaleString()} kWh` : "",
  };
  return emailData;
};

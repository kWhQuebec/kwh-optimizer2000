/**
 * Client Portal Service — O&M, Performance Dashboard, Support Tickets
 * 
 * Backend service for the client-facing portal post-installation.
 * Clients can: view system performance, access O&M docs, submit support tickets.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SystemPerformance {
  siteId: number;
  clientId: number;
  date: string;
  productionKWh: number;
  consumptionKWh: number;
  selfConsumptionKWh: number;
  gridExportKWh: number;
  gridImportKWh: number;
  savingsCAD: number;
  co2AvoidedKg: number;
}

export interface PerformanceSummary {
  period: 'day' | 'week' | 'month' | 'year' | 'lifetime';
  totalProductionKWh: number;
  totalSavingsCAD: number;
  totalCO2AvoidedKg: number;
  averageDailyProductionKWh: number;
  performanceRatio: number; // actual vs expected (%)
  systemHealthStatus: 'excellent' | 'good' | 'attention' | 'critical';
  alerts: PerformanceAlert[];
}

export interface PerformanceAlert {
  id: string;
  type: 'underperformance' | 'inverter_fault' | 'communication_loss' | 'panel_degradation' | 'maintenance_due';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  messageFr: string;
  detectedAt: string;
  acknowledged: boolean;
}

export interface OMDocument {
  id: string;
  type: 'warranty' | 'manual' | 'inspection_report' | 'maintenance_log' | 'certificate' | 'as_built';
  title: string;
  titleFr: string;
  description: string;
  fileUrl: string;
  fileType: 'pdf' | 'doc' | 'jpg' | 'png';
  uploadedAt: string;
  expiresAt?: string;
}

export interface SupportTicket {
  id: number;
  clientId: number;
  siteId: number;
  subject: string;
  description: string;
  category: 'technical' | 'billing' | 'maintenance' | 'general' | 'emergency';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting_client' | 'resolved' | 'closed';
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  messages: TicketMessage[];
}

export interface TicketMessage {
  id: number;
  ticketId: number;
  authorId: number;
  authorRole: 'client' | 'staff' | 'system';
  content: string;
  attachments: string[];
  createdAt: string;
}

// ─── Performance Service ─────────────────────────────────────────────────────

const CO2_PER_KWH_QC = 0.002; // kg CO2/kWh (Quebec's low-carbon grid)
const EXPECTED_YIELD_KWHPERKWP = 1150;

export function calculatePerformanceSummary(
  dailyData: SystemPerformance[],
  systemSizeKWp: number,
  period: PerformanceSummary['period'] = 'month'
): PerformanceSummary {
  if (dailyData.length === 0) {
    return {
      period,
      totalProductionKWh: 0,
      totalSavingsCAD: 0,
      totalCO2AvoidedKg: 0,
      averageDailyProductionKWh: 0,
      performanceRatio: 0,
      systemHealthStatus: 'attention',
      alerts: [{
        id: 'no-data',
        type: 'communication_loss',
        severity: 'warning',
        message: 'No production data available for this period',
        messageFr: "Aucune donnée de production disponible pour cette période",
        detectedAt: new Date().toISOString(),
        acknowledged: false,
      }],
    };
  }

  const totalProductionKWh = dailyData.reduce((sum, d) => sum + d.productionKWh, 0);
  const totalSavingsCAD = dailyData.reduce((sum, d) => sum + d.savingsCAD, 0);
  const totalCO2AvoidedKg = totalProductionKWh * CO2_PER_KWH_QC;
  const averageDailyProductionKWh = totalProductionKWh / dailyData.length;

  // Performance ratio: actual vs expected
  const daysInPeriod = dailyData.length;
  const expectedDailyKWh = (systemSizeKWp * EXPECTED_YIELD_KWHPERKWP) / 365;
  const expectedTotalKWh = expectedDailyKWh * daysInPeriod;
  const performanceRatio = expectedTotalKWh > 0
    ? (totalProductionKWh / expectedTotalKWh) * 100
    : 0;

  // Generate alerts
  const alerts: PerformanceAlert[] = [];

  if (performanceRatio < 70) {
    alerts.push({
      id: `underperf-${Date.now()}`,
      type: 'underperformance',
      severity: 'critical',
      message: `System producing at ${performanceRatio.toFixed(0)}% of expected — investigate immediately`,
      messageFr: `Système produit à ${performanceRatio.toFixed(0)}% du prévu — investigation requise`,
      detectedAt: new Date().toISOString(),
      acknowledged: false,
    });
  } else if (performanceRatio < 85) {
    alerts.push({
      id: `underperf-${Date.now()}`,
      type: 'underperformance',
      severity: 'warning',
      message: `System producing at ${performanceRatio.toFixed(0)}% of expected — may need inspection`,
      messageFr: `Système produit à ${performanceRatio.toFixed(0)}% du prévu — inspection recommandée`,
      detectedAt: new Date().toISOString(),
      acknowledged: false,
    });
  }

  // Check for zero-production days (possible inverter fault)
  const zeroDays = dailyData.filter(d => d.productionKWh === 0).length;
  if (zeroDays > 2) {
    alerts.push({
      id: `inv-fault-${Date.now()}`,
      type: 'inverter_fault',
      severity: 'warning',
      message: `${zeroDays} days with zero production detected`,
      messageFr: `${zeroDays} jours sans production détectés`,
      detectedAt: new Date().toISOString(),
      acknowledged: false,
    });
  }

  const systemHealthStatus: PerformanceSummary['systemHealthStatus'] =
    performanceRatio >= 95 ? 'excellent' :
    performanceRatio >= 85 ? 'good' :
    performanceRatio >= 70 ? 'attention' : 'critical';

  return {
    period,
    totalProductionKWh,
    totalSavingsCAD,
    totalCO2AvoidedKg,
    averageDailyProductionKWh,
    performanceRatio,
    systemHealthStatus,
    alerts,
  };
}

// ─── O&M Document Templates ─────────────────────────────────────────────────

export function getDefaultOMDocuments(siteId: number): OMDocument[] {
  const now = new Date().toISOString();
  const warrantyExpiry = new Date();
  warrantyExpiry.setFullYear(warrantyExpiry.getFullYear() + 25);

  return [
    {
      id: `warranty-panels-${siteId}`,
      type: 'warranty',
      title: 'Solar Panel Warranty (25 years)',
      titleFr: 'Garantie panneaux solaires (25 ans)',
      description: 'Manufacturer performance warranty — 80% output at year 25',
      fileUrl: `/api/portal/documents/warranty-panels-${siteId}`,
      fileType: 'pdf',
      uploadedAt: now,
      expiresAt: warrantyExpiry.toISOString(),
    },
    {
      id: `warranty-inverter-${siteId}`,
      type: 'warranty',
      title: 'Inverter Warranty (12 years)',
      titleFr: 'Garantie onduleur (12 ans)',
      description: 'Manufacturer product warranty with extended coverage',
      fileUrl: `/api/portal/documents/warranty-inverter-${siteId}`,
      fileType: 'pdf',
      uploadedAt: now,
    },
    {
      id: `manual-system-${siteId}`,
      type: 'manual',
      title: 'System Owner Manual',
      titleFr: "Manuel du propriétaire du système",
      description: 'Complete guide for monitoring, maintenance, and troubleshooting',
      fileUrl: `/api/portal/documents/manual-${siteId}`,
      fileType: 'pdf',
      uploadedAt: now,
    },
    {
      id: `asbuilt-${siteId}`,
      type: 'as_built',
      title: 'As-Built Drawings',
      titleFr: 'Plans tel que construit',
      description: 'Final installation drawings with equipment locations',
      fileUrl: `/api/portal/documents/asbuilt-${siteId}`,
      fileType: 'pdf',
      uploadedAt: now,
    },
    {
      id: `cert-hq-${siteId}`,
      type: 'certificate',
      title: 'Hydro-Québec Interconnection Certificate',
      titleFr: "Certificat d'interconnexion Hydro-Québec",
      description: 'Official PTO (Permission to Operate) from HQ',
      fileUrl: `/api/portal/documents/cert-hq-${siteId}`,
      fileType: 'pdf',
      uploadedAt: now,
    },
  ];
}

// ─── Support Ticket Helpers ──────────────────────────────────────────────────

export function createTicket(params: {
  clientId: number;
  siteId: number;
  subject: string;
  description: string;
  category: SupportTicket['category'];
}): Omit<SupportTicket, 'id'> {
  const now = new Date().toISOString();

  // Auto-assign priority based on category
  const priorityMap: Record<SupportTicket['category'], SupportTicket['priority']> = {
    emergency: 'urgent',
    technical: 'high',
    maintenance: 'medium',
    billing: 'medium',
    general: 'low',
  };

  return {
    clientId: params.clientId,
    siteId: params.siteId,
    subject: params.subject,
    description: params.description,
    category: params.category,
    priority: priorityMap[params.category],
    status: 'open',
    createdAt: now,
    updatedAt: now,
    messages: [{
      id: 0,
      ticketId: 0,
      authorId: params.clientId,
      authorRole: 'client',
      content: params.description,
      attachments: [],
      createdAt: now,
    }],
  };
}

export function getTicketSLAHours(priority: SupportTicket['priority']): number {
  const slaMap: Record<SupportTicket['priority'], number> = {
    urgent: 4,
    high: 24,
    medium: 48,
    low: 72,
  };
  return slaMap[priority];
}

export function isTicketOverdue(ticket: SupportTicket): boolean {
  if (ticket.status === 'resolved' || ticket.status === 'closed') return false;
  const slaHours = getTicketSLAHours(ticket.priority);
  const createdAt = new Date(ticket.createdAt).getTime();
  const now = Date.now();
  const elapsedHours = (now - createdAt) / (1000 * 60 * 60);
  return elapsedHours > slaHours;
}

// ─── Portal Dashboard Data ──────────────────────────────────────────────────

export interface PortalDashboard {
  systemOverview: {
    systemSizeKWp: number;
    installDate: string;
    panelCount: number;
    inverterModel: string;
    warrantyEndDate: string;
  };
  performance: PerformanceSummary;
  documents: OMDocument[];
  openTickets: number;
  nextMaintenanceDate: string | null;
}

export function buildPortalDashboard(params: {
  systemSizeKWp: number;
  installDate: string;
  panelCount: number;
  inverterModel: string;
  siteId: number;
  performanceData: SystemPerformance[];
  openTicketCount: number;
}): PortalDashboard {
  const warrantyEnd = new Date(params.installDate);
  warrantyEnd.setFullYear(warrantyEnd.getFullYear() + 25);

  // Next maintenance: every 6 months from install
  const nextMaintenance = new Date(params.installDate);
  while (nextMaintenance < new Date()) {
    nextMaintenance.setMonth(nextMaintenance.getMonth() + 6);
  }

  return {
    systemOverview: {
      systemSizeKWp: params.systemSizeKWp,
      installDate: params.installDate,
      panelCount: params.panelCount,
      inverterModel: params.inverterModel,
      warrantyEndDate: warrantyEnd.toISOString(),
    },
    performance: calculatePerformanceSummary(params.performanceData, params.systemSizeKWp, 'month'),
    documents: getDefaultOMDocuments(params.siteId),
    openTickets: params.openTicketCount,
    nextMaintenanceDate: nextMaintenance.toISOString(),
  };
}

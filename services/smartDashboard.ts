/**
 * Smart Dashboard Service
 * Calculates KPIs, generates alerts, and creates action items for executives
 */

import { DocumentRecord, Client, Staff, PostedGLEntry } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface KPI {
  id: string;
  name: string;
  nameTh: string;
  value: number;
  previousValue?: number;
  target?: number;
  unit: 'number' | 'currency' | 'percentage' | 'days';
  trend: 'up' | 'down' | 'stable';
  trendIsGood: boolean;
  category: 'revenue' | 'efficiency' | 'quality' | 'compliance';
}

export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  category: 'deadline' | 'compliance' | 'performance' | 'system' | 'financial';
  title: string;
  titleTh: string;
  message: string;
  messageTh: string;
  timestamp: string;
  clientId?: string;
  documentId?: string;
  actionUrl?: string;
  isDismissed: boolean;
}

export interface ActionItem {
  id: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  type: 'approval' | 'review' | 'filing' | 'reconciliation' | 'closing' | 'followup';
  title: string;
  titleTh: string;
  description: string;
  descriptionTh: string;
  dueDate?: string;
  clientId?: string;
  documentId?: string;
  assigneeId?: string;
  assigneeName?: string;
  estimatedMinutes?: number;
  isCompleted: boolean;
}

export interface DashboardSummary {
  totalRevenue: number;
  monthlyRevenue: number;
  pendingAmount: number;
  totalClients: number;
  activeClients: number;
  totalDocuments: number;
  pendingDocuments: number;
  approvalRate: number;
  avgProcessingTime: number;
  slaCompliance: number;
  overdueTasks: number;
  upcomingDeadlines: number;
}

export interface TrendData {
  date: string;
  value: number;
}

export interface ClientHealth {
  clientId: string;
  clientName: string;
  score: number; // 0-100
  status: 'excellent' | 'good' | 'attention' | 'critical';
  issuesCount: number;
  pendingDocs: number;
  lastActivity: string;
}

// ============================================================================
// KPI CALCULATIONS
// ============================================================================

/**
 * Calculate all KPIs from data
 */
export const calculateKPIs = (
  documents: DocumentRecord[],
  clients: Client[],
  glEntries: PostedGLEntry[]
): KPI[] => {
  const kpis: KPI[] = [];
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  // 1. Total Revenue (from GL entries - credit side of revenue accounts)
  const revenueEntries = glEntries.filter(gl =>
    gl.account_code.startsWith('4') && gl.credit > 0
  );
  const totalRevenue = revenueEntries.reduce((sum, gl) => sum + gl.credit, 0);
  const lastMonthRevenue = revenueEntries
    .filter(gl => {
      const date = new Date(gl.date);
      return date.getMonth() === (thisMonth - 1 + 12) % 12;
    })
    .reduce((sum, gl) => sum + gl.credit, 0);

  kpis.push({
    id: 'total-revenue',
    name: 'Total Revenue',
    nameTh: 'รายได้รวม',
    value: totalRevenue,
    previousValue: lastMonthRevenue * 12, // Annualized
    unit: 'currency',
    trend: totalRevenue > lastMonthRevenue * 12 ? 'up' : totalRevenue < lastMonthRevenue * 12 ? 'down' : 'stable',
    trendIsGood: totalRevenue >= lastMonthRevenue * 12,
    category: 'revenue',
  });

  // 2. Monthly Revenue
  const thisMonthDocs = documents.filter(d => {
    const date = new Date(d.uploaded_at);
    return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
  });
  const monthlyRevenue = thisMonthDocs.reduce((sum, d) => sum + d.amount, 0);

  kpis.push({
    id: 'monthly-revenue',
    name: 'Monthly Revenue',
    nameTh: 'รายได้เดือนนี้',
    value: monthlyRevenue,
    target: 1000000, // 1M THB target
    unit: 'currency',
    trend: monthlyRevenue > 800000 ? 'up' : 'down',
    trendIsGood: monthlyRevenue >= 800000,
    category: 'revenue',
  });

  // 3. Document Processing Rate
  const approvedDocs = documents.filter(d => d.status === 'approved').length;
  const totalDocs = documents.length || 1;
  const approvalRate = Math.round((approvedDocs / totalDocs) * 100);

  kpis.push({
    id: 'approval-rate',
    name: 'Approval Rate',
    nameTh: 'อัตราการอนุมัติ',
    value: approvalRate,
    target: 95,
    unit: 'percentage',
    trend: approvalRate >= 90 ? 'up' : 'down',
    trendIsGood: approvalRate >= 90,
    category: 'efficiency',
  });

  // 4. Pending Documents
  const pendingDocs = documents.filter(d =>
    d.status === 'pending_review' || d.status === 'processing'
  ).length;

  kpis.push({
    id: 'pending-docs',
    name: 'Pending Documents',
    nameTh: 'เอกสารรอดำเนินการ',
    value: pendingDocs,
    target: 10, // Below 10 is good
    unit: 'number',
    trend: pendingDocs <= 10 ? 'down' : 'up',
    trendIsGood: pendingDocs <= 10,
    category: 'efficiency',
  });

  // 5. Active Clients
  const activeClients = clients.filter(c =>
    !c.current_workflow.is_locked && c.current_workflow.closing_status !== 'Filed/Closed'
  ).length;

  kpis.push({
    id: 'active-clients',
    name: 'Active Clients',
    nameTh: 'ลูกค้าที่กำลังดำเนินการ',
    value: activeClients,
    unit: 'number',
    trend: 'stable',
    trendIsGood: true,
    category: 'revenue',
  });

  // 6. Total Issues
  const totalIssues = clients.reduce((sum, c) => sum + c.current_workflow.issues.length, 0);

  kpis.push({
    id: 'total-issues',
    name: 'Open Issues',
    nameTh: 'ประเด็นที่ต้องแก้ไข',
    value: totalIssues,
    target: 0,
    unit: 'number',
    trend: totalIssues > 5 ? 'up' : 'down',
    trendIsGood: totalIssues <= 5,
    category: 'quality',
  });

  // 7. Clients Ready for Filing
  const readyForFiling = clients.filter(c =>
    c.current_workflow.closing_status === 'Ready to File'
  ).length;

  kpis.push({
    id: 'ready-filing',
    name: 'Ready for Filing',
    nameTh: 'พร้อมยื่นภาษี',
    value: readyForFiling,
    unit: 'number',
    trend: 'stable',
    trendIsGood: true,
    category: 'compliance',
  });

  // 8. SLA Compliance (mock - calculate based on processing time)
  const slaCompliance = Math.min(98, 85 + Math.round(approvalRate / 10));

  kpis.push({
    id: 'sla-compliance',
    name: 'SLA Compliance',
    nameTh: 'ประสิทธิภาพตาม SLA',
    value: slaCompliance,
    target: 95,
    unit: 'percentage',
    trend: slaCompliance >= 95 ? 'up' : 'down',
    trendIsGood: slaCompliance >= 95,
    category: 'efficiency',
  });

  return kpis;
};

// ============================================================================
// ALERT GENERATION
// ============================================================================

/**
 * Generate alerts based on current state
 */
export const generateAlerts = (
  documents: DocumentRecord[],
  clients: Client[],
  staff: Staff[]
): Alert[] => {
  const alerts: Alert[] = [];
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // Check for tax filing deadlines
  const taxDeadlines = [
    { day: 7, name: 'ภ.ง.ด.3', nameTh: 'ภ.ง.ด.3 (หัก ณ ที่จ่าย บุคคลธรรมดา)' },
    { day: 7, name: 'ภ.ง.ด.53', nameTh: 'ภ.ง.ด.53 (หัก ณ ที่จ่าย นิติบุคคล)' },
    { day: 15, name: 'ภ.พ.30', nameTh: 'ภ.พ.30 (ภาษีมูลค่าเพิ่ม)' },
    { day: 15, name: 'ภ.ง.ด.1', nameTh: 'ภ.ง.ด.1 (เงินเดือน)' },
  ];

  const currentDay = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  taxDeadlines.forEach(deadline => {
    const daysUntil = deadline.day - currentDay;
    if (daysUntil > 0 && daysUntil <= 5) {
      alerts.push({
        id: `deadline-${deadline.name}-${now.getMonth()}`,
        type: daysUntil <= 2 ? 'critical' : 'warning',
        category: 'deadline',
        title: `${deadline.name} Due Soon`,
        titleTh: `กำหนดส่ง ${deadline.name}`,
        message: `Tax filing ${deadline.name} is due in ${daysUntil} days`,
        messageTh: `เหลือเวลา ${daysUntil} วัน สำหรับการยื่น ${deadline.nameTh}`,
        timestamp: now.toISOString(),
        isDismissed: false,
      });
    }
  });

  // Check for pending documents that are old
  const pendingDocs = documents.filter(d => d.status === 'pending_review');
  const oldPending = pendingDocs.filter(d => {
    const uploadDate = new Date(d.uploaded_at);
    const daysSince = Math.floor((now.getTime() - uploadDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysSince >= 3;
  });

  if (oldPending.length > 0) {
    alerts.push({
      id: `old-pending-${now.getTime()}`,
      type: oldPending.length > 5 ? 'critical' : 'warning',
      category: 'performance',
      title: `${oldPending.length} Documents Pending > 3 Days`,
      titleTh: `${oldPending.length} เอกสารค้างมากกว่า 3 วัน`,
      message: `There are ${oldPending.length} documents waiting for review for more than 3 days`,
      messageTh: `มี ${oldPending.length} เอกสารรอตรวจสอบมากกว่า 3 วัน กรุณาดำเนินการ`,
      timestamp: now.toISOString(),
      isDismissed: false,
    });
  }

  // Check for clients with issues
  const clientsWithIssues = clients.filter(c => c.current_workflow.issues.length > 0);
  if (clientsWithIssues.length > 0) {
    const totalIssues = clientsWithIssues.reduce((sum, c) => sum + c.current_workflow.issues.length, 0);
    alerts.push({
      id: `client-issues-${now.getTime()}`,
      type: totalIssues > 10 ? 'critical' : 'warning',
      category: 'compliance',
      title: `${totalIssues} Client Issues Require Attention`,
      titleTh: `มี ${totalIssues} ประเด็นที่ต้องแก้ไข`,
      message: `${clientsWithIssues.length} clients have open issues totaling ${totalIssues} items`,
      messageTh: `ลูกค้า ${clientsWithIssues.length} รายมีประเด็นที่ต้องดำเนินการรวม ${totalIssues} รายการ`,
      timestamp: now.toISOString(),
      isDismissed: false,
    });
  }

  // Check for high-value pending approvals
  const highValuePending = pendingDocs.filter(d => d.amount > 100000);
  if (highValuePending.length > 0) {
    const totalValue = highValuePending.reduce((sum, d) => sum + d.amount, 0);
    alerts.push({
      id: `high-value-pending-${now.getTime()}`,
      type: 'warning',
      category: 'financial',
      title: `${highValuePending.length} High-Value Documents Pending`,
      titleTh: `${highValuePending.length} เอกสารมูลค่าสูงรอดำเนินการ`,
      message: `Documents worth ${new Intl.NumberFormat('th-TH').format(totalValue)} THB are pending approval`,
      messageTh: `เอกสารมูลค่ารวม ${new Intl.NumberFormat('th-TH').format(totalValue)} บาท รอการอนุมัติ`,
      timestamp: now.toISOString(),
      isDismissed: false,
    });
  }

  // Success alert if everything is on track
  if (pendingDocs.length === 0 && clientsWithIssues.length === 0) {
    alerts.push({
      id: `all-clear-${now.getTime()}`,
      type: 'success',
      category: 'system',
      title: 'All Clear!',
      titleTh: 'ระบบปกติ!',
      message: 'No pending documents or issues. Great work!',
      messageTh: 'ไม่มีเอกสารค้างหรือประเด็นที่ต้องแก้ไข ทำได้ดีมาก!',
      timestamp: now.toISOString(),
      isDismissed: false,
    });
  }

  return alerts.sort((a, b) => {
    const priority = { critical: 0, warning: 1, info: 2, success: 3 };
    return priority[a.type] - priority[b.type];
  });
};

// ============================================================================
// ACTION ITEMS
// ============================================================================

/**
 * Generate action items requiring attention
 */
export const generateActionItems = (
  documents: DocumentRecord[],
  clients: Client[],
  staff: Staff[]
): ActionItem[] => {
  const items: ActionItem[] = [];
  const now = new Date();

  // Action: Review pending documents
  const pendingReview = documents.filter(d => d.status === 'pending_review');
  pendingReview.slice(0, 10).forEach(doc => {
    const uploadDate = new Date(doc.uploaded_at);
    const daysSince = Math.floor((now.getTime() - uploadDate.getTime()) / (1000 * 60 * 60 * 24));

    items.push({
      id: `review-${doc.id}`,
      priority: daysSince >= 3 ? 'urgent' : daysSince >= 1 ? 'high' : 'medium',
      type: 'review',
      title: `Review: ${doc.filename}`,
      titleTh: `ตรวจสอบ: ${doc.filename}`,
      description: `Document from ${doc.client_name} - ${new Intl.NumberFormat('th-TH').format(doc.amount)} THB`,
      descriptionTh: `เอกสารจาก ${doc.client_name} - ${new Intl.NumberFormat('th-TH').format(doc.amount)} บาท`,
      documentId: doc.id,
      assigneeId: doc.assigned_to || undefined,
      assigneeName: doc.assigned_to ? staff.find(s => s.id === doc.assigned_to)?.name : undefined,
      estimatedMinutes: 15,
      isCompleted: false,
    });
  });

  // Action: Resolve client issues
  clients.forEach(client => {
    client.current_workflow.issues.forEach(issue => {
      items.push({
        id: `issue-${issue.id}`,
        priority: issue.severity === 'High' ? 'urgent' : issue.severity === 'Medium' ? 'high' : 'medium',
        type: 'followup',
        title: `Issue: ${issue.description.slice(0, 50)}`,
        titleTh: `ประเด็น: ${issue.description.slice(0, 50)}`,
        description: `Client: ${client.name} - ${issue.description}`,
        descriptionTh: `ลูกค้า: ${client.name} - ${issue.description}`,
        clientId: client.id,
        documentId: issue.related_doc_id || undefined,
        estimatedMinutes: 30,
        isCompleted: false,
      });
    });
  });

  // Action: Period closing for clients ready
  const readyForClosing = clients.filter(c =>
    c.current_workflow.closing_status === 'Ready to File' && !c.current_workflow.is_locked
  );
  readyForClosing.forEach(client => {
    items.push({
      id: `closing-${client.id}`,
      priority: 'high',
      type: 'closing',
      title: `Close Period: ${client.name}`,
      titleTh: `ปิดงวด: ${client.name}`,
      description: `Client ${client.name} is ready for period closing`,
      descriptionTh: `ลูกค้า ${client.name} พร้อมสำหรับการปิดงวดบัญชี`,
      clientId: client.id,
      estimatedMinutes: 45,
      isCompleted: false,
    });
  });

  // Action: Bank reconciliation needed (clients with pending documents)
  const needsReconciliation = clients.filter(c =>
    c.current_workflow.pending_count > 0
  );
  needsReconciliation.slice(0, 5).forEach(client => {
    items.push({
      id: `recon-${client.id}`,
      priority: 'medium',
      type: 'reconciliation',
      title: `Reconcile: ${client.name}`,
      titleTh: `กระทบยอด: ${client.name}`,
      description: `Bank reconciliation overdue for ${client.name}`,
      descriptionTh: `${client.name} ต้องทำการกระทบยอดธนาคาร`,
      clientId: client.id,
      estimatedMinutes: 60,
      isCompleted: false,
    });
  });

  // Sort by priority
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  return items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
};

// ============================================================================
// DASHBOARD SUMMARY
// ============================================================================

/**
 * Calculate dashboard summary metrics
 */
export const calculateSummary = (
  documents: DocumentRecord[],
  clients: Client[],
  glEntries: PostedGLEntry[]
): DashboardSummary => {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  // Revenue calculations
  const revenueEntries = glEntries.filter(gl =>
    gl.account_code.startsWith('4') && gl.credit > 0
  );
  const totalRevenue = revenueEntries.reduce((sum, gl) => sum + gl.credit, 0);

  const thisMonthEntries = revenueEntries.filter(gl => {
    const date = new Date(gl.date);
    return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
  });
  const monthlyRevenue = thisMonthEntries.reduce((sum, gl) => sum + gl.credit, 0);

  // Document metrics
  const pendingDocs = documents.filter(d =>
    d.status === 'pending_review' || d.status === 'processing'
  );
  const pendingAmount = pendingDocs.reduce((sum, d) => sum + d.amount, 0);
  const approvedDocs = documents.filter(d => d.status === 'approved').length;
  const approvalRate = documents.length > 0
    ? Math.round((approvedDocs / documents.length) * 100)
    : 100;

  // Client metrics
  const activeClients = clients.filter(c =>
    !c.current_workflow.is_locked
  ).length;

  // Task metrics
  const totalIssues = clients.reduce((sum, c) => sum + c.current_workflow.issues.length, 0);

  // Calculate upcoming deadlines (tax filing dates in current month)
  const currentDay = now.getDate();
  const deadlineDays = [7, 15]; // Tax filing days
  const upcomingDeadlines = deadlineDays.filter(d => d > currentDay && d <= currentDay + 7).length;

  return {
    totalRevenue,
    monthlyRevenue,
    pendingAmount,
    totalClients: clients.length,
    activeClients,
    totalDocuments: documents.length,
    pendingDocuments: pendingDocs.length,
    approvalRate,
    avgProcessingTime: 2.5, // Mock average hours
    slaCompliance: Math.min(98, 85 + Math.round(approvalRate / 10)),
    overdueTasks: totalIssues,
    upcomingDeadlines,
  };
};

// ============================================================================
// CLIENT HEALTH SCORE
// ============================================================================

/**
 * Calculate client health scores
 */
export const calculateClientHealth = (
  clients: Client[],
  documents: DocumentRecord[]
): ClientHealth[] => {
  return clients.map(client => {
    const clientDocs = documents.filter(d => d.client_name === client.name);
    const pendingDocs = clientDocs.filter(d =>
      d.status === 'pending_review' || d.status === 'processing'
    ).length;
    const issuesCount = client.current_workflow.issues.length;

    // Calculate score (0-100)
    let score = 100;
    score -= pendingDocs * 5;  // -5 per pending doc
    score -= issuesCount * 10; // -10 per issue
    if (client.current_workflow.is_locked) score -= 0; // Locked is fine
    score = Math.max(0, Math.min(100, score));

    // Determine status
    let status: ClientHealth['status'];
    if (score >= 90) status = 'excellent';
    else if (score >= 70) status = 'good';
    else if (score >= 50) status = 'attention';
    else status = 'critical';

    // Last activity
    const lastDoc = clientDocs.sort((a, b) =>
      new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
    )[0];

    return {
      clientId: client.id,
      clientName: client.name,
      score,
      status,
      issuesCount,
      pendingDocs,
      lastActivity: lastDoc?.uploaded_at || client.last_closing_date || new Date().toISOString(),
    };
  }).sort((a, b) => a.score - b.score); // Sort by score ascending (worst first)
};

// ============================================================================
// TREND DATA
// ============================================================================

/**
 * Generate trend data for charts
 */
export const generateTrendData = (
  documents: DocumentRecord[],
  days: number = 30
): TrendData[] => {
  const trends: TrendData[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const dayDocs = documents.filter(d =>
      d.uploaded_at.split('T')[0] === dateStr
    );
    const value = dayDocs.reduce((sum, d) => sum + d.amount, 0);

    trends.push({ date: dateStr, value });
  }

  return trends;
};

/**
 * Generate document volume trend
 */
export const generateVolumeTrend = (
  documents: DocumentRecord[],
  days: number = 30
): TrendData[] => {
  const trends: TrendData[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const value = documents.filter(d =>
      d.uploaded_at.split('T')[0] === dateStr
    ).length;

    trends.push({ date: dateStr, value });
  }

  return trends;
};

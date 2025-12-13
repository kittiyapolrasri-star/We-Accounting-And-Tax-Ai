/**
 * Notification Service - Email and In-App Notifications
 * Uses Firebase Cloud Functions for email sending
 */

export interface NotificationTemplate {
  id: string;
  name: string;
  subject: string;
  bodyTemplate: string;
  variables: string[];
}

export interface Notification {
  id: string;
  type: 'email' | 'in_app' | 'both';
  templateId: string;
  recipientEmail?: string;
  recipientUserId?: string;
  subject: string;
  body: string;
  status: 'pending' | 'sent' | 'failed' | 'read';
  createdAt: string;
  sentAt?: string;
  readAt?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationPreferences {
  userId: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  preferences: {
    documentApproved: boolean;
    documentRejected: boolean;
    taxDeadlineReminder: boolean;
    weeklyReport: boolean;
    systemAlerts: boolean;
  };
}

// Email templates for Thai accounting notifications
export const EMAIL_TEMPLATES: Record<string, NotificationTemplate> = {
  DOCUMENT_APPROVED: {
    id: 'DOCUMENT_APPROVED',
    name: 'เอกสารได้รับการอนุมัติ',
    subject: 'เอกสาร {{documentNumber}} ได้รับการอนุมัติแล้ว',
    bodyTemplate: `
เรียน {{recipientName}},

เอกสารหมายเลข {{documentNumber}} ของ {{clientName}} ได้รับการอนุมัติแล้ว

รายละเอียด:
- ประเภทเอกสาร: {{documentType}}
- จำนวนเงิน: {{amount}} บาท
- อนุมัติโดย: {{approverName}}
- วันที่อนุมัติ: {{approvalDate}}

ท่านสามารถดูรายละเอียดเพิ่มเติมได้ที่ระบบ WE Accounting & Tax AI

ขอแสดงความนับถือ,
WE Accounting & Tax AI
    `.trim(),
    variables: ['recipientName', 'documentNumber', 'clientName', 'documentType', 'amount', 'approverName', 'approvalDate'],
  },

  DOCUMENT_REJECTED: {
    id: 'DOCUMENT_REJECTED',
    name: 'เอกสารถูกปฏิเสธ',
    subject: 'เอกสาร {{documentNumber}} ต้องการการแก้ไข',
    bodyTemplate: `
เรียน {{recipientName}},

เอกสารหมายเลข {{documentNumber}} ของ {{clientName}} ต้องการการแก้ไข

เหตุผล: {{rejectionReason}}

รายละเอียด:
- ประเภทเอกสาร: {{documentType}}
- ตรวจสอบโดย: {{reviewerName}}

กรุณาตรวจสอบและแก้ไขเอกสารในระบบ

ขอแสดงความนับถือ,
WE Accounting & Tax AI
    `.trim(),
    variables: ['recipientName', 'documentNumber', 'clientName', 'documentType', 'rejectionReason', 'reviewerName'],
  },

  TAX_DEADLINE_REMINDER: {
    id: 'TAX_DEADLINE_REMINDER',
    name: 'แจ้งเตือนกำหนดยื่นภาษี',
    subject: 'แจ้งเตือน: กำหนดยื่น {{taxType}} ภายใน {{daysLeft}} วัน',
    bodyTemplate: `
เรียน {{recipientName}},

นี่คือการแจ้งเตือนกำหนดยื่นภาษี {{taxType}}

รายละเอียด:
- ประเภทภาษี: {{taxType}}
- งวดเดือน: {{taxPeriod}}
- กำหนดยื่น: {{deadline}}
- เหลืออีก: {{daysLeft}} วัน

รายการลูกค้าที่ยังไม่ได้ยื่น:
{{clientList}}

กรุณาดำเนินการยื่นภาษีก่อนถึงกำหนด

ขอแสดงความนับถือ,
WE Accounting & Tax AI
    `.trim(),
    variables: ['recipientName', 'taxType', 'taxPeriod', 'deadline', 'daysLeft', 'clientList'],
  },

  WEEKLY_REPORT: {
    id: 'WEEKLY_REPORT',
    name: 'รายงานประจำสัปดาห์',
    subject: 'รายงานประจำสัปดาห์ - {{weekRange}}',
    bodyTemplate: `
เรียน {{recipientName}},

รายงานสรุปประจำสัปดาห์ {{weekRange}}

สรุปภาพรวม:
- เอกสารที่ประมวลผล: {{documentsProcessed}} รายการ
- เอกสารอนุมัติ: {{documentsApproved}} รายการ
- เอกสารรอดำเนินการ: {{documentsPending}} รายการ
- รายการที่ต้องตรวจสอบ: {{issuesCount}} รายการ

ลูกค้าที่มีความคืบหน้า:
{{clientProgress}}

งานที่ต้องดำเนินการสัปดาห์หน้า:
{{upcomingTasks}}

ขอแสดงความนับถือ,
WE Accounting & Tax AI
    `.trim(),
    variables: ['recipientName', 'weekRange', 'documentsProcessed', 'documentsApproved', 'documentsPending', 'issuesCount', 'clientProgress', 'upcomingTasks'],
  },

  SYSTEM_ALERT: {
    id: 'SYSTEM_ALERT',
    name: 'แจ้งเตือนระบบ',
    subject: '[แจ้งเตือน] {{alertTitle}}',
    bodyTemplate: `
เรียน {{recipientName}},

ระบบพบ{{alertType}}ที่ต้องการความสนใจ:

{{alertTitle}}

รายละเอียด:
{{alertDetails}}

{{actionRequired}}

ขอแสดงความนับถือ,
WE Accounting & Tax AI
    `.trim(),
    variables: ['recipientName', 'alertType', 'alertTitle', 'alertDetails', 'actionRequired'],
  },
};

/**
 * Replace template variables with actual values
 */
export const renderTemplate = (
  template: NotificationTemplate,
  variables: Record<string, string>
): { subject: string; body: string } => {
  let subject = template.subject;
  let body = template.bodyTemplate;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`{{${key}}}`, 'g');
    subject = subject.replace(placeholder, value);
    body = body.replace(placeholder, value);
  }

  return { subject, body };
};

/**
 * Queue notification for sending (via Cloud Functions)
 */
export const queueNotification = async (
  templateId: string,
  recipientEmail: string,
  variables: Record<string, string>,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; notificationId?: string; error?: string }> => {
  const template = EMAIL_TEMPLATES[templateId];

  if (!template) {
    return { success: false, error: `Template ${templateId} not found` };
  }

  const { subject, body } = renderTemplate(template, variables);

  try {
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
    if (!projectId) {
      console.log('Demo mode: Email notification would be sent', { templateId, recipientEmail, subject });
      return { success: true, notificationId: `demo-${Date.now()}` };
    }

    const response = await fetch(
      `https://asia-southeast1-${projectId}.cloudfunctions.net/api/api/notifications/send`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateId,
          recipientEmail,
          subject,
          body,
          metadata,
        }),
      }
    );

    const result = await response.json();

    if (result.success) {
      return { success: true, notificationId: result.notificationId };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('Failed to queue notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Send document approval notification
 */
export const notifyDocumentApproved = async (
  recipientEmail: string,
  recipientName: string,
  documentNumber: string,
  clientName: string,
  documentType: string,
  amount: number,
  approverName: string
): Promise<{ success: boolean; error?: string }> => {
  return queueNotification('DOCUMENT_APPROVED', recipientEmail, {
    recipientName,
    documentNumber,
    clientName,
    documentType,
    amount: amount.toLocaleString('th-TH', { minimumFractionDigits: 2 }),
    approverName,
    approvalDate: new Date().toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  });
};

/**
 * Send document rejection notification
 */
export const notifyDocumentRejected = async (
  recipientEmail: string,
  recipientName: string,
  documentNumber: string,
  clientName: string,
  documentType: string,
  rejectionReason: string,
  reviewerName: string
): Promise<{ success: boolean; error?: string }> => {
  return queueNotification('DOCUMENT_REJECTED', recipientEmail, {
    recipientName,
    documentNumber,
    clientName,
    documentType,
    rejectionReason,
    reviewerName,
  });
};

/**
 * Send tax deadline reminder
 */
export const notifyTaxDeadline = async (
  recipientEmail: string,
  recipientName: string,
  taxType: string,
  taxPeriod: string,
  deadline: string,
  daysLeft: number,
  pendingClients: string[]
): Promise<{ success: boolean; error?: string }> => {
  const clientList = pendingClients.length > 0
    ? pendingClients.map((c, i) => `${i + 1}. ${c}`).join('\n')
    : '- ไม่มีลูกค้าที่รอดำเนินการ';

  return queueNotification('TAX_DEADLINE_REMINDER', recipientEmail, {
    recipientName,
    taxType,
    taxPeriod,
    deadline,
    daysLeft: daysLeft.toString(),
    clientList,
  });
};

/**
 * Get upcoming tax deadlines for the current month
 */
export const getUpcomingDeadlines = (): {
  type: string;
  form: string;
  deadline: Date;
  description: string;
}[] => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  return [
    {
      type: 'VAT',
      form: 'ภ.พ.30',
      deadline: new Date(year, month, 15),
      description: 'ยื่นแบบภาษีมูลค่าเพิ่ม',
    },
    {
      type: 'WHT',
      form: 'ภ.ง.ด.3/53',
      deadline: new Date(year, month, 7),
      description: 'ยื่นแบบภาษีหัก ณ ที่จ่าย',
    },
    {
      type: 'SSO',
      form: 'สปส. 1-10',
      deadline: new Date(year, month, 15),
      description: 'นำส่งเงินสมทบประกันสังคม',
    },
    {
      type: 'VAT_ONLINE',
      form: 'ภ.พ.30 (Online)',
      deadline: new Date(year, month, 23),
      description: 'ยื่นแบบภาษีมูลค่าเพิ่ม (ออนไลน์)',
    },
  ].filter(d => d.deadline > now);
};

export default {
  EMAIL_TEMPLATES,
  renderTemplate,
  queueNotification,
  notifyDocumentApproved,
  notifyDocumentRejected,
  notifyTaxDeadline,
  getUpcomingDeadlines,
};

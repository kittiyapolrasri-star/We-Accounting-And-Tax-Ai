/**
 * Notification Agent Handler
 * AI-powered deadline alerts, reminders, and proactive notifications
 */

import { AgentHandler, AgentContext } from '../agentOrchestrator';
import { AgentInput, AgentOutput } from '../../../types/agents';
import { Task } from '../../../types/tasks';
import { Client } from '../../../types';

interface DeadlineAlert {
  type: 'tax' | 'task' | 'filing' | 'review';
  title: string;
  message: string;
  dueDate: string;
  daysRemaining: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  relatedId?: string;
  clientName?: string;
}

interface NotificationItem {
  id: string;
  type: 'deadline' | 'task' | 'approval' | 'system';
  title: string;
  message: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  recipientId: string;
  createdAt: string;
  isRead: boolean;
  metadata?: Record<string, any>;
}

interface NotificationResult {
  notifications: NotificationItem[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  confidenceScore: number;
}

export class NotificationAgentHandler implements AgentHandler {
  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    context.addLog('start', 'ตรวจสอบกำหนดการและสร้างการแจ้งเตือน', 'pending');

    const { tasks, clients, documents, currentDate } = input.context || {};
    const today = currentDate ? new Date(currentDate) : new Date();

    try {
      const alerts: DeadlineAlert[] = [];

      // 1. Check tax deadlines
      context.addLog('check_tax', 'ตรวจสอบกำหนดยื่นภาษี', 'pending');
      const taxAlerts = this.checkTaxDeadlines(clients || [], today);
      alerts.push(...taxAlerts);

      // 2. Check task deadlines
      context.addLog('check_tasks', 'ตรวจสอบกำหนดส่งงาน', 'pending');
      const taskAlerts = this.checkTaskDeadlines(tasks || [], today);
      alerts.push(...taskAlerts);

      // 3. Check document review deadlines
      context.addLog('check_docs', 'ตรวจสอบเอกสารรอตรวจสอบ', 'pending');
      const docAlerts = this.checkDocumentReview(documents || [], today);
      alerts.push(...docAlerts);

      // Sort by priority and due date
      alerts.sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return a.daysRemaining - b.daysRemaining;
      });

      // Generate notifications
      const notifications: NotificationItem[] = alerts.map((alert, index) => ({
        id: `NOTIF-${Date.now()}-${index}`,
        type: this.mapAlertTypeToNotificationType(alert.type),
        title: alert.title,
        message: alert.message,
        priority: alert.priority,
        recipientId: 'all', // Could be targeted based on assignment
        createdAt: new Date().toISOString(),
        isRead: false,
        metadata: {
          relatedId: alert.relatedId,
          clientName: alert.clientName,
          dueDate: alert.dueDate,
          daysRemaining: alert.daysRemaining,
        },
      }));

      // Summarize
      const criticalCount = alerts.filter(a => a.priority === 'critical').length;
      const highCount = alerts.filter(a => a.priority === 'high').length;
      const confidenceScore = alerts.length > 0 ? 95 : 100;

      const result: NotificationResult = {
        notifications,
        summary: {
          total: alerts.length,
          critical: criticalCount,
          high: highCount,
          medium: alerts.filter(a => a.priority === 'medium').length,
          low: alerts.filter(a => a.priority === 'low').length,
        },
        confidenceScore,
      };

      context.addLog(
        'complete',
        `พบ ${alerts.length} รายการที่ต้องแจ้งเตือน (วิกฤต: ${criticalCount}, สูง: ${highCount})`,
        'success'
      );

      return {
        success: true,
        result,
        actions: [
          ...(criticalCount > 0 ? [{
            type: 'send_critical_alerts',
            label: `ส่งแจ้งเตือนด่วน ${criticalCount} รายการ`,
            data: { notifications: notifications.filter(n => n.priority === 'critical') },
          }] : []),
          ...(notifications.length > 0 ? [{
            type: 'send_all_notifications',
            label: `ส่งการแจ้งเตือนทั้งหมด`,
            data: { notifications },
          }] : []),
        ],
      };
    } catch (error) {
      context.addLog('error', `เกิดข้อผิดพลาด: ${error}`, 'failure');
      return {
        success: false,
        result: {
          error: String(error),
          confidenceScore: 0,
        },
      };
    }
  }

  private checkTaxDeadlines(clients: Client[], today: Date): DeadlineAlert[] {
    const alerts: DeadlineAlert[] = [];
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Thai tax deadlines
    const taxDeadlines = [
      { day: 7, name: 'ภ.ง.ด.3/53 (WHT)', type: 'wht' as const },
      { day: 15, name: 'ภ.พ.30 (VAT)', type: 'vat' as const },
      { day: 15, name: 'ประกันสังคม', type: 'sso' as const },
    ];

    for (const client of clients) {
      if (client.status !== 'Active') continue;

      for (const deadline of taxDeadlines) {
        const dueDate = new Date(currentYear, currentMonth, deadline.day);

        // If past this month's deadline, check next month
        if (dueDate < today) {
          dueDate.setMonth(dueDate.getMonth() + 1);
        }

        const daysRemaining = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // Only alert if within 10 days
        if (daysRemaining <= 10) {
          // Check if already filed (simplified check)
          const workflow = client.current_workflow;
          let isCompleted = false;

          if (deadline.type === 'vat' && workflow?.vat_status === 'Filed/Closed') {
            isCompleted = true;
          }
          if (deadline.type === 'wht' && workflow?.wht_status === 'Filed/Closed') {
            isCompleted = true;
          }

          if (!isCompleted) {
            alerts.push({
              type: 'tax',
              title: `${deadline.name} - ${client.name}`,
              message: daysRemaining <= 0
                ? `เลยกำหนดยื่น ${deadline.name} แล้ว!`
                : daysRemaining <= 3
                  ? `เหลือเวลายื่น ${deadline.name} อีก ${daysRemaining} วัน`
                  : `กำหนดยื่น ${deadline.name} ในอีก ${daysRemaining} วัน`,
              dueDate: dueDate.toISOString(),
              daysRemaining,
              priority: daysRemaining <= 0 ? 'critical' : daysRemaining <= 3 ? 'high' : 'medium',
              relatedId: client.id,
              clientName: client.name,
            });
          }
        }
      }
    }

    return alerts;
  }

  private checkTaskDeadlines(tasks: Task[], today: Date): DeadlineAlert[] {
    const alerts: DeadlineAlert[] = [];

    for (const task of tasks) {
      if (task.status === 'completed' || task.status === 'cancelled') continue;
      if (!task.dueDate) continue;

      const dueDate = new Date(task.dueDate);
      const daysRemaining = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Alert for tasks due within 5 days or overdue
      if (daysRemaining <= 5) {
        alerts.push({
          type: 'task',
          title: task.title,
          message: daysRemaining <= 0
            ? `งาน "${task.title}" เลยกำหนดแล้ว ${Math.abs(daysRemaining)} วัน!`
            : daysRemaining === 1
              ? `งาน "${task.title}" ครบกำหนดพรุ่งนี้`
              : `งาน "${task.title}" ครบกำหนดในอีก ${daysRemaining} วัน`,
          dueDate: dueDate.toISOString(),
          daysRemaining,
          priority: daysRemaining <= 0 ? 'critical'
            : task.priority === 'urgent' ? 'high'
            : daysRemaining <= 2 ? 'high'
            : 'medium',
          relatedId: task.id,
          clientName: task.clientId,
        });
      }
    }

    return alerts;
  }

  private checkDocumentReview(documents: any[], today: Date): DeadlineAlert[] {
    const alerts: DeadlineAlert[] = [];

    const pendingDocs = documents.filter(d => d.status === 'pending_review');

    // Group by age
    for (const doc of pendingDocs) {
      const uploadDate = new Date(doc.uploaded_at || doc.upload_date);
      const daysPending = Math.ceil((today.getTime() - uploadDate.getTime()) / (1000 * 60 * 60 * 24));

      // Alert if pending for more than 2 days
      if (daysPending >= 2) {
        alerts.push({
          type: 'review',
          title: `เอกสารรอตรวจสอบ`,
          message: `มีเอกสาร "${doc.ai_data?.parties?.counterparty?.name || doc.client_name || 'ไม่ระบุผู้ขาย'}" รอตรวจสอบ ${daysPending} วันแล้ว`,
          dueDate: uploadDate.toISOString(),
          daysRemaining: -daysPending,
          priority: daysPending >= 5 ? 'high' : 'medium',
          relatedId: doc.id,
          clientName: doc.client_name,
        });
      }
    }

    // Summarize if too many
    if (alerts.length > 5) {
      return [{
        type: 'review',
        title: `เอกสารรอตรวจสอบ ${alerts.length} รายการ`,
        message: `มีเอกสารรอตรวจสอบสะสม ${alerts.length} รายการ กรุณาตรวจสอบโดยเร็ว`,
        dueDate: today.toISOString(),
        daysRemaining: 0,
        priority: 'high',
      }];
    }

    return alerts;
  }

  private mapAlertTypeToNotificationType(type: DeadlineAlert['type']): NotificationItem['type'] {
    const mapping: Record<DeadlineAlert['type'], NotificationItem['type']> = {
      tax: 'deadline',
      task: 'task',
      filing: 'deadline',
      review: 'approval',
    };
    return mapping[type] || 'system';
  }

  canHandle(input: AgentInput): boolean {
    return input.type === 'check_deadlines' || input.type === 'generate_notifications';
  }

  getRequiredPermissions(): string[] {
    return ['view_tasks', 'view_clients', 'send_notifications'];
  }
}

export const notificationAgentHandler = new NotificationAgentHandler();

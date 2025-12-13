/**
 * Automated Workflow Service
 * Handles approval routing, SLA tracking, and notifications
 */

import { DocumentRecord, Staff, Client } from '../types';

// Workflow Types
export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  triggerType: 'document_upload' | 'manual' | 'schedule' | 'amount_threshold';
  triggerConditions: WorkflowCondition[];
  steps: WorkflowStep[];
  slaHours: number; // Total SLA for workflow completion
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'in_list';
  value: string | number | string[];
}

export interface WorkflowStep {
  id: string;
  order: number;
  name: string;
  type: 'approval' | 'review' | 'notification' | 'auto_action';
  assigneeType: 'specific' | 'role' | 'manager' | 'auto';
  assigneeId?: string;
  assigneeRole?: string;
  requiredApprovals: number; // For multi-approval steps
  slaHours: number;
  escalationEnabled: boolean;
  escalationAfterHours?: number;
  escalationTo?: string;
  actions: WorkflowAction[];
  conditions?: WorkflowCondition[]; // Conditional step execution
}

export interface WorkflowAction {
  type: 'approve' | 'reject' | 'return' | 'notify' | 'update_status' | 'assign' | 'post_gl';
  params: Record<string, any>;
}

export interface WorkflowInstance {
  id: string;
  workflowId: string;
  documentId: string;
  clientId: string;
  currentStepId: string;
  status: 'active' | 'completed' | 'cancelled' | 'escalated';
  startedAt: string;
  completedAt?: string;
  dueAt: string;
  stepHistory: StepHistory[];
  assignments: StepAssignment[];
}

export interface StepHistory {
  stepId: string;
  action: string;
  actionBy: string;
  actionByName: string;
  timestamp: string;
  comments?: string;
  previousStatus: string;
  newStatus: string;
}

export interface StepAssignment {
  stepId: string;
  assigneeId: string;
  assigneeName: string;
  assignedAt: string;
  dueAt: string;
  status: 'pending' | 'completed' | 'skipped' | 'escalated';
  completedAt?: string;
}

export interface Notification {
  id: string;
  recipientId: string;
  recipientEmail?: string;
  type: 'assignment' | 'reminder' | 'escalation' | 'completion' | 'sla_warning';
  title: string;
  message: string;
  relatedDocId?: string;
  relatedWorkflowId?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'sent' | 'read';
  createdAt: string;
  sentAt?: string;
  readAt?: string;
}

export interface SLAStatus {
  workflowInstanceId: string;
  documentId: string;
  totalSlaHours: number;
  elapsedHours: number;
  remainingHours: number;
  percentComplete: number;
  status: 'on_track' | 'at_risk' | 'overdue';
  currentStep: string;
  dueAt: string;
}

// Default Workflow Definitions for Accounting Firm
export const DEFAULT_WORKFLOW_DEFINITIONS: WorkflowDefinition[] = [
  {
    id: 'WF-001',
    name: 'Standard Document Approval',
    description: 'มาตรฐานการอนุมัติเอกสารทั่วไป',
    triggerType: 'document_upload',
    triggerConditions: [
      { field: 'amount', operator: 'less_than', value: 50000 },
    ],
    steps: [
      {
        id: 'STEP-001',
        order: 1,
        name: 'Staff Review',
        type: 'review',
        assigneeType: 'role',
        assigneeRole: 'accountant',
        requiredApprovals: 1,
        slaHours: 4,
        escalationEnabled: true,
        escalationAfterHours: 6,
        escalationTo: 'supervisor',
        actions: [
          { type: 'approve', params: { nextStep: 'STEP-002' } },
          { type: 'return', params: { reason: 'required' } },
        ],
      },
      {
        id: 'STEP-002',
        order: 2,
        name: 'Supervisor Approval',
        type: 'approval',
        assigneeType: 'role',
        assigneeRole: 'supervisor',
        requiredApprovals: 1,
        slaHours: 2,
        escalationEnabled: true,
        escalationAfterHours: 4,
        escalationTo: 'manager',
        actions: [
          { type: 'approve', params: { autoPost: true } },
          { type: 'reject', params: { notifyCreator: true } },
        ],
      },
    ],
    slaHours: 8,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'WF-002',
    name: 'High-Value Approval',
    description: 'กระบวนการอนุมัติสำหรับรายการมูลค่าสูง',
    triggerType: 'amount_threshold',
    triggerConditions: [
      { field: 'amount', operator: 'greater_than', value: 50000 },
    ],
    steps: [
      {
        id: 'STEP-HV-001',
        order: 1,
        name: 'Senior Accountant Review',
        type: 'review',
        assigneeType: 'role',
        assigneeRole: 'senior_accountant',
        requiredApprovals: 1,
        slaHours: 4,
        escalationEnabled: true,
        escalationAfterHours: 8,
        escalationTo: 'manager',
        actions: [
          { type: 'approve', params: { nextStep: 'STEP-HV-002' } },
          { type: 'return', params: { reason: 'required' } },
        ],
      },
      {
        id: 'STEP-HV-002',
        order: 2,
        name: 'Manager Approval',
        type: 'approval',
        assigneeType: 'role',
        assigneeRole: 'manager',
        requiredApprovals: 1,
        slaHours: 4,
        escalationEnabled: true,
        escalationAfterHours: 8,
        escalationTo: 'executive',
        actions: [
          { type: 'approve', params: { nextStep: 'STEP-HV-003' } },
          { type: 'reject', params: { notifyCreator: true } },
        ],
        conditions: [
          { field: 'amount', operator: 'greater_than', value: 100000 },
        ],
      },
      {
        id: 'STEP-HV-003',
        order: 3,
        name: 'Executive Approval',
        type: 'approval',
        assigneeType: 'role',
        assigneeRole: 'executive',
        requiredApprovals: 1,
        slaHours: 8,
        escalationEnabled: false,
        actions: [
          { type: 'approve', params: { autoPost: true } },
          { type: 'reject', params: { notifyAll: true } },
        ],
      },
    ],
    slaHours: 24,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Approval Level Thresholds
export const APPROVAL_THRESHOLDS = {
  LEVEL_1: { maxAmount: 10000, role: 'accountant', title: 'พนักงานบัญชี' },
  LEVEL_2: { maxAmount: 50000, role: 'supervisor', title: 'หัวหน้างาน' },
  LEVEL_3: { maxAmount: 200000, role: 'manager', title: 'ผู้จัดการ' },
  LEVEL_4: { maxAmount: Infinity, role: 'executive', title: 'ผู้บริหาร' },
};

/**
 * Get approval level required for amount
 */
export const getApprovalLevel = (amount: number): {
  level: number;
  role: string;
  title: string;
} => {
  if (amount <= APPROVAL_THRESHOLDS.LEVEL_1.maxAmount) {
    return { level: 1, ...APPROVAL_THRESHOLDS.LEVEL_1 };
  }
  if (amount <= APPROVAL_THRESHOLDS.LEVEL_2.maxAmount) {
    return { level: 2, ...APPROVAL_THRESHOLDS.LEVEL_2 };
  }
  if (amount <= APPROVAL_THRESHOLDS.LEVEL_3.maxAmount) {
    return { level: 3, ...APPROVAL_THRESHOLDS.LEVEL_3 };
  }
  return { level: 4, ...APPROVAL_THRESHOLDS.LEVEL_4 };
};

/**
 * Find matching workflow for document
 */
export const findMatchingWorkflow = (
  doc: DocumentRecord,
  workflows: WorkflowDefinition[]
): WorkflowDefinition | null => {
  const enabledWorkflows = workflows.filter(w => w.enabled);

  for (const workflow of enabledWorkflows) {
    let matches = true;

    for (const condition of workflow.triggerConditions) {
      let fieldValue: any;

      switch (condition.field) {
        case 'amount':
          fieldValue = doc.amount || doc.ai_data?.financials.grand_total || 0;
          break;
        case 'doc_type':
          fieldValue = doc.ai_data?.header_data.doc_type;
          break;
        case 'client_name':
          fieldValue = doc.client_name;
          break;
        case 'vendor_name':
          fieldValue = doc.ai_data?.parties.counterparty.name;
          break;
        case 'confidence_score':
          fieldValue = doc.ai_data?.confidence_score;
          break;
        default:
          continue;
      }

      let conditionMet = false;
      switch (condition.operator) {
        case 'equals':
          conditionMet = fieldValue === condition.value;
          break;
        case 'greater_than':
          conditionMet = Number(fieldValue) > Number(condition.value);
          break;
        case 'less_than':
          conditionMet = Number(fieldValue) < Number(condition.value);
          break;
        case 'contains':
          conditionMet = String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase());
          break;
        case 'in_list':
          const valueList = Array.isArray(condition.value) ? condition.value : [condition.value];
          conditionMet = valueList.includes(fieldValue);
          break;
      }

      if (!conditionMet) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return workflow;
    }
  }

  return null;
};

/**
 * Create workflow instance for document
 */
export const createWorkflowInstance = (
  workflow: WorkflowDefinition,
  doc: DocumentRecord,
  clientId: string
): WorkflowInstance => {
  const startTime = new Date();
  const dueTime = new Date(startTime.getTime() + workflow.slaHours * 60 * 60 * 1000);
  const firstStep = workflow.steps[0];

  return {
    id: `WFI-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    workflowId: workflow.id,
    documentId: doc.id,
    clientId,
    currentStepId: firstStep.id,
    status: 'active',
    startedAt: startTime.toISOString(),
    dueAt: dueTime.toISOString(),
    stepHistory: [],
    assignments: [],
  };
};

/**
 * Assign step to appropriate staff member
 */
export const assignStep = (
  step: WorkflowStep,
  staffList: Staff[],
  clientId?: string
): StepAssignment | null => {
  let assignee: Staff | undefined;

  switch (step.assigneeType) {
    case 'specific':
      assignee = staffList.find(s => s.id === step.assigneeId);
      break;
    case 'role':
      // Find least loaded staff with matching role
      const roleStaff = staffList.filter(s =>
        s.role.toLowerCase() === step.assigneeRole?.toLowerCase()
      );
      if (roleStaff.length > 0) {
        assignee = roleStaff.reduce((min, s) =>
          s.active_tasks < min.active_tasks ? s : min
        );
      }
      break;
    case 'manager':
      assignee = staffList.find(s =>
        s.role.toLowerCase().includes('manager')
      );
      break;
    case 'auto':
      // Auto-assign based on workload
      if (staffList.length > 0) {
        assignee = staffList.reduce((min, s) =>
          s.active_tasks < min.active_tasks ? s : min
        );
      }
      break;
  }

  if (!assignee) return null;

  const now = new Date();
  const dueAt = new Date(now.getTime() + step.slaHours * 60 * 60 * 1000);

  return {
    stepId: step.id,
    assigneeId: assignee.id,
    assigneeName: assignee.name,
    assignedAt: now.toISOString(),
    dueAt: dueAt.toISOString(),
    status: 'pending',
  };
};

/**
 * Process workflow step action
 */
export const processStepAction = (
  instance: WorkflowInstance,
  workflow: WorkflowDefinition,
  actionType: string,
  actionBy: Staff,
  comments?: string
): {
  updatedInstance: WorkflowInstance;
  notifications: Notification[];
  nextStep: WorkflowStep | null;
} => {
  const currentStep = workflow.steps.find(s => s.id === instance.currentStepId);
  if (!currentStep) {
    throw new Error('Current step not found');
  }

  const now = new Date().toISOString();
  const notifications: Notification[] = [];

  // Add to history
  const historyEntry: StepHistory = {
    stepId: currentStep.id,
    action: actionType,
    actionBy: actionBy.id,
    actionByName: actionBy.name,
    timestamp: now,
    comments,
    previousStatus: instance.status,
    newStatus: actionType === 'approve' ? 'active' : actionType === 'reject' ? 'cancelled' : 'active',
  };

  const updatedInstance = {
    ...instance,
    stepHistory: [...instance.stepHistory, historyEntry],
  };

  // Update assignment status
  const currentAssignment = updatedInstance.assignments.find(a => a.stepId === currentStep.id);
  if (currentAssignment) {
    currentAssignment.status = 'completed';
    currentAssignment.completedAt = now;
  }

  // Determine next step
  let nextStep: WorkflowStep | null = null;

  if (actionType === 'approve') {
    const nextStepIndex = currentStep.order;
    nextStep = workflow.steps.find(s => s.order === nextStepIndex + 1) || null;

    if (nextStep) {
      updatedInstance.currentStepId = nextStep.id;

      // Create notification for next assignee
      notifications.push({
        id: `NOTIF-${Date.now()}`,
        recipientId: '', // Will be filled by assignment
        type: 'assignment',
        title: `งานใหม่รอดำเนินการ: ${nextStep.name}`,
        message: `คุณได้รับมอบหมายให้ดำเนินการ ${nextStep.name} สำหรับเอกสาร`,
        relatedWorkflowId: instance.id,
        relatedDocId: instance.documentId,
        priority: 'medium',
        status: 'pending',
        createdAt: now,
      });
    } else {
      // Workflow completed
      updatedInstance.status = 'completed';
      updatedInstance.completedAt = now;

      // Create completion notification
      notifications.push({
        id: `NOTIF-${Date.now()}`,
        recipientId: '', // Creator
        type: 'completion',
        title: 'กระบวนการอนุมัติเสร็จสิ้น',
        message: 'เอกสารได้รับการอนุมัติเรียบร้อยแล้ว',
        relatedWorkflowId: instance.id,
        relatedDocId: instance.documentId,
        priority: 'low',
        status: 'pending',
        createdAt: now,
      });
    }
  } else if (actionType === 'reject') {
    updatedInstance.status = 'cancelled';

    // Create rejection notification
    notifications.push({
      id: `NOTIF-${Date.now()}`,
      recipientId: '', // Creator
      type: 'completion',
      title: 'เอกสารถูกปฏิเสธ',
      message: `เอกสารถูกปฏิเสธโดย ${actionBy.name}${comments ? `: ${comments}` : ''}`,
      relatedWorkflowId: instance.id,
      relatedDocId: instance.documentId,
      priority: 'high',
      status: 'pending',
      createdAt: now,
    });
  } else if (actionType === 'return') {
    // Return to previous step
    const prevStepIndex = currentStep.order - 2;
    if (prevStepIndex >= 0) {
      const prevStep = workflow.steps[prevStepIndex];
      updatedInstance.currentStepId = prevStep.id;
      nextStep = prevStep;
    }
  }

  return { updatedInstance, notifications, nextStep };
};

/**
 * Calculate SLA status for workflow instance
 */
export const calculateSLAStatus = (
  instance: WorkflowInstance,
  workflow: WorkflowDefinition
): SLAStatus => {
  const now = new Date();
  const startedAt = new Date(instance.startedAt);
  const dueAt = new Date(instance.dueAt);

  const totalMs = workflow.slaHours * 60 * 60 * 1000;
  const elapsedMs = now.getTime() - startedAt.getTime();
  const remainingMs = Math.max(0, dueAt.getTime() - now.getTime());

  const elapsedHours = elapsedMs / (60 * 60 * 1000);
  const remainingHours = remainingMs / (60 * 60 * 1000);
  const percentComplete = Math.min(100, (elapsedMs / totalMs) * 100);

  let status: SLAStatus['status'];
  if (remainingHours <= 0) {
    status = 'overdue';
  } else if (percentComplete >= 75) {
    status = 'at_risk';
  } else {
    status = 'on_track';
  }

  const currentStep = workflow.steps.find(s => s.id === instance.currentStepId);

  return {
    workflowInstanceId: instance.id,
    documentId: instance.documentId,
    totalSlaHours: workflow.slaHours,
    elapsedHours: Math.round(elapsedHours * 100) / 100,
    remainingHours: Math.round(remainingHours * 100) / 100,
    percentComplete: Math.round(percentComplete),
    status,
    currentStep: currentStep?.name || 'Unknown',
    dueAt: instance.dueAt,
  };
};

/**
 * Check for escalations and create notifications
 */
export const checkEscalations = (
  instances: WorkflowInstance[],
  workflows: WorkflowDefinition[],
  staffList: Staff[]
): {
  escalatedInstances: WorkflowInstance[];
  notifications: Notification[];
} => {
  const now = new Date();
  const escalatedInstances: WorkflowInstance[] = [];
  const notifications: Notification[] = [];

  for (const instance of instances) {
    if (instance.status !== 'active') continue;

    const workflow = workflows.find(w => w.id === instance.workflowId);
    if (!workflow) continue;

    const currentStep = workflow.steps.find(s => s.id === instance.currentStepId);
    if (!currentStep || !currentStep.escalationEnabled) continue;

    const currentAssignment = instance.assignments.find(a =>
      a.stepId === currentStep.id && a.status === 'pending'
    );
    if (!currentAssignment) continue;

    const assignedAt = new Date(currentAssignment.assignedAt);
    const hoursElapsed = (now.getTime() - assignedAt.getTime()) / (60 * 60 * 1000);

    if (currentStep.escalationAfterHours && hoursElapsed >= currentStep.escalationAfterHours) {
      // Escalate
      const escalateTo = staffList.find(s =>
        s.role.toLowerCase().includes(currentStep.escalationTo || 'manager')
      );

      if (escalateTo) {
        currentAssignment.status = 'escalated';

        // Create new assignment for escalation
        const escalationAssignment: StepAssignment = {
          stepId: currentStep.id,
          assigneeId: escalateTo.id,
          assigneeName: escalateTo.name,
          assignedAt: now.toISOString(),
          dueAt: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
          status: 'pending',
        };

        instance.assignments.push(escalationAssignment);
        instance.status = 'escalated';
        escalatedInstances.push(instance);

        // Create escalation notification
        notifications.push({
          id: `NOTIF-ESC-${Date.now()}`,
          recipientId: escalateTo.id,
          type: 'escalation',
          title: 'งาน Escalation: ต้องการความสนใจ',
          message: `งาน "${currentStep.name}" ถูกส่งต่อมาถึงคุณเนื่องจากเกินระยะเวลา SLA`,
          relatedWorkflowId: instance.id,
          relatedDocId: instance.documentId,
          priority: 'urgent',
          status: 'pending',
          createdAt: now.toISOString(),
        });
      }
    }
  }

  return { escalatedInstances, notifications };
};

/**
 * Get pending tasks for staff member
 */
export const getStaffPendingTasks = (
  staffId: string,
  instances: WorkflowInstance[],
  workflows: WorkflowDefinition[]
): {
  pending: Array<{
    instanceId: string;
    documentId: string;
    stepName: string;
    dueAt: string;
    slaStatus: SLAStatus['status'];
  }>;
  overdue: number;
  atRisk: number;
} => {
  const pending: Array<{
    instanceId: string;
    documentId: string;
    stepName: string;
    dueAt: string;
    slaStatus: SLAStatus['status'];
  }> = [];

  let overdue = 0;
  let atRisk = 0;

  for (const instance of instances) {
    if (instance.status !== 'active') continue;

    const assignment = instance.assignments.find(a =>
      a.assigneeId === staffId && a.status === 'pending'
    );
    if (!assignment) continue;

    const workflow = workflows.find(w => w.id === instance.workflowId);
    if (!workflow) continue;

    const slaStatus = calculateSLAStatus(instance, workflow);
    const step = workflow.steps.find(s => s.id === assignment.stepId);

    pending.push({
      instanceId: instance.id,
      documentId: instance.documentId,
      stepName: step?.name || 'Unknown',
      dueAt: assignment.dueAt,
      slaStatus: slaStatus.status,
    });

    if (slaStatus.status === 'overdue') overdue++;
    if (slaStatus.status === 'at_risk') atRisk++;
  }

  return { pending, overdue, atRisk };
};

/**
 * Generate workflow statistics
 */
export const getWorkflowStatistics = (
  instances: WorkflowInstance[],
  workflows: WorkflowDefinition[]
): {
  totalActive: number;
  totalCompleted: number;
  totalEscalated: number;
  averageCompletionHours: number;
  slaCompliance: number;
  byStatus: Record<string, number>;
  byWorkflow: Record<string, { count: number; avgHours: number }>;
} => {
  const active = instances.filter(i => i.status === 'active');
  const completed = instances.filter(i => i.status === 'completed');
  const escalated = instances.filter(i => i.status === 'escalated');

  // Calculate average completion time
  let totalCompletionHours = 0;
  let completedWithTime = 0;
  let slaCompliant = 0;

  completed.forEach(instance => {
    if (instance.completedAt && instance.startedAt) {
      const hours = (new Date(instance.completedAt).getTime() - new Date(instance.startedAt).getTime()) / (60 * 60 * 1000);
      totalCompletionHours += hours;
      completedWithTime++;

      const workflow = workflows.find(w => w.id === instance.workflowId);
      if (workflow && hours <= workflow.slaHours) {
        slaCompliant++;
      }
    }
  });

  const averageCompletionHours = completedWithTime > 0 ? totalCompletionHours / completedWithTime : 0;
  const slaCompliance = completed.length > 0 ? (slaCompliant / completed.length) * 100 : 100;

  // By status
  const byStatus: Record<string, number> = {
    active: active.length,
    completed: completed.length,
    escalated: escalated.length,
    cancelled: instances.filter(i => i.status === 'cancelled').length,
  };

  // By workflow
  const byWorkflow: Record<string, { count: number; avgHours: number }> = {};
  workflows.forEach(w => {
    const wfInstances = instances.filter(i => i.workflowId === w.id);
    const completedWf = wfInstances.filter(i => i.status === 'completed' && i.completedAt);

    let wfTotalHours = 0;
    completedWf.forEach(i => {
      if (i.completedAt && i.startedAt) {
        wfTotalHours += (new Date(i.completedAt).getTime() - new Date(i.startedAt).getTime()) / (60 * 60 * 1000);
      }
    });

    byWorkflow[w.name] = {
      count: wfInstances.length,
      avgHours: completedWf.length > 0 ? wfTotalHours / completedWf.length : 0,
    };
  });

  return {
    totalActive: active.length,
    totalCompleted: completed.length,
    totalEscalated: escalated.length,
    averageCompletionHours: Math.round(averageCompletionHours * 10) / 10,
    slaCompliance: Math.round(slaCompliance),
    byStatus,
    byWorkflow,
  };
};

export default {
  DEFAULT_WORKFLOW_DEFINITIONS,
  APPROVAL_THRESHOLDS,
  getApprovalLevel,
  findMatchingWorkflow,
  createWorkflowInstance,
  assignStep,
  processStepAction,
  calculateSLAStatus,
  checkEscalations,
  getStaffPendingTasks,
  getWorkflowStatistics,
};

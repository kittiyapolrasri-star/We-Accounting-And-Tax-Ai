/**
 * AI Agent System Types
 * ระบบ AI Agent สำหรับสำนักงานบัญชี
 */

// Agent Types
export type AgentType =
  | 'orchestrator'     // ควบคุม agents อื่นๆ
  | 'document'         // วิเคราะห์เอกสาร
  | 'tax'              // คำนวณและเตรียมภาษี
  | 'reconciliation'   // กระทบยอดธนาคาร
  | 'closing'          // ปิดงวดบัญชี
  | 'task_assignment'  // มอบหมายงาน
  | 'notification';    // แจ้งเตือน

export type AgentStatus =
  | 'idle'        // รอรับงาน
  | 'processing'  // กำลังทำงาน
  | 'waiting'     // รอ input จาก human/agent อื่น
  | 'completed'   // ทำเสร็จ
  | 'failed'      // ล้มเหลว
  | 'escalated';  // ส่งต่อ human

export type AgentPriority = 'critical' | 'high' | 'medium' | 'low';

// Agent Definition
export interface AgentDefinition {
  id: string;
  type: AgentType;
  name: string;
  description: string;
  enabled: boolean;
  capabilities: string[];
  maxConcurrentTasks: number;
  timeoutMinutes: number;
  escalationRules: EscalationRule[];
}

export interface EscalationRule {
  condition: 'timeout' | 'error' | 'low_confidence' | 'manual_request';
  threshold?: number;  // สำหรับ low_confidence (0-100)
  escalateTo: 'human' | 'manager' | 'senior';
  notifyStaff: boolean;
}

// Agent Execution
export interface AgentExecution {
  id: string;
  agentType: AgentType;
  status: AgentStatus;

  // Context
  clientId?: string;
  documentId?: string;
  taskId?: string;

  // Input/Output
  input: AgentInput;
  output?: AgentOutput;

  // Timing
  startedAt: string;
  completedAt?: string;
  timeoutAt: string;

  // Human Interaction
  humanReviewRequired: boolean;
  escalatedTo?: string;
  escalationReason?: string;

  // Tracking
  auditLog: AgentAction[];
  attempts: number;
  maxAttempts: number;

  // Results
  confidence?: number;
  errorMessage?: string;
}

export interface AgentInput {
  type: string;
  data: Record<string, any>;
  context?: {
    clientName?: string;
    previousExecutions?: string[];
    priority?: AgentPriority;
  };
}

export interface AgentOutput {
  success: boolean;
  result?: Record<string, any>;
  suggestedActions?: SuggestedAction[];
  warnings?: string[];
  nextSteps?: NextStep[];
}

export interface SuggestedAction {
  type: 'approve' | 'reject' | 'modify' | 'escalate' | 'create_task';
  description: string;
  confidence: number;
  params?: Record<string, any>;
}

export interface NextStep {
  agentType: AgentType;
  input: AgentInput;
  priority: AgentPriority;
  dependsOn?: string[];  // Execution IDs
}

export interface AgentAction {
  timestamp: string;
  action: string;
  details: string;
  result?: 'success' | 'failure' | 'pending';
  metadata?: Record<string, any>;
}

// Agent Queue
export interface AgentQueueItem {
  id: string;
  agentType: AgentType;
  priority: AgentPriority;
  input: AgentInput;
  createdAt: string;
  scheduledFor?: string;
  dependencies?: string[];  // Queue Item IDs
  retryCount: number;
  maxRetries: number;
}

// Agent Metrics
export interface AgentMetrics {
  agentType: AgentType;
  period: 'hour' | 'day' | 'week' | 'month';
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  escalationCount: number;
  avgProcessingTimeMs: number;
  avgConfidence: number;
  costSavingsThb: number;
  timeSavedMinutes: number;
}

// Agent Configuration
export interface AgentConfig {
  agentType: AgentType;
  settings: {
    enabled: boolean;
    confidenceThreshold: number;     // ต่ำกว่านี้จะ escalate
    autoApprovalEnabled: boolean;
    maxAutoApprovalAmount: number;   // THB
    requiresHumanReviewTypes: string[];
    workingHours?: {
      start: string;  // "08:00"
      end: string;    // "17:00"
    };
  };
}

// Document Agent Specific
export interface DocumentAgentInput extends AgentInput {
  type: 'document_analysis';
  data: {
    documentId: string;
    fileData: string;  // base64
    mimeType: string;
    clientId: string;
    clientName: string;
  };
}

export interface DocumentAgentOutput extends AgentOutput {
  result?: {
    documentType: string;
    extractedData: Record<string, any>;
    suggestedGLEntries: any[];
    taxCompliance: any;
    confidenceScore: number;
    auditFlags: any[];
  };
}

// Tax Agent Specific
export interface TaxAgentInput extends AgentInput {
  type: 'tax_calculation' | 'tax_form_preparation' | 'deadline_check';
  data: {
    clientId: string;
    taxPeriod: { month: string; year: string };
    formType?: 'PND3' | 'PND53' | 'PP30' | 'PP36';
  };
}

export interface TaxAgentOutput extends AgentOutput {
  result?: {
    calculatedTax: number;
    formData?: Record<string, any>;
    deadlines?: TaxDeadline[];
    warnings?: string[];
  };
}

export interface TaxDeadline {
  formType: string;
  dueDate: string;
  status: 'upcoming' | 'due_soon' | 'overdue';
  clientId: string;
  clientName: string;
}

// Reconciliation Agent Specific
export interface ReconciliationAgentInput extends AgentInput {
  type: 'bank_reconciliation' | 'variance_analysis';
  data: {
    clientId: string;
    bankAccountId: string;
    periodStart: string;
    periodEnd: string;
  };
}

export interface ReconciliationAgentOutput extends AgentOutput {
  result?: {
    matchedTransactions: number;
    unmatchedBank: number;
    unmatchedBooks: number;
    variance: number;
    suggestedMatches: SuggestedMatch[];
  };
}

export interface SuggestedMatch {
  bankTransactionId: string;
  documentId: string;
  confidence: number;
  matchReason: string;
}

// Closing Agent Specific
export interface ClosingAgentInput extends AgentInput {
  type: 'depreciation' | 'accruals' | 'provisions' | 'trial_balance_check';
  data: {
    clientId: string;
    period: string;  // "2024-02"
  };
}

export interface ClosingAgentOutput extends AgentOutput {
  result?: {
    journalEntries?: any[];
    depreciationAmount?: number;
    accrualAmount?: number;
    trialBalanceStatus?: 'balanced' | 'unbalanced';
    variance?: number;
    adjustments?: any[];
  };
}

// Task Assignment Agent Specific
export interface TaskAssignmentAgentInput extends AgentInput {
  type: 'assign_task' | 'rebalance_workload' | 'find_available_staff';
  data: {
    taskId?: string;
    taskCategory?: string;
    clientId?: string;
    priority?: AgentPriority;
    skillsRequired?: string[];
    estimatedHours?: number;
  };
}

export interface TaskAssignmentAgentOutput extends AgentOutput {
  result?: {
    assignedTo?: string;
    assignedToName?: string;
    reason?: string;
    alternativeStaff?: StaffSuggestion[];
    workloadImpact?: number;  // % increase
  };
}

export interface StaffSuggestion {
  staffId: string;
  staffName: string;
  currentWorkload: number;
  skillMatch: number;
  clientFamiliarity: number;
  score: number;
}

// Notification Agent Specific
export interface NotificationAgentInput extends AgentInput {
  type: 'send_notification' | 'digest' | 'deadline_reminder';
  data: {
    recipientIds?: string[];
    notificationType: string;
    templateId?: string;
    templateData?: Record<string, any>;
  };
}

export interface NotificationAgentOutput extends AgentOutput {
  result?: {
    sentCount: number;
    failedCount: number;
    notifications: NotificationResult[];
  };
}

export interface NotificationResult {
  recipientId: string;
  channel: 'email' | 'in_app' | 'sms';
  status: 'sent' | 'failed' | 'queued';
  sentAt?: string;
  error?: string;
}

// Default Agent Definitions
export const DEFAULT_AGENT_DEFINITIONS: AgentDefinition[] = [
  {
    id: 'AGENT-DOC',
    type: 'document',
    name: 'Document Analysis Agent',
    description: 'วิเคราะห์เอกสารด้วย AI และสร้าง Journal Entry',
    enabled: true,
    capabilities: [
      'document_classification',
      'data_extraction',
      'gl_mapping',
      'audit_flagging',
    ],
    maxConcurrentTasks: 10,
    timeoutMinutes: 5,
    escalationRules: [
      {
        condition: 'low_confidence',
        threshold: 70,
        escalateTo: 'human',
        notifyStaff: true,
      },
      {
        condition: 'error',
        escalateTo: 'senior',
        notifyStaff: true,
      },
    ],
  },
  {
    id: 'AGENT-TAX',
    type: 'tax',
    name: 'Tax Calculation Agent',
    description: 'คำนวณภาษีและเตรียมแบบยื่น',
    enabled: true,
    capabilities: [
      'wht_calculation',
      'vat_calculation',
      'form_preparation',
      'deadline_tracking',
    ],
    maxConcurrentTasks: 5,
    timeoutMinutes: 10,
    escalationRules: [
      {
        condition: 'low_confidence',
        threshold: 90,  // Tax needs higher confidence
        escalateTo: 'senior',
        notifyStaff: true,
      },
    ],
  },
  {
    id: 'AGENT-RECON',
    type: 'reconciliation',
    name: 'Bank Reconciliation Agent',
    description: 'จับคู่รายการธนาคารกับบัญชี',
    enabled: true,
    capabilities: [
      'transaction_matching',
      'variance_detection',
      'auto_booking',
    ],
    maxConcurrentTasks: 3,
    timeoutMinutes: 15,
    escalationRules: [
      {
        condition: 'low_confidence',
        threshold: 80,
        escalateTo: 'human',
        notifyStaff: true,
      },
    ],
  },
  {
    id: 'AGENT-CLOSE',
    type: 'closing',
    name: 'Period Closing Agent',
    description: 'คำนวณค่าเสื่อมราคา, ตั้ง accruals, ตรวจสอบ trial balance',
    enabled: true,
    capabilities: [
      'depreciation_calculation',
      'accrual_posting',
      'trial_balance_check',
    ],
    maxConcurrentTasks: 2,
    timeoutMinutes: 20,
    escalationRules: [
      {
        condition: 'error',
        escalateTo: 'manager',
        notifyStaff: true,
      },
    ],
  },
  {
    id: 'AGENT-ASSIGN',
    type: 'task_assignment',
    name: 'Task Assignment Agent',
    description: 'มอบหมายงานให้ Staff อัตโนมัติ',
    enabled: true,
    capabilities: [
      'workload_analysis',
      'skill_matching',
      'auto_assignment',
      'rebalancing',
    ],
    maxConcurrentTasks: 20,
    timeoutMinutes: 1,
    escalationRules: [
      {
        condition: 'error',
        escalateTo: 'manager',
        notifyStaff: false,
      },
    ],
  },
  {
    id: 'AGENT-NOTIFY',
    type: 'notification',
    name: 'Notification Agent',
    description: 'ส่งแจ้งเตือนและรายงานสรุป',
    enabled: true,
    capabilities: [
      'email_sending',
      'in_app_notification',
      'digest_generation',
      'deadline_reminder',
    ],
    maxConcurrentTasks: 50,
    timeoutMinutes: 2,
    escalationRules: [],
  },
];

export default {
  DEFAULT_AGENT_DEFINITIONS,
};

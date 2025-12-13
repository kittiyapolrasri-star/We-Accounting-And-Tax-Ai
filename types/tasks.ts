/**
 * Task Management System Types
 * ระบบจัดการงานสำหรับสำนักงานบัญชี (Notion-style)
 */

// Task Categories
export type TaskCategory =
  // งานบัญชี
  | 'document_review'      // ตรวจสอบเอกสาร
  | 'gl_posting'           // ลงบัญชี
  | 'bank_reconciliation'  // กระทบยอดธนาคาร
  | 'period_closing'       // ปิดงวด
  | 'tax_filing'           // ยื่นภาษี
  | 'financial_report'     // จัดทำงบ
  | 'audit_preparation'    // เตรียมงานสอบบัญชี

  // งานบริการลูกค้า
  | 'client_request'       // ตอบคำถามลูกค้า
  | 'document_collection'  // ติดตามเอกสาร
  | 'client_meeting'       // นัดประชุมลูกค้า
  | 'consultation'         // ให้คำปรึกษา

  // งานทั่วไป
  | 'general'              // งานทั่วไป
  | 'training'             // อบรม
  | 'internal_meeting'     // ประชุมภายใน
  | 'administrative';      // งานธุรการ

export type TaskStatus =
  | 'backlog'       // รอจัดสรร
  | 'todo'          // รอดำเนินการ
  | 'in_progress'   // กำลังทำ
  | 'reviewing'     // รอตรวจสอบ
  | 'completed'     // เสร็จแล้ว
  | 'cancelled'     // ยกเลิก
  | 'blocked';      // ติดขัด

export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';

export type TaskView = 'board' | 'list' | 'calendar' | 'timeline';

// Main Task Interface
export interface Task {
  id: string;

  // Basic Info
  title: string;
  description: string;
  category: TaskCategory;
  icon?: string;  // Notion-style icon
  cover?: string; // Cover image URL

  // Assignment
  assignedTo: string | null;           // Staff ID
  assignedToName?: string;
  assignedBy: string;                  // Manager/Agent ID
  assignedByName?: string;
  assignedAt: string;
  watchers?: string[];                 // Staff IDs watching this task

  // Priority & Deadline
  priority: TaskPriority;
  dueDate: string | null;
  startDate?: string;
  estimatedHours: number;

  // Context
  clientId?: string;
  clientName?: string;
  documentIds?: string[];
  parentTaskId?: string;        // สำหรับ subtasks
  projectId?: string;           // สำหรับ project grouping

  // Status
  status: TaskStatus;
  progress: number;             // 0-100
  completedAt?: string;
  completionNotes?: string;

  // AI Agent
  createdByAgent?: string;
  canBeAutomated: boolean;
  automationAttempts: number;
  lastAutomationResult?: 'success' | 'failed' | 'escalated';

  // Tracking
  timeSpent: number;            // minutes
  timeEntries: TimeEntry[];

  // Checklist (Notion-style)
  checklist: ChecklistItem[];

  // Comments & Activity
  comments: TaskComment[];
  activityLog: TaskActivity[];

  // Tags & Properties (Notion-style)
  tags: string[];
  properties: TaskProperty[];

  // Relations
  blockedBy?: string[];         // Task IDs
  blocks?: string[];            // Task IDs
  relatedTasks?: string[];

  // Metadata
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface TimeEntry {
  id: string;
  userId: string;
  userName: string;
  startTime: string;
  endTime?: string;
  duration: number;  // minutes
  description?: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
  assignedTo?: string;
  dueDate?: string;
  indent?: number;  // 0-3 for nesting
}

export interface TaskComment {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  mentions?: string[];      // User IDs mentioned
  attachments?: Attachment[];
  reactions?: Reaction[];
  createdAt: string;
  updatedAt?: string;
  isEdited: boolean;
  replyTo?: string;         // Comment ID
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'document' | 'link';
  size?: number;
}

export interface Reaction {
  emoji: string;
  users: string[];
}

export interface TaskActivity {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: TaskActivityAction;
  details: string;
  previousValue?: any;
  newValue?: any;
}

export type TaskActivityAction =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'assigned'
  | 'unassigned'
  | 'priority_changed'
  | 'due_date_changed'
  | 'comment_added'
  | 'checklist_added'
  | 'checklist_completed'
  | 'time_logged'
  | 'attachment_added'
  | 'moved_to_project'
  | 'archived'
  | 'restored';

// Notion-style Properties
export interface TaskProperty {
  id: string;
  name: string;
  type: PropertyType;
  value: any;
  options?: PropertyOption[];  // สำหรับ select/multi_select
}

export type PropertyType =
  | 'text'
  | 'number'
  | 'select'
  | 'multi_select'
  | 'date'
  | 'person'
  | 'checkbox'
  | 'url'
  | 'email'
  | 'phone'
  | 'formula'
  | 'relation'
  | 'rollup';

export interface PropertyOption {
  id: string;
  name: string;
  color: string;
}

// Project (Notion-style Database)
export interface TaskProject {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  cover?: string;
  color: string;

  // Views
  defaultView: TaskView;
  availableViews: TaskView[];

  // Properties Schema
  propertySchema: PropertySchema[];

  // Filters & Sorting
  defaultFilters?: TaskFilter[];
  defaultSort?: TaskSort;

  // Access
  ownerId: string;
  members: ProjectMember[];
  isPublic: boolean;

  // Metadata
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface PropertySchema {
  id: string;
  name: string;
  type: PropertyType;
  required: boolean;
  options?: PropertyOption[];
  defaultValue?: any;
}

export interface ProjectMember {
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  addedAt: string;
}

export interface TaskFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'is_empty' | 'is_not_empty' | 'greater_than' | 'less_than';
  value: any;
}

export interface TaskSort {
  field: string;
  direction: 'asc' | 'desc';
}

// Staff Workload
export interface StaffWorkload {
  staffId: string;
  staffName: string;
  staffAvatar?: string;
  role: string;

  // Current Tasks
  totalTasks: number;
  tasksByStatus: Record<TaskStatus, number>;
  tasksByPriority: Record<TaskPriority, number>;

  // Capacity
  maxCapacity: number;
  currentLoad: number;
  utilizationPercent: number;
  availableHours: number;

  // Performance
  completedThisWeek: number;
  completedThisMonth: number;
  avgCompletionTime: number;  // hours
  slaCompliance: number;      // percentage
  qualityScore: number;       // 0-100

  // Skills & Specialization
  skills: string[];
  preferredCategories: TaskCategory[];
  clientExpertise: string[];  // Client IDs

  // Current Status
  isAvailable: boolean;
  statusMessage?: string;
  lastActiveAt: string;

  // Upcoming
  upcomingDeadlines: number;
  overdueItems: number;
}

// Task Templates (Notion-style)
export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  category: TaskCategory;
  icon?: string;

  // Template Content
  defaultTitle: string;
  defaultDescription: string;
  defaultChecklist: ChecklistItem[];
  defaultProperties: TaskProperty[];
  defaultTags: string[];

  estimatedHours: number;
  autoAssignment?: {
    strategy: 'round_robin' | 'least_loaded' | 'skill_match';
    skillsRequired?: string[];
  };

  // Recurring
  isRecurring: boolean;
  recurrenceRule?: RecurrenceRule;

  createdBy: string;
  createdAt: string;
  usageCount: number;
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  daysOfWeek?: number[];   // 0-6 for weekly
  dayOfMonth?: number;     // 1-31 for monthly
  endDate?: string;
  occurrences?: number;
}

// Kanban Board Configuration
export interface KanbanBoard {
  id: string;
  projectId?: string;
  name: string;

  columns: KanbanColumn[];

  // WIP Limits
  wipLimitsEnabled: boolean;

  // Swimlanes
  swimlaneField?: string;  // e.g., 'priority', 'assignedTo', 'category'

  settings: {
    showCompletedTasks: boolean;
    autoArchiveDays?: number;
    defaultAssignee?: string;
  };
}

export interface KanbanColumn {
  id: string;
  status: TaskStatus;
  name: string;
  color: string;
  wipLimit?: number;
  autoMoveRules?: AutoMoveRule[];
}

export interface AutoMoveRule {
  condition: 'all_checklist_done' | 'time_elapsed' | 'approved';
  targetColumn: string;
  params?: Record<string, any>;
}

// Dashboard Widgets
export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  config: Record<string, any>;
}

export type WidgetType =
  | 'task_summary'
  | 'workload_chart'
  | 'deadline_calendar'
  | 'recent_activity'
  | 'team_status'
  | 'sla_metrics'
  | 'agent_status'
  | 'quick_actions';

// Task Category Labels (Thai)
export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  document_review: 'ตรวจสอบเอกสาร',
  gl_posting: 'ลงบัญชี',
  bank_reconciliation: 'กระทบยอดธนาคาร',
  period_closing: 'ปิดงวด',
  tax_filing: 'ยื่นภาษี',
  financial_report: 'จัดทำงบการเงิน',
  audit_preparation: 'เตรียมงานสอบบัญชี',
  client_request: 'ตอบคำถามลูกค้า',
  document_collection: 'ติดตามเอกสาร',
  client_meeting: 'นัดประชุมลูกค้า',
  consultation: 'ให้คำปรึกษา',
  general: 'งานทั่วไป',
  training: 'อบรม',
  internal_meeting: 'ประชุมภายใน',
  administrative: 'งานธุรการ',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: 'รอจัดสรร',
  todo: 'รอดำเนินการ',
  in_progress: 'กำลังทำ',
  reviewing: 'รอตรวจสอบ',
  completed: 'เสร็จแล้ว',
  cancelled: 'ยกเลิก',
  blocked: 'ติดขัด',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: 'เร่งด่วนมาก',
  high: 'สำคัญ',
  medium: 'ปานกลาง',
  low: 'ไม่เร่งด่วน',
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  backlog: '#6B7280',    // gray
  todo: '#3B82F6',       // blue
  in_progress: '#F59E0B', // amber
  reviewing: '#8B5CF6',   // purple
  completed: '#10B981',   // green
  cancelled: '#EF4444',   // red
  blocked: '#DC2626',     // dark red
};

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent: '#DC2626',
  high: '#F59E0B',
  medium: '#3B82F6',
  low: '#6B7280',
};

// Default Property Options
export const DEFAULT_TAG_COLORS = [
  { id: 'red', name: 'แดง', color: '#FEE2E2' },
  { id: 'orange', name: 'ส้ม', color: '#FFEDD5' },
  { id: 'yellow', name: 'เหลือง', color: '#FEF3C7' },
  { id: 'green', name: 'เขียว', color: '#D1FAE5' },
  { id: 'blue', name: 'น้ำเงิน', color: '#DBEAFE' },
  { id: 'purple', name: 'ม่วง', color: '#EDE9FE' },
  { id: 'pink', name: 'ชมพู', color: '#FCE7F3' },
  { id: 'gray', name: 'เทา', color: '#F3F4F6' },
];

export default {
  TASK_CATEGORY_LABELS,
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_COLORS,
  TASK_PRIORITY_COLORS,
  DEFAULT_TAG_COLORS,
};

/**
 * Task Management Service
 * ระบบจัดการงานสำหรับสำนักงานบัญชี
 */

import {
  Task,
  TaskStatus,
  TaskPriority,
  TaskCategory,
  TaskComment,
  ChecklistItem,
  TaskActivity,
  TaskTemplate,
  StaffWorkload,
  TaskFilter,
  TaskSort,
  TimeEntry,
  TASK_STATUS_LABELS,
} from '../types/tasks';
import { Staff } from '../types';

// Generate unique ID
const generateId = (prefix: string = 'TASK'): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Task CRUD Operations
export const createTask = (
  data: Partial<Task>,
  createdBy: { id: string; name: string }
): Task => {
  const now = new Date().toISOString();

  const task: Task = {
    id: generateId('TASK'),
    title: data.title || 'งานใหม่',
    description: data.description || '',
    category: data.category || 'general',
    icon: data.icon || '📋',

    assignedTo: data.assignedTo || null,
    assignedToName: data.assignedToName,
    assignedBy: createdBy.id,
    assignedByName: createdBy.name,
    assignedAt: now,
    watchers: data.watchers || [],

    priority: data.priority || 'medium',
    dueDate: data.dueDate || null,
    startDate: data.startDate,
    estimatedHours: data.estimatedHours || 1,

    clientId: data.clientId,
    clientName: data.clientName,
    documentIds: data.documentIds || [],
    parentTaskId: data.parentTaskId,
    projectId: data.projectId,

    status: data.status || 'todo',
    progress: 0,

    createdByAgent: data.createdByAgent,
    canBeAutomated: data.canBeAutomated || false,
    automationAttempts: 0,

    timeSpent: 0,
    timeEntries: [],
    checklist: data.checklist || [],
    comments: [],
    activityLog: [
      {
        id: generateId('ACT'),
        timestamp: now,
        userId: createdBy.id,
        userName: createdBy.name,
        action: 'created',
        details: 'สร้างงานใหม่',
      },
    ],

    tags: data.tags || [],
    properties: data.properties || [],
    blockedBy: [],
    blocks: [],
    relatedTasks: [],

    createdAt: now,
    updatedAt: now,
  };

  return task;
};

export const updateTask = (
  task: Task,
  updates: Partial<Task>,
  updatedBy: { id: string; name: string }
): Task => {
  const now = new Date().toISOString();
  const activities: TaskActivity[] = [];

  // Track status change
  if (updates.status && updates.status !== task.status) {
    activities.push({
      id: generateId('ACT'),
      timestamp: now,
      userId: updatedBy.id,
      userName: updatedBy.name,
      action: 'status_changed',
      details: `เปลี่ยนสถานะจาก "${TASK_STATUS_LABELS[task.status]}" เป็น "${TASK_STATUS_LABELS[updates.status]}"`,
      previousValue: task.status,
      newValue: updates.status,
    });
  }

  // Track assignment change
  if (updates.assignedTo !== undefined && updates.assignedTo !== task.assignedTo) {
    activities.push({
      id: generateId('ACT'),
      timestamp: now,
      userId: updatedBy.id,
      userName: updatedBy.name,
      action: updates.assignedTo ? 'assigned' : 'unassigned',
      details: updates.assignedTo
        ? `มอบหมายงานให้ ${updates.assignedToName || 'ผู้รับผิดชอบใหม่'}`
        : 'ยกเลิกการมอบหมายงาน',
      previousValue: task.assignedTo,
      newValue: updates.assignedTo,
    });
  }

  // Track priority change
  if (updates.priority && updates.priority !== task.priority) {
    activities.push({
      id: generateId('ACT'),
      timestamp: now,
      userId: updatedBy.id,
      userName: updatedBy.name,
      action: 'priority_changed',
      details: `เปลี่ยนความสำคัญ`,
      previousValue: task.priority,
      newValue: updates.priority,
    });
  }

  // Track due date change
  if (updates.dueDate !== undefined && updates.dueDate !== task.dueDate) {
    activities.push({
      id: generateId('ACT'),
      timestamp: now,
      userId: updatedBy.id,
      userName: updatedBy.name,
      action: 'due_date_changed',
      details: `เปลี่ยนวันกำหนดส่ง`,
      previousValue: task.dueDate,
      newValue: updates.dueDate,
    });
  }

  // General update activity if no specific changes tracked
  if (activities.length === 0) {
    activities.push({
      id: generateId('ACT'),
      timestamp: now,
      userId: updatedBy.id,
      userName: updatedBy.name,
      action: 'updated',
      details: 'อัปเดตรายละเอียดงาน',
    });
  }

  return {
    ...task,
    ...updates,
    activityLog: [...task.activityLog, ...activities],
    updatedAt: now,
    completedAt: updates.status === 'completed' ? now : task.completedAt,
  };
};

// Checklist Operations
export const addChecklistItem = (
  task: Task,
  text: string,
  addedBy: { id: string; name: string }
): Task => {
  const now = new Date().toISOString();
  const newItem: ChecklistItem = {
    id: generateId('CHK'),
    text,
    completed: false,
    indent: 0,
  };

  return {
    ...task,
    checklist: [...task.checklist, newItem],
    activityLog: [
      ...task.activityLog,
      {
        id: generateId('ACT'),
        timestamp: now,
        userId: addedBy.id,
        userName: addedBy.name,
        action: 'checklist_added',
        details: `เพิ่มรายการ: "${text}"`,
      },
    ],
    updatedAt: now,
  };
};

export const toggleChecklistItem = (
  task: Task,
  itemId: string,
  toggledBy: { id: string; name: string }
): Task => {
  const now = new Date().toISOString();
  let itemText = '';

  const updatedChecklist = task.checklist.map((item) => {
    if (item.id === itemId) {
      itemText = item.text;
      return {
        ...item,
        completed: !item.completed,
        completedAt: !item.completed ? now : undefined,
        completedBy: !item.completed ? toggledBy.id : undefined,
      };
    }
    return item;
  });

  // Calculate progress
  const completedCount = updatedChecklist.filter((i) => i.completed).length;
  const progress = updatedChecklist.length > 0
    ? Math.round((completedCount / updatedChecklist.length) * 100)
    : 0;

  return {
    ...task,
    checklist: updatedChecklist,
    progress,
    activityLog: [
      ...task.activityLog,
      {
        id: generateId('ACT'),
        timestamp: now,
        userId: toggledBy.id,
        userName: toggledBy.name,
        action: 'checklist_completed',
        details: `${task.checklist.find(i => i.id === itemId)?.completed ? 'ยกเลิก' : 'ทำ'}รายการ: "${itemText}"`,
      },
    ],
    updatedAt: now,
  };
};

// Comment Operations
export const addComment = (
  task: Task,
  content: string,
  author: { id: string; name: string; avatar?: string },
  replyTo?: string
): Task => {
  const now = new Date().toISOString();
  const newComment: TaskComment = {
    id: generateId('CMT'),
    userId: author.id,
    userName: author.name,
    userAvatar: author.avatar,
    content,
    mentions: extractMentions(content),
    attachments: [],
    reactions: [],
    createdAt: now,
    isEdited: false,
    replyTo,
  };

  return {
    ...task,
    comments: [...task.comments, newComment],
    activityLog: [
      ...task.activityLog,
      {
        id: generateId('ACT'),
        timestamp: now,
        userId: author.id,
        userName: author.name,
        action: 'comment_added',
        details: 'เพิ่มความคิดเห็น',
      },
    ],
    updatedAt: now,
  };
};

const extractMentions = (content: string): string[] => {
  const mentions = content.match(/@\[([^\]]+)\]\(([^)]+)\)/g) || [];
  return mentions.map((m) => m.match(/\(([^)]+)\)/)?.[1] || '');
};

// Time Tracking
export const logTime = (
  task: Task,
  duration: number,
  description: string,
  user: { id: string; name: string }
): Task => {
  const now = new Date().toISOString();
  const timeEntry: TimeEntry = {
    id: generateId('TIME'),
    userId: user.id,
    userName: user.name,
    startTime: now,
    duration,
    description,
  };

  return {
    ...task,
    timeSpent: task.timeSpent + duration,
    timeEntries: [...task.timeEntries, timeEntry],
    activityLog: [
      ...task.activityLog,
      {
        id: generateId('ACT'),
        timestamp: now,
        userId: user.id,
        userName: user.name,
        action: 'time_logged',
        details: `บันทึกเวลา ${duration} นาที`,
      },
    ],
    updatedAt: now,
  };
};

// Task Filtering & Sorting
export const filterTasks = (tasks: Task[], filters: TaskFilter[]): Task[] => {
  return tasks.filter((task) => {
    return filters.every((filter) => {
      const value = getFieldValue(task, filter.field);

      switch (filter.operator) {
        case 'equals':
          return value === filter.value;
        case 'not_equals':
          return value !== filter.value;
        case 'contains':
          return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
        case 'not_contains':
          return !String(value).toLowerCase().includes(String(filter.value).toLowerCase());
        case 'is_empty':
          return !value || (Array.isArray(value) && value.length === 0);
        case 'is_not_empty':
          return value && (!Array.isArray(value) || value.length > 0);
        case 'greater_than':
          return Number(value) > Number(filter.value);
        case 'less_than':
          return Number(value) < Number(filter.value);
        default:
          return true;
      }
    });
  });
};

export const sortTasks = (tasks: Task[], sort: TaskSort): Task[] => {
  return [...tasks].sort((a, b) => {
    const aValue = getFieldValue(a, sort.field);
    const bValue = getFieldValue(b, sort.field);

    let comparison = 0;
    if (aValue < bValue) comparison = -1;
    if (aValue > bValue) comparison = 1;

    return sort.direction === 'asc' ? comparison : -comparison;
  });
};

const getFieldValue = (task: Task, field: string): any => {
  const fieldMap: Record<string, any> = {
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    assignedTo: task.assignedTo,
    category: task.category,
    progress: task.progress,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
  return fieldMap[field] ?? task[field as keyof Task];
};

// Group tasks by field (for Kanban)
export const groupTasksByStatus = (tasks: Task[]): Record<TaskStatus, Task[]> => {
  const groups: Record<TaskStatus, Task[]> = {
    backlog: [],
    todo: [],
    in_progress: [],
    reviewing: [],
    completed: [],
    cancelled: [],
    blocked: [],
  };

  tasks.forEach((task) => {
    if (groups[task.status]) {
      groups[task.status].push(task);
    }
  });

  return groups;
};

export const groupTasksByAssignee = (tasks: Task[]): Record<string, Task[]> => {
  const groups: Record<string, Task[]> = { unassigned: [] };

  tasks.forEach((task) => {
    const key = task.assignedTo || 'unassigned';
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(task);
  });

  return groups;
};

// Staff Workload Calculation
export const calculateStaffWorkload = (
  staff: Staff,
  tasks: Task[],
  allTasks: Task[]
): StaffWorkload => {
  const staffTasks = tasks.filter((t) => t.assignedTo === staff.id);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Tasks by status
  const tasksByStatus: Record<TaskStatus, number> = {
    backlog: 0,
    todo: 0,
    in_progress: 0,
    reviewing: 0,
    completed: 0,
    cancelled: 0,
    blocked: 0,
  };

  // Tasks by priority
  const tasksByPriority: Record<TaskPriority, number> = {
    urgent: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  let totalEstimatedHours = 0;
  let completedThisWeek = 0;
  let completedThisMonth = 0;
  let upcomingDeadlines = 0;
  let overdueItems = 0;

  staffTasks.forEach((task) => {
    tasksByStatus[task.status]++;
    tasksByPriority[task.priority]++;

    if (task.status !== 'completed' && task.status !== 'cancelled') {
      totalEstimatedHours += task.estimatedHours;

      if (task.dueDate) {
        const dueDate = new Date(task.dueDate);
        if (dueDate < now) {
          overdueItems++;
        } else if (dueDate.getTime() - now.getTime() < 3 * 24 * 60 * 60 * 1000) {
          upcomingDeadlines++;
        }
      }
    }

    if (task.status === 'completed' && task.completedAt) {
      const completedDate = new Date(task.completedAt);
      if (completedDate >= weekAgo) completedThisWeek++;
      if (completedDate >= monthAgo) completedThisMonth++;
    }
  });

  const activeTasks = staffTasks.filter(
    (t) => t.status !== 'completed' && t.status !== 'cancelled'
  ).length;

  // Calculate capacity (assume 8 hours/day, 40 hours/week)
  const maxCapacity = 15; // max tasks
  const utilizationPercent = Math.min(100, Math.round((activeTasks / maxCapacity) * 100));

  // Calculate average completion time
  const completedTasks = staffTasks.filter(
    (t) => t.status === 'completed' && t.completedAt
  );
  let totalCompletionTime = 0;
  completedTasks.forEach((task) => {
    const created = new Date(task.createdAt);
    const completed = new Date(task.completedAt!);
    totalCompletionTime += (completed.getTime() - created.getTime()) / (1000 * 60 * 60);
  });
  const avgCompletionTime =
    completedTasks.length > 0 ? totalCompletionTime / completedTasks.length : 0;

  return {
    staffId: staff.id,
    staffName: staff.name,
    staffAvatar: staff.avatar_url,
    role: staff.role,

    totalTasks: staffTasks.length,
    tasksByStatus,
    tasksByPriority,

    maxCapacity,
    currentLoad: activeTasks,
    utilizationPercent,
    availableHours: Math.max(0, 40 - totalEstimatedHours),

    completedThisWeek,
    completedThisMonth,
    avgCompletionTime: Math.round(avgCompletionTime * 10) / 10,
    slaCompliance: 85, // TODO: Calculate from actual SLA data
    qualityScore: 90, // TODO: Calculate from review scores

    skills: [], // TODO: Add to Staff type
    preferredCategories: [],
    clientExpertise: [],

    isAvailable: utilizationPercent < 80,
    lastActiveAt: new Date().toISOString(),

    upcomingDeadlines,
    overdueItems,
  };
};

// Task Assignment Logic
export const findBestAssignee = (
  task: Task,
  staffList: Staff[],
  allTasks: Task[]
): { staffId: string; score: number; reason: string } | null => {
  if (staffList.length === 0) return null;

  const scores: Array<{ staff: Staff; score: number; reasons: string[] }> = [];

  staffList.forEach((staff) => {
    let score = 100;
    const reasons: string[] = [];

    // Calculate workload
    const workload = calculateStaffWorkload(staff, allTasks, allTasks);

    // Penalize for high workload
    if (workload.utilizationPercent > 80) {
      score -= 30;
      reasons.push('งานเยอะ');
    } else if (workload.utilizationPercent > 60) {
      score -= 15;
    } else {
      reasons.push('งานไม่เยอะ');
    }

    // Penalize for overdue items
    if (workload.overdueItems > 0) {
      score -= workload.overdueItems * 10;
      reasons.push(`มีงานเลย deadline ${workload.overdueItems} งาน`);
    }

    // Bonus for client familiarity
    if (task.clientId && workload.clientExpertise.includes(task.clientId)) {
      score += 20;
      reasons.push('คุ้นเคยลูกค้า');
    }

    // Role matching
    if (task.category === 'period_closing' || task.category === 'tax_filing') {
      if (staff.role === 'Senior Accountant' || staff.role === 'Manager') {
        score += 15;
        reasons.push('ตำแหน่งเหมาะสม');
      }
    }

    scores.push({ staff, score, reasons });
  });

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  const best = scores[0];
  if (best && best.score > 0) {
    return {
      staffId: best.staff.id,
      score: best.score,
      reason: best.reasons.join(', '),
    };
  }

  return null;
};

// Create task from template
export const createTaskFromTemplate = (
  template: TaskTemplate,
  overrides: Partial<Task>,
  createdBy: { id: string; name: string }
): Task => {
  return createTask(
    {
      title: template.defaultTitle,
      description: template.defaultDescription,
      category: template.category,
      icon: template.icon,
      checklist: template.defaultChecklist.map((item) => ({
        ...item,
        id: generateId('CHK'),
        completed: false,
      })),
      properties: template.defaultProperties,
      tags: template.defaultTags,
      estimatedHours: template.estimatedHours,
      ...overrides,
    },
    createdBy
  );
};

// Task Statistics
export const getTaskStatistics = (
  tasks: Task[],
  period?: { start: string; end: string }
): {
  total: number;
  completed: number;
  inProgress: number;
  overdue: number;
  completionRate: number;
  avgCompletionTime: number;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
} => {
  let filteredTasks = tasks;

  if (period) {
    filteredTasks = tasks.filter((t) => {
      const created = new Date(t.createdAt);
      return created >= new Date(period.start) && created <= new Date(period.end);
    });
  }

  const now = new Date();
  const completed = filteredTasks.filter((t) => t.status === 'completed').length;
  const inProgress = filteredTasks.filter((t) => t.status === 'in_progress').length;
  const overdue = filteredTasks.filter((t) => {
    if (!t.dueDate || t.status === 'completed' || t.status === 'cancelled') return false;
    return new Date(t.dueDate) < now;
  }).length;

  const byCategory: Record<string, number> = {};
  const byPriority: Record<string, number> = {};

  filteredTasks.forEach((task) => {
    byCategory[task.category] = (byCategory[task.category] || 0) + 1;
    byPriority[task.priority] = (byPriority[task.priority] || 0) + 1;
  });

  // Calculate average completion time
  const completedTasks = filteredTasks.filter(
    (t) => t.status === 'completed' && t.completedAt
  );
  let totalTime = 0;
  completedTasks.forEach((task) => {
    const created = new Date(task.createdAt);
    const completedAt = new Date(task.completedAt!);
    totalTime += (completedAt.getTime() - created.getTime()) / (1000 * 60 * 60);
  });

  return {
    total: filteredTasks.length,
    completed,
    inProgress,
    overdue,
    completionRate: filteredTasks.length > 0 ? Math.round((completed / filteredTasks.length) * 100) : 0,
    avgCompletionTime: completedTasks.length > 0 ? Math.round((totalTime / completedTasks.length) * 10) / 10 : 0,
    byCategory,
    byPriority,
  };
};

export default {
  createTask,
  updateTask,
  addChecklistItem,
  toggleChecklistItem,
  addComment,
  logTime,
  filterTasks,
  sortTasks,
  groupTasksByStatus,
  groupTasksByAssignee,
  calculateStaffWorkload,
  findBestAssignee,
  createTaskFromTemplate,
  getTaskStatistics,
};

/**
 * Agent Orchestrator Service
 * ควบคุมและประสานงาน AI Agents ทั้งหมด
 */

import {
  AgentType,
  AgentStatus,
  AgentExecution,
  AgentInput,
  AgentOutput,
  AgentDefinition,
  AgentQueueItem,
  AgentMetrics,
  AgentPriority,
  AgentAction,
  DEFAULT_AGENT_DEFINITIONS,
} from '../../types/agents';
import { Task } from '../../types/tasks';
import { DocumentRecord, Staff, Client } from '../../types';

// Generate unique ID
const generateId = (prefix: string = 'EXEC'): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Agent Registry
class AgentRegistry {
  private definitions: Map<AgentType, AgentDefinition> = new Map();
  private handlers: Map<AgentType, AgentHandler> = new Map();

  constructor() {
    // Register default definitions
    DEFAULT_AGENT_DEFINITIONS.forEach((def) => {
      this.definitions.set(def.type, def);
    });
  }

  registerDefinition(definition: AgentDefinition): void {
    this.definitions.set(definition.type, definition);
  }

  registerHandler(type: AgentType, handler: AgentHandler): void {
    this.handlers.set(type, handler);
  }

  getDefinition(type: AgentType): AgentDefinition | undefined {
    return this.definitions.get(type);
  }

  getHandler(type: AgentType): AgentHandler | undefined {
    return this.handlers.get(type);
  }

  getAllDefinitions(): AgentDefinition[] {
    return Array.from(this.definitions.values());
  }
}

// Agent Handler Interface
export interface AgentHandler {
  execute(input: AgentInput, context: AgentContext): Promise<AgentOutput>;
  canHandle(input: AgentInput): boolean;
  getRequiredPermissions(): string[];
}

// Agent Context
export interface AgentContext {
  executionId: string;
  userId?: string;
  clientId?: string;
  documents?: DocumentRecord[];
  tasks?: Task[];
  staff?: Staff[];
  clients?: Client[];
  addLog: (action: string, details: string, result?: 'success' | 'failure' | 'pending') => void;
}

// Execution Queue
class ExecutionQueue {
  private queue: AgentQueueItem[] = [];
  private processing: Set<string> = new Set();

  enqueue(item: AgentQueueItem): void {
    this.queue.push(item);
    this.sortByPriority();
  }

  dequeue(): AgentQueueItem | undefined {
    const item = this.queue.find((i) => !this.processing.has(i.id));
    if (item) {
      this.processing.add(item.id);
    }
    return item;
  }

  complete(itemId: string): void {
    this.processing.delete(itemId);
    this.queue = this.queue.filter((i) => i.id !== itemId);
  }

  private sortByPriority(): void {
    const priorityOrder: Record<AgentPriority, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    this.queue.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getProcessingCount(): number {
    return this.processing.size;
  }
}

// Agent Orchestrator
export class AgentOrchestrator {
  private registry: AgentRegistry;
  private queue: ExecutionQueue;
  private executions: Map<string, AgentExecution> = new Map();
  private metrics: Map<AgentType, AgentMetrics> = new Map();
  private isRunning: boolean = false;

  constructor() {
    this.registry = new AgentRegistry();
    this.queue = new ExecutionQueue();
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    const agentTypes: AgentType[] = [
      'orchestrator',
      'document',
      'tax',
      'reconciliation',
      'closing',
      'task_assignment',
      'notification',
    ];

    agentTypes.forEach((type) => {
      this.metrics.set(type, {
        agentType: type,
        period: 'day',
        totalExecutions: 0,
        successCount: 0,
        failureCount: 0,
        escalationCount: 0,
        avgProcessingTimeMs: 0,
        avgConfidence: 0,
        costSavingsThb: 0,
        timeSavedMinutes: 0,
      });
    });
  }

  // Register agent handler
  registerAgent(type: AgentType, handler: AgentHandler): void {
    this.registry.registerHandler(type, handler);
  }

  // Submit task for agent processing
  async submitTask(
    agentType: AgentType,
    input: AgentInput,
    priority: AgentPriority = 'medium',
    userId?: string
  ): Promise<string> {
    const definition = this.registry.getDefinition(agentType);
    if (!definition || !definition.enabled) {
      throw new Error(`Agent ${agentType} is not available or disabled`);
    }

    const queueItem: AgentQueueItem = {
      id: generateId('QUEUE'),
      agentType,
      priority,
      input,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3,
    };

    this.queue.enqueue(queueItem);

    // Create execution record
    const execution = this.createExecution(agentType, input, definition);
    this.executions.set(execution.id, execution);

    // Process immediately if not running in batch mode
    if (!this.isRunning) {
      this.processQueue();
    }

    return execution.id;
  }

  private createExecution(
    agentType: AgentType,
    input: AgentInput,
    definition: AgentDefinition
  ): AgentExecution {
    const now = new Date();
    const timeout = new Date(now.getTime() + definition.timeoutMinutes * 60 * 1000);

    return {
      id: generateId('EXEC'),
      agentType,
      status: 'idle',
      input,
      startedAt: now.toISOString(),
      timeoutAt: timeout.toISOString(),
      humanReviewRequired: false,
      auditLog: [],
      attempts: 0,
      maxAttempts: 3,
    };
  }

  // Process queue
  private async processQueue(): Promise<void> {
    this.isRunning = true;

    while (this.queue.getQueueLength() > 0) {
      const item = this.queue.dequeue();
      if (!item) break;

      try {
        await this.executeAgent(item);
      } catch (error) {
        console.error(`Agent execution failed: ${error}`);
      } finally {
        this.queue.complete(item.id);
      }
    }

    this.isRunning = false;
  }

  // Execute single agent
  private async executeAgent(item: AgentQueueItem): Promise<AgentOutput> {
    const handler = this.registry.getHandler(item.agentType);
    const definition = this.registry.getDefinition(item.agentType);

    if (!handler || !definition) {
      throw new Error(`No handler found for agent type: ${item.agentType}`);
    }

    const execution = Array.from(this.executions.values()).find(
      (e) => e.agentType === item.agentType && e.status === 'idle'
    );

    if (!execution) {
      throw new Error('Execution record not found');
    }

    const auditLog: AgentAction[] = [];
    const context: AgentContext = {
      executionId: execution.id,
      clientId: item.input.context?.clientName,
      addLog: (action, details, result) => {
        auditLog.push({
          timestamp: new Date().toISOString(),
          action,
          details,
          result,
        });
      },
    };

    // Update status to processing
    execution.status = 'processing';
    execution.attempts++;
    execution.auditLog = auditLog;

    context.addLog('start', `เริ่มประมวลผล ${definition.name}`, 'pending');

    const startTime = Date.now();

    try {
      const output = await handler.execute(item.input, context);

      const processingTime = Date.now() - startTime;

      // Update execution
      execution.status = 'completed';
      execution.completedAt = new Date().toISOString();
      execution.output = output;
      execution.confidence = output.result?.confidenceScore;

      // Check if human review required
      const confidenceThreshold = definition.escalationRules.find(
        (r) => r.condition === 'low_confidence'
      )?.threshold || 70;

      if (output.result?.confidenceScore && output.result.confidenceScore < confidenceThreshold) {
        execution.humanReviewRequired = true;
        execution.status = 'escalated';
        execution.escalationReason = `Confidence ${output.result.confidenceScore}% ต่ำกว่า threshold ${confidenceThreshold}%`;
        context.addLog('escalate', execution.escalationReason, 'pending');
      }

      context.addLog('complete', `ประมวลผลเสร็จใน ${processingTime}ms`, 'success');

      // Update metrics
      this.updateMetrics(item.agentType, true, processingTime, output.result?.confidenceScore);

      return output;
    } catch (error) {
      execution.status = 'failed';
      execution.errorMessage = String(error);
      context.addLog('error', String(error), 'failure');

      // Check retry
      if (item.retryCount < item.maxRetries) {
        item.retryCount++;
        this.queue.enqueue(item);
        context.addLog('retry', `Retry attempt ${item.retryCount}/${item.maxRetries}`, 'pending');
      } else {
        // Escalate to human
        execution.humanReviewRequired = true;
        execution.status = 'escalated';
        execution.escalationReason = `Failed after ${item.maxRetries} attempts: ${error}`;
      }

      this.updateMetrics(item.agentType, false, Date.now() - startTime);

      throw error;
    }
  }

  private updateMetrics(
    agentType: AgentType,
    success: boolean,
    processingTimeMs: number,
    confidence?: number
  ): void {
    const metrics = this.metrics.get(agentType);
    if (!metrics) return;

    metrics.totalExecutions++;
    if (success) {
      metrics.successCount++;
      // Estimate savings: 5 minutes saved per successful automation
      metrics.timeSavedMinutes += 5;
      metrics.costSavingsThb += 250; // 50 THB/minute × 5 minutes
    } else {
      metrics.failureCount++;
    }

    // Update average processing time
    metrics.avgProcessingTimeMs =
      (metrics.avgProcessingTimeMs * (metrics.totalExecutions - 1) + processingTimeMs) /
      metrics.totalExecutions;

    // Update average confidence
    if (confidence !== undefined) {
      metrics.avgConfidence =
        (metrics.avgConfidence * (metrics.successCount - 1) + confidence) / metrics.successCount;
    }

    this.metrics.set(agentType, metrics);
  }

  // Get execution status
  getExecution(executionId: string): AgentExecution | undefined {
    return this.executions.get(executionId);
  }

  // Get all executions for monitoring
  getAllExecutions(filters?: {
    agentType?: AgentType;
    status?: AgentStatus;
    limit?: number;
  }): AgentExecution[] {
    let executions = Array.from(this.executions.values());

    if (filters?.agentType) {
      executions = executions.filter((e) => e.agentType === filters.agentType);
    }
    if (filters?.status) {
      executions = executions.filter((e) => e.status === filters.status);
    }

    // Sort by startedAt descending
    executions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    if (filters?.limit) {
      executions = executions.slice(0, filters.limit);
    }

    return executions;
  }

  // Get metrics
  getMetrics(agentType?: AgentType): AgentMetrics | AgentMetrics[] {
    if (agentType) {
      return this.metrics.get(agentType)!;
    }
    return Array.from(this.metrics.values());
  }

  // Get agent definitions
  getAgentDefinitions(): AgentDefinition[] {
    return this.registry.getAllDefinitions();
  }

  // Enable/disable agent
  setAgentEnabled(agentType: AgentType, enabled: boolean): void {
    const definition = this.registry.getDefinition(agentType);
    if (definition) {
      definition.enabled = enabled;
    }
  }

  // Get queue status
  getQueueStatus(): {
    queueLength: number;
    processingCount: number;
    isRunning: boolean;
  } {
    return {
      queueLength: this.queue.getQueueLength(),
      processingCount: this.queue.getProcessingCount(),
      isRunning: this.isRunning,
    };
  }

  // Escalate execution to human
  escalateToHuman(
    executionId: string,
    staffId: string,
    reason: string
  ): void {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error('Execution not found');
    }

    execution.status = 'escalated';
    execution.humanReviewRequired = true;
    execution.escalatedTo = staffId;
    execution.escalationReason = reason;
    execution.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'escalate_to_human',
      details: `Escalated to ${staffId}: ${reason}`,
      result: 'pending',
    });

    const metrics = this.metrics.get(execution.agentType);
    if (metrics) {
      metrics.escalationCount++;
    }
  }

  // Complete human review
  completeHumanReview(
    executionId: string,
    reviewerId: string,
    approved: boolean,
    notes?: string
  ): void {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error('Execution not found');
    }

    execution.status = 'completed';
    execution.completedAt = new Date().toISOString();
    execution.humanReviewRequired = false;
    execution.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'human_review_completed',
      details: `Reviewed by ${reviewerId}: ${approved ? 'Approved' : 'Rejected'}${notes ? ` - ${notes}` : ''}`,
      result: approved ? 'success' : 'failure',
    });
  }
}

// Default Agent Handlers

// Document Agent Handler
export const documentAgentHandler: AgentHandler = {
  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    context.addLog('analyze', 'กำลังวิเคราะห์เอกสาร', 'pending');

    // Simulate document analysis (in production, this would call Gemini API)
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const confidence = Math.floor(Math.random() * 30) + 70; // 70-100

    context.addLog('extract', `สกัดข้อมูลเสร็จ (confidence: ${confidence}%)`, 'success');

    return {
      success: true,
      result: {
        documentType: 'Tax Invoice',
        confidenceScore: confidence,
        extractedData: {},
        suggestedGLEntries: [],
      },
      suggestedActions: [
        {
          type: confidence >= 90 ? 'approve' : 'modify',
          description: confidence >= 90 ? 'อนุมัติอัตโนมัติ' : 'ตรวจสอบและแก้ไข',
          confidence,
        },
      ],
    };
  },

  canHandle(input: AgentInput): boolean {
    return input.type === 'document_analysis';
  },

  getRequiredPermissions(): string[] {
    return ['document:read', 'document:analyze'];
  },
};

// Task Assignment Agent Handler
export const taskAssignmentAgentHandler: AgentHandler = {
  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    context.addLog('analyze_workload', 'วิเคราะห์ workload ของทีม', 'pending');

    // Get staff with lowest workload
    const staff = context.staff || [];

    if (staff.length === 0) {
      return {
        success: false,
        warnings: ['ไม่พบ staff ที่ว่าง'],
      };
    }

    // Find staff with lowest active tasks
    const sortedStaff = [...staff].sort((a, b) => a.active_tasks - b.active_tasks);
    const selectedStaff = sortedStaff[0];

    context.addLog(
      'assign',
      `มอบหมายงานให้ ${selectedStaff.name} (งานปัจจุบัน: ${selectedStaff.active_tasks})`,
      'success'
    );

    return {
      success: true,
      result: {
        assignedTo: selectedStaff.id,
        assignedToName: selectedStaff.name,
        reason: `Lowest workload (${selectedStaff.active_tasks} tasks)`,
        workloadImpact: ((selectedStaff.active_tasks + 1) / 15) * 100,
      },
    };
  },

  canHandle(input: AgentInput): boolean {
    return input.type === 'assign_task' || input.type === 'rebalance_workload';
  },

  getRequiredPermissions(): string[] {
    return ['task:assign', 'staff:read'];
  },
};

// Notification Agent Handler
export const notificationAgentHandler: AgentHandler = {
  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    context.addLog('prepare', 'เตรียมการแจ้งเตือน', 'pending');

    const { recipientIds = [], notificationType } = input.data || {};

    context.addLog('send', `ส่งแจ้งเตือนไปยัง ${recipientIds.length} คน`, 'success');

    return {
      success: true,
      result: {
        sentCount: recipientIds.length,
        failedCount: 0,
        notifications: recipientIds.map((id: string) => ({
          recipientId: id,
          channel: 'in_app',
          status: 'sent',
          sentAt: new Date().toISOString(),
        })),
      },
    };
  },

  canHandle(input: AgentInput): boolean {
    return input.type === 'send_notification' || input.type === 'deadline_reminder';
  },

  getRequiredPermissions(): string[] {
    return ['notification:send'];
  },
};

// Create singleton instance
export const agentOrchestrator = new AgentOrchestrator();

// Register default handlers
agentOrchestrator.registerAgent('document', documentAgentHandler);
agentOrchestrator.registerAgent('task_assignment', taskAssignmentAgentHandler);
agentOrchestrator.registerAgent('notification', notificationAgentHandler);

export default agentOrchestrator;

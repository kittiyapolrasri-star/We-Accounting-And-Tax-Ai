/**
 * useAgents Hook
 * React hook for connecting AI Agents to UI components
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { AgentOrchestrator } from '../services/agents/agentOrchestrator';
import { taxAgentHandler } from '../services/agents/handlers/taxAgentHandler';
import { reconciliationAgentHandler } from '../services/agents/handlers/reconciliationAgentHandler';
import { taskAssignmentAgentHandler } from '../services/agents/handlers/taskAssignmentAgentHandler';
import { notificationAgentHandler } from '../services/agents/handlers/notificationAgentHandler';
import { AgentType, AgentPriority, AgentInput, AgentMetrics } from '../types/agents';
import { Task } from '../types/tasks';
import { Staff, Client, DocumentRecord } from '../types';

interface AgentState {
  isProcessing: boolean;
  currentAgent: AgentType | null;
  lastResult: any | null;
  error: string | null;
  metrics: Map<AgentType, AgentMetrics>;
}

interface UseAgentsReturn {
  // State
  isProcessing: boolean;
  currentAgent: AgentType | null;
  lastResult: any | null;
  error: string | null;

  // Tax Agent
  calculateTaxes: (documents: DocumentRecord[], period?: string, clientId?: string) => Promise<any>;

  // Reconciliation Agent
  autoReconcile: (bankTransactions: any[], glEntries: any[], documents?: DocumentRecord[]) => Promise<any>;

  // Task Assignment Agent
  autoAssignTasks: (tasks: Task[], staff: Staff[], unassignedOnly?: boolean) => Promise<any>;

  // Notification Agent
  checkDeadlines: (tasks: Task[], clients: Client[], documents: DocumentRecord[]) => Promise<any>;

  // Utilities
  getAgentMetrics: (agentType: AgentType) => AgentMetrics | AgentMetrics[] | undefined;
  clearError: () => void;
}

// Singleton orchestrator
let orchestratorInstance: AgentOrchestrator | null = null;

const getOrchestrator = (): AgentOrchestrator => {
  if (!orchestratorInstance) {
    orchestratorInstance = new AgentOrchestrator();

    // Register all handlers
    orchestratorInstance.registerAgent('tax', taxAgentHandler);
    orchestratorInstance.registerAgent('reconciliation', reconciliationAgentHandler);
    orchestratorInstance.registerAgent('task_assignment', taskAssignmentAgentHandler);
    orchestratorInstance.registerAgent('notification', notificationAgentHandler);
  }
  return orchestratorInstance;
};

export const useAgents = (): UseAgentsReturn => {
  const [state, setState] = useState<AgentState>({
    isProcessing: false,
    currentAgent: null,
    lastResult: null,
    error: null,
    metrics: new Map(),
  });

  const orchestratorRef = useRef<AgentOrchestrator>(getOrchestrator());

  // Generic agent execution wrapper
  const executeAgent = useCallback(async (
    agentType: AgentType,
    input: AgentInput,
    priority: AgentPriority = 'medium'
  ) => {
    setState(prev => ({
      ...prev,
      isProcessing: true,
      currentAgent: agentType,
      error: null,
    }));

    try {
      const executionId = await orchestratorRef.current.submitTask(agentType, input, priority);

      // Wait for completion (simplified - in production use polling or WebSocket)
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = orchestratorRef.current.getExecutionResult(executionId);

      setState(prev => ({
        ...prev,
        isProcessing: false,
        currentAgent: null,
        lastResult: result,
      }));

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setState(prev => ({
        ...prev,
        isProcessing: false,
        currentAgent: null,
        error: errorMessage,
      }));
      throw error;
    }
  }, []);

  // Tax Agent: Calculate taxes
  const calculateTaxes = useCallback(async (
    documents: DocumentRecord[],
    period?: string,
    clientId?: string
  ) => {
    return executeAgent('tax', {
      type: 'tax_calculation',
      data: {},
      context: {
        documents,
        period: period || new Date().toISOString().slice(0, 7),
        clientId,
      },
    }, 'high');
  }, [executeAgent]);

  // Reconciliation Agent: Auto-match transactions
  const autoReconcile = useCallback(async (
    bankTransactions: any[],
    glEntries: any[],
    documents?: DocumentRecord[]
  ) => {
    return executeAgent('reconciliation', {
      type: 'reconciliation',
      data: {},
      context: {
        bankTransactions,
        glEntries,
        documents,
      },
    }, 'medium');
  }, [executeAgent]);

  // Task Assignment Agent: Auto-assign unassigned tasks
  const autoAssignTasks = useCallback(async (
    tasks: Task[],
    staff: Staff[],
    unassignedOnly: boolean = true
  ) => {
    const tasksToProcess = unassignedOnly
      ? tasks.filter(t => !t.assignedTo && t.status !== 'completed' && t.status !== 'cancelled')
      : tasks;

    return executeAgent('task_assignment', {
      type: 'task_assignment',
      data: {},
      context: {
        tasks,
        staff,
        unassignedTasks: tasksToProcess,
      },
    }, 'medium');
  }, [executeAgent]);

  // Notification Agent: Check all deadlines
  const checkDeadlines = useCallback(async (
    tasks: Task[],
    clients: Client[],
    documents: DocumentRecord[]
  ) => {
    return executeAgent('notification', {
      type: 'check_deadlines',
      data: {},
      context: {
        tasks,
        clients,
        documents,
        currentDate: new Date().toISOString(),
      },
    }, 'low');
  }, [executeAgent]);

  // Get metrics for specific agent
  const getAgentMetrics = useCallback((agentType: AgentType) => {
    return orchestratorRef.current.getMetrics(agentType);
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    isProcessing: state.isProcessing,
    currentAgent: state.currentAgent,
    lastResult: state.lastResult,
    error: state.error,
    calculateTaxes,
    autoReconcile,
    autoAssignTasks,
    checkDeadlines,
    getAgentMetrics,
    clearError,
  };
};

export default useAgents;

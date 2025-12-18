/**
 * useAgents Hook
 * React hook for connecting AI Agents to Gemini API via Cloud Functions
 */

import { useState, useCallback } from 'react';
import {
  calculateTaxesWithAI,
  autoReconcileWithAI,
  autoAssignTasksWithAI,
  checkDeadlinesWithAI,
  AgentResponse,
} from '../services/aiAgentService';
import { AgentType, AgentMetrics } from '../types/agents';
import { Task } from '../types/tasks';
import { Staff, Client, DocumentRecord } from '../types';

interface AgentState {
  isProcessing: boolean;
  currentAgent: AgentType | null;
  lastResult: AgentResponse | null;
  error: string | null;
}

interface UseAgentsReturn {
  // State
  isProcessing: boolean;
  currentAgent: AgentType | null;
  lastResult: AgentResponse | null;
  error: string | null;

  // Tax Agent
  calculateTaxes: (documents: DocumentRecord[], period?: string, clientId?: string) => Promise<AgentResponse>;

  // Reconciliation Agent
  autoReconcile: (bankTransactions: any[], glEntries: any[], documents?: DocumentRecord[]) => Promise<AgentResponse>;

  // Task Assignment Agent
  autoAssignTasks: (tasks: Task[], staff: Staff[], unassignedOnly?: boolean) => Promise<AgentResponse>;

  // Notification Agent
  checkDeadlines: (tasks: Task[], clients: Client[], documents: DocumentRecord[]) => Promise<AgentResponse>;

  // Utilities
  getAgentMetrics: (agentType: AgentType) => AgentMetrics | undefined;
  clearError: () => void;
}

export const useAgents = (): UseAgentsReturn => {
  const [state, setState] = useState<AgentState>({
    isProcessing: false,
    currentAgent: null,
    lastResult: null,
    error: null,
  });

  // Tax Agent: Calculate taxes using Gemini AI
  const calculateTaxes = useCallback(async (
    documents: DocumentRecord[],
    period?: string,
    clientId?: string
  ): Promise<AgentResponse> => {
    setState(prev => ({
      ...prev,
      isProcessing: true,
      currentAgent: 'tax',
      error: null,
    }));

    try {
      const result = await calculateTaxesWithAI(documents, period, clientId);

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

  // Reconciliation Agent: Auto-match transactions using Gemini AI
  const autoReconcile = useCallback(async (
    bankTransactions: any[],
    glEntries: any[],
    documents?: DocumentRecord[]
  ): Promise<AgentResponse> => {
    setState(prev => ({
      ...prev,
      isProcessing: true,
      currentAgent: 'reconciliation',
      error: null,
    }));

    try {
      const result = await autoReconcileWithAI(bankTransactions, glEntries, documents);

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

  // Task Assignment Agent: Auto-assign unassigned tasks using Gemini AI
  const autoAssignTasks = useCallback(async (
    tasks: Task[],
    staff: Staff[],
    unassignedOnly: boolean = true
  ): Promise<AgentResponse> => {
    setState(prev => ({
      ...prev,
      isProcessing: true,
      currentAgent: 'task_assignment',
      error: null,
    }));

    try {
      const tasksToProcess = unassignedOnly
        ? tasks.filter(t => !t.assignedTo && t.status !== 'completed' && t.status !== 'cancelled')
        : tasks;

      const result = await autoAssignTasksWithAI(tasks, staff, tasksToProcess);

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

  // Notification Agent: Check all deadlines using Gemini AI
  const checkDeadlines = useCallback(async (
    tasks: Task[],
    clients: Client[],
    documents: DocumentRecord[]
  ): Promise<AgentResponse> => {
    setState(prev => ({
      ...prev,
      isProcessing: true,
      currentAgent: 'notification',
      error: null,
    }));

    try {
      const result = await checkDeadlinesWithAI(tasks, clients, documents);

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

  // Get metrics (placeholder - could be implemented with server-side metrics)
  const getAgentMetrics = useCallback((agentType: AgentType): AgentMetrics | undefined => {
    // Return mock metrics for now
    return {
      agentType,
      period: 'day',
      totalExecutions: 0,
      successCount: 0,
      failureCount: 0,
      escalationCount: 0,
      avgProcessingTimeMs: 0,
      avgConfidence: 0,
      costSavingsThb: 0,
      timeSavedMinutes: 0,
    };
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

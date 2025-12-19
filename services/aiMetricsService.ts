/**
 * AI Metrics Service
 * จัดการ Metrics และ Analytics สำหรับ AI Agents
 */

import { db, isFirebaseConfigured } from './firebase';
import {
    collection, doc, getDocs, getDoc, addDoc, updateDoc, setDoc,
    query, where, orderBy, limit, serverTimestamp, increment
} from 'firebase/firestore';
import { AgentType, AgentMetrics } from '../types/agents';

const METRICS_COLLECTION = 'agent_metrics';
const EXECUTIONS_COLLECTION = 'agent_executions';

// ============================================================================
// LOAD METRICS
// ============================================================================

export const loadAgentMetrics = async (
    agentType: AgentType,
    period: 'hour' | 'day' | 'week' | 'month' = 'day'
): Promise<AgentMetrics> => {
    const defaultMetrics: AgentMetrics = {
        agentType,
        period,
        totalExecutions: 0,
        successCount: 0,
        failureCount: 0,
        escalationCount: 0,
        avgProcessingTimeMs: 0,
        avgConfidence: 0,
        costSavingsThb: 0,
        timeSavedMinutes: 0
    };

    if (!isFirebaseConfigured || !db) {
        return defaultMetrics;
    }

    try {
        const periodKey = getPeriodKey(period);
        const docRef = doc(db, METRICS_COLLECTION, `${agentType}_${periodKey}`);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            return defaultMetrics;
        }

        return {
            ...defaultMetrics,
            ...docSnap.data()
        } as AgentMetrics;
    } catch (error) {
        console.error('Error loading agent metrics:', error);
        return defaultMetrics;
    }
};

export const loadAllAgentMetrics = async (
    period: 'hour' | 'day' | 'week' | 'month' = 'day'
): Promise<Record<AgentType, AgentMetrics>> => {
    const agentTypes: AgentType[] = [
        'orchestrator', 'document', 'tax', 'reconciliation',
        'closing', 'task_assignment', 'notification'
    ];

    const metrics: Record<AgentType, AgentMetrics> = {} as Record<AgentType, AgentMetrics>;

    for (const agentType of agentTypes) {
        metrics[agentType] = await loadAgentMetrics(agentType, period);
    }

    return metrics;
};

// ============================================================================
// RECORD EXECUTION
// ============================================================================

export const recordAgentExecution = async (
    agentType: AgentType,
    execution: {
        success: boolean;
        processingTimeMs: number;
        confidence: number;
        escalated?: boolean;
        error?: string;
        metadata?: Record<string, any>;
    }
): Promise<{ success: boolean; error?: string }> => {
    if (!isFirebaseConfigured || !db) {
        return { success: false, error: 'Firebase not configured' };
    }

    try {
        // 1. Record individual execution
        const executionsRef = collection(db, EXECUTIONS_COLLECTION);
        await addDoc(executionsRef, {
            agentType,
            ...execution,
            timestamp: serverTimestamp()
        });

        // 2. Update aggregated metrics for each period
        const periods: Array<'hour' | 'day' | 'week' | 'month'> = ['hour', 'day', 'week', 'month'];

        for (const period of periods) {
            const periodKey = getPeriodKey(period);
            const docRef = doc(db, METRICS_COLLECTION, `${agentType}_${periodKey}`);

            // Get current metrics or create new
            const docSnap = await getDoc(docRef);
            const current = docSnap.exists() ? docSnap.data() : {
                agentType,
                period,
                totalExecutions: 0,
                successCount: 0,
                failureCount: 0,
                escalationCount: 0,
                totalProcessingTimeMs: 0,
                totalConfidence: 0,
                costSavingsThb: 0,
                timeSavedMinutes: 0
            };

            // Calculate new averages
            const newTotalExecutions = current.totalExecutions + 1;
            const newTotalProcessingTime = (current.totalProcessingTimeMs || 0) + execution.processingTimeMs;
            const newTotalConfidence = (current.totalConfidence || 0) + execution.confidence;

            // Estimate time saved (based on manual processing time)
            const estimatedManualTimeMinutes = getEstimatedManualTime(agentType);
            const timeSavedMinutes = execution.success ? estimatedManualTimeMinutes : 0;
            const costSavingsThb = timeSavedMinutes * 5; // Estimate 5 THB per minute saved

            await setDoc(docRef, {
                agentType,
                period,
                periodKey,
                totalExecutions: newTotalExecutions,
                successCount: current.successCount + (execution.success ? 1 : 0),
                failureCount: current.failureCount + (!execution.success ? 1 : 0),
                escalationCount: current.escalationCount + (execution.escalated ? 1 : 0),
                totalProcessingTimeMs: newTotalProcessingTime,
                totalConfidence: newTotalConfidence,
                avgProcessingTimeMs: Math.round(newTotalProcessingTime / newTotalExecutions),
                avgConfidence: Math.round(newTotalConfidence / newTotalExecutions),
                costSavingsThb: current.costSavingsThb + costSavingsThb,
                timeSavedMinutes: current.timeSavedMinutes + timeSavedMinutes,
                lastUpdated: serverTimestamp()
            });
        }

        return { success: true };
    } catch (error: any) {
        console.error('Error recording agent execution:', error);
        return { success: false, error: error.message };
    }
};

// ============================================================================
// GET RECENT EXECUTIONS
// ============================================================================

export const getRecentExecutions = async (
    agentType?: AgentType,
    limitCount: number = 20
): Promise<Array<{
    id: string;
    agentType: AgentType;
    success: boolean;
    processingTimeMs: number;
    confidence: number;
    timestamp: string;
}>> => {
    if (!isFirebaseConfigured || !db) {
        return [];
    }

    try {
        const executionsRef = collection(db, EXECUTIONS_COLLECTION);
        let q;

        if (agentType) {
            q = query(
                executionsRef,
                where('agentType', '==', agentType),
                orderBy('timestamp', 'desc'),
                limit(limitCount)
            );
        } else {
            q = query(
                executionsRef,
                orderBy('timestamp', 'desc'),
                limit(limitCount)
            );
        }

        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || new Date().toISOString()
        })) as any;
    } catch (error) {
        console.error('Error getting recent executions:', error);
        return [];
    }
};

// ============================================================================
// HELPERS
// ============================================================================

function getPeriodKey(period: 'hour' | 'day' | 'week' | 'month'): string {
    const now = new Date();

    switch (period) {
        case 'hour':
            return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}`;
        case 'day':
            return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        case 'week':
            const weekNum = getWeekNumber(now);
            return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
        case 'month':
            return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        default:
            return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
}

function getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getEstimatedManualTime(agentType: AgentType): number {
    // Estimated manual processing time in minutes
    switch (agentType) {
        case 'document': return 5;
        case 'tax': return 10;
        case 'reconciliation': return 15;
        case 'closing': return 30;
        case 'task_assignment': return 2;
        case 'notification': return 1;
        default: return 5;
    }
}

// ============================================================================
// SUMMARY STATS
// ============================================================================

export const getTodaySummary = async (): Promise<{
    totalExecutions: number;
    successRate: number;
    totalSavingsThb: number;
    totalTimeSavedMinutes: number;
}> => {
    const metrics = await loadAllAgentMetrics('day');

    let totalExecutions = 0;
    let totalSuccess = 0;
    let totalSavingsThb = 0;
    let totalTimeSavedMinutes = 0;

    Object.values(metrics).forEach(m => {
        totalExecutions += m.totalExecutions;
        totalSuccess += m.successCount;
        totalSavingsThb += m.costSavingsThb;
        totalTimeSavedMinutes += m.timeSavedMinutes;
    });

    return {
        totalExecutions,
        successRate: totalExecutions > 0 ? (totalSuccess / totalExecutions) * 100 : 0,
        totalSavingsThb,
        totalTimeSavedMinutes
    };
};

export default {
    loadAgentMetrics,
    loadAllAgentMetrics,
    recordAgentExecution,
    getRecentExecutions,
    getTodaySummary
};

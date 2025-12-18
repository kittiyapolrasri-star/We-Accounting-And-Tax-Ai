/**
 * AI Agent Service
 * เรียก AI Agents ผ่าน Cloud Functions ที่เชื่อมต่อ Gemini API จริง
 */

import { getAuthToken } from './auth';
import { isFirebaseConfigured } from './firebase';

// API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL ||
    (import.meta.env.VITE_FIREBASE_PROJECT_ID
        ? `https://asia-southeast1-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net/api`
        : '');

export type AgentType = 'tax' | 'reconciliation' | 'task_assignment' | 'notification';

export interface AgentInput {
    type: string;
    data: Record<string, any>;
    context: Record<string, any>;
}

export interface AgentResponse {
    success: boolean;
    agentType: AgentType;
    priority: 'low' | 'medium' | 'high';
    result: any;
    processedAt: string;
    processedBy: string;
    error?: string;
}

/**
 * เรียก AI Agent ผ่าน Cloud Functions
 */
export const callAIAgent = async (
    agentType: AgentType,
    input: AgentInput,
    priority: 'low' | 'medium' | 'high' = 'medium'
): Promise<AgentResponse> => {
    // Check if Firebase is configured
    if (!isFirebaseConfigured || !API_BASE_URL) {
        console.log('Firebase not configured, using mock AI response');
        return generateMockResponse(agentType, input);
    }

    try {
        // Get auth token
        const token = await getAuthToken();

        if (!token) {
            throw new Error('กรุณาเข้าสู่ระบบก่อนใช้งาน AI Agent');
        }

        // Call Cloud Functions API
        const response = await fetch(`${API_BASE_URL}/api/ai-agent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                agentType,
                input,
                priority,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));

            if (response.status === 401) {
                throw new Error('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
            }

            if (response.status === 429) {
                throw new Error('คำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่');
            }

            throw new Error(errorData.error || 'AI Agent ทำงานผิดพลาด');
        }

        const result = await response.json();
        return result as AgentResponse;

    } catch (error: any) {
        console.error('AI Agent Error:', error);

        // If network error, use mock response
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            console.log('Network error, using mock AI response');
            return generateMockResponse(agentType, input);
        }

        throw error;
    }
};

/**
 * Tax Agent - คำนวณภาษี
 */
export const calculateTaxesWithAI = async (
    documents: any[],
    period?: string,
    clientId?: string
): Promise<AgentResponse> => {
    return callAIAgent('tax', {
        type: 'tax_calculation',
        data: {},
        context: {
            documents,
            period: period || new Date().toISOString().slice(0, 7),
            clientId,
        },
    }, 'high');
};

/**
 * Reconciliation Agent - จับคู่รายการธนาคาร
 */
export const autoReconcileWithAI = async (
    bankTransactions: any[],
    glEntries: any[],
    documents?: any[]
): Promise<AgentResponse> => {
    return callAIAgent('reconciliation', {
        type: 'reconciliation',
        data: {},
        context: {
            bankTransactions,
            glEntries,
            documents,
        },
    }, 'medium');
};

/**
 * Task Assignment Agent - มอบหมายงานอัตโนมัติ
 */
export const autoAssignTasksWithAI = async (
    tasks: any[],
    staff: any[],
    unassignedTasks?: any[]
): Promise<AgentResponse> => {
    return callAIAgent('task_assignment', {
        type: 'task_assignment',
        data: {},
        context: {
            tasks,
            staff,
            unassignedTasks: unassignedTasks || tasks.filter(t => !t.assignedTo),
        },
    }, 'medium');
};

/**
 * Notification Agent - ตรวจสอบ Deadlines
 */
export const checkDeadlinesWithAI = async (
    tasks: any[],
    clients: any[],
    documents?: any[]
): Promise<AgentResponse> => {
    return callAIAgent('notification', {
        type: 'check_deadlines',
        data: {},
        context: {
            tasks,
            clients,
            documents,
            currentDate: new Date().toISOString(),
        },
    }, 'low');
};

/**
 * Generate mock response when Firebase is not available
 */
function generateMockResponse(agentType: AgentType, input: AgentInput): AgentResponse {
    const now = new Date().toISOString();

    switch (agentType) {
        case 'tax':
            return {
                success: true,
                agentType,
                priority: 'high',
                result: {
                    taxType: 'VAT_WHT',
                    period: input.context?.period || now.slice(0, 7),
                    calculations: {
                        outputVat: 15000,
                        inputVat: 8500,
                        netVat: 6500,
                        whtPND3: 1200,
                        whtPND53: 3500,
                        totalWht: 4700,
                    },
                    suggestedForms: ['PP30', 'PND53'],
                    warnings: ['⚠️ นี่คือข้อมูลจำลอง - กรุณาตั้งค่า Firebase เพื่อใช้ AI จริง'],
                    confidenceScore: 85,
                    aiInsights: 'Mock: ระบบกำลังทำงานในโหมดจำลอง',
                },
                processedAt: now,
                processedBy: 'mock-agent',
            };

        case 'reconciliation':
            return {
                success: true,
                agentType,
                priority: 'medium',
                result: {
                    matched: [],
                    unmatchedBank: [],
                    unmatchedGL: [],
                    discrepancies: [],
                    totalMatched: 0,
                    matchRate: 0,
                    aiInsights: 'Mock: ไม่มีรายการให้จับคู่ (โหมดจำลอง)',
                },
                processedAt: now,
                processedBy: 'mock-agent',
            };

        case 'task_assignment':
            return {
                success: true,
                agentType,
                priority: 'medium',
                result: {
                    assignments: [],
                    workloadAnalysis: [],
                    warnings: ['⚠️ นี่คือข้อมูลจำลอง'],
                    aiInsights: 'Mock: ไม่มีงานให้มอบหมาย (โหมดจำลอง)',
                },
                processedAt: now,
                processedBy: 'mock-agent',
            };

        case 'notification':
            return {
                success: true,
                agentType,
                priority: 'low',
                result: {
                    urgentTasks: [],
                    upcomingDeadlines: [],
                    notifications: [
                        {
                            type: 'info',
                            title: 'โหมดจำลอง',
                            message: 'กรุณาตั้งค่า Firebase เพื่อใช้ AI Agent จริง',
                        }
                    ],
                    summary: { urgent: 0, warning: 0, info: 1 },
                    aiInsights: 'Mock: ระบบกำลังทำงานในโหมดจำลอง',
                },
                processedAt: now,
                processedBy: 'mock-agent',
            };

        default:
            return {
                success: false,
                agentType,
                priority: 'medium',
                result: { error: 'Unknown agent type' },
                processedAt: now,
                processedBy: 'mock-agent',
            };
    }
}

export default {
    callAIAgent,
    calculateTaxesWithAI,
    autoReconcileWithAI,
    autoAssignTasksWithAI,
    checkDeadlinesWithAI,
};

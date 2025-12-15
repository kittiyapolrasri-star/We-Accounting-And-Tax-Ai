/**
 * Recurring Tasks Service
 * 
 * ระบบสร้างงานประจำอัตโนมัติ
 * - งานยื่นภาษีประจำเดือน
 * - งานปิดบัญชี
 * - Task Templates
 * - Scheduling Engine
 */

import {
    collection,
    addDoc,
    query,
    where,
    getDocs,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { Task, TaskCategory, TaskPriority } from '../types/tasks';

// ============================================================================
// TYPES
// ============================================================================

export type RecurrenceFrequency =
    | 'daily'
    | 'weekly'
    | 'biweekly'
    | 'monthly'
    | 'quarterly'
    | 'yearly';

export type RecurrenceEndType =
    | 'never'
    | 'after_occurrences'
    | 'on_date';

export interface RecurringTaskTemplate {
    id: string;
    name: string;
    description: string;
    category: TaskCategory;
    priority: TaskPriority;

    // Recurrence settings
    frequency: RecurrenceFrequency;
    interval: number;  // Every N days/weeks/months
    dayOfMonth?: number;  // For monthly: 1-31 or -1 for last day
    dayOfWeek?: number;   // For weekly: 0-6 (Sun-Sat)
    monthOfYear?: number; // For yearly: 1-12

    // End conditions
    endType: RecurrenceEndType;
    endAfterOccurrences?: number;
    endDate?: string;

    // Assignment
    clientId?: string;      // Specific client or null for all
    assignToClientOwner: boolean;  // Auto-assign to client's owner
    defaultAssigneeId?: string;    // Fallback assignee

    // Task details
    estimatedHours: number;
    checklist: Array<{ text: string; completed: boolean }>;
    dueDaysAfterCreation: number;  // Due date = creation + N days

    // Tax deadlines (Thai)
    taxFormType?: 'PP30' | 'PP36' | 'PND1' | 'PND3' | 'PND53' | 'PND54' | 'PND50' | 'PND51';

    // Status
    isActive: boolean;
    lastRunAt?: string;
    nextRunAt?: string;
    totalCreated: number;

    createdAt: string;
    createdBy: string;
    updatedAt: string;
}

export interface RecurringTaskLog {
    id: string;
    templateId: string;
    taskId: string;
    clientId?: string;
    createdAt: string;
    status: 'created' | 'skipped' | 'error';
    errorMessage?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const COLLECTIONS = {
    RECURRING_TEMPLATES: 'recurring_task_templates',
    RECURRING_LOGS: 'recurring_task_logs',
    TASKS: 'tasks'
};

// Thai Tax Deadlines
export const THAI_TAX_DEADLINES: Record<string, {
    name: string;
    nameTh: string;
    dueDay: number;    // Day of month
    dueMonthOffset: number;  // 0 = same month, 1 = next month
    frequency: RecurrenceFrequency;
}> = {
    PP30: {
        name: 'VAT Return (PP30)',
        nameTh: 'ภ.พ.30 ภาษีมูลค่าเพิ่ม',
        dueDay: 15,
        dueMonthOffset: 1,
        frequency: 'monthly'
    },
    PP36: {
        name: 'VAT Service (PP36)',
        nameTh: 'ภ.พ.36 ภาษีมูลค่าเพิ่มบริการ',
        dueDay: 7,
        dueMonthOffset: 1,
        frequency: 'monthly'
    },
    PND1: {
        name: 'WHT Personal (PND1)',
        nameTh: 'ภ.ง.ด.1 หัก ณ ที่จ่ายเงินเดือน',
        dueDay: 7,
        dueMonthOffset: 1,
        frequency: 'monthly'
    },
    PND3: {
        name: 'WHT Company (PND3)',
        nameTh: 'ภ.ง.ด.3 หัก ณ ที่จ่ายนิติบุคคล',
        dueDay: 7,
        dueMonthOffset: 1,
        frequency: 'monthly'
    },
    PND53: {
        name: 'WHT Service (PND53)',
        nameTh: 'ภ.ง.ด.53 หัก ณ ที่จ่ายค่าบริการ',
        dueDay: 7,
        dueMonthOffset: 1,
        frequency: 'monthly'
    },
    PND54: {
        name: 'WHT Foreign (PND54)',
        nameTh: 'ภ.ง.ด.54 หัก ณ ที่จ่ายต่างประเทศ',
        dueDay: 7,
        dueMonthOffset: 1,
        frequency: 'monthly'
    },
    PND50: {
        name: 'Corporate Tax (PND50)',
        nameTh: 'ภ.ง.ด.50 ภาษีนิติบุคคลประจำปี',
        dueDay: 31,  // Within 150 days after fiscal year end
        dueMonthOffset: 5,
        frequency: 'yearly'
    },
    PND51: {
        name: 'Corporate Tax Half-Year (PND51)',
        nameTh: 'ภ.ง.ด.51 ภาษีนิติบุคคลครึ่งปี',
        dueDay: 31,  // Within 2 months
        dueMonthOffset: 2,
        frequency: 'yearly'
    }
};

// Pre-built templates
export const DEFAULT_TEMPLATES: Array<Omit<RecurringTaskTemplate, 'id' | 'createdAt' | 'updatedAt' | 'lastRunAt' | 'nextRunAt' | 'totalCreated'>> = [
    {
        name: 'ยื่น ภ.พ.30 ประจำเดือน',
        description: 'จัดทำและยื่นแบบ ภ.พ.30 ภาษีมูลค่าเพิ่มประจำเดือน',
        category: 'tax_filing',
        priority: 'high',
        frequency: 'monthly',
        interval: 1,
        dayOfMonth: 1,  // Create on 1st of month
        endType: 'never',
        assignToClientOwner: true,
        estimatedHours: 2,
        checklist: [
            { text: 'รวบรวมใบกำกับภาษีขาย', completed: false },
            { text: 'รวบรวมใบกำกับภาษีซื้อ', completed: false },
            { text: 'คำนวณภาษีขาย-ภาษีซื้อ', completed: false },
            { text: 'จัดทำรายงานภาษีซื้อ/ขาย', completed: false },
            { text: 'ยื่นแบบ ภ.พ.30', completed: false },
            { text: 'ชำระภาษี (ถ้ามี)', completed: false }
        ],
        dueDaysAfterCreation: 15,
        taxFormType: 'PP30',
        isActive: true,
        createdBy: 'system'
    },
    {
        name: 'ยื่น ภ.ง.ด.3 ประจำเดือน',
        description: 'จัดทำและยื่นแบบ ภ.ง.ด.3 หัก ณ ที่จ่าย',
        category: 'tax_filing',
        priority: 'high',
        frequency: 'monthly',
        interval: 1,
        dayOfMonth: 1,
        endType: 'never',
        assignToClientOwner: true,
        estimatedHours: 1.5,
        checklist: [
            { text: 'รวบรวมใบสำคัญจ่าย', completed: false },
            { text: 'คำนวณภาษีหัก ณ ที่จ่าย', completed: false },
            { text: 'จัดทำใบ 50 ทวิ', completed: false },
            { text: 'ยื่นแบบ ภ.ง.ด.3', completed: false },
            { text: 'ชำระภาษี', completed: false }
        ],
        dueDaysAfterCreation: 7,
        taxFormType: 'PND3',
        isActive: true,
        createdBy: 'system'
    },
    {
        name: 'ปิดบัญชีประจำเดือน',
        description: 'ปิดบัญชีและจัดทำงบการเงินประจำเดือน',
        category: 'period_closing',
        priority: 'high',
        frequency: 'monthly',
        interval: 1,
        dayOfMonth: 1,
        endType: 'never',
        assignToClientOwner: true,
        estimatedHours: 4,
        checklist: [
            { text: 'กระทบยอดธนาคาร', completed: false },
            { text: 'ตรวจสอบรายการค้างรับ/ค้างจ่าย', completed: false },
            { text: 'คำนวณค่าเสื่อมราคา', completed: false },
            { text: 'ปรับปรุงรายการ', completed: false },
            { text: 'จัดทำงบทดลอง', completed: false },
            { text: 'จัดทำงบกำไรขาดทุน', completed: false },
            { text: 'จัดทำงบดุล', completed: false }
        ],
        dueDaysAfterCreation: 10,
        isActive: true,
        createdBy: 'system'
    },
    {
        name: 'ยื่น ภ.ง.ด.50 ประจำปี',
        description: 'จัดทำและยื่นแบบ ภ.ง.ด.50 ภาษีเงินได้นิติบุคคล',
        category: 'tax_filing',
        priority: 'urgent',
        frequency: 'yearly',
        interval: 1,
        monthOfYear: 1,  // January
        dayOfMonth: 1,
        endType: 'never',
        assignToClientOwner: true,
        estimatedHours: 8,
        checklist: [
            { text: 'ปิดบัญชีประจำปี', completed: false },
            { text: 'จัดทำงบการเงิน', completed: false },
            { text: 'คำนวณภาษีเงินได้นิติบุคคล', completed: false },
            { text: 'จัดทำแบบ ภ.ง.ด.50', completed: false },
            { text: 'ตรวจสอบก่อนยื่น', completed: false },
            { text: 'ยื่นแบบและชำระภาษี', completed: false }
        ],
        dueDaysAfterCreation: 150,
        taxFormType: 'PND50',
        isActive: true,
        createdBy: 'system'
    }
];

// ============================================================================
// RECURRING TASKS SERVICE
// ============================================================================

class RecurringTasksService {

    // ==========================================================================
    // TEMPLATE CRUD
    // ==========================================================================

    /**
     * Create recurring task template
     */
    async createTemplate(
        template: Omit<RecurringTaskTemplate, 'id' | 'createdAt' | 'updatedAt' | 'lastRunAt' | 'nextRunAt' | 'totalCreated'>
    ): Promise<string | null> {
        if (!db) {
            console.warn('Database not initialized');
            return null;
        }

        try {
            const now = new Date().toISOString();
            const nextRun = this.calculateNextRun(template);

            const docRef = await addDoc(collection(db, COLLECTIONS.RECURRING_TEMPLATES), {
                ...template,
                createdAt: now,
                updatedAt: now,
                nextRunAt: nextRun,
                totalCreated: 0
            });

            return docRef.id;
        } catch (error) {
            console.error('Error creating template:', error);
            return null;
        }
    }

    /**
     * Get all templates
     */
    async getTemplates(activeOnly: boolean = false): Promise<RecurringTaskTemplate[]> {
        if (!db) return [];

        try {
            const constraints: any[] = [];
            if (activeOnly) {
                constraints.push(where('isActive', '==', true));
            }

            const q = query(collection(db, COLLECTIONS.RECURRING_TEMPLATES), ...constraints);
            const snapshot = await getDocs(q);

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as RecurringTaskTemplate[];

        } catch (error) {
            console.error('Error fetching templates:', error);
            return [];
        }
    }

    /**
     * Update template
     */
    async updateTemplate(id: string, updates: Partial<RecurringTaskTemplate>): Promise<void> {
        if (!db) return;

        try {
            await updateDoc(doc(db, COLLECTIONS.RECURRING_TEMPLATES, id), {
                ...updates,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error updating template:', error);
        }
    }

    /**
     * Delete template
     */
    async deleteTemplate(id: string): Promise<void> {
        if (!db) return;

        try {
            await deleteDoc(doc(db, COLLECTIONS.RECURRING_TEMPLATES, id));
        } catch (error) {
            console.error('Error deleting template:', error);
        }
    }

    // ==========================================================================
    // TASK GENERATION
    // ==========================================================================

    /**
     * Calculate next run date for template
     */
    calculateNextRun(template: Pick<RecurringTaskTemplate, 'frequency' | 'interval' | 'dayOfMonth' | 'dayOfWeek' | 'monthOfYear'>): string {
        const now = new Date();
        let nextDate = new Date(now);

        switch (template.frequency) {
            case 'daily':
                nextDate.setDate(now.getDate() + template.interval);
                break;

            case 'weekly':
                const targetDay = template.dayOfWeek ?? 1;
                const daysUntil = (targetDay - now.getDay() + 7) % 7 || 7;
                nextDate.setDate(now.getDate() + daysUntil);
                break;

            case 'biweekly':
                nextDate.setDate(now.getDate() + 14);
                break;

            case 'monthly':
                nextDate.setMonth(now.getMonth() + template.interval);
                if (template.dayOfMonth) {
                    if (template.dayOfMonth === -1) {
                        // Last day of month
                        nextDate = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0);
                    } else {
                        nextDate.setDate(Math.min(template.dayOfMonth,
                            new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()));
                    }
                }
                break;

            case 'quarterly':
                nextDate.setMonth(now.getMonth() + 3);
                if (template.dayOfMonth) {
                    nextDate.setDate(Math.min(template.dayOfMonth,
                        new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()));
                }
                break;

            case 'yearly':
                nextDate.setFullYear(now.getFullYear() + 1);
                if (template.monthOfYear) {
                    nextDate.setMonth(template.monthOfYear - 1);
                }
                if (template.dayOfMonth) {
                    nextDate.setDate(template.dayOfMonth);
                }
                break;
        }

        return nextDate.toISOString();
    }

    /**
     * Generate tasks from template
     */
    async generateTasksFromTemplate(
        template: RecurringTaskTemplate,
        clientIds: string[],
        getClientOwner: (clientId: string) => string | null
    ): Promise<{ created: number; errors: string[] }> {
        if (!db) {
            return { created: 0, errors: ['Database not initialized'] };
        }

        const result = { created: 0, errors: [] as string[] };
        const now = new Date();
        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + template.dueDaysAfterCreation);

        for (const clientId of clientIds) {
            try {
                // Determine assignee
                let assigneeId = template.defaultAssigneeId || null;
                if (template.assignToClientOwner) {
                    const owner = getClientOwner(clientId);
                    if (owner) assigneeId = owner;
                }

                // Create task
                const task: Omit<Task, 'id'> = {
                    title: template.name,
                    description: template.description,
                    status: 'todo',
                    priority: template.priority,
                    category: template.category,
                    clientId,
                    assignedTo: assigneeId || undefined,
                    dueDate: dueDate.toISOString(),
                    estimatedHours: template.estimatedHours,
                    checklist: template.checklist.map((item, idx) => ({
                        id: `check-${idx}`,
                        text: item.text,
                        completed: false,
                        indent: 0
                    })),
                    progress: 0,
                    timeSpent: 0,
                    comments: [],
                    activity: [{
                        id: `act-${Date.now()}`,
                        type: 'created',
                        timestamp: now.toISOString(),
                        userId: 'system',
                        userName: 'ระบบอัตโนมัติ',
                        details: `สร้างจากงานประจำ: ${template.name}`
                    }],
                    attachments: [],
                    watchers: [],
                    tags: ['recurring', template.taxFormType || template.category],
                    createdAt: now.toISOString(),
                    updatedAt: now.toISOString(),
                    createdByAgent: true,
                    canBeAutomated: false
                };

                const taskRef = await addDoc(collection(db, COLLECTIONS.TASKS), task);

                // Log creation
                await addDoc(collection(db, COLLECTIONS.RECURRING_LOGS), {
                    templateId: template.id,
                    taskId: taskRef.id,
                    clientId,
                    createdAt: now.toISOString(),
                    status: 'created'
                });

                result.created++;

            } catch (error) {
                const errorMsg = `Error creating task for client ${clientId}: ${error}`;
                result.errors.push(errorMsg);
                console.error(errorMsg);

                // Log error
                await addDoc(collection(db, COLLECTIONS.RECURRING_LOGS), {
                    templateId: template.id,
                    clientId,
                    createdAt: now.toISOString(),
                    status: 'error',
                    errorMessage: String(error)
                });
            }
        }

        // Update template
        await this.updateTemplate(template.id, {
            lastRunAt: now.toISOString(),
            nextRunAt: this.calculateNextRun(template),
            totalCreated: (template.totalCreated || 0) + result.created
        });

        return result;
    }

    /**
     * Run scheduler - check and generate due recurring tasks
     */
    async runScheduler(
        clients: Array<{ id: string; ownerId?: string }>,
        getClientOwner: (clientId: string) => string | null
    ): Promise<{ templatesProcessed: number; tasksCreated: number; errors: string[] }> {
        const result = { templatesProcessed: 0, tasksCreated: 0, errors: [] as string[] };

        try {
            const now = new Date();
            const templates = await this.getTemplates(true);

            for (const template of templates) {
                // Check if it's time to run
                if (!template.nextRunAt || new Date(template.nextRunAt) > now) {
                    continue;
                }

                // Check end conditions
                if (template.endType === 'on_date' && template.endDate) {
                    if (new Date(template.endDate) < now) continue;
                }
                if (template.endType === 'after_occurrences' && template.endAfterOccurrences) {
                    if ((template.totalCreated || 0) >= template.endAfterOccurrences) continue;
                }

                // Get applicable clients
                let targetClients = clients.map(c => c.id);
                if (template.clientId) {
                    targetClients = [template.clientId];
                }

                // Generate tasks
                const genResult = await this.generateTasksFromTemplate(
                    template,
                    targetClients,
                    getClientOwner
                );

                result.templatesProcessed++;
                result.tasksCreated += genResult.created;
                result.errors.push(...genResult.errors);
            }

        } catch (error) {
            result.errors.push(`Scheduler error: ${error}`);
            console.error('Scheduler error:', error);
        }

        return result;
    }

    /**
     * Get logs for template
     */
    async getLogs(templateId: string, limit: number = 50): Promise<RecurringTaskLog[]> {
        if (!db) return [];

        try {
            const q = query(
                collection(db, COLLECTIONS.RECURRING_LOGS),
                where('templateId', '==', templateId),
                // orderBy('createdAt', 'desc'),
                // firestoreLimit(limit)
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as RecurringTaskLog[];

        } catch (error) {
            console.error('Error fetching logs:', error);
            return [];
        }
    }

    /**
     * Initialize default templates
     */
    async initializeDefaultTemplates(createdBy: string): Promise<number> {
        let created = 0;

        for (const template of DEFAULT_TEMPLATES) {
            const id = await this.createTemplate({
                ...template,
                createdBy
            });
            if (id) created++;
        }

        return created;
    }
}

// ============================================================================
// EXPORT
// ============================================================================

export const recurringTasksService = new RecurringTasksService();

export default recurringTasksService;

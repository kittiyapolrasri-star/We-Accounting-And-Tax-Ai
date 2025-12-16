/**
 * Task Database Service
 * 
 * CRUD Operations สำหรับ Tasks บน Firestore
 * รองรับ Real-time Sync
 */

import {
    collection,
    addDoc,
    getDocs,
    getDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where,
    orderBy,
    limit as firestoreLimit,
    onSnapshot,
    serverTimestamp,
    Unsubscribe,
    writeBatch
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { Task, TaskStatus, TaskCategory, TaskPriority } from '../types/tasks';

// ============================================================================
// CONSTANTS
// ============================================================================

const COLLECTION_NAME = 'tasks';

// ============================================================================
// LOCAL STORAGE FALLBACK
// ============================================================================

const LOCAL_STORAGE_KEY = 'we_accounting_tasks';

const getLocalTasks = (): Task[] => {
    try {
        const data = localStorage.getItem(LOCAL_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
};

const saveLocalTasks = (tasks: Task[]): void => {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks));
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
};

// ============================================================================
// TASK DATABASE SERVICE
// ============================================================================

class TaskDatabaseService {
    private unsubscribeListeners: Map<string, Unsubscribe> = new Map();

    // ==========================================================================
    // CREATE
    // ==========================================================================

    /**
     * Create a new task
     */
    async createTask(task: Omit<Task, 'id'>): Promise<string> {
        const now = new Date().toISOString();
        const taskData = {
            ...task,
            createdAt: now,
            updatedAt: now,
            progress: task.progress || 0,
            timeSpent: task.timeSpent || 0,
            timeEntries: task.timeEntries || [],
            comments: task.comments || [],
            activityLog: task.activityLog || [{
                id: `act-${Date.now()}`,
                action: 'created',
                timestamp: now,
                userId: task.assignedBy || 'system',
                userName: 'ระบบ',
                details: 'สร้างงานใหม่'
            }],
            properties: task.properties || [],
            tags: task.tags || [],
            checklist: task.checklist || []
        };

        // Firestore mode
        if (db && isFirebaseConfigured) {
            try {
                const docRef = await addDoc(collection(db, COLLECTION_NAME), taskData);
                return docRef.id;
            } catch (error) {
                console.error('Error creating task in Firestore:', error);
                // Fallback to local storage
            }
        }

        // Local storage fallback
        const newId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const tasks = getLocalTasks();
        tasks.push({ id: newId, ...taskData } as Task);
        saveLocalTasks(tasks);
        return newId;
    }

    /**
     * Create multiple tasks
     */
    async createTasks(tasks: Omit<Task, 'id'>[]): Promise<string[]> {
        const ids: string[] = [];

        if (db && isFirebaseConfigured) {
            const batch = writeBatch(db);
            const now = new Date().toISOString();

            for (const task of tasks) {
                const docRef = doc(collection(db, COLLECTION_NAME));
                batch.set(docRef, {
                    ...task,
                    createdAt: now,
                    updatedAt: now
                });
                ids.push(docRef.id);
            }

            try {
                await batch.commit();
                return ids;
            } catch (error) {
                console.error('Error batch creating tasks:', error);
            }
        }

        // Fallback
        for (const task of tasks) {
            const id = await this.createTask(task);
            ids.push(id);
        }
        return ids;
    }

    // ==========================================================================
    // READ
    // ==========================================================================

    /**
     * Get all tasks
     */
    async getTasks(filters: {
        status?: TaskStatus;
        category?: TaskCategory;
        priority?: TaskPriority;
        assignedTo?: string;
        clientId?: string;
        projectId?: string;
        limit?: number;
    } = {}): Promise<Task[]> {

        // Firestore mode
        if (db && isFirebaseConfigured) {
            try {
                const constraints: any[] = [];

                if (filters.status) {
                    constraints.push(where('status', '==', filters.status));
                }
                if (filters.category) {
                    constraints.push(where('category', '==', filters.category));
                }
                if (filters.priority) {
                    constraints.push(where('priority', '==', filters.priority));
                }
                if (filters.assignedTo) {
                    constraints.push(where('assignedTo', '==', filters.assignedTo));
                }
                if (filters.clientId) {
                    constraints.push(where('clientId', '==', filters.clientId));
                }
                if (filters.projectId) {
                    constraints.push(where('projectId', '==', filters.projectId));
                }

                constraints.push(orderBy('createdAt', 'desc'));

                if (filters.limit) {
                    constraints.push(firestoreLimit(filters.limit));
                }

                const q = query(collection(db, COLLECTION_NAME), ...constraints);
                const snapshot = await getDocs(q);

                return snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Task[];

            } catch (error) {
                console.error('Error fetching tasks from Firestore:', error);
                // Fallback to local storage
            }
        }

        // Local storage fallback
        let tasks = getLocalTasks();

        if (filters.status) {
            tasks = tasks.filter(t => t.status === filters.status);
        }
        if (filters.category) {
            tasks = tasks.filter(t => t.category === filters.category);
        }
        if (filters.priority) {
            tasks = tasks.filter(t => t.priority === filters.priority);
        }
        if (filters.assignedTo) {
            tasks = tasks.filter(t => t.assignedTo === filters.assignedTo);
        }
        if (filters.clientId) {
            tasks = tasks.filter(t => t.clientId === filters.clientId);
        }
        if (filters.limit) {
            tasks = tasks.slice(0, filters.limit);
        }

        return tasks.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }

    /**
     * Get task by ID
     */
    async getTaskById(taskId: string): Promise<Task | null> {
        if (db && isFirebaseConfigured) {
            try {
                const docSnap = await getDoc(doc(db, COLLECTION_NAME, taskId));
                if (docSnap.exists()) {
                    return { id: docSnap.id, ...docSnap.data() } as Task;
                }
                return null;
            } catch (error) {
                console.error('Error fetching task:', error);
            }
        }

        // Local storage fallback
        const tasks = getLocalTasks();
        return tasks.find(t => t.id === taskId) || null;
    }

    /**
     * Get tasks by client
     */
    async getTasksByClient(clientId: string): Promise<Task[]> {
        return this.getTasks({ clientId });
    }

    /**
     * Get tasks assigned to staff
     */
    async getTasksByAssignee(staffId: string): Promise<Task[]> {
        return this.getTasks({ assignedTo: staffId });
    }

    /**
     * Get overdue tasks
     */
    async getOverdueTasks(): Promise<Task[]> {
        const tasks = await this.getTasks();
        const now = new Date();

        return tasks.filter(task =>
            task.dueDate &&
            new Date(task.dueDate) < now &&
            !['completed', 'cancelled'].includes(task.status)
        );
    }

    /**
     * Get tasks due soon
     */
    async getTasksDueSoon(daysAhead: number = 7): Promise<Task[]> {
        const tasks = await this.getTasks();
        const now = new Date();
        const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

        return tasks.filter(task =>
            task.dueDate &&
            new Date(task.dueDate) >= now &&
            new Date(task.dueDate) <= futureDate &&
            !['completed', 'cancelled'].includes(task.status)
        );
    }

    // ==========================================================================
    // UPDATE
    // ==========================================================================

    /**
     * Update task
     */
    async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
        const now = new Date().toISOString();
        const updateData = {
            ...updates,
            updatedAt: now
        };

        // Add activity log for status change
        if (updates.status) {
            const task = await this.getTaskById(taskId);
            if (task && task.status !== updates.status) {
                updateData.activityLog = [
                    ...(task.activityLog || []),
                    {
                        id: `act-${Date.now()}`,
                        action: 'status_changed' as const,
                        timestamp: now,
                        userId: 'current_user',
                        userName: 'ผู้ใช้',
                        details: `เปลี่ยนสถานะเป็น ${updates.status}`,
                        previousValue: task.status,
                        newValue: updates.status
                    }
                ];
            }
        }

        // Firestore mode
        if (db && isFirebaseConfigured) {
            try {
                await updateDoc(doc(db, COLLECTION_NAME, taskId), updateData);
                return;
            } catch (error) {
                console.error('Error updating task in Firestore:', error);
            }
        }

        // Local storage fallback
        const tasks = getLocalTasks();
        const index = tasks.findIndex(t => t.id === taskId);
        if (index !== -1) {
            tasks[index] = { ...tasks[index], ...updateData };
            saveLocalTasks(tasks);
        }
    }

    /**
     * Update task status
     */
    async updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
        const updates: Partial<Task> = { status };

        if (status === 'completed') {
            updates.completedAt = new Date().toISOString();
            updates.progress = 100;
        }

        await this.updateTask(taskId, updates);
    }

    /**
     * Assign task to staff
     */
    async assignTask(taskId: string, staffId: string, assignedBy: string): Promise<void> {
        const now = new Date().toISOString();
        const task = await this.getTaskById(taskId);

        const updates: Partial<Task> = {
            assignedTo: staffId,
            assignedBy,
            assignedAt: now,
            activityLog: [
                ...(task?.activityLog || []),
                {
                    id: `act-${Date.now()}`,
                    action: 'assigned' as const,
                    timestamp: now,
                    userId: assignedBy,
                    userName: 'ผู้มอบหมาย',
                    details: `มอบหมายงานให้ ${staffId}`
                }
            ]
        };

        await this.updateTask(taskId, updates);
    }

    /**
     * Update checklist item
     */
    async updateChecklistItem(
        taskId: string,
        checklistItemId: string,
        completed: boolean
    ): Promise<void> {
        const task = await this.getTaskById(taskId);
        if (!task || !task.checklist) return;

        const updatedChecklist = task.checklist.map(item =>
            item.id === checklistItemId ? { ...item, completed } : item
        );

        // Calculate progress based on checklist
        const completedItems = updatedChecklist.filter(item => item.completed).length;
        const progress = Math.round((completedItems / updatedChecklist.length) * 100);

        await this.updateTask(taskId, {
            checklist: updatedChecklist,
            progress
        });
    }

    /**
     * Add comment to task
     */
    async addComment(
        taskId: string,
        userId: string,
        userName: string,
        content: string,
        mentions?: string[]
    ): Promise<void> {
        const task = await this.getTaskById(taskId);
        if (!task) return;

        const newComment = {
            id: `comment-${Date.now()}`,
            userId,
            userName,
            content,
            mentions: mentions || [],
            reactions: [],
            createdAt: new Date().toISOString(),
            isEdited: false
        };

        await this.updateTask(taskId, {
            comments: [...(task.comments || []), newComment]
        });
    }

    /**
     * Log time spent
     */
    async logTime(
        taskId: string,
        userId: string,
        userName: string,
        hours: number,
        description: string
    ): Promise<void> {
        const task = await this.getTaskById(taskId);
        if (!task) return;

        const timeEntry = {
            id: `time-${Date.now()}`,
            userId,
            userName,
            startTime: new Date().toISOString(),
            duration: hours * 60, // Convert to minutes
            description
        };

        await this.updateTask(taskId, {
            timeEntries: [...(task.timeEntries || []), timeEntry],
            timeSpent: (task.timeSpent || 0) + hours
        });
    }

    // ==========================================================================
    // DELETE
    // ==========================================================================

    /**
     * Delete task
     */
    async deleteTask(taskId: string): Promise<void> {
        if (db && isFirebaseConfigured) {
            try {
                await deleteDoc(doc(db, COLLECTION_NAME, taskId));
                return;
            } catch (error) {
                console.error('Error deleting task from Firestore:', error);
            }
        }

        // Local storage fallback
        const tasks = getLocalTasks();
        const filtered = tasks.filter(t => t.id !== taskId);
        saveLocalTasks(filtered);
    }

    /**
     * Delete tasks by client
     */
    async deleteTasksByClient(clientId: string): Promise<number> {
        const tasks = await this.getTasksByClient(clientId);

        for (const task of tasks) {
            await this.deleteTask(task.id);
        }

        return tasks.length;
    }

    // ==========================================================================
    // REAL-TIME SYNC
    // ==========================================================================

    /**
     * Subscribe to task changes
     */
    subscribeToTasks(
        callback: (tasks: Task[]) => void,
        filters: { assignedTo?: string; clientId?: string } = {}
    ): Unsubscribe | null {
        if (!db || !isFirebaseConfigured) {
            console.warn('Real-time sync not available - Firestore not configured');
            return null;
        }

        const constraints: any[] = [];

        if (filters.assignedTo) {
            constraints.push(where('assignedTo', '==', filters.assignedTo));
        }
        if (filters.clientId) {
            constraints.push(where('clientId', '==', filters.clientId));
        }

        constraints.push(orderBy('createdAt', 'desc'));

        const q = query(collection(db, COLLECTION_NAME), ...constraints);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const tasks = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Task[];

            callback(tasks);
        }, (error) => {
            console.error('Error in real-time sync:', error);
        });

        // Store unsubscribe for cleanup
        const key = `${filters.assignedTo || ''}_${filters.clientId || ''}`;
        this.unsubscribeListeners.set(key, unsubscribe);

        return unsubscribe;
    }

    /**
     * Subscribe to single task
     */
    subscribeToTask(
        taskId: string,
        callback: (task: Task | null) => void
    ): Unsubscribe | null {
        if (!db || !isFirebaseConfigured) return null;

        const unsubscribe = onSnapshot(
            doc(db, COLLECTION_NAME, taskId),
            (docSnap) => {
                if (docSnap.exists()) {
                    callback({ id: docSnap.id, ...docSnap.data() } as Task);
                } else {
                    callback(null);
                }
            },
            (error) => {
                console.error('Error in task subscription:', error);
                callback(null);
            }
        );

        this.unsubscribeListeners.set(`task_${taskId}`, unsubscribe);
        return unsubscribe;
    }

    /**
     * Unsubscribe all listeners
     */
    cleanup(): void {
        this.unsubscribeListeners.forEach(unsub => unsub());
        this.unsubscribeListeners.clear();
    }

    // ==========================================================================
    // STATISTICS
    // ==========================================================================

    /**
     * Get task statistics
     */
    async getStatistics(filters: { clientId?: string; assignedTo?: string } = {}): Promise<{
        total: number;
        byStatus: Record<TaskStatus, number>;
        byCategory: Record<TaskCategory, number>;
        byPriority: Record<TaskPriority, number>;
        overdue: number;
        completedThisMonth: number;
        avgCompletionTime: number;
    }> {
        const tasks = await this.getTasks(filters);
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const byStatus: Record<string, number> = {};
        const byCategory: Record<string, number> = {};
        const byPriority: Record<string, number> = {};

        let overdue = 0;
        let completedThisMonth = 0;
        let totalCompletionTime = 0;
        let completedCount = 0;

        for (const task of tasks) {
            // Count by status
            byStatus[task.status] = (byStatus[task.status] || 0) + 1;

            // Count by category
            if (task.category) {
                byCategory[task.category] = (byCategory[task.category] || 0) + 1;
            }

            // Count by priority
            byPriority[task.priority] = (byPriority[task.priority] || 0) + 1;

            // Count overdue
            if (task.dueDate && new Date(task.dueDate) < now &&
                !['completed', 'cancelled'].includes(task.status)) {
                overdue++;
            }

            // Count completed this month
            if (task.status === 'completed' && task.completedAt) {
                const completedDate = new Date(task.completedAt);
                if (completedDate >= startOfMonth) {
                    completedThisMonth++;
                }

                // Calculate completion time
                const createdDate = new Date(task.createdAt);
                totalCompletionTime += (completedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
                completedCount++;
            }
        }

        return {
            total: tasks.length,
            byStatus: byStatus as Record<TaskStatus, number>,
            byCategory: byCategory as Record<TaskCategory, number>,
            byPriority: byPriority as Record<TaskPriority, number>,
            overdue,
            completedThisMonth,
            avgCompletionTime: completedCount > 0 ? totalCompletionTime / completedCount : 0
        };
    }
}

// ============================================================================
// EXPORT
// ============================================================================

export const taskDatabase = new TaskDatabaseService();

export default taskDatabase;

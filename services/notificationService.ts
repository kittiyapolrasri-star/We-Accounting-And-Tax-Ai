/**
 * In-App Notification Service
 * จัดการการแจ้งเตือนใน App ผ่าน Firestore
 */

import { db, isFirebaseConfigured } from './firebase';
import {
    collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
    query, where, orderBy, limit, serverTimestamp, onSnapshot, Unsubscribe, writeBatch
} from 'firebase/firestore';

// ============================================================================
// TYPES
// ============================================================================

export type NotificationType =
    | 'task_assigned'
    | 'task_completed'
    | 'task_overdue'
    | 'deadline_reminder'
    | 'document_uploaded'
    | 'document_approved'
    | 'document_rejected'
    | 'tax_deadline'
    | 'client_update'
    | 'system_alert'
    | 'mention';

export interface AppNotification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    icon?: string;
    timestamp: string;
    read: boolean;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    recipientId: string;
    actionUrl?: string;
    actionLabel?: string;
    metadata?: {
        taskId?: string;
        documentId?: string;
        clientId?: string;
        userId?: string;
        [key: string]: any;
    };
}

const NOTIFICATIONS_COLLECTION = 'notifications';

// ============================================================================
// LOAD NOTIFICATIONS
// ============================================================================

export const loadNotifications = async (
    userId: string,
    options: {
        unreadOnly?: boolean;
        limitCount?: number;
    } = {}
): Promise<AppNotification[]> => {
    if (!isFirebaseConfigured || !db) {
        console.log('Firebase not configured, returning empty notifications');
        return [];
    }

    try {
        const notificationsRef = collection(db, NOTIFICATIONS_COLLECTION);
        let q;

        if (options.unreadOnly) {
            q = query(
                notificationsRef,
                where('recipientId', '==', userId),
                where('read', '==', false),
                orderBy('timestamp', 'desc'),
                limit(options.limitCount || 50)
            );
        } else {
            q = query(
                notificationsRef,
                where('recipientId', '==', userId),
                orderBy('timestamp', 'desc'),
                limit(options.limitCount || 50)
            );
        }

        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || doc.data().timestamp
        })) as AppNotification[];
    } catch (error) {
        console.error('Error loading notifications:', error);
        return [];
    }
};

// ============================================================================
// REAL-TIME NOTIFICATIONS
// ============================================================================

export const subscribeToNotifications = (
    userId: string,
    callback: (notifications: AppNotification[]) => void
): Unsubscribe | null => {
    if (!isFirebaseConfigured || !db) {
        console.log('Firebase not configured, cannot subscribe to notifications');
        return null;
    }

    try {
        const notificationsRef = collection(db, NOTIFICATIONS_COLLECTION);
        const q = query(
            notificationsRef,
            where('recipientId', '==', userId),
            orderBy('timestamp', 'desc'),
            limit(50)
        );

        return onSnapshot(q, (snapshot) => {
            const notifications = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || doc.data().timestamp
            })) as AppNotification[];

            callback(notifications);
        });
    } catch (error) {
        console.error('Error subscribing to notifications:', error);
        return null;
    }
};

// ============================================================================
// CREATE NOTIFICATION
// ============================================================================

export const createNotification = async (
    notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>
): Promise<{ success: boolean; id?: string; error?: string }> => {
    if (!isFirebaseConfigured || !db) {
        return { success: false, error: 'Firebase not configured' };
    }

    try {
        const notificationsRef = collection(db, NOTIFICATIONS_COLLECTION);
        const docRef = await addDoc(notificationsRef, {
            ...notification,
            read: false,
            timestamp: serverTimestamp()
        });

        return { success: true, id: docRef.id };
    } catch (error: any) {
        console.error('Error creating notification:', error);
        return { success: false, error: error.message };
    }
};

// Create notification for multiple recipients
export const createNotificationBulk = async (
    notification: Omit<AppNotification, 'id' | 'timestamp' | 'read' | 'recipientId'>,
    recipientIds: string[]
): Promise<{ success: boolean; count: number; error?: string }> => {
    if (!isFirebaseConfigured || !db) {
        return { success: false, count: 0, error: 'Firebase not configured' };
    }

    try {
        const notificationsRef = collection(db, NOTIFICATIONS_COLLECTION);
        let count = 0;

        for (const recipientId of recipientIds) {
            await addDoc(notificationsRef, {
                ...notification,
                recipientId,
                read: false,
                timestamp: serverTimestamp()
            });
            count++;
        }

        return { success: true, count };
    } catch (error: any) {
        console.error('Error creating bulk notifications:', error);
        return { success: false, count: 0, error: error.message };
    }
};

// ============================================================================
// MARK AS READ
// ============================================================================

export const markAsRead = async (
    notificationId: string
): Promise<{ success: boolean; error?: string }> => {
    if (!isFirebaseConfigured || !db) {
        return { success: false, error: 'Firebase not configured' };
    }

    try {
        const docRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
        await updateDoc(docRef, {
            read: true,
            readAt: serverTimestamp()
        });
        return { success: true };
    } catch (error: any) {
        console.error('Error marking notification as read:', error);
        return { success: false, error: error.message };
    }
};

export const markAllAsRead = async (
    userId: string
): Promise<{ success: boolean; count: number; error?: string }> => {
    if (!isFirebaseConfigured || !db) {
        return { success: false, count: 0, error: 'Firebase not configured' };
    }

    try {
        const notificationsRef = collection(db, NOTIFICATIONS_COLLECTION);
        const q = query(
            notificationsRef,
            where('recipientId', '==', userId),
            where('read', '==', false)
        );
        const snapshot = await getDocs(q);

        const batch = writeBatch(db);
        snapshot.docs.forEach(docSnap => {
            batch.update(docSnap.ref, { read: true, readAt: serverTimestamp() });
        });

        await batch.commit();
        return { success: true, count: snapshot.size };
    } catch (error: any) {
        console.error('Error marking all notifications as read:', error);
        return { success: false, count: 0, error: error.message };
    }
};

// ============================================================================
// DELETE NOTIFICATIONS
// ============================================================================

export const deleteNotification = async (
    notificationId: string
): Promise<{ success: boolean; error?: string }> => {
    if (!isFirebaseConfigured || !db) {
        return { success: false, error: 'Firebase not configured' };
    }

    try {
        await deleteDoc(doc(db, NOTIFICATIONS_COLLECTION, notificationId));
        return { success: true };
    } catch (error: any) {
        console.error('Error deleting notification:', error);
        return { success: false, error: error.message };
    }
};

export const clearAllNotifications = async (
    userId: string
): Promise<{ success: boolean; count: number; error?: string }> => {
    if (!isFirebaseConfigured || !db) {
        return { success: false, count: 0, error: 'Firebase not configured' };
    }

    try {
        const notificationsRef = collection(db, NOTIFICATIONS_COLLECTION);
        const q = query(notificationsRef, where('recipientId', '==', userId));
        const snapshot = await getDocs(q);

        const batch = writeBatch(db);
        snapshot.docs.forEach(docSnap => {
            batch.delete(docSnap.ref);
        });

        await batch.commit();
        return { success: true, count: snapshot.size };
    } catch (error: any) {
        console.error('Error clearing all notifications:', error);
        return { success: false, count: 0, error: error.message };
    }
};

// ============================================================================
// GET UNREAD COUNT
// ============================================================================

export const getUnreadCount = async (userId: string): Promise<number> => {
    if (!isFirebaseConfigured || !db) {
        return 0;
    }

    try {
        const notificationsRef = collection(db, NOTIFICATIONS_COLLECTION);
        const q = query(
            notificationsRef,
            where('recipientId', '==', userId),
            where('read', '==', false)
        );
        const snapshot = await getDocs(q);
        return snapshot.size;
    } catch (error) {
        console.error('Error getting unread count:', error);
        return 0;
    }
};

// ============================================================================
// HELPER: CREATE STANDARD NOTIFICATIONS
// ============================================================================

export const notifyTaskAssigned = async (
    recipientId: string,
    taskId: string,
    taskTitle: string,
    assignedBy?: string
): Promise<{ success: boolean }> => {
    return createNotification({
        type: 'task_assigned',
        title: 'งานใหม่ได้รับมอบหมาย',
        message: `คุณได้รับมอบหมายงาน "${taskTitle}"`,
        priority: 'high',
        recipientId,
        actionLabel: 'ดูงาน',
        metadata: { taskId, assignedBy }
    });
};

export const notifyDeadlineReminder = async (
    recipientId: string,
    taskId: string,
    taskTitle: string,
    daysLeft: number
): Promise<{ success: boolean }> => {
    return createNotification({
        type: 'deadline_reminder',
        title: 'Deadline ใกล้ถึง',
        message: `งาน "${taskTitle}" ครบกำหนดใน ${daysLeft} วัน`,
        priority: daysLeft <= 1 ? 'urgent' : 'high',
        recipientId,
        actionLabel: 'ไปที่งาน',
        metadata: { taskId, daysLeft }
    });
};

export const notifyDocumentProcessed = async (
    recipientId: string,
    documentId: string,
    documentName: string,
    status: 'approved' | 'rejected'
): Promise<{ success: boolean }> => {
    return createNotification({
        type: status === 'approved' ? 'document_approved' : 'document_rejected',
        title: status === 'approved' ? 'เอกสารได้รับการอนุมัติ' : 'เอกสารถูกปฏิเสธ',
        message: `เอกสาร "${documentName}" ${status === 'approved' ? 'ได้รับการอนุมัติแล้ว' : 'ถูกปฏิเสธ'}`,
        priority: 'normal',
        recipientId,
        metadata: { documentId }
    });
};

export const notifyTaxDeadline = async (
    recipientId: string,
    formType: string,
    dueDate: string,
    clientName?: string
): Promise<{ success: boolean }> => {
    return createNotification({
        type: 'tax_deadline',
        title: 'กำหนดยื่นภาษี',
        message: clientName
            ? `กำหนดยื่น ${formType} ของ ${clientName} ภายในวันที่ ${dueDate}`
            : `กำหนดยื่น ${formType} ภายในวันที่ ${dueDate}`,
        priority: 'high',
        recipientId,
        metadata: { formType, dueDate, clientName }
    });
};

export default {
    loadNotifications,
    subscribeToNotifications,
    createNotification,
    createNotificationBulk,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    getUnreadCount,
    notifyTaskAssigned,
    notifyDeadlineReminder,
    notifyDocumentProcessed,
    notifyTaxDeadline
};

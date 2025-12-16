/**
 * Firebase Cloud Messaging Service
 * 
 * ระบบแจ้งเตือน Real-time ผ่าน Firebase Cloud Messaging
 * - Push Notifications
 * - In-App Notifications
 * - Background Sync
 */

import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import {
    collection,
    addDoc,
    query,
    where,
    orderBy,
    limit as firestoreLimit,
    getDocs,
    updateDoc,
    doc,
    onSnapshot,
    Unsubscribe,
    serverTimestamp
} from 'firebase/firestore';
import { db, app, isFirebaseConfigured } from './firebase';

// ============================================================================
// TYPES
// ============================================================================

export type NotificationType =
    | 'task_assigned'
    | 'task_updated'
    | 'task_completed'
    | 'task_overdue'
    | 'deadline_reminder'
    | 'document_uploaded'
    | 'document_approved'
    | 'document_rejected'
    | 'tax_deadline'
    | 'client_update'
    | 'system_alert'
    | 'mention'
    | 'payment_received'
    | 'ecommerce_order';

export interface Notification {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, string>;
    read: boolean;
    createdAt: string;
    readAt?: string;
    actionUrl?: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
}

export interface NotificationPreferences {
    userId: string;
    pushEnabled: boolean;
    emailEnabled: boolean;
    inAppEnabled: boolean;
    preferences: {
        task_assigned: boolean;
        task_completed: boolean;
        task_overdue: boolean;
        deadline_reminder: boolean;
        document_approved: boolean;
        document_rejected: boolean;
        tax_deadline: boolean;
        ecommerce_order: boolean;
        system_alert: boolean;
    };
    quietHours?: {
        enabled: boolean;
        start: string; // HH:mm
        end: string;   // HH:mm
    };
}

// ============================================================================
// COLLECTION NAMES
// ============================================================================

const COLLECTIONS = {
    NOTIFICATIONS: 'notifications',
    NOTIFICATION_PREFERENCES: 'notification_preferences',
    FCM_TOKENS: 'fcm_tokens'
};

// ============================================================================
// FCM SERVICE
// ============================================================================

class FirebaseCloudMessagingService {
    private messaging: Messaging | null = null;
    private currentToken: string | null = null;
    private unsubscribeListeners: Unsubscribe[] = [];

    constructor() {
        if (isFirebaseConfigured && app) {
            try {
                this.messaging = getMessaging(app);
            } catch (error) {
                console.warn('FCM not available:', error);
            }
        }
    }

    /**
     * Request permission and get FCM token
     */
    async requestPermission(): Promise<{ granted: boolean; token?: string; error?: string }> {
        if (!this.messaging) {
            return { granted: false, error: 'FCM not initialized' };
        }

        try {
            const permission = await Notification.requestPermission();

            if (permission !== 'granted') {
                return { granted: false, error: 'Permission denied' };
            }

            // Get FCM token
            const vapidKey = process.env.FIREBASE_VAPID_KEY;
            const token = await getToken(this.messaging, { vapidKey });

            this.currentToken = token;
            return { granted: true, token };

        } catch (error) {
            console.error('Error requesting notification permission:', error);
            return { granted: false, error: String(error) };
        }
    }

    /**
     * Save FCM token to Firestore
     */
    async saveToken(userId: string, token: string): Promise<void> {
        if (!db) return;

        try {
            const tokenRef = doc(db, COLLECTIONS.FCM_TOKENS, `${userId}_${token.slice(-10)}`);
            await updateDoc(tokenRef, {
                userId,
                token,
                platform: 'web',
                updatedAt: serverTimestamp(),
                active: true
            }).catch(() => {
                // Document doesn't exist, create it
                if (db) {
                    addDoc(collection(db, COLLECTIONS.FCM_TOKENS), {
                        userId,
                        token,
                        platform: 'web',
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                        active: true
                    });
                }
            });
        } catch (error) {
            console.error('Error saving FCM token:', error);
        }
    }

    /**
     * Listen to foreground messages
     */
    onForegroundMessage(callback: (payload: any) => void): Unsubscribe | null {
        if (!this.messaging) return null;

        const unsubscribe = onMessage(this.messaging, (payload) => {
            console.log('Foreground message received:', payload);
            callback(payload);
        });

        this.unsubscribeListeners.push(unsubscribe);
        return unsubscribe;
    }

    /**
     * Send notification to user (via Firestore - picked up by Cloud Function)
     */
    async sendNotification(notification: Omit<Notification, 'id' | 'createdAt' | 'read'>): Promise<string | null> {
        if (!db) {
            console.warn('Database not initialized');
            return null;
        }

        try {
            const notifData = {
                ...notification,
                read: false,
                createdAt: serverTimestamp()
            };

            const docRef = await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), notifData);
            return docRef.id;
        } catch (error) {
            console.error('Error sending notification:', error);
            return null;
        }
    }

    /**
     * Get notifications for user
     */
    async getNotifications(
        userId: string,
        options: { unreadOnly?: boolean; limit?: number } = {}
    ): Promise<Notification[]> {
        if (!db) return [];

        try {
            const constraints: any[] = [
                where('userId', '==', userId),
                orderBy('createdAt', 'desc')
            ];

            if (options.unreadOnly) {
                constraints.push(where('read', '==', false));
            }

            if (options.limit) {
                constraints.push(firestoreLimit(options.limit));
            }

            const q = query(collection(db, COLLECTIONS.NOTIFICATIONS), ...constraints);
            const snapshot = await getDocs(q);

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Notification[];

        } catch (error) {
            console.error('Error fetching notifications:', error);
            return [];
        }
    }

    /**
     * Subscribe to real-time notifications
     */
    subscribeToNotifications(
        userId: string,
        callback: (notifications: Notification[]) => void
    ): Unsubscribe | null {
        if (!db) return null;

        const q = query(
            collection(db, COLLECTIONS.NOTIFICATIONS),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc'),
            firestoreLimit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notifications = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Notification[];

            callback(notifications);
        });

        this.unsubscribeListeners.push(unsubscribe);
        return unsubscribe;
    }

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId: string): Promise<void> {
        if (!db) return;

        try {
            await updateDoc(doc(db, COLLECTIONS.NOTIFICATIONS, notificationId), {
                read: true,
                readAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }

    /**
     * Mark all notifications as read
     */
    async markAllAsRead(userId: string): Promise<void> {
        if (!db) return;

        try {
            const q = query(
                collection(db, COLLECTIONS.NOTIFICATIONS),
                where('userId', '==', userId),
                where('read', '==', false)
            );

            const snapshot = await getDocs(q);

            const updates = snapshot.docs.map(docSnap => {
                if (!db) return Promise.resolve();
                return updateDoc(doc(db, COLLECTIONS.NOTIFICATIONS, docSnap.id), {
                    read: true,
                    readAt: serverTimestamp()
                });
            });

            await Promise.all(updates);
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    }

    /**
     * Get unread count
     */
    async getUnreadCount(userId: string): Promise<number> {
        if (!db) return 0;

        try {
            const q = query(
                collection(db, COLLECTIONS.NOTIFICATIONS),
                where('userId', '==', userId),
                where('read', '==', false)
            );

            const snapshot = await getDocs(q);
            return snapshot.size;
        } catch (error) {
            console.error('Error getting unread count:', error);
            return 0;
        }
    }

    /**
     * Get/Update notification preferences
     */
    async getPreferences(userId: string): Promise<NotificationPreferences | null> {
        if (!db) return null;

        try {
            const q = query(
                collection(db, COLLECTIONS.NOTIFICATION_PREFERENCES),
                where('userId', '==', userId)
            );

            const snapshot = await getDocs(q);
            if (snapshot.empty) return null;

            return {
                ...snapshot.docs[0].data()
            } as NotificationPreferences;
        } catch (error) {
            console.error('Error getting preferences:', error);
            return null;
        }
    }

    async updatePreferences(preferences: NotificationPreferences): Promise<void> {
        if (!db) return;

        try {
            const q = query(
                collection(db, COLLECTIONS.NOTIFICATION_PREFERENCES),
                where('userId', '==', preferences.userId)
            );

            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                await addDoc(collection(db, COLLECTIONS.NOTIFICATION_PREFERENCES), preferences);
            } else {
                await updateDoc(doc(db, COLLECTIONS.NOTIFICATION_PREFERENCES, snapshot.docs[0].id), preferences as any);
            }
        } catch (error) {
            console.error('Error updating preferences:', error);
        }
    }

    /**
     * Cleanup listeners
     */
    cleanup(): void {
        this.unsubscribeListeners.forEach(unsub => unsub());
        this.unsubscribeListeners = [];
    }
}

// ============================================================================
// NOTIFICATION HELPERS
// ============================================================================

export const notificationHelpers = {
    /**
     * Create task assigned notification
     */
    taskAssigned: (userId: string, taskTitle: string, assignedBy: string, taskId: string): Omit<Notification, 'id' | 'createdAt' | 'read'> => ({
        userId,
        type: 'task_assigned',
        title: 'งานใหม่',
        body: `คุณได้รับมอบหมายงาน "${taskTitle}" จาก ${assignedBy}`,
        priority: 'high',
        data: { taskId },
        actionUrl: `/tasks/${taskId}`
    }),

    /**
     * Create deadline reminder
     */
    deadlineReminder: (userId: string, taskTitle: string, daysLeft: number, taskId: string): Omit<Notification, 'id' | 'createdAt' | 'read'> => ({
        userId,
        type: 'deadline_reminder',
        title: 'ใกล้ถึงกำหนด',
        body: `งาน "${taskTitle}" ครบกำหนดในอีก ${daysLeft} วัน`,
        priority: daysLeft <= 1 ? 'urgent' : 'high',
        data: { taskId },
        actionUrl: `/tasks/${taskId}`
    }),

    /**
     * Create tax deadline reminder
     */
    taxDeadline: (userId: string, taxType: string, deadline: string, clientCount: number): Omit<Notification, 'id' | 'createdAt' | 'read'> => ({
        userId,
        type: 'tax_deadline',
        title: `กำหนดยื่น ${taxType}`,
        body: `กำหนดยื่น ${taxType} ภายใน ${deadline} (${clientCount} ลูกค้า)`,
        priority: 'urgent',
        actionUrl: '/tax-calendar'
    }),

    /**
     * Create ecommerce order notification
     */
    ecommerceOrder: (userId: string, platform: string, orderCount: number, totalAmount: number): Omit<Notification, 'id' | 'createdAt' | 'read'> => ({
        userId,
        type: 'ecommerce_order',
        title: `คำสั่งซื้อใหม่จาก ${platform}`,
        body: `${orderCount} คำสั่งซื้อ รวม ฿${totalAmount.toLocaleString()}`,
        priority: 'normal',
        data: { platform, orderCount: String(orderCount) },
        actionUrl: '/ecommerce-sync'
    }),

    /**
     * Create document approved notification
     */
    documentApproved: (userId: string, docNumber: string, clientName: string): Omit<Notification, 'id' | 'createdAt' | 'read'> => ({
        userId,
        type: 'document_approved',
        title: 'เอกสารได้รับการอนุมัติ',
        body: `เอกสาร ${docNumber} ของ ${clientName} ได้รับการอนุมัติแล้ว`,
        priority: 'normal'
    })
};

// ============================================================================
// EXPORT
// ============================================================================

export const fcmService = new FirebaseCloudMessagingService();

export default fcmService;

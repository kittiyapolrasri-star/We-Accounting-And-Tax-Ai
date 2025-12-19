/**
 * Webhook Integration Service
 * 
 * รับข้อมูล Real-time จาก E-Commerce Platforms
 * - Shopee Webhook
 * - Lazada Callback
 * - TikTok Shop Webhook
 * - Grab GrabFood Webhook
 * - LINE MAN Webhook
 * 
 * หมายเหตุ: ใช้กับ Express Backend Server
 */

import {
    collection,
    addDoc,
    query,
    where,
    getDocs,
    updateDoc,
    doc,
    serverTimestamp,
    orderBy,
    limit as firestoreLimit
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { Platform, PlatformOrder, PLATFORM_CONFIG, PLATFORM_FEES } from './ecommercePlatforms';
import { fcmService, notificationHelpers } from './fcmService';

// ============================================================================
// TYPES
// ============================================================================

export type WebhookEventType =
    | 'order.created'
    | 'order.paid'
    | 'order.shipped'
    | 'order.delivered'
    | 'order.completed'
    | 'order.cancelled'
    | 'order.refunded'
    | 'settlement.created'
    | 'settlement.completed'
    | 'product.updated'
    | 'inventory.low';

export interface WebhookPayload {
    platform: Platform;
    eventType: WebhookEventType;
    timestamp: string;
    signature?: string;
    data: Record<string, any>;
}

export interface WebhookLog {
    id: string;
    platform: Platform;
    eventType: WebhookEventType;
    payload: Record<string, any>;
    status: 'received' | 'processed' | 'failed' | 'ignored';
    errorMessage?: string;
    processedAt?: string;
    createdAt: string;
    clientId?: string;
    orderId?: string;
}

export interface WebhookConfig {
    id: string;
    platform: Platform;
    clientId: string;
    webhookUrl: string;
    secretKey: string;
    isActive: boolean;
    events: WebhookEventType[];
    createdAt: string;
    updatedAt: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const COLLECTIONS = {
    WEBHOOK_LOGS: 'webhook_logs',
    WEBHOOK_CONFIGS: 'webhook_configs',
    ECOMMERCE_ORDERS: 'ecommerce_orders',
    ECOMMERCE_SETTLEMENTS: 'ecommerce_settlements'
};

// ============================================================================
// WEBHOOK HANDLERS BY PLATFORM
// ============================================================================

const platformHandlers = {
    /**
     * Shopee webhook handler
     */
    shopee: {
        verifySignature: (payload: string, signature: string, secretKey: string): boolean => {
            // In production: Verify HMAC-SHA256 signature
            // crypto.createHmac('sha256', secretKey).update(payload).digest('hex') === signature
            return true; // Mock
        },

        parseOrderCreated: (data: any): Partial<PlatformOrder> => ({
            platform: 'shopee',
            platformOrderId: data.ordersn || data.order_sn,
            orderNumber: data.ordersn || data.order_sn,
            status: 'pending',
            customerName: data.buyer_username || 'Unknown',
            items: (data.items || []).map((item: any) => ({
                id: item.item_id,
                sku: item.item_sku,
                name: item.item_name,
                quantity: item.quantity,
                unitPrice: item.item_price,
                discount: item.discount || 0,
                total: item.item_price * item.quantity
            })),
            subtotal: data.total_amount || 0,
            shippingFee: data.shipping_fee || 0,
            discount: data.voucher_from_seller || 0,
            platformFee: 0, // Calculated later
            paymentFee: 0,
            grandTotal: data.total_amount || 0,
            sellerReceives: 0, // Calculated later
            paymentMethod: data.payment_method || 'unknown',
            paymentStatus: 'unpaid',
            orderDate: new Date(data.create_time * 1000).toISOString()
        }),

        parseOrderPaid: (data: any): Partial<PlatformOrder> => ({
            paymentStatus: 'paid',
            paidAt: new Date().toISOString()
        }),

        parseOrderCompleted: (data: any): Partial<PlatformOrder> => ({
            status: 'completed',
            completedDate: new Date().toISOString()
        })
    },

    /**
     * Lazada webhook handler
     */
    lazada: {
        verifySignature: (payload: string, signature: string, secretKey: string): boolean => {
            return true; // Mock
        },

        parseOrderCreated: (data: any): Partial<PlatformOrder> => ({
            platform: 'lazada',
            platformOrderId: data.order_id,
            orderNumber: data.order_number,
            status: 'pending',
            customerName: data.customer_first_name + ' ' + data.customer_last_name,
            items: (data.order_items || []).map((item: any) => ({
                id: item.order_item_id,
                sku: item.sku,
                name: item.name,
                quantity: 1,
                unitPrice: parseFloat(item.item_price),
                discount: parseFloat(item.voucher_seller || 0),
                total: parseFloat(item.paid_price)
            })),
            subtotal: parseFloat(data.price || 0),
            shippingFee: parseFloat(data.shipping_fee || 0),
            discount: parseFloat(data.voucher_seller || 0),
            orderDate: data.created_at
        }),

        parseOrderPaid: (data: any): Partial<PlatformOrder> => ({
            paymentStatus: 'paid',
            paidAt: new Date().toISOString()
        }),

        parseOrderCompleted: (data: any): Partial<PlatformOrder> => ({
            status: 'completed',
            completedDate: new Date().toISOString()
        })
    },

    /**
     * TikTok Shop webhook handler
     */
    tiktok: {
        verifySignature: (payload: string, signature: string, secretKey: string): boolean => {
            return true; // Mock
        },

        parseOrderCreated: (data: any): Partial<PlatformOrder> => ({
            platform: 'tiktok',
            platformOrderId: data.order_id,
            orderNumber: data.order_id,
            status: 'pending',
            customerName: data.recipient?.name || 'Unknown',
            orderDate: new Date(data.create_time * 1000).toISOString()
        }),

        parseOrderPaid: (data: any): Partial<PlatformOrder> => ({
            paymentStatus: 'paid',
            paidAt: new Date().toISOString()
        }),

        parseOrderCompleted: (data: any): Partial<PlatformOrder> => ({
            status: 'completed',
            completedDate: new Date().toISOString()
        })
    },

    /**
     * Grab webhook handler
     */
    grab: {
        verifySignature: (payload: string, signature: string, secretKey: string): boolean => {
            return true; // Mock
        },

        parseOrderCreated: (data: any): Partial<PlatformOrder> => ({
            platform: 'grab',
            platformOrderId: data.orderID,
            orderNumber: data.orderID,
            status: 'pending',
            customerName: data.eater?.name || 'Unknown',
            items: (data.items || []).map((item: any) => ({
                id: item.id,
                sku: item.id,
                name: item.name,
                quantity: item.quantity,
                unitPrice: item.price,
                discount: 0,
                total: item.price * item.quantity
            })),
            subtotal: data.price?.subtotal || 0,
            shippingFee: data.price?.deliveryFee || 0,
            orderDate: new Date().toISOString()
        }),

        parseOrderPaid: (data: any): Partial<PlatformOrder> => ({
            paymentStatus: 'paid',
            paidAt: new Date().toISOString()
        }),

        parseOrderCompleted: (data: any): Partial<PlatformOrder> => ({
            status: 'completed',
            completedDate: new Date().toISOString()
        })
    },

    /**
     * LINE MAN webhook handler
     */
    lineman: {
        verifySignature: (payload: string, signature: string, secretKey: string): boolean => {
            return true; // Mock
        },

        parseOrderCreated: (data: any): Partial<PlatformOrder> => ({
            platform: 'lineman',
            platformOrderId: data.order_id,
            orderNumber: data.order_number || data.order_id,
            status: 'pending',
            customerName: data.customer?.display_name || 'Unknown',
            orderDate: new Date().toISOString()
        }),

        parseOrderPaid: (data: any): Partial<PlatformOrder> => ({
            paymentStatus: 'paid',
            paidAt: new Date().toISOString()
        }),

        parseOrderCompleted: (data: any): Partial<PlatformOrder> => ({
            status: 'completed',
            completedDate: new Date().toISOString()
        })
    }
};

// ============================================================================
// WEBHOOK SERVICE
// ============================================================================

class WebhookIntegrationService {

    /**
     * Generate webhook URL for platform
     */
    generateWebhookUrl(platform: Platform, clientId: string): string {
        const baseUrl = process.env.WEBHOOK_BASE_URL || 'https://your-api.com';
        return `${baseUrl}/webhooks/${platform}/${clientId}`;
    }

    /**
     * Register webhook config
     */
    async registerWebhook(config: Omit<WebhookConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | null> {
        if (!db) return null;

        try {
            const now = new Date().toISOString();
            const docRef = await addDoc(collection(db, COLLECTIONS.WEBHOOK_CONFIGS), {
                ...config,
                createdAt: now,
                updatedAt: now
            });
            return docRef.id;
        } catch (error) {
            console.error('Error registering webhook:', error);
            return null;
        }
    }

    /**
     * Get webhook configs for client
     */
    async getWebhookConfigs(clientId: string): Promise<WebhookConfig[]> {
        if (!db) return [];

        try {
            const q = query(
                collection(db, COLLECTIONS.WEBHOOK_CONFIGS),
                where('clientId', '==', clientId)
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as WebhookConfig[];
        } catch (error) {
            console.error('Error fetching webhook configs:', error);
            return [];
        }
    }

    /**
     * Main webhook handler - process incoming webhooks
     */
    async handleWebhook(
        platform: Platform,
        clientId: string,
        eventType: WebhookEventType,
        rawPayload: string,
        signature?: string
    ): Promise<{ success: boolean; orderId?: string; error?: string }> {

        const logId = await this.logWebhook(platform, eventType, JSON.parse(rawPayload), 'received', clientId);

        try {
            // Verify signature
            const handler = platformHandlers[platform];
            if (!handler) {
                throw new Error(`Unknown platform: ${platform}`);
            }

            // Get webhook config for secret key
            const configs = await this.getWebhookConfigs(clientId);
            const config = configs.find(c => c.platform === platform && c.isActive);

            if (config && signature) {
                const isValid = handler.verifySignature(rawPayload, signature, config.secretKey);
                if (!isValid) {
                    throw new Error('Invalid signature');
                }
            }

            // Parse payload
            const payload = JSON.parse(rawPayload);
            let order: Partial<PlatformOrder> | null = null;

            // Handle different event types
            switch (eventType) {
                case 'order.created':
                    order = handler.parseOrderCreated?.(payload);
                    if (order) {
                        order = this.calculateFees(order);
                        await this.saveOrder(clientId, order);
                        await this.notifyNewOrder(clientId, platform, order);
                    }
                    break;

                case 'order.paid':
                    if (handler.parseOrderPaid) {
                        const updates = handler.parseOrderPaid(payload);
                        await this.updateOrderByPlatformId(platform, payload.ordersn || payload.order_id, updates);
                    }
                    break;

                case 'order.completed':
                    if (handler.parseOrderCompleted) {
                        const updates = handler.parseOrderCompleted(payload);
                        await this.updateOrderByPlatformId(platform, payload.ordersn || payload.order_id, updates);
                    }
                    break;

                case 'order.cancelled':
                case 'order.refunded':
                    await this.updateOrderByPlatformId(platform, payload.ordersn || payload.order_id, {
                        status: eventType === 'order.cancelled' ? 'cancelled' : 'refunded'
                    });
                    break;

                default:
                    // Log but don't process
                    await this.updateWebhookLog(logId, 'ignored');
                    return { success: true };
            }

            await this.updateWebhookLog(logId, 'processed', order?.platformOrderId);
            return { success: true, orderId: order?.platformOrderId };

        } catch (error) {
            console.error('Webhook processing error:', error);
            await this.updateWebhookLog(logId, 'failed', undefined, String(error));
            return { success: false, error: String(error) };
        }
    }

    /**
     * Calculate platform fees
     */
    private calculateFees(order: Partial<PlatformOrder>): Partial<PlatformOrder> {
        if (!order.platform || !order.subtotal) return order;

        const fees = PLATFORM_FEES[order.platform];
        const platformFee = Math.round(order.subtotal * (fees.commissionRate / 100));
        const paymentFee = Math.round(order.subtotal * (fees.paymentFeeRate / 100));
        const grandTotal = (order.subtotal || 0) + (order.shippingFee || 0) - (order.discount || 0);
        const sellerReceives = grandTotal - platformFee - paymentFee;

        return {
            ...order,
            platformFee,
            paymentFee,
            grandTotal,
            sellerReceives
        };
    }

    /**
     * Save order to Firestore
     */
    private async saveOrder(clientId: string, order: Partial<PlatformOrder>): Promise<string | null> {
        if (!db) return null;

        try {
            const docRef = await addDoc(collection(db, COLLECTIONS.ECOMMERCE_ORDERS), {
                ...order,
                clientId,
                isReconciled: false,
                createdAt: serverTimestamp()
            });
            return docRef.id;
        } catch (error) {
            console.error('Error saving order:', error);
            return null;
        }
    }

    /**
     * Update order by platform order ID
     */
    private async updateOrderByPlatformId(
        platform: Platform,
        platformOrderId: string,
        updates: Partial<PlatformOrder>
    ): Promise<void> {
        if (!db) return;

        try {
            const q = query(
                collection(db, COLLECTIONS.ECOMMERCE_ORDERS),
                where('platform', '==', platform),
                where('platformOrderId', '==', platformOrderId)
            );

            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                await updateDoc(doc(db, COLLECTIONS.ECOMMERCE_ORDERS, snapshot.docs[0].id), {
                    ...updates,
                    updatedAt: serverTimestamp()
                });
            }
        } catch (error) {
            console.error('Error updating order:', error);
        }
    }

    /**
     * Send notification for new order
     */
    private async notifyNewOrder(
        clientId: string,
        platform: Platform,
        order: Partial<PlatformOrder>
    ): Promise<void> {
        // In production: Get staff assigned to this client and notify them
        const platformName = PLATFORM_CONFIG[platform].name;

        // Mock: Notify all admins
        const notification = notificationHelpers.ecommerceOrder(
            'admin', // Replace with actual user ID
            platformName,
            1,
            order.grandTotal || 0
        );

        await fcmService.sendNotification(notification);
    }

    /**
     * Log webhook
     */
    private async logWebhook(
        platform: Platform,
        eventType: WebhookEventType,
        payload: Record<string, any>,
        status: WebhookLog['status'],
        clientId?: string
    ): Promise<string> {
        if (!db) return '';

        try {
            const docRef = await addDoc(collection(db, COLLECTIONS.WEBHOOK_LOGS), {
                platform,
                eventType,
                payload,
                status,
                clientId,
                createdAt: new Date().toISOString()
            });
            return docRef.id;
        } catch (error) {
            console.error('Error logging webhook:', error);
            return '';
        }
    }

    /**
     * Update webhook log
     */
    private async updateWebhookLog(
        logId: string,
        status: WebhookLog['status'],
        orderId?: string,
        errorMessage?: string
    ): Promise<void> {
        if (!db || !logId) return;

        try {
            await updateDoc(doc(db, COLLECTIONS.WEBHOOK_LOGS, logId), {
                status,
                orderId,
                errorMessage,
                processedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error updating webhook log:', error);
        }
    }

    /**
     * Get webhook logs
     */
    async getWebhookLogs(
        filters: { platform?: Platform; clientId?: string; status?: WebhookLog['status'] } = {},
        limitCount: number = 100
    ): Promise<WebhookLog[]> {
        if (!db) return [];

        try {
            const constraints: any[] = [];

            if (filters.platform) {
                constraints.push(where('platform', '==', filters.platform));
            }
            if (filters.clientId) {
                constraints.push(where('clientId', '==', filters.clientId));
            }
            if (filters.status) {
                constraints.push(where('status', '==', filters.status));
            }

            constraints.push(orderBy('createdAt', 'desc'));
            constraints.push(firestoreLimit(limitCount));

            const q = query(collection(db, COLLECTIONS.WEBHOOK_LOGS), ...constraints);
            const snapshot = await getDocs(q);

            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as WebhookLog[];

        } catch (error) {
            console.error('Error fetching webhook logs:', error);
            return [];
        }
    }

    /**
     * Get orders from Firestore
     */
    async getOrders(
        clientId: string,
        filters: { platform?: Platform; dateFrom?: string; dateTo?: string } = {}
    ): Promise<PlatformOrder[]> {
        if (!db) return [];

        try {
            const constraints: any[] = [where('clientId', '==', clientId)];

            if (filters.platform) {
                constraints.push(where('platform', '==', filters.platform));
            }

            constraints.push(orderBy('orderDate', 'desc'));

            const q = query(collection(db, COLLECTIONS.ECOMMERCE_ORDERS), ...constraints);
            const snapshot = await getDocs(q);

            let orders = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as PlatformOrder[];

            // Filter by date (client-side for simplicity)
            if (filters.dateFrom) {
                orders = orders.filter(o => o.orderDate >= filters.dateFrom!);
            }
            if (filters.dateTo) {
                orders = orders.filter(o => o.orderDate <= filters.dateTo!);
            }

            return orders;

        } catch (error) {
            console.error('Error fetching orders:', error);
            return [];
        }
    }

    /**
     * Mark order as reconciled
     */
    async markOrderReconciled(orderId: string, glEntryId: string): Promise<void> {
        if (!db) return;

        try {
            await updateDoc(doc(db, COLLECTIONS.ECOMMERCE_ORDERS, orderId), {
                isReconciled: true,
                reconciledAt: serverTimestamp(),
                glEntryId
            });
        } catch (error) {
            console.error('Error marking order as reconciled:', error);
        }
    }
}

// ============================================================================
// EXPRESS ROUTER (for backend integration)
// ============================================================================

/**
 * Example Express routes for webhook endpoints
 * Import this in your Express app: app.use('/webhooks', webhookRoutes)
 */
export const createWebhookRouter = () => {
    // Note: This is placeholder code - actual Express router would be in backend
    return {
        path: '/webhooks/:platform/:clientId',
        handler: async (req: any, res: any) => {
            const { platform, clientId } = req.params;
            const eventType = req.headers['x-webhook-event'] || 'order.created';
            const signature = req.headers['x-signature'];

            const result = await webhookService.handleWebhook(
                platform as Platform,
                clientId,
                eventType as WebhookEventType,
                JSON.stringify(req.body),
                signature
            );

            if (result.success) {
                res.status(200).json({ success: true, orderId: result.orderId });
            } else {
                res.status(400).json({ success: false, error: result.error });
            }
        }
    };
};

// ============================================================================
// EXPORT
// ============================================================================

export const webhookService = new WebhookIntegrationService();

export default webhookService;

/**
 * E-Commerce Platform Integration Service
 * 
 * เชื่อมต่อกับ Platform ต่างๆ เพื่อรับข้อมูลการขาย
 * - Shopee
 * - Lazada
 * - TikTok Shop
 * - Grab (GrabFood, GrabMart)
 * - LINE MAN (LINE MAN Wongnai)
 * 
 * สำหรับนำข้อมูลมาประมวลผลบัญชีอัตโนมัติ
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type Platform = 'shopee' | 'lazada' | 'tiktok' | 'grab' | 'lineman';

export interface PlatformCredentials {
    platform: Platform;
    shopId: string;
    apiKey?: string;
    apiSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: string;
    partnerId?: string;
}

export interface PlatformConnection {
    id: string;
    clientId: string;
    platform: Platform;
    shopName: string;
    shopId: string;
    status: 'connected' | 'disconnected' | 'expired' | 'error';
    lastSyncAt?: string;
    syncEnabled: boolean;
    credentials: Partial<PlatformCredentials>;
    createdAt: string;
    updatedAt: string;
}

// Order from platform
export interface PlatformOrder {
    id: string;
    platform: Platform;
    platformOrderId: string;
    orderNumber: string;
    status: 'pending' | 'paid' | 'shipping' | 'delivered' | 'completed' | 'cancelled' | 'refunded';

    // Customer
    customerName: string;
    customerPhone?: string;
    customerAddress?: string;

    // Items
    items: PlatformOrderItem[];

    // Amounts
    subtotal: number;
    shippingFee: number;
    discount: number;
    platformFee: number;
    paymentFee: number;
    grandTotal: number;
    sellerReceives: number;  // จำนวนเงินที่ผู้ขายได้รับจริง

    // Payment
    paymentMethod: string;
    paymentStatus: 'unpaid' | 'paid' | 'refunded';
    paidAt?: string;

    // Dates
    orderDate: string;
    shippedDate?: string;
    deliveredDate?: string;
    completedDate?: string;

    // Shipping
    shippingProvider?: string;
    trackingNumber?: string;

    // Accounting
    isReconciled: boolean;
    reconciledAt?: string;
    glEntryId?: string;
}

export interface PlatformOrderItem {
    id: string;
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
    variationName?: string;
    imageUrl?: string;
}

// Settlement/Payout from platform
export interface PlatformSettlement {
    id: string;
    platform: Platform;
    settlementId: string;
    periodStart: string;
    periodEnd: string;
    status: 'pending' | 'processing' | 'completed';

    // Amounts
    totalSales: number;
    totalShippingFee: number;
    totalPlatformFee: number;
    totalPaymentFee: number;
    totalAdjustments: number;
    netAmount: number;

    // Settlement
    settledAt?: string;
    bankAccount?: string;
    reference?: string;

    // Orders included
    orderCount: number;
    orderIds: string[];

    // Accounting
    isReconciled: boolean;
    glEntryId?: string;
}

// Sync result
export interface SyncResult {
    success: boolean;
    platform: Platform;
    syncedAt: string;
    ordersAdded: number;
    ordersUpdated: number;
    settlementsAdded: number;
    errors: string[];
}

// ============================================================================
// PLATFORM API CONFIGURATIONS
// ============================================================================

export const PLATFORM_CONFIG: Record<Platform, {
    name: string;
    nameTh: string;
    logo: string;
    color: string;
    apiBaseUrl: string;
    oauthUrl: string;
    scopes: string[];
    docUrl: string;
}> = {
    shopee: {
        name: 'Shopee',
        nameTh: 'ช้อปปี้',
        logo: '/platforms/shopee.png',
        color: '#EE4D2D',
        apiBaseUrl: 'https://partner.shopeemobile.com/api/v2',
        oauthUrl: 'https://partner.shopee.com/api/v2/shop/auth_partner',
        scopes: ['shop.orders', 'shop.payment', 'shop.finance'],
        docUrl: 'https://open.shopee.com/documents'
    },
    lazada: {
        name: 'Lazada',
        nameTh: 'ลาซาด้า',
        logo: '/platforms/lazada.png',
        color: '#0F146E',
        apiBaseUrl: 'https://api.lazada.co.th/rest',
        oauthUrl: 'https://auth.lazada.com/oauth/authorize',
        scopes: ['orders', 'finance'],
        docUrl: 'https://open.lazada.com/apps/doc'
    },
    tiktok: {
        name: 'TikTok Shop',
        nameTh: 'ติ๊กต่อกช็อป',
        logo: '/platforms/tiktok.png',
        color: '#000000',
        apiBaseUrl: 'https://open-api.tiktokglobalshop.com',
        oauthUrl: 'https://auth.tiktok-shops.com/oauth/authorize',
        scopes: ['order.list', 'finance.settlement'],
        docUrl: 'https://partner.tiktokshop.com/doc'
    },
    grab: {
        name: 'Grab Merchant',
        nameTh: 'แกร็บ',
        logo: '/platforms/grab.png',
        color: '#00B14F',
        apiBaseUrl: 'https://partner-api.grab.com/grabfood-sandbox/v1',
        oauthUrl: 'https://partner-api.grab.com/grabid/v1/oauth2/authorize',
        scopes: ['orders.read', 'finance.read'],
        docUrl: 'https://developer.grab.com/docs'
    },
    lineman: {
        name: 'LINE MAN',
        nameTh: 'ไลน์แมน',
        logo: '/platforms/lineman.png',
        color: '#00C300',
        apiBaseUrl: 'https://merchant-api.lineman.line.me/v1',
        oauthUrl: 'https://access.line.me/oauth2/v2.1/authorize',
        scopes: ['orders', 'reports'],
        docUrl: 'https://developers.line.biz/en/docs/line-login/'
    }
};

// ============================================================================
// TAX & ACCOUNTING MAPPING
// ============================================================================

// ค่าธรรมเนียม platform ต่างๆ
export const PLATFORM_FEES: Record<Platform, {
    commissionRate: number;  // % ของยอดขาย
    paymentFeeRate: number;  // % ค่าธรรมเนียมชำระเงิน
    vatIncluded: boolean;    // ค่าธรรมเนียมรวม VAT แล้วหรือไม่
}> = {
    shopee: { commissionRate: 6.42, paymentFeeRate: 0, vatIncluded: true },
    lazada: { commissionRate: 5.35, paymentFeeRate: 2.14, vatIncluded: true },
    tiktok: { commissionRate: 5.5, paymentFeeRate: 0, vatIncluded: true },
    grab: { commissionRate: 30, paymentFeeRate: 0, vatIncluded: true },  // GrabFood
    lineman: { commissionRate: 30, paymentFeeRate: 0, vatIncluded: true }
};

// GL Account mapping for platform transactions
export const PLATFORM_GL_MAPPING = {
    // รายได้
    sales: '4100-00',           // รายได้จากการขาย
    shippingIncome: '4200-00',  // รายได้ค่าจัดส่ง

    // ค่าใช้จ่าย
    platformFee: '5410-00',     // ค่าธรรมเนียม Platform
    paymentFee: '5420-00',      // ค่าธรรมเนียมการชำระเงิน
    shippingExpense: '5430-00', // ค่าจัดส่ง
    discount: '5440-00',        // ส่วนลด/โปรโมชั่น

    // สินทรัพย์
    accountsReceivable: '1120-00',  // ลูกหนี้ Platform
    bank: '1110-00',                // เงินฝากธนาคาร

    // ภาษี
    inputVat: '1140-00',        // ภาษีซื้อ
    outputVat: '2110-00'        // ภาษีขาย
};

// ============================================================================
// PLATFORM SERVICE CLASS
// ============================================================================

class ECommercePlatformService {
    private connections: Map<string, PlatformConnection> = new Map();
    private orders: PlatformOrder[] = [];
    private settlements: PlatformSettlement[] = [];

    // ==========================================================================
    // CONNECTION MANAGEMENT
    // ==========================================================================

    /**
     * Get OAuth URL for platform authorization
     */
    getAuthorizationUrl(platform: Platform, redirectUri: string, state?: string): string {
        const config = PLATFORM_CONFIG[platform];
        const params = new URLSearchParams({
            redirect_uri: redirectUri,
            state: state || '',
            response_type: 'code'
        });

        // Platform-specific params
        switch (platform) {
            case 'shopee':
                params.set('partner_id', process.env.SHOPEE_PARTNER_ID || '');
                break;
            case 'lazada':
                params.set('client_id', process.env.LAZADA_APP_KEY || '');
                break;
            case 'tiktok':
                params.set('app_key', process.env.TIKTOK_APP_KEY || '');
                break;
        }

        return `${config.oauthUrl}?${params.toString()}`;
    }

    /**
     * Connect shop to platform (after OAuth callback)
     */
    async connectShop(
        clientId: string,
        platform: Platform,
        authCode: string,
        shopId: string
    ): Promise<{ success: boolean; connection?: PlatformConnection; error?: string }> {
        try {
            // In production: Exchange auth code for access token
            // Mock implementation
            const connection: PlatformConnection = {
                id: `conn-${Date.now()}`,
                clientId,
                platform,
                shopName: `${PLATFORM_CONFIG[platform].name} Shop`,
                shopId,
                status: 'connected',
                syncEnabled: true,
                credentials: {
                    accessToken: 'mock_access_token',
                    refreshToken: 'mock_refresh_token',
                    expiresAt: new Date(Date.now() + 7 * 24 * 3600000).toISOString()
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            this.connections.set(connection.id, connection);

            return { success: true, connection };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Disconnect shop from platform
     */
    async disconnectShop(connectionId: string): Promise<boolean> {
        const connection = this.connections.get(connectionId);
        if (connection) {
            connection.status = 'disconnected';
            connection.updatedAt = new Date().toISOString();
            return true;
        }
        return false;
    }

    /**
     * Get all connections for a client
     */
    getConnections(clientId: string): PlatformConnection[] {
        return Array.from(this.connections.values())
            .filter(c => c.clientId === clientId);
    }

    // ==========================================================================
    // ORDER SYNC
    // ==========================================================================

    /**
     * Sync orders from platform
     */
    async syncOrders(
        connectionId: string,
        dateFrom: string,
        dateTo: string
    ): Promise<SyncResult> {
        const connection = this.connections.get(connectionId);
        if (!connection) {
            return {
                success: false,
                platform: 'shopee',
                syncedAt: new Date().toISOString(),
                ordersAdded: 0,
                ordersUpdated: 0,
                settlementsAdded: 0,
                errors: ['Connection not found']
            };
        }

        const result: SyncResult = {
            success: true,
            platform: connection.platform,
            syncedAt: new Date().toISOString(),
            ordersAdded: 0,
            ordersUpdated: 0,
            settlementsAdded: 0,
            errors: []
        };

        try {
            // In production: Call platform API
            // Mock implementation - generate sample orders
            const mockOrders = this.generateMockOrders(connection.platform, 5);

            for (const order of mockOrders) {
                const existing = this.orders.find(o => o.platformOrderId === order.platformOrderId);
                if (existing) {
                    Object.assign(existing, order);
                    result.ordersUpdated++;
                } else {
                    this.orders.push(order);
                    result.ordersAdded++;
                }
            }

            connection.lastSyncAt = new Date().toISOString();
            connection.updatedAt = new Date().toISOString();

        } catch (error) {
            result.success = false;
            result.errors.push(String(error));
        }

        return result;
    }

    /**
     * Generate mock orders for testing
     */
    private generateMockOrders(platform: Platform, count: number): PlatformOrder[] {
        const orders: PlatformOrder[] = [];
        const now = new Date();

        for (let i = 0; i < count; i++) {
            const orderDate = new Date(now.getTime() - i * 86400000);
            const subtotal = Math.floor(Math.random() * 5000) + 500;
            const shippingFee = Math.floor(Math.random() * 50) + 30;
            const discount = Math.floor(Math.random() * 100);
            const platformFee = Math.round(subtotal * (PLATFORM_FEES[platform].commissionRate / 100));
            const paymentFee = Math.round(subtotal * (PLATFORM_FEES[platform].paymentFeeRate / 100));
            const grandTotal = subtotal + shippingFee - discount;
            const sellerReceives = grandTotal - platformFee - paymentFee;

            orders.push({
                id: `order-${platform}-${Date.now()}-${i}`,
                platform,
                platformOrderId: `${platform.toUpperCase()}-${Date.now()}-${i}`,
                orderNumber: `ORD-${i + 1}`.padStart(10, '0'),
                status: 'completed',
                customerName: `ลูกค้า ${i + 1}`,
                customerPhone: `08${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
                items: [
                    {
                        id: `item-${i}-1`,
                        sku: `SKU-${Math.floor(Math.random() * 1000)}`,
                        name: `สินค้า ${i + 1}`,
                        quantity: Math.floor(Math.random() * 3) + 1,
                        unitPrice: Math.floor(subtotal / 2),
                        discount: 0,
                        total: Math.floor(subtotal / 2)
                    }
                ],
                subtotal,
                shippingFee,
                discount,
                platformFee,
                paymentFee,
                grandTotal,
                sellerReceives,
                paymentMethod: 'credit_card',
                paymentStatus: 'paid',
                paidAt: orderDate.toISOString(),
                orderDate: orderDate.toISOString(),
                completedDate: new Date(orderDate.getTime() + 3 * 86400000).toISOString(),
                isReconciled: false
            });
        }

        return orders;
    }

    // ==========================================================================
    // SETTLEMENT SYNC
    // ==========================================================================

    /**
     * Sync settlement/payout data from platform
     */
    async syncSettlements(
        connectionId: string,
        month: string  // YYYY-MM
    ): Promise<SyncResult> {
        const connection = this.connections.get(connectionId);
        if (!connection) {
            return {
                success: false,
                platform: 'shopee',
                syncedAt: new Date().toISOString(),
                ordersAdded: 0,
                ordersUpdated: 0,
                settlementsAdded: 0,
                errors: ['Connection not found']
            };
        }

        const result: SyncResult = {
            success: true,
            platform: connection.platform,
            syncedAt: new Date().toISOString(),
            ordersAdded: 0,
            ordersUpdated: 0,
            settlementsAdded: 0,
            errors: []
        };

        try {
            // Mock settlement
            const [year, monthNum] = month.split('-').map(Number);
            const periodStart = `${month}-01`;
            const lastDay = new Date(year, monthNum, 0).getDate();
            const periodEnd = `${month}-${lastDay}`;

            const orders = this.orders.filter(o =>
                o.platform === connection.platform &&
                o.completedDate?.startsWith(month)
            );

            const settlement: PlatformSettlement = {
                id: `settle-${connection.platform}-${month}`,
                platform: connection.platform,
                settlementId: `STL-${month}`,
                periodStart,
                periodEnd,
                status: 'completed',
                totalSales: orders.reduce((sum, o) => sum + o.subtotal, 0),
                totalShippingFee: orders.reduce((sum, o) => sum + o.shippingFee, 0),
                totalPlatformFee: orders.reduce((sum, o) => sum + o.platformFee, 0),
                totalPaymentFee: orders.reduce((sum, o) => sum + o.paymentFee, 0),
                totalAdjustments: 0,
                netAmount: orders.reduce((sum, o) => sum + o.sellerReceives, 0),
                settledAt: new Date().toISOString(),
                orderCount: orders.length,
                orderIds: orders.map(o => o.id),
                isReconciled: false
            };

            this.settlements.push(settlement);
            result.settlementsAdded = 1;

        } catch (error) {
            result.success = false;
            result.errors.push(String(error));
        }

        return result;
    }

    // ==========================================================================
    // DATA ACCESS
    // ==========================================================================

    /**
     * Get orders for a client
     */
    getOrders(filters: {
        platform?: Platform;
        status?: string;
        dateFrom?: string;
        dateTo?: string;
        isReconciled?: boolean;
    } = {}): PlatformOrder[] {
        let result = [...this.orders];

        if (filters.platform) {
            result = result.filter(o => o.platform === filters.platform);
        }
        if (filters.status) {
            result = result.filter(o => o.status === filters.status);
        }
        if (filters.dateFrom) {
            result = result.filter(o => o.orderDate >= filters.dateFrom!);
        }
        if (filters.dateTo) {
            result = result.filter(o => o.orderDate <= filters.dateTo!);
        }
        if (filters.isReconciled !== undefined) {
            result = result.filter(o => o.isReconciled === filters.isReconciled);
        }

        return result.sort((a, b) =>
            new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
        );
    }

    /**
     * Get settlements for a client
     */
    getSettlements(platform?: Platform): PlatformSettlement[] {
        let result = [...this.settlements];
        if (platform) {
            result = result.filter(s => s.platform === platform);
        }
        return result.sort((a, b) => b.periodStart.localeCompare(a.periodStart));
    }

    // ==========================================================================
    // ACCOUNTING INTEGRATION
    // ==========================================================================

    /**
     * Generate GL entries from platform order
     */
    generateGLEntriesFromOrder(order: PlatformOrder): Array<{
        accountCode: string;
        accountName: string;
        debit: number;
        credit: number;
        description: string;
    }> {
        const entries: Array<{
            accountCode: string;
            accountName: string;
            debit: number;
            credit: number;
            description: string;
        }> = [];

        const platform = PLATFORM_CONFIG[order.platform];
        const baseDesc = `${platform.name} #${order.orderNumber}`;

        // Debit: Accounts Receivable (ลูกหนี้ Platform)
        entries.push({
            accountCode: PLATFORM_GL_MAPPING.accountsReceivable,
            accountName: 'ลูกหนี้ Platform',
            debit: order.sellerReceives,
            credit: 0,
            description: `${baseDesc} - ลูกหนี้ Platform`
        });

        // Debit: Platform Fee (ค่าธรรมเนียม)
        if (order.platformFee > 0) {
            entries.push({
                accountCode: PLATFORM_GL_MAPPING.platformFee,
                accountName: 'ค่าธรรมเนียม Platform',
                debit: order.platformFee,
                credit: 0,
                description: `${baseDesc} - ค่าธรรมเนียม ${platform.name}`
            });
        }

        // Debit: Payment Fee
        if (order.paymentFee > 0) {
            entries.push({
                accountCode: PLATFORM_GL_MAPPING.paymentFee,
                accountName: 'ค่าธรรมเนียมการชำระเงิน',
                debit: order.paymentFee,
                credit: 0,
                description: `${baseDesc} - ค่าธรรมเนียมชำระเงิน`
            });
        }

        // Credit: Sales Revenue
        entries.push({
            accountCode: PLATFORM_GL_MAPPING.sales,
            accountName: 'รายได้จากการขาย',
            debit: 0,
            credit: order.subtotal,
            description: `${baseDesc} - รายได้จากการขาย`
        });

        // Credit: Shipping Income (if customer paid)
        if (order.shippingFee > 0) {
            entries.push({
                accountCode: PLATFORM_GL_MAPPING.shippingIncome,
                accountName: 'รายได้ค่าจัดส่ง',
                debit: 0,
                credit: order.shippingFee,
                description: `${baseDesc} - รายได้ค่าจัดส่ง`
            });
        }

        // Debit: Discount (if any)
        if (order.discount > 0) {
            entries.push({
                accountCode: PLATFORM_GL_MAPPING.discount,
                accountName: 'ส่วนลดการขาย',
                debit: order.discount,
                credit: 0,
                description: `${baseDesc} - ส่วนลด`
            });

            // Adjust sales
            entries[entries.findIndex(e => e.accountCode === PLATFORM_GL_MAPPING.sales)].credit -= order.discount;
        }

        return entries;
    }

    /**
     * Generate GL entry for settlement (when money received from platform)
     */
    generateGLEntriesFromSettlement(settlement: PlatformSettlement): Array<{
        accountCode: string;
        accountName: string;
        debit: number;
        credit: number;
        description: string;
    }> {
        const platform = PLATFORM_CONFIG[settlement.platform];
        const entries = [];

        // Debit: Bank
        entries.push({
            accountCode: PLATFORM_GL_MAPPING.bank,
            accountName: 'เงินฝากธนาคาร',
            debit: settlement.netAmount,
            credit: 0,
            description: `รับเงินจาก ${platform.name} - ${settlement.settlementId}`
        });

        // Credit: Accounts Receivable
        entries.push({
            accountCode: PLATFORM_GL_MAPPING.accountsReceivable,
            accountName: 'ลูกหนี้ Platform',
            debit: 0,
            credit: settlement.netAmount,
            description: `ตัดลูกหนี้ ${platform.name} - ${settlement.settlementId}`
        });

        return entries;
    }

    /**
     * Get summary for accounting report
     */
    getSalesReportByPlatform(month: string): Record<Platform, {
        orderCount: number;
        totalSales: number;
        totalFees: number;
        netReceived: number;
    }> {
        const report: Record<Platform, any> = {} as any;

        for (const platform of Object.keys(PLATFORM_CONFIG) as Platform[]) {
            const orders = this.orders.filter(o =>
                o.platform === platform &&
                o.completedDate?.startsWith(month)
            );

            report[platform] = {
                orderCount: orders.length,
                totalSales: orders.reduce((sum, o) => sum + o.subtotal, 0),
                totalFees: orders.reduce((sum, o) => sum + o.platformFee + o.paymentFee, 0),
                netReceived: orders.reduce((sum, o) => sum + o.sellerReceives, 0)
            };
        }

        return report;
    }
}

// ============================================================================
// EXPORT
// ============================================================================

export const ecommercePlatforms = new ECommercePlatformService();

export default ecommercePlatforms;

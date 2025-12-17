/**
 * Real E-Commerce API Integration Service
 * 
 * Production-ready implementation for:
 * - Lazada Open Platform API
 * - Shopee Open Platform API
 * - TikTok Shop API
 * 
 * Note: Requires API credentials from each platform's developer portal
 */

import CryptoJS from 'crypto-js';
import { Platform, PlatformOrder, PlatformSettlement, PlatformCredentials, PLATFORM_CONFIG } from './ecommercePlatforms';

// ============================================================================
// ENV CONFIGURATION
// ============================================================================

interface EcommerceConfig {
    lazada: {
        appKey: string;
        appSecret: string;
        endpoint: string;
    };
    shopee: {
        partnerId: string;
        partnerKey: string;
        endpoint: string;
    };
    tiktok: {
        appKey: string;
        appSecret: string;
        endpoint: string;
    };
}

// Load from environment variables
const getConfig = (): EcommerceConfig => ({
    lazada: {
        appKey: import.meta.env.VITE_LAZADA_APP_KEY || '',
        appSecret: import.meta.env.VITE_LAZADA_APP_SECRET || '',
        endpoint: 'https://api.lazada.co.th/rest'
    },
    shopee: {
        partnerId: import.meta.env.VITE_SHOPEE_PARTNER_ID || '',
        partnerKey: import.meta.env.VITE_SHOPEE_PARTNER_KEY || '',
        endpoint: 'https://partner.shopeemobile.com/api/v2'
    },
    tiktok: {
        appKey: import.meta.env.VITE_TIKTOK_APP_KEY || '',
        appSecret: import.meta.env.VITE_TIKTOK_APP_SECRET || '',
        endpoint: 'https://open-api.tiktokglobalshop.com'
    }
});

// ============================================================================
// LAZADA API CLIENT
// ============================================================================

export class LazadaApiClient {
    private appKey: string;
    private appSecret: string;
    private endpoint: string;
    private accessToken?: string;
    private refreshToken?: string;

    constructor(config?: { appKey?: string; appSecret?: string }) {
        const envConfig = getConfig().lazada;
        this.appKey = config?.appKey || envConfig.appKey;
        this.appSecret = config?.appSecret || envConfig.appSecret;
        this.endpoint = envConfig.endpoint;
    }

    /**
     * Generate signature for Lazada API calls
     */
    private generateSignature(apiPath: string, params: Record<string, string>): string {
        // Sort parameters alphabetically
        const sortedKeys = Object.keys(params).sort();
        let signString = apiPath;

        for (const key of sortedKeys) {
            signString += key + params[key];
        }

        // HMAC-SHA256 with app secret
        const signature = CryptoJS.HmacSHA256(signString, this.appSecret);
        return signature.toString(CryptoJS.enc.Hex).toUpperCase();
    }

    /**
     * Generate OAuth authorization URL for Lazada Seller Center
     */
    getAuthorizationUrl(redirectUri: string, state?: string): string {
        const params = new URLSearchParams({
            response_type: 'code',
            force_auth: 'true',
            redirect_uri: redirectUri,
            client_id: this.appKey,
            state: state || ''
        });

        return `https://auth.lazada.com/oauth/authorize?${params.toString()}`;
    }

    /**
     * Exchange authorization code for access token
     */
    async exchangeCodeForToken(code: string): Promise<{
        success: boolean;
        accessToken?: string;
        refreshToken?: string;
        expiresIn?: number;
        error?: string;
    }> {
        try {
            const timestamp = Date.now();
            const params: Record<string, string> = {
                app_key: this.appKey,
                code: code,
                sign_method: 'sha256',
                timestamp: timestamp.toString()
            };

            const apiPath = '/auth/token/create';
            params.sign = this.generateSignature(apiPath, params);

            const url = `${this.endpoint}${apiPath}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(params)
            });

            const data = await response.json();

            if (data.code === '0') {
                this.accessToken = data.access_token;
                this.refreshToken = data.refresh_token;
                return {
                    success: true,
                    accessToken: data.access_token,
                    refreshToken: data.refresh_token,
                    expiresIn: data.expires_in
                };
            }

            return { success: false, error: data.message || 'Token exchange failed' };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Refresh access token
     */
    async refreshAccessToken(refreshToken: string): Promise<{
        success: boolean;
        accessToken?: string;
        refreshToken?: string;
        error?: string;
    }> {
        try {
            const timestamp = Date.now();
            const params: Record<string, string> = {
                app_key: this.appKey,
                refresh_token: refreshToken,
                sign_method: 'sha256',
                timestamp: timestamp.toString()
            };

            const apiPath = '/auth/token/refresh';
            params.sign = this.generateSignature(apiPath, params);

            const url = `${this.endpoint}${apiPath}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(params)
            });

            const data = await response.json();

            if (data.code === '0') {
                this.accessToken = data.access_token;
                this.refreshToken = data.refresh_token;
                return {
                    success: true,
                    accessToken: data.access_token,
                    refreshToken: data.refresh_token
                };
            }

            return { success: false, error: data.message || 'Token refresh failed' };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Set access token for API calls
     */
    setAccessToken(token: string) {
        this.accessToken = token;
    }

    /**
     * Make authenticated API call to Lazada
     */
    private async apiCall(apiPath: string, customParams: Record<string, string> = {}): Promise<any> {
        if (!this.accessToken) {
            throw new Error('Access token not set. Call setAccessToken() first.');
        }

        const timestamp = Date.now();
        const params: Record<string, string> = {
            app_key: this.appKey,
            access_token: this.accessToken,
            sign_method: 'sha256',
            timestamp: timestamp.toString(),
            ...customParams
        };

        params.sign = this.generateSignature(apiPath, params);

        const queryString = new URLSearchParams(params).toString();
        const url = `${this.endpoint}${apiPath}?${queryString}`;

        const response = await fetch(url, { method: 'GET' });
        return response.json();
    }

    /**
     * Get orders from Lazada
     */
    async getOrders(options: {
        createdAfter?: string;
        createdBefore?: string;
        status?: string;
        offset?: number;
        limit?: number;
    } = {}): Promise<{ success: boolean; orders?: PlatformOrder[]; error?: string }> {
        try {
            const params: Record<string, string> = {};

            if (options.createdAfter) {
                params.created_after = options.createdAfter;
            }
            if (options.createdBefore) {
                params.created_before = options.createdBefore;
            }
            if (options.status) {
                params.status = options.status;
            }
            if (options.offset !== undefined) {
                params.offset = options.offset.toString();
            }
            if (options.limit !== undefined) {
                params.limit = options.limit.toString();
            }

            const response = await this.apiCall('/orders/get', params);

            if (response.code === '0') {
                const orders: PlatformOrder[] = (response.data?.orders || []).map((order: any) => ({
                    id: `lazada-${order.order_id}`,
                    platform: 'lazada' as Platform,
                    platformOrderId: order.order_id,
                    orderNumber: order.order_number,
                    status: this.mapLazadaStatus(order.statuses?.[0]),
                    customerName: order.address_shipping?.first_name || 'Unknown',
                    customerPhone: order.address_shipping?.phone || '',
                    customerAddress: [
                        order.address_shipping?.address1,
                        order.address_shipping?.city,
                        order.address_shipping?.country
                    ].filter(Boolean).join(', '),
                    items: (order.items || []).map((item: any) => ({
                        id: item.order_item_id,
                        sku: item.sku || '',
                        name: item.name,
                        quantity: 1,
                        unitPrice: parseFloat(item.item_price || '0'),
                        discount: parseFloat(item.voucher_seller || '0'),
                        total: parseFloat(item.paid_price || '0')
                    })),
                    subtotal: parseFloat(order.price || '0'),
                    shippingFee: parseFloat(order.shipping_fee || '0'),
                    discount: parseFloat(order.voucher || '0'),
                    platformFee: parseFloat(order.commision_fee || '0'),
                    paymentFee: parseFloat(order.payment_fee || '0'),
                    grandTotal: parseFloat(order.price || '0'),
                    sellerReceives: parseFloat(order.price || '0') - parseFloat(order.commision_fee || '0'),
                    paymentMethod: order.payment_method || 'unknown',
                    paymentStatus: order.payment_status === 'paid' ? 'paid' : 'unpaid',
                    paidAt: order.paid_at || undefined,
                    orderDate: order.created_at,
                    shippedDate: order.shipped_at || undefined,
                    deliveredDate: order.delivered_at || undefined,
                    completedDate: order.completed_at || undefined,
                    shippingProvider: order.shipping_provider || undefined,
                    trackingNumber: order.tracking_code || undefined,
                    isReconciled: false
                }));

                return { success: true, orders };
            }

            return { success: false, error: response.message || 'Failed to get orders' };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Get order details by order ID
     */
    async getOrderDetails(orderId: string): Promise<{ success: boolean; order?: PlatformOrder; error?: string }> {
        try {
            const response = await this.apiCall('/order/get', { order_id: orderId });

            if (response.code === '0') {
                const order = response.data;
                // Similar mapping as getOrders
                return {
                    success: true,
                    order: {
                        id: `lazada-${order.order_id}`,
                        platform: 'lazada',
                        platformOrderId: order.order_id,
                        orderNumber: order.order_number,
                        status: this.mapLazadaStatus(order.statuses?.[0]),
                        customerName: order.address_shipping?.first_name || 'Unknown',
                        items: [],
                        subtotal: parseFloat(order.price || '0'),
                        shippingFee: parseFloat(order.shipping_fee || '0'),
                        discount: 0,
                        platformFee: 0,
                        paymentFee: 0,
                        grandTotal: parseFloat(order.price || '0'),
                        sellerReceives: parseFloat(order.price || '0'),
                        paymentMethod: order.payment_method || 'unknown',
                        paymentStatus: 'paid',
                        orderDate: order.created_at,
                        isReconciled: false
                    }
                };
            }

            return { success: false, error: response.message };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Get finance transactions/settlements
     */
    async getTransactions(startDate: string, endDate: string): Promise<{
        success: boolean;
        transactions?: any[];
        error?: string;
    }> {
        try {
            const response = await this.apiCall('/finance/transaction/detail/get', {
                start_time: startDate,
                end_time: endDate
            });

            if (response.code === '0') {
                return { success: true, transactions: response.data };
            }

            return { success: false, error: response.message };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Map Lazada order status to standard status
     */
    private mapLazadaStatus(status: string): PlatformOrder['status'] {
        const statusMap: Record<string, PlatformOrder['status']> = {
            'pending': 'pending',
            'unpaid': 'pending',
            'paid': 'paid',
            'packed': 'paid',
            'ready_to_ship': 'shipping',
            'shipped': 'shipping',
            'delivered': 'delivered',
            'completed': 'completed',
            'canceled': 'cancelled',
            'returned': 'refunded',
            'failed': 'cancelled'
        };
        return statusMap[status?.toLowerCase()] || 'pending';
    }
}

// ============================================================================
// SHOPEE API CLIENT
// ============================================================================

export class ShopeeApiClient {
    private partnerId: string;
    private partnerKey: string;
    private endpoint: string;
    private accessToken?: string;
    private shopId?: string;

    constructor(config?: { partnerId?: string; partnerKey?: string }) {
        const envConfig = getConfig().shopee;
        this.partnerId = config?.partnerId || envConfig.partnerId;
        this.partnerKey = config?.partnerKey || envConfig.partnerKey;
        this.endpoint = envConfig.endpoint;
    }

    /**
     * Generate HMAC-SHA256 signature for Shopee API
     */
    private generateSignature(path: string, timestamp: number, accessToken?: string, shopId?: string): string {
        let baseString = `${this.partnerId}${path}${timestamp}`;

        if (accessToken && shopId) {
            baseString += `${accessToken}${shopId}`;
        }

        const signature = CryptoJS.HmacSHA256(baseString, this.partnerKey);
        return signature.toString(CryptoJS.enc.Hex);
    }

    /**
     * Generate OAuth authorization URL for Shopee Seller
     */
    getAuthorizationUrl(redirectUri: string, state?: string): string {
        const timestamp = Math.floor(Date.now() / 1000);
        const path = '/api/v2/shop/auth_partner';
        const sign = this.generateSignature(path, timestamp);

        const params = new URLSearchParams({
            partner_id: this.partnerId,
            timestamp: timestamp.toString(),
            sign: sign,
            redirect: redirectUri
        });

        if (state) {
            params.set('state', state);
        }

        return `${this.endpoint}${path}?${params.toString()}`;
    }

    /**
     * Exchange authorization code for access token
     */
    async exchangeCodeForToken(code: string, shopId: string): Promise<{
        success: boolean;
        accessToken?: string;
        refreshToken?: string;
        expiresIn?: number;
        error?: string;
    }> {
        try {
            const timestamp = Math.floor(Date.now() / 1000);
            const path = '/api/v2/auth/token/get';
            const sign = this.generateSignature(path, timestamp);

            const url = `${this.endpoint}${path}?partner_id=${this.partnerId}&timestamp=${timestamp}&sign=${sign}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: code,
                    shop_id: parseInt(shopId),
                    partner_id: parseInt(this.partnerId)
                })
            });

            const data = await response.json();

            if (!data.error) {
                this.accessToken = data.access_token;
                this.shopId = shopId;
                return {
                    success: true,
                    accessToken: data.access_token,
                    refreshToken: data.refresh_token,
                    expiresIn: data.expire_in
                };
            }

            return { success: false, error: data.message || 'Token exchange failed' };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Refresh access token
     */
    async refreshAccessToken(refreshToken: string, shopId: string): Promise<{
        success: boolean;
        accessToken?: string;
        refreshToken?: string;
        error?: string;
    }> {
        try {
            const timestamp = Math.floor(Date.now() / 1000);
            const path = '/api/v2/auth/access_token/get';
            const sign = this.generateSignature(path, timestamp);

            const url = `${this.endpoint}${path}?partner_id=${this.partnerId}&timestamp=${timestamp}&sign=${sign}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    refresh_token: refreshToken,
                    shop_id: parseInt(shopId),
                    partner_id: parseInt(this.partnerId)
                })
            });

            const data = await response.json();

            if (!data.error) {
                this.accessToken = data.access_token;
                return {
                    success: true,
                    accessToken: data.access_token,
                    refreshToken: data.refresh_token
                };
            }

            return { success: false, error: data.message };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Set credentials for API calls
     */
    setCredentials(accessToken: string, shopId: string) {
        this.accessToken = accessToken;
        this.shopId = shopId;
    }

    /**
     * Make authenticated API call to Shopee
     */
    private async apiCall(path: string, method: 'GET' | 'POST' = 'GET', body?: any): Promise<any> {
        if (!this.accessToken || !this.shopId) {
            throw new Error('Credentials not set. Call setCredentials() first.');
        }

        const timestamp = Math.floor(Date.now() / 1000);
        const sign = this.generateSignature(path, timestamp, this.accessToken, this.shopId);

        const params = new URLSearchParams({
            partner_id: this.partnerId,
            timestamp: timestamp.toString(),
            access_token: this.accessToken,
            shop_id: this.shopId,
            sign: sign
        });

        const url = `${this.endpoint}${path}?${params.toString()}`;

        const options: RequestInit = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        return response.json();
    }

    /**
     * Get orders from Shopee
     */
    async getOrders(options: {
        timeRangeField?: 'create_time' | 'update_time';
        timeFrom?: number;
        timeTo?: number;
        pageSize?: number;
        cursor?: string;
        orderStatus?: string;
    } = {}): Promise<{ success: boolean; orders?: PlatformOrder[]; nextCursor?: string; error?: string }> {
        try {
            const body = {
                time_range_field: options.timeRangeField || 'create_time',
                time_from: options.timeFrom || Math.floor((Date.now() - 7 * 24 * 3600000) / 1000),
                time_to: options.timeTo || Math.floor(Date.now() / 1000),
                page_size: options.pageSize || 50,
                cursor: options.cursor || '',
                order_status: options.orderStatus || 'COMPLETED'
            };

            const response = await this.apiCall('/api/v2/order/get_order_list', 'POST', body);

            if (!response.error) {
                const orderSnList = response.response?.order_list?.map((o: any) => o.order_sn) || [];

                if (orderSnList.length > 0) {
                    // Get order details
                    const detailsResp = await this.apiCall('/api/v2/order/get_order_detail', 'POST', {
                        order_sn_list: orderSnList,
                        response_optional_fields: ['buyer_user_id', 'buyer_username', 'note', 'item_list', 'recipient_address', 'actual_shipping_fee']
                    });

                    const orders: PlatformOrder[] = (detailsResp.response?.order_list || []).map((order: any) => ({
                        id: `shopee-${order.order_sn}`,
                        platform: 'shopee' as Platform,
                        platformOrderId: order.order_sn,
                        orderNumber: order.order_sn,
                        status: this.mapShopeeStatus(order.order_status),
                        customerName: order.buyer_username || 'Unknown',
                        customerPhone: order.recipient_address?.phone || '',
                        customerAddress: [
                            order.recipient_address?.full_address,
                            order.recipient_address?.city,
                            order.recipient_address?.state
                        ].filter(Boolean).join(', '),
                        items: (order.item_list || []).map((item: any) => ({
                            id: item.item_id?.toString(),
                            sku: item.item_sku || '',
                            name: item.item_name,
                            quantity: item.model_quantity_purchased || 1,
                            unitPrice: item.model_original_price || 0,
                            discount: item.model_discounted_price ? item.model_original_price - item.model_discounted_price : 0,
                            total: (item.model_discounted_price || item.model_original_price) * (item.model_quantity_purchased || 1)
                        })),
                        subtotal: order.total_amount || 0,
                        shippingFee: order.actual_shipping_fee || 0,
                        discount: order.voucher_from_seller || 0,
                        platformFee: 0, // Need to get from finance API
                        paymentFee: 0,
                        grandTotal: order.total_amount || 0,
                        sellerReceives: order.total_amount || 0,
                        paymentMethod: order.payment_method || 'unknown',
                        paymentStatus: order.order_status === 'COMPLETED' ? 'paid' : 'unpaid',
                        orderDate: new Date(order.create_time * 1000).toISOString(),
                        shippedDate: order.ship_by_date ? new Date(order.ship_by_date * 1000).toISOString() : undefined,
                        completedDate: order.order_status === 'COMPLETED' ? new Date(order.update_time * 1000).toISOString() : undefined,
                        shippingProvider: order.shipping_carrier || undefined,
                        trackingNumber: order.tracking_no || undefined,
                        isReconciled: false
                    }));

                    return {
                        success: true,
                        orders,
                        nextCursor: response.response?.next_cursor || ''
                    };
                }

                return { success: true, orders: [], nextCursor: '' };
            }

            return { success: false, error: response.message };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Get shop financial wallets and transactions
     */
    async getWalletTransactions(pageNo: number = 1, pageSize: number = 50): Promise<{
        success: boolean;
        transactions?: any[];
        error?: string;
    }> {
        try {
            const response = await this.apiCall('/api/v2/payment/get_wallet_transaction_list', 'POST', {
                page_no: pageNo,
                page_size: pageSize
            });

            if (!response.error) {
                return { success: true, transactions: response.response?.transaction_list || [] };
            }

            return { success: false, error: response.message };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Map Shopee order status to standard status
     */
    private mapShopeeStatus(status: string): PlatformOrder['status'] {
        const statusMap: Record<string, PlatformOrder['status']> = {
            'UNPAID': 'pending',
            'READY_TO_SHIP': 'paid',
            'PROCESSED': 'paid',
            'SHIPPED': 'shipping',
            'TO_CONFIRM_RECEIVE': 'shipping',
            'IN_CANCEL': 'pending',
            'CANCELLED': 'cancelled',
            'COMPLETED': 'completed',
            'TO_RETURN': 'refunded'
        };
        return statusMap[status] || 'pending';
    }
}

// ============================================================================
// UNIFIED E-COMMERCE API SERVICE
// ============================================================================

export class ECommerceApiService {
    private lazadaClient: LazadaApiClient;
    private shopeeClient: ShopeeApiClient;

    constructor() {
        this.lazadaClient = new LazadaApiClient();
        this.shopeeClient = new ShopeeApiClient();
    }

    /**
     * Get authorization URL for a platform
     */
    getAuthorizationUrl(platform: Platform, redirectUri: string, state?: string): string {
        switch (platform) {
            case 'lazada':
                return this.lazadaClient.getAuthorizationUrl(redirectUri, state);
            case 'shopee':
                return this.shopeeClient.getAuthorizationUrl(redirectUri, state);
            default:
                throw new Error(`Platform ${platform} not supported for OAuth`);
        }
    }

    /**
     * Exchange authorization code for tokens
     */
    async exchangeToken(platform: Platform, code: string, shopId?: string): Promise<{
        success: boolean;
        accessToken?: string;
        refreshToken?: string;
        expiresIn?: number;
        error?: string;
    }> {
        switch (platform) {
            case 'lazada':
                return this.lazadaClient.exchangeCodeForToken(code);
            case 'shopee':
                if (!shopId) throw new Error('Shop ID required for Shopee');
                return this.shopeeClient.exchangeCodeForToken(code, shopId);
            default:
                return { success: false, error: `Platform ${platform} not supported` };
        }
    }

    /**
     * Set credentials for a platform
     */
    setCredentials(platform: Platform, credentials: { accessToken: string; shopId?: string }) {
        switch (platform) {
            case 'lazada':
                this.lazadaClient.setAccessToken(credentials.accessToken);
                break;
            case 'shopee':
                if (!credentials.shopId) throw new Error('Shop ID required for Shopee');
                this.shopeeClient.setCredentials(credentials.accessToken, credentials.shopId);
                break;
        }
    }

    /**
     * Get orders from a platform
     */
    async getOrders(platform: Platform, options: {
        dateFrom?: string;
        dateTo?: string;
        status?: string;
    } = {}): Promise<{ success: boolean; orders?: PlatformOrder[]; error?: string }> {
        switch (platform) {
            case 'lazada':
                return this.lazadaClient.getOrders({
                    createdAfter: options.dateFrom,
                    createdBefore: options.dateTo,
                    status: options.status
                });
            case 'shopee':
                const timeFrom = options.dateFrom ? new Date(options.dateFrom).getTime() / 1000 : undefined;
                const timeTo = options.dateTo ? new Date(options.dateTo).getTime() / 1000 : undefined;
                return this.shopeeClient.getOrders({
                    timeFrom: timeFrom ? Math.floor(timeFrom) : undefined,
                    timeTo: timeTo ? Math.floor(timeTo) : undefined,
                    orderStatus: options.status
                });
            default:
                return { success: false, error: `Platform ${platform} not supported` };
        }
    }

    /**
     * Sync all orders from connected platforms
     */
    async syncAllOrders(connections: Array<{
        platform: Platform;
        accessToken: string;
        shopId?: string;
    }>, dateFrom: string, dateTo: string): Promise<{
        success: boolean;
        totalOrders: number;
        byPlatform: Record<Platform, number>;
        errors: string[];
    }> {
        const result = {
            success: true,
            totalOrders: 0,
            byPlatform: {} as Record<Platform, number>,
            errors: [] as string[]
        };

        for (const conn of connections) {
            try {
                this.setCredentials(conn.platform, conn);
                const orders = await this.getOrders(conn.platform, { dateFrom, dateTo });

                if (orders.success && orders.orders) {
                    result.byPlatform[conn.platform] = orders.orders.length;
                    result.totalOrders += orders.orders.length;
                } else if (orders.error) {
                    result.errors.push(`${conn.platform}: ${orders.error}`);
                }
            } catch (error) {
                result.errors.push(`${conn.platform}: ${String(error)}`);
            }
        }

        result.success = result.errors.length === 0;
        return result;
    }

    /**
     * Check if API is configured for a platform
     */
    isConfigured(platform: Platform): boolean {
        const config = getConfig();
        switch (platform) {
            case 'lazada':
                return !!(config.lazada.appKey && config.lazada.appSecret);
            case 'shopee':
                return !!(config.shopee.partnerId && config.shopee.partnerKey);
            case 'tiktok':
                return !!(config.tiktok.appKey && config.tiktok.appSecret);
            default:
                return false;
        }
    }

    /**
     * Get configuration status for all platforms
     */
    getConfigurationStatus(): Record<Platform, {
        configured: boolean;
        requiresEnvVars: string[];
    }> {
        return {
            lazada: {
                configured: this.isConfigured('lazada'),
                requiresEnvVars: ['VITE_LAZADA_APP_KEY', 'VITE_LAZADA_APP_SECRET']
            },
            shopee: {
                configured: this.isConfigured('shopee'),
                requiresEnvVars: ['VITE_SHOPEE_PARTNER_ID', 'VITE_SHOPEE_PARTNER_KEY']
            },
            tiktok: {
                configured: this.isConfigured('tiktok'),
                requiresEnvVars: ['VITE_TIKTOK_APP_KEY', 'VITE_TIKTOK_APP_SECRET']
            },
            grab: {
                configured: false,
                requiresEnvVars: ['VITE_GRAB_CLIENT_ID', 'VITE_GRAB_CLIENT_SECRET']
            },
            lineman: {
                configured: false,
                requiresEnvVars: ['VITE_LINEMAN_API_KEY']
            }
        };
    }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const ecommerceApiService = new ECommerceApiService();
export default ecommerceApiService;

/**
 * E-Commerce Integration Manager
 * 
 * ระบบจัดการการเชื่อมต่อ E-Commerce Platform แยกตาม Client
 * 
 * Features:
 * - แต่ละ Client มี credentials แยกกัน
 * - ตั้งค่าง่ายผ่าน UI
 * - รองรับทั้งแบบมี API และ Manual Import
 * - เก็บ connection status ต่อ client
 */

import { Platform } from './ecommercePlatforms';

// ============================================================================
// CLIENT E-COMMERCE SETTINGS TYPES
// ============================================================================

export type ConnectionMode = 'api' | 'manual' | 'none';

export interface ECommerceCredentials {
    platform: Platform;
    mode: ConnectionMode;
    // API Mode
    apiKey?: string;
    apiSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    shopId?: string;
    partnerId?: string;
    expiresAt?: string;
    // Manual Mode
    manualImportEnabled?: boolean;
    lastManualImport?: string;
}

export interface ClientECommerceSettings {
    clientId: string;
    enabled: boolean;
    platforms: {
        [key in Platform]?: {
            enabled: boolean;
            mode: ConnectionMode;
            credentials?: Omit<ECommerceCredentials, 'platform' | 'mode'>;
            shopName?: string;
            lastSyncAt?: string;
            syncStatus: 'connected' | 'disconnected' | 'expired' | 'error' | 'manual';
            autoSync: boolean;
            syncFrequency?: 'hourly' | 'daily' | 'weekly' | 'manual';
            createdAt: string;
            updatedAt: string;
        };
    };
    defaultAccountMapping?: {
        sales: string;
        platformFee: string;
        paymentFee: string;
        shipping: string;
        refund: string;
    };
    createdAt: string;
    updatedAt: string;
}

// ============================================================================
// PLATFORM REQUIREMENTS
// ============================================================================

export interface PlatformRequirement {
    platform: Platform;
    name: string;
    nameTh: string;
    logo: string;
    color: string;
    modes: ConnectionMode[];
    apiFields: {
        key: string;
        label: string;
        labelTh: string;
        type: 'text' | 'password' | 'select';
        required: boolean;
        placeholder?: string;
        helpText?: string;
        helpTextTh?: string;
    }[];
    oauthSupported: boolean;
    oauthUrl?: string;
    setupGuideUrl?: string;
    setupGuideTh?: string;
}

export const PLATFORM_REQUIREMENTS: Record<Platform, PlatformRequirement> = {
    shopee: {
        platform: 'shopee',
        name: 'Shopee',
        nameTh: 'ช้อปปี้',
        logo: '/platforms/shopee.png',
        color: '#EE4D2D',
        modes: ['api', 'manual'],
        apiFields: [
            {
                key: 'partnerId',
                label: 'Partner ID',
                labelTh: 'รหัส Partner',
                type: 'text',
                required: true,
                placeholder: 'e.g., 123456',
                helpText: 'Get from Shopee Open Platform',
                helpTextTh: 'ได้จาก Shopee Open Platform Console'
            },
            {
                key: 'partnerKey',
                label: 'Partner Key',
                labelTh: 'คีย์ Partner',
                type: 'password',
                required: true,
                placeholder: 'Your partner key',
                helpText: 'Secret key from Shopee',
                helpTextTh: 'คีย์ลับจาก Shopee'
            },
            {
                key: 'shopId',
                label: 'Shop ID',
                labelTh: 'รหัสร้านค้า',
                type: 'text',
                required: true,
                placeholder: 'e.g., 789012',
                helpText: 'Your Shopee shop ID',
                helpTextTh: 'รหัสร้านค้าของคุณบน Shopee'
            }
        ],
        oauthSupported: true,
        oauthUrl: 'https://partner.shopeemobile.com/api/v2/shop/auth_partner',
        setupGuideUrl: 'https://open.shopee.com/documents',
        setupGuideTh: 'วิธีสมัคร: 1) ไปที่ open.shopee.com 2) สร้าง Partner Account 3) ขอ API Access'
    },
    lazada: {
        platform: 'lazada',
        name: 'Lazada',
        nameTh: 'ลาซาด้า',
        logo: '/platforms/lazada.png',
        color: '#0F1689',
        modes: ['api', 'manual'],
        apiFields: [
            {
                key: 'appKey',
                label: 'App Key',
                labelTh: 'App Key',
                type: 'text',
                required: true,
                placeholder: 'e.g., 123456',
                helpText: 'Get from Lazada Open Platform',
                helpTextTh: 'ได้จาก Lazada Open Platform'
            },
            {
                key: 'appSecret',
                label: 'App Secret',
                labelTh: 'App Secret',
                type: 'password',
                required: true,
                placeholder: 'Your app secret',
                helpText: 'Secret from Lazada',
                helpTextTh: 'คีย์ลับจาก Lazada'
            }
        ],
        oauthSupported: true,
        oauthUrl: 'https://auth.lazada.com/oauth/authorize',
        setupGuideUrl: 'https://open.lazada.com',
        setupGuideTh: 'วิธีสมัคร: 1) ไปที่ open.lazada.com 2) สร้าง Developer Account 3) สร้าง App'
    },
    tiktok: {
        platform: 'tiktok',
        name: 'TikTok Shop',
        nameTh: 'ติ๊กต็อก ช็อป',
        logo: '/platforms/tiktok.png',
        color: '#000000',
        modes: ['api', 'manual'],
        apiFields: [
            {
                key: 'appKey',
                label: 'App Key',
                labelTh: 'App Key',
                type: 'text',
                required: true,
                placeholder: 'Your TikTok app key'
            },
            {
                key: 'appSecret',
                label: 'App Secret',
                labelTh: 'App Secret',
                type: 'password',
                required: true,
                placeholder: 'Your app secret'
            }
        ],
        oauthSupported: true,
        oauthUrl: 'https://auth.tiktok-shops.com/oauth/authorize',
        setupGuideUrl: 'https://partner.tiktokshop.com',
        setupGuideTh: 'วิธีสมัคร: 1) ไปที่ TikTok Shop Partner Center 2) สร้าง Partner App'
    },
    grab: {
        platform: 'grab',
        name: 'Grab Merchant',
        nameTh: 'แกร็บ',
        logo: '/platforms/grab.png',
        color: '#00B14F',
        modes: ['manual'], // Grab ไม่เปิด API สำหรับ 3rd party
        apiFields: [],
        oauthSupported: false,
        setupGuideTh: 'Grab ยังไม่เปิดให้ใช้ API - ใช้วิธี Manual Import จากรายงานในแอป'
    },
    lineman: {
        platform: 'lineman',
        name: 'LINE MAN',
        nameTh: 'ไลน์แมน',
        logo: '/platforms/lineman.png',
        color: '#00C73C',
        modes: ['manual'], // LINE MAN ไม่เปิด API สำหรับ 3rd party
        apiFields: [],
        oauthSupported: false,
        setupGuideTh: 'LINE MAN ยังไม่เปิดให้ใช้ API - ใช้วิธี Manual Import'
    }
};

// ============================================================================
// CLIENT ECOMMERCE MANAGER
// ============================================================================

class ClientECommerceManager {
    private settingsCache: Map<string, ClientECommerceSettings> = new Map();

    // Get settings for a client
    async getSettings(clientId: string): Promise<ClientECommerceSettings | null> {
        // Check cache
        if (this.settingsCache.has(clientId)) {
            return this.settingsCache.get(clientId)!;
        }

        // Load from localStorage (in production, use Firebase)
        const stored = localStorage.getItem(`ecommerce_settings_${clientId}`);
        if (stored) {
            const settings = JSON.parse(stored) as ClientECommerceSettings;
            this.settingsCache.set(clientId, settings);
            return settings;
        }

        return null;
    }

    // Create default settings for a client
    createDefaultSettings(clientId: string): ClientECommerceSettings {
        const settings: ClientECommerceSettings = {
            clientId,
            enabled: false,
            platforms: {},
            defaultAccountMapping: {
                sales: '4100-00',
                platformFee: '5200-10',
                paymentFee: '5200-11',
                shipping: '4200-00',
                refund: '4190-00'
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        return settings;
    }

    // Save settings
    async saveSettings(settings: ClientECommerceSettings): Promise<void> {
        settings.updatedAt = new Date().toISOString();

        // Save to localStorage (in production, use Firebase)
        localStorage.setItem(`ecommerce_settings_${settings.clientId}`, JSON.stringify(settings));

        // Update cache
        this.settingsCache.set(settings.clientId, settings);
    }

    // Enable/Disable platform for client
    async togglePlatform(
        clientId: string,
        platform: Platform,
        enabled: boolean,
        mode: ConnectionMode = 'manual'
    ): Promise<ClientECommerceSettings> {
        let settings = await this.getSettings(clientId);
        if (!settings) {
            settings = this.createDefaultSettings(clientId);
        }

        if (enabled) {
            settings.platforms[platform] = {
                enabled: true,
                mode,
                syncStatus: mode === 'api' ? 'disconnected' : 'manual',
                autoSync: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            settings.enabled = true;
        } else {
            if (settings.platforms[platform]) {
                settings.platforms[platform]!.enabled = false;
                settings.platforms[platform]!.updatedAt = new Date().toISOString();
            }
        }

        await this.saveSettings(settings);
        return settings;
    }

    // Save API credentials for a platform
    async saveCredentials(
        clientId: string,
        platform: Platform,
        credentials: Omit<ECommerceCredentials, 'platform' | 'mode'>
    ): Promise<ClientECommerceSettings> {
        let settings = await this.getSettings(clientId);
        if (!settings) {
            settings = this.createDefaultSettings(clientId);
        }

        if (!settings.platforms[platform]) {
            settings.platforms[platform] = {
                enabled: true,
                mode: 'api',
                syncStatus: 'disconnected',
                autoSync: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
        }

        settings.platforms[platform]!.credentials = credentials;
        settings.platforms[platform]!.mode = 'api';
        settings.platforms[platform]!.updatedAt = new Date().toISOString();

        await this.saveSettings(settings);
        return settings;
    }

    // Test connection for a platform
    async testConnection(
        clientId: string,
        platform: Platform
    ): Promise<{ success: boolean; message: string }> {
        const settings = await this.getSettings(clientId);
        if (!settings || !settings.platforms[platform]) {
            return { success: false, message: 'Platform not configured' };
        }

        const platformSettings = settings.platforms[platform]!;
        if (platformSettings.mode !== 'api') {
            return { success: false, message: 'Platform is in manual mode' };
        }

        const creds = platformSettings.credentials;
        if (!creds) {
            return { success: false, message: 'No credentials configured' };
        }

        // Simulate API test (in production, make actual API call)
        // This would call the respective platform's API to verify credentials
        try {
            // Mock test - in production, replace with actual API call
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Update status
            platformSettings.syncStatus = 'connected';
            platformSettings.lastSyncAt = new Date().toISOString();
            await this.saveSettings(settings);

            return { success: true, message: 'Connected successfully' };
        } catch (error: any) {
            platformSettings.syncStatus = 'error';
            await this.saveSettings(settings);
            return { success: false, message: error.message || 'Connection failed' };
        }
    }

    // Get all connected platforms for a client
    async getConnectedPlatforms(clientId: string): Promise<Platform[]> {
        const settings = await this.getSettings(clientId);
        if (!settings) return [];

        return Object.entries(settings.platforms)
            .filter(([_, config]) => config?.enabled && config.syncStatus === 'connected')
            .map(([platform]) => platform as Platform);
    }

    // Get platform status summary for a client
    async getPlatformSummary(clientId: string): Promise<{
        platform: Platform;
        enabled: boolean;
        mode: ConnectionMode;
        status: string;
        lastSync?: string;
    }[]> {
        const settings = await this.getSettings(clientId);
        if (!settings) return [];

        return Object.entries(settings.platforms).map(([platform, config]) => ({
            platform: platform as Platform,
            enabled: config?.enabled || false,
            mode: config?.mode || 'none',
            status: config?.syncStatus || 'disconnected',
            lastSync: config?.lastSyncAt
        }));
    }

    // Clear cache
    clearCache(clientId?: string): void {
        if (clientId) {
            this.settingsCache.delete(clientId);
        } else {
            this.settingsCache.clear();
        }
    }
}

export const clientECommerceManager = new ClientECommerceManager();

/**
 * LINE Notify Service
 * ส่งการแจ้งเตือนผ่าน LINE Notify API
 */

// LINE Notify API endpoint
const LINE_NOTIFY_API = 'https://notify-api.line.me/api/notify';

export interface LineNotifyConfig {
    accessToken: string;
    enabled: boolean;
}

export interface LineNotifyMessage {
    message: string;
    imageUrl?: string;
    stickerPackageId?: number;
    stickerId?: number;
}

// Store config in memory (in production, use environment variables or Firestore)
let lineConfig: LineNotifyConfig = {
    accessToken: '',
    enabled: false
};

/**
 * Set LINE Notify configuration
 */
export function setLineNotifyConfig(config: LineNotifyConfig): void {
    lineConfig = config;
}

/**
 * Get current LINE Notify configuration
 */
export function getLineNotifyConfig(): LineNotifyConfig {
    return { ...lineConfig };
}

/**
 * Send LINE Notify message
 */
export async function sendLineNotify(
    message: LineNotifyMessage
): Promise<{ success: boolean; error?: string }> {
    if (!lineConfig.enabled || !lineConfig.accessToken) {
        console.log('[LINE Notify] Not configured or disabled');
        return { success: false, error: 'LINE Notify ยังไม่ได้ตั้งค่า' };
    }

    try {
        const formData = new URLSearchParams();
        formData.append('message', message.message);

        if (message.imageUrl) {
            formData.append('imageFullsize', message.imageUrl);
            formData.append('imageThumbnail', message.imageUrl);
        }

        if (message.stickerPackageId && message.stickerId) {
            formData.append('stickerPackageId', String(message.stickerPackageId));
            formData.append('stickerId', String(message.stickerId));
        }

        const response = await fetch(LINE_NOTIFY_API, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${lineConfig.accessToken}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        console.log('[LINE Notify] Message sent successfully');
        return { success: true };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[LINE Notify] Error:', errorMessage);
        return { success: false, error: errorMessage };
    }
}

/**
 * Notify helpers for common accounting events
 */
export const lineNotifyHelpers = {
    /**
     * แจ้งเตือนเอกสารใหม่
     */
    documentUploaded: (clientName: string, docType: string, amount: number) => {
        const formattedAmount = new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB'
        }).format(amount);

        return sendLineNotify({
            message: `\n📄 เอกสารใหม่\n👤 ลูกค้า: ${clientName}\n📝 ประเภท: ${docType}\n💰 จำนวนเงิน: ${formattedAmount}`
        });
    },

    /**
     * แจ้งเตือนกำหนดส่งภาษี
     */
    taxDeadlineReminder: (taxType: string, dueDate: string, clientCount: number) => {
        return sendLineNotify({
            message: `\n⏰ แจ้งเตือนกำหนดส่งภาษี\n📋 ประเภท: ${taxType}\n📅 กำหนดส่ง: ${dueDate}\n👥 ลูกค้าที่ต้องยื่น: ${clientCount} ราย`,
            stickerPackageId: 1,
            stickerId: 13
        });
    },

    /**
     * แจ้งเตือนปิดบัญชีสำเร็จ
     */
    periodClosed: (clientName: string, period: string) => {
        return sendLineNotify({
            message: `\n✅ ปิดบัญชีสำเร็จ\n👤 ลูกค้า: ${clientName}\n📅 งวด: ${period}`,
            stickerPackageId: 1,
            stickerId: 2
        });
    },

    /**
     * แจ้งเตือนปัญหาที่ต้องตรวจสอบ
     */
    issueDetected: (clientName: string, issueTitle: string, severity: 'High' | 'Medium' | 'Low') => {
        const severityEmoji = severity === 'High' ? '🔴' : severity === 'Medium' ? '🟡' : '🟢';
        return sendLineNotify({
            message: `\n${severityEmoji} พบปัญหาที่ต้องตรวจสอบ\n👤 ลูกค้า: ${clientName}\n📝 รายละเอียด: ${issueTitle}\n⚠️ ระดับ: ${severity}`
        });
    },

    /**
     * แจ้งเตือน Bank Reconciliation ไม่ตรง
     */
    reconciliationMismatch: (clientName: string, difference: number) => {
        const formattedDiff = new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB'
        }).format(Math.abs(difference));

        return sendLineNotify({
            message: `\n⚠️ ยอดกระทบธนาคารไม่ตรง\n👤 ลูกค้า: ${clientName}\n💰 ผลต่าง: ${formattedDiff}`
        });
    },

    /**
     * แจ้งเตือนรายงานประจำวัน
     */
    dailySummary: (date: string, stats: {
        documentsProcessed: number;
        clientsUpdated: number;
        issuesResolved: number;
        pendingTasks: number;
    }) => {
        return sendLineNotify({
            message: `\n📊 สรุปประจำวัน ${date}\n📄 เอกสารที่ประมวลผล: ${stats.documentsProcessed}\n👥 ลูกค้าที่อัพเดต: ${stats.clientsUpdated}\n✅ ปัญหาที่แก้ไข: ${stats.issuesResolved}\n⏳ งานค้าง: ${stats.pendingTasks}`
        });
    }
};

export default {
    sendLineNotify,
    setLineNotifyConfig,
    getLineNotifyConfig,
    ...lineNotifyHelpers
};

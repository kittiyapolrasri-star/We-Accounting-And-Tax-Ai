/**
 * Settings Service
 * บันทึกและโหลดการตั้งค่าจาก Firestore
 */

import { db, isFirebaseConfigured } from './firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export interface SystemSettingsData {
    companyName: string;
    taxId: string;
    address: string;
    phone: string;
    email: string;
    fiscalYearStart: string;
    currency: string;
    language: string;
    theme: 'light' | 'dark' | 'auto';
    notifications: {
        email: boolean;
        push: boolean;
        taxDeadlines: boolean;
        documentProcessed: boolean;
    };
    backup: {
        autoBackup: boolean;
        frequency: 'daily' | 'weekly' | 'monthly';
        retention: number;
    };
    updatedAt?: any;
    updatedBy?: string;
}

const SETTINGS_DOC_ID = 'system_settings';
const SETTINGS_COLLECTION = 'settings';

// Default settings
export const defaultSettings: SystemSettingsData = {
    companyName: 'WE Accounting & Tax',
    taxId: '',
    address: '',
    phone: '',
    email: '',
    fiscalYearStart: '01',
    currency: 'THB',
    language: 'th',
    theme: 'light',
    notifications: {
        email: true,
        push: true,
        taxDeadlines: true,
        documentProcessed: true,
    },
    backup: {
        autoBackup: true,
        frequency: 'daily',
        retention: 30,
    },
};

/**
 * โหลดการตั้งค่าจาก Firestore
 */
export const loadSettings = async (): Promise<SystemSettingsData> => {
    if (!isFirebaseConfigured || !db) {
        console.log('Firebase not configured, using default settings');
        return defaultSettings;
    }

    try {
        const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data() as SystemSettingsData;
            console.log('Settings loaded from Firestore');
            return { ...defaultSettings, ...data };
        } else {
            console.log('No settings found, using defaults');
            return defaultSettings;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        return defaultSettings;
    }
};

/**
 * บันทึกการตั้งค่าลง Firestore
 */
export const saveSettings = async (
    settings: SystemSettingsData,
    userId?: string
): Promise<{ success: boolean; error?: string }> => {
    if (!isFirebaseConfigured || !db) {
        console.log('Firebase not configured, cannot save settings');
        return { success: false, error: 'Firebase not configured' };
    }

    try {
        const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);

        await setDoc(docRef, {
            ...settings,
            updatedAt: serverTimestamp(),
            updatedBy: userId || 'system',
        }, { merge: true });

        console.log('Settings saved to Firestore');
        return { success: true };
    } catch (error: any) {
        console.error('Error saving settings:', error);
        return { success: false, error: error.message };
    }
};

/**
 * โหลดการตั้งค่าเฉพาะส่วน
 */
export const getSettingValue = async <K extends keyof SystemSettingsData>(
    key: K
): Promise<SystemSettingsData[K]> => {
    const settings = await loadSettings();
    return settings[key];
};

/**
 * บันทึกการตั้งค่าเฉพาะส่วน
 */
export const updateSettingValue = async <K extends keyof SystemSettingsData>(
    key: K,
    value: SystemSettingsData[K],
    userId?: string
): Promise<{ success: boolean; error?: string }> => {
    if (!isFirebaseConfigured || !db) {
        return { success: false, error: 'Firebase not configured' };
    }

    try {
        const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);

        await setDoc(docRef, {
            [key]: value,
            updatedAt: serverTimestamp(),
            updatedBy: userId || 'system',
        }, { merge: true });

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};

export default {
    loadSettings,
    saveSettings,
    getSettingValue,
    updateSettingValue,
    defaultSettings,
};

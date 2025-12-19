/**
 * Backup Service
 * สำรองและกู้คืนข้อมูลจาก Firestore
 */

import { db, isFirebaseConfigured } from './firebase';
import { collection, getDocs, doc, setDoc, writeBatch, deleteDoc, query, orderBy, limit } from 'firebase/firestore';

export interface BackupData {
    version: string;
    createdAt: string;
    createdBy?: string;
    collections: {
        [collectionName: string]: {
            count: number;
            documents: Array<{ id: string; data: any }>;
        };
    };
    metadata: {
        totalDocuments: number;
        includedCollections: string[];
    };
}

// Collections to backup
const BACKUP_COLLECTIONS = [
    'clients',
    'staff',
    'documents',
    'tasks',
    'gl_entries',
    'bank_transactions',
    'chart_of_accounts',
    'settings',
];

/**
 * สร้างไฟล์สำรองข้อมูล
 */
export const createBackup = async (userId?: string): Promise<BackupData> => {
    if (!isFirebaseConfigured || !db) {
        throw new Error('Firebase not configured');
    }

    const backup: BackupData = {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        createdBy: userId,
        collections: {},
        metadata: {
            totalDocuments: 0,
            includedCollections: [],
        },
    };

    for (const collectionName of BACKUP_COLLECTIONS) {
        try {
            const colRef = collection(db, collectionName);
            const snapshot = await getDocs(colRef);

            if (!snapshot.empty) {
                const documents = snapshot.docs.map(doc => ({
                    id: doc.id,
                    data: doc.data(),
                }));

                backup.collections[collectionName] = {
                    count: documents.length,
                    documents,
                };

                backup.metadata.totalDocuments += documents.length;
                backup.metadata.includedCollections.push(collectionName);
            }
        } catch (error) {
            console.error(`Error backing up collection ${collectionName}:`, error);
        }
    }

    // Save backup record to Firestore
    try {
        const backupRef = doc(collection(db, 'backups'));
        await setDoc(backupRef, {
            createdAt: backup.createdAt,
            createdBy: userId,
            totalDocuments: backup.metadata.totalDocuments,
            includedCollections: backup.metadata.includedCollections,
            status: 'completed',
        });
    } catch (error) {
        console.error('Error saving backup record:', error);
    }

    return backup;
};

/**
 * ดาวน์โหลดไฟล์สำรอง
 */
export const downloadBackup = (backup: BackupData, filename?: string): void => {
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/**
 * อ่านไฟล์สำรอง
 */
export const readBackupFile = (file: File): Promise<BackupData> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result as string);

                // Validate backup format
                if (!data.version || !data.collections || !data.metadata) {
                    throw new Error('Invalid backup file format');
                }

                resolve(data as BackupData);
            } catch (error) {
                reject(new Error('ไม่สามารถอ่านไฟล์สำรอง: รูปแบบไฟล์ไม่ถูกต้อง'));
            }
        };

        reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์ได้'));
        reader.readAsText(file);
    });
};

/**
 * กู้คืนข้อมูลจากไฟล์สำรอง
 */
export const restoreBackup = async (
    backup: BackupData,
    options: {
        clearExisting?: boolean;
        collections?: string[];
        userId?: string;
    } = {}
): Promise<{ success: boolean; restoredCount: number; errors: string[] }> => {
    if (!isFirebaseConfigured || !db) {
        throw new Error('Firebase not configured');
    }

    const { clearExisting = false, collections = Object.keys(backup.collections), userId } = options;
    let restoredCount = 0;
    const errors: string[] = [];

    for (const collectionName of collections) {
        if (!backup.collections[collectionName]) {
            continue;
        }

        const collectionData = backup.collections[collectionName];

        try {
            // Clear existing data if requested
            if (clearExisting) {
                const existingDocs = await getDocs(collection(db, collectionName));
                const batch = writeBatch(db);
                existingDocs.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
            }

            // Restore documents in batches
            const batchSize = 500;
            for (let i = 0; i < collectionData.documents.length; i += batchSize) {
                const batch = writeBatch(db);
                const batchDocs = collectionData.documents.slice(i, i + batchSize);

                for (const docData of batchDocs) {
                    const docRef = doc(db, collectionName, docData.id);
                    batch.set(docRef, {
                        ...docData.data,
                        _restoredAt: new Date().toISOString(),
                        _restoredBy: userId,
                    });
                }

                await batch.commit();
                restoredCount += batchDocs.length;
            }
        } catch (error: any) {
            console.error(`Error restoring collection ${collectionName}:`, error);
            errors.push(`${collectionName}: ${error.message}`);
        }
    }

    // Log restore action
    try {
        await setDoc(doc(collection(db, 'restore_logs')), {
            restoredAt: new Date().toISOString(),
            restoredBy: userId,
            backupDate: backup.createdAt,
            restoredCount,
            errors,
        });
    } catch (error) {
        console.error('Error logging restore:', error);
    }

    return {
        success: errors.length === 0,
        restoredCount,
        errors,
    };
};

/**
 * ดึงรายการ Backup ล่าสุด
 */
export const getRecentBackups = async (limitCount: number = 10): Promise<Array<{
    id: string;
    createdAt: string;
    totalDocuments: number;
    status: string;
}>> => {
    if (!isFirebaseConfigured || !db) {
        return [];
    }

    try {
        const backupsRef = collection(db, 'backups');
        const q = query(backupsRef, orderBy('createdAt', 'desc'), limit(limitCount));
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            createdAt: doc.data().createdAt,
            totalDocuments: doc.data().totalDocuments,
            status: doc.data().status,
        }));
    } catch (error) {
        console.error('Error fetching backups:', error);
        return [];
    }
};

export default {
    createBackup,
    downloadBackup,
    readBackupFile,
    restoreBackup,
    getRecentBackups,
};

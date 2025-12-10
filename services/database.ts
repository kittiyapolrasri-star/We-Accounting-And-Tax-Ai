import {
    collection,
    getDocs,
    doc,
    setDoc,
    updateDoc,
    addDoc,
    query,
    where,
    writeBatch,
    orderBy,
    limit as firestoreLimit,
    startAfter,
    getDoc,
    deleteDoc,
    DocumentSnapshot,
    QueryConstraint,
    serverTimestamp
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";
import { Client, DocumentRecord, Staff, PostedGLEntry, FixedAsset, VendorRule, BankTransaction, ActivityLog } from '../types';

// --- CONFIGURATION ---
const STORAGE_KEY = 'WE_ACCOUNTING_DB_V1';
const IS_DEMO_MODE = !isFirebaseConfigured;

// Collection names
const COLLECTIONS = {
    CLIENTS: 'clients',
    DOCUMENTS: 'documents',
    STAFF: 'staff',
    GL_ENTRIES: 'gl_entries',
    ASSETS: 'assets',
    VENDOR_RULES: 'vendor_rules',
    BANK_TRANSACTIONS: 'bank_transactions',
    ACTIVITY_LOGS: 'activity_logs'
} as const;

// --- LOCAL STORAGE HELPERS (Demo Mode Only) ---
interface LocalStorageData {
    clients: Client[];
    documents: DocumentRecord[];
    staff: Staff[];
    glEntries: PostedGLEntry[];
    assets: FixedAsset[];
    vendorRules: VendorRule[];
    bankTransactions: BankTransaction[];
    activityLogs: ActivityLog[];
}

const getLocalStorage = (): LocalStorageData => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            return JSON.parse(data);
        }
    } catch (e) {
        console.warn('Failed to read from localStorage:', e);
    }

    // Return empty data structure
    return {
        clients: [],
        documents: [],
        staff: [],
        glEntries: [],
        assets: [],
        vendorRules: [],
        bankTransactions: [],
        activityLogs: []
    };
};

const saveLocalStorage = (data: LocalStorageData): void => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('Failed to save to localStorage:', e);
    }
};

// --- GENERIC FETCH FUNCTION ---
async function fetchCollection<T>(
    collectionName: string,
    queryConstraints: QueryConstraint[] = [],
    limitCount?: number
): Promise<T[]> {
    if (IS_DEMO_MODE || !db) {
        // Demo mode: use localStorage
        const data = getLocalStorage();
        const collectionMap: Record<string, any[]> = {
            [COLLECTIONS.CLIENTS]: data.clients,
            [COLLECTIONS.DOCUMENTS]: data.documents,
            [COLLECTIONS.STAFF]: data.staff,
            [COLLECTIONS.GL_ENTRIES]: data.glEntries,
            [COLLECTIONS.ASSETS]: data.assets,
            [COLLECTIONS.VENDOR_RULES]: data.vendorRules,
            [COLLECTIONS.BANK_TRANSACTIONS]: data.bankTransactions,
            [COLLECTIONS.ACTIVITY_LOGS]: data.activityLogs,
        };

        let result = collectionMap[collectionName] || [];
        if (limitCount) {
            result = result.slice(0, limitCount);
        }
        return result as T[];
    }

    try {
        const constraints = [...queryConstraints];
        if (limitCount) {
            constraints.push(firestoreLimit(limitCount));
        }

        const q = query(collection(db, collectionName), ...constraints);
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as T[];
    } catch (error) {
        console.error(`Error fetching ${collectionName}:`, error);
        throw new Error(`Failed to fetch data from ${collectionName}`);
    }
}

// --- CLIENTS ---
export const getClients = async (): Promise<Client[]> => {
    return fetchCollection<Client>(COLLECTIONS.CLIENTS, [orderBy('name')]);
};

export const getClientById = async (clientId: string): Promise<Client | null> => {
    if (IS_DEMO_MODE || !db) {
        const data = getLocalStorage();
        return data.clients.find(c => c.id === clientId) || null;
    }

    try {
        const docRef = doc(db, COLLECTIONS.CLIENTS, clientId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as Client;
        }
        return null;
    } catch (error) {
        console.error('Error fetching client:', error);
        throw new Error('Failed to fetch client');
    }
};

export const addClient = async (client: Omit<Client, 'id'>): Promise<string> => {
    if (IS_DEMO_MODE || !db) {
        const data = getLocalStorage();
        const newClient = { ...client, id: `C${Date.now()}` } as Client;
        data.clients.push(newClient);
        saveLocalStorage(data);
        return newClient.id;
    }

    try {
        const docRef = await addDoc(collection(db, COLLECTIONS.CLIENTS), {
            ...client,
            created_at: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error('Error adding client:', error);
        throw new Error('Failed to add client');
    }
};

export const updateClient = async (client: Client): Promise<void> => {
    if (IS_DEMO_MODE || !db) {
        const data = getLocalStorage();
        data.clients = data.clients.map(c => c.id === client.id ? client : c);
        saveLocalStorage(data);
        return;
    }

    try {
        await setDoc(doc(db, COLLECTIONS.CLIENTS, client.id), {
            ...client,
            updated_at: serverTimestamp()
        });
    } catch (error) {
        console.error('Error updating client:', error);
        throw new Error('Failed to update client');
    }
};

// --- DOCUMENTS ---
export const getDocuments = async (limitCount?: number): Promise<DocumentRecord[]> => {
    return fetchCollection<DocumentRecord>(
        COLLECTIONS.DOCUMENTS,
        [orderBy('uploaded_at', 'desc')],
        limitCount
    );
};

export const getDocumentsByClient = async (clientId: string): Promise<DocumentRecord[]> => {
    return fetchCollection<DocumentRecord>(
        COLLECTIONS.DOCUMENTS,
        [where('client_id', '==', clientId), orderBy('uploaded_at', 'desc')]
    );
};

export const addDocument = async (document: Omit<DocumentRecord, 'id'>): Promise<string> => {
    if (IS_DEMO_MODE || !db) {
        const data = getLocalStorage();
        const newDoc = { ...document, id: `DOC${Date.now()}` } as DocumentRecord;
        data.documents.push(newDoc);
        saveLocalStorage(data);
        return newDoc.id;
    }

    try {
        const docRef = await addDoc(collection(db, COLLECTIONS.DOCUMENTS), document);
        return docRef.id;
    } catch (error) {
        console.error('Error adding document:', error);
        throw new Error('Failed to add document');
    }
};

export const updateDocument = async (document: DocumentRecord): Promise<void> => {
    if (IS_DEMO_MODE || !db) {
        const data = getLocalStorage();
        data.documents = data.documents.map(d => d.id === document.id ? document : d);
        saveLocalStorage(data);
        return;
    }

    try {
        await setDoc(doc(db, COLLECTIONS.DOCUMENTS, document.id), document);
    } catch (error) {
        console.error('Error updating document:', error);
        throw new Error('Failed to update document');
    }
};

export const deleteDocument = async (documentId: string): Promise<void> => {
    if (IS_DEMO_MODE || !db) {
        const data = getLocalStorage();
        data.documents = data.documents.filter(d => d.id !== documentId);
        saveLocalStorage(data);
        return;
    }

    try {
        await deleteDoc(doc(db, COLLECTIONS.DOCUMENTS, documentId));
    } catch (error) {
        console.error('Error deleting document:', error);
        throw new Error('Failed to delete document');
    }
};

// --- STAFF ---
export const getStaff = async (): Promise<Staff[]> => {
    return fetchCollection<Staff>(COLLECTIONS.STAFF, [orderBy('name')]);
};

export const getStaffById = async (staffId: string): Promise<Staff | null> => {
    if (IS_DEMO_MODE || !db) {
        const data = getLocalStorage();
        return data.staff.find(s => s.id === staffId) || null;
    }

    try {
        const docRef = doc(db, COLLECTIONS.STAFF, staffId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as Staff;
        }
        return null;
    } catch (error) {
        console.error('Error fetching staff:', error);
        throw new Error('Failed to fetch staff');
    }
};

export const updateStaff = async (staff: Staff): Promise<void> => {
    if (IS_DEMO_MODE || !db) {
        const data = getLocalStorage();
        data.staff = data.staff.map(s => s.id === staff.id ? staff : s);
        saveLocalStorage(data);
        return;
    }

    try {
        await setDoc(doc(db, COLLECTIONS.STAFF, staff.id), staff);
    } catch (error) {
        console.error('Error updating staff:', error);
        throw new Error('Failed to update staff');
    }
};

// --- GL ENTRIES ---
export const getGLEntries = async (limitCount?: number): Promise<PostedGLEntry[]> => {
    return fetchCollection<PostedGLEntry>(
        COLLECTIONS.GL_ENTRIES,
        [orderBy('date', 'desc')],
        limitCount
    );
};

export const getGLEntriesByClient = async (clientId: string): Promise<PostedGLEntry[]> => {
    return fetchCollection<PostedGLEntry>(
        COLLECTIONS.GL_ENTRIES,
        [where('clientId', '==', clientId), orderBy('date', 'desc')]
    );
};

export const addGLEntry = async (entry: Omit<PostedGLEntry, 'id'>): Promise<string> => {
    if (IS_DEMO_MODE || !db) {
        const data = getLocalStorage();
        const newEntry = { ...entry, id: `GL${Date.now()}-${Math.random().toString(36).substr(2, 9)}` } as PostedGLEntry;
        data.glEntries.push(newEntry);
        saveLocalStorage(data);
        return newEntry.id;
    }

    try {
        const docRef = await addDoc(collection(db, COLLECTIONS.GL_ENTRIES), entry);
        return docRef.id;
    } catch (error) {
        console.error('Error adding GL entry:', error);
        throw new Error('Failed to add GL entry');
    }
};

export const addGLEntries = async (entries: Omit<PostedGLEntry, 'id'>[]): Promise<string[]> => {
    if (IS_DEMO_MODE || !db) {
        const data = getLocalStorage();
        const newIds: string[] = [];

        entries.forEach(entry => {
            const newEntry = { ...entry, id: `GL${Date.now()}-${Math.random().toString(36).substr(2, 9)}` } as PostedGLEntry;
            data.glEntries.push(newEntry);
            newIds.push(newEntry.id);
        });

        saveLocalStorage(data);
        return newIds;
    }

    try {
        const batch = writeBatch(db);
        const newIds: string[] = [];

        entries.forEach(entry => {
            const docRef = doc(collection(db, COLLECTIONS.GL_ENTRIES));
            batch.set(docRef, entry);
            newIds.push(docRef.id);
        });

        await batch.commit();
        return newIds;
    } catch (error) {
        console.error('Error adding GL entries:', error);
        throw new Error('Failed to add GL entries');
    }
};

// --- FIXED ASSETS ---
export const getAssets = async (): Promise<FixedAsset[]> => {
    return fetchCollection<FixedAsset>(COLLECTIONS.ASSETS);
};

export const getAssetsByClient = async (clientId: string): Promise<FixedAsset[]> => {
    return fetchCollection<FixedAsset>(
        COLLECTIONS.ASSETS,
        [where('clientId', '==', clientId)]
    );
};

export const addAsset = async (asset: Omit<FixedAsset, 'id'>): Promise<string> => {
    if (IS_DEMO_MODE || !db) {
        const data = getLocalStorage();
        const newAsset = { ...asset, id: `FA${Date.now()}` } as FixedAsset;
        data.assets.push(newAsset);
        saveLocalStorage(data);
        return newAsset.id;
    }

    try {
        const docRef = await addDoc(collection(db, COLLECTIONS.ASSETS), asset);
        return docRef.id;
    } catch (error) {
        console.error('Error adding asset:', error);
        throw new Error('Failed to add asset');
    }
};

export const updateAsset = async (asset: FixedAsset): Promise<void> => {
    if (IS_DEMO_MODE || !db) {
        const data = getLocalStorage();
        data.assets = data.assets.map(a => a.id === asset.id ? asset : a);
        saveLocalStorage(data);
        return;
    }

    try {
        await setDoc(doc(db, COLLECTIONS.ASSETS, asset.id), asset);
    } catch (error) {
        console.error('Error updating asset:', error);
        throw new Error('Failed to update asset');
    }
};

// --- VENDOR RULES ---
export const getRules = async (): Promise<VendorRule[]> => {
    return fetchCollection<VendorRule>(COLLECTIONS.VENDOR_RULES);
};

export const addRule = async (rule: Omit<VendorRule, 'id'>): Promise<string> => {
    if (IS_DEMO_MODE || !db) {
        const data = getLocalStorage();
        const newRule = { ...rule, id: `R${Date.now()}` } as VendorRule;
        data.vendorRules.push(newRule);
        saveLocalStorage(data);
        return newRule.id;
    }

    try {
        const docRef = await addDoc(collection(db, COLLECTIONS.VENDOR_RULES), rule);
        return docRef.id;
    } catch (error) {
        console.error('Error adding rule:', error);
        throw new Error('Failed to add rule');
    }
};

export const deleteRule = async (ruleId: string): Promise<void> => {
    if (IS_DEMO_MODE || !db) {
        const data = getLocalStorage();
        data.vendorRules = data.vendorRules.filter(r => r.id !== ruleId);
        saveLocalStorage(data);
        return;
    }

    try {
        await deleteDoc(doc(db, COLLECTIONS.VENDOR_RULES, ruleId));
    } catch (error) {
        console.error('Error deleting rule:', error);
        throw new Error('Failed to delete rule');
    }
};

// --- BANK TRANSACTIONS ---
export const getBankTransactions = async (): Promise<BankTransaction[]> => {
    return fetchCollection<BankTransaction>(COLLECTIONS.BANK_TRANSACTIONS);
};

export const getBankTransactionsByClient = async (clientId: string): Promise<BankTransaction[]> => {
    return fetchCollection<BankTransaction>(
        COLLECTIONS.BANK_TRANSACTIONS,
        [where('clientId', '==', clientId), orderBy('date', 'desc')]
    );
};

export const updateBankTransaction = async (transaction: BankTransaction): Promise<void> => {
    if (IS_DEMO_MODE || !db) {
        const data = getLocalStorage();
        data.bankTransactions = data.bankTransactions.map(t => t.id === transaction.id ? transaction : t);
        saveLocalStorage(data);
        return;
    }

    try {
        await setDoc(doc(db, COLLECTIONS.BANK_TRANSACTIONS, transaction.id), transaction);
    } catch (error) {
        console.error('Error updating bank transaction:', error);
        throw new Error('Failed to update bank transaction');
    }
};

export const addBankTransactions = async (transactions: Omit<BankTransaction, 'id'>[]): Promise<string[]> => {
    if (IS_DEMO_MODE || !db) {
        const data = getLocalStorage();
        const newIds: string[] = [];

        transactions.forEach(txn => {
            const newTxn = { ...txn, id: `BT${Date.now()}-${Math.random().toString(36).substr(2, 9)}` } as BankTransaction;
            data.bankTransactions.push(newTxn);
            newIds.push(newTxn.id);
        });

        saveLocalStorage(data);
        return newIds;
    }

    try {
        const batch = writeBatch(db);
        const newIds: string[] = [];

        transactions.forEach(txn => {
            const docRef = doc(collection(db, COLLECTIONS.BANK_TRANSACTIONS));
            batch.set(docRef, txn);
            newIds.push(docRef.id);
        });

        await batch.commit();
        return newIds;
    } catch (error) {
        console.error('Error adding bank transactions:', error);
        throw new Error('Failed to add bank transactions');
    }
};

// --- ACTIVITY LOGS ---
export const getLogs = async (limitCount: number = 50): Promise<ActivityLog[]> => {
    return fetchCollection<ActivityLog>(
        COLLECTIONS.ACTIVITY_LOGS,
        [orderBy('timestamp', 'desc')],
        limitCount
    );
};

export const addLog = async (log: Omit<ActivityLog, 'id'>): Promise<string> => {
    if (IS_DEMO_MODE || !db) {
        const data = getLocalStorage();
        const newLog = { ...log, id: `LOG${Date.now()}` } as ActivityLog;
        data.activityLogs.unshift(newLog); // Add to beginning

        // Keep only last 1000 logs
        if (data.activityLogs.length > 1000) {
            data.activityLogs = data.activityLogs.slice(0, 1000);
        }

        saveLocalStorage(data);
        return newLog.id;
    }

    try {
        const docRef = await addDoc(collection(db, COLLECTIONS.ACTIVITY_LOGS), {
            ...log,
            timestamp: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error('Error adding log:', error);
        // Don't throw - logging should not break the app
        return '';
    }
};

// --- INITIALIZATION (No more seed data) ---
export const seed = async (): Promise<void> => {
    // In production, no seeding - data comes from Firestore
    // In demo mode, initialize empty storage if not exists
    if (IS_DEMO_MODE) {
        const existingData = localStorage.getItem(STORAGE_KEY);
        if (!existingData) {
            saveLocalStorage({
                clients: [],
                documents: [],
                staff: [],
                glEntries: [],
                assets: [],
                vendorRules: [],
                bankTransactions: [],
                activityLogs: []
            });
        }
    }

    console.log(`Database initialized in ${IS_DEMO_MODE ? 'Demo' : 'Production'} mode`);
};

// --- BATCH OPERATIONS ---
export const batchUpdateDocuments = async (documents: DocumentRecord[]): Promise<void> => {
    if (IS_DEMO_MODE || !db) {
        const data = getLocalStorage();
        documents.forEach(doc => {
            const index = data.documents.findIndex(d => d.id === doc.id);
            if (index >= 0) {
                data.documents[index] = doc;
            }
        });
        saveLocalStorage(data);
        return;
    }

    try {
        const batch = writeBatch(db);
        documents.forEach(document => {
            const docRef = doc(db, COLLECTIONS.DOCUMENTS, document.id);
            batch.set(docRef, document);
        });
        await batch.commit();
    } catch (error) {
        console.error('Error batch updating documents:', error);
        throw new Error('Failed to batch update documents');
    }
};

// --- EXPORT DATABASE SERVICE ---
export const databaseService = {
    // Clients
    getClients,
    getClientById,
    addClient,
    updateClient,

    // Documents
    getDocuments,
    getDocumentsByClient,
    addDocument,
    updateDocument,
    deleteDocument,
    batchUpdateDocuments,

    // Staff
    getStaff,
    getStaffById,
    updateStaff,

    // GL Entries
    getGLEntries,
    getGLEntriesByClient,
    addGLEntry,
    addGLEntries,

    // Fixed Assets
    getAssets,
    getAssetsByClient,
    addAsset,
    updateAsset,

    // Vendor Rules
    getRules,
    addRule,
    deleteRule,

    // Bank Transactions
    getBankTransactions,
    getBankTransactionsByClient,
    updateBankTransaction,
    addBankTransactions,

    // Activity Logs
    getLogs,
    addLog,

    // Initialization
    seed,

    // Meta
    isDemoMode: IS_DEMO_MODE
};

export default databaseService;

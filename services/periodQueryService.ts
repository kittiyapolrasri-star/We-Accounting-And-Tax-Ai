/**
 * Period-based Query Service
 * Optimized queries for multi-tenant, multi-year data
 * 
 * Path format: /clients/{clientId}/documents/{year}/{month}
 */

import {
    collection,
    getDocs,
    query,
    where,
    orderBy,
    limit as firestoreLimit,
    QueryConstraint
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { DocumentRecord, PostedGLEntry, BankTransaction } from '../types';

const IS_DEMO_MODE = !isFirebaseConfigured;
const STORAGE_KEY = 'WE_ACCOUNTING_DB_V1';

// --- HELPER FUNCTIONS ---

/**
 * Extract year and month from date string
 */
export const extractPeriod = (dateStr: string): { year: number; month: string; period: string } => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return {
        year,
        month,
        period: `${year}-${month}`
    };
};

/**
 * Add period fields to a record
 */
export const addPeriodFields = <T extends { uploaded_at?: string; date?: string }>(
    record: T
): T & { year: number; month: string; period: string } => {
    const dateStr = record.uploaded_at || record.date || new Date().toISOString();
    const { year, month, period } = extractPeriod(dateStr);
    return { ...record, year, month, period };
};

// --- LOCAL STORAGE HELPERS ---
const getLocalStorage = () => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : { documents: [], glEntries: [], bankTransactions: [] };
    } catch {
        return { documents: [], glEntries: [], bankTransactions: [] };
    }
};

// --- DOCUMENTS ---

/**
 * Get documents by client and period
 * @param clientId - Client ID
 * @param year - Year (e.g., 2024)
 * @param month - Optional month (e.g., "01"-"12")
 */
export const getDocumentsByPeriod = async (
    clientId: string,
    year: number,
    month?: string
): Promise<DocumentRecord[]> => {
    if (IS_DEMO_MODE || !db) {
        const data = getLocalStorage();
        return data.documents.filter((doc: DocumentRecord) => {
            if (doc.clientId !== clientId) return false;

            const { year: docYear, month: docMonth } = extractPeriod(doc.uploaded_at);
            if (docYear !== year) return false;
            if (month && docMonth !== month) return false;

            return true;
        });
    }

    try {
        const constraints: QueryConstraint[] = [
            where('clientId', '==', clientId),
            where('year', '==', year)
        ];

        if (month) {
            constraints.push(where('month', '==', month));
        }

        constraints.push(orderBy('uploaded_at', 'desc'));

        const q = query(collection(db, 'documents'), ...constraints);
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DocumentRecord));
    } catch (error) {
        console.error('Error fetching documents by period:', error);
        return [];
    }
};

/**
 * Get documents summary by period (for dashboard)
 */
export const getDocumentsSummary = async (
    clientId: string,
    year: number
): Promise<{ month: string; count: number; amount: number }[]> => {
    const summary: Map<string, { count: number; amount: number }> = new Map();

    // Initialize all months
    for (let m = 1; m <= 12; m++) {
        const month = String(m).padStart(2, '0');
        summary.set(month, { count: 0, amount: 0 });
    }

    const docs = await getDocumentsByPeriod(clientId, year);

    docs.forEach(doc => {
        const { month } = extractPeriod(doc.uploaded_at);
        const current = summary.get(month) || { count: 0, amount: 0 };
        summary.set(month, {
            count: current.count + 1,
            amount: current.amount + (doc.amount || 0)
        });
    });

    return Array.from(summary.entries()).map(([month, data]) => ({
        month,
        ...data
    }));
};

// --- GL ENTRIES ---

/**
 * Get GL entries by client and period
 */
export const getGLEntriesByPeriod = async (
    clientId: string,
    year: number,
    month?: string
): Promise<PostedGLEntry[]> => {
    if (IS_DEMO_MODE || !db) {
        const data = getLocalStorage();
        return data.glEntries.filter((entry: PostedGLEntry) => {
            if (entry.clientId !== clientId) return false;

            const { year: entryYear, month: entryMonth } = extractPeriod(entry.date);
            if (entryYear !== year) return false;
            if (month && entryMonth !== month) return false;

            return true;
        });
    }

    try {
        const constraints: QueryConstraint[] = [
            where('clientId', '==', clientId),
            where('year', '==', year)
        ];

        if (month) {
            constraints.push(where('month', '==', month));
        }

        constraints.push(orderBy('date', 'desc'));

        const q = query(collection(db, 'gl_entries'), ...constraints);
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PostedGLEntry));
    } catch (error) {
        console.error('Error fetching GL entries by period:', error);
        return [];
    }
};

/**
 * Get trial balance for a period
 */
export const getTrialBalanceByPeriod = async (
    clientId: string,
    year: number,
    month?: string
): Promise<{ account_code: string; account_name: string; debit: number; credit: number }[]> => {
    const entries = await getGLEntriesByPeriod(clientId, year, month);

    const balances: Map<string, { account_name: string; debit: number; credit: number }> = new Map();

    entries.forEach(entry => {
        const current = balances.get(entry.account_code) || {
            account_name: entry.account_name,
            debit: 0,
            credit: 0
        };

        balances.set(entry.account_code, {
            account_name: entry.account_name,
            debit: current.debit + (entry.debit || 0),
            credit: current.credit + (entry.credit || 0)
        });
    });

    return Array.from(balances.entries())
        .map(([account_code, data]) => ({ account_code, ...data }))
        .sort((a, b) => a.account_code.localeCompare(b.account_code));
};

// --- BANK TRANSACTIONS ---

/**
 * Get bank transactions by client and period
 */
export const getBankTransactionsByPeriod = async (
    clientId: string,
    year: number,
    month?: string
): Promise<BankTransaction[]> => {
    if (IS_DEMO_MODE || !db) {
        const data = getLocalStorage();
        return data.bankTransactions.filter((tx: BankTransaction) => {
            if (tx.clientId !== clientId) return false;

            const { year: txYear, month: txMonth } = extractPeriod(tx.date);
            if (txYear !== year) return false;
            if (month && txMonth !== month) return false;

            return true;
        });
    }

    try {
        const constraints: QueryConstraint[] = [
            where('clientId', '==', clientId),
            where('year', '==', year)
        ];

        if (month) {
            constraints.push(where('month', '==', month));
        }

        constraints.push(orderBy('date', 'desc'));

        const q = query(collection(db, 'bank_transactions'), ...constraints);
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankTransaction));
    } catch (error) {
        console.error('Error fetching bank transactions by period:', error);
        return [];
    }
};

// --- REPORTING HELPERS ---

/**
 * Get VAT summary for a period
 */
export const getVATSummaryByPeriod = async (
    clientId: string,
    year: number,
    month: string
): Promise<{
    inputVAT: number;
    outputVAT: number;
    netPayable: number;
    documentCount: number;
}> => {
    const entries = await getGLEntriesByPeriod(clientId, year, month);

    let inputVAT = 0;  // Account 11540
    let outputVAT = 0; // Account 21540

    entries.forEach(entry => {
        if (entry.account_code === '11540') {
            inputVAT += entry.debit - entry.credit;
        } else if (entry.account_code === '21540') {
            outputVAT += entry.credit - entry.debit;
        }
    });

    const docs = await getDocumentsByPeriod(clientId, year, month);

    return {
        inputVAT,
        outputVAT,
        netPayable: outputVAT - inputVAT,
        documentCount: docs.length
    };
};

/**
 * Get client years with data
 */
export const getClientDataYears = async (clientId: string): Promise<number[]> => {
    // For demo mode, return current and last 2 years
    const currentYear = new Date().getFullYear();
    return [currentYear, currentYear - 1, currentYear - 2];
};

// --- EXPORT ---

export const periodQueryService = {
    // Helpers
    extractPeriod,
    addPeriodFields,

    // Documents
    getDocumentsByPeriod,
    getDocumentsSummary,

    // GL Entries
    getGLEntriesByPeriod,
    getTrialBalanceByPeriod,

    // Bank Transactions
    getBankTransactionsByPeriod,

    // Reporting
    getVATSummaryByPeriod,
    getClientDataYears,
};

export default periodQueryService;

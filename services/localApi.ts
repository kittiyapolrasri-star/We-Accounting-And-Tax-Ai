/**
 * Local Backend API Service
 * Replaces Firebase services for Local VM deployment
 */

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Get auth token from localStorage
 */
export const getAuthToken = (): string | null => {
    return localStorage.getItem('auth_token');
};

/**
 * Set auth token to localStorage
 */
export const setAuthToken = (token: string): void => {
    localStorage.setItem('auth_token', token);
};

/**
 * Remove auth token from localStorage
 */
export const removeAuthToken = (): void => {
    localStorage.removeItem('auth_token');
};

/**
 * Make authenticated API request
 */
export async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string; code?: string }> {
    try {
        const token = getAuthToken();

        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        if (token) {
            (headers as any)['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
        });

        const data = await response.json();

        if (!response.ok) {
            // Handle auth errors
            if (response.status === 401) {
                removeAuthToken();
                window.location.href = '/login';
            }

            return {
                success: false,
                error: data.error || 'เกิดข้อผิดพลาด',
                code: data.code,
            };
        }

        return data;
    } catch (error: any) {
        console.error('API request error:', error);

        if (error.message?.includes('fetch') || error.message?.includes('Network')) {
            return {
                success: false,
                error: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้',
                code: 'NETWORK_ERROR',
            };
        }

        return {
            success: false,
            error: 'เกิดข้อผิดพลาด กรุณาลองใหม่',
            code: 'UNKNOWN_ERROR',
        };
    }
}

// =====================================
// AUTH FUNCTIONS
// =====================================

export interface LoginResult {
    success: boolean;
    token?: string;
    user?: {
        uid: string;
        email: string;
        displayName: string;
        role: string;
        assignedClients: string[];
    };
    error?: string;
}

export const signIn = async (email: string, password: string): Promise<LoginResult> => {
    const result = await apiRequest<{ token: string; user: any }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });

    if (result.success && result.data?.token) {
        setAuthToken(result.data.token);
        return {
            success: true,
            token: result.data.token,
            user: result.data.user,
        };
    }

    return {
        success: false,
        error: result.error,
    };
};

export const signOut = (): void => {
    removeAuthToken();
    window.location.href = '/login';
};

export const getCurrentUser = async () => {
    const result = await apiRequest<{ user: any }>('/api/auth/me');
    return result.success ? result.data?.user : null;
};

// =====================================
// CLIENT FUNCTIONS
// =====================================

export const getClients = async (params?: { status?: string; search?: string }) => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    const result = await apiRequest<any[]>(`/api/clients${queryString}`);
    return result.data || [];
};

export const getClientById = async (id: string) => {
    const result = await apiRequest<any>(`/api/clients/${id}`);
    return result.data || null;
};

export const addClient = async (client: any) => {
    const result = await apiRequest<any>('/api/clients', {
        method: 'POST',
        body: JSON.stringify(client),
    });
    return result.data?.id || '';
};

export const updateClient = async (client: any) => {
    await apiRequest(`/api/clients/${client.id}`, {
        method: 'PUT',
        body: JSON.stringify(client),
    });
};

// =====================================
// DOCUMENT FUNCTIONS
// =====================================

export const getDocuments = async (params?: {
    clientId?: string;
    status?: string;
    period?: string;
    limit?: number;
}) => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    const result = await apiRequest<any[]>(`/api/documents${queryString}`);
    return result.data || [];
};

export const getDocumentsByClient = async (clientId: string) => {
    return getDocuments({ clientId });
};

export const addDocument = async (document: any) => {
    const result = await apiRequest<any>('/api/documents', {
        method: 'POST',
        body: JSON.stringify(document),
    });
    return result.data?.id || '';
};

export const updateDocument = async (document: any) => {
    await apiRequest(`/api/documents/${document.id}`, {
        method: 'PUT',
        body: JSON.stringify(document),
    });
};

export const deleteDocument = async (documentId: string) => {
    await apiRequest(`/api/documents/${documentId}`, {
        method: 'DELETE',
    });
};

// =====================================
// GL ENTRY FUNCTIONS
// =====================================

export const getGLEntries = async (params?: {
    clientId?: string;
    period?: string;
    limit?: number;
}) => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    const result = await apiRequest<any[]>(`/api/gl${queryString}`);
    return result.data || [];
};

export const getGLEntriesByClient = async (clientId: string) => {
    return getGLEntries({ clientId });
};

/**
 * Add GL entries - matches backend expected format
 * Backend expects: { client_id, date, entries[], source_doc_id?, journal_ref? }
 */
export const addGLEntries = async (postingData: {
    client_id: string;
    date: string;
    entries: Array<{
        account_code: string;
        account_name: string;
        debit?: number;
        credit?: number;
        description?: string;
    }>;
    source_doc_id?: string;
    journal_ref?: string;
}) => {
    const result = await apiRequest<any[]>('/api/gl', {
        method: 'POST',
        body: JSON.stringify(postingData),
    });
    return result.data?.map((e: any) => e.id) || [];
};

/**
 * Add GL entries from journal lines (simplified interface)
 * Converts journal_lines format to backend format
 */
export const addGLEntriesFromJournalLines = async (
    clientId: string,
    date: string,
    journalLines: Array<{
        account_code: string;
        account_name_th?: string;
        account_side: 'DEBIT' | 'CREDIT';
        amount: number;
    }>,
    sourceDocId?: string
) => {
    const entries = journalLines.map(line => ({
        account_code: line.account_code,
        account_name: line.account_name_th || line.account_code,
        debit: line.account_side === 'DEBIT' ? line.amount : 0,
        credit: line.account_side === 'CREDIT' ? line.amount : 0,
    }));

    return addGLEntries({
        client_id: clientId,
        date,
        entries,
        source_doc_id: sourceDocId,
    });
};

// =====================================
// FILE FUNCTIONS
// =====================================

export const uploadDocument = async (
    file: File,
    clientId: string,
    docType: string = 'invoice'
) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('clientId', clientId);
    formData.append('docType', docType);

    const token = getAuthToken();

    const response = await fetch(`${API_BASE_URL}/api/files/upload`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
    });

    const result = await response.json();

    return {
        success: result.success,
        fileUrl: result.data?.url,
        storagePath: result.data?.path,
        error: result.error,
    };
};

// =====================================
// ANALYZE FUNCTIONS (Gemini)
// =====================================

export const analyzeDocument = async (
    file: File,
    clientId?: string,
    clientName?: string
) => {
    // Convert file to base64
    const base64Data = await fileToBase64(file);

    const result = await apiRequest<any>('/api/analyze/document', {
        method: 'POST',
        body: JSON.stringify({
            fileData: base64Data,
            mimeType: file.type,
            clientId: clientId || 'unknown',
            clientName: clientName || 'Unknown',
        }),
    });

    if (!result.success) {
        throw new Error(result.error || 'การวิเคราะห์เอกสารล้มเหลว');
    }

    return result.data;
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            const base64Data = base64String.split(',')[1];
            resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

// =====================================
// ACTIVITY LOG
// =====================================

export const getLogs = async (limit: number = 50) => {
    const result = await apiRequest<any[]>(`/api/activity-logs?limit=${limit}`);
    return result.data || [];
};

export const addLog = async (log: any) => {
    const result = await apiRequest<any>('/api/activity-logs', {
        method: 'POST',
        body: JSON.stringify(log),
    });
    return result.data?.id || '';
};

// =====================================
// STAFF FUNCTIONS
// =====================================

export const getStaff = async (params?: { role?: string; is_active?: boolean }) => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    const result = await apiRequest<any[]>(`/api/staff${queryString}`);
    return result.data || [];
};

export const getStaffById = async (id: string) => {
    const result = await apiRequest<any>(`/api/staff/${id}`);
    return result.data || null;
};

export const addStaff = async (staff: any) => {
    const result = await apiRequest<any>('/api/staff', {
        method: 'POST',
        body: JSON.stringify(staff),
    });
    return result.data?.id || '';
};

export const updateStaff = async (staff: any) => {
    await apiRequest(`/api/staff/${staff.id}`, {
        method: 'PUT',
        body: JSON.stringify(staff),
    });
};

// =====================================
// FIXED ASSETS FUNCTIONS
// =====================================

export const getAssets = async (params?: { clientId?: string; status?: string }) => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    const result = await apiRequest<any[]>(`/api/assets${queryString}`);
    return result.data || [];
};

export const getAssetsByClient = async (clientId: string) => {
    return getAssets({ clientId });
};

export const addAsset = async (asset: any) => {
    const result = await apiRequest<any>('/api/assets', {
        method: 'POST',
        body: JSON.stringify(asset),
    });
    return result.data?.id || '';
};

export const updateAsset = async (asset: any) => {
    await apiRequest(`/api/assets/${asset.id}`, {
        method: 'PUT',
        body: JSON.stringify(asset),
    });
};

export const depreciateAsset = async (assetId: string, period: string) => {
    const result = await apiRequest<any>(`/api/assets/${assetId}/depreciate`, {
        method: 'POST',
        body: JSON.stringify({ period }),
    });
    return result.data;
};

// =====================================
// BANK TRANSACTION FUNCTIONS
// =====================================

export const getBankTransactions = async (params?: { clientId?: string; status?: string; year?: number; month?: string }) => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    const result = await apiRequest<any[]>(`/api/bank${queryString}`);
    return result.data || [];
};

export const getBankTransactionsByClient = async (clientId: string) => {
    return getBankTransactions({ clientId });
};

export const addBankTransactions = async (clientId: string, transactions: any[]) => {
    const result = await apiRequest<any[]>('/api/bank/import', {
        method: 'POST',
        body: JSON.stringify({ client_id: clientId, transactions }),
    });
    return result.data || [];
};

export const matchBankTransaction = async (transactionId: string, documentId: string) => {
    const result = await apiRequest<any>(`/api/bank/${transactionId}/match`, {
        method: 'POST',
        body: JSON.stringify({ documentId }),
    });
    return result.data;
};

export const reconcileBankTransaction = async (transactionId: string) => {
    const result = await apiRequest<any>(`/api/bank/${transactionId}/reconcile`, {
        method: 'POST',
    });
    return result.data;
};

export const updateBankTransaction = async (transaction: any) => {
    await apiRequest(`/api/bank/${transaction.id}`, {
        method: 'PUT',
        body: JSON.stringify(transaction),
    });
};

// =====================================
// VENDOR RULES FUNCTIONS
// =====================================

export const getRules = async (params?: { clientId?: string }) => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    const result = await apiRequest<any[]>(`/api/rules${queryString}`);
    return result.data || [];
};

export const getRulesByClient = async (clientId: string) => {
    return getRules({ clientId });
};

export const addRule = async (rule: any) => {
    const result = await apiRequest<any>('/api/rules', {
        method: 'POST',
        body: JSON.stringify(rule),
    });
    return result.data?.id || '';
};

export const deleteRule = async (ruleId: string) => {
    await apiRequest(`/api/rules/${ruleId}`, {
        method: 'DELETE',
    });
};

export const matchVendorRule = async (vendorName: string, clientId?: string) => {
    const result = await apiRequest<any>('/api/rules/match', {
        method: 'POST',
        body: JSON.stringify({ vendorName, clientId }),
    });
    return result.data;
};

// =====================================
// TASK FUNCTIONS
// =====================================

export const getTasks = async (params?: { clientId?: string; status?: string; assigneeId?: string }) => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    const result = await apiRequest<any[]>(`/api/tasks${queryString}`);
    return result.data || [];
};

export const getMyTasks = async (status?: string) => {
    const queryString = status ? `?status=${status}` : '';
    const result = await apiRequest<any[]>(`/api/tasks/my${queryString}`);
    return result.data || [];
};

export const addTask = async (task: any) => {
    const result = await apiRequest<any>('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(task),
    });
    return result.data?.id || '';
};

export const updateTask = async (task: any) => {
    await apiRequest(`/api/tasks/${task.id}`, {
        method: 'PUT',
        body: JSON.stringify(task),
    });
};

export const completeTask = async (taskId: string) => {
    const result = await apiRequest<any>(`/api/tasks/${taskId}/complete`, {
        method: 'POST',
    });
    return result.data;
};

export const deleteTask = async (taskId: string) => {
    await apiRequest(`/api/tasks/${taskId}`, {
        method: 'DELETE',
    });
};

// =====================================
// FINANCIAL REPORTS FUNCTIONS
// =====================================

export const getIncomeStatement = async (
    clientId: string,
    periodStart?: string,
    periodEnd?: string,
    period?: string
) => {
    const params = new URLSearchParams({ clientId });
    if (period) params.append('period', period);
    if (periodStart) params.append('periodStart', periodStart);
    if (periodEnd) params.append('periodEnd', periodEnd);

    const result = await apiRequest<any>(`/api/reports/income-statement?${params}`);
    return result.data;
};

export const getBalanceSheet = async (
    clientId: string,
    asOfDate?: string,
    period?: string
) => {
    const params = new URLSearchParams({ clientId });
    if (asOfDate) params.append('asOfDate', asOfDate);
    if (period) params.append('period', period);

    const result = await apiRequest<any>(`/api/reports/balance-sheet?${params}`);
    return result.data;
};

export const getTrialBalance = async (clientId: string, period: string) => {
    const result = await apiRequest<any>(`/api/gl/trial-balance?clientId=${clientId}&period=${period}`);
    return result.data;
};

export const getFinancialSummary = async (clientId: string, period?: string) => {
    const params = new URLSearchParams({ clientId });
    if (period) params.append('period', period);

    const result = await apiRequest<any>(`/api/reports/summary?${params}`);
    return result.data;
};

export const getIncomeStatementHTML = async (
    clientId: string,
    period?: string,
    periodStart?: string,
    periodEnd?: string
) => {
    const params = new URLSearchParams({ clientId });
    if (period) params.append('period', period);
    if (periodStart) params.append('periodStart', periodStart);
    if (periodEnd) params.append('periodEnd', periodEnd);

    const response = await fetch(`${API_BASE_URL}/api/reports/income-statement/html?${params}`, {
        headers: getAuthHeaders(),
    });
    return response.text();
};

// =====================================
// EXPORT DATABASE SERVICE OBJECT
// =====================================

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

    // GL Entries
    getGLEntries,
    getGLEntriesByClient,
    addGLEntries,
    addGLEntriesFromJournalLines,

    // Files
    uploadDocument,

    // Analyze
    analyzeDocument,

    // Logs
    getLogs,
    addLog,

    // Staff
    getStaff,
    getStaffById,
    addStaff,
    updateStaff,

    // Fixed Assets
    getAssets,
    getAssetsByClient,
    addAsset,
    updateAsset,
    depreciateAsset,

    // Bank Transactions
    getBankTransactions,
    getBankTransactionsByClient,
    addBankTransactions,
    matchBankTransaction,
    reconcileBankTransaction,
    updateBankTransaction,

    // Vendor Rules
    getRules,
    getRulesByClient,
    addRule,
    deleteRule,
    matchVendorRule,

    // Tasks
    getTasks,
    getMyTasks,
    addTask,
    updateTask,
    completeTask,
    deleteTask,

    // Financial Reports
    getIncomeStatement,
    getBalanceSheet,
    getTrialBalance,
    getFinancialSummary,
    getIncomeStatementHTML,

    // Meta
    isDemoMode: false,
};

export default databaseService;




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
    limit,
    Firestore
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";
import { Client, DocumentRecord, Staff, PostedGLEntry, FixedAsset, VendorRule, BankTransaction, ActivityLog } from '../types';

// --- SEED DATA (In-Memory Fallback & Initial Real DB Population) ---

const STORAGE_KEY = 'WE_ACCOUNTING_DB_V1';

let SEED_STAFF: Staff[] = [
  { id: 'S001', name: 'Somsri Account', role: 'Manager', email: 'somsri@weaccounting.co.th', active_tasks: 12 },
  { id: 'S002', name: 'John Ledger', role: 'Senior Accountant', email: 'john@weaccounting.co.th', active_tasks: 8 },
  { id: 'S003', name: 'Nida Tax', role: 'Junior Accountant', email: 'nida@weaccounting.co.th', active_tasks: 3 },
];

let SEED_CLIENTS: Client[] = [
  { 
      id: 'C001', name: 'Tech Solutions Co., Ltd.', tax_id: '0105560001234', industry: 'Software House', contact_person: 'Khun Somchai', status: 'Active', 
      assigned_staff_id: 'S002', last_closing_date: '31 Jan 2024',
      current_workflow: { 
          month: '2024-02', vat_status: 'Ready to File', wht_status: 'In Progress', closing_status: 'In Progress', is_locked: false, doc_count: 45, pending_count: 2,
          issues: [] 
      },
      client_requests: [
          { id: 'R1', title: 'ขอ Statement เดือน ม.ค. 67', description: 'บัญชี KBANK-8899 ยังไม่ได้รับ', due_date: '2024-02-15', status: 'Pending', request_type: 'BankStatement' },
          { id: 'R2', title: 'ยืนยันยอดลูกหนี้คงเหลือ', description: 'บริษัท ABC จำกัด ยอด 50,000 บาท', due_date: '2024-02-20', status: 'Pending', request_type: 'Clarification' }
      ],
      published_reports: [
          { id: 'PUB1', title: 'งบการเงินปี 2566 (Draft)', type: 'Financial Statement', generated_date: '2024-02-01', download_url: '#' },
          { id: 'PUB2', title: 'ภ.พ.30 ม.ค. 67', type: 'Tax Return', generated_date: '2024-02-10', download_url: '#' }
      ]
  },
  { 
      id: 'C002', name: 'Design Studio 99', tax_id: '0105559005678', industry: 'Marketing Agency', contact_person: 'Khun Aom', status: 'Active', 
      assigned_staff_id: 'S001', last_closing_date: '31 Jan 2024',
      current_workflow: { 
          month: '2024-02', vat_status: 'Filed/Closed', wht_status: 'Filed/Closed', closing_status: 'Filed/Closed', is_locked: true, doc_count: 120, pending_count: 0,
          issues: [] 
      } 
  },
  { 
      id: 'C003', name: 'Siam Import Export', tax_id: '0105558009999', industry: 'Logistics', contact_person: 'Khun Peter', status: 'Suspended', 
      assigned_staff_id: 'S003', last_closing_date: '31 Dec 2023',
      current_workflow: { 
          month: '2024-02', vat_status: 'Not Started', wht_status: 'Not Started', closing_status: 'Not Started', is_locked: false, doc_count: 0, pending_count: 0,
          issues: [{ id: 'I01', severity: 'High', title: 'Missing Statement Jan', description: 'Bank Statement missing for Jan', created_at: '2024-02-01', action_type: 'bank_recon' }]
      } 
  }
];

let SEED_RULES: VendorRule[] = [
    { id: 'R001', vendorNameKeyword: '7-Eleven', accountCode: '52990', accountName: 'ค่าใช้จ่ายเบ็ดเตล็ด (Misc Expense)', vatType: 'NON_CLAIMABLE' },
    { id: 'R002', vendorNameKeyword: 'Grab', accountCode: '52300', accountName: 'ค่าพาหนะ (Transportation)', vatType: 'EXEMPT' },
    { id: 'R003', vendorNameKeyword: 'True', accountCode: '52400', accountName: 'ค่าโทรศัพท์และอินเทอร์เน็ต', vatType: 'CLAIMABLE' },
    { id: 'R004', vendorNameKeyword: 'OfficeMate', accountCode: '52700', accountName: 'วัสดุสำนักงาน', vatType: 'CLAIMABLE' },
    { id: 'R005', vendorNameKeyword: 'Google', accountCode: '52400', accountName: 'ค่าบริการซอฟต์แวร์ (Software Sub)', vatType: 'CLAIMABLE' },
];

let SEED_GL: PostedGLEntry[] = [
    // Opening Balance
    { id: 'GL000', clientId: 'C001', date: '2024-01-01', doc_no: 'OP-001', description: 'ยอดยกมา (Opening Balance)', account_code: '11120', account_name: 'เงินฝากธนาคาร (Bank Deposit)', debit: 1250000, credit: 0 },
    { id: 'GL000-2', clientId: 'C001', date: '2024-01-01', doc_no: 'OP-001', description: 'ยอดยกมา (Opening Balance)', account_code: '31000', account_name: 'ทุนจดทะเบียน (Share Capital)', debit: 0, credit: 1000000 },
    { id: 'GL000-3', clientId: 'C001', date: '2024-01-01', doc_no: 'OP-001', description: 'ยอดยกมา (Opening Balance)', account_code: '32000', account_name: 'กำไรสะสม (Retained Earnings)', debit: 0, credit: 250000 },
    
    // Revenue Transactions (To create Output VAT)
    { id: 'GL-SAL-01', clientId: 'C001', date: '2024-02-05', doc_no: 'IV-2024-001', description: 'รายได้ค่าบริการ - ลูกค้า A', account_code: '11300', account_name: 'ลูกหนี้การค้า', debit: 107000, credit: 0 },
    { id: 'GL-SAL-02', clientId: 'C001', date: '2024-02-05', doc_no: 'IV-2024-001', description: 'รายได้ค่าบริการ - ลูกค้า A', account_code: '41100', account_name: 'รายได้จากการบริการ', debit: 0, credit: 100000 },
    { id: 'GL-SAL-03', clientId: 'C001', date: '2024-02-05', doc_no: 'IV-2024-001', description: 'รายได้ค่าบริการ - ลูกค้า A', account_code: '21540', account_name: 'ภาษีขาย (Output VAT)', debit: 0, credit: 7000 },

    // Expense Transactions
    { id: 'GL001', clientId: 'C001', date: '2024-02-01', doc_no: 'INV-RENT-001', description: 'ค่าเช่าออฟฟิศ ก.พ. 67', account_code: '52100', account_name: 'ค่าเช่า (Rent)', debit: 25000, credit: 0 },
    { id: 'GL002', clientId: 'C001', date: '2024-02-01', doc_no: 'INV-RENT-001', description: 'ค่าเช่าออฟฟิศ ก.พ. 67', account_code: '11120', account_name: 'เงินฝากธนาคาร', debit: 0, credit: 23750 },
    { id: 'GL003', clientId: 'C001', date: '2024-02-01', doc_no: 'INV-RENT-001', description: 'ค่าเช่าออฟฟิศ ก.พ. 67', account_code: '21400', account_name: 'ภาษีหัก ณ ที่จ่ายค้างจ่าย (WHT Payable)', debit: 0, credit: 1250 },
];

let SEED_ASSETS: FixedAsset[] = [
    {
        id: 'FA001', clientId: 'C001', asset_code: '12400-001', name: 'MacBook Pro M3 (Design)', category: 'Equipment',
        acquisition_date: '2024-01-15', cost: 85000, residual_value: 1, useful_life_years: 3,
        accumulated_depreciation_bf: 0, current_month_depreciation: 2361.08
    },
    {
        id: 'FA002', clientId: 'C001', asset_code: '12500-001', name: 'Toyota Fortuner (Company Car)', category: 'Vehicle',
        acquisition_date: '2023-06-01', cost: 1500000, residual_value: 1, useful_life_years: 5,
        accumulated_depreciation_bf: 200000, current_month_depreciation: 25000.00
    },
];

let SEED_BANK: BankTransaction[] = [
  { id: 'B001', clientId: 'C001', date: '2024-02-14', description: 'TRF TO TRUE CORP PUBLIC', amount: -15430.00, status: 'unmatched' },
  { id: 'B002', clientId: 'C001', date: '2024-02-12', description: 'POS 9988 OFFICEMATE', amount: -2500.00, status: 'unmatched' },
  { id: 'B003', clientId: 'C001', date: '2024-02-15', description: 'SALES DEPOSIT 8899', amount: 45000.00, status: 'unmatched' },
  { id: 'B004', clientId: 'C001', date: '2024-02-16', description: 'KERRY EXPRESS', amount: -450.00, status: 'unmatched' },
  { id: 'B005', clientId: 'C001', date: '2024-02-28', description: 'INTEREST RECEIVED', amount: 125.50, status: 'unmatched' },
];

let SEED_DOCS: DocumentRecord[] = [
    { 
      id: 'D001', 
      uploaded_at: '2024-02-14T10:30:00Z', 
      filename: 'INV-2024-001_TrueCorp.jpg', 
      status: 'pending_review', 
      assigned_to: 'S002', 
      client_name: 'Tech Solutions Co., Ltd.', 
      amount: 15400.00,
      ai_data: {
          status: 'success', confidence_score: 98, audit_flags: [], review_reason: null,
          financials: { subtotal: 14392.52, vat_amount: 1007.48, grand_total: 15400, vat_rate: 7, discount: 0, wht_amount: null },
          header_data: { issue_date: '2024-02-14', inv_number: 'TRUE-2402', doc_type: 'Tax Invoice', currency: 'THB' },
          parties: { client_company: { name: 'Tech Solutions Co., Ltd.', tax_id: '0105560001234' }, counterparty: { name: 'True Corp', tax_id: '0105536000123', branch: '00000' } },
          tax_compliance: { is_full_tax_invoice: true, vat_claimable: true, wht_flag: false },
          file_metadata: { suggested_filename: 'INV_TRUE', suggested_folder_path: 'Tech/Feb' },
          accounting_entry: { 
              transaction_description: 'ค่าบริการโทรศัพท์', account_class: 'Expense', 
              journal_lines: [
                  {account_code: '52400', account_side: 'DEBIT', account_name_th: 'ค่าโทรศัพท์', amount: 14392.52},
                  {account_code: '11540', account_side: 'DEBIT', account_name_th: 'ภาษีซื้อ', amount: 1007.48},
                  {account_code: '21200', account_side: 'CREDIT', account_name_th: 'เจ้าหนี้การค้า', amount: 15400.00}
              ] 
          }
      } as any
    },
    { 
      id: 'D002', 
      uploaded_at: '2024-02-15T14:20:00Z', 
      filename: 'RECEIPT-Grab-Travel.jpg', 
      status: 'approved', 
      assigned_to: 'S002', 
      client_name: 'Tech Solutions Co., Ltd.', 
      amount: 450.00,
      ai_data: {
          status: 'success', confidence_score: 95, audit_flags: [], review_reason: null,
          financials: { subtotal: 450, vat_amount: 0, grand_total: 450, vat_rate: 0, discount: 0, wht_amount: null },
          header_data: { issue_date: '2024-02-15', inv_number: 'GRAB-8822', doc_type: 'Receipt', currency: 'THB' },
          parties: { client_company: { name: 'Tech Solutions Co., Ltd.', tax_id: '0105560001234' }, counterparty: { name: 'Grab Taxi', tax_id: '0105555000555' } },
          tax_compliance: { is_full_tax_invoice: false, vat_claimable: false, wht_flag: false },
          file_metadata: { suggested_filename: 'RCPT_GRAB', suggested_folder_path: 'Tech/Feb' },
          accounting_entry: { 
              transaction_description: 'ค่าพาหนะเดินทาง (Transportation)', account_class: 'Expense', 
              journal_lines: [
                  {account_code: '52300', account_side: 'DEBIT', account_name_th: 'ค่าพาหนะ', amount: 450},
                  {account_code: '21200', account_side: 'CREDIT', account_name_th: 'เจ้าหนี้การค้า', amount: 450}
              ] 
          }
      } as any
    },
];

let SEED_LOGS: ActivityLog[] = [
    { id: 'L001', timestamp: new Date(Date.now() - 3600000).toISOString(), user_id: 'S002', user_name: 'John Ledger', action: 'LOGIN', details: 'System Login successful', status: 'success' },
    { id: 'L002', timestamp: new Date(Date.now() - 3000000).toISOString(), user_id: 'S002', user_name: 'John Ledger', action: 'UPLOAD', details: 'Uploaded 5 documents for Tech Solutions', status: 'success' },
    { id: 'L003', timestamp: new Date(Date.now() - 1500000).toISOString(), user_id: 'S002', user_name: 'John Ledger', action: 'APPROVE', details: 'Approved INV-2024-001 (True Corp)', status: 'success' },
    { id: 'L004', timestamp: new Date(Date.now() - 500000).toISOString(), user_id: 'S001', user_name: 'Somsri Account', action: 'CLOSE_PERIOD', details: 'Closed VAT Period for Design Studio 99', status: 'success' },
];

// --- STORAGE HELPER (Offline Persistence) ---
const saveToStorage = () => {
    if (typeof window !== 'undefined') {
        const data = {
            SEED_CLIENTS, SEED_DOCS, SEED_STAFF, SEED_GL, SEED_ASSETS, SEED_RULES, SEED_BANK, SEED_LOGS
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
};

const loadFromStorage = () => {
    if (typeof window !== 'undefined') {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            try {
                const parsed = JSON.parse(data);
                if(parsed.SEED_CLIENTS) SEED_CLIENTS = parsed.SEED_CLIENTS;
                if(parsed.SEED_DOCS) SEED_DOCS = parsed.SEED_DOCS;
                if(parsed.SEED_STAFF) SEED_STAFF = parsed.SEED_STAFF;
                if(parsed.SEED_GL) SEED_GL = parsed.SEED_GL;
                if(parsed.SEED_ASSETS) SEED_ASSETS = parsed.SEED_ASSETS;
                if(parsed.SEED_RULES) SEED_RULES = parsed.SEED_RULES;
                if(parsed.SEED_BANK) SEED_BANK = parsed.SEED_BANK;
                if(parsed.SEED_LOGS) SEED_LOGS = parsed.SEED_LOGS;
                console.log("Loaded offline data from local storage.");
            } catch (e) {
                console.error("Failed to load local storage data", e);
            }
        }
    }
};

// --- DATABASE OPERATIONS ---

const COLLECTIONS = {
    CLIENTS: 'clients',
    DOCUMENTS: 'documents',
    STAFF: 'staff',
    GL_ENTRIES: 'gl_entries',
    ASSETS: 'assets',
    RULES: 'vendor_rules',
    BANK_TXNS: 'bank_transactions',
    LOGS: 'activity_logs'
};

// Check if Firebase is truly connected and usable
const checkDb = (): boolean => {
    if (!isFirebaseConfigured || !db) {
        return false;
    }
    return true;
};

// Internal helper to get mock data if DB fails
const getMockData = (collectionName: string) => {
    switch (collectionName) {
        case COLLECTIONS.CLIENTS: return SEED_CLIENTS;
        case COLLECTIONS.DOCUMENTS: 
            // Sort Descending by Uploaded At to mimic Firestore OrderBy
            return [...SEED_DOCS].sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
        case COLLECTIONS.STAFF: return SEED_STAFF;
        case COLLECTIONS.GL_ENTRIES: return SEED_GL;
        case COLLECTIONS.ASSETS: return SEED_ASSETS;
        case COLLECTIONS.RULES: return SEED_RULES;
        case COLLECTIONS.BANK_TXNS: return SEED_BANK;
        case COLLECTIONS.LOGS: 
            // Sort Descending by Timestamp to mimic Firestore OrderBy
            return [...SEED_LOGS].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        default: return [];
    }
};

// Generic Fetcher with Robust Fallback
async function fetchCollection<T>(collectionName: string, limitCount?: number): Promise<T[]> {
    if (checkDb()) {
        try {
            let q;
            if (collectionName === COLLECTIONS.DOCUMENTS || collectionName === COLLECTIONS.LOGS) {
                 q = query(collection(db, collectionName), orderBy(collectionName === COLLECTIONS.LOGS ? 'timestamp' : 'uploaded_at', 'desc'), limit(limitCount || 50));
            } else if (collectionName === COLLECTIONS.GL_ENTRIES && limitCount) {
                 q = query(collection(db, collectionName), limit(limitCount));
            } else {
                 q = collection(db, collectionName);
            }
            const querySnapshot = await getDocs(q);
            const data: T[] = [];
            querySnapshot.forEach((doc) => {
                data.push(doc.data() as T);
            });
            
            // If connected but empty, return empty (don't fallback to mock if real DB is active but just empty)
            if (data.length === 0 && (collectionName === COLLECTIONS.CLIENTS || collectionName === COLLECTIONS.STAFF)) {
                 // Exception: If critical master data is missing, we allow empty return here, 
                 // because seedDatabase will handle population.
                 return [];
            }
            return data;
        } catch (error) {
            console.warn(`Firestore read failed for ${collectionName}. Switching to Offline Mode.`);
        }
    }
    // If we reach here, we are offline or fallback
    let data = getMockData(collectionName) as unknown as T[];
    if (limitCount && data.length > limitCount) {
        data = data.slice(0, limitCount);
    }
    return data;
}

// Client-Specific Fetcher
async function fetchByClient<T>(collectionName: string, clientId: string): Promise<T[]> {
    if (checkDb()) {
        try {
            const q = query(collection(db, collectionName), where("clientId", "==", clientId));
            const querySnapshot = await getDocs(q);
            const data: T[] = [];
            querySnapshot.forEach((doc) => {
                data.push(doc.data() as T);
            });
            return data;
        } catch (error) {
            console.warn(`Firestore client fetch failed. Using Offline Mode.`);
        }
    }
    const allMock = getMockData(collectionName) as any[];
    return allMock.filter(item => item.clientId === clientId) as unknown as T[];
}

// Seeder Function - CRITICAL for "Real Data" experience
export const seedDatabase = async () => {
    // If offline, try load from storage first to persist state across reloads
    if (!checkDb()) {
        loadFromStorage();
        console.log("Skipping DB Seed: Offline Mode Active. Using Local Storage.");
        return;
    }
    try {
        const clientsRef = collection(db, COLLECTIONS.CLIENTS);
        const clientsSnapshot = await getDocs(query(clientsRef, limit(1)));
        
        // Only seed if empty
        if (!clientsSnapshot.empty) return; 

        console.log("Seeding Firestore with Initial Real-World Data...");
        const batch = writeBatch(db);

        // Helper to safely add doc
        const safeSet = (col: string, id: string, data: any) => {
            const ref = doc(db, col, id);
            batch.set(ref, data);
        };

        SEED_CLIENTS.forEach(c => safeSet(COLLECTIONS.CLIENTS, c.id, c));
        SEED_STAFF.forEach(s => safeSet(COLLECTIONS.STAFF, s.id, s));
        SEED_DOCS.forEach(d => safeSet(COLLECTIONS.DOCUMENTS, d.id, d));
        SEED_GL.forEach(g => safeSet(COLLECTIONS.GL_ENTRIES, g.id, g));
        SEED_ASSETS.forEach(a => safeSet(COLLECTIONS.ASSETS, a.id, a));
        SEED_RULES.forEach(r => safeSet(COLLECTIONS.RULES, r.id, r));
        SEED_BANK.forEach(b => safeSet(COLLECTIONS.BANK_TXNS, b.id, b));
        SEED_LOGS.forEach(l => safeSet(COLLECTIONS.LOGS, l.id, l));

        await batch.commit();
        console.log("Database Seeding Complete.");
    } catch (e) {
        console.error("Seeding failed (non-critical):", e);
    }
};

// WRITE OPERATIONS - With In-Memory Persistence fallback for Offline Demo
export const databaseService = {
    seed: seedDatabase,

    // Clients
    getClients: () => fetchCollection<Client>(COLLECTIONS.CLIENTS),
    updateClient: async (client: Client) => {
        if (!checkDb()) {
            SEED_CLIENTS = SEED_CLIENTS.map(c => c.id === client.id ? client : c);
            saveToStorage();
            return;
        }
        try { await setDoc(doc(db, COLLECTIONS.CLIENTS, client.id), client); } catch(e) { 
            console.warn("Write failed (Offline)", e); 
            SEED_CLIENTS = SEED_CLIENTS.map(c => c.id === client.id ? client : c); 
            saveToStorage();
        }
    },

    // Documents
    getDocuments: (limitCount: number = 50) => fetchCollection<DocumentRecord>(COLLECTIONS.DOCUMENTS, limitCount),
    addDocument: async (docData: DocumentRecord) => {
        if (!checkDb()) {
            SEED_DOCS = [docData, ...SEED_DOCS];
            saveToStorage();
            return;
        }
        try { await setDoc(doc(db, COLLECTIONS.DOCUMENTS, docData.id), docData); } catch(e) { 
            console.warn("Write failed (Offline)", e); 
            SEED_DOCS = [docData, ...SEED_DOCS]; 
            saveToStorage();
        }
    },
    updateDocument: async (docData: DocumentRecord) => {
        if (!checkDb()) {
            SEED_DOCS = SEED_DOCS.map(d => d.id === docData.id ? docData : d);
            saveToStorage();
            return;
        }
        try { await setDoc(doc(db, COLLECTIONS.DOCUMENTS, docData.id), docData); } catch(e) { 
            console.warn("Write failed (Offline)", e); 
            SEED_DOCS = SEED_DOCS.map(d => d.id === docData.id ? docData : d); 
            saveToStorage();
        }
    },

    // Staff
    getStaff: () => fetchCollection<Staff>(COLLECTIONS.STAFF),
    updateStaff: async (staff: Staff) => {
        if (!checkDb()) {
            SEED_STAFF = SEED_STAFF.map(s => s.id === staff.id ? staff : s);
            saveToStorage();
            return;
        }
        try { await setDoc(doc(db, COLLECTIONS.STAFF, staff.id), staff); } catch(e) { 
            console.warn("Write failed (Offline)", e); 
            SEED_STAFF = SEED_STAFF.map(s => s.id === staff.id ? staff : s);
            saveToStorage();
        }
    },

    // GL Entries
    getGLEntries: (limitCount: number = 200) => fetchCollection<PostedGLEntry>(COLLECTIONS.GL_ENTRIES, limitCount), 
    getGLEntriesByClient: (clientId: string) => fetchByClient<PostedGLEntry>(COLLECTIONS.GL_ENTRIES, clientId),
    addGLEntry: async (entry: PostedGLEntry) => {
        if (!checkDb()) {
            SEED_GL = [...SEED_GL, entry];
            saveToStorage();
            return;
        }
        try { await setDoc(doc(db, COLLECTIONS.GL_ENTRIES, entry.id), entry); } catch(e) { 
            console.warn("Write failed (Offline)", e); 
            SEED_GL = [...SEED_GL, entry]; 
            saveToStorage();
        }
    },

    // Assets
    getAssets: () => fetchCollection<FixedAsset>(COLLECTIONS.ASSETS),
    getAssetsByClient: (clientId: string) => fetchByClient<FixedAsset>(COLLECTIONS.ASSETS, clientId),
    addAsset: async (asset: FixedAsset) => {
        if (!checkDb()) {
            SEED_ASSETS = [...SEED_ASSETS, asset];
            saveToStorage();
            return;
        }
        try { await setDoc(doc(db, COLLECTIONS.ASSETS, asset.id), asset); } catch(e) { 
            console.warn("Write failed (Offline)", e); 
            SEED_ASSETS = [...SEED_ASSETS, asset]; 
            saveToStorage();
        }
    },

    // Rules
    getRules: () => fetchCollection<VendorRule>(COLLECTIONS.RULES),
    addRule: async (rule: VendorRule) => {
        if (!checkDb()) {
            SEED_RULES = [...SEED_RULES, rule];
            saveToStorage();
            return;
        }
        try { await setDoc(doc(db, COLLECTIONS.RULES, rule.id), rule); } catch(e) { 
            console.warn("Write failed (Offline)", e); 
            SEED_RULES = [...SEED_RULES, rule]; 
            saveToStorage();
        }
    },

    // Bank Transactions
    getBankTransactions: () => fetchCollection<BankTransaction>(COLLECTIONS.BANK_TXNS),
    getBankTransactionsByClient: (clientId: string) => fetchByClient<BankTransaction>(COLLECTIONS.BANK_TXNS, clientId),
    updateBankTransaction: async (txn: BankTransaction) => {
        if (!checkDb()) {
            SEED_BANK = SEED_BANK.map(b => b.id === txn.id ? txn : b);
            saveToStorage();
            return;
        }
        try { await updateDoc(doc(db, COLLECTIONS.BANK_TXNS, txn.id), { status: txn.status, matched_doc_id: txn.matched_doc_id }); } catch(e) { 
            console.warn("Write failed (Offline)", e); 
            SEED_BANK = SEED_BANK.map(b => b.id === txn.id ? txn : b); 
            saveToStorage();
        }
    },

    // Activity Logs (Audit Trail)
    getLogs: (limitCount: number = 20) => fetchCollection<ActivityLog>(COLLECTIONS.LOGS, limitCount),
    addLog: async (log: ActivityLog) => {
        if (!checkDb()) {
            SEED_LOGS = [log, ...SEED_LOGS]; // Prepend for LIFO
            saveToStorage();
            return;
        }
        try { await setDoc(doc(db, COLLECTIONS.LOGS, log.id), log); } catch(e) { 
            console.warn("Write failed (Offline)", e); 
            SEED_LOGS = [log, ...SEED_LOGS]; 
            saveToStorage();
        }
    }
};

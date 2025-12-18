
import React, { useState, useRef, useEffect } from 'react';
import { Upload, Loader2, AlertCircle, FileStack, ArrowRight, CheckCircle2, WifiOff, RefreshCcw, Database, LogOut, User } from 'lucide-react';
import { analyzeDocument } from './services/geminiService';
import { databaseService } from './services/database';
import { validateGLPosting, GLPostingRequest, ValidationResult } from './services/accountingValidation';
import { isFirebaseConfigured } from './services/firebase';
import { useAuth, AuthProvider } from './contexts/AuthContext';
import Login from './components/Login';
import { AnalysisState, DocumentRecord, Staff, AccountingResponse, Client, IssueTicket, VendorRule, PostedGLEntry, PublishedReport, FixedAsset, WorkflowStatus, ActivityLog } from './types';
import { Task, TaskStatus } from './types/tasks';

// Toast and Accessibility
import { ToastContainer, useToast } from './components/Toast';
import './styles/accessibility.css';
import AnalysisResult from './components/AnalysisResult';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import StaffManagement from './components/StaffManagement';
import SmartDocumentArchive from './components/SmartDocumentArchive';
import ClientDirectory from './components/ClientDirectory';
import TaxReporting from './components/TaxReporting';
import MasterCommandCenter from './components/MasterCommandCenter';
import BankReconciliation from './components/BankReconciliation';
import StaffWorkplace from './components/StaffWorkplace';
import ClientDetail from './components/ClientDetail';
import ClientPortal from './components/ClientPortal';
import PayrollManagement from './components/PayrollManagement';
import MasterData from './components/MasterData';
import CashFlowStatement from './components/CashFlowStatement';
import TaxEfiling from './components/TaxEfiling';
import AutomationDashboard from './components/AutomationDashboard';
import WorkflowDashboard from './components/WorkflowDashboard';
import SmartDashboard from './components/SmartDashboard';
import TaskBoard from './components/TaskBoard';
import StaffWorkloadDashboard from './components/StaffWorkloadDashboard';
import AIAgentsPage from './components/AIAgentsPage';
import TaskDetailModal from './components/TaskDetailModal';
import TaxCalendar from './components/TaxCalendar';
import WHTCertificateManager from './components/WHTCertificateManager';
import VATReturnManager from './components/VATReturnManager';
import ErrorBoundary from './components/ErrorBoundary';
import FloatingAIPanel from './components/FloatingAIPanel';
import AccountingWorkflowDashboard from './components/AccountingWorkflowDashboard';
import CEODashboard from './components/CEODashboard';
import TaskTimeline from './components/TaskTimeline';
import NotificationCenter, { NotificationBell } from './components/NotificationCenter';
import ECommerceSyncDashboard from './components/ECommerceSyncDashboard';
import RecurringTasksManager from './components/RecurringTasksManager';
import SalesDataImport from './components/SalesDataImport';
import SimpleAddClientModal from './components/SimpleAddClientModal';
import EditClientModal from './components/EditClientModal';
import DocumentUploadModal, { UploadContext } from './components/DocumentUploadModal';
import DataImportWizard, { ImportContext } from './components/DataImportWizard';
import { ImportDataType } from './services/DataImportService';

// AI Agents Hook
import { useAgents } from './hooks/useAgents';

// Main App Content (requires authentication)
const AppContent: React.FC = () => {
    const { user, signOut, isAuthenticated, loading: authLoading } = useAuth();

    // Toast notifications
    const { toasts, success: toastSuccess, error: toastError, warning: toastWarning, info: toastInfo, dismissToast } = useToast();

    // AI Agents
    const {
        isProcessing: agentProcessing,
        calculateTaxes,
        autoReconcile,
        autoAssignTasks,
        checkDeadlines
    } = useAgents();

    // --- STATE INITIALIZATION ---
    const [currentView, setCurrentView] = useState('dashboard');

    const [documents, setDocuments] = useState<DocumentRecord[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [vendorRules, setVendorRules] = useState<VendorRule[]>([]);

    // SYSTEMATIC: Load GL globally for Reporting
    const [glEntries, setGlEntries] = useState<PostedGLEntry[]>([]);
    const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]);

    // Task Management State
    const [tasks, setTasks] = useState<Task[]>([]);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);

    const [loadingApp, setLoadingApp] = useState(true);
    const [isOfflineMode, setIsOfflineMode] = useState(false);
    const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    // Specific View States
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
    const [showAddClientModal, setShowAddClientModal] = useState(false);
    const [showEditClientModal, setShowEditClientModal] = useState(false);
    const [reviewDocId, setReviewDocId] = useState<string | null>(null);

    // Upload Queue State
    const [uploadQueue, setUploadQueue] = useState<File[]>([]);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [pendingUploadFiles, setPendingUploadFiles] = useState<File[]>([]);
    const [uploadContext, setUploadContext] = useState<UploadContext | null>(null);
    const [showDataImportWizard, setShowDataImportWizard] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Get current user info from auth context
    const CURRENT_USER_ID = user?.staffId || 'unknown';
    const CURRENT_USER_NAME = user?.displayName || 'Unknown User';

    // --- HELPER: SYSTEM LOGGING ---
    const logAction = async (action: ActivityLog['action'], details: string, status: 'success' | 'error' = 'success') => {
        const newLog: ActivityLog = {
            id: `LOG-${Date.now()}-${Math.random()}`,
            timestamp: new Date().toISOString(),
            user_id: CURRENT_USER_ID,
            user_name: CURRENT_USER_NAME,
            action,
            details,
            status
        };
        // Fire and forget log
        databaseService.addLog(newLog).catch(err => console.error("Logging failed", err));
    };

    // --- INITIAL DATA LOAD ---
    const initSystem = async () => {
        setLoadingApp(true);

        // Determine mode
        if (!isFirebaseConfigured) {
            console.log("App running in Offline/Demo Mode (Missing Config)");
            setIsOfflineMode(true);
        }

        try {
            // Initialize Database (Seed if needed or Load from LocalStorage)
            await databaseService.seed();

            // Parallel Fetch for Speed
            const [docs, stf, cli, rules, gl] = await Promise.all([
                databaseService.getDocuments(50),
                databaseService.getStaff(),
                databaseService.getClients(),
                databaseService.getRules(),
                databaseService.getGLEntries(500) // Fetch GL for global reports
            ]);

            setDocuments(docs);
            setStaff(stf);
            setClients(cli);
            setVendorRules(rules);
            setGlEntries(gl);

        } catch (err: any) {
            console.error("Failed to load data, system will attempt to continue:", err);
            showNotification("System running with limited connectivity", 'error');
        } finally {
            setLoadingApp(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            initSystem();
            logAction('LOGIN', `User ${CURRENT_USER_NAME} logged in`);
        }
    }, [isAuthenticated]);

    // --- ACTIONS ---

    // Legacy showNotification - now uses Toast
    const showNotification = (msg: string, type: 'success' | 'error' | 'warning' = 'success') => {
        if (type === 'success') {
            toastSuccess('สำเร็จ', msg);
        } else if (type === 'warning') {
            toastWarning('แจ้งเตือน', msg);
        } else {
            toastError('เกิดข้อผิดพลาด', msg);
        }
    };

    const handleSignOut = async () => {
        try {
            await logAction('LOGIN', `User ${CURRENT_USER_NAME} logged out`);
            await signOut();
            setCurrentView('dashboard');
        } catch (error) {
            console.error('Sign out error:', error);
            showNotification('เกิดข้อผิดพลาดในการออกจากระบบ', 'error');
        }
    };

    const resolveRelatedIssues = async (docId: string) => {
        let issuesResolvedCount = 0;
        const updatedClients = clients.map((client: Client) => {
            const relatedIssues = client.current_workflow?.issues?.filter((i: IssueTicket) => i.related_doc_id === docId) || [];
            if (relatedIssues.length > 0) {
                issuesResolvedCount += relatedIssues.length;
                const newClient: Client = {
                    ...client,
                    current_workflow: {
                        month: client.current_workflow?.month || new Date().toISOString().slice(0, 7),
                        vat_status: client.current_workflow?.vat_status || 'Not Started',
                        wht_status: client.current_workflow?.wht_status || 'Not Started',
                        closing_status: client.current_workflow?.closing_status || 'Not Started',
                        is_locked: client.current_workflow?.is_locked || false,
                        doc_count: client.current_workflow?.doc_count || 0,
                        pending_count: client.current_workflow?.pending_count || 0,
                        issues: client.current_workflow?.issues?.filter((i: IssueTicket) => i.related_doc_id !== docId) || []
                    }
                };
                // Async update in background
                databaseService.updateClient(newClient);
                return newClient;
            }
            return client;
        });

        if (issuesResolvedCount > 0) {
            setClients(updatedClients);
            console.log(`Auto-resolved ${issuesResolvedCount} issues related to ${docId}`);
        }
    };

    // SYSTEMATIC POSTING ENGINE with Validation
    const handlePostJournalEntry = async (entries: PostedGLEntry[]) => {
        const clientId = selectedClientId || 'C001'; // Fallback
        const userId = user?.uid || 'system';

        // CRITICAL: Validate GL entries before posting
        // Derive period from first entry date (format: "2024-02")
        const firstEntryDate = entries[0]?.date || new Date().toISOString().slice(0, 10);
        const periodMonth = firstEntryDate.slice(0, 7); // "YYYY-MM"

        const validationRequest: GLPostingRequest = {
            clientId,
            entries: entries.map(e => ({
                ...e,
                clientId
            })),
            userId,
            periodMonth,
            sourceDocId: entries[0]?.doc_no
        };

        const validation = await validateGLPosting(validationRequest);

        // Show warnings even if valid
        if (validation.warnings.length > 0) {
            validation.warnings.forEach(w => {
                showNotification(`⚠️ ${w.message}`, 'error');
            });
        }

        // Block posting if validation fails
        if (!validation.isValid) {
            const errorMessages = validation.errors.map(e => e.message).join(', ');
            showNotification(`❌ ไม่สามารถลงบัญชีได้: ${errorMessages}`, 'error');
            await logAction('POST_GL', `GL posting blocked: ${errorMessages}`, 'error');
            return;
        }

        // Save GL to Local State (Critical for immediate UI update)
        setGlEntries(prev => [...prev, ...entries]);

        // Persist each with Client ID
        for (const entry of entries) {
            await databaseService.addGLEntry({ ...entry, clientId });
        }

        // 2. Auto-Detect Fixed Assets
        const newAssets: FixedAsset[] = [];
        entries.forEach(entry => {
            if (entry.account_code.startsWith('12') && !entry.account_code.endsWith('01') && entry.debit > 0) {
                // Trigger auto creation of asset draft
                const newAsset: FixedAsset = {
                    id: `FA-AUTO-${Date.now()}-${Math.random()}`,
                    clientId: clientId,
                    asset_code: `${entry.account_code}-${Date.now().toString().slice(-3)}`,
                    name: entry.description,
                    category: 'Equipment', // Default
                    acquisition_date: entry.date,
                    cost: entry.debit,
                    residual_value: 1,
                    useful_life_years: 5,
                    accumulated_depreciation_bf: 0,
                    current_month_depreciation: 0
                };
                newAssets.push(newAsset);
            }
        });

        if (newAssets.length > 0) {
            setFixedAssets([...fixedAssets, ...newAssets]);
            for (const asset of newAssets) {
                await databaseService.addAsset(asset);
            }
            showNotification(`บันทึกบัญชีและสร้างทะเบียนทรัพย์สินอัตโนมัติ ${newAssets.length} รายการ`, 'success');
        } else {
            showNotification(`บันทึกรายการบัญชีสำเร็จ ${entries.length} รายการ`, 'success');
        }

        await logAction('POST_GL', `Posted ${entries.length} journal entries.`);
    };

    // Handler to update Client Workflow (Status)
    const handleUpdateClientStatus = async (status: Partial<Client['current_workflow']>) => {
        if (!selectedClientId) return;

        const updatedClients = clients.map((c: Client) => {
            if (c.id === selectedClientId && c.current_workflow) {
                const updatedClient: Client = {
                    ...c,
                    current_workflow: {
                        month: c.current_workflow.month || new Date().toISOString().slice(0, 7),
                        vat_status: status?.vat_status ?? c.current_workflow.vat_status ?? 'Not Started',
                        wht_status: status?.wht_status ?? c.current_workflow.wht_status ?? 'Not Started',
                        closing_status: status?.closing_status ?? c.current_workflow.closing_status ?? 'Not Started',
                        is_locked: status?.is_locked ?? c.current_workflow.is_locked ?? false,
                        doc_count: status?.doc_count ?? c.current_workflow.doc_count ?? 0,
                        pending_count: status?.pending_count ?? c.current_workflow.pending_count ?? 0,
                        issues: status?.issues ?? c.current_workflow.issues ?? []
                    }
                };
                databaseService.updateClient(updatedClient);
                return updatedClient;
            }
            return c;
        });
        setClients(updatedClients);
    };

    // Handler to update Client Assets
    const handleAddAsset = async (asset: FixedAsset) => {
        const assetWithClient = { ...asset, clientId: selectedClientId || 'C001' };
        const newAssets = [...fixedAssets, assetWithClient];
        setFixedAssets(newAssets);
        await databaseService.addAsset(assetWithClient);
        await logAction('ADD_ASSET', `Added fixed asset: ${asset.name}`);
    }

    // NEW: Rule Learning Engine
    const handleAddVendorRule = async (vendorName: string, accountCode: string, accountName: string) => {
        const newRule: VendorRule = {
            id: `R${Date.now()}`,
            vendorNameKeyword: vendorName,
            accountCode: accountCode,
            accountName: accountName,
            vatType: 'CLAIMABLE'
        };
        setVendorRules([...vendorRules, newRule]);
        await databaseService.addRule(newRule);
        showNotification(`AI Learned: "${vendorName}" maps to ${accountCode}`, 'success');
    };

    // NEW: Publishing Engine (Firm -> Client Portal)
    const handlePublishReport = async (clientId: string, report: PublishedReport) => {
        const updatedClients = clients.map(c => {
            if (c.id === clientId) {
                const currentReports = c.published_reports || [];
                const updatedClient = {
                    ...c,
                    published_reports: [report, ...currentReports]
                };
                databaseService.updateClient(updatedClient);
                return updatedClient;
            }
            return c;
        });
        setClients(updatedClients);
        showNotification(`เผยแพร่รายงาน "${report.title}" ไปยัง Client Portal แล้ว`, 'success');
    };

    // --- BATCH APPROVAL ENGINE with Validation ---
    const handleBatchApprove = async (docIds: string[]) => {
        const docsToApprove = documents.filter(d => docIds.includes(d.id));
        const userId = user?.uid || 'system';

        // Group GL entries by document for individual validation
        const docEntriesMap: Map<string, { entries: PostedGLEntry[], docNo: string, clientId: string }> = new Map();
        const failedDocs: string[] = [];
        const successDocs: string[] = [];

        docsToApprove.forEach(doc => {
            if (doc.status !== 'approved' && doc.ai_data) {
                const client = clients.find(c => c.name === doc.client_name);
                const targetClientId = client ? client.id : 'C001';
                const docEntries: PostedGLEntry[] = [];

                // Create GL Entries for this document
                doc.ai_data.accounting_entry.journal_lines.forEach((line, index) => {
                    docEntries.push({
                        id: `GL-${doc.id}-${index}`,
                        clientId: targetClientId,
                        date: doc.ai_data!.header_data.issue_date,
                        doc_no: doc.ai_data!.header_data.inv_number,
                        description: doc.ai_data!.accounting_entry.transaction_description,
                        account_code: line.account_code,
                        account_name: line.account_name_th,
                        department_code: line.department_code,
                        debit: line.account_side === 'DEBIT' ? line.amount : 0,
                        credit: line.account_side === 'CREDIT' ? line.amount : 0,
                        system_generated: false
                    });
                });

                docEntriesMap.set(doc.id, {
                    entries: docEntries,
                    docNo: doc.ai_data.header_data.inv_number,
                    clientId: targetClientId
                });
            }
        });

        // Validate and post each document individually
        const allPostedEntries: PostedGLEntry[] = [];

        for (const [docId, { entries, docNo, clientId }] of docEntriesMap) {
            // CRITICAL: Validate GL entries before posting
            // Derive period from first entry date
            const firstEntryDate = entries[0]?.date || new Date().toISOString().slice(0, 10);
            const periodMonth = firstEntryDate.slice(0, 7); // "YYYY-MM"

            const validationRequest: GLPostingRequest = {
                clientId,
                entries,
                userId,
                periodMonth,
                sourceDocId: docNo
            };

            const validation = await validateGLPosting(validationRequest);

            if (!validation.isValid) {
                const errorMessages = validation.errors.map(e => e.message).join(', ');
                console.warn(`Validation failed for ${docNo}: ${errorMessages}`);
                failedDocs.push(docNo);
                continue;
            }

            // Post valid entries
            for (const entry of entries) {
                await databaseService.addGLEntry(entry);
            }
            allPostedEntries.push(...entries);
            successDocs.push(docId);
        }

        if (allPostedEntries.length > 0) {
            setGlEntries(prev => [...prev, ...allPostedEntries]);

            // Update Docs Status - only successful ones
            const updatedDocs = documents.map(d => successDocs.includes(d.id) ? { ...d, status: 'approved' as const } : d);
            setDocuments(updatedDocs);

            // Persist Doc Updates
            for (const d of updatedDocs.filter(doc => successDocs.includes(doc.id))) {
                await databaseService.updateDocument(d);
            }

            // Resolve Issues
            successDocs.forEach(id => resolveRelatedIssues(id));
        }

        // Show results
        if (successDocs.length > 0) {
            showNotification(`อนุมัติและลงบัญชีสำเร็จ ${successDocs.length} เอกสาร`, 'success');
            await logAction('APPROVE', `Batch approved ${successDocs.length} documents.`);
        }

        if (failedDocs.length > 0) {
            showNotification(`❌ ไม่สามารถลงบัญชีได้ ${failedDocs.length} เอกสาร: ${failedDocs.join(', ')}`, 'error');
            await logAction('APPROVE', `Validation failed for ${failedDocs.length} documents: ${failedDocs.join(', ')}`, 'error');
        }

        if (successDocs.length === 0 && failedDocs.length === 0) {
            showNotification('ไม่มีเอกสารที่สามารถอนุมัติได้', 'error');
        }
    };

    // --- BATCH DELETE ---
    const handleBatchDelete = async (docIds: string[]) => {
        try {
            // Delete from database
            for (const docId of docIds) {
                await databaseService.deleteDocument(docId);
            }

            // Update local state
            setDocuments(prev => prev.filter(d => !docIds.includes(d.id)));

            showNotification(`ลบเอกสาร ${docIds.length} รายการสำเร็จ`, 'success');
            await logAction('UPLOAD', `Deleted ${docIds.length} documents: ${docIds.join(', ')}`);
        } catch (error) {
            console.error('Error deleting documents:', error);
            showNotification('เกิดข้อผิดพลาดในการลบเอกสาร', 'error');
        }
    };

    const handleSaveEntry = async (data: AccountingResponse, assignedStaffId: string | null) => {
        if (!reviewDocId) return;

        const doc = documents.find(d => d.id === reviewDocId);
        if (!doc) return;

        // Check if client Period is Locked
        const client = clients.find(c => c.name === doc.client_name);
        if (client && client.current_workflow?.is_locked) {
            showNotification("ไม่สามารถบันทึกได้เนื่องจากงวดบัญชีถูกปิดแล้ว (Period Locked)", 'error');
            return;
        }

        const clientId = client ? client.id : 'C001';

        // 1. Post to General Ledger (The CORE Logic)
        const newGLEntries: PostedGLEntry[] = data.accounting_entry.journal_lines.map((line, index) => ({
            id: `GL-${Date.now()}-${index}`,
            clientId: clientId,
            date: data.header_data.issue_date,
            doc_no: data.header_data.inv_number,
            description: data.accounting_entry.transaction_description,
            account_code: line.account_code,
            account_name: line.account_name_th,
            department_code: line.department_code, // Capture Dept Code
            debit: line.account_side === 'DEBIT' ? line.amount : 0,
            credit: line.account_side === 'CREDIT' ? line.amount : 0
        }));

        await handlePostJournalEntry(newGLEntries); // Persist

        // 2. Update Document Status
        const updatedDocs = documents.map(d => {
            if (d.id === reviewDocId) {
                return {
                    ...d,
                    status: 'approved' as const,
                    assigned_to: assignedStaffId,
                    amount: data.financials.grand_total,
                    ai_data: data
                };
            }
            return d;
        });
        setDocuments(updatedDocs);
        const savedDoc = updatedDocs.find(d => d.id === reviewDocId);
        if (savedDoc) await databaseService.updateDocument(savedDoc);

        // 3. Resolve Issues
        resolveRelatedIssues(reviewDocId);

        // 4. Update Staff Workload
        if (assignedStaffId) {
            const updatedStaff = staff.map(s => s.id === assignedStaffId ? { ...s, active_tasks: s.active_tasks + 1 } : s);
            setStaff(updatedStaff);
            const s = updatedStaff.find(s => s.id === assignedStaffId);
            if (s) databaseService.updateStaff(s);
        }

        await logAction('APPROVE', `Approved document ${doc.filename}`);

        setReviewDocId(null);
        if (currentView !== 'client-detail') {
            setCurrentView('documents');
        }
    };

    // --- LOCKING & CLOSING LOGIC ---
    const handleLockPeriod = async () => {
        if (!selectedClientId) return;
        handleUpdateClientStatus({
            is_locked: true,
            closing_status: 'Filed/Closed'
        });
        showNotification("ปิดงวดบัญชีเรียบร้อยแล้ว (Period Locked Successfully)");
        await logAction('CLOSE_PERIOD', `Locked period for client ID: ${selectedClientId}`);
    };

    // --- AUTOMATION ENGINE (The Brain) ---
    const applyVendorRules = (aiResult: AccountingResponse): AccountingResponse => {
        const vendorName = aiResult.parties.counterparty.name.toLowerCase();
        const rule = vendorRules.find(r => vendorName.includes(r.vendorNameKeyword.toLowerCase()));

        if (rule) {
            console.log(`[Automation Engine] Applied rule for ${rule.vendorNameKeyword}`);

            // Clone data
            const newData = JSON.parse(JSON.stringify(aiResult));

            // Update Journal Lines
            newData.accounting_entry.journal_lines = newData.accounting_entry.journal_lines.map((line: any) => {
                if (line.account_side === 'DEBIT') {
                    return {
                        ...line,
                        account_code: rule.accountCode,
                        account_name_th: rule.accountName,
                        auto_mapped: true // Add flag
                    };
                }
                return line;
            });

            // Update VAT Logic based on rule
            if (rule.vatType === 'NON_CLAIMABLE') {
                newData.tax_compliance.vat_claimable = false;
                // Add simple audit flag
                newData.audit_flags.push({
                    severity: 'low',
                    code: 'RULE_VAT_NC',
                    message: `VAT set to Non-Claimable based on vendor rule: ${rule.vendorNameKeyword}`
                });
            }

            return newData;
        }
        return aiResult;
    };

    const processQueueItem = async (file: File) => {
        const tempId = `TEMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Get client context: selected client, first available client, or placeholder
        const currentClient = selectedClientId
            ? clients.find(c => c.id === selectedClientId)
            : clients[0];

        const targetClientId = currentClient?.id || 'UNASSIGNED';

        // Optimistic Update
        const initialDoc: DocumentRecord = {
            id: tempId,
            uploaded_at: new Date().toISOString(),
            filename: file.name,
            status: 'processing',
            assigned_to: null,
            client_name: currentClient?.name || 'Processing...',
            clientId: targetClientId,
            amount: 0,
            ai_data: null,
            mime_type: file.type
        };

        setDocuments(prev => [initialDoc, ...prev]);

        try {
            // 1. Upload file to Firebase Storage (if configured)
            let fileUrl: string | undefined;
            let storagePath: string | undefined;

            try {
                const { uploadDocument } = await import('./services/documentStorage');
                const uploadResult = await uploadDocument(
                    file,
                    targetClientId,
                    'invoice', // Document type - could be detected from AI later
                    CURRENT_USER_ID
                );
                if (uploadResult.success) {
                    fileUrl = uploadResult.fileUrl;
                    storagePath = uploadResult.storagePath;
                    console.log('✅ File uploaded to storage:', storagePath);
                }
            } catch (uploadError) {
                console.warn('File upload skipped (Storage not configured):', uploadError);
            }

            // 1.5 Image Enhancement for low-quality images
            let processableFile = file;
            if (file.type.startsWith('image/')) {
                try {
                    const { needsEnhancement, enhanceImage } = await import('./services/imageEnhancement');
                    const needsWork = await needsEnhancement(file);

                    if (needsWork) {
                        console.log('🔧 Enhancing image for better OCR...');
                        const enhanced = await enhanceImage(file, {
                            autoCorrect: true,
                            sharpen: true,
                            contrast: 1.2,
                        });

                        if (enhanced.enhanced) {
                            // Create a new File from enhanced data
                            const base64Response = await fetch(enhanced.dataUrl);
                            const blob = await base64Response.blob();
                            processableFile = new File([blob], file.name, { type: enhanced.mimeType });
                            console.log(`✅ Image enhanced: ${enhanced.corrections.join(', ')}`);
                        }
                    }
                } catch (enhanceError) {
                    console.warn('Image enhancement skipped:', enhanceError);
                    // Continue with original file
                }
            }

            // 2. Analyze with Gemini via Cloud Functions (secure)
            const rawResult = await analyzeDocument(processableFile, targetClientId, currentClient?.name);

            // 3. Post-Process with Automation Engine
            const refinedResult = applyVendorRules(rawResult);

            // 4. Check for duplicates
            try {
                const { checkDuplicate } = await import('./services/documentValidation');
                const invNumber = refinedResult.header_data.inv_number;
                const vendorTaxId = refinedResult.parties.counterparty.tax_id;
                const amount = refinedResult.financials.grand_total;
                const date = refinedResult.header_data.issue_date;

                // Get existing documents for this client
                const existingDocs = documents.filter(d => d.clientId === targetClientId);
                const duplicateCheck = await checkDuplicate(existingDocs, invNumber, vendorTaxId, amount, date);

                if (duplicateCheck.isDuplicate) {
                    const matchType = duplicateCheck.matchType === 'exact' ? 'เลขที่เอกสารซ้ำ' : 'ยอดเงินและคู่ค้าใกล้เคียง';
                    showNotification(`⚠️ พบเอกสารที่อาจซ้ำ: ${matchType}`, 'warning');
                    console.warn('Potential duplicate detected:', duplicateCheck.matches);
                }
            } catch (dupError) {
                console.warn('Duplicate check failed (non-critical):', dupError);
            }

            // 5. Create finalized document with storage references and period indexing
            const uploadDate = new Date();
            const year = uploadDate.getFullYear();
            const month = String(uploadDate.getMonth() + 1).padStart(2, '0');

            const finalizedDoc: DocumentRecord = {
                id: `D${Date.now()}`,
                uploaded_at: uploadDate.toISOString(),
                filename: file.name,
                status: 'pending_review',
                assigned_to: null,
                client_name: refinedResult.parties.client_company.name || currentClient?.name || 'Unknown',
                clientId: targetClientId,
                amount: refinedResult.financials.grand_total,
                ai_data: refinedResult,
                file_url: fileUrl,
                storage_path: storagePath,
                mime_type: file.type,
                // Period indexing for efficient queries
                year,
                month,
                period: `${year}-${month}`
            };

            // 6. Persist to DB
            await databaseService.addDocument(finalizedDoc);

            // Update State (Replace Temp with Final)
            setDocuments(currentDocs => currentDocs.map(d => d.id === tempId ? finalizedDoc : d));

            await logAction('UPLOAD', `Successfully processed file: ${file.name}${storagePath ? ' (stored)' : ''}`);

        } catch (error) {
            console.error("Processing failed", error);
            setDocuments(currentDocs => currentDocs.map(d => d.id === tempId ? { ...d, status: 'rejected' as const, client_name: 'Error' } : d));
            showNotification(`ประมวลผลไฟล์ ${file.name} ไม่สำเร็จ`, 'error');
        }
        setUploadQueue(prev => prev.filter(f => f !== file));
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files) return;
        const files: File[] = Array.from(event.target.files);
        if (files.length === 0) return;

        // Import validation service dynamically to avoid circular deps
        const { validateFile, classifyByFilename } = await import('./services/documentValidation');

        const validFiles: File[] = [];

        for (const file of files) {
            // Pre-upload validation
            const validation = validateFile(file);

            if (!validation.valid) {
                // Show error notification
                showNotification(
                    `❌ ${file.name}: ${validation.errors.map(e => e.messageTh).join(', ')}`,
                    'error'
                );
                continue;
            }

            // Show warnings if any
            if (validation.warnings.length > 0) {
                showNotification(
                    `⚠️ ${file.name}: ${validation.warnings.map(w => w.messageTh).join(', ')}`,
                    'warning'
                );
            }

            // Auto-classify by filename
            const classification = classifyByFilename(file.name);
            if (classification.confidence > 0.7) {
                console.log(`📁 Auto-classified "${file.name}" as ${classification.docType} (${Math.round(classification.confidence * 100)}%)`);
            }

            validFiles.push(file);
        }

        if (validFiles.length > 0) {
            // *** NEW: Show upload modal for client/period selection first ***
            setPendingUploadFiles(validFiles);
            setShowUploadModal(true);
        }

        // Reset input to allow re-selecting same file
        event.target.value = '';
    };

    // NEW: Handle upload confirm from modal
    const handleUploadConfirm = (context: UploadContext) => {
        setUploadContext(context);
        setShowUploadModal(false);

        // Now process the files with the selected context
        if (pendingUploadFiles.length > 0) {
            setUploadQueue(prev => [...prev, ...pendingUploadFiles]);
            pendingUploadFiles.forEach(file => processQueueItemWithContext(file, context));
            setPendingUploadFiles([]);
        }
    };

    // NEW: Process queue item with upload context
    const processQueueItemWithContext = async (file: File, context: UploadContext) => {
        const tempId = `TEMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Optimistic Update with selected client
        const initialDoc: DocumentRecord = {
            id: tempId,
            uploaded_at: new Date().toISOString(),
            filename: file.name,
            status: 'processing',
            assigned_to: null,
            client_name: context.clientName,
            clientId: context.clientId,
            amount: 0,
            ai_data: null,
            mime_type: file.type,
            // Use context period (may be overridden by AI if autoDetectPeriod is true)
            year: context.autoDetectPeriod ? undefined : context.year,
            month: context.autoDetectPeriod ? undefined : String(context.month).padStart(2, '0'),
            period: context.autoDetectPeriod ? undefined : context.period
        };

        setDocuments(prev => [initialDoc, ...prev]);

        try {
            // 1. Upload file to Firebase Storage (if configured)
            let fileUrl: string | undefined;
            let storagePath: string | undefined;

            try {
                const { uploadDocument } = await import('./services/documentStorage');
                const uploadResult = await uploadDocument(
                    file,
                    context.clientId,
                    'invoice',
                    CURRENT_USER_ID
                );
                if (uploadResult.success) {
                    fileUrl = uploadResult.fileUrl;
                    storagePath = uploadResult.storagePath;
                    console.log('✅ File uploaded to storage:', storagePath);
                }
            } catch (uploadError) {
                console.warn('File upload skipped (Storage not configured):', uploadError);
            }

            // 1.5 Image Enhancement for low-quality images
            let processableFile = file;
            if (file.type.startsWith('image/')) {
                try {
                    const { needsEnhancement, enhanceImage } = await import('./services/imageEnhancement');
                    const needsWork = await needsEnhancement(file);

                    if (needsWork) {
                        console.log('🔧 Enhancing image for better OCR...');
                        const enhanced = await enhanceImage(file, {
                            autoCorrect: true,
                            sharpen: true,
                            contrast: 1.2,
                        });

                        if (enhanced.enhanced) {
                            const base64Response = await fetch(enhanced.dataUrl);
                            const blob = await base64Response.blob();
                            processableFile = new File([blob], file.name, { type: enhanced.mimeType });
                            console.log(`✅ Image enhanced: ${enhanced.corrections.join(', ')}`);
                        }
                    }
                } catch (enhanceError) {
                    console.warn('Image enhancement skipped:', enhanceError);
                }
            }

            // 2. Analyze with Gemini via Cloud Functions (secure)
            const rawResult = await analyzeDocument(processableFile, context.clientId, context.clientName);

            // 3. Post-Process with Automation Engine
            const refinedResult = applyVendorRules(rawResult);

            // 4. Determine final period (auto-detect or manual)
            let finalYear: number;
            let finalMonth: string;
            let finalPeriod: string;

            if (context.autoDetectPeriod && refinedResult.header_data.issue_date) {
                // Auto-detect from AI-extracted date
                const aiDate = new Date(refinedResult.header_data.issue_date);
                if (!isNaN(aiDate.getTime())) {
                    finalYear = aiDate.getFullYear();
                    finalMonth = String(aiDate.getMonth() + 1).padStart(2, '0');
                    finalPeriod = `${finalYear}-${finalMonth}`;
                    console.log(`🤖 Auto-detected period from AI: ${finalPeriod}`);
                } else {
                    // Fallback to manual selection
                    finalYear = context.year;
                    finalMonth = String(context.month).padStart(2, '0');
                    finalPeriod = context.period;
                }
            } else {
                // Use manual selection
                finalYear = context.year;
                finalMonth = String(context.month).padStart(2, '0');
                finalPeriod = context.period;
            }

            // 5. Check for duplicates
            try {
                const { checkDuplicate } = await import('./services/documentValidation');
                const invNumber = refinedResult.header_data.inv_number;
                const vendorTaxId = refinedResult.parties.counterparty.tax_id;
                const amount = refinedResult.financials.grand_total;
                const date = refinedResult.header_data.issue_date;

                const existingDocs = documents.filter(d => d.clientId === context.clientId);
                const duplicateCheck = await checkDuplicate(existingDocs, invNumber, vendorTaxId, amount, date);

                if (duplicateCheck.isDuplicate) {
                    const matchType = duplicateCheck.matchType === 'exact' ? 'เลขที่เอกสารซ้ำ' : 'ยอดเงินและคู่ค้าใกล้เคียง';
                    showNotification(`⚠️ พบเอกสารที่อาจซ้ำ: ${matchType}`, 'warning');
                    console.warn('Potential duplicate detected:', duplicateCheck.matches);
                }
            } catch (dupError) {
                console.warn('Duplicate check failed (non-critical):', dupError);
            }

            // 6. Create finalized document with storage references and period indexing
            const finalizedDoc: DocumentRecord = {
                id: `D${Date.now()}`,
                uploaded_at: new Date().toISOString(),
                filename: file.name,
                status: refinedResult.status === 'auto_approved' ? 'approved' : 'pending_review',
                assigned_to: null,
                client_name: context.clientName,
                clientId: context.clientId,
                amount: refinedResult.financials.grand_total,
                ai_data: refinedResult,
                file_url: fileUrl,
                storage_path: storagePath,
                mime_type: file.type,
                // ** Use determined period **
                year: finalYear,
                month: finalMonth,
                period: finalPeriod
            };

            // Replace temp doc with finalized
            setDocuments(prev => prev.map(d => d.id === tempId ? finalizedDoc : d));

            // Persist to database
            await databaseService.updateDocument(finalizedDoc);

            // Log action
            await logAction('UPLOAD', `Uploaded ${file.name} to ${context.clientName} (period: ${finalPeriod})`);
            showNotification(`✅ อัปโหลด "${file.name}" สำเร็จ → งวด ${finalPeriod}`);

            // Auto-create fixed assets if detected
            if (refinedResult.accounting_entry.journal_lines.some(l => l.account_code.startsWith('12'))) {
                const newAssets: FixedAsset[] = [];
                refinedResult.accounting_entry.journal_lines.forEach(line => {
                    if (line.account_code.startsWith('12')) {
                        const newAsset: FixedAsset = {
                            id: `FA-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            clientId: context.clientId,
                            asset_code: `${line.account_code}-${String(fixedAssets.length + 1).padStart(3, '0')}`,
                            name: line.account_name_th,
                            category: line.account_code.startsWith('124') ? 'Equipment' : 'Building',
                            acquisition_date: refinedResult.header_data.issue_date,
                            cost: line.amount,
                            residual_value: 1,
                            useful_life_years: 5,
                            accumulated_depreciation_bf: 0,
                            current_month_depreciation: (line.amount - 1) / 5 / 12
                        };
                        newAssets.push(newAsset);
                    }
                });
                if (newAssets.length > 0) {
                    setFixedAssets([...fixedAssets, ...newAssets]);
                }
            }

        } catch (error: any) {
            console.error('❌ Document Processing Error:', error);
            setDocuments(prev => prev.map(d =>
                d.id === tempId ? { ...d, status: 'rejected', ai_data: null } : d
            ));
            showNotification(`❌ ไม่สามารถประมวลผล "${file.name}": ${error.message}`, 'error');
        }

        setUploadQueue(prev => prev.filter(f => f.name !== file.name));
    };

    const handleClientPortalUpload = (files: File[], client: Client) => {
        setUploadQueue(prev => [...prev, ...files]);
        files.forEach(file => {
            // Todo: inject client context into processQueueItem to force client name
            processQueueItem(file);
        });
        showNotification(`ได้รับเอกสารจากลูกค้า ${client.name} แล้ว`);
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    // Handler for Data Import Wizard completion
    const handleDataImportComplete = async (type: ImportDataType, data: any[], context: ImportContext) => {
        try {
            switch (type) {
                case 'clients':
                    // Import clients
                    for (const clientData of data) {
                        const newClient = {
                            name: clientData.name,
                            tax_id: clientData.tax_id,
                            industry: clientData.industry || 'General',
                            status: clientData.status || 'Active',
                            contact_person: clientData.contact_person || '',
                            contact_email: clientData.contact_email,
                            contact_phone: clientData.contact_phone,
                            address: clientData.address,
                            assigned_staff_id: '',
                            last_closing_date: new Date().toISOString().split('T')[0]
                        };
                        await handleCreateClient(newClient as any);
                    }
                    showNotification(`✅ นำเข้าบริษัท ${data.length} รายการสำเร็จ`);
                    break;

                case 'staff':
                    // Import staff
                    for (const staffData of data) {
                        const newStaff: Omit<Staff, 'id'> = {
                            name: staffData.name,
                            email: staffData.email,
                            role: staffData.role || 'Junior Accountant',
                            status: staffData.status || 'active',
                            phone: staffData.phone,
                            department: staffData.department,
                            active_tasks: 0
                        };
                        await handleAddStaff(newStaff as any);
                    }
                    showNotification(`✅ นำเข้าพนักงาน ${data.length} รายการสำเร็จ`);
                    break;

                case 'opening_balance':
                case 'journal_entries':
                    // Use context from wizard (has clientId and date)
                    if (!context.clientId) {
                        showNotification('กรุณาเลือกบริษัทก่อนนำเข้ายอดยกมา', 'error');
                        return;
                    }

                    const newEntries: PostedGLEntry[] = data.map((row, idx) => ({
                        id: `GL-IMP-${Date.now()}-${idx}`,
                        clientId: context.clientId,
                        date: context.date || row.date || new Date().toISOString().split('T')[0],
                        doc_no: row.doc_no || `OB-${Date.now()}`,
                        description: type === 'opening_balance' ? 'ยอดยกมา (Opening Balance)' : row.description || '',
                        account_code: row.account_code,
                        account_name: row.account_name,
                        department_code: row.department_code,
                        debit: parseFloat(row.debit) || 0,
                        credit: parseFloat(row.credit) || 0,
                        system_generated: type === 'opening_balance'
                    }));

                    await handlePostJournalEntry(newEntries);
                    showNotification(`✅ นำเข้า${type === 'opening_balance' ? 'ยอดยกมา' : 'รายการบัญชี'} ${data.length} รายการ สำหรับ "${context.clientName}" สำเร็จ`);
                    break;

                case 'fixed_assets':
                    // Use context from wizard
                    if (!context.clientId) {
                        showNotification('กรุณาเลือกบริษัทก่อนนำเข้าทรัพย์สิน', 'error');
                        return;
                    }

                    const newAssets: FixedAsset[] = data.map((row, idx) => ({
                        id: `FA-IMP-${Date.now()}-${idx}`,
                        clientId: context.clientId,
                        asset_code: row.asset_code,
                        name: row.name,
                        category: row.category || 'Equipment',
                        acquisition_date: row.acquisition_date,
                        cost: parseFloat(row.cost) || 0,
                        residual_value: parseFloat(row.residual_value) || 1,
                        useful_life_years: parseInt(row.useful_life_years) || 5,
                        accumulated_depreciation_bf: parseFloat(row.accumulated_depreciation_bf) || 0,
                        current_month_depreciation: 0
                    }));

                    setFixedAssets(prev => [...prev, ...newAssets]);
                    for (const asset of newAssets) {
                        await databaseService.addAsset(asset);
                    }
                    showNotification(`✅ นำเข้าทรัพย์สินถาวร ${data.length} รายการ สำหรับ "${context.clientName}" สำเร็จ`);
                    break;

                case 'vendors':
                    // Use context from wizard
                    const newRules: VendorRule[] = data.map((row, idx) => ({
                        id: `VR-IMP-${Date.now()}-${idx}`,
                        clientId: context.clientId || undefined,
                        vendorNameKeyword: row.name,
                        accountCode: row.default_account || '52100',
                        accountName: 'ค่าใช้จ่าย',
                        vatType: 'CLAIMABLE' as const,
                        whtRate: parseFloat(row.wht_rate) || 0,
                        description: `${row.name} - ${row.tax_id || ''}`,
                        isActive: true,
                        createdAt: new Date().toISOString()
                    }));

                    setVendorRules(prev => [...prev, ...newRules]);
                    for (const rule of newRules) {
                        await databaseService.addRule(rule);
                    }
                    showNotification(`✅ นำเข้าคู่ค้า ${data.length} รายการสำเร็จ`);
                    break;

                case 'chart_of_accounts':
                    // Chart of accounts is stored in constants, show info
                    showNotification(`ผังบัญชี ${data.length} รายการ พร้อมใช้งาน (ระบบใช้ผังบัญชีมาตรฐาน)`, 'warning');
                    break;

                default:
                    showNotification(`นำเข้าข้อมูลประเภท ${type} สำเร็จ`);
            }

            await logAction('IMPORT', `Imported ${data.length} ${type} records for ${context.clientName || 'global'}`);
        } catch (error: any) {
            console.error('Import error:', error);
            showNotification(`เกิดข้อผิดพลาดในการนำเข้า: ${error.message}`, 'error');
        }
    };

    const handleCancelEntry = () => {
        setReviewDocId(null);
    };

    const handleOpenReview = (doc: DocumentRecord) => {
        if (doc.status === 'processing') return;
        if (!doc.ai_data) return;
        setReviewDocId(doc.id);
    };

    const handleNavigateToIssue = (issue: IssueTicket) => {
        if (issue.action_type === 'review_doc' && issue.related_doc_id) {
            const doc = documents.find(d => d.id === issue.related_doc_id);
            if (doc) {
                handleOpenReview(doc);
            } else {
                alert('Document not found for this issue.');
            }
        } else if (issue.action_type === 'bank_recon') {
            setCurrentView('reconciliation');
        } else {
            setCurrentView('workplace');
        }
    };

    const handleSelectClient = (client: Client) => {
        setSelectedClientId(client.id);
        setCurrentView('client-detail');
    };

    const createManualEntry = async () => {
        const tempId = `MANUAL-${Date.now()}`;
        const manualDoc: DocumentRecord = {
            id: tempId,
            uploaded_at: new Date().toISOString(),
            filename: `JV-${new Date().toISOString().split('T')[0]}`,
            status: 'pending_review',
            assigned_to: null,
            client_name: 'Manual Entry',
            amount: 0,
            ai_data: {
                status: 'needs_review',
                confidence_score: 100,
                audit_flags: [],
                review_reason: 'Manual Journal Voucher (สมุดรายวันทั่วไป)',
                file_metadata: { suggested_filename: 'Manual_JV', suggested_folder_path: 'Manual/JV' },
                header_data: { doc_type: 'Journal Voucher (JV)', issue_date: new Date().toISOString().split('T')[0], inv_number: 'JV-NEW', currency: 'THB' },
                parties: { client_company: { name: 'Tech Solutions Co., Ltd.', tax_id: '0105560001234' }, counterparty: { name: '-', tax_id: '' } },
                financials: { subtotal: 0, discount: 0, vat_rate: 7, vat_amount: 0, grand_total: 0, wht_amount: 0 },
                accounting_entry: {
                    transaction_description: 'รายการปรับปรุง (Adjustments)',
                    account_class: 'General Journal',
                    journal_lines: [
                        { account_code: '', account_side: 'DEBIT', account_name_th: '', amount: 0 },
                        { account_code: '', account_side: 'CREDIT', account_name_th: '', amount: 0 }
                    ]
                },
                tax_compliance: { is_full_tax_invoice: false, vat_claimable: false, wht_flag: false }
            }
        };

        setDocuments([manualDoc, ...documents]);
        await databaseService.addDocument(manualDoc);
        setReviewDocId(tempId);
    };

    const handleUpdateRules = async (newRules: VendorRule[]) => {
        setVendorRules(newRules);
    };

    const handleCreateClient = async (clientData: Omit<Client, 'id' | 'created_at' | 'updated_at'>) => {
        try {
            const newClient = {
                ...clientData,
                status: 'Active',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            } as any;

            const newId = await databaseService.addClient(newClient);
            const createdClient = { ...newClient, id: newId };

            setClients(prev => [...prev, createdClient as Client]);
            setShowAddClientModal(false);
            showNotification(`เพิ่มลูกค้า ${clientData.name} สำเร็จ`, 'success');
        } catch (error) {
            console.error('Error creating client:', error);
            showNotification('ไม่สามารถเพิ่มลูกค้าได้', 'error');
        }
    };

    // --- EDIT CLIENT ---
    const handleEditClient = async (clientData: Partial<Client>) => {
        try {
            if (!clientData.id) return;

            const updatedClient = {
                ...clientData,
                updated_at: new Date().toISOString()
            } as Client;

            await databaseService.updateClient(updatedClient);

            setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
            setShowEditClientModal(false);
            showNotification(`อัปเดตข้อมูลลูกค้า ${clientData.name} สำเร็จ`, 'success');
        } catch (error) {
            console.error('Error updating client:', error);
            showNotification('ไม่สามารถอัปเดตข้อมูลลูกค้าได้', 'error');
        }
    };

    // --- STAFF MANAGEMENT HANDLERS ---
    const handleAddStaff = async (staffData: Omit<Staff, 'id'>) => {
        try {
            const newId = await databaseService.addStaff(staffData);
            const newStaff = { ...staffData, id: newId } as Staff;
            setStaff(prev => [...prev, newStaff]);
            showNotification(`เพิ่มพนักงาน ${staffData.name} สำเร็จ`, 'success');
            await logAction('UPLOAD', `Added new staff: ${staffData.name}`);
        } catch (error) {
            console.error('Error adding staff:', error);
            showNotification('ไม่สามารถเพิ่มพนักงานได้', 'error');
        }
    };

    const handleViewStaffHistory = (staffId: string) => {
        const staffMember = staff.find(s => s.id === staffId);
        if (staffMember) {
            // Navigate to staff detail or show history modal
            setSelectedClientId(null);
            setCurrentView('ceo-dashboard');
            showNotification(`กำลังดูประวัติของ ${staffMember.name}`, 'success');
        }
    };

    const handleAssignWorkToStaff = (staffId: string) => {
        const staffMember = staff.find(s => s.id === staffId);
        if (staffMember) {
            // Navigate to task creation with pre-selected staff
            setCurrentView('ceo-dashboard');
            showNotification(`เลือก ${staffMember.name} สำหรับมอบหมายงาน - ไปที่หน้า CEO Dashboard`, 'success');
        }
    };

    // --- TASK MANAGEMENT HANDLERS ---
    const handleCreateTask = async (data: Partial<Task>) => {
        const now = new Date().toISOString();
        const newTask: Task = {
            id: `TASK-${Date.now()}`,
            title: data.title || 'New Task',
            description: data.description || '',
            status: data.status || 'todo',
            priority: data.priority || 'medium',
            category: data.category || 'general',
            assignedTo: data.assignedTo || null,
            assignedBy: CURRENT_USER_ID,
            assignedByName: CURRENT_USER_NAME,
            assignedAt: now,
            clientId: data.clientId,
            clientName: data.clientName,
            dueDate: data.dueDate || null,
            estimatedHours: data.estimatedHours || 1,
            progress: 0,
            canBeAutomated: false,
            automationAttempts: 0,
            timeSpent: 0,
            timeEntries: [],
            tags: data.tags || [],
            checklist: data.checklist || [],
            comments: [],
            activityLog: [],
            properties: [],
            createdAt: now,
            updatedAt: now,
        };
        setTasks((prev: Task[]) => [newTask, ...prev]);
        showNotification('สร้างงานใหม่สำเร็จ', 'success');
        await logAction('CREATE_TASK', `Created task: ${newTask.title}`);
    };

    const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
        setTasks((prev: Task[]) => prev.map((task: Task) =>
            task.id === taskId
                ? { ...task, ...updates, updatedAt: new Date().toISOString() }
                : task
        ));
        if (updates.status) {
            showNotification(`อัปเดตสถานะงานเป็น ${updates.status}`, 'success');
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        const task = tasks.find((t: Task) => t.id === taskId);
        setTasks((prev: Task[]) => prev.filter((t: Task) => t.id !== taskId));
        showNotification('ลบงานสำเร็จ', 'success');
        if (task) {
            await logAction('DELETE_TASK', `Deleted task: ${task.title}`);
        }
    };

    const handleTaskClick = (task: Task) => {
        setSelectedTask(task);
        // Could open a modal or navigate to task detail
    };

    const handleAssignTask = (staffId: string) => {
        // Navigate to task creation with pre-selected assignee
        showNotification(`เลือกพนักงานสำหรับมอบหมายงาน`, 'success');
    };

    const handleViewStaffTasks = (staffId: string) => {
        // Could filter tasks by staff or navigate to staff detail
        const staffMember = staff.find((s: Staff) => s.id === staffId);
        showNotification(`ดูงานของ ${staffMember?.name || 'Staff'}`, 'success');
    };

    const handleRebalanceWorkload = () => {
        showNotification('กำลังปรับสมดุลภาระงาน...', 'success');
        // Could trigger AI agent for rebalancing
    };


    // --- VIEW ROUTING ---
    const renderContent = () => {
        if (loadingApp) {
            return (
                <div className="flex h-full items-center justify-center bg-slate-50">
                    <div className="text-center">
                        <Loader2 size={48} className="animate-spin text-blue-600 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-slate-800">เชื่อมต่อระบบบัญชี (Initialize)...</h2>
                        <p className="text-slate-500">Checking Connectivity & Security Protocols</p>
                    </div>
                </div>
            )
        }

        // 1. Priority: Review Mode (Modal Overlay behavior)
        if (reviewDocId) {
            const docToReview = documents.find(d => d.id === reviewDocId);
            if (docToReview && docToReview.ai_data) {
                return (
                    <AnalysisResult
                        data={docToReview.ai_data}
                        staffList={staff}
                        // PASSING EXISTING DOCS FOR DUPLICATE CHECKS
                        existingDocuments={documents.filter(d => d.client_name === docToReview.client_name)}
                        onSave={handleSaveEntry}
                        onCancel={handleCancelEntry}
                        onAddRule={handleAddVendorRule} // Pass the learner function
                    />
                );
            }
        }

        // 2. Priority: Manual Entry Trigger
        if (currentView === 'manual-jv') {
            createManualEntry();
            return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;
        }

        // 3. Client Portal View (Simulation)
        if (currentView === 'client-portal') {
            // Mock a specific logged-in client context or default to first if available
            const demoClient = clients.length > 0 ? clients[0] : null;
            if (!demoClient) {
                return <div className="p-10 text-center text-slate-500">No active clients found for portal demo.</div>
            }
            return <ClientPortal client={demoClient} onUploadDocs={handleClientPortalUpload} />;
        }

        // 4. Main Views
        if (currentView === 'upload') {
            return (
                <div className="max-w-4xl mx-auto mt-10 animate-in fade-in duration-300">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-800">ศูนย์นำเข้าเอกสาร (Upload Center)</h2>
                            <p className="text-slate-500">รองรับการอัปโหลดทีละหลายไฟล์ (Batch Processing Queue)</p>
                        </div>
                        <button
                            onClick={() => setCurrentView('documents')}
                            className="text-blue-600 hover:underline flex items-center gap-1 text-sm font-medium"
                        >
                            ไปที่คลังเอกสาร <ArrowRight size={16} />
                        </button>
                    </div>

                    <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center hover:border-blue-500 hover:bg-blue-50/50 transition-all shadow-sm">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="image/png, image/jpeg, image/webp, application/pdf"
                            className="hidden"
                            multiple
                        />
                        <div className="flex flex-col items-center justify-center cursor-pointer" onClick={handleUploadClick}>
                            <div className="bg-blue-100 text-blue-600 p-5 rounded-full mb-4">
                                <FileStack size={40} />
                            </div>
                            <h3 className="text-xl font-semibold text-slate-800">ลากไฟล์มาวางเพื่ออัปโหลดหลายรายการ</h3>
                            <p className="text-slate-500 mt-2 max-w-sm mx-auto">รองรับใบกำกับภาษี, ใบเสร็จรับเงิน, หนังสือรับรองหัก ณ ที่จ่าย (AI จะทำการประมวลผลอัตโนมัติ)</p>
                        </div>
                    </div>

                    <div className="mt-8">
                        <h4 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                            <Loader2 className={`text-blue-500 ${uploadQueue.length > 0 ? 'animate-spin' : ''}`} size={18} />
                            คิวการประมวลผล (Processing Queue)
                        </h4>
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            {documents.filter(d => d.status === 'processing').length === 0 && uploadQueue.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 text-sm">ไม่มีไฟล์ที่กำลังประมวลผล</div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {documents.filter(d => d.status === 'processing').map(d => (
                                        <div key={d.id} className="p-4 flex justify-between items-center bg-blue-50/30">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center text-blue-600">
                                                    <Loader2 size={16} className="animate-spin" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-800">{d.filename}</p>
                                                    <p className="text-xs text-slate-500">
                                                        <span className="font-semibold text-blue-600">Gemini AI</span> analyzing & applying vendor rules...
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-xs font-bold text-blue-600">Processing</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        if (currentView === 'client-detail' && selectedClientId) {
            const client = clients.find(c => c.id === selectedClientId);
            if (client) {
                return <ClientDetail
                    client={client}
                    documents={documents}
                    staff={staff}
                    vendorRules={vendorRules}
                    // Important: Pass empty or specific GL/Assets if loaded in ClientDetail
                    // We will allow ClientDetail to fetch its own data for scalability
                    glEntries={[]} // Deprecated prop usage, ClientDetail will fetch
                    assets={[]} // Deprecated prop usage, ClientDetail will fetch

                    onUpdateRules={handleUpdateRules}
                    onBack={() => setCurrentView('command-center')}
                    onReviewDoc={handleOpenReview}
                    onEditClient={() => setShowEditClientModal(true)}

                    // SYSTEMATIC: Pass action handlers for Locking & GL Posting & Status Updates
                    onLockPeriod={handleLockPeriod}
                    onPostJournal={handlePostJournalEntry}
                    onBatchApprove={handleBatchApprove}
                    onAddAsset={handleAddAsset}
                    onUpdateStatus={handleUpdateClientStatus}
                />;
            }
        }

        switch (currentView) {
            case 'dashboard':
                return <Dashboard documents={documents} staff={staff} clients={clients} />;
            case 'command-center':
                return <MasterCommandCenter clients={clients} staff={staff} onNavigateToIssue={handleNavigateToIssue} onSelectClient={handleSelectClient} />;
            case 'workplace':
                return <StaffWorkplace currentStaffId={CURRENT_USER_ID} clients={clients} documents={documents} onReviewDoc={handleOpenReview} />;
            case 'staff':
                return <StaffManagement
                    staff={staff}
                    onAddStaff={handleAddStaff}
                    onViewHistory={handleViewStaffHistory}
                    onAssignWork={handleAssignWorkToStaff}
                />;
            case 'documents':
                return (
                    <div className="h-full flex flex-col">
                        <SmartDocumentArchive
                            documents={documents}
                            staff={staff}
                            clients={clients}
                            onReview={handleOpenReview}
                            onBatchApprove={handleBatchApprove}
                            onBatchDelete={handleBatchDelete}
                        />
                    </div>
                );
            case 'reconciliation':
                // Pass clientId if we want specific, but global recon view might be needed for staff
                return <BankReconciliation documents={documents} clients={clients} onPostAdjustment={handlePostJournalEntry} />;
            case 'clients':
                return <ClientDirectory clients={clients} onSelectClient={handleSelectClient} onAddClient={() => setShowAddClientModal(true)} />;
            case 'master-data':
                return <MasterData clients={clients} />;
            case 'payroll':
                return <PayrollManagement clients={clients} onPostJournal={handlePostJournalEntry} />;
            case 'cash-flow':
                return <CashFlowStatement clients={clients} glEntries={glEntries} />;
            case 'efiling':
                return <TaxEfiling clients={clients} documents={documents} />;
            case 'automation':
                return <AutomationDashboard
                    documents={documents}
                    clients={clients}
                    vendorRules={vendorRules}
                />;
            case 'workflow':
                return <WorkflowDashboard
                    documents={documents}
                    clients={clients}
                    staff={staff}
                    currentUserId={CURRENT_USER_ID}
                />;
            case 'smart-dashboard':
                return <SmartDashboard
                    documents={documents}
                    clients={clients}
                    staff={staff}
                    glEntries={glEntries}
                    onNavigateToClient={(clientId) => {
                        setSelectedClientId(clientId);
                        setCurrentView('client-detail');
                    }}
                    onNavigateToDocument={(docId) => {
                        const doc = documents.find(d => d.id === docId);
                        if (doc) handleOpenReview(doc);
                    }}
                />;
            case 'task-board':
                return <TaskBoard
                    tasks={tasks}
                    staff={staff}
                    onCreateTask={handleCreateTask}
                    onUpdateTask={handleUpdateTask}
                    onDeleteTask={handleDeleteTask}
                    onTaskClick={handleTaskClick}
                    currentUserId={CURRENT_USER_ID}
                />;
            case 'workload':
                return <StaffWorkloadDashboard
                    staff={staff}
                    tasks={tasks}
                    onAssignTask={handleAssignTask}
                    onViewStaffTasks={handleViewStaffTasks}
                    onRebalanceWorkload={handleRebalanceWorkload}
                />;
            case 'ai-agents':
                return <AIAgentsPage />;
            case 'ceo-dashboard':
                return <CEODashboard
                    staff={staff}
                    clients={clients}
                    tasks={tasks}
                    currentUserId={CURRENT_USER_ID}
                    onAssignClient={(clientId, staffId) => {
                        // Update client assignment
                        showNotification(`มอบหมายลูกค้าให้ ${staff.find(s => s.id === staffId)?.first_name || 'พนักงาน'} แล้ว`, 'success');
                    }}
                    onCreateTask={handleCreateTask}
                    onUpdateTask={handleUpdateTask}
                    onViewStaffDetail={(staffId) => {
                        setCurrentView('workload');
                    }}
                    onViewClientDetail={(clientId) => {
                        setSelectedClientId(clientId);
                        setCurrentView('client-detail');
                    }}
                    onViewTaskDetail={handleTaskClick}
                />;
            case 'task-timeline':
                return <TaskTimeline
                    tasks={tasks}
                    staff={staff}
                    clients={clients}
                    onTaskClick={handleTaskClick}
                    onUpdateTask={handleUpdateTask}
                    currentUserId={CURRENT_USER_ID}
                />;
            case 'accounting-workflow':
                return <AccountingWorkflowDashboard
                    clients={clients}
                    onProcessComplete={(result) => {
                        showNotification(`ประมวลผลเสร็จสิ้น: ${result.entries?.length || 0} รายการ`, 'success');
                    }}
                />;
            case 'ecommerce-sync':
                const ecomClient = selectedClientId ? clients.find(c => c.id === selectedClientId) : clients[0];
                if (!ecomClient) {
                    return <div className="p-10 text-center text-gray-500">กรุณาเลือกลูกค้าก่อน</div>;
                }
                return <ECommerceSyncDashboard
                    client={ecomClient}
                    onOrdersImported={(count) => {
                        showNotification(`นำเข้า ${count} คำสั่งซื้อแล้ว`, 'success');
                    }}
                />;
            case 'recurring-tasks':
                return <RecurringTasksManager
                    staff={staff}
                    clients={clients}
                    onRunScheduler={(result) => {
                        showNotification(`สร้าง ${result.tasksCreated} งานจาก ${result.templatesProcessed} templates`, 'success');
                    }}
                />;
            case 'sales-import':
                const salesClient = selectedClientId ? clients.find(c => c.id === selectedClientId) : clients[0];
                return <SalesDataImport
                    clientId={salesClient?.id || ''}
                    clientName={salesClient?.name || 'ไม่ได้เลือกลูกค้า'}
                    onImportComplete={(data) => {
                        showNotification(`นำเข้า ${data.transactions.length} รายการ พร้อมสร้าง ${data.glEntries.length} รายการบัญชี`, 'success');
                    }}
                    onGenerateGL={(entries) => {
                        showNotification(`บันทึกบัญชี ${entries.length} รายการสำเร็จ`, 'success');
                    }}
                />;
            case 'data-import':
                // Open DataImportWizard modal
                setShowDataImportWizard(true);
                setCurrentView('smart-dashboard'); // Redirect to dashboard while modal is open
                return null;
            case 'tax-calendar':
                return <TaxCalendar
                    clients={clients}
                    documents={documents}
                    onSelectClient={(clientId) => {
                        setSelectedClientId(clientId);
                        setCurrentView('client-detail');
                    }}
                />;
            case 'wht-certificates':
                return <WHTCertificateManager
                    clients={clients}
                    documents={documents}
                    selectedClientId={selectedClientId}
                    onShowNotification={showNotification}
                />;
            case 'vat-returns':
                return <VATReturnManager
                    clients={clients}
                    documents={documents}
                    glEntries={glEntries}
                    selectedClientId={selectedClientId}
                    onShowNotification={showNotification}
                />;
            case 'reports':
                // SYSTEMATIC: Pass GL entries to global reporting view
                return <TaxReporting
                    documents={documents}
                    clients={clients}
                    glEntries={glEntries}
                    onPostJournal={handlePostJournalEntry}
                    onPublishReport={handlePublishReport}
                />;
            default:
                return <Dashboard documents={documents} staff={staff} clients={clients} />;
        }
    };

    return (
        <div className="flex h-screen bg-slate-50 font-inter text-slate-900 overflow-hidden relative" role="application" aria-label="WE Accounting & Tax AI">
            {/* Skip Link for Accessibility */}
            <a href="#main-content" className="skip-link">
                ข้ามไปยังเนื้อหาหลัก
            </a>

            {/* Toast Notifications */}
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />

            {/* Legacy Notification (will be removed) */}
            {notification && (
                <div className={`absolute top-6 right-6 z-50 px-6 py-3 rounded-xl shadow-lg border flex items-center gap-3 animate-in slide-in-from-top-4 fade-in ${notification.type === 'success' ? 'bg-white border-emerald-100 text-emerald-700' : 'bg-white border-red-100 text-red-700'
                    }`} role="alert" aria-live="polite">
                    {notification.type === 'success' ? <CheckCircle2 size={20} className="text-emerald-500" /> : <AlertCircle size={20} className="text-red-500" />}
                    <span className="font-semibold text-sm">{notification.message}</span>
                </div>
            )}

            {/* Task Detail Modal */}
            {selectedTask && (
                <TaskDetailModal
                    task={selectedTask}
                    staff={staff}
                    onClose={() => setSelectedTask(null)}
                    onUpdate={(updates) => {
                        handleUpdateTask(selectedTask.id, updates);
                        setSelectedTask(prev => prev ? { ...prev, ...updates } : null);
                    }}
                    onDelete={() => {
                        handleDeleteTask(selectedTask.id);
                        setSelectedTask(null);
                    }}
                    currentUser={{
                        id: CURRENT_USER_ID,
                        name: CURRENT_USER_NAME
                    }}
                />
            )}

            {/* Add Client Modal */}
            {showAddClientModal && (
                <SimpleAddClientModal
                    onClose={() => setShowAddClientModal(false)}
                    onSubmit={handleCreateClient}
                />
            )}

            {/* Edit Client Modal */}
            {showEditClientModal && selectedClientId && (
                <EditClientModal
                    client={clients.find(c => c.id === selectedClientId)!}
                    onClose={() => setShowEditClientModal(false)}
                    onSubmit={handleEditClient}
                />
            )}

            {/* Conditionally render sidebar based on view */}
            {currentView !== 'client-portal' && (
                <nav role="navigation" aria-label="เมนูหลัก">
                    <Sidebar activeView={currentView} onChangeView={setCurrentView} />
                </nav>
            )}

            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {currentView !== 'client-portal' && (
                    <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-8 shrink-0 shadow-sm z-10">
                        <div className="text-sm text-slate-500 flex items-center gap-2">
                            {new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            {isOfflineMode && (
                                <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold">
                                    <WifiOff size={10} /> Demo Mode
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-4">
                            {/* User Info */}
                            <div className="text-right hidden md:block">
                                <p className="text-sm font-semibold text-slate-800">{user?.displayName || 'User'}</p>
                                <p className="text-xs text-slate-500 capitalize">{user?.role || 'accountant'}</p>
                            </div>

                            {/* User Avatar */}
                            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold border-2 border-white shadow-md">
                                {user?.displayName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || <User size={20} />}
                            </div>

                            {/* Sign Out Button */}
                            <button
                                onClick={handleSignOut}
                                className="ml-2 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="ออกจากระบบ"
                                aria-label="ออกจากระบบ"
                            >
                                <LogOut size={20} aria-hidden="true" />
                            </button>
                        </div>
                    </header>
                )}

                <main id="main-content" role="main" aria-label="เนื้อหาหลัก" className="flex-1 overflow-y-auto p-0">
                    {renderContent()}
                </main>
            </div>

            {/* Floating AI Assistant Panel */}
            {currentView !== 'client-portal' && (
                <FloatingAIPanel
                    onCalculateTaxes={() => calculateTaxes(documents, selectedClientId || undefined)}
                    onAutoReconcile={() => autoReconcile([], glEntries, documents)}
                    onAutoAssignTasks={() => autoAssignTasks(tasks, staff)}
                    onCheckDeadlines={() => checkDeadlines(tasks, clients, documents)}
                    isProcessing={agentProcessing}
                    onSuccess={toastSuccess}
                    onError={toastError}
                />
            )}

            {/* Document Upload Modal - Client/Period Selection */}
            <DocumentUploadModal
                isOpen={showUploadModal}
                onClose={() => {
                    setShowUploadModal(false);
                    setPendingUploadFiles([]);
                }}
                onConfirm={handleUploadConfirm}
                clients={clients}
                selectedClientId={selectedClientId || undefined}
            />

            {/* Data Import Wizard - All data types */}
            <DataImportWizard
                isOpen={showDataImportWizard}
                onClose={() => setShowDataImportWizard(false)}
                onImportComplete={handleDataImportComplete}
                clients={clients}
                selectedClientId={selectedClientId || undefined}
            />
        </div>
    );
};

// Main App with Auth Provider wrapper
const App: React.FC = () => {
    return (
        <ErrorBoundary>
            <AuthProvider>
                <AuthenticatedApp />
            </AuthProvider>
        </ErrorBoundary>
    );
};

// Authenticated App component that checks auth state
const AuthenticatedApp: React.FC = () => {
    const { isAuthenticated, loading } = useAuth();
    const [loginUser, setLoginUser] = useState<any>(null);

    // Handle login success from Login component
    const handleLoginSuccess = (user: any) => {
        setLoginUser(user);
    };

    // Show loading spinner while checking auth
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 size={48} className="animate-spin text-blue-600 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-slate-800">กำลังตรวจสอบสถานะการเข้าสู่ระบบ...</h2>
                </div>
            </div>
        );
    }

    // Show login page if not authenticated
    if (!isAuthenticated) {
        return <Login onLoginSuccess={handleLoginSuccess} />;
    }

    // Show main app if authenticated
    return <AppContent />;
};

export default App;

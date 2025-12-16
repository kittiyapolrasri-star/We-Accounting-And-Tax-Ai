
import React, { useState, useMemo, useEffect } from 'react';
import { Client, DocumentRecord, Staff, PostedGLEntry, VendorRule, FixedAsset, WorkflowStatus } from '../types';
import { ArrowLeft, Building2, MapPin, Phone, Mail, FileText, CheckCircle2, AlertTriangle, PieChart, CalendarDays, Upload, Clock, BookOpen, Settings, BarChart4, X, Scale, ShieldCheck, FolderOpen, Save, Trash, Plus, Loader2 } from 'lucide-react';
import DocumentList from './DocumentList';
import TrialBalance from './TrialBalance';
import ProfitAndLoss from './ProfitAndLoss';
import BalanceSheet from './BalanceSheet';
import FixedAssetRegister from './FixedAssetRegister';
import FinancialRatios from './FinancialRatios';
import ChartOfAccounts from './ChartOfAccounts';
import AuditClosing from './AuditClosing';
import FinancialNotes from './FinancialNotes';
import { databaseService } from '../services/database';

interface Props {
    client: Client;
    documents: DocumentRecord[];
    staff: Staff[];
    vendorRules: VendorRule[];
    glEntries: PostedGLEntry[]; // Kept for type compatibility but ignored in favor of internal fetch
    assets: FixedAsset[]; // Kept for type compatibility but ignored

    onUpdateRules: (rules: VendorRule[]) => void;
    onBack: () => void;
    onReviewDoc: (doc: DocumentRecord) => void;

    // Systematic Actions
    onLockPeriod: () => void;
    onPostJournal: (entries: PostedGLEntry[]) => void;
    onBatchApprove?: (docIds: string[]) => void;
    onAddAsset: (asset: FixedAsset) => void;
    onUpdateStatus: (status: Partial<Client['current_workflow']>) => void;
}

const ClientDetail: React.FC<Props> = ({ client, documents, staff, vendorRules, onUpdateRules, onBack, onReviewDoc, onLockPeriod, onPostJournal, onBatchApprove, onAddAsset, onUpdateStatus }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'financials' | 'pl' | 'bs' | 'assets' | 'gl' | 'audit' | 'coa' | 'notes' | 'settings'>('overview');
    const [glFilter, setGlFilter] = useState<string | null>(null);

    // --- SCALABILITY: Local State for Heavy Data ---
    const [localGLEntries, setLocalGLEntries] = useState<PostedGLEntry[]>([]);
    const [localAssets, setLocalAssets] = useState<FixedAsset[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    // Fetch Client Specific Data on Mount
    useEffect(() => {
        const fetchData = async () => {
            setLoadingData(true);
            try {
                const [entries, assets] = await Promise.all([
                    databaseService.getGLEntriesByClient(client.id),
                    databaseService.getAssetsByClient(client.id)
                ]);
                setLocalGLEntries(entries);
                setLocalAssets(assets);
            } catch (e) {
                console.error("Failed to load client data", e);
            } finally {
                setLoadingData(false);
            }
        };
        fetchData();
    }, [client.id]);

    // Local state for new rule input
    const [newVendor, setNewVendor] = useState('');
    const [newCode, setNewCode] = useState('');

    // Filter docs for this client (Optimized: Parent passed only global docs, usually we'd fetch docs here too if list is huge)
    const clientDocs = documents.filter(d => d.client_name === client.name);
    const pendingDocs = clientDocs.filter(d => d.status === 'pending_review' || d.status === 'processing');

    const getAssignedStaffName = () => {
        const s = staff.find(st => st.id === client.assigned_staff_id);
        return s ? s.name : 'Unassigned';
    };

    const handleDrillDown = (code: string) => {
        setGlFilter(code);
        setActiveTab('gl');
    };

    // SYSTEMATIC GL ENGINE: Running Balance Calculation
    const processedGL = useMemo(() => {
        let filtered = [...localGLEntries];
        if (glFilter) {
            filtered = filtered.filter(e => e.account_code === glFilter);
        }
        // Sort by Date
        filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Calculate Running Balance
        let runningBalance = 0;
        return filtered.map(e => {
            // Asset/Expense: Dr + / Cr -
            // Liab/Equity/Rev: Cr + / Dr -
            const isDrNormal = e.account_code.startsWith('1') || e.account_code.startsWith('5');
            const change = isDrNormal ? (e.debit - e.credit) : (e.credit - e.debit);
            runningBalance += change;
            return { ...e, balance: runningBalance };
        });
    }, [glFilter, localGLEntries]);

    const handleAddRule = () => {
        if (newVendor && newCode) {
            const newRule: VendorRule = {
                id: `R${Date.now()}`,
                vendorNameKeyword: newVendor,
                accountCode: newCode,
                accountName: 'Custom User Mapped',
                vatType: 'CLAIMABLE' // Default
            };
            onUpdateRules([...vendorRules, newRule]);
            setNewVendor('');
            setNewCode('');
        }
    };

    const handleRemoveRule = (id: string) => {
        onUpdateRules(vendorRules.filter(r => r.id !== id));
    }

    // Wrapper for GL Posting to update local state immediately
    const handleLocalPost = (entries: PostedGLEntry[]) => {
        setLocalGLEntries(prev => [...prev, ...entries]);
        onPostJournal(entries); // Propagate up for persistence
    };

    // Wrapper for Asset Add to update local state
    const handleLocalAddAsset = (asset: FixedAsset) => {
        setLocalAssets(prev => [...prev, asset]);
        onAddAsset(asset);
    };

    // Helper for tab names in Thai
    const tabNames = {
        'overview': 'ภาพรวม',
        'documents': 'เอกสาร',
        'financials': 'งบทดลอง',
        'pl': 'งบกำไรขาดทุน',
        'bs': 'งบดุล',
        'assets': 'สินทรัพย์',
        'audit': 'ปิดงบ & ตรวจสอบ',
        'notes': 'หมายเหตุฯ',
        'coa': 'ผังบัญชี',
        'settings': 'ตั้งค่า'
    };

    if (loadingData) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
        );
    }

    return (
        <div className="animate-in slide-in-from-right duration-300 h-full flex flex-col">
            {/* Header */}
            <div className="bg-white border-b border-slate-100 px-8 py-6 flex items-start justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-50 rounded-full text-slate-400 hover:text-slate-700 transition-colors">
                        <ArrowLeft size={24} />
                    </button>
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-md shadow-blue-200">
                        {client.name.charAt(0)}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">{client.name}</h1>
                        <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-mono text-xs">{client.tax_id}</span>
                            <span className="flex items-center gap-1"><MapPin size={14} /> {client.industry}</span>
                            <span className={`flex items-center gap-1 font-medium bg-slate-50 px-2 py-0.5 rounded-full ${client.current_workflow.is_locked ? 'text-red-600' : 'text-emerald-600'}`}>
                                <CheckCircle2 size={12} /> {client.current_workflow.is_locked ? 'Period Locked' : 'Open Period'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className="text-right">
                        <p className="text-xs text-slate-400">ผู้ดูแลบัญชี (Account Manager)</p>
                        <p className="font-semibold text-slate-700">{getAssignedStaffName()}</p>
                    </div>
                    <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 flex items-center gap-2 shadow-sm">
                        <Upload size={16} /> อัปโหลดเอกสาร
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white border-b border-slate-100 px-8 flex gap-8 overflow-x-auto">
                {(Object.keys(tabNames) as Array<keyof typeof tabNames>).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`py-4 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        {tabNames[tab]}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left Col */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Issues Alert */}
                            {client.current_workflow.issues.length > 0 && (
                                <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-4">
                                    <AlertTriangle className="text-red-500 shrink-0 mt-1" />
                                    <div>
                                        <h3 className="font-bold text-red-700">พบปัญหาที่ต้องแก้ไข {client.current_workflow.issues.length} รายการ</h3>
                                        <div className="mt-2 space-y-2">
                                            {client.current_workflow.issues.map(issue => (
                                                <div key={issue.id} className="bg-white p-3 rounded-lg border border-red-100 shadow-sm text-sm flex justify-between items-center">
                                                    <span>{issue.title}</span>
                                                    <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded font-bold">{issue.severity}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Monthly Progress */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                    <CalendarDays size={20} className="text-blue-500" /> ความคืบหน้าประจำเดือน (กุมภาพันธ์ 2567)
                                </h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
                                        <p className="text-xs text-slate-400 font-bold uppercase mb-2">VAT (ภ.พ.30)</p>
                                        <div className={`text-sm font-bold px-3 py-1.5 rounded-lg inline-block ${client.current_workflow.vat_status === 'Filed/Closed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                            }`}>
                                            {client.current_workflow.vat_status}
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
                                        <p className="text-xs text-slate-400 font-bold uppercase mb-2">WHT (50 ทวิ)</p>
                                        <div className={`text-sm font-bold px-3 py-1.5 rounded-lg inline-block ${client.current_workflow.wht_status === 'Filed/Closed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                                            }`}>
                                            {client.current_workflow.wht_status}
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
                                        <p className="text-xs text-slate-400 font-bold uppercase mb-2">Closing</p>
                                        <div className={`text-sm font-bold px-3 py-1.5 rounded-lg inline-block ${client.current_workflow.closing_status === 'Filed/Closed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                                            }`}>
                                            {client.current_workflow.closing_status}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Recent Pending Docs */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-slate-800">เอกสารรอตรวจสอบ ({pendingDocs.length})</h3>
                                </div>
                                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                                    {pendingDocs.length === 0 ? (
                                        <div className="p-8 text-center text-slate-400">ไม่พบเอกสารค้างตรวจสอบ</div>
                                    ) : (
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 text-slate-500">
                                                <tr>
                                                    <th className="px-4 py-3">วันที่</th>
                                                    <th className="px-4 py-3">เอกสาร</th>
                                                    <th className="px-4 py-3 text-right">ยอดเงิน</th>
                                                    <th className="px-4 py-3"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {pendingDocs.slice(0, 5).map(doc => (
                                                    <tr key={doc.id} className="hover:bg-blue-50/50 cursor-pointer" onClick={() => onReviewDoc(doc)}>
                                                        <td className="px-4 py-3 text-slate-600">{doc.uploaded_at.split('T')[0]}</td>
                                                        <td className="px-4 py-3 font-medium text-slate-800">{doc.filename}</td>
                                                        <td className="px-4 py-3 text-right font-mono">{doc.amount.toLocaleString()}</td>
                                                        <td className="px-4 py-3 text-right text-blue-600 font-bold text-xs">Review</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Col */}
                        <div className="space-y-6">
                            {/* AI Financial Ratios - Connected to Real GL */}
                            <FinancialRatios entries={localGLEntries} />

                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                <h3 className="font-bold text-slate-800 mb-4">ข้อมูลบริษัท</h3>
                                <div className="space-y-4 text-sm">
                                    <div>
                                        <p className="text-slate-400 text-xs">ที่อยู่จดทะเบียน</p>
                                        <p className="text-slate-700 mt-1">{client.address || "123 Main Street, Bangkok 10110"}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 text-xs">ผู้ติดต่อ</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs">
                                                {client.contact_person.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-800">{client.contact_person}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'documents' && (
                    <DocumentList
                        documents={clientDocs}
                        staff={staff}
                        onReview={onReviewDoc}
                        onBatchApprove={onBatchApprove}
                    />
                )}

                {activeTab === 'financials' && (
                    <TrialBalance entries={localGLEntries} onDrillDown={handleDrillDown} />
                )}

                {activeTab === 'pl' && (
                    <ProfitAndLoss entries={localGLEntries} onDrillDown={handleDrillDown} />
                )}

                {activeTab === 'bs' && (
                    <BalanceSheet entries={localGLEntries} />
                )}

                {activeTab === 'assets' && (
                    <FixedAssetRegister
                        assets={localAssets}
                        clientId={client.id}
                        onAddAsset={handleLocalAddAsset}
                        onPostJournal={handleLocalPost}
                    />
                )}

                {activeTab === 'audit' && (
                    <AuditClosing
                        documents={documents}
                        glEntries={localGLEntries}
                        assets={localAssets}
                        clientId={client.id}
                        onClosePeriod={onLockPeriod}
                        isLocked={client.current_workflow?.is_locked ?? false}
                        onPostJournal={handleLocalPost}
                    />
                )}

                {activeTab === 'coa' && (
                    <ChartOfAccounts />
                )}

                {activeTab === 'notes' && (
                    <FinancialNotes client={client} entries={localGLEntries} />
                )}

                {activeTab === 'gl' && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full animate-in fade-in">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <h3 className="font-bold text-slate-800">สมุดบัญชีแยกประเภท (General Ledger)</h3>
                                {glFilter && (
                                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
                                        Account: {glFilter}
                                        <button onClick={() => setGlFilter(null)} className="hover:text-blue-900"><X size={14} /></button>
                                    </span>
                                )}
                            </div>
                            <div className="text-xs text-slate-500">
                                {processedGL.length} Transactions found
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-white text-slate-500 font-semibold border-b border-slate-100 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-3 bg-slate-50">วันที่</th>
                                        <th className="px-6 py-3 bg-slate-50">เลขที่เอกสาร</th>
                                        <th className="px-6 py-3 bg-slate-50">คำอธิบาย</th>
                                        <th className="px-6 py-3 bg-slate-50">รหัสบัญชี</th>
                                        <th className="px-6 py-3 bg-slate-50">ชื่อบัญชี</th>
                                        <th className="px-6 py-3 bg-slate-50">แผนก</th>
                                        <th className="px-6 py-3 bg-slate-50 text-right">เดบิต</th>
                                        <th className="px-6 py-3 bg-slate-50 text-right">เครดิต</th>
                                        {glFilter && <th className="px-6 py-3 bg-slate-50 text-right text-blue-700 font-bold">คงเหลือ</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {processedGL.length === 0 ? (
                                        <tr><td colSpan={glFilter ? 9 : 8} className="px-6 py-12 text-center text-slate-400">
                                            {glFilter ? 'ไม่พบรายการสำหรับบัญชีนี้' : 'ยังไม่มีรายการบันทึกบัญชี'}
                                        </td></tr>
                                    ) : processedGL.map(gl => (
                                        <tr key={gl.id} className={`hover:bg-slate-50 ${gl.system_generated ? 'bg-indigo-50/20' : ''}`}>
                                            <td className="px-6 py-2.5 text-slate-600">{gl.date}</td>
                                            <td className="px-6 py-2.5 font-medium text-blue-600 cursor-pointer hover:underline">{gl.doc_no}</td>
                                            <td className="px-6 py-2.5 text-slate-700">
                                                {gl.description}
                                                {gl.system_generated && <span className="ml-2 text-[10px] text-white bg-indigo-400 px-1 rounded">AUTO</span>}
                                            </td>
                                            <td className="px-6 py-2.5 font-mono text-slate-500 text-xs bg-slate-50/50 w-fit rounded">{gl.account_code}</td>
                                            <td className="px-6 py-2.5 text-slate-600">{gl.account_name}</td>
                                            <td className="px-6 py-2.5 text-slate-500 text-xs text-center">{gl.department_code || '-'}</td>
                                            <td className="px-6 py-2.5 text-right font-mono text-slate-600">{gl.debit > 0 ? gl.debit.toLocaleString() : '-'}</td>
                                            <td className="px-6 py-2.5 text-right font-mono text-slate-600">{gl.credit > 0 ? gl.credit.toLocaleString() : '-'}</td>
                                            {glFilter && (
                                                <td className="px-6 py-2.5 text-right font-mono font-bold text-blue-700 bg-blue-50/20">
                                                    {gl.balance?.toLocaleString()}
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="bg-white p-8 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-3 mb-6">
                            <Settings size={32} className="text-slate-400" />
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg">การตั้งค่า (Settings)</h3>
                                <p className="text-slate-500 text-sm">กำหนดค่าเริ่มต้นผังบัญชีและการเรียนรู้ของ AI (Auto-Code Learning)</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Vendor Rules Section */}
                            <div className="border border-slate-100 rounded-xl p-6 bg-slate-50/50">
                                <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                    <Building2 size={18} className="text-blue-500" />
                                    ระบบจดจำคู่ค้า (Vendor Intelligence)
                                </h4>
                                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden mb-4 shadow-sm">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                                            <tr>
                                                <th className="px-4 py-3 text-left">คำค้นหาชื่อคู่ค้า (Keyword)</th>
                                                <th className="px-4 py-3 text-left">ผูกบัญชีอัตโนมัติ (Default GL)</th>
                                                <th className="px-4 py-3 w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {vendorRules.map((rule) => (
                                                <tr key={rule.id} className="hover:bg-slate-50/50">
                                                    <td className="px-4 py-3 font-medium text-slate-700">{rule.vendorNameKeyword}</td>
                                                    <td className="px-4 py-3">
                                                        <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 mr-2 border border-slate-200">{rule.accountCode}</span>
                                                        <span className="text-slate-500 text-xs">{rule.accountName}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button onClick={() => handleRemoveRule(rule.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                                                            <Trash size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="ชื่อคู่ค้า (เช่น Lotus's)"
                                        className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
                                        value={newVendor}
                                        onChange={(e) => setNewVendor(e.target.value)}
                                    />
                                    <input
                                        type="text"
                                        placeholder="รหัสบัญชี (เช่น 52700)"
                                        className="w-32 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-sm font-mono"
                                        value={newCode}
                                        onChange={(e) => setNewCode(e.target.value)}
                                    />
                                    <button
                                        onClick={handleAddRule}
                                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-1 min-w-fit"
                                    >
                                        <Plus size={16} /> เพิ่มกฎ
                                    </button>
                                </div>
                            </div>

                            {/* General Settings */}
                            <div className="border border-slate-100 rounded-xl p-6 bg-slate-50/50">
                                <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                    <FolderOpen size={18} className="text-emerald-500" />
                                    การตั้งค่าทั่วไป (General)
                                </h4>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                                        <div>
                                            <p className="font-semibold text-slate-700 text-sm">VAT Rate Default</p>
                                            <p className="text-xs text-slate-400">อัตราภาษีมูลค่าเพิ่มเริ่มต้น</p>
                                        </div>
                                        <span className="font-mono bg-slate-100 px-3 py-1 rounded text-sm font-bold">7%</span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                                        <div>
                                            <p className="font-semibold text-slate-700 text-sm">Mapping ผังบัญชี</p>
                                            <p className="text-xs text-slate-400">ใช้ผังบัญชีมาตรฐาน NPAEs</p>
                                        </div>
                                        <button className="text-blue-600 text-xs font-bold hover:underline">แก้ไข</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientDetail;

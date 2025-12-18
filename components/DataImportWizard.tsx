/**
 * DataImportWizard.tsx
 * 
 * Professional Data Import Wizard Component - ENHANCED VERSION
 * 
 * Features:
 * - Step-by-step wizard interface
 * - Client selector for client-specific imports
 * - Date/Period picker for Opening Balance & Journal Entries
 * - Template download with Excel Data Validation
 * - File upload with drag & drop
 * - Column mapping preview
 * - Real-time validation with duplicate check
 * - Export errors to Excel
 * - Detailed error messages with fix suggestions
 * - Batch import with progress
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
    X, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, AlertTriangle,
    ChevronRight, ChevronLeft, Loader2, FileText, Building2, Users, Package,
    Calculator, BookOpen, Wallet, Eye, EyeOff, Check, Calendar, Search,
    Copy, HelpCircle, FileDown, RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
    DataImportService,
    ImportDataType,
    IMPORT_TEMPLATES,
    ImportResult,
    ValidationError
} from '../services/DataImportService';
import { Client } from '../types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onImportComplete: (type: ImportDataType, data: any[], context: ImportContext) => void;
    clients: Client[];
    selectedClientId?: string;
}

export interface ImportContext {
    clientId: string;
    clientName: string;
    date?: string;
    period?: string;
}

type WizardStep = 'select_type' | 'select_client' | 'upload' | 'preview' | 'complete';

const TYPE_ICONS: Record<ImportDataType, React.ReactNode> = {
    opening_balance: <Calculator size={24} />,
    chart_of_accounts: <BookOpen size={24} />,
    clients: <Building2 size={24} />,
    fixed_assets: <Package size={24} />,
    vendors: <Wallet size={24} />,
    staff: <Users size={24} />,
    journal_entries: <FileText size={24} />
};

const TYPE_COLORS: Record<ImportDataType, string> = {
    opening_balance: 'from-emerald-500 to-teal-600',
    chart_of_accounts: 'from-blue-500 to-indigo-600',
    clients: 'from-purple-500 to-violet-600',
    fixed_assets: 'from-orange-500 to-amber-600',
    vendors: 'from-pink-500 to-rose-600',
    staff: 'from-cyan-500 to-sky-600',
    journal_entries: 'from-slate-500 to-gray-600'
};

// Types that require client selection
const CLIENT_REQUIRED_TYPES: ImportDataType[] = [
    'opening_balance', 'fixed_assets', 'vendors', 'journal_entries'
];

// Types that require date/period
const DATE_REQUIRED_TYPES: ImportDataType[] = [
    'opening_balance', 'journal_entries'
];

const DataImportWizard: React.FC<Props> = ({
    isOpen,
    onClose,
    onImportComplete,
    clients,
    selectedClientId
}) => {
    // State
    const [step, setStep] = useState<WizardStep>('select_type');
    const [selectedType, setSelectedType] = useState<ImportDataType | null>(null);
    const [wizardClientId, setWizardClientId] = useState<string>(selectedClientId || '');
    const [clientSearch, setClientSearch] = useState('');
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [file, setFile] = useState<File | null>(null);
    const [parseResult, setParseResult] = useState<ImportResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showOnlyErrors, setShowOnlyErrors] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [showHelp, setShowHelp] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Selected client object
    const selectedClient = useMemo(() =>
        clients.find(c => c.id === wizardClientId),
        [clients, wizardClientId]);

    // Filtered clients for search
    const filteredClients = useMemo(() => {
        if (!clientSearch.trim()) return clients;
        const search = clientSearch.toLowerCase();
        return clients.filter(c =>
            c.name.toLowerCase().includes(search) ||
            c.tax_id.includes(search)
        );
    }, [clients, clientSearch]);

    // Requires client selection?
    const requiresClient = selectedType && CLIENT_REQUIRED_TYPES.includes(selectedType);

    // Requires date selection?
    const requiresDate = selectedType && DATE_REQUIRED_TYPES.includes(selectedType);

    // Period from selected date
    const selectedPeriod = useMemo(() => {
        const date = new Date(selectedDate);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }, [selectedDate]);

    // Reset wizard
    const handleReset = useCallback(() => {
        setStep('select_type');
        setSelectedType(null);
        setWizardClientId(selectedClientId || '');
        setClientSearch('');
        setSelectedDate(new Date().toISOString().split('T')[0]);
        setFile(null);
        setParseResult(null);
        setError(null);
        setShowOnlyErrors(false);
        setImporting(false);
        setImportProgress(0);
        setShowHelp(false);
    }, [selectedClientId]);

    // Handle close
    const handleClose = useCallback(() => {
        handleReset();
        onClose();
    }, [handleReset, onClose]);

    // Handle type selection
    const handleTypeSelect = useCallback((type: ImportDataType) => {
        setSelectedType(type);
        // Skip client selection for clients/staff imports
        if (type === 'clients' || type === 'staff' || type === 'chart_of_accounts') {
            setStep('upload');
        } else {
            setStep('select_client');
        }
    }, []);

    // Handle file select
    const handleFileSelect = useCallback(async (selectedFile: File) => {
        if (!selectedType) return;

        setFile(selectedFile);
        setIsLoading(true);
        setError(null);

        try {
            const result = await DataImportService.parseFile(selectedFile, selectedType);
            setParseResult(result);
            setStep('preview');
        } catch (err: any) {
            setError(err.message || 'ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบรูปแบบไฟล์');
        } finally {
            setIsLoading(false);
        }
    }, [selectedType]);

    // Handle file drop
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            handleFileSelect(droppedFile);
        }
    }, [handleFileSelect]);

    // Handle file input change
    const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            handleFileSelect(selectedFile);
        }
    }, [handleFileSelect]);

    // Download template
    const handleDownloadTemplate = useCallback(() => {
        if (selectedType) {
            DataImportService.downloadTemplate(selectedType);
        }
    }, [selectedType]);

    // Export errors to Excel
    const handleExportErrors = useCallback(() => {
        if (!parseResult || !selectedType) return;

        const template = IMPORT_TEMPLATES[selectedType];
        const errorRows = parseResult.data.filter(r => !r.isValid);

        const wsData = [
            ['แถว', 'ข้อผิดพลาด', ...template.columns.map(c => c.labelTh)],
            ...errorRows.map(row => [
                row.rowNumber,
                row.errors.map(e => `${e.column}: ${e.errorTh}`).join('; '),
                ...template.columns.map(c => row.data[c.key] ?? '')
            ])
        ];

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Errors');

        XLSX.writeFile(wb, `Import_Errors_${new Date().toISOString().split('T')[0]}.xlsx`);
    }, [parseResult, selectedType]);

    // Handle import
    const handleImport = useCallback(async () => {
        if (!parseResult || !selectedType) return;

        setImporting(true);
        setImportProgress(0);

        try {
            // Get valid data only
            const validData = parseResult.data
                .filter(row => row.isValid)
                .map(row => row.data);

            // Build context
            const context: ImportContext = {
                clientId: wizardClientId,
                clientName: selectedClient?.name || '',
                date: requiresDate ? selectedDate : undefined,
                period: requiresDate ? selectedPeriod : undefined
            };

            // Simulate progress
            for (let i = 0; i <= 100; i += 10) {
                await new Promise(resolve => setTimeout(resolve, 80));
                setImportProgress(i);
            }

            // Call parent handler
            onImportComplete(selectedType, validData, context);

            setStep('complete');
        } catch (err: any) {
            setError(err.message || 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล');
        } finally {
            setImporting(false);
        }
    }, [parseResult, selectedType, wizardClientId, selectedClient, selectedDate, selectedPeriod, requiresDate, onImportComplete]);

    // Render step indicator
    const renderStepIndicator = () => {
        const allSteps = [
            { id: 'select_type', label: 'เลือกประเภท', icon: FileSpreadsheet },
            ...(requiresClient ? [{ id: 'select_client', label: 'เลือกบริษัท', icon: Building2 }] : []),
            { id: 'upload', label: 'อัปโหลด', icon: Upload },
            { id: 'preview', label: 'ตรวจสอบ', icon: Eye }
        ];

        const currentIndex = allSteps.findIndex(s => s.id === step);

        return (
            <div className="flex items-center justify-center px-6 py-4 border-b border-slate-200 bg-slate-50">
                {allSteps.map((s, idx) => (
                    <React.Fragment key={s.id}>
                        <div
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${idx <= currentIndex
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-slate-100 text-slate-400'
                                }`}
                        >
                            <s.icon size={16} />
                            <span className="hidden sm:inline">{s.label}</span>
                        </div>
                        {idx < allSteps.length - 1 && (
                            <ChevronRight size={16} className="mx-2 text-slate-300" />
                        )}
                    </React.Fragment>
                ))}
            </div>
        );
    };

    // Render type selection step
    const renderTypeSelection = () => (
        <div className="p-6">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">เลือกประเภทข้อมูลที่ต้องการนำเข้า</h3>
                    <p className="text-sm text-slate-500">
                        ระบบจะเตรียม template และ validation ให้อัตโนมัติ
                    </p>
                </div>
                <button
                    onClick={() => setShowHelp(!showHelp)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                    <HelpCircle size={20} />
                </button>
            </div>

            {/* Help Section */}
            {showHelp && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <h4 className="font-semibold text-blue-800 mb-2">📖 วิธีใช้งาน</h4>
                    <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                        <li>เลือกประเภทข้อมูลที่ต้องการนำเข้า</li>
                        <li>เลือกบริษัท (ถ้าจำเป็น)</li>
                        <li>ดาวน์โหลด Template Excel → กรอกข้อมูล</li>
                        <li>อัปโหลดไฟล์ → ตรวจสอบข้อมูล</li>
                        <li>กดนำเข้า</li>
                    </ol>
                    <p className="text-xs text-blue-600 mt-2">
                        💡 Tip: ใช้ Template ที่ระบบให้เพื่อหลีกเลี่ยงข้อผิดพลาด
                    </p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(IMPORT_TEMPLATES).map(([type, template]) => (
                    <button
                        key={type}
                        onClick={() => handleTypeSelect(type as ImportDataType)}
                        className="group p-4 border rounded-xl text-left transition-all hover:shadow-md hover:scale-[1.01] hover:border-blue-300 border-slate-200"
                    >
                        <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-xl bg-gradient-to-br ${TYPE_COLORS[type as ImportDataType]} text-white shadow-lg`}>
                                {TYPE_ICONS[type as ImportDataType]}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                                    {template.nameTh}
                                </h4>
                                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                    {template.description}
                                </p>
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded-full">
                                        {template.columns.filter(c => c.required).length} ฟิลด์บังคับ
                                    </span>
                                    {CLIENT_REQUIRED_TYPES.includes(type as ImportDataType) && (
                                        <span className="px-2 py-0.5 bg-purple-100 text-purple-600 text-[10px] rounded-full">
                                            ต้องเลือกบริษัท
                                        </span>
                                    )}
                                    {DATE_REQUIRED_TYPES.includes(type as ImportDataType) && (
                                        <span className="px-2 py-0.5 bg-amber-100 text-amber-600 text-[10px] rounded-full">
                                            ต้องระบุวันที่
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );

    // Render client selection step
    const renderClientSelection = () => (
        <div className="p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-2">เลือกบริษัทที่ต้องการนำเข้าข้อมูล</h3>
            <p className="text-sm text-slate-500 mb-6">
                ข้อมูลที่นำเข้าจะถูกบันทึกภายใต้บริษัทที่เลือก
            </p>

            {/* Search */}
            <div className="relative mb-4">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="ค้นหาชื่อบริษัทหรือเลขประจำตัวผู้เสียภาษี..."
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
            </div>

            {/* Date/Period Picker (if required) */}
            {requiresDate && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-3">
                        <Calendar size={18} className="text-amber-600" />
                        <span className="font-semibold text-amber-800">
                            {selectedType === 'opening_balance' ? 'วันที่ยอดยกมา' : 'วันที่รายการบัญชี'}
                        </span>
                    </div>
                    <div className="flex items-center gap-4">
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="px-4 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white"
                        />
                        <span className="text-sm text-amber-700">
                            งวด: <strong>{selectedPeriod}</strong>
                        </span>
                    </div>
                    {selectedType === 'opening_balance' && (
                        <p className="text-xs text-amber-600 mt-2">
                            💡 ปกติใช้วันที่ 1 ของเดือนที่เริ่มใช้ระบบ หรือวันที่ย้ายข้อมูล
                        </p>
                    )}
                </div>
            )}

            {/* Client List */}
            <div className="max-h-64 overflow-auto border border-slate-200 rounded-xl">
                {filteredClients.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        ไม่พบบริษัทที่ตรงกับการค้นหา
                    </div>
                ) : (
                    filteredClients.map(client => (
                        <button
                            key={client.id}
                            onClick={() => setWizardClientId(client.id)}
                            className={`w-full p-4 text-left border-b border-slate-100 last:border-0 transition-colors ${wizardClientId === client.id
                                    ? 'bg-blue-50 border-l-4 border-l-blue-500'
                                    : 'hover:bg-slate-50'
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-semibold text-slate-800">{client.name}</p>
                                    <p className="text-xs text-slate-500">
                                        Tax ID: {client.tax_id} • {client.industry}
                                    </p>
                                </div>
                                {wizardClientId === client.id && (
                                    <CheckCircle2 size={20} className="text-blue-600" />
                                )}
                            </div>
                        </button>
                    ))
                )}
            </div>

            {/* Selected Client Info */}
            {selectedClient && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                    <Building2 size={16} className="text-blue-600" />
                    <span className="text-sm text-blue-700">
                        เลือก: <strong>{selectedClient.name}</strong>
                    </span>
                </div>
            )}

            {/* Continue Button */}
            <div className="mt-6 flex justify-end">
                <button
                    onClick={() => setStep('upload')}
                    disabled={!wizardClientId}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-all ${wizardClientId
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                >
                    ดำเนินการต่อ
                    <ChevronRight size={18} />
                </button>
            </div>
        </div>
    );

    // Render upload step
    const renderUploadStep = () => {
        const template = selectedType ? IMPORT_TEMPLATES[selectedType] : null;

        return (
            <div className="p-6">
                {/* Template Info */}
                {template && (
                    <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg bg-gradient-to-br ${TYPE_COLORS[selectedType!]} text-white`}>
                                    {TYPE_ICONS[selectedType!]}
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800">{template.nameTh}</h4>
                                    {selectedClient && (
                                        <p className="text-xs text-purple-600">
                                            📍 บริษัท: {selectedClient.name}
                                        </p>
                                    )}
                                    {requiresDate && (
                                        <p className="text-xs text-amber-600">
                                            📅 วันที่: {selectedDate} (งวด {selectedPeriod})
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={handleDownloadTemplate}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-200 rounded-lg text-blue-600 text-sm font-medium hover:bg-blue-50 transition-colors shadow-sm"
                            >
                                <Download size={16} />
                                ดาวน์โหลด Template
                            </button>
                        </div>

                        {/* Required fields */}
                        <div className="mt-4 pt-4 border-t border-blue-100">
                            <p className="text-xs text-slate-600 font-medium mb-2">ฟิลด์ที่ต้องระบุ:</p>
                            <div className="flex flex-wrap gap-2">
                                {template.columns.filter(c => c.required).map(col => (
                                    <span
                                        key={col.key}
                                        className="px-2 py-1 bg-white border border-blue-200 text-blue-700 text-xs rounded-lg"
                                    >
                                        {col.labelTh}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Tips */}
                        <div className="mt-4 p-3 bg-white/50 rounded-lg">
                            <p className="text-xs text-slate-600">
                                💡 <strong>เคล็ดลับ:</strong> ใช้ Template ที่ดาวน์โหลดเพื่อให้การนำเข้าราบรื่น
                                Header ต้องอยู่แถวแรก และข้อมูลเริ่มจากแถวที่ 2
                            </p>
                        </div>
                    </div>
                )}

                {/* Drop Zone */}
                <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${isLoading
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 hover:shadow-lg'
                        }`}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={handleFileInputChange}
                        className="hidden"
                    />

                    {isLoading ? (
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 size={48} className="text-blue-500 animate-spin" />
                            <p className="text-slate-600">กำลังวิเคราะห์ไฟล์...</p>
                        </div>
                    ) : (
                        <>
                            <FileSpreadsheet size={48} className="mx-auto text-slate-400 mb-4" />
                            <p className="text-slate-600 font-medium mb-2">
                                ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์
                            </p>
                            <p className="text-sm text-slate-400">
                                รองรับ: Excel (.xlsx) หรือ CSV (สูงสุด 10MB)
                            </p>
                        </>
                    )}
                </div>

                {/* Error */}
                {error && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                        <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium text-red-700">เกิดข้อผิดพลาด</p>
                            <p className="text-sm text-red-600">{error}</p>
                            <p className="text-xs text-red-500 mt-2">
                                ลองตรวจสอบ: รูปแบบไฟล์, Header แถวแรก, ความถูกต้องของข้อมูล
                            </p>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // Render preview step
    const renderPreviewStep = () => {
        if (!parseResult || !selectedType) return null;

        const template = IMPORT_TEMPLATES[selectedType];
        const displayData = showOnlyErrors
            ? parseResult.data.filter(row => !row.isValid)
            : parseResult.data;

        const balanceDiff = Math.abs((parseResult.summary.totalDebit || 0) - (parseResult.summary.totalCredit || 0));
        const isDebitHigher = (parseResult.summary.totalDebit || 0) > (parseResult.summary.totalCredit || 0);

        return (
            <div className="flex flex-col h-full">
                {/* Summary Stats */}
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                        <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-lg bg-gradient-to-br ${TYPE_COLORS[selectedType]} text-white`}>
                                {TYPE_ICONS[selectedType]}
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800">{template.nameTh}</h4>
                                <p className="text-xs text-slate-500">ไฟล์: {file?.name}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {parseResult.errorRows > 0 && (
                                <button
                                    onClick={handleExportErrors}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                                >
                                    <FileDown size={14} />
                                    ดาวน์โหลดรายการผิดพลาด
                                </button>
                            )}
                            <button
                                onClick={() => setShowOnlyErrors(!showOnlyErrors)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${showOnlyErrors
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                            >
                                {showOnlyErrors ? <EyeOff size={14} /> : <Eye size={14} />}
                                {showOnlyErrors ? 'แสดงทั้งหมด' : 'แสดงเฉพาะผิดพลาด'}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-3 bg-white rounded-lg border border-slate-200">
                            <p className="text-xs text-slate-500">แถวทั้งหมด</p>
                            <p className="text-xl font-bold text-slate-800">{parseResult.totalRows}</p>
                        </div>
                        <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                            <p className="text-xs text-emerald-600">✓ ถูกต้อง</p>
                            <p className="text-xl font-bold text-emerald-700">{parseResult.validRows}</p>
                        </div>
                        <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                            <p className="text-xs text-red-600">✗ ผิดพลาด</p>
                            <p className="text-xl font-bold text-red-700">{parseResult.errorRows}</p>
                        </div>
                        {(selectedType === 'opening_balance' || selectedType === 'journal_entries') && (
                            <div className={`p-3 rounded-lg border ${parseResult.summary.isBalanced
                                    ? 'bg-emerald-50 border-emerald-200'
                                    : 'bg-red-50 border-red-200'
                                }`}>
                                <p className={`text-xs ${parseResult.summary.isBalanced ? 'text-emerald-600' : 'text-red-600'}`}>
                                    ยอดสมดุล (Dr=Cr)
                                </p>
                                <p className={`text-xl font-bold ${parseResult.summary.isBalanced ? 'text-emerald-700' : 'text-red-700'}`}>
                                    {parseResult.summary.isBalanced ? '✓ สมดุล' : '✗ ไม่สมดุล'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Balance Info with Fix Suggestion */}
                    {(selectedType === 'opening_balance' || selectedType === 'journal_entries') && (
                        <div className="mt-4 p-3 bg-white rounded-lg border border-slate-200">
                            <div className="flex items-center gap-4 text-sm">
                                <span className="text-slate-600">
                                    เดบิตรวม: <strong className="text-blue-600">฿{parseResult.summary.totalDebit?.toLocaleString()}</strong>
                                </span>
                                <span className="text-slate-400">—</span>
                                <span className="text-slate-600">
                                    เครดิตรวม: <strong className="text-pink-600">฿{parseResult.summary.totalCredit?.toLocaleString()}</strong>
                                </span>
                                {!parseResult.summary.isBalanced && (
                                    <>
                                        <span className="text-slate-400">=</span>
                                        <span className="text-red-600 font-bold">
                                            ผลต่าง ฿{balanceDiff.toLocaleString()}
                                        </span>
                                    </>
                                )}
                            </div>
                            {!parseResult.summary.isBalanced && (
                                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                                    <p className="text-xs text-amber-700">
                                        💡 <strong>วิธีแก้ไข:</strong> {isDebitHigher
                                            ? `เพิ่มรายการเครดิต ฿${balanceDiff.toLocaleString()} หรือลดรายการเดบิต`
                                            : `เพิ่มรายการเดบิต ฿${balanceDiff.toLocaleString()} หรือลดรายการเครดิต`
                                        }
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Data Table */}
                <div className="flex-1 overflow-auto p-4">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-slate-100">
                            <tr>
                                <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b">แถว</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b">สถานะ</th>
                                {template.columns.slice(0, 6).map(col => (
                                    <th key={col.key} className="px-3 py-2 text-left font-semibold text-slate-700 border-b">
                                        {col.labelTh}
                                        {col.required && <span className="text-red-500 ml-1">*</span>}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {displayData.slice(0, 100).map((row) => (
                                <tr
                                    key={row.rowNumber}
                                    className={`border-b border-slate-100 ${row.isValid
                                            ? 'hover:bg-slate-50'
                                            : 'bg-red-50 hover:bg-red-100'
                                        }`}
                                >
                                    <td className="px-3 py-2 text-slate-500">{row.rowNumber}</td>
                                    <td className="px-3 py-2">
                                        {row.isValid ? (
                                            <CheckCircle2 size={16} className="text-emerald-500" />
                                        ) : (
                                            <div className="group relative">
                                                <AlertCircle size={16} className="text-red-500 cursor-help" />
                                                <div className="absolute left-0 top-full mt-1 z-20 w-72 p-3 bg-white border border-red-200 rounded-lg shadow-xl hidden group-hover:block">
                                                    <p className="text-xs font-semibold text-red-700 mb-2">ข้อผิดพลาด:</p>
                                                    {row.errors.map((err, idx) => (
                                                        <div key={idx} className="mb-1">
                                                            <p className="text-xs text-red-600">
                                                                <strong>{err.column}:</strong> {err.errorTh}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                    {template.columns.slice(0, 6).map(col => {
                                        const value = row.data[col.key];
                                        const hasError = row.errors.some(e => e.column === col.labelTh);
                                        return (
                                            <td
                                                key={col.key}
                                                className={`px-3 py-2 ${hasError ? 'text-red-700 font-medium bg-red-100' : 'text-slate-700'}`}
                                            >
                                                {col.type === 'number'
                                                    ? Number(value || 0).toLocaleString()
                                                    : String(value || '-')
                                                }
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {displayData.length > 100 && (
                        <p className="text-center text-slate-500 text-sm mt-4">
                            แสดง 100 แถวแรก จากทั้งหมด {displayData.length} แถว
                        </p>
                    )}

                    {displayData.length === 0 && showOnlyErrors && (
                        <div className="p-8 text-center text-emerald-600">
                            <CheckCircle2 size={48} className="mx-auto mb-4" />
                            <p className="font-semibold">ไม่พบข้อผิดพลาด!</p>
                            <p className="text-sm text-slate-500">ข้อมูลทั้งหมดถูกต้อง พร้อมนำเข้า</p>
                        </div>
                    )}
                </div>

                {/* Error Summary */}
                {parseResult.errors.length > 0 && (
                    <div className="p-4 bg-red-50 border-t border-red-200">
                        <div className="flex items-center justify-between mb-2">
                            <h5 className="font-semibold text-red-700 flex items-center gap-2">
                                <AlertTriangle size={16} />
                                สรุปข้อผิดพลาด ({parseResult.errors.length} รายการ)
                            </h5>
                            <button
                                onClick={handleExportErrors}
                                className="text-xs text-red-600 hover:text-red-800 underline"
                            >
                                ดาวน์โหลดไฟล์เพื่อแก้ไข
                            </button>
                        </div>
                        <div className="max-h-24 overflow-auto space-y-1">
                            {parseResult.errors.slice(0, 5).map((err, idx) => (
                                <p key={idx} className="text-xs text-red-600">
                                    {err.row > 0 ? `แถว ${err.row}: ` : '⚠️ '}{err.errorTh}
                                </p>
                            ))}
                            {parseResult.errors.length > 5 && (
                                <p className="text-xs text-red-500 font-medium">
                                    ... และอีก {parseResult.errors.length - 5} รายการ
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // Render complete step
    const renderCompleteStep = () => (
        <div className="p-12 text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-emerald-400 to-green-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-200">
                <CheckCircle2 size={40} className="text-white" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">นำเข้าข้อมูลสำเร็จ! 🎉</h3>
            <p className="text-slate-600 mb-2">
                นำเข้าข้อมูล <strong className="text-emerald-600">{parseResult?.validRows}</strong> รายการ เรียบร้อยแล้ว
            </p>
            {selectedClient && (
                <p className="text-sm text-purple-600 mb-6">
                    บันทึกภายใต้: {selectedClient.name}
                </p>
            )}
            <div className="flex items-center justify-center gap-4">
                <button
                    onClick={handleReset}
                    className="px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
                >
                    <RefreshCw size={18} className="inline mr-2" />
                    นำเข้าเพิ่ม
                </button>
                <button
                    onClick={handleClose}
                    className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200"
                >
                    เสร็จสิ้น
                </button>
            </div>
        </div>
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <FileSpreadsheet className="text-white" size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">นำเข้าข้อมูล</h2>
                            <p className="text-sm text-indigo-100">Data Import Wizard</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <X className="text-white" size={20} />
                    </button>
                </div>

                {/* Step Indicator */}
                {step !== 'complete' && renderStepIndicator()}

                {/* Content */}
                <div className="flex-1 overflow-hidden">
                    {step === 'select_type' && renderTypeSelection()}
                    {step === 'select_client' && renderClientSelection()}
                    {step === 'upload' && renderUploadStep()}
                    {step === 'preview' && renderPreviewStep()}
                    {step === 'complete' && renderCompleteStep()}
                </div>

                {/* Footer */}
                {(step === 'upload' || step === 'preview') && (
                    <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                        <button
                            onClick={() => {
                                if (step === 'upload') {
                                    setStep(requiresClient ? 'select_client' : 'select_type');
                                } else if (step === 'preview') {
                                    setStep('upload');
                                    setFile(null);
                                    setParseResult(null);
                                }
                            }}
                            disabled={importing}
                            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-800 font-medium disabled:opacity-50 transition-colors"
                        >
                            <ChevronLeft size={18} />
                            ย้อนกลับ
                        </button>

                        {step === 'preview' && (
                            <div className="flex items-center gap-4">
                                {importing ? (
                                    <div className="flex items-center gap-3">
                                        <div className="w-48 h-2 bg-slate-200 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                                                style={{ width: `${importProgress}%` }}
                                            />
                                        </div>
                                        <span className="text-sm text-slate-600">{importProgress}%</span>
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleImport}
                                        disabled={!parseResult?.success || parseResult.validRows === 0}
                                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-all ${parseResult?.success && parseResult.validRows > 0
                                                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200'
                                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                            }`}
                                    >
                                        <Upload size={18} />
                                        นำเข้า {parseResult?.validRows || 0} รายการ
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DataImportWizard;

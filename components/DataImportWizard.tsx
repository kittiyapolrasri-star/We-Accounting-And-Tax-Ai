/**
 * DataImportWizard.tsx
 * 
 * Professional Data Import Wizard Component
 * 
 * Features:
 * - Step-by-step wizard interface
 * - Template download
 * - File upload with drag & drop
 * - Real-time validation preview
 * - Error/Warning highlighting
 * - Batch import with progress
 */

import React, { useState, useCallback, useRef } from 'react';
import {
    X, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, AlertTriangle,
    ChevronRight, ChevronLeft, Loader2, FileText, Building2, Users, Package,
    Calculator, BookOpen, Wallet, Search, Eye, EyeOff, Check
} from 'lucide-react';
import {
    DataImportService,
    ImportDataType,
    IMPORT_TEMPLATES,
    ImportResult,
    ParsedRow,
    ValidationError
} from '../services/DataImportService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onImportComplete: (type: ImportDataType, data: any[]) => void;
    clientId?: string;
    clientName?: string;
}

type WizardStep = 'select_type' | 'upload' | 'preview' | 'confirm' | 'complete';

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

const DataImportWizard: React.FC<Props> = ({
    isOpen,
    onClose,
    onImportComplete,
    clientId,
    clientName
}) => {
    // State
    const [step, setStep] = useState<WizardStep>('select_type');
    const [selectedType, setSelectedType] = useState<ImportDataType | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [parseResult, setParseResult] = useState<ImportResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showOnlyErrors, setShowOnlyErrors] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reset wizard
    const handleReset = useCallback(() => {
        setStep('select_type');
        setSelectedType(null);
        setFile(null);
        setParseResult(null);
        setError(null);
        setShowOnlyErrors(false);
        setImporting(false);
        setImportProgress(0);
    }, []);

    // Handle close
    const handleClose = useCallback(() => {
        handleReset();
        onClose();
    }, [handleReset, onClose]);

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
            setError(err.message || 'Failed to parse file');
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

            // Simulate progress (actual import would be done via callback)
            for (let i = 0; i <= 100; i += 10) {
                await new Promise(resolve => setTimeout(resolve, 100));
                setImportProgress(i);
            }

            // Call parent handler
            onImportComplete(selectedType, validData);

            setStep('complete');
        } catch (err: any) {
            setError(err.message || 'Import failed');
        } finally {
            setImporting(false);
        }
    }, [parseResult, selectedType, onImportComplete]);

    // Render step indicator
    const renderStepIndicator = () => {
        const steps = [
            { id: 'select_type', label: 'เลือกประเภท', icon: FileSpreadsheet },
            { id: 'upload', label: 'อัปโหลด', icon: Upload },
            { id: 'preview', label: 'ตรวจสอบ', icon: Eye },
            { id: 'confirm', label: 'ยืนยัน', icon: Check }
        ];

        const currentIndex = steps.findIndex(s => s.id === step);

        return (
            <div className="flex items-center justify-center px-6 py-4 border-b border-slate-200 bg-slate-50">
                {steps.map((s, idx) => (
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
                        {idx < steps.length - 1 && (
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
            <h3 className="text-lg font-bold text-slate-800 mb-2">เลือกประเภทข้อมูลที่ต้องการนำเข้า</h3>
            <p className="text-sm text-slate-500 mb-6">
                เลือกประเภทข้อมูลตามที่ต้องการ ระบบจะเตรียม template และ validation ให้อัตโนมัติ
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(IMPORT_TEMPLATES).map(([type, template]) => (
                    <button
                        key={type}
                        onClick={() => {
                            setSelectedType(type as ImportDataType);
                            setStep('upload');
                        }}
                        className={`group p-4 border rounded-xl text-left transition-all hover:shadow-md hover:scale-[1.02] ${selectedType === type
                                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                                : 'border-slate-200 hover:border-blue-300'
                            }`}
                    >
                        <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-xl bg-gradient-to-br ${TYPE_COLORS[type as ImportDataType]} text-white`}>
                                {TYPE_ICONS[type as ImportDataType]}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                                    {template.nameTh}
                                </h4>
                                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                    {template.description}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded-full">
                                        {template.columns.filter(c => c.required).length} ฟิลด์บังคับ
                                    </span>
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded-full">
                                        {template.columns.length} ฟิลด์ทั้งหมด
                                    </span>
                                </div>
                            </div>
                        </div>
                    </button>
                ))}
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
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg bg-gradient-to-br ${TYPE_COLORS[selectedType!]} text-white`}>
                                    {TYPE_ICONS[selectedType!]}
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800">{template.nameTh}</h4>
                                    <p className="text-xs text-slate-500">{template.description}</p>
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
                    </div>
                )}

                {/* Drop Zone */}
                <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${isLoading
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/50'
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
                        </div>
                    </div>
                )}

                {/* Client context */}
                {clientName && (
                    <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-center gap-2">
                        <Building2 size={16} className="text-purple-600" />
                        <span className="text-sm text-purple-700">
                            นำเข้าสำหรับ: <strong>{clientName}</strong>
                        </span>
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

        return (
            <div className="flex flex-col h-full">
                {/* Summary Stats */}
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-lg bg-gradient-to-br ${TYPE_COLORS[selectedType]} text-white`}>
                                {TYPE_ICONS[selectedType]}
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800">{template.nameTh}</h4>
                                <p className="text-xs text-slate-500">ไฟล์: {file?.name}</p>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowOnlyErrors(!showOnlyErrors)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${showOnlyErrors
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            {showOnlyErrors ? <EyeOff size={14} /> : <Eye size={14} />}
                            {showOnlyErrors ? 'แสดงทั้งหมด' : 'แสดงเฉพาะข้อผิดพลาด'}
                        </button>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                        <div className="p-3 bg-white rounded-lg border border-slate-200">
                            <p className="text-xs text-slate-500">แถวทั้งหมด</p>
                            <p className="text-xl font-bold text-slate-800">{parseResult.totalRows}</p>
                        </div>
                        <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                            <p className="text-xs text-emerald-600">ถูกต้อง</p>
                            <p className="text-xl font-bold text-emerald-700">{parseResult.validRows}</p>
                        </div>
                        <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                            <p className="text-xs text-red-600">ข้อผิดพลาด</p>
                            <p className="text-xl font-bold text-red-700">{parseResult.errorRows}</p>
                        </div>
                        {(selectedType === 'opening_balance' || selectedType === 'journal_entries') && (
                            <div className={`p-3 rounded-lg border ${parseResult.summary.isBalanced
                                    ? 'bg-emerald-50 border-emerald-200'
                                    : 'bg-red-50 border-red-200'
                                }`}>
                                <p className={`text-xs ${parseResult.summary.isBalanced ? 'text-emerald-600' : 'text-red-600'}`}>
                                    สมดุล Dr=Cr
                                </p>
                                <p className={`text-xl font-bold ${parseResult.summary.isBalanced ? 'text-emerald-700' : 'text-red-700'}`}>
                                    {parseResult.summary.isBalanced ? '✓' : '✗'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Balance Info */}
                    {(selectedType === 'opening_balance' || selectedType === 'journal_entries') && (
                        <div className="mt-4 flex items-center gap-4 text-sm">
                            <span className="text-slate-600">
                                เดบิตรวม: <strong className="text-blue-600">฿{parseResult.summary.totalDebit?.toLocaleString()}</strong>
                            </span>
                            <span className="text-slate-600">
                                เครดิตรวม: <strong className="text-pink-600">฿{parseResult.summary.totalCredit?.toLocaleString()}</strong>
                            </span>
                            {!parseResult.summary.isBalanced && (
                                <span className="text-red-600 font-medium">
                                    ผลต่าง: ฿{Math.abs((parseResult.summary.totalDebit || 0) - (parseResult.summary.totalCredit || 0)).toLocaleString()}
                                </span>
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
                                                <AlertCircle size={16} className="text-red-500" />
                                                <div className="absolute left-0 top-full mt-1 z-10 w-64 p-2 bg-white border border-red-200 rounded-lg shadow-lg hidden group-hover:block">
                                                    {row.errors.map((err, idx) => (
                                                        <p key={idx} className="text-xs text-red-600">
                                                            {err.column}: {err.errorTh}
                                                        </p>
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
                                                className={`px-3 py-2 ${hasError ? 'text-red-700 font-medium' : 'text-slate-700'}`}
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
                </div>

                {/* Error Summary */}
                {parseResult.errors.length > 0 && (
                    <div className="p-4 bg-red-50 border-t border-red-200">
                        <h5 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                            <AlertTriangle size={16} />
                            สรุปข้อผิดพลาด ({parseResult.errors.length} รายการ)
                        </h5>
                        <div className="max-h-32 overflow-auto space-y-1">
                            {parseResult.errors.slice(0, 10).map((err, idx) => (
                                <p key={idx} className="text-xs text-red-600">
                                    {err.row > 0 ? `แถว ${err.row}: ` : ''}{err.errorTh}
                                </p>
                            ))}
                            {parseResult.errors.length > 10 && (
                                <p className="text-xs text-red-500 font-medium">
                                    ... และอีก {parseResult.errors.length - 10} รายการ
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
            <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-emerald-400 to-green-600 rounded-full flex items-center justify-center">
                <CheckCircle2 size={32} className="text-white" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">นำเข้าข้อมูลสำเร็จ!</h3>
            <p className="text-slate-600 mb-6">
                นำเข้าข้อมูล {parseResult?.validRows} รายการ เรียบร้อยแล้ว
            </p>
            <button
                onClick={handleClose}
                className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
            >
                เสร็จสิ้น
            </button>
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
                    {step === 'upload' && renderUploadStep()}
                    {step === 'preview' && renderPreviewStep()}
                    {step === 'complete' && renderCompleteStep()}
                </div>

                {/* Footer */}
                {step !== 'select_type' && step !== 'complete' && (
                    <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                        <button
                            onClick={() => {
                                if (step === 'upload') {
                                    setStep('select_type');
                                    setSelectedType(null);
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
                                        <Loader2 size={18} className="animate-spin text-blue-600" />
                                        <span className="text-sm text-slate-600">นำเข้าข้อมูล... {importProgress}%</span>
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

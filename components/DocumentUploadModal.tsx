/**
 * DocumentUploadModal Component
 * 
 * Modal สำหรับให้ Staff เลือก:
 * - Client (บริษัท)
 * - Period (ปี/เดือน งวดบัญชี)
 * - Auto-detect period จาก AI toggle
 * 
 * ก่อนอัปโหลดเอกสาร batch
 */

import React, { useState, useCallback } from 'react';
import { X, Upload, Building2, Calendar, FileText, Sparkles, ChevronDown, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { Client } from '../types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (context: UploadContext) => void;
    clients: Client[];
    selectedClientId?: string;
}

export interface UploadContext {
    clientId: string;
    clientName: string;
    year: number;
    month: number; // 1-12
    period: string; // "2567-01" format
    autoDetectPeriod: boolean; // ถ้า true = ใช้วันที่จาก AI แทน
}

const THAI_MONTHS = [
    { value: 1, label: 'มกราคม', short: 'ม.ค.' },
    { value: 2, label: 'กุมภาพันธ์', short: 'ก.พ.' },
    { value: 3, label: 'มีนาคม', short: 'มี.ค.' },
    { value: 4, label: 'เมษายน', short: 'เม.ย.' },
    { value: 5, label: 'พฤษภาคม', short: 'พ.ค.' },
    { value: 6, label: 'มิถุนายน', short: 'มิ.ย.' },
    { value: 7, label: 'กรกฎาคม', short: 'ก.ค.' },
    { value: 8, label: 'สิงหาคม', short: 'ส.ค.' },
    { value: 9, label: 'กันยายน', short: 'ก.ย.' },
    { value: 10, label: 'ตุลาคม', short: 'ต.ค.' },
    { value: 11, label: 'พฤศจิกายน', short: 'พ.ย.' },
    { value: 12, label: 'ธันวาคม', short: 'ธ.ค.' },
];

// Get current Thai year
const getCurrentThaiYear = () => new Date().getFullYear() + 543;
const getCurrentMonth = () => new Date().getMonth() + 1;

// Generate year options (last 3 years + current + next)
const getYearOptions = () => {
    const currentYear = getCurrentThaiYear();
    return [
        { value: currentYear + 1, label: `${currentYear + 1}` },
        { value: currentYear, label: `${currentYear}` },
        { value: currentYear - 1, label: `${currentYear - 1}` },
        { value: currentYear - 2, label: `${currentYear - 2}` },
    ];
};

const DocumentUploadModal: React.FC<Props> = ({
    isOpen,
    onClose,
    onConfirm,
    clients,
    selectedClientId
}) => {
    // State
    const [selectedClient, setSelectedClient] = useState<string>(selectedClientId || '');
    const [selectedYear, setSelectedYear] = useState<number>(getCurrentThaiYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(getCurrentMonth());
    const [autoDetectPeriod, setAutoDetectPeriod] = useState<boolean>(false);
    const [showClientDropdown, setShowClientDropdown] = useState(false);

    // Get selected client object
    const clientObj = clients.find(c => c.id === selectedClient);

    // Handle confirm
    const handleConfirm = useCallback(() => {
        if (!selectedClient || !clientObj) return;

        const westernYear = selectedYear - 543;
        const monthStr = String(selectedMonth).padStart(2, '0');

        const context: UploadContext = {
            clientId: selectedClient,
            clientName: clientObj.name,
            year: westernYear,
            month: selectedMonth,
            period: `${westernYear}-${monthStr}`,
            autoDetectPeriod
        };

        onConfirm(context);
        onClose();
    }, [selectedClient, clientObj, selectedYear, selectedMonth, autoDetectPeriod, onConfirm, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-indigo-600">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <Upload className="text-white" size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">นำเข้าเอกสาร</h2>
                                <p className="text-sm text-blue-100">เลือกบริษัทและงวดบัญชีก่อนอัปโหลด</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X className="text-white" size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Step 1: Select Client */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-bold">1</div>
                            <Building2 size={16} className="text-slate-400" />
                            เลือกบริษัท (Client)
                        </label>
                        <div className="relative">
                            <button
                                onClick={() => setShowClientDropdown(!showClientDropdown)}
                                className={`w-full px-4 py-3 text-left border rounded-xl flex items-center justify-between transition-colors ${selectedClient
                                        ? 'border-blue-300 bg-blue-50/50'
                                        : 'border-slate-200 hover:border-slate-300'
                                    }`}
                            >
                                {clientObj ? (
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                                            <Building2 size={20} />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-800">{clientObj.name}</p>
                                            <p className="text-xs text-slate-500">Tax ID: {clientObj.tax_id}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <span className="text-slate-400">-- เลือกบริษัท --</span>
                                )}
                                <ChevronDown size={16} className={`text-slate-400 transition-transform ${showClientDropdown ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Dropdown */}
                            {showClientDropdown && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-10 max-h-64 overflow-y-auto">
                                    {clients.length === 0 ? (
                                        <div className="p-4 text-center text-slate-500">
                                            ไม่มีบริษัทในระบบ
                                        </div>
                                    ) : (
                                        clients.map(client => (
                                            <button
                                                key={client.id}
                                                onClick={() => {
                                                    setSelectedClient(client.id);
                                                    setShowClientDropdown(false);
                                                }}
                                                className={`w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-slate-50 transition-colors ${selectedClient === client.id ? 'bg-blue-50' : ''
                                                    }`}
                                            >
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedClient === client.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    <Building2 size={16} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-slate-800 truncate">{client.name}</p>
                                                    <p className="text-xs text-slate-500">{client.industry} • {client.status}</p>
                                                </div>
                                                {selectedClient === client.id && (
                                                    <CheckCircle2 size={18} className="text-blue-600" />
                                                )}
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Step 2: Select Period */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-bold">2</div>
                            <Calendar size={16} className="text-slate-400" />
                            งวดบัญชี (Period)
                        </label>

                        <div className="grid grid-cols-2 gap-3">
                            {/* Month */}
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">เดือน</label>
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                    disabled={autoDetectPeriod}
                                    className={`w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${autoDetectPeriod ? 'bg-slate-100 text-slate-400' : ''
                                        }`}
                                >
                                    {THAI_MONTHS.map(m => (
                                        <option key={m.value} value={m.value}>
                                            {m.label} ({m.short})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Year */}
                            <div>
                                <label className="text-xs text-slate-500 block mb-1">ปี (พ.ศ.)</label>
                                <select
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                                    disabled={autoDetectPeriod}
                                    className={`w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${autoDetectPeriod ? 'bg-slate-100 text-slate-400' : ''
                                        }`}
                                >
                                    {getYearOptions().map(y => (
                                        <option key={y.value} value={y.value}>
                                            {y.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Period Preview */}
                        {!autoDetectPeriod && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg text-sm">
                                <FileText size={14} className="text-slate-400" />
                                <span className="text-slate-600">
                                    เอกสารจะบันทึกในงวด: <strong>{THAI_MONTHS[selectedMonth - 1].label} {selectedYear}</strong>
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Step 3: Auto-detect Toggle */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 text-xs font-bold">
                                <Sparkles size={12} />
                            </div>
                            ตั้งค่าขั้นสูง
                        </label>

                        <div className={`p-4 border rounded-xl transition-colors ${autoDetectPeriod
                                ? 'border-purple-300 bg-purple-50/50'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}>
                            <label className="flex items-start gap-3 cursor-pointer">
                                <div className="pt-0.5">
                                    <input
                                        type="checkbox"
                                        checked={autoDetectPeriod}
                                        onChange={(e) => setAutoDetectPeriod(e.target.checked)}
                                        className="w-5 h-5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                                    />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-slate-800">Auto-detect Period จาก AI</span>
                                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-full uppercase">
                                            Smart
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500 mt-1">
                                        ให้ AI อ่านวันที่จากเอกสารแล้วกำหนดงวดบัญชีอัตโนมัติ
                                        (override การเลือกด้านบน)
                                    </p>
                                </div>
                            </label>
                        </div>

                        {autoDetectPeriod && (
                            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                                <Info size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                                <div className="text-amber-800">
                                    <strong>หมายเหตุ:</strong> AI จะอ่านวันที่จากเอกสาร (issue_date)
                                    และกำหนดงวดบัญชีตามวันที่นั้น หากอ่านไม่ได้จะใช้งวดที่เลือกข้างต้นแทน
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
                    >
                        ยกเลิก
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedClient}
                        className={`px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all ${selectedClient
                                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        <Upload size={18} />
                        ดำเนินการต่อ
                    </button>
                </div>

                {/* Validation Warning */}
                {!selectedClient && (
                    <div className="px-6 pb-4 -mt-2">
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            <AlertCircle size={16} />
                            กรุณาเลือกบริษัทก่อนดำเนินการต่อ
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DocumentUploadModal;

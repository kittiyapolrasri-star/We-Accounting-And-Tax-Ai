/**
 * SalesDataImport.tsx
 * 
 * UI Component สำหรับ Import ข้อมูลยอดขายจากแพลตฟอร์มต่างๆ
 * รองรับ Grab, LINE MAN, Shopee, POS และอื่นๆ
 */

import React, { useState, useCallback } from 'react';
import {
    Upload, FileSpreadsheet, CheckCircle2, AlertTriangle,
    Building2, Calendar, TrendingUp, FileText, Download,
    ChevronDown, ChevronRight, BarChart3, DollarSign,
    Package, Store, Truck, CreditCard, XCircle, Loader2,
    ArrowRight, Eye, Check
} from 'lucide-react';
import {
    SmartExcelParser,
    SalesDataImporter,
    ExcelParseResult,
    SalesTransaction,
    DailySalesSummary,
    DataSourceType
} from '../services/excelParser';

interface Props {
    clientId: string;
    clientName: string;
    onImportComplete?: (data: {
        transactions: SalesTransaction[];
        summary: DailySalesSummary[];
        glEntries: any[];
    }) => void;
    onGenerateGL?: (entries: any[]) => void;
}

const SalesDataImport: React.FC<Props> = ({
    clientId,
    clientName,
    onImportComplete,
    onGenerateGL
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [parseResult, setParseResult] = useState<ExcelParseResult | null>(null);
    const [transactions, setTransactions] = useState<SalesTransaction[]>([]);
    const [summary, setSummary] = useState<DailySalesSummary[]>([]);
    const [glEntries, setGlEntries] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'summary' | 'gl'>('overview');
    const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

    // Source icon and color
    const getSourceInfo = (source: DataSourceType) => {
        const info: Record<DataSourceType, { icon: typeof Store; color: string; bg: string }> = {
            grab_food: { icon: Truck, color: 'text-green-600', bg: 'bg-green-50' },
            lineman: { icon: Package, color: 'text-lime-600', bg: 'bg-lime-50' },
            shopee_food: { icon: Store, color: 'text-orange-600', bg: 'bg-orange-50' },
            pos_foodstory: { icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50' },
            pos_generic: { icon: CreditCard, color: 'text-slate-600', bg: 'bg-slate-50' },
            bank_statement: { icon: Building2, color: 'text-purple-600', bg: 'bg-purple-50' },
            unknown: { icon: FileSpreadsheet, color: 'text-slate-500', bg: 'bg-slate-50' }
        };
        return info[source] || info.unknown;
    };

    // Handle file drop
    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        const excelFile = files.find(f =>
            f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
        );

        if (excelFile) {
            await processFile(excelFile);
        } else {
            setError('กรุณาอัปโหลดไฟล์ Excel (.xlsx หรือ .xls)');
        }
    }, []);

    // Handle file select
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            await processFile(file);
        }
    };

    // Process uploaded file
    const processFile = async (file: File) => {
        setIsProcessing(true);
        setError(null);

        try {
            const imported = await SalesDataImporter.importFromExcel(file);

            setParseResult(imported.result);
            setTransactions(imported.transactions);
            setSummary(imported.summary);

            // Generate GL entries
            const gl = SalesDataImporter.generateGLEntries(imported.transactions, clientId);
            setGlEntries(gl);

            // Callback
            onImportComplete?.({
                transactions: imported.transactions,
                summary: imported.summary,
                glEntries: gl
            });

        } catch (err) {
            console.error('Error processing file:', err);
            setError(`เกิดข้อผิดพลาดในการประมวลผลไฟล์: ${err}`);
        } finally {
            setIsProcessing(false);
        }
    };

    // Format currency
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('th-TH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    };

    // Calculate totals
    const totals = {
        orders: transactions.length,
        grossSales: transactions.reduce((sum, t) => sum + t.grossAmount, 0),
        discounts: transactions.reduce((sum, t) => sum + t.discount, 0),
        netSales: transactions.reduce((sum, t) => sum + t.netAmount, 0),
        commissions: transactions.reduce((sum, t) => sum + (t.commission || 0), 0),
        payouts: transactions.reduce((sum, t) => sum + (t.payout || 0), 0),
        cancelled: transactions.filter(t => t.status === 'cancelled').length
    };

    // Toggle day expansion
    const toggleDay = (date: string) => {
        const newExpanded = new Set(expandedDays);
        if (newExpanded.has(date)) {
            newExpanded.delete(date);
        } else {
            newExpanded.add(date);
        }
        setExpandedDays(newExpanded);
    };

    // Render upload zone
    if (!parseResult) {
        return (
            <div className="min-h-[400px] flex items-center justify-center p-8">
                <div
                    className={`w-full max-w-xl border-2 border-dashed rounded-2xl p-12 text-center transition-all
            ${isDragging
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-300 hover:border-slate-400 bg-white'
                        }`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                >
                    {isProcessing ? (
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 size={48} className="animate-spin text-blue-500" />
                            <p className="text-lg font-medium text-slate-700">กำลังประมวลผล...</p>
                            <p className="text-sm text-slate-500">อ่านและวิเคราะห์ข้อมูลจากไฟล์</p>
                        </div>
                    ) : (
                        <>
                            <div className="mb-6">
                                <div className="w-20 h-20 mx-auto bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                                    <Upload size={36} className="text-slate-400" />
                                </div>
                                <h3 className="text-xl font-semibold text-slate-800 mb-2">
                                    นำเข้าข้อมูลยอดขาย
                                </h3>
                                <p className="text-slate-500">
                                    ลากไฟล์มาวางหรือคลิกเพื่อเลือกไฟล์
                                </p>
                            </div>

                            <input
                                type="file"
                                id="file-upload"
                                accept=".xlsx,.xls"
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                            <label
                                htmlFor="file-upload"
                                className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl
                  font-medium cursor-pointer hover:bg-slate-800 transition-colors"
                            >
                                <FileSpreadsheet size={20} />
                                เลือกไฟล์ Excel
                            </label>

                            <div className="mt-8 flex flex-wrap justify-center gap-3">
                                {['Grab Food', 'LINE MAN', 'Shopee Food', 'POS', 'Bank'].map(platform => (
                                    <span key={platform} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm">
                                        {platform}
                                    </span>
                                ))}
                            </div>

                            {error && (
                                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                                    <XCircle size={20} className="text-red-500" />
                                    <p className="text-red-700">{error}</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    }

    // Render result view
    const SourceIcon = getSourceInfo(parseResult.source).icon;
    const sourceInfo = getSourceInfo(parseResult.source);

    return (
        <div className="space-y-6">
            {/* Header Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`p-4 rounded-xl ${sourceInfo.bg}`}>
                            <SourceIcon size={32} className={sourceInfo.color} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">
                                {parseResult.sourceName}
                            </h2>
                            <p className="text-slate-500 mt-1">
                                {parseResult.filename}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-sm">
                                {parseResult.metadata.dateRange && (
                                    <span className="flex items-center gap-1 text-slate-600">
                                        <Calendar size={14} />
                                        {parseResult.metadata.dateRange.start} - {parseResult.metadata.dateRange.end}
                                    </span>
                                )}
                                {parseResult.metadata.branches && (
                                    <span className="flex items-center gap-1 text-slate-600">
                                        <Building2 size={14} />
                                        {parseResult.metadata.branches.join(', ')}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                setParseResult(null);
                                setTransactions([]);
                                setSummary([]);
                                setGlEntries([]);
                            }}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            นำเข้าไฟล์อื่น
                        </button>
                        {onGenerateGL && glEntries.length > 0 && (
                            <button
                                onClick={() => onGenerateGL(glEntries)}
                                className="px-4 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800
                  flex items-center gap-2 transition-colors"
                            >
                                <Check size={18} />
                                บันทึกบัญชี ({glEntries.length} รายการ)
                            </button>
                        )}
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-5 gap-4 mt-6">
                    <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-sm text-slate-500">จำนวนรายการ</p>
                        <p className="text-2xl font-bold text-slate-900">{totals.orders.toLocaleString()}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-sm text-slate-500">ยอดขายรวม</p>
                        <p className="text-2xl font-bold text-slate-900">฿{formatCurrency(totals.grossSales)}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-sm text-slate-500">ค่าคอมมิชชั่น</p>
                        <p className="text-2xl font-bold text-red-600">-฿{formatCurrency(totals.commissions)}</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-xl">
                        <p className="text-sm text-slate-500">ยอดรับจริง</p>
                        <p className="text-2xl font-bold text-green-600">฿{formatCurrency(totals.payouts || totals.netSales)}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-sm text-slate-500">ยกเลิก</p>
                        <p className="text-2xl font-bold text-slate-900">{totals.cancelled}</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="border-b border-slate-200">
                    <div className="flex">
                        {[
                            { id: 'overview', label: 'ภาพรวม', icon: BarChart3 },
                            { id: 'transactions', label: 'รายการทั้งหมด', icon: FileText, count: transactions.length },
                            { id: 'summary', label: 'สรุปรายวัน', icon: Calendar, count: summary.length },
                            { id: 'gl', label: 'รายการบัญชี', icon: DollarSign, count: glEntries.length }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-6 py-4 font-medium text-sm border-b-2 transition-colors
                  ${activeTab === tab.id
                                        ? 'border-slate-900 text-slate-900'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <tab.icon size={18} />
                                {tab.label}
                                {tab.count !== undefined && (
                                    <span className="px-2 py-0.5 bg-slate-100 rounded-full text-xs">
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-2 gap-6">
                            {/* By Branch */}
                            <div>
                                <h3 className="font-semibold text-slate-800 mb-4">ยอดขายตามสาขา</h3>
                                <div className="space-y-3">
                                    {Array.from(new Set(transactions.map(t => t.branch || 'ไม่ระบุ'))).map(branch => {
                                        const branchTx = transactions.filter(t => (t.branch || 'ไม่ระบุ') === branch);
                                        const branchTotal = branchTx.reduce((sum, t) => sum + t.netAmount, 0);
                                        const percentage = (branchTotal / totals.netSales) * 100;

                                        return (
                                            <div key={branch} className="flex items-center gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-sm font-medium text-slate-700">{branch}</span>
                                                        <span className="text-sm text-slate-600">฿{formatCurrency(branchTotal)}</span>
                                                    </div>
                                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-slate-600 rounded-full"
                                                            style={{ width: `${percentage}%` }}
                                                        />
                                                    </div>
                                                </div>
                                                <span className="text-sm text-slate-500 w-12 text-right">
                                                    {percentage.toFixed(1)}%
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Top Days */}
                            <div>
                                <h3 className="font-semibold text-slate-800 mb-4">วันที่ขายดีที่สุด</h3>
                                <div className="space-y-2">
                                    {summary
                                        .sort((a, b) => b.netSales - a.netSales)
                                        .slice(0, 5)
                                        .map((day, i) => (
                                            <div key={day.date} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">
                                                    {i + 1}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-medium text-slate-800">{day.date}</p>
                                                    <p className="text-sm text-slate-500">{day.totalOrders} รายการ</p>
                                                </div>
                                                <p className="font-bold text-slate-900">฿{formatCurrency(day.netSales)}</p>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Transactions Tab */}
                    {activeTab === 'transactions' && (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-200">
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">วันที่</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Order ID</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">สาขา</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">ยอดขาย</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">ค่า GP</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">รับจริง</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">สถานะ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {transactions.slice(0, 50).map((tx, i) => (
                                        <tr key={tx.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 text-sm text-slate-600">
                                                {tx.date.toLocaleDateString('th-TH')}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-medium text-slate-800">
                                                {tx.orderId}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-600">
                                                {tx.branch || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right text-slate-800">
                                                ฿{formatCurrency(tx.netAmount)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right text-red-600">
                                                {tx.commission ? `-฿${formatCurrency(tx.commission)}` : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-medium text-green-600">
                                                ฿{formatCurrency(tx.payout || tx.netAmount)}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium
                          ${tx.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                        tx.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                                            'bg-slate-100 text-slate-700'
                                                    }`}
                                                >
                                                    {tx.status === 'completed' ? 'สำเร็จ' :
                                                        tx.status === 'cancelled' ? 'ยกเลิก' : tx.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {transactions.length > 50 && (
                                <p className="p-4 text-center text-sm text-slate-500">
                                    แสดง 50 จาก {transactions.length} รายการ
                                </p>
                            )}
                        </div>
                    )}

                    {/* Summary Tab */}
                    {activeTab === 'summary' && (
                        <div className="space-y-3">
                            {summary.map(day => (
                                <div key={`${day.date}-${day.branch}`} className="border border-slate-200 rounded-lg overflow-hidden">
                                    <button
                                        onClick={() => toggleDay(day.date)}
                                        className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            {expandedDays.has(day.date) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                            <span className="font-medium text-slate-800">{day.date}</span>
                                            {day.branch && (
                                                <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-sm">
                                                    {day.branch}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-6 text-sm">
                                            <span className="text-slate-600">{day.totalOrders} รายการ</span>
                                            <span className="font-medium text-slate-800">฿{formatCurrency(day.netSales)}</span>
                                        </div>
                                    </button>

                                    {expandedDays.has(day.date) && (
                                        <div className="p-4 grid grid-cols-4 gap-4 border-t border-slate-200">
                                            <div>
                                                <p className="text-xs text-slate-500">ยอดขายรวม</p>
                                                <p className="text-lg font-semibold text-slate-800">฿{formatCurrency(day.grossSales)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500">ส่วนลด</p>
                                                <p className="text-lg font-semibold text-red-600">-฿{formatCurrency(day.discounts)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500">ค่าคอมมิชชั่น</p>
                                                <p className="text-lg font-semibold text-red-600">-฿{formatCurrency(day.commissions)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500">รับจริง</p>
                                                <p className="text-lg font-semibold text-green-600">฿{formatCurrency(day.payouts)}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* GL Entries Tab */}
                    {activeTab === 'gl' && (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-200">
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">วันที่</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">รหัสบัญชี</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">ชื่อบัญชี</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">เดบิต</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">เครดิต</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">คำอธิบาย</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {glEntries.map((entry, i) => (
                                        <tr key={i} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 text-sm text-slate-600">{entry.date}</td>
                                            <td className="px-4 py-3 text-sm font-mono text-slate-800">{entry.accountCode}</td>
                                            <td className="px-4 py-3 text-sm text-slate-800">{entry.accountName}</td>
                                            <td className="px-4 py-3 text-sm text-right text-slate-800">
                                                {entry.debit > 0 ? `฿${formatCurrency(entry.debit)}` : ''}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right text-slate-800">
                                                {entry.credit > 0 ? `฿${formatCurrency(entry.credit)}` : ''}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate">
                                                {entry.description}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-50">
                                    <tr>
                                        <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-slate-800">รวม</td>
                                        <td className="px-4 py-3 text-sm text-right font-bold text-slate-900">
                                            ฿{formatCurrency(glEntries.reduce((sum, e) => sum + e.debit, 0))}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right font-bold text-slate-900">
                                            ฿{formatCurrency(glEntries.reduce((sum, e) => sum + e.credit, 0))}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SalesDataImport;

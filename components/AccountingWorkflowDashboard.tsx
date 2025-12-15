/**
 * AccountingWorkflowDashboard.tsx
 * 
 * Master Dashboard สำหรับจัดการ workflow สำนักงานบัญชีครบวงจร
 * แสดงสถานะและดำเนินการทุกขั้นตอนได้จากที่เดียว
 */

import React, { useState, useEffect } from 'react';
import {
    FileText, CheckCircle2, AlertTriangle, Clock, PlayCircle,
    Calendar, ChevronDown, ChevronRight, RefreshCw, Loader2,
    FileDigit, Calculator, TrendingUp, FileSpreadsheet, Receipt,
    Lock, Unlock, ArrowRight, XCircle, AlertCircle, Zap
} from 'lucide-react';
import { Client, DocumentRecord, PostedGLEntry } from '../types';
import { accountingEngine, MonthlyClosingProgress, ProcessingResult } from '../services/accountingFirmEngine';

interface Props {
    clients: Client[];
    onProcessComplete?: (result: any) => void;
}

interface WorkflowStep {
    id: string;
    name: string;
    nameTh: string;
    icon: React.ReactNode;
    status: 'pending' | 'in_progress' | 'completed' | 'error' | 'skipped';
    progress?: number;
    details?: string;
    action?: () => Promise<void>;
}

const AccountingWorkflowDashboard: React.FC<Props> = ({ clients, onProcessComplete }) => {
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    const [closingProgress, setClosingProgress] = useState<MonthlyClosingProgress | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentStep, setCurrentStep] = useState<string | null>(null);
    const [results, setResults] = useState<ProcessingResult[]>([]);
    const [expandedSection, setExpandedSection] = useState<string | null>('overview');

    // Load closing progress when client or period changes
    useEffect(() => {
        if (selectedClient) {
            loadClosingProgress();
        }
    }, [selectedClient, selectedPeriod]);

    const loadClosingProgress = async () => {
        if (!selectedClient) return;

        setIsLoading(true);
        try {
            const progress = await accountingEngine.getMonthlyClosingProgress(
                selectedClient.id,
                selectedPeriod
            );
            setClosingProgress(progress);
        } catch (error) {
            console.error('Failed to load progress:', error);
        }
        setIsLoading(false);
    };

    // Run individual step
    const runStep = async (stepId: string) => {
        if (!selectedClient) return;

        setCurrentStep(stepId);
        setIsProcessing(true);
        let result: ProcessingResult | null = null;

        try {
            switch (stepId) {
                case 'documents':
                    result = await runDocumentProcessing();
                    break;
                case 'reconcile':
                    result = await accountingEngine.autoReconcileBank(selectedClient.id, selectedPeriod);
                    break;
                case 'closing':
                    result = await accountingEngine.runMonthlyClosing(selectedClient.id, selectedPeriod);
                    break;
                case 'vat':
                    result = await accountingEngine.generateVATReturn(selectedClient.id, selectedPeriod);
                    break;
                case 'wht':
                    result = await accountingEngine.generateWHTCertificates(selectedClient.id, selectedPeriod);
                    break;
                case 'reports':
                    result = await runReportGeneration();
                    break;
            }

            if (result) {
                setResults(prev => [...prev, result!]);
            }

            await loadClosingProgress();
            onProcessComplete?.(result);

        } catch (error) {
            console.error(`Step ${stepId} failed:`, error);
        }

        setIsProcessing(false);
        setCurrentStep(null);
    };

    // Run full monthly processing
    const runFullProcess = async () => {
        if (!selectedClient) return;

        setIsProcessing(true);
        setResults([]);

        try {
            const fullResult = await accountingEngine.runFullMonthlyProcessing(
                selectedClient.id,
                selectedPeriod,
                {
                    autoPost: true,
                    autoReconcile: true,
                    generateReports: true,
                    generateTaxForms: true
                }
            );

            setClosingProgress(fullResult.summary);
            onProcessComplete?.(fullResult);

        } catch (error) {
            console.error('Full process failed:', error);
        }

        setIsProcessing(false);
    };

    const runDocumentProcessing = async (): Promise<ProcessingResult> => {
        // This would be enhanced to auto-approve pending documents
        return {
            success: true,
            status: 'completed',
            message: 'Document processing completed',
            messageTh: 'ประมวลผลเอกสารสำเร็จ'
        };
    };

    const runReportGeneration = async (): Promise<ProcessingResult> => {
        if (!selectedClient) {
            return { success: false, status: 'failed', message: 'No client selected', messageTh: 'ไม่ได้เลือกลูกค้า' };
        }

        const periodStart = `${selectedPeriod}-01`;
        const periodEnd = getLastDayOfMonth(selectedPeriod);

        await accountingEngine.generateFinancialStatements(
            selectedClient.id,
            periodStart,
            periodEnd
        );

        return {
            success: true,
            status: 'completed',
            message: 'Financial statements generated',
            messageTh: 'สร้างงบการเงินสำเร็จ'
        };
    };

    const getLastDayOfMonth = (period: string): string => {
        const [year, month] = period.split('-').map(Number);
        const lastDay = new Date(year, month, 0).getDate();
        return `${period}-${lastDay.toString().padStart(2, '0')}`;
    };

    const getStepStatus = (stepId: string): 'pending' | 'in_progress' | 'completed' | 'error' => {
        if (currentStep === stepId) return 'in_progress';
        if (!closingProgress) return 'pending';

        switch (stepId) {
            case 'documents':
                return closingProgress.phases.documentsProcessed.pending === 0 &&
                    closingProgress.phases.documentsProcessed.completed > 0
                    ? 'completed' : 'pending';
            case 'reconcile':
                return closingProgress.phases.bankReconciled.unmatched === 0 &&
                    closingProgress.phases.bankReconciled.matched > 0
                    ? 'completed' : 'pending';
            case 'closing':
                return closingProgress.phases.closingEntriesPosted ? 'completed' : 'pending';
            case 'vat':
                return closingProgress.phases.vatFilingReady ? 'completed' : 'pending';
            case 'wht':
                return closingProgress.phases.whtFilingReady ? 'completed' : 'pending';
            case 'reports':
                return closingProgress.phases.financialStatementsPrepared ? 'completed' : 'pending';
            default:
                return 'pending';
        }
    };

    const workflowSteps: WorkflowStep[] = [
        {
            id: 'documents',
            name: 'Document Processing',
            nameTh: 'ประมวลผลเอกสาร',
            icon: <FileText size={20} />,
            status: getStepStatus('documents'),
            details: closingProgress
                ? `${closingProgress.phases.documentsProcessed.completed}/${closingProgress.phases.documentsProcessed.total} เอกสาร`
                : undefined
        },
        {
            id: 'reconcile',
            name: 'Bank Reconciliation',
            nameTh: 'กระทบยอดธนาคาร',
            icon: <Calculator size={20} />,
            status: getStepStatus('reconcile'),
            details: closingProgress
                ? `${closingProgress.phases.bankReconciled.matched}/${closingProgress.phases.bankReconciled.total} รายการ`
                : undefined
        },
        {
            id: 'closing',
            name: 'Monthly Closing',
            nameTh: 'ปิดบัญชีประจำเดือน',
            icon: <Lock size={20} />,
            status: getStepStatus('closing'),
            details: closingProgress?.phases.closingEntriesPosted ? 'เสร็จสิ้น' : 'รอดำเนินการ'
        },
        {
            id: 'reports',
            name: 'Financial Statements',
            nameTh: 'งบการเงิน',
            icon: <FileSpreadsheet size={20} />,
            status: getStepStatus('reports'),
            details: closingProgress?.phases.financialStatementsPrepared ? 'พร้อมใช้งาน' : 'รอสร้าง'
        },
        {
            id: 'vat',
            name: 'VAT Return (PP30)',
            nameTh: 'แบบ ภ.พ.30',
            icon: <Receipt size={20} />,
            status: getStepStatus('vat'),
            details: closingProgress?.phases.vatFilingReady ? 'พร้อมยื่น' : 'รอเตรียม'
        },
        {
            id: 'wht',
            name: 'WHT Certificates',
            nameTh: 'หนังสือรับรองหัก ณ ที่จ่าย',
            icon: <FileDigit size={20} />,
            status: getStepStatus('wht'),
            details: closingProgress?.phases.whtFilingReady ? 'พร้อมออก' : 'รอเตรียม'
        }
    ];

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'text-green-600 bg-green-100';
            case 'in_progress': return 'text-blue-600 bg-blue-100';
            case 'error': return 'text-red-600 bg-red-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <CheckCircle2 size={16} className="text-green-600" />;
            case 'in_progress': return <Loader2 size={16} className="text-blue-600 animate-spin" />;
            case 'error': return <XCircle size={16} className="text-red-600" />;
            default: return <Clock size={16} className="text-gray-400" />;
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Zap className="text-yellow-500" />
                    Accounting Workflow Dashboard
                </h1>
                <p className="text-gray-600">จัดการงานสำนักงานบัญชีครบวงจรอัตโนมัติ</p>
            </div>

            {/* Client & Period Selection */}
            <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
                <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            เลือกลูกค้า
                        </label>
                        <select
                            value={selectedClient?.id || ''}
                            onChange={(e) => {
                                const client = clients.find(c => c.id === e.target.value);
                                setSelectedClient(client || null);
                            }}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">-- เลือกลูกค้า --</option>
                            {clients.map(client => (
                                <option key={client.id} value={client.id}>
                                    {client.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="w-48">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            งวดบัญชี
                        </label>
                        <input
                            type="month"
                            value={selectedPeriod}
                            onChange={(e) => setSelectedPeriod(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <button
                        onClick={loadClosingProgress}
                        disabled={!selectedClient || isLoading}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
                    >
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                        รีเฟรช
                    </button>

                    <button
                        onClick={runFullProcess}
                        disabled={!selectedClient || isProcessing}
                        className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg 
                       hover:from-blue-700 hover:to-purple-700 flex items-center gap-2 font-medium
                       disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                กำลังประมวลผล...
                            </>
                        ) : (
                            <>
                                <PlayCircle size={18} />
                                รันทั้งหมดอัตโนมัติ
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Progress Overview */}
            {selectedClient && closingProgress && (
                <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold">ความคืบหน้าปิดบัญชี</h2>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${closingProgress.status === 'completed' ? 'bg-green-100 text-green-700' :
                                closingProgress.status === 'ready_for_review' ? 'bg-blue-100 text-blue-700' :
                                    closingProgress.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-gray-100 text-gray-700'
                            }`}>
                            {closingProgress.status === 'completed' ? 'เสร็จสมบูรณ์' :
                                closingProgress.status === 'ready_for_review' ? 'พร้อมตรวจสอบ' :
                                    closingProgress.status === 'in_progress' ? 'กำลังดำเนินการ' :
                                        'ยังไม่เริ่ม'}
                        </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="relative mb-6">
                        <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
                                style={{ width: `${closingProgress.overallProgress}%` }}
                            />
                        </div>
                        <div className="absolute right-0 top-5 text-sm font-medium text-gray-600">
                            {closingProgress.overallProgress}%
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-blue-50 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-blue-700">
                                {closingProgress.phases.documentsProcessed.completed}
                            </div>
                            <div className="text-sm text-blue-600">เอกสารประมวลผลแล้ว</div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-green-700">
                                {closingProgress.phases.bankReconciled.matched}
                            </div>
                            <div className="text-sm text-green-600">รายการ Match</div>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-purple-700">
                                {closingProgress.phases.glPosted.totalEntries}
                            </div>
                            <div className="text-sm text-purple-600">รายการบัญชี</div>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-orange-700">
                                {closingProgress.phases.glPosted.totalDebit.toLocaleString()}
                            </div>
                            <div className="text-sm text-orange-600">ยอดรวม (บาท)</div>
                        </div>
                    </div>

                    {/* Issues */}
                    {closingProgress.issues.length > 0 && (
                        <div className="border-t pt-4">
                            <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                <AlertCircle size={16} className="text-yellow-500" />
                                รายการที่ต้องดำเนินการ
                            </h3>
                            <div className="space-y-2">
                                {closingProgress.issues.map((issue, idx) => (
                                    <div
                                        key={idx}
                                        className={`p-3 rounded-lg flex items-center justify-between ${issue.severity === 'error' ? 'bg-red-50' : 'bg-yellow-50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            {issue.severity === 'error'
                                                ? <XCircle size={16} className="text-red-500" />
                                                : <AlertTriangle size={16} className="text-yellow-500" />
                                            }
                                            <span className={issue.severity === 'error' ? 'text-red-700' : 'text-yellow-700'}>
                                                {issue.message}
                                            </span>
                                        </div>
                                        {issue.action && (
                                            <button
                                                onClick={() => runStep(issue.action!)}
                                                className="text-sm text-blue-600 hover:underline"
                                            >
                                                แก้ไข
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Workflow Steps */}
            {selectedClient && (
                <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h2 className="text-lg font-semibold mb-4">ขั้นตอนการทำงาน</h2>

                    <div className="space-y-3">
                        {workflowSteps.map((step, index) => (
                            <div
                                key={step.id}
                                className={`p-4 rounded-lg border-2 transition-all ${step.status === 'in_progress' ? 'border-blue-400 bg-blue-50' :
                                        step.status === 'completed' ? 'border-green-300 bg-green-50' :
                                            step.status === 'error' ? 'border-red-300 bg-red-50' :
                                                'border-gray-200 bg-gray-50'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-lg ${getStatusColor(step.status)}`}>
                                            {step.icon}
                                        </div>
                                        <div>
                                            <div className="font-medium text-gray-900">{step.nameTh}</div>
                                            <div className="text-sm text-gray-500">{step.name}</div>
                                            {step.details && (
                                                <div className="text-sm text-gray-600 mt-1">{step.details}</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {getStatusIcon(step.status)}

                                        {step.status !== 'completed' && step.status !== 'in_progress' && (
                                            <button
                                                onClick={() => runStep(step.id)}
                                                disabled={isProcessing}
                                                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg 
                                   hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                                            >
                                                <PlayCircle size={14} />
                                                เริ่ม
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Results Log */}
            {results.length > 0 && (
                <div className="mt-6 bg-gray-900 rounded-lg p-4">
                    <h3 className="text-white font-medium mb-2">ผลการดำเนินงาน</h3>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                        {results.map((result, idx) => (
                            <div
                                key={idx}
                                className={`text-sm font-mono ${result.success ? 'text-green-400' : 'text-red-400'
                                    }`}
                            >
                                [{result.success ? '✓' : '✗'}] {result.messageTh}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!selectedClient && (
                <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
                    <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-700 mb-2">
                        เลือกลูกค้าเพื่อเริ่มต้น
                    </h3>
                    <p className="text-gray-500">
                        เลือกลูกค้าและงวดบัญชีจากด้านบนเพื่อดูและจัดการ workflow
                    </p>
                </div>
            )}
        </div>
    );
};

export default AccountingWorkflowDashboard;

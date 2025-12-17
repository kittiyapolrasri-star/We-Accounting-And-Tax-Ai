import React, { useMemo } from 'react';
import { PostedGLEntry } from '../types';
import { Scale, TrendingUp, Building2, Wallet, ArrowDown, Download } from 'lucide-react';
import { downloadBalanceSheetPDF, BalanceSheetData } from '../services/pdfService';

interface Props {
    entries: PostedGLEntry[];
    clientName?: string;
    clientTaxId?: string;
}

const BalanceSheet: React.FC<Props> = ({ entries, clientName = 'Company Name', clientTaxId = '0000000000000' }) => {
    const bsData = useMemo(() => {
        // 1. Helper to sum account group
        const sumByPrefix = (prefix: string) => {
            return entries
                .filter(e => e.account_code.startsWith(prefix))
                .reduce((sum, e) => {
                    const firstDigit = prefix.charAt(0);
                    // Asset (1) & Expense (5) = Dr - Cr
                    // Liab (2), Equity (3), Rev (4) = Cr - Dr
                    if (firstDigit === '1' || firstDigit === '5') return sum + (e.debit - e.credit);
                    return sum + (e.credit - e.debit);
                }, 0);
        };

        // 2. Calculate P&L for Retained Earnings
        const revenue = sumByPrefix('4');
        const expenses = sumByPrefix('5');
        const currentYearEarnings = revenue - expenses;

        // 3. Asset Groups
        const cashAndBank = sumByPrefix('111');
        const accountsReceivable = sumByPrefix('113');
        const inventory = sumByPrefix('114');
        const currentAssets = cashAndBank + accountsReceivable + inventory + sumByPrefix('115'); // Include VAT

        const fixedAssets = sumByPrefix('12');
        const totalAssets = sumByPrefix('1');

        // 4. Liability Groups
        const accountsPayable = sumByPrefix('212');
        const accruedExpenses = sumByPrefix('213');
        const taxPayable = sumByPrefix('214') + sumByPrefix('215');
        const totalLiabilities = sumByPrefix('2');

        // 5. Equity Groups
        const shareCapital = sumByPrefix('310'); // Assume 31000 is Capital
        const retainedEarningsBF = sumByPrefix('320'); // Brought Forward
        const totalEquity = sumByPrefix('3') + currentYearEarnings;

        return {
            assets: {
                cashAndBank,
                accountsReceivable,
                currentAssets,
                fixedAssets,
                total: totalAssets
            },
            liabilities: {
                accountsPayable,
                accruedExpenses,
                taxPayable,
                total: totalLiabilities
            },
            equity: {
                shareCapital,
                retainedEarningsBF,
                currentYearEarnings,
                total: totalEquity
            }
        };
    }, [entries]);

    const formatCurrency = (val: number) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
    const isBalanced = Math.abs(bsData.assets.total - (bsData.liabilities.total + bsData.equity.total)) < 1.0;

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full animate-in fade-in duration-500">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                        <Scale className="text-emerald-600" size={20} />
                        งบแสดงฐานะการเงิน (Balance Sheet)
                    </h3>
                    <p className="text-sm text-slate-500">สถานะสินทรัพย์ หนี้สิน และส่วนของผู้ถือหุ้น</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full border ${isBalanced ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {isBalanced ? 'Balanced (A = L + OE)' : 'Unbalanced'}
                    </span>
                    <button
                        onClick={() => {
                            const pdfData: BalanceSheetData = {
                                companyInfo: { name: clientName, taxId: clientTaxId },
                                periodStart: new Date(new Date().getFullYear(), 0, 1).toLocaleDateString('th-TH'),
                                periodEnd: new Date().toLocaleDateString('th-TH'),
                                currentAssets: [
                                    { name: 'Cash and Cash Equivalents', amount: bsData.assets.cashAndBank },
                                    { name: 'Accounts Receivable', amount: bsData.assets.accountsReceivable }
                                ],
                                nonCurrentAssets: [
                                    { name: 'Property, Plant & Equipment', amount: bsData.assets.fixedAssets }
                                ],
                                currentLiabilities: [
                                    { name: 'Accounts Payable', amount: bsData.liabilities.accountsPayable },
                                    { name: 'Accrued Expenses', amount: bsData.liabilities.accruedExpenses },
                                    { name: 'Tax Payable', amount: bsData.liabilities.taxPayable }
                                ],
                                nonCurrentLiabilities: [],
                                equity: [
                                    { name: 'Share Capital', amount: bsData.equity.shareCapital },
                                    { name: 'Retained Earnings', amount: bsData.equity.retainedEarningsBF },
                                    { name: 'Current Year Earnings', amount: bsData.equity.currentYearEarnings }
                                ]
                            };
                            downloadBalanceSheetPDF(pdfData);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                        <Download size={16} /> Export PDF
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">

                    {/* LEFT: ASSETS */}
                    <div className="space-y-6">
                        <h4 className="font-bold text-slate-700 border-b-2 border-emerald-500 pb-2 flex items-center gap-2">
                            <Wallet size={18} /> สินทรัพย์ (Assets)
                        </h4>

                        {/* Current Assets */}
                        <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                            <h5 className="font-bold text-sm text-slate-500 mb-3 uppercase tracking-wider">สินทรัพย์หมุนเวียน</h5>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-600">เงินสดและรายการเทียบเท่าเงินสด</span>
                                    <span className="font-mono font-medium">{formatCurrency(bsData.assets.cashAndBank)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-600">ลูกหนี้การค้า</span>
                                    <span className="font-mono font-medium">{formatCurrency(bsData.assets.accountsReceivable)}</span>
                                </div>
                                <div className="flex justify-between pt-2 border-t border-slate-200">
                                    <span className="font-bold text-slate-700">รวมสินทรัพย์หมุนเวียน</span>
                                    <span className="font-mono font-bold text-slate-800">{formatCurrency(bsData.assets.currentAssets)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Non-Current Assets */}
                        <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                            <h5 className="font-bold text-sm text-slate-500 mb-3 uppercase tracking-wider">สินทรัพย์ไม่หมุนเวียน</h5>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-600">ที่ดิน อาคาร และอุปกรณ์ (สุทธิ)</span>
                                    <span className="font-mono font-medium">{formatCurrency(bsData.assets.fixedAssets)}</span>
                                </div>
                                <div className="flex justify-between pt-2 border-t border-slate-200">
                                    <span className="font-bold text-slate-700">รวมสินทรัพย์ไม่หมุนเวียน</span>
                                    <span className="font-mono font-bold text-slate-800">{formatCurrency(bsData.assets.fixedAssets)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Total Assets */}
                        <div className="bg-emerald-600 text-white rounded-xl p-5 shadow-lg shadow-emerald-200 flex justify-between items-center">
                            <span className="font-bold text-lg">รวมสินทรัพย์ (Total Assets)</span>
                            <span className="font-bold text-2xl font-mono">{formatCurrency(bsData.assets.total)}</span>
                        </div>
                    </div>

                    {/* RIGHT: LIABILITIES & EQUITY */}
                    <div className="space-y-6">
                        <h4 className="font-bold text-slate-700 border-b-2 border-blue-500 pb-2 flex items-center gap-2">
                            <Building2 size={18} /> หนี้สินและส่วนของผู้ถือหุ้น
                        </h4>

                        {/* Liabilities */}
                        <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                            <h5 className="font-bold text-sm text-slate-500 mb-3 uppercase tracking-wider">หนี้สิน (Liabilities)</h5>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-600">เจ้าหนี้การค้า</span>
                                    <span className="font-mono font-medium">{formatCurrency(bsData.liabilities.accountsPayable)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-600">ค่าใช้จ่ายค้างจ่าย</span>
                                    <span className="font-mono font-medium">{formatCurrency(bsData.liabilities.accruedExpenses)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-600">ภาษีค้างจ่าย (VAT/WHT)</span>
                                    <span className="font-mono font-medium">{formatCurrency(bsData.liabilities.taxPayable)}</span>
                                </div>
                                <div className="flex justify-between pt-2 border-t border-slate-200">
                                    <span className="font-bold text-slate-700">รวมหนี้สิน</span>
                                    <span className="font-mono font-bold text-slate-800">{formatCurrency(bsData.liabilities.total)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Equity */}
                        <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                            <h5 className="font-bold text-sm text-slate-500 mb-3 uppercase tracking-wider">ส่วนของผู้ถือหุ้น (Equity)</h5>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-600">ทุนจดทะเบียน (Paid-up Capital)</span>
                                    <span className="font-mono font-medium">{formatCurrency(bsData.equity.shareCapital)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-600">กำไร(ขาดทุน) สะสม</span>
                                    <span className="font-mono font-medium">{formatCurrency(bsData.equity.retainedEarningsBF)}</span>
                                </div>
                                <div className="flex justify-between bg-blue-50 p-2 rounded border border-blue-100">
                                    <span className="text-blue-700 font-medium flex items-center gap-2"><TrendingUp size={14} /> กำไรสุทธิปีปัจจุบัน (Current Year)</span>
                                    <span className="font-mono font-bold text-blue-700">{formatCurrency(bsData.equity.currentYearEarnings)}</span>
                                </div>
                                <div className="flex justify-between pt-2 border-t border-slate-200">
                                    <span className="font-bold text-slate-700">รวมส่วนของผู้ถือหุ้น</span>
                                    <span className="font-mono font-bold text-slate-800">{formatCurrency(bsData.equity.total)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Total L+OE */}
                        <div className="bg-slate-800 text-white rounded-xl p-5 shadow-lg flex justify-between items-center">
                            <span className="font-bold text-lg">รวมหนี้สินและส่วนของผู้ถือหุ้น</span>
                            <span className="font-bold text-2xl font-mono">{formatCurrency(bsData.liabilities.total + bsData.equity.total)}</span>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default BalanceSheet;
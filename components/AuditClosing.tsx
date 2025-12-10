import React, { useState, useMemo } from 'react';
import { ShieldCheck, Lock, AlertTriangle, CheckCircle2, ScanSearch, History, AlertCircle, ArrowRight, Play, Package, Download, Scale, RefreshCw, Wallet, Calculator, Coins } from 'lucide-react';
import { DocumentRecord, PostedGLEntry, FixedAsset } from '../types';

interface Props {
    documents: DocumentRecord[];
    glEntries: PostedGLEntry[];
    assets: FixedAsset[]; // Received Fixed Asset Data
    clientId: string;
    onClosePeriod: () => void;
    isLocked?: boolean;
    onPostJournal?: (entries: PostedGLEntry[]) => void;
}

const AuditClosing: React.FC<Props> = ({ documents, glEntries, assets, clientId, onClosePeriod, isLocked, onPostJournal }) => {
    const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'complete'>('idle');
    const [auditScore, setAuditScore] = useState(100);
    const [checklist, setChecklist] = useState({
        docsReviewed: false,
        bankRecon: false,
        vatFiled: false,
        assetsDepre: false,
        citCalculated: false // NEW CHECK
    });

    // --- SYSTEMATIC AUDIT ENGINE ---
    const reconciliation = useMemo(() => {
        // 1. VAT Reconciliation
        const glInputVat = glEntries
            .filter(e => e.account_code === '11540') // Input VAT
            .reduce((sum, e) => sum + (e.debit - e.credit), 0);
        
        const docInputVat = documents
            .filter(d => d.status === 'approved' && d.ai_data?.tax_compliance.is_full_tax_invoice && d.ai_data.tax_compliance.vat_claimable)
            .reduce((sum, d) => sum + (d.ai_data?.financials.vat_amount || 0), 0);

        const vatDiff = Math.abs(glInputVat - docInputVat);

        // 2. Fixed Asset Reconciliation
        const glAssets = glEntries
            .filter(e => e.account_code.startsWith('12') && !e.account_code.endsWith('01')) // Asset Cost accounts (excluding accum depre)
            .reduce((sum, e) => sum + (e.debit - e.credit), 0);
        
        const regAssets = assets.reduce((sum, a) => sum + a.cost, 0);
        const assetDiff = Math.abs(glAssets - regAssets);

        // 3. Pending Docs Check
        const pendingDocs = documents.filter(d => d.status === 'pending_review' || d.status === 'processing').length;

        return {
            vat: { gl: glInputVat, doc: docInputVat, diff: vatDiff, status: vatDiff < 1 ? 'pass' : 'fail' },
            asset: { gl: glAssets, reg: regAssets, diff: assetDiff, status: assetDiff < 1 ? 'pass' : 'fail' },
            pending: pendingDocs
        };
    }, [documents, glEntries, assets]);

    // --- CLOSING PREVIEW ENGINE (Enhanced with CIT) ---
    const closingPreview = useMemo(() => {
        // Calculate P&L Balances to Clear
        const closingLines: {code: string, name: string, balance: number, side: 'DEBIT'|'CREDIT'}[] = [];
        
        // Sum by Account Code for Revenue (4) & Expense (5)
        const accountBalances: {[code: string]: {name: string, balance: number}} = {};
        
        glEntries.forEach(entry => {
            if (entry.account_code.startsWith('4') || entry.account_code.startsWith('5')) {
                if (!accountBalances[entry.account_code]) {
                    accountBalances[entry.account_code] = { name: entry.account_name, balance: 0 };
                }
                // Standard Logic: Revenue is Credit, Expense is Debit
                if (entry.account_code.startsWith('4')) {
                    accountBalances[entry.account_code].balance += (entry.credit - entry.debit);
                } else {
                    accountBalances[entry.account_code].balance += (entry.debit - entry.credit);
                }
            }
        });

        let totalRev = 0;
        let totalExp = 0;

        // Generate Closing Lines (To Zero Out)
        Object.entries(accountBalances).forEach(([code, data]) => {
            if (data.balance !== 0) {
                if (code.startsWith('4')) {
                    // Revenue normally Credit, so Debit to close
                    closingLines.push({ code, name: data.name, balance: data.balance, side: 'DEBIT' });
                    totalRev += data.balance;
                } else {
                    // Expense normally Debit, so Credit to close
                    closingLines.push({ code, name: data.name, balance: data.balance, side: 'CREDIT' });
                    totalExp += data.balance;
                }
            }
        });

        // CIT Calculation
        const profitBeforeTax = totalRev - totalExp;
        const citRate = 0.20; // SME rate approximation or standard 20%
        // Only calculate CIT if profit > 0
        const citAmount = profitBeforeTax > 0 ? profitBeforeTax * citRate : 0;
        const netProfitAfterTax = profitBeforeTax - citAmount;

        return { lines: closingLines, profitBeforeTax, citAmount, netProfitAfterTax };
    }, [glEntries]);


    const anomalies = [
        ...(reconciliation.vat.status === 'fail' ? [{ id: 'VAT01', severity: 'high', title: 'VAT Discrepancy', desc: `GL (${reconciliation.vat.gl.toLocaleString()}) vs Docs (${reconciliation.vat.doc.toLocaleString()}) mismatch.` }] : []),
        ...(reconciliation.asset.status === 'fail' ? [{ id: 'AST01', severity: 'medium', title: 'Asset Register Mismatch', desc: `GL Cost (${reconciliation.asset.gl.toLocaleString()}) != Register (${reconciliation.asset.reg.toLocaleString()})` }] : []),
        ...(reconciliation.pending > 0 ? [{ id: 'PEN01', severity: 'high', title: 'Pending Documents', desc: `มีเอกสารรอตรวจสอบ ${reconciliation.pending} รายการ` }] : []),
    ];

    const runScan = () => {
        setScanStatus('scanning');
        setTimeout(() => {
            setScanStatus('complete');
            // Calculate Score based on fails
            let score = 100;
            if (reconciliation.vat.status === 'fail') score -= 20;
            if (reconciliation.asset.status === 'fail') score -= 15;
            if (reconciliation.pending > 0) score -= 30;
            setAuditScore(Math.max(0, score));
        }, 1500);
    };

    const toggleCheck = (key: keyof typeof checklist) => {
        setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const allChecked = Object.values(checklist).every(Boolean) && auditScore >= 90;

    const handleConfirmClosing = () => {
        if (!onPostJournal) return;

        const closingDate = new Date().toISOString().split('T')[0];
        const generatedEntries: PostedGLEntry[] = [];
        
        // 1. Post Corporate Income Tax (CIT) Accrual
        if (closingPreview.citAmount > 0) {
             generatedEntries.push({
                id: `CIT-EXP-${Date.now()}`,
                clientId,
                date: closingDate,
                doc_no: 'JV-CIT-2024',
                description: 'ตั้งค้างจ่ายภาษีเงินได้นิติบุคคล (CIT Accrual)',
                account_code: '58000',
                account_name: 'ค่าใช้จ่ายภาษีเงินได้ (Corporate Income Tax)',
                debit: closingPreview.citAmount,
                credit: 0,
                system_generated: true
            });
            generatedEntries.push({
                id: `CIT-PAY-${Date.now()}`,
                clientId,
                date: closingDate,
                doc_no: 'JV-CIT-2024',
                description: 'ตั้งค้างจ่ายภาษีเงินได้นิติบุคคล (CIT Accrual)',
                account_code: '21600',
                account_name: 'ภาษีเงินได้นิติบุคคลค้างจ่าย (CIT Payable)',
                debit: 0,
                credit: closingPreview.citAmount,
                system_generated: true
            });
        }

        // 2. Close Revenue & Expense (Including the newly created CIT Expense)
        closingPreview.lines.forEach((line, idx) => {
            generatedEntries.push({
                id: `CLOSE-${line.code}-${Date.now()}-${idx}`,
                clientId,
                date: closingDate,
                doc_no: 'JV-CLOSE-2024',
                description: 'Closing Entry: Transfer to P&L',
                account_code: line.code,
                account_name: line.name,
                debit: line.side === 'DEBIT' ? line.balance : 0,
                credit: line.side === 'CREDIT' ? line.balance : 0,
                system_generated: true
            });
        });

        // Close CIT Expense manually since it wasn't in 'lines' yet
        if (closingPreview.citAmount > 0) {
             generatedEntries.push({
                id: `CLOSE-CIT-${Date.now()}`,
                clientId,
                date: closingDate,
                doc_no: 'JV-CLOSE-2024',
                description: 'Closing Entry: Transfer CIT to P&L',
                account_code: '58000',
                account_name: 'ค่าใช้จ่ายภาษีเงินได้ (Corporate Income Tax)',
                debit: 0,
                credit: closingPreview.citAmount,
                system_generated: true
            });
        }

        // 3. Post Net Profit (After Tax) to Retained Earnings
        if (closingPreview.netProfitAfterTax !== 0) {
            generatedEntries.push({
                id: `CLOSE-RE-${Date.now()}`,
                clientId,
                date: closingDate,
                doc_no: 'JV-CLOSE-2024',
                description: 'Closing Entry: Net Profit to Retained Earnings',
                account_code: '32000',
                account_name: 'กำไร(ขาดทุน)สะสม (Retained Earnings)',
                debit: closingPreview.netProfitAfterTax < 0 ? Math.abs(closingPreview.netProfitAfterTax) : 0, // Loss = Debit Equity
                credit: closingPreview.netProfitAfterTax > 0 ? closingPreview.netProfitAfterTax : 0, // Profit = Credit Equity
                system_generated: true
            });
        }

        onPostJournal(generatedEntries);
        onClosePeriod();
    };

    const handleDownloadPackage = () => {
        alert("Downloading Full Year-End Package (TB, GL, Notes, Tax Summary) as ZIP...");
    };

    if (isLocked) {
        return (
            <div className="h-full flex items-center justify-center animate-in fade-in">
                <div className="text-center p-12 bg-white rounded-2xl border border-slate-200 shadow-sm max-w-lg">
                    <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Lock size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">งวดบัญชีนี้ถูกปิดแล้ว (Period Locked)</h2>
                    <p className="text-slate-500 mb-6">ข้อมูลถูกบันทึกและป้องกันการแก้ไขเพื่อความถูกต้องทางบัญชี (Audit Trail Secured)</p>
                    <button onClick={handleDownloadPackage} className="px-6 py-3 bg-slate-800 text-white font-bold rounded-xl shadow-lg flex items-center gap-2 mx-auto hover:bg-slate-900 transition-all">
                        <Download size={18} /> ดาวน์โหลดงบการเงิน
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full animate-in fade-in duration-500">
            {/* Left: AI Auditor */}
            <div className="lg:col-span-2 space-y-6">
                
                {/* 1. Reconciliation Dashboard */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <ScanSearch className="text-indigo-600" />
                                AI Auditor Scan
                            </h3>
                            <p className="text-sm text-slate-500">ระบบตรวจสอบยันยอดบัญชี (Cross-Module Reconciliation)</p>
                        </div>
                        {scanStatus === 'complete' && (
                             <div className={`flex flex-col items-end`}>
                                 <span className={`text-3xl font-bold ${auditScore >= 90 ? 'text-emerald-600' : 'text-amber-500'}`}>{auditScore}%</span>
                                 <span className="text-xs font-bold text-slate-400 uppercase">Health Score</span>
                             </div>
                        )}
                    </div>

                    {scanStatus === 'idle' && (
                        <div className="text-center py-10 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                             <ShieldCheck size={48} className="mx-auto text-slate-300 mb-4" />
                             <p className="text-slate-500 mb-4">พร้อมเริ่มการตรวจสอบ: GL vs Tax vs Assets vs Bank</p>
                             <button 
                                onClick={runScan}
                                className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 mx-auto shadow-lg shadow-indigo-200"
                            >
                                <Play size={18} /> Start AI Scan
                            </button>
                        </div>
                    )}

                    {scanStatus === 'scanning' && (
                        <div className="py-12 flex flex-col items-center justify-center">
                            <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                            <p className="text-indigo-600 font-bold animate-pulse">AI กำลังวิเคราะห์ข้อมูล...</p>
                            <p className="text-xs text-slate-400 mt-2">Checking Compliance, VAT logic, and WHT rules</p>
                        </div>
                    )}

                    {scanStatus === 'complete' && (
                        <div className="space-y-6 animate-in slide-in-from-bottom-4">
                            
                            {/* Reconciliation Cards */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className={`p-4 rounded-xl border ${reconciliation.vat.status === 'pass' ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                                    <div className="flex items-center gap-2 mb-2 font-bold text-slate-700">
                                        <Scale size={16} /> VAT Reconciliation
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">GL (11540):</span>
                                        <span className="font-mono">{reconciliation.vat.gl.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Tax Reports:</span>
                                        <span className="font-mono">{reconciliation.vat.doc.toLocaleString()}</span>
                                    </div>
                                    <div className={`mt-2 pt-2 border-t ${reconciliation.vat.status === 'pass' ? 'border-emerald-200 text-emerald-700' : 'border-red-200 text-red-700'} text-xs font-bold flex justify-between`}>
                                        <span>Result: {reconciliation.vat.status === 'pass' ? 'Matched' : 'Variance'}</span>
                                        <span>Diff: {reconciliation.vat.diff.toLocaleString()}</span>
                                    </div>
                                </div>

                                <div className={`p-4 rounded-xl border ${reconciliation.asset.status === 'pass' ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                                    <div className="flex items-center gap-2 mb-2 font-bold text-slate-700">
                                        <Package size={16} /> Asset Reconciliation
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">GL (12xxx):</span>
                                        <span className="font-mono">{reconciliation.asset.gl.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Register:</span>
                                        <span className="font-mono">{reconciliation.asset.reg.toLocaleString()}</span>
                                    </div>
                                    <div className={`mt-2 pt-2 border-t ${reconciliation.asset.status === 'pass' ? 'border-emerald-200 text-emerald-700' : 'border-red-200 text-red-700'} text-xs font-bold flex justify-between`}>
                                        <span>Result: {reconciliation.asset.status === 'pass' ? 'Matched' : 'Variance'}</span>
                                        <span>Diff: {reconciliation.asset.diff.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Anomalies List */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                    <AlertTriangle size={16} className="text-amber-500" />
                                    ผลการตรวจสอบโดยละเอียด (Detailed Findings)
                                </div>
                                {anomalies.map((issue: any) => (
                                    <div key={issue.id} className="flex items-start gap-3 p-4 bg-white border border-slate-100 rounded-lg shadow-sm hover:border-indigo-200 transition-colors group">
                                        <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                                            issue.severity === 'high' ? 'bg-red-500' : issue.severity === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                                        }`}></div>
                                        <div className="flex-1">
                                            <h4 className="text-sm font-bold text-slate-800">{issue.title}</h4>
                                            <p className="text-xs text-slate-500 mt-0.5">{issue.desc}</p>
                                        </div>
                                        {issue.severity !== 'low' && <button className="text-xs font-bold text-blue-600 hover:underline">Fix This</button>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Closing Workflow */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-800 text-white rounded-t-xl">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <Lock size={18} className="text-blue-400"/> Period Closing
                    </h3>
                    <p className="text-blue-200 text-xs mt-1">ปิดงวดบัญชี ประจำปี 2024</p>
                </div>
                <div className="p-6 flex-1 overflow-auto">
                    
                    {/* Closing Preview Section */}
                    {scanStatus === 'complete' && (
                        <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <h4 className="text-xs font-bold text-slate-600 uppercase mb-3 flex items-center gap-2">
                                <Calculator size={14}/> Auto-Calculation & Closing
                            </h4>
                            <div className="space-y-2 text-xs font-medium">
                                <div className="flex justify-between text-slate-600">
                                    <span>กำไรก่อนภาษี (Profit Before Tax)</span>
                                    <span>{closingPreview.profitBeforeTax.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-red-600">
                                    <span className="flex items-center gap-1"><Coins size={10}/> หัก: ภาษีเงินได้ (CIT 20%)</span>
                                    <span>({closingPreview.citAmount.toLocaleString()})</span>
                                </div>
                                <div className="border-t border-slate-200 my-1 pt-1"></div>
                                <div className="flex justify-between font-bold text-emerald-700 text-sm">
                                    <span>กำไรสุทธิคงเหลือ (Net Profit)</span>
                                    <span>{closingPreview.netProfitAfterTax.toLocaleString()}</span>
                                </div>
                                <p className="text-[10px] text-slate-400 text-right mt-1">*Transfer to Retained Earnings</p>
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Checklist ก่อนปิดงบ</p>
                        
                        <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${checklist.docsReviewed ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${checklist.docsReviewed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'}`}>
                                {checklist.docsReviewed && <CheckCircle2 size={14} />}
                            </div>
                            <input type="checkbox" className="hidden" checked={checklist.docsReviewed} onChange={() => toggleCheck('docsReviewed')} />
                            <span className={`text-sm font-medium ${checklist.docsReviewed ? 'text-emerald-900' : 'text-slate-600'}`}>บันทึกเอกสารครบถ้วน</span>
                        </label>

                        <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${checklist.bankRecon ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                             <div className={`w-5 h-5 rounded border flex items-center justify-center ${checklist.bankRecon ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'}`}>
                                {checklist.bankRecon && <CheckCircle2 size={14} />}
                            </div>
                            <input type="checkbox" className="hidden" checked={checklist.bankRecon} onChange={() => toggleCheck('bankRecon')} />
                            <span className={`text-sm font-medium ${checklist.bankRecon ? 'text-emerald-900' : 'text-slate-600'}`}>กระทบยอดธนาคารแล้ว</span>
                        </label>

                         <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${checklist.vatFiled ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                             <div className={`w-5 h-5 rounded border flex items-center justify-center ${checklist.vatFiled ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'}`}>
                                {checklist.vatFiled && <CheckCircle2 size={14} />}
                            </div>
                            <input type="checkbox" className="hidden" checked={checklist.vatFiled} onChange={() => toggleCheck('vatFiled')} />
                            <span className={`text-sm font-medium ${checklist.vatFiled ? 'text-emerald-900' : 'text-slate-600'}`}>ปิดบัญชีภาษี (VAT) แล้ว</span>
                        </label>

                        <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${checklist.assetsDepre ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                             <div className={`w-5 h-5 rounded border flex items-center justify-center ${checklist.assetsDepre ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'}`}>
                                {checklist.assetsDepre && <CheckCircle2 size={14} />}
                            </div>
                            <input type="checkbox" className="hidden" checked={checklist.assetsDepre} onChange={() => toggleCheck('assetsDepre')} />
                            <span className={`text-sm font-medium ${checklist.assetsDepre ? 'text-emerald-900' : 'text-slate-600'}`}>บันทึกค่าเสื่อมราคาแล้ว</span>
                        </label>

                        <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${checklist.citCalculated ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                             <div className={`w-5 h-5 rounded border flex items-center justify-center ${checklist.citCalculated ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'}`}>
                                {checklist.citCalculated && <CheckCircle2 size={14} />}
                            </div>
                            <input type="checkbox" className="hidden" checked={checklist.citCalculated} onChange={() => toggleCheck('citCalculated')} />
                            <span className={`text-sm font-medium ${checklist.citCalculated ? 'text-emerald-900' : 'text-slate-600'}`}>ตรวจสอบภาษีเงินได้นิติบุคคล (CIT)</span>
                        </label>
                    </div>
                </div>
                <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl">
                    <button 
                        onClick={handleConfirmClosing}
                        disabled={!allChecked}
                        className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all ${
                            allChecked 
                            ? 'bg-slate-800 text-white hover:bg-slate-900 shadow-slate-200' 
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                    >
                        <Lock size={18} /> Confirm & Lock Period
                    </button>
                    {!allChecked && (
                        <p className="text-xs text-center text-red-500 mt-2 flex items-center justify-center gap-1">
                            {auditScore < 90 ? <AlertTriangle size={12}/> : <AlertCircle size={12}/>} 
                            {auditScore < 90 ? 'คะแนน Audit ต่ำกว่าเกณฑ์' : 'กรุณาดำเนินการให้ครบทุกขั้นตอน'}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuditClosing;
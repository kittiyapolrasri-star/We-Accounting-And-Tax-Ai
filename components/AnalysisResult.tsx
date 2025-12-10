import React, { useState, useEffect, useMemo } from 'react';
import { AccountingResponse, Staff, DocumentRecord } from '../types';
import FinancialSummary from './FinancialSummary';
import JournalEntryEditor from './JournalEntryEditor';
import WHTPreview from './WHTPreview';
import { AlertTriangle, CheckCircle, FileText, Building2, Calendar, FolderOpen, Save, XCircle, Settings2, FileCheck, ArrowLeft, RefreshCw, CalendarDays, AlertOctagon, Info, ShieldCheck, BrainCircuit } from 'lucide-react';

interface Props {
  data: AccountingResponse;
  staffList: Staff[];
  existingDocuments?: DocumentRecord[]; // New prop for duplicate checking
  onSave: (data: AccountingResponse, assignedStaffId: string | null) => void;
  onCancel: () => void;
  onAddRule?: (vendorName: string, accountCode: string, accountName: string) => void; // New prop for learning
}

const AnalysisResult: React.FC<Props> = ({ data: initialData, staffList, existingDocuments = [], onSave, onCancel, onAddRule }) => {
  const [data, setData] = useState<AccountingResponse>(initialData);
  const [activeTab, setActiveTab] = useState<'journal' | 'wht' | 'json'>('journal');
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  
  // VAT Period State (Default to issue date month/year)
  const initialDate = new Date(initialData.header_data.issue_date);
  const [vatMonth, setVatMonth] = useState((initialDate.getMonth() + 1).toString().padStart(2, '0'));
  const [vatYear, setVatYear] = useState(initialDate.getFullYear().toString());

  // --- AUTOMATED AUDIT ENGINE ---
  const auditResults = useMemo(() => {
      const risks = [];
      
      // 1. Duplicate Check
      const isDuplicate = existingDocuments.some(d => 
          d.id !== 'TEMP_CURRENT' && // Ignore self if temporary ID matches
          d.ai_data?.header_data.inv_number === data.header_data.inv_number &&
          d.client_name === data.parties.client_company.name
      );
      if (isDuplicate) {
          risks.push({ type: 'critical', msg: `พบเลขที่เอกสารซ้ำ (${data.header_data.inv_number}) ในระบบแล้ว` });
      }

      // 2. VAT Logic Validation
      if (data.tax_compliance.is_full_tax_invoice) {
          const calculatedVat = data.financials.subtotal * 0.07;
          const diff = Math.abs(calculatedVat - data.financials.vat_amount);
          if (diff > 1.00) {
              risks.push({ type: 'warning', msg: `ยอด VAT ไม่สัมพันธ์กับฐานภาษี (Diff: ${diff.toFixed(2)})` });
          }
      }

      // 3. WHT Logic Check
      if (!data.tax_compliance.wht_flag && data.financials.subtotal >= 1000) {
          // Heuristic check for service keywords
          const desc = data.accounting_entry.transaction_description.toLowerCase();
          if (desc.includes('service') || desc.includes('ค่าบริการ') || desc.includes('hire') || desc.includes('จ้าง') || desc.includes('repair')) {
              risks.push({ type: 'info', msg: 'ยอดเกิน 1,000 บาท และเป็นค่าบริการ ควรพิจารณาหัก ณ ที่จ่าย (WHT)' });
          }
      }

      // 4. Non-Deductible VAT Check
      if (data.tax_compliance.vat_claimable === false && data.financials.vat_amount > 0) {
           risks.push({ type: 'info', msg: 'VAT รายการนี้เป็นภาษีซื้อต้องห้าม (Non-Deductible) ระบบบันทึกเข้าต้นทุนแล้ว' });
      }

      return risks;
  }, [data, existingDocuments]);

  // --- INTELLIGENT SYNC ENGINE ---

  // 1. When Journal Changes
  const handleEntryChange = (updatedEntry: any) => {
    setData(prev => ({ ...prev, accounting_entry: updatedEntry }));
  };

  // 2. When WHT Form Changes -> Update GL Line 21400 (WHT Payable)
  const handleWHTChange = (updatedData: AccountingResponse) => {
      const newWhtRate = updatedData.tax_compliance.wht_rate || 3;
      const taxable = updatedData.financials.subtotal;
      const whtAmt = (taxable * newWhtRate) / 100;
      
      const newEntry = { ...updatedData.accounting_entry };
      
      // Find WHT Payable line
      const whtLineIndex = newEntry.journal_lines.findIndex(l => l.account_code === '21400');
      
      if (updatedData.tax_compliance.wht_flag) {
          if (whtLineIndex >= 0) {
              // Update existing
              newEntry.journal_lines[whtLineIndex].amount = whtAmt;
              newEntry.journal_lines[whtLineIndex].account_side = 'CREDIT';
          } else {
              // Create new line
              newEntry.journal_lines.push({
                  account_code: '21400',
                  account_name_th: 'ภาษีหัก ณ ที่จ่ายรอนำส่ง (WHT Payable)',
                  account_side: 'CREDIT',
                  amount: whtAmt
              });
          }
      } else {
          // If flag turned off, remove line
          if (whtLineIndex >= 0) {
             newEntry.journal_lines.splice(whtLineIndex, 1);
          }
      }

      // Update State
      setData({
          ...updatedData,
          financials: { ...updatedData.financials, wht_amount: whtAmt },
          accounting_entry: newEntry
      });
  };

  // 3. VAT Period Logic
  useEffect(() => {
      setData(prev => ({
          ...prev,
          header_data: {
              ...prev.header_data,
              vat_period: { month: vatMonth, year: vatYear }
          }
      }));
  }, [vatMonth, vatYear]);

  // 4. Learning Handler
  const handleLearnRule = () => {
      if (onAddRule && data.parties.counterparty.name && data.accounting_entry.journal_lines.length > 0) {
          // Simplification: Assume the first DEBIT line is the main expense
          const mainExpense = data.accounting_entry.journal_lines.find(l => l.account_side === 'DEBIT' && !['11540'].includes(l.account_code));
          if (mainExpense) {
              onAddRule(data.parties.counterparty.name, mainExpense.account_code, mainExpense.account_name_th);
          }
      }
  };


  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      {/* Header Actions */}
      <div className="flex justify-between items-center mb-8 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-4">
             <button onClick={onCancel} className="p-2 hover:bg-slate-50 rounded-full text-slate-400 hover:text-slate-700 transition-colors">
                 <ArrowLeft size={20} />
             </button>
             <div>
                <h2 className="text-xl font-bold text-slate-800">ตรวจสอบรายการ (Review)</h2>
                <p className="text-slate-500 text-xs">เอกสารเลขที่ {data.header_data.inv_number} • {data.parties.counterparty.name}</p>
             </div>
        </div>
        <div className="flex items-center gap-3">
            <select 
                className="bg-slate-50 border-none text-slate-700 text-sm rounded-lg focus:ring-2 focus:ring-blue-100 block p-2.5 min-w-[200px]"
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
            >
                <option value="">มอบหมายงานให้ (Assign to)...</option>
                {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                ))}
            </select>
            <button 
                onClick={() => onSave(data, selectedStaff || null)}
                disabled={auditResults.some(r => r.type === 'critical')}
                className={`px-6 py-2.5 text-white font-semibold rounded-xl shadow-md transition-all flex items-center gap-2 transform hover:-translate-y-0.5 ${
                    auditResults.some(r => r.type === 'critical') 
                    ? 'bg-slate-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                }`}
            >
                <Save size={18} />
                บันทึกบัญชี (Post)
            </button>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <FinancialSummary financials={data.financials} compliance={data.tax_compliance} />

      {/* Main Workbench Area */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* Left Column: Context & Metadata */}
          <div className="xl:col-span-1 space-y-6">
              
              {/* Audit Findings Panel */}
              {auditResults.length > 0 ? (
                  <div className="bg-white p-5 rounded-2xl border border-red-100 shadow-sm ring-4 ring-red-50/50">
                      <h3 className="font-bold text-red-700 flex items-center gap-2 mb-3">
                          <AlertOctagon size={18} /> ผลการตรวจสอบ (AI Audit)
                      </h3>
                      <div className="space-y-3">
                          {auditResults.map((r, i) => (
                              <div key={i} className={`p-3 rounded-lg text-xs font-medium flex items-start gap-2 ${
                                  r.type === 'critical' ? 'bg-red-50 text-red-700' :
                                  r.type === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                              }`}>
                                  {r.type === 'critical' ? <XCircle size={14} className="mt-0.5 shrink-0"/> : <Info size={14} className="mt-0.5 shrink-0"/>}
                                  {r.msg}
                              </div>
                          ))}
                      </div>
                  </div>
              ) : (
                  <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm flex items-center gap-3">
                      <div className="p-2 bg-emerald-100 text-emerald-600 rounded-full">
                          <ShieldCheck size={24} />
                      </div>
                      <div>
                          <h3 className="font-bold text-emerald-700">Audit Passed</h3>
                          <p className="text-xs text-emerald-600">ไม่พบข้อผิดพลาดตามเงื่อนไขที่กำหนด</p>
                      </div>
                  </div>
              )}

               {/* Advanced VAT Period Setting */}
               <div className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm">
                    <h3 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                         <CalendarDays size={12} /> งวดภาษีมูลค่าเพิ่ม (VAT Period)
                    </h3>
                    <div className="flex gap-2 items-center bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                        <div className="flex-1">
                             <label className="text-[10px] font-bold text-slate-400 block mb-1">เดือน (Month)</label>
                             <select 
                                value={vatMonth}
                                onChange={(e) => setVatMonth(e.target.value)}
                                className="w-full bg-white border border-slate-200 text-slate-700 text-sm rounded p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                             >
                                 {Array.from({length: 12}, (_, i) => (i + 1).toString().padStart(2, '0')).map(m => (
                                     <option key={m} value={m}>{m}</option>
                                 ))}
                             </select>
                        </div>
                        <div className="flex-1">
                             <label className="text-[10px] font-bold text-slate-400 block mb-1">ปี (Year)</label>
                             <input 
                                type="text" 
                                value={vatYear}
                                onChange={(e) => setVatYear(e.target.value)}
                                className="w-full bg-white border border-slate-200 text-slate-700 text-sm rounded p-1.5 focus:ring-1 focus:ring-blue-500 outline-none text-center font-mono"
                             />
                        </div>
                    </div>
               </div>

               {/* Parties & Document Meta */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)]">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <FileText size={12} /> ข้อมูลเอกสาร
                </h3>
                <div className="space-y-4">
                    <div>
                        <p className="text-xs text-slate-400 mb-1">คู่ค้า (Counterparty)</p>
                        <p className="font-bold text-slate-800">{data.parties.counterparty.name || "ระบุไม่ได้"}</p>
                        <p className="text-xs text-slate-500 mt-1">{data.parties.counterparty.tax_id} ({data.parties.counterparty.branch || "HQ"})</p>
                    </div>
                    <div className="border-t border-slate-50 pt-3 flex justify-between">
                        <div>
                            <p className="text-xs text-slate-400">เลขที่</p>
                            <p className="font-mono text-sm font-semibold text-slate-700">{data.header_data.inv_number}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-slate-400">วันที่</p>
                            <p className="font-mono text-sm font-semibold text-slate-700">{data.header_data.issue_date}</p>
                        </div>
                    </div>
                </div>
              </div>
          </div>

          {/* Right Column: Editor & Tools */}
          <div className="xl:col-span-2">
              {/* Tab Navigation */}
              <div className="flex justify-between mb-4">
                  <div className="flex gap-1">
                    <button 
                        onClick={() => setActiveTab('journal')}
                        className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${activeTab === 'journal' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-100'}`}
                    >
                        Journal Entry
                    </button>
                    <button 
                        onClick={() => setActiveTab('wht')}
                        className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'wht' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-100'}`}
                    >
                        WHT Editor (50 ทวิ)
                        {data.tax_compliance.wht_flag && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                    </button>
                    <button 
                        onClick={() => setActiveTab('json')}
                        className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${activeTab === 'json' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-100'}`}
                    >
                        JSON
                    </button>
                  </div>
                  
                  {/* Smart Learning Button */}
                  {onAddRule && (
                      <button 
                        onClick={handleLearnRule}
                        className="px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors flex items-center gap-2"
                        title="AI will remember this Vendor -> GL mapping for next time"
                      >
                          <BrainCircuit size={16} /> จำการลงบัญชีนี้ (Learn Rule)
                      </button>
                  )}
              </div>

              {/* Tab Content */}
              <div className="h-[calc(100%-60px)]">
                  {activeTab === 'journal' && (
                      <div className="h-full flex flex-col">
                        <div className="bg-blue-50 p-3 rounded-lg mb-4 text-xs text-blue-700 flex items-center gap-2 border border-blue-100">
                            <RefreshCw size={14} className="animate-spin-slow" />
                            <span>
                                Auto-Sync Active: หากแก้ไข 50 ทวิ ระบบจะอัปเดต Journal ให้เอง
                            </span>
                        </div>
                        <JournalEntryEditor entry={data.accounting_entry} onChange={handleEntryChange} />
                      </div>
                  )}
                  
                  {activeTab === 'wht' && (
                      <WHTPreview data={data} onChange={handleWHTChange} />
                  )}

                  {activeTab === 'json' && (
                    <div className="bg-slate-900 rounded-2xl p-6 overflow-auto shadow-inner h-full border border-slate-800 max-h-[600px]">
                        <pre className="text-xs text-emerald-400 font-mono leading-relaxed">
                            {JSON.stringify(data, null, 2)}
                        </pre>
                    </div>
                  )}
              </div>
          </div>
      </div>
    </div>
  );
};

export default AnalysisResult;
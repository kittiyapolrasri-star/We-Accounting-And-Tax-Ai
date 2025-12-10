
import React, { useState, useEffect } from 'react';
import { DocumentRecord, BankTransaction, PostedGLEntry, Client } from '../types';
import { CheckCircle2, AlertTriangle, ArrowRightLeft, Upload, Search, Link2, X, PlusCircle, Calculator, Loader2, Building2 } from 'lucide-react';
import { databaseService } from '../services/database';

interface Props {
  documents: DocumentRecord[];
  clients: Client[]; // Added to support client switching
  onPostAdjustment?: (entries: PostedGLEntry[]) => void;
}

const BankReconciliation: React.FC<Props> = ({ documents, clients, onPostAdjustment }) => {
  const [selectedClientId, setSelectedClientId] = useState<string>(clients[0]?.id || '');
  const [bankTxns, setBankTxns] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTxn, setSelectedTxn] = useState<BankTransaction | null>(null);
  const [adjustment, setAdjustment] = useState<{ diff: number, type: 'fee' | 'interest' | 'other', docId: string | null } | null>(null);

  // Load Real Data from Firestore specific to the selected client
  useEffect(() => {
      const loadTxns = async () => {
          if(!selectedClientId) return;
          setLoading(true);
          try {
            const data = await databaseService.getBankTransactionsByClient(selectedClientId);
            setBankTxns(data);
          } catch (e) {
              console.error(e);
          } finally {
              setLoading(false);
          }
      };
      loadTxns();
  }, [selectedClientId]);

  // Find current client object
  const currentClient = clients.find(c => c.id === selectedClientId);

  // Strict Filter: Only allow matching with documents belonging to the currently selected client
  const bookDocs = documents.filter(d => 
      d.status === 'approved' && 
      d.client_name === currentClient?.name
  );

  const getMatchScore = (txn: BankTransaction, doc: DocumentRecord) => {
    let score = 0;
    // Amount Match (Exact)
    if (Math.abs(Math.abs(txn.amount) - doc.amount) < 0.01) score += 50;
    // Amount Match (With Fee Tolerance e.g. < 50 THB difference)
    else if (Math.abs(Math.abs(txn.amount) - doc.amount) <= 50) score += 40;
    
    // Date proximity (within 3 days)
    const txnDate = new Date(txn.date).getTime();
    const docDate = new Date(doc.ai_data?.header_data.issue_date || '').getTime();
    const diffDays = Math.abs(txnDate - docDate) / (1000 * 3600 * 24);
    if (diffDays <= 3) score += 30;

    // Name similarity (Very basic fuzzy check)
    if (txn.description.toLowerCase().includes(doc.client_name.toLowerCase().split(' ')[0])) score += 20;
    
    return score;
  };

  const getSuggestedMatch = (txn: BankTransaction) => {
    return bookDocs
        .map(doc => ({ doc, score: getMatchScore(txn, doc) }))
        .filter(match => match.score > 30) // Threshold
        .sort((a, b) => b.score - a.score)[0]?.doc;
  };

  const initiateMatch = (txn: BankTransaction, docId: string) => {
      const doc = bookDocs.find(d => d.id === docId);
      if (!doc) return;

      const absDiff = Math.abs(Math.abs(txn.amount) - doc.amount);

      if (absDiff > 0.01) {
          // Trigger Adjustment Modal
          setAdjustment({
              diff: absDiff,
              type: 'fee', // Default assumption
              docId: docId
          });
      } else {
          confirmMatch(txn, docId);
      }
  };

  const confirmMatch = async (txn: BankTransaction, docId: string | null) => {
      const updatedTxn: BankTransaction = {
          ...txn,
          status: 'matched',
          matched_doc_id: docId || undefined
      };
      
      // Update UI immediately
      setBankTxns(prev => prev.map(t => t.id === txn.id ? updatedTxn : t));
      
      // Persist to DB
      await databaseService.updateBankTransaction(updatedTxn);

      setSelectedTxn(null);
      setAdjustment(null);
  };

  const handlePostAndMatch = () => {
      if (!selectedTxn || !adjustment || !onPostAdjustment) return;

      const accountCode = adjustment.type === 'fee' ? '52510' : '42100'; // Bank Fee or Interest
      const accountName = adjustment.type === 'fee' ? 'ค่าธรรมเนียมธนาคาร (Bank Charges)' : 'ดอกเบี้ยรับ (Interest Income)';
      
      const newEntry: PostedGLEntry = {
          id: `ADJ-${Date.now()}`,
          clientId: selectedClientId,
          date: selectedTxn.date,
          doc_no: `BANK-ADJ-${selectedTxn.id}`,
          description: `Adjustment: ${selectedTxn.description}`,
          account_code: accountCode,
          account_name: accountName,
          debit: adjustment.type === 'fee' ? adjustment.diff : 0,
          credit: adjustment.type === 'fee' ? 0 : adjustment.diff, // Revenue is Credit
          system_generated: true
      };

      // Balancing side (Bank)
      const balancingEntry: PostedGLEntry = {
          id: `ADJ-BANK-${Date.now()}`,
          clientId: selectedClientId,
          date: selectedTxn.date,
          doc_no: `BANK-ADJ-${selectedTxn.id}`,
          description: `Adjustment: ${selectedTxn.description}`,
          account_code: '11120',
          account_name: 'เงินฝากธนาคาร (Bank Deposit)',
          debit: adjustment.type === 'fee' ? 0 : adjustment.diff,
          credit: adjustment.type === 'fee' ? adjustment.diff : 0,
          system_generated: true
      };

      onPostAdjustment([newEntry, balancingEntry]);
      confirmMatch(selectedTxn, adjustment.docId);
  };

  const handleCreateEntry = (txn: BankTransaction) => {
      // Direct booking for things like Interest
      if (!onPostAdjustment) return;
      
      const isInterest = txn.description.includes('INTEREST') && txn.amount > 0;
      
      const newEntry: PostedGLEntry = {
          id: `DIRECT-${Date.now()}`,
          clientId: selectedClientId,
          date: txn.date,
          doc_no: `BANK-DIRECT-${txn.id}`,
          description: txn.description,
          account_code: isInterest ? '42100' : '52990',
          account_name: isInterest ? 'ดอกเบี้ยรับ (Interest Income)' : 'ค่าใช้จ่ายเบ็ดเตล็ด (Misc Expense)',
          debit: txn.amount < 0 ? Math.abs(txn.amount) : 0,
          credit: txn.amount > 0 ? txn.amount : 0,
          system_generated: true
      };

      const bankEntry: PostedGLEntry = {
          id: `DIRECT-BANK-${Date.now()}`,
          clientId: selectedClientId,
          date: txn.date,
          doc_no: `BANK-DIRECT-${txn.id}`,
          description: txn.description,
          account_code: '11120',
          account_name: 'เงินฝากธนาคาร (Bank Deposit)',
          debit: txn.amount > 0 ? txn.amount : 0,
          credit: txn.amount < 0 ? Math.abs(txn.amount) : 0,
          system_generated: true
      };

      onPostAdjustment([newEntry, bankEntry]);
      
      // Update DB Status
      confirmMatch(txn, null);
  };

  return (
    <div className="animate-in fade-in duration-500 h-full flex flex-col relative">
      
      {/* Adjustment Modal */}
      {adjustment && selectedTxn && (
          <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                  <div className="p-5 bg-amber-50 border-b border-amber-100 flex justify-between items-center">
                      <h3 className="font-bold text-amber-800 flex items-center gap-2">
                          <AlertTriangle size={20} /> ยอดเงินไม่ตรงกัน (Discrepancy)
                      </h3>
                      <button onClick={() => setAdjustment(null)} className="text-amber-700 hover:bg-amber-100 rounded-full p-1"><X size={18}/></button>
                  </div>
                  <div className="p-6">
                      <div className="flex justify-between items-center mb-6">
                          <div className="text-center">
                              <p className="text-xs text-slate-500 uppercase">Bank Amount</p>
                              <p className="font-mono font-bold text-lg text-slate-800">{Math.abs(selectedTxn.amount).toLocaleString()}</p>
                          </div>
                          <div className="text-slate-300"><ArrowRightLeft /></div>
                          <div className="text-center">
                              <p className="text-xs text-slate-500 uppercase">Book Amount</p>
                              <p className="font-mono font-bold text-lg text-slate-800">
                                  {adjustment.docId ? bookDocs.find(d => d.id === adjustment.docId)?.amount.toLocaleString() : '0.00'}
                              </p>
                          </div>
                      </div>
                      
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
                          <div className="flex justify-between items-center">
                              <span className="font-bold text-slate-700">ผลต่าง (Difference)</span>
                              <span className="font-mono font-bold text-red-600 text-xl">{adjustment.diff.toLocaleString()} <span className="text-sm">THB</span></span>
                          </div>
                      </div>

                      <p className="text-sm text-slate-600 mb-2 font-medium">ต้องการบันทึกผลต่างเป็น:</p>
                      <div className="space-y-2">
                          <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
                              <input type="radio" name="adjType" checked={adjustment.type === 'fee'} onChange={() => setAdjustment({...adjustment, type: 'fee'})} className="text-blue-600 focus:ring-blue-500" />
                              <div className="flex-1">
                                  <span className="block font-bold text-sm text-slate-800">ค่าธรรมเนียมธนาคาร (Bank Fee)</span>
                                  <span className="block text-xs text-slate-500">บันทึกเข้าบัญชี 52510 - Bank Charges</span>
                              </div>
                          </label>
                          <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
                              <input type="radio" name="adjType" checked={adjustment.type === 'interest'} onChange={() => setAdjustment({...adjustment, type: 'interest'})} className="text-blue-600 focus:ring-blue-500" />
                              <div className="flex-1">
                                  <span className="block font-bold text-sm text-slate-800">รายได้ดอกเบี้ย (Interest Income)</span>
                                  <span className="block text-xs text-slate-500">บันทึกเข้าบัญชี 42100 - Other Income</span>
                              </div>
                          </label>
                      </div>

                      <button onClick={handlePostAndMatch} className="w-full mt-6 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                          <Calculator size={18} /> Auto-Book Adjustment & Match
                      </button>
                  </div>
              </div>
          </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">ระบบกระทบยอดธนาคาร (Bank Reconciliation)</h2>
          <p className="text-slate-500">จัดการจับคู่รายการและบันทึกผลต่างอัตโนมัติ (Smart Adjustment)</p>
        </div>
        <div className="flex items-center gap-3">
            <div className="relative">
                <Building2 className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <select 
                    value={selectedClientId} 
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-100 outline-none min-w-[200px]"
                >
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>
            <button className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 flex items-center gap-2 shadow-sm">
                <Upload size={16} /> นำเข้า Statement
            </button>
        </div>
      </div>

      {loading ? (
          <div className="h-full flex items-center justify-center">
              <Loader2 className="animate-spin text-blue-600" size={32}/>
          </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-200px)]">
         {/* LEFT: Bank Statement (The Truth) */}
         <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
             <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                 <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    รายการเดินบัญชี (KBANK - 8889)
                 </h3>
                 <span className="text-xs text-slate-500">{bankTxns.length} รายการ</span>
             </div>
             <div className="overflow-y-auto flex-1 p-0">
                 {bankTxns.length === 0 ? (
                     <div className="p-8 text-center text-slate-400 text-sm">ไม่พบรายการเดินบัญชีสำหรับลูกค้า {currentClient?.name}</div>
                 ) : bankTxns.map(txn => {
                     const isSelected = selectedTxn?.id === txn.id;
                     const suggestion = getSuggestedMatch(txn);
                     
                     return (
                         <div 
                            key={txn.id} 
                            onClick={() => txn.status === 'unmatched' && setSelectedTxn(txn)}
                            className={`p-4 border-b border-slate-100 transition-all cursor-pointer hover:bg-slate-50 
                                ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'}
                                ${txn.status === 'matched' ? 'bg-emerald-50/30 opacity-70' : ''}
                            `}
                         >
                             <div className="flex justify-between items-start mb-1">
                                 <span className="text-xs text-slate-400 font-mono">{txn.date}</span>
                                 <span className={`font-mono font-bold ${txn.amount > 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                                     {txn.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                                 </span>
                             </div>
                             <div className="flex justify-between items-center">
                                 <p className="text-sm text-slate-700 font-medium">{txn.description}</p>
                                 {txn.status === 'unmatched' && !suggestion && (
                                     <button 
                                        onClick={(e) => { e.stopPropagation(); handleCreateEntry(txn); }}
                                        className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded hover:bg-indigo-100 hover:text-indigo-600 font-bold flex items-center gap-1"
                                     >
                                         <PlusCircle size={10} /> Book
                                     </button>
                                 )}
                             </div>
                             
                             {txn.status === 'matched' && (
                                 <div className="mt-2 text-xs text-emerald-600 flex items-center gap-1 font-semibold">
                                     <Link2 size={12} /> จับคู่แล้ว
                                 </div>
                             )}

                             {/* AI Suggestion Badge */}
                             {txn.status === 'unmatched' && suggestion && (
                                 <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] rounded-full">
                                     <ArrowRightLeft size={10} /> AI แนะนำรายการนี้ (Score: {getMatchScore(txn, suggestion)})
                                 </div>
                             )}
                         </div>
                     );
                 })}
             </div>
         </div>

         {/* RIGHT: Accounting Book / Matching Area */}
         <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden relative">
             <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                 <h3 className="font-bold text-slate-700">รายการบันทึกบัญชี (Book)</h3>
                 <div className="relative">
                    <Search className="absolute left-2 top-1.5 text-slate-400" size={14}/>
                    <input type="text" placeholder="ค้นหาเอกสาร..." className="pl-8 py-1 text-xs border border-slate-300 rounded-md focus:outline-none"/>
                 </div>
             </div>

             {/* If a transaction is selected, show matching interface */}
             {selectedTxn ? (
                <div className="flex-1 flex flex-col bg-slate-50/50">
                    <div className="p-4 bg-blue-600 text-white shadow-md z-10">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-blue-100 text-xs uppercase tracking-wide">กำลังจับคู่รายการ (Matching)</p>
                                <p className="font-bold text-lg">{selectedTxn.description}</p>
                                <p className="font-mono text-xl mt-1">{selectedTxn.amount.toLocaleString('th-TH')} THB</p>
                            </div>
                            <button onClick={() => setSelectedTxn(null)} className="text-blue-200 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                         <p className="text-xs text-slate-500 font-bold uppercase tracking-wide mb-2">AI แนะนำรายการที่ตรงกัน (Matches)</p>
                         
                         {(() => {
                            const suggestion = getSuggestedMatch(selectedTxn);
                            return suggestion ? (
                                <div className="bg-white p-4 rounded-xl border-2 border-indigo-200 shadow-sm hover:border-indigo-400 cursor-pointer transition-all"
                                     onClick={() => initiateMatch(selectedTxn, suggestion.id)}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold">Recommended</span>
                                            <span className="text-xs text-slate-400">{suggestion.ai_data?.header_data.issue_date}</span>
                                        </div>
                                        <span className="font-bold font-mono text-slate-800">{suggestion.amount.toLocaleString('th-TH', {minimumFractionDigits:2})}</span>
                                    </div>
                                    <p className="font-medium text-slate-800">{suggestion.client_name}</p>
                                    <p className="text-xs text-slate-500">{suggestion.filename}</p>
                                    {Math.abs(Math.abs(selectedTxn.amount) - suggestion.amount) > 0.01 && (
                                        <div className="mt-2 text-xs text-amber-600 font-bold flex items-center gap-1">
                                            <AlertTriangle size={12}/> มียอดผลต่าง (Diff): {Math.abs(Math.abs(selectedTxn.amount) - suggestion.amount).toLocaleString()}
                                        </div>
                                    )}
                                    <button className="w-full mt-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700">
                                        จับคู่รายการ (Match)
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-slate-400 text-sm">ไม่พบรายการที่ตรงกันด้วยความเชื่อมั่นสูง</div>
                            );
                         })()}

                         <div className="border-t border-slate-200 my-4"></div>
                         <p className="text-xs text-slate-500 font-bold uppercase tracking-wide mb-2">เอกสารทั้งหมดที่ยังไม่ได้กระทบยอด ({bookDocs.length})</p>
                         
                         {bookDocs.length === 0 ? (
                             <div className="text-center py-4 text-xs text-slate-400">ไม่มีเอกสารที่ได้รับการอนุมัติสำหรับลูกค้า {currentClient?.name}</div>
                         ) : bookDocs.map(doc => {
                             const diff = Math.abs(Math.abs(selectedTxn.amount) - doc.amount);
                             return (
                             <div key={doc.id} onClick={() => initiateMatch(selectedTxn, doc.id)} className="bg-white p-3 rounded-lg border border-slate-200 hover:border-blue-400 cursor-pointer mb-2">
                                 <div className="flex justify-between">
                                     <span className="font-medium text-sm text-slate-700">{doc.client_name}</span>
                                     <span className="font-mono text-sm font-bold">{doc.amount.toLocaleString()}</span>
                                 </div>
                                 <div className="flex justify-between mt-1 text-xs text-slate-500">
                                     <span>{doc.ai_data?.header_data.inv_number}</span>
                                     {diff > 0.01 && <span className="text-amber-600 font-bold">Diff: {diff.toLocaleString()}</span>}
                                 </div>
                             </div>
                         )})}
                    </div>
                </div>
             ) : (
                 <div className="flex-1 flex items-center justify-center text-slate-400 flex-col gap-3">
                     <ArrowRightLeft size={40} className="opacity-20" />
                     <p>เลือกรายการเดินบัญชีด้านซ้ายเพื่อเริ่มจับคู่</p>
                 </div>
             )}
         </div>
      </div>
      )}
    </div>
  );
};

export default BankReconciliation;

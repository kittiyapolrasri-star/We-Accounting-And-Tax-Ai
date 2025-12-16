import React, { useState, useEffect, useRef } from 'react';
import { DocumentRecord, BankTransaction, PostedGLEntry, Client } from '../types';
import {
  CheckCircle2, AlertTriangle, ArrowRightLeft, Upload, Search, Link2, X, PlusCircle,
  Calculator, Loader2, Building2, Zap, FileText, TrendingUp, BarChart3, Settings,
  Download, RefreshCw, Eye, Check, XCircle, ChevronDown, Sparkles
} from 'lucide-react';
import { databaseService } from '../services/database';
import {
  autoMatchTransactions, generateReconciliationSummary, MatchResult,
  AutoMatchConfig, DEFAULT_AUTO_MATCH_CONFIG, calculateMatchScore,
  parseBankStatementCSV, detectBankFormat
} from '../services/bankReconciliation';

interface Props {
  documents: DocumentRecord[];
  clients: Client[];
  onPostAdjustment?: (entries: PostedGLEntry[]) => void;
}

const BankReconciliation: React.FC<Props> = ({ documents, clients, onPostAdjustment }) => {
  const [selectedClientId, setSelectedClientId] = useState<string>(clients[0]?.id || '');
  const [bankTxns, setBankTxns] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(false); // Start as false, not true
  const [selectedTxn, setSelectedTxn] = useState<BankTransaction | null>(null);
  const [adjustment, setAdjustment] = useState<{ diff: number, type: 'fee' | 'interest' | 'other', docId: string | null } | null>(null);
  const [activeTab, setActiveTab] = useState<'reconcile' | 'auto-match' | 'summary' | 'import'>('reconcile');
  const [autoMatchConfig, setAutoMatchConfig] = useState<AutoMatchConfig>(DEFAULT_AUTO_MATCH_CONFIG);
  const [autoMatchResults, setAutoMatchResults] = useState<MatchResult[]>([]);
  const [isAutoMatching, setIsAutoMatching] = useState(false);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Real Data from Firestore specific to the selected client
  useEffect(() => {
    const loadTxns = async () => {
      // Skip loading if no client selected
      if (!selectedClientId) {
        setLoading(false);
        setBankTxns([]);
        return;
      }

      setLoading(true);
      setLoadError(null);

      try {
        const data = await databaseService.getBankTransactionsByClient(selectedClientId);
        setBankTxns(data || []);
      } catch (e) {
        console.error('Failed to load bank transactions:', e);
        setLoadError('ไม่สามารถโหลดข้อมูลธนาคารได้');
        setBankTxns([]);
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

  // Calculate summary
  const summary = generateReconciliationSummary(bankTxns, bookDocs, autoMatchResults);

  const getMatchScore = (txn: BankTransaction, doc: DocumentRecord) => {
    const result = calculateMatchScore(txn, doc);
    return result.score;
  };

  const getSuggestedMatch = (txn: BankTransaction) => {
    return bookDocs
      .map(doc => ({ doc, score: getMatchScore(txn, doc) }))
      .filter(match => match.score > 30)
      .sort((a, b) => b.score - a.score)[0]?.doc;
  };

  const initiateMatch = (txn: BankTransaction, docId: string) => {
    const doc = bookDocs.find(d => d.id === docId);
    if (!doc) return;

    const absDiff = Math.abs(Math.abs(txn.amount) - doc.amount);

    if (absDiff > 0.01) {
      setAdjustment({
        diff: absDiff,
        type: 'fee',
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

    setBankTxns(prev => prev.map(t => t.id === txn.id ? updatedTxn : t));
    await databaseService.updateBankTransaction(updatedTxn);
    setSelectedTxn(null);
    setAdjustment(null);
  };

  const handlePostAndMatch = () => {
    if (!selectedTxn || !adjustment || !onPostAdjustment) return;

    const accountCode = adjustment.type === 'fee' ? '52510' : '42100';
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
      credit: adjustment.type === 'fee' ? 0 : adjustment.diff,
      system_generated: true
    };

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
    confirmMatch(txn, null);
  };

  // Auto-match handler
  const handleAutoMatch = async () => {
    setIsAutoMatching(true);
    try {
      const { matches, autoMatchedCount } = autoMatchTransactions(
        bankTxns,
        bookDocs,
        autoMatchConfig
      );
      setAutoMatchResults(matches);

      // Auto-apply high-confidence matches
      const highConfidenceMatches = matches.filter(m =>
        m.matchType !== 'no_match' && m.score >= autoMatchConfig.minScore
      );

      // Update transactions
      for (const match of highConfidenceMatches) {
        const txn = bankTxns.find(t => t.id === match.txnId);
        if (txn && match.docId) {
          await confirmMatch(txn, match.docId);
        }
      }

      alert(`Auto-matched ${autoMatchedCount} transactions!`);
    } finally {
      setIsAutoMatching(false);
    }
  };

  // CSV Import handler
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      if (!content) return;

      const format = detectBankFormat(content);
      const newTxns = parseBankStatementCSV(content, selectedClientId, format.bank);

      // Add to existing transactions
      setBankTxns(prev => [...newTxns, ...prev]);

      // Persist to database (batch save)
      await databaseService.addBankTransactions(newTxns);

      alert(`Imported ${newTxns.length} transactions from ${format.bank}`);
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Render Stats Cards
  const renderStatsCards = () => (
    <div className="grid grid-cols-5 gap-4 mb-6">
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="text-blue-500" size={18} />
          <span className="text-xs font-medium text-slate-500">รายการธนาคาร</span>
        </div>
        <p className="text-2xl font-bold text-slate-800">{summary.totalBankTransactions}</p>
      </div>

      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="text-green-500" size={18} />
          <span className="text-xs font-medium text-slate-500">จับคู่แล้ว</span>
        </div>
        <p className="text-2xl font-bold text-green-600">{summary.totalMatched}</p>
      </div>

      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="text-amber-500" size={18} />
          <span className="text-xs font-medium text-slate-500">รอจับคู่</span>
        </div>
        <p className="text-2xl font-bold text-amber-600">{summary.totalUnmatched}</p>
      </div>

      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="text-indigo-500" size={18} />
          <span className="text-xs font-medium text-slate-500">Match Rate</span>
        </div>
        <p className="text-2xl font-bold text-indigo-600">{summary.matchRate.toFixed(1)}%</p>
      </div>

      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="text-purple-500" size={18} />
          <span className="text-xs font-medium text-slate-500">ยอดผลต่าง</span>
        </div>
        <p className={`text-2xl font-bold ${summary.difference === 0 ? 'text-green-600' : 'text-red-600'}`}>
          {formatCurrency(Math.abs(summary.difference))}
        </p>
      </div>
    </div>
  );

  // Render Auto-Match Tab
  const renderAutoMatchTab = () => (
    <div className="space-y-6">
      {/* Config Panel */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Zap size={24} />
              AI Auto-Match Engine
            </h3>
            <p className="text-indigo-100 mt-1">
              ให้ระบบจับคู่รายการอัตโนมัติด้วย AI scoring algorithm
            </p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold">{bankTxns.filter(t => t.status === 'unmatched').length}</p>
            <p className="text-indigo-200 text-sm">รายการรอจับคู่</p>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={() => setShowConfigPanel(!showConfigPanel)}
            className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 border border-white/30"
          >
            <Settings size={18} />
            ตั้งค่า
            <ChevronDown size={16} className={`transition-transform ${showConfigPanel ? 'rotate-180' : ''}`} />
          </button>

          <button
            onClick={handleAutoMatch}
            disabled={isAutoMatching || bankTxns.filter(t => t.status === 'unmatched').length === 0}
            className="flex-1 bg-white text-indigo-600 font-semibold py-3 px-6 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isAutoMatching ? (
              <>
                <RefreshCw className="animate-spin" size={20} />
                กำลังจับคู่...
              </>
            ) : (
              <>
                <Sparkles size={20} />
                เริ่ม Auto-Match
              </>
            )}
          </button>
        </div>

        {/* Config Panel */}
        {showConfigPanel && (
          <div className="mt-6 p-4 bg-white/10 rounded-xl border border-white/20">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-indigo-100 mb-2">Min Score (%)</label>
                <input
                  type="number"
                  value={autoMatchConfig.minScore}
                  onChange={(e) => setAutoMatchConfig({ ...autoMatchConfig, minScore: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50"
                />
              </div>
              <div>
                <label className="block text-sm text-indigo-100 mb-2">Amount Tolerance (THB)</label>
                <input
                  type="number"
                  value={autoMatchConfig.amountTolerance}
                  onChange={(e) => setAutoMatchConfig({ ...autoMatchConfig, amountTolerance: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50"
                />
              </div>
              <div>
                <label className="block text-sm text-indigo-100 mb-2">Date Tolerance (Days)</label>
                <input
                  type="number"
                  value={autoMatchConfig.dateTolerance}
                  onChange={(e) => setAutoMatchConfig({ ...autoMatchConfig, dateTolerance: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50"
                />
              </div>
            </div>

            <div className="flex gap-4 mt-4">
              <label className="flex items-center gap-2 text-sm text-indigo-100">
                <input
                  type="checkbox"
                  checked={autoMatchConfig.autoBookFees}
                  onChange={(e) => setAutoMatchConfig({ ...autoMatchConfig, autoBookFees: e.target.checked })}
                  className="rounded"
                />
                Auto-book bank fees
              </label>
              <label className="flex items-center gap-2 text-sm text-indigo-100">
                <input
                  type="checkbox"
                  checked={autoMatchConfig.autoBookInterest}
                  onChange={(e) => setAutoMatchConfig({ ...autoMatchConfig, autoBookInterest: e.target.checked })}
                  className="rounded"
                />
                Auto-book interest
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Match Results */}
      {autoMatchResults.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">ผลการ Auto-Match</h3>
              <span className="text-sm text-slate-500">
                จับคู่ได้ {autoMatchResults.filter(r => r.matchType !== 'no_match').length} / {autoMatchResults.length} รายการ
              </span>
            </div>
          </div>
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {autoMatchResults.map((result, i) => {
              const txn = bankTxns.find(t => t.id === result.txnId);
              const doc = result.docId ? bookDocs.find(d => d.id === result.docId) : null;

              return (
                <div key={i} className="p-4 hover:bg-slate-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {result.matchType !== 'no_match' ? (
                          <Check size={16} className="text-green-500" />
                        ) : (
                          <XCircle size={16} className="text-red-400" />
                        )}
                        <span className="font-medium text-slate-700">{txn?.description}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span>{txn?.date}</span>
                        <span className="font-mono">{formatCurrency(txn?.amount || 0)}</span>
                      </div>
                    </div>

                    {doc && (
                      <div className="text-right">
                        <p className="text-sm font-medium text-slate-700">{doc.client_name}</p>
                        <p className="text-xs text-slate-400">{doc.ai_data?.header_data.inv_number}</p>
                      </div>
                    )}

                    <div className="ml-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${result.matchType === 'exact' ? 'bg-green-100 text-green-700' :
                        result.matchType === 'fuzzy' ? 'bg-blue-100 text-blue-700' :
                          result.matchType === 'partial' ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-600'
                        }`}>
                        {result.matchType === 'exact' ? 'Exact' :
                          result.matchType === 'fuzzy' ? 'Fuzzy' :
                            result.matchType === 'partial' ? 'Partial' : 'No Match'}
                      </span>
                      <p className="text-xs text-slate-400 mt-1">Score: {result.score}</p>
                    </div>
                  </div>

                  {result.reasons.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {result.reasons.slice(0, 3).map((reason, j) => (
                        <span key={j} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          {reason}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  // Render Summary Tab
  const renderSummaryTab = () => (
    <div className="space-y-6">
      {/* Reconciliation Summary */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">สรุปการกระทบยอด</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h4 className="font-medium text-slate-700 mb-4">ยอดตามบัญชีธนาคาร</h4>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">ยอดรวมรายการ</span>
                  <span className="font-mono font-medium">{formatCurrency(summary.totalBankAmount)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">จำนวนรายการ</span>
                  <span className="font-medium">{summary.totalBankTransactions}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">เงินฝากค้างจ่าย</span>
                  <span className="font-mono text-green-600">{formatCurrency(summary.outstandingDeposits)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-600">เช็คค้างจ่าย</span>
                  <span className="font-mono text-red-600">{formatCurrency(summary.outstandingPayments)}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-slate-700 mb-4">ยอดตามบัญชีบริษัท</h4>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">ยอดรวมเอกสาร</span>
                  <span className="font-mono font-medium">{formatCurrency(summary.totalBookAmount)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">จำนวนเอกสาร</span>
                  <span className="font-medium">{bookDocs.length}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">จับคู่แล้ว</span>
                  <span className="font-medium text-green-600">{summary.totalMatched}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-600">รอจับคู่</span>
                  <span className="font-medium text-amber-600">{summary.totalUnmatched}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Difference */}
          <div className={`mt-6 p-4 rounded-xl ${summary.difference === 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
            <div className="flex items-center justify-between">
              <span className="font-medium">ยอดผลต่าง</span>
              <span className={`text-2xl font-bold font-mono ${summary.difference === 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                {formatCurrency(summary.difference)}
              </span>
            </div>
            {summary.difference === 0 && (
              <p className="text-sm text-green-600 mt-2 flex items-center gap-2">
                <CheckCircle2 size={16} />
                ยอดกระทบยอดตรงกันแล้ว
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Unmatched Items */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-amber-50">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-500" />
              รายการธนาคารที่ยังไม่จับคู่
            </h3>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
            {summary.unmatchedBankItems.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <CheckCircle2 size={32} className="mx-auto mb-2 text-green-400" />
                <p>ไม่มีรายการค้าง</p>
              </div>
            ) : summary.unmatchedBankItems.map(item => (
              <div key={item.id} className="p-4">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-700">{item.description}</span>
                  <span className={`font-mono ${item.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(item.amount)}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{item.date}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-blue-50">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <FileText size={18} className="text-blue-500" />
              เอกสารที่ยังไม่จับคู่
            </h3>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
            {summary.unmatchedBookItems.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <CheckCircle2 size={32} className="mx-auto mb-2 text-green-400" />
                <p>ไม่มีเอกสารค้าง</p>
              </div>
            ) : summary.unmatchedBookItems.map(doc => (
              <div key={doc.id} className="p-4">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-700">{doc.client_name}</span>
                  <span className="font-mono">{formatCurrency(doc.amount)}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {doc.ai_data?.header_data.inv_number} | {doc.ai_data?.header_data.issue_date}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // Render Import Tab
  const renderImportTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border-2 border-dashed border-slate-300 p-12 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-all">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".csv,.txt"
          className="hidden"
        />
        <div className="flex flex-col items-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          <div className="bg-blue-100 text-blue-600 p-5 rounded-full mb-4">
            <Upload size={40} />
          </div>
          <h3 className="text-xl font-semibold text-slate-800">นำเข้า Bank Statement</h3>
          <p className="text-slate-500 mt-2 max-w-md">
            รองรับไฟล์ CSV จากธนาคาร KBANK, SCB, BBL, KTB และอื่นๆ
          </p>
          <div className="flex gap-2 mt-4">
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">KBANK</span>
            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">SCB</span>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">BBL</span>
            <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">KTB</span>
          </div>
        </div>
      </div>

      {/* Recent Imports */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">รายการที่นำเข้าล่าสุด</h3>
        </div>
        <div className="p-4">
          {bankTxns.length === 0 ? (
            <p className="text-center text-slate-400 py-8">ยังไม่มีรายการที่นำเข้า</p>
          ) : (
            <div className="text-sm text-slate-600">
              <p>นำเข้าแล้วทั้งหมด <strong>{bankTxns.length}</strong> รายการ</p>
              <p className="mt-1">สำหรับลูกค้า: <strong>{currentClient?.name}</strong></p>
            </div>
          )}
        </div>
      </div>

      {/* Download Template */}
      <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
        <h4 className="font-medium text-slate-700 mb-2">รูปแบบไฟล์ที่รองรับ</h4>
        <p className="text-sm text-slate-500 mb-4">
          ไฟล์ CSV ต้องมีคอลัมน์: Date, Description, Debit, Credit, Balance
        </p>
        <button
          onClick={() => {
            const template = 'Date,Description,Debit,Credit,Balance\n2024-01-01,Sample Transaction,1000,0,1000';
            const blob = new Blob([template], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'bank_statement_template.csv';
            link.click();
            URL.revokeObjectURL(url);
          }}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
        >
          <Download size={16} />
          ดาวน์โหลด Template
        </button>
      </div>
    </div>
  );

  // Main Reconciliation Tab
  const renderReconcileTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-350px)]">
      {/* LEFT: Bank Statement */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            รายการเดินบัญชี (Bank)
          </h3>
          <span className="text-xs text-slate-500">{bankTxns.length} รายการ</span>
        </div>
        <div className="overflow-y-auto flex-1 p-0">
          {bankTxns.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              ไม่พบรายการเดินบัญชีสำหรับลูกค้า {currentClient?.name}
            </div>
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

                {txn.status === 'unmatched' && suggestion && (
                  <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] rounded-full">
                    <ArrowRightLeft size={10} /> AI แนะนำ (Score: {getMatchScore(txn, suggestion)})
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
            <Search className="absolute left-2 top-1.5 text-slate-400" size={14} />
            <input type="text" placeholder="ค้นหาเอกสาร..." className="pl-8 py-1 text-xs border border-slate-300 rounded-md focus:outline-none" />
          </div>
        </div>

        {selectedTxn ? (
          <div className="flex-1 flex flex-col bg-slate-50/50">
            <div className="p-4 bg-blue-600 text-white shadow-md z-10">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-blue-100 text-xs uppercase tracking-wide">กำลังจับคู่รายการ</p>
                  <p className="font-bold text-lg">{selectedTxn.description}</p>
                  <p className="font-mono text-xl mt-1">{selectedTxn.amount.toLocaleString('th-TH')} THB</p>
                </div>
                <button onClick={() => setSelectedTxn(null)} className="text-blue-200 hover:text-white">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wide mb-2">AI แนะนำ</p>

              {(() => {
                const suggestion = getSuggestedMatch(selectedTxn);
                return suggestion ? (
                  <div
                    className="bg-white p-4 rounded-xl border-2 border-indigo-200 shadow-sm hover:border-indigo-400 cursor-pointer transition-all"
                    onClick={() => initiateMatch(selectedTxn, suggestion.id)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold">Recommended</span>
                        <span className="text-xs text-slate-400">{suggestion.ai_data?.header_data.issue_date}</span>
                      </div>
                      <span className="font-bold font-mono text-slate-800">{suggestion.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <p className="font-medium text-slate-800">{suggestion.client_name}</p>
                    <p className="text-xs text-slate-500">{suggestion.filename}</p>
                    {Math.abs(Math.abs(selectedTxn.amount) - suggestion.amount) > 0.01 && (
                      <div className="mt-2 text-xs text-amber-600 font-bold flex items-center gap-1">
                        <AlertTriangle size={12} /> มียอดผลต่าง: {Math.abs(Math.abs(selectedTxn.amount) - suggestion.amount).toLocaleString()}
                      </div>
                    )}
                    <button className="w-full mt-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700">
                      จับคู่รายการ
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400 text-sm">ไม่พบรายการที่ตรงกัน</div>
                );
              })()}

              <div className="border-t border-slate-200 my-4"></div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wide mb-2">เอกสารทั้งหมด ({bookDocs.length})</p>

              {bookDocs.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-400">ไม่มีเอกสารสำหรับลูกค้า {currentClient?.name}</div>
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
                );
              })}
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
  );

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Adjustment Modal */}
      {adjustment && selectedTxn && (
        <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="p-5 bg-amber-50 border-b border-amber-100 flex justify-between items-center">
              <h3 className="font-bold text-amber-800 flex items-center gap-2">
                <AlertTriangle size={20} /> ยอดเงินไม่ตรงกัน
              </h3>
              <button onClick={() => setAdjustment(null)} className="text-amber-700 hover:bg-amber-100 rounded-full p-1"><X size={18} /></button>
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
                  <span className="font-bold text-slate-700">ผลต่าง</span>
                  <span className="font-mono font-bold text-red-600 text-xl">{adjustment.diff.toLocaleString()} <span className="text-sm">THB</span></span>
                </div>
              </div>

              <p className="text-sm text-slate-600 mb-2 font-medium">บันทึกผลต่างเป็น:</p>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
                  <input type="radio" name="adjType" checked={adjustment.type === 'fee'} onChange={() => setAdjustment({ ...adjustment, type: 'fee' })} className="text-blue-600 focus:ring-blue-500" />
                  <div className="flex-1">
                    <span className="block font-bold text-sm text-slate-800">ค่าธรรมเนียมธนาคาร</span>
                    <span className="block text-xs text-slate-500">บัญชี 52510 - Bank Charges</span>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
                  <input type="radio" name="adjType" checked={adjustment.type === 'interest'} onChange={() => setAdjustment({ ...adjustment, type: 'interest' })} className="text-blue-600 focus:ring-blue-500" />
                  <div className="flex-1">
                    <span className="block font-bold text-sm text-slate-800">รายได้ดอกเบี้ย</span>
                    <span className="block text-xs text-slate-500">บัญชี 42100 - Interest Income</span>
                  </div>
                </label>
              </div>

              <button onClick={handlePostAndMatch} className="w-full mt-6 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                <Calculator size={18} /> บันทึกและจับคู่
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clean Minimal Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-100 rounded-xl">
              <ArrowRightLeft size={24} className="text-slate-700" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">ระบบกระทบยอดธนาคาร</h1>
              <p className="text-sm text-slate-500">Bank Reconciliation with AI Auto-matching</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Building2 className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-100 outline-none min-w-[200px]"
              >
                {clients.length === 0 && <option value="">ไม่มีลูกค้า</option>}
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        {/* Stats Cards */}
        {!loading && clients.length > 0 && renderStatsCards()}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-200 pb-1">
          {[
            { id: 'reconcile', label: 'กระทบยอด', icon: ArrowRightLeft },
            { id: 'auto-match', label: 'Auto-Match', icon: Zap },
            { id: 'summary', label: 'สรุป', icon: BarChart3 },
            { id: 'import', label: 'นำเข้า', icon: Upload },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${isActive
                  ? 'bg-white text-blue-600 border border-slate-200 border-b-white -mb-px'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                  }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-blue-600" size={32} />
            <p className="text-slate-500 text-sm">กำลังโหลดข้อมูล...</p>
          </div>
        ) : loadError ? (
          <div className="h-64 flex flex-col items-center justify-center gap-4">
            <AlertTriangle size={48} className="text-amber-500" />
            <p className="text-slate-600">{loadError}</p>
            <button
              onClick={() => setSelectedClientId(selectedClientId)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              ลองใหม่
            </button>
          </div>
        ) : clients.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center gap-4">
            <Building2 size={48} className="text-slate-300" />
            <p className="text-slate-500">กรุณาเพิ่มข้อมูลลูกค้าก่อนเพื่อใช้งาน</p>
          </div>
        ) : (
          <>
            {activeTab === 'reconcile' && renderReconcileTab()}
            {activeTab === 'auto-match' && renderAutoMatchTab()}
            {activeTab === 'summary' && renderSummaryTab()}
            {activeTab === 'import' && renderImportTab()}
          </>
        )}
      </div>
    </div>
  );
};

export default BankReconciliation;

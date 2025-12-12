import React, { useState } from 'react';
import {
  Zap, Settings, Play, CheckCircle, AlertTriangle, Clock,
  FileText, TrendingUp, RefreshCw, Bot, ChevronRight,
  BarChart3, Target, Building,
  ThumbsUp, Eye, Sparkles, Layers, Activity
} from 'lucide-react';
import {
  AutoApprovalConfig, AutomationRule, BatchProcessResult,
  DEFAULT_AUTO_APPROVAL_CONFIG, DEFAULT_AUTOMATION_RULES,
  canAutoApprove, batchProcessDocuments, calculateAutomationStats,
  getPendingTasks
} from '../services/automation';
import { DocumentRecord, VendorRule, Client } from '../types';

interface Props {
  documents: DocumentRecord[];
  clients: Client[];
  vendorRules?: VendorRule[];
  onDocumentUpdate?: (docId: string, updates: Partial<DocumentRecord>) => void;
  onBatchProcess?: (result: BatchProcessResult) => void;
}

const AutomationDashboard: React.FC<Props> = ({
  documents,
  clients,
  vendorRules = [],
  onBatchProcess
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'config' | 'rules' | 'batch' | 'insights'>('overview');
  const [config, setConfig] = useState<AutoApprovalConfig>(DEFAULT_AUTO_APPROVAL_CONFIG);
  const [rules, setRules] = useState<AutomationRule[]>(DEFAULT_AUTOMATION_RULES);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessResult, setLastProcessResult] = useState<BatchProcessResult | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>('all');

  // Get statistics
  const today = new Date();
  const startOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const endOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()}`;

  const stats = calculateAutomationStats(documents, { startDate: startOfMonth, endDate: endOfMonth });
  const pendingTasks = getPendingTasks(documents, clients);

  // Filter documents for batch processing
  const eligibleDocs = documents.filter(d =>
    d.status === 'pending_review' &&
    (selectedClientId === 'all' || d.client_name === clients.find(c => c.id === selectedClientId)?.name)
  );

  const handleBatchProcess = async () => {
    if (eligibleDocs.length === 0) return;

    setIsProcessing(true);
    try {
      const result = await batchProcessDocuments(
        eligibleDocs,
        selectedClientId === 'all' ? 'batch' : selectedClientId,
        config,
        rules,
        vendorRules
      );
      setLastProcessResult(result);
      onBatchProcess?.(result);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // Tab: Overview
  const renderOverview = () => (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
          <div className="flex items-center justify-between mb-3">
            <Bot className="text-blue-600" size={24} />
            <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
              Auto-Approved
            </span>
          </div>
          <p className="text-3xl font-bold text-slate-800">{stats.autoApproved}</p>
          <p className="text-sm text-slate-500 mt-1">
            {formatPercent(stats.automationRate)} อัตโนมัติ
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border border-green-100">
          <div className="flex items-center justify-between mb-3">
            <TrendingUp className="text-green-600" size={24} />
            <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">
              มูลค่ารวม
            </span>
          </div>
          <p className="text-3xl font-bold text-slate-800">
            {formatCurrency(stats.autoApprovedAmount).replace('฿', '')}
          </p>
          <p className="text-sm text-slate-500 mt-1">฿ ประมวลผลอัตโนมัติ</p>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-5 border border-amber-100">
          <div className="flex items-center justify-between mb-3">
            <Clock className="text-amber-600" size={24} />
            <span className="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-1 rounded-full">
              รอดำเนินการ
            </span>
          </div>
          <p className="text-3xl font-bold text-slate-800">{stats.manuallyProcessed}</p>
          <p className="text-sm text-slate-500 mt-1">เอกสารรอตรวจสอบ</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-5 border border-purple-100">
          <div className="flex items-center justify-between mb-3">
            <Target className="text-purple-600" size={24} />
            <span className="text-xs font-medium text-purple-600 bg-purple-100 px-2 py-1 rounded-full">
              เวลาที่ประหยัด
            </span>
          </div>
          <p className="text-3xl font-bold text-slate-800">{stats.timeSaved} นาที</p>
          <p className="text-sm text-slate-500 mt-1">~{formatCurrency(stats.costSaved)}</p>
        </div>
      </div>

      {/* Pending Tasks */}
      <div className="grid grid-cols-2 gap-6">
        {/* Urgent Tasks */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-red-50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-red-500" size={20} />
              <h3 className="font-semibold text-slate-800">งานเร่งด่วน</h3>
              <span className="ml-auto text-xs font-medium text-red-600 bg-red-100 px-2 py-1 rounded-full">
                {pendingTasks.urgent.length} รายการ
              </span>
            </div>
          </div>
          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {pendingTasks.urgent.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <CheckCircle size={32} className="mx-auto mb-2 text-green-400" />
                <p>ไม่มีงานเร่งด่วน</p>
              </div>
            ) : (
              pendingTasks.urgent.slice(0, 5).map((task, i) => (
                <div key={i} className="px-5 py-3 hover:bg-slate-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{task.description}</p>
                      {task.clientName && (
                        <p className="text-xs text-slate-400">{task.clientName}</p>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-slate-400" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Normal Tasks */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-blue-50">
            <div className="flex items-center gap-2">
              <Clock className="text-blue-500" size={20} />
              <h3 className="font-semibold text-slate-800">งานปกติ</h3>
              <span className="ml-auto text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                {pendingTasks.normal.length} รายการ
              </span>
            </div>
          </div>
          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {pendingTasks.normal.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <CheckCircle size={32} className="mx-auto mb-2 text-green-400" />
                <p>ไม่มีงานรอดำเนินการ</p>
              </div>
            ) : (
              pendingTasks.normal.slice(0, 5).map((task, i) => (
                <div key={i} className="px-5 py-3 hover:bg-slate-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{task.description}</p>
                      {task.clientName && (
                        <p className="text-xs text-slate-400">{task.clientName}</p>
                      )}
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                      {task.type}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Automation Activity */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="text-indigo-500" size={20} />
              <h3 className="font-semibold text-slate-800">กิจกรรมล่าสุด</h3>
            </div>
            <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
              ดูทั้งหมด
            </button>
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-8">
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-500">อัตราการอนุมัติอัตโนมัติ</span>
                <span className="font-semibold text-slate-700">{formatPercent(stats.automationRate)}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                  style={{ width: `${Math.min(stats.automationRate, 100)}%` }}
                />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-500">ประมวลผลรวม</span>
                <span className="font-semibold text-slate-700">{stats.totalDocuments} รายการ</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
                  style={{ width: `${Math.min((stats.totalDocuments / Math.max(documents.length, 1)) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Tab: Config
  const renderConfig = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Settings className="text-slate-500" size={20} />
            <h3 className="font-semibold text-slate-800">การตั้งค่าอนุมัติอัตโนมัติ</h3>
          </div>
        </div>
        <div className="p-6 space-y-6">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-700">เปิดใช้งานการอนุมัติอัตโนมัติ</p>
              <p className="text-sm text-slate-400">ระบบจะอนุมัติเอกสารที่ผ่านเกณฑ์โดยอัตโนมัติ</p>
            </div>
            <button
              onClick={() => setConfig({ ...config, enabled: !config.enabled })}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                config.enabled ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                config.enabled ? 'translate-x-8' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {/* Max Amount */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              วงเงินสูงสุดที่อนุมัติอัตโนมัติได้
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="10000"
                max="500000"
                step="10000"
                value={config.maxAmount}
                onChange={(e) => setConfig({ ...config, maxAmount: parseInt(e.target.value) })}
                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-sm font-semibold text-slate-700 w-32 text-right">
                {formatCurrency(config.maxAmount)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>฿10,000</span>
              <span>฿500,000</span>
            </div>
          </div>

          {/* Min Confidence Score */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              ค่าความมั่นใจ AI ขั้นต่ำ (%)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="70"
                max="99"
                step="1"
                value={config.minConfidenceScore}
                onChange={(e) => setConfig({ ...config, minConfidenceScore: parseInt(e.target.value) })}
                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-sm font-semibold text-slate-700 w-16 text-right">
                {config.minConfidenceScore}%
              </span>
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>70% (ผ่อนปรน)</span>
              <span>99% (เข้มงวด)</span>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.requireFullTaxInvoice}
                onChange={(e) => setConfig({ ...config, requireFullTaxInvoice: e.target.checked })}
                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-slate-700">ต้องเป็นใบกำกับภาษีเต็มรูปแบบเท่านั้น</p>
                <p className="text-xs text-slate-400">ใบเสร็จรับเงินหรือใบแจ้งหนี้ต้องตรวจสอบด้วยมือ</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.requireNoAuditFlags}
                onChange={(e) => setConfig({ ...config, requireNoAuditFlags: e.target.checked })}
                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-slate-700">ไม่มี Audit Flag</p>
                <p className="text-xs text-slate-400">เอกสารที่มีการตั้ง flag ต้องตรวจสอบด้วยมือ</p>
              </div>
            </label>
          </div>

          {/* Allowed Document Types */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              ประเภทเอกสารที่อนุญาตให้อนุมัติอัตโนมัติ
            </label>
            <div className="flex flex-wrap gap-2">
              {['Invoice', 'Receipt', 'Tax Invoice', 'Expense', 'Purchase'].map(type => {
                const isSelected = config.allowedDocTypes.some(t => t.toLowerCase() === type.toLowerCase());
                const labels: Record<string, string> = {
                  'Invoice': 'ใบแจ้งหนี้',
                  'Receipt': 'ใบเสร็จรับเงิน',
                  'Tax Invoice': 'ใบกำกับภาษี',
                  'Expense': 'ค่าใช้จ่าย',
                  'Purchase': 'ซื้อสินค้า',
                };
                return (
                  <button
                    key={type}
                    onClick={() => {
                      const newTypes = isSelected
                        ? config.allowedDocTypes.filter(t => t.toLowerCase() !== type.toLowerCase())
                        : [...config.allowedDocTypes, type];
                      setConfig({ ...config, allowedDocTypes: newTypes });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                        : 'bg-slate-100 text-slate-600 border-2 border-transparent hover:bg-slate-200'
                    }`}
                  >
                    {labels[type] || type}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Tab: Rules
  const renderRules = () => (
    <div className="space-y-6">
      {/* Automation Rules */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="text-purple-500" size={20} />
              <h3 className="font-semibold text-slate-800">กฎการทำงานอัตโนมัติ</h3>
            </div>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              <span>เพิ่มกฎใหม่</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {rules.map((rule, index) => (
            <div key={rule.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    rule.enabled ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <Zap size={20} />
                  </div>
                  <div>
                    <p className="font-medium text-slate-700">{rule.name}</p>
                    <p className="text-sm text-slate-400 mt-0.5">{rule.description}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {rule.conditions.map((cond, i) => (
                        <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                          {cond.field} {cond.operator} {String(cond.value)}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      ทำงานแล้ว {rule.triggerCount} ครั้ง
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const newRules = [...rules];
                    newRules[index] = { ...rule, enabled: !rule.enabled };
                    setRules(newRules);
                  }}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    rule.enabled ? 'bg-green-500' : 'bg-slate-300'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    rule.enabled ? 'translate-x-7' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Vendor Rules */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building className="text-indigo-500" size={20} />
              <h3 className="font-semibold text-slate-800">กฎตามผู้ขาย (Vendor Rules)</h3>
            </div>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              <span>เพิ่มผู้ขาย</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        {vendorRules.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Building size={40} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">ยังไม่มีกฎตามผู้ขาย</p>
            <p className="text-xs mt-1">เพิ่มกฎเพื่อกำหนดบัญชีและ WHT อัตโนมัติตามผู้ขาย</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {vendorRules.map(vr => (
              <div key={vr.id} className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-700">{vr.vendorNameKeyword}</p>
                    <p className="text-sm text-slate-400">
                      บัญชี: {vr.accountCode} - {vr.accountName}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                    VAT: {vr.vatType}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Tab: Batch Processing
  const renderBatch = () => (
    <div className="space-y-6">
      {/* Batch Control */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Bot size={24} />
              ประมวลผลเอกสารอัตโนมัติ
            </h3>
            <p className="text-indigo-100 mt-1">
              เลือกลูกค้าและกด Run เพื่อประมวลผลเอกสารที่รอดำเนินการทั้งหมด
            </p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold">{eligibleDocs.length}</p>
            <p className="text-indigo-200 text-sm">เอกสารพร้อมประมวลผล</p>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-4">
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="bg-white/20 text-white border-2 border-white/30 rounded-lg px-4 py-2 focus:outline-none focus:border-white/50"
          >
            <option value="all" className="text-slate-800">ทุกลูกค้า</option>
            {clients.map(c => (
              <option key={c.id} value={c.id} className="text-slate-800">{c.name}</option>
            ))}
          </select>

          <button
            onClick={handleBatchProcess}
            disabled={isProcessing || eligibleDocs.length === 0}
            className="flex-1 bg-white text-indigo-600 font-semibold py-3 px-6 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="animate-spin" size={20} />
                กำลังประมวลผล...
              </>
            ) : (
              <>
                <Play size={20} />
                เริ่มประมวลผล Batch
              </>
            )}
          </button>
        </div>
      </div>

      {/* Last Process Result */}
      {lastProcessResult && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-green-50">
            <div className="flex items-center gap-2">
              <CheckCircle className="text-green-500" size={20} />
              <h3 className="font-semibold text-slate-800">ผลการประมวลผลล่าสุด</h3>
            </div>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-slate-50 rounded-lg">
                <p className="text-2xl font-bold text-slate-800">{lastProcessResult.totalProcessed}</p>
                <p className="text-sm text-slate-500">ประมวลผลแล้ว</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{lastProcessResult.autoApproved}</p>
                <p className="text-sm text-slate-500">อนุมัติอัตโนมัติ</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{lastProcessResult.autoPosted}</p>
                <p className="text-sm text-slate-500">Post GL อัตโนมัติ</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-600">{lastProcessResult.errors.length}</p>
                <p className="text-sm text-slate-500">ผิดพลาด</p>
              </div>
            </div>

            {/* GL Entries Generated */}
            {lastProcessResult.glEntriesGenerated.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-slate-700 mb-2">
                  GL Entries ที่สร้างอัตโนมัติ: {lastProcessResult.glEntriesGenerated.length} รายการ
                </p>
              </div>
            )}

            {/* Errors */}
            {lastProcessResult.errors.length > 0 && (
              <div className="mt-4 p-4 bg-red-50 rounded-lg">
                <p className="text-sm font-medium text-red-700 mb-2">ข้อผิดพลาด:</p>
                {lastProcessResult.errors.map((err, i) => (
                  <p key={i} className="text-xs text-red-600">
                    Doc {err.docId}: {err.error}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Eligible Documents Preview */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileText className="text-blue-500" size={20} />
            <h3 className="font-semibold text-slate-800">เอกสารที่รอประมวลผล</h3>
          </div>
        </div>
        {eligibleDocs.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <CheckCircle size={40} className="mx-auto mb-3 text-green-400" />
            <p>ไม่มีเอกสารรอดำเนินการ</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {eligibleDocs.slice(0, 10).map(doc => {
              const canAuto = canAutoApprove(doc, config);
              return (
                <div key={doc.id} className="px-5 py-3 hover:bg-slate-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText size={16} className="text-slate-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          {doc.ai_data?.parties.counterparty.name || 'ไม่ระบุผู้ขาย'}
                        </p>
                        <p className="text-xs text-slate-400">
                          {doc.ai_data?.header_data.doc_type || '-'} | {formatCurrency(doc.ai_data?.financials.grand_total || 0)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canAuto.approved ? (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <ThumbsUp size={14} />
                          <span>Auto-approve</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-amber-600">
                          <Eye size={14} />
                          <span>ต้องตรวจสอบ</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // Tab: Insights
  const renderInsights = () => (
    <div className="space-y-6">
      {/* AI Insights */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500 flex items-center justify-center">
            <Sparkles className="text-white" size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">AI Insights</h3>
            <p className="text-sm text-slate-500">การวิเคราะห์อัจฉริยะจากข้อมูลของคุณ</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4 border border-purple-100">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={18} className="text-green-500" />
              <span className="text-sm font-medium text-slate-700">ประสิทธิภาพเพิ่มขึ้น</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{formatPercent(stats.automationRate)}</p>
            <p className="text-xs text-slate-400 mt-1">
              เอกสารที่ประมวลผลอัตโนมัติเทียบกับทั้งหมด
            </p>
          </div>

          <div className="bg-white rounded-lg p-4 border border-purple-100">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={18} className="text-blue-500" />
              <span className="text-sm font-medium text-slate-700">เวลาที่ประหยัด</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">
              {stats.timeSaved} นาที
            </p>
            <p className="text-xs text-slate-400 mt-1">
              ประมาณการจากการอนุมัติอัตโนมัติ (5 นาที/เอกสาร)
            </p>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Target className="text-indigo-500" size={20} />
            <h3 className="font-semibold text-slate-800">คำแนะนำเพื่อเพิ่มประสิทธิภาพ</h3>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {stats.automationRate < 50 && (
            <div className="p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={16} className="text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">เพิ่มวงเงินอนุมัติอัตโนมัติ</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  อัตราการอนุมัติอัตโนมัติต่ำกว่า 50% ลองเพิ่มวงเงินจาก {formatCurrency(config.maxAmount)}
                </p>
              </div>
            </div>
          )}

          {config.minConfidenceScore > 95 && (
            <div className="p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <Target size={16} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">ปรับค่า Confidence Score</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  ค่าความมั่นใจ {config.minConfidenceScore}% ค่อนข้างสูง ลองลดลงเป็น 90% เพื่อเพิ่มความเร็ว
                </p>
              </div>
            </div>
          )}

          {vendorRules.length < 5 && (
            <div className="p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <Building size={16} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">เพิ่มกฎผู้ขายประจำ</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  สร้างกฎสำหรับผู้ขายที่ทำธุรกรรมบ่อยเพื่อให้ระบบกำหนดบัญชีและ WHT อัตโนมัติ
                </p>
              </div>
            </div>
          )}

          <div className="p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
              <Sparkles size={16} className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">ทำงานได้ดี!</p>
              <p className="text-xs text-slate-400 mt-0.5">
                ระบบกำลังเรียนรู้จากข้อมูลของคุณ ยิ่งใช้งานมากยิ่งแม่นยำมากขึ้น
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Savings */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <BarChart3 className="text-blue-500" size={20} />
            <h3 className="font-semibold text-slate-800">การประหยัดต้นทุน</h3>
          </div>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.costSaved)}</p>
              <p className="text-sm text-slate-500">ค่าใช้จ่ายที่ประหยัด</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{stats.timeSaved}</p>
              <p className="text-sm text-slate-500">นาทีที่ประหยัด</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">{stats.autoApproved}</p>
              <p className="text-sm text-slate-500">รายการอัตโนมัติ</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'overview', label: 'ภาพรวม', icon: BarChart3 },
    { id: 'config', label: 'ตั้งค่า', icon: Settings },
    { id: 'rules', label: 'กฎอัตโนมัติ', icon: Layers },
    { id: 'batch', label: 'ประมวลผล Batch', icon: Play },
    { id: 'insights', label: 'AI Insights', icon: Sparkles },
  ];

  return (
    <div className="flex-1 overflow-auto bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
              <Bot className="text-indigo-600" size={32} />
              Smart Automation Engine
            </h1>
            <p className="text-slate-500 mt-2">
              ลดงานที่ต้องทำด้วยมือ ด้วยระบบอนุมัติและประมวลผลอัตโนมัติ
            </p>
          </div>

          {config.enabled && (
            <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-lg border border-green-200">
              <Zap size={18} />
              <span className="font-medium">Auto-Approval เปิดใช้งาน</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-200 pb-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
                  isActive
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
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'config' && renderConfig()}
        {activeTab === 'rules' && renderRules()}
        {activeTab === 'batch' && renderBatch()}
        {activeTab === 'insights' && renderInsights()}
      </div>
    </div>
  );
};

export default AutomationDashboard;

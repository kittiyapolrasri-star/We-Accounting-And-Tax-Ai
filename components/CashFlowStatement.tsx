import React, { useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Building, Calendar, Download,
  ChevronDown, ChevronUp, Printer, FileText, ArrowUpRight, ArrowDownRight,
  Wallet, Factory, Landmark, RefreshCw, HelpCircle, Info
} from 'lucide-react';
import { PostedGLEntry, Client } from '../types';

interface Props {
  clients: Client[];
  glEntries: PostedGLEntry[];
}

// Cash Flow Categories mapping based on account codes
const CASH_FLOW_MAPPING = {
  // Operating Activities - Direct Method items
  operating: {
    cashReceipts: {
      label: 'เงินสดรับจากลูกค้า',
      labelEn: 'Cash received from customers',
      accounts: ['11100', '11200', '41'], // Cash, Bank, Revenue accounts
      type: 'inflow',
    },
    cashPayments: {
      label: 'เงินสดจ่ายให้เจ้าหนี้การค้า',
      labelEn: 'Cash paid to suppliers',
      accounts: ['21', '51', '52'], // AP, COGS, Operating expenses
      type: 'outflow',
    },
    salaryPayments: {
      label: 'เงินสดจ่ายให้พนักงาน',
      labelEn: 'Cash paid to employees',
      accounts: ['521', '522'], // Salary accounts
      type: 'outflow',
    },
    interestReceived: {
      label: 'ดอกเบี้ยรับ',
      labelEn: 'Interest received',
      accounts: ['42'], // Interest income
      type: 'inflow',
    },
    interestPaid: {
      label: 'ดอกเบี้ยจ่าย',
      labelEn: 'Interest paid',
      accounts: ['53'], // Interest expense
      type: 'outflow',
    },
    taxesPaid: {
      label: 'ภาษีเงินได้จ่าย',
      labelEn: 'Income taxes paid',
      accounts: ['213', '54'], // Tax payable, Tax expense
      type: 'outflow',
    },
  },
  // Investing Activities
  investing: {
    propertyPurchase: {
      label: 'ซื้อที่ดิน อาคาร และอุปกรณ์',
      labelEn: 'Purchase of property, plant and equipment',
      accounts: ['12'], // Fixed assets
      type: 'outflow',
    },
    propertySale: {
      label: 'ขายที่ดิน อาคาร และอุปกรณ์',
      labelEn: 'Proceeds from sale of property',
      accounts: ['12'], // Fixed assets (credit side)
      type: 'inflow',
    },
    investmentPurchase: {
      label: 'ซื้อเงินลงทุน',
      labelEn: 'Purchase of investments',
      accounts: ['13'], // Investments
      type: 'outflow',
    },
    investmentSale: {
      label: 'ขายเงินลงทุน',
      labelEn: 'Proceeds from sale of investments',
      accounts: ['13'], // Investments (credit side)
      type: 'inflow',
    },
  },
  // Financing Activities
  financing: {
    borrowings: {
      label: 'เงินกู้ยืมรับ',
      labelEn: 'Proceeds from borrowings',
      accounts: ['22', '23'], // Long-term liabilities
      type: 'inflow',
    },
    loanRepayments: {
      label: 'จ่ายคืนเงินกู้ยืม',
      labelEn: 'Repayment of borrowings',
      accounts: ['22', '23'], // Long-term liabilities (debit side)
      type: 'outflow',
    },
    shareCapital: {
      label: 'รับเงินจากการออกหุ้น',
      labelEn: 'Proceeds from share issuance',
      accounts: ['31'], // Share capital
      type: 'inflow',
    },
    dividendsPaid: {
      label: 'จ่ายเงินปันผล',
      labelEn: 'Dividends paid',
      accounts: ['33'], // Retained earnings/dividends
      type: 'outflow',
    },
  },
};

// Account code prefixes for classification
const accountStartsWith = (code: string, prefixes: string[]): boolean => {
  return prefixes.some(prefix => code.startsWith(prefix));
};

const CashFlowStatement: React.FC<Props> = ({ clients, glEntries }) => {
  const [selectedClientId, setSelectedClientId] = useState<string>(clients[0]?.id || '');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
  const [expandedSections, setExpandedSections] = useState<string[]>(['operating', 'investing', 'financing']);
  const [method, setMethod] = useState<'direct' | 'indirect'>('direct');

  // Filter GL entries by client and period
  const filteredEntries = useMemo(() => {
    return glEntries.filter(entry => {
      if (entry.clientId !== selectedClientId) return false;

      const entryDate = new Date(entry.date);
      const entryYear = entryDate.getFullYear();
      const entryMonth = entryDate.getMonth() + 1;

      if (viewMode === 'yearly') {
        return entryYear === selectedYear;
      } else {
        return entryYear === selectedYear && entryMonth === selectedMonth;
      }
    });
  }, [glEntries, selectedClientId, selectedYear, selectedMonth, viewMode]);

  // Calculate cash flows by category
  const cashFlows = useMemo(() => {
    const results = {
      operating: {
        items: {} as Record<string, number>,
        total: 0,
      },
      investing: {
        items: {} as Record<string, number>,
        total: 0,
      },
      financing: {
        items: {} as Record<string, number>,
        total: 0,
      },
      beginningCash: 0,
      endingCash: 0,
      netChange: 0,
    };

    // Initialize all items
    Object.entries(CASH_FLOW_MAPPING.operating).forEach(([key]) => {
      results.operating.items[key] = 0;
    });
    Object.entries(CASH_FLOW_MAPPING.investing).forEach(([key]) => {
      results.investing.items[key] = 0;
    });
    Object.entries(CASH_FLOW_MAPPING.financing).forEach(([key]) => {
      results.financing.items[key] = 0;
    });

    // Process each GL entry
    filteredEntries.forEach(entry => {
      const code = entry.account_code;
      const netAmount = entry.debit - entry.credit;

      // Operating Activities
      if (accountStartsWith(code, ['41', '42'])) {
        // Revenue - cash inflow (credit increases revenue, so negative net = inflow)
        results.operating.items['cashReceipts'] += Math.abs(entry.credit - entry.debit);
      } else if (accountStartsWith(code, ['51', '52'])) {
        // Expenses - cash outflow
        if (accountStartsWith(code, ['521', '522'])) {
          results.operating.items['salaryPayments'] += entry.debit;
        } else if (accountStartsWith(code, ['53'])) {
          results.operating.items['interestPaid'] += entry.debit;
        } else {
          results.operating.items['cashPayments'] += entry.debit;
        }
      } else if (accountStartsWith(code, ['213'])) {
        // Tax payable
        results.operating.items['taxesPaid'] += Math.abs(netAmount);
      }

      // Investing Activities
      if (accountStartsWith(code, ['12'])) {
        // Fixed assets
        if (entry.debit > entry.credit) {
          results.investing.items['propertyPurchase'] += entry.debit - entry.credit;
        } else {
          results.investing.items['propertySale'] += entry.credit - entry.debit;
        }
      } else if (accountStartsWith(code, ['13'])) {
        // Investments
        if (entry.debit > entry.credit) {
          results.investing.items['investmentPurchase'] += entry.debit - entry.credit;
        } else {
          results.investing.items['investmentSale'] += entry.credit - entry.debit;
        }
      }

      // Financing Activities
      if (accountStartsWith(code, ['22', '23'])) {
        // Long-term liabilities
        if (entry.credit > entry.debit) {
          results.financing.items['borrowings'] += entry.credit - entry.debit;
        } else {
          results.financing.items['loanRepayments'] += entry.debit - entry.credit;
        }
      } else if (accountStartsWith(code, ['31'])) {
        // Share capital
        if (entry.credit > entry.debit) {
          results.financing.items['shareCapital'] += entry.credit - entry.debit;
        }
      } else if (accountStartsWith(code, ['33'])) {
        // Dividends
        if (entry.debit > entry.credit) {
          results.financing.items['dividendsPaid'] += entry.debit - entry.credit;
        }
      }

      // Track cash accounts for beginning/ending balance
      if (accountStartsWith(code, ['111', '112'])) {
        results.endingCash += netAmount;
      }
    });

    // Calculate totals
    Object.entries(CASH_FLOW_MAPPING.operating).forEach(([key, config]) => {
      const amount = results.operating.items[key];
      if (config.type === 'inflow') {
        results.operating.total += amount;
      } else {
        results.operating.total -= amount;
      }
    });

    Object.entries(CASH_FLOW_MAPPING.investing).forEach(([key, config]) => {
      const amount = results.investing.items[key];
      if (config.type === 'inflow') {
        results.investing.total += amount;
      } else {
        results.investing.total -= amount;
      }
    });

    Object.entries(CASH_FLOW_MAPPING.financing).forEach(([key, config]) => {
      const amount = results.financing.items[key];
      if (config.type === 'inflow') {
        results.financing.total += amount;
      } else {
        results.financing.total -= amount;
      }
    });

    results.netChange = results.operating.total + results.investing.total + results.financing.total;

    return results;
  }, [filteredEntries]);

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  // Format currency
  const formatCurrency = (amount: number): string => {
    const formatted = Math.abs(amount).toLocaleString('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return amount < 0 ? `(${formatted})` : formatted;
  };

  // Get period label
  const getPeriodLabel = (): string => {
    if (viewMode === 'yearly') {
      return `ปี ${selectedYear + 543}`;
    } else {
      const monthName = new Date(selectedYear, selectedMonth - 1).toLocaleDateString('th-TH', { month: 'long' });
      return `${monthName} ${selectedYear + 543}`;
    }
  };

  // Section renderer
  const renderCashFlowSection = (
    title: string,
    titleEn: string,
    icon: React.ReactNode,
    sectionKey: 'operating' | 'investing' | 'financing',
    mapping: Record<string, { label: string; labelEn: string; type: string }>
  ) => {
    const isExpanded = expandedSections.includes(sectionKey);
    const sectionData = cashFlows[sectionKey];
    const totalColor = sectionData.total >= 0 ? 'text-emerald-600' : 'text-red-600';

    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Section Header */}
        <button
          onClick={() => toggleSection(sectionKey)}
          className="w-full px-6 py-4 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            {icon}
            <div className="text-left">
              <h3 className="font-semibold text-slate-800">{title}</h3>
              <p className="text-xs text-slate-500">{titleEn}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className={`text-lg font-bold ${totalColor}`}>
              ฿{formatCurrency(sectionData.total)}
            </span>
            {isExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
          </div>
        </button>

        {/* Section Details */}
        {isExpanded && (
          <div className="divide-y divide-slate-100">
            {Object.entries(mapping).map(([key, config]) => {
              const amount = sectionData.items[key] || 0;
              if (amount === 0) return null;

              const isInflow = config.type === 'inflow';
              const displayAmount = isInflow ? amount : -amount;

              return (
                <div key={key} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-2">
                    {isInflow ? (
                      <ArrowUpRight size={16} className="text-emerald-500" />
                    ) : (
                      <ArrowDownRight size={16} className="text-red-500" />
                    )}
                    <div>
                      <span className="text-sm text-slate-700">{config.label}</span>
                      <span className="text-xs text-slate-400 ml-2">{config.labelEn}</span>
                    </div>
                  </div>
                  <span className={`text-sm font-medium ${displayAmount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    ฿{formatCurrency(displayAmount)}
                  </span>
                </div>
              );
            })}
            {Object.values(sectionData.items).every(v => v === 0) && (
              <div className="px-6 py-8 text-center text-slate-400">
                <Info size={24} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">ไม่มีรายการในงวดนี้</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="animate-in fade-in duration-500 p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <RefreshCw className="text-blue-600" />
            งบกระแสเงินสด (Cash Flow Statement)
          </h2>
          <p className="text-slate-500 mt-1">วิเคราะห์การไหลเวียนของเงินสดจากกิจกรรมต่างๆ</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Client Selector */}
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
          >
            {clients.map(client => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>

          {/* Actions */}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
          >
            <Printer size={18} />
            พิมพ์
          </button>
          <button
            onClick={() => {
              const data = {
                period: getPeriodLabel(),
                client: clients.find(c => c.id === selectedClientId)?.name,
                operating: cashFlows.operating,
                investing: cashFlows.investing,
                financing: cashFlows.financing,
                netChange: cashFlows.netChange
              };
              const dataStr = JSON.stringify(data, null, 2);
              const blob = new Blob([dataStr], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `cashflow_${selectedClientId}_${selectedYear}_${selectedMonth}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
          >
            <Download size={18} />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* View Mode */}
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('monthly')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'monthly' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'
                  }`}
              >
                รายเดือน
              </button>
              <button
                onClick={() => setViewMode('yearly')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'yearly' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'
                  }`}
              >
                รายปี
              </button>
            </div>

            {/* Period Selection */}
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-slate-400" />
              {viewMode === 'monthly' && (
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2024, i).toLocaleDateString('th-TH', { month: 'long' })}
                    </option>
                  ))}
                </select>
              )}
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                {[2023, 2024, 2025].map(year => (
                  <option key={year} value={year}>{year + 543}</option>
                ))}
              </select>
            </div>

            {/* Method Toggle */}
            <div className="flex items-center gap-2 ml-4">
              <span className="text-sm text-slate-500">วิธี:</span>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="direct">ทางตรง (Direct)</option>
                <option value="indirect">ทางอ้อม (Indirect)</option>
              </select>
              <button
                onClick={() => alert('วิธีทางตรง (Direct): แสดงเงินสดรับ-จ่ายโดยตรง\nวิธีทางอ้อม (Indirect): เริ่มจากกำไรสุทธิแล้วปรับปรุง')}
                className="p-1 text-slate-400 hover:text-slate-600"
                title="ข้อมูลเพิ่มเติม"
              >
                <HelpCircle size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">เงินสดจากการดำเนินงาน</span>
            <Factory size={18} className="text-blue-500" />
          </div>
          <p className={`text-xl font-bold ${cashFlows.operating.total >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            ฿{formatCurrency(cashFlows.operating.total)}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">เงินสดจากการลงทุน</span>
            <TrendingUp size={18} className="text-purple-500" />
          </div>
          <p className={`text-xl font-bold ${cashFlows.investing.total >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            ฿{formatCurrency(cashFlows.investing.total)}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">เงินสดจากการจัดหาเงิน</span>
            <Landmark size={18} className="text-amber-500" />
          </div>
          <p className={`text-xl font-bold ${cashFlows.financing.total >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            ฿{formatCurrency(cashFlows.financing.total)}
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-blue-100">เงินสดเปลี่ยนแปลงสุทธิ</span>
            <Wallet size={18} className="text-white" />
          </div>
          <p className="text-xl font-bold">
            ฿{formatCurrency(cashFlows.netChange)}
          </p>
        </div>
      </div>

      {/* Report Title */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-6 text-center">
        <h3 className="text-lg font-bold text-slate-800">
          {clients.find(c => c.id === selectedClientId)?.name || 'บริษัท'}
        </h3>
        <p className="text-sm text-slate-600">งบกระแสเงินสด</p>
        <p className="text-sm text-slate-500">สำหรับ{getPeriodLabel()}</p>
        <p className="text-xs text-slate-400 mt-1">(หน่วย: บาท)</p>
      </div>

      {/* Cash Flow Sections */}
      <div className="space-y-4">
        {/* Operating Activities */}
        {renderCashFlowSection(
          'กระแสเงินสดจากกิจกรรมดำเนินงาน',
          'Cash flows from operating activities',
          <Factory className="text-blue-600" size={24} />,
          'operating',
          CASH_FLOW_MAPPING.operating
        )}

        {/* Investing Activities */}
        {renderCashFlowSection(
          'กระแสเงินสดจากกิจกรรมลงทุน',
          'Cash flows from investing activities',
          <TrendingUp className="text-purple-600" size={24} />,
          'investing',
          CASH_FLOW_MAPPING.investing
        )}

        {/* Financing Activities */}
        {renderCashFlowSection(
          'กระแสเงินสดจากกิจกรรมจัดหาเงิน',
          'Cash flows from financing activities',
          <Landmark className="text-amber-600" size={24} />,
          'financing',
          CASH_FLOW_MAPPING.financing
        )}

        {/* Summary */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 text-white">
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-slate-300 mb-1">เงินสดต้นงวด</p>
              <p className="text-xl font-bold">฿{formatCurrency(cashFlows.beginningCash)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-300 mb-1">เงินสดเพิ่ม (ลด) สุทธิ</p>
              <p className={`text-xl font-bold ${cashFlows.netChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {cashFlows.netChange >= 0 ? '+' : ''}฿{formatCurrency(cashFlows.netChange)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-300 mb-1">เงินสดปลายงวด</p>
              <p className="text-xl font-bold text-blue-300">
                ฿{formatCurrency(cashFlows.beginningCash + cashFlows.netChange)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold mb-1">หมายเหตุประกอบงบกระแสเงินสด</p>
            <ul className="list-disc list-inside space-y-1 text-amber-700">
              <li>งบกระแสเงินสดนี้จัดทำตามวิธี{method === 'direct' ? 'ทางตรง' : 'ทางอ้อม'}</li>
              <li>รายการที่ไม่ใช่เงินสด เช่น ค่าเสื่อมราคา ไม่รวมในงบนี้</li>
              <li>ตัวเลขในวงเล็บหมายถึงเงินสดไหลออก</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CashFlowStatement;

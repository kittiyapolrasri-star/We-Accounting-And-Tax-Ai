import React, { useMemo } from 'react';
import { PostedGLEntry } from '../types';
import { ArrowDown, ArrowUp, Download, PieChart, TrendingUp, TrendingDown, ChevronRight } from 'lucide-react';

interface Props {
  entries: PostedGLEntry[];
  onDrillDown: (accountCode: string) => void;
}

const ProfitAndLoss: React.FC<Props> = ({ entries, onDrillDown }) => {
  const plData = useMemo(() => {
    // Helper to sum by prefix
    const sumByPrefix = (prefix: string) => {
        return entries
            .filter(e => e.account_code.startsWith(prefix))
            .reduce((sum, e) => {
                // Revenue (4) = Credit - Debit
                if (prefix.startsWith('4')) return sum + (e.credit - e.debit);
                // Expense (5) = Debit - Credit
                return sum + (e.debit - e.credit);
            }, 0);
    };

    const revenue = sumByPrefix('4');
    const costOfServices = sumByPrefix('51');
    const grossProfit = revenue - costOfServices;
    
    const adminExpense = sumByPrefix('52');
    const sellingExpense = sumByPrefix('53'); // Assuming 53 is selling/marketing based on standard mapping if available, or included in 52
    const totalOperatingExpense = adminExpense + sellingExpense;
    
    const netProfit = grossProfit - totalOperatingExpense;

    // Get breakdown for details
    const getAccountBreakdown = (prefix: string) => {
        const accounts: {[code: string]: {name: string, amount: number}} = {};
        entries.filter(e => e.account_code.startsWith(prefix)).forEach(e => {
            if (!accounts[e.account_code]) accounts[e.account_code] = { name: e.account_name, amount: 0 };
            if (prefix.startsWith('4')) {
                accounts[e.account_code].amount += (e.credit - e.debit);
            } else {
                accounts[e.account_code].amount += (e.debit - e.credit);
            }
        });
        return Object.entries(accounts).map(([code, val]) => ({ code, ...val })).sort((a,b) => b.amount - a.amount);
    };

    return {
        revenue,
        revenueBreakdown: getAccountBreakdown('4'),
        costOfServices,
        costBreakdown: getAccountBreakdown('51'),
        grossProfit,
        grossProfitMargin: revenue ? (grossProfit / revenue) * 100 : 0,
        adminExpense,
        adminBreakdown: getAccountBreakdown('52'),
        netProfit,
        netProfitMargin: revenue ? (netProfit / revenue) * 100 : 0,
    };
  }, [entries]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full animate-in fade-in duration-500">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <div>
           <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
               <PieChart className="text-blue-600" size={20} />
               งบกำไรขาดทุน (Profit & Loss)
           </h3>
           <p className="text-sm text-slate-500">ผลการดำเนินงานประจำงวด (Operational Performance)</p>
        </div>
        <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors shadow-sm text-slate-600">
                <Download size={16} /> PDF
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
         <div className="max-w-4xl mx-auto space-y-6">
            
            {/* Header Summary */}
            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className={`p-6 rounded-2xl border ${plData.netProfit >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'} flex flex-col items-center text-center`}>
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Net Profit (กำไรสุทธิ)</span>
                    <span className={`text-3xl font-bold ${plData.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(plData.netProfit)}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full mt-2 ${plData.netProfit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {plData.netProfitMargin.toFixed(1)}% Margin
                    </span>
                </div>
                <div className="p-6 rounded-2xl border bg-blue-50 border-blue-100 flex flex-col items-center text-center">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Total Revenue (รายได้รวม)</span>
                    <span className="text-3xl font-bold text-blue-600">
                        {formatCurrency(plData.revenue)}
                    </span>
                     <span className="text-xs font-semibold px-2 py-1 rounded-full mt-2 bg-blue-100 text-blue-700">
                        100% Base
                    </span>
                </div>
            </div>

            {/* Statement Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
                {/* 1. Revenue */}
                <div className="bg-slate-50 px-6 py-3 border-b border-slate-100 flex justify-between items-center font-bold text-slate-700">
                    <span>รายได้ (Revenue)</span>
                    <span>{formatCurrency(plData.revenue)}</span>
                </div>
                <div className="divide-y divide-slate-50">
                    {plData.revenueBreakdown.map(item => (
                        <div 
                            key={item.code} 
                            onClick={() => onDrillDown(item.code)}
                            className="px-6 py-3 bg-white hover:bg-blue-50 cursor-pointer flex justify-between items-center text-sm group transition-colors"
                        >
                            <span className="text-slate-600 group-hover:text-blue-600 flex items-center gap-2">
                                <span className="font-mono text-xs text-slate-400 bg-slate-100 px-1 rounded">{item.code}</span>
                                {item.name}
                            </span>
                            <span className="font-mono text-slate-800">{formatCurrency(item.amount)}</span>
                        </div>
                    ))}
                    {plData.revenueBreakdown.length === 0 && <div className="px-6 py-4 text-center text-slate-400 text-sm italic">ไม่มีรายการรายได้</div>}
                </div>

                {/* 2. Cost of Services */}
                <div className="bg-slate-50 px-6 py-3 border-y border-slate-100 flex justify-between items-center font-bold text-slate-700 mt-2">
                    <span>ต้นทุนขาย/บริการ (Cost of Goods Sold)</span>
                    <span className="text-red-600">({formatCurrency(plData.costOfServices)})</span>
                </div>
                <div className="divide-y divide-slate-50">
                    {plData.costBreakdown.map(item => (
                        <div 
                            key={item.code} 
                            onClick={() => onDrillDown(item.code)}
                            className="px-6 py-3 bg-white hover:bg-blue-50 cursor-pointer flex justify-between items-center text-sm group transition-colors"
                        >
                           <span className="text-slate-600 group-hover:text-blue-600 flex items-center gap-2">
                                <span className="font-mono text-xs text-slate-400 bg-slate-100 px-1 rounded">{item.code}</span>
                                {item.name}
                            </span>
                            <span className="font-mono text-slate-800">({formatCurrency(item.amount)})</span>
                        </div>
                    ))}
                     {plData.costBreakdown.length === 0 && <div className="px-6 py-4 text-center text-slate-400 text-sm italic">ไม่มีรายการต้นทุน</div>}
                </div>

                {/* GROSS PROFIT LINE */}
                <div className="bg-indigo-50/50 px-6 py-4 border-y border-indigo-100 flex justify-between items-center">
                    <div>
                        <span className="font-bold text-indigo-900">กำไรขั้นต้น (Gross Profit)</span>
                        <span className="text-xs text-indigo-500 ml-2 font-semibold">({plData.grossProfitMargin.toFixed(1)}%)</span>
                    </div>
                    <span className="font-bold text-indigo-900 text-lg">{formatCurrency(plData.grossProfit)}</span>
                </div>

                {/* 3. Admin Expense */}
                <div className="bg-slate-50 px-6 py-3 border-b border-slate-100 flex justify-between items-center font-bold text-slate-700">
                    <span>ค่าใช้จ่ายในการบริหาร (Admin Expenses)</span>
                    <span className="text-red-600">({formatCurrency(plData.adminExpense)})</span>
                </div>
                 <div className="divide-y divide-slate-50">
                    {plData.adminBreakdown.map(item => (
                        <div 
                            key={item.code} 
                            onClick={() => onDrillDown(item.code)}
                            className="px-6 py-3 bg-white hover:bg-blue-50 cursor-pointer flex justify-between items-center text-sm group transition-colors"
                        >
                            <span className="text-slate-600 group-hover:text-blue-600 flex items-center gap-2">
                                <span className="font-mono text-xs text-slate-400 bg-slate-100 px-1 rounded">{item.code}</span>
                                {item.name}
                            </span>
                            <span className="font-mono text-slate-800">({formatCurrency(item.amount)})</span>
                        </div>
                    ))}
                     {plData.adminBreakdown.length === 0 && <div className="px-6 py-4 text-center text-slate-400 text-sm italic">ไม่มีรายการค่าใช้จ่าย</div>}
                </div>

                {/* NET PROFIT LINE */}
                <div className={`px-6 py-5 border-t-2 flex justify-between items-center ${plData.netProfit >= 0 ? 'bg-emerald-50 border-emerald-500' : 'bg-red-50 border-red-500'}`}>
                     <div>
                        <span className={`font-bold text-lg ${plData.netProfit >= 0 ? 'text-emerald-900' : 'text-red-900'}`}>กำไร(ขาดทุน) สุทธิ (Net Profit)</span>
                        <span className={`text-xs ml-2 font-semibold ${plData.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>({plData.netProfitMargin.toFixed(1)}%)</span>
                    </div>
                    <span className={`font-bold text-2xl ${plData.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatCurrency(plData.netProfit)}</span>
                </div>

            </div>
         </div>
      </div>
    </div>
  );
};

export default ProfitAndLoss;
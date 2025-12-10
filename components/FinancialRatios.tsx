import React, { useMemo } from 'react';
import { PostedGLEntry } from '../types';
import { TrendingUp, Activity, PieChart, AlertCircle, ArrowRight, BrainCircuit } from 'lucide-react';

interface Props {
  entries: PostedGLEntry[];
}

const FinancialRatios: React.FC<Props> = ({ entries }) => {
  const analysis = useMemo(() => {
    const sumByPrefix = (prefix: string) => {
        return entries
            .filter(e => e.account_code.startsWith(prefix))
            .reduce((sum, e) => {
                const firstDigit = prefix.charAt(0);
                if (firstDigit === '1' || firstDigit === '5') return sum + (e.debit - e.credit);
                return sum + (e.credit - e.debit);
            }, 0);
    };

    const currentAssets = sumByPrefix('11');
    const currentLiabilities = sumByPrefix('21');
    const totalLiabilities = sumByPrefix('2');
    const totalEquity = sumByPrefix('3') + (sumByPrefix('4') - sumByPrefix('5'));
    const revenue = sumByPrefix('4');
    const netProfit = revenue - sumByPrefix('5');

    // Ratios
    const currentRatio = currentLiabilities ? (currentAssets / currentLiabilities) : 0;
    const netMargin = revenue ? (netProfit / revenue) * 100 : 0;
    const deRatio = totalEquity ? (totalLiabilities / totalEquity) : 0;

    return {
        currentRatio,
        netMargin,
        deRatio,
        revenue,
        netProfit
    };
  }, [entries]);

  const getStatusColor = (val: number, type: 'liquidity' | 'profit' | 'debt') => {
      if (type === 'liquidity') return val >= 1.5 ? 'text-emerald-500' : val >= 1 ? 'text-amber-500' : 'text-red-500';
      if (type === 'profit') return val >= 20 ? 'text-emerald-500' : val >= 0 ? 'text-blue-500' : 'text-red-500';
      if (type === 'debt') return val <= 1 ? 'text-emerald-500' : val <= 2 ? 'text-amber-500' : 'text-red-500';
      return 'text-slate-500';
  };

  const getAIInsight = () => {
      if (analysis.netMargin < 0) return "Warning: The company is operating at a loss. Review cost structure immediately.";
      if (analysis.currentRatio < 1) return "Alert: Liquidity is tight (Current Ratio < 1). Monitor cash flow closely.";
      if (analysis.netMargin > 30) return "Excellent Performance: High net margin indicates strong competitive advantage.";
      return "Stable Performance: Financial health is within standard range.";
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 animate-in fade-in slide-in-from-right-4 duration-700 delay-100">
       <div className="flex items-center gap-2 mb-6">
           <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg text-white shadow-md">
               <BrainCircuit size={20} />
           </div>
           <div>
               <h3 className="font-bold text-slate-800">AI Financial Health Check</h3>
               <p className="text-xs text-slate-500">วิเคราะห์สุขภาพทางการเงินอัตโนมัติ</p>
           </div>
       </div>

       <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-6 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-2 opacity-10">
               <Activity size={64} />
           </div>
           <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">AI Insight</p>
           <p className="text-sm font-medium text-slate-700 leading-relaxed flex items-start gap-2">
               <span className="mt-1 w-2 h-2 rounded-full bg-indigo-500 shrink-0 animate-pulse"></span>
               {getAIInsight()}
           </p>
       </div>

       <div className="space-y-6">
           {/* Current Ratio */}
           <div>
               <div className="flex justify-between items-end mb-1">
                   <span className="text-xs text-slate-500 font-medium">Current Ratio (สภาพคล่อง)</span>
                   <span className={`text-xl font-bold font-mono ${getStatusColor(analysis.currentRatio, 'liquidity')}`}>
                       {analysis.currentRatio.toFixed(2)}x
                   </span>
               </div>
               <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                   <div className={`h-full rounded-full ${getStatusColor(analysis.currentRatio, 'liquidity').replace('text', 'bg')}`} 
                        style={{width: `${Math.min(analysis.currentRatio * 30, 100)}%`}}></div>
               </div>
               <p className="text-[10px] text-slate-400 mt-1">Target: &gt; 1.5x</p>
           </div>

           {/* Net Margin */}
           <div>
               <div className="flex justify-between items-end mb-1">
                   <span className="text-xs text-slate-500 font-medium">Net Profit Margin (กำไรสุทธิ)</span>
                   <span className={`text-xl font-bold font-mono ${getStatusColor(analysis.netMargin, 'profit')}`}>
                       {analysis.netMargin.toFixed(1)}%
                   </span>
               </div>
               <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                   <div className={`h-full rounded-full ${getStatusColor(analysis.netMargin, 'profit').replace('text', 'bg')}`} 
                        style={{width: `${Math.max(Math.min(analysis.netMargin, 100), 0)}%`}}></div>
               </div>
               <p className="text-[10px] text-slate-400 mt-1">Industry Avg: 15%</p>
           </div>

           {/* D/E Ratio */}
           <div>
               <div className="flex justify-between items-end mb-1">
                   <span className="text-xs text-slate-500 font-medium">D/E Ratio (หนี้สินต่อทุน)</span>
                   <span className={`text-xl font-bold font-mono ${getStatusColor(analysis.deRatio, 'debt')}`}>
                       {analysis.deRatio.toFixed(2)}x
                   </span>
               </div>
               <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                   <div className={`h-full rounded-full ${getStatusColor(analysis.deRatio, 'debt').replace('text', 'bg')}`} 
                        style={{width: `${Math.min(analysis.deRatio * 40, 100)}%`}}></div>
               </div>
               <p className="text-[10px] text-slate-400 mt-1">Target: &lt; 1.0x</p>
           </div>
       </div>

       <button className="w-full mt-6 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
           View Full Analysis <ArrowRight size={12} />
       </button>
    </div>
  );
};

export default FinancialRatios;
import React from 'react';
import { Financials, TaxCompliance } from '../types';
import { Calculator, Percent, DollarSign, FileCheck } from 'lucide-react';

interface Props {
  financials: Financials;
  compliance: TaxCompliance;
}

const FinancialSummary: React.FC<Props> = ({ financials, compliance }) => {
  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '-';
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amount);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-white p-5 rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col justify-between hover:border-blue-200 transition-colors group">
        <div className="flex items-center gap-3 mb-2">
           <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
             <Calculator size={18} />
           </div>
           <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Subtotal</span>
        </div>
        <p className="text-2xl font-bold text-slate-800 tracking-tight">{formatCurrency(financials.subtotal)}</p>
      </div>

      <div className="bg-white p-5 rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col justify-between hover:border-emerald-200 transition-colors group">
         <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <Percent size={18} />
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">VAT ({financials.vat_rate}%)</span>
            </div>
            {compliance.vat_claimable ? (
                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">Claimable</span>
            ) : (
                <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">Non-Claim</span>
            )}
         </div>
         <p className="text-2xl font-bold text-slate-800 tracking-tight">{formatCurrency(financials.vat_amount)}</p>
      </div>

      <div className="bg-white p-5 rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col justify-between hover:border-indigo-200 transition-colors group">
        <div className="flex items-center gap-3 mb-2">
           <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
             <DollarSign size={18} />
           </div>
           <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Grand Total</span>
        </div>
        <p className="text-2xl font-bold text-slate-800 tracking-tight">{formatCurrency(financials.grand_total)}</p>
      </div>

      <div className="bg-white p-5 rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col justify-between">
        <div className="flex items-center gap-3 mb-2">
           <div className={`p-2 rounded-lg transition-colors ${compliance.is_full_tax_invoice ? 'bg-teal-50 text-teal-600' : 'bg-orange-50 text-orange-600'}`}>
             <FileCheck size={18} />
           </div>
           <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Compliance</span>
        </div>
        <div className="flex flex-col items-start">
             <p className="text-sm font-bold text-slate-800">
                {compliance.is_full_tax_invoice ? 'Tax Invoice (Full)' : 'Abbreviated/Receipt'}
             </p>
             {compliance.wht_flag && (
                <span className="text-[10px] text-orange-600 font-semibold flex items-center gap-1 mt-1">
                    • WHT Required
                </span>
             )}
        </div>
      </div>
    </div>
  );
};

export default FinancialSummary;
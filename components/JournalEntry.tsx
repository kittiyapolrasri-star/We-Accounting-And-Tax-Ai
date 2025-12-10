import React from 'react';
import { AccountingEntry } from '../types';

interface Props {
  entry: AccountingEntry;
}

const JournalEntry: React.FC<Props> = ({ entry }) => {
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  };

  const totalDr = entry.journal_lines
    .filter(line => line.account_side === 'DEBIT')
    .reduce((sum, line) => sum + line.amount, 0);

  const totalCr = entry.journal_lines
    .filter(line => line.account_side === 'CREDIT')
    .reduce((sum, line) => sum + line.amount, 0);

  const isBalanced = Math.abs(totalDr - totalCr) < 0.05;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <span className="text-blue-600">GL Entry:</span> {entry.transaction_description}
        </h3>
        <p className="text-sm text-slate-500 mt-1">Class: {entry.account_class}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 w-1/2">Account Name (Thai)</th>
              <th className="px-6 py-3 text-right">Debit (THB)</th>
              <th className="px-6 py-3 text-right">Credit (THB)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entry.journal_lines.map((line, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-3">
                  <div className={`font-medium ${line.account_side === 'CREDIT' ? 'pl-8' : 'text-slate-800'}`}>
                    {line.account_name_th}
                  </div>
                </td>
                <td className="px-6 py-3 text-right font-mono text-slate-700">
                  {line.account_side === 'DEBIT' ? formatNumber(line.amount) : ''}
                </td>
                <td className="px-6 py-3 text-right font-mono text-slate-700">
                  {line.account_side === 'CREDIT' ? formatNumber(line.amount) : ''}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-semibold text-slate-800 border-t border-slate-200">
            <tr>
              <td className="px-6 py-3 text-right">Total</td>
              <td className={`px-6 py-3 text-right font-mono ${!isBalanced ? 'text-red-500' : 'text-emerald-600'}`}>
                {formatNumber(totalDr)}
              </td>
              <td className={`px-6 py-3 text-right font-mono ${!isBalanced ? 'text-red-500' : 'text-emerald-600'}`}>
                {formatNumber(totalCr)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      
      {!isBalanced && (
        <div className="bg-red-50 px-6 py-2 text-red-600 text-xs font-semibold border-t border-red-100">
          WARNING: Journal entry is not balanced.
        </div>
      )}
    </div>
  );
};

export default JournalEntry;
import React, { useMemo } from 'react';
import { PostedGLEntry } from '../types';
import { ArrowDown, ArrowUp, Download, ZoomIn, FileSpreadsheet } from 'lucide-react';

interface Props {
  entries: PostedGLEntry[];
  onDrillDown?: (accountCode: string) => void;
}

interface AccountSummary {
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
}

const TrialBalance: React.FC<Props> = ({ entries, onDrillDown }) => {
  const summary = useMemo(() => {
    const accMap = new Map<string, AccountSummary>();

    entries.forEach(entry => {
      if (!accMap.has(entry.account_code)) {
        // Determine approximate type based on first digit
        const firstDigit = entry.account_code.charAt(0);
        let type = 'Other';
        if (firstDigit === '1') type = 'Asset';
        else if (firstDigit === '2') type = 'Liability';
        else if (firstDigit === '3') type = 'Equity';
        else if (firstDigit === '4') type = 'Revenue';
        else if (firstDigit === '5') type = 'Expense';

        accMap.set(entry.account_code, {
          code: entry.account_code,
          name: entry.account_name,
          type,
          debit: 0,
          credit: 0,
          balance: 0
        });
      }

      const acc = accMap.get(entry.account_code)!;
      acc.debit += entry.debit;
      acc.credit += entry.credit;
    });

    return Array.from(accMap.values()).map(acc => {
      // Basic logic: Asset/Expense = Dr - Cr, Others = Cr - Dr
      if (acc.type === 'Asset' || acc.type === 'Expense') {
        acc.balance = acc.debit - acc.credit;
      } else {
        acc.balance = acc.credit - acc.debit;
      }
      return acc;
    }).sort((a, b) => a.code.localeCompare(b.code));

  }, [entries]);

  const totalDr = summary.reduce((sum, acc) => sum + acc.debit, 0);
  const totalCr = summary.reduce((sum, acc) => sum + acc.credit, 0);

  const handleExportExpress = () => {
    // Logic to create a mock Express Import File (Text file with specific format)
    // Example Format: DocNo, Date, AccCode, Amount, DrCr
    const header = "DocNo|Date|AccCode|Desc|Amount|DrCr\n";
    const rows = entries.map(e =>
      `${e.doc_no}|${e.date}|${e.account_code}|${e.description}|${e.debit > 0 ? e.debit : e.credit}|${e.debit > 0 ? 'DR' : 'CR'}`
    ).join('\n');

    const blob = new Blob([header + rows], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `EXPRESS_IMPORT_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full animate-in fade-in duration-500">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <div>
          <h3 className="font-bold text-slate-800 text-lg">งบทดลอง (Trial Balance)</h3>
          <p className="text-sm text-slate-500">สถานะการเงิน Real-time จากรายการบันทึกบัญชี</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportExpress}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-200"
          >
            <FileSpreadsheet size={16} /> Export to Express
          </button>
          <button
            onClick={() => {
              const csvHeader = 'รหัสบัญชี,ชื่อบัญชี,หมวด,เดบิต,เครดิต,คงเหลือ\n';
              const csvRows = summary.map(acc =>
                `${acc.code},${acc.name},${acc.type},${acc.debit},${acc.credit},${acc.balance}`
              ).join('\n');
              const blob = new Blob(['\uFEFF' + csvHeader + csvRows], { type: 'text/csv;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `TrialBalance_${new Date().toISOString().split('T')[0]}.csv`;
              link.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors shadow-sm text-slate-600"
          >
            <Download size={16} /> Excel
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-white text-slate-500 font-semibold border-b border-slate-100 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-6 py-4 w-32">รหัสบัญชี</th>
              <th className="px-6 py-4">ชื่อบัญชี</th>
              <th className="px-6 py-4 w-32">หมวด</th>
              <th className="px-6 py-4 text-right bg-slate-50/50">เดบิต (Dr.)</th>
              <th className="px-6 py-4 text-right bg-slate-50/50">เครดิต (Cr.)</th>
              <th className="px-6 py-4 text-right font-bold w-40">คงเหลือ (Net)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {summary.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">ยังไม่มีรายการบัญชี</td></tr>
            ) : summary.map((acc) => (
              <tr
                key={acc.code}
                onClick={() => onDrillDown && onDrillDown(acc.code)}
                className="hover:bg-blue-50 cursor-pointer group transition-colors"
                title="Click to view details"
              >
                <td className="px-6 py-3 font-mono text-slate-600 font-medium group-hover:text-blue-600 flex items-center gap-2">
                  {acc.code}
                  <ZoomIn size={12} className="opacity-0 group-hover:opacity-100 text-blue-400" />
                </td>
                <td className="px-6 py-3 text-slate-800 font-medium">{acc.name}</td>
                <td className="px-6 py-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${acc.type === 'Asset' ? 'bg-emerald-50 text-emerald-600' :
                      acc.type === 'Liability' ? 'bg-amber-50 text-amber-600' :
                        acc.type === 'Equity' ? 'bg-purple-50 text-purple-600' :
                          acc.type === 'Revenue' ? 'bg-blue-50 text-blue-600' :
                            'bg-rose-50 text-rose-600'
                    }`}>
                    {acc.type}
                  </span>
                </td>
                <td className="px-6 py-3 text-right font-mono text-slate-500 group-hover:text-slate-700">{acc.debit > 0 ? acc.debit.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '-'}</td>
                <td className="px-6 py-3 text-right font-mono text-slate-500 group-hover:text-slate-700">{acc.credit > 0 ? acc.credit.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '-'}</td>
                <td className="px-6 py-3 text-right font-mono font-bold text-slate-800">
                  {acc.balance.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-100 font-bold text-slate-800 border-t-2 border-slate-200">
            <tr>
              <td colSpan={3} className="px-6 py-4 text-right uppercase tracking-wider text-xs">Total Summary</td>
              <td className="px-6 py-4 text-right font-mono text-blue-700">{totalDr.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
              <td className="px-6 py-4 text-right font-mono text-blue-700">{totalCr.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
              <td className="px-6 py-4 text-right">
                {Math.abs(totalDr - totalCr) < 0.01 ? (
                  <span className="flex items-center justify-end gap-1 text-emerald-600 text-xs">
                    <ArrowDown size={14} className="rotate-45" /> Balanced
                  </span>
                ) : (
                  <span className="text-red-600 text-xs">Diff: {(totalDr - totalCr).toFixed(2)}</span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default TrialBalance;
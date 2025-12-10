import React, { useState, useEffect, useRef } from 'react';
import { AccountingEntry, JournalLine } from '../types';
import { Plus, Trash2, Search, ChevronDown, Building2, Zap, LayoutTemplate, Wand2 } from 'lucide-react';
import { THAI_GL_CODES } from '../constants';

interface Props {
  entry: AccountingEntry;
  onChange: (updatedEntry: AccountingEntry) => void;
}

// Complex Accounting Templates
const TEMPLATES = [
    {
        name: 'จ่ายเงินเดือน (Payroll)',
        description: 'เงินเดือน + ประกันสังคม + ภาษีหัก ณ ที่จ่าย (ภ.ง.ด.1)',
        lines: [
            { account_code: '52000', account_name_th: 'เงินเดือนและค่าแรง (Salary)', account_side: 'DEBIT', amount: 0 },
            { account_code: '52010', account_name_th: 'เงินสมทบกองทุนประกันสังคม (Social Security Exp)', account_side: 'DEBIT', amount: 0 },
            { account_code: '21310', account_name_th: 'เงินประกันสังคมค้างจ่าย (Social Security Payable)', account_side: 'CREDIT', amount: 0 },
            { account_code: '21410', account_name_th: 'ภาษีหัก ณ ที่จ่ายค้างจ่าย - ภ.ง.ด.1 (WHT PND1)', account_side: 'CREDIT', amount: 0 },
            { account_code: '11120', account_name_th: 'เงินฝากธนาคาร (Bank Deposit)', account_side: 'CREDIT', amount: 0 },
        ]
    },
    {
        name: 'ซื้อทรัพย์สิน (Fixed Asset Purchase)',
        description: 'บันทึกสินทรัพย์ + ภาษีซื้อ + เจ้าหนี้/เงินสด',
        lines: [
            { account_code: '12400', account_name_th: 'เครื่องใช้สำนักงาน (Office Equipment)', account_side: 'DEBIT', amount: 0 },
            { account_code: '11540', account_name_th: 'ภาษีซื้อ (Input VAT)', account_side: 'DEBIT', amount: 0 },
            { account_code: '21200', account_name_th: 'เจ้าหนี้การค้า (Accounts Payable)', account_side: 'CREDIT', amount: 0 },
        ]
    },
    {
        name: 'ค่ารับรอง (Entertainment)',
        description: 'ค่ารับรอง (รวม VAT ไม่ขอคืน) + หัก ณ ที่จ่าย',
        lines: [
            { account_code: '52900', account_name_th: 'ค่ารับรอง (Entertainment)', account_side: 'DEBIT', amount: 0 },
            { account_code: '53000', account_name_th: 'ภาษีซื้อต้องห้าม (Non-deductible VAT)', account_side: 'DEBIT', amount: 0 },
            { account_code: '21400', account_name_th: 'ภาษีหัก ณ ที่จ่ายรอนำส่ง (WHT Payable)', account_side: 'CREDIT', amount: 0 },
            { account_code: '11100', account_name_th: 'เงินสด (Cash)', account_side: 'CREDIT', amount: 0 },
        ]
    }
];

const JournalEntryEditor: React.FC<Props> = ({ entry, onChange }) => {
  const [lines, setLines] = useState<JournalLine[]>(entry.journal_lines);
  const [suggestionIndex, setSuggestionIndex] = useState<number | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const templateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onChange({ ...entry, journal_lines: lines });
  }, [lines]);

  // Handle click outside for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setSuggestionIndex(null);
      }
      if (templateRef.current && !templateRef.current.contains(event.target as Node)) {
        setShowTemplates(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  const totalDr = lines
    .filter(l => l.account_side === 'DEBIT')
    .reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

  const totalCr = lines
    .filter(l => l.account_side === 'CREDIT')
    .reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

  const diff = totalDr - totalCr;
  const isBalanced = Math.abs(diff) < 0.05;

  const handleLineChange = (index: number, field: keyof JournalLine, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const handleAccountSelect = (index: number, code: string, name: string) => {
      const newLines = [...lines];
      newLines[index] = { ...newLines[index], account_code: code, account_name_th: name };
      setLines(newLines);
      setSuggestionIndex(null);
  };

  const removeLine = (index: number) => {
    const newLines = lines.filter((_, i) => i !== index);
    setLines(newLines);
  };

  const addLine = () => {
    setLines([...lines, { 
      account_code: '', 
      account_side: 'DEBIT', 
      account_name_th: '', 
      department_code: '',
      amount: 0 
    }]);
  };

  const applyTemplate = (templateLines: any[]) => {
      // Convert template lines to JournalLine type
      const newLines: JournalLine[] = templateLines.map(l => ({
          account_code: l.account_code,
          account_name_th: l.account_name_th,
          account_side: l.account_side as 'DEBIT' | 'CREDIT',
          amount: l.amount,
          department_code: ''
      }));
      setLines(newLines);
      setShowTemplates(false);
  };

  const filterGL = (query: string) => {
      if (!query) return [];
      const lowerQuery = query.toLowerCase();
      return THAI_GL_CODES.filter(gl => 
        gl.code.startsWith(lowerQuery) || 
        gl.name.toLowerCase().includes(lowerQuery)
      );
  };

  return (
    <div className="bg-white rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] border border-slate-100 overflow-visible flex flex-col h-full relative">
      {/* Header - White Theme */}
      <div className="bg-white px-6 py-4 border-b border-slate-100 flex justify-between items-center rounded-t-xl">
        <div>
           <h3 className="text-lg font-bold text-slate-800 tracking-tight">สมุดรายวัน (Journal Entry)</h3>
           <p className="text-xs text-slate-400 mt-0.5">ตรวจสอบการบันทึกบัญชีแยกประเภท (GL Posting)</p>
        </div>
        
        <div className="flex items-center gap-3">
             {/* Templates Button */}
             <div className="relative" ref={templateRef}>
                <button 
                    onClick={() => setShowTemplates(!showTemplates)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors border border-indigo-100"
                >
                    <LayoutTemplate size={14} /> แม่แบบ (Templates)
                </button>
                
                {showTemplates && (
                    <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                        <div className="p-3 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            เลือกแม่แบบรายการ (Select Template)
                        </div>
                        <div className="divide-y divide-slate-50">
                            {TEMPLATES.map((t, idx) => (
                                <div 
                                    key={idx} 
                                    onClick={() => applyTemplate(t.lines)}
                                    className="p-3 hover:bg-blue-50 cursor-pointer group transition-colors"
                                >
                                    <div className="flex items-center gap-2 font-bold text-slate-700 group-hover:text-blue-700 text-sm">
                                        <Zap size={12} className="text-amber-500 fill-amber-500"/> {t.name}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-1 pl-5">
                                        {t.description}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
             </div>

            {!isBalanced && (
                <div className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold animate-pulse border border-red-100">
                    ยอดไม่ดุล (Diff): {diff.toFixed(2)}
                </div>
            )}
        </div>
      </div>

      <div className="overflow-visible flex-1 p-4">
        <table className="w-full text-left text-sm">
          <thead className="text-slate-400 font-semibold border-b border-slate-100">
            <tr>
              <th className="px-3 py-3 w-20 text-xs uppercase tracking-wider">รหัสบัญชี</th>
              <th className="px-3 py-3 text-xs uppercase tracking-wider">ชื่อบัญชี</th>
              <th className="px-3 py-3 w-28 text-xs uppercase tracking-wider">แผนก/Job</th>
              <th className="px-3 py-3 w-32 text-right text-xs uppercase tracking-wider">เดบิต</th>
              <th className="px-3 py-3 w-32 text-right text-xs uppercase tracking-wider">เครดิต</th>
              <th className="px-3 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {lines.map((line, idx) => (
              <tr key={idx} className="group hover:bg-slate-50/50 transition-colors relative">
                {/* GL Code */}
                <td className="p-3 align-top relative">
                    <input 
                        type="text" 
                        value={line.account_code}
                        onChange={(e) => handleLineChange(idx, 'account_code', e.target.value)}
                        className={`w-full border-none rounded-lg px-3 py-2 text-slate-700 font-mono text-xs focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all placeholder-slate-300 ${line.auto_mapped ? 'bg-indigo-50/50 ring-1 ring-indigo-200' : 'bg-slate-50'}`}
                        placeholder="Code"
                    />
                    {line.auto_mapped && (
                        <div className="absolute top-1 right-1 text-indigo-500" title="Auto-mapped by Vendor Rule">
                            <Wand2 size={10} />
                        </div>
                    )}
                </td>

                {/* Account Name & Search */}
                <td className="p-3 relative align-top">
                    <div className="relative">
                        <input 
                            type="text" 
                            value={line.account_name_th}
                            onFocus={() => setSuggestionIndex(idx)}
                            onChange={(e) => handleLineChange(idx, 'account_name_th', e.target.value)}
                            className={`w-full bg-slate-50 border-none rounded-lg px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all placeholder-slate-300 ${line.account_side === 'CREDIT' ? 'pl-8' : ''}`}
                            placeholder="ค้นหาผังบัญชี..."
                        />
                         {line.account_side === 'CREDIT' && <div className="absolute left-3 top-3 w-3 h-px bg-slate-300"></div>}
                        
                        {/* Autocomplete Dropdown */}
                        {suggestionIndex === idx && (
                            <div ref={dropdownRef} className="absolute z-50 left-0 top-full mt-2 w-full bg-white border border-slate-100 rounded-xl shadow-xl max-h-56 overflow-y-auto ring-1 ring-slate-900/5">
                                {filterGL(line.account_name_th).length > 0 ? (
                                    filterGL(line.account_name_th).map((gl) => (
                                        <div 
                                            key={gl.code}
                                            onClick={() => handleAccountSelect(idx, gl.code, gl.name)}
                                            className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer flex justify-between items-center text-xs border-b border-slate-50 last:border-0"
                                        >
                                            <span className="font-medium text-slate-700">{gl.name}</span>
                                            <span className="text-slate-400 font-mono text-[10px]">{gl.code}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="px-4 py-3 text-xs text-slate-400">
                                        ไม่พบข้อมูล...
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </td>

                 {/* Department / Cost Center */}
                 <td className="p-3 align-top">
                    <input 
                        type="text" 
                        value={line.department_code || ''}
                        onChange={(e) => handleLineChange(idx, 'department_code', e.target.value)}
                        className="w-full bg-slate-50 border-none rounded-lg px-3 py-2 text-slate-600 text-xs focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all placeholder-slate-300"
                        placeholder="Cost Center"
                    />
                </td>

                {/* DR/CR */}
                <td className="p-3 text-right align-top">
                    {line.account_side === 'DEBIT' ? (
                        <input 
                            type="number" 
                            value={line.amount}
                            onChange={(e) => handleLineChange(idx, 'amount', parseFloat(e.target.value))}
                            className="w-full text-right bg-white border border-slate-200 rounded-lg px-3 py-2 font-mono text-slate-800 font-semibold focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none transition-all"
                        />
                    ) : (
                       <button onClick={() => handleLineChange(idx, 'account_side', 'DEBIT')} className="text-[10px] text-slate-300 hover:text-blue-600 mt-2 font-medium">สลับเป็น Dr.</button>
                    )}
                </td>
                <td className="p-3 text-right align-top">
                    {line.account_side === 'CREDIT' ? (
                        <input 
                            type="number" 
                            value={line.amount}
                            onChange={(e) => handleLineChange(idx, 'amount', parseFloat(e.target.value))}
                            className="w-full text-right bg-white border border-slate-200 rounded-lg px-3 py-2 font-mono text-slate-800 font-semibold focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none transition-all"
                        />
                    ) : (
                        <button onClick={() => handleLineChange(idx, 'account_side', 'CREDIT')} className="text-[10px] text-slate-300 hover:text-blue-600 mt-2 font-medium">สลับเป็น Cr.</button>
                    )}
                </td>
                <td className="p-3 text-center align-top pt-2.5">
                    <button onClick={() => removeLine(idx)} className="text-slate-300 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50">
                        <Trash2 size={14} />
                    </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={addLine} className="mt-6 w-full py-3 border border-dashed border-slate-200 rounded-xl text-slate-400 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all flex items-center justify-center gap-2 text-sm font-medium">
            <Plus size={16} /> เพิ่มรายการ (Add Line)
        </button>
      </div>

      <div className="bg-white p-6 border-t border-slate-100 mt-auto rounded-b-xl">
        <div className="flex justify-between items-center text-sm font-bold text-slate-700">
            <span className="text-slate-400 font-medium">ยอดรวม (Total)</span>
            <div className="flex gap-12 mr-14">
                <span className={`font-mono text-base ${isBalanced ? 'text-slate-800' : 'text-red-500'}`}>
                    {totalDr.toLocaleString('th-TH', {minimumFractionDigits: 2})}
                </span>
                <span className={`font-mono text-base ${isBalanced ? 'text-slate-800' : 'text-red-500'}`}>
                    {totalCr.toLocaleString('th-TH', {minimumFractionDigits: 2})}
                </span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default JournalEntryEditor;
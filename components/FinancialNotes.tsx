import React, { useMemo, useState } from 'react';
import { PostedGLEntry, Client } from '../types';
import { FileText, Download, Printer, BookOpen, PenTool, Edit3, Save } from 'lucide-react';

interface Props {
  client: Client;
  entries: PostedGLEntry[];
}

const FinancialNotes: React.FC<Props> = ({ client, entries }) => {
  // State for editable notes content
  const [generalInfo, setGeneralInfo] = useState(`${client.name} ("บริษัท") จัดตั้งขึ้นเป็นนิติบุคคลตามกฎหมายไทย ทะเบียนเลขที่ ${client.tax_id} ประกอบธุรกิจหลักเกี่ยวกับ ${client.industry} สำนักงานตั้งอยู่ที่ ${client.address || "กรุงเทพมหานคร"}`);
  const [basisInfo, setBasisInfo] = useState('งบการเงินนี้จัดทำขึ้นตามมาตรฐานการรายงานทางการเงินสำหรับกิจการที่ไม่มีส่วนได้เสียสาธารณะ (TFRS for NPAEs) ที่ออกโดยสภาวิชาชีพบัญชี ในพระบรมราชูปถัมภ์');
  
  const [isEditing, setIsEditing] = useState(false);

  const noteData = useMemo(() => {
    const sumByCode = (codePrefix: string) => {
        return entries
            .filter(e => e.account_code.startsWith(codePrefix))
            .reduce((sum, e) => {
                const firstDigit = codePrefix.charAt(0);
                if (firstDigit === '1' || firstDigit === '5') return sum + (e.debit - e.credit);
                return sum + (e.credit - e.debit);
            }, 0);
    };

    const cash = sumByCode('111');
    const ar = sumByCode('113');
    const inventory = sumByCode('114');
    const ppe = sumByCode('12');
    const ap = sumByCode('212');
    const revenue = sumByCode('4');
    
    return { cash, ar, inventory, ppe, ap, revenue };
  }, [entries]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(val);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full animate-in fade-in duration-500">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <div>
           <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
               <BookOpen className="text-blue-600" size={20} />
               หมายเหตุประกอบงบการเงิน (Notes to Financial Statements)
           </h3>
           <p className="text-sm text-slate-500">ร่างเอกสารสำหรับผู้สอบบัญชี (Editable Draft)</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => setIsEditing(!isEditing)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm ${isEditing ? 'bg-indigo-100 text-indigo-700' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
            >
                {isEditing ? <Save size={16} /> : <Edit3 size={16} />}
                {isEditing ? 'Done Editing' : 'Edit Notes'}
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-colors shadow-sm text-slate-600">
                <Printer size={16} /> Print
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-md">
                <Download size={16} /> Export PDF
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-12 bg-slate-50/50">
          <div className="max-w-4xl mx-auto bg-white p-12 shadow-lg min-h-[800px] relative">
              
              {/* Document Header */}
              <div className="text-center mb-12">
                  <h1 className="text-xl font-bold text-slate-900">{client.name}</h1>
                  <h2 className="text-lg font-semibold text-slate-700 mt-2">หมายเหตุประกอบงบการเงิน</h2>
                  <p className="text-slate-600 mt-1">สำหรับงวดบัญชีสิ้นสุดวันที่ {client.last_closing_date}</p>
              </div>

              {/* Note 1: General Info */}
              <div className="mb-8 group">
                  <h3 className="font-bold text-slate-800 border-b border-slate-200 pb-1 mb-3">1. ข้อมูลทั่วไป (General Information)</h3>
                  {isEditing ? (
                      <textarea 
                        className="w-full border border-blue-200 rounded-lg p-3 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                        rows={4}
                        value={generalInfo}
                        onChange={(e) => setGeneralInfo(e.target.value)}
                      />
                  ) : (
                      <p className="text-sm text-slate-600 leading-relaxed indent-8 text-justify">{generalInfo}</p>
                  )}
              </div>

              {/* Note 2: Basis of Preparation */}
              <div className="mb-8">
                  <h3 className="font-bold text-slate-800 border-b border-slate-200 pb-1 mb-3">2. เกณฑ์การจัดทำงบการเงิน (Basis of Preparation)</h3>
                  {isEditing ? (
                      <textarea 
                        className="w-full border border-blue-200 rounded-lg p-3 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                        rows={3}
                        value={basisInfo}
                        onChange={(e) => setBasisInfo(e.target.value)}
                      />
                  ) : (
                      <p className="text-sm text-slate-600 leading-relaxed indent-8 text-justify">{basisInfo}</p>
                  )}
              </div>

              {/* Note 3: Significant Policies */}
              <div className="mb-8">
                  <h3 className="font-bold text-slate-800 border-b border-slate-200 pb-1 mb-3">3. สรุปนโยบายการบัญชีที่สำคัญ (Significant Accounting Policies)</h3>
                  <ul className="list-disc pl-5 text-sm text-slate-600 space-y-2">
                      <li><span className="font-semibold">การรับรู้รายได้:</span> รับรู้รายได้เมื่อมีการส่งมอบสินค้าหรือให้บริการแก่ลูกค้าแล้ว (Accrual Basis)</li>
                      <li><span className="font-semibold">เงินสดและรายการเทียบเท่าเงินสด:</span> ประกอบด้วยเงินสดในมือและเงินฝากธนาคาร</li>
                      <li><span className="font-semibold">ที่ดิน อาคาร และอุปกรณ์:</span> แสดงในราคาทุนหักค่าเสื่อมราคาสะสม คำนวณค่าเสื่อมราคาโดยวิธีเส้นตรง (Straight-line method)</li>
                  </ul>
              </div>

              {/* Note 4: Cash & Equivalents */}
              <div className="mb-8">
                  <h3 className="font-bold text-slate-800 border-b border-slate-200 pb-1 mb-3">4. เงินสดและรายการเทียบเท่าเงินสด (Cash and Cash Equivalents)</h3>
                  <div className="flex justify-between items-end mb-2 text-sm">
                      <span>ประกอบด้วย:</span>
                      <span className="font-bold">{client.current_workflow.month.split('-')[0]}</span>
                  </div>
                  <div className="border-t border-slate-200 py-2">
                      <div className="flex justify-between text-sm">
                          <span>เงินสดและเงินฝากธนาคาร</span>
                          <span className="font-mono">{formatCurrency(noteData.cash)} บาท</span>
                      </div>
                  </div>
                  <div className="border-t border-b border-slate-400 py-2 font-bold flex justify-between text-sm bg-slate-50">
                      <span>รวม</span>
                      <span className="font-mono">{formatCurrency(noteData.cash)} บาท</span>
                  </div>
              </div>

              {/* Note 5: Trade Receivables */}
              <div className="mb-8">
                  <h3 className="font-bold text-slate-800 border-b border-slate-200 pb-1 mb-3">5. ลูกหนี้การค้า (Trade Receivables)</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-4 indent-8 text-justify">
                      ณ วันที่ในงบดุล บริษัทมีลูกหนี้การค้าคงเหลือจำนวน {formatCurrency(noteData.ar)} บาท 
                      ซึ่งฝ่ายบริหารเชื่อว่าบริษัทจะได้รับชำระหนี้เต็มจำนวน จึงไม่ได้ตั้งค่าเผื่อหนี้สงสัยจะสูญ
                  </p>
              </div>

               {/* Note 6: PPE */}
               <div className="mb-8">
                  <h3 className="font-bold text-slate-800 border-b border-slate-200 pb-1 mb-3">6. ที่ดิน อาคาร และอุปกรณ์ - สุทธิ (Property, Plant and Equipment)</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-4 indent-8 text-justify">
                      สินทรัพย์ถาวรสุทธิจำนวน {formatCurrency(noteData.ppe)} บาท ประกอบด้วยอุปกรณ์สำนักงานและยานพาหนะ 
                      (รายละเอียดแสดงในทะเบียนทรัพย์สิน)
                  </p>
              </div>

              {/* Footer / Sign off area */}
              <div className="mt-16 grid grid-cols-2 gap-20">
                  <div className="text-center">
                      <div className="border-b border-slate-400 w-full h-8 mb-2"></div>
                      <p className="text-sm font-semibold text-slate-800">({client.contact_person})</p>
                      <p className="text-xs text-slate-500">กรรมการผู้มีอำนาจลงนาม</p>
                  </div>
                  <div className="text-center">
                      <div className="border-b border-slate-400 w-full h-8 mb-2"></div>
                      <p className="text-sm font-semibold text-slate-800">(__________________________)</p>
                      <p className="text-xs text-slate-500">ผู้สอบบัญชีรับอนุญาต (CPA)</p>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default FinancialNotes;
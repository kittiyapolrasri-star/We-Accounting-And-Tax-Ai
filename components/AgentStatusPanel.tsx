import React from 'react';
import { Bot, Scan, FileSearch, Scale, CheckCircle2 } from 'lucide-react';

const AgentStatusPanel: React.FC = () => {
  return (
    <div className="grid grid-cols-4 gap-4 mb-8">
       {/* Agent 1: Ingestion */}
       <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 relative">
             <Scan size={18} />
             <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
             </span>
          </div>
          <div>
             <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Agent รับเอกสาร</p>
             <p className="text-sm font-semibold text-slate-700">กำลังรอรับข้อมูล...</p>
          </div>
       </div>

       {/* Agent 2: Auditor */}
       <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
             <FileSearch size={18} />
          </div>
          <div>
             <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Agent ตรวจสอบ</p>
             <p className="text-sm font-semibold text-slate-700">พร้อมทำงาน</p>
          </div>
       </div>

       {/* Agent 3: Reconciliation */}
       <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
             <Scale size={18} />
          </div>
          <div>
             <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Agent กระทบยอด</p>
             <p className="text-sm font-semibold text-slate-700">รอตรวจสอบ 4 รายการ</p>
          </div>
       </div>

       {/* Agent 4: CFO/Closing */}
       <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
             <Bot size={18} />
          </div>
          <div>
             <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Agent ปิดงบ</p>
             <p className="text-sm font-semibold text-slate-700">รายงานพร้อมแล้ว</p>
          </div>
       </div>
    </div>
  );
};

export default AgentStatusPanel;
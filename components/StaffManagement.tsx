import React from 'react';
import { Staff } from '../types';
import { Mail, Briefcase, CheckCircle2 } from 'lucide-react';

interface Props {
  staff: Staff[];
}

const StaffManagement: React.FC<Props> = ({ staff }) => {
  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">จัดการทีมงานและสิทธิ์ (Staff Management)</h2>
          <p className="text-slate-500">บริหารจัดการพนักงานบัญชีและการมอบหมายงาน</p>
        </div>
        <button className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 transition-colors">
          เพิ่มพนักงาน
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {staff.map((member) => (
          <div key={member.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-6">
            <div className="flex items-start justify-between mb-4">
               <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{member.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      member.role === 'Manager' ? 'bg-purple-100 text-purple-700' :
                      member.role === 'Senior Accountant' ? 'bg-blue-100 text-blue-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {member.role}
                    </span>
                  </div>
               </div>
               {member.active_tasks > 0 && (
                 <span className="flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
               )}
            </div>

            <div className="space-y-3">
               <div className="flex items-center gap-3 text-sm text-slate-500">
                  <Mail size={16} />
                  <span>{member.email}</span>
               </div>
               <div className="flex items-center gap-3 text-sm text-slate-500">
                  <Briefcase size={16} />
                  <span>งานที่รับผิดชอบ: <span className="font-semibold text-slate-800">{member.active_tasks}</span></span>
               </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex gap-2">
               <button className="flex-1 py-2 text-sm font-medium text-slate-600 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                 ดูประวัติ
               </button>
               <button className="flex-1 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                 มอบหมายงาน
               </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StaffManagement;
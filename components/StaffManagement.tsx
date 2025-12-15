import React from 'react';
import { Staff } from '../types';
import { Mail, Briefcase, CheckCircle2, Users, Plus } from 'lucide-react';

interface Props {
  staff: Staff[];
}

const StaffManagement: React.FC<Props> = ({ staff }) => {
  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Clean Minimal Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-100 rounded-xl">
              <Users size={24} className="text-slate-700" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">จัดการทีมงานและสิทธิ์</h1>
              <p className="text-sm text-slate-500">บริหารจัดการพนักงานบัญชีและการมอบหมายงาน</p>
            </div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 transition-colors">
            <Plus size={16} />
            เพิ่มพนักงาน
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold text-slate-400 uppercase">จำนวนพนักงาน</p>
            <p className="text-2xl font-bold text-slate-800">{staff.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold text-slate-400 uppercase">กำลังทำงาน</p>
            <p className="text-2xl font-bold text-emerald-600">{staff.filter(s => s.active_tasks > 0).length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold text-slate-400 uppercase">งานทั้งหมด</p>
            <p className="text-2xl font-bold text-blue-600">{staff.reduce((sum, s) => sum + s.active_tasks, 0)}</p>
          </div>
        </div>

        {/* Staff Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {staff.map((member) => (
            <div key={member.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-lg">
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{member.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${member.role === 'Manager' ? 'bg-purple-100 text-purple-700' :
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

        {/* Empty State */}
        {staff.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users size={32} className="text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">ยังไม่มีพนักงาน</h3>
            <p className="text-slate-500 mb-4">เริ่มต้นด้วยการเพิ่มพนักงานคนแรก</p>
            <button className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900">
              เพิ่มพนักงาน
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffManagement;
import React from 'react';
import { Client } from '../types';
import { Building2, MapPin, Activity, FileText, MoreHorizontal, Plus } from 'lucide-react';

interface Props {
  clients: Client[];
  onSelectClient?: (client: Client) => void;
}

const ClientDirectory: React.FC<Props> = ({ clients, onSelectClient }) => {
  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Clean Minimal Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-100 rounded-xl">
              <Building2 size={24} className="text-slate-700" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">ทะเบียนรายชื่อลูกค้า</h1>
              <p className="text-sm text-slate-500">จัดการข้อมูลบริษัทและรอบระยะเวลาบัญชี</p>
            </div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            <Plus size={18} />
            เพิ่มลูกค้าใหม่
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        {clients.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center gap-4">
            <Building2 size={48} className="text-slate-300" />
            <p className="text-slate-500">ยังไม่มีข้อมูลลูกค้า</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clients.map((client) => (
              <div
                key={client.id}
                onClick={() => onSelectClient && onSelectClient(client)}
                className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all p-6 group cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <Building2 size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-base leading-tight group-hover:text-blue-600 transition-colors">{client.name}</h3>
                      <p className="text-xs text-slate-400 font-mono mt-1">Tax ID: {client.tax_id}</p>
                    </div>
                  </div>
                  <button className="text-slate-300 hover:text-slate-600">
                    <MoreHorizontal size={20} />
                  </button>
                </div>

                <div className="space-y-2 py-3 border-t border-slate-100">
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <Activity size={14} className="text-slate-400" />
                    <span>{client.industry}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <MapPin size={14} className="text-slate-400" />
                    <span>{client.address || 'Bangkok, Thailand'}</span>
                  </div>
                </div>

                <div className="mt-2 pt-3 flex items-center border-t border-slate-100">
                  <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide
                     ${client.status === 'Active' ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-500'}
                   `}>
                    {client.status}
                  </span>
                  <div className="ml-auto text-xs text-slate-400 text-right">
                    <span className="block">ปิดงบล่าสุด</span>
                    <span className="font-medium text-slate-700">{client.last_closing_date}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientDirectory;

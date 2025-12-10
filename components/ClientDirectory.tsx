import React from 'react';
import { Client } from '../types';
import { Building2, MapPin, Activity, FileText, MoreHorizontal } from 'lucide-react';

interface Props {
  clients: Client[];
  onSelectClient?: (client: Client) => void;
}

const ClientDirectory: React.FC<Props> = ({ clients, onSelectClient }) => {
  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">ทะเบียนรายชื่อลูกค้า (Client Directory)</h2>
          <p className="text-slate-500">จัดการข้อมูลบริษัทและรอบระยะเวลาบัญชี</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-md shadow-blue-200">
          + เพิ่มลูกค้าใหม่
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clients.map((client) => (
          <div 
            key={client.id} 
            onClick={() => onSelectClient && onSelectClient(client)}
            className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] hover:shadow-lg hover:border-blue-200 transition-all p-6 group cursor-pointer relative top-0 hover:-top-1"
          >
            <div className="flex items-start justify-between mb-4">
               <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                    <Building2 size={28} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg leading-tight group-hover:text-blue-600 transition-colors">{client.name}</h3>
                    <p className="text-xs text-slate-400 font-mono mt-1">Tax ID: {client.tax_id}</p>
                  </div>
               </div>
               <button className="text-slate-300 hover:text-slate-600">
                   <MoreHorizontal size={20} />
               </button>
            </div>

            <div className="space-y-3 py-4 border-t border-dashed border-slate-100 mt-2">
               <div className="flex items-center gap-3 text-sm text-slate-600">
                  <Activity size={16} className="text-blue-400" />
                  <span className="font-medium">{client.industry}</span>
               </div>
               <div className="flex items-center gap-3 text-sm text-slate-600">
                  <MapPin size={16} className="text-blue-400" />
                  <span>Bangkok, Thailand</span>
               </div>
            </div>

            <div className="mt-2 pt-4 flex gap-2">
               <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border
                 ${client.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-100'}
               `}>
                 {client.status}
               </span>
               <div className="ml-auto text-xs text-slate-400 flex flex-col items-end">
                   <span>ปิดงบล่าสุด</span>
                   <span className="font-semibold text-slate-700">{client.last_closing_date}</span>
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClientDirectory;
import React, { useState } from 'react';
import { Client, WorkflowStatus, Staff, IssueTicket } from '../types';
import { Search, Filter, AlertCircle, CheckCircle2, Clock, MoreHorizontal, ArrowUpRight, User, AlertTriangle, ChevronRight, Wrench } from 'lucide-react';

interface Props {
  clients: Client[];
  staff: Staff[];
  onNavigateToIssue?: (issue: IssueTicket) => void;
  onSelectClient?: (client: Client) => void;
}

const MasterCommandCenter: React.FC<Props> = ({ clients, staff, onNavigateToIssue, onSelectClient }) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const getStatusColor = (status: WorkflowStatus) => {
    switch (status) {
      case 'Filed/Closed': return 'bg-emerald-50 text-emerald-700 border-emerald-100 ring-1 ring-emerald-200';
      case 'Ready to File': return 'bg-purple-50 text-purple-700 border-purple-100 ring-1 ring-purple-200';
      case 'Reviewing': return 'bg-blue-50 text-blue-700 border-blue-100 ring-1 ring-blue-200';
      case 'In Progress': return 'bg-amber-50 text-amber-700 border-amber-100 ring-1 ring-amber-200';
      default: return 'bg-slate-50 text-slate-400 border-slate-100';
    }
  };

  const getStatusIcon = (status: WorkflowStatus) => {
     switch (status) {
      case 'Filed/Closed': return <CheckCircle2 size={14} className="shrink-0" />;
      case 'Ready to File': return <CheckCircle2 size={14} className="shrink-0" />;
      case 'Reviewing': return <ArrowUpRight size={14} className="shrink-0" />;
      case 'In Progress': return <Clock size={14} className="shrink-0" />;
      default: return <AlertCircle size={14} className="shrink-0" />;
    }
  };

  const getStatusLabel = (status: WorkflowStatus) => {
    switch (status) {
      case 'Not Started': return 'ยังไม่เริ่ม';
      case 'In Progress': return 'กำลังทำ';
      case 'Reviewing': return 'รอตรวจ';
      case 'Ready to File': return 'พร้อมยื่น';
      case 'Filed/Closed': return 'เสร็จสิ้น';
      default: return '-';
    }
  };

  const getStaffName = (id: string) => {
      return staff.find(s => s.id === id)?.name || 'Unassigned';
  };

  const getStaffAvatar = (id: string) => {
      const s = staff.find(s => s.id === id);
      return s ? s.name.charAt(0) : '?';
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.tax_id.includes(searchTerm)
  );

  // Calculate Overview Stats
  const totalIssues = clients.reduce((sum, c) => sum + c.current_workflow.issues.length, 0);
  const closingProgress = Math.round(clients.filter(c => c.current_workflow.closing_status === 'Filed/Closed').length / clients.length * 100);

  return (
    <div className="animate-in fade-in duration-500 h-full flex flex-col">
      {/* CEO Executive Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="md:col-span-2">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                ศูนย์ควบคุมบัญชี (CEO Command Center)
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-bold">Live</span>
            </h2>
            <p className="text-slate-500 mt-1">ภาพรวมสถานะงานบัญชีและภาษีของลูกค้าทั้งหมด พร้อมติดตามปัญหาที่ต้องแก้ไข (Issues)</p>
          </div>
          
          <div className="flex gap-4 justify-end items-end">
               <div className={`flex items-center gap-3 px-5 py-3 rounded-xl border shadow-sm flex-1 max-w-[200px] ${totalIssues > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                    <div className={`p-2 rounded-full ${totalIssues > 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        <AlertTriangle size={20} />
                    </div>
                    <div>
                        <p className={`text-2xl font-bold ${totalIssues > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{totalIssues}</p>
                        <p className={`text-xs font-semibold uppercase ${totalIssues > 0 ? 'text-red-500' : 'text-emerald-500'}`}>Issues Required</p>
                    </div>
               </div>

               <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-white border border-slate-200 shadow-sm flex-1 max-w-[200px]">
                    <div className="p-2 rounded-full bg-blue-100 text-blue-600">
                        <CheckCircle2 size={20} />
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-slate-800">{closingProgress}%</p>
                        <p className="text-xs font-semibold text-slate-400 uppercase">Closing Done</p>
                    </div>
               </div>
          </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex gap-4 bg-slate-50/50 rounded-t-2xl items-center">
           <div className="relative flex-1 max-w-md">
               <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
               <input 
                 type="text" 
                 placeholder="ค้นหาลูกค้า (Client Search)..." 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 border border-slate-200 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
               />
           </div>
           <div className="flex gap-2 ml-auto">
               <button className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 shadow-sm">
                   <Filter size={14}/> Filter Status
               </button>
           </div>
        </div>

        {/* High Density Table */}
        <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-white text-slate-500 font-semibold sticky top-0 z-10 shadow-sm">
                    <tr>
                        <th className="px-6 py-4 border-b border-slate-100 w-[280px]">ลูกค้า (Client)</th>
                        <th className="px-4 py-4 border-b border-slate-100 w-[200px]">ผู้รับผิดชอบ (Staff)</th>
                        <th className="px-4 py-4 border-b border-slate-100 text-center w-[120px]">VAT (ภ.พ.30)</th>
                        <th className="px-4 py-4 border-b border-slate-100 text-center w-[120px]">WHT (50 ทวิ)</th>
                        <th className="px-4 py-4 border-b border-slate-100 w-[200px]">ปิดงบ (Closing)</th>
                        <th className="px-4 py-4 border-b border-slate-100">สิ่งที่ต้องแก้ไข (Issues)</th>
                        <th className="px-4 py-4 border-b border-slate-100 w-10"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {filteredClients.map((client) => {
                        const hasIssues = client.current_workflow.issues.length > 0;
                        return (
                        <tr key={client.id} className={`transition-colors group hover:bg-blue-50/20 ${hasIssues ? 'bg-red-50/10' : ''}`}>
                            {/* Client Info */}
                            <td className="px-6 py-4 cursor-pointer" onClick={() => onSelectClient && onSelectClient(client)}>
                                <div className="font-bold text-slate-800 text-base group-hover:text-blue-600 transition-colors">{client.name}</div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{client.tax_id}</span>
                                    <span className="text-[10px] text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded-full">{client.industry}</span>
                                </div>
                            </td>

                            {/* Assigned Staff */}
                            <td className="px-4 py-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm border-2 border-white
                                        ${getStaffName(client.assigned_staff_id) === 'Unassigned' ? 'bg-slate-300' : 'bg-indigo-500'}
                                    `}>
                                        {getStaffAvatar(client.assigned_staff_id)}
                                    </div>
                                    <div className="leading-tight">
                                        <div className="font-semibold text-slate-700 text-xs">{getStaffName(client.assigned_staff_id)}</div>
                                        <div className="text-[10px] text-slate-400">Account Manager</div>
                                    </div>
                                </div>
                            </td>
                            
                            {/* VAT Status */}
                            <td className="px-4 py-4 text-center">
                                <span className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold w-full max-w-[110px] ${getStatusColor(client.current_workflow.vat_status)}`}>
                                    {getStatusIcon(client.current_workflow.vat_status)}
                                    {getStatusLabel(client.current_workflow.vat_status)}
                                </span>
                            </td>

                             {/* WHT Status */}
                             <td className="px-4 py-4 text-center">
                                <span className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold w-full max-w-[110px] ${getStatusColor(client.current_workflow.wht_status)}`}>
                                    {getStatusIcon(client.current_workflow.wht_status)}
                                    {getStatusLabel(client.current_workflow.wht_status)}
                                </span>
                            </td>

                            {/* Closing Status Progress */}
                            <td className="px-4 py-4">
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-0.5">
                                        <span>Progress</span>
                                        <span>{client.current_workflow.closing_status === 'Filed/Closed' ? '100%' : '45%'}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-500 ${client.current_workflow.closing_status === 'Filed/Closed' ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                                            style={{ width: client.current_workflow.closing_status === 'Filed/Closed' ? '100%' : '45%'}}
                                        ></div>
                                    </div>
                                </div>
                            </td>

                            {/* Issues / Tickets */}
                            <td className="px-4 py-4">
                                {hasIssues ? (
                                    <div className="space-y-1">
                                        {client.current_workflow.issues.map(issue => (
                                            <div key={issue.id} className="flex items-center gap-2 bg-white border border-red-100 p-1.5 rounded-lg shadow-sm hover:border-red-300 transition-colors">
                                                <AlertCircle size={14} className="text-red-500 shrink-0" />
                                                <span className="text-xs text-slate-700 truncate max-w-[150px]" title={issue.title}>{issue.title}</span>
                                                <button 
                                                    onClick={() => onNavigateToIssue && onNavigateToIssue(issue)}
                                                    className="ml-auto text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded font-bold hover:bg-red-100 flex items-center gap-1"
                                                >
                                                    <Wrench size={10} /> แก้ไข
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-emerald-600 opacity-60">
                                        <CheckCircle2 size={16} />
                                        <span className="text-xs font-medium">No Issues</span>
                                    </div>
                                )}
                            </td>

                            <td className="px-4 py-4 text-right">
                                <button className="p-2 text-slate-300 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-colors" onClick={() => onSelectClient && onSelectClient(client)}>
                                    <ChevronRight size={20} />
                                </button>
                            </td>
                        </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default MasterCommandCenter;
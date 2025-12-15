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

    // Calculate Overview Stats with null safety
    const totalIssues = clients.reduce((sum, c) => sum + (c.current_workflow?.issues?.length || 0), 0);
    const clientsWithWorkflow = clients.filter(c => c.current_workflow?.closing_status === 'Filed/Closed').length;
    const closingProgress = clients.length > 0 ? Math.round(clientsWithWorkflow / clients.length * 100) : 0;


    return (
        <div className="h-full flex flex-col bg-slate-50">
            {/* Clean Minimal Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-6">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-slate-100 rounded-xl">
                            <AlertCircle size={24} className="text-slate-700" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                ศูนย์ควบคุมบัญชี (CEO Command Center)
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">Live</span>
                            </h2>
                            <p className="text-slate-500 mt-1">ภาพรวมสถานะงานบัญชีและภาษีของลูกค้าทั้งหมด พร้อมติดตามปัญหาที่ต้องแก้ไข</p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className={`flex items-center gap-3 px-5 py-3 rounded-xl border shadow-sm ${totalIssues > 0 ? 'bg-white border-red-200' : 'bg-white border-green-200'}`}>
                            <div className={`p-2 rounded-lg ${totalIssues > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                                <AlertTriangle size={20} className={totalIssues > 0 ? 'text-red-500' : 'text-green-500'} />
                            </div>
                            <div>
                                <p className={`text-2xl font-bold ${totalIssues > 0 ? 'text-red-600' : 'text-green-600'}`}>{totalIssues}</p>
                                <p className="text-xs text-slate-500">ปัญหาที่ต้องแก้</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-white border border-slate-200 shadow-sm">
                            <div className="p-2 rounded-lg bg-blue-50">
                                <CheckCircle2 size={20} className="text-blue-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900">{closingProgress || 0}%</p>
                                <p className="text-xs text-slate-500">ปิดงบเสร็จ</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 p-6 overflow-hidden flex flex-col">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
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
                                <Filter size={14} /> Filter Status
                            </button>
                        </div>
                    </div>

                    {/* High Density Table */}
                    <div className="flex-1 overflow-auto">
                        {filteredClients.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                    <Search size={32} className="text-slate-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-700 mb-2">ยังไม่มีข้อมูลลูกค้า</h3>
                                <p className="text-slate-500 max-w-md">
                                    {searchTerm
                                        ? `ไม่พบลูกค้าที่ตรงกับ "${searchTerm}"`
                                        : 'กรุณาเพิ่มข้อมูลลูกค้าก่อนเพื่อติดตามสถานะงานบัญชี'}
                                </p>
                                <p className="text-sm text-slate-400 mt-4">
                                    ไปที่เมนู "ลูกค้า & ข้อมูล" → "ทะเบียนลูกค้า" เพื่อเพิ่มลูกค้า
                                </p>
                            </div>
                        ) : (
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
                                        const workflow = client.current_workflow || {
                                            vat_status: 'Not Started' as WorkflowStatus,
                                            wht_status: 'Not Started' as WorkflowStatus,
                                            closing_status: 'Not Started' as WorkflowStatus,
                                            issues: []
                                        };
                                        const hasIssues = workflow.issues?.length > 0;
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
                                                    <span className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold w-full max-w-[110px] ${getStatusColor(workflow.vat_status)}`}>
                                                        {getStatusIcon(workflow.vat_status)}
                                                        {getStatusLabel(workflow.vat_status)}
                                                    </span>
                                                </td>

                                                {/* WHT Status */}
                                                <td className="px-4 py-4 text-center">
                                                    <span className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold w-full max-w-[110px] ${getStatusColor(workflow.wht_status)}`}>
                                                        {getStatusIcon(workflow.wht_status)}
                                                        {getStatusLabel(workflow.wht_status)}
                                                    </span>
                                                </td>

                                                {/* Closing Status Progress */}
                                                <td className="px-4 py-4">
                                                    <div className="flex flex-col gap-1.5">
                                                        <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-0.5">
                                                            <span>Progress</span>
                                                            <span>{workflow.closing_status === 'Filed/Closed' ? '100%' : '45%'}</span>
                                                        </div>
                                                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-500 ${workflow.closing_status === 'Filed/Closed' ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                                                style={{ width: workflow.closing_status === 'Filed/Closed' ? '100%' : '45%' }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Issues / Tickets */}
                                                <td className="px-4 py-4">
                                                    {hasIssues ? (
                                                        <div className="space-y-1">
                                                            {workflow.issues.map(issue => (
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
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MasterCommandCenter;
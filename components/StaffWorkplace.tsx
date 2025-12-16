import React from 'react';
import { Staff, Client, DocumentRecord, IssueTicket } from '../types';
import { Briefcase, AlertTriangle, FileSearch, CheckCircle2, Clock, CalendarDays, ArrowRight, AlarmClock } from 'lucide-react';

interface Props {
    currentStaffId: string;
    clients: Client[];
    documents: DocumentRecord[];
    onReviewDoc: (doc: DocumentRecord) => void;
}

const StaffWorkplace: React.FC<Props> = ({ currentStaffId, clients, documents, onReviewDoc }) => {
    // Filter clients assigned to this staff
    const myClients = clients.filter(c => c.assigned_staff_id === currentStaffId);
    const myClientIds = new Set(myClients.map(c => c.id));

    // Filter documents for these clients
    // In a real app, we would match by client ID. Here matching by name for mock consistency.
    const myDocs = documents.filter(d => myClients.some(c => c.name === d.client_name));
    const pendingDocs = myDocs.filter(d => d.status === 'pending_review' || d.status === 'processing');

    // SLA / Aging Logic
    const getDaysOverdue = (dateStr: string) => {
        const uploadDate = new Date(dateStr).getTime();
        const now = new Date().getTime();
        return Math.floor((now - uploadDate) / (1000 * 3600 * 24));
    };

    // Aggregate Issues
    const myIssues: { client: Client, issue: IssueTicket }[] = [];
    myClients.forEach(c => {
        (c.current_workflow?.issues ?? []).forEach(i => {
            myIssues.push({ client: c, issue: i });
        });
    });

    return (
        <div className="animate-in fade-in duration-500 h-full flex flex-col pb-10">
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Briefcase className="text-blue-600" /> พื้นที่ทำงานของฉัน (My Workplace)
                </h2>
                <p className="text-slate-500 mt-1">รวบรวมงานทั้งหมดที่คุณต้องรับผิดชอบในวันนี้</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Column 1: Priority Issues (High Alert) */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                            <AlertTriangle size={18} className="text-red-500" />
                            ปัญหาที่ต้องแก้ไขด่วน ({myIssues.length})
                        </h3>
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-bold">Priority</span>
                    </div>

                    <div className="space-y-3">
                        {myIssues.length === 0 ? (
                            <div className="bg-white p-8 rounded-xl border border-dashed border-slate-200 text-center text-slate-400">
                                <CheckCircle2 size={32} className="mx-auto mb-2 opacity-30 text-emerald-500" />
                                <p>ไม่มีปัญหาค้างคา (All Clear)</p>
                            </div>
                        ) : myIssues.map((item, idx) => (
                            <div key={idx} className="bg-white p-4 rounded-xl border-l-4 border-l-red-500 border-y border-r border-slate-100 shadow-sm hover:shadow-md transition-all group cursor-pointer">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.client.name}</span>
                                    <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100">{item.issue.severity}</span>
                                </div>
                                <h4 className="font-bold text-slate-800 text-sm mb-1">{item.issue.title}</h4>
                                <p className="text-xs text-slate-500 line-clamp-2">{item.issue.description}</p>
                                <div className="mt-3 flex justify-between items-center border-t border-slate-50 pt-2">
                                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                        <CalendarDays size={10} /> {item.issue.created_at}
                                    </span>
                                    <button className="text-xs font-bold text-blue-600 flex items-center gap-1 group-hover:underline">
                                        แก้ไขทันที <ArrowRight size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Column 2: Document Reviews (Daily Task) with SLA */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                            <FileSearch size={18} className="text-amber-500" />
                            เอกสารรอตรวจ ({pendingDocs.length})
                        </h3>
                        <span className="text-xs bg-amber-100 text-amber-600 px-2 py-1 rounded-full font-bold">To Do</span>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[300px]">
                        <div className="divide-y divide-slate-50">
                            {pendingDocs.length === 0 ? (
                                <div className="p-8 text-center text-slate-400">
                                    <p>ไม่มีเอกสารรอตรวจสอบ</p>
                                </div>
                            ) : pendingDocs.map(doc => {
                                const daysOverdue = getDaysOverdue(doc.uploaded_at);
                                const isOverdue = daysOverdue > 3;

                                return (
                                    <div key={doc.id} onClick={() => onReviewDoc(doc)} className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors group relative ${isOverdue ? 'bg-red-50/30' : ''}`}>
                                        {isOverdue && (
                                            <div className="absolute right-2 top-2 flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full animate-pulse">
                                                <AlarmClock size={10} /> Overdue {daysOverdue}d
                                            </div>
                                        )}
                                        <div className="flex justify-between items-start mb-1 mt-1">
                                            <span className="font-medium text-sm text-slate-800">{doc.client_name}</span>
                                            <span className="font-mono text-xs font-bold text-slate-600">
                                                {doc.amount.toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-mono">{doc.filename}</span>
                                            <span>• {doc.uploaded_at.split('T')[0]}</span>
                                        </div>
                                        <div className="mt-2 text-right">
                                            <span className="text-[10px] font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1">
                                                Review <ArrowRight size={10} />
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* Column 3: My Client Portfolio */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                            <Briefcase size={18} className="text-blue-500" />
                            ลูกค้าที่ดูแล ({myClients.length})
                        </h3>
                    </div>

                    <div className="space-y-3">
                        {myClients.map(client => (
                            <div key={client.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                                <div>
                                    <h4 className="font-bold text-slate-800 text-sm">{client.name}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`w-2 h-2 rounded-full ${client.current_workflow?.closing_status === 'Filed/Closed' ? 'bg-emerald-500' : 'bg-blue-500'}`}></span>
                                        <span className="text-xs text-slate-500">
                                            Closing: {client.current_workflow?.closing_status === 'Filed/Closed' ? 'Done' : 'In Progress'}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold text-slate-200">{client.name.charAt(0)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default StaffWorkplace;
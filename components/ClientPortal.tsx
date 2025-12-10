import React, { useState } from 'react';
import { Client, DocumentRecord } from '../types';
import { Upload, FileText, Download, CheckCircle2, Clock, AlertCircle, Bell, LogOut, ChevronRight, File } from 'lucide-react';

interface Props {
    client: Client;
    onUploadDocs: (files: File[], client: Client) => void;
}

const ClientPortal: React.FC<Props> = ({ client, onUploadDocs }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'requests' | 'reports'>('dashboard');
    const [dragActive, setDragActive] = useState(false);

    // Filter requests
    const pendingRequests = client.client_requests?.filter(r => r.status === 'Pending') || [];
    const reports = client.published_reports || [];

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            onUploadDocs(Array.from(e.dataTransfer.files), client);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onUploadDocs(Array.from(e.target.files), client);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-inter">
            {/* Client Navbar */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm">
                            {client.name.charAt(0)}
                        </div>
                        <div>
                            <h1 className="font-bold text-slate-800 text-sm leading-tight">{client.name}</h1>
                            <p className="text-[10px] text-slate-500">Client Portal (ระบบลูกค้าสัมพันธ์)</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="hidden md:flex gap-1">
                            <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}>ภาพรวม</button>
                            <button onClick={() => setActiveTab('requests')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'requests' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}>สิ่งที่ต้องส่ง ({pendingRequests.length})</button>
                            <button onClick={() => setActiveTab('reports')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'reports' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}>รายงาน & งบการเงิน</button>
                        </div>
                        <div className="h-6 w-px bg-slate-200"></div>
                        <button className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800">
                            <LogOut size={16} /> ออกจากระบบ
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto p-8">
                {activeTab === 'dashboard' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                        {/* Welcome Banner */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
                            <div className="relative z-10">
                                <h2 className="text-3xl font-bold mb-2">สวัสดี, {client.contact_person}</h2>
                                <p className="text-blue-100 mb-6">ขณะนี้เรากำลังปิดงบประจำเดือน กุมภาพันธ์ 2567 ความคืบหน้าอยู่ที่ 85%</p>
                                <div className="flex gap-3">
                                    <button 
                                        onClick={() => setActiveTab('requests')}
                                        className="bg-white text-blue-600 px-5 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-blue-50 transition-colors flex items-center gap-2"
                                    >
                                        <Upload size={16} /> ส่งเอกสารเพิ่มเติม
                                    </button>
                                    <button 
                                        onClick={() => setActiveTab('reports')}
                                        className="bg-blue-700/50 text-white px-5 py-2.5 rounded-xl text-sm font-bold backdrop-blur-sm hover:bg-blue-700/70 transition-colors flex items-center gap-2"
                                    >
                                        <FileText size={16} /> ดูรายงานล่าสุด
                                    </button>
                                </div>
                            </div>
                            <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
                                <FileText size={200} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Upload Area */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <Upload size={20} className="text-blue-500"/> นำส่งเอกสารด่วน (Quick Upload)
                                </h3>
                                <div 
                                    onDragEnter={handleDrag} 
                                    onDragLeave={handleDrag} 
                                    onDragOver={handleDrag} 
                                    onDrop={handleDrop}
                                    className={`border-2 border-dashed rounded-xl h-48 flex flex-col items-center justify-center transition-all ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}
                                >
                                    <input type="file" multiple className="hidden" id="portal-upload" onChange={handleFileSelect} />
                                    <label htmlFor="portal-upload" className="flex flex-col items-center cursor-pointer">
                                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3">
                                            <Upload size={24} />
                                        </div>
                                        <p className="text-sm font-bold text-slate-700">คลิกเพื่ออัปโหลด หรือลากไฟล์มาวาง</p>
                                        <p className="text-xs text-slate-400 mt-1">รองรับใบวางบิล, ใบกำกับภาษี, Statement</p>
                                    </label>
                                </div>
                            </div>

                            {/* Recent Activity / Requests */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <Bell size={20} className="text-amber-500"/> สิ่งที่สำนักงานบัญชีต้องการ (To-Do)
                                </h3>
                                <div className="space-y-3">
                                    {pendingRequests.length === 0 ? (
                                        <div className="text-center py-8 text-slate-400">
                                            <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500 opacity-50"/>
                                            <p>ไม่มีรายการที่ต้องดำเนินการ</p>
                                        </div>
                                    ) : pendingRequests.map(req => (
                                        <div key={req.id} className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white rounded-lg text-amber-600 shadow-sm">
                                                    <AlertCircle size={16} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">{req.title}</p>
                                                    <p className="text-xs text-slate-500">ครบกำหนด: {req.due_date}</p>
                                                </div>
                                            </div>
                                            <button className="text-xs bg-amber-200 text-amber-800 px-3 py-1.5 rounded-lg font-bold hover:bg-amber-300">
                                                ส่งข้อมูล
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'reports' && (
                    <div className="animate-in fade-in slide-in-from-right-4">
                        <h2 className="text-2xl font-bold text-slate-800 mb-6">คลังเอกสารและงบการเงิน (Document Vault)</h2>
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="divide-y divide-slate-100">
                                {reports.length === 0 ? (
                                    <div className="p-12 text-center text-slate-400">
                                        ยังไม่มีรายงานที่เผยแพร่
                                    </div>
                                ) : reports.map(report => (
                                    <div key={report.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                                report.type === 'Financial Statement' ? 'bg-emerald-100 text-emerald-600' : 
                                                report.type === 'Tax Return' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                                            }`}>
                                                <FileText size={24} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-lg group-hover:text-blue-600 transition-colors">{report.title}</h4>
                                                <p className="text-sm text-slate-500 flex items-center gap-2">
                                                    <Clock size={12}/> เผยแพร่เมื่อ: {report.generated_date} • {report.type}
                                                </p>
                                            </div>
                                        </div>
                                        <button className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-800 hover:text-white transition-all shadow-sm">
                                            <Download size={16} /> ดาวน์โหลด
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientPortal;
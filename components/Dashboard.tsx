
import React, { useEffect, useState } from 'react';
import { DocumentRecord, Staff, Client, ActivityLog } from '../types';
import { TrendingUp, Users, Clock, Calendar, AlertCircle, ArrowUpRight, CheckCircle2, AlertTriangle, Activity, Zap, FileText, Lock } from 'lucide-react';
import AgentStatusPanel from './AgentStatusPanel';
import { databaseService } from '../services/database';

interface Props {
  documents: DocumentRecord[];
  staff: Staff[];
  clients: Client[];
}

const Dashboard: React.FC<Props> = ({ documents, staff, clients }) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  // Fetch real-time logs
  useEffect(() => {
      const fetchLogs = async () => {
          const data = await databaseService.getLogs(15);
          setLogs(data);
      };
      fetchLogs();
      // Poll every 5s for demo "Live" effect
      const interval = setInterval(fetchLogs, 5000);
      return () => clearInterval(interval);
  }, []);

  const totalProcessed = documents.length;
  const pendingReview = documents.filter(d => d.status === 'pending_review').length;
  const totalAmount = documents.reduce((sum, d) => sum + d.amount, 0);
  const totalIssues = clients.reduce((sum, c) => sum + c.current_workflow.issues.length, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(amount);
  };

  const getLogIcon = (action: string) => {
      switch(action) {
          case 'UPLOAD': return <Zap size={14} className="text-blue-500"/>;
          case 'APPROVE': return <CheckCircle2 size={14} className="text-emerald-500"/>;
          case 'CLOSE_PERIOD': return <Lock size={14} className="text-purple-500"/>;
          case 'POST_GL': return <FileText size={14} className="text-indigo-500"/>;
          default: return <Activity size={14} className="text-slate-400"/>;
      }
  };

  const formatTimeAgo = (dateStr: string) => {
      const diff = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      return '1d+';
  };

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500">
      {/* Page Header - Standardized */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
           <div className="p-3 bg-blue-100 rounded-xl">
             <TrendingUp size={28} className="text-blue-600" />
           </div>
           <div>
             <h1 className="text-2xl font-bold text-slate-900">ภาพรวมสำนักงาน</h1>
             <p className="text-sm text-slate-500">Live Monitoring & Performance Tracking</p>
           </div>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
            <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Live System</span>
        </div>
      </div>

      {/* AI Agent Status Panel */}
      <AgentStatusPanel />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Stats Area */}
          <div className="lg:col-span-2 space-y-6">
              {/* CEO Executive Summary Banner */}
              <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-lg shadow-slate-200/50 p-8">
                <div className="absolute top-0 right-0 w-[500px] h-full bg-gradient-to-l from-blue-50 via-indigo-50/50 to-transparent pointer-events-none"></div>
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-start gap-5">
                        <div className={`p-3 rounded-2xl shadow-sm ${totalIssues > 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            {totalIssues > 0 ? <AlertTriangle size={28} /> : <CheckCircle2 size={28} />}
                        </div>
                        <div>
                            <h3 className="font-bold text-xl text-slate-800">สรุปสถานะงาน (Executive Summary)</h3>
                            <p className="text-slate-500 mt-1 max-w-md text-sm">
                                {totalIssues > 0 
                                    ? <span>ตรวจพบ <span className="font-bold text-red-600">{totalIssues} ปัญหา (Issues)</span> ที่ต้องแก้ไขด่วน ระบบได้สร้าง Ticket แจ้งพนักงานที่ดูแลแล้ว</span>
                                    : <span>สถานะปกติ ทุกบริษัทดำเนินการตามแผน ปิดงบไปแล้ว {Math.round((clients.filter(c => c.current_workflow.closing_status === 'Filed/Closed').length / clients.length) * 100)}%</span>
                                }
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <div className="bg-white px-6 py-3 rounded-xl border border-slate-100 shadow-sm text-center min-w-[120px]">
                            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">AI ความแม่นยำ</p>
                            <p className="font-bold text-2xl text-emerald-600">98%</p>
                        </div>
                        <div className="bg-blue-600 px-6 py-3 rounded-xl shadow-lg shadow-blue-200 text-center min-w-[120px] text-white">
                            <p className="text-xs text-blue-100 font-semibold uppercase tracking-wider mb-1">งานที่ต้องทำ</p>
                            <p className="font-bold text-2xl">{totalIssues + pendingReview}</p>
                        </div>
                    </div>
                </div>
              </div>

              {/* Stats Cards - Clean Style */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                    <TrendingUp size={22} />
                    </div>
                    <span className="flex items-center text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                        <ArrowUpRight size={12} className="mr-1"/> +12.5%
                    </span>
                </div>
                <div>
                    <p className="text-sm font-medium text-slate-400">รายได้ที่บันทึกแล้ว</p>
                    <h3 className="text-2xl font-bold text-slate-800 mt-1 tracking-tight">{formatCurrency(totalAmount)}</h3>
                </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                    <Clock size={22} />
                    </div>
                    {pendingReview > 0 && (
                        <span className="flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                    )}
                </div>
                <div>
                    <p className="text-sm font-medium text-slate-400">เอกสารรอตรวจสอบ</p>
                    <h3 className="text-2xl font-bold text-slate-800 mt-1 tracking-tight">{pendingReview} รายการ</h3>
                </div>
                </div>
              </div>
          </div>

          {/* Right Column: Live Activity Feed (Audit Trail) */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-0 flex flex-col overflow-hidden h-full max-h-[500px] lg:max-h-full">
              <div className="p-5 border-b border-slate-50 bg-slate-50/50">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm uppercase tracking-wide">
                      <Activity size={16} className="text-blue-500" />
                      Live Activity Feed
                  </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-0">
                  <div className="divide-y divide-slate-50">
                      {logs.map((log) => (
                          <div key={log.id} className="p-4 flex gap-3 hover:bg-slate-50 transition-colors animate-in slide-in-from-right-2">
                              <div className="mt-1 bg-slate-100 p-1.5 rounded-lg h-fit">
                                  {getLogIcon(log.action)}
                              </div>
                              <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-slate-700 truncate">
                                      {log.user_name} <span className="text-slate-400 font-normal">performed</span> {log.action}
                                  </p>
                                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{log.details}</p>
                                  <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                                      <Clock size={10} /> {formatTimeAgo(log.timestamp)}
                                  </p>
                              </div>
                          </div>
                      ))}
                      {logs.length === 0 && (
                          <div className="p-8 text-center text-slate-400 text-xs">Waiting for system activity...</div>
                      )}
                  </div>
              </div>
              <div className="p-3 border-t border-slate-50 bg-slate-50 text-center">
                  <button className="text-[10px] font-bold text-blue-600 hover:underline">View Full Audit Logs</button>
              </div>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;

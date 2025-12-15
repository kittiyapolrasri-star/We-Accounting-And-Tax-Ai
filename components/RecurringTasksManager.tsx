/**
 * RecurringTasksManager.tsx
 * 
 * หน้าจอจัดการงานประจำอัตโนมัติ
 * - สร้าง/แก้ไข Template
 * - ดู Schedule
 * - รัน Scheduler
 * - ดู Logs
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
    RefreshCw, Plus, Play, Pause, Trash2, Edit2, Calendar,
    Clock, AlertTriangle, CheckCircle2, FileText, Users,
    ChevronRight, Settings, History, Zap, X
} from 'lucide-react';
import {
    RecurringTaskTemplate,
    RecurringTaskLog,
    RecurrenceFrequency,
    THAI_TAX_DEADLINES,
    DEFAULT_TEMPLATES,
    recurringTasksService
} from '../services/recurringTasks';
import { Staff, Client } from '../types';
import { TaskCategory, TaskPriority } from '../types/tasks';

interface Props {
    staff: Staff[];
    clients: Client[];
    onRunScheduler?: (result: { templatesProcessed: number; tasksCreated: number }) => void;
}

const RecurringTasksManager: React.FC<Props> = ({ staff, clients, onRunScheduler }) => {
    const [templates, setTemplates] = useState<RecurringTaskTemplate[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<RecurringTaskTemplate | null>(null);
    const [logs, setLogs] = useState<RecurringTaskLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'templates' | 'schedule' | 'logs'>('templates');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isRunning, setIsRunning] = useState(false);

    // Load templates
    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        setLoading(true);
        const data = await recurringTasksService.getTemplates();
        setTemplates(data);
        setLoading(false);
    };

    const loadLogs = async (templateId: string) => {
        const data = await recurringTasksService.getLogs(templateId);
        setLogs(data);
    };

    // Run scheduler
    const handleRunScheduler = async () => {
        setIsRunning(true);

        const getClientOwner = (clientId: string): string | null => {
            const client = clients.find(c => c.id === clientId);
            return client?.assigned_staff_id || null;
        };

        const result = await recurringTasksService.runScheduler(
            clients.map(c => ({ id: c.id, ownerId: c.assigned_staff_id })),
            getClientOwner
        );

        await loadTemplates();
        setIsRunning(false);
        onRunScheduler?.(result);
    };

    // Toggle template active status
    const toggleActive = async (template: RecurringTaskTemplate) => {
        await recurringTasksService.updateTemplate(template.id, {
            isActive: !template.isActive
        });
        await loadTemplates();
    };

    // Delete template
    const deleteTemplate = async (templateId: string) => {
        if (confirm('คุณต้องการลบ Template นี้?')) {
            await recurringTasksService.deleteTemplate(templateId);
            await loadTemplates();
        }
    };

    // Initialize defaults
    const initializeDefaults = async () => {
        setLoading(true);
        await recurringTasksService.initializeDefaultTemplates('current_user');
        await loadTemplates();
        setLoading(false);
    };

    // Format frequency
    const formatFrequency = (freq: RecurrenceFrequency): string => {
        switch (freq) {
            case 'daily': return 'ทุกวัน';
            case 'weekly': return 'ทุกสัปดาห์';
            case 'biweekly': return 'ทุก 2 สัปดาห์';
            case 'monthly': return 'ทุกเดือน';
            case 'quarterly': return 'ทุกไตรมาส';
            case 'yearly': return 'ทุกปี';
            default: return freq;
        }
    };

    // Format date
    const formatDate = (dateStr?: string): string => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('th-TH', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Get category color
    const getCategoryColor = (category: TaskCategory): string => {
        switch (category) {
            case 'tax_filing': return 'bg-red-100 text-red-700';
            case 'period_closing': return 'bg-purple-100 text-purple-700';
            case 'document_review': return 'bg-blue-100 text-blue-700';
            case 'bank_reconciliation': return 'bg-green-100 text-green-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    // Schedule view data
    const scheduleData = useMemo(() => {
        const now = new Date();
        const next30Days: { date: Date; templates: RecurringTaskTemplate[] }[] = [];

        for (let i = 0; i < 30; i++) {
            const date = new Date(now);
            date.setDate(date.getDate() + i);
            date.setHours(0, 0, 0, 0);

            const dateTemplates = templates.filter(t => {
                if (!t.isActive || !t.nextRunAt) return false;
                const nextRun = new Date(t.nextRunAt);
                nextRun.setHours(0, 0, 0, 0);
                return nextRun.getTime() === date.getTime();
            });

            if (dateTemplates.length > 0) {
                next30Days.push({ date, templates: dateTemplates });
            }
        }

        return next30Days;
    }, [templates]);

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-6 mb-6 text-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-xl">
                            <RefreshCw size={28} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">งานประจำอัตโนมัติ</h1>
                            <p className="text-white/80">
                                จัดการ Templates และ Scheduler สำหรับงานที่ทำซ้ำ
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleRunScheduler}
                            disabled={isRunning}
                            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${isRunning
                                    ? 'bg-white/30 cursor-not-allowed'
                                    : 'bg-white text-purple-600 hover:bg-purple-50'
                                }`}
                        >
                            <Play size={18} className={isRunning ? 'animate-spin' : ''} />
                            {isRunning ? 'กำลังรัน...' : 'รัน Scheduler'}
                        </button>

                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-4 py-2 bg-white/20 rounded-lg font-medium flex items-center gap-2
                       hover:bg-white/30"
                        >
                            <Plus size={18} />
                            สร้าง Template
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4 mt-6">
                    <div className="bg-white/10 rounded-xl p-4">
                        <FileText size={20} className="text-white/70 mb-1" />
                        <div className="text-2xl font-bold">{templates.length}</div>
                        <div className="text-sm text-white/70">Templates</div>
                    </div>
                    <div className="bg-white/10 rounded-xl p-4">
                        <Zap size={20} className="text-white/70 mb-1" />
                        <div className="text-2xl font-bold">
                            {templates.filter(t => t.isActive).length}
                        </div>
                        <div className="text-sm text-white/70">Active</div>
                    </div>
                    <div className="bg-white/10 rounded-xl p-4">
                        <Calendar size={20} className="text-white/70 mb-1" />
                        <div className="text-2xl font-bold">{scheduleData.length}</div>
                        <div className="text-sm text-white/70">กำหนดใน 30 วัน</div>
                    </div>
                    <div className="bg-white/10 rounded-xl p-4">
                        <CheckCircle2 size={20} className="text-white/70 mb-1" />
                        <div className="text-2xl font-bold">
                            {templates.reduce((sum, t) => sum + (t.totalCreated || 0), 0)}
                        </div>
                        <div className="text-sm text-white/70">งานที่สร้างแล้ว</div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-xl shadow-sm border mb-6">
                <div className="flex border-b">
                    {[
                        { id: 'templates', label: 'Templates', icon: <FileText size={16} /> },
                        { id: 'schedule', label: 'กำหนดการ', icon: <Calendar size={16} /> },
                        { id: 'logs', label: 'ประวัติ', icon: <History size={16} /> }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-colors ${activeTab === tab.id
                                    ? 'border-purple-500 text-purple-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="p-6">
                    {/* Templates Tab */}
                    {activeTab === 'templates' && (
                        <div>
                            {templates.length === 0 ? (
                                <div className="text-center py-12">
                                    <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                                    <p className="text-gray-500 mb-4">ยังไม่มี Templates</p>
                                    <button
                                        onClick={initializeDefaults}
                                        disabled={loading}
                                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700
                             flex items-center gap-2 mx-auto"
                                    >
                                        <Zap size={16} />
                                        สร้าง Templates เริ่มต้น
                                    </button>
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {templates.map(template => (
                                        <div
                                            key={template.id}
                                            className={`border rounded-xl p-4 transition-all ${template.isActive
                                                    ? 'border-purple-200 bg-purple-50/30'
                                                    : 'border-gray-200 opacity-60'
                                                }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-start gap-3">
                                                    <div className={`p-2 rounded-lg ${template.isActive ? 'bg-purple-100' : 'bg-gray-100'
                                                        }`}>
                                                        <RefreshCw size={20} className={
                                                            template.isActive ? 'text-purple-600' : 'text-gray-400'
                                                        } />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-semibold text-gray-900">{template.name}</h3>
                                                        <p className="text-sm text-gray-500 mt-1">{template.description}</p>

                                                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                                                            <span className={`px-2 py-0.5 rounded-full text-xs ${getCategoryColor(template.category)
                                                                }`}>
                                                                {template.category}
                                                            </span>
                                                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                                                <Clock size={12} />
                                                                {formatFrequency(template.frequency)}
                                                            </span>
                                                            <span className="text-xs text-gray-500">
                                                                {template.estimatedHours}h
                                                            </span>
                                                            {template.taxFormType && (
                                                                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                                                                    {template.taxFormType}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => toggleActive(template)}
                                                        className={`p-2 rounded-lg transition-colors ${template.isActive
                                                                ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                                            }`}
                                                        title={template.isActive ? 'หยุดชั่วคราว' : 'เปิดใช้งาน'}
                                                    >
                                                        {template.isActive ? <Pause size={16} /> : <Play size={16} />}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setSelectedTemplate(template);
                                                            loadLogs(template.id);
                                                            setActiveTab('logs');
                                                        }}
                                                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                                                        title="ดูประวัติ"
                                                    >
                                                        <History size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteTemplate(template.id)}
                                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                                        title="ลบ"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
                                                <div className="flex items-center gap-4">
                                                    <span className="text-gray-500">
                                                        รันล่าสุด: <span className="text-gray-700">{formatDate(template.lastRunAt)}</span>
                                                    </span>
                                                    <span className="text-gray-500">
                                                        ครั้งถัดไป: <span className="text-purple-600 font-medium">{formatDate(template.nextRunAt)}</span>
                                                    </span>
                                                </div>
                                                <span className="text-gray-500">
                                                    สร้างแล้ว {template.totalCreated || 0} งาน
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Schedule Tab */}
                    {activeTab === 'schedule' && (
                        <div>
                            {scheduleData.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
                                    <p>ไม่มีงานที่กำหนดใน 30 วันข้างหน้า</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {scheduleData.map(({ date, templates: dayTemplates }) => (
                                        <div key={date.toISOString()} className="border rounded-xl overflow-hidden">
                                            <div className="bg-gray-50 px-4 py-2 border-b">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={16} className="text-purple-600" />
                                                    <span className="font-medium">
                                                        {date.toLocaleDateString('th-TH', {
                                                            weekday: 'long',
                                                            day: 'numeric',
                                                            month: 'long',
                                                            year: 'numeric'
                                                        })}
                                                    </span>
                                                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">
                                                        {dayTemplates.length} งาน
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="divide-y">
                                                {dayTemplates.map(template => (
                                                    <div key={template.id} className="px-4 py-3 flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-2 h-2 rounded-full ${template.priority === 'urgent' ? 'bg-red-500' :
                                                                    template.priority === 'high' ? 'bg-orange-500' :
                                                                        'bg-blue-500'
                                                                }`} />
                                                            <span className="font-medium">{template.name}</span>
                                                            <span className={`px-2 py-0.5 rounded text-xs ${getCategoryColor(template.category)
                                                                }`}>
                                                                {template.category}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                                            <Users size={14} />
                                                            {clients.length} ลูกค้า
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Logs Tab */}
                    {activeTab === 'logs' && (
                        <div>
                            {selectedTemplate && (
                                <div className="mb-4 p-3 bg-purple-50 rounded-lg flex items-center justify-between">
                                    <span className="text-purple-700">
                                        แสดงประวัติของ: <strong>{selectedTemplate.name}</strong>
                                    </span>
                                    <button
                                        onClick={() => {
                                            setSelectedTemplate(null);
                                            setLogs([]);
                                        }}
                                        className="text-purple-600 hover:text-purple-800"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            )}

                            {logs.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <History size={48} className="mx-auto mb-4 text-gray-300" />
                                    <p>ยังไม่มีประวัติ</p>
                                    {!selectedTemplate && (
                                        <p className="text-sm mt-2">เลือก Template เพื่อดูประวัติ</p>
                                    )}
                                </div>
                            ) : (
                                <div className="border rounded-xl overflow-hidden">
                                    <table className="w-full">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">วันที่</th>
                                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Template</th>
                                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">ลูกค้า</th>
                                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">สถานะ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {logs.map(log => (
                                                <tr key={log.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-sm">{formatDate(log.createdAt)}</td>
                                                    <td className="px-4 py-3 text-sm">{log.templateId}</td>
                                                    <td className="px-4 py-3 text-sm">
                                                        {clients.find(c => c.id === log.clientId)?.name || log.clientId || '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm">
                                                        <span className={`px-2 py-1 rounded-full text-xs ${log.status === 'created' ? 'bg-green-100 text-green-700' :
                                                                log.status === 'error' ? 'bg-red-100 text-red-700' :
                                                                    'bg-gray-100 text-gray-700'
                                                            }`}>
                                                            {log.status === 'created' ? 'สร้างแล้ว' :
                                                                log.status === 'error' ? 'ข้อผิดพลาด' :
                                                                    log.status}
                                                        </span>
                                                        {log.errorMessage && (
                                                            <span className="ml-2 text-red-600 text-xs">{log.errorMessage}</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Tax Deadlines Reference */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-orange-500" />
                    กำหนดยื่นภาษี (ไทย)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(THAI_TAX_DEADLINES).map(([key, deadline]) => (
                        <div key={key} className="border rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                                    {key}
                                </span>
                            </div>
                            <div className="text-sm font-medium">{deadline.nameTh}</div>
                            <div className="text-xs text-gray-500 mt-1">
                                ภายในวันที่ {deadline.dueDay} ของเดือนถัดไป{deadline.dueMonthOffset > 1 ? ` (+${deadline.dueMonthOffset} เดือน)` : ''}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default RecurringTasksManager;

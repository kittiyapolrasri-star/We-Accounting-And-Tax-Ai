/**
 * CEODashboard.tsx
 * 
 * Dashboard สำหรับ CEO/Manager 
 * - มอบหมายลูกค้าให้ Staff
 * - มอบหมายงานต่างๆ
 * - ติดตามสถานะงานทั้งหมด
 */

import React, { useState, useMemo } from 'react';
import {
    Users, Building2, CheckCircle2, Clock, AlertTriangle,
    Plus, Search, Filter, MoreVertical, TrendingUp,
    ChevronRight, Calendar, FileText, Briefcase, Crown,
    ArrowRight, Zap, Target, Activity, BarChart3,
    UserPlus, RefreshCw, Eye, Edit2, MessagesSquare
} from 'lucide-react';
import { Staff, Client } from '../types';
import { Task, TaskCategory, TaskStatus, TaskPriority, TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from '../types/tasks';

interface Props {
    staff: Staff[];
    clients: Client[];
    tasks: Task[];
    currentUserId: string;
    onAssignClient: (clientId: string, staffId: string) => void;
    onCreateTask: (task: Partial<Task>) => void;
    onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
    onViewStaffDetail: (staffId: string) => void;
    onViewClientDetail: (clientId: string) => void;
    onViewTaskDetail: (task: Task) => void;
}

// Client Assignment Card
interface ClientAssignment {
    clientId: string;
    clientName: string;
    assignedStaffId: string | null;
    assignedStaffName: string | null;
    tasksCount: number;
    pendingTasks: number;
    overdueTasks: number;
    lastActivity?: string;
    monthlyStatus: 'on_track' | 'at_risk' | 'behind' | 'completed';
}

const CEODashboard: React.FC<Props> = ({
    staff,
    clients,
    tasks,
    currentUserId,
    onAssignClient,
    onCreateTask,
    onUpdateTask,
    onViewStaffDetail,
    onViewClientDetail,
    onViewTaskDetail
}) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'clients' | 'staff' | 'tasks'>('overview');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
    const [showAssignModal, setShowAssignModal] = useState<{ type: 'client' | 'task'; id: string } | null>(null);
    const [showNewTaskModal, setShowNewTaskModal] = useState(false);

    // Calculate statistics
    const stats = useMemo(() => {
        const now = new Date();
        const activeTasks = tasks.filter(t => !['completed', 'cancelled'].includes(t.status));
        const overdueTasks = tasks.filter(t =>
            t.dueDate && new Date(t.dueDate) < now && !['completed', 'cancelled'].includes(t.status)
        );
        const completedThisMonth = tasks.filter(t => {
            if (!t.completedAt) return false;
            const completed = new Date(t.completedAt);
            return completed.getMonth() === now.getMonth() && completed.getFullYear() === now.getFullYear();
        });

        return {
            totalStaff: staff.length,
            activeStaff: staff.filter(s => s.status === 'active').length,
            totalClients: clients.length,
            activeClients: clients.filter(c => c.status === 'active').length,
            totalTasks: tasks.length,
            activeTasks: activeTasks.length,
            overdueTasks: overdueTasks.length,
            completedThisMonth: completedThisMonth.length,
            completionRate: tasks.length > 0
                ? Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100)
                : 0
        };
    }, [staff, clients, tasks]);

    // Build client assignments
    const clientAssignments: ClientAssignment[] = useMemo(() => {
        return clients.map(client => {
            const clientTasks = tasks.filter(t => t.clientId === client.id);
            const assignedStaff = staff.find(s => client.assigned_staff?.includes(s.id));
            const pendingTasks = clientTasks.filter(t => !['completed', 'cancelled'].includes(t.status));
            const overdueTasks = clientTasks.filter(t =>
                t.dueDate && new Date(t.dueDate) < new Date() && !['completed', 'cancelled'].includes(t.status)
            );

            // Determine monthly status
            let monthlyStatus: 'on_track' | 'at_risk' | 'behind' | 'completed' = 'on_track';
            if (overdueTasks.length > 3) monthlyStatus = 'behind';
            else if (overdueTasks.length > 0) monthlyStatus = 'at_risk';
            else if (pendingTasks.length === 0 && clientTasks.length > 0) monthlyStatus = 'completed';

            return {
                clientId: client.id,
                clientName: client.name,
                assignedStaffId: assignedStaff?.id || null,
                assignedStaffName: assignedStaff ? `${assignedStaff.first_name} ${assignedStaff.last_name}` : null,
                tasksCount: clientTasks.length,
                pendingTasks: pendingTasks.length,
                overdueTasks: overdueTasks.length,
                lastActivity: clientTasks[0]?.updatedAt,
                monthlyStatus
            };
        });
    }, [clients, tasks, staff]);

    // Staff workload summary
    const staffWorkload = useMemo(() => {
        return staff.map(s => {
            const staffTasks = tasks.filter(t => t.assignedTo === s.id);
            const activeTasks = staffTasks.filter(t => !['completed', 'cancelled'].includes(t.status));
            const overdue = staffTasks.filter(t =>
                t.dueDate && new Date(t.dueDate) < new Date() && !['completed', 'cancelled'].includes(t.status)
            );
            const assignedClients = clients.filter(c => c.assigned_staff?.includes(s.id));

            return {
                staff: s,
                totalTasks: staffTasks.length,
                activeTasks: activeTasks.length,
                overdue: overdue.length,
                clientCount: assignedClients.length,
                utilization: Math.min(100, (activeTasks.length / 10) * 100) // Assuming 10 tasks = 100%
            };
        }).sort((a, b) => b.activeTasks - a.activeTasks);
    }, [staff, tasks, clients]);

    // Filtered tasks for task view
    const filteredTasks = useMemo(() => {
        let result = [...tasks];

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(t =>
                t.title.toLowerCase().includes(query) ||
                t.description.toLowerCase().includes(query) ||
                t.clientName?.toLowerCase().includes(query)
            );
        }

        if (selectedCategory !== 'all') {
            result = result.filter(t => t.category === selectedCategory);
        }

        return result.sort((a, b) => {
            // Priority: overdue first, then by due date
            const aOverdue = a.dueDate && new Date(a.dueDate) < new Date();
            const bOverdue = b.dueDate && new Date(b.dueDate) < new Date();
            if (aOverdue && !bOverdue) return -1;
            if (!aOverdue && bOverdue) return 1;

            if (a.dueDate && b.dueDate) {
                return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            }
            return 0;
        });
    }, [tasks, searchQuery, selectedCategory]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'on_track':
            case 'completed': return 'bg-green-100 text-green-700';
            case 'at_risk': return 'bg-yellow-100 text-yellow-700';
            case 'behind': return 'bg-red-100 text-red-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'on_track': return 'ตรงตามแผน';
            case 'at_risk': return 'เสี่ยงล่าช้า';
            case 'behind': return 'ล่าช้า';
            case 'completed': return 'เสร็จสมบูรณ์';
            default: return status;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 text-white px-6 py-8">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-white/20 rounded-xl">
                                <Crown size={28} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold">CEO Dashboard</h1>
                                <p className="text-white/80">ภาพรวมและการจัดการทีม</p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowNewTaskModal(true)}
                                className="px-4 py-2 bg-white text-purple-600 rounded-lg font-medium 
                         hover:bg-purple-50 flex items-center gap-2"
                            >
                                <Plus size={18} />
                                สร้างงานใหม่
                            </button>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                            <div className="flex items-center gap-3">
                                <Users size={24} className="text-white/80" />
                                <div>
                                    <div className="text-2xl font-bold">{stats.activeStaff}</div>
                                    <div className="text-sm text-white/70">พนักงาน</div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                            <div className="flex items-center gap-3">
                                <Building2 size={24} className="text-white/80" />
                                <div>
                                    <div className="text-2xl font-bold">{stats.activeClients}</div>
                                    <div className="text-sm text-white/70">ลูกค้า</div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                            <div className="flex items-center gap-3">
                                <Activity size={24} className="text-white/80" />
                                <div>
                                    <div className="text-2xl font-bold">{stats.activeTasks}</div>
                                    <div className="text-sm text-white/70">งานที่กำลังทำ</div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                            <div className="flex items-center gap-3">
                                <AlertTriangle size={24} className="text-yellow-300" />
                                <div>
                                    <div className="text-2xl font-bold">{stats.overdueTasks}</div>
                                    <div className="text-sm text-white/70">งานล่าช้า</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex gap-1">
                        {[
                            { id: 'overview', label: 'ภาพรวม', icon: <BarChart3 size={18} /> },
                            { id: 'clients', label: 'ลูกค้า', icon: <Building2 size={18} /> },
                            { id: 'staff', label: 'พนักงาน', icon: <Users size={18} /> },
                            { id: 'tasks', label: 'งานทั้งหมด', icon: <FileText size={18} /> }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${activeTab === tab.id
                                        ? 'border-purple-600 text-purple-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-6 py-6">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Staff Workload */}
                        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold">ภาระงานพนักงาน</h2>
                                <button
                                    onClick={() => setActiveTab('staff')}
                                    className="text-sm text-purple-600 hover:underline"
                                >
                                    ดูทั้งหมด
                                </button>
                            </div>

                            <div className="space-y-4">
                                {staffWorkload.slice(0, 5).map(sw => (
                                    <div
                                        key={sw.staff.id}
                                        className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                                        onClick={() => onViewStaffDetail(sw.staff.id)}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 
                                  flex items-center justify-center text-white font-medium">
                                            {sw.staff.first_name[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-gray-900">
                                                {sw.staff.first_name} {sw.staff.last_name}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {sw.clientCount} ลูกค้า · {sw.activeTasks} งาน
                                                {sw.overdue > 0 && (
                                                    <span className="text-red-500 ml-1">· {sw.overdue} ล่าช้า</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="w-24">
                                            <div className="text-xs text-right mb-1">{Math.round(sw.utilization)}%</div>
                                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${sw.utilization > 80 ? 'bg-red-500' :
                                                            sw.utilization > 60 ? 'bg-yellow-500' : 'bg-green-500'
                                                        }`}
                                                    style={{ width: `${sw.utilization}%` }}
                                                />
                                            </div>
                                        </div>
                                        <ChevronRight size={16} className="text-gray-400" />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Urgent Items */}
                        <div className="bg-white rounded-xl shadow-sm border p-6">
                            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <AlertTriangle size={20} className="text-red-500" />
                                ต้องดำเนินการด่วน
                            </h2>

                            <div className="space-y-3">
                                {tasks
                                    .filter(t =>
                                        t.priority === 'urgent' ||
                                        (t.dueDate && new Date(t.dueDate) < new Date() && !['completed', 'cancelled'].includes(t.status))
                                    )
                                    .slice(0, 5)
                                    .map(task => (
                                        <div
                                            key={task.id}
                                            onClick={() => onViewTaskDetail(task)}
                                            className="p-3 rounded-lg border border-red-200 bg-red-50 cursor-pointer 
                               hover:border-red-300 transition-colors"
                                        >
                                            <div className="font-medium text-gray-900 text-sm">{task.title}</div>
                                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
                                                {task.clientName && (
                                                    <span className="flex items-center gap-1">
                                                        <Building2 size={12} />
                                                        {task.clientName}
                                                    </span>
                                                )}
                                                {task.dueDate && (
                                                    <span className="flex items-center gap-1 text-red-600">
                                                        <Calendar size={12} />
                                                        {new Date(task.dueDate).toLocaleDateString('th-TH')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                {tasks.filter(t => t.priority === 'urgent').length === 0 && (
                                    <div className="text-center py-6 text-gray-500">
                                        <CheckCircle2 size={32} className="mx-auto mb-2 text-green-500" />
                                        <p>ไม่มีงานด่วน</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Client Status Overview */}
                        <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold">สถานะงานลูกค้า</h2>
                                <button
                                    onClick={() => setActiveTab('clients')}
                                    className="text-sm text-purple-600 hover:underline"
                                >
                                    ดูทั้งหมด
                                </button>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                                    <div className="text-2xl font-bold text-green-700">
                                        {clientAssignments.filter(c => c.monthlyStatus === 'on_track').length}
                                    </div>
                                    <div className="text-sm text-green-600">ตรงตามแผน</div>
                                </div>
                                <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                                    <div className="text-2xl font-bold text-yellow-700">
                                        {clientAssignments.filter(c => c.monthlyStatus === 'at_risk').length}
                                    </div>
                                    <div className="text-sm text-yellow-600">เสี่ยงล่าช้า</div>
                                </div>
                                <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                                    <div className="text-2xl font-bold text-red-700">
                                        {clientAssignments.filter(c => c.monthlyStatus === 'behind').length}
                                    </div>
                                    <div className="text-sm text-red-600">ล่าช้า</div>
                                </div>
                                <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                                    <div className="text-2xl font-bold text-blue-700">
                                        {clientAssignments.filter(c => c.monthlyStatus === 'completed').length}
                                    </div>
                                    <div className="text-sm text-blue-600">เสร็จสมบูรณ์</div>
                                </div>
                            </div>

                            {/* Client list with issues */}
                            <div className="space-y-2">
                                {clientAssignments
                                    .filter(c => c.monthlyStatus === 'behind' || c.monthlyStatus === 'at_risk')
                                    .map(client => (
                                        <div
                                            key={client.clientId}
                                            className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                                            onClick={() => onViewClientDetail(client.clientId)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                                                    <Building2 size={20} className="text-gray-500" />
                                                </div>
                                                <div>
                                                    <div className="font-medium">{client.clientName}</div>
                                                    <div className="text-sm text-gray-500">
                                                        {client.assignedStaffName || 'ยังไม่มอบหมาย'} ·
                                                        {client.pendingTasks} งานค้าง
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(client.monthlyStatus)}`}>
                                                    {getStatusLabel(client.monthlyStatus)}
                                                </span>
                                                <ChevronRight size={16} className="text-gray-400" />
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Clients Tab */}
                {activeTab === 'clients' && (
                    <div className="space-y-6">
                        {/* Search & Filters */}
                        <div className="flex gap-4">
                            <div className="flex-1 relative">
                                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="ค้นหาลูกค้า..."
                                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                                />
                            </div>
                            <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2">
                                <Filter size={18} />
                                ตัวกรอง
                            </button>
                        </div>

                        {/* Client Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {clientAssignments
                                .filter(c =>
                                    !searchQuery ||
                                    c.clientName.toLowerCase().includes(searchQuery.toLowerCase())
                                )
                                .map(client => (
                                    <div
                                        key={client.clientId}
                                        className="bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow"
                                    >
                                        <div className="p-4">
                                            <div className="flex items-start justify-between mb-3">
                                                <div
                                                    className="flex items-center gap-3 cursor-pointer"
                                                    onClick={() => onViewClientDetail(client.clientId)}
                                                >
                                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 
                                        flex items-center justify-center text-white font-bold">
                                                        {client.clientName[0]}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold">{client.clientName}</div>
                                                        <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(client.monthlyStatus)}`}>
                                                            {getStatusLabel(client.monthlyStatus)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <button className="p-1 hover:bg-gray-100 rounded">
                                                    <MoreVertical size={16} className="text-gray-400" />
                                                </button>
                                            </div>

                                            {/* Staff Assignment */}
                                            <div className="mb-4">
                                                <div className="text-xs text-gray-500 mb-1">ผู้รับผิดชอบ</div>
                                                {client.assignedStaffId ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-purple-500 text-white text-xs 
                                          flex items-center justify-center">
                                                            {client.assignedStaffName?.[0]}
                                                        </div>
                                                        <span className="text-sm">{client.assignedStaffName}</span>
                                                        <button
                                                            onClick={() => setShowAssignModal({ type: 'client', id: client.clientId })}
                                                            className="ml-auto text-purple-600 text-sm hover:underline"
                                                        >
                                                            เปลี่ยน
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setShowAssignModal({ type: 'client', id: client.clientId })}
                                                        className="flex items-center gap-2 text-sm text-purple-600 hover:underline"
                                                    >
                                                        <UserPlus size={14} />
                                                        มอบหมายผู้รับผิดชอบ
                                                    </button>
                                                )}
                                            </div>

                                            {/* Task Stats */}
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="text-center p-2 bg-gray-50 rounded">
                                                    <div className="text-lg font-bold text-gray-700">{client.tasksCount}</div>
                                                    <div className="text-xs text-gray-500">งานทั้งหมด</div>
                                                </div>
                                                <div className="text-center p-2 bg-blue-50 rounded">
                                                    <div className="text-lg font-bold text-blue-600">{client.pendingTasks}</div>
                                                    <div className="text-xs text-blue-500">กำลังทำ</div>
                                                </div>
                                                <div className="text-center p-2 bg-red-50 rounded">
                                                    <div className="text-lg font-bold text-red-600">{client.overdueTasks}</div>
                                                    <div className="text-xs text-red-500">ล่าช้า</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="px-4 py-3 border-t bg-gray-50 rounded-b-xl flex gap-2">
                                            <button
                                                onClick={() => onViewClientDetail(client.clientId)}
                                                className="flex-1 text-sm text-gray-600 hover:text-gray-900"
                                            >
                                                ดูรายละเอียด
                                            </button>
                                            <button
                                                onClick={() => {
                                                    // Create accounting task for this client
                                                    onCreateTask({
                                                        title: `งานบัญชีประจำเดือน - ${client.clientName}`,
                                                        category: 'period_closing',
                                                        clientId: client.clientId,
                                                        clientName: client.clientName,
                                                        assignedTo: client.assignedStaffId || undefined,
                                                        assignedBy: currentUserId,
                                                        priority: 'medium',
                                                        status: 'todo'
                                                    });
                                                }}
                                                className="flex-1 text-sm text-purple-600 hover:text-purple-800 flex items-center justify-center gap-1"
                                            >
                                                <Plus size={14} />
                                                สร้างงาน
                                            </button>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}

                {/* Staff Tab */}
                {activeTab === 'staff' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {staffWorkload.map(sw => (
                                <div
                                    key={sw.staff.id}
                                    className="bg-white rounded-xl border shadow-sm p-4"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 
                                  flex items-center justify-center text-white text-xl font-bold">
                                            {sw.staff.first_name[0]}{sw.staff.last_name[0]}
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-semibold text-lg">
                                                {sw.staff.first_name} {sw.staff.last_name}
                                            </div>
                                            <div className="text-sm text-gray-500">{sw.staff.role}</div>
                                            <div className={`inline-block px-2 py-0.5 rounded text-xs mt-1 ${sw.staff.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                {sw.staff.status === 'active' ? 'พร้อมรับงาน' : sw.staff.status}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                                        <div className="p-2 bg-blue-50 rounded">
                                            <div className="text-xl font-bold text-blue-600">{sw.clientCount}</div>
                                            <div className="text-xs text-blue-500">ลูกค้า</div>
                                        </div>
                                        <div className="p-2 bg-purple-50 rounded">
                                            <div className="text-xl font-bold text-purple-600">{sw.activeTasks}</div>
                                            <div className="text-xs text-purple-500">งาน</div>
                                        </div>
                                        <div className={`p-2 rounded ${sw.overdue > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                                            <div className={`text-xl font-bold ${sw.overdue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {sw.overdue}
                                            </div>
                                            <div className={`text-xs ${sw.overdue > 0 ? 'text-red-500' : 'text-green-500'}`}>ล่าช้า</div>
                                        </div>
                                    </div>

                                    <div className="mt-4">
                                        <div className="flex items-center justify-between text-sm mb-1">
                                            <span className="text-gray-600">Workload</span>
                                            <span className={`font-medium ${sw.utilization > 80 ? 'text-red-600' :
                                                    sw.utilization > 60 ? 'text-yellow-600' : 'text-green-600'
                                                }`}>
                                                {Math.round(sw.utilization)}%
                                            </span>
                                        </div>
                                        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${sw.utilization > 80 ? 'bg-red-500' :
                                                        sw.utilization > 60 ? 'bg-yellow-500' : 'bg-green-500'
                                                    }`}
                                                style={{ width: `${sw.utilization}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-4 flex gap-2">
                                        <button
                                            onClick={() => onViewStaffDetail(sw.staff.id)}
                                            className="flex-1 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
                                        >
                                            ดูงาน
                                        </button>
                                        <button
                                            onClick={() => {
                                                // Open task creation with this staff pre-selected
                                                setShowNewTaskModal(true);
                                            }}
                                            className="flex-1 px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                                        >
                                            มอบหมายงาน
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tasks Tab */}
                {activeTab === 'tasks' && (
                    <div className="space-y-4">
                        {/* Search & Filters */}
                        <div className="flex gap-4 flex-wrap">
                            <div className="flex-1 min-w-[200px] relative">
                                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="ค้นหางาน..."
                                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                                />
                            </div>
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="px-4 py-2 border rounded-lg"
                            >
                                <option value="all">ทุกประเภท</option>
                                <option value="document_review">ตรวจสอบเอกสาร</option>
                                <option value="gl_posting">ลงบัญชี</option>
                                <option value="bank_reconciliation">กระทบยอดธนาคาร</option>
                                <option value="period_closing">ปิดงวด</option>
                                <option value="tax_filing">ยื่นภาษี</option>
                                <option value="financial_report">จัดทำงบ</option>
                            </select>
                            <button
                                onClick={() => setShowNewTaskModal(true)}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg flex items-center gap-2"
                            >
                                <Plus size={18} />
                                สร้างงานใหม่
                            </button>
                        </div>

                        {/* Task List */}
                        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">งาน</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">ลูกค้า</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">ผู้รับผิดชอบ</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">สถานะ</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">กำหนดส่ง</th>
                                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filteredTasks.map(task => {
                                        const assignedStaff = staff.find(s => s.id === task.assignedTo);
                                        const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() &&
                                            !['completed', 'cancelled'].includes(task.status);

                                        return (
                                            <tr
                                                key={task.id}
                                                className={`hover:bg-gray-50 cursor-pointer ${isOverdue ? 'bg-red-50' : ''}`}
                                                onClick={() => onViewTaskDetail(task)}
                                            >
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-gray-900">{task.title}</div>
                                                    <div className="text-sm text-gray-500">{task.category}</div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600">
                                                    {task.clientName || '-'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {assignedStaff ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-purple-500 text-white text-xs 
                                            flex items-center justify-center">
                                                                {assignedStaff.first_name[0]}
                                                            </div>
                                                            <span className="text-sm">{assignedStaff.first_name}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm text-gray-400">ไม่มี</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${task.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                            task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                                                task.status === 'blocked' ? 'bg-red-100 text-red-700' :
                                                                    'bg-gray-100 text-gray-700'
                                                        }`}>
                                                        {TASK_STATUS_LABELS[task.status]?.t || task.status}
                                                    </span>
                                                </td>
                                                <td className={`px-4 py-3 text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                                                    {task.dueDate
                                                        ? new Date(task.dueDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
                                                        : '-'
                                                    }
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setShowAssignModal({ type: 'task', id: task.id });
                                                        }}
                                                        className="px-3 py-1 text-sm text-purple-600 hover:bg-purple-50 rounded"
                                                    >
                                                        มอบหมาย
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {filteredTasks.length === 0 && (
                                <div className="py-12 text-center text-gray-500">
                                    <FileText size={40} className="mx-auto mb-3 text-gray-300" />
                                    <p>ไม่พบงาน</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Assignment Modal */}
            {showAssignModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl w-full max-w-md p-6">
                        <h3 className="text-lg font-semibold mb-4">
                            {showAssignModal.type === 'client' ? 'มอบหมายลูกค้า' : 'มอบหมายงาน'}
                        </h3>

                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {staff
                                .filter(s => s.status === 'active')
                                .map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => {
                                            if (showAssignModal.type === 'client') {
                                                onAssignClient(showAssignModal.id, s.id);
                                            } else {
                                                onUpdateTask(showAssignModal.id, { assignedTo: s.id });
                                            }
                                            setShowAssignModal(null);
                                        }}
                                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-left"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 
                                  flex items-center justify-center text-white font-medium">
                                            {s.first_name[0]}
                                        </div>
                                        <div>
                                            <div className="font-medium">{s.first_name} {s.last_name}</div>
                                            <div className="text-sm text-gray-500">{s.role}</div>
                                        </div>
                                    </button>
                                ))}
                        </div>

                        <div className="mt-4 flex justify-end">
                            <button
                                onClick={() => setShowAssignModal(null)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                                ยกเลิก
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* New Task Modal - Simplified version */}
            {showNewTaskModal && (
                <NewTaskModal
                    staff={staff}
                    clients={clients}
                    onClose={() => setShowNewTaskModal(false)}
                    onCreate={(data) => {
                        onCreateTask({
                            ...data,
                            assignedBy: currentUserId
                        });
                        setShowNewTaskModal(false);
                    }}
                />
            )}
        </div>
    );
};

// New Task Modal Component
interface NewTaskModalProps {
    staff: Staff[];
    clients: Client[];
    onClose: () => void;
    onCreate: (data: Partial<Task>) => void;
}

const NewTaskModal: React.FC<NewTaskModalProps> = ({ staff, clients, onClose, onCreate }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState<TaskCategory>('general');
    const [priority, setPriority] = useState<TaskPriority>('medium');
    const [clientId, setClientId] = useState('');
    const [assignedTo, setAssignedTo] = useState('');
    const [dueDate, setDueDate] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const selectedClient = clients.find(c => c.id === clientId);

        onCreate({
            title,
            description,
            category,
            priority,
            clientId: clientId || undefined,
            clientName: selectedClient?.name,
            assignedTo: assignedTo || null,
            dueDate: dueDate || null,
            status: 'todo'
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Plus size={20} />
                    สร้างงานใหม่
                </h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ชื่องาน</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                            placeholder="เช่น ตรวจสอบเอกสารลูกค้า XYZ"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ประเภท</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value as TaskCategory)}
                                className="w-full px-3 py-2 border rounded-lg"
                            >
                                <option value="general">งานทั่วไป</option>
                                <option value="document_review">ตรวจสอบเอกสาร</option>
                                <option value="gl_posting">ลงบัญชี</option>
                                <option value="bank_reconciliation">กระทบยอดธนาคาร</option>
                                <option value="period_closing">ปิดงวด</option>
                                <option value="tax_filing">ยื่นภาษี</option>
                                <option value="financial_report">จัดทำงบ</option>
                                <option value="client_request">ตอบคำถามลูกค้า</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ความสำคัญ</label>
                            <select
                                value={priority}
                                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                                className="w-full px-3 py-2 border rounded-lg"
                            >
                                <option value="low">ต่ำ</option>
                                <option value="medium">ปานกลาง</option>
                                <option value="high">สูง</option>
                                <option value="urgent">ด่วนมาก</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ลูกค้า (ถ้ามี)</label>
                        <select
                            value={clientId}
                            onChange={(e) => setClientId(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg"
                        >
                            <option value="">-- ไม่ระบุ --</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">มอบหมายให้</label>
                        <select
                            value={assignedTo}
                            onChange={(e) => setAssignedTo(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg"
                        >
                            <option value="">-- ไม่ระบุ --</option>
                            {staff.filter(s => s.status === 'active').map(s => (
                                <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">กำหนดส่ง</label>
                        <input
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg"
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                        >
                            สร้างงาน
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CEODashboard;

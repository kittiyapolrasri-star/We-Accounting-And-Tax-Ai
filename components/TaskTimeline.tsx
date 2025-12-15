/**
 * TaskTimeline.tsx
 * 
 * Gantt Chart / Timeline View สำหรับ Task Management
 * แสดงงานตามลำดับเวลาและระยะเวลาการทำงาน
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
    ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Calendar,
    Clock, User, AlertTriangle, CheckCircle2, Play, Pause,
    Filter, Download, MoreVertical, Eye
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority, TASK_STATUS_LABELS, TASK_PRIORITY_COLORS } from '../types/tasks';
import { Staff, Client } from '../types';

interface Props {
    tasks: Task[];
    staff: Staff[];
    clients: Client[];
    onTaskClick: (task: Task) => void;
    onUpdateTask?: (taskId: string, updates: Partial<Task>) => void;
    currentUserId?: string;
}

type ViewMode = 'day' | 'week' | 'month';

interface TimelineDay {
    date: Date;
    dateString: string;
    dayOfWeek: number;
    dayOfMonth: number;
    isToday: boolean;
    isWeekend: boolean;
}

const TaskTimeline: React.FC<Props> = ({
    tasks,
    staff,
    clients,
    onTaskClick,
    onUpdateTask,
    currentUserId
}) => {
    const [viewMode, setViewMode] = useState<ViewMode>('week');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [filter, setFilter] = useState<'all' | 'my' | 'team'>('all');
    const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Calculate visible date range
    const dateRange = useMemo(() => {
        const dates: TimelineDay[] = [];
        const start = new Date(currentDate);
        const daysToShow = viewMode === 'day' ? 7 : viewMode === 'week' ? 14 : 31;

        // Start from beginning of current week/month
        if (viewMode === 'week') {
            start.setDate(start.getDate() - start.getDay());
        } else if (viewMode === 'month') {
            start.setDate(1);
        }

        for (let i = 0; i < daysToShow; i++) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            const today = new Date();

            dates.push({
                date,
                dateString: date.toISOString().slice(0, 10),
                dayOfWeek: date.getDay(),
                dayOfMonth: date.getDate(),
                isToday: date.toDateString() === today.toDateString(),
                isWeekend: date.getDay() === 0 || date.getDay() === 6
            });
        }

        return dates;
    }, [currentDate, viewMode]);

    // Filter tasks
    const filteredTasks = useMemo(() => {
        let result = [...tasks];

        // Filter by owner
        if (filter === 'my' && currentUserId) {
            result = result.filter(t => t.assignedTo === currentUserId);
        }

        // Filter by staff
        if (selectedStaffId) {
            result = result.filter(t => t.assignedTo === selectedStaffId);
        }

        // Filter by client
        if (selectedClientId) {
            result = result.filter(t => t.clientId === selectedClientId);
        }

        // Sort by start date, then due date
        return result.sort((a, b) => {
            const aDate = a.startDate || a.dueDate || a.createdAt;
            const bDate = b.startDate || b.dueDate || b.createdAt;
            return new Date(aDate).getTime() - new Date(bDate).getTime();
        });
    }, [tasks, filter, currentUserId, selectedStaffId, selectedClientId]);

    // Group tasks by staff
    const tasksByStaff = useMemo(() => {
        const grouped = new Map<string, Task[]>();
        grouped.set('unassigned', []);

        staff.forEach(s => {
            grouped.set(s.id, []);
        });

        filteredTasks.forEach(task => {
            const staffId = task.assignedTo || 'unassigned';
            const existing = grouped.get(staffId) || [];
            existing.push(task);
            grouped.set(staffId, existing);
        });

        return grouped;
    }, [filteredTasks, staff]);

    // Navigation
    const navigate = (direction: 'prev' | 'next') => {
        const newDate = new Date(currentDate);
        const offset = viewMode === 'day' ? 7 : viewMode === 'week' ? 14 : 31;
        newDate.setDate(newDate.getDate() + (direction === 'next' ? offset : -offset));
        setCurrentDate(newDate);
    };

    const goToToday = () => {
        setCurrentDate(new Date());
    };

    // Calculate task bar position
    const getTaskBarStyle = (task: Task): React.CSSProperties => {
        const startDate = task.startDate ? new Date(task.startDate) :
            task.dueDate ? new Date(task.dueDate) : new Date();
        const endDate = task.dueDate ? new Date(task.dueDate) : startDate;

        // Default to 1 day if same date
        if (startDate.toDateString() === endDate.toDateString()) {
            endDate.setDate(endDate.getDate() + 1);
        }

        const rangeStart = dateRange[0]?.date;
        const rangeEnd = dateRange[dateRange.length - 1]?.date;

        if (!rangeStart || !rangeEnd) return { display: 'none' };

        // Calculate position
        const totalDays = dateRange.length;
        const dayWidth = 100 / totalDays;

        const startOffset = Math.max(0,
            Math.floor((startDate.getTime() - rangeStart.getTime()) / (24 * 60 * 60 * 1000))
        );
        const duration = Math.max(1,
            Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
        );

        // Hide if completely outside range
        if (startOffset >= totalDays || startOffset + duration < 0) {
            return { display: 'none' };
        }

        return {
            left: `${startOffset * dayWidth}%`,
            width: `${Math.min(duration, totalDays - startOffset) * dayWidth}%`,
        };
    };

    // Get status color
    const getStatusColor = (status: TaskStatus): string => {
        switch (status) {
            case 'completed': return 'bg-green-500';
            case 'in_progress': return 'bg-blue-500';
            case 'reviewing': return 'bg-purple-500';
            case 'blocked': return 'bg-red-500';
            case 'cancelled': return 'bg-gray-400';
            default: return 'bg-gray-500';
        }
    };

    // Get priority indicator
    const getPriorityIndicator = (priority: TaskPriority): JSX.Element | null => {
        if (priority === 'urgent') {
            return <AlertTriangle size={12} className="text-red-500" />;
        }
        return null;
    };

    // Day labels
    const DAY_NAMES = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
    const MONTH_NAMES = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

    return (
        <div className="h-full bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Calendar className="text-blue-600" size={24} />
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Timeline View</h2>
                            <p className="text-sm text-gray-500">
                                {dateRange[0]?.date.toLocaleDateString('th-TH', { day: 'numeric', month: 'long' })} -
                                {dateRange[dateRange.length - 1]?.date.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* View Mode */}
                        <div className="flex rounded-lg border overflow-hidden">
                            {(['day', 'week', 'month'] as ViewMode[]).map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setViewMode(mode)}
                                    className={`px-3 py-1.5 text-sm ${viewMode === mode
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    {mode === 'day' ? 'วัน' : mode === 'week' ? 'สัปดาห์' : 'เดือน'}
                                </button>
                            ))}
                        </div>

                        {/* Navigation */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => navigate('prev')}
                                className="p-2 hover:bg-gray-100 rounded-lg"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <button
                                onClick={goToToday}
                                className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                            >
                                วันนี้
                            </button>
                            <button
                                onClick={() => navigate('next')}
                                className="p-2 hover:bg-gray-100 rounded-lg"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">แสดง:</span>
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value as any)}
                            className="text-sm border rounded-lg px-3 py-1.5"
                        >
                            <option value="all">ทั้งหมด</option>
                            <option value="my">งานของฉัน</option>
                            <option value="team">ทีม</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">พนักงาน:</span>
                        <select
                            value={selectedStaffId || ''}
                            onChange={(e) => setSelectedStaffId(e.target.value || null)}
                            className="text-sm border rounded-lg px-3 py-1.5"
                        >
                            <option value="">ทั้งหมด</option>
                            {staff.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.first_name} {s.last_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">ลูกค้า:</span>
                        <select
                            value={selectedClientId || ''}
                            onChange={(e) => setSelectedClientId(e.target.value || null)}
                            className="text-sm border rounded-lg px-3 py-1.5"
                        >
                            <option value="">ทั้งหมด</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="ml-auto text-sm text-gray-500">
                        {filteredTasks.length} งาน
                    </div>
                </div>
            </div>

            {/* Timeline Grid */}
            <div className="flex-1 overflow-auto" ref={scrollRef}>
                <div className="min-w-[800px]">
                    {/* Date Headers */}
                    <div className="sticky top-0 z-10 bg-white border-b">
                        <div className="flex">
                            {/* Staff column header */}
                            <div className="w-48 flex-shrink-0 p-2 bg-gray-50 border-r font-medium text-sm text-gray-600">
                                พนักงาน
                            </div>

                            {/* Date columns */}
                            <div className="flex-1 flex">
                                {dateRange.map((day, idx) => (
                                    <div
                                        key={day.dateString}
                                        className={`flex-1 text-center py-2 border-r text-sm ${day.isToday ? 'bg-blue-50' :
                                                day.isWeekend ? 'bg-gray-50' : 'bg-white'
                                            }`}
                                    >
                                        <div className={`text-xs ${day.isToday ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
                                            {DAY_NAMES[day.dayOfWeek]}
                                        </div>
                                        <div className={`font-medium ${day.isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                                            {day.dayOfMonth}
                                        </div>
                                        {day.dayOfMonth === 1 && (
                                            <div className="text-xs text-gray-400">
                                                {MONTH_NAMES[day.date.getMonth()]}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Staff Rows */}
                    {Array.from(tasksByStaff.entries()).map(([staffId, staffTasks]) => {
                        if (staffTasks.length === 0 && staffId !== 'unassigned') return null;

                        const staffMember = staff.find(s => s.id === staffId);
                        const displayName = staffMember
                            ? `${staffMember.first_name} ${staffMember.last_name}`
                            : 'ไม่ได้มอบหมาย';

                        return (
                            <div key={staffId} className="flex border-b hover:bg-gray-50/50">
                                {/* Staff Info */}
                                <div className="w-48 flex-shrink-0 p-2 border-r bg-gray-50/50">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${staffId === 'unassigned' ? 'bg-gray-400' : 'bg-gradient-to-br from-blue-500 to-purple-500'
                                            }`}>
                                            {staffId === 'unassigned' ? '?' : displayName[0]}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-gray-900 truncate max-w-[120px]">
                                                {displayName}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {staffTasks.length} งาน
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Task Bars */}
                                <div className="flex-1 relative min-h-[60px]">
                                    {/* Grid Lines */}
                                    <div className="absolute inset-0 flex">
                                        {dateRange.map((day) => (
                                            <div
                                                key={day.dateString}
                                                className={`flex-1 border-r ${day.isToday ? 'bg-blue-50/50' :
                                                        day.isWeekend ? 'bg-gray-50/50' : ''
                                                    }`}
                                            />
                                        ))}
                                    </div>

                                    {/* Task Bars */}
                                    <div className="relative py-2 px-1">
                                        {staffTasks.map((task, idx) => {
                                            const style = getTaskBarStyle(task);
                                            if (style.display === 'none') return null;

                                            const isOverdue = task.dueDate &&
                                                new Date(task.dueDate) < new Date() &&
                                                !['completed', 'cancelled'].includes(task.status);

                                            return (
                                                <div
                                                    key={task.id}
                                                    onClick={() => onTaskClick(task)}
                                                    className={`absolute h-7 rounded-md cursor-pointer transition-all
                                    hover:shadow-md hover:scale-[1.02] flex items-center gap-1 px-2
                                    ${getStatusColor(task.status)} bg-opacity-90`}
                                                    style={{
                                                        ...style,
                                                        top: `${idx * 32 + 4}px`,
                                                    }}
                                                    title={task.title}
                                                >
                                                    {getPriorityIndicator(task.priority)}
                                                    <span className="text-white text-xs font-medium truncate">
                                                        {task.title}
                                                    </span>
                                                    {isOverdue && (
                                                        <AlertTriangle size={12} className="text-yellow-300 flex-shrink-0" />
                                                    )}
                                                    {task.progress > 0 && task.progress < 100 && (
                                                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20 rounded-b">
                                                            <div
                                                                className="h-full bg-white/50 rounded-b"
                                                                style={{ width: `${task.progress}%` }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Empty State */}
                    {filteredTasks.length === 0 && (
                        <div className="flex items-center justify-center h-64 text-gray-500">
                            <div className="text-center">
                                <Calendar size={48} className="mx-auto mb-3 text-gray-300" />
                                <p>ไม่พบงานในช่วงเวลานี้</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Legend */}
            <div className="p-3 border-t bg-gray-50 flex items-center gap-4 text-sm">
                <span className="text-gray-600 font-medium">สถานะ:</span>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-gray-500" />
                        <span>รอดำเนินการ</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-blue-500" />
                        <span>กำลังทำ</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-purple-500" />
                        <span>รอตรวจสอบ</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-green-500" />
                        <span>เสร็จแล้ว</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-red-500" />
                        <span>ติดขัด</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TaskTimeline;

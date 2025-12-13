/**
 * TaskBoard Component - Notion-style Kanban Board
 * สำหรับจัดการและมอบหมายงาน
 */

import React, { useState, useMemo } from 'react';
import {
  Plus,
  MoreHorizontal,
  Calendar,
  Clock,
  User,
  Flag,
  MessageSquare,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  SortAsc,
  LayoutGrid,
  List,
  CalendarDays,
  GripVertical,
  Edit3,
  Trash2,
  Copy,
  Archive,
  Tag,
  AlertCircle,
  CheckCircle2,
  Circle,
  Timer,
  Loader2,
} from 'lucide-react';
import {
  Task,
  TaskStatus,
  TaskPriority,
  TaskCategory,
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
  TASK_CATEGORY_LABELS,
} from '../types/tasks';
import { Staff } from '../types';

interface TaskBoardProps {
  tasks: Task[];
  staff: Staff[];
  onCreateTask: (data: Partial<Task>) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  onTaskClick: (task: Task) => void;
  currentUserId?: string;
}

type ViewMode = 'board' | 'list' | 'calendar';

const TaskBoard: React.FC<TaskBoardProps> = ({
  tasks,
  staff,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onTaskClick,
  currentUserId,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [filterAssignee, setFilterAssignee] = useState<string | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>('todo');

  // Filter and search tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !task.title.toLowerCase().includes(query) &&
          !task.description.toLowerCase().includes(query) &&
          !task.clientName?.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      // Filter by status
      if (filterStatus !== 'all' && task.status !== filterStatus) {
        return false;
      }

      // Filter by assignee
      if (filterAssignee !== 'all' && task.assignedTo !== filterAssignee) {
        return false;
      }

      // Filter by priority
      if (filterPriority !== 'all' && task.priority !== filterPriority) {
        return false;
      }

      return true;
    });
  }, [tasks, searchQuery, filterStatus, filterAssignee, filterPriority]);

  // Group tasks by status for Kanban view
  const tasksByStatus = useMemo(() => {
    const groups: Record<TaskStatus, Task[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      reviewing: [],
      completed: [],
      cancelled: [],
      blocked: [],
    };

    filteredTasks.forEach((task) => {
      groups[task.status].push(task);
    });

    // Sort each group by priority
    const priorityOrder: Record<TaskPriority, number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    Object.keys(groups).forEach((status) => {
      groups[status as TaskStatus].sort(
        (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
      );
    });

    return groups;
  }, [filteredTasks]);

  // Visible columns (hide cancelled by default)
  const visibleStatuses: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'reviewing', 'completed'];

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    if (draggedTask && draggedTask.status !== targetStatus) {
      onUpdateTask(draggedTask.id, { status: targetStatus });
    }
    setDraggedTask(null);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
  };

  // Quick add task
  const handleQuickAddTask = (status: TaskStatus) => {
    setNewTaskStatus(status);
    setShowNewTaskModal(true);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              📋 Task Board
            </h1>
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {filteredTasks.length} งาน
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('board')}
                className={`p-2 rounded ${viewMode === 'board' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                title="Kanban Board"
              >
                <LayoutGrid size={18} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                title="List View"
              >
                <List size={18} />
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`p-2 rounded ${viewMode === 'calendar' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                title="Calendar View"
              >
                <CalendarDays size={18} />
              </button>
            </div>

            <button
              onClick={() => setShowNewTaskModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              <span>สร้างงานใหม่</span>
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="ค้นหางาน..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-gray-200 hover:bg-gray-50'}`}
          >
            <Filter size={18} />
            <span>ตัวกรอง</span>
            {(filterStatus !== 'all' || filterAssignee !== 'all' || filterPriority !== 'all') && (
              <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                {[filterStatus !== 'all', filterAssignee !== 'all', filterPriority !== 'all'].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="flex items-center gap-4 mt-4 pt-4 border-t">
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">สถานะ:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as TaskStatus | 'all')}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">ทั้งหมด</option>
                {Object.entries(TASK_STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {/* Assignee Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">ผู้รับผิดชอบ:</span>
              <select
                value={filterAssignee}
                onChange={(e) => setFilterAssignee(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">ทั้งหมด</option>
                <option value="">ยังไม่มอบหมาย</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Priority Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">ความสำคัญ:</span>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value as TaskPriority | 'all')}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">ทั้งหมด</option>
                {Object.entries(TASK_PRIORITY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {/* Clear Filters */}
            {(filterStatus !== 'all' || filterAssignee !== 'all' || filterPriority !== 'all') && (
              <button
                onClick={() => {
                  setFilterStatus('all');
                  setFilterAssignee('all');
                  setFilterPriority('all');
                }}
                className="text-sm text-red-600 hover:text-red-700"
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>
        )}
      </div>

      {/* Board Content */}
      {viewMode === 'board' && (
        <div className="flex-1 overflow-x-auto p-6">
          <div className="flex gap-4 h-full min-w-max">
            {visibleStatuses.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                tasks={tasksByStatus[status]}
                staff={staff}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                onTaskClick={onTaskClick}
                onQuickAdd={() => handleQuickAddTask(status)}
                isDragTarget={draggedTask?.status !== status}
              />
            ))}
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="flex-1 overflow-auto p-6">
          <TaskListView
            tasks={filteredTasks}
            staff={staff}
            onTaskClick={onTaskClick}
            onUpdateTask={onUpdateTask}
          />
        </div>
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="flex-1 overflow-auto p-6">
          <TaskCalendarView
            tasks={filteredTasks}
            onTaskClick={onTaskClick}
          />
        </div>
      )}

      {/* New Task Modal */}
      {showNewTaskModal && (
        <NewTaskModal
          status={newTaskStatus}
          staff={staff}
          onClose={() => setShowNewTaskModal(false)}
          onCreate={(data) => {
            onCreateTask(data);
            setShowNewTaskModal(false);
          }}
        />
      )}
    </div>
  );
};

// Kanban Column Component
interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  staff: Staff[];
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, status: TaskStatus) => void;
  onDragEnd: () => void;
  onTaskClick: (task: Task) => void;
  onQuickAdd: () => void;
  isDragTarget: boolean;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  status,
  tasks,
  staff,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onTaskClick,
  onQuickAdd,
  isDragTarget,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div
      className={`flex flex-col w-80 bg-gray-100 rounded-xl ${isDragTarget ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}`}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, status)}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-gray-400 hover:text-gray-600"
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </button>
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: TASK_STATUS_COLORS[status] }}
          />
          <span className="font-medium text-gray-700">{TASK_STATUS_LABELS[status]}</span>
          <span className="text-sm text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        <button
          onClick={onQuickAdd}
          className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Tasks */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              staff={staff}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onClick={() => onTaskClick(task)}
            />
          ))}

          {/* Empty state */}
          {tasks.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <Circle size={24} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">ไม่มีงาน</p>
            </div>
          )}

          {/* Quick add button */}
          <button
            onClick={onQuickAdd}
            className="w-full flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <Plus size={16} />
            <span className="text-sm">เพิ่มงานใหม่</span>
          </button>
        </div>
      )}
    </div>
  );
};

// Task Card Component
interface TaskCardProps {
  task: Task;
  staff: Staff[];
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onDragEnd: () => void;
  onClick: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  staff,
  onDragStart,
  onDragEnd,
  onClick,
}) => {
  const assignee = staff.find((s) => s.id === task.assignedTo);
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';
  const completedChecklist = task.checklist.filter((c) => c.completed).length;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-shadow group"
    >
      {/* Drag Handle */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical size={14} className="text-gray-400 cursor-grab" />
        </div>
        {task.icon && <span className="text-lg">{task.icon}</span>}
      </div>

      {/* Title */}
      <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">{task.title}</h3>

      {/* Tags */}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags.slice(0, 3).map((tag, index) => (
            <span
              key={index}
              className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600"
            >
              {tag}
            </span>
          ))}
          {task.tags.length > 3 && (
            <span className="px-2 py-0.5 text-xs text-gray-400">+{task.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Client */}
      {task.clientName && (
        <div className="text-sm text-gray-500 mb-2 truncate">
          🏢 {task.clientName}
        </div>
      )}

      {/* Meta */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-3">
          {/* Priority */}
          <span
            className="flex items-center gap-1"
            style={{ color: TASK_PRIORITY_COLORS[task.priority] }}
          >
            <Flag size={12} />
            {TASK_PRIORITY_LABELS[task.priority]}
          </span>

          {/* Due Date */}
          {task.dueDate && (
            <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600' : ''}`}>
              <Calendar size={12} />
              {new Date(task.dueDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>

        {/* Checklist Progress */}
        {task.checklist.length > 0 && (
          <span className="flex items-center gap-1">
            <CheckSquare size={12} />
            {completedChecklist}/{task.checklist.length}
          </span>
        )}
      </div>

      {/* Assignee & Comments */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
        {assignee ? (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-600">
              {assignee.name.charAt(0)}
            </div>
            <span className="text-xs text-gray-600 truncate max-w-[100px]">{assignee.name}</span>
          </div>
        ) : (
          <span className="text-xs text-gray-400">ยังไม่มอบหมาย</span>
        )}

        {task.comments.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <MessageSquare size={12} />
            {task.comments.length}
          </span>
        )}
      </div>

      {/* Progress Bar */}
      {task.progress > 0 && (
        <div className="mt-2">
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${task.progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Task List View
interface TaskListViewProps {
  tasks: Task[];
  staff: Staff[];
  onTaskClick: (task: Task) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
}

const TaskListView: React.FC<TaskListViewProps> = ({
  tasks,
  staff,
  onTaskClick,
  onUpdateTask,
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 border-b text-sm font-medium text-gray-600">
        <div className="col-span-4">งาน</div>
        <div className="col-span-2">สถานะ</div>
        <div className="col-span-2">ผู้รับผิดชอบ</div>
        <div className="col-span-2">กำหนดส่ง</div>
        <div className="col-span-2">ความสำคัญ</div>
      </div>

      {/* Rows */}
      <div className="divide-y">
        {tasks.map((task) => {
          const assignee = staff.find((s) => s.id === task.assignedTo);
          const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';

          return (
            <div
              key={task.id}
              onClick={() => onTaskClick(task)}
              className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-gray-50 cursor-pointer items-center"
            >
              {/* Task */}
              <div className="col-span-4 flex items-center gap-3">
                <span>{task.icon || '📋'}</span>
                <div>
                  <div className="font-medium text-gray-900">{task.title}</div>
                  {task.clientName && (
                    <div className="text-sm text-gray-500">{task.clientName}</div>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="col-span-2">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: `${TASK_STATUS_COLORS[task.status]}20`,
                    color: TASK_STATUS_COLORS[task.status],
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: TASK_STATUS_COLORS[task.status] }}
                  />
                  {TASK_STATUS_LABELS[task.status]}
                </span>
              </div>

              {/* Assignee */}
              <div className="col-span-2">
                {assignee ? (
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-600">
                      {assignee.name.charAt(0)}
                    </div>
                    <span className="text-sm text-gray-700">{assignee.name}</span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">—</span>
                )}
              </div>

              {/* Due Date */}
              <div className="col-span-2">
                {task.dueDate ? (
                  <span className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                    {new Date(task.dueDate).toLocaleDateString('th-TH', {
                      day: 'numeric',
                      month: 'short',
                      year: '2-digit',
                    })}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">—</span>
                )}
              </div>

              {/* Priority */}
              <div className="col-span-2">
                <span
                  className="inline-flex items-center gap-1 text-sm"
                  style={{ color: TASK_PRIORITY_COLORS[task.priority] }}
                >
                  <Flag size={14} />
                  {TASK_PRIORITY_LABELS[task.priority]}
                </span>
              </div>
            </div>
          );
        })}

        {tasks.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            ไม่พบงาน
          </div>
        )}
      </div>
    </div>
  );
};

// Calendar View
interface TaskCalendarViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

const TaskCalendarView: React.FC<TaskCalendarViewProps> = ({ tasks, onTaskClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startDay = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  const days = [];
  for (let i = 0; i < startDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const getTasksForDay = (day: number) => {
    return tasks.filter((task) => {
      if (!task.dueDate) return false;
      const dueDate = new Date(task.dueDate);
      return dueDate.getDate() === day && dueDate.getMonth() === month && dueDate.getFullYear() === year;
    });
  };

  const monthNames = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          {monthNames[month]} {year + 543}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronRight size={20} className="rotate-180" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
          >
            วันนี้
          </button>
          <button
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Day Names */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((day) => (
          <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          if (day === null) {
            return <div key={index} className="h-24 bg-gray-50 rounded-lg" />;
          }

          const dayTasks = getTasksForDay(day);
          const isToday =
            day === new Date().getDate() &&
            month === new Date().getMonth() &&
            year === new Date().getFullYear();

          return (
            <div
              key={index}
              className={`h-24 p-1 rounded-lg border ${isToday ? 'border-blue-400 bg-blue-50' : 'border-gray-100'}`}
            >
              <div className={`text-sm font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                {day}
              </div>
              <div className="space-y-0.5 overflow-y-auto max-h-14">
                {dayTasks.slice(0, 3).map((task) => (
                  <div
                    key={task.id}
                    onClick={() => onTaskClick(task)}
                    className="text-xs px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80"
                    style={{
                      backgroundColor: `${TASK_PRIORITY_COLORS[task.priority]}20`,
                      color: TASK_PRIORITY_COLORS[task.priority],
                    }}
                  >
                    {task.title}
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <div className="text-xs text-gray-500 pl-1">+{dayTasks.length - 3} อื่นๆ</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// New Task Modal
interface NewTaskModalProps {
  status: TaskStatus;
  staff: Staff[];
  onClose: () => void;
  onCreate: (data: Partial<Task>) => void;
}

const NewTaskModal: React.FC<NewTaskModalProps> = ({ status, staff, onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory>('general');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [dueDate, setDueDate] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({
      title,
      description,
      category,
      priority,
      status,
      assignedTo: assignedTo || null,
      assignedToName: staff.find((s) => s.id === assignedTo)?.name,
      dueDate: dueDate || null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">สร้างงานใหม่</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-4 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ชื่องาน *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="ระบุชื่องาน..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="รายละเอียดงาน..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Category & Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ประเภท</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TaskCategory)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(TASK_CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ความสำคัญ</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(TASK_PRIORITY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Assignee & Due Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">มอบหมายให้</label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- เลือกผู้รับผิดชอบ --</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">กำหนดส่ง</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              สร้างงาน
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskBoard;

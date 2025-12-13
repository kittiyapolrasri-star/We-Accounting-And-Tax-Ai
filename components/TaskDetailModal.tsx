/**
 * TaskDetailModal - Notion-style Task Detail View
 * แสดงรายละเอียดงานแบบ Full-featured
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  User,
  Users,
  Flag,
  Tag,
  MessageSquare,
  CheckSquare,
  Paperclip,
  Link2,
  MoreHorizontal,
  ChevronDown,
  Plus,
  Edit3,
  Trash2,
  Copy,
  Archive,
  ExternalLink,
  History,
  Send,
  AtSign,
  Smile,
  Timer,
  Play,
  Pause,
  Building2,
  FileText,
  Bot,
  Zap,
  GripVertical,
} from 'lucide-react';
import {
  Task,
  TaskStatus,
  TaskPriority,
  TaskCategory,
  ChecklistItem,
  TaskComment,
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
  TASK_CATEGORY_LABELS,
} from '../types/tasks';
import { Staff } from '../types';

interface TaskDetailModalProps {
  task: Task;
  staff: Staff[];
  onClose: () => void;
  onUpdate: (updates: Partial<Task>) => void;
  onDelete: () => void;
  currentUser: { id: string; name: string; avatar?: string };
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  staff,
  onClose,
  onUpdate,
  onDelete,
  currentUser,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [newComment, setNewComment] = useState('');
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [showAssigneeMenu, setShowAssigneeMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details');
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  // Focus title input when editing
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // Handlers
  const handleTitleSave = () => {
    if (title.trim() && title !== task.title) {
      onUpdate({ title: title.trim() });
    }
    setIsEditingTitle(false);
  };

  const handleDescriptionSave = () => {
    if (description !== task.description) {
      onUpdate({ description });
    }
  };

  const handleStatusChange = (status: TaskStatus) => {
    onUpdate({ status });
    setShowStatusMenu(false);
  };

  const handlePriorityChange = (priority: TaskPriority) => {
    onUpdate({ priority });
    setShowPriorityMenu(false);
  };

  const handleAssigneeChange = (staffId: string | null) => {
    const staffMember = staff.find((s) => s.id === staffId);
    onUpdate({
      assignedTo: staffId,
      assignedToName: staffMember?.name,
    });
    setShowAssigneeMenu(false);
  };

  const handleAddChecklistItem = () => {
    if (!newChecklistItem.trim()) return;

    const newItem: ChecklistItem = {
      id: `CHK-${Date.now()}`,
      text: newChecklistItem.trim(),
      completed: false,
    };

    onUpdate({
      checklist: [...task.checklist, newItem],
    });
    setNewChecklistItem('');
  };

  const handleToggleChecklistItem = (itemId: string) => {
    const updatedChecklist = task.checklist.map((item) =>
      item.id === itemId
        ? {
            ...item,
            completed: !item.completed,
            completedAt: !item.completed ? new Date().toISOString() : undefined,
            completedBy: !item.completed ? currentUser.id : undefined,
          }
        : item
    );

    const completedCount = updatedChecklist.filter((i) => i.completed).length;
    const progress = updatedChecklist.length > 0
      ? Math.round((completedCount / updatedChecklist.length) * 100)
      : 0;

    onUpdate({ checklist: updatedChecklist, progress });
  };

  const handleDeleteChecklistItem = (itemId: string) => {
    const updatedChecklist = task.checklist.filter((item) => item.id !== itemId);
    const completedCount = updatedChecklist.filter((i) => i.completed).length;
    const progress = updatedChecklist.length > 0
      ? Math.round((completedCount / updatedChecklist.length) * 100)
      : 0;

    onUpdate({ checklist: updatedChecklist, progress });
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;

    const comment: TaskComment = {
      id: `CMT-${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      content: newComment.trim(),
      createdAt: new Date().toISOString(),
      isEdited: false,
      reactions: [],
      attachments: [],
    };

    onUpdate({
      comments: [...task.comments, comment],
    });
    setNewComment('');
  };

  const handleTimerToggle = () => {
    if (isTimerRunning) {
      // Save time
      const minutes = Math.round(timerSeconds / 60);
      if (minutes > 0) {
        onUpdate({
          timeSpent: task.timeSpent + minutes,
          timeEntries: [
            ...task.timeEntries,
            {
              id: `TIME-${Date.now()}`,
              userId: currentUser.id,
              userName: currentUser.name,
              startTime: new Date(Date.now() - timerSeconds * 1000).toISOString(),
              endTime: new Date().toISOString(),
              duration: minutes,
            },
          ],
        });
      }
      setTimerSeconds(0);
    }
    setIsTimerRunning(!isTimerRunning);
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const assignee = staff.find((s) => s.id === task.assignedTo);
  const completedChecklist = task.checklist.filter((c) => c.completed).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 overflow-y-auto py-10">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white rounded-t-xl z-10">
          <div className="flex items-center gap-4">
            {/* Icon */}
            <button className="text-2xl hover:bg-gray-100 p-1 rounded">
              {task.icon || '📋'}
            </button>

            {/* Breadcrumb */}
            {task.clientName && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Building2 size={14} />
                <span>{task.clientName}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Timer */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg">
              <Timer size={16} className="text-gray-500" />
              <span className="text-sm font-mono">{formatTime(timerSeconds)}</span>
              <button
                onClick={handleTimerToggle}
                className={`p-1 rounded ${isTimerRunning ? 'text-red-600 hover:bg-red-100' : 'text-green-600 hover:bg-green-100'}`}
              >
                {isTimerRunning ? <Pause size={16} /> : <Play size={16} />}
              </button>
            </div>

            {/* More Actions */}
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <MoreHorizontal size={20} className="text-gray-500" />
            </button>

            {/* Close */}
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X size={20} className="text-gray-500" />
            </button>
          </div>
        </div>

        <div className="flex">
          {/* Main Content */}
          <div className="flex-1 p-6 overflow-y-auto max-h-[70vh]">
            {/* Title */}
            <div className="mb-6">
              {isEditingTitle ? (
                <input
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
                  className="text-2xl font-bold text-gray-900 w-full outline-none border-b-2 border-blue-500 pb-1"
                />
              ) : (
                <h1
                  onClick={() => setIsEditingTitle(true)}
                  className="text-2xl font-bold text-gray-900 cursor-text hover:bg-gray-50 rounded px-1 -mx-1"
                >
                  {task.title}
                </h1>
              )}
            </div>

            {/* Description */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <FileText size={16} />
                รายละเอียด
              </h3>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleDescriptionSave}
                placeholder="เพิ่มรายละเอียด..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Checklist */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <CheckSquare size={16} />
                  รายการย่อย
                  {task.checklist.length > 0 && (
                    <span className="text-gray-500">
                      ({completedChecklist}/{task.checklist.length})
                    </span>
                  )}
                </h3>
                {task.checklist.length > 0 && (
                  <span className="text-sm text-gray-500">{task.progress}%</span>
                )}
              </div>

              {/* Progress Bar */}
              {task.checklist.length > 0 && (
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
              )}

              {/* Checklist Items */}
              <div className="space-y-2 mb-3">
                {task.checklist.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 group py-1 px-2 -mx-2 hover:bg-gray-50 rounded-lg"
                  >
                    <GripVertical size={14} className="text-gray-300 opacity-0 group-hover:opacity-100 cursor-grab" />
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => handleToggleChecklistItem(item.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span
                      className={`flex-1 text-sm ${item.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}
                    >
                      {item.text}
                    </span>
                    <button
                      onClick={() => handleDeleteChecklistItem(item.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Checklist Item */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddChecklistItem()}
                  placeholder="เพิ่มรายการ..."
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleAddChecklistItem}
                  disabled={!newChecklistItem.trim()}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* Comments */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <MessageSquare size={16} />
                ความคิดเห็น ({task.comments.length})
              </h3>

              {/* Comment List */}
              <div className="space-y-4 mb-4">
                {task.comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium text-blue-600 flex-shrink-0">
                      {comment.userName.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 text-sm">{comment.userName}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(comment.createdAt).toLocaleDateString('th-TH', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                    </div>
                  </div>
                ))}

                {task.comments.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีความคิดเห็น</p>
                )}
              </div>

              {/* Add Comment */}
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-sm font-medium text-purple-600 flex-shrink-0">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <textarea
                    ref={commentInputRef}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="เขียนความคิดเห็น..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                        <AtSign size={16} />
                      </button>
                      <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                        <Smile size={16} />
                      </button>
                      <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                        <Paperclip size={16} />
                      </button>
                    </div>
                    <button
                      onClick={handleAddComment}
                      disabled={!newComment.trim()}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send size={14} />
                      ส่ง
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-80 border-l bg-gray-50 p-6 overflow-y-auto max-h-[70vh]">
            {/* Properties */}
            <div className="space-y-4">
              {/* Status */}
              <div className="relative">
                <label className="text-xs font-medium text-gray-500 uppercase mb-1.5 block">สถานะ</label>
                <button
                  onClick={() => setShowStatusMenu(!showStatusMenu)}
                  className="w-full flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-white transition-colors"
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: TASK_STATUS_COLORS[task.status] }}
                  />
                  <span className="flex-1 text-left text-sm text-gray-700">
                    {TASK_STATUS_LABELS[task.status]}
                  </span>
                  <ChevronDown size={16} className="text-gray-400" />
                </button>

                {showStatusMenu && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                    {Object.entries(TASK_STATUS_LABELS).map(([status, label]) => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(status as TaskStatus)}
                        className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-sm ${
                          task.status === status ? 'bg-blue-50' : ''
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: TASK_STATUS_COLORS[status as TaskStatus] }}
                        />
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Assignee */}
              <div className="relative">
                <label className="text-xs font-medium text-gray-500 uppercase mb-1.5 block">ผู้รับผิดชอบ</label>
                <button
                  onClick={() => setShowAssigneeMenu(!showAssigneeMenu)}
                  className="w-full flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-white transition-colors"
                >
                  {assignee ? (
                    <>
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-600">
                        {assignee.name.charAt(0)}
                      </div>
                      <span className="flex-1 text-left text-sm text-gray-700">{assignee.name}</span>
                    </>
                  ) : (
                    <>
                      <User size={16} className="text-gray-400" />
                      <span className="flex-1 text-left text-sm text-gray-400">ยังไม่มอบหมาย</span>
                    </>
                  )}
                  <ChevronDown size={16} className="text-gray-400" />
                </button>

                {showAssigneeMenu && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                    <button
                      onClick={() => handleAssigneeChange(null)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-sm"
                    >
                      <User size={16} className="text-gray-400" />
                      ไม่มอบหมาย
                    </button>
                    {staff.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => handleAssigneeChange(s.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-sm ${
                          task.assignedTo === s.id ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-600">
                          {s.name.charAt(0)}
                        </div>
                        <span className="flex-1 text-left">{s.name}</span>
                        <span className="text-xs text-gray-400">{s.role}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Priority */}
              <div className="relative">
                <label className="text-xs font-medium text-gray-500 uppercase mb-1.5 block">ความสำคัญ</label>
                <button
                  onClick={() => setShowPriorityMenu(!showPriorityMenu)}
                  className="w-full flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-white transition-colors"
                >
                  <Flag size={16} style={{ color: TASK_PRIORITY_COLORS[task.priority] }} />
                  <span className="flex-1 text-left text-sm text-gray-700">
                    {TASK_PRIORITY_LABELS[task.priority]}
                  </span>
                  <ChevronDown size={16} className="text-gray-400" />
                </button>

                {showPriorityMenu && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                    {Object.entries(TASK_PRIORITY_LABELS).map(([priority, label]) => (
                      <button
                        key={priority}
                        onClick={() => handlePriorityChange(priority as TaskPriority)}
                        className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-sm ${
                          task.priority === priority ? 'bg-blue-50' : ''
                        }`}
                      >
                        <Flag size={16} style={{ color: TASK_PRIORITY_COLORS[priority as TaskPriority] }} />
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Due Date */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase mb-1.5 block">กำหนดส่ง</label>
                <input
                  type="date"
                  value={task.dueDate || ''}
                  onChange={(e) => onUpdate({ dueDate: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase mb-1.5 block">ประเภท</label>
                <select
                  value={task.category}
                  onChange={(e) => onUpdate({ category: e.target.value as TaskCategory })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(TASK_CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Estimated Hours */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase mb-1.5 block">เวลาประมาณ (ชม.)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={task.estimatedHours}
                  onChange={(e) => onUpdate({ estimatedHours: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Time Spent */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase mb-1.5 block">เวลาที่ใช้ไป</label>
                <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-white">
                  <Clock size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-700">
                    {Math.floor(task.timeSpent / 60)} ชม. {task.timeSpent % 60} นาที
                  </span>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase mb-1.5 block">แท็ก</label>
                <div className="flex flex-wrap gap-1">
                  {task.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-gray-200 text-gray-700 rounded-full text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                  <button className="px-2 py-1 border border-dashed border-gray-300 text-gray-400 rounded-full text-xs hover:border-gray-400 hover:text-gray-500">
                    <Plus size={12} />
                  </button>
                </div>
              </div>

              {/* AI Agent Info */}
              {task.createdByAgent && (
                <div className="pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm text-purple-600 bg-purple-50 px-3 py-2 rounded-lg">
                    <Bot size={16} />
                    <span>สร้างโดย AI Agent</span>
                  </div>
                </div>
              )}

              {/* Delete */}
              <div className="pt-4 border-t">
                <button
                  onClick={onDelete}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                  <span className="text-sm">ลบงานนี้</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Activity */}
        <div className="border-t px-6 py-3 bg-gray-50 rounded-b-xl">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span>สร้างเมื่อ {new Date(task.createdAt).toLocaleDateString('th-TH')}</span>
              <span>อัปเดตล่าสุด {new Date(task.updatedAt).toLocaleDateString('th-TH')}</span>
            </div>
            <button className="flex items-center gap-1 text-gray-500 hover:text-gray-700">
              <History size={14} />
              <span>ดูประวัติ ({task.activityLog.length})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailModal;

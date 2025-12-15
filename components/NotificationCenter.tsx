/**
 * NotificationCenter.tsx
 * 
 * ศูนย์แจ้งเตือนแบบ In-App
 * - แจ้งเตือนงานใหม่/งานที่ได้รับมอบหมาย
 * - แจ้งเตือน Deadline
 * - แจ้งเตือนการอนุมัติ
 * - แจ้งเตือนจากระบบ
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
    Bell, X, Check, CheckCheck, Clock, AlertTriangle, FileText,
    User, Calendar, Settings, Trash2, RefreshCw, Filter,
    ChevronRight, MessageSquare, Building2, DollarSign, Zap
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export type NotificationType =
    | 'task_assigned'
    | 'task_completed'
    | 'task_overdue'
    | 'deadline_reminder'
    | 'document_uploaded'
    | 'document_approved'
    | 'document_rejected'
    | 'tax_deadline'
    | 'client_update'
    | 'system_alert'
    | 'mention';

export interface AppNotification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    icon?: string;
    timestamp: string;
    read: boolean;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    actionUrl?: string;
    actionLabel?: string;
    metadata?: {
        taskId?: string;
        documentId?: string;
        clientId?: string;
        userId?: string;
        [key: string]: any;
    };
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onNotificationClick?: (notification: AppNotification) => void;
}

// ============================================================================
// MOCK DATA (In production, this would come from Firebase)
// ============================================================================

const generateMockNotifications = (): AppNotification[] => {
    const now = new Date();

    return [
        {
            id: 'notif-1',
            type: 'task_assigned',
            title: 'งานใหม่: ตรวจสอบเอกสาร',
            message: 'คุณได้รับมอบหมายงาน "ตรวจสอบเอกสาร - บริษัท ABC"',
            timestamp: new Date(now.getTime() - 5 * 60000).toISOString(), // 5 mins ago
            read: false,
            priority: 'high',
            actionLabel: 'ดูงาน',
            metadata: { taskId: 'TASK-001', clientId: 'client-1' }
        },
        {
            id: 'notif-2',
            type: 'deadline_reminder',
            title: 'Deadline ใกล้ถึง',
            message: 'งาน "ยื่น ภ.พ.30 - Tech Corp" ครบกำหนดใน 2 วัน',
            timestamp: new Date(now.getTime() - 30 * 60000).toISOString(), // 30 mins ago
            read: false,
            priority: 'urgent',
            actionLabel: 'ไปที่งาน',
            metadata: { taskId: 'TASK-002' }
        },
        {
            id: 'notif-3',
            type: 'document_approved',
            title: 'เอกสารได้รับการอนุมัติ',
            message: 'เอกสาร INV-2024-001 ของ XYZ Ltd. ได้รับการอนุมัติแล้ว',
            timestamp: new Date(now.getTime() - 2 * 3600000).toISOString(), // 2 hours ago
            read: false,
            priority: 'normal',
            metadata: { documentId: 'DOC-001' }
        },
        {
            id: 'notif-4',
            type: 'tax_deadline',
            title: 'กำหนดยื่นภาษี',
            message: 'กำหนดยื่น ภ.พ.30 ภายในวันที่ 15 ของเดือน (เหลืออีก 5 วัน)',
            timestamp: new Date(now.getTime() - 6 * 3600000).toISOString(), // 6 hours ago
            read: true,
            priority: 'high'
        },
        {
            id: 'notif-5',
            type: 'mention',
            title: '@คุณ ถูกกล่าวถึง',
            message: 'คุณ สมชาย กล่าวถึงคุณใน comment ของงาน "ปิดบัญชีเดือน ม.ค."',
            timestamp: new Date(now.getTime() - 1 * 86400000).toISOString(), // 1 day ago
            read: true,
            priority: 'normal',
            metadata: { taskId: 'TASK-003', userId: 'user-1' }
        },
        {
            id: 'notif-6',
            type: 'task_completed',
            title: 'งานเสร็จสมบูรณ์',
            message: 'งาน "กระทบยอดธนาคาร - ABC Corp" เสร็จสมบูรณ์แล้ว',
            timestamp: new Date(now.getTime() - 2 * 86400000).toISOString(), // 2 days ago
            read: true,
            priority: 'low',
            metadata: { taskId: 'TASK-004' }
        },
        {
            id: 'notif-7',
            type: 'system_alert',
            title: 'อัปเดตระบบ',
            message: 'ระบบจะมีการ maintenance ในวันเสาร์ที่ 20 เวลา 02:00-04:00 น.',
            timestamp: new Date(now.getTime() - 3 * 86400000).toISOString(), // 3 days ago
            read: true,
            priority: 'low'
        }
    ];
};

// ============================================================================
// NOTIFICATION CENTER COMPONENT
// ============================================================================

const NotificationCenter: React.FC<Props> = ({ isOpen, onClose, onNotificationClick }) => {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const [loading, setLoading] = useState(false);

    // Load notifications
    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            // Simulate API call
            setTimeout(() => {
                setNotifications(generateMockNotifications());
                setLoading(false);
            }, 300);
        }
    }, [isOpen]);

    // Filter notifications
    const filteredNotifications = useMemo(() => {
        if (filter === 'unread') {
            return notifications.filter(n => !n.read);
        }
        return notifications;
    }, [notifications, filter]);

    // Counts
    const unreadCount = useMemo(() =>
        notifications.filter(n => !n.read).length,
        [notifications]
    );

    // Mark as read
    const markAsRead = (id: string) => {
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, read: true } : n)
        );
    };

    // Mark all as read
    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    // Delete notification
    const deleteNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    // Clear all
    const clearAll = () => {
        setNotifications([]);
    };

    // Get icon for notification type
    const getIcon = (type: NotificationType) => {
        switch (type) {
            case 'task_assigned':
            case 'task_completed':
                return <FileText size={18} className="text-blue-500" />;
            case 'task_overdue':
            case 'deadline_reminder':
                return <AlertTriangle size={18} className="text-orange-500" />;
            case 'document_uploaded':
            case 'document_approved':
                return <Check size={18} className="text-green-500" />;
            case 'document_rejected':
                return <X size={18} className="text-red-500" />;
            case 'tax_deadline':
                return <Calendar size={18} className="text-purple-500" />;
            case 'client_update':
                return <Building2 size={18} className="text-cyan-500" />;
            case 'mention':
                return <MessageSquare size={18} className="text-indigo-500" />;
            case 'system_alert':
                return <Zap size={18} className="text-yellow-500" />;
            default:
                return <Bell size={18} className="text-gray-500" />;
        }
    };

    // Get priority style
    const getPriorityStyle = (priority: string) => {
        switch (priority) {
            case 'urgent': return 'border-l-red-500 bg-red-50';
            case 'high': return 'border-l-orange-500 bg-orange-50';
            default: return 'border-l-transparent';
        }
    };

    // Format time ago
    const formatTimeAgo = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'เมื่อสักครู่';
        if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
        if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
        if (days < 7) return `${days} วันที่แล้ว`;
        return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/20 z-40"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed right-4 top-4 w-96 max-h-[calc(100vh-32px)] bg-white rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Bell size={22} />
                            <h2 className="text-lg font-semibold">การแจ้งเตือน</h2>
                            {unreadCount > 0 && (
                                <span className="px-2 py-0.5 bg-white/20 rounded-full text-sm">
                                    {unreadCount} ใหม่
                                </span>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                            <button
                                onClick={() => setFilter('all')}
                                className={`px-3 py-1 text-sm rounded-lg transition-colors ${filter === 'all'
                                        ? 'bg-white/30 font-medium'
                                        : 'hover:bg-white/10'
                                    }`}
                            >
                                ทั้งหมด
                            </button>
                            <button
                                onClick={() => setFilter('unread')}
                                className={`px-3 py-1 text-sm rounded-lg transition-colors ${filter === 'unread'
                                        ? 'bg-white/30 font-medium'
                                        : 'hover:bg-white/10'
                                    }`}
                            >
                                ยังไม่อ่าน
                            </button>
                        </div>

                        <div className="flex gap-1">
                            <button
                                onClick={markAllAsRead}
                                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                                title="อ่านทั้งหมด"
                            >
                                <CheckCheck size={18} />
                            </button>
                            <button
                                onClick={clearAll}
                                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                                title="ลบทั้งหมด"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Notification List */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <RefreshCw size={24} className="animate-spin text-gray-400" />
                        </div>
                    ) : filteredNotifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                            <Bell size={48} className="mb-3 text-gray-300" />
                            <p>ไม่มีการแจ้งเตือน</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {filteredNotifications.map(notification => (
                                <div
                                    key={notification.id}
                                    className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer border-l-4 ${getPriorityStyle(notification.priority)
                                        } ${!notification.read ? 'bg-blue-50/50' : ''}`}
                                    onClick={() => {
                                        markAsRead(notification.id);
                                        onNotificationClick?.(notification);
                                    }}
                                >
                                    <div className="flex gap-3">
                                        {/* Icon */}
                                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                                            {getIcon(notification.type)}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className={`text-sm ${!notification.read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                                                    {notification.title}
                                                </p>
                                                {!notification.read && (
                                                    <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                                                {notification.message}
                                            </p>
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                                    <Clock size={12} />
                                                    {formatTimeAgo(notification.timestamp)}
                                                </span>
                                                {notification.actionLabel && (
                                                    <button className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                                        {notification.actionLabel}
                                                        <ChevronRight size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex-shrink-0 flex flex-col gap-1">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteNotification(notification.id);
                                                }}
                                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t bg-gray-50 flex items-center justify-between">
                    <button
                        onClick={() => {/* Navigate to settings */ }}
                        className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                    >
                        <Settings size={14} />
                        ตั้งค่าการแจ้งเตือน
                    </button>
                    <span className="text-xs text-gray-400">
                        {notifications.length} รายการ
                    </span>
                </div>
            </div>
        </>
    );
};

// ============================================================================
// NOTIFICATION BELL (for header)
// ============================================================================

interface NotificationBellProps {
    unreadCount?: number;
    onClick: () => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ unreadCount = 0, onClick }) => {
    return (
        <button
            onClick={onClick}
            className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
            <Bell size={20} />
            {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs 
                       rounded-full flex items-center justify-center font-medium">
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
            )}
        </button>
    );
};

export default NotificationCenter;

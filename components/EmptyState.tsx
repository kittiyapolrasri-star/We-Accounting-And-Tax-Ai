/**
 * EmptyState Component
 * Reusable empty state for when there's no data to display
 */

import React from 'react';
import {
  FileText,
  Users,
  FolderOpen,
  Calendar,
  CheckSquare,
  Building2,
  TrendingUp,
  AlertCircle,
  Search,
  Plus,
  RefreshCw,
} from 'lucide-react';

type EmptyStateType =
  | 'documents'
  | 'clients'
  | 'tasks'
  | 'staff'
  | 'calendar'
  | 'reports'
  | 'search'
  | 'error'
  | 'generic';

interface EmptyStateProps {
  type?: EmptyStateType;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  showRefresh?: boolean;
  onRefresh?: () => void;
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'generic',
  title,
  description,
  actionLabel,
  onAction,
  showRefresh = false,
  onRefresh,
  className = '',
}) => {
  const configs: Record<EmptyStateType, {
    icon: React.ReactNode;
    defaultTitle: string;
    defaultDescription: string;
    defaultAction?: string;
    color: string;
    bgColor: string;
  }> = {
    documents: {
      icon: <FileText size={48} />,
      defaultTitle: 'ยังไม่มีเอกสาร',
      defaultDescription: 'เริ่มต้นโดยการอัปโหลดเอกสารใหม่',
      defaultAction: 'อัปโหลดเอกสาร',
      color: 'text-blue-400',
      bgColor: 'bg-blue-50',
    },
    clients: {
      icon: <Building2 size={48} />,
      defaultTitle: 'ยังไม่มีลูกค้า',
      defaultDescription: 'เพิ่มลูกค้าใหม่เพื่อเริ่มใช้งาน',
      defaultAction: 'เพิ่มลูกค้า',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-50',
    },
    tasks: {
      icon: <CheckSquare size={48} />,
      defaultTitle: 'ไม่มีงานที่ต้องทำ',
      defaultDescription: 'ยินดีด้วย! คุณไม่มีงานค้างอยู่',
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-50',
    },
    staff: {
      icon: <Users size={48} />,
      defaultTitle: 'ยังไม่มีพนักงาน',
      defaultDescription: 'เพิ่มพนักงานเพื่อมอบหมายงาน',
      defaultAction: 'เพิ่มพนักงาน',
      color: 'text-purple-400',
      bgColor: 'bg-purple-50',
    },
    calendar: {
      icon: <Calendar size={48} />,
      defaultTitle: 'ไม่มีกำหนดการ',
      defaultDescription: 'ยังไม่มีกำหนดยื่นภาษีในเดือนนี้',
      color: 'text-amber-400',
      bgColor: 'bg-amber-50',
    },
    reports: {
      icon: <TrendingUp size={48} />,
      defaultTitle: 'ยังไม่มีข้อมูลรายงาน',
      defaultDescription: 'เลือกลูกค้าและช่วงเวลาเพื่อดูรายงาน',
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-50',
    },
    search: {
      icon: <Search size={48} />,
      defaultTitle: 'ไม่พบผลลัพธ์',
      defaultDescription: 'ลองเปลี่ยนคำค้นหาหรือตัวกรอง',
      color: 'text-slate-400',
      bgColor: 'bg-slate-50',
    },
    error: {
      icon: <AlertCircle size={48} />,
      defaultTitle: 'เกิดข้อผิดพลาด',
      defaultDescription: 'ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่',
      defaultAction: 'ลองใหม่',
      color: 'text-red-400',
      bgColor: 'bg-red-50',
    },
    generic: {
      icon: <FolderOpen size={48} />,
      defaultTitle: 'ไม่มีข้อมูล',
      defaultDescription: 'ยังไม่มีข้อมูลที่จะแสดง',
      color: 'text-slate-400',
      bgColor: 'bg-slate-50',
    },
  };

  const config = configs[type];
  const displayTitle = title || config.defaultTitle;
  const displayDescription = description || config.defaultDescription;
  const displayAction = actionLabel || config.defaultAction;

  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-6 ${className}`}
      role="status"
      aria-label={displayTitle}
    >
      <div className={`p-6 rounded-full ${config.bgColor} mb-4`}>
        <div className={config.color}>{config.icon}</div>
      </div>
      <h3 className="text-lg font-semibold text-slate-700 mb-2">{displayTitle}</h3>
      <p className="text-sm text-slate-500 text-center max-w-sm mb-6">
        {displayDescription}
      </p>
      <div className="flex items-center gap-3">
        {displayAction && onAction && (
          <button
            onClick={onAction}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            aria-label={displayAction}
          >
            <Plus size={18} />
            {displayAction}
          </button>
        )}
        {showRefresh && onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
            aria-label="รีเฟรช"
          >
            <RefreshCw size={18} />
            รีเฟรช
          </button>
        )}
      </div>
    </div>
  );
};

export default EmptyState;

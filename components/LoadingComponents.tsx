/**
 * Loading Components
 * Skeleton loaders และ Loading states สำหรับ UX ที่ดี
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

// ============================================================================
// SKELETON COMPONENTS
// ============================================================================

interface SkeletonProps {
    className?: string;
}

/**
 * Skeleton base component
 */
export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
    <div
        className={`animate-pulse bg-slate-200 rounded ${className}`}
    />
);

/**
 * Skeleton สำหรับข้อความบรรทัดเดียว
 */
export const SkeletonText: React.FC<{ width?: string }> = ({ width = 'w-full' }) => (
    <Skeleton className={`h-4 ${width}`} />
);

/**
 * Skeleton สำหรับหัวข้อ
 */
export const SkeletonTitle: React.FC<{ width?: string }> = ({ width = 'w-1/2' }) => (
    <Skeleton className={`h-6 ${width}`} />
);

/**
 * Skeleton สำหรับ Avatar/รูป
 */
export const SkeletonAvatar: React.FC<{ size?: string }> = ({ size = 'w-10 h-10' }) => (
    <Skeleton className={`${size} rounded-full`} />
);

/**
 * Skeleton สำหรับ Card
 */
export const SkeletonCard: React.FC = () => (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
        <div className="space-y-4">
            <div className="flex items-center gap-4">
                <SkeletonAvatar />
                <div className="flex-1 space-y-2">
                    <SkeletonTitle width="w-1/3" />
                    <SkeletonText width="w-1/2" />
                </div>
            </div>
            <SkeletonText />
            <SkeletonText width="w-3/4" />
        </div>
    </div>
);

/**
 * Skeleton สำหรับ Table Row
 */
export const SkeletonTableRow: React.FC<{ columns?: number }> = ({ columns = 5 }) => (
    <tr className="border-b border-slate-100">
        {Array.from({ length: columns }).map((_, i) => (
            <td key={i} className="px-4 py-3">
                <SkeletonText width={i === 0 ? 'w-20' : 'w-full'} />
            </td>
        ))}
    </tr>
);

/**
 * Skeleton สำหรับ Table ทั้งตาราง
 */
export const SkeletonTable: React.FC<{ rows?: number; columns?: number }> = ({
    rows = 5,
    columns = 5
}) => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="border-b border-slate-200 bg-slate-50">
            <div className="flex px-4 py-3 gap-4">
                {Array.from({ length: columns }).map((_, i) => (
                    <Skeleton key={i} className="h-4 w-24" />
                ))}
            </div>
        </div>
        {/* Body */}
        <table className="w-full">
            <tbody>
                {Array.from({ length: rows }).map((_, i) => (
                    <SkeletonTableRow key={i} columns={columns} />
                ))}
            </tbody>
        </table>
    </div>
);

/**
 * Skeleton สำหรับ Dashboard Stats
 */
export const SkeletonStats: React.FC<{ count?: number }> = ({ count = 4 }) => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                <div className="space-y-3">
                    <SkeletonText width="w-1/3" />
                    <Skeleton className="h-8 w-20" />
                    <SkeletonText width="w-1/2" />
                </div>
            </div>
        ))}
    </div>
);

/**
 * Skeleton สำหรับ Chart
 */
export const SkeletonChart: React.FC<{ height?: string }> = ({ height = 'h-64' }) => (
    <div className={`bg-white rounded-xl p-6 shadow-sm border border-slate-100 ${height}`}>
        <div className="h-full flex flex-col">
            <SkeletonTitle width="w-1/4" />
            <div className="flex-1 flex items-end gap-2 mt-4">
                {Array.from({ length: 7 }).map((_, i) => (
                    <Skeleton
                        key={i}
                        className="flex-1"
                        style={{ height: `${Math.random() * 60 + 40}%` }}
                    />
                ))}
            </div>
        </div>
    </div>
);

/**
 * Skeleton สำหรับ List Items
 */
export const SkeletonList: React.FC<{ count?: number }> = ({ count = 5 }) => (
    <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-100">
                <SkeletonAvatar />
                <div className="flex-1 space-y-2">
                    <SkeletonText width="w-1/3" />
                    <SkeletonText width="w-2/3" />
                </div>
                <Skeleton className="w-20 h-8 rounded-lg" />
            </div>
        ))}
    </div>
);

// ============================================================================
// LOADING COMPONENTS
// ============================================================================

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

/**
 * Loading Spinner
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    size = 'md',
    className = ''
}) => {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-8 h-8',
        lg: 'w-12 h-12'
    };

    return (
        <Loader2 className={`animate-spin text-blue-600 ${sizeClasses[size]} ${className}`} />
    );
};

/**
 * Loading Overlay (สำหรับครอบทั้งหน้า/component)
 */
export const LoadingOverlay: React.FC<{ message?: string }> = ({
    message = 'กำลังโหลด...'
}) => (
    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="flex flex-col items-center gap-3">
            <LoadingSpinner size="lg" />
            <p className="text-slate-600 font-medium">{message}</p>
        </div>
    </div>
);

/**
 * Full Page Loading
 */
export const FullPageLoader: React.FC<{ message?: string }> = ({
    message = 'กำลังโหลดข้อมูล...'
}) => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center">
                <LoadingSpinner size="lg" />
            </div>
            <p className="text-slate-600 font-medium">{message}</p>
        </div>
    </div>
);

/**
 * Inline Loading (สำหรับปุ่มหรือ text)
 */
export const InlineLoader: React.FC<{ text?: string }> = ({ text = 'กำลังดำเนินการ...' }) => (
    <span className="inline-flex items-center gap-2 text-slate-600">
        <LoadingSpinner size="sm" />
        <span>{text}</span>
    </span>
);

// ============================================================================
// EMPTY STATES
// ============================================================================

interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
}

/**
 * Empty State Component
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
    icon,
    title,
    description,
    action
}) => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
        {icon && (
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                {icon}
            </div>
        )}
        <h3 className="text-lg font-semibold text-slate-800 mb-2">{title}</h3>
        {description && (
            <p className="text-slate-500 max-w-md mb-4">{description}</p>
        )}
        {action}
    </div>
);

// ============================================================================
// ERROR STATES
// ============================================================================

interface ErrorStateProps {
    title?: string;
    message: string;
    onRetry?: () => void;
}

/**
 * Error State Component
 */
export const ErrorState: React.FC<ErrorStateProps> = ({
    title = 'เกิดข้อผิดพลาด',
    message,
    onRetry
}) => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-3xl">⚠️</span>
        </div>
        <h3 className="text-lg font-semibold text-slate-800 mb-2">{title}</h3>
        <p className="text-slate-500 max-w-md mb-4">{message}</p>
        {onRetry && (
            <button
                onClick={onRetry}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
                ลองอีกครั้ง
            </button>
        )}
    </div>
);

export default {
    Skeleton,
    SkeletonText,
    SkeletonTitle,
    SkeletonAvatar,
    SkeletonCard,
    SkeletonTableRow,
    SkeletonTable,
    SkeletonStats,
    SkeletonChart,
    SkeletonList,
    LoadingSpinner,
    LoadingOverlay,
    FullPageLoader,
    InlineLoader,
    EmptyState,
    ErrorState
};

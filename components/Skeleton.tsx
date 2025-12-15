/**
 * Skeleton.tsx
 *
 * Skeleton loading components for better UX
 */

import React from 'react';

interface SkeletonProps {
  className?: string;
  animate?: boolean;
}

// Base skeleton element
export const Skeleton: React.FC<SkeletonProps> = ({ className = '', animate = true }) => {
  return (
    <div
      className={`bg-slate-200 rounded ${animate ? 'animate-pulse' : ''} ${className}`}
      aria-hidden="true"
    />
  );
};

// Skeleton for text lines
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 3,
  className = '',
}) => {
  return (
    <div className={`space-y-2 ${className}`} role="status" aria-label="กำลังโหลด">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
      <span className="sr-only">กำลังโหลด...</span>
    </div>
  );
};

// Skeleton for cards
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-100 p-4 ${className}`}
      role="status"
      aria-label="กำลังโหลด"
    >
      <div className="flex items-start gap-4">
        <Skeleton className="w-12 h-12 rounded-lg shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
      <span className="sr-only">กำลังโหลด...</span>
    </div>
  );
};

// Skeleton for table rows
export const SkeletonTableRow: React.FC<{ cols?: number }> = ({ cols = 5 }) => {
  return (
    <tr className="animate-pulse" role="row" aria-label="กำลังโหลด">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="p-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
};

// Skeleton for dashboard stats
export const SkeletonStat: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-100 p-6 ${className}`}
      role="status"
      aria-label="กำลังโหลด"
    >
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="w-12 h-12 rounded-xl" />
      </div>
      <Skeleton className="h-2 w-full mt-4" />
      <span className="sr-only">กำลังโหลด...</span>
    </div>
  );
};

// Skeleton for list items
export const SkeletonList: React.FC<{ items?: number; className?: string }> = ({
  items = 5,
  className = '',
}) => {
  return (
    <div className={`space-y-3 ${className}`} role="status" aria-label="กำลังโหลด">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-100 animate-pulse">
          <Skeleton className="w-10 h-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
          <Skeleton className="w-16 h-6 rounded-full" />
        </div>
      ))}
      <span className="sr-only">กำลังโหลด...</span>
    </div>
  );
};

// Skeleton for Kanban board
export const SkeletonKanban: React.FC = () => {
  return (
    <div className="flex gap-4 p-4" role="status" aria-label="กำลังโหลด">
      {[1, 2, 3, 4].map((col) => (
        <div key={col} className="w-72 bg-slate-100 rounded-xl p-3 space-y-3">
          <Skeleton className="h-6 w-24" />
          {[1, 2, 3].map((card) => (
            <div key={card} className="bg-white rounded-lg p-3 space-y-2 animate-pulse">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <div className="flex gap-2 mt-2">
                <Skeleton className="w-6 h-6 rounded-full" />
                <Skeleton className="w-16 h-6 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ))}
      <span className="sr-only">กำลังโหลด...</span>
    </div>
  );
};

export default Skeleton;

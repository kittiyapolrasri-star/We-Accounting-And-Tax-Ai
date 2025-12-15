/**
 * Toast Notification Component
 * Professional toast/snackbar notifications with accessibility support
 */

import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const duration = toast.duration || 5000;
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const handleDismiss = useCallback(() => {
    setIsLeaving(true);
    setTimeout(() => onDismiss(toast.id), 300);
  }, [toast.id, onDismiss]);

  const icons = {
    success: <CheckCircle2 size={20} className="text-emerald-500" />,
    error: <AlertCircle size={20} className="text-red-500" />,
    warning: <AlertTriangle size={20} className="text-amber-500" />,
    info: <Info size={20} className="text-blue-500" />,
  };

  const backgrounds = {
    success: 'bg-emerald-50 border-emerald-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
    info: 'bg-blue-50 border-blue-200',
  };

  const titleColors = {
    success: 'text-emerald-800',
    error: 'text-red-800',
    warning: 'text-amber-800',
    info: 'text-blue-800',
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      className={`
        flex items-start gap-3 p-4 rounded-xl border shadow-lg max-w-md
        ${backgrounds[toast.type]}
        ${isLeaving ? 'animate-slide-out' : 'animate-slide-in'}
        transition-all duration-300
      `}
    >
      <div className="flex-shrink-0 mt-0.5" aria-hidden="true">
        {icons[toast.type]}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-sm ${titleColors[toast.type]}`}>
          {toast.title}
        </p>
        {toast.message && (
          <p className="text-sm text-slate-600 mt-1">{toast.message}</p>
        )}
      </div>
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 p-1 rounded-lg hover:bg-slate-200/50 transition-colors"
        aria-label="ปิดการแจ้งเตือน"
      >
        <X size={16} className="text-slate-400" />
      </button>
    </div>
  );
};

// Toast Container Component
interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="การแจ้งเตือน"
      className="fixed top-4 right-4 z-50 flex flex-col gap-2"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

// Toast Hook for easy usage
export const useToast = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((
    type: ToastType,
    title: string,
    message?: string,
    duration?: number
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { id, type, title, message, duration }]);
    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback((title: string, message?: string) => {
    return addToast('success', title, message);
  }, [addToast]);

  const error = useCallback((title: string, message?: string) => {
    return addToast('error', title, message, 7000); // Longer for errors
  }, [addToast]);

  const warning = useCallback((title: string, message?: string) => {
    return addToast('warning', title, message);
  }, [addToast]);

  const info = useCallback((title: string, message?: string) => {
    return addToast('info', title, message);
  }, [addToast]);

  return {
    toasts,
    addToast,
    dismissToast,
    success,
    error,
    warning,
    info,
  };
};

export default Toast;

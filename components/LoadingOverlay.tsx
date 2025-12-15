/**
 * LoadingOverlay.tsx
 *
 * Full-screen loading overlay for major operations
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  subMessage?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isVisible,
  message = 'กำลังประมวลผล...',
  subMessage,
}) => {
  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={message}
    >
      <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4 animate-in zoom-in-95 fade-in duration-200">
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
              <Loader2 size={32} className="text-blue-600 animate-spin" />
            </div>
            <div className="absolute -inset-2 rounded-full border-4 border-blue-200 border-t-transparent animate-spin" style={{ animationDuration: '1.5s' }}></div>
          </div>

          <h3 className="text-lg font-bold text-slate-800 mb-1">
            {message}
          </h3>

          {subMessage && (
            <p className="text-sm text-slate-500">
              {subMessage}
            </p>
          )}

          <div className="mt-4 flex gap-1">
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingOverlay;

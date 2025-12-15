/**
 * FloatingAIPanel.tsx
 *
 * Floating AI Assistant Panel - ปุ่มลอยสำหรับเรียกใช้ AI Agents
 * รองรับ: คำนวณภาษี, จับคู่ธนาคาร, มอบหมายงาน, ตรวจสอบ deadline
 */

import React, { useState } from 'react';
import {
  Bot,
  X,
  Calculator,
  GitMerge,
  UserCheck,
  Bell,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ChevronRight,
  Zap,
} from 'lucide-react';

interface AgentAction {
  id: string;
  name: string;
  nameTh: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

interface FloatingAIPanelProps {
  onCalculateTaxes: () => Promise<any>;
  onAutoReconcile: () => Promise<any>;
  onAutoAssignTasks: () => Promise<any>;
  onCheckDeadlines: () => Promise<any>;
  isProcessing: boolean;
  onSuccess: (title: string, message?: string) => void;
  onError: (title: string, message?: string) => void;
}

const AGENT_ACTIONS: AgentAction[] = [
  {
    id: 'tax',
    name: 'Calculate Taxes',
    nameTh: 'คำนวณภาษี',
    description: 'คำนวณ VAT, WHT อัตโนมัติจากเอกสาร',
    icon: <Calculator size={20} />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 hover:bg-blue-100',
  },
  {
    id: 'reconcile',
    name: 'Bank Reconciliation',
    nameTh: 'จับคู่ธนาคาร',
    description: 'จับคู่รายการธนาคารกับเอกสารอัตโนมัติ',
    icon: <GitMerge size={20} />,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 hover:bg-emerald-100',
  },
  {
    id: 'assign',
    name: 'Auto Assign Tasks',
    nameTh: 'มอบหมายงาน',
    description: 'มอบหมายงานตามทักษะและภาระงาน',
    icon: <UserCheck size={20} />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 hover:bg-purple-100',
  },
  {
    id: 'deadline',
    name: 'Check Deadlines',
    nameTh: 'ตรวจ Deadline',
    description: 'ตรวจสอบกำหนดยื่นภาษีและงานที่ใกล้ครบ',
    icon: <Bell size={20} />,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 hover:bg-amber-100',
  },
];

const FloatingAIPanel: React.FC<FloatingAIPanelProps> = ({
  onCalculateTaxes,
  onAutoReconcile,
  onAutoAssignTasks,
  onCheckDeadlines,
  isProcessing,
  onSuccess,
  onError,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ action: string; success: boolean; message: string } | null>(null);

  const handleAction = async (actionId: string) => {
    if (isProcessing) return;

    setActiveAction(actionId);
    setLastResult(null);

    try {
      let result;
      switch (actionId) {
        case 'tax':
          result = await onCalculateTaxes();
          if (result?.success) {
            const taxData = result.result;
            onSuccess(
              'คำนวณภาษีสำเร็จ',
              `VAT: ฿${taxData?.calculations?.netVat?.toLocaleString() || 0} | WHT: ฿${taxData?.calculations?.totalWht?.toLocaleString() || 0}`
            );
            setLastResult({ action: actionId, success: true, message: 'คำนวณภาษีเรียบร้อย' });
          }
          break;

        case 'reconcile':
          result = await onAutoReconcile();
          if (result?.success) {
            const matches = result.result?.matches?.length || 0;
            onSuccess(
              'จับคู่รายการสำเร็จ',
              `จับคู่ได้ ${matches} รายการ`
            );
            setLastResult({ action: actionId, success: true, message: `จับคู่ได้ ${matches} รายการ` });
          }
          break;

        case 'assign':
          result = await onAutoAssignTasks();
          if (result?.success) {
            const assignments = result.result?.assignments?.length || 0;
            onSuccess(
              'มอบหมายงานสำเร็จ',
              `มอบหมายได้ ${assignments} งาน`
            );
            setLastResult({ action: actionId, success: true, message: `มอบหมายได้ ${assignments} งาน` });
          }
          break;

        case 'deadline':
          result = await onCheckDeadlines();
          if (result?.success) {
            const total = result.result?.summary?.total || 0;
            const critical = result.result?.summary?.critical || 0;
            if (total > 0) {
              onSuccess(
                'พบการแจ้งเตือน',
                `${total} รายการ (ด่วน ${critical} รายการ)`
              );
            } else {
              onSuccess('ไม่มีงานใกล้ deadline', 'ทุกอย่างปกติ');
            }
            setLastResult({
              action: actionId,
              success: true,
              message: total > 0 ? `พบ ${total} รายการ` : 'ไม่มีงานใกล้ deadline'
            });
          }
          break;
      }

      if (!result?.success && result?.result?.error) {
        throw new Error(result.result.error);
      }
    } catch (error: any) {
      onError('เกิดข้อผิดพลาด', error.message || 'ไม่สามารถดำเนินการได้');
      setLastResult({ action: actionId, success: false, message: error.message || 'เกิดข้อผิดพลาด' });
    } finally {
      setActiveAction(null);
    }
  };

  const getActionState = (actionId: string) => {
    if (activeAction === actionId) return 'loading';
    if (lastResult?.action === actionId) return lastResult.success ? 'success' : 'error';
    return 'idle';
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-lg transition-all duration-300 ${
          isOpen
            ? 'bg-slate-800 text-white rotate-0'
            : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-xl hover:scale-105'
        }`}
        aria-label={isOpen ? 'ปิด AI Assistant' : 'เปิด AI Assistant'}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <X size={24} className="transition-transform" />
        ) : (
          <div className="relative">
            <Bot size={24} />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
          </div>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300"
          role="dialog"
          aria-label="AI Assistant Panel"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="font-bold text-lg">AI Assistant</h3>
                <p className="text-sm text-blue-100">เลือกงานที่ต้องการให้ AI ช่วย</p>
              </div>
            </div>
          </div>

          {/* Actions List */}
          <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
            {AGENT_ACTIONS.map((action) => {
              const state = getActionState(action.id);

              return (
                <button
                  key={action.id}
                  onClick={() => handleAction(action.id)}
                  disabled={isProcessing}
                  className={`w-full p-3 rounded-xl text-left transition-all duration-200 ${action.bgColor} ${
                    isProcessing && activeAction !== action.id ? 'opacity-50 cursor-not-allowed' : ''
                  } ${state === 'success' ? 'ring-2 ring-green-500' : ''} ${state === 'error' ? 'ring-2 ring-red-500' : ''}`}
                  aria-busy={state === 'loading'}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${action.color} bg-white shadow-sm`}>
                        {state === 'loading' ? (
                          <Loader2 size={20} className="animate-spin" />
                        ) : state === 'success' ? (
                          <CheckCircle2 size={20} className="text-green-600" />
                        ) : state === 'error' ? (
                          <AlertCircle size={20} className="text-red-600" />
                        ) : (
                          action.icon
                        )}
                      </div>
                      <div>
                        <p className={`font-semibold text-sm ${action.color}`}>
                          {action.nameTh}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {state === 'loading'
                            ? 'กำลังประมวลผล...'
                            : state === 'success' && lastResult
                              ? lastResult.message
                              : action.description
                          }
                        </p>
                      </div>
                    </div>
                    {state === 'idle' && (
                      <ChevronRight size={16} className="text-slate-400" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-slate-100 bg-slate-50">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-1">
                <Zap size={12} className="text-amber-500" />
                <span>Powered by Gemini AI</span>
              </div>
              {isProcessing && (
                <span className="flex items-center gap-1 text-blue-600">
                  <Loader2 size={12} className="animate-spin" />
                  กำลังทำงาน...
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/10 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
};

export default FloatingAIPanel;

import React, { useState, useEffect } from 'react';
import {
  GitBranch, Clock, CheckCircle, AlertTriangle, Users, Settings,
  ChevronRight, Play, XCircle, RotateCcw, Bell, BarChart3,
  TrendingUp, Target, Zap, ArrowRight, Eye, User
} from 'lucide-react';
import {
  WorkflowDefinition, WorkflowInstance, Notification, SLAStatus,
  DEFAULT_WORKFLOW_DEFINITIONS, getApprovalLevel, calculateSLAStatus,
  getStaffPendingTasks, getWorkflowStatistics
} from '../services/workflow';
import { DocumentRecord, Staff, Client } from '../types';

interface Props {
  documents: DocumentRecord[];
  staff: Staff[];
  clients: Client[];
  currentUserId: string;
  onApproveTask?: (taskId: string, taskName: string) => void;
  onViewTask?: (taskId: string, taskName: string) => void;
}

const WorkflowDashboard: React.FC<Props> = ({
  documents,
  staff,
  clients,
  currentUserId,
  onApproveTask,
  onViewTask
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'my-tasks' | 'workflows' | 'notifications' | 'settings'>('overview');
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>(DEFAULT_WORKFLOW_DEFINITIONS);
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Mock some instances for demo
  useEffect(() => {
    const mockInstances: WorkflowInstance[] = documents
      .filter(d => d.status === 'pending_review')
      .slice(0, 5)
      .map((doc, i) => ({
        id: `WFI-${doc.id}`,
        workflowId: 'WF-001',
        documentId: doc.id,
        clientId: clients[0]?.id || 'C001',
        currentStepId: 'STEP-001',
        status: i % 3 === 0 ? 'escalated' : 'active',
        startedAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
        dueAt: new Date(Date.now() + (8 - Math.random() * 12) * 60 * 60 * 1000).toISOString(),
        stepHistory: [],
        assignments: [{
          stepId: 'STEP-001',
          assigneeId: currentUserId,
          assigneeName: staff.find(s => s.id === currentUserId)?.name || 'You',
          assignedAt: new Date(Date.now() - Math.random() * 4 * 60 * 60 * 1000).toISOString(),
          dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          status: 'pending',
        }],
      }));
    setInstances(mockInstances);
  }, [documents, clients, currentUserId, staff]);

  // Get current user's pending tasks
  const myTasks = getStaffPendingTasks(currentUserId, instances, workflows);
  const stats = getWorkflowStatistics(instances, workflows);

  // Handler functions
  const handleApproveTask = (taskId: string, taskName: string) => {
    if (onApproveTask) {
      onApproveTask(taskId, taskName);
    } else {
      // Update local state
      setInstances(prev => prev.map(inst =>
        inst.assignments.some(a => a.stepId === taskId)
          ? { ...inst, status: 'completed' as const }
          : inst
      ));
      setSuccessMessage(`อนุมัติ ${taskName} สำเร็จ!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const handleViewTask = (taskId: string, taskName: string) => {
    if (onViewTask) {
      onViewTask(taskId, taskName);
    } else {
      setSuccessMessage(`กำลังดูรายละเอียด: ${taskName}`);
      setTimeout(() => setSuccessMessage(null), 2000);
    }
  };

  const handleCreateWorkflow = () => {
    const newWorkflow: WorkflowDefinition = {
      id: `WF-${Date.now()}`,
      name: `กระบวนการใหม่ ${workflows.length + 1}`,
      description: 'กระบวนการที่สร้างใหม่',
      triggerType: 'manual',
      triggerConditions: [],
      steps: [{
        id: `STEP-${Date.now()}`,
        order: 1,
        name: 'ขั้นตอนที่ 1',
        type: 'approval',
        assigneeType: 'role',
        assigneeRole: 'accountant',
        requiredApprovals: 1,
        slaHours: 24,
        escalationEnabled: true,
        escalationAfterHours: 48,
        escalationTo: 'manager',
        actions: [{ type: 'approve', params: { autoPost: false } }]
      }],
      slaHours: 24,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setWorkflows(prev => [...prev, newWorkflow]);
    setSuccessMessage('สร้างกระบวนการใหม่สำเร็จ!');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleToggleWorkflow = (workflowId: string) => {
    setWorkflows(prev => prev.map(wf =>
      wf.id === workflowId ? { ...wf, enabled: !wf.enabled } : wf
    ));
    const workflow = workflows.find(wf => wf.id === workflowId);
    setSuccessMessage(`${workflow?.enabled ? 'ปิด' : 'เปิด'}ใช้งาน ${workflow?.name} แล้ว`);
    setTimeout(() => setSuccessMessage(null), 2000);
  };


  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatTimeRemaining = (dueAt: string) => {
    const now = new Date();
    const due = new Date(dueAt);
    const diffMs = due.getTime() - now.getTime();
    const diffHours = Math.round(diffMs / (60 * 60 * 1000));

    if (diffHours < 0) {
      return { text: `เกิน ${Math.abs(diffHours)} ชม.`, overdue: true };
    }
    if (diffHours < 1) {
      const diffMins = Math.round(diffMs / (60 * 1000));
      return { text: `${diffMins} นาที`, overdue: false };
    }
    return { text: `${diffHours} ชม.`, overdue: false };
  };

  const getStatusColor = (status: SLAStatus['status']) => {
    switch (status) {
      case 'on_track': return 'text-green-600 bg-green-50';
      case 'at_risk': return 'text-amber-600 bg-amber-50';
      case 'overdue': return 'text-red-600 bg-red-50';
    }
  };

  const getStatusIcon = (status: SLAStatus['status']) => {
    switch (status) {
      case 'on_track': return <CheckCircle size={16} />;
      case 'at_risk': return <Clock size={16} />;
      case 'overdue': return <AlertTriangle size={16} />;
    }
  };

  // Overview Tab
  const renderOverview = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
          <div className="flex items-center justify-between mb-3">
            <GitBranch className="text-blue-600" size={24} />
            <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded-full">Active</span>
          </div>
          <p className="text-3xl font-bold text-slate-800">{stats.totalActive}</p>
          <p className="text-sm text-slate-500 mt-1">กระบวนการที่กำลังดำเนินการ</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border border-green-100">
          <div className="flex items-center justify-between mb-3">
            <CheckCircle className="text-green-600" size={24} />
            <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">Done</span>
          </div>
          <p className="text-3xl font-bold text-slate-800">{stats.totalCompleted}</p>
          <p className="text-sm text-slate-500 mt-1">เสร็จสิ้นแล้ว</p>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-5 border border-amber-100">
          <div className="flex items-center justify-between mb-3">
            <AlertTriangle className="text-amber-600" size={24} />
            <span className="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-1 rounded-full">Escalated</span>
          </div>
          <p className="text-3xl font-bold text-slate-800">{stats.totalEscalated}</p>
          <p className="text-sm text-slate-500 mt-1">ส่งต่อไปยังผู้บริหาร</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-5 border border-purple-100">
          <div className="flex items-center justify-between mb-3">
            <TrendingUp className="text-purple-600" size={24} />
            <span className="text-xs font-medium text-purple-600 bg-purple-100 px-2 py-1 rounded-full">SLA</span>
          </div>
          <p className="text-3xl font-bold text-slate-800">{stats.slaCompliance}%</p>
          <p className="text-sm text-slate-500 mt-1">อัตราการทำงานตาม SLA</p>
        </div>
      </div>

      {/* Workflow Pipeline */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <GitBranch size={20} className="text-indigo-500" />
            Workflow Pipeline
          </h3>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            {['รอตรวจสอบ', 'Staff Review', 'Supervisor Approval', 'เสร็จสิ้น'].map((stage, i) => (
              <React.Fragment key={stage}>
                <div className="text-center">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center ${i === 0 ? 'bg-blue-500 text-white' :
                    i === 3 ? 'bg-green-500 text-white' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                    {i === 0 ? stats.totalActive :
                      i === 3 ? stats.totalCompleted :
                        Math.floor(stats.totalActive / 2)}
                  </div>
                  <p className="text-sm text-slate-600 mt-2">{stage}</p>
                </div>
                {i < 3 && (
                  <ArrowRight className="text-slate-300" size={24} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Active Workflows */}
      <div className="grid grid-cols-2 gap-6">
        {/* Recent Active */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">กระบวนการที่กำลังดำเนินการ</h3>
          </div>
          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {instances.filter(i => i.status === 'active').slice(0, 5).map(instance => {
              const workflow = workflows.find(w => w.id === instance.workflowId);
              const slaStatus = workflow ? calculateSLAStatus(instance, workflow) : null;
              const doc = documents.find(d => d.id === instance.documentId);

              return (
                <div key={instance.id} className="px-5 py-3 hover:bg-slate-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {doc?.ai_data?.parties.counterparty.name || doc?.filename || 'Unknown'}
                      </p>
                      <p className="text-xs text-slate-400">{workflow?.name}</p>
                    </div>
                    {slaStatus && (
                      <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${getStatusColor(slaStatus.status)}`}>
                        {getStatusIcon(slaStatus.status)}
                        {slaStatus.remainingHours.toFixed(1)}h
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {instances.filter(i => i.status === 'active').length === 0 && (
              <div className="p-8 text-center text-slate-400">
                <CheckCircle size={32} className="mx-auto mb-2 text-green-400" />
                <p>ไม่มีกระบวนการที่กำลังดำเนินการ</p>
              </div>
            )}
          </div>
        </div>

        {/* Escalated Items */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-red-50">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-500" />
              รายการที่ต้องดูแลเป็นพิเศษ
            </h3>
          </div>
          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {instances.filter(i => i.status === 'escalated').map(instance => {
              const doc = documents.find(d => d.id === instance.documentId);
              const timeInfo = formatTimeRemaining(instance.dueAt);

              return (
                <div key={instance.id} className="px-5 py-3 hover:bg-slate-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {doc?.ai_data?.parties.counterparty.name || 'Unknown'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatCurrency(doc?.amount || 0)}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${timeInfo.overdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                      {timeInfo.text}
                    </span>
                  </div>
                </div>
              );
            })}
            {instances.filter(i => i.status === 'escalated').length === 0 && (
              <div className="p-8 text-center text-slate-400">
                <CheckCircle size={32} className="mx-auto mb-2 text-green-400" />
                <p>ไม่มีรายการที่ต้องดูแลเป็นพิเศษ</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // My Tasks Tab
  const renderMyTasks = () => (
    <div className="space-y-6">
      {/* Task Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <Play className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{myTasks.pending.length}</p>
              <p className="text-sm text-slate-500">งานที่รอดำเนินการ</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <Clock className="text-amber-600" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{myTasks.atRisk}</p>
              <p className="text-sm text-slate-500">ใกล้ครบกำหนด</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
              <AlertTriangle className="text-red-600" size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{myTasks.overdue}</p>
              <p className="text-sm text-slate-500">เกินกำหนด</p>
            </div>
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">งานของฉัน</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {myTasks.pending.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <CheckCircle size={48} className="mx-auto mb-4 text-green-400" />
              <p className="text-lg font-medium">ไม่มีงานที่รอดำเนินการ</p>
              <p className="text-sm mt-1">คุณทำงานเสร็จหมดแล้ว!</p>
            </div>
          ) : (
            myTasks.pending.map((task, i) => {
              const doc = documents.find(d => d.id === task.documentId);
              const timeInfo = formatTimeRemaining(task.dueAt);

              return (
                <div key={i} className="p-4 hover:bg-slate-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getStatusColor(task.slaStatus)}`}>
                        {getStatusIcon(task.slaStatus)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{task.stepName}</p>
                        <p className="text-sm text-slate-500">
                          {doc?.ai_data?.parties.counterparty.name || doc?.filename || 'Unknown'}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {formatCurrency(doc?.amount || 0)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`text-sm font-medium ${timeInfo.overdue ? 'text-red-600' : 'text-slate-600'}`}>
                        {timeInfo.text}
                      </span>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleApproveTask(task.instanceId, task.stepName)}
                          className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 flex items-center gap-1"
                        >
                          <CheckCircle size={14} />
                          อนุมัติ
                        </button>
                        <button
                          onClick={() => handleViewTask(task.instanceId, task.stepName)}
                          className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-200 flex items-center gap-1"
                        >
                          <Eye size={14} />
                          ดู
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  // Workflows Tab
  const renderWorkflows = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-slate-800">กระบวนการทำงานที่กำหนด</h3>
        <button
          onClick={handleCreateWorkflow}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 flex items-center gap-2"
        >
          <Zap size={16} />
          สร้างกระบวนการใหม่
        </button>
      </div>

      <div className="space-y-4">
        {workflows.map(workflow => (
          <div key={workflow.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${workflow.enabled ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'
                    }`}>
                    <GitBranch size={20} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-800">{workflow.name}</h4>
                    <p className="text-sm text-slate-500">{workflow.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${workflow.enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                    {workflow.enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                  </span>
                  <button
                    onClick={() => handleToggleWorkflow(workflow.id)}
                    className="p-2 hover:bg-slate-100 rounded-lg"
                    title="เปิด/ปิดการใช้งาน"
                  >
                    <Settings size={18} className="text-slate-400" />
                  </button>
                </div>
              </div>

              {/* Workflow Steps */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {workflow.steps.map((step, i) => (
                  <React.Fragment key={step.id}>
                    <div className="flex-shrink-0 bg-slate-50 rounded-lg p-3 border border-slate-200 min-w-[180px]">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center">
                          {i + 1}
                        </span>
                        <span className="text-sm font-medium text-slate-700">{step.name}</span>
                      </div>
                      <div className="text-xs text-slate-500 space-y-1">
                        <p className="flex items-center gap-1">
                          <User size={12} />
                          {step.assigneeRole || step.assigneeType}
                        </p>
                        <p className="flex items-center gap-1">
                          <Clock size={12} />
                          SLA: {step.slaHours}h
                        </p>
                        {step.escalationEnabled && (
                          <p className="flex items-center gap-1 text-amber-600">
                            <AlertTriangle size={12} />
                            Escalate: {step.escalationAfterHours}h
                          </p>
                        )}
                      </div>
                    </div>
                    {i < workflow.steps.length - 1 && (
                      <ChevronRight className="text-slate-300 flex-shrink-0" size={20} />
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* Workflow Stats */}
              <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-100">
                <div className="text-sm">
                  <span className="text-slate-500">รวม SLA:</span>
                  <span className="font-medium text-slate-700 ml-1">{workflow.slaHours} ชม.</span>
                </div>
                <div className="text-sm">
                  <span className="text-slate-500">ขั้นตอน:</span>
                  <span className="font-medium text-slate-700 ml-1">{workflow.steps.length}</span>
                </div>
                <div className="text-sm">
                  <span className="text-slate-500">Trigger:</span>
                  <span className="font-medium text-slate-700 ml-1">{workflow.triggerType}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Approval Thresholds */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Target size={18} className="text-indigo-500" />
            ระดับอำนาจอนุมัติ
          </h3>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-4 gap-4">
            {[
              { level: 1, maxAmount: 10000, role: 'พนักงานบัญชี', color: 'bg-blue-100 text-blue-600' },
              { level: 2, maxAmount: 50000, role: 'หัวหน้างาน', color: 'bg-green-100 text-green-600' },
              { level: 3, maxAmount: 200000, role: 'ผู้จัดการ', color: 'bg-amber-100 text-amber-600' },
              { level: 4, maxAmount: Infinity, role: 'ผู้บริหาร', color: 'bg-red-100 text-red-600' },
            ].map(threshold => (
              <div key={threshold.level} className="text-center p-4 bg-slate-50 rounded-lg">
                <div className={`w-12 h-12 rounded-full ${threshold.color} flex items-center justify-center mx-auto mb-3`}>
                  <span className="font-bold text-lg">L{threshold.level}</span>
                </div>
                <p className="font-medium text-slate-700">{threshold.role}</p>
                <p className="text-sm text-slate-500">
                  {threshold.maxAmount === Infinity
                    ? 'ไม่จำกัด'
                    : `ไม่เกิน ${formatCurrency(threshold.maxAmount)}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // Notifications Tab
  const renderNotifications = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Bell size={18} className="text-indigo-500" />
            การแจ้งเตือน
          </h3>
          <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            อ่านทั้งหมด
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {[
            { type: 'assignment', title: 'งานใหม่รอดำเนินการ', message: 'คุณได้รับมอบหมายให้ตรวจสอบเอกสาร INV-2024-001', time: '5 นาทีที่แล้ว', priority: 'high' },
            { type: 'escalation', title: 'Escalation Alert', message: 'รายการ DOC-123 ถูกส่งต่อมาถึงคุณเนื่องจากเกิน SLA', time: '1 ชม.ที่แล้ว', priority: 'urgent' },
            { type: 'reminder', title: 'เตือนความจำ', message: 'มี 3 รายการที่ใกล้ครบกำหนด SLA ภายใน 2 ชม.', time: '2 ชม.ที่แล้ว', priority: 'medium' },
            { type: 'completion', title: 'อนุมัติสำเร็จ', message: 'เอกสาร INV-2024-089 ได้รับการอนุมัติเรียบร้อยแล้ว', time: '3 ชม.ที่แล้ว', priority: 'low' },
          ].map((notif, i) => (
            <div key={i} className={`p-4 hover:bg-slate-50 ${i === 0 ? 'bg-blue-50/50' : ''}`}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${notif.priority === 'urgent' ? 'bg-red-100 text-red-600' :
                  notif.priority === 'high' ? 'bg-amber-100 text-amber-600' :
                    notif.priority === 'medium' ? 'bg-blue-100 text-blue-600' :
                      'bg-green-100 text-green-600'
                  }`}>
                  {notif.type === 'assignment' ? <Play size={18} /> :
                    notif.type === 'escalation' ? <AlertTriangle size={18} /> :
                      notif.type === 'reminder' ? <Clock size={18} /> :
                        <CheckCircle size={18} />}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-800">{notif.title}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{notif.message}</p>
                  <p className="text-xs text-slate-400 mt-1">{notif.time}</p>
                </div>
                {i === 0 && (
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Settings Tab
  const renderSettings = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">การตั้งค่า Workflow</h3>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-700">เปิดใช้งาน Auto-routing</p>
              <p className="text-sm text-slate-500">มอบหมายงานให้พนักงานอัตโนมัติตามภาระงาน</p>
            </div>
            <button className="relative w-14 h-7 bg-blue-600 rounded-full">
              <div className="absolute top-1 translate-x-8 w-5 h-5 bg-white rounded-full shadow" />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-700">SLA Escalation</p>
              <p className="text-sm text-slate-500">ส่งต่อรายการที่เกิน SLA ไปยังผู้บริหารอัตโนมัติ</p>
            </div>
            <button className="relative w-14 h-7 bg-blue-600 rounded-full">
              <div className="absolute top-1 translate-x-8 w-5 h-5 bg-white rounded-full shadow" />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-700">Email Notifications</p>
              <p className="text-sm text-slate-500">ส่งอีเมลแจ้งเตือนเมื่อมีงานใหม่</p>
            </div>
            <button className="relative w-14 h-7 bg-slate-300 rounded-full">
              <div className="absolute top-1 translate-x-1 w-5 h-5 bg-white rounded-full shadow" />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-700">Auto-approve Low Value</p>
              <p className="text-sm text-slate-500">อนุมัติรายการมูลค่าต่ำกว่า 5,000 บาทอัตโนมัติ</p>
            </div>
            <button className="relative w-14 h-7 bg-blue-600 rounded-full">
              <div className="absolute top-1 translate-x-8 w-5 h-5 bg-white rounded-full shadow" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'overview', label: 'ภาพรวม', icon: BarChart3 },
    { id: 'my-tasks', label: 'งานของฉัน', icon: Play, badge: myTasks.pending.length },
    { id: 'workflows', label: 'กระบวนการ', icon: GitBranch },
    { id: 'notifications', label: 'แจ้งเตือน', icon: Bell },
    { id: 'settings', label: 'ตั้งค่า', icon: Settings },
  ];

  return (
    <div className="flex-1 overflow-auto bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
              <GitBranch className="text-indigo-600" size={32} />
              Workflow Automation
            </h1>
            <p className="text-slate-500 mt-2">
              ระบบจัดการกระบวนการอนุมัติ พร้อมติดตาม SLA และแจ้งเตือนอัตโนมัติ
            </p>
          </div>

          <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg border border-indigo-200">
            <Target size={18} />
            <span className="font-medium">SLA Compliance: {stats.slaCompliance}%</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-200 pb-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors relative ${isActive
                  ? 'bg-white text-blue-600 border border-slate-200 border-b-white -mb-px'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                  }`}
              >
                <Icon size={18} />
                {tab.label}
                {tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'my-tasks' && renderMyTasks()}
        {activeTab === 'workflows' && renderWorkflows()}
        {activeTab === 'notifications' && renderNotifications()}
        {activeTab === 'settings' && renderSettings()}
      </div>
    </div>
  );
};

export default WorkflowDashboard;

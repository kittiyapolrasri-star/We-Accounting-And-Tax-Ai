import React, { useState } from 'react';
import {
  Bot, FileText, Calculator, Building, CalendarCheck, Users, Bell,
  Play, Pause, Settings, Activity, CheckCircle2, AlertCircle, Clock,
  TrendingUp, Zap, ChevronRight, Shield, BarChart3, RefreshCw
} from 'lucide-react';
import { DEFAULT_AGENT_DEFINITIONS, AgentDefinition, AgentType, AgentMetrics, AgentConfig } from '../types/agents';

interface Props {
  onConfigureAgent?: (agentType: AgentType) => void;
}

const AIAgentsPage: React.FC<Props> = ({ onConfigureAgent }) => {
  const [selectedAgent, setSelectedAgent] = useState<AgentDefinition | null>(null);
  const [agentConfigs, setAgentConfigs] = useState<Record<string, { enabled: boolean; confidenceThreshold: number }>>(() => {
    const configs: Record<string, { enabled: boolean; confidenceThreshold: number }> = {};
    DEFAULT_AGENT_DEFINITIONS.forEach(agent => {
      configs[agent.id] = { enabled: agent.enabled, confidenceThreshold: 70 };
    });
    return configs;
  });

  // Mock metrics data
  const mockMetrics: Record<AgentType, AgentMetrics> = {
    orchestrator: { agentType: 'orchestrator', period: 'day', totalExecutions: 0, successCount: 0, failureCount: 0, escalationCount: 0, avgProcessingTimeMs: 0, avgConfidence: 0, costSavingsThb: 0, timeSavedMinutes: 0 },
    document: { agentType: 'document', period: 'day', totalExecutions: 156, successCount: 142, failureCount: 3, escalationCount: 11, avgProcessingTimeMs: 2500, avgConfidence: 92, costSavingsThb: 15600, timeSavedMinutes: 780 },
    tax: { agentType: 'tax', period: 'day', totalExecutions: 45, successCount: 43, failureCount: 0, escalationCount: 2, avgProcessingTimeMs: 5000, avgConfidence: 95, costSavingsThb: 9000, timeSavedMinutes: 225 },
    reconciliation: { agentType: 'reconciliation', period: 'day', totalExecutions: 28, successCount: 25, failureCount: 1, escalationCount: 2, avgProcessingTimeMs: 8000, avgConfidence: 88, costSavingsThb: 5600, timeSavedMinutes: 280 },
    closing: { agentType: 'closing', period: 'day', totalExecutions: 12, successCount: 11, failureCount: 0, escalationCount: 1, avgProcessingTimeMs: 15000, avgConfidence: 94, costSavingsThb: 3600, timeSavedMinutes: 120 },
    task_assignment: { agentType: 'task_assignment', period: 'day', totalExecutions: 89, successCount: 87, failureCount: 0, escalationCount: 2, avgProcessingTimeMs: 500, avgConfidence: 85, costSavingsThb: 4450, timeSavedMinutes: 89 },
    notification: { agentType: 'notification', period: 'day', totalExecutions: 234, successCount: 232, failureCount: 2, escalationCount: 0, avgProcessingTimeMs: 200, avgConfidence: 99, costSavingsThb: 2340, timeSavedMinutes: 117 }
  };

  const getAgentIcon = (type: AgentType) => {
    switch (type) {
      case 'document': return FileText;
      case 'tax': return Calculator;
      case 'reconciliation': return Building;
      case 'closing': return CalendarCheck;
      case 'task_assignment': return Users;
      case 'notification': return Bell;
      default: return Bot;
    }
  };

  const getStatusColor = (enabled: boolean) => {
    return enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500';
  };

  const toggleAgent = (agentId: string) => {
    setAgentConfigs(prev => ({
      ...prev,
      [agentId]: { ...prev[agentId], enabled: !prev[agentId].enabled }
    }));
  };

  // Calculate totals
  const totalExecutions = Object.values(mockMetrics).reduce((acc, m) => acc + m.totalExecutions, 0);
  const totalSuccess = Object.values(mockMetrics).reduce((acc, m) => acc + m.successCount, 0);
  const totalSavings = Object.values(mockMetrics).reduce((acc, m) => acc + m.costSavingsThb, 0);
  const totalTimeSaved = Object.values(mockMetrics).reduce((acc, m) => acc + m.timeSavedMinutes, 0);
  const successRate = totalExecutions > 0 ? (totalSuccess / totalExecutions * 100).toFixed(1) : '0';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-purple-100 rounded-xl">
            <Bot size={28} className="text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">AI Agents</h1>
            <p className="text-slate-500 text-sm">ระบบ AI Agent อัจฉริยะสำหรับงานบัญชี</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">BETA</span>
          <span className="text-xs text-slate-400">v0.1.0 - AI Agent System Preview</span>
        </div>
      </div>

      {/* Overall Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Activity size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Executions (Today)</p>
              <p className="text-2xl font-bold text-slate-800">{totalExecutions.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <CheckCircle2 size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Success Rate</p>
              <p className="text-2xl font-bold text-emerald-600">{successRate}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg">
              <TrendingUp size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Cost Savings (Est.)</p>
              <p className="text-2xl font-bold text-slate-800">฿{totalSavings.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Clock size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Time Saved</p>
              <p className="text-2xl font-bold text-slate-800">{Math.round(totalTimeSaved / 60)} hrs</p>
            </div>
          </div>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Zap size={20} className="text-purple-500" />
          Active Agents
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {DEFAULT_AGENT_DEFINITIONS.map((agent) => {
            const Icon = getAgentIcon(agent.type);
            const metrics = mockMetrics[agent.type];
            const config = agentConfigs[agent.id];
            const isEnabled = config?.enabled ?? agent.enabled;

            return (
              <div
                key={agent.id}
                className={`bg-white rounded-xl border p-5 cursor-pointer transition-all hover:shadow-md ${
                  selectedAgent?.id === agent.id ? 'border-purple-300 shadow-md ring-2 ring-purple-100' : 'border-slate-200'
                } ${!isEnabled ? 'opacity-60' : ''}`}
                onClick={() => setSelectedAgent(agent)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isEnabled ? 'bg-purple-100' : 'bg-slate-100'}`}>
                      <Icon size={24} className={isEnabled ? 'text-purple-600' : 'text-slate-400'} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">{agent.name}</h3>
                      <p className="text-xs text-slate-500">{agent.description}</p>
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex items-center justify-between mb-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(isEnabled)}`}>
                    {isEnabled ? '● Active' : '○ Disabled'}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleAgent(agent.id); }}
                    className={`p-1.5 rounded-lg transition-colors ${
                      isEnabled ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {isEnabled ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                </div>

                {/* Mini Stats */}
                <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 rounded-lg p-2">
                  <div>
                    <p className="text-lg font-bold text-slate-800">{metrics.totalExecutions}</p>
                    <p className="text-[10px] text-slate-500">Runs</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-emerald-600">
                      {metrics.totalExecutions > 0 ? Math.round(metrics.successCount / metrics.totalExecutions * 100) : 0}%
                    </p>
                    <p className="text-[10px] text-slate-500">Success</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-800">{metrics.avgConfidence}%</p>
                    <p className="text-[10px] text-slate-500">Confidence</p>
                  </div>
                </div>

                {/* Capabilities Preview */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {agent.capabilities.slice(0, 3).map((cap) => (
                    <span key={cap} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded-full">
                      {cap.replace(/_/g, ' ')}
                    </span>
                  ))}
                  {agent.capabilities.length > 3 && (
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded-full">
                      +{agent.capabilities.length - 3}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Agent Details */}
      {selectedAgent && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              {(() => {
                const Icon = getAgentIcon(selectedAgent.type);
                return (
                  <div className="p-3 bg-purple-100 rounded-xl">
                    <Icon size={28} className="text-purple-600" />
                  </div>
                );
              })()}
              <div>
                <h2 className="text-xl font-bold text-slate-800">{selectedAgent.name}</h2>
                <p className="text-sm text-slate-500">{selectedAgent.description}</p>
              </div>
            </div>
            <button
              onClick={() => onConfigureAgent?.(selectedAgent.type)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Settings size={16} />
              Configure
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Performance */}
            <div className="bg-slate-50 rounded-xl p-4">
              <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <BarChart3 size={16} className="text-blue-500" />
                Performance (Today)
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Total Runs</span>
                  <span className="font-semibold">{mockMetrics[selectedAgent.type].totalExecutions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Success</span>
                  <span className="font-semibold text-emerald-600">{mockMetrics[selectedAgent.type].successCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Escalated</span>
                  <span className="font-semibold text-amber-600">{mockMetrics[selectedAgent.type].escalationCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">Avg. Time</span>
                  <span className="font-semibold">{(mockMetrics[selectedAgent.type].avgProcessingTimeMs / 1000).toFixed(1)}s</span>
                </div>
              </div>
            </div>

            {/* Capabilities */}
            <div className="bg-slate-50 rounded-xl p-4">
              <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Zap size={16} className="text-purple-500" />
                Capabilities
              </h3>
              <div className="space-y-2">
                {selectedAgent.capabilities.map((cap) => (
                  <div key={cap} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    <span className="text-slate-600 capitalize">{cap.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Escalation Rules */}
            <div className="bg-slate-50 rounded-xl p-4">
              <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Shield size={16} className="text-red-500" />
                Escalation Rules
              </h3>
              {selectedAgent.escalationRules.length === 0 ? (
                <p className="text-sm text-slate-500">No escalation rules configured</p>
              ) : (
                <div className="space-y-2">
                  {selectedAgent.escalationRules.map((rule, idx) => (
                    <div key={idx} className="text-sm bg-white rounded-lg p-2 border border-slate-200">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle size={12} className="text-amber-500" />
                        <span className="font-medium text-slate-700 capitalize">{rule.condition.replace(/_/g, ' ')}</span>
                        {rule.threshold && <span className="text-slate-500">({rule.threshold}%)</span>}
                      </div>
                      <p className="text-slate-500 text-xs pl-4">
                        → Escalate to <span className="font-medium">{rule.escalateTo}</span>
                        {rule.notifyStaff && ', notify staff'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Configuration */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Settings size={16} className="text-slate-500" />
              Quick Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-600 block mb-2">Confidence Threshold</label>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={agentConfigs[selectedAgent.id]?.confidenceThreshold || 70}
                  onChange={(e) => setAgentConfigs(prev => ({
                    ...prev,
                    [selectedAgent.id]: { ...prev[selectedAgent.id], confidenceThreshold: parseInt(e.target.value) }
                  }))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>50% (More Auto)</span>
                  <span className="font-medium text-slate-700">{agentConfigs[selectedAgent.id]?.confidenceThreshold || 70}%</span>
                  <span>100% (More Review)</span>
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-600 block mb-2">Max Concurrent Tasks</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={selectedAgent.maxConcurrentTasks}
                    className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    readOnly
                  />
                  <span className="text-sm text-slate-500">tasks simultaneously</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-8 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-100 p-6">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Bot size={24} className="text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-purple-800 mb-1">AI Agent System - Beta Preview</h3>
            <p className="text-sm text-purple-700 mb-3">
              ระบบ AI Agent ช่วยทำงานอัตโนมัติ เช่น วิเคราะห์เอกสาร, คำนวณภาษี, กระทบยอด และมอบหมายงาน
              ระบบจะเรียนรู้และปรับปรุงความแม่นยำจากการใช้งานจริง
            </p>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-1 text-xs text-purple-600">
                <CheckCircle2 size={14} />
                <span>Document Analysis</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-purple-600">
                <CheckCircle2 size={14} />
                <span>Tax Calculation</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-purple-600">
                <CheckCircle2 size={14} />
                <span>Auto Assignment</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <RefreshCw size={14} />
                <span>More coming soon...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAgentsPage;

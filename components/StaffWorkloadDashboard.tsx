/**
 * Staff Workload Dashboard - Notion-style
 * แสดงภาพรวม workload และ performance ของทีม
 */

import React, { useState, useMemo } from 'react';
import {
  Users,
  Activity,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  PieChart,
  Calendar,
  Target,
  Zap,
  Award,
  Briefcase,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  User,
  UserPlus,
  Settings,
  RefreshCcw,
} from 'lucide-react';
import { Staff } from '../types';
import {
  Task,
  StaffWorkload,
  TaskStatus,
  TaskPriority,
  TASK_STATUS_COLORS,
  TASK_STATUS_LABELS,
  TASK_PRIORITY_COLORS,
} from '../types/tasks';
import { calculateStaffWorkload, getTaskStatistics } from '../services/taskManagement';

interface StaffWorkloadDashboardProps {
  staff: Staff[];
  tasks: Task[];
  onAssignTask: (staffId: string) => void;
  onViewStaffTasks: (staffId: string) => void;
  onRebalanceWorkload: () => void;
}

const StaffWorkloadDashboard: React.FC<StaffWorkloadDashboardProps> = ({
  staff,
  tasks,
  onAssignTask,
  onViewStaffTasks,
  onRebalanceWorkload,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [sortBy, setSortBy] = useState<'name' | 'workload' | 'performance'>('workload');

  // Calculate workloads for all staff
  const workloads = useMemo(() => {
    return staff.map((s) => calculateStaffWorkload(s, tasks, tasks));
  }, [staff, tasks]);

  // Sort workloads
  const sortedWorkloads = useMemo(() => {
    return [...workloads].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.staffName.localeCompare(b.staffName);
        case 'workload':
          return b.utilizationPercent - a.utilizationPercent;
        case 'performance':
          return b.slaCompliance - a.slaCompliance;
        default:
          return 0;
      }
    });
  }, [workloads, sortBy]);

  // Team statistics
  const teamStats = useMemo(() => {
    const stats = getTaskStatistics(tasks);
    const avgUtilization = workloads.reduce((sum, w) => sum + w.utilizationPercent, 0) / workloads.length;
    const avgSla = workloads.reduce((sum, w) => sum + w.slaCompliance, 0) / workloads.length;
    const totalOverdue = workloads.reduce((sum, w) => sum + w.overdueItems, 0);
    const availableStaff = workloads.filter((w) => w.isAvailable).length;

    return {
      ...stats,
      avgUtilization: Math.round(avgUtilization),
      avgSla: Math.round(avgSla),
      totalOverdue,
      availableStaff,
      totalStaff: staff.length,
    };
  }, [tasks, workloads, staff]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <Users className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Team Workload</h1>
                <p className="text-sm text-gray-500">ภาพรวมงานและประสิทธิภาพของทีม</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Period Selector */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                {(['day', 'week', 'month'] as const).map((period) => (
                  <button
                    key={period}
                    onClick={() => setSelectedPeriod(period)}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      selectedPeriod === period
                        ? 'bg-white shadow-sm text-gray-900'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {period === 'day' ? 'วันนี้' : period === 'week' ? 'สัปดาห์' : 'เดือน'}
                  </button>
                ))}
              </div>

              <button
                onClick={onRebalanceWorkload}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <RefreshCcw size={18} />
                <span>AI จัดสรรงาน</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <SummaryCard
            icon={<Target className="text-blue-600" />}
            label="งานทั้งหมด"
            value={teamStats.total}
            subValue={`${teamStats.completed} เสร็จแล้ว`}
            trend={teamStats.completionRate}
            trendLabel="อัตราสำเร็จ"
            color="blue"
          />
          <SummaryCard
            icon={<Activity className="text-green-600" />}
            label="Utilization เฉลี่ย"
            value={`${teamStats.avgUtilization}%`}
            subValue={`${teamStats.availableStaff}/${teamStats.totalStaff} ว่าง`}
            trend={teamStats.avgUtilization > 70 ? -5 : 10}
            trendLabel="จากสัปดาห์ก่อน"
            color="green"
          />
          <SummaryCard
            icon={<Clock className="text-amber-600" />}
            label="SLA Compliance"
            value={`${teamStats.avgSla}%`}
            subValue={`${teamStats.totalOverdue} เกินกำหนด`}
            trend={teamStats.avgSla >= 90 ? 5 : -3}
            trendLabel="จากสัปดาห์ก่อน"
            color="amber"
          />
          <SummaryCard
            icon={<Zap className="text-purple-600" />}
            label="กำลังดำเนินการ"
            value={teamStats.inProgress}
            subValue={`${teamStats.overdue} เร่งด่วน`}
            trend={null}
            trendLabel=""
            color="purple"
          />
        </div>

        {/* View Toggle & Sort */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-900">สมาชิกทีม</h2>
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {staff.length} คน
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="workload">เรียงตาม Workload</option>
              <option value="performance">เรียงตาม Performance</option>
              <option value="name">เรียงตามชื่อ</option>
            </select>

            {/* View Mode */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('cards')}
                className={`p-2 rounded ${viewMode === 'cards' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
              >
                <BarChart3 size={18} />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded ${viewMode === 'table' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
              >
                <Users size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Staff Cards View */}
        {viewMode === 'cards' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedWorkloads.map((workload) => (
              <StaffCard
                key={workload.staffId}
                workload={workload}
                onAssign={() => onAssignTask(workload.staffId)}
                onViewTasks={() => onViewStaffTasks(workload.staffId)}
              />
            ))}
          </div>
        )}

        {/* Staff Table View */}
        {viewMode === 'table' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">สมาชิก</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">Workload</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">งาน</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">SLA</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">สัปดาห์นี้</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">สถานะ</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-gray-600"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedWorkloads.map((workload) => (
                  <tr key={workload.staffId} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-medium">
                          {workload.staffName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{workload.staffName}</div>
                          <div className="text-sm text-gray-500">{workload.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              workload.utilizationPercent > 80
                                ? 'bg-red-500'
                                : workload.utilizationPercent > 60
                                ? 'bg-amber-500'
                                : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(100, workload.utilizationPercent)}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600">{workload.utilizationPercent}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-900">{workload.currentLoad}</span>
                        <span className="text-gray-400">/</span>
                        <span className="text-gray-500">{workload.maxCapacity}</span>
                        {workload.overdueItems > 0 && (
                          <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-xs">
                            {workload.overdueItems} เกิน
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-medium ${
                            workload.slaCompliance >= 90
                              ? 'text-green-600'
                              : workload.slaCompliance >= 70
                              ? 'text-amber-600'
                              : 'text-red-600'
                          }`}
                        >
                          {workload.slaCompliance}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">
                        {workload.completedThisWeek} เสร็จ
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {workload.isAvailable ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                          ว่าง
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                          งานเต็ม
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onViewStaffTasks(workload.staffId)}
                          className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
                          title="ดูงาน"
                        >
                          <ChevronRight size={18} />
                        </button>
                        <button
                          onClick={() => onAssignTask(workload.staffId)}
                          className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
                          title="มอบหมายงาน"
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Task Distribution Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          {/* Task by Status */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">งานตามสถานะ</h3>
            <div className="space-y-4">
              {Object.entries(teamStats.byStatus || {})
                .filter(([, count]) => (count as number) > 0)
                .map(([status, count]) => {
                  const countNum = count as number;
                  return (
                    <div key={status} className="flex items-center gap-4">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: TASK_STATUS_COLORS[status as TaskStatus] }}
                      />
                      <span className="flex-1 text-sm text-gray-600">
                        {TASK_STATUS_LABELS[status as TaskStatus]}
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(countNum / teamStats.total) * 100}%`,
                              backgroundColor: TASK_STATUS_COLORS[status as TaskStatus],
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-900 w-8 text-right">
                          {countNum}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Task by Priority */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">งานตามความสำคัญ</h3>
            <div className="space-y-4">
              {Object.entries(teamStats.byPriority || {}).map(([priority, count]) => {
                const countNum = count as number;
                return (
                  <div key={priority} className="flex items-center gap-4">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: TASK_PRIORITY_COLORS[priority as TaskPriority] }}
                    />
                    <span className="flex-1 text-sm text-gray-600">
                      {priority === 'urgent'
                        ? 'เร่งด่วนมาก'
                        : priority === 'high'
                        ? 'สำคัญ'
                        : priority === 'medium'
                        ? 'ปานกลาง'
                        : 'ไม่เร่งด่วน'}
                    </span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(countNum / teamStats.total) * 100}%`,
                            backgroundColor: TASK_PRIORITY_COLORS[priority as TaskPriority],
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-8 text-right">
                        {countNum}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Summary Card Component
interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  subValue: string;
  trend: number | null;
  trendLabel: string;
  color: 'blue' | 'green' | 'amber' | 'purple' | 'red';
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  icon,
  label,
  value,
  subValue,
  trend,
  trendLabel,
  color,
}) => {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-100',
    green: 'bg-green-50 border-green-100',
    amber: 'bg-amber-50 border-amber-100',
    purple: 'bg-purple-50 border-purple-100',
    red: 'bg-red-50 border-red-100',
  };

  return (
    <div className={`rounded-xl border p-5 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm">
          {icon}
        </div>
        {trend !== null && (
          <div
            className={`flex items-center gap-1 text-sm ${
              trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-500'
            }`}
          >
            {trend > 0 ? (
              <ArrowUpRight size={16} />
            ) : trend < 0 ? (
              <ArrowDownRight size={16} />
            ) : (
              <Minus size={16} />
            )}
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
      <div className="text-xs text-gray-500 mt-1">{subValue}</div>
    </div>
  );
};

// Staff Card Component
interface StaffCardProps {
  workload: StaffWorkload;
  onAssign: () => void;
  onViewTasks: () => void;
}

const StaffCard: React.FC<StaffCardProps> = ({ workload, onAssign, onViewTasks }) => {
  const utilizationColor =
    workload.utilizationPercent > 80
      ? 'red'
      : workload.utilizationPercent > 60
      ? 'amber'
      : 'green';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-lg font-semibold">
              {workload.staffName.charAt(0)}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{workload.staffName}</h3>
              <p className="text-sm text-gray-500">{workload.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {workload.isAvailable ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                ว่าง
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                งานเต็ม
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Workload Meter */}
      <div className="px-5 py-4 bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Workload</span>
          <span
            className={`text-sm font-semibold ${
              utilizationColor === 'red'
                ? 'text-red-600'
                : utilizationColor === 'amber'
                ? 'text-amber-600'
                : 'text-green-600'
            }`}
          >
            {workload.utilizationPercent}%
          </span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              utilizationColor === 'red'
                ? 'bg-red-500'
                : utilizationColor === 'amber'
                ? 'bg-amber-500'
                : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(100, workload.utilizationPercent)}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <span>
            {workload.currentLoad} / {workload.maxCapacity} งาน
          </span>
          <span>{workload.availableHours}h ว่าง</span>
        </div>
      </div>

      {/* Stats */}
      <div className="px-5 py-4">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">{workload.completedThisWeek}</div>
            <div className="text-xs text-gray-500">เสร็จสัปดาห์นี้</div>
          </div>
          <div className="text-center border-x border-gray-100">
            <div
              className={`text-lg font-semibold ${
                workload.slaCompliance >= 90
                  ? 'text-green-600'
                  : workload.slaCompliance >= 70
                  ? 'text-amber-600'
                  : 'text-red-600'
              }`}
            >
              {workload.slaCompliance}%
            </div>
            <div className="text-xs text-gray-500">SLA</div>
          </div>
          <div className="text-center">
            <div
              className={`text-lg font-semibold ${
                workload.overdueItems > 0 ? 'text-red-600' : 'text-gray-900'
              }`}
            >
              {workload.overdueItems}
            </div>
            <div className="text-xs text-gray-500">เกินกำหนด</div>
          </div>
        </div>

        {/* Task Status Breakdown */}
        <div className="flex gap-1 mb-4">
          {Object.entries(workload.tasksByStatus)
            .filter(([, count]) => count > 0)
            .map(([status, count]) => (
              <div
                key={status}
                className="flex-1 h-2 rounded-full"
                style={{
                  backgroundColor: TASK_STATUS_COLORS[status as TaskStatus],
                  opacity: 0.7,
                }}
                title={`${TASK_STATUS_LABELS[status as TaskStatus]}: ${count}`}
              />
            ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onViewTasks}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Briefcase size={16} />
            ดูงาน
          </button>
          <button
            onClick={onAssign}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 rounded-lg text-sm text-white hover:bg-purple-700 transition-colors"
          >
            <Plus size={16} />
            มอบหมาย
          </button>
        </div>
      </div>

      {/* Upcoming Deadlines Alert */}
      {workload.upcomingDeadlines > 0 && (
        <div className="px-5 py-3 bg-amber-50 border-t border-amber-100">
          <div className="flex items-center gap-2 text-sm text-amber-700">
            <AlertTriangle size={16} />
            <span>{workload.upcomingDeadlines} งานใกล้ deadline</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffWorkloadDashboard;

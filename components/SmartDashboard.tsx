import React, { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Target, AlertTriangle, CheckCircle2,
  Clock, Users, FileText, DollarSign, BarChart3, Bell, ChevronRight,
  AlertCircle, Zap, ArrowUpRight, RefreshCw, Calendar, Activity,
  XCircle, Eye, PieChart, Building
} from 'lucide-react';
import {
  KPI, Alert, ActionItem, DashboardSummary, ClientHealth,
  calculateKPIs, generateAlerts, generateActionItems,
  calculateSummary, calculateClientHealth, generateTrendData
} from '../services/smartDashboard';
import { DocumentRecord, Client, Staff, PostedGLEntry } from '../types';
import { databaseService } from '../services/database';

interface Props {
  documents: DocumentRecord[];
  clients: Client[];
  staff: Staff[];
  glEntries: PostedGLEntry[];
  onNavigateToClient?: (clientId: string) => void;
  onNavigateToDocument?: (docId: string) => void;
}

const SmartDashboard: React.FC<Props> = ({
  documents,
  clients,
  staff,
  glEntries,
  onNavigateToClient,
  onNavigateToDocument
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'kpis' | 'alerts' | 'actions' | 'clients'>('overview');
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [clientHealth, setClientHealth] = useState<ClientHealth[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Calculate dashboard data
  useEffect(() => {
    refreshData();
  }, [documents, clients, glEntries, staff]);

  const refreshData = async () => {
    setIsRefreshing(true);

    // Calculate all metrics
    const newKpis = calculateKPIs(documents, clients, glEntries);
    const newAlerts = generateAlerts(documents, clients, staff);
    const newActions = generateActionItems(documents, clients, staff);
    const newSummary = calculateSummary(documents, clients, glEntries);
    const newHealth = calculateClientHealth(clients, documents);

    setKpis(newKpis);
    setAlerts(newAlerts);
    setActionItems(newActions);
    setSummary(newSummary);
    setClientHealth(newHealth);
    setLastRefresh(new Date());

    setTimeout(() => setIsRefreshing(false), 500);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('th-TH').format(num);
  };

  const getPriorityColor = (priority: ActionItem['priority']) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'medium': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'low': return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'critical': return <XCircle className="text-red-500" size={20} />;
      case 'warning': return <AlertTriangle className="text-amber-500" size={20} />;
      case 'info': return <AlertCircle className="text-blue-500" size={20} />;
      case 'success': return <CheckCircle2 className="text-green-500" size={20} />;
    }
  };

  const getHealthColor = (status: ClientHealth['status']) => {
    switch (status) {
      case 'excellent': return 'bg-green-100 text-green-700';
      case 'good': return 'bg-blue-100 text-blue-700';
      case 'attention': return 'bg-amber-100 text-amber-700';
      case 'critical': return 'bg-red-100 text-red-700';
    }
  };

  // Overview Tab
  const renderOverview = () => (
    <div className="space-y-6">
      {/* Hero Stats - Clean White Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-slate-100 rounded-lg">
              <DollarSign size={24} className="text-slate-600" />
            </div>
            <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded-full">Revenue</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(summary?.monthlyRevenue || 0)}</p>
          <p className="text-slate-500 text-sm mt-1">รายได้เดือนนี้</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-slate-100 rounded-lg">
              <FileText size={24} className="text-slate-600" />
            </div>
            <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded-full">Documents</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatNumber(summary?.totalDocuments || 0)}</p>
          <p className="text-slate-500 text-sm mt-1">
            <span className={`font-semibold ${(summary?.pendingDocuments || 0) > 0 ? 'text-amber-600' : 'text-slate-600'}`}>
              {summary?.pendingDocuments || 0}
            </span> รอดำเนินการ
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Building size={24} className="text-slate-600" />
            </div>
            <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded-full">Clients</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{summary?.activeClients || 0}</p>
          <p className="text-slate-500 text-sm mt-1">ลูกค้าที่ดูแล</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className={`p-2 rounded-lg ${(summary?.slaCompliance || 0) >= 90 ? 'bg-green-50' : 'bg-amber-50'}`}>
              <Target size={24} className={(summary?.slaCompliance || 0) >= 90 ? 'text-green-600' : 'text-amber-600'} />
            </div>
            <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded-full">SLA</span>
          </div>
          <p className={`text-2xl font-bold ${(summary?.slaCompliance || 0) >= 90 ? 'text-green-600' : 'text-amber-600'}`}>
            {summary?.slaCompliance || 0}%
          </p>
          <p className="text-slate-500 text-sm mt-1">ประสิทธิภาพการทำงาน</p>
        </div>
      </div>

      {/* Critical Alerts Banner */}
      {alerts.filter(a => a.type === 'critical').length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-red-500" size={24} />
            <div className="flex-1">
              <p className="font-semibold text-red-700">
                {alerts.filter(a => a.type === 'critical').length} รายการต้องดำเนินการเร่งด่วน
              </p>
              <p className="text-sm text-red-600">
                {alerts.find(a => a.type === 'critical')?.titleTh}
              </p>
            </div>
            <button
              onClick={() => setActiveTab('alerts')}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
            >
              ดูทั้งหมด
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* KPI Cards */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <BarChart3 size={18} className="text-indigo-500" />
              KPIs หลัก
            </h3>
            <button
              onClick={() => setActiveTab('kpis')}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              ดูทั้งหมด
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {kpis.slice(0, 4).map(kpi => (
              <div key={kpi.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">{kpi.nameTh}</p>
                  <p className="text-lg font-bold text-slate-800">
                    {kpi.unit === 'currency' ? formatCurrency(kpi.value) :
                      kpi.unit === 'percentage' ? `${kpi.value}%` :
                        formatNumber(kpi.value)}
                  </p>
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${kpi.trendIsGood
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
                  }`}>
                  {kpi.trend === 'up' ? <TrendingUp size={14} /> :
                    kpi.trend === 'down' ? <TrendingDown size={14} /> :
                      <Activity size={14} />}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts Preview */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Bell size={18} className="text-amber-500" />
              การแจ้งเตือน
            </h3>
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
              {alerts.filter(a => a.type === 'critical' || a.type === 'warning').length}
            </span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
            {alerts.slice(0, 5).map(alert => (
              <div key={alert.id} className="px-5 py-3 flex items-start gap-3 hover:bg-slate-50">
                {getAlertIcon(alert.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{alert.titleTh}</p>
                  <p className="text-xs text-slate-500 truncate">{alert.messageTh}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Items Preview */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Zap size={18} className="text-purple-500" />
              งานที่ต้องทำ
            </h3>
            <button
              onClick={() => setActiveTab('actions')}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              ดูทั้งหมด
            </button>
          </div>
          <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
            {actionItems.slice(0, 5).map(item => (
              <div key={item.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50">
                <span className={`text-xs px-2 py-1 rounded border font-medium ${getPriorityColor(item.priority)}`}>
                  {item.priority === 'urgent' ? 'ด่วน' :
                    item.priority === 'high' ? 'สูง' :
                      item.priority === 'medium' ? 'ปานกลาง' : 'ต่ำ'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{item.titleTh}</p>
                  <p className="text-xs text-slate-500 truncate">{item.descriptionTh}</p>
                </div>
                <ChevronRight size={16} className="text-slate-400" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Client Health Overview */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Users size={18} className="text-blue-500" />
            สถานะลูกค้า
          </h3>
          <button
            onClick={() => setActiveTab('clients')}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            ดูทั้งหมด
          </button>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-6 gap-3">
            {clientHealth.slice(0, 6).map(client => (
              <div
                key={client.clientId}
                className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer"
                onClick={() => onNavigateToClient?.(client.clientId)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${getHealthColor(client.status)}`}>
                    {client.score}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{client.clientName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  {client.issuesCount > 0 && (
                    <span className="text-red-600">{client.issuesCount} issues</span>
                  )}
                  {client.pendingDocs > 0 && (
                    <span className="text-amber-600">{client.pendingDocs} pending</span>
                  )}
                  {client.issuesCount === 0 && client.pendingDocs === 0 && (
                    <span className="text-green-600">OK</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // KPIs Tab
  const renderKPIs = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        {/* Revenue KPIs */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-blue-50">
            <h3 className="font-semibold text-blue-800 flex items-center gap-2">
              <DollarSign size={18} />
              รายได้ (Revenue)
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {kpis.filter(k => k.category === 'revenue').map(kpi => (
              <div key={kpi.id} className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-slate-600">{kpi.nameTh}</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">
                    {kpi.unit === 'currency' ? formatCurrency(kpi.value) : formatNumber(kpi.value)}
                  </p>
                  {kpi.target && (
                    <p className="text-sm text-slate-500 mt-1">
                      เป้าหมาย: {kpi.unit === 'currency' ? formatCurrency(kpi.target) : formatNumber(kpi.target)}
                    </p>
                  )}
                </div>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${kpi.trendIsGood ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                  {kpi.trend === 'up' ? (
                    <TrendingUp className={kpi.trendIsGood ? 'text-green-600' : 'text-red-600'} size={28} />
                  ) : (
                    <TrendingDown className={kpi.trendIsGood ? 'text-green-600' : 'text-red-600'} size={28} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Efficiency KPIs */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-purple-50">
            <h3 className="font-semibold text-purple-800 flex items-center gap-2">
              <Zap size={18} />
              ประสิทธิภาพ (Efficiency)
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {kpis.filter(k => k.category === 'efficiency').map(kpi => (
              <div key={kpi.id} className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-slate-600">{kpi.nameTh}</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">
                    {kpi.unit === 'percentage' ? `${kpi.value}%` : formatNumber(kpi.value)}
                  </p>
                  {kpi.target && (
                    <div className="mt-2 w-full bg-slate-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${kpi.trendIsGood ? 'bg-green-500' : 'bg-amber-500'}`}
                        style={{ width: `${Math.min(100, (kpi.value / kpi.target) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${kpi.trendIsGood ? 'bg-green-100' : 'bg-amber-100'
                  }`}>
                  {kpi.trendIsGood ? (
                    <CheckCircle2 className="text-green-600" size={28} />
                  ) : (
                    <AlertTriangle className="text-amber-600" size={28} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quality KPIs */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-emerald-50">
            <h3 className="font-semibold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 size={18} />
              คุณภาพ (Quality)
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {kpis.filter(k => k.category === 'quality').map(kpi => (
              <div key={kpi.id} className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-slate-600">{kpi.nameTh}</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">
                    {formatNumber(kpi.value)}
                  </p>
                </div>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${kpi.trendIsGood ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                  {kpi.value === 0 ? (
                    <CheckCircle2 className="text-green-600" size={28} />
                  ) : (
                    <AlertCircle className="text-red-600" size={28} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Compliance KPIs */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-amber-50">
            <h3 className="font-semibold text-amber-800 flex items-center gap-2">
              <Calendar size={18} />
              การปฏิบัติตามกฎหมาย (Compliance)
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {kpis.filter(k => k.category === 'compliance').map(kpi => (
              <div key={kpi.id} className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-slate-600">{kpi.nameTh}</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">
                    {formatNumber(kpi.value)}
                  </p>
                </div>
                <div className="w-16 h-16 rounded-full flex items-center justify-center bg-green-100">
                  <CheckCircle2 className="text-green-600" size={28} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // Alerts Tab
  const renderAlerts = () => (
    <div className="space-y-4">
      {alerts.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <CheckCircle2 size={48} className="mx-auto text-green-500 mb-4" />
          <p className="text-lg font-medium text-slate-800">ไม่มีการแจ้งเตือน</p>
          <p className="text-slate-500">ระบบทำงานปกติ</p>
        </div>
      ) : (
        alerts.map(alert => (
          <div
            key={alert.id}
            className={`bg-white rounded-xl border overflow-hidden ${alert.type === 'critical' ? 'border-red-200' :
              alert.type === 'warning' ? 'border-amber-200' :
                alert.type === 'success' ? 'border-green-200' : 'border-slate-200'
              }`}
          >
            <div className={`px-5 py-4 flex items-start gap-4 ${alert.type === 'critical' ? 'bg-red-50' :
              alert.type === 'warning' ? 'bg-amber-50' :
                alert.type === 'success' ? 'bg-green-50' : 'bg-slate-50'
              }`}>
              {getAlertIcon(alert.type)}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-slate-800">{alert.titleTh}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${alert.type === 'critical' ? 'bg-red-200 text-red-700' :
                    alert.type === 'warning' ? 'bg-amber-200 text-amber-700' :
                      alert.type === 'success' ? 'bg-green-200 text-green-700' : 'bg-slate-200 text-slate-700'
                    }`}>
                    {alert.category}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mt-1">{alert.messageTh}</p>
                <p className="text-xs text-slate-400 mt-2">
                  {new Date(alert.timestamp).toLocaleString('th-TH')}
                </p>
              </div>
              {alert.clientId && (
                <button
                  onClick={() => onNavigateToClient?.(alert.clientId!)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  ดูรายละเอียด
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );

  // Actions Tab
  const renderActions = () => (
    <div className="space-y-6">
      {/* Priority Groups */}
      {['urgent', 'high', 'medium', 'low'].map(priority => {
        const priorityItems = actionItems.filter(i => i.priority === priority);
        if (priorityItems.length === 0) return null;

        const priorityLabels = {
          urgent: { label: 'ด่วนมาก', color: 'bg-red-500' },
          high: { label: 'สำคัญ', color: 'bg-amber-500' },
          medium: { label: 'ปานกลาง', color: 'bg-blue-500' },
          low: { label: 'ทั่วไป', color: 'bg-slate-400' },
        };

        return (
          <div key={priority} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className={`px-5 py-3 flex items-center gap-2 ${priority === 'urgent' ? 'bg-red-50' :
              priority === 'high' ? 'bg-amber-50' :
                priority === 'medium' ? 'bg-blue-50' : 'bg-slate-50'
              }`}>
              <div className={`w-3 h-3 rounded-full ${priorityLabels[priority as keyof typeof priorityLabels].color}`} />
              <h3 className="font-semibold text-slate-800">
                {priorityLabels[priority as keyof typeof priorityLabels].label}
              </h3>
              <span className="text-sm text-slate-500">({priorityItems.length} รายการ)</span>
            </div>
            <div className="divide-y divide-slate-100">
              {priorityItems.map(item => (
                <div key={item.id} className="p-4 flex items-center gap-4 hover:bg-slate-50">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${item.type === 'review' ? 'bg-blue-100 text-blue-600' :
                    item.type === 'approval' ? 'bg-green-100 text-green-600' :
                      item.type === 'closing' ? 'bg-purple-100 text-purple-600' :
                        item.type === 'reconciliation' ? 'bg-amber-100 text-amber-600' :
                          'bg-slate-100 text-slate-600'
                    }`}>
                    {item.type === 'review' ? <Eye size={20} /> :
                      item.type === 'approval' ? <CheckCircle2 size={20} /> :
                        item.type === 'closing' ? <Calendar size={20} /> :
                          item.type === 'reconciliation' ? <RefreshCw size={20} /> :
                            <FileText size={20} />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">{item.titleTh}</p>
                    <p className="text-sm text-slate-500">{item.descriptionTh}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                      {item.estimatedMinutes && (
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          ~{item.estimatedMinutes} นาที
                        </span>
                      )}
                      {item.assigneeName && (
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          {item.assigneeName}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {item.documentId && (
                      <button
                        onClick={() => onNavigateToDocument?.(item.documentId!)}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                      >
                        ดำเนินการ
                      </button>
                    )}
                    {item.clientId && !item.documentId && (
                      <button
                        onClick={() => onNavigateToClient?.(item.clientId!)}
                        className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200"
                      >
                        ดูลูกค้า
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {actionItems.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <CheckCircle2 size={48} className="mx-auto text-green-500 mb-4" />
          <p className="text-lg font-medium text-slate-800">ไม่มีงานที่ต้องทำ</p>
          <p className="text-slate-500">งานทั้งหมดเสร็จเรียบร้อยแล้ว!</p>
        </div>
      )}
    </div>
  );

  // Clients Tab
  const renderClients = () => (
    <div className="space-y-6">
      {/* Health Summary */}
      <div className="grid grid-cols-4 gap-4">
        {['excellent', 'good', 'attention', 'critical'].map(status => {
          const count = clientHealth.filter(c => c.status === status).length;
          const labels = {
            excellent: { label: 'ดีเยี่ยม', icon: CheckCircle2, color: 'bg-green-100 text-green-600' },
            good: { label: 'ปกติ', icon: Activity, color: 'bg-blue-100 text-blue-600' },
            attention: { label: 'ต้องดูแล', icon: AlertTriangle, color: 'bg-amber-100 text-amber-600' },
            critical: { label: 'วิกฤต', icon: XCircle, color: 'bg-red-100 text-red-600' },
          };
          const config = labels[status as keyof typeof labels];
          const Icon = config.icon;

          return (
            <div key={status} className={`rounded-xl p-5 ${config.color.replace('text-', 'bg-').split(' ')[0]}`}>
              <div className="flex items-center justify-between mb-2">
                <Icon size={24} className={config.color.split(' ')[1]} />
                <span className="text-2xl font-bold text-slate-800">{count}</span>
              </div>
              <p className="text-sm font-medium text-slate-600">{config.label}</p>
            </div>
          );
        })}
      </div>

      {/* Client List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">รายชื่อลูกค้าทั้งหมด</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">ลูกค้า</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-600 uppercase">คะแนน</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-600 uppercase">สถานะ</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-600 uppercase">ประเด็น</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-600 uppercase">เอกสารค้าง</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-600 uppercase">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clientHealth.map(client => (
                <tr key={client.clientId} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-800">{client.clientName}</p>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <div className={`inline-flex w-10 h-10 rounded-full items-center justify-center text-sm font-bold ${getHealthColor(client.status)}`}>
                      {client.score}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${getHealthColor(client.status)}`}>
                      {client.status === 'excellent' ? 'ดีเยี่ยม' :
                        client.status === 'good' ? 'ปกติ' :
                          client.status === 'attention' ? 'ต้องดูแล' : 'วิกฤต'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    {client.issuesCount > 0 ? (
                      <span className="text-red-600 font-medium">{client.issuesCount}</span>
                    ) : (
                      <CheckCircle2 size={18} className="text-green-500 mx-auto" />
                    )}
                  </td>
                  <td className="px-5 py-4 text-center">
                    {client.pendingDocs > 0 ? (
                      <span className="text-amber-600 font-medium">{client.pendingDocs}</span>
                    ) : (
                      <CheckCircle2 size={18} className="text-green-500 mx-auto" />
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => onNavigateToClient?.(client.clientId)}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 inline-flex items-center gap-1"
                    >
                      ดูรายละเอียด
                      <ChevronRight size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'overview', label: 'ภาพรวม', icon: BarChart3 },
    { id: 'kpis', label: 'KPIs', icon: Target },
    { id: 'alerts', label: 'แจ้งเตือน', icon: Bell, badge: alerts.filter(a => a.type === 'critical').length },
    { id: 'actions', label: 'งานที่ต้องทำ', icon: Zap, badge: actionItems.filter(i => i.priority === 'urgent').length },
    { id: 'clients', label: 'ลูกค้า', icon: Building },
  ];

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <div className="p-8">
        {/* Header - Clean Minimal */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-xl">
                <PieChart className="text-slate-700" size={24} />
              </div>
              Smart Dashboard
            </h1>
            <p className="text-slate-500 mt-2 ml-12">
              แดชบอร์ดอัจฉริยะสำหรับผู้บริหาร - KPIs, Alerts, และ Action Items
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right text-sm text-slate-500">
              <p>อัปเดตล่าสุด</p>
              <p className="font-medium text-slate-700">{lastRefresh.toLocaleTimeString('th-TH')}</p>
            </div>
            <button
              onClick={refreshData}
              disabled={isRefreshing}
              className={`p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 shadow-sm ${isRefreshing ? 'animate-spin' : ''
                }`}
            >
              <RefreshCw size={20} className="text-slate-600" />
            </button>
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
        {activeTab === 'kpis' && renderKPIs()}
        {activeTab === 'alerts' && renderAlerts()}
        {activeTab === 'actions' && renderActions()}
        {activeTab === 'clients' && renderClients()}
      </div>
    </div>
  );
};

export default SmartDashboard;

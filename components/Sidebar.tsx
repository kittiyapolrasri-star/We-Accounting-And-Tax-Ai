import React, { useState } from 'react';
import {
  LayoutDashboard, FileText, Users, Settings, PlusCircle, PieChart,
  Building, FilePlus, BarChart3, ChevronRight, ChevronDown, Scale,
  Briefcase, Globe, DollarSign, Database, RefreshCw, Send, Zap,
  GitBranch, Gauge, FolderKanban, UsersRound, Calendar, Bot,
  ClipboardList, Crown, ShoppingCart, Bell, FileSpreadsheet
} from 'lucide-react';

interface Props {
  activeView: string;
  onChangeView: (view: string) => void;
  userRole?: string;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
}

interface MenuGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  items: MenuItem[];
  defaultOpen?: boolean;
}

const WeLogo = () => (
  <img
    src="/icon/S__111992841_0.jpg"
    alt="Company Logo"
    className="w-10 h-10 object-contain rounded-lg shadow-sm shrink-0"
  />
);

const Sidebar: React.FC<Props> = ({ activeView, onChangeView, userRole = 'Manager' }) => {
  // Track which groups are expanded
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    dashboard: true,
    daily: true,
    client: false,
    finance: false,
    team: false,
    settings: false,
  });

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  // Check if any item in a group is active
  const isGroupActive = (items: MenuItem[]) => {
    return items.some(item => item.id === activeView);
  };

  // Menu structure with groups - OPTIMIZED: Reduced duplication
  const menuGroups: MenuGroup[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      defaultOpen: true,
      items: [
        { id: 'smart-dashboard', label: 'Dashboard หลัก', icon: LayoutDashboard },
        { id: 'ceo-dashboard', label: 'CEO Command Center', icon: Crown },
      ]
    },
    {
      id: 'daily',
      label: 'งานประจำวัน',
      icon: ClipboardList,
      defaultOpen: true,
      items: [
        { id: 'workplace', label: 'งานของฉัน', icon: Briefcase },
        { id: 'task-board', label: 'บอร์ดงาน (Kanban)', icon: FolderKanban },
        { id: 'task-timeline', label: 'Timeline (Gantt)', icon: GitBranch },
        { id: 'documents', label: 'ทะเบียนเอกสาร', icon: FileText },
        { id: 'reconciliation', label: 'กระทบยอดธนาคาร', icon: Scale },
      ]
    },
    {
      id: 'data',
      label: 'ลูกค้า & ข้อมูล',
      icon: Building,
      items: [
        { id: 'clients', label: 'ทะเบียนลูกค้า', icon: Building },
        { id: 'master-data', label: 'ข้อมูลหลัก', icon: Database },
        { id: 'sales-import', label: 'นำเข้ายอดขาย', icon: FileSpreadsheet, badge: 'NEW' },
        { id: 'ecommerce-sync', label: 'เชื่อม E-Commerce', icon: ShoppingCart },
      ]
    },
    {
      id: 'finance',
      label: 'การเงิน & ภาษี',
      icon: DollarSign,
      items: [
        { id: 'tax-calendar', label: 'ปฏิทินภาษี', icon: Calendar },
        { id: 'efiling', label: 'ยื่นภาษี e-Filing', icon: Send },
        { id: 'wht-certificates', label: 'ใบ 50 ทวิ (WHT)', icon: FileText },
        { id: 'vat-returns', label: 'ภ.พ.30 (VAT)', icon: FileText },
        { id: 'reports', label: 'รายงานภาษี & ปิดงบ', icon: PieChart },
        { id: 'payroll', label: 'เงินเดือน', icon: DollarSign },
        { id: 'cash-flow', label: 'งบกระแสเงินสด', icon: RefreshCw },
      ]
    },
    {
      id: 'team',
      label: 'ทีมงาน',
      icon: UsersRound,
      items: [
        { id: 'staff', label: 'จัดการทีมงาน', icon: Users },
        { id: 'workload', label: 'Workload Dashboard', icon: BarChart3 },
        { id: 'notifications', label: 'การแจ้งเตือน', icon: Bell },
      ]
    },
    {
      id: 'automation',
      label: 'อัตโนมัติ & AI',
      icon: Zap,
      items: [
        { id: 'accounting-workflow', label: 'Workflow บัญชี', icon: Zap },
        { id: 'recurring-tasks', label: 'งานประจำอัตโนมัติ', icon: RefreshCw },
        { id: 'automation', label: 'ตั้งค่า Automation', icon: Settings },
        { id: 'ai-agents', label: 'AI Agents', icon: Bot, badge: 'BETA' },
      ]
    },
  ];

  // Filter menu groups based on role
  const filteredGroups = menuGroups.filter(group => {
    if (userRole === 'Junior Accountant' && group.id === 'settings') {
      return false;
    }
    return true;
  });

  return (
    <div className="w-64 bg-white flex flex-col h-full border-r border-slate-100 font-inter shadow-[4px_0_24px_-12px_rgba(0,0,0,0.05)] z-20">
      {/* Header Logo */}
      <div className="h-20 flex items-center gap-4 px-6 border-b border-slate-50">
        <WeLogo />
        <div className="flex flex-col justify-center">
          <span className="font-bold text-lg text-slate-800 tracking-tight leading-none">WE</span>
          <span className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase mt-1">Accounting AI</span>
        </div>
      </div>

      {/* Main Actions */}
      <div className="p-4 space-y-2">
        <button
          onClick={() => onChangeView('upload')}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-200 hover:shadow-lg hover:shadow-blue-300 transform hover:-translate-y-0.5"
        >
          <PlusCircle size={18} />
          <span className="text-sm font-semibold">อัปโหลดเอกสาร</span>
        </button>
        <button
          onClick={() => onChangeView('manual-jv')}
          className="w-full bg-white hover:bg-slate-50 text-slate-600 font-medium py-2 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors border border-slate-200 hover:border-slate-300 shadow-sm"
        >
          <FilePlus size={16} />
          <span className="text-sm">บันทึก JV ทั่วไป</span>
        </button>
      </div>

      {/* Navigation - Collapsible Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <nav className="space-y-1">
          {filteredGroups.map((group) => {
            const GroupIcon = group.icon;
            const isExpanded = expandedGroups[group.id];
            const hasActiveItem = isGroupActive(group.items);

            return (
              <div key={group.id} className="mb-1">
                {/* Group Header */}
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all ${hasActiveItem
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <GroupIcon size={18} className={hasActiveItem ? 'text-blue-600' : 'text-slate-400'} />
                    <span className="text-sm font-medium">{group.label}</span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown size={16} className="text-slate-400" />
                  ) : (
                    <ChevronRight size={16} className="text-slate-400" />
                  )}
                </button>

                {/* Group Items */}
                {isExpanded && (
                  <div className="mt-1 ml-3 pl-3 border-l-2 border-slate-100 space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeView === item.id;

                      return (
                        <button
                          key={item.id}
                          onClick={() => onChangeView(item.id)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all group ${isActive
                            ? 'bg-blue-100 text-blue-700 font-medium'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                            }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon size={16} className={isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-500'} />
                            <span className="text-sm">{item.label}</span>
                          </div>
                          {item.badge && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.badge === 'NEW'
                              ? 'bg-green-100 text-green-600'
                              : 'bg-purple-100 text-purple-600'
                              }`}>
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-50 space-y-2">
        <button
          onClick={() => onChangeView('client-portal')}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-600 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200"
        >
          <Globe size={16} />
          <span>Client Portal</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;

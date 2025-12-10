import React from 'react';
import { LayoutDashboard, FileText, Users, Settings, PlusCircle, PieChart, Building, FilePlus, BarChart3, ChevronRight, Scale, Briefcase, Globe } from 'lucide-react';

interface Props {
  activeView: string;
  onChangeView: (view: string) => void;
}

const WeLogo = () => (
  <svg width="40" height="30" viewBox="0 0 50 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
    <path d="M10 25L18 17" stroke="#3B82F6" strokeWidth="8" strokeLinecap="round"/>
    <path d="M18 17L28 27" stroke="#22D3EE" strokeWidth="8" strokeLinecap="round"/>
    <path d="M28 27L42 5" stroke="#3B82F6" strokeWidth="8" strokeLinecap="round"/>
  </svg>
);

const Sidebar: React.FC<Props> = ({ activeView, onChangeView }) => {
  const menuItems = [
    { id: 'dashboard', label: 'ภาพรวมผู้บริหาร', subLabel: 'CEO Dashboard', icon: LayoutDashboard },
    { id: 'command-center', label: 'ศูนย์ควบคุมงาน', subLabel: 'Command Center', icon: BarChart3 },
    { id: 'workplace', label: 'งานของฉัน', subLabel: 'My Workplace', icon: Briefcase }, // Updated Label
    { id: 'documents', label: 'ทะเบียนเอกสาร', subLabel: 'Documents', icon: FileText },
    { id: 'reconciliation', label: 'กระทบยอดธนาคาร', subLabel: 'Bank Recon', icon: Scale },
    { id: 'clients', label: 'ทะเบียนลูกค้า', subLabel: 'Clients', icon: Building },
    { id: 'reports', label: 'รายงานภาษี & ปิดงบ', subLabel: 'Tax Reports', icon: PieChart },
    { id: 'staff', label: 'ทีมงาน', subLabel: 'Staff', icon: Users },
  ];

  return (
    <div className="w-64 bg-white flex flex-col h-full border-r border-slate-100 font-inter shadow-[4px_0_24px_-12px_rgba(0,0,0,0.05)] z-20">
      {/* Header Logo */}
      <div className="h-24 flex items-center gap-4 px-6 border-b border-slate-50">
        <WeLogo />
        <div className="flex flex-col justify-center">
          <span className="font-bold text-lg text-slate-800 tracking-tight leading-none">WE</span>
          <span className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase mt-1">Accounting AI</span>
        </div>
      </div>

      {/* Main Actions */}
      <div className="p-6 space-y-3">
        <button 
          onClick={() => onChangeView('upload')}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-200 hover:shadow-lg hover:shadow-blue-300 transform hover:-translate-y-0.5"
        >
          <PlusCircle size={20} />
          <span className="text-sm font-semibold">อัปโหลดเอกสาร</span>
        </button>
         <button 
          onClick={() => onChangeView('manual-jv')}
          className="w-full bg-white hover:bg-slate-50 text-slate-600 font-medium py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors border border-slate-200 hover:border-slate-300 shadow-sm"
        >
          <FilePlus size={18} />
          <span className="text-sm">บันทึก JV ทั่วไป</span>
        </button>
      </div>

      {/* Navigation */}
      <div className="px-4 py-2">
        <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">เมนูหลัก (Main Menu)</p>
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeView(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all group relative overflow-hidden ${
                  isActive 
                    ? 'bg-blue-50 text-blue-700 font-semibold' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r-full"></div>}
                <div className="flex items-center gap-3">
                  <Icon size={20} className={isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'} />
                  <div className="text-left">
                    <span className="block text-sm">{item.label}</span>
                  </div>
                </div>
                {isActive && <ChevronRight size={16} className="text-blue-400" />}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-6 border-t border-slate-50 space-y-2">
        <button 
            onClick={() => onChangeView('client-portal')}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-600 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200"
        >
          <Globe size={18} />
          <span>Client Portal (Demo)</span>
        </button>
        <button className="w-full flex items-center gap-3 px-2 py-2 text-sm text-slate-500 hover:text-slate-800 transition-colors">
          <Settings size={20} />
          <span>ตั้งค่าระบบ (Settings)</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
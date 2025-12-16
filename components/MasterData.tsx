import React, { useState, useMemo } from 'react';
import {
  Building2, Plus, Search, Edit2, Trash2, Save, X, Users, CheckCircle,
  AlertTriangle, FileText, Phone, Mail, MapPin, CreditCard, ChevronDown,
  ChevronUp, Shield, DollarSign, UserCheck, Clock, Filter, Download
} from 'lucide-react';
import { Client } from '../types';

interface Props {
  clients: Client[];
}

// Vendor/Supplier Type
export interface Vendor {
  id: string;
  clientId: string;
  code: string;
  name: string;
  nameEn?: string;
  taxId: string;
  branch?: string;
  address: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  vendorType: 'supplier' | 'service' | 'contractor' | 'other';
  paymentTerms: number; // Days
  whtRate: number; // Default WHT rate
  bankName?: string;
  bankAccount?: string;
  creditLimit?: number;
  status: 'active' | 'inactive' | 'blacklisted';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Approval Authority
export interface ApprovalAuthority {
  id: string;
  clientId: string;
  staffId: string;
  staffName: string;
  role: string;
  approvalLevel: number; // 1 = lowest, higher = more authority
  minAmount: number;
  maxAmount: number;
  documentTypes: string[];
  canApproveOverBudget: boolean;
  canApproveEmergency: boolean;
  status: 'active' | 'inactive';
}

// Mock Data
const generateMockVendors = (clientId: string): Vendor[] => [
  {
    id: `V-001-${clientId}`,
    clientId,
    code: 'V001',
    name: 'บริษัท ซัพพลายเออร์ไทย จำกัด',
    nameEn: 'Thai Supplier Co., Ltd.',
    taxId: '0105551234567',
    branch: 'สำนักงานใหญ่',
    address: '123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110',
    phone: '02-123-4567',
    email: 'contact@thaisupplier.co.th',
    contactPerson: 'คุณสมชาย',
    vendorType: 'supplier',
    paymentTerms: 30,
    whtRate: 3,
    bankName: 'ธนาคารกสิกรไทย',
    bankAccount: '123-4-56789-0',
    creditLimit: 500000,
    status: 'active',
    createdAt: '2023-01-15',
    updatedAt: '2024-06-01',
  },
  {
    id: `V-002-${clientId}`,
    clientId,
    code: 'V002',
    name: 'บริษัท บริการดี จำกัด',
    nameEn: 'Good Service Co., Ltd.',
    taxId: '0105559876543',
    address: '456 ถนนพระราม 4 แขวงคลองตัน เขตคลองเตย กรุงเทพฯ 10110',
    phone: '02-987-6543',
    email: 'service@goodservice.co.th',
    contactPerson: 'คุณสมหญิง',
    vendorType: 'service',
    paymentTerms: 15,
    whtRate: 3,
    bankName: 'ธนาคารไทยพาณิชย์',
    bankAccount: '987-6-54321-0',
    status: 'active',
    createdAt: '2023-03-20',
    updatedAt: '2024-05-15',
  },
  {
    id: `V-003-${clientId}`,
    clientId,
    code: 'V003',
    name: 'บริษัท ก่อสร้างมั่นคง จำกัด',
    taxId: '0105557777777',
    address: '789 ถนนรัชดาภิเษก แขวงดินแดง เขตดินแดง กรุงเทพฯ 10400',
    phone: '02-777-7777',
    contactPerson: 'คุณวิชัย',
    vendorType: 'contractor',
    paymentTerms: 45,
    whtRate: 3,
    creditLimit: 2000000,
    status: 'active',
    createdAt: '2022-06-10',
    updatedAt: '2024-04-20',
  },
];

const generateMockAuthorities = (clientId: string): ApprovalAuthority[] => [
  {
    id: `AUTH-001-${clientId}`,
    clientId,
    staffId: 'S001',
    staffName: 'คุณสมศักดิ์ ผู้จัดการ',
    role: 'Manager',
    approvalLevel: 3,
    minAmount: 100001,
    maxAmount: 1000000,
    documentTypes: ['PO', 'PR', 'Payment', 'JV'],
    canApproveOverBudget: true,
    canApproveEmergency: true,
    status: 'active',
  },
  {
    id: `AUTH-002-${clientId}`,
    clientId,
    staffId: 'S002',
    staffName: 'คุณสมหญิง หัวหน้าบัญชี',
    role: 'Senior Accountant',
    approvalLevel: 2,
    minAmount: 10001,
    maxAmount: 100000,
    documentTypes: ['PO', 'PR', 'Payment'],
    canApproveOverBudget: false,
    canApproveEmergency: true,
    status: 'active',
  },
  {
    id: `AUTH-003-${clientId}`,
    clientId,
    staffId: 'S003',
    staffName: 'คุณวิชัย พนักงานบัญชี',
    role: 'Junior Accountant',
    approvalLevel: 1,
    minAmount: 0,
    maxAmount: 10000,
    documentTypes: ['PR'],
    canApproveOverBudget: false,
    canApproveEmergency: false,
    status: 'active',
  },
  {
    id: `AUTH-004-${clientId}`,
    clientId,
    staffId: 'S004',
    staffName: 'คุณประธาน กรรมการผู้จัดการ',
    role: 'CEO',
    approvalLevel: 4,
    minAmount: 1000001,
    maxAmount: 999999999,
    documentTypes: ['PO', 'PR', 'Payment', 'JV', 'Contract'],
    canApproveOverBudget: true,
    canApproveEmergency: true,
    status: 'active',
  },
];

const MasterData: React.FC<Props> = ({ clients }) => {
  // State
  const [activeTab, setActiveTab] = useState<'vendors' | 'authorities'>('vendors');
  const [selectedClientId, setSelectedClientId] = useState<string>(clients[0]?.id || '');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [authorities, setAuthorities] = useState<ApprovalAuthority[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Vendor | ApprovalAuthority | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Load mock data
  React.useEffect(() => {
    if (selectedClientId) {
      setVendors(generateMockVendors(selectedClientId));
      setAuthorities(generateMockAuthorities(selectedClientId));
    }
  }, [selectedClientId]);

  // Filter vendors
  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      const matchSearch =
        v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.taxId.includes(searchTerm);
      const matchStatus = filterStatus === 'all' || v.status === filterStatus;
      const matchType = filterType === 'all' || v.vendorType === filterType;
      return matchSearch && matchStatus && matchType;
    });
  }, [vendors, searchTerm, filterStatus, filterType]);

  // Filter authorities
  const filteredAuthorities = useMemo(() => {
    return authorities.filter(a => {
      const matchSearch =
        a.staffName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.role.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = filterStatus === 'all' || a.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [authorities, searchTerm, filterStatus]);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Vendor Actions
  const handleSaveVendor = (vendor: Vendor) => {
    if (editingItem) {
      setVendors(prev => prev.map(v => v.id === vendor.id ? vendor : v));
    } else {
      const newVendor = {
        ...vendor,
        id: `V-${Date.now()}`,
        clientId: selectedClientId,
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
      };
      setVendors(prev => [...prev, newVendor]);
    }
    setShowModal(false);
    setEditingItem(null);
    showNotification('บันทึกข้อมูลผู้ขายสำเร็จ', 'success');
  };

  const handleDeleteVendor = (id: string) => {
    if (window.confirm('ต้องการลบผู้ขายนี้ใช่หรือไม่?')) {
      setVendors(prev => prev.filter(v => v.id !== id));
      showNotification('ลบผู้ขายสำเร็จ', 'success');
    }
  };

  // Authority Actions
  const handleSaveAuthority = (auth: ApprovalAuthority) => {
    if (editingItem) {
      setAuthorities(prev => prev.map(a => a.id === auth.id ? auth : a));
    } else {
      const newAuth = {
        ...auth,
        id: `AUTH-${Date.now()}`,
        clientId: selectedClientId,
      };
      setAuthorities(prev => [...prev, newAuth]);
    }
    setShowModal(false);
    setEditingItem(null);
    showNotification('บันทึกข้อมูลอำนาจอนุมัติสำเร็จ', 'success');
  };

  const handleDeleteAuthority = (id: string) => {
    if (window.confirm('ต้องการลบข้อมูลอำนาจอนุมัตินี้ใช่หรือไม่?')) {
      setAuthorities(prev => prev.filter(a => a.id !== id));
      showNotification('ลบข้อมูลอำนาจอนุมัติสำเร็จ', 'success');
    }
  };

  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString('th-TH', { minimumFractionDigits: 0 });
  };

  const getVendorTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      supplier: 'ซัพพลายเออร์',
      service: 'ผู้ให้บริการ',
      contractor: 'ผู้รับเหมา',
      other: 'อื่นๆ',
    };
    return labels[type] || type;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active': return 'bg-emerald-100 text-emerald-700';
      case 'inactive': return 'bg-slate-100 text-slate-600';
      case 'blacklisted': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="animate-in fade-in duration-500 p-6">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-xl shadow-lg border flex items-center gap-3 animate-in slide-in-from-top-4 ${notification.type === 'success' ? 'bg-white border-emerald-100 text-emerald-700' : 'bg-white border-red-100 text-red-700'
          }`}>
          {notification.type === 'success' ? <CheckCircle size={20} className="text-emerald-500" /> : <AlertTriangle size={20} className="text-red-500" />}
          <span className="font-semibold text-sm">{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <Building2 className="text-blue-600" />
            Master Data Management
          </h2>
          <p className="text-slate-500 mt-1">จัดการข้อมูลหลัก - ทะเบียนผู้ขาย และตารางอำนาจอนุมัติ</p>
        </div>

        {/* Client Selector */}
        <div className="flex items-center gap-2">
          <Building2 size={18} className="text-slate-400" />
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {clients.map(client => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
        {[
          { id: 'vendors', label: 'ทะเบียนผู้ขาย', icon: Building2 },
          { id: 'authorities', label: 'ตารางอำนาจอนุมัติ', icon: Shield },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id as any); setSearchTerm(''); setFilterStatus('all'); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
              }`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Vendors Tab */}
      {activeTab === 'vendors' && (
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative w-80">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาผู้ขาย..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">ประเภททั้งหมด</option>
                <option value="supplier">ซัพพลายเออร์</option>
                <option value="service">ผู้ให้บริการ</option>
                <option value="contractor">ผู้รับเหมา</option>
                <option value="other">อื่นๆ</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">สถานะทั้งหมด</option>
                <option value="active">ใช้งาน</option>
                <option value="inactive">ไม่ใช้งาน</option>
                <option value="blacklisted">ขึ้นบัญชีดำ</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const headers = ['รหัส', 'ชื่อ', 'เลขประจำตัว', 'ประเภท', 'เครดิต', 'วงเงิน', 'สถานะ'];
                  const rows = filteredVendors.map(v => [v.code, v.name, v.taxId, v.vendorType, v.paymentTerms, v.creditLimit || 0, v.status]);
                  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = 'vendors_export.csv';
                  link.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
              >
                <Download size={18} />
                Export
              </button>
              <button
                onClick={() => { setEditingItem(null); setShowModal(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                <Plus size={18} />
                เพิ่มผู้ขาย
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'ผู้ขายทั้งหมด', value: vendors.length, icon: Building2, color: 'blue' },
              { label: 'ใช้งาน', value: vendors.filter(v => v.status === 'active').length, icon: CheckCircle, color: 'emerald' },
              { label: 'วงเงินเครดิตรวม', value: vendors.reduce((sum, v) => sum + (v.creditLimit || 0), 0), icon: CreditCard, color: 'purple', prefix: '฿' },
              { label: 'ผู้ให้บริการ', value: vendors.filter(v => v.vendorType === 'service').length, icon: Users, color: 'amber' },
            ].map((stat, idx) => (
              <div key={idx} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500">{stat.label}</span>
                  <stat.icon size={18} className={`text-${stat.color}-500`} />
                </div>
                <p className="text-xl font-bold text-slate-800">
                  {stat.prefix}{typeof stat.value === 'number' && stat.value > 1000 ? formatCurrency(stat.value) : stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* Vendor List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">รหัส</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">ชื่อผู้ขาย</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">เลขประจำตัวผู้เสียภาษี</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">ประเภท</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">เครดิต (วัน)</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">วงเงิน</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">สถานะ</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVendors.map(vendor => (
                  <tr key={vendor.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono text-slate-600">{vendor.code}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{vendor.name}</p>
                        {vendor.contactPerson && (
                          <p className="text-xs text-slate-500">ติดต่อ: {vendor.contactPerson}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-600">{vendor.taxId}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                        {getVendorTypeLabel(vendor.vendorType)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-slate-600">{vendor.paymentTerms}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-slate-800">
                      {vendor.creditLimit ? `฿${formatCurrency(vendor.creditLimit)}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(vendor.status)}`}>
                        {vendor.status === 'active' ? 'ใช้งาน' : vendor.status === 'inactive' ? 'ไม่ใช้งาน' : 'ขึ้นบัญชีดำ'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => { setEditingItem(vendor); setShowModal(true); }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteVendor(vendor.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredVendors.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      <Building2 size={48} className="mx-auto mb-3 opacity-50" />
                      <p>ไม่พบข้อมูลผู้ขาย</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Authorities Tab */}
      {activeTab === 'authorities' && (
        <div className="space-y-4">
          {/* Search & Actions */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="relative w-80">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาผู้มีอำนาจอนุมัติ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">สถานะทั้งหมด</option>
                <option value="active">ใช้งาน</option>
                <option value="inactive">ไม่ใช้งาน</option>
              </select>
            </div>
            <button
              onClick={() => { setEditingItem(null); setShowModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <Plus size={18} />
              เพิ่มอำนาจอนุมัติ
            </button>
          </div>

          {/* Authority Matrix Visual */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Shield className="text-blue-600" />
              โครงสร้างอำนาจอนุมัติ (Approval Matrix)
            </h3>
            <div className="relative">
              {/* Levels */}
              <div className="space-y-4">
                {[4, 3, 2, 1].map(level => {
                  const levelAuthorities = filteredAuthorities.filter(a => a.approvalLevel === level);
                  return (
                    <div key={level} className="flex items-start gap-4">
                      <div className="w-24 shrink-0">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${level === 4 ? 'bg-purple-100 text-purple-700' :
                            level === 3 ? 'bg-blue-100 text-blue-700' :
                              level === 2 ? 'bg-emerald-100 text-emerald-700' :
                                'bg-slate-100 text-slate-600'
                          }`}>
                          L{level}
                        </span>
                      </div>
                      <div className="flex-1 flex flex-wrap gap-3">
                        {levelAuthorities.map(auth => (
                          <div key={auth.id} className={`p-3 rounded-xl border ${auth.status === 'active' ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-60'
                            }`}>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                                {auth.staffName.charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-slate-800">{auth.staffName}</p>
                                <p className="text-xs text-slate-500">{auth.role}</p>
                              </div>
                            </div>
                            <div className="text-xs text-slate-600">
                              <p>฿{formatCurrency(auth.minAmount)} - ฿{formatCurrency(auth.maxAmount)}</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {auth.documentTypes.map(type => (
                                  <span key={type} className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px]">{type}</span>
                                ))}
                              </div>
                            </div>
                            <div className="flex gap-1 mt-2">
                              <button
                                onClick={() => { setEditingItem(auth); setShowModal(true); }}
                                className="p-1 text-slate-400 hover:text-blue-600 rounded"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteAuthority(auth.id)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                        {levelAuthorities.length === 0 && (
                          <div className="text-sm text-slate-400 italic">ไม่มีผู้มีอำนาจในระดับนี้</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Authority Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">ผู้อนุมัติ</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">ตำแหน่ง</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">ระดับ</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">วงเงินต่ำสุด</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">วงเงินสูงสุด</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">ประเภทเอกสาร</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">สิทธิ์พิเศษ</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAuthorities.sort((a, b) => b.approvalLevel - a.approvalLevel).map(auth => (
                  <tr key={auth.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                          {auth.staffName.charAt(0)}
                        </div>
                        <span className="text-sm font-medium text-slate-800">{auth.staffName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{auth.role}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${auth.approvalLevel === 4 ? 'bg-purple-100 text-purple-700' :
                          auth.approvalLevel === 3 ? 'bg-blue-100 text-blue-700' :
                            auth.approvalLevel === 2 ? 'bg-emerald-100 text-emerald-700' :
                              'bg-slate-100 text-slate-600'
                        }`}>
                        {auth.approvalLevel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-slate-600">฿{formatCurrency(auth.minAmount)}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-slate-800">฿{formatCurrency(auth.maxAmount)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {auth.documentTypes.map(type => (
                          <span key={type} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{type}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-1">
                        {auth.canApproveOverBudget && (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px]" title="อนุมัติเกินงบได้">เกินงบ</span>
                        )}
                        {auth.canApproveEmergency && (
                          <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px]" title="อนุมัติฉุกเฉินได้">ฉุกเฉิน</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${auth.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                        {auth.status === 'active' ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        activeTab === 'vendors' ? (
          <VendorModal
            vendor={editingItem as Vendor | null}
            onSave={handleSaveVendor}
            onClose={() => { setShowModal(false); setEditingItem(null); }}
          />
        ) : (
          <AuthorityModal
            authority={editingItem as ApprovalAuthority | null}
            onSave={handleSaveAuthority}
            onClose={() => { setShowModal(false); setEditingItem(null); }}
          />
        )
      )}
    </div>
  );
};

// Vendor Modal
interface VendorModalProps {
  vendor: Vendor | null;
  onSave: (vendor: Vendor) => void;
  onClose: () => void;
}

const VendorModal: React.FC<VendorModalProps> = ({ vendor, onSave, onClose }) => {
  const [formData, setFormData] = useState<Partial<Vendor>>(
    vendor || {
      code: '',
      name: '',
      taxId: '',
      address: '',
      vendorType: 'supplier',
      paymentTerms: 30,
      whtRate: 3,
      status: 'active',
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as Vendor);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">
            {vendor ? 'แก้ไขข้อมูลผู้ขาย' : 'เพิ่มผู้ขายใหม่'}
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3">ข้อมูลพื้นฐาน</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">รหัสผู้ขาย*</label>
                <input
                  type="text"
                  value={formData.code || ''}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">ประเภท</label>
                <select
                  value={formData.vendorType || 'supplier'}
                  onChange={(e) => setFormData({ ...formData, vendorType: e.target.value as any })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="supplier">ซัพพลายเออร์</option>
                  <option value="service">ผู้ให้บริการ</option>
                  <option value="contractor">ผู้รับเหมา</option>
                  <option value="other">อื่นๆ</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm text-slate-600 mb-1">ชื่อผู้ขาย (ไทย)*</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">เลขประจำตัวผู้เสียภาษี*</label>
                <input
                  type="text"
                  value={formData.taxId || ''}
                  onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">สาขา</label>
                <input
                  type="text"
                  value={formData.branch || ''}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="สำนักงานใหญ่"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm text-slate-600 mb-1">ที่อยู่*</label>
                <textarea
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  rows={2}
                  required
                />
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3">ข้อมูลติดต่อ</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">ผู้ติดต่อ</label>
                <input
                  type="text"
                  value={formData.contactPerson || ''}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">โทรศัพท์</label>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm text-slate-600 mb-1">อีเมล</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Payment Info */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3">ข้อมูลการชำระเงิน</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">เครดิต (วัน)</label>
                <input
                  type="number"
                  value={formData.paymentTerms || 30}
                  onChange={(e) => setFormData({ ...formData, paymentTerms: Number(e.target.value) })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">WHT Rate (%)</label>
                <input
                  type="number"
                  value={formData.whtRate || 3}
                  onChange={(e) => setFormData({ ...formData, whtRate: Number(e.target.value) })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">วงเงินเครดิต</label>
                <input
                  type="number"
                  value={formData.creditLimit || ''}
                  onChange={(e) => setFormData({ ...formData, creditLimit: Number(e.target.value) || undefined })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">ธนาคาร</label>
                <select
                  value={formData.bankName || ''}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">เลือกธนาคาร</option>
                  <option value="ธนาคารกสิกรไทย">ธนาคารกสิกรไทย</option>
                  <option value="ธนาคารไทยพาณิชย์">ธนาคารไทยพาณิชย์</option>
                  <option value="ธนาคารกรุงเทพ">ธนาคารกรุงเทพ</option>
                  <option value="ธนาคารกรุงไทย">ธนาคารกรุงไทย</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">เลขบัญชี</label>
                <input
                  type="text"
                  value={formData.bankAccount || ''}
                  onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">สถานะ</label>
                <select
                  value={formData.status || 'active'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="active">ใช้งาน</option>
                  <option value="inactive">ไม่ใช้งาน</option>
                  <option value="blacklisted">ขึ้นบัญชีดำ</option>
                </select>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">
              ยกเลิก
            </button>
            <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Save size={18} />
              บันทึก
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Authority Modal
interface AuthorityModalProps {
  authority: ApprovalAuthority | null;
  onSave: (auth: ApprovalAuthority) => void;
  onClose: () => void;
}

const AuthorityModal: React.FC<AuthorityModalProps> = ({ authority, onSave, onClose }) => {
  const [formData, setFormData] = useState<Partial<ApprovalAuthority>>(
    authority || {
      staffId: '',
      staffName: '',
      role: '',
      approvalLevel: 1,
      minAmount: 0,
      maxAmount: 100000,
      documentTypes: ['PO', 'PR'],
      canApproveOverBudget: false,
      canApproveEmergency: false,
      status: 'active',
    }
  );

  const docTypes = ['PO', 'PR', 'Payment', 'JV', 'Contract'];

  const toggleDocType = (type: string) => {
    const current = formData.documentTypes || [];
    if (current.includes(type)) {
      setFormData({ ...formData, documentTypes: current.filter(t => t !== type) });
    } else {
      setFormData({ ...formData, documentTypes: [...current, type] });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as ApprovalAuthority);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">
            {authority ? 'แก้ไขอำนาจอนุมัติ' : 'เพิ่มอำนาจอนุมัติใหม่'}
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm text-slate-600 mb-1">ชื่อผู้อนุมัติ*</label>
              <input
                type="text"
                value={formData.staffName || ''}
                onChange={(e) => setFormData({ ...formData, staffName: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">ตำแหน่ง*</label>
              <input
                type="text"
                value={formData.role || ''}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">ระดับอำนาจ</label>
              <select
                value={formData.approvalLevel || 1}
                onChange={(e) => setFormData({ ...formData, approvalLevel: Number(e.target.value) })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value={1}>Level 1 - พนักงาน</option>
                <option value={2}>Level 2 - หัวหน้างาน</option>
                <option value={3}>Level 3 - ผู้จัดการ</option>
                <option value={4}>Level 4 - ผู้บริหาร</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">วงเงินต่ำสุด</label>
              <input
                type="number"
                value={formData.minAmount || 0}
                onChange={(e) => setFormData({ ...formData, minAmount: Number(e.target.value) })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">วงเงินสูงสุด</label>
              <input
                type="number"
                value={formData.maxAmount || 100000}
                onChange={(e) => setFormData({ ...formData, maxAmount: Number(e.target.value) })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-2">ประเภทเอกสารที่อนุมัติได้</label>
            <div className="flex flex-wrap gap-2">
              {docTypes.map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleDocType(type)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${formData.documentTypes?.includes(type)
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                    }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.canApproveOverBudget || false}
                onChange={(e) => setFormData({ ...formData, canApproveOverBudget: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">สามารถอนุมัติเกินงบประมาณได้</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.canApproveEmergency || false}
                onChange={(e) => setFormData({ ...formData, canApproveEmergency: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">สามารถอนุมัติกรณีฉุกเฉินได้</span>
            </label>
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-1">สถานะ</label>
            <select
              value={formData.status || 'active'}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="active">ใช้งาน</option>
              <option value="inactive">ไม่ใช้งาน</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">
              ยกเลิก
            </button>
            <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Save size={18} />
              บันทึก
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MasterData;

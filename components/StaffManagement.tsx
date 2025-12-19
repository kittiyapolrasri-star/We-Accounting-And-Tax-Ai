import React, { useState } from 'react';
import { Staff } from '../types';
import { Mail, Briefcase, CheckCircle2, Users, Plus, X, User, Phone, Shield, Save, Loader2 } from 'lucide-react';

interface Props {
  staff: Staff[];
  onAddStaff?: (staffData: Omit<Staff, 'id'>) => void;
  onAssignWork?: (staffId: string) => void;
  onViewHistory?: (staffId: string) => void;
}

// Simple Add Staff Modal
const AddStaffModal: React.FC<{ onClose: () => void; onSubmit: (data: any) => void }> = ({ onClose, onSubmit }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'Junior Accountant',
    first_name: '',
    last_name: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Auto-update name when first/last name changes
    if (name === 'first_name' || name === 'last_name') {
      const firstName = name === 'first_name' ? value : formData.first_name;
      const lastName = name === 'last_name' ? value : formData.last_name;
      setFormData(prev => ({ ...prev, [name]: value, name: `${firstName} ${lastName}`.trim() }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;

    setLoading(true);
    try {
      await onSubmit({
        ...formData,
        active_tasks: 0,
        assigned_clients: []
      });
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <User size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">เพิ่มพนักงานใหม่</h3>
              <p className="text-xs text-slate-500">กรอกข้อมูลพนักงานบัญชี</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อ <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="ชื่อ"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">นามสกุล <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="นามสกุล"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">อีเมล <span className="text-red-500">*</span></label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="email@company.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">เบอร์โทรศัพท์</label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="08x-xxx-xxxx"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ตำแหน่ง</label>
            <div className="relative">
              <Shield className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none"
              >
                <option value="Junior Accountant">Junior Accountant</option>
                <option value="Senior Accountant">Senior Accountant</option>
                <option value="Manager">Manager</option>
                <option value="Partner">Partner</option>
              </select>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-medium rounded-lg transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm shadow-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {loading ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const StaffManagement: React.FC<Props> = ({ staff, onAddStaff, onAssignWork, onViewHistory }) => {
  const [showAddModal, setShowAddModal] = useState(false);

  const handleAddStaff = async (data: any) => {
    if (onAddStaff) {
      await onAddStaff(data);
    } else {
      console.log('Add staff handler not provided, data:', data);
    }
    setShowAddModal(false);
  };

  const handleViewHistory = (staffId: string) => {
    if (onViewHistory) {
      onViewHistory(staffId);
    } else {
      console.log('View history handler not provided for staff:', staffId);
    }
  };

  const handleAssignWork = (staffId: string) => {
    if (onAssignWork) {
      onAssignWork(staffId);
    } else {
      console.log('Assign work handler not provided for staff:', staffId);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Add Staff Modal */}
      {showAddModal && (
        <AddStaffModal onClose={() => setShowAddModal(false)} onSubmit={handleAddStaff} />
      )}

      {/* Clean Minimal Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-100 rounded-xl">
              <Users size={24} className="text-slate-700" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">จัดการทีมงานและสิทธิ์</h1>
              <p className="text-sm text-slate-500">บริหารจัดการพนักงานบัญชีและการมอบหมายงาน</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 transition-colors"
          >
            <Plus size={16} />
            เพิ่มพนักงาน
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold text-slate-400 uppercase">จำนวนพนักงาน</p>
            <p className="text-2xl font-bold text-slate-800">{staff.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold text-slate-400 uppercase">กำลังทำงาน</p>
            <p className="text-2xl font-bold text-emerald-600">{staff.filter(s => s.active_tasks > 0).length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold text-slate-400 uppercase">งานทั้งหมด</p>
            <p className="text-2xl font-bold text-blue-600">{staff.reduce((sum, s) => sum + s.active_tasks, 0)}</p>
          </div>
        </div>

        {/* Staff Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {staff.map((member) => (
            <div key={member.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-lg">
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{member.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${member.role === 'Manager' ? 'bg-purple-100 text-purple-700' :
                      member.role === 'Senior Accountant' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                      {member.role}
                    </span>
                  </div>
                </div>
                {member.active_tasks > 0 && (
                  <span className="flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <Mail size={16} />
                  <span>{member.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <Briefcase size={16} />
                  <span>งานที่รับผิดชอบ: <span className="font-semibold text-slate-800">{member.active_tasks}</span></span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex gap-2">
                <button
                  onClick={() => handleViewHistory(member.id)}
                  className="flex-1 py-2 text-sm font-medium text-slate-600 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  ดูประวัติ
                </button>
                <button
                  onClick={() => handleAssignWork(member.id)}
                  className="flex-1 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  มอบหมายงาน
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {staff.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users size={32} className="text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">ยังไม่มีพนักงาน</h3>
            <p className="text-slate-500 mb-4">เริ่มต้นด้วยการเพิ่มพนักงานคนแรก</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900"
            >
              เพิ่มพนักงาน
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffManagement;
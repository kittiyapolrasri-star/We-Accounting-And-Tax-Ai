import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, Plus, Search, FileText, Calculator, DollarSign, Calendar,
  CheckCircle2, AlertCircle, Download, Printer, ChevronDown, ChevronUp,
  Edit2, Trash2, Save, X, Building, CreditCard, Briefcase, Clock,
  TrendingUp, UserPlus, FileSpreadsheet, Send, BookOpen, Filter
} from 'lucide-react';
import {
  Employee, SalaryStructure, PaySlip, calculatePaySlip, calculateSSO,
  formatThaiCurrency, PIT_BRACKETS, TAX_DEDUCTIONS, SSO_RATES
} from '../services/payroll';
import { PostedGLEntry, Client } from '../types';

interface Props {
  clients: Client[];
  onPostJournal: (entries: PostedGLEntry[]) => Promise<void>;
}

// Mock data for demo
const generateMockEmployees = (clientId: string): Employee[] => [
  {
    id: `EMP-001-${clientId}`,
    clientId,
    employeeCode: 'EMP001',
    titleTh: 'นาย',
    firstNameTh: 'สมชาย',
    lastNameTh: 'ใจดี',
    titleEn: 'Mr.',
    firstNameEn: 'Somchai',
    lastNameEn: 'Jaidee',
    nationalId: '1-1234-56789-01-2',
    taxId: '1234567890123',
    dateOfBirth: '1985-05-15',
    startDate: '2020-01-15',
    position: 'ผู้จัดการฝ่ายบัญชี',
    department: 'บัญชี',
    bankAccount: '123-4-56789-0',
    bankName: 'ธนาคารกสิกรไทย',
    status: 'active',
  },
  {
    id: `EMP-002-${clientId}`,
    clientId,
    employeeCode: 'EMP002',
    titleTh: 'นางสาว',
    firstNameTh: 'สมหญิง',
    lastNameTh: 'รักงาน',
    titleEn: 'Ms.',
    firstNameEn: 'Somying',
    lastNameEn: 'Rukngarn',
    nationalId: '1-9876-54321-01-3',
    taxId: '9876543210987',
    dateOfBirth: '1990-08-20',
    startDate: '2021-06-01',
    position: 'พนักงานบัญชี',
    department: 'บัญชี',
    bankAccount: '987-6-54321-0',
    bankName: 'ธนาคารไทยพาณิชย์',
    status: 'active',
  },
  {
    id: `EMP-003-${clientId}`,
    clientId,
    employeeCode: 'EMP003',
    titleTh: 'นาย',
    firstNameTh: 'วิชัย',
    lastNameTh: 'มานะ',
    titleEn: 'Mr.',
    firstNameEn: 'Wichai',
    lastNameEn: 'Mana',
    nationalId: '1-5555-55555-55-5',
    taxId: '5555555555555',
    dateOfBirth: '1988-03-10',
    startDate: '2019-02-01',
    position: 'ผู้จัดการฝ่ายขาย',
    department: 'ขาย',
    bankAccount: '555-5-55555-5',
    bankName: 'ธนาคารกรุงเทพ',
    status: 'active',
  },
];

const generateMockSalary = (employeeCode: string): SalaryStructure => {
  const salaries: Record<string, SalaryStructure> = {
    'EMP001': { baseSalary: 65000, positionAllowance: 10000, transportAllowance: 3000 },
    'EMP002': { baseSalary: 35000, positionAllowance: 0, transportAllowance: 2000 },
    'EMP003': { baseSalary: 55000, positionAllowance: 8000, transportAllowance: 3000, commission: 15000 },
  };
  return salaries[employeeCode] || { baseSalary: 25000 };
};

const PayrollManagement: React.FC<Props> = ({ clients, onPostJournal }) => {
  // State
  const [activeTab, setActiveTab] = useState<'employees' | 'payslips' | 'run'>('employees');
  const [selectedClientId, setSelectedClientId] = useState<string>(clients[0]?.id || '');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payslips, setPayslips] = useState<PaySlip[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [expandedPayslip, setExpandedPayslip] = useState<string | null>(null);
  const [salaryData, setSalaryData] = useState<Record<string, SalaryStructure>>({});

  // Load mock data
  useEffect(() => {
    if (selectedClientId) {
      const mockEmps = generateMockEmployees(selectedClientId);
      setEmployees(mockEmps);

      // Generate salary data
      const salaries: Record<string, SalaryStructure> = {};
      mockEmps.forEach(emp => {
        salaries[emp.id] = generateMockSalary(emp.employeeCode);
      });
      setSalaryData(salaries);
    }
  }, [selectedClientId]);

  // Filter employees
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const searchLower = searchTerm.toLowerCase();
      return (
        emp.employeeCode.toLowerCase().includes(searchLower) ||
        emp.firstNameTh.includes(searchTerm) ||
        emp.lastNameTh.includes(searchTerm) ||
        emp.position.includes(searchTerm) ||
        (emp.department && emp.department.includes(searchTerm))
      );
    });
  }, [employees, searchTerm]);

  // Filter payslips by period
  const filteredPayslips = useMemo(() => {
    const period = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    return payslips.filter(ps => ps.period === period);
  }, [payslips, selectedMonth, selectedYear]);

  // Show notification
  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Calculate summary stats
  const payrollSummary = useMemo(() => {
    if (filteredPayslips.length === 0) return null;

    return {
      totalEmployees: filteredPayslips.length,
      totalEarnings: filteredPayslips.reduce((sum, ps) => sum + ps.totalEarnings, 0),
      totalDeductions: filteredPayslips.reduce((sum, ps) => sum + ps.totalDeductions, 0),
      totalNetPay: filteredPayslips.reduce((sum, ps) => sum + ps.netPay, 0),
      totalWht: filteredPayslips.reduce((sum, ps) => sum + ps.wht, 0),
      totalSso: filteredPayslips.reduce((sum, ps) => sum + ps.deductions.sso, 0),
    };
  }, [filteredPayslips]);

  // Run payroll for all employees
  const handleRunPayroll = async () => {
    if (employees.length === 0) {
      showNotification('ไม่มีพนักงานในระบบ', 'error');
      return;
    }

    setIsProcessing(true);
    const period = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

    // Check if already run
    const existingPayslips = payslips.filter(ps => ps.period === period);
    if (existingPayslips.length > 0) {
      showNotification('ประมวลผลเงินเดือนงวดนี้แล้ว กรุณาเลือกงวดอื่น', 'error');
      setIsProcessing(false);
      return;
    }

    try {
      const newPayslips: PaySlip[] = [];

      for (const emp of employees.filter(e => e.status === 'active')) {
        const earnings = salaryData[emp.id] || { baseSalary: 25000 };

        // Get YTD data (mock for demo)
        const ytd = {
          earnings: (selectedMonth - 1) * (earnings.baseSalary || 25000),
          wht: 0,
          sso: (selectedMonth - 1) * Math.min(750, (earnings.baseSalary || 25000) * 0.05),
        };

        const payslipData = calculatePaySlip(
          emp,
          earnings,
          ytd,
          selectedMonth,
          3, // 3% provident fund
          TAX_DEDUCTIONS.PERSONAL_ALLOWANCE + TAX_DEDUCTIONS.EXPENSE_DEDUCTION_MAX
        );

        const payslip: PaySlip = {
          ...payslipData,
          id: `PS-${Date.now()}-${emp.id}`,
          status: 'draft',
          createdAt: new Date().toISOString(),
        };

        newPayslips.push(payslip);
      }

      setPayslips(prev => [...prev, ...newPayslips]);
      showNotification(`ประมวลผลเงินเดือน ${newPayslips.length} คน สำเร็จ`, 'success');
      setActiveTab('payslips');
    } catch (error) {
      console.error('Payroll processing error:', error);
      showNotification('เกิดข้อผิดพลาดในการประมวลผล', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Approve payslips and post to GL
  const handleApproveAndPost = async () => {
    const draftPayslips = filteredPayslips.filter(ps => ps.status === 'draft');
    if (draftPayslips.length === 0) {
      showNotification('ไม่มีรายการที่รออนุมัติ', 'error');
      return;
    }

    setIsProcessing(true);

    try {
      // Generate GL entries for payroll
      const glEntries: PostedGLEntry[] = [];
      const period = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
      const postDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${new Date(selectedYear, selectedMonth, 0).getDate()}`;

      // Summary amounts
      let totalSalary = 0;
      let totalAllowances = 0;
      let totalWht = 0;
      let totalSso = 0;
      let totalProvidentFund = 0;
      let totalNetPay = 0;

      draftPayslips.forEach(ps => {
        totalSalary += ps.earnings.baseSalary || 0;
        totalAllowances += (ps.earnings.positionAllowance || 0) +
                          (ps.earnings.housingAllowance || 0) +
                          (ps.earnings.transportAllowance || 0) +
                          (ps.earnings.mealAllowance || 0) +
                          (ps.earnings.otherAllowance || 0) +
                          (ps.earnings.commission || 0) +
                          (ps.earnings.bonus || 0) +
                          (ps.earnings.overtime || 0);
        totalWht += ps.wht;
        totalSso += ps.deductions.sso;
        totalProvidentFund += ps.deductions.providentFund || 0;
        totalNetPay += ps.netPay;
      });

      const employerSso = totalSso; // Employer matches employee contribution

      // Debit entries - Expenses
      if (totalSalary > 0) {
        glEntries.push({
          id: `GL-SAL-${Date.now()}-1`,
          clientId: selectedClientId,
          date: postDate,
          doc_no: `PAY-${period}`,
          description: `เงินเดือนพนักงาน ${period}`,
          account_code: '52100',
          account_name: 'เงินเดือนและค่าจ้าง',
          debit: totalSalary,
          credit: 0,
          system_generated: true,
        });
      }

      if (totalAllowances > 0) {
        glEntries.push({
          id: `GL-SAL-${Date.now()}-2`,
          clientId: selectedClientId,
          date: postDate,
          doc_no: `PAY-${period}`,
          description: `เบี้ยเลี้ยงและค่าตอบแทนอื่น ${period}`,
          account_code: '52200',
          account_name: 'เบี้ยเลี้ยงและสวัสดิการ',
          debit: totalAllowances,
          credit: 0,
          system_generated: true,
        });
      }

      // Employer SSO contribution
      if (employerSso > 0) {
        glEntries.push({
          id: `GL-SAL-${Date.now()}-3`,
          clientId: selectedClientId,
          date: postDate,
          doc_no: `PAY-${period}`,
          description: `ประกันสังคมส่วนนายจ้าง ${period}`,
          account_code: '52300',
          account_name: 'เงินสมทบประกันสังคม',
          debit: employerSso,
          credit: 0,
          system_generated: true,
        });
      }

      // Credit entries - Liabilities
      if (totalWht > 0) {
        glEntries.push({
          id: `GL-SAL-${Date.now()}-4`,
          clientId: selectedClientId,
          date: postDate,
          doc_no: `PAY-${period}`,
          description: `ภาษีหัก ณ ที่จ่ายค้างจ่าย ${period}`,
          account_code: '21300',
          account_name: 'ภาษีหัก ณ ที่จ่ายค้างจ่าย',
          debit: 0,
          credit: totalWht,
          system_generated: true,
        });
      }

      // SSO payable (both employee + employer)
      const totalSsoPayable = totalSso + employerSso;
      if (totalSsoPayable > 0) {
        glEntries.push({
          id: `GL-SAL-${Date.now()}-5`,
          clientId: selectedClientId,
          date: postDate,
          doc_no: `PAY-${period}`,
          description: `ประกันสังคมค้างจ่าย ${period}`,
          account_code: '21400',
          account_name: 'ประกันสังคมค้างจ่าย',
          debit: 0,
          credit: totalSsoPayable,
          system_generated: true,
        });
      }

      if (totalProvidentFund > 0) {
        glEntries.push({
          id: `GL-SAL-${Date.now()}-6`,
          clientId: selectedClientId,
          date: postDate,
          doc_no: `PAY-${period}`,
          description: `กองทุนสำรองเลี้ยงชีพค้างจ่าย ${period}`,
          account_code: '21500',
          account_name: 'กองทุนสำรองเลี้ยงชีพค้างจ่าย',
          debit: 0,
          credit: totalProvidentFund,
          system_generated: true,
        });
      }

      // Accrued payroll (net pay)
      if (totalNetPay > 0) {
        glEntries.push({
          id: `GL-SAL-${Date.now()}-7`,
          clientId: selectedClientId,
          date: postDate,
          doc_no: `PAY-${period}`,
          description: `เงินเดือนค้างจ่าย ${period}`,
          account_code: '21100',
          account_name: 'เงินเดือนค้างจ่าย',
          debit: 0,
          credit: totalNetPay,
          system_generated: true,
        });
      }

      // Post to GL
      await onPostJournal(glEntries);

      // Update payslip status
      setPayslips(prev => prev.map(ps =>
        draftPayslips.some(d => d.id === ps.id)
          ? { ...ps, status: 'approved', approvedAt: new Date().toISOString() }
          : ps
      ));

      showNotification(`อนุมัติและบันทึกบัญชี ${draftPayslips.length} รายการสำเร็จ`, 'success');
    } catch (error) {
      console.error('Approval error:', error);
      showNotification('เกิดข้อผิดพลาดในการอนุมัติ', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Add/Edit employee
  const handleSaveEmployee = (employee: Employee) => {
    if (editingEmployee) {
      setEmployees(prev => prev.map(e => e.id === employee.id ? employee : e));
    } else {
      const newEmployee = {
        ...employee,
        id: `EMP-${Date.now()}`,
        clientId: selectedClientId,
      };
      setEmployees(prev => [...prev, newEmployee]);
      setSalaryData(prev => ({
        ...prev,
        [newEmployee.id]: { baseSalary: 25000 }
      }));
    }
    setShowEmployeeModal(false);
    setEditingEmployee(null);
    showNotification('บันทึกข้อมูลพนักงานสำเร็จ', 'success');
  };

  // Delete employee
  const handleDeleteEmployee = (empId: string) => {
    if (window.confirm('ต้องการลบพนักงานนี้ใช่หรือไม่?')) {
      setEmployees(prev => prev.filter(e => e.id !== empId));
      showNotification('ลบพนักงานสำเร็จ', 'success');
    }
  };

  // Get employee name
  const getEmployeeName = (employeeId: string): string => {
    const emp = employees.find(e => e.id === employeeId);
    return emp ? `${emp.titleTh}${emp.firstNameTh} ${emp.lastNameTh}` : '-';
  };

  return (
    <div className="animate-in fade-in duration-500 p-6">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-xl shadow-lg border flex items-center gap-3 animate-in slide-in-from-top-4 ${
          notification.type === 'success' ? 'bg-white border-emerald-100 text-emerald-700' : 'bg-white border-red-100 text-red-700'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 size={20} className="text-emerald-500" /> : <AlertCircle size={20} className="text-red-500" />}
          <span className="font-semibold text-sm">{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <DollarSign className="text-blue-600" />
            ระบบเงินเดือน (Payroll Management)
          </h2>
          <p className="text-slate-500 mt-1">จัดการพนักงาน คำนวณเงินเดือน และบันทึกบัญชีอัตโนมัติ</p>
        </div>

        {/* Client Selector */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Building size={18} className="text-slate-400" />
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
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
        {[
          { id: 'employees', label: 'พนักงาน', icon: Users },
          { id: 'payslips', label: 'สลิปเงินเดือน', icon: FileText },
          { id: 'run', label: 'ประมวลผลเงินเดือน', icon: Calculator },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Employees Tab */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
          {/* Search & Actions */}
          <div className="flex justify-between items-center">
            <div className="relative w-80">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาพนักงาน..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => { setEditingEmployee(null); setShowEmployeeModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <UserPlus size={18} />
              เพิ่มพนักงาน
            </button>
          </div>

          {/* Employee List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">รหัส</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">ชื่อ-สกุล</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">ตำแหน่ง</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">แผนก</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">เงินเดือน</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">สถานะ</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono text-slate-600">{emp.employeeCode}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                          {emp.firstNameTh.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{emp.titleTh}{emp.firstNameTh} {emp.lastNameTh}</p>
                          <p className="text-xs text-slate-500">{emp.nationalId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{emp.position}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{emp.department || '-'}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 text-right">
                      ฿{formatThaiCurrency(salaryData[emp.id]?.baseSalary || 0)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        emp.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                        emp.status === 'resigned' ? 'bg-slate-100 text-slate-600' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {emp.status === 'active' ? 'ปฏิบัติงาน' : emp.status === 'resigned' ? 'ลาออก' : 'พักงาน'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => { setEditingEmployee(emp); setShowEmployeeModal(true); }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="แก้ไข"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(emp.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="ลบ"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredEmployees.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      <Users size={48} className="mx-auto mb-3 opacity-50" />
                      <p>ไม่พบข้อมูลพนักงาน</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payslips Tab */}
      {activeTab === 'payslips' && (
        <div className="space-y-4">
          {/* Period Selector & Actions */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Calendar size={18} className="text-slate-400" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(2024, i).toLocaleDateString('th-TH', { month: 'long' })}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[2024, 2025, 2026].map(year => (
                  <option key={year} value={year}>{year + 543}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              {filteredPayslips.some(ps => ps.status === 'draft') && (
                <button
                  onClick={handleApproveAndPost}
                  disabled={isProcessing}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  <BookOpen size={18} />
                  อนุมัติและบันทึกบัญชี
                </button>
              )}
              <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                <Download size={18} />
                Export Excel
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          {payrollSummary && (
            <div className="grid grid-cols-5 gap-4">
              {[
                { label: 'จำนวนพนักงาน', value: payrollSummary.totalEmployees, suffix: 'คน', icon: Users, color: 'blue' },
                { label: 'รายได้รวม', value: payrollSummary.totalEarnings, prefix: '฿', icon: TrendingUp, color: 'emerald' },
                { label: 'หักภาษี ณ ที่จ่าย', value: payrollSummary.totalWht, prefix: '฿', icon: FileText, color: 'amber' },
                { label: 'ประกันสังคม', value: payrollSummary.totalSso, prefix: '฿', icon: CreditCard, color: 'purple' },
                { label: 'เงินสุทธิ', value: payrollSummary.totalNetPay, prefix: '฿', icon: DollarSign, color: 'blue' },
              ].map((stat, idx) => (
                <div key={idx} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-500">{stat.label}</span>
                    <stat.icon size={18} className={`text-${stat.color}-500`} />
                  </div>
                  <p className="text-xl font-bold text-slate-800">
                    {stat.prefix}{typeof stat.value === 'number' && stat.value > 100 ? formatThaiCurrency(stat.value) : stat.value}{stat.suffix}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Payslips List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {filteredPayslips.length === 0 ? (
              <div className="px-4 py-12 text-center text-slate-400">
                <FileText size={48} className="mx-auto mb-3 opacity-50" />
                <p>ยังไม่มีสลิปเงินเดือนในงวดนี้</p>
                <p className="text-sm mt-1">กรุณาประมวลผลเงินเดือนก่อน</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredPayslips.map(ps => (
                  <div key={ps.id} className="hover:bg-slate-50 transition-colors">
                    {/* Summary Row */}
                    <div
                      className="px-4 py-3 flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedPayslip(expandedPayslip === ps.id ? null : ps.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                          {getEmployeeName(ps.employeeId).charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{getEmployeeName(ps.employeeId)}</p>
                          <p className="text-xs text-slate-500">งวด {ps.period}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-xs text-slate-500">รายได้</p>
                          <p className="font-medium text-slate-800">฿{formatThaiCurrency(ps.totalEarnings)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500">หัก</p>
                          <p className="font-medium text-red-600">-฿{formatThaiCurrency(ps.totalDeductions)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500">สุทธิ</p>
                          <p className="font-bold text-emerald-600">฿{formatThaiCurrency(ps.netPay)}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          ps.status === 'draft' ? 'bg-amber-100 text-amber-700' :
                          ps.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {ps.status === 'draft' ? 'รอตรวจ' : ps.status === 'approved' ? 'อนุมัติแล้ว' : 'จ่ายแล้ว'}
                        </span>
                        {expandedPayslip === ps.id ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedPayslip === ps.id && (
                      <div className="px-4 py-4 bg-slate-50 border-t border-slate-200">
                        <div className="grid grid-cols-2 gap-8">
                          {/* Earnings */}
                          <div>
                            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                              <TrendingUp size={16} className="text-emerald-500" />
                              รายได้
                            </h4>
                            <div className="space-y-2">
                              {ps.earnings.baseSalary && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-600">เงินเดือน</span>
                                  <span className="font-medium">฿{formatThaiCurrency(ps.earnings.baseSalary)}</span>
                                </div>
                              )}
                              {ps.earnings.positionAllowance && ps.earnings.positionAllowance > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-600">ค่าตำแหน่ง</span>
                                  <span className="font-medium">฿{formatThaiCurrency(ps.earnings.positionAllowance)}</span>
                                </div>
                              )}
                              {ps.earnings.transportAllowance && ps.earnings.transportAllowance > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-600">ค่าเดินทาง</span>
                                  <span className="font-medium">฿{formatThaiCurrency(ps.earnings.transportAllowance)}</span>
                                </div>
                              )}
                              {ps.earnings.commission && ps.earnings.commission > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-600">ค่าคอมมิชชั่น</span>
                                  <span className="font-medium">฿{formatThaiCurrency(ps.earnings.commission)}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-sm font-semibold pt-2 border-t border-slate-200">
                                <span className="text-slate-800">รวมรายได้</span>
                                <span className="text-emerald-600">฿{formatThaiCurrency(ps.totalEarnings)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Deductions */}
                          <div>
                            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                              <FileText size={16} className="text-red-500" />
                              รายการหัก
                            </h4>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-600">ประกันสังคม</span>
                                <span className="font-medium text-red-600">-฿{formatThaiCurrency(ps.deductions.sso)}</span>
                              </div>
                              {ps.deductions.providentFund && ps.deductions.providentFund > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-600">กองทุนสำรองเลี้ยงชีพ</span>
                                  <span className="font-medium text-red-600">-฿{formatThaiCurrency(ps.deductions.providentFund)}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-600">ภาษีหัก ณ ที่จ่าย</span>
                                <span className="font-medium text-red-600">-฿{formatThaiCurrency(ps.wht)}</span>
                              </div>
                              <div className="flex justify-between text-sm font-semibold pt-2 border-t border-slate-200">
                                <span className="text-slate-800">รวมหัก</span>
                                <span className="text-red-600">-฿{formatThaiCurrency(ps.totalDeductions)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* YTD Info */}
                        <div className="mt-4 pt-4 border-t border-slate-200">
                          <h4 className="text-sm font-semibold text-slate-700 mb-2">ข้อมูลสะสมตั้งแต่ต้นปี (YTD)</h4>
                          <div className="flex gap-6 text-sm">
                            <span className="text-slate-600">รายได้สะสม: <span className="font-medium text-slate-800">฿{formatThaiCurrency(ps.ytdEarnings)}</span></span>
                            <span className="text-slate-600">ภาษีสะสม: <span className="font-medium text-slate-800">฿{formatThaiCurrency(ps.ytdWht)}</span></span>
                            <span className="text-slate-600">ประกันสังคมสะสม: <span className="font-medium text-slate-800">฿{formatThaiCurrency(ps.ytdSso)}</span></span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-4 pt-4 border-t border-slate-200 flex gap-2">
                          <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:bg-white rounded-lg transition-colors">
                            <Printer size={16} />
                            พิมพ์สลิป
                          </button>
                          <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:bg-white rounded-lg transition-colors">
                            <Send size={16} />
                            ส่งอีเมล
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Run Payroll Tab */}
      {activeTab === 'run' && (
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calculator size={32} className="text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">ประมวลผลเงินเดือน</h3>
              <p className="text-slate-500 mt-2">คำนวณเงินเดือน ภาษี และประกันสังคมอัตโนมัติ</p>
            </div>

            {/* Period Selection */}
            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <span className="text-sm font-medium text-slate-600">งวดเงินเดือน</span>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {new Date(2024, i).toLocaleDateString('th-TH', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[2024, 2025, 2026].map(year => (
                      <option key={year} value={year}>{year + 543}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <span className="text-sm font-medium text-slate-600">พนักงานที่จะประมวลผล</span>
                <span className="text-lg font-bold text-slate-800">{employees.filter(e => e.status === 'active').length} คน</span>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <span className="text-sm font-medium text-slate-600">บริษัท</span>
                <span className="font-medium text-slate-800">
                  {clients.find(c => c.id === selectedClientId)?.name || '-'}
                </span>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-8">
              <h4 className="text-sm font-semibold text-blue-800 mb-2">สิ่งที่ระบบจะคำนวณ</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• เงินเดือนและค่าตอบแทนตามโครงสร้าง</li>
                <li>• ภาษีหัก ณ ที่จ่าย (WHT) ตามบันไดภาษี 2567</li>
                <li>• ประกันสังคม 5% (สูงสุด 750 บาท/เดือน)</li>
                <li>• กองทุนสำรองเลี้ยงชีพ (ถ้ามี)</li>
              </ul>
            </div>

            {/* Run Button */}
            <button
              onClick={handleRunPayroll}
              disabled={isProcessing || employees.filter(e => e.status === 'active').length === 0}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Clock className="animate-spin" size={20} />
                  กำลังประมวลผล...
                </>
              ) : (
                <>
                  <Calculator size={20} />
                  ประมวลผลเงินเดือน
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Employee Modal */}
      {showEmployeeModal && (
        <EmployeeModal
          employee={editingEmployee}
          onSave={handleSaveEmployee}
          onClose={() => { setShowEmployeeModal(false); setEditingEmployee(null); }}
        />
      )}
    </div>
  );
};

// Employee Modal Component
interface EmployeeModalProps {
  employee: Employee | null;
  onSave: (employee: Employee) => void;
  onClose: () => void;
}

const EmployeeModal: React.FC<EmployeeModalProps> = ({ employee, onSave, onClose }) => {
  const [formData, setFormData] = useState<Partial<Employee>>(
    employee || {
      employeeCode: '',
      titleTh: 'นาย',
      firstNameTh: '',
      lastNameTh: '',
      nationalId: '',
      dateOfBirth: '',
      startDate: new Date().toISOString().split('T')[0],
      position: '',
      department: '',
      status: 'active',
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData as Employee);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">
            {employee ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่'}
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
                <label className="block text-sm text-slate-600 mb-1">รหัสพนักงาน*</label>
                <input
                  type="text"
                  value={formData.employeeCode || ''}
                  onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">คำนำหน้า</label>
                <select
                  value={formData.titleTh || 'นาย'}
                  onChange={(e) => setFormData({ ...formData, titleTh: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="นาย">นาย</option>
                  <option value="นาง">นาง</option>
                  <option value="นางสาว">นางสาว</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">ชื่อ (ไทย)*</label>
                <input
                  type="text"
                  value={formData.firstNameTh || ''}
                  onChange={(e) => setFormData({ ...formData, firstNameTh: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">นามสกุล (ไทย)*</label>
                <input
                  type="text"
                  value={formData.lastNameTh || ''}
                  onChange={(e) => setFormData({ ...formData, lastNameTh: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">เลขประจำตัวประชาชน*</label>
                <input
                  type="text"
                  value={formData.nationalId || ''}
                  onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">วันเกิด</label>
                <input
                  type="date"
                  value={formData.dateOfBirth || ''}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Employment Info */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3">ข้อมูลการจ้างงาน</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">ตำแหน่ง*</label>
                <input
                  type="text"
                  value={formData.position || ''}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">แผนก</label>
                <input
                  type="text"
                  value={formData.department || ''}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">วันที่เริ่มงาน*</label>
                <input
                  type="date"
                  value={formData.startDate || ''}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">สถานะ</label>
                <select
                  value={formData.status || 'active'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">ปฏิบัติงาน</option>
                  <option value="suspended">พักงาน</option>
                  <option value="resigned">ลาออก</option>
                </select>
              </div>
            </div>
          </div>

          {/* Bank Info */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3">ข้อมูลธนาคาร</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">ธนาคาร</label>
                <select
                  value={formData.bankName || ''}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">เลือกธนาคาร</option>
                  <option value="ธนาคารกสิกรไทย">ธนาคารกสิกรไทย</option>
                  <option value="ธนาคารไทยพาณิชย์">ธนาคารไทยพาณิชย์</option>
                  <option value="ธนาคารกรุงเทพ">ธนาคารกรุงเทพ</option>
                  <option value="ธนาคารกรุงไทย">ธนาคารกรุงไทย</option>
                  <option value="ธนาคารกรุงศรีอยุธยา">ธนาคารกรุงศรีอยุธยา</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">เลขบัญชี</label>
                <input
                  type="text"
                  value={formData.bankAccount || ''}
                  onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Save size={18} />
              บันทึก
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PayrollManagement;

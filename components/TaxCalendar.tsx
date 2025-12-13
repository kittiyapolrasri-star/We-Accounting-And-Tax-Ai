/**
 * TaxCalendar.tsx
 *
 * Thai Tax Deadline Calendar Component
 * Shows upcoming tax filing deadlines for VAT, WHT, and other Thai taxes
 * Critical for accounting firms managing multiple clients
 */

import React, { useState, useMemo } from 'react';
import {
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Building2,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react';
import { Client, DocumentRecord } from '../types';

// Thai Tax Deadlines
interface TaxDeadline {
  id: string;
  type: 'VAT' | 'WHT_PND3' | 'WHT_PND53' | 'WHT_PND1' | 'CIT' | 'SSO' | 'PND50' | 'PND51';
  name: string;
  nameTh: string;
  description: string;
  descriptionTh: string;
  dayOfMonth: number; // Filing deadline day
  penalty: string;
  penaltyTh: string;
}

const TAX_DEADLINES: TaxDeadline[] = [
  {
    id: 'VAT',
    type: 'VAT',
    name: 'VAT Return (PP30)',
    nameTh: 'ภ.พ.30 แบบแสดงรายการภาษีมูลค่าเพิ่ม',
    description: 'Monthly VAT return for VAT registered businesses',
    descriptionTh: 'แบบยื่นภาษีมูลค่าเพิ่มประจำเดือน',
    dayOfMonth: 15,
    penalty: 'THB 200/month + 1.5%/month surcharge',
    penaltyTh: 'เบี้ยปรับ 200 บาท/เดือน + เงินเพิ่ม 1.5%/เดือน'
  },
  {
    id: 'WHT_PND3',
    type: 'WHT_PND3',
    name: 'WHT (PND3) - Individuals',
    nameTh: 'ภ.ง.ด.3 ภาษีหัก ณ ที่จ่ายบุคคลธรรมดา',
    description: 'WHT for payments to individuals',
    descriptionTh: 'ภาษีหัก ณ ที่จ่ายสำหรับการจ่ายให้บุคคลธรรมดา',
    dayOfMonth: 7,
    penalty: 'THB 200 + 1.5%/month surcharge',
    penaltyTh: 'เบี้ยปรับ 200 บาท + เงินเพิ่ม 1.5%/เดือน'
  },
  {
    id: 'WHT_PND53',
    type: 'WHT_PND53',
    name: 'WHT (PND53) - Companies',
    nameTh: 'ภ.ง.ด.53 ภาษีหัก ณ ที่จ่ายนิติบุคคล',
    description: 'WHT for payments to companies',
    descriptionTh: 'ภาษีหัก ณ ที่จ่ายสำหรับการจ่ายให้นิติบุคคล',
    dayOfMonth: 7,
    penalty: 'THB 200 + 1.5%/month surcharge',
    penaltyTh: 'เบี้ยปรับ 200 บาท + เงินเพิ่ม 1.5%/เดือน'
  },
  {
    id: 'WHT_PND1',
    type: 'WHT_PND1',
    name: 'WHT (PND1) - Payroll',
    nameTh: 'ภ.ง.ด.1 ภาษีหัก ณ ที่จ่ายเงินเดือน',
    description: 'WHT for employee salaries',
    descriptionTh: 'ภาษีหัก ณ ที่จ่ายจากเงินเดือนพนักงาน',
    dayOfMonth: 7,
    penalty: 'THB 200 + 1.5%/month surcharge',
    penaltyTh: 'เบี้ยปรับ 200 บาท + เงินเพิ่ม 1.5%/เดือน'
  },
  {
    id: 'SSO',
    type: 'SSO',
    name: 'Social Security Fund',
    nameTh: 'เงินสมทบประกันสังคม',
    description: 'Monthly social security contribution',
    descriptionTh: 'เงินสมทบประกันสังคมประจำเดือน',
    dayOfMonth: 15,
    penalty: '2%/month surcharge',
    penaltyTh: 'เงินเพิ่ม 2%/เดือน'
  }
];

// Annual deadlines
interface AnnualDeadline {
  month: number;
  day: number;
  name: string;
  nameTh: string;
  type: string;
}

const ANNUAL_DEADLINES: AnnualDeadline[] = [
  { month: 5, day: 31, name: 'Corporate Income Tax (PND50)', nameTh: 'ภ.ง.ด.50 ภาษีนิติบุคคลประจำปี', type: 'PND50' },
  { month: 8, day: 31, name: 'Half-Year CIT (PND51)', nameTh: 'ภ.ง.ด.51 ภาษีนิติบุคคลครึ่งปี', type: 'PND51' },
  { month: 2, day: 28, name: 'Annual WHT Summary (PND1ก)', nameTh: 'ภ.ง.ด.1ก สรุปภาษีหัก ณ ที่จ่ายประจำปี', type: 'PND1G' }
];

interface ClientDeadline {
  clientId: string;
  clientName: string;
  deadline: TaxDeadline | AnnualDeadline;
  dueDate: Date;
  status: 'upcoming' | 'due_soon' | 'overdue' | 'filed';
  filedDate?: string;
  amount?: number;
}

interface TaxCalendarProps {
  clients: Client[];
  documents: DocumentRecord[];
  onSelectClient?: (clientId: string) => void;
}

const TaxCalendar: React.FC<TaxCalendarProps> = ({ clients, documents, onSelectClient }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedType, setSelectedType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('list');

  // Calculate all client deadlines for current month
  const clientDeadlines = useMemo((): ClientDeadline[] => {
    const deadlines: ClientDeadline[] = [];
    const today = new Date();
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    // Active clients only
    const activeClients = clients.filter(c => c.status === 'Active');

    activeClients.forEach(client => {
      // Monthly tax deadlines
      TAX_DEADLINES.forEach(deadline => {
        const dueDate = new Date(year, month, deadline.dayOfMonth);

        // Determine status
        let status: ClientDeadline['status'] = 'upcoming';
        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntilDue < 0) {
          status = 'overdue';
        } else if (daysUntilDue <= 3) {
          status = 'due_soon';
        }

        // Check if already filed (simplified - would check actual filing records in production)
        const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
        if (deadline.type === 'VAT' && client.current_workflow?.vat_status === 'Filed/Closed') {
          status = 'filed';
        }
        if ((deadline.type === 'WHT_PND3' || deadline.type === 'WHT_PND53') &&
            client.current_workflow?.wht_status === 'Filed/Closed') {
          status = 'filed';
        }

        deadlines.push({
          clientId: client.id,
          clientName: client.name,
          deadline,
          dueDate,
          status
        });
      });

      // Check annual deadlines in current month
      ANNUAL_DEADLINES.forEach(annual => {
        if (annual.month === month + 1) {
          const dueDate = new Date(year, month, annual.day);
          let status: ClientDeadline['status'] = 'upcoming';
          const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          if (daysUntilDue < 0) {
            status = 'overdue';
          } else if (daysUntilDue <= 7) {
            status = 'due_soon';
          }

          deadlines.push({
            clientId: client.id,
            clientName: client.name,
            deadline: annual,
            dueDate,
            status
          });
        }
      });
    });

    // Filter by selected type
    if (selectedType !== 'all') {
      return deadlines.filter(d => {
        const deadlineType = d.deadline.type;
        return deadlineType === selectedType || deadlineType.startsWith(selectedType);
      });
    }

    return deadlines.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [clients, currentMonth, selectedType]);

  // Summary stats
  const stats = useMemo(() => {
    return {
      total: clientDeadlines.length,
      overdue: clientDeadlines.filter(d => d.status === 'overdue').length,
      dueSoon: clientDeadlines.filter(d => d.status === 'due_soon').length,
      filed: clientDeadlines.filter(d => d.status === 'filed').length,
      upcoming: clientDeadlines.filter(d => d.status === 'upcoming').length
    };
  }, [clientDeadlines]);

  // Navigate months
  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // Format Thai month name
  const getThaiMonthName = (date: Date): string => {
    const thaiMonths = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    return `${thaiMonths[date.getMonth()]} ${date.getFullYear() + 543}`; // Buddhist year
  };

  // Status badge component
  const StatusBadge: React.FC<{ status: ClientDeadline['status'] }> = ({ status }) => {
    const config = {
      overdue: { bg: 'bg-red-100', text: 'text-red-700', label: 'เลยกำหนด', icon: AlertTriangle },
      due_soon: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'ใกล้กำหนด', icon: Clock },
      filed: { bg: 'bg-green-100', text: 'text-green-700', label: 'ยื่นแล้ว', icon: CheckCircle2 },
      upcoming: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'รอยื่น', icon: FileText }
    };

    const { bg, text, label, icon: Icon } = config[status];

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${bg} ${text}`}>
        <Icon size={12} />
        {label}
      </span>
    );
  };

  // Group deadlines by date for calendar view
  const deadlinesByDate = useMemo(() => {
    const grouped: Record<number, ClientDeadline[]> = {};
    clientDeadlines.forEach(d => {
      const day = d.dueDate.getDate();
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(d);
    });
    return grouped;
  }, [clientDeadlines]);

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Calendar className="text-blue-600" size={24} />
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                ปฏิทินภาษี / Tax Calendar
              </h2>
              <p className="text-sm text-gray-500">
                กำหนดยื่นภาษีของลูกค้าทั้งหมด
              </p>
            </div>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="font-medium min-w-[150px] text-center">
              {getThaiMonthName(currentMonth)}
            </span>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-5 gap-3 mb-4">
          <div className="bg-gray-50 p-3 rounded-lg text-center">
            <div className="text-2xl font-bold text-gray-700">{stats.total}</div>
            <div className="text-xs text-gray-500">ทั้งหมด</div>
          </div>
          <div className="bg-red-50 p-3 rounded-lg text-center">
            <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
            <div className="text-xs text-red-600">เลยกำหนด</div>
          </div>
          <div className="bg-yellow-50 p-3 rounded-lg text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.dueSoon}</div>
            <div className="text-xs text-yellow-600">ใกล้กำหนด</div>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.upcoming}</div>
            <div className="text-xs text-blue-600">รอยื่น</div>
          </div>
          <div className="bg-green-50 p-3 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-600">{stats.filed}</div>
            <div className="text-xs text-green-600">ยื่นแล้ว</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="all">ทุกประเภทภาษี</option>
            <option value="VAT">ภ.พ.30 (VAT)</option>
            <option value="WHT">ภาษีหัก ณ ที่จ่าย (WHT)</option>
            <option value="SSO">ประกันสังคม</option>
            <option value="PND50">ภ.ง.ด.50 (CIT)</option>
          </select>

          <div className="ml-auto flex gap-1">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 text-sm rounded ${viewMode === 'list' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              รายการ
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1 text-sm rounded ${viewMode === 'calendar' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              ปฏิทิน
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'list' ? (
        <div className="divide-y max-h-[500px] overflow-y-auto">
          {clientDeadlines.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              ไม่มีกำหนดยื่นภาษีในเดือนนี้
            </div>
          ) : (
            clientDeadlines.map((item, index) => (
              <div
                key={`${item.clientId}-${item.deadline.type}-${index}`}
                className={`p-3 hover:bg-gray-50 cursor-pointer ${
                  item.status === 'overdue' ? 'bg-red-50' :
                  item.status === 'due_soon' ? 'bg-yellow-50' : ''
                }`}
                onClick={() => onSelectClient?.(item.clientId)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Building2 size={18} className="text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-800">{item.clientName}</div>
                      <div className="text-sm text-gray-500">
                        {item.deadline.nameTh}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-700">
                      {item.dueDate.getDate()} {getThaiMonthName(item.dueDate).split(' ')[0]}
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                </div>
                {item.status === 'overdue' && 'penaltyTh' in item.deadline && (
                  <div className="mt-2 text-xs text-red-600 bg-red-100 rounded px-2 py-1">
                    ⚠️ {(item.deadline as TaxDeadline).penaltyTh}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        // Calendar View
        <div className="p-4">
          <div className="grid grid-cols-7 gap-1">
            {/* Day headers */}
            {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(day => (
              <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {(() => {
              const year = currentMonth.getFullYear();
              const month = currentMonth.getMonth();
              const firstDay = new Date(year, month, 1).getDay();
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const days = [];

              // Empty cells before first day
              for (let i = 0; i < firstDay; i++) {
                days.push(<div key={`empty-${i}`} className="h-20 bg-gray-50" />);
              }

              // Day cells
              for (let day = 1; day <= daysInMonth; day++) {
                const dayDeadlines = deadlinesByDate[day] || [];
                const hasOverdue = dayDeadlines.some(d => d.status === 'overdue');
                const hasDueSoon = dayDeadlines.some(d => d.status === 'due_soon');

                days.push(
                  <div
                    key={day}
                    className={`h-20 border rounded p-1 text-sm ${
                      hasOverdue ? 'bg-red-50 border-red-200' :
                      hasDueSoon ? 'bg-yellow-50 border-yellow-200' :
                      dayDeadlines.length > 0 ? 'bg-blue-50 border-blue-200' : ''
                    }`}
                  >
                    <div className="font-medium text-gray-700">{day}</div>
                    {dayDeadlines.length > 0 && (
                      <div className="text-xs mt-1">
                        <span className={`${hasOverdue ? 'text-red-600' : hasDueSoon ? 'text-yellow-600' : 'text-blue-600'}`}>
                          {dayDeadlines.length} รายการ
                        </span>
                      </div>
                    )}
                  </div>
                );
              }

              return days;
            })()}
          </div>
        </div>
      )}

      {/* Quick Reference */}
      <div className="p-4 bg-gray-50 border-t">
        <h3 className="text-sm font-medium text-gray-700 mb-2">กำหนดยื่นภาษีประจำ</h3>
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
          <div>• ภ.พ.30 (VAT): ทุกวันที่ 15 ของเดือนถัดไป</div>
          <div>• ภ.ง.ด.3/53 (WHT): ทุกวันที่ 7 ของเดือนถัดไป</div>
          <div>• ประกันสังคม: ทุกวันที่ 15 ของเดือนถัดไป</div>
          <div>• ภ.ง.ด.1 (เงินเดือน): ทุกวันที่ 7 ของเดือนถัดไป</div>
        </div>
      </div>
    </div>
  );
};

export default TaxCalendar;

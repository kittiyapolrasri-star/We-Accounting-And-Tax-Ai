import React, { useState, useMemo } from 'react';
import {
  FileText, Upload, Download, CheckCircle, AlertCircle, Building,
  Calendar, ChevronRight, Eye, Send, RefreshCw, FileCode, AlertTriangle,
  Check, X, Info, Loader2
} from 'lucide-react';
import { DocumentRecord, Client } from '../types';
import {
  TaxFormType,
  EFilingHeader,
  generateEFilingPackage,
  EFilingResult,
  getBuddhistYear,
  INCOME_TYPES
} from '../services/taxEfiling';

interface Props {
  clients: Client[];
  documents: DocumentRecord[];
}

const TAX_FORMS = [
  {
    id: 'PND3' as TaxFormType,
    name: 'ภ.ง.ด.3',
    description: 'ภาษีหัก ณ ที่จ่าย (บุคคลธรรมดา)',
    descriptionEn: 'WHT for Individuals',
    deadline: 'ภายในวันที่ 7 ของเดือนถัดไป',
    color: 'blue',
  },
  {
    id: 'PND53' as TaxFormType,
    name: 'ภ.ง.ด.53',
    description: 'ภาษีหัก ณ ที่จ่าย (นิติบุคคล)',
    descriptionEn: 'WHT for Juristic Persons',
    deadline: 'ภายในวันที่ 7 ของเดือนถัดไป',
    color: 'purple',
  },
  {
    id: 'PP30' as TaxFormType,
    name: 'ภ.พ.30',
    description: 'แบบแสดงรายการภาษีมูลค่าเพิ่ม',
    descriptionEn: 'VAT Return',
    deadline: 'ภายในวันที่ 15 ของเดือนถัดไป',
    color: 'emerald',
  },
];

const TaxEfiling: React.FC<Props> = ({ clients, documents }) => {
  const [selectedClientId, setSelectedClientId] = useState<string>(clients[0]?.id || '');
  const [selectedFormType, setSelectedFormType] = useState<TaxFormType | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [efilingResult, setEfilingResult] = useState<EFilingResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const selectedClient = clients.find(c => c.id === selectedClientId);

  // Filter documents for selected client and period
  const relevantDocuments = useMemo(() => {
    return documents.filter(doc => {
      if (doc.client_name !== selectedClient?.name) return false;
      if (!doc.ai_data) return false;

      const docDate = new Date(doc.ai_data.header_data.issue_date);
      const docMonth = docDate.getMonth() + 1;
      const docYear = docDate.getFullYear();

      return docMonth === selectedMonth && docYear === selectedYear;
    });
  }, [documents, selectedClient, selectedMonth, selectedYear]);

  // Count documents by form type
  const documentCounts = useMemo(() => {
    const pnd3 = relevantDocuments.filter(d =>
      d.ai_data?.tax_compliance.wht_code === 'PND3'
    ).length;

    const pnd53 = relevantDocuments.filter(d =>
      d.ai_data?.tax_compliance.wht_code === 'PND53'
    ).length;

    const vatDocs = relevantDocuments.filter(d =>
      d.ai_data?.tax_compliance.is_full_tax_invoice
    ).length;

    return { PND3: pnd3, PND53: pnd53, PP30: vatDocs };
  }, [relevantDocuments]);

  // Generate e-filing package
  const handleGenerateEfiling = async (formType: TaxFormType) => {
    if (!selectedClient) return;

    setIsProcessing(true);
    setSelectedFormType(formType);

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    const header: EFilingHeader = {
      taxId: selectedClient.tax_id,
      branchNo: '00000',
      companyName: selectedClient.name,
      address: selectedClient.address || '',
      taxMonth: String(selectedMonth).padStart(2, '0'),
      taxYear: getBuddhistYear(selectedYear),
      formType,
      totalRecords: 0,
      totalAmount: 0,
      totalTax: 0,
    };

    const result = generateEFilingPackage(formType, header, relevantDocuments);
    setEfilingResult(result);
    setIsProcessing(false);
  };

  // Download XML file
  const handleDownloadXML = () => {
    if (!efilingResult || !efilingResult.xmlContent) return;

    const blob = new Blob([efilingResult.xmlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = efilingResult.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Format currency
  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="animate-in fade-in duration-500 p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <Send className="text-blue-600" />
            ยื่นภาษีอิเล็กทรอนิกส์ (Tax e-Filing)
          </h2>
          <p className="text-slate-500 mt-1">สร้างไฟล์ XML สำหรับยื่นภาษีผ่านระบบ RD Smart Tax</p>
        </div>

        {/* Client Selector */}
        <div className="flex items-center gap-2">
          <Building size={18} className="text-slate-400" />
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
          >
            {clients.map(client => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Period Selection */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-slate-400" />
            <span className="text-sm text-slate-600">งวดภาษี:</span>
          </div>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
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
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
          >
            {[2023, 2024, 2025].map(year => (
              <option key={year} value={year}>พ.ศ. {year + 543}</option>
            ))}
          </select>
          <div className="ml-auto text-sm text-slate-500">
            เอกสารในงวด: <span className="font-semibold text-slate-800">{relevantDocuments.length}</span> รายการ
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Form Selection */}
        <div className="col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">เลือกแบบภาษีที่ต้องการยื่น</h3>

          {TAX_FORMS.map(form => {
            const count = (documentCounts as Record<string, number>)[form.id] || 0;
            const isSelected = selectedFormType === form.id;
            const hasData = count > 0;

            return (
              <div
                key={form.id}
                className={`bg-white rounded-xl border-2 p-5 transition-all cursor-pointer ${
                  isSelected
                    ? `border-${form.color}-500 bg-${form.color}-50/30`
                    : 'border-slate-200 hover:border-slate-300'
                }`}
                onClick={() => hasData && setSelectedFormType(form.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-${form.color}-100 flex items-center justify-center`}>
                      <FileText className={`text-${form.color}-600`} size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-800">{form.name}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          hasData
                            ? `bg-${form.color}-100 text-${form.color}-700`
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {count} รายการ
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mt-0.5">{form.description}</p>
                      <p className="text-xs text-slate-400">{form.descriptionEn}</p>
                      <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                        <AlertTriangle size={12} />
                        กำหนดยื่น: {form.deadline}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {hasData && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGenerateEfiling(form.id);
                        }}
                        disabled={isProcessing}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {isProcessing && selectedFormType === form.id ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            กำลังสร้าง...
                          </>
                        ) : (
                          <>
                            <FileCode size={16} />
                            สร้างไฟล์ XML
                          </>
                        )}
                      </button>
                    )}
                    {!hasData && (
                      <span className="text-xs text-slate-400">ไม่มีรายการ</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Result Panel */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">ผลลัพธ์</h3>

          {!efilingResult && !isProcessing && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-8 text-center">
              <FileText size={48} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm text-slate-500">เลือกแบบภาษีและคลิก "สร้างไฟล์ XML"</p>
            </div>
          )}

          {isProcessing && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <Loader2 size={48} className="mx-auto mb-3 text-blue-500 animate-spin" />
              <p className="text-sm text-slate-600">กำลังประมวลผลและสร้างไฟล์...</p>
            </div>
          )}

          {efilingResult && !isProcessing && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Status Header */}
              <div className={`px-4 py-3 ${
                efilingResult.success
                  ? 'bg-emerald-50 border-b border-emerald-100'
                  : 'bg-red-50 border-b border-red-100'
              }`}>
                <div className="flex items-center gap-2">
                  {efilingResult.success ? (
                    <>
                      <CheckCircle size={20} className="text-emerald-600" />
                      <span className="font-semibold text-emerald-800">พร้อมดาวน์โหลด</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={20} className="text-red-600" />
                      <span className="font-semibold text-red-800">พบข้อผิดพลาด</span>
                    </>
                  )}
                </div>
              </div>

              {/* Details */}
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">แบบภาษี</p>
                  <p className="font-bold text-slate-800">
                    {TAX_FORMS.find(f => f.id === efilingResult.formType)?.name}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">จำนวนรายการ</p>
                    <p className="font-semibold text-slate-800">{efilingResult.summary.totalRecords}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">ยอดเงิน</p>
                    <p className="font-semibold text-slate-800">฿{formatCurrency(efilingResult.summary.totalAmount)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-slate-500 mb-1">ภาษี</p>
                    <p className="font-bold text-lg text-blue-600">฿{formatCurrency(efilingResult.summary.totalTax)}</p>
                  </div>
                </div>

                {/* Validation Errors */}
                {efilingResult.validationErrors.length > 0 && (
                  <div className="bg-red-50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-red-800 mb-2">ข้อผิดพลาด:</p>
                    <ul className="text-xs text-red-700 space-y-1">
                      {efilingResult.validationErrors.map((error, idx) => (
                        <li key={idx} className="flex items-start gap-1">
                          <X size={12} className="shrink-0 mt-0.5" />
                          {error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Actions */}
                {efilingResult.success && (
                  <div className="space-y-2 pt-2">
                    <button
                      onClick={() => setShowPreview(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                    >
                      <Eye size={16} />
                      ดูตัวอย่าง XML
                    </button>
                    <button
                      onClick={handleDownloadXML}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                    >
                      <Download size={16} />
                      ดาวน์โหลดไฟล์ XML
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
            <div className="flex items-start gap-3">
              <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-800">
                <p className="font-semibold mb-1">วิธีการยื่นภาษี</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-700">
                  <li>ดาวน์โหลดไฟล์ XML</li>
                  <li>เข้าเว็บไซต์ RD Smart Tax</li>
                  <li>เลือก "นำเข้าไฟล์"</li>
                  <li>อัปโหลดไฟล์ XML</li>
                  <li>ตรวจสอบและยืนยันการยื่น</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* XML Preview Modal */}
      {showPreview && efilingResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden m-4 flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-slate-800">ตัวอย่างไฟล์ XML - {efilingResult.filename}</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-xs font-mono bg-slate-900 text-emerald-400 p-4 rounded-xl overflow-auto whitespace-pre-wrap">
                {efilingResult.xmlContent}
              </pre>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                ปิด
              </button>
              <button
                onClick={() => {
                  handleDownloadXML();
                  setShowPreview(false);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Download size={16} />
                ดาวน์โหลด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaxEfiling;

/**
 * VATReturnManager.tsx
 *
 * UI Component for generating and managing PP30 VAT Returns (ภ.พ.30)
 * Calculates VAT payable/refundable, generates forms and XML for e-filing
 */

import React, { useState, useMemo } from 'react';
import {
  FileText,
  Download,
  Printer,
  Calculator,
  Calendar,
  Building2,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  RefreshCw
} from 'lucide-react';
import { DocumentRecord, Client, PostedGLEntry } from '../types';
import {
  generatePP30,
  generatePP30HTML,
  generatePP30XML,
  PP30Data
} from '../services/vatReturn';

interface VATReturnManagerProps {
  clients: Client[];
  documents: DocumentRecord[];
  glEntries: PostedGLEntry[];
  selectedClientId: string | null;
  onShowNotification: (message: string, type: 'success' | 'error') => void;
}

const VATReturnManager: React.FC<VATReturnManagerProps> = ({
  clients,
  documents,
  glEntries,
  selectedClientId,
  onShowNotification
}) => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [carryForwardCredit, setCarryForwardCredit] = useState(0);
  const [pp30Data, setPP30Data] = useState<PP30Data | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Get selected client
  const selectedClient = useMemo(() => {
    return clients.find(c => c.id === selectedClientId) || null;
  }, [clients, selectedClientId]);

  // Filter documents for selected client and month
  const clientDocuments = useMemo(() => {
    if (!selectedClient) return [];

    const [year, month] = selectedMonth.split('-').map(Number);
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-31`;

    return documents.filter(doc => {
      if (doc.client_name !== selectedClient.name) return false;
      if (!doc.ai_data?.header_data.issue_date) return false;

      const docDate = doc.ai_data.header_data.issue_date;
      return docDate >= monthStart && docDate <= monthEnd;
    });
  }, [documents, selectedClient, selectedMonth]);

  // Calculate VAT summary from documents
  const vatSummary = useMemo(() => {
    let outputVAT = 0;
    let inputVAT = 0;
    let salesAmount = 0;
    let purchaseAmount = 0;
    let salesInvoiceCount = 0;
    let purchaseInvoiceCount = 0;

    clientDocuments.forEach(doc => {
      if (!doc.ai_data?.financials) return;

      const vatAmount = doc.ai_data.financials.vat_amount || 0;
      const grossAmount = doc.ai_data.financials.grand_total || 0;
      const vatClaimable = doc.ai_data.tax_compliance?.vat_claimable;

      // Determine if it's a sale or purchase based on document type
      const docType = doc.ai_data.header_data.doc_type;

      if (docType === 'TAX_INVOICE' || docType === 'RECEIPT' || docType === 'ใบกำกับภาษี') {
        // Sales - Output VAT
        outputVAT += vatAmount;
        salesAmount += grossAmount - vatAmount;
        salesInvoiceCount++;
      } else {
        // Purchases - Input VAT
        if (vatClaimable) {
          inputVAT += vatAmount;
        }
        purchaseAmount += grossAmount - vatAmount;
        purchaseInvoiceCount++;
      }
    });

    const netVAT = outputVAT - inputVAT - carryForwardCredit;

    return {
      outputVAT,
      inputVAT,
      salesAmount,
      purchaseAmount,
      salesInvoiceCount,
      purchaseInvoiceCount,
      netVAT,
      vatToPay: netVAT > 0 ? netVAT : 0,
      vatToRefund: netVAT < 0 ? Math.abs(netVAT) : 0
    };
  }, [clientDocuments, carryForwardCredit]);

  // Generate PP30
  const handleGeneratePP30 = async () => {
    if (!selectedClient) {
      onShowNotification('กรุณาเลือกลูกค้าก่อน', 'error');
      return;
    }

    setIsCalculating(true);

    try {
      const pp30 = await generatePP30(
        selectedClient,
        clientDocuments,
        selectedMonth,
        carryForwardCredit
      );

      setPP30Data(pp30);
      onShowNotification('สร้างแบบ ภ.พ.30 สำเร็จ', 'success');
    } catch (error) {
      console.error('Error generating PP30:', error);
      onShowNotification('เกิดข้อผิดพลาดในการสร้างแบบ ภ.พ.30', 'error');
    } finally {
      setIsCalculating(false);
    }
  };

  // Print PP30
  const handlePrintPP30 = () => {
    if (!pp30Data) return;

    const html = generatePP30HTML(pp30Data);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Download XML for e-filing
  const handleDownloadXML = () => {
    if (!pp30Data) return;

    const xml = generatePP30XML(pp30Data);
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PP30_${selectedClient?.tax_id}_${selectedMonth}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onShowNotification('ดาวน์โหลดไฟล์ XML สำเร็จ', 'success');
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Get Thai month name
  const getThaiMonthYear = (monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number);
    const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    return `${thaiMonths[month - 1]} ${year + 543}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-100 rounded-xl">
              <Calculator className="text-emerald-600" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                แบบแสดงรายการภาษีมูลค่าเพิ่ม (ภ.พ.30)
              </h1>
              <p className="text-sm text-slate-500">
                VAT Return Form PP30
              </p>
            </div>
          </div>

          {/* Client selector display */}
          {selectedClient && (
            <div className="flex items-center gap-2 bg-green-50 px-3 py-1 rounded">
              <Building2 size={16} className="text-green-600" />
              <span className="text-sm font-medium text-green-700">{selectedClient.name}</span>
            </div>
          )}
        </div>

        {!selectedClient ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-4 text-center">
            <AlertTriangle className="mx-auto text-yellow-500 mb-2" size={24} />
            <p className="text-yellow-700">กรุณาเลือกลูกค้าก่อน</p>
          </div>
        ) : (
          <>
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-4 mb-4">
              {/* Month selector */}
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-slate-400" />
                <label className="text-sm text-slate-600">เดือนภาษี:</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setPP30Data(null);
                  }}
                  className="border rounded px-2 py-1 text-sm"
                />
              </div>

              {/* Carry forward credit */}
              <div className="flex items-center gap-2">
                <TrendingDown size={16} className="text-slate-400" />
                <label className="text-sm text-slate-600">ยกมา:</label>
                <input
                  type="number"
                  value={carryForwardCredit}
                  onChange={(e) => {
                    setCarryForwardCredit(parseFloat(e.target.value) || 0);
                    setPP30Data(null);
                  }}
                  className="border rounded px-2 py-1 text-sm w-32 text-right"
                  placeholder="0.00"
                />
                <span className="text-sm text-slate-500">บาท</span>
              </div>

              {/* Generate button */}
              <button
                onClick={handleGeneratePP30}
                disabled={isCalculating || clientDocuments.length === 0}
                className="ml-auto px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-slate-300 flex items-center gap-2"
              >
                {isCalculating ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    กำลังคำนวณ...
                  </>
                ) : (
                  <>
                    <Calculator size={16} />
                    คำนวณ ภ.พ.30
                  </>
                )}
              </button>
            </div>

            {/* VAT Summary Preview */}
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-slate-700 mb-3">
                สรุป VAT ประจำเดือน {getThaiMonthYear(selectedMonth)}
              </h3>

              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Output VAT (Sales) */}
                <div className="bg-white rounded-lg p-4 border">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={18} className="text-blue-500" />
                    <span className="font-medium text-slate-700">ภาษีขาย (Output VAT)</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">ยอดขาย:</span>
                      <span>{formatCurrency(vatSummary.salesAmount)} บาท</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">ภาษีขาย:</span>
                      <span className="font-medium text-blue-600">{formatCurrency(vatSummary.outputVAT)} บาท</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>จำนวนใบกำกับ:</span>
                      <span>{vatSummary.salesInvoiceCount} ฉบับ</span>
                    </div>
                  </div>
                </div>

                {/* Input VAT (Purchases) */}
                <div className="bg-white rounded-lg p-4 border">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown size={18} className="text-green-500" />
                    <span className="font-medium text-slate-700">ภาษีซื้อ (Input VAT)</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">ยอดซื้อ:</span>
                      <span>{formatCurrency(vatSummary.purchaseAmount)} บาท</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">ภาษีซื้อ:</span>
                      <span className="font-medium text-green-600">{formatCurrency(vatSummary.inputVAT)} บาท</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>จำนวนใบกำกับ:</span>
                      <span>{vatSummary.purchaseInvoiceCount} ฉบับ</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Calculation Result */}
              <div className="bg-white rounded-lg p-4 border">
                <div className="flex items-center justify-center gap-4 text-lg">
                  <div className="text-center">
                    <div className="text-xs text-slate-500">ภาษีขาย</div>
                    <div className="font-bold text-blue-600">{formatCurrency(vatSummary.outputVAT)}</div>
                  </div>
                  <span className="text-2xl text-slate-400">-</span>
                  <div className="text-center">
                    <div className="text-xs text-slate-500">ภาษีซื้อ</div>
                    <div className="font-bold text-green-600">{formatCurrency(vatSummary.inputVAT)}</div>
                  </div>
                  {carryForwardCredit > 0 && (
                    <>
                      <span className="text-2xl text-slate-400">-</span>
                      <div className="text-center">
                        <div className="text-xs text-slate-500">ยกมา</div>
                        <div className="font-bold text-purple-600">{formatCurrency(carryForwardCredit)}</div>
                      </div>
                    </>
                  )}
                  <span className="text-2xl text-slate-400">=</span>
                  <div className="text-center">
                    <div className="text-xs text-slate-500">
                      {vatSummary.vatToPay > 0 ? 'ต้องชำระ' : 'ขอคืน/ยกไป'}
                    </div>
                    <div className={`font-bold text-xl ${vatSummary.vatToPay > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(vatSummary.vatToPay > 0 ? vatSummary.vatToPay : vatSummary.vatToRefund)}
                    </div>
                  </div>
                </div>

                {vatSummary.vatToPay > 0 && (
                  <div className="mt-3 text-center text-sm text-red-600 bg-red-50 rounded p-2">
                    <AlertTriangle size={14} className="inline mr-1" />
                    ต้องชำระภาษี ภายในวันที่ 15 ของเดือนถัดไป
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Generated PP30 Results */}
      {pp30Data && (
        <div className="p-4 border-t">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="text-green-500" size={20} />
              <h3 className="font-medium text-slate-700">
                แบบ ภ.พ.30 พร้อมยื่น
              </h3>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDownloadXML}
                className="px-3 py-1 bg-blue-500 text-white rounded text-sm flex items-center gap-1 hover:bg-blue-600"
              >
                <FileCode size={14} />
                ดาวน์โหลด XML
              </button>
              <button
                onClick={handlePrintPP30}
                className="px-3 py-1 bg-green-500 text-white rounded text-sm flex items-center gap-1 hover:bg-green-600"
              >
                <Printer size={14} />
                พิมพ์
              </button>
            </div>
          </div>

          {/* PP30 Preview */}
          <div className="bg-slate-50 rounded-lg p-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500">ผู้ประกอบการ</label>
                <div className="font-medium">{pp30Data.taxpayerName}</div>
                <div className="text-slate-500">เลขประจำตัวผู้เสียภาษี: {pp30Data.taxpayerTaxId}</div>
              </div>
              <div>
                <label className="text-xs text-slate-500">เดือนภาษี</label>
                <div className="font-medium">
                  {pp30Data.taxPeriod.month}/{pp30Data.taxPeriod.year}
                </div>
              </div>
            </div>

            <table className="w-full mt-4">
              <tbody>
                <tr className="border-b">
                  <td className="py-2 text-slate-500">ภาษีขาย</td>
                  <td className="py-2 text-right font-medium">{formatCurrency(pp30Data.outputVAT.totalVAT)} บาท</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-slate-500">ภาษีซื้อ</td>
                  <td className="py-2 text-right font-medium">{formatCurrency(pp30Data.inputVAT.totalClaimableVAT)} บาท</td>
                </tr>
                <tr className="border-b bg-slate-100">
                  <td className="py-2 font-medium">
                    {pp30Data.calculation.vatToPay > 0 ? 'ภาษีที่ต้องชำระ' : 'ภาษีที่ขอคืน/ยกไป'}
                  </td>
                  <td className={`py-2 text-right font-bold text-lg ${
                    pp30Data.calculation.vatToPay > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {formatCurrency(pp30Data.calculation.vatToPay > 0 ? pp30Data.calculation.vatToPay : pp30Data.calculation.vatToRefund)} บาท
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="mt-4 text-xs text-slate-500">
              <div>จำนวนใบกำกับขาย: {pp30Data.supportingDocs.salesInvoices.length} ฉบับ</div>
              <div>จำนวนใบกำกับซื้อ: {pp30Data.supportingDocs.purchaseInvoices.length} ฉบับ</div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {selectedClient && clientDocuments.length === 0 && (
        <div className="p-8 text-center text-slate-500">
          <FileText size={48} className="mx-auto mb-2 text-slate-300" />
          <p>ไม่พบเอกสารสำหรับเดือน {getThaiMonthYear(selectedMonth)}</p>
        </div>
      )}
    </div>
  );
};

export default VATReturnManager;

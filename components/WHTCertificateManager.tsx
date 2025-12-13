/**
 * WHTCertificateManager.tsx
 *
 * UI Component for managing Withholding Tax Certificates (50 Tawi / ใบรับรองหักภาษี ณ ที่จ่าย)
 * Allows generating, viewing, and printing WHT certificates
 */

import React, { useState, useMemo } from 'react';
import {
  FileText,
  Download,
  Printer,
  Search,
  Calendar,
  Building2,
  User,
  Filter,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { DocumentRecord, Client } from '../types';
import {
  createWHTCertificate,
  generateWHTCertificateHTML,
  generateBatchWHTCertificates,
  WHTCertificateData
} from '../services/whtCertificate';

interface WHTCertificateManagerProps {
  clients: Client[];
  documents: DocumentRecord[];
  selectedClientId: string | null;
  onShowNotification: (message: string, type: 'success' | 'error') => void;
}

const WHTCertificateManager: React.FC<WHTCertificateManagerProps> = ({
  clients,
  documents,
  selectedClientId,
  onShowNotification
}) => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [filterType, setFilterType] = useState<'all' | 'PND3' | 'PND53'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [generatedCertificates, setGeneratedCertificates] = useState<WHTCertificateData[]>([]);
  const [selectedCertificate, setSelectedCertificate] = useState<WHTCertificateData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Get selected client
  const selectedClient = useMemo(() => {
    return clients.find(c => c.id === selectedClientId) || null;
  }, [clients, selectedClientId]);

  // Filter documents with WHT
  const whtDocuments = useMemo(() => {
    if (!selectedClient) return [];

    const [year, month] = selectedMonth.split('-').map(Number);
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-31`;

    return documents.filter(doc => {
      // Must be for selected client
      if (doc.client_name !== selectedClient.name) return false;

      // Must have AI data with WHT
      if (!doc.ai_data?.financials) return false;

      const whtAmount = doc.ai_data.financials.wht_amount || 0;
      if (whtAmount <= 0) return false;

      // Check date range
      const docDate = doc.ai_data.header_data.issue_date;
      if (docDate < monthStart || docDate > monthEnd) return false;

      // Check search term
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const vendorName = doc.ai_data.parties?.counterparty?.name?.toLowerCase() || '';
        const invNumber = doc.ai_data.header_data.inv_number?.toLowerCase() || '';
        if (!vendorName.includes(searchLower) && !invNumber.includes(searchLower)) {
          return false;
        }
      }

      return true;
    });
  }, [documents, selectedClient, selectedMonth, searchTerm]);

  // Calculate summary
  const summary = useMemo(() => {
    let totalWHT = 0;
    let totalIncome = 0;
    let pnd3Count = 0;
    let pnd53Count = 0;

    whtDocuments.forEach(doc => {
      const whtAmount = doc.ai_data?.financials?.wht_amount || 0;
      const grossAmount = doc.ai_data?.financials?.grand_total || 0;

      totalWHT += whtAmount;
      totalIncome += grossAmount;

      // Determine form type based on tax compliance data or vendor name
      const whtCode = doc.ai_data?.tax_compliance?.wht_code;
      if (whtCode === 'PND53') {
        pnd53Count++;
      } else if (whtCode === 'PND3') {
        pnd3Count++;
      } else {
        // Fallback: check vendor name
        const vendorName = doc.ai_data?.parties?.counterparty?.name || '';
        if (vendorName.includes('บริษัท') || vendorName.includes('หจก') || vendorName.includes('Co.')) {
          pnd53Count++;
        } else {
          pnd3Count++;
        }
      }
    });

    return { totalWHT, totalIncome, pnd3Count, pnd53Count, totalDocs: whtDocuments.length };
  }, [whtDocuments]);

  // Generate certificates for selected documents
  const handleGenerateCertificates = async () => {
    if (!selectedClient || whtDocuments.length === 0) {
      onShowNotification('ไม่มีเอกสารที่มีภาษีหัก ณ ที่จ่ายในเดือนที่เลือก', 'error');
      return;
    }

    setIsGenerating(true);

    try {
      // Generate batch certificates
      const bookNo = `${selectedMonth.replace('-', '')}`;
      const startRunningNo = 1;

      const certificates = generateBatchWHTCertificates(
        whtDocuments,
        selectedClient,
        bookNo,
        startRunningNo
      );

      setGeneratedCertificates(certificates);
      onShowNotification(`สร้างหนังสือรับรองหักภาษี ณ ที่จ่าย ${certificates.length} ฉบับสำเร็จ`, 'success');
    } catch (error) {
      console.error('Error generating certificates:', error);
      onShowNotification('เกิดข้อผิดพลาดในการสร้างหนังสือรับรอง', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Print single certificate
  const handlePrintCertificate = (cert: WHTCertificateData) => {
    const html = generateWHTCertificateHTML(cert);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Print all certificates
  const handlePrintAll = () => {
    if (generatedCertificates.length === 0) return;

    const allHTML = generatedCertificates.map(cert => generateWHTCertificateHTML(cert)).join('<div style="page-break-after: always;"></div>');

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>หนังสือรับรองหักภาษี ณ ที่จ่าย</title>
          <style>
            @media print {
              .page-break { page-break-after: always; }
            }
          </style>
        </head>
        <body>${allHTML}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
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
          <div className="flex items-center gap-3">
            <FileText className="text-orange-600" size={24} />
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                หนังสือรับรองหักภาษี ณ ที่จ่าย (50 ทวิ)
              </h2>
              <p className="text-sm text-gray-500">
                WHT Certificate Management
              </p>
            </div>
          </div>

          {/* Client selector display */}
          {selectedClient && (
            <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded">
              <Building2 size={16} className="text-blue-600" />
              <span className="text-sm font-medium text-blue-700">{selectedClient.name}</span>
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
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {/* Month selector */}
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-gray-400" />
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="border rounded px-2 py-1 text-sm"
                />
              </div>

              {/* Form type filter */}
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-gray-400" />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as 'all' | 'PND3' | 'PND53')}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value="all">ทุกประเภท</option>
                  <option value="PND3">ภ.ง.ด.3 (บุคคลธรรมดา)</option>
                  <option value="PND53">ภ.ง.ด.53 (นิติบุคคล)</option>
                </select>
              </div>

              {/* Search */}
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search size={16} className="text-gray-400" />
                <input
                  type="text"
                  placeholder="ค้นหาผู้รับเงิน..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border rounded px-2 py-1 text-sm w-full"
                />
              </div>

              {/* Generate button */}
              <button
                onClick={handleGenerateCertificates}
                disabled={isGenerating || whtDocuments.length === 0}
                className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:bg-gray-300 flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Clock size={16} className="animate-spin" />
                    กำลังสร้าง...
                  </>
                ) : (
                  <>
                    <FileText size={16} />
                    สร้างหนังสือรับรอง ({whtDocuments.length})
                  </>
                )}
              </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-5 gap-3 mb-4">
              <div className="bg-gray-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-gray-700">{summary.totalDocs}</div>
                <div className="text-xs text-gray-500">เอกสารทั้งหมด</div>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-blue-600">{summary.pnd3Count}</div>
                <div className="text-xs text-blue-600">ภ.ง.ด.3</div>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-purple-600">{summary.pnd53Count}</div>
                <div className="text-xs text-purple-600">ภ.ง.ด.53</div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-green-600">{formatCurrency(summary.totalIncome)}</div>
                <div className="text-xs text-green-600">รายได้รวม</div>
              </div>
              <div className="bg-orange-50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-orange-600">{formatCurrency(summary.totalWHT)}</div>
                <div className="text-xs text-orange-600">ภาษีหัก ณ ที่จ่ายรวม</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Content */}
      {selectedClient && (
        <div className="p-4">
          {generatedCertificates.length > 0 ? (
            <>
              {/* Generated certificates header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-700">
                  หนังสือรับรองที่สร้างแล้ว ({generatedCertificates.length} ฉบับ)
                </h3>
                <button
                  onClick={handlePrintAll}
                  className="px-3 py-1 bg-blue-500 text-white rounded text-sm flex items-center gap-1 hover:bg-blue-600"
                >
                  <Printer size={14} />
                  พิมพ์ทั้งหมด
                </button>
              </div>

              {/* Certificates list */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {generatedCertificates.map((cert, index) => (
                  <div
                    key={cert.certificateNo}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-sm font-bold text-orange-600">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium text-gray-800">{cert.payeeName}</div>
                        <div className="text-xs text-gray-500">
                          เลขที่ {cert.certificateNo} | {cert.formType}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-700">
                          {formatCurrency(cert.totalIncome)} บาท
                        </div>
                        <div className="text-xs text-orange-600">
                          หัก {formatCurrency(cert.totalWHT)} บาท
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setSelectedCertificate(cert)}
                          className="p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 rounded"
                          title="ดูรายละเอียด"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handlePrintCertificate(cert)}
                          className="p-2 text-gray-500 hover:text-green-500 hover:bg-green-50 rounded"
                          title="พิมพ์"
                        >
                          <Printer size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Source documents list */}
              <h3 className="font-medium text-gray-700 mb-3">
                เอกสารที่มีภาษีหัก ณ ที่จ่าย - {getThaiMonthYear(selectedMonth)}
              </h3>

              {whtDocuments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText size={48} className="mx-auto mb-2 text-gray-300" />
                  <p>ไม่พบเอกสารที่มีภาษีหัก ณ ที่จ่ายในเดือนนี้</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {whtDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded"
                    >
                      <div className="flex items-center gap-3">
                        <User size={20} className="text-gray-400" />
                        <div>
                          <div className="font-medium text-gray-800">
                            {doc.ai_data?.parties?.counterparty?.name || 'ไม่ระบุผู้รับเงิน'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {doc.ai_data?.header_data.inv_number} | {doc.ai_data?.header_data.issue_date}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-700">
                          {formatCurrency(doc.ai_data?.financials?.grand_total || 0)} บาท
                        </div>
                        <div className="text-xs text-orange-600">
                          หัก {formatCurrency(doc.ai_data?.financials?.wht_amount || 0)} บาท
                          ({((doc.ai_data?.financials?.wht_amount || 0) / (doc.ai_data?.financials?.grand_total || 1) * 100).toFixed(0)}%)
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Certificate Preview Modal */}
      {selectedCertificate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-medium text-gray-800">
                หนังสือรับรองหักภาษี ณ ที่จ่าย เลขที่ {selectedCertificate.certificateNo}
              </h3>
              <button
                onClick={() => setSelectedCertificate(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[70vh]">
              {/* Certificate details */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">ผู้จ่ายเงิน</label>
                    <div className="font-medium">{selectedCertificate.payerName}</div>
                    <div className="text-sm text-gray-500">เลขประจำตัวผู้เสียภาษี: {selectedCertificate.payerTaxId}</div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">ผู้รับเงิน</label>
                    <div className="font-medium">{selectedCertificate.payeeName}</div>
                    <div className="text-sm text-gray-500">เลขประจำตัวผู้เสียภาษี: {selectedCertificate.payeeTaxId}</div>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500 mb-2 block">รายการเงินได้</label>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-2 text-left">ประเภทเงินได้</th>
                        <th className="p-2 text-right">จำนวนเงิน</th>
                        <th className="p-2 text-right">ภาษีหัก</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCertificate.incomeItems.map((item, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-2">{item.incomeTypeNameTh}</td>
                          <td className="p-2 text-right">{formatCurrency(item.incomeAmount)}</td>
                          <td className="p-2 text-right">{formatCurrency(item.whtAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 font-medium">
                      <tr>
                        <td className="p-2">รวม</td>
                        <td className="p-2 text-right">{formatCurrency(selectedCertificate.totalIncome)}</td>
                        <td className="p-2 text-right">{formatCurrency(selectedCertificate.totalWHT)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="flex items-center gap-2 p-2 bg-blue-50 rounded">
                  <CheckCircle2 size={16} className="text-blue-500" />
                  <span className="text-sm text-blue-700">
                    แบบ {selectedCertificate.formType} | เล่มที่ {selectedCertificate.bookNo}
                  </span>
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => setSelectedCertificate(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                ปิด
              </button>
              <button
                onClick={() => handlePrintCertificate(selectedCertificate)}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-2"
              >
                <Printer size={16} />
                พิมพ์
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WHTCertificateManager;

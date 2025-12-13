/**
 * VAT Return Service (แบบ ภ.พ.30)
 * Generates PP30 VAT return forms for Thai VAT compliance
 */

import { DocumentRecord, Client, PostedGLEntry } from '../types';
import { databaseService } from './database';

// ============================================================================
// TYPES
// ============================================================================

export interface PP30Data {
  // Header
  formNo: string; // "ภ.พ.30"
  taxPeriod: {
    month: string; // "02"
    year: string;  // "2567" (Buddhist Era)
  };

  // Taxpayer Info
  taxpayerName: string;
  taxpayerTaxId: string;
  taxpayerBranch: string;
  taxpayerAddress: string;

  // Section 1: Output VAT (ภาษีขาย)
  outputVAT: {
    salesAmount: number;        // ยอดขาย
    vatAmount: number;          // ภาษีขาย
    adjustmentAdd: number;      // ปรับปรุงเพิ่ม
    adjustmentDeduct: number;   // ปรับปรุงลด
    totalVAT: number;           // รวมภาษีขาย
    invoiceCount: number;       // จำนวนใบกำกับ
  };

  // Section 2: Input VAT (ภาษีซื้อ)
  inputVAT: {
    purchaseAmount: number;     // ยอดซื้อ
    vatAmount: number;          // ภาษีซื้อ
    adjustmentAdd: number;      // ปรับปรุงเพิ่ม
    adjustmentDeduct: number;   // ปรับปรุงลด
    nonDeductibleVAT: number;   // ภาษีซื้อที่ไม่สามารถขอคืนได้
    totalClaimableVAT: number;  // รวมภาษีซื้อที่ขอคืนได้
    invoiceCount: number;       // จำนวนใบกำกับ
  };

  // Section 3: VAT Calculation
  calculation: {
    outputVATTotal: number;     // ภาษีขายรวม
    inputVATTotal: number;      // ภาษีซื้อรวม
    netVAT: number;             // ภาษีสุทธิ (ขาย - ซื้อ)
    carryForwardCredit: number; // เครดิตยกมา
    vatToPay: number;           // ภาษีที่ต้องชำระ
    vatToRefund: number;        // ภาษีที่ขอคืน
  };

  // Section 4: Payment Method
  paymentMethod?: 'bank' | 'check' | 'cash' | 'transfer';
  paymentDate?: string;

  // Supporting Documents
  supportingDocs: {
    salesInvoices: VATInvoiceSummary[];
    purchaseInvoices: VATInvoiceSummary[];
  };

  // Meta
  preparedBy?: string;
  preparedDate: string;
  status: 'draft' | 'pending' | 'submitted' | 'paid';
}

export interface VATInvoiceSummary {
  date: string;
  invoiceNo: string;
  counterpartyName: string;
  counterpartyTaxId: string;
  baseAmount: number;
  vatAmount: number;
  totalAmount: number;
  isDeductible: boolean;
  documentId?: string;
}

export interface VATReportSummary {
  period: string;
  totalSales: number;
  totalOutputVAT: number;
  totalPurchases: number;
  totalInputVAT: number;
  nonDeductibleVAT: number;
  netVAT: number;
  status: 'payable' | 'refundable' | 'zero';
}

// ============================================================================
// VAT CALCULATION FUNCTIONS
// ============================================================================

/**
 * Extract VAT invoices from documents
 */
export const extractVATInvoices = (
  documents: DocumentRecord[],
  periodMonth: string, // "2024-02"
  type: 'sales' | 'purchase'
): VATInvoiceSummary[] => {
  const invoices: VATInvoiceSummary[] = [];

  documents.forEach(doc => {
    if (!doc.ai_data) return;

    const docDate = doc.ai_data.header_data.issue_date;
    const docPeriod = docDate.slice(0, 7); // "YYYY-MM"

    // Check if document is in the period
    if (docPeriod !== periodMonth) return;

    const docType = doc.ai_data.header_data.doc_type.toLowerCase();
    const isSalesDoc = docType.includes('ขาย') ||
                       docType.includes('sales') ||
                       docType.includes('invoice') ||
                       docType.includes('ใบกำกับภาษี') && !docType.includes('ซื้อ');
    const isPurchaseDoc = docType.includes('ซื้อ') ||
                          docType.includes('purchase') ||
                          docType.includes('expense') ||
                          docType.includes('ใบเสร็จ');

    // Determine if this is the type we're looking for
    if (type === 'sales' && !isSalesDoc) return;
    if (type === 'purchase' && !isPurchaseDoc) return;

    const vatAmount = doc.ai_data.financials.vat_amount || 0;
    if (vatAmount === 0) return; // Skip non-VAT documents

    invoices.push({
      date: docDate,
      invoiceNo: doc.ai_data.header_data.inv_number,
      counterpartyName: type === 'sales'
        ? doc.ai_data.parties.client_company.name
        : doc.ai_data.parties.counterparty.name,
      counterpartyTaxId: type === 'sales'
        ? doc.ai_data.parties.client_company.tax_id
        : doc.ai_data.parties.counterparty.tax_id,
      baseAmount: doc.ai_data.financials.subtotal,
      vatAmount: vatAmount,
      totalAmount: doc.ai_data.financials.grand_total,
      isDeductible: doc.ai_data.tax_compliance.vat_claimable,
      documentId: doc.id,
    });
  });

  // Sort by date
  return invoices.sort((a, b) => a.date.localeCompare(b.date));
};

/**
 * Calculate VAT from GL entries
 */
export const calculateVATFromGL = async (
  clientId: string,
  periodMonth: string // "2024-02"
): Promise<{
  outputVAT: number;
  inputVAT: number;
  nonDeductibleVAT: number;
}> => {
  const glEntries = await databaseService.getGLEntriesByClient(clientId);

  // Filter by period
  const periodEntries = glEntries.filter(gl => gl.date.startsWith(periodMonth));

  // Output VAT (Credit to 21540)
  const outputVAT = periodEntries
    .filter(gl => gl.account_code === '21540')
    .reduce((sum, gl) => sum + gl.credit, 0);

  // Input VAT (Debit to 11540)
  const inputVAT = periodEntries
    .filter(gl => gl.account_code === '11540')
    .reduce((sum, gl) => sum + gl.debit, 0);

  // Non-deductible VAT (Debit to 53000)
  const nonDeductibleVAT = periodEntries
    .filter(gl => gl.account_code === '53000')
    .reduce((sum, gl) => sum + gl.debit, 0);

  return { outputVAT, inputVAT, nonDeductibleVAT };
};

/**
 * Generate PP30 VAT Return Form
 */
export const generatePP30 = async (
  client: Client,
  documents: DocumentRecord[],
  periodMonth: string, // "2024-02"
  carryForwardCredit: number = 0
): Promise<PP30Data> => {
  const now = new Date();
  const [year, month] = periodMonth.split('-');
  const thaiYear = parseInt(year) + 543;

  // Extract invoices
  const salesInvoices = extractVATInvoices(documents, periodMonth, 'sales');
  const purchaseInvoices = extractVATInvoices(documents, periodMonth, 'purchase');

  // Calculate from GL for accuracy
  const glVAT = await calculateVATFromGL(client.id, periodMonth);

  // Or calculate from invoices
  const salesAmount = salesInvoices.reduce((sum, inv) => sum + inv.baseAmount, 0);
  const outputVATAmount = salesInvoices.reduce((sum, inv) => sum + inv.vatAmount, 0);

  const purchaseAmount = purchaseInvoices.reduce((sum, inv) => sum + inv.baseAmount, 0);
  const inputVATDeductible = purchaseInvoices
    .filter(inv => inv.isDeductible)
    .reduce((sum, inv) => sum + inv.vatAmount, 0);
  const inputVATNonDeductible = purchaseInvoices
    .filter(inv => !inv.isDeductible)
    .reduce((sum, inv) => sum + inv.vatAmount, 0);

  // Use GL values if available, otherwise use invoice calculations
  const finalOutputVAT = glVAT.outputVAT || outputVATAmount;
  const finalInputVAT = glVAT.inputVAT || inputVATDeductible;
  const finalNonDeductibleVAT = glVAT.nonDeductibleVAT || inputVATNonDeductible;

  // Calculate net VAT
  const netVAT = finalOutputVAT - finalInputVAT;
  const netAfterCredit = netVAT - carryForwardCredit;

  const pp30: PP30Data = {
    formNo: 'ภ.พ.30',
    taxPeriod: {
      month: month,
      year: String(thaiYear),
    },

    taxpayerName: client.name,
    taxpayerTaxId: client.tax_id,
    taxpayerBranch: '00000', // Head office
    taxpayerAddress: client.address || '',

    outputVAT: {
      salesAmount,
      vatAmount: finalOutputVAT,
      adjustmentAdd: 0,
      adjustmentDeduct: 0,
      totalVAT: finalOutputVAT,
      invoiceCount: salesInvoices.length,
    },

    inputVAT: {
      purchaseAmount,
      vatAmount: finalInputVAT + finalNonDeductibleVAT,
      adjustmentAdd: 0,
      adjustmentDeduct: 0,
      nonDeductibleVAT: finalNonDeductibleVAT,
      totalClaimableVAT: finalInputVAT,
      invoiceCount: purchaseInvoices.length,
    },

    calculation: {
      outputVATTotal: finalOutputVAT,
      inputVATTotal: finalInputVAT,
      netVAT: netVAT,
      carryForwardCredit: carryForwardCredit,
      vatToPay: netAfterCredit > 0 ? netAfterCredit : 0,
      vatToRefund: netAfterCredit < 0 ? Math.abs(netAfterCredit) : 0,
    },

    supportingDocs: {
      salesInvoices,
      purchaseInvoices,
    },

    preparedDate: now.toISOString().split('T')[0],
    status: 'draft',
  };

  return pp30;
};

/**
 * Generate PP30 HTML for printing
 */
export const generatePP30HTML = (pp30: PP30Data): string => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const monthName = thaiMonths[parseInt(pp30.taxPeriod.month) - 1];

  return `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>แบบ ภ.พ.30 - ${monthName} ${pp30.taxPeriod.year}</title>
  <style>
    @page { size: A4; margin: 10mm; }
    body {
      font-family: 'Sarabun', 'TH SarabunPSK', sans-serif;
      font-size: 13px;
      line-height: 1.4;
      padding: 15px;
    }
    .form { max-width: 800px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 20px; }
    .title { font-size: 20px; font-weight: bold; }
    .period { font-size: 16px; margin-top: 5px; }
    .section { margin-bottom: 20px; border: 1px solid #000; }
    .section-header {
      background: #e0e0e0;
      padding: 8px;
      font-weight: bold;
      border-bottom: 1px solid #000;
    }
    .section-content { padding: 10px; }
    .row { display: flex; margin-bottom: 8px; align-items: center; }
    .label { width: 200px; }
    .value { flex: 1; text-align: right; font-weight: bold; }
    .amount { font-family: monospace; }
    .taxpayer-info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .info-box { padding: 5px; border: 1px solid #ccc; background: #f9f9f9; }
    .summary-table { width: 100%; border-collapse: collapse; }
    .summary-table th, .summary-table td {
      border: 1px solid #000;
      padding: 8px;
      text-align: right;
    }
    .summary-table th { background: #e0e0e0; text-align: center; }
    .summary-table td:first-child { text-align: left; }
    .result-box {
      background: #fff3cd;
      border: 2px solid #000;
      padding: 15px;
      margin-top: 20px;
      text-align: center;
    }
    .result-amount { font-size: 24px; font-weight: bold; color: #d00; }
    .result-label { font-size: 14px; margin-bottom: 5px; }
    .signature-section {
      margin-top: 30px;
      display: flex;
      justify-content: space-around;
    }
    .signature-box { text-align: center; width: 200px; }
    .signature-line { border-top: 1px solid #000; margin-top: 40px; padding-top: 5px; }
    .invoice-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
    .invoice-table th, .invoice-table td { border: 1px solid #999; padding: 4px; }
    .invoice-table th { background: #f0f0f0; }
  </style>
</head>
<body>
  <div class="form">
    <div class="header">
      <div class="title">แบบแสดงรายการภาษีมูลค่าเพิ่ม (ภ.พ.30)</div>
      <div class="period">สำหรับเดือนภาษี ${monthName} พ.ศ. ${pp30.taxPeriod.year}</div>
    </div>

    <div class="section">
      <div class="section-header">ข้อมูลผู้ประกอบการ</div>
      <div class="section-content">
        <div class="taxpayer-info">
          <div class="info-box">
            <strong>ชื่อผู้ประกอบการ:</strong><br>${pp30.taxpayerName}
          </div>
          <div class="info-box">
            <strong>เลขประจำตัวผู้เสียภาษี:</strong><br>${pp30.taxpayerTaxId}
          </div>
          <div class="info-box">
            <strong>สาขา:</strong><br>${pp30.taxpayerBranch === '00000' ? 'สำนักงานใหญ่' : pp30.taxpayerBranch}
          </div>
          <div class="info-box">
            <strong>ที่อยู่:</strong><br>${pp30.taxpayerAddress || '-'}
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">ส่วนที่ 1: ภาษีขาย</div>
      <div class="section-content">
        <table class="summary-table">
          <tr>
            <td>ยอดขาย (ไม่รวม VAT)</td>
            <td class="amount">${formatCurrency(pp30.outputVAT.salesAmount)}</td>
          </tr>
          <tr>
            <td>ภาษีขาย (7%)</td>
            <td class="amount">${formatCurrency(pp30.outputVAT.vatAmount)}</td>
          </tr>
          <tr>
            <td>ปรับปรุงเพิ่ม</td>
            <td class="amount">${formatCurrency(pp30.outputVAT.adjustmentAdd)}</td>
          </tr>
          <tr>
            <td>ปรับปรุงลด</td>
            <td class="amount">${formatCurrency(pp30.outputVAT.adjustmentDeduct)}</td>
          </tr>
          <tr style="background: #f5f5f5; font-weight: bold;">
            <td>รวมภาษีขาย</td>
            <td class="amount">${formatCurrency(pp30.outputVAT.totalVAT)}</td>
          </tr>
        </table>
        <div style="margin-top: 5px; font-size: 11px; color: #666;">
          จำนวนใบกำกับภาษี: ${pp30.outputVAT.invoiceCount} ฉบับ
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">ส่วนที่ 2: ภาษีซื้อ</div>
      <div class="section-content">
        <table class="summary-table">
          <tr>
            <td>ยอดซื้อ (ไม่รวม VAT)</td>
            <td class="amount">${formatCurrency(pp30.inputVAT.purchaseAmount)}</td>
          </tr>
          <tr>
            <td>ภาษีซื้อ</td>
            <td class="amount">${formatCurrency(pp30.inputVAT.vatAmount)}</td>
          </tr>
          <tr>
            <td>ภาษีซื้อที่ไม่สามารถขอคืนได้</td>
            <td class="amount" style="color: #900;">(${formatCurrency(pp30.inputVAT.nonDeductibleVAT)})</td>
          </tr>
          <tr style="background: #f5f5f5; font-weight: bold;">
            <td>รวมภาษีซื้อที่ขอคืนได้</td>
            <td class="amount">${formatCurrency(pp30.inputVAT.totalClaimableVAT)}</td>
          </tr>
        </table>
        <div style="margin-top: 5px; font-size: 11px; color: #666;">
          จำนวนใบกำกับภาษี: ${pp30.inputVAT.invoiceCount} ฉบับ
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">ส่วนที่ 3: การคำนวณภาษี</div>
      <div class="section-content">
        <table class="summary-table">
          <tr>
            <td>ภาษีขายรวม</td>
            <td class="amount">${formatCurrency(pp30.calculation.outputVATTotal)}</td>
          </tr>
          <tr>
            <td>หัก: ภาษีซื้อที่ขอคืนได้</td>
            <td class="amount">(${formatCurrency(pp30.calculation.inputVATTotal)})</td>
          </tr>
          <tr style="font-weight: bold;">
            <td>ภาษีสุทธิ (ขาย - ซื้อ)</td>
            <td class="amount">${formatCurrency(pp30.calculation.netVAT)}</td>
          </tr>
          ${pp30.calculation.carryForwardCredit > 0 ? `
          <tr>
            <td>หัก: เครดิตภาษียกมา</td>
            <td class="amount">(${formatCurrency(pp30.calculation.carryForwardCredit)})</td>
          </tr>
          ` : ''}
        </table>

        <div class="result-box">
          ${pp30.calculation.vatToPay > 0 ? `
            <div class="result-label">ภาษีที่ต้องชำระ</div>
            <div class="result-amount">${formatCurrency(pp30.calculation.vatToPay)} บาท</div>
          ` : pp30.calculation.vatToRefund > 0 ? `
            <div class="result-label">ภาษีที่ขอคืน/เครดิตยกไป</div>
            <div class="result-amount" style="color: #060;">${formatCurrency(pp30.calculation.vatToRefund)} บาท</div>
          ` : `
            <div class="result-label">ไม่มีภาษีที่ต้องชำระ</div>
            <div class="result-amount" style="color: #666;">0.00 บาท</div>
          `}
        </div>
      </div>
    </div>

    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-line">
          ลงชื่อ .....................................<br>
          ผู้มีอำนาจลงนาม<br>
          วันที่ ......./......./..........
        </div>
      </div>
      <div class="signature-box">
        <div class="signature-line">
          ลงชื่อ .....................................<br>
          ผู้จัดทำ<br>
          วันที่ ${pp30.preparedDate}
        </div>
      </div>
    </div>

    <div style="margin-top: 30px; page-break-before: always;">
      <h3>รายละเอียดใบกำกับภาษีขาย</h3>
      <table class="invoice-table">
        <thead>
          <tr>
            <th>วันที่</th>
            <th>เลขที่ใบกำกับ</th>
            <th>ชื่อลูกค้า</th>
            <th>เลขประจำตัว</th>
            <th>มูลค่า</th>
            <th>VAT</th>
          </tr>
        </thead>
        <tbody>
          ${pp30.supportingDocs.salesInvoices.map(inv => `
            <tr>
              <td>${inv.date}</td>
              <td>${inv.invoiceNo}</td>
              <td>${inv.counterpartyName}</td>
              <td>${inv.counterpartyTaxId}</td>
              <td style="text-align: right;">${formatCurrency(inv.baseAmount)}</td>
              <td style="text-align: right;">${formatCurrency(inv.vatAmount)}</td>
            </tr>
          `).join('')}
          <tr style="font-weight: bold; background: #f0f0f0;">
            <td colspan="4">รวม (${pp30.supportingDocs.salesInvoices.length} รายการ)</td>
            <td style="text-align: right;">${formatCurrency(pp30.outputVAT.salesAmount)}</td>
            <td style="text-align: right;">${formatCurrency(pp30.outputVAT.vatAmount)}</td>
          </tr>
        </tbody>
      </table>

      <h3 style="margin-top: 20px;">รายละเอียดใบกำกับภาษีซื้อ</h3>
      <table class="invoice-table">
        <thead>
          <tr>
            <th>วันที่</th>
            <th>เลขที่ใบกำกับ</th>
            <th>ชื่อผู้ขาย</th>
            <th>เลขประจำตัว</th>
            <th>มูลค่า</th>
            <th>VAT</th>
            <th>ขอคืน</th>
          </tr>
        </thead>
        <tbody>
          ${pp30.supportingDocs.purchaseInvoices.map(inv => `
            <tr ${!inv.isDeductible ? 'style="background: #fff0f0;"' : ''}>
              <td>${inv.date}</td>
              <td>${inv.invoiceNo}</td>
              <td>${inv.counterpartyName}</td>
              <td>${inv.counterpartyTaxId}</td>
              <td style="text-align: right;">${formatCurrency(inv.baseAmount)}</td>
              <td style="text-align: right;">${formatCurrency(inv.vatAmount)}</td>
              <td style="text-align: center;">${inv.isDeductible ? '✓' : '✗'}</td>
            </tr>
          `).join('')}
          <tr style="font-weight: bold; background: #f0f0f0;">
            <td colspan="4">รวม (${pp30.supportingDocs.purchaseInvoices.length} รายการ)</td>
            <td style="text-align: right;">${formatCurrency(pp30.inputVAT.purchaseAmount)}</td>
            <td style="text-align: right;">${formatCurrency(pp30.inputVAT.vatAmount)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div style="margin-top: 20px; font-size: 11px; text-align: center; color: #666;">
      เอกสารนี้ออกโดยระบบ WE Accounting AI - ${new Date().toISOString()}
    </div>
  </div>
</body>
</html>
  `.trim();
};

/**
 * Generate VAT Report Summary
 */
export const generateVATSummary = async (
  client: Client,
  documents: DocumentRecord[],
  periodMonth: string
): Promise<VATReportSummary> => {
  const pp30 = await generatePP30(client, documents, periodMonth);

  return {
    period: periodMonth,
    totalSales: pp30.outputVAT.salesAmount,
    totalOutputVAT: pp30.outputVAT.totalVAT,
    totalPurchases: pp30.inputVAT.purchaseAmount,
    totalInputVAT: pp30.inputVAT.totalClaimableVAT,
    nonDeductibleVAT: pp30.inputVAT.nonDeductibleVAT,
    netVAT: pp30.calculation.netVAT,
    status: pp30.calculation.vatToPay > 0 ? 'payable' :
            pp30.calculation.vatToRefund > 0 ? 'refundable' : 'zero',
  };
};

/**
 * Generate XML for e-Filing submission
 */
export const generatePP30XML = (pp30: PP30Data): string => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<PP30>
  <Header>
    <FormNo>ภ.พ.30</FormNo>
    <TaxMonth>${pp30.taxPeriod.month}</TaxMonth>
    <TaxYear>${pp30.taxPeriod.year}</TaxYear>
    <TaxpayerTIN>${pp30.taxpayerTaxId}</TaxpayerTIN>
    <TaxpayerName>${pp30.taxpayerName}</TaxpayerName>
    <BranchNo>${pp30.taxpayerBranch}</BranchNo>
  </Header>
  <OutputVAT>
    <SalesAmount>${pp30.outputVAT.salesAmount.toFixed(2)}</SalesAmount>
    <VATAmount>${pp30.outputVAT.vatAmount.toFixed(2)}</VATAmount>
    <AdjustmentAdd>${pp30.outputVAT.adjustmentAdd.toFixed(2)}</AdjustmentAdd>
    <AdjustmentDeduct>${pp30.outputVAT.adjustmentDeduct.toFixed(2)}</AdjustmentDeduct>
    <TotalVAT>${pp30.outputVAT.totalVAT.toFixed(2)}</TotalVAT>
  </OutputVAT>
  <InputVAT>
    <PurchaseAmount>${pp30.inputVAT.purchaseAmount.toFixed(2)}</PurchaseAmount>
    <VATAmount>${pp30.inputVAT.vatAmount.toFixed(2)}</VATAmount>
    <NonDeductible>${pp30.inputVAT.nonDeductibleVAT.toFixed(2)}</NonDeductible>
    <TotalClaimable>${pp30.inputVAT.totalClaimableVAT.toFixed(2)}</TotalClaimable>
  </InputVAT>
  <Calculation>
    <NetVAT>${pp30.calculation.netVAT.toFixed(2)}</NetVAT>
    <CarryForward>${pp30.calculation.carryForwardCredit.toFixed(2)}</CarryForward>
    <VATToPay>${pp30.calculation.vatToPay.toFixed(2)}</VATToPay>
    <VATToRefund>${pp30.calculation.vatToRefund.toFixed(2)}</VATToRefund>
  </Calculation>
</PP30>`;
};

export const vatReturnService = {
  extractVATInvoices,
  calculateVATFromGL,
  generatePP30,
  generatePP30HTML,
  generateVATSummary,
  generatePP30XML,
};

export default vatReturnService;

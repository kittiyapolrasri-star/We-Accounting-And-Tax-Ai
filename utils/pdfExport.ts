/**
 * PDF Export Utility for Thai Financial Reports
 * Supports: VAT Reports (ภ.พ.30), WHT Forms (ภ.ง.ด.3, ภ.ง.ด.53), Financial Statements
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Extend jsPDF type for autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: typeof autoTable;
    lastAutoTable: { finalY: number };
  }
}

export interface ReportData {
  title: string;
  subtitle?: string;
  date: string;
  companyName: string;
  taxId?: string;
  content: string; // HTML content
}

export interface TaxFormData {
  companyName: string;
  companyTaxId: string;
  companyAddress?: string;
  period: string; // e.g., "กุมภาพันธ์ 2567"
  year: string;
}

export interface VATReportItem {
  date: string;
  docNo: string;
  counterpartyName: string;
  counterpartyTaxId: string;
  baseAmount: number;
  vatAmount: number;
}

export interface WHTReportItem {
  date: string;
  docNo: string;
  payeeName: string;
  payeeTaxId: string;
  incomeType: string;
  whtRate: number;
  baseAmount: number;
  whtAmount: number;
}

/**
 * Format Thai date
 */
const formatThaiDate = (date: Date): string => {
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const buddhistYear = date.getFullYear() + 543;
  return `${date.getDate()} ${thaiMonths[date.getMonth()]} ${buddhistYear}`;
};

/**
 * Format currency for Thai Baht
 */
const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Generate VAT Report PDF (รายงานภาษีซื้อ/ขาย for ภ.พ.30)
 */
export const generateVATReportPDF = (
  formData: TaxFormData,
  items: VATReportItem[],
  reportType: 'input' | 'output'
): void => {
  const doc = new jsPDF('p', 'mm', 'a4');

  // Title
  const title = reportType === 'input' ? 'รายงานภาษีซื้อ' : 'รายงานภาษีขาย';
  doc.setFontSize(16);
  doc.text(title, 105, 20, { align: 'center' });

  // Company info
  doc.setFontSize(10);
  doc.text(`บริษัท: ${formData.companyName}`, 14, 35);
  doc.text(`เลขประจำตัวผู้เสียภาษี: ${formData.companyTaxId}`, 14, 42);
  doc.text(`งวดเดือน: ${formData.period}`, 14, 49);

  // Table
  const tableData = items.map((item, index) => [
    (index + 1).toString(),
    item.date,
    item.docNo,
    item.counterpartyName,
    item.counterpartyTaxId,
    formatCurrency(item.baseAmount),
    formatCurrency(item.vatAmount)
  ]);

  // Calculate totals
  const totalBase = items.reduce((sum, item) => sum + item.baseAmount, 0);
  const totalVat = items.reduce((sum, item) => sum + item.vatAmount, 0);

  autoTable(doc, {
    startY: 55,
    head: [[
      'ลำดับ',
      'วันที่',
      'เลขที่เอกสาร',
      reportType === 'input' ? 'ชื่อผู้ขาย' : 'ชื่อผู้ซื้อ',
      'เลขประจำตัวผู้เสียภาษี',
      'มูลค่าสินค้า/บริการ',
      'ภาษีมูลค่าเพิ่ม'
    ]],
    body: tableData,
    foot: [[
      '', '', '', '', 'รวม',
      formatCurrency(totalBase),
      formatCurrency(totalVat)
    ]],
    styles: { font: 'helvetica', fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246] },
    footStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 22 },
      2: { cellWidth: 28 },
      3: { cellWidth: 45 },
      4: { cellWidth: 28 },
      5: { cellWidth: 28, halign: 'right' },
      6: { cellWidth: 25, halign: 'right' }
    }
  });

  // Footer
  const finalY = doc.lastAutoTable.finalY + 20;
  doc.setFontSize(8);
  doc.text(`พิมพ์จาก WE Accounting & Tax AI - ${formatThaiDate(new Date())}`, 105, finalY, { align: 'center' });

  // Save
  const filename = `VAT_${reportType === 'input' ? 'Input' : 'Output'}_${formData.period.replace(/\s/g, '_')}.pdf`;
  doc.save(filename);
};

/**
 * Generate WHT Certificate PDF (หนังสือรับรองการหักภาษี ณ ที่จ่าย)
 */
export const generateWHTCertificatePDF = (
  formData: TaxFormData,
  item: WHTReportItem,
  formType: 'PND3' | 'PND53'
): void => {
  const doc = new jsPDF('p', 'mm', 'a4');

  // Border
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(10, 10, 190, 277);

  // Title
  doc.setFontSize(14);
  doc.text('หนังสือรับรองการหักภาษี ณ ที่จ่าย', 105, 25, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร (${formType})`, 105, 32, { align: 'center' });

  // Section 1: Payer info
  doc.setFontSize(9);
  doc.text('1. ผู้มีหน้าที่หักภาษี ณ ที่จ่าย', 14, 45);
  doc.setDrawColor(150);
  doc.rect(14, 48, 182, 25);
  doc.text(`ชื่อ: ${formData.companyName}`, 18, 55);
  doc.text(`เลขประจำตัวผู้เสียภาษีอากร: ${formData.companyTaxId}`, 18, 62);
  doc.text(`ที่อยู่: ${formData.companyAddress || '-'}`, 18, 69);

  // Section 2: Payee info
  doc.text('2. ผู้ถูกหักภาษี ณ ที่จ่าย', 14, 82);
  doc.rect(14, 85, 182, 25);
  doc.text(`ชื่อ: ${item.payeeName}`, 18, 92);
  doc.text(`เลขประจำตัวผู้เสียภาษีอากร: ${item.payeeTaxId}`, 18, 99);

  // Section 3: Income details
  doc.text('3. รายละเอียดเงินได้และภาษีหัก ณ ที่จ่าย', 14, 120);

  autoTable(doc, {
    startY: 125,
    head: [['ลำดับ', 'ประเภทเงินได้', 'อัตราภาษี (%)', 'จำนวนเงินที่จ่าย', 'ภาษีที่หักไว้']],
    body: [[
      '1',
      item.incomeType,
      item.whtRate.toString(),
      formatCurrency(item.baseAmount),
      formatCurrency(item.whtAmount)
    ]],
    foot: [['', '', 'รวม', formatCurrency(item.baseAmount), formatCurrency(item.whtAmount)]],
    styles: { font: 'helvetica', fontSize: 9 },
    headStyles: { fillColor: [59, 130, 246] },
    footStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold' },
    margin: { left: 14, right: 14 },
    columnStyles: {
      0: { cellWidth: 15 },
      1: { cellWidth: 70 },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 35, halign: 'right' },
      4: { cellWidth: 35, halign: 'right' }
    }
  });

  const finalY = doc.lastAutoTable.finalY + 10;

  // Section 4: Payment date
  doc.text(`4. วันเดือนปีที่จ่ายเงิน: ${item.date}`, 14, finalY + 5);

  // Signature section
  doc.text('ลงชื่อ ................................................ ผู้จ่ายเงิน', 120, finalY + 40);
  doc.text('(........................................................)', 120, finalY + 48);
  doc.text(`วันที่ออกหนังสือรับรอง: ${formatThaiDate(new Date())}`, 120, finalY + 56);

  // Footer
  doc.setFontSize(7);
  doc.text('พิมพ์จาก WE Accounting & Tax AI', 105, 280, { align: 'center' });

  // Save
  const filename = `WHT_${formType}_${item.payeeName.replace(/\s/g, '_')}_${item.date.replace(/\//g, '-')}.pdf`;
  doc.save(filename);
};

/**
 * Generate PND3/PND53 Summary Report PDF (รายงานสรุป ภ.ง.ด.3/53)
 */
export const generateWHTSummaryPDF = (
  formData: TaxFormData,
  items: WHTReportItem[],
  formType: 'PND3' | 'PND53'
): void => {
  const doc = new jsPDF('p', 'mm', 'a4');

  // Title
  const title = formType === 'PND3'
    ? 'รายงานสรุปภาษีหัก ณ ที่จ่าย (ภ.ง.ด.3)'
    : 'รายงานสรุปภาษีหัก ณ ที่จ่าย (ภ.ง.ด.53)';
  doc.setFontSize(14);
  doc.text(title, 105, 20, { align: 'center' });

  // Subtitle
  doc.setFontSize(10);
  const subtitle = formType === 'PND3'
    ? 'สำหรับบุคคลธรรมดา'
    : 'สำหรับนิติบุคคล';
  doc.text(subtitle, 105, 27, { align: 'center' });

  // Company info
  doc.text(`บริษัท: ${formData.companyName}`, 14, 40);
  doc.text(`เลขประจำตัวผู้เสียภาษี: ${formData.companyTaxId}`, 14, 47);
  doc.text(`งวดเดือน: ${formData.period}`, 14, 54);

  // Table
  const tableData = items.map((item, index) => [
    (index + 1).toString(),
    item.date,
    item.payeeName,
    item.payeeTaxId,
    item.incomeType,
    `${item.whtRate}%`,
    formatCurrency(item.baseAmount),
    formatCurrency(item.whtAmount)
  ]);

  // Calculate totals
  const totalBase = items.reduce((sum, item) => sum + item.baseAmount, 0);
  const totalWht = items.reduce((sum, item) => sum + item.whtAmount, 0);

  autoTable(doc, {
    startY: 60,
    head: [[
      'ลำดับ',
      'วันที่',
      'ชื่อผู้รับเงิน',
      'เลขประจำตัวผู้เสียภาษี',
      'ประเภทเงินได้',
      'อัตรา',
      'ยอดเงิน',
      'ภาษีหัก'
    ]],
    body: tableData,
    foot: [[
      '', '', '', '', '', 'รวม',
      formatCurrency(totalBase),
      formatCurrency(totalWht)
    ]],
    styles: { font: 'helvetica', fontSize: 7 },
    headStyles: { fillColor: formType === 'PND3' ? [34, 197, 94] : [168, 85, 247] },
    footStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 20 },
      2: { cellWidth: 40 },
      3: { cellWidth: 28 },
      4: { cellWidth: 30 },
      5: { cellWidth: 12, halign: 'center' },
      6: { cellWidth: 25, halign: 'right' },
      7: { cellWidth: 22, halign: 'right' }
    }
  });

  // Summary section
  const finalY = doc.lastAutoTable.finalY + 15;
  doc.setFontSize(10);
  doc.setDrawColor(150);
  doc.rect(14, finalY, 90, 30);
  doc.text('สรุป', 18, finalY + 8);
  doc.text(`จำนวนราย: ${items.length} ราย`, 18, finalY + 16);
  doc.text(`ยอดเงินรวม: ${formatCurrency(totalBase)} บาท`, 18, finalY + 24);

  doc.rect(106, finalY, 90, 30);
  doc.text('ภาษีที่ต้องนำส่ง', 110, finalY + 8);
  doc.setFontSize(14);
  doc.text(`${formatCurrency(totalWht)} บาท`, 110, finalY + 22);

  // Footer
  doc.setFontSize(8);
  doc.text(`พิมพ์จาก WE Accounting & Tax AI - ${formatThaiDate(new Date())}`, 105, 280, { align: 'center' });

  // Save
  const filename = `${formType}_Summary_${formData.period.replace(/\s/g, '_')}.pdf`;
  doc.save(filename);
};

/**
 * Generate PP30 Summary (ภ.พ.30 Summary)
 */
export const generatePP30SummaryPDF = (
  formData: TaxFormData,
  outputVat: number,
  inputVat: number,
  outputItems: VATReportItem[],
  inputItems: VATReportItem[]
): void => {
  const doc = new jsPDF('p', 'mm', 'a4');

  // Title
  doc.setFontSize(16);
  doc.text('สรุปแบบแสดงรายการภาษีมูลค่าเพิ่ม (ภ.พ.30)', 105, 20, { align: 'center' });

  // Company info
  doc.setFontSize(10);
  doc.text(`บริษัท: ${formData.companyName}`, 14, 35);
  doc.text(`เลขประจำตัวผู้เสียภาษี: ${formData.companyTaxId}`, 14, 42);
  doc.text(`งวดเดือน: ${formData.period}`, 14, 49);

  // Summary boxes
  const boxY = 60;

  // Output VAT box
  doc.setFillColor(239, 246, 255);
  doc.rect(14, boxY, 88, 45, 'F');
  doc.setDrawColor(59, 130, 246);
  doc.rect(14, boxY, 88, 45);
  doc.setFontSize(11);
  doc.text('ภาษีขาย (Output VAT)', 58, boxY + 10, { align: 'center' });
  doc.setFontSize(9);
  doc.text(`จำนวน: ${outputItems.length} รายการ`, 20, boxY + 22);
  const outputBase = outputItems.reduce((sum, i) => sum + i.baseAmount, 0);
  doc.text(`ยอดขาย: ${formatCurrency(outputBase)}`, 20, boxY + 30);
  doc.setFontSize(12);
  doc.text(`VAT: ${formatCurrency(outputVat)}`, 20, boxY + 40);

  // Input VAT box
  doc.setFillColor(236, 253, 245);
  doc.rect(108, boxY, 88, 45, 'F');
  doc.setDrawColor(34, 197, 94);
  doc.rect(108, boxY, 88, 45);
  doc.setFontSize(11);
  doc.text('ภาษีซื้อ (Input VAT)', 152, boxY + 10, { align: 'center' });
  doc.setFontSize(9);
  doc.text(`จำนวน: ${inputItems.length} รายการ`, 114, boxY + 22);
  const inputBase = inputItems.reduce((sum, i) => sum + i.baseAmount, 0);
  doc.text(`ยอดซื้อ: ${formatCurrency(inputBase)}`, 114, boxY + 30);
  doc.setFontSize(12);
  doc.text(`VAT: ${formatCurrency(inputVat)}`, 114, boxY + 40);

  // Net VAT
  const netVat = outputVat - inputVat;
  const netY = boxY + 55;

  if (netVat > 0) {
    doc.setFillColor(254, 242, 242);
    doc.rect(14, netY, 182, 30, 'F');
    doc.setDrawColor(239, 68, 68);
    doc.rect(14, netY, 182, 30);
    doc.setTextColor(185, 28, 28);
    doc.setFontSize(12);
    doc.text('ภาษีที่ต้องชำระ (VAT Payable)', 105, netY + 12, { align: 'center' });
    doc.setFontSize(16);
    doc.text(`${formatCurrency(netVat)} บาท`, 105, netY + 24, { align: 'center' });
  } else {
    doc.setFillColor(236, 253, 245);
    doc.rect(14, netY, 182, 30, 'F');
    doc.setDrawColor(34, 197, 94);
    doc.rect(14, netY, 182, 30);
    doc.setTextColor(22, 101, 52);
    doc.setFontSize(12);
    doc.text('ภาษีที่ชำระเกิน (VAT Refundable)', 105, netY + 12, { align: 'center' });
    doc.setFontSize(16);
    doc.text(`${formatCurrency(Math.abs(netVat))} บาท`, 105, netY + 24, { align: 'center' });
  }

  doc.setTextColor(0, 0, 0);

  // Instructions
  doc.setFontSize(9);
  const instructY = netY + 45;
  doc.text('หมายเหตุ:', 14, instructY);
  doc.text('- กำหนดยื่นแบบ ภ.พ.30 ภายในวันที่ 15 ของเดือนถัดไป', 20, instructY + 8);
  doc.text('- หากยื่นผ่านอินเทอร์เน็ต ขยายเวลาถึงวันที่ 23 ของเดือนถัดไป', 20, instructY + 16);
  if (netVat > 0) {
    doc.text(`- ชำระภาษีจำนวน ${formatCurrency(netVat)} บาท ที่ธนาคารหรือสรรพากรพื้นที่`, 20, instructY + 24);
  }

  // Footer
  doc.setFontSize(8);
  doc.text(`พิมพ์จาก WE Accounting & Tax AI - ${formatThaiDate(new Date())}`, 105, 280, { align: 'center' });

  // Save
  const filename = `PP30_Summary_${formData.period.replace(/\s/g, '_')}.pdf`;
  doc.save(filename);
};

// ===========================================
// LEGACY FUNCTIONS (Browser Print)
// ===========================================

/**
 * Generate printable HTML document
 */
const generatePrintableHTML = (data: ReportData): string => {
  return `
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <title>${data.title}</title>
      <style>
        @page {
          size: A4;
          margin: 2cm;
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Sarabun', 'TH Sarabun New', Arial, sans-serif;
          font-size: 14px;
          line-height: 1.5;
          color: #000;
        }

        .header {
          text-align: center;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 2px solid #000;
        }

        .company-name {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 5px;
        }

        .tax-id {
          font-size: 12px;
          color: #666;
        }

        .report-title {
          font-size: 16px;
          font-weight: bold;
          margin: 15px 0;
        }

        .report-date {
          font-size: 12px;
          color: #666;
          margin-bottom: 20px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin: 10px 0;
        }

        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }

        th {
          background-color: #f5f5f5;
          font-weight: bold;
        }

        .text-right {
          text-align: right;
        }

        .text-center {
          text-align: center;
        }

        .total-row {
          font-weight: bold;
          background-color: #f9f9f9;
        }

        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          font-size: 11px;
          color: #666;
          text-align: center;
        }

        .signature-section {
          margin-top: 50px;
          display: flex;
          justify-content: space-between;
        }

        .signature-box {
          width: 200px;
          text-align: center;
        }

        .signature-line {
          border-top: 1px solid #000;
          margin-top: 50px;
          padding-top: 5px;
        }

        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-name">${data.companyName}</div>
        ${data.taxId ? `<div class="tax-id">เลขประจำตัวผู้เสียภาษี: ${data.taxId}</div>` : ''}
      </div>

      <div class="report-title">${data.title}</div>
      ${data.subtitle ? `<div class="report-subtitle">${data.subtitle}</div>` : ''}
      <div class="report-date">ณ วันที่ ${data.date}</div>

      <div class="content">
        ${data.content}
      </div>

      <div class="footer">
        พิมพ์จาก WE Accounting & Tax AI<br>
        วันที่พิมพ์: ${new Date().toLocaleDateString('th-TH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </div>
    </body>
    </html>
  `;
};

/**
 * Export report as PDF using browser print
 */
export const exportToPDF = (data: ReportData): void => {
  const html = generatePrintableHTML(data);

  // Open new window for printing
  const printWindow = window.open('', '_blank');

  if (!printWindow) {
    alert('กรุณาอนุญาตการเปิด popup เพื่อพิมพ์รายงาน');
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();

  // Wait for content to load then print
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
};

/**
 * Print report directly
 */
export const printReport = (data: ReportData): void => {
  exportToPDF(data);
};

/**
 * Generate Trial Balance HTML content
 */
export const generateTrialBalanceContent = (
  entries: { account_code: string; account_name: string; debit: number; credit: number }[]
): string => {
  let totalDebit = 0;
  let totalCredit = 0;

  const rows = entries.map(entry => {
    totalDebit += entry.debit;
    totalCredit += entry.credit;
    return `
      <tr>
        <td>${entry.account_code}</td>
        <td>${entry.account_name}</td>
        <td class="text-right">${entry.debit > 0 ? entry.debit.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '-'}</td>
        <td class="text-right">${entry.credit > 0 ? entry.credit.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '-'}</td>
      </tr>
    `;
  }).join('');

  return `
    <table>
      <thead>
        <tr>
          <th style="width: 15%">รหัสบัญชี</th>
          <th style="width: 45%">ชื่อบัญชี</th>
          <th style="width: 20%" class="text-right">เดบิต</th>
          <th style="width: 20%" class="text-right">เครดิต</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="total-row">
          <td colspan="2" class="text-right">รวม</td>
          <td class="text-right">${totalDebit.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
          <td class="text-right">${totalCredit.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
        </tr>
      </tbody>
    </table>
  `;
};

/**
 * Generate Profit & Loss HTML content
 */
export const generatePnLContent = (data: {
  revenue: number;
  costOfSales: number;
  grossProfit: number;
  expenses: { name: string; amount: number }[];
  netProfit: number;
}): string => {
  const expenseRows = data.expenses.map(exp => `
    <tr>
      <td style="padding-left: 20px">${exp.name}</td>
      <td class="text-right">${exp.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
    </tr>
  `).join('');

  const totalExpenses = data.expenses.reduce((sum, exp) => sum + exp.amount, 0);

  return `
    <table>
      <tbody>
        <tr>
          <td><strong>รายได้</strong></td>
          <td class="text-right"><strong>${data.revenue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</strong></td>
        </tr>
        <tr>
          <td>ต้นทุนขาย</td>
          <td class="text-right">(${data.costOfSales.toLocaleString('th-TH', { minimumFractionDigits: 2 })})</td>
        </tr>
        <tr class="total-row">
          <td><strong>กำไรขั้นต้น</strong></td>
          <td class="text-right"><strong>${data.grossProfit.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</strong></td>
        </tr>
        <tr>
          <td colspan="2"><strong>ค่าใช้จ่ายดำเนินงาน</strong></td>
        </tr>
        ${expenseRows}
        <tr>
          <td style="padding-left: 20px"><strong>รวมค่าใช้จ่าย</strong></td>
          <td class="text-right"><strong>(${totalExpenses.toLocaleString('th-TH', { minimumFractionDigits: 2 })})</strong></td>
        </tr>
        <tr class="total-row">
          <td><strong>กำไร (ขาดทุน) สุทธิ</strong></td>
          <td class="text-right"><strong>${data.netProfit.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</strong></td>
        </tr>
      </tbody>
    </table>
  `;
};

/**
 * Generate Balance Sheet HTML content
 */
export const generateBalanceSheetContent = (data: {
  assets: { name: string; amount: number }[];
  liabilities: { name: string; amount: number }[];
  equity: { name: string; amount: number }[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}): string => {
  const assetRows = data.assets.map(a => `
    <tr>
      <td>${a.name}</td>
      <td class="text-right">${a.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
    </tr>
  `).join('');

  const liabilityRows = data.liabilities.map(l => `
    <tr>
      <td>${l.name}</td>
      <td class="text-right">${l.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
    </tr>
  `).join('');

  const equityRows = data.equity.map(e => `
    <tr>
      <td>${e.name}</td>
      <td class="text-right">${e.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
    </tr>
  `).join('');

  return `
    <table>
      <tbody>
        <tr>
          <td colspan="2"><strong>สินทรัพย์</strong></td>
        </tr>
        ${assetRows}
        <tr class="total-row">
          <td><strong>รวมสินทรัพย์</strong></td>
          <td class="text-right"><strong>${data.totalAssets.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</strong></td>
        </tr>
        <tr><td colspan="2">&nbsp;</td></tr>
        <tr>
          <td colspan="2"><strong>หนี้สิน</strong></td>
        </tr>
        ${liabilityRows}
        <tr class="total-row">
          <td><strong>รวมหนี้สิน</strong></td>
          <td class="text-right"><strong>${data.totalLiabilities.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</strong></td>
        </tr>
        <tr><td colspan="2">&nbsp;</td></tr>
        <tr>
          <td colspan="2"><strong>ส่วนของผู้ถือหุ้น</strong></td>
        </tr>
        ${equityRows}
        <tr class="total-row">
          <td><strong>รวมส่วนของผู้ถือหุ้น</strong></td>
          <td class="text-right"><strong>${data.totalEquity.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</strong></td>
        </tr>
        <tr class="total-row">
          <td><strong>รวมหนี้สินและส่วนของผู้ถือหุ้น</strong></td>
          <td class="text-right"><strong>${(data.totalLiabilities + data.totalEquity).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</strong></td>
        </tr>
      </tbody>
    </table>
  `;
};

/**
 * Export data as Excel (CSV format with BOM for Thai support)
 */
export const exportToExcel = (
  data: any[][],
  filename: string,
  headers?: string[]
): void => {
  // Add BOM for UTF-8 Thai character support in Excel
  let csvContent = '\uFEFF';

  if (headers) {
    csvContent += headers.join(',') + '\n';
  }

  data.forEach(row => {
    const escapedRow = row.map(cell => {
      if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    });
    csvContent += escapedRow.join(',') + '\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};

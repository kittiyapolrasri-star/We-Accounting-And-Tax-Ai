/**
 * PDF Export Utility for Financial Reports
 * Uses browser's print functionality for PDF generation
 */

export interface ReportData {
  title: string;
  subtitle?: string;
  date: string;
  companyName: string;
  taxId?: string;
  content: string; // HTML content
}

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

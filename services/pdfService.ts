/**
 * Premium PDF Export Service
 * 
 * สร้างเอกสาร PDF ที่สวยงามสำหรับ:
 * - งบการเงิน (Financial Statements)
 * - รายงานภาษี (Tax Reports)
 * - ใบแจ้งหนี้/ใบเสร็จ (Invoices/Receipts)
 * - Pay Slips
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PostedGLEntry, DocumentRecord, Client } from '../types';

// ============================================================================
// THAI FORMATTING HELPERS
// ============================================================================

const THAI_MONTHS = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const THAI_MONTHS_SHORT = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

export const formatThaiDate = (date: Date, short = false): string => {
    const day = date.getDate();
    const month = short ? THAI_MONTHS_SHORT[date.getMonth()] : THAI_MONTHS[date.getMonth()];
    const buddhistYear = date.getFullYear() + 543;
    return `${day} ${month} ${buddhistYear}`;
};

export const formatThaiCurrency = (amount: number, showSymbol = true): string => {
    const formatted = Math.abs(amount).toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    const prefix = amount < 0 ? '-' : '';
    return showSymbol ? `${prefix}฿${formatted}` : `${prefix}${formatted}`;
};

export const numberToThaiWord = (num: number): string => {
    const units = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
    const positions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

    if (num === 0) return 'ศูนย์';
    if (num < 0) return 'ลบ' + numberToThaiWord(Math.abs(num));

    const intPart = Math.floor(num);
    const decPart = Math.round((num - intPart) * 100);

    const convertInt = (n: number): string => {
        if (n === 0) return '';
        if (n < 10) return units[n];
        if (n < 100) {
            const tens = Math.floor(n / 10);
            const ones = n % 10;
            let result = tens === 2 ? 'ยี่สิบ' : (tens === 1 ? 'สิบ' : units[tens] + 'สิบ');
            if (ones === 1) result += 'เอ็ด';
            else if (ones > 0) result += units[ones];
            return result;
        }
        // For larger numbers
        let result = '';
        let remaining = n;
        let pos = 0;
        while (remaining > 0) {
            const digit = remaining % 10;
            if (digit > 0) {
                result = units[digit] + positions[pos] + result;
            }
            remaining = Math.floor(remaining / 10);
            pos++;
        }
        return result;
    };

    let result = convertInt(intPart) + 'บาท';
    if (decPart > 0) {
        result += convertInt(decPart) + 'สตางค์';
    } else {
        result += 'ถ้วน';
    }

    return result;
};

// ============================================================================
// PDF GENERATION TYPES
// ============================================================================

export interface CompanyInfo {
    name: string;
    taxId: string;
    address?: string;
    phone?: string;
    email?: string;
    logo?: string; // Base64 or URL
}

export interface FinancialStatementData {
    companyInfo: CompanyInfo;
    periodStart: string;
    periodEnd: string;
    preparedBy?: string;
    approvedBy?: string;
}

export interface TrialBalanceItem {
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
}

export interface ProfitLossData extends FinancialStatementData {
    revenue: { name: string; amount: number }[];
    costOfSales: { name: string; amount: number }[];
    operatingExpenses: { name: string; amount: number }[];
    otherIncome?: { name: string; amount: number }[];
    otherExpenses?: { name: string; amount: number }[];
    incomeTax?: number;
}

export interface BalanceSheetData extends FinancialStatementData {
    currentAssets: { name: string; amount: number }[];
    nonCurrentAssets: { name: string; amount: number }[];
    currentLiabilities: { name: string; amount: number }[];
    nonCurrentLiabilities: { name: string; amount: number }[];
    equity: { name: string; amount: number }[];
}

// ============================================================================
// PDF THEME & STYLING
// ============================================================================

const PDF_THEME = {
    // Colors
    primary: [59, 130, 246] as [number, number, number],     // Blue
    secondary: [100, 116, 139] as [number, number, number],  // Slate
    success: [34, 197, 94] as [number, number, number],      // Green
    danger: [239, 68, 68] as [number, number, number],       // Red
    dark: [30, 41, 59] as [number, number, number],          // Dark slate
    light: [248, 250, 252] as [number, number, number],      // Light gray

    // Fonts
    headerSize: 16,
    subHeaderSize: 12,
    bodySize: 10,
    smallSize: 8,

    // Spacing
    margin: 15,
    lineHeight: 6,
};

// ============================================================================
// PREMIUM PDF GENERATOR CLASS
// ============================================================================

export class PremiumPDFGenerator {
    private doc: jsPDF;
    private pageWidth: number;
    private pageHeight: number;
    private currentY: number;

    constructor(orientation: 'p' | 'l' = 'p', format: 'a4' | 'letter' = 'a4') {
        this.doc = new jsPDF(orientation, 'mm', format);
        this.pageWidth = this.doc.internal.pageSize.getWidth();
        this.pageHeight = this.doc.internal.pageSize.getHeight();
        this.currentY = PDF_THEME.margin;
    }

    // ========================================================================
    // HELPER METHODS
    // ========================================================================

    private addHeader(title: string, subtitle?: string) {
        // Gradient-like header bar
        this.doc.setFillColor(...PDF_THEME.primary);
        this.doc.rect(0, 0, this.pageWidth, 35, 'F');

        // Title
        this.doc.setTextColor(255, 255, 255);
        this.doc.setFontSize(PDF_THEME.headerSize);
        this.doc.text(title, this.pageWidth / 2, 15, { align: 'center' });

        if (subtitle) {
            this.doc.setFontSize(PDF_THEME.bodySize);
            this.doc.text(subtitle, this.pageWidth / 2, 23, { align: 'center' });
        }

        // Reset text color
        this.doc.setTextColor(0, 0, 0);
        this.currentY = 45;
    }

    private addCompanyInfo(info: CompanyInfo) {
        this.doc.setFontSize(PDF_THEME.subHeaderSize);
        this.doc.setTextColor(...PDF_THEME.dark);
        this.doc.text(info.name, PDF_THEME.margin, this.currentY);

        this.doc.setFontSize(PDF_THEME.smallSize);
        this.doc.setTextColor(...PDF_THEME.secondary);
        this.currentY += PDF_THEME.lineHeight;
        this.doc.text(`Tax ID: ${info.taxId}`, PDF_THEME.margin, this.currentY);

        if (info.address) {
            this.currentY += PDF_THEME.lineHeight - 1;
            this.doc.text(info.address, PDF_THEME.margin, this.currentY);
        }

        this.doc.setTextColor(0, 0, 0);
        this.currentY += PDF_THEME.lineHeight + 5;
    }

    private addPeriodInfo(startDate: string, endDate: string) {
        this.doc.setFontSize(PDF_THEME.bodySize);
        const periodText = `Period: ${startDate} - ${endDate}`;
        this.doc.text(periodText, this.pageWidth - PDF_THEME.margin, 50, { align: 'right' });
    }

    private addFooter(pageInfo = true) {
        const footerY = this.pageHeight - 10;

        // Line
        this.doc.setDrawColor(...PDF_THEME.secondary);
        this.doc.setLineWidth(0.3);
        this.doc.line(PDF_THEME.margin, footerY - 5, this.pageWidth - PDF_THEME.margin, footerY - 5);

        // Footer text
        this.doc.setFontSize(7);
        this.doc.setTextColor(...PDF_THEME.secondary);
        this.doc.text(
            `Generated by WE Accounting & Tax AI | ${formatThaiDate(new Date())}`,
            PDF_THEME.margin,
            footerY
        );

        if (pageInfo) {
            const pageNum = this.doc.getNumberOfPages();
            this.doc.text(`Page 1 of ${pageNum}`, this.pageWidth - PDF_THEME.margin, footerY, { align: 'right' });
        }
    }

    private checkPageBreak(requiredSpace: number): boolean {
        if (this.currentY + requiredSpace > this.pageHeight - 25) {
            this.addFooter();
            this.doc.addPage();
            this.currentY = PDF_THEME.margin + 10;
            return true;
        }
        return false;
    }

    // ========================================================================
    // FINANCIAL STATEMENT GENERATORS
    // ========================================================================

    /**
     * Generate Trial Balance PDF
     */
    generateTrialBalance(
        data: FinancialStatementData,
        items: TrialBalanceItem[]
    ): Blob {
        this.addHeader('Trial Balance', 'งบทดลอง');
        this.addCompanyInfo(data.companyInfo);
        this.addPeriodInfo(data.periodStart, data.periodEnd);

        // Calculate totals
        const totalDebit = items.reduce((sum, item) => sum + item.debit, 0);
        const totalCredit = items.reduce((sum, item) => sum + item.credit, 0);

        // Table
        const tableData = items.map(item => [
            item.accountCode,
            item.accountName,
            item.debit > 0 ? formatThaiCurrency(item.debit, false) : '-',
            item.credit > 0 ? formatThaiCurrency(item.credit, false) : '-'
        ]);

        autoTable(this.doc, {
            startY: this.currentY,
            head: [['Account Code', 'Account Name', 'Debit', 'Credit']],
            body: tableData,
            foot: [['', 'Total', formatThaiCurrency(totalDebit, false), formatThaiCurrency(totalCredit, false)]],
            styles: { fontSize: 9 },
            headStyles: {
                fillColor: PDF_THEME.primary,
                textColor: [255, 255, 255]
            },
            footStyles: {
                fillColor: PDF_THEME.light,
                textColor: PDF_THEME.dark,
                fontStyle: 'bold'
            },
            columnStyles: {
                0: { cellWidth: 30 },
                1: { cellWidth: 80 },
                2: { cellWidth: 35, halign: 'right' },
                3: { cellWidth: 35, halign: 'right' }
            },
            alternateRowStyles: { fillColor: [250, 250, 250] }
        });

        // Balance check
        this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
        const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

        this.doc.setFillColor(...(isBalanced ? PDF_THEME.success : PDF_THEME.danger));
        this.doc.roundedRect(PDF_THEME.margin, this.currentY, 80, 12, 2, 2, 'F');
        this.doc.setTextColor(255, 255, 255);
        this.doc.setFontSize(10);
        this.doc.text(
            isBalanced ? '✓ Balance Verified' : '✗ Out of Balance',
            PDF_THEME.margin + 5,
            this.currentY + 8
        );

        this.addFooter();
        return this.doc.output('blob');
    }

    /**
     * Generate Profit & Loss Statement PDF
     */
    generateProfitLoss(data: ProfitLossData): Blob {
        this.addHeader('Profit & Loss Statement', 'งบกำไรขาดทุน');
        this.addCompanyInfo(data.companyInfo);
        this.addPeriodInfo(data.periodStart, data.periodEnd);

        const sumItems = (items: { amount: number }[]) => items.reduce((s, i) => s + i.amount, 0);

        const totalRevenue = sumItems(data.revenue);
        const totalCost = sumItems(data.costOfSales);
        const grossProfit = totalRevenue - totalCost;
        const totalOpex = sumItems(data.operatingExpenses);
        const totalOtherIncome = data.otherIncome ? sumItems(data.otherIncome) : 0;
        const totalOtherExpense = data.otherExpenses ? sumItems(data.otherExpenses) : 0;
        const profitBeforeTax = grossProfit - totalOpex + totalOtherIncome - totalOtherExpense;
        const netProfit = profitBeforeTax - (data.incomeTax || 0);

        const tableRows: any[] = [];

        // Revenue section
        tableRows.push([{ content: 'Revenue / รายได้', colSpan: 2, styles: { fontStyle: 'bold', fillColor: PDF_THEME.primary, textColor: [255, 255, 255] } }]);
        data.revenue.forEach(item => {
            tableRows.push(['   ' + item.name, formatThaiCurrency(item.amount, false)]);
        });
        tableRows.push([{ content: 'Total Revenue', styles: { fontStyle: 'bold' } }, { content: formatThaiCurrency(totalRevenue, false), styles: { fontStyle: 'bold' } }]);

        // Cost of Sales
        tableRows.push([{ content: 'Cost of Sales / ต้นทุนขาย', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }]);
        data.costOfSales.forEach(item => {
            tableRows.push(['   ' + item.name, formatThaiCurrency(item.amount, false)]);
        });
        tableRows.push([{ content: 'Total Cost of Sales', styles: { fontStyle: 'bold' } }, { content: formatThaiCurrency(totalCost, false), styles: { fontStyle: 'bold' } }]);

        // Gross Profit
        tableRows.push([{ content: 'Gross Profit / กำไรขั้นต้น', styles: { fontStyle: 'bold', fillColor: PDF_THEME.success, textColor: [255, 255, 255] } },
        { content: formatThaiCurrency(grossProfit, false), styles: { fontStyle: 'bold', fillColor: PDF_THEME.success, textColor: [255, 255, 255] } }]);

        // Operating Expenses
        tableRows.push([{ content: 'Operating Expenses / ค่าใช้จ่ายดำเนินงาน', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }]);
        data.operatingExpenses.forEach(item => {
            tableRows.push(['   ' + item.name, formatThaiCurrency(item.amount, false)]);
        });
        tableRows.push([{ content: 'Total Operating Expenses', styles: { fontStyle: 'bold' } }, { content: formatThaiCurrency(totalOpex, false), styles: { fontStyle: 'bold' } }]);

        // Net Profit
        const netProfitColor = netProfit >= 0 ? PDF_THEME.success : PDF_THEME.danger;
        tableRows.push([{ content: 'Net Profit / กำไรสุทธิ', styles: { fontStyle: 'bold', fillColor: netProfitColor, textColor: [255, 255, 255] } },
        { content: formatThaiCurrency(netProfit, false), styles: { fontStyle: 'bold', fillColor: netProfitColor, textColor: [255, 255, 255] } }]);

        autoTable(this.doc, {
            startY: this.currentY,
            body: tableRows,
            styles: { fontSize: 9 },
            columnStyles: {
                0: { cellWidth: 120 },
                1: { cellWidth: 50, halign: 'right' }
            },
            theme: 'grid'
        });

        this.addFooter();
        return this.doc.output('blob');
    }

    /**
     * Generate Balance Sheet PDF
     */
    generateBalanceSheet(data: BalanceSheetData): Blob {
        this.addHeader('Balance Sheet', 'งบแสดงฐานะการเงิน');
        this.addCompanyInfo(data.companyInfo);
        this.doc.text(`As of ${data.periodEnd}`, this.pageWidth - PDF_THEME.margin, 50, { align: 'right' });

        const sumItems = (items: { amount: number }[]) => items.reduce((s, i) => s + i.amount, 0);

        const totalCurrentAssets = sumItems(data.currentAssets);
        const totalNonCurrentAssets = sumItems(data.nonCurrentAssets);
        const totalAssets = totalCurrentAssets + totalNonCurrentAssets;

        const totalCurrentLiab = sumItems(data.currentLiabilities);
        const totalNonCurrentLiab = sumItems(data.nonCurrentLiabilities);
        const totalLiabilities = totalCurrentLiab + totalNonCurrentLiab;

        const totalEquity = sumItems(data.equity);
        const totalLiabEquity = totalLiabilities + totalEquity;

        const tableRows: any[] = [];

        // Assets
        tableRows.push([{ content: 'ASSETS / สินทรัพย์', colSpan: 2, styles: { fontStyle: 'bold', fillColor: PDF_THEME.primary, textColor: [255, 255, 255] } }]);

        tableRows.push([{ content: 'Current Assets / สินทรัพย์หมุนเวียน', colSpan: 2, styles: { fillColor: [241, 245, 249], fontStyle: 'bold' } }]);
        data.currentAssets.forEach(item => tableRows.push(['   ' + item.name, formatThaiCurrency(item.amount, false)]));
        tableRows.push([{ content: 'Total Current Assets', styles: { fontStyle: 'bold' } }, { content: formatThaiCurrency(totalCurrentAssets, false), styles: { fontStyle: 'bold' } }]);

        tableRows.push([{ content: 'Non-Current Assets / สินทรัพย์ไม่หมุนเวียน', colSpan: 2, styles: { fillColor: [241, 245, 249], fontStyle: 'bold' } }]);
        data.nonCurrentAssets.forEach(item => tableRows.push(['   ' + item.name, formatThaiCurrency(item.amount, false)]));
        tableRows.push([{ content: 'Total Non-Current Assets', styles: { fontStyle: 'bold' } }, { content: formatThaiCurrency(totalNonCurrentAssets, false), styles: { fontStyle: 'bold' } }]);

        tableRows.push([{ content: 'TOTAL ASSETS', styles: { fontStyle: 'bold', fillColor: PDF_THEME.dark, textColor: [255, 255, 255] } },
        { content: formatThaiCurrency(totalAssets, false), styles: { fontStyle: 'bold', fillColor: PDF_THEME.dark, textColor: [255, 255, 255] } }]);

        // Liabilities
        tableRows.push([{ content: 'LIABILITIES / หนี้สิน', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [239, 68, 68], textColor: [255, 255, 255] } }]);

        tableRows.push([{ content: 'Current Liabilities', colSpan: 2, styles: { fillColor: [241, 245, 249], fontStyle: 'bold' } }]);
        data.currentLiabilities.forEach(item => tableRows.push(['   ' + item.name, formatThaiCurrency(item.amount, false)]));
        tableRows.push([{ content: 'Total Current Liabilities', styles: { fontStyle: 'bold' } }, { content: formatThaiCurrency(totalCurrentLiab, false), styles: { fontStyle: 'bold' } }]);

        tableRows.push([{ content: 'TOTAL LIABILITIES', styles: { fontStyle: 'bold' } }, { content: formatThaiCurrency(totalLiabilities, false), styles: { fontStyle: 'bold' } }]);

        // Equity
        tableRows.push([{ content: 'EQUITY / ส่วนของผู้ถือหุ้น', colSpan: 2, styles: { fontStyle: 'bold', fillColor: PDF_THEME.success, textColor: [255, 255, 255] } }]);
        data.equity.forEach(item => tableRows.push(['   ' + item.name, formatThaiCurrency(item.amount, false)]));
        tableRows.push([{ content: 'TOTAL EQUITY', styles: { fontStyle: 'bold' } }, { content: formatThaiCurrency(totalEquity, false), styles: { fontStyle: 'bold' } }]);

        tableRows.push([{ content: 'TOTAL LIABILITIES & EQUITY', styles: { fontStyle: 'bold', fillColor: PDF_THEME.dark, textColor: [255, 255, 255] } },
        { content: formatThaiCurrency(totalLiabEquity, false), styles: { fontStyle: 'bold', fillColor: PDF_THEME.dark, textColor: [255, 255, 255] } }]);

        autoTable(this.doc, {
            startY: this.currentY,
            body: tableRows,
            styles: { fontSize: 9 },
            columnStyles: {
                0: { cellWidth: 120 },
                1: { cellWidth: 50, halign: 'right' }
            },
            theme: 'grid'
        });

        this.addFooter();
        return this.doc.output('blob');
    }

    /**
     * Generate Pay Slip PDF
     */
    generatePaySlip(employeeData: {
        name: string;
        position: string;
        department: string;
        employeeId: string;
        period: string;
        earnings: { name: string; amount: number }[];
        deductions: { name: string; amount: number }[];
        bankAccount?: string;
    }, companyInfo: CompanyInfo): Blob {
        this.addHeader('Pay Slip / สลิปเงินเดือน', companyInfo.name);

        this.currentY = 50;

        // Employee Info Box
        this.doc.setFillColor(248, 250, 252);
        this.doc.roundedRect(PDF_THEME.margin, this.currentY, this.pageWidth - 2 * PDF_THEME.margin, 30, 3, 3, 'F');

        this.doc.setFontSize(10);
        this.doc.setTextColor(...PDF_THEME.dark);

        const col1X = PDF_THEME.margin + 5;
        const col2X = this.pageWidth / 2 + 10;

        this.doc.text(`Employee: ${employeeData.name}`, col1X, this.currentY + 8);
        this.doc.text(`ID: ${employeeData.employeeId}`, col2X, this.currentY + 8);
        this.doc.text(`Position: ${employeeData.position}`, col1X, this.currentY + 16);
        this.doc.text(`Department: ${employeeData.department}`, col2X, this.currentY + 16);
        this.doc.text(`Pay Period: ${employeeData.period}`, col1X, this.currentY + 24);
        if (employeeData.bankAccount) {
            this.doc.text(`Bank Account: ${employeeData.bankAccount}`, col2X, this.currentY + 24);
        }

        this.currentY += 40;

        // Earnings & Deductions side by side
        const halfWidth = (this.pageWidth - 3 * PDF_THEME.margin) / 2;

        // Earnings
        const earningsTotal = employeeData.earnings.reduce((s, e) => s + e.amount, 0);
        autoTable(this.doc, {
            startY: this.currentY,
            head: [[{ content: 'Earnings / รายได้', colSpan: 2, styles: { fillColor: PDF_THEME.success } }]],
            body: employeeData.earnings.map(e => [e.name, formatThaiCurrency(e.amount, false)]),
            foot: [['Total', formatThaiCurrency(earningsTotal, false)]],
            styles: { fontSize: 9 },
            footStyles: { fontStyle: 'bold' },
            columnStyles: { 1: { halign: 'right' } },
            margin: { left: PDF_THEME.margin, right: this.pageWidth / 2 + 5 }
        });

        // Deductions
        const deductionsTotal = employeeData.deductions.reduce((s, d) => s + d.amount, 0);
        autoTable(this.doc, {
            startY: this.currentY,
            head: [[{ content: 'Deductions / หักภาษี', colSpan: 2, styles: { fillColor: PDF_THEME.danger } }]],
            body: employeeData.deductions.map(d => [d.name, formatThaiCurrency(d.amount, false)]),
            foot: [['Total', formatThaiCurrency(deductionsTotal, false)]],
            styles: { fontSize: 9 },
            footStyles: { fontStyle: 'bold' },
            columnStyles: { 1: { halign: 'right' } },
            margin: { left: this.pageWidth / 2 + 5, right: PDF_THEME.margin }
        });

        // Net Pay
        const netPay = earningsTotal - deductionsTotal;
        this.currentY = Math.max(
            (this.doc as any).lastAutoTable?.finalY || this.currentY,
            this.currentY
        ) + 15;

        this.doc.setFillColor(...PDF_THEME.primary);
        this.doc.roundedRect(PDF_THEME.margin, this.currentY, this.pageWidth - 2 * PDF_THEME.margin, 25, 3, 3, 'F');

        this.doc.setFontSize(12);
        this.doc.setTextColor(255, 255, 255);
        this.doc.text('Net Pay / เงินเดือนสุทธิ', PDF_THEME.margin + 10, this.currentY + 10);
        this.doc.setFontSize(16);
        this.doc.text(formatThaiCurrency(netPay), this.pageWidth - PDF_THEME.margin - 10, this.currentY + 15, { align: 'right' });

        // Thai words
        this.doc.setFontSize(8);
        this.doc.text(`(${numberToThaiWord(netPay)})`, this.pageWidth - PDF_THEME.margin - 10, this.currentY + 21, { align: 'right' });

        this.addFooter();
        return this.doc.output('blob');
    }

    /**
     * Get the PDF document for additional customization
     */
    getDocument(): jsPDF {
        return this.doc;
    }

    /**
     * Save the PDF with filename
     */
    save(filename: string) {
        this.doc.save(filename);
    }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Quick function to generate and download Trial Balance PDF
 */
export const downloadTrialBalancePDF = (
    companyInfo: CompanyInfo,
    periodStart: string,
    periodEnd: string,
    items: TrialBalanceItem[]
) => {
    const generator = new PremiumPDFGenerator();
    const blob = generator.generateTrialBalance(
        { companyInfo, periodStart, periodEnd },
        items
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TrialBalance_${periodEnd.replace(/\//g, '-')}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/**
 * Quick function to generate and download P&L PDF
 */
export const downloadProfitLossPDF = (data: ProfitLossData) => {
    const generator = new PremiumPDFGenerator();
    const blob = generator.generateProfitLoss(data);

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ProfitLoss_${data.periodEnd.replace(/\//g, '-')}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/**
 * Quick function to generate and download Balance Sheet PDF
 */
export const downloadBalanceSheetPDF = (data: BalanceSheetData) => {
    const generator = new PremiumPDFGenerator();
    const blob = generator.generateBalanceSheet(data);

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BalanceSheet_${data.periodEnd.replace(/\//g, '-')}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export default PremiumPDFGenerator;

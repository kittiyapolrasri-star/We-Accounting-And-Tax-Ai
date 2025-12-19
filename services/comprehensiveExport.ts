/**
 * Comprehensive Export Service
 * 
 * รวมฟังก์ชัน Export ทั้งหมดสำหรับ:
 * - งบการเงิน (Financial Statements)
 * - รายงานภาษี (Tax Reports)
 * - ทะเบียนสินทรัพย์ (Fixed Assets)
 * - ผังบัญชี (Chart of Accounts)
 * - รายงาน Management
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { PostedGLEntry, Client, Staff, DocumentRecord, FixedAsset } from '../types';

// ============================================================================
// THAI HELPERS
// ============================================================================

const THAI_MONTHS = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

export const formatThaiDate = (date: Date | string, short = false): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const day = d.getDate();
    const month = short ? THAI_MONTHS[d.getMonth()].slice(0, 3) : THAI_MONTHS[d.getMonth()];
    const buddhistYear = d.getFullYear() + 543;
    return `${day} ${month} ${buddhistYear}`;
};

export const formatThaiCurrency = (amount: number): string => {
    return Math.abs(amount).toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

// ============================================================================
// PDF THEME
// ============================================================================

const PDF_THEME = {
    primary: [59, 130, 246] as [number, number, number],
    secondary: [100, 116, 139] as [number, number, number],
    success: [34, 197, 94] as [number, number, number],
    danger: [239, 68, 68] as [number, number, number],
    dark: [30, 41, 59] as [number, number, number],
    light: [248, 250, 252] as [number, number, number],
    headerSize: 16,
    subHeaderSize: 12,
    bodySize: 10,
    smallSize: 8,
    margin: 15,
};

// ============================================================================
// PDF HELPER CLASS
// ============================================================================

class PDFBuilder {
    doc: jsPDF;
    pageWidth: number;
    pageHeight: number;
    currentY: number;
    margin: number;

    constructor(orientation: 'p' | 'l' = 'p') {
        this.doc = new jsPDF(orientation, 'mm', 'a4');
        this.pageWidth = this.doc.internal.pageSize.getWidth();
        this.pageHeight = this.doc.internal.pageSize.getHeight();
        this.margin = PDF_THEME.margin;
        this.currentY = this.margin;
    }

    addHeader(title: string, subtitle?: string): this {
        this.doc.setFillColor(...PDF_THEME.primary);
        this.doc.rect(0, 0, this.pageWidth, 35, 'F');

        this.doc.setTextColor(255, 255, 255);
        this.doc.setFontSize(PDF_THEME.headerSize);
        this.doc.text(title, this.pageWidth / 2, 15, { align: 'center' });

        if (subtitle) {
            this.doc.setFontSize(PDF_THEME.bodySize);
            this.doc.text(subtitle, this.pageWidth / 2, 23, { align: 'center' });
        }

        this.doc.setTextColor(0, 0, 0);
        this.currentY = 45;
        return this;
    }

    addCompanyInfo(name: string, taxId: string, address?: string): this {
        this.doc.setFontSize(PDF_THEME.subHeaderSize);
        this.doc.setTextColor(...PDF_THEME.dark);
        this.doc.text(name, this.margin, this.currentY);

        this.doc.setFontSize(PDF_THEME.smallSize);
        this.doc.setTextColor(...PDF_THEME.secondary);
        this.currentY += 6;
        this.doc.text(`Tax ID: ${taxId}`, this.margin, this.currentY);

        if (address) {
            this.currentY += 5;
            this.doc.text(address, this.margin, this.currentY);
        }

        this.doc.setTextColor(0, 0, 0);
        this.currentY += 10;
        return this;
    }

    addPeriod(startDate: string, endDate: string): this {
        this.doc.setFontSize(PDF_THEME.bodySize);
        this.doc.text(
            `Period: ${startDate} - ${endDate}`,
            this.pageWidth - this.margin,
            50,
            { align: 'right' }
        );
        return this;
    }

    addSection(title: string, color?: [number, number, number]): this {
        this.currentY += 5;
        this.doc.setFillColor(...(color || PDF_THEME.secondary));
        this.doc.rect(this.margin, this.currentY, this.pageWidth - 2 * this.margin, 8, 'F');

        this.doc.setFontSize(PDF_THEME.bodySize);
        this.doc.setTextColor(255, 255, 255);
        this.doc.text(title, this.margin + 3, this.currentY + 5.5);

        this.doc.setTextColor(0, 0, 0);
        this.currentY += 12;
        return this;
    }

    addTable(headers: string[], data: (string | number)[][], options?: {
        foot?: (string | number)[];
        columnWidths?: number[];
        startY?: number;
    }): this {
        const startY = options?.startY || this.currentY;

        autoTable(this.doc, {
            startY,
            head: [headers],
            body: data,
            foot: options?.foot ? [options.foot] : undefined,
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
            columnStyles: options?.columnWidths ?
                options.columnWidths.reduce((acc, w, i) => ({ ...acc, [i]: { cellWidth: w } }), {}) :
                undefined,
            alternateRowStyles: { fillColor: [250, 250, 250] }
        });

        this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
        return this;
    }

    addFooter(): this {
        const footerY = this.pageHeight - 10;

        this.doc.setDrawColor(...PDF_THEME.secondary);
        this.doc.setLineWidth(0.3);
        this.doc.line(this.margin, footerY - 5, this.pageWidth - this.margin, footerY - 5);

        this.doc.setFontSize(7);
        this.doc.setTextColor(...PDF_THEME.secondary);
        this.doc.text(
            `Generated by WE Accounting & Tax AI | ${formatThaiDate(new Date())}`,
            this.margin,
            footerY
        );

        const pageCount = this.doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            this.doc.setPage(i);
            this.doc.text(
                `Page ${i} of ${pageCount}`,
                this.pageWidth - this.margin,
                footerY,
                { align: 'right' }
            );
        }

        return this;
    }

    save(filename: string): void {
        this.doc.save(filename);
    }

    getBlob(): Blob {
        return this.doc.output('blob');
    }
}

// ============================================================================
// FINANCIAL STATEMENTS
// ============================================================================

/**
 * Cash Flow Statement PDF
 */
export const exportCashFlowPDF = (
    companyName: string,
    period: string,
    data: {
        operating: { name: string; amount: number }[];
        investing: { name: string; amount: number }[];
        financing: { name: string; amount: number }[];
        beginningCash: number;
        endingCash: number;
    }
): void => {
    const pdf = new PDFBuilder();
    pdf.addHeader('Statement of Cash Flows', 'งบกระแสเงินสด');
    pdf.addCompanyInfo(companyName, '-');

    const sumItems = (items: { amount: number }[]) => items.reduce((s, i) => s + i.amount, 0);

    const operatingTotal = sumItems(data.operating);
    const investingTotal = sumItems(data.investing);
    const financingTotal = sumItems(data.financing);
    const netChange = operatingTotal + investingTotal + financingTotal;

    // Operating Activities
    pdf.addSection('กระแสเงินสดจากกิจกรรมดำเนินงาน', PDF_THEME.success);
    const operatingData = data.operating.map(i => ['   ' + i.name, formatThaiCurrency(i.amount)]);
    operatingData.push(['Net Cash from Operating', formatThaiCurrency(operatingTotal)]);
    pdf.addTable(['Description', 'Amount (฿)'], operatingData);

    // Investing Activities
    pdf.addSection('กระแสเงินสดจากกิจกรรมลงทุน', [100, 116, 139]);
    const investingData = data.investing.map(i => ['   ' + i.name, formatThaiCurrency(i.amount)]);
    investingData.push(['Net Cash from Investing', formatThaiCurrency(investingTotal)]);
    pdf.addTable(['Description', 'Amount (฿)'], investingData);

    // Financing Activities
    pdf.addSection('กระแสเงินสดจากกิจกรรมจัดหาเงิน', [59, 130, 246]);
    const financingData = data.financing.map(i => ['   ' + i.name, formatThaiCurrency(i.amount)]);
    financingData.push(['Net Cash from Financing', formatThaiCurrency(financingTotal)]);
    pdf.addTable(['Description', 'Amount (฿)'], financingData);

    // Summary
    pdf.addSection('สรุป', PDF_THEME.dark);
    pdf.addTable(
        ['รายการ', 'จำนวนเงิน'],
        [
            ['เงินสดต้นงวด', formatThaiCurrency(data.beginningCash)],
            ['เงินสดเพิ่มขึ้น(ลดลง)สุทธิ', formatThaiCurrency(netChange)],
            ['เงินสดปลายงวด', formatThaiCurrency(data.endingCash)]
        ]
    );

    pdf.addFooter();
    pdf.save(`CashFlow_${period.replace(/\//g, '-')}.pdf`);
};

/**
 * Trial Balance PDF
 */
export const exportTrialBalancePDF = (
    companyName: string,
    taxId: string,
    period: string,
    entries: { accountCode: string; accountName: string; debit: number; credit: number }[]
): void => {
    const pdf = new PDFBuilder();
    pdf.addHeader('Trial Balance', 'งบทดลอง');
    pdf.addCompanyInfo(companyName, taxId);
    pdf.addPeriod(period.split(' - ')[0] || period, period.split(' - ')[1] || period);

    const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = entries.reduce((s, e) => s + e.credit, 0);

    const tableData = entries.map(e => [
        e.accountCode,
        e.accountName,
        e.debit > 0 ? formatThaiCurrency(e.debit) : '-',
        e.credit > 0 ? formatThaiCurrency(e.credit) : '-'
    ]);

    pdf.addTable(
        ['Account Code', 'Account Name', 'Debit', 'Credit'],
        tableData,
        {
            foot: ['', 'Total', formatThaiCurrency(totalDebit), formatThaiCurrency(totalCredit)],
            columnWidths: [25, 80, 35, 35]
        }
    );

    // Balance Check
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
    pdf.doc.setFillColor(...(isBalanced ? PDF_THEME.success : PDF_THEME.danger));
    pdf.doc.roundedRect(pdf.margin, pdf.currentY, 80, 10, 2, 2, 'F');
    pdf.doc.setTextColor(255, 255, 255);
    pdf.doc.setFontSize(10);
    pdf.doc.text(
        isBalanced ? '✓ Balance Verified' : '✗ Out of Balance: ' + formatThaiCurrency(Math.abs(totalDebit - totalCredit)),
        pdf.margin + 5,
        pdf.currentY + 7
    );

    pdf.addFooter();
    pdf.save(`TrialBalance_${period.replace(/\//g, '-')}.pdf`);
};

/**
 * Financial Notes PDF
 */
export const exportFinancialNotesPDF = (
    companyName: string,
    taxId: string,
    period: string,
    notes: {
        title: string;
        content: string;
        table?: { headers: string[]; data: (string | number)[][] };
    }[]
): void => {
    const pdf = new PDFBuilder();
    pdf.addHeader('Notes to Financial Statements', 'หมายเหตุประกอบงบการเงิน');
    pdf.addCompanyInfo(companyName, taxId);

    notes.forEach((note, idx) => {
        pdf.addSection(`${idx + 1}. ${note.title}`);

        pdf.doc.setFontSize(9);
        pdf.doc.setTextColor(...PDF_THEME.dark);

        // Split content into lines
        const lines = pdf.doc.splitTextToSize(note.content, pdf.pageWidth - 2 * pdf.margin);
        pdf.doc.text(lines, pdf.margin, pdf.currentY);
        pdf.currentY += lines.length * 5 + 5;

        if (note.table) {
            pdf.addTable(note.table.headers, note.table.data);
        }
    });

    pdf.addFooter();
    pdf.save(`FinancialNotes_${period.replace(/\//g, '-')}.pdf`);
};

/**
 * Financial Ratios PDF
 */
export const exportFinancialRatiosPDF = (
    companyName: string,
    period: string,
    ratios: {
        category: string;
        items: { name: string; value: number; unit: string; benchmark?: string }[];
    }[]
): void => {
    const pdf = new PDFBuilder();
    pdf.addHeader('Financial Ratios Analysis', 'การวิเคราะห์อัตราส่วนทางการเงิน');
    pdf.addCompanyInfo(companyName, '-');

    ratios.forEach(category => {
        pdf.addSection(category.category);

        const tableData = category.items.map(item => [
            item.name,
            `${item.value.toFixed(2)} ${item.unit}`,
            item.benchmark || '-'
        ]);

        pdf.addTable(['Ratio', 'Value', 'Benchmark'], tableData);
    });

    pdf.addFooter();
    pdf.save(`FinancialRatios_${period.replace(/\//g, '-')}.pdf`);
};

// ============================================================================
// FIXED ASSETS
// ============================================================================

/**
 * Fixed Asset Register PDF
 */
export const exportFixedAssetsPDF = (
    companyName: string,
    taxId: string,
    assets: FixedAsset[]
): void => {
    const pdf = new PDFBuilder('l'); // Landscape
    pdf.addHeader('Fixed Asset Register', 'ทะเบียนสินทรัพย์ถาวร');
    pdf.addCompanyInfo(companyName, taxId);

    const totalCost = assets.reduce((s, a) => s + a.cost, 0);
    const totalAccumDep = assets.reduce((s, a) => s + a.accumulated_depreciation_bf + a.current_month_depreciation, 0);
    const totalNBV = totalCost - totalAccumDep;

    const tableData = assets.map(a => [
        a.asset_code,
        a.name.substring(0, 30),
        formatThaiDate(a.acquisition_date, true),
        formatThaiCurrency(a.cost),
        a.useful_life_years.toString(),
        formatThaiCurrency(a.accumulated_depreciation_bf + a.current_month_depreciation),
        formatThaiCurrency(a.cost - a.accumulated_depreciation_bf - a.current_month_depreciation)
    ]);

    pdf.addTable(
        ['Code', 'Description', 'Acquired', 'Cost', 'Life', 'Accum. Dep.', 'NBV'],
        tableData,
        {
            foot: ['', 'Total', '', formatThaiCurrency(totalCost), '', formatThaiCurrency(totalAccumDep), formatThaiCurrency(totalNBV)],
            columnWidths: [20, 60, 25, 35, 15, 35, 35]
        }
    );

    pdf.addFooter();
    pdf.save(`FixedAssets_${new Date().toISOString().slice(0, 10)}.pdf`);
};

/**
 * Fixed Asset Register Excel
 */
export const exportFixedAssetsExcel = (assets: FixedAsset[], companyName: string): void => {
    const headers = [
        'Asset Code', 'Description', 'Category', 'Acquisition Date', 'Cost',
        'Residual Value', 'Useful Life (Years)', 'Accumulated Depreciation BF',
        'Current Month Depreciation', 'Total Accum. Depreciation', 'Net Book Value'
    ];

    const data = assets.map(a => [
        a.asset_code,
        a.name,
        a.category,
        a.acquisition_date,
        a.cost,
        a.residual_value,
        a.useful_life_years,
        a.accumulated_depreciation_bf,
        a.current_month_depreciation,
        a.accumulated_depreciation_bf + a.current_month_depreciation,
        a.cost - a.accumulated_depreciation_bf - a.current_month_depreciation
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fixed Assets');

    XLSX.writeFile(wb, `FixedAssets_${companyName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

// ============================================================================
// CHART OF ACCOUNTS
// ============================================================================

/**
 * Chart of Accounts Excel (Import/Export Template)
 */
export const exportChartOfAccountsExcel = (
    accounts: { code: string; name: string; type: string; parentCode?: string; isActive: boolean }[],
    companyName?: string
): void => {
    const headers = ['Account Code', 'Account Name', 'Account Type', 'Parent Code', 'Is Active'];

    const data = accounts.map(a => [
        a.code,
        a.name,
        a.type,
        a.parentCode || '',
        a.isActive ? 'Yes' : 'No'
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

    // Set column widths
    ws['!cols'] = [
        { wch: 15 }, // Account Code
        { wch: 50 }, // Account Name
        { wch: 15 }, // Type
        { wch: 15 }, // Parent
        { wch: 10 }  // Active
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Chart of Accounts');

    XLSX.writeFile(wb, `ChartOfAccounts_${companyName || 'template'}_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

// ============================================================================
// MANAGEMENT REPORTS
// ============================================================================

/**
 * CEO Executive Summary PDF
 */
export const exportExecutiveSummaryPDF = (
    companyName: string,
    period: string,
    data: {
        kpis: { name: string; value: string; change?: string; trend?: 'up' | 'down' | 'stable' }[];
        topClients: { name: string; revenue: number; percentage: number }[];
        cashPosition: { account: string; balance: number }[];
        alerts: string[];
    }
): void => {
    const pdf = new PDFBuilder();
    pdf.addHeader('Executive Summary', 'รายงานสรุปผู้บริหาร');
    pdf.addCompanyInfo(companyName, '-');
    pdf.addPeriod(period, period);

    // KPIs Section
    pdf.addSection('Key Performance Indicators', PDF_THEME.primary);
    const kpiData = data.kpis.map(k => [
        k.name,
        k.value,
        k.change || '-',
        k.trend === 'up' ? '↑' : k.trend === 'down' ? '↓' : '→'
    ]);
    pdf.addTable(['Metric', 'Value', 'Change', 'Trend'], kpiData);

    // Top Clients
    pdf.addSection('Top Revenue Clients', PDF_THEME.success);
    const clientData = data.topClients.map(c => [
        c.name,
        formatThaiCurrency(c.revenue),
        `${c.percentage.toFixed(1)}%`
    ]);
    pdf.addTable(['Client', 'Revenue', '% of Total'], clientData);

    // Cash Position
    pdf.addSection('Cash Position', [59, 130, 246]);
    const cashData = data.cashPosition.map(c => [c.account, formatThaiCurrency(c.balance)]);
    const totalCash = data.cashPosition.reduce((s, c) => s + c.balance, 0);
    pdf.addTable(['Account', 'Balance'], cashData, {
        foot: ['Total Cash', formatThaiCurrency(totalCash)]
    });

    // Alerts
    if (data.alerts.length > 0) {
        pdf.addSection('Alerts & Notifications', PDF_THEME.danger);
        data.alerts.forEach((alert, idx) => {
            pdf.doc.setFontSize(9);
            pdf.doc.text(`${idx + 1}. ${alert}`, pdf.margin + 5, pdf.currentY);
            pdf.currentY += 6;
        });
    }

    pdf.addFooter();
    pdf.save(`ExecutiveSummary_${period.replace(/\//g, '-')}.pdf`);
};

/**
 * Staff Workload Report PDF
 */
export const exportStaffWorkloadPDF = (
    companyName: string,
    period: string,
    staff: {
        name: string;
        position: string;
        clientCount: number;
        tasksPending: number;
        tasksCompleted: number;
        utilizationPercent: number;
    }[]
): void => {
    const pdf = new PDFBuilder();
    pdf.addHeader('Staff Workload Report', 'รายงานภาระงานพนักงาน');
    pdf.addCompanyInfo(companyName, '-');

    const tableData = staff.map(s => [
        s.name,
        s.position,
        s.clientCount.toString(),
        s.tasksPending.toString(),
        s.tasksCompleted.toString(),
        `${s.utilizationPercent}%`
    ]);

    pdf.addTable(
        ['Name', 'Position', 'Clients', 'Pending', 'Completed', 'Utilization'],
        tableData
    );

    // Summary statistics
    const avgUtilization = staff.reduce((s, st) => s + st.utilizationPercent, 0) / staff.length;
    const totalPending = staff.reduce((s, st) => s + st.tasksPending, 0);
    const totalCompleted = staff.reduce((s, st) => s + st.tasksCompleted, 0);

    pdf.addSection('Summary', PDF_THEME.dark);
    pdf.addTable(
        ['Metric', 'Value'],
        [
            ['Total Staff', staff.length.toString()],
            ['Average Utilization', `${avgUtilization.toFixed(1)}%`],
            ['Total Pending Tasks', totalPending.toString()],
            ['Total Completed Tasks', totalCompleted.toString()],
            ['Completion Rate', `${((totalCompleted / (totalPending + totalCompleted)) * 100).toFixed(1)}%`]
        ]
    );

    pdf.addFooter();
    pdf.save(`StaffWorkload_${period.replace(/\//g, '-')}.pdf`);
};

// ============================================================================
// CLIENT & STAFF LISTS
// ============================================================================

/**
 * Client Directory Excel
 */
export const exportClientsExcel = (clients: Client[]): void => {
    const headers = [
        'Client ID', 'Company Name', 'Tax ID', 'Industry', 'Status',
        'Contact Person', 'Contact Email', 'Contact Phone',
        'Assigned Staff', 'Last Closing Date'
    ];

    const data = clients.map(c => [
        c.id,
        c.name,
        c.tax_id,
        c.industry,
        c.status,
        c.contact_person,
        c.contact_email || '',
        c.contact_phone || '',
        c.assigned_staff_id,
        c.last_closing_date
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    ws['!cols'] = [
        { wch: 12 }, { wch: 35 }, { wch: 15 }, { wch: 15 }, { wch: 10 },
        { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 12 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clients');

    XLSX.writeFile(wb, `ClientDirectory_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

/**
 * Staff List Excel
 */
export const exportStaffExcel = (staff: Staff[]): void => {
    const headers = [
        'Staff ID', 'Name', 'Email', 'Role', 'Status',
        'Active Tasks', 'Phone', 'Department'
    ];

    const data = staff.map(s => [
        s.id,
        s.name,
        s.email,
        s.role,
        s.status || 'active',
        s.active_tasks || 0,
        s.phone || '',
        s.department || ''
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Staff');

    XLSX.writeFile(wb, `StaffList_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

// ============================================================================
// JOURNAL ENTRIES
// ============================================================================

/**
 * Journal Entries Excel
 */
export const exportJournalEntriesExcel = (
    entries: PostedGLEntry[],
    clientName: string,
    period: string
): void => {
    const headers = [
        'Date', 'Document No', 'Account Code', 'Account Name',
        'Debit', 'Credit', 'Description', 'Department', 'Period'
    ];

    const data = entries.map(e => [
        e.date,
        e.doc_no || '',
        e.account_code,
        e.account_name,
        e.debit,
        e.credit,
        e.description || '',
        e.department_code || '',
        e.period || ''
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

    // Add totals row
    const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
    XLSX.utils.sheet_add_aoa(ws, [['', '', '', 'TOTAL', totalDebit, totalCredit, '', '', '']], { origin: -1 });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Journal Entries');

    XLSX.writeFile(wb, `JournalEntries_${clientName}_${period.replace(/\//g, '-')}.xlsx`);
};

// ============================================================================
// E-COMMERCE
// ============================================================================

/**
 * E-Commerce Orders Summary PDF
 */
export const exportEcommerceOrdersPDF = (
    companyName: string,
    period: string,
    platforms: {
        name: string;
        orderCount: number;
        totalSales: number;
        totalFees: number;
        netReceived: number;
    }[]
): void => {
    const pdf = new PDFBuilder();
    pdf.addHeader('E-Commerce Sales Report', 'รายงานยอดขาย E-Commerce');
    pdf.addCompanyInfo(companyName, '-');
    pdf.addPeriod(period.split(' - ')[0] || period, period.split(' - ')[1] || period);

    const tableData = platforms.map(p => [
        p.name,
        p.orderCount.toString(),
        formatThaiCurrency(p.totalSales),
        formatThaiCurrency(p.totalFees),
        formatThaiCurrency(p.netReceived)
    ]);

    const totals = platforms.reduce((acc, p) => ({
        orders: acc.orders + p.orderCount,
        sales: acc.sales + p.totalSales,
        fees: acc.fees + p.totalFees,
        net: acc.net + p.netReceived
    }), { orders: 0, sales: 0, fees: 0, net: 0 });

    pdf.addTable(
        ['Platform', 'Orders', 'Total Sales', 'Platform Fees', 'Net Received'],
        tableData,
        {
            foot: ['TOTAL', totals.orders.toString(), formatThaiCurrency(totals.sales),
                formatThaiCurrency(totals.fees), formatThaiCurrency(totals.net)]
        }
    );

    pdf.addFooter();
    pdf.save(`EcommerceReport_${period.replace(/[\s\/]/g, '-')}.pdf`);
};

/**
 * E-Commerce Orders Excel
 */
export const exportEcommerceOrdersExcel = (
    orders: {
        platform: string;
        orderNumber: string;
        orderDate: string;
        customerName: string;
        subtotal: number;
        shippingFee: number;
        platformFee: number;
        netReceived: number;
        status: string;
    }[],
    period: string
): void => {
    const headers = [
        'Platform', 'Order Number', 'Date', 'Customer',
        'Subtotal', 'Shipping', 'Platform Fee', 'Net Received', 'Status'
    ];

    const data = orders.map(o => [
        o.platform,
        o.orderNumber,
        o.orderDate,
        o.customerName,
        o.subtotal,
        o.shippingFee,
        o.platformFee,
        o.netReceived,
        o.status
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');

    XLSX.writeFile(wb, `EcommerceOrders_${period.replace(/[\s\/]/g, '-')}.xlsx`);
};

// ============================================================================
// COMPREHENSIVE FINANCIAL PACKAGE
// ============================================================================

/**
 * Generate complete Financial Statements Package (Multi-page PDF)
 */
export const exportFinancialPackagePDF = (
    companyName: string,
    taxId: string,
    period: string,
    data: {
        balanceSheet: {
            assets: { name: string; amount: number }[];
            liabilities: { name: string; amount: number }[];
            equity: { name: string; amount: number }[];
        };
        profitLoss: {
            revenue: { name: string; amount: number }[];
            expenses: { name: string; amount: number }[];
        };
        cashFlow: {
            operating: { name: string; amount: number }[];
            investing: { name: string; amount: number }[];
            financing: { name: string; amount: number }[];
        };
    }
): void => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    // Cover Page
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, pageWidth, 297, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text('Financial Statements', pageWidth / 2, 100, { align: 'center' });
    doc.setFontSize(18);
    doc.text('งบการเงิน', pageWidth / 2, 115, { align: 'center' });

    doc.setFontSize(14);
    doc.text(companyName, pageWidth / 2, 150, { align: 'center' });
    doc.text(`Tax ID: ${taxId}`, pageWidth / 2, 160, { align: 'center' });
    doc.text(`Period: ${period}`, pageWidth / 2, 175, { align: 'center' });

    doc.setFontSize(10);
    doc.text('Generated by WE Accounting & Tax AI', pageWidth / 2, 250, { align: 'center' });
    doc.text(formatThaiDate(new Date()), pageWidth / 2, 258, { align: 'center' });

    // Page 2: Balance Sheet
    doc.addPage();
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text('Balance Sheet / งบแสดงฐานะการเงิน', pageWidth / 2, 18, { align: 'center' });

    const sumItems = (items: { amount: number }[]) => items.reduce((s, i) => s + i.amount, 0);
    const totalAssets = sumItems(data.balanceSheet.assets);
    const totalLiab = sumItems(data.balanceSheet.liabilities);
    const totalEquity = sumItems(data.balanceSheet.equity);

    const bsData: any[] = [];
    bsData.push([{ content: 'ASSETS / สินทรัพย์', colSpan: 2, styles: { fillColor: [34, 197, 94], textColor: [255, 255, 255], fontStyle: 'bold' } }]);
    data.balanceSheet.assets.forEach(a => bsData.push(['   ' + a.name, formatThaiCurrency(a.amount)]));
    bsData.push([{ content: 'Total Assets', styles: { fontStyle: 'bold' } }, { content: formatThaiCurrency(totalAssets), styles: { fontStyle: 'bold' } }]);

    bsData.push([{ content: 'LIABILITIES / หนี้สิน', colSpan: 2, styles: { fillColor: [239, 68, 68], textColor: [255, 255, 255], fontStyle: 'bold' } }]);
    data.balanceSheet.liabilities.forEach(l => bsData.push(['   ' + l.name, formatThaiCurrency(l.amount)]));
    bsData.push([{ content: 'Total Liabilities', styles: { fontStyle: 'bold' } }, { content: formatThaiCurrency(totalLiab), styles: { fontStyle: 'bold' } }]);

    bsData.push([{ content: 'EQUITY / ส่วนของผู้ถือหุ้น', colSpan: 2, styles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold' } }]);
    data.balanceSheet.equity.forEach(e => bsData.push(['   ' + e.name, formatThaiCurrency(e.amount)]));
    bsData.push([{ content: 'Total Equity', styles: { fontStyle: 'bold' } }, { content: formatThaiCurrency(totalEquity), styles: { fontStyle: 'bold' } }]);

    autoTable(doc, {
        startY: 40,
        body: bsData,
        styles: { fontSize: 9 },
        columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 50, halign: 'right' } },
        theme: 'grid'
    });

    // Page 3: P&L
    doc.addPage();
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text('Profit & Loss / งบกำไรขาดทุน', pageWidth / 2, 18, { align: 'center' });

    const totalRevenue = sumItems(data.profitLoss.revenue);
    const totalExpenses = sumItems(data.profitLoss.expenses);
    const netProfit = totalRevenue - totalExpenses;

    const plData: any[] = [];
    plData.push([{ content: 'REVENUE / รายได้', colSpan: 2, styles: { fillColor: [34, 197, 94], textColor: [255, 255, 255], fontStyle: 'bold' } }]);
    data.profitLoss.revenue.forEach(r => plData.push(['   ' + r.name, formatThaiCurrency(r.amount)]));
    plData.push([{ content: 'Total Revenue', styles: { fontStyle: 'bold' } }, { content: formatThaiCurrency(totalRevenue), styles: { fontStyle: 'bold' } }]);

    plData.push([{ content: 'EXPENSES / ค่าใช้จ่าย', colSpan: 2, styles: { fillColor: [239, 68, 68], textColor: [255, 255, 255], fontStyle: 'bold' } }]);
    data.profitLoss.expenses.forEach(e => plData.push(['   ' + e.name, formatThaiCurrency(e.amount)]));
    plData.push([{ content: 'Total Expenses', styles: { fontStyle: 'bold' } }, { content: formatThaiCurrency(totalExpenses), styles: { fontStyle: 'bold' } }]);

    const profitColor = netProfit >= 0 ? [34, 197, 94] : [239, 68, 68];
    plData.push([{ content: 'NET PROFIT / กำไรสุทธิ', styles: { fillColor: profitColor, textColor: [255, 255, 255], fontStyle: 'bold' } },
    { content: formatThaiCurrency(netProfit), styles: { fillColor: profitColor, textColor: [255, 255, 255], fontStyle: 'bold' } }]);

    autoTable(doc, {
        startY: 40,
        body: plData,
        styles: { fontSize: 9 },
        columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 50, halign: 'right' } },
        theme: 'grid'
    });

    // Footer on all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 2; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(`Generated by WE Accounting & Tax AI | ${formatThaiDate(new Date())}`, margin, 287);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, 287, { align: 'right' });
    }

    doc.save(`FinancialPackage_${companyName.replace(/\s/g, '_')}_${period.replace(/[\s\/]/g, '-')}.pdf`);
};

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default {
    // Financial Statements
    exportCashFlowPDF,
    exportTrialBalancePDF,
    exportFinancialNotesPDF,
    exportFinancialRatiosPDF,
    exportFinancialPackagePDF,

    // Fixed Assets
    exportFixedAssetsPDF,
    exportFixedAssetsExcel,

    // Chart of Accounts
    exportChartOfAccountsExcel,

    // Management Reports
    exportExecutiveSummaryPDF,
    exportStaffWorkloadPDF,

    // Lists
    exportClientsExcel,
    exportStaffExcel,
    exportJournalEntriesExcel,

    // E-Commerce
    exportEcommerceOrdersPDF,
    exportEcommerceOrdersExcel,

    // Utilities
    formatThaiDate,
    formatThaiCurrency
};

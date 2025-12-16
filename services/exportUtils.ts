/**
 * Export Utilities
 * PDF และ Excel Export สำหรับรายงานและข้อมูลต่างๆ
 */

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Extend jsPDF type for autoTable
declare module 'jspdf' {
    interface jsPDF {
        autoTable: (options: any) => jsPDF;
    }
}

// ============================================================================
// PDF EXPORT
// ============================================================================

export interface PDFExportOptions {
    title: string;
    subtitle?: string;
    orientation?: 'portrait' | 'landscape';
    pageSize?: 'a4' | 'letter';
    fontSize?: number;
    headerColor?: [number, number, number];
}

const DEFAULT_PDF_OPTIONS: PDFExportOptions = {
    title: 'รายงาน',
    orientation: 'portrait',
    pageSize: 'a4',
    fontSize: 10,
    headerColor: [59, 130, 246] // Blue
};

/**
 * สร้าง PDF จากตาราง
 */
export function exportTableToPDF(
    headers: string[],
    data: (string | number)[][],
    options: Partial<PDFExportOptions> = {}
): void {
    const opts = { ...DEFAULT_PDF_OPTIONS, ...options };

    const doc = new jsPDF({
        orientation: opts.orientation,
        unit: 'mm',
        format: opts.pageSize
    });

    // Add Thai font (Note: In production, import a Thai font)
    // doc.addFont(...);

    // Title
    doc.setFontSize(16);
    doc.text(opts.title, 14, 20);

    if (opts.subtitle) {
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(opts.subtitle, 14, 28);
    }

    // Table
    (doc as any).autoTable({
        head: [headers],
        body: data,
        startY: opts.subtitle ? 35 : 28,
        styles: {
            fontSize: opts.fontSize,
            cellPadding: 3,
        },
        headStyles: {
            fillColor: opts.headerColor,
            textColor: [255, 255, 255],
            fontStyle: 'bold'
        },
        alternateRowStyles: {
            fillColor: [245, 247, 250]
        }
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128);
        doc.text(
            `หน้า ${i} จาก ${pageCount} | สร้างเมื่อ ${new Date().toLocaleString('th-TH')}`,
            14,
            doc.internal.pageSize.height - 10
        );
    }

    // Download
    const filename = `${opts.title.replace(/\s+/g, '_')}_${formatDateForFilename()}.pdf`;
    doc.save(filename);
}

/**
 * สร้าง PDF รายงานทั่วไป
 */
export function exportReportToPDF(
    content: {
        title: string;
        subtitle?: string;
        sections: Array<{
            heading: string;
            text?: string;
            table?: {
                headers: string[];
                data: (string | number)[][];
            };
        }>;
    },
    options: Partial<PDFExportOptions> = {}
): void {
    const opts = { ...DEFAULT_PDF_OPTIONS, ...options };

    const doc = new jsPDF({
        orientation: opts.orientation,
        unit: 'mm',
        format: opts.pageSize
    });

    let yPosition = 20;

    // Title
    doc.setFontSize(18);
    doc.text(content.title, 14, yPosition);
    yPosition += 10;

    if (content.subtitle) {
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(content.subtitle, 14, yPosition);
        yPosition += 10;
    }

    // Sections
    content.sections.forEach(section => {
        // Check if need new page
        if (yPosition > doc.internal.pageSize.height - 40) {
            doc.addPage();
            yPosition = 20;
        }

        // Section heading
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text(section.heading, 14, yPosition);
        yPosition += 8;

        // Text content
        if (section.text) {
            doc.setFontSize(10);
            doc.setTextColor(60);
            const lines = doc.splitTextToSize(section.text, doc.internal.pageSize.width - 28);
            doc.text(lines, 14, yPosition);
            yPosition += lines.length * 5 + 5;
        }

        // Table content
        if (section.table) {
            (doc as any).autoTable({
                head: [section.table.headers],
                body: section.table.data,
                startY: yPosition,
                styles: { fontSize: 9 },
                headStyles: { fillColor: opts.headerColor }
            });
            yPosition = (doc as any).lastAutoTable.finalY + 10;
        }
    });

    const filename = `${content.title.replace(/\s+/g, '_')}_${formatDateForFilename()}.pdf`;
    doc.save(filename);
}

// ============================================================================
// EXCEL EXPORT
// ============================================================================

export interface ExcelExportOptions {
    sheetName?: string;
    includeHeaders?: boolean;
    columnWidths?: number[];
    headerStyle?: {
        bold?: boolean;
        backgroundColor?: string;
    };
}

const DEFAULT_EXCEL_OPTIONS: ExcelExportOptions = {
    sheetName: 'Sheet1',
    includeHeaders: true,
    headerStyle: {
        bold: true,
        backgroundColor: '#3B82F6'
    }
};

/**
 * Export ข้อมูลเป็น Excel
 */
export function exportToExcel(
    headers: string[],
    data: (string | number | null | undefined)[][],
    filename: string,
    options: Partial<ExcelExportOptions> = {}
): void {
    const opts = { ...DEFAULT_EXCEL_OPTIONS, ...options };

    // Prepare data with headers
    const worksheetData = opts.includeHeaders ? [headers, ...data] : data;

    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Set column widths
    if (opts.columnWidths) {
        worksheet['!cols'] = opts.columnWidths.map(w => ({ wch: w }));
    } else {
        // Auto-width based on content
        const maxWidths = headers.map((h, i) => {
            const headerWidth = h.length;
            const dataMaxWidth = Math.max(...data.map(row =>
                String(row[i] ?? '').length
            ));
            return Math.max(headerWidth, dataMaxWidth) + 2;
        });
        worksheet['!cols'] = maxWidths.map(w => ({ wch: Math.min(w, 50) }));
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, opts.sheetName);

    // Download
    const finalFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    XLSX.writeFile(workbook, finalFilename);
}

/**
 * Export หลาย sheet เป็น Excel
 */
export function exportMultiSheetExcel(
    sheets: Array<{
        name: string;
        headers: string[];
        data: (string | number | null | undefined)[][];
    }>,
    filename: string
): void {
    const workbook = XLSX.utils.book_new();

    sheets.forEach(sheet => {
        const worksheetData = [sheet.headers, ...sheet.data];
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

        // Auto-width
        const maxWidths = sheet.headers.map((h, i) => {
            const headerWidth = h.length;
            const dataMaxWidth = Math.max(...sheet.data.map(row =>
                String(row[i] ?? '').length
            ));
            return Math.max(headerWidth, dataMaxWidth) + 2;
        });
        worksheet['!cols'] = maxWidths.map(w => ({ wch: Math.min(w, 50) }));

        XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
    });

    const finalFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    XLSX.writeFile(workbook, finalFilename);
}

// ============================================================================
// ACCOUNTING-SPECIFIC EXPORTS
// ============================================================================

import type { PostedGLEntry, Client, DocumentRecord } from '../types';

/**
 * Export GL entries to Excel
 */
export function exportGLEntriesToExcel(
    entries: PostedGLEntry[],
    clientName: string,
    period: string
): void {
    const headers = [
        'วันที่',
        'เลขที่เอกสาร',
        'รายละเอียด',
        'รหัสบัญชี',
        'ชื่อบัญชี',
        'เดบิต',
        'เครดิต'
    ];

    const data = entries.map(entry => [
        entry.date,
        entry.doc_no,
        entry.description,
        entry.account_code,
        entry.account_name,
        entry.debit || '',
        entry.credit || ''
    ]);

    // Add totals row
    const totalDebit = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
    const totalCredit = entries.reduce((sum, e) => sum + (e.credit || 0), 0);
    data.push(['', '', 'รวมทั้งสิ้น', '', '', totalDebit, totalCredit]);

    exportToExcel(headers, data, `GL_${clientName}_${period}`);
}

/**
 * Export client list to Excel
 */
export function exportClientsToExcel(clients: Client[]): void {
    const headers = [
        'รหัสลูกค้า',
        'ชื่อบริษัท',
        'เลขประจำตัวผู้เสียภาษี',
        'อุตสาหกรรม',
        'ผู้ติดต่อ',
        'สถานะ',
        'วันที่ปิดบัญชีล่าสุด'
    ];

    const data = clients.map(client => [
        client.id,
        client.name,
        client.tax_id,
        client.industry,
        client.contact_person,
        client.status,
        client.last_closing_date
    ]);

    exportToExcel(headers, data, `ทะเบียนลูกค้า_${formatDateForFilename()}`);
}

/**
 * Export documents to Excel
 */
export function exportDocumentsToExcel(
    documents: DocumentRecord[],
    clientName?: string
): void {
    const headers = [
        'วันที่อัพโหลด',
        'ชื่อไฟล์',
        'ลูกค้า',
        'ประเภทเอกสาร',
        'จำนวนเงิน',
        'สถานะ',
        'ผู้รับผิดชอบ'
    ];

    const data = documents.map(doc => [
        doc.uploaded_at,
        doc.filename,
        doc.client_name,
        doc.ai_data?.header_data?.doc_type || '-',
        doc.amount || 0,
        doc.status,
        doc.assigned_to || '-'
    ]);

    const filename = clientName
        ? `เอกสาร_${clientName}_${formatDateForFilename()}`
        : `เอกสารทั้งหมด_${formatDateForFilename()}`;

    exportToExcel(headers, data, filename);
}

/**
 * Export VAT summary to Excel
 */
export function exportVATSummaryToExcel(
    salesVAT: Array<{
        date: string;
        invoiceNo: string;
        customerName: string;
        baseAmount: number;
        vatAmount: number;
    }>,
    purchaseVAT: Array<{
        date: string;
        invoiceNo: string;
        vendorName: string;
        baseAmount: number;
        vatAmount: number;
        isDeductible: boolean;
    }>,
    clientName: string,
    period: string
): void {
    // Sales VAT sheet
    const salesHeaders = ['วันที่', 'เลขที่ใบกำกับภาษี', 'ชื่อลูกค้า', 'ยอดก่อน VAT', 'VAT'];
    const salesData = salesVAT.map(item => [
        item.date,
        item.invoiceNo,
        item.customerName,
        item.baseAmount,
        item.vatAmount
    ]);

    // Purchase VAT sheet
    const purchaseHeaders = ['วันที่', 'เลขที่ใบกำกับภาษี', 'ชื่อผู้ขาย', 'ยอดก่อน VAT', 'VAT', 'ขอคืนได้'];
    const purchaseData = purchaseVAT.map(item => [
        item.date,
        item.invoiceNo,
        item.vendorName,
        item.baseAmount,
        item.vatAmount,
        item.isDeductible ? 'ได้' : 'ไม่ได้'
    ]);

    exportMultiSheetExcel([
        { name: 'รายงานภาษีขาย', headers: salesHeaders, data: salesData },
        { name: 'รายงานภาษีซื้อ', headers: purchaseHeaders, data: purchaseData }
    ], `VAT_${clientName}_${period}`);
}

// ============================================================================
// UTILITIES
// ============================================================================

function formatDateForFilename(): string {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
}

export default {
    exportTableToPDF,
    exportReportToPDF,
    exportToExcel,
    exportMultiSheetExcel,
    exportGLEntriesToExcel,
    exportClientsToExcel,
    exportDocumentsToExcel,
    exportVATSummaryToExcel
};

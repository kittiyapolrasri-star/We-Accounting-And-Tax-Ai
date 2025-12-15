/**
 * PDF Processing Utilities
 * Handles multi-page PDF extraction and processing
 */

import * as pdfParse from 'pdf-parse';

interface PDFPage {
    pageNumber: number;
    base64Data: string;
    text: string;
}

interface PDFProcessingResult {
    totalPages: number;
    pages: PDFPage[];
    extractedText: string;
}

/**
 * Extract text content from PDF
 * Used for multi-page PDFs to get full content
 */
export async function extractPDFText(pdfBase64: string): Promise<PDFProcessingResult> {
    try {
        const pdfBuffer = Buffer.from(pdfBase64, 'base64');
        const data = await pdfParse(pdfBuffer);

        // pdf-parse extracts all text from all pages
        return {
            totalPages: data.numpages,
            pages: [], // Individual page images not available with pdf-parse
            extractedText: data.text,
        };
    } catch (error) {
        console.error('PDF text extraction failed:', error);
        throw new Error('Failed to extract PDF text');
    }
}

/**
 * Determine if PDF needs multi-page processing
 */
export function isPDFMultiPage(pdfBase64: string): boolean {
    // Check PDF header for page count hint
    // This is a simple heuristic - full parsing is done on demand
    const sizeKB = Buffer.from(pdfBase64, 'base64').length / 1024;
    // If > 500KB, likely multi-page
    return sizeKB > 500;
}

/**
 * Merge AI results from multiple pages
 */
export function mergeMultiPageResults(results: any[]): any {
    if (results.length === 0) return null;
    if (results.length === 1) return results[0];

    // Use first page as base
    const merged = { ...results[0] };

    // Merge financials (sum up amounts)
    let totalAmount = 0;
    let totalVAT = 0;
    let totalSubtotal = 0;

    for (const result of results) {
        if (result.financials) {
            totalSubtotal += result.financials.subtotal || 0;
            totalVAT += result.financials.vat_amount || 0;
            totalAmount += result.financials.grand_total || 0;
        }
    }

    merged.financials = {
        ...merged.financials,
        subtotal: totalSubtotal,
        vat_amount: totalVAT,
        grand_total: totalAmount,
    };

    // Mark as multi-page
    merged._multiPage = {
        totalPages: results.length,
        processedAt: new Date().toISOString(),
    };

    // Merge journal lines from all pages
    merged.accounting_entry = {
        ...merged.accounting_entry,
        journal_lines: results.flatMap(r => r.accounting_entry?.journal_lines || []),
    };

    // Highest confidence
    merged.confidence_score = Math.max(...results.map(r => r.confidence_score || 0));

    return merged;
}

/**
 * Create prompt for multi-page context
 */
export function createMultiPagePrompt(
    pageNumber: number,
    totalPages: number,
    previousText?: string
): string {
    let prompt = `นี่คือหน้าที่ ${pageNumber} จากทั้งหมด ${totalPages} หน้า\n`;

    if (pageNumber > 1 && previousText) {
        prompt += `ข้อมูลจากหน้าก่อนหน้า:\n${previousText.substring(0, 500)}...\n\n`;
    }

    prompt += `วิเคราะห์เอกสารหน้านี้และรวมกับข้อมูลก่อนหน้า`;

    return prompt;
}

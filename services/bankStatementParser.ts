/**
 * Enhanced Bank Statement Parser
 * รองรับหลายธนาคารและหลาย format (CSV, Excel, PDF)
 */

import { BankTransaction } from '../types';
import * as XLSX from 'xlsx';

// ============================================================================
// Bank Configuration
// ============================================================================

export interface BankConfig {
    code: string;
    nameTH: string;
    nameEN: string;
    dateColumn: number | string;
    descColumn: number | string;
    debitColumn: number | string;
    creditColumn: number | string;
    balanceColumn?: number | string;
    dateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'DD-MM-YYYY' | 'MM/DD/YYYY';
    useBuddhistYear: boolean;
    headerRow: number;
    skipRows?: number[];
    amountMultiplier?: number;
}

export const BANK_CONFIGS: Record<string, BankConfig> = {
    KBANK: {
        code: 'KBANK',
        nameTH: 'ธนาคารกสิกรไทย',
        nameEN: 'Kasikornbank',
        dateColumn: 0,
        descColumn: 2,
        debitColumn: 3,
        creditColumn: 4,
        balanceColumn: 5,
        dateFormat: 'DD/MM/YYYY',
        useBuddhistYear: true,
        headerRow: 0,
    },
    SCB: {
        code: 'SCB',
        nameTH: 'ธนาคารไทยพาณิชย์',
        nameEN: 'Siam Commercial Bank',
        dateColumn: 0,
        descColumn: 1,
        debitColumn: 2,
        creditColumn: 3,
        balanceColumn: 4,
        dateFormat: 'DD/MM/YYYY',
        useBuddhistYear: true,
        headerRow: 0,
    },
    BBL: {
        code: 'BBL',
        nameTH: 'ธนาคารกรุงเทพ',
        nameEN: 'Bangkok Bank',
        dateColumn: 0,
        descColumn: 2,
        debitColumn: 3,
        creditColumn: 4,
        balanceColumn: 5,
        dateFormat: 'DD/MM/YYYY',
        useBuddhistYear: true,
        headerRow: 1,
    },
    KTB: {
        code: 'KTB',
        nameTH: 'ธนาคารกรุงไทย',
        nameEN: 'Krungthai Bank',
        dateColumn: 0,
        descColumn: 3,
        debitColumn: 4,
        creditColumn: 5,
        balanceColumn: 6,
        dateFormat: 'DD/MM/YYYY',
        useBuddhistYear: true,
        headerRow: 0,
    },
    TTB: {
        code: 'TTB',
        nameTH: 'ธนาคารทีเอ็มบีธนชาต',
        nameEN: 'TMBThanachart Bank',
        dateColumn: 0,
        descColumn: 1,
        debitColumn: 2,
        creditColumn: 3,
        balanceColumn: 4,
        dateFormat: 'DD/MM/YYYY',
        useBuddhistYear: true,
        headerRow: 0,
    },
    BAY: {
        code: 'BAY',
        nameTH: 'ธนาคารกรุงศรีอยุธยา',
        nameEN: 'Bank of Ayudhya',
        dateColumn: 0,
        descColumn: 2,
        debitColumn: 3,
        creditColumn: 4,
        balanceColumn: 5,
        dateFormat: 'DD/MM/YYYY',
        useBuddhistYear: true,
        headerRow: 0,
    },
    CIMB: {
        code: 'CIMB',
        nameTH: 'ธนาคารซีไอเอ็มบี ไทย',
        nameEN: 'CIMB Thai Bank',
        dateColumn: 0,
        descColumn: 1,
        debitColumn: 2,
        creditColumn: 3,
        dateFormat: 'DD/MM/YYYY',
        useBuddhistYear: true,
        headerRow: 0,
    },
    GENERIC: {
        code: 'GENERIC',
        nameTH: 'รูปแบบทั่วไป',
        nameEN: 'Generic Format',
        dateColumn: 0,
        descColumn: 1,
        debitColumn: 2,
        creditColumn: 3,
        balanceColumn: 4,
        dateFormat: 'DD/MM/YYYY',
        useBuddhistYear: false,
        headerRow: 0,
    },
};

// ============================================================================
// Detection
// ============================================================================

/**
 * Auto-detect bank from file content
 */
export function detectBank(content: string): BankConfig {
    const lowerContent = content.toLowerCase();

    // Check for bank identifiers
    if (lowerContent.includes('kasikorn') || lowerContent.includes('kbank')) {
        return BANK_CONFIGS.KBANK;
    }
    if (lowerContent.includes('siam commercial') || lowerContent.includes('scb')) {
        return BANK_CONFIGS.SCB;
    }
    if (lowerContent.includes('bangkok bank') || lowerContent.includes('bbl')) {
        return BANK_CONFIGS.BBL;
    }
    if (lowerContent.includes('krungthai') || lowerContent.includes('ktb')) {
        return BANK_CONFIGS.KTB;
    }
    if (lowerContent.includes('tmb') || lowerContent.includes('ttb') || lowerContent.includes('thanachart')) {
        return BANK_CONFIGS.TTB;
    }
    if (lowerContent.includes('ayudhya') || lowerContent.includes('krungsri') || lowerContent.includes('bay')) {
        return BANK_CONFIGS.BAY;
    }
    if (lowerContent.includes('cimb')) {
        return BANK_CONFIGS.CIMB;
    }

    return BANK_CONFIGS.GENERIC;
}

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Parse date string according to format
 */
export function parseDate(dateStr: string, format: BankConfig['dateFormat'], useBuddhistYear: boolean): string {
    if (!dateStr) return '';

    // Clean the date string
    const cleaned = dateStr.trim();

    let day: number, month: number, year: number;

    switch (format) {
        case 'DD/MM/YYYY': {
            const parts = cleaned.split(/[\/\-\.]/);
            if (parts.length >= 3) {
                day = parseInt(parts[0], 10);
                month = parseInt(parts[1], 10);
                year = parseInt(parts[2], 10);
            } else {
                return '';
            }
            break;
        }
        case 'DD-MM-YYYY': {
            const parts = cleaned.split('-');
            if (parts.length >= 3) {
                day = parseInt(parts[0], 10);
                month = parseInt(parts[1], 10);
                year = parseInt(parts[2], 10);
            } else {
                return '';
            }
            break;
        }
        case 'YYYY-MM-DD': {
            const parts = cleaned.split('-');
            if (parts.length >= 3) {
                year = parseInt(parts[0], 10);
                month = parseInt(parts[1], 10);
                day = parseInt(parts[2], 10);
            } else {
                return '';
            }
            break;
        }
        case 'MM/DD/YYYY': {
            const parts = cleaned.split('/');
            if (parts.length >= 3) {
                month = parseInt(parts[0], 10);
                day = parseInt(parts[1], 10);
                year = parseInt(parts[2], 10);
            } else {
                return '';
            }
            break;
        }
        default:
            return '';
    }

    // Convert Buddhist year to Gregorian
    if (useBuddhistYear && year > 2400) {
        year -= 543;
    }

    // Validate
    if (isNaN(day) || isNaN(month) || isNaN(year)) {
        return '';
    }

    // Return ISO format
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Parse amount from string (handles Thai number formatting)
 */
export function parseAmount(amountStr: string | number | undefined): number {
    if (amountStr === undefined || amountStr === null || amountStr === '') {
        return 0;
    }

    if (typeof amountStr === 'number') {
        return amountStr;
    }

    // Remove commas, spaces, and currency symbols
    const cleaned = amountStr
        .replace(/,/g, '')
        .replace(/\s/g, '')
        .replace(/฿/g, '')
        .replace(/THB/gi, '')
        .trim();

    const value = parseFloat(cleaned);
    return isNaN(value) ? 0 : value;
}

/**
 * Parse CSV content to transactions
 */
export function parseCSV(
    content: string,
    clientId: string,
    config: BankConfig = BANK_CONFIGS.GENERIC
): BankTransaction[] {
    const lines = content.trim().split(/\r?\n/);
    const transactions: BankTransaction[] = [];

    // Skip header rows
    const startRow = config.headerRow + 1;

    for (let i = startRow; i < lines.length; i++) {
        // Skip empty lines
        if (!lines[i].trim()) continue;

        // Skip specified rows
        if (config.skipRows?.includes(i)) continue;

        // Parse CSV line (handle quoted values)
        const columns = parseCSVLine(lines[i]);

        // Extract values
        const dateCol = typeof config.dateColumn === 'number' ? config.dateColumn : 0;
        const descCol = typeof config.descColumn === 'number' ? config.descColumn : 1;
        const debitCol = typeof config.debitColumn === 'number' ? config.debitColumn : 2;
        const creditCol = typeof config.creditColumn === 'number' ? config.creditColumn : 3;

        const date = parseDate(columns[dateCol] || '', config.dateFormat, config.useBuddhistYear);
        const description = columns[descCol] || '';
        const debit = parseAmount(columns[debitCol]);
        const credit = parseAmount(columns[creditCol]);

        // Skip rows without valid date
        if (!date) continue;

        // Calculate amount (positive for credit, negative for debit)
        const amount = credit - debit;

        // Skip zero amount transactions
        if (amount === 0 && debit === 0 && credit === 0) continue;

        transactions.push({
            id: `BANK-${clientId}-${Date.now()}-${i}`,
            clientId,
            date,
            description: description.trim(),
            amount,
            status: 'unmatched',
        });
    }

    return transactions;
}

/**
 * Parse a single CSV line (handles quoted values)
 */
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current.trim());
    return result;
}

/**
 * Parse Excel file to transactions
 */
export async function parseExcel(
    file: File,
    clientId: string,
    config: BankConfig = BANK_CONFIGS.GENERIC
): Promise<BankTransaction[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });

                // Get first sheet
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

                // Convert to array of arrays
                const rows = XLSX.utils.sheet_to_json<(string | number)[]>(firstSheet, { header: 1 });

                const transactions: BankTransaction[] = [];
                const startRow = config.headerRow + 1;

                for (let i = startRow; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length === 0) continue;

                    const dateCol = typeof config.dateColumn === 'number' ? config.dateColumn : 0;
                    const descCol = typeof config.descColumn === 'number' ? config.descColumn : 1;
                    const debitCol = typeof config.debitColumn === 'number' ? config.debitColumn : 2;
                    const creditCol = typeof config.creditColumn === 'number' ? config.creditColumn : 3;

                    // Handle Excel date (serial number)
                    let dateValue = row[dateCol];
                    let date: string;

                    if (typeof dateValue === 'number') {
                        // Excel date serial number
                        const excelDate = XLSX.SSF.parse_date_code(dateValue);
                        date = `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
                    } else {
                        date = parseDate(String(dateValue || ''), config.dateFormat, config.useBuddhistYear);
                    }

                    if (!date) continue;

                    const description = String(row[descCol] || '');
                    const debit = parseAmount(row[debitCol]);
                    const credit = parseAmount(row[creditCol]);
                    const amount = credit - debit;

                    if (amount === 0 && debit === 0 && credit === 0) continue;

                    transactions.push({
                        id: `BANK-${clientId}-${Date.now()}-${i}`,
                        clientId,
                        date,
                        description: description.trim(),
                        amount,
                        status: 'unmatched',
                    });
                }

                resolve(transactions);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์ได้'));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Parse bank statement file (auto-detect format)
 */
export async function parseBankStatement(
    file: File,
    clientId: string,
    bankCode?: string
): Promise<{
    transactions: BankTransaction[];
    bankConfig: BankConfig;
    errors: string[];
}> {
    const errors: string[] = [];
    let transactions: BankTransaction[] = [];
    let bankConfig: BankConfig = BANK_CONFIGS.GENERIC;

    try {
        const fileExt = file.name.split('.').pop()?.toLowerCase();

        // Get bank config
        if (bankCode && BANK_CONFIGS[bankCode]) {
            bankConfig = BANK_CONFIGS[bankCode];
        }

        if (fileExt === 'xlsx' || fileExt === 'xls') {
            // Excel file
            transactions = await parseExcel(file, clientId, bankConfig);
        } else if (fileExt === 'csv' || fileExt === 'txt') {
            // CSV/Text file
            const content = await file.text();

            // Auto-detect bank if not specified
            if (!bankCode) {
                bankConfig = detectBank(content);
            }

            transactions = parseCSV(content, clientId, bankConfig);
        } else {
            errors.push(`ไม่รองรับไฟล์นามสกุล .${fileExt}`);
        }

        if (transactions.length === 0 && errors.length === 0) {
            errors.push('ไม่พบรายการธุรกรรมในไฟล์');
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการอ่านไฟล์';
        errors.push(errorMessage);
    }

    return {
        transactions,
        bankConfig,
        errors,
    };
}

// ============================================================================
// Summary & Statistics
// ============================================================================

export interface BankStatementSummary {
    bankName: string;
    totalTransactions: number;
    totalDebit: number;
    totalCredit: number;
    netChange: number;
    dateRange: {
        from: string;
        to: string;
    };
    byMonth: Record<string, { debit: number; credit: number; count: number }>;
}

/**
 * Generate summary from parsed transactions
 */
export function generateStatementSummary(
    transactions: BankTransaction[],
    bankConfig: BankConfig
): BankStatementSummary {
    const totalDebit = transactions
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const totalCredit = transactions
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);

    const dates = transactions.map(t => t.date).filter(Boolean).sort();

    const byMonth: Record<string, { debit: number; credit: number; count: number }> = {};

    for (const txn of transactions) {
        const monthKey = txn.date.substring(0, 7); // YYYY-MM
        if (!byMonth[monthKey]) {
            byMonth[monthKey] = { debit: 0, credit: 0, count: 0 };
        }

        if (txn.amount < 0) {
            byMonth[monthKey].debit += Math.abs(txn.amount);
        } else {
            byMonth[monthKey].credit += txn.amount;
        }
        byMonth[monthKey].count++;
    }

    return {
        bankName: bankConfig.nameTH,
        totalTransactions: transactions.length,
        totalDebit,
        totalCredit,
        netChange: totalCredit - totalDebit,
        dateRange: {
            from: dates[0] || '',
            to: dates[dates.length - 1] || '',
        },
        byMonth,
    };
}

export default {
    BANK_CONFIGS,
    detectBank,
    parseDate,
    parseAmount,
    parseCSV,
    parseExcel,
    parseBankStatement,
    generateStatementSummary,
};

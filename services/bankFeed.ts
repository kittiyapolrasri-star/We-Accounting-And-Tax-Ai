/**
 * Bank Feed Service - Parse and import bank statements from CSV
 * Supports major Thai banks: SCB, KBANK, BBL, KTB, BAY
 */

import { BankTransaction } from '../types';

export interface ParsedBankRow {
  date: string;
  description: string;
  withdrawal: number;
  deposit: number;
  balance: number;
  reference?: string;
}

export interface BankParseResult {
  success: boolean;
  transactions: ParsedBankRow[];
  bankName?: string;
  accountNumber?: string;
  startDate?: string;
  endDate?: string;
  errors: string[];
}

export type BankFormat = 'SCB' | 'KBANK' | 'BBL' | 'KTB' | 'BAY' | 'AUTO';

/**
 * Parse CSV content into rows
 */
const parseCSV = (content: string): string[][] => {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  return lines.map(line => {
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
  });
};

/**
 * Parse Thai date format (DD/MM/YYYY or DD-MM-YYYY) to ISO format
 */
const parseThaiDate = (dateStr: string): string => {
  const cleaned = dateStr.replace(/[^\d/-]/g, '');
  const parts = cleaned.split(/[/-]/);

  if (parts.length !== 3) return '';

  let day = parts[0];
  let month = parts[1];
  let year = parts[2];

  // Handle Buddhist year (add 543 years to get Gregorian)
  const yearNum = parseInt(year);
  if (yearNum > 2500) {
    year = String(yearNum - 543);
  }

  // Ensure 4-digit year
  if (year.length === 2) {
    year = '20' + year;
  }

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

/**
 * Parse amount from Thai format (may include commas, parentheses for negative)
 */
const parseAmount = (amountStr: string): number => {
  if (!amountStr || amountStr === '-' || amountStr === '') return 0;

  let cleaned = amountStr.replace(/[,\s]/g, '');

  // Handle parentheses for negative (accounting format)
  const isNegative = cleaned.includes('(') || cleaned.includes(')');
  cleaned = cleaned.replace(/[()]/g, '');

  const amount = parseFloat(cleaned) || 0;
  return isNegative ? -amount : amount;
};

/**
 * Detect bank format from CSV content
 */
const detectBankFormat = (rows: string[][]): BankFormat => {
  const headerRow = rows.slice(0, 5).join(' ').toLowerCase();

  if (headerRow.includes('siam commercial') || headerRow.includes('scb')) {
    return 'SCB';
  }
  if (headerRow.includes('kasikorn') || headerRow.includes('kbank')) {
    return 'KBANK';
  }
  if (headerRow.includes('bangkok bank') || headerRow.includes('bbl')) {
    return 'BBL';
  }
  if (headerRow.includes('krung thai') || headerRow.includes('ktb')) {
    return 'KTB';
  }
  if (headerRow.includes('ayudhya') || headerRow.includes('krungsri') || headerRow.includes('bay')) {
    return 'BAY';
  }

  return 'AUTO';
};

/**
 * Parse SCB bank statement format
 */
const parseSCBFormat = (rows: string[][]): ParsedBankRow[] => {
  const transactions: ParsedBankRow[] = [];

  // Find header row (usually contains "Date", "Description", etc.)
  const headerIndex = rows.findIndex(row =>
    row.some(cell => cell.toLowerCase().includes('date') || cell.includes('วันที่'))
  );

  const dataRows = headerIndex >= 0 ? rows.slice(headerIndex + 1) : rows;

  for (const row of dataRows) {
    if (row.length < 4) continue;

    const dateStr = parseThaiDate(row[0]);
    if (!dateStr) continue;

    transactions.push({
      date: dateStr,
      description: row[1] || '',
      withdrawal: parseAmount(row[2]),
      deposit: parseAmount(row[3]),
      balance: row[4] ? parseAmount(row[4]) : 0,
      reference: row[5] || undefined,
    });
  }

  return transactions;
};

/**
 * Parse KBANK bank statement format
 */
const parseKBANKFormat = (rows: string[][]): ParsedBankRow[] => {
  const transactions: ParsedBankRow[] = [];

  const headerIndex = rows.findIndex(row =>
    row.some(cell =>
      cell.toLowerCase().includes('transaction') ||
      cell.includes('รายการ') ||
      cell.toLowerCase().includes('date')
    )
  );

  const dataRows = headerIndex >= 0 ? rows.slice(headerIndex + 1) : rows;

  for (const row of dataRows) {
    if (row.length < 4) continue;

    const dateStr = parseThaiDate(row[0]);
    if (!dateStr) continue;

    // KBANK format: Date, Time, Description, Withdrawal, Deposit, Balance
    transactions.push({
      date: dateStr,
      description: row[2] || row[1] || '',
      withdrawal: parseAmount(row[3]),
      deposit: parseAmount(row[4]),
      balance: row[5] ? parseAmount(row[5]) : 0,
      reference: row[6] || undefined,
    });
  }

  return transactions;
};

/**
 * Parse generic bank statement format (auto-detect columns)
 */
const parseGenericFormat = (rows: string[][]): ParsedBankRow[] => {
  const transactions: ParsedBankRow[] = [];

  // Find header row
  const headerIndex = rows.findIndex(row =>
    row.some(cell => {
      const lower = cell.toLowerCase();
      return lower.includes('date') || lower.includes('วันที่') ||
        lower.includes('description') || lower.includes('รายการ');
    })
  );

  let dateCol = -1;
  let descCol = -1;
  let withdrawalCol = -1;
  let depositCol = -1;
  let balanceCol = -1;

  if (headerIndex >= 0) {
    const header = rows[headerIndex].map(h => h.toLowerCase());

    for (let i = 0; i < header.length; i++) {
      const col = header[i];
      if (col.includes('date') || col.includes('วันที่')) dateCol = i;
      else if (col.includes('desc') || col.includes('รายการ') || col.includes('particular')) descCol = i;
      else if (col.includes('withdrawal') || col.includes('ถอน') || col.includes('debit')) withdrawalCol = i;
      else if (col.includes('deposit') || col.includes('ฝาก') || col.includes('credit')) depositCol = i;
      else if (col.includes('balance') || col.includes('ยอด') || col.includes('คงเหลือ')) balanceCol = i;
    }
  }

  // Default column positions if not detected
  if (dateCol === -1) dateCol = 0;
  if (descCol === -1) descCol = 1;
  if (withdrawalCol === -1) withdrawalCol = 2;
  if (depositCol === -1) depositCol = 3;
  if (balanceCol === -1) balanceCol = 4;

  const dataRows = headerIndex >= 0 ? rows.slice(headerIndex + 1) : rows;

  for (const row of dataRows) {
    if (row.length < 3) continue;

    const dateStr = parseThaiDate(row[dateCol] || '');
    if (!dateStr) continue;

    transactions.push({
      date: dateStr,
      description: row[descCol] || '',
      withdrawal: parseAmount(row[withdrawalCol] || ''),
      deposit: parseAmount(row[depositCol] || ''),
      balance: balanceCol < row.length ? parseAmount(row[balanceCol]) : 0,
    });
  }

  return transactions;
};

/**
 * Main function to parse bank statement CSV
 */
export const parseBankStatement = (
  content: string,
  format: BankFormat = 'AUTO'
): BankParseResult => {
  const errors: string[] = [];

  try {
    const rows = parseCSV(content);

    if (rows.length < 2) {
      return {
        success: false,
        transactions: [],
        errors: ['ไฟล์ไม่มีข้อมูลเพียงพอ'],
      };
    }

    const detectedFormat = format === 'AUTO' ? detectBankFormat(rows) : format;
    let transactions: ParsedBankRow[];

    switch (detectedFormat) {
      case 'SCB':
        transactions = parseSCBFormat(rows);
        break;
      case 'KBANK':
        transactions = parseKBANKFormat(rows);
        break;
      default:
        transactions = parseGenericFormat(rows);
    }

    if (transactions.length === 0) {
      return {
        success: false,
        transactions: [],
        errors: ['ไม่สามารถอ่านข้อมูลรายการธนาคารได้ กรุณาตรวจสอบรูปแบบไฟล์'],
      };
    }

    // Sort by date
    transactions.sort((a, b) => a.date.localeCompare(b.date));

    return {
      success: true,
      transactions,
      bankName: detectedFormat !== 'AUTO' ? detectedFormat : undefined,
      startDate: transactions[0]?.date,
      endDate: transactions[transactions.length - 1]?.date,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      transactions: [],
      errors: [`เกิดข้อผิดพลาดในการอ่านไฟล์: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
};

/**
 * Convert parsed rows to BankTransaction objects for Firestore
 */
export const convertToBankTransactions = (
  rows: ParsedBankRow[],
  clientId: string
): Omit<BankTransaction, 'id'>[] => {
  return rows.map((row, index) => ({
    clientId,
    date: row.date,
    description: row.description,
    amount: row.deposit > 0 ? row.deposit : -row.withdrawal,
    status: 'unmatched' as const,
  }));
};

/**
 * Auto-match bank transactions with documents
 */
export const autoMatchTransactions = (
  transactions: BankTransaction[],
  documents: { id: string; amount: number; date: string; inv_number?: string }[]
): Map<string, string> => {
  const matches = new Map<string, string>();

  for (const tx of transactions) {
    if (tx.matched_doc_id) continue;

    // Find potential matches based on amount and date proximity
    const potentialMatches = documents.filter(doc => {
      const amountMatch = Math.abs(Math.abs(tx.amount) - doc.amount) < 0.01;
      const dateDiff = Math.abs(
        new Date(tx.date).getTime() - new Date(doc.date).getTime()
      );
      const dateMatch = dateDiff <= 7 * 24 * 60 * 60 * 1000; // Within 7 days

      return amountMatch && dateMatch;
    });

    // If exactly one match, auto-link
    if (potentialMatches.length === 1) {
      matches.set(tx.id, potentialMatches[0].id);
    }
  }

  return matches;
};

/**
 * Read file as text
 */
export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));

    // Try UTF-8 first, then TIS-620 (Thai encoding)
    reader.readAsText(file, 'UTF-8');
  });
};

export default {
  parseBankStatement,
  convertToBankTransactions,
  autoMatchTransactions,
  readFileAsText,
};

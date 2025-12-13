/**
 * Intelligent Bank Reconciliation Service
 * Auto-matching engine with ML-like scoring and batch processing
 */

import { DocumentRecord, BankTransaction, PostedGLEntry } from '../types';

// Match Result Types
export interface MatchResult {
  txnId: string;
  docId: string | null;
  score: number;
  matchType: 'exact' | 'fuzzy' | 'partial' | 'manual' | 'no_match';
  confidence: number;
  adjustmentRequired: boolean;
  adjustmentAmount: number;
  adjustmentType?: 'fee' | 'interest' | 'discount' | 'other';
  reasons: string[];
}

export interface ReconciliationSummary {
  totalBankTransactions: number;
  totalMatched: number;
  totalUnmatched: number;
  totalAutoMatched: number;
  matchRate: number;
  totalBankAmount: number;
  totalBookAmount: number;
  difference: number;
  outstandingDeposits: number;
  outstandingPayments: number;
  unmatchedBankItems: BankTransaction[];
  unmatchedBookItems: DocumentRecord[];
}

export interface AutoMatchConfig {
  minScore: number; // Minimum score to auto-match (0-100)
  amountTolerance: number; // Max amount difference to still consider matching (in THB)
  dateTolerance: number; // Max days difference to consider matching
  autoBookFees: boolean; // Automatically book bank fees
  autoBookInterest: boolean; // Automatically book interest
  matchPriority: 'amount' | 'date' | 'description'; // Primary matching criteria
}

export const DEFAULT_AUTO_MATCH_CONFIG: AutoMatchConfig = {
  minScore: 70,
  amountTolerance: 100,
  dateTolerance: 7,
  autoBookFees: true,
  autoBookInterest: true,
  matchPriority: 'amount',
};

// Scoring weights for different matching criteria
const SCORING_WEIGHTS = {
  exactAmount: 40,
  closeAmount: 25,
  exactDate: 15,
  closeDate: 10,
  descriptionMatch: 15,
  invoiceNumberMatch: 20,
  vendorNameMatch: 15,
  historicalMatch: 10,
};

/**
 * Calculate match score between bank transaction and document
 */
export const calculateMatchScore = (
  txn: BankTransaction,
  doc: DocumentRecord,
  historicalMatches?: Map<string, string[]>
): { score: number; reasons: string[]; confidence: number } => {
  let score = 0;
  const reasons: string[] = [];

  if (!doc.ai_data) {
    return { score: 0, reasons: ['No AI data available'], confidence: 0 };
  }

  const txnAmount = Math.abs(txn.amount);
  const docAmount = doc.amount || doc.ai_data.financials.grand_total;
  const amountDiff = Math.abs(txnAmount - docAmount);

  // 1. Amount matching (max 40 points)
  if (amountDiff < 0.01) {
    score += SCORING_WEIGHTS.exactAmount;
    reasons.push('Exact amount match');
  } else if (amountDiff <= 10) {
    score += SCORING_WEIGHTS.closeAmount + 10;
    reasons.push(`Near-exact amount (diff: ${amountDiff.toFixed(2)})`);
  } else if (amountDiff <= 50) {
    score += SCORING_WEIGHTS.closeAmount;
    reasons.push(`Close amount (diff: ${amountDiff.toFixed(2)})`);
  } else if (amountDiff <= 200) {
    score += SCORING_WEIGHTS.closeAmount - 10;
    reasons.push(`Amount within tolerance (diff: ${amountDiff.toFixed(2)})`);
  }

  // 2. Date matching (max 15 points)
  const txnDate = new Date(txn.date);
  const docDate = new Date(doc.ai_data.header_data.issue_date);
  const dateDiffDays = Math.abs(
    (txnDate.getTime() - docDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (dateDiffDays === 0) {
    score += SCORING_WEIGHTS.exactDate;
    reasons.push('Same date');
  } else if (dateDiffDays <= 1) {
    score += SCORING_WEIGHTS.closeDate + 3;
    reasons.push('Date within 1 day');
  } else if (dateDiffDays <= 3) {
    score += SCORING_WEIGHTS.closeDate;
    reasons.push('Date within 3 days');
  } else if (dateDiffDays <= 7) {
    score += SCORING_WEIGHTS.closeDate - 5;
    reasons.push('Date within 1 week');
  }

  // 3. Description/vendor matching (max 15 points)
  const txnDesc = txn.description.toLowerCase();
  const vendorName = doc.ai_data.parties.counterparty.name.toLowerCase();
  const clientName = doc.client_name.toLowerCase();

  // Check for vendor name in transaction description
  const vendorWords = vendorName.split(/\s+/).filter(w => w.length > 2);
  const matchedVendorWords = vendorWords.filter(word => txnDesc.includes(word));
  if (matchedVendorWords.length > 0) {
    const vendorMatchPercent = matchedVendorWords.length / vendorWords.length;
    score += Math.round(SCORING_WEIGHTS.vendorNameMatch * vendorMatchPercent);
    reasons.push(`Vendor name match (${matchedVendorWords.join(', ')})`);
  }

  // Check for client name match
  const clientWords = clientName.split(/\s+/).filter(w => w.length > 2);
  const matchedClientWords = clientWords.filter(word => txnDesc.includes(word));
  if (matchedClientWords.length > 0) {
    const clientMatchPercent = matchedClientWords.length / clientWords.length;
    score += Math.round(SCORING_WEIGHTS.descriptionMatch * clientMatchPercent);
    reasons.push(`Client name match (${matchedClientWords.join(', ')})`);
  }

  // 4. Invoice number matching (max 20 points)
  const invNumber = doc.ai_data.header_data.inv_number;
  if (invNumber && txnDesc.includes(invNumber.toLowerCase())) {
    score += SCORING_WEIGHTS.invoiceNumberMatch;
    reasons.push(`Invoice number match (${invNumber})`);
  }

  // 5. Historical matching pattern (max 10 points)
  if (historicalMatches) {
    const vendorHistoricalDocs = historicalMatches.get(vendorName);
    if (vendorHistoricalDocs && vendorHistoricalDocs.includes(doc.id)) {
      score += SCORING_WEIGHTS.historicalMatch;
      reasons.push('Historical vendor match pattern');
    }
  }

  // Calculate confidence based on score and number of matching criteria
  const maxPossibleScore = Object.values(SCORING_WEIGHTS).reduce((a, b) => a + b, 0);
  const confidence = Math.round((score / maxPossibleScore) * 100);

  return {
    score: Math.min(score, 100),
    reasons,
    confidence,
  };
};

/**
 * Find best match for a bank transaction
 */
export const findBestMatch = (
  txn: BankTransaction,
  documents: DocumentRecord[],
  config: AutoMatchConfig = DEFAULT_AUTO_MATCH_CONFIG,
  historicalMatches?: Map<string, string[]>
): MatchResult => {
  let bestMatch: MatchResult = {
    txnId: txn.id,
    docId: null,
    score: 0,
    matchType: 'no_match',
    confidence: 0,
    adjustmentRequired: false,
    adjustmentAmount: 0,
    reasons: [],
  };

  // Filter documents by amount direction (debit/credit)
  const isDebit = txn.amount < 0;
  const eligibleDocs = documents.filter(d => {
    if (!d.ai_data) return false;
    // For debit transactions, match with purchase/expense documents
    // For credit transactions, match with sales/receipt documents
    const docType = d.ai_data.header_data.doc_type?.toLowerCase() || '';
    if (isDebit) {
      return docType.includes('invoice') || docType.includes('receipt') || docType.includes('purchase');
    } else {
      return docType.includes('sales') || docType.includes('receipt');
    }
  });

  for (const doc of eligibleDocs) {
    const { score, reasons, confidence } = calculateMatchScore(txn, doc, historicalMatches);

    if (score > bestMatch.score) {
      const txnAmount = Math.abs(txn.amount);
      const docAmount = doc.amount || (doc.ai_data?.financials.grand_total || 0);
      const amountDiff = Math.abs(txnAmount - docAmount);

      bestMatch = {
        txnId: txn.id,
        docId: doc.id,
        score,
        matchType: amountDiff < 0.01 ? 'exact' : amountDiff <= config.amountTolerance ? 'fuzzy' : 'partial',
        confidence,
        adjustmentRequired: amountDiff >= 0.01,
        adjustmentAmount: amountDiff,
        adjustmentType: amountDiff > 0 ? (txnAmount > docAmount ? 'fee' : 'discount') : undefined,
        reasons,
      };
    }
  }

  // Check if score meets minimum threshold
  if (bestMatch.score < config.minScore) {
    return {
      txnId: txn.id,
      docId: null,
      score: bestMatch.score,
      matchType: 'no_match',
      confidence: bestMatch.confidence,
      adjustmentRequired: false,
      adjustmentAmount: 0,
      reasons: [`Score ${bestMatch.score} below threshold ${config.minScore}`],
    };
  }

  return bestMatch;
};

/**
 * Auto-match all unmatched transactions
 */
export const autoMatchTransactions = (
  transactions: BankTransaction[],
  documents: DocumentRecord[],
  config: AutoMatchConfig = DEFAULT_AUTO_MATCH_CONFIG
): {
  matches: MatchResult[];
  autoMatchedCount: number;
  unmatchedCount: number;
} => {
  const unmatchedTxns = transactions.filter(t => t.status === 'unmatched');
  const availableDocs = documents.filter(d => d.status === 'approved');
  const matches: MatchResult[] = [];
  const usedDocIds = new Set<string>();

  // Sort transactions by amount (larger first) for better matching
  const sortedTxns = [...unmatchedTxns].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  for (const txn of sortedTxns) {
    // Filter out already matched documents
    const unusedDocs = availableDocs.filter(d => !usedDocIds.has(d.id));
    const match = findBestMatch(txn, unusedDocs, config);
    matches.push(match);

    if (match.docId && match.score >= config.minScore) {
      usedDocIds.add(match.docId);
    }
  }

  const autoMatchedCount = matches.filter(m => m.matchType !== 'no_match').length;

  return {
    matches,
    autoMatchedCount,
    unmatchedCount: matches.length - autoMatchedCount,
  };
};

/**
 * Generate reconciliation summary
 */
export const generateReconciliationSummary = (
  transactions: BankTransaction[],
  documents: DocumentRecord[],
  matches: MatchResult[]
): ReconciliationSummary => {
  const matchedTxnIds = new Set(matches.filter(m => m.docId).map(m => m.txnId));
  const matchedDocIds = new Set(matches.filter(m => m.docId).map(m => m.docId));

  const totalBankAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
  const approvedDocs = documents.filter(d => d.status === 'approved');
  const totalBookAmount = approvedDocs.reduce((sum, d) => sum + (d.amount || 0), 0);

  const unmatchedBankItems = transactions.filter(t => !matchedTxnIds.has(t.id) && t.status === 'unmatched');
  const unmatchedBookItems = approvedDocs.filter(d => !matchedDocIds.has(d.id));

  // Calculate outstanding deposits (positive bank amounts not matched)
  const outstandingDeposits = unmatchedBankItems
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  // Calculate outstanding payments (negative bank amounts not matched)
  const outstandingPayments = Math.abs(
    unmatchedBankItems
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + t.amount, 0)
  );

  const autoMatchedCount = matches.filter(m => m.matchType !== 'manual' && m.matchType !== 'no_match').length;

  return {
    totalBankTransactions: transactions.length,
    totalMatched: matches.filter(m => m.docId).length,
    totalUnmatched: matches.filter(m => !m.docId).length,
    totalAutoMatched: autoMatchedCount,
    matchRate: transactions.length > 0
      ? (matches.filter(m => m.docId).length / transactions.length) * 100
      : 0,
    totalBankAmount,
    totalBookAmount,
    difference: totalBankAmount - totalBookAmount,
    outstandingDeposits,
    outstandingPayments,
    unmatchedBankItems,
    unmatchedBookItems,
  };
};

/**
 * Generate adjustment GL entries for matched items with differences
 */
export const generateAdjustmentEntries = (
  match: MatchResult,
  txn: BankTransaction,
  clientId: string,
  config: AutoMatchConfig = DEFAULT_AUTO_MATCH_CONFIG
): PostedGLEntry[] => {
  if (!match.adjustmentRequired || match.adjustmentAmount < 0.01) {
    return [];
  }

  const entries: PostedGLEntry[] = [];
  const timestamp = Date.now();

  // Determine adjustment account based on type
  let accountCode: string;
  let accountName: string;
  let isDebit: boolean;

  switch (match.adjustmentType) {
    case 'fee':
      accountCode = '52510';
      accountName = 'ค่าธรรมเนียมธนาคาร (Bank Charges)';
      isDebit = true;
      break;
    case 'interest':
      accountCode = '42100';
      accountName = 'ดอกเบี้ยรับ (Interest Income)';
      isDebit = false;
      break;
    case 'discount':
      accountCode = '52520';
      accountName = 'ส่วนลดจ่าย (Discount Expense)';
      isDebit = true;
      break;
    default:
      accountCode = '52990';
      accountName = 'ค่าใช้จ่ายเบ็ดเตล็ด (Miscellaneous Expense)';
      isDebit = true;
  }

  // Check if auto-booking is enabled for this type
  if (match.adjustmentType === 'fee' && !config.autoBookFees) {
    return [];
  }
  if (match.adjustmentType === 'interest' && !config.autoBookInterest) {
    return [];
  }

  // Adjustment entry
  entries.push({
    id: `RECON-ADJ-${timestamp}`,
    clientId,
    date: txn.date,
    doc_no: `BANK-RECON-${txn.id}`,
    description: `Bank Recon Adjustment: ${txn.description}`,
    account_code: accountCode,
    account_name: accountName,
    debit: isDebit ? match.adjustmentAmount : 0,
    credit: isDebit ? 0 : match.adjustmentAmount,
    system_generated: true,
  });

  // Balancing bank entry
  entries.push({
    id: `RECON-BANK-${timestamp}`,
    clientId,
    date: txn.date,
    doc_no: `BANK-RECON-${txn.id}`,
    description: `Bank Recon Adjustment: ${txn.description}`,
    account_code: '11120',
    account_name: 'เงินฝากธนาคาร (Bank Deposit)',
    debit: isDebit ? 0 : match.adjustmentAmount,
    credit: isDebit ? match.adjustmentAmount : 0,
    system_generated: true,
  });

  return entries;
};

/**
 * Parse bank statement CSV
 */
export const parseBankStatementCSV = (
  csvContent: string,
  clientId: string,
  _bankCode: string = 'KBANK' // Bank code for reference, not stored in transaction
): BankTransaction[] => {
  const lines = csvContent.trim().split('\n');
  const transactions: BankTransaction[] = [];

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const columns = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));

    if (columns.length < 4) continue;

    // Expected format: Date, Description, Debit, Credit, Balance
    // Adjust based on actual bank format
    const date = columns[0];
    const description = columns[1];
    const debit = parseFloat(columns[2]) || 0;
    const credit = parseFloat(columns[3]) || 0;
    const amount = credit - debit; // Positive for deposits, negative for withdrawals

    transactions.push({
      id: `BANK-${clientId}-${Date.now()}-${i}`,
      clientId,
      date: formatBankDate(date),
      description,
      amount,
      status: 'unmatched',
    });
  }

  return transactions;
};

/**
 * Format date from various bank formats to ISO
 */
const formatBankDate = (dateStr: string): string => {
  // Handle DD/MM/YYYY format (common in Thai banks)
  const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const match = dateStr.match(ddmmyyyy);
  if (match) {
    const [_, day, month, year] = match;
    // Check if year is Buddhist Era (add 543)
    const gregorianYear = parseInt(year) > 2400 ? parseInt(year) - 543 : parseInt(year);
    return `${gregorianYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Handle YYYY-MM-DD format
  const yyyymmdd = /^\d{4}-\d{2}-\d{2}$/;
  if (yyyymmdd.test(dateStr)) {
    return dateStr;
  }

  // Default: return as-is or current date
  return new Date().toISOString().split('T')[0];
};

/**
 * Detect bank statement format from content
 */
export const detectBankFormat = (content: string): {
  bank: string;
  format: string;
  columns: string[];
} => {
  const firstLines = content.split('\n').slice(0, 3).join('\n').toLowerCase();

  if (firstLines.includes('kbank') || firstLines.includes('kasikorn')) {
    return {
      bank: 'KBANK',
      format: 'csv',
      columns: ['Date', 'Time', 'Description', 'Debit', 'Credit', 'Balance'],
    };
  }

  if (firstLines.includes('scb') || firstLines.includes('siam commercial')) {
    return {
      bank: 'SCB',
      format: 'csv',
      columns: ['Date', 'Description', 'Withdrawal', 'Deposit', 'Balance'],
    };
  }

  if (firstLines.includes('bbl') || firstLines.includes('bangkok bank')) {
    return {
      bank: 'BBL',
      format: 'csv',
      columns: ['Date', 'Time', 'Description', 'Debit', 'Credit', 'Balance'],
    };
  }

  if (firstLines.includes('ktb') || firstLines.includes('krungthai')) {
    return {
      bank: 'KTB',
      format: 'csv',
      columns: ['Date', 'Time', 'Channel', 'Description', 'Debit', 'Credit', 'Balance'],
    };
  }

  // Default format
  return {
    bank: 'UNKNOWN',
    format: 'csv',
    columns: ['Date', 'Description', 'Debit', 'Credit', 'Balance'],
  };
};

export default {
  calculateMatchScore,
  findBestMatch,
  autoMatchTransactions,
  generateReconciliationSummary,
  generateAdjustmentEntries,
  parseBankStatementCSV,
  detectBankFormat,
  DEFAULT_AUTO_MATCH_CONFIG,
};

/**
 * Document Validation Service
 * Pre-upload validation, duplicate detection, and classification
 * 
 * Features:
 * - File type and size validation
 * - Duplicate invoice detection
 * - Auto-classification by filename
 * - Tax ID validation (Thailand 13-digit)
 */

import { DocumentRecord } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}

export interface ValidationError {
    code: string;
    message: string;
    messageTh: string;
    field?: string;
}

export interface ValidationWarning {
    code: string;
    message: string;
    messageTh: string;
}

export interface ClassificationResult {
    docType: DocumentType;
    suggestedFolder: string;
    confidence: number;
    detectedSource?: string;
}

export interface DuplicateCheckResult {
    isDuplicate: boolean;
    matches: DocumentRecord[];
    confidence: number;
    matchType?: 'exact' | 'fuzzy';
}

export type DocumentType =
    | 'TAX_INVOICE'
    | 'RECEIPT'
    | 'ABBREVIATED_TAX_INVOICE'
    | 'DEBIT_NOTE'
    | 'CREDIT_NOTE'
    | 'BANK_STATEMENT'
    | 'WHT_CERTIFICATE'
    | 'SALES_REPORT'
    | 'CONTRACT'
    | 'QUOTATION'
    | 'PURCHASE_ORDER'
    | 'PAYMENT_VOUCHER'
    | 'RECEIPT_VOUCHER'
    | 'JOURNAL_VOUCHER'
    | 'GENERAL';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
];

const ALLOWED_IMPORT_TYPES = [
    ...ALLOWED_MIME_TYPES,
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

// Document type patterns for classification
const CLASSIFICATION_PATTERNS: Record<string, { patterns: RegExp[]; type: DocumentType }> = {
    taxInvoice: {
        patterns: [
            /invoice|inv|ใบกำกับภาษี|ใบกำกับ|tax[-_\s]?inv/i,
        ],
        type: 'TAX_INVOICE',
    },
    receipt: {
        patterns: [
            /receipt|rcpt|ใบเสร็จ|ใบเสร็จรับเงิน|rec[-_]?\d/i,
        ],
        type: 'RECEIPT',
    },
    abbreviatedTaxInvoice: {
        patterns: [
            /ใบกำกับ.*ย่อ|abbreviated|abv[-_]?inv/i,
        ],
        type: 'ABBREVIATED_TAX_INVOICE',
    },
    debitNote: {
        patterns: [
            /debit[-_\s]?note|dn[-_]?\d|ใบเพิ่มหนี้/i,
        ],
        type: 'DEBIT_NOTE',
    },
    creditNote: {
        patterns: [
            /credit[-_\s]?note|cn[-_]?\d|ใบลดหนี้/i,
        ],
        type: 'CREDIT_NOTE',
    },
    bankStatement: {
        patterns: [
            /statement|stt|bank|scb|kbank|bbl|ktb|bay|ttb|ธนาคาร|รายการเดินบัญชี/i,
        ],
        type: 'BANK_STATEMENT',
    },
    whtCertificate: {
        patterns: [
            /wht|50[-_\s]?ทวิ|หักภาษี|withholding|หนังสือรับรอง.*หัก/i,
        ],
        type: 'WHT_CERTIFICATE',
    },
    salesReport: {
        patterns: [
            /sales|grab|lineman|shopee|lazada|รายงานขาย|ยอดขาย/i,
        ],
        type: 'SALES_REPORT',
    },
    contract: {
        patterns: [
            /contract|agreement|สัญญา|ข้อตกลง/i,
        ],
        type: 'CONTRACT',
    },
    quotation: {
        patterns: [
            /quotation|quote|qt[-_]?\d|ใบเสนอราคา/i,
        ],
        type: 'QUOTATION',
    },
    purchaseOrder: {
        patterns: [
            /purchase[-_\s]?order|po[-_]?\d|ใบสั่งซื้อ/i,
        ],
        type: 'PURCHASE_ORDER',
    },
    paymentVoucher: {
        patterns: [
            /payment[-_\s]?voucher|pv[-_]?\d|ใบสำคัญจ่าย/i,
        ],
        type: 'PAYMENT_VOUCHER',
    },
    receiptVoucher: {
        patterns: [
            /receipt[-_\s]?voucher|rv[-_]?\d|ใบสำคัญรับ/i,
        ],
        type: 'RECEIPT_VOUCHER',
    },
    journalVoucher: {
        patterns: [
            /journal[-_\s]?voucher|jv[-_]?\d|ใบสำคัญทั่วไป/i,
        ],
        type: 'JOURNAL_VOUCHER',
    },
};

// Storage folder mapping
const STORAGE_FOLDERS: Record<DocumentType, string> = {
    'TAX_INVOICE': 'invoices',
    'RECEIPT': 'receipts',
    'ABBREVIATED_TAX_INVOICE': 'receipts',
    'DEBIT_NOTE': 'invoices',
    'CREDIT_NOTE': 'invoices',
    'BANK_STATEMENT': 'bank-statements',
    'WHT_CERTIFICATE': 'wht-certificates',
    'SALES_REPORT': 'sales-reports',
    'CONTRACT': 'contracts',
    'QUOTATION': 'quotations',
    'PURCHASE_ORDER': 'purchase-orders',
    'PAYMENT_VOUCHER': 'vouchers',
    'RECEIPT_VOUCHER': 'vouchers',
    'JOURNAL_VOUCHER': 'vouchers',
    'GENERAL': 'other',
};

// Document type Thai names
const DOCUMENT_TYPE_NAMES: Record<DocumentType, { en: string; th: string }> = {
    'TAX_INVOICE': { en: 'Tax Invoice', th: 'ใบกำกับภาษี' },
    'RECEIPT': { en: 'Receipt', th: 'ใบเสร็จรับเงิน' },
    'ABBREVIATED_TAX_INVOICE': { en: 'Abbreviated Tax Invoice', th: 'ใบกำกับภาษีอย่างย่อ' },
    'DEBIT_NOTE': { en: 'Debit Note', th: 'ใบเพิ่มหนี้' },
    'CREDIT_NOTE': { en: 'Credit Note', th: 'ใบลดหนี้' },
    'BANK_STATEMENT': { en: 'Bank Statement', th: 'รายการเดินบัญชี' },
    'WHT_CERTIFICATE': { en: 'WHT Certificate', th: '50 ทวิ' },
    'SALES_REPORT': { en: 'Sales Report', th: 'รายงานยอดขาย' },
    'CONTRACT': { en: 'Contract', th: 'สัญญา' },
    'QUOTATION': { en: 'Quotation', th: 'ใบเสนอราคา' },
    'PURCHASE_ORDER': { en: 'Purchase Order', th: 'ใบสั่งซื้อ' },
    'PAYMENT_VOUCHER': { en: 'Payment Voucher', th: 'ใบสำคัญจ่าย' },
    'RECEIPT_VOUCHER': { en: 'Receipt Voucher', th: 'ใบสำคัญรับ' },
    'JOURNAL_VOUCHER': { en: 'Journal Voucher', th: 'ใบสำคัญทั่วไป' },
    'GENERAL': { en: 'General', th: 'ทั่วไป' },
};

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate file before upload
 */
export const validateFile = (file: File): ValidationResult => {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 1. Check file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
        errors.push({
            code: 'FILE_TOO_LARGE',
            message: `File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds limit of ${MAX_FILE_SIZE_MB}MB`,
            messageTh: `ขนาดไฟล์ ${(file.size / 1024 / 1024).toFixed(2)}MB เกินกว่าที่กำหนด ${MAX_FILE_SIZE_MB}MB`,
            field: 'file',
        });
    }

    // 2. Check file type - use import types for broader support
    const isAllowedForOCR = ALLOWED_MIME_TYPES.includes(file.type);
    const isAllowedForImport = ALLOWED_IMPORT_TYPES.includes(file.type);

    if (!isAllowedForImport) {
        errors.push({
            code: 'INVALID_FILE_TYPE',
            message: `File type ${file.type} is not supported`,
            messageTh: `ไม่รองรับไฟล์ประเภท ${file.type}`,
            field: 'file',
        });
    } else if (!isAllowedForOCR) {
        warnings.push({
            code: 'NO_OCR_SUPPORT',
            message: 'This file type does not support AI OCR, will be imported as data',
            messageTh: 'ไฟล์ประเภทนี้ไม่รองรับ AI OCR จะนำเข้าเป็นข้อมูลแทน',
        });
    }

    // 3. Check filename for issues
    const filename = file.name;
    if (filename.length > 100) {
        warnings.push({
            code: 'LONG_FILENAME',
            message: 'Filename is very long, will be truncated',
            messageTh: 'ชื่อไฟล์ยาวมาก จะถูกตัดให้สั้นลง',
        });
    }

    // 4. Check for empty file
    if (file.size === 0) {
        errors.push({
            code: 'EMPTY_FILE',
            message: 'File is empty',
            messageTh: 'ไฟล์ว่างเปล่า',
            field: 'file',
        });
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
};

/**
 * Validate Thai Tax ID (13 digits)
 */
export const validateTaxId = (taxId: string): { valid: boolean; error?: string } => {
    // Remove non-digit characters
    const cleaned = taxId.replace(/\D/g, '');

    // Must be exactly 13 digits
    if (cleaned.length !== 13) {
        return {
            valid: false,
            error: `Tax ID must be 13 digits, got ${cleaned.length}`,
        };
    }

    // Thai Tax ID checksum validation
    // Algorithm: Sum of (digit * position) mod 11, then check against last digit
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        sum += parseInt(cleaned[i]) * (13 - i);
    }
    const checkDigit = (11 - (sum % 11)) % 10;

    if (checkDigit !== parseInt(cleaned[12])) {
        return {
            valid: false,
            error: 'Invalid Tax ID checksum',
        };
    }

    return { valid: true };
};

/**
 * Validate amount (not negative, within reasonable range)
 */
export const validateAmount = (
    amount: number,
    options: { min?: number; max?: number; allowNegative?: boolean } = {}
): { valid: boolean; error?: string } => {
    const { max = 100000000, allowNegative = false } = options;
    // If allowNegative, use provided min or no min. Otherwise default min is 0
    const min = options.min !== undefined ? options.min : (allowNegative ? -Infinity : 0);

    if (isNaN(amount)) {
        return { valid: false, error: 'Amount is not a valid number' };
    }

    if (!allowNegative && amount < 0) {
        return { valid: false, error: 'Amount cannot be negative' };
    }

    if (amount < min) {
        return { valid: false, error: `Amount ${amount} is below minimum ${min}` };
    }

    if (amount > max) {
        return { valid: false, error: `Amount ${amount} exceeds maximum ${max}` };
    }

    return { valid: true };
};

// ============================================================================
// CLASSIFICATION FUNCTIONS
// ============================================================================

/**
 * Classify document by filename
 */
export const classifyByFilename = (filename: string): ClassificationResult => {
    for (const [key, config] of Object.entries(CLASSIFICATION_PATTERNS)) {
        for (const pattern of config.patterns) {
            if (pattern.test(filename)) {
                return {
                    docType: config.type,
                    suggestedFolder: STORAGE_FOLDERS[config.type],
                    confidence: 0.8,
                    detectedSource: key,
                };
            }
        }
    }

    return {
        docType: 'GENERAL',
        suggestedFolder: STORAGE_FOLDERS['GENERAL'],
        confidence: 0.2,
    };
};

/**
 * Classify document by AI result
 */
export const classifyByAIResult = (docType: string): ClassificationResult => {
    const normalizedType = docType.toLowerCase();

    if (normalizedType.includes('ใบกำกับภาษี') && !normalizedType.includes('ย่อ')) {
        return { docType: 'TAX_INVOICE', suggestedFolder: 'invoices', confidence: 0.95 };
    }
    if (normalizedType.includes('ย่อ') || normalizedType.includes('abbreviated')) {
        return { docType: 'ABBREVIATED_TAX_INVOICE', suggestedFolder: 'receipts', confidence: 0.95 };
    }
    if (normalizedType.includes('ใบเสร็จ') || normalizedType.includes('receipt')) {
        return { docType: 'RECEIPT', suggestedFolder: 'receipts', confidence: 0.95 };
    }
    if (normalizedType.includes('ใบเพิ่มหนี้') || normalizedType.includes('debit')) {
        return { docType: 'DEBIT_NOTE', suggestedFolder: 'invoices', confidence: 0.95 };
    }
    if (normalizedType.includes('ใบลดหนี้') || normalizedType.includes('credit')) {
        return { docType: 'CREDIT_NOTE', suggestedFolder: 'invoices', confidence: 0.95 };
    }
    if (normalizedType.includes('50 ทวิ') || normalizedType.includes('withholding')) {
        return { docType: 'WHT_CERTIFICATE', suggestedFolder: 'wht-certificates', confidence: 0.95 };
    }

    return { docType: 'GENERAL', suggestedFolder: 'other', confidence: 0.5 };
};

/**
 * Get document type display name
 */
export const getDocumentTypeName = (type: DocumentType, lang: 'en' | 'th' = 'th'): string => {
    return DOCUMENT_TYPE_NAMES[type]?.[lang] || type;
};

/**
 * Get storage folder for document type
 */
export const getStorageFolder = (type: DocumentType): string => {
    return STORAGE_FOLDERS[type] || 'other';
};

// ============================================================================
// DUPLICATE DETECTION
// ============================================================================

/**
 * Check for duplicate documents
 */
export const checkDuplicate = async (
    existingDocs: DocumentRecord[],
    invNumber: string,
    vendorTaxId: string,
    amount: number,
    date?: string
): Promise<DuplicateCheckResult> => {
    const matches: DocumentRecord[] = [];

    for (const doc of existingDocs) {
        if (!doc.ai_data) continue;

        const existingInvNumber = doc.ai_data.header_data.inv_number;
        const existingTaxId = doc.ai_data.parties.counterparty.tax_id;
        const existingAmount = doc.ai_data.financials.grand_total;
        const existingDate = doc.ai_data.header_data.issue_date;

        // Exact match: same invoice number and vendor tax ID
        if (existingInvNumber === invNumber && existingTaxId === vendorTaxId) {
            return {
                isDuplicate: true,
                matches: [doc],
                confidence: 1.0,
                matchType: 'exact',
            };
        }

        // Fuzzy match: same amount and vendor, similar date
        if (existingTaxId === vendorTaxId && Math.abs(existingAmount - amount) < 0.01) {
            // Check if dates are within 7 days
            if (date && existingDate) {
                const dateDiff = Math.abs(
                    new Date(date).getTime() - new Date(existingDate).getTime()
                );
                const daysDiff = dateDiff / (1000 * 60 * 60 * 24);

                if (daysDiff <= 7) {
                    matches.push(doc);
                }
            } else {
                matches.push(doc);
            }
        }
    }

    if (matches.length > 0) {
        return {
            isDuplicate: true,
            matches,
            confidence: 0.7,
            matchType: 'fuzzy',
        };
    }

    return {
        isDuplicate: false,
        matches: [],
        confidence: 0,
    };
};

/**
 * Sanitize filename for storage
 */
export const sanitizeFilename = (filename: string): string => {
    // Remove or replace invalid characters
    let sanitized = filename
        .replace(/[<>:"/\\|?*]/g, '_')  // Replace invalid chars with underscore
        .replace(/\s+/g, '_')           // Replace spaces with underscore
        .replace(/_+/g, '_')            // Remove multiple underscores
        .replace(/^_+|_+$/g, '');       // Remove leading/trailing underscores

    // Truncate if too long (keep extension)
    if (sanitized.length > 100) {
        const ext = sanitized.substring(sanitized.lastIndexOf('.'));
        const name = sanitized.substring(0, sanitized.lastIndexOf('.'));
        sanitized = name.substring(0, 95 - ext.length) + ext;
    }

    return sanitized;
};

// ============================================================================
// EXPORT
// ============================================================================

export const documentValidationService = {
    // Validation
    validateFile,
    validateTaxId,
    validateAmount,

    // Classification
    classifyByFilename,
    classifyByAIResult,
    getDocumentTypeName,
    getStorageFolder,

    // Duplicate Detection
    checkDuplicate,
    sanitizeFilename,

    // Constants
    ALLOWED_MIME_TYPES,
    ALLOWED_IMPORT_TYPES,
    MAX_FILE_SIZE_MB,
    DOCUMENT_TYPE_NAMES,
    STORAGE_FOLDERS,
};

export default documentValidationService;

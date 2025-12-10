/**
 * Input Validation Utilities for Thai Accounting System
 */

// Validation result type
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate Thai Tax ID (13 digits)
 */
export const validateTaxId = (taxId: string): ValidationResult => {
  if (!taxId || taxId.trim() === '') {
    return { isValid: false, error: 'กรุณากรอกเลขประจำตัวผู้เสียภาษี' };
  }

  const cleaned = taxId.replace(/\D/g, '');

  if (cleaned.length !== 13) {
    return { isValid: false, error: 'เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก' };
  }

  // Check digit validation
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned[i]) * (13 - i);
  }
  const checkDigit = (11 - (sum % 11)) % 10;

  if (parseInt(cleaned[12]) !== checkDigit) {
    return { isValid: false, error: 'เลขประจำตัวผู้เสียภาษีไม่ถูกต้อง' };
  }

  return { isValid: true };
};

/**
 * Validate GL Account Code (5 digits)
 */
export const validateAccountCode = (code: string): ValidationResult => {
  if (!code || code.trim() === '') {
    return { isValid: false, error: 'กรุณากรอกรหัสบัญชี' };
  }

  const cleaned = code.replace(/\D/g, '');

  if (cleaned.length !== 5) {
    return { isValid: false, error: 'รหัสบัญชีต้องมี 5 หลัก' };
  }

  // Check valid account ranges
  const prefix = parseInt(cleaned[0]);
  if (![1, 2, 3, 4, 5].includes(prefix)) {
    return { isValid: false, error: 'รหัสบัญชีไม่ถูกต้อง (ต้องเริ่มด้วย 1-5)' };
  }

  return { isValid: true };
};

/**
 * Validate email format
 */
export const validateEmail = (email: string): ValidationResult => {
  if (!email || email.trim() === '') {
    return { isValid: false, error: 'กรุณากรอกอีเมล' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'รูปแบบอีเมลไม่ถูกต้อง' };
  }

  return { isValid: true };
};

/**
 * Validate Thai phone number
 */
export const validatePhone = (phone: string): ValidationResult => {
  if (!phone || phone.trim() === '') {
    return { isValid: true }; // Phone is optional
  }

  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.length < 9 || cleaned.length > 10) {
    return { isValid: false, error: 'เบอร์โทรศัพท์ต้องมี 9-10 หลัก' };
  }

  return { isValid: true };
};

/**
 * Validate amount (positive number)
 */
export const validateAmount = (amount: number | string): ValidationResult => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(num)) {
    return { isValid: false, error: 'จำนวนเงินไม่ถูกต้อง' };
  }

  if (num < 0) {
    return { isValid: false, error: 'จำนวนเงินต้องมากกว่าหรือเท่ากับ 0' };
  }

  // Max amount check (prevent overflow)
  if (num > 999999999999) {
    return { isValid: false, error: 'จำนวนเงินเกินขีดจำกัด' };
  }

  return { isValid: true };
};

/**
 * Validate date string (YYYY-MM-DD format)
 */
export const validateDate = (dateStr: string): ValidationResult => {
  if (!dateStr || dateStr.trim() === '') {
    return { isValid: false, error: 'กรุณาเลือกวันที่' };
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    return { isValid: false, error: 'รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)' };
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return { isValid: false, error: 'วันที่ไม่ถูกต้อง' };
  }

  // Check reasonable date range (1900 - 2100)
  const year = date.getFullYear();
  if (year < 1900 || year > 2100) {
    return { isValid: false, error: 'ปีไม่อยู่ในช่วงที่รองรับ' };
  }

  return { isValid: true };
};

/**
 * Validate required text field
 */
export const validateRequired = (value: string, fieldName: string): ValidationResult => {
  if (!value || value.trim() === '') {
    return { isValid: false, error: `กรุณากรอก${fieldName}` };
  }

  return { isValid: true };
};

/**
 * Validate text length
 */
export const validateLength = (
  value: string,
  min: number,
  max: number,
  fieldName: string
): ValidationResult => {
  if (value.length < min) {
    return { isValid: false, error: `${fieldName}ต้องมีอย่างน้อย ${min} ตัวอักษร` };
  }

  if (value.length > max) {
    return { isValid: false, error: `${fieldName}ต้องไม่เกิน ${max} ตัวอักษร` };
  }

  return { isValid: true };
};

/**
 * Sanitize input (remove XSS vectors)
 */
export const sanitizeInput = (input: string): string => {
  if (!input) return '';

  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
};

/**
 * Format Thai Tax ID with dashes
 */
export const formatTaxId = (taxId: string): string => {
  const cleaned = taxId.replace(/\D/g, '');
  if (cleaned.length !== 13) return taxId;

  return `${cleaned.slice(0, 1)}-${cleaned.slice(1, 5)}-${cleaned.slice(5, 10)}-${cleaned.slice(10, 12)}-${cleaned.slice(12)}`;
};

/**
 * Format phone number
 */
export const formatPhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 9) {
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 5)}-${cleaned.slice(5)}`;
  }
  return phone;
};

/**
 * Validate journal entry (debits must equal credits)
 */
export const validateJournalEntry = (
  lines: { debit: number; credit: number }[]
): ValidationResult => {
  const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);

  // Allow small floating point difference
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return {
      isValid: false,
      error: `ยอดเดบิต (${totalDebit.toFixed(2)}) ไม่เท่ากับยอดเครดิต (${totalCredit.toFixed(2)})`,
    };
  }

  return { isValid: true };
};

/**
 * Validate VAT calculation
 */
export const validateVATCalculation = (
  subtotal: number,
  vatAmount: number,
  vatRate: number = 7
): ValidationResult => {
  const expectedVAT = subtotal * (vatRate / 100);
  const difference = Math.abs(expectedVAT - vatAmount);

  // Allow 1 baht difference for rounding
  if (difference > 1) {
    return {
      isValid: false,
      error: `ยอด VAT ไม่ถูกต้อง (คาดว่า ${expectedVAT.toFixed(2)}, ได้รับ ${vatAmount.toFixed(2)})`,
    };
  }

  return { isValid: true };
};

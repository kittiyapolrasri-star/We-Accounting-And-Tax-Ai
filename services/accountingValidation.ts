/**
 * Accounting Validation Service
 * Validates GL entries, period controls, and accounting rules
 * Ensures data integrity before posting to ledger
 */

import { PostedGLEntry, JournalLine, Client, DocumentRecord, VendorRule } from '../types';
import { databaseService } from './database';

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  messageTh: string;
  field?: string;
  severity: 'critical' | 'error';
}

export interface ValidationWarning {
  code: string;
  message: string;
  messageTh: string;
  field?: string;
}

export interface GLPostingRequest {
  entries: Omit<PostedGLEntry, 'id'>[];
  clientId: string;
  periodMonth: string; // "2024-02"
  sourceDocId?: string;
  userId: string;
}

export interface ChartOfAccount {
  code: string;
  name: string;
  nameTh: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  subType?: string;
  isActive: boolean;
  normalBalance: 'debit' | 'credit';
  parentCode?: string;
}

// ============================================================================
// THAI CHART OF ACCOUNTS (STANDARD)
// ============================================================================

export const THAI_CHART_OF_ACCOUNTS: ChartOfAccount[] = [
  // Assets (1xxxx)
  { code: '11100', name: 'Cash', nameTh: 'เงินสด', type: 'asset', subType: 'current', isActive: true, normalBalance: 'debit' },
  { code: '11200', name: 'Cash at Bank', nameTh: 'เงินฝากธนาคาร', type: 'asset', subType: 'current', isActive: true, normalBalance: 'debit' },
  { code: '11300', name: 'Accounts Receivable', nameTh: 'ลูกหนี้การค้า', type: 'asset', subType: 'current', isActive: true, normalBalance: 'debit' },
  { code: '11301', name: 'Allowance for Doubtful Accounts', nameTh: 'ค่าเผื่อหนี้สงสัยจะสูญ', type: 'asset', subType: 'current', isActive: true, normalBalance: 'credit' },
  { code: '11400', name: 'Inventory', nameTh: 'สินค้าคงเหลือ', type: 'asset', subType: 'current', isActive: true, normalBalance: 'debit' },
  { code: '11500', name: 'Other Receivables', nameTh: 'ลูกหนี้อื่น', type: 'asset', subType: 'current', isActive: true, normalBalance: 'debit' },
  { code: '11540', name: 'Input VAT', nameTh: 'ภาษีซื้อ', type: 'asset', subType: 'current', isActive: true, normalBalance: 'debit' },
  { code: '11541', name: 'Undue Input VAT', nameTh: 'ภาษีซื้อยังไม่ถึงกำหนด', type: 'asset', subType: 'current', isActive: true, normalBalance: 'debit' },
  { code: '11600', name: 'Advance Payment', nameTh: 'เงินทดรองจ่าย', type: 'asset', subType: 'current', isActive: true, normalBalance: 'debit' },
  { code: '11700', name: 'Accrued Income', nameTh: 'รายได้ค้างรับ', type: 'asset', subType: 'current', isActive: true, normalBalance: 'debit' },
  { code: '11800', name: 'Prepaid Expenses', nameTh: 'ค่าใช้จ่ายจ่ายล่วงหน้า', type: 'asset', subType: 'current', isActive: true, normalBalance: 'debit' },
  { code: '11900', name: 'WHT Receivable', nameTh: 'ภาษีหัก ณ ที่จ่ายค้างรับ', type: 'asset', subType: 'current', isActive: true, normalBalance: 'debit' },
  { code: '12100', name: 'Land', nameTh: 'ที่ดิน', type: 'asset', subType: 'fixed', isActive: true, normalBalance: 'debit' },
  { code: '12200', name: 'Building', nameTh: 'อาคาร', type: 'asset', subType: 'fixed', isActive: true, normalBalance: 'debit' },
  { code: '12201', name: 'Accumulated Depreciation - Building', nameTh: 'ค่าเสื่อมราคาสะสม-อาคาร', type: 'asset', subType: 'fixed', isActive: true, normalBalance: 'credit' },
  { code: '12300', name: 'Vehicle', nameTh: 'ยานพาหนะ', type: 'asset', subType: 'fixed', isActive: true, normalBalance: 'debit' },
  { code: '12301', name: 'Accumulated Depreciation - Vehicle', nameTh: 'ค่าเสื่อมราคาสะสม-ยานพาหนะ', type: 'asset', subType: 'fixed', isActive: true, normalBalance: 'credit' },
  { code: '12400', name: 'Equipment', nameTh: 'อุปกรณ์สำนักงาน', type: 'asset', subType: 'fixed', isActive: true, normalBalance: 'debit' },
  { code: '12401', name: 'Accumulated Depreciation - Equipment', nameTh: 'ค่าเสื่อมราคาสะสม-อุปกรณ์', type: 'asset', subType: 'fixed', isActive: true, normalBalance: 'credit' },
  { code: '12500', name: 'Computer & Software', nameTh: 'คอมพิวเตอร์และซอฟต์แวร์', type: 'asset', subType: 'fixed', isActive: true, normalBalance: 'debit' },
  { code: '12501', name: 'Accumulated Depreciation - Computer', nameTh: 'ค่าเสื่อมราคาสะสม-คอมพิวเตอร์', type: 'asset', subType: 'fixed', isActive: true, normalBalance: 'credit' },

  // Liabilities (2xxxx)
  { code: '21100', name: 'Short-term Loan', nameTh: 'เงินกู้ยืมระยะสั้น', type: 'liability', subType: 'current', isActive: true, normalBalance: 'credit' },
  { code: '21200', name: 'Accounts Payable', nameTh: 'เจ้าหนี้การค้า', type: 'liability', subType: 'current', isActive: true, normalBalance: 'credit' },
  { code: '21300', name: 'Accrued Expenses', nameTh: 'ค่าใช้จ่ายค้างจ่าย', type: 'liability', subType: 'current', isActive: true, normalBalance: 'credit' },
  { code: '21400', name: 'WHT Payable', nameTh: 'ภาษีหัก ณ ที่จ่ายค้างจ่าย', type: 'liability', subType: 'current', isActive: true, normalBalance: 'credit' },
  { code: '21540', name: 'Output VAT', nameTh: 'ภาษีขาย', type: 'liability', subType: 'current', isActive: true, normalBalance: 'credit' },
  { code: '21541', name: 'Undue Output VAT', nameTh: 'ภาษีขายยังไม่ถึงกำหนด', type: 'liability', subType: 'current', isActive: true, normalBalance: 'credit' },
  { code: '21600', name: 'CIT Payable', nameTh: 'ภาษีเงินได้นิติบุคคลค้างจ่าย', type: 'liability', subType: 'current', isActive: true, normalBalance: 'credit' },
  { code: '21700', name: 'Deferred Income', nameTh: 'รายได้รับล่วงหน้า', type: 'liability', subType: 'current', isActive: true, normalBalance: 'credit' },
  { code: '21800', name: 'Bonus Provision', nameTh: 'ประมาณการโบนัส', type: 'liability', subType: 'current', isActive: true, normalBalance: 'credit' },
  { code: '21900', name: 'Leave Provision', nameTh: 'ประมาณการค่าชดเชยพนักงาน', type: 'liability', subType: 'current', isActive: true, normalBalance: 'credit' },
  { code: '22100', name: 'Warranty Provision', nameTh: 'ประมาณการค่ารับประกัน', type: 'liability', subType: 'non-current', isActive: true, normalBalance: 'credit' },
  { code: '22200', name: 'Legal Provision', nameTh: 'ประมาณการหนี้สินทางกฎหมาย', type: 'liability', subType: 'non-current', isActive: true, normalBalance: 'credit' },
  { code: '23100', name: 'Long-term Loan', nameTh: 'เงินกู้ยืมระยะยาว', type: 'liability', subType: 'non-current', isActive: true, normalBalance: 'credit' },

  // Equity (3xxxx)
  { code: '31100', name: 'Share Capital', nameTh: 'ทุนจดทะเบียน', type: 'equity', isActive: true, normalBalance: 'credit' },
  { code: '31200', name: 'Paid-up Capital', nameTh: 'ทุนชำระแล้ว', type: 'equity', isActive: true, normalBalance: 'credit' },
  { code: '32000', name: 'Retained Earnings', nameTh: 'กำไรสะสม', type: 'equity', isActive: true, normalBalance: 'credit' },
  { code: '33000', name: 'Legal Reserve', nameTh: 'สำรองตามกฎหมาย', type: 'equity', isActive: true, normalBalance: 'credit' },
  { code: '39000', name: 'Income Summary', nameTh: 'สรุปรายได้', type: 'equity', isActive: true, normalBalance: 'credit' },

  // Revenue (4xxxx)
  { code: '41100', name: 'Sales Revenue', nameTh: 'รายได้จากการขายสินค้า', type: 'revenue', isActive: true, normalBalance: 'credit' },
  { code: '41200', name: 'Service Revenue', nameTh: 'รายได้จากการให้บริการ', type: 'revenue', isActive: true, normalBalance: 'credit' },
  { code: '41300', name: 'Other Revenue', nameTh: 'รายได้อื่น', type: 'revenue', isActive: true, normalBalance: 'credit' },
  { code: '42100', name: 'Interest Income', nameTh: 'ดอกเบี้ยรับ', type: 'revenue', isActive: true, normalBalance: 'credit' },
  { code: '42200', name: 'Dividend Income', nameTh: 'เงินปันผลรับ', type: 'revenue', isActive: true, normalBalance: 'credit' },
  { code: '42300', name: 'Gain on Disposal', nameTh: 'กำไรจากการจำหน่ายสินทรัพย์', type: 'revenue', isActive: true, normalBalance: 'credit' },
  { code: '42400', name: 'FX Gain', nameTh: 'กำไรจากอัตราแลกเปลี่ยน', type: 'revenue', isActive: true, normalBalance: 'credit' },

  // Expenses (5xxxx)
  { code: '51100', name: 'Cost of Goods Sold', nameTh: 'ต้นทุนขาย', type: 'expense', isActive: true, normalBalance: 'debit' },
  { code: '51200', name: 'Cost of Services', nameTh: 'ต้นทุนบริการ', type: 'expense', isActive: true, normalBalance: 'debit' },
  { code: '52100', name: 'Salary & Wages', nameTh: 'เงินเดือนและค่าจ้าง', type: 'expense', subType: 'admin', isActive: true, normalBalance: 'debit' },
  { code: '52200', name: 'Social Security', nameTh: 'ประกันสังคม', type: 'expense', subType: 'admin', isActive: true, normalBalance: 'debit' },
  { code: '52300', name: 'Rent Expense', nameTh: 'ค่าเช่า', type: 'expense', subType: 'admin', isActive: true, normalBalance: 'debit' },
  { code: '52400', name: 'Utilities', nameTh: 'ค่าสาธารณูปโภค', type: 'expense', subType: 'admin', isActive: true, normalBalance: 'debit' },
  { code: '52500', name: 'Communication', nameTh: 'ค่าโทรศัพท์และอินเทอร์เน็ต', type: 'expense', subType: 'admin', isActive: true, normalBalance: 'debit' },
  { code: '52600', name: 'Transportation', nameTh: 'ค่าเดินทาง', type: 'expense', subType: 'admin', isActive: true, normalBalance: 'debit' },
  { code: '52700', name: 'Entertainment', nameTh: 'ค่ารับรอง', type: 'expense', subType: 'admin', isActive: true, normalBalance: 'debit' },
  { code: '52800', name: 'Professional Fees', nameTh: 'ค่าวิชาชีพ', type: 'expense', subType: 'admin', isActive: true, normalBalance: 'debit' },
  { code: '52900', name: 'Insurance', nameTh: 'ค่าประกันภัย', type: 'expense', subType: 'admin', isActive: true, normalBalance: 'debit' },
  { code: '53000', name: 'Non-deductible VAT', nameTh: 'ภาษีซื้อไม่ขอคืน', type: 'expense', subType: 'admin', isActive: true, normalBalance: 'debit' },
  { code: '53100', name: 'Office Supplies', nameTh: 'วัสดุสำนักงาน', type: 'expense', subType: 'admin', isActive: true, normalBalance: 'debit' },
  { code: '53200', name: 'Repair & Maintenance', nameTh: 'ค่าซ่อมแซมและบำรุงรักษา', type: 'expense', subType: 'admin', isActive: true, normalBalance: 'debit' },
  { code: '53300', name: 'Advertising', nameTh: 'ค่าโฆษณา', type: 'expense', subType: 'selling', isActive: true, normalBalance: 'debit' },
  { code: '53400', name: 'Depreciation Expense', nameTh: 'ค่าเสื่อมราคา', type: 'expense', subType: 'admin', isActive: true, normalBalance: 'debit' },
  { code: '53500', name: 'Bad Debt Expense', nameTh: 'หนี้สูญ', type: 'expense', subType: 'admin', isActive: true, normalBalance: 'debit' },
  { code: '54100', name: 'Bank Charges', nameTh: 'ค่าธรรมเนียมธนาคาร', type: 'expense', subType: 'finance', isActive: true, normalBalance: 'debit' },
  { code: '54200', name: 'Interest Expense', nameTh: 'ดอกเบี้ยจ่าย', type: 'expense', subType: 'finance', isActive: true, normalBalance: 'debit' },
  { code: '54300', name: 'FX Loss', nameTh: 'ขาดทุนจากอัตราแลกเปลี่ยน', type: 'expense', subType: 'finance', isActive: true, normalBalance: 'debit' },
  { code: '58000', name: 'Corporate Income Tax', nameTh: 'ภาษีเงินได้นิติบุคคล', type: 'expense', isActive: true, normalBalance: 'debit' },
];

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate GL entries before posting
 * Checks: Balance, Account codes, Period lock, Duplicate prevention
 */
export const validateGLPosting = async (request: GLPostingRequest): Promise<ValidationResult> => {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // 1. Check if entries exist
  if (!request.entries || request.entries.length === 0) {
    errors.push({
      code: 'GL_EMPTY',
      message: 'No GL entries provided',
      messageTh: 'ไม่มีรายการบัญชีที่จะบันทึก',
      severity: 'critical',
    });
    return { isValid: false, errors, warnings };
  }

  // 2. Validate Debit = Credit (CRITICAL)
  const totalDebit = request.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
  const totalCredit = request.entries.reduce((sum, e) => sum + (e.credit || 0), 0);
  const difference = Math.abs(totalDebit - totalCredit);

  if (difference > 0.01) { // Allow 1 satang tolerance
    errors.push({
      code: 'GL_OUT_OF_BALANCE',
      message: `Journal out of balance: Debit ${totalDebit.toFixed(2)} ≠ Credit ${totalCredit.toFixed(2)} (Diff: ${difference.toFixed(2)})`,
      messageTh: `ยอดเดบิต ${totalDebit.toFixed(2)} ไม่เท่ากับเครดิต ${totalCredit.toFixed(2)} (ต่าง ${difference.toFixed(2)} บาท)`,
      severity: 'critical',
    });
  }

  // 3. Validate each entry
  for (let i = 0; i < request.entries.length; i++) {
    const entry = request.entries[i];

    // Check account code exists
    const account = THAI_CHART_OF_ACCOUNTS.find(a => a.code === entry.account_code);
    if (!account) {
      errors.push({
        code: 'GL_INVALID_ACCOUNT',
        message: `Invalid account code: ${entry.account_code}`,
        messageTh: `รหัสบัญชีไม่ถูกต้อง: ${entry.account_code}`,
        field: `entries[${i}].account_code`,
        severity: 'error',
      });
    } else if (!account.isActive) {
      warnings.push({
        code: 'GL_INACTIVE_ACCOUNT',
        message: `Account ${entry.account_code} is inactive`,
        messageTh: `บัญชี ${entry.account_code} ถูกปิดใช้งาน`,
        field: `entries[${i}].account_code`,
      });
    }

    // Check amounts are valid
    if (entry.debit < 0 || entry.credit < 0) {
      errors.push({
        code: 'GL_NEGATIVE_AMOUNT',
        message: `Negative amount not allowed`,
        messageTh: `จำนวนเงินติดลบไม่ได้`,
        field: `entries[${i}]`,
        severity: 'error',
      });
    }

    // Check entry has either debit or credit (not both, not neither)
    if (entry.debit > 0 && entry.credit > 0) {
      errors.push({
        code: 'GL_BOTH_SIDES',
        message: `Entry cannot have both debit and credit`,
        messageTh: `รายการไม่สามารถมีทั้งเดบิตและเครดิตพร้อมกัน`,
        field: `entries[${i}]`,
        severity: 'error',
      });
    }

    if ((entry.debit === 0 || entry.debit === undefined) && (entry.credit === 0 || entry.credit === undefined)) {
      errors.push({
        code: 'GL_ZERO_AMOUNT',
        message: `Entry has no amount`,
        messageTh: `รายการไม่มียอดเงิน`,
        field: `entries[${i}]`,
        severity: 'error',
      });
    }

    // Check date format
    if (!entry.date || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
      errors.push({
        code: 'GL_INVALID_DATE',
        message: `Invalid date format: ${entry.date}`,
        messageTh: `รูปแบบวันที่ไม่ถูกต้อง: ${entry.date}`,
        field: `entries[${i}].date`,
        severity: 'error',
      });
    }

    // Check clientId matches
    if (entry.clientId !== request.clientId) {
      errors.push({
        code: 'GL_CLIENT_MISMATCH',
        message: `Entry clientId does not match request`,
        messageTh: `รหัสลูกค้าในรายการไม่ตรงกับที่ร้องขอ`,
        field: `entries[${i}].clientId`,
        severity: 'error',
      });
    }
  }

  // 4. Check Period Lock
  try {
    const client = await databaseService.getClientById(request.clientId);
    if (client && client.current_workflow.is_locked) {
      errors.push({
        code: 'PERIOD_LOCKED',
        message: `Period is locked for client ${client.name}`,
        messageTh: `งวดบัญชีของ ${client.name} ถูกล็อคแล้ว ไม่สามารถบันทึกรายการได้`,
        severity: 'critical',
      });
    }
  } catch (e) {
    warnings.push({
      code: 'CLIENT_CHECK_FAILED',
      message: 'Could not verify client period lock status',
      messageTh: 'ไม่สามารถตรวจสอบสถานะการล็อคงวดได้',
    });
  }

  // 5. Check for duplicate document posting
  if (request.sourceDocId) {
    try {
      const existingEntries = await databaseService.getGLEntriesByClient(request.clientId);
      const duplicate = existingEntries.find(e => e.doc_no === request.sourceDocId);
      if (duplicate) {
        warnings.push({
          code: 'POSSIBLE_DUPLICATE',
          message: `Document ${request.sourceDocId} may already be posted`,
          messageTh: `เอกสาร ${request.sourceDocId} อาจถูกบันทึกแล้ว`,
        });
      }
    } catch (e) {
      // Non-critical, continue
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Validate journal lines from AI analysis
 */
export const validateJournalLines = (lines: JournalLine[]): ValidationResult => {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!lines || lines.length < 2) {
    errors.push({
      code: 'JL_MINIMUM_LINES',
      message: 'Journal must have at least 2 lines',
      messageTh: 'รายการบัญชีต้องมีอย่างน้อย 2 บรรทัด',
      severity: 'error',
    });
    return { isValid: false, errors, warnings };
  }

  // Check balance
  const totalDebit = lines.filter(l => l.account_side === 'DEBIT').reduce((sum, l) => sum + l.amount, 0);
  const totalCredit = lines.filter(l => l.account_side === 'CREDIT').reduce((sum, l) => sum + l.amount, 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    errors.push({
      code: 'JL_OUT_OF_BALANCE',
      message: `Journal lines out of balance`,
      messageTh: `รายการบัญชีไม่ balance (Debit: ${totalDebit}, Credit: ${totalCredit})`,
      severity: 'critical',
    });
  }

  // Check each line
  lines.forEach((line, i) => {
    if (!line.account_code || line.account_code.length !== 5) {
      errors.push({
        code: 'JL_INVALID_CODE',
        message: `Invalid account code: ${line.account_code}`,
        messageTh: `รหัสบัญชีไม่ถูกต้อง: ${line.account_code}`,
        field: `lines[${i}].account_code`,
        severity: 'error',
      });
    }

    if (line.amount <= 0) {
      errors.push({
        code: 'JL_INVALID_AMOUNT',
        message: `Amount must be positive`,
        messageTh: `จำนวนเงินต้องมากกว่า 0`,
        field: `lines[${i}].amount`,
        severity: 'error',
      });
    }
  });

  return { isValid: errors.length === 0, errors, warnings };
};

/**
 * Check if period can be edited (not locked)
 */
export const canEditPeriod = async (clientId: string, periodMonth?: string): Promise<boolean> => {
  try {
    const client = await databaseService.getClientById(clientId);
    if (!client) return false;

    // Check if current workflow is locked
    if (client.current_workflow.is_locked) {
      return false;
    }

    // If specific period month provided, check if it matches current workflow
    if (periodMonth && client.current_workflow.month !== periodMonth) {
      // Different period - assume it's a past period which should be locked
      return false;
    }

    return true;
  } catch (e) {
    console.error('Error checking period edit permission:', e);
    return false;
  }
};

/**
 * Validate tax ID format (Thailand)
 */
export const validateTaxId = (taxId: string): ValidationResult => {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Remove spaces and dashes
  const cleanId = taxId.replace(/[\s-]/g, '');

  // Must be 13 digits
  if (!/^\d{13}$/.test(cleanId)) {
    errors.push({
      code: 'TAX_ID_FORMAT',
      message: 'Tax ID must be 13 digits',
      messageTh: 'เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก',
      severity: 'error',
    });
    return { isValid: false, errors, warnings };
  }

  // Validate check digit
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleanId[i]) * (13 - i);
  }
  const checkDigit = (11 - (sum % 11)) % 10;

  if (checkDigit !== parseInt(cleanId[12])) {
    errors.push({
      code: 'TAX_ID_CHECKSUM',
      message: 'Tax ID checksum is invalid',
      messageTh: 'เลขประจำตัวผู้เสียภาษีไม่ถูกต้อง (Check digit)',
      severity: 'error',
    });
  }

  // Check first digit for entity type
  const firstDigit = cleanId[0];
  if (firstDigit === '0') {
    // Company registered with DBD
  } else if (['1', '2', '3', '4', '5'].includes(firstDigit)) {
    // Individual
  } else {
    warnings.push({
      code: 'TAX_ID_TYPE',
      message: 'Unusual tax ID format',
      messageTh: 'รูปแบบเลขประจำตัวผู้เสียภาษีไม่ปกติ',
    });
  }

  return { isValid: errors.length === 0, errors, warnings };
};

/**
 * Validate invoice number for duplicates
 */
export const checkDuplicateInvoice = async (
  clientId: string,
  invoiceNo: string,
  vendorTaxId: string,
  amount: number,
  excludeDocId?: string
): Promise<{ isDuplicate: boolean; matchingDocs: DocumentRecord[] }> => {
  try {
    const docs = await databaseService.getDocumentsByClient(clientId);
    const matchingDocs = docs.filter(d => {
      if (excludeDocId && d.id === excludeDocId) return false;
      if (!d.ai_data) return false;

      const sameInvoice = d.ai_data.header_data.inv_number === invoiceNo;
      const sameVendor = d.ai_data.parties.counterparty.tax_id === vendorTaxId;
      const sameAmount = Math.abs(d.ai_data.financials.grand_total - amount) < 1;

      return sameInvoice && sameVendor && sameAmount;
    });

    return {
      isDuplicate: matchingDocs.length > 0,
      matchingDocs,
    };
  } catch (e) {
    console.error('Error checking duplicate invoice:', e);
    return { isDuplicate: false, matchingDocs: [] };
  }
};

/**
 * Get account by code
 */
export const getAccountByCode = (code: string): ChartOfAccount | undefined => {
  return THAI_CHART_OF_ACCOUNTS.find(a => a.code === code);
};

/**
 * Get all accounts by type
 */
export const getAccountsByType = (type: ChartOfAccount['type']): ChartOfAccount[] => {
  return THAI_CHART_OF_ACCOUNTS.filter(a => a.type === type);
};

/**
 * Validate WHT calculation
 */
export const validateWHTCalculation = (
  grossAmount: number,
  whtRate: number,
  whtAmount: number
): ValidationResult => {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const expectedWHT = Math.round(grossAmount * (whtRate / 100) * 100) / 100;
  const tolerance = 1; // 1 baht tolerance

  if (Math.abs(expectedWHT - whtAmount) > tolerance) {
    errors.push({
      code: 'WHT_MISMATCH',
      message: `WHT calculation mismatch: Expected ${expectedWHT}, got ${whtAmount}`,
      messageTh: `การคำนวณภาษีหัก ณ ที่จ่ายไม่ตรง: ควรได้ ${expectedWHT} บาท แต่ได้ ${whtAmount} บาท`,
      severity: 'error',
    });
  }

  // Validate rate
  const validRates = [1, 2, 3, 5, 10, 15];
  if (!validRates.includes(whtRate)) {
    warnings.push({
      code: 'WHT_UNUSUAL_RATE',
      message: `WHT rate ${whtRate}% is unusual`,
      messageTh: `อัตราภาษีหัก ณ ที่จ่าย ${whtRate}% ไม่ปกติ`,
    });
  }

  return { isValid: errors.length === 0, errors, warnings };
};

/**
 * Validate VAT calculation
 */
export const validateVATCalculation = (
  subtotal: number,
  vatRate: number,
  vatAmount: number,
  grandTotal: number
): ValidationResult => {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const expectedVAT = Math.round(subtotal * (vatRate / 100) * 100) / 100;
  const expectedTotal = subtotal + expectedVAT;
  const tolerance = 1; // 1 baht tolerance

  if (Math.abs(expectedVAT - vatAmount) > tolerance) {
    errors.push({
      code: 'VAT_MISMATCH',
      message: `VAT calculation mismatch: Expected ${expectedVAT}, got ${vatAmount}`,
      messageTh: `การคำนวณ VAT ไม่ตรง: ควรได้ ${expectedVAT} บาท แต่ได้ ${vatAmount} บาท`,
      severity: 'error',
    });
  }

  if (Math.abs(expectedTotal - grandTotal) > tolerance) {
    errors.push({
      code: 'TOTAL_MISMATCH',
      message: `Grand total mismatch: Expected ${expectedTotal}, got ${grandTotal}`,
      messageTh: `ยอดรวมไม่ตรง: ควรได้ ${expectedTotal} บาท แต่ได้ ${grandTotal} บาท`,
      severity: 'error',
    });
  }

  // Thai VAT rate
  if (vatRate !== 7 && vatRate !== 0) {
    warnings.push({
      code: 'VAT_UNUSUAL_RATE',
      message: `VAT rate ${vatRate}% is unusual for Thailand`,
      messageTh: `อัตรา VAT ${vatRate}% ไม่ปกติ (ควรเป็น 7% หรือ 0%)`,
    });
  }

  return { isValid: errors.length === 0, errors, warnings };
};

// Export all validation functions
export const validationService = {
  validateGLPosting,
  validateJournalLines,
  canEditPeriod,
  validateTaxId,
  checkDuplicateInvoice,
  getAccountByCode,
  getAccountsByType,
  validateWHTCalculation,
  validateVATCalculation,
  THAI_CHART_OF_ACCOUNTS,
};

export default validationService;

/**
 * Period Closing Service
 * Handles monthly/yearly closing entries, accruals, provisions, and depreciation
 */

import { PostedGLEntry, FixedAsset, DocumentRecord } from '../types';

// Closing Entry Types
export type ClosingEntryType =
  | 'DEPRECIATION'      // ค่าเสื่อมราคา
  | 'PREPAID_EXPENSE'   // รายจ่ายล่วงหน้า
  | 'ACCRUED_EXPENSE'   // ค่าใช้จ่ายค้างจ่าย
  | 'ACCRUED_INCOME'    // รายได้ค้างรับ
  | 'DEFERRED_INCOME'   // รายได้รับล่วงหน้า
  | 'PROVISION'         // ประมาณการหนี้สิน
  | 'INVENTORY_ADJ'     // ปรับปรุงสินค้าคงเหลือ
  | 'FX_ADJUSTMENT'     // ปรับปรุงอัตราแลกเปลี่ยน
  | 'CLOSING'           // ปิดบัญชีรายได้/ค่าใช้จ่าย
  | 'CIT_ACCRUAL';      // ตั้งค้างภาษีเงินได้

export interface ClosingTask {
  id: string;
  type: ClosingEntryType;
  title: string;
  titleEn: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  required: boolean;
  amount?: number;
  entries?: PostedGLEntry[];
  autoCalculate: boolean;
}

export interface AccrualItem {
  id: string;
  type: 'prepaid' | 'accrued_expense' | 'accrued_income' | 'deferred';
  description: string;
  vendorOrCustomer: string;
  originalAmount: number;
  periodMonths: number;
  startDate: string;
  monthlyAmount: number;
  recognizedToDate: number;
  remainingAmount: number;
  accountCode: string;
  expenseAccountCode: string;
}

export interface ProvisionItem {
  id: string;
  type: 'warranty' | 'legal' | 'restructuring' | 'bad_debt' | 'bonus' | 'leave' | 'other';
  description: string;
  estimatedAmount: number;
  probability: number; // 0-100%
  provisionAmount: number;
  accountCode: string;
  expenseAccountCode: string;
  notes?: string;
}

// Account code mappings for Thai Chart of Accounts
export const CLOSING_ACCOUNTS = {
  // Assets
  PREPAID_EXPENSE: '11800',
  ACCRUED_INCOME: '11700',

  // Liabilities
  ACCRUED_EXPENSE: '21200',
  DEFERRED_INCOME: '21700',
  WARRANTY_PROVISION: '22100',
  LEGAL_PROVISION: '22200',
  BAD_DEBT_PROVISION: '11301', // Contra to AR
  BONUS_PROVISION: '21800',
  LEAVE_PROVISION: '21900',

  // Depreciation
  ACCUM_DEPRE_BUILDING: '12201',
  ACCUM_DEPRE_EQUIPMENT: '12401',
  ACCUM_DEPRE_VEHICLE: '12501',
  ACCUM_DEPRE_SOFTWARE: '12601',
  DEPRE_EXPENSE: '53400',

  // P&L Closing
  INCOME_SUMMARY: '39000',
  RETAINED_EARNINGS: '32000',

  // CIT
  CIT_EXPENSE: '58000',
  CIT_PAYABLE: '21600',
};

/**
 * Calculate monthly depreciation for fixed assets
 */
export const calculateDepreciation = (
  assets: FixedAsset[],
  clientId: string,
  period: string // YYYY-MM
): { entries: PostedGLEntry[]; totalDepreciation: number; details: { asset: FixedAsset; monthly: number }[] } => {
  const entries: PostedGLEntry[] = [];
  const details: { asset: FixedAsset; monthly: number }[] = [];
  let totalDepreciation = 0;

  const [year, month] = period.split('-').map(Number);
  const periodEnd = new Date(year, month, 0).toISOString().split('T')[0];

  assets.forEach((asset, index) => {
    // Skip if no useful life
    if (!asset.useful_life_years || asset.useful_life_years <= 0) return;

    // Calculate monthly depreciation (straight-line)
    const depreciableAmount = asset.cost - asset.residual_value;
    const monthlyDepreciation = depreciableAmount / (asset.useful_life_years * 12);

    // Skip if already fully depreciated
    const totalAccumulated = asset.accumulated_depreciation_bf + (asset.current_month_depreciation * 12);
    if (totalAccumulated >= depreciableAmount) return;

    // Determine depreciation account based on category
    let accumDepreAccount = CLOSING_ACCOUNTS.ACCUM_DEPRE_EQUIPMENT;
    if (asset.category === 'Building') accumDepreAccount = CLOSING_ACCOUNTS.ACCUM_DEPRE_BUILDING;
    else if (asset.category === 'Vehicle') accumDepreAccount = CLOSING_ACCOUNTS.ACCUM_DEPRE_VEHICLE;
    else if (asset.category === 'Software') accumDepreAccount = CLOSING_ACCOUNTS.ACCUM_DEPRE_SOFTWARE;

    // Create depreciation entries
    entries.push({
      id: `DEPRE-EXP-${period}-${index}`,
      clientId,
      date: periodEnd,
      doc_no: `JV-DEPRE-${period}`,
      description: `ค่าเสื่อมราคา: ${asset.name} (${asset.asset_code})`,
      account_code: CLOSING_ACCOUNTS.DEPRE_EXPENSE,
      account_name: 'ค่าเสื่อมราคา',
      debit: Math.round(monthlyDepreciation * 100) / 100,
      credit: 0,
      system_generated: true,
    });

    entries.push({
      id: `DEPRE-ACC-${period}-${index}`,
      clientId,
      date: periodEnd,
      doc_no: `JV-DEPRE-${period}`,
      description: `ค่าเสื่อมราคาสะสม: ${asset.name} (${asset.asset_code})`,
      account_code: accumDepreAccount,
      account_name: 'ค่าเสื่อมราคาสะสม',
      debit: 0,
      credit: Math.round(monthlyDepreciation * 100) / 100,
      system_generated: true,
    });

    totalDepreciation += monthlyDepreciation;
    details.push({ asset, monthly: monthlyDepreciation });
  });

  return {
    entries,
    totalDepreciation: Math.round(totalDepreciation * 100) / 100,
    details,
  };
};

/**
 * Calculate accrual entries
 */
export const calculateAccruals = (
  accruals: AccrualItem[],
  clientId: string,
  period: string
): { entries: PostedGLEntry[]; summary: { type: string; amount: number }[] } => {
  const entries: PostedGLEntry[] = [];
  const summary: { type: string; amount: number }[] = [];

  const [year, month] = period.split('-').map(Number);
  const periodEnd = new Date(year, month, 0).toISOString().split('T')[0];

  accruals.forEach((item, index) => {
    const periodDate = new Date(period + '-01');
    const startDate = new Date(item.startDate);

    // Skip if not started yet
    if (startDate > periodDate) return;

    // Calculate months elapsed
    const monthsElapsed = (periodDate.getFullYear() - startDate.getFullYear()) * 12 +
                          (periodDate.getMonth() - startDate.getMonth()) + 1;

    // Skip if fully recognized
    if (monthsElapsed > item.periodMonths) return;

    const amountToRecognize = item.monthlyAmount;

    switch (item.type) {
      case 'prepaid':
        // Dr. Expense, Cr. Prepaid Asset
        entries.push({
          id: `ACCR-PRE-DR-${period}-${index}`,
          clientId,
          date: periodEnd,
          doc_no: `JV-ACCR-${period}`,
          description: `ตัดจ่ายล่วงหน้า: ${item.description}`,
          account_code: item.expenseAccountCode,
          account_name: 'ค่าใช้จ่าย (จากรายจ่ายล่วงหน้า)',
          debit: amountToRecognize,
          credit: 0,
          system_generated: true,
        });
        entries.push({
          id: `ACCR-PRE-CR-${period}-${index}`,
          clientId,
          date: periodEnd,
          doc_no: `JV-ACCR-${period}`,
          description: `ตัดจ่ายล่วงหน้า: ${item.description}`,
          account_code: item.accountCode,
          account_name: 'รายจ่ายล่วงหน้า',
          debit: 0,
          credit: amountToRecognize,
          system_generated: true,
        });
        summary.push({ type: 'รายจ่ายล่วงหน้า', amount: amountToRecognize });
        break;

      case 'accrued_expense':
        // Dr. Expense, Cr. Accrued Payable
        entries.push({
          id: `ACCR-EXP-DR-${period}-${index}`,
          clientId,
          date: periodEnd,
          doc_no: `JV-ACCR-${period}`,
          description: `ตั้งค้างจ่าย: ${item.description}`,
          account_code: item.expenseAccountCode,
          account_name: 'ค่าใช้จ่าย (ค้างจ่าย)',
          debit: amountToRecognize,
          credit: 0,
          system_generated: true,
        });
        entries.push({
          id: `ACCR-EXP-CR-${period}-${index}`,
          clientId,
          date: periodEnd,
          doc_no: `JV-ACCR-${period}`,
          description: `ตั้งค้างจ่าย: ${item.description}`,
          account_code: item.accountCode,
          account_name: 'ค่าใช้จ่ายค้างจ่าย',
          debit: 0,
          credit: amountToRecognize,
          system_generated: true,
        });
        summary.push({ type: 'ค่าใช้จ่ายค้างจ่าย', amount: amountToRecognize });
        break;

      case 'accrued_income':
        // Dr. Accrued Receivable, Cr. Revenue
        entries.push({
          id: `ACCR-INC-DR-${period}-${index}`,
          clientId,
          date: periodEnd,
          doc_no: `JV-ACCR-${period}`,
          description: `ตั้งรายได้ค้างรับ: ${item.description}`,
          account_code: item.accountCode,
          account_name: 'รายได้ค้างรับ',
          debit: amountToRecognize,
          credit: 0,
          system_generated: true,
        });
        entries.push({
          id: `ACCR-INC-CR-${period}-${index}`,
          clientId,
          date: periodEnd,
          doc_no: `JV-ACCR-${period}`,
          description: `ตั้งรายได้ค้างรับ: ${item.description}`,
          account_code: item.expenseAccountCode, // Actually revenue account
          account_name: 'รายได้ (ค้างรับ)',
          debit: 0,
          credit: amountToRecognize,
          system_generated: true,
        });
        summary.push({ type: 'รายได้ค้างรับ', amount: amountToRecognize });
        break;

      case 'deferred':
        // Dr. Deferred Liability, Cr. Revenue
        entries.push({
          id: `ACCR-DEF-DR-${period}-${index}`,
          clientId,
          date: periodEnd,
          doc_no: `JV-ACCR-${period}`,
          description: `รับรู้รายได้รับล่วงหน้า: ${item.description}`,
          account_code: item.accountCode,
          account_name: 'รายได้รับล่วงหน้า',
          debit: amountToRecognize,
          credit: 0,
          system_generated: true,
        });
        entries.push({
          id: `ACCR-DEF-CR-${period}-${index}`,
          clientId,
          date: periodEnd,
          doc_no: `JV-ACCR-${period}`,
          description: `รับรู้รายได้รับล่วงหน้า: ${item.description}`,
          account_code: item.expenseAccountCode, // Actually revenue account
          account_name: 'รายได้',
          debit: 0,
          credit: amountToRecognize,
          system_generated: true,
        });
        summary.push({ type: 'รายได้รับล่วงหน้า', amount: amountToRecognize });
        break;
    }
  });

  return { entries, summary };
};

/**
 * Calculate provisions
 */
export const calculateProvisions = (
  provisions: ProvisionItem[],
  clientId: string,
  period: string
): { entries: PostedGLEntry[]; totalProvision: number } => {
  const entries: PostedGLEntry[] = [];
  let totalProvision = 0;

  const [year, month] = period.split('-').map(Number);
  const periodEnd = new Date(year, month, 0).toISOString().split('T')[0];

  provisions.forEach((item, index) => {
    // Calculate provision amount based on probability
    const provisionAmount = item.estimatedAmount * (item.probability / 100);

    if (provisionAmount <= 0) return;

    // Determine account based on type
    let provisionAccount = CLOSING_ACCOUNTS.WARRANTY_PROVISION;
    let expenseDescription = 'ค่าใช้จ่ายประมาณการ';

    switch (item.type) {
      case 'warranty':
        provisionAccount = CLOSING_ACCOUNTS.WARRANTY_PROVISION;
        expenseDescription = 'ค่าใช้จ่ายประมาณการหนี้สินรับประกัน';
        break;
      case 'legal':
        provisionAccount = CLOSING_ACCOUNTS.LEGAL_PROVISION;
        expenseDescription = 'ค่าใช้จ่ายประมาณการคดีความ';
        break;
      case 'bad_debt':
        provisionAccount = CLOSING_ACCOUNTS.BAD_DEBT_PROVISION;
        expenseDescription = 'ค่าใช้จ่ายหนี้สงสัยจะสูญ';
        break;
      case 'bonus':
        provisionAccount = CLOSING_ACCOUNTS.BONUS_PROVISION;
        expenseDescription = 'ค่าใช้จ่ายโบนัสค้างจ่าย';
        break;
      case 'leave':
        provisionAccount = CLOSING_ACCOUNTS.LEAVE_PROVISION;
        expenseDescription = 'ค่าใช้จ่ายวันลาค้างจ่าย';
        break;
    }

    entries.push({
      id: `PROV-EXP-${period}-${index}`,
      clientId,
      date: periodEnd,
      doc_no: `JV-PROV-${period}`,
      description: `${expenseDescription}: ${item.description}`,
      account_code: item.expenseAccountCode,
      account_name: expenseDescription,
      debit: Math.round(provisionAmount * 100) / 100,
      credit: 0,
      system_generated: true,
    });

    entries.push({
      id: `PROV-LIA-${period}-${index}`,
      clientId,
      date: periodEnd,
      doc_no: `JV-PROV-${period}`,
      description: `ประมาณการหนี้สิน: ${item.description}`,
      account_code: provisionAccount,
      account_name: 'ประมาณการหนี้สิน',
      debit: 0,
      credit: Math.round(provisionAmount * 100) / 100,
      system_generated: true,
    });

    totalProvision += provisionAmount;
  });

  return {
    entries,
    totalProvision: Math.round(totalProvision * 100) / 100,
  };
};

/**
 * Generate closing entries for P&L accounts
 */
export const generateClosingEntries = (
  glEntries: PostedGLEntry[],
  clientId: string,
  period: string,
  citRate: number = 0.20
): {
  closingEntries: PostedGLEntry[];
  profitBeforeTax: number;
  citAmount: number;
  netProfit: number;
} => {
  const closingEntries: PostedGLEntry[] = [];

  const [year, month] = period.split('-').map(Number);
  const periodEnd = new Date(year, month, 0).toISOString().split('T')[0];

  // Calculate P&L balances
  const accountBalances: Record<string, { name: string; balance: number }> = {};

  glEntries.forEach(entry => {
    const code = entry.account_code;
    if (code.startsWith('4') || code.startsWith('5')) {
      if (!accountBalances[code]) {
        accountBalances[code] = { name: entry.account_name, balance: 0 };
      }
      // Revenue (4) = Credit normal, Expense (5) = Debit normal
      if (code.startsWith('4')) {
        accountBalances[code].balance += (entry.credit - entry.debit);
      } else {
        accountBalances[code].balance += (entry.debit - entry.credit);
      }
    }
  });

  // Calculate totals
  let totalRevenue = 0;
  let totalExpense = 0;

  Object.entries(accountBalances).forEach(([code, data]) => {
    if (code.startsWith('4')) {
      totalRevenue += data.balance;
    } else {
      totalExpense += data.balance;
    }
  });

  const profitBeforeTax = totalRevenue - totalExpense;
  const citAmount = profitBeforeTax > 0 ? Math.round(profitBeforeTax * citRate * 100) / 100 : 0;
  const netProfit = profitBeforeTax - citAmount;

  // Create CIT accrual entry if profitable
  if (citAmount > 0) {
    closingEntries.push({
      id: `CIT-EXP-${period}`,
      clientId,
      date: periodEnd,
      doc_no: `JV-CIT-${period}`,
      description: 'ตั้งค้างจ่ายภาษีเงินได้นิติบุคคล',
      account_code: CLOSING_ACCOUNTS.CIT_EXPENSE,
      account_name: 'ค่าใช้จ่ายภาษีเงินได้',
      debit: citAmount,
      credit: 0,
      system_generated: true,
    });

    closingEntries.push({
      id: `CIT-PAY-${period}`,
      clientId,
      date: periodEnd,
      doc_no: `JV-CIT-${period}`,
      description: 'ตั้งค้างจ่ายภาษีเงินได้นิติบุคคล',
      account_code: CLOSING_ACCOUNTS.CIT_PAYABLE,
      account_name: 'ภาษีเงินได้ค้างจ่าย',
      debit: 0,
      credit: citAmount,
      system_generated: true,
    });
  }

  // Generate closing entries for each P&L account
  let entryIndex = 0;
  Object.entries(accountBalances).forEach(([code, data]) => {
    if (data.balance === 0) return;

    const isRevenue = code.startsWith('4');
    closingEntries.push({
      id: `CLOSE-${code}-${period}-${entryIndex}`,
      clientId,
      date: periodEnd,
      doc_no: `JV-CLOSE-${period}`,
      description: `ปิดบัญชี: ${data.name}`,
      account_code: code,
      account_name: data.name,
      debit: isRevenue ? data.balance : 0,
      credit: isRevenue ? 0 : data.balance,
      system_generated: true,
    });
    entryIndex++;
  });

  // Close CIT expense
  if (citAmount > 0) {
    closingEntries.push({
      id: `CLOSE-CIT-${period}`,
      clientId,
      date: periodEnd,
      doc_no: `JV-CLOSE-${period}`,
      description: 'ปิดบัญชี: ค่าใช้จ่ายภาษีเงินได้',
      account_code: CLOSING_ACCOUNTS.CIT_EXPENSE,
      account_name: 'ค่าใช้จ่ายภาษีเงินได้',
      debit: 0,
      credit: citAmount,
      system_generated: true,
    });
  }

  // Transfer to Retained Earnings
  if (netProfit !== 0) {
    closingEntries.push({
      id: `CLOSE-RE-${period}`,
      clientId,
      date: periodEnd,
      doc_no: `JV-CLOSE-${period}`,
      description: 'โอนกำไร(ขาดทุน)สุทธิไปกำไรสะสม',
      account_code: CLOSING_ACCOUNTS.RETAINED_EARNINGS,
      account_name: 'กำไรสะสม',
      debit: netProfit < 0 ? Math.abs(netProfit) : 0,
      credit: netProfit > 0 ? netProfit : 0,
      system_generated: true,
    });
  }

  return {
    closingEntries,
    profitBeforeTax,
    citAmount,
    netProfit,
  };
};

/**
 * Create default closing tasks checklist
 */
export const createClosingTasks = (period: string): ClosingTask[] => {
  return [
    {
      id: 'TASK-001',
      type: 'DEPRECIATION',
      title: 'คำนวณค่าเสื่อมราคา',
      titleEn: 'Calculate Depreciation',
      description: 'คำนวณและบันทึกค่าเสื่อมราคาสินทรัพย์ถาวร',
      status: 'pending',
      required: true,
      autoCalculate: true,
    },
    {
      id: 'TASK-002',
      type: 'PREPAID_EXPENSE',
      title: 'ตัดจำหน่ายรายจ่ายล่วงหน้า',
      titleEn: 'Amortize Prepaid Expenses',
      description: 'ตัดจำหน่ายรายจ่ายล่วงหน้าที่ครบกำหนด',
      status: 'pending',
      required: true,
      autoCalculate: true,
    },
    {
      id: 'TASK-003',
      type: 'ACCRUED_EXPENSE',
      title: 'บันทึกค่าใช้จ่ายค้างจ่าย',
      titleEn: 'Record Accrued Expenses',
      description: 'บันทึกค่าใช้จ่ายที่เกิดขึ้นแต่ยังไม่ได้จ่าย',
      status: 'pending',
      required: true,
      autoCalculate: false,
    },
    {
      id: 'TASK-004',
      type: 'ACCRUED_INCOME',
      title: 'บันทึกรายได้ค้างรับ',
      titleEn: 'Record Accrued Income',
      description: 'บันทึกรายได้ที่เกิดขึ้นแต่ยังไม่ได้รับ',
      status: 'pending',
      required: false,
      autoCalculate: false,
    },
    {
      id: 'TASK-005',
      type: 'DEFERRED_INCOME',
      title: 'รับรู้รายได้รับล่วงหน้า',
      titleEn: 'Recognize Deferred Income',
      description: 'รับรู้รายได้รับล่วงหน้าที่ครบกำหนด',
      status: 'pending',
      required: false,
      autoCalculate: true,
    },
    {
      id: 'TASK-006',
      type: 'PROVISION',
      title: 'บันทึกประมาณการหนี้สิน',
      titleEn: 'Record Provisions',
      description: 'ตั้งสำรองหนี้สงสัยจะสูญ, ประกันสินค้า, โบนัส',
      status: 'pending',
      required: true,
      autoCalculate: false,
    },
    {
      id: 'TASK-007',
      type: 'INVENTORY_ADJ',
      title: 'ปรับปรุงสินค้าคงเหลือ',
      titleEn: 'Inventory Adjustment',
      description: 'ปรับปรุงมูลค่าสินค้าตามราคาตลาด (LCM)',
      status: 'pending',
      required: false,
      autoCalculate: false,
    },
    {
      id: 'TASK-008',
      type: 'FX_ADJUSTMENT',
      title: 'ปรับปรุงอัตราแลกเปลี่ยน',
      titleEn: 'Foreign Exchange Adjustment',
      description: 'ปรับปรุงกำไร/ขาดทุนจากอัตราแลกเปลี่ยน',
      status: 'pending',
      required: false,
      autoCalculate: false,
    },
    {
      id: 'TASK-009',
      type: 'CIT_ACCRUAL',
      title: 'คำนวณภาษีเงินได้นิติบุคคล',
      titleEn: 'Calculate Corporate Income Tax',
      description: 'คำนวณและตั้งค้างภาษีเงินได้นิติบุคคล',
      status: 'pending',
      required: true,
      autoCalculate: true,
    },
    {
      id: 'TASK-010',
      type: 'CLOSING',
      title: 'ปิดบัญชีรายได้และค่าใช้จ่าย',
      titleEn: 'Close Revenue and Expense Accounts',
      description: 'โอนยอดรายได้/ค่าใช้จ่ายไปกำไรสะสม',
      status: 'pending',
      required: true,
      autoCalculate: true,
    },
  ];
};

export default {
  calculateDepreciation,
  calculateAccruals,
  calculateProvisions,
  generateClosingEntries,
  createClosingTasks,
  CLOSING_ACCOUNTS,
};

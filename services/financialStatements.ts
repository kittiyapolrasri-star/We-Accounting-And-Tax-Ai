/**
 * financialStatements.ts
 *
 * Thai Financial Statement Generation Service
 * Generates งบกำไรขาดทุน (Income Statement) and งบแสดงฐานะการเงิน (Balance Sheet)
 * Compliant with Thai Federation of Accounting Professions (TFAC) standards
 */

import { PostedGLEntry, Client } from '../types';
import { THAI_CHART_OF_ACCOUNTS } from './accountingValidation';

// Account type classification
type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

// Financial statement line item
export interface StatementLineItem {
  code: string;
  name: string;
  nameTh: string;
  amount: number;
  previousAmount?: number;
  indent: number;
  isBold?: boolean;
  isTotal?: boolean;
}

// Trial Balance entry
export interface TrialBalanceEntry {
  accountCode: string;
  accountName: string;
  accountNameTh: string;
  debit: number;
  credit: number;
  balance: number;
  accountType: AccountType;
}

// Trial Balance report
export interface TrialBalanceReport {
  clientId: string;
  clientName: string;
  asOfDate: string;
  periodStart: string;
  periodEnd: string;
  entries: TrialBalanceEntry[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  generatedAt: string;
}

// Income Statement (งบกำไรขาดทุน)
export interface IncomeStatement {
  clientId: string;
  clientName: string;
  periodStart: string;
  periodEnd: string;
  // Revenue section
  revenue: {
    items: StatementLineItem[];
    totalRevenue: number;
  };
  // Cost of Sales section
  costOfSales: {
    items: StatementLineItem[];
    totalCostOfSales: number;
  };
  grossProfit: number;
  // Operating Expenses section
  operatingExpenses: {
    items: StatementLineItem[];
    totalOperatingExpenses: number;
  };
  operatingProfit: number;
  // Other Income/Expenses
  otherIncome: number;
  otherExpenses: number;
  // Tax
  incomeTaxExpense: number;
  // Final results
  profitBeforeTax: number;
  netProfit: number;
  generatedAt: string;
}

// Balance Sheet (งบแสดงฐานะการเงิน)
export interface BalanceSheet {
  clientId: string;
  clientName: string;
  asOfDate: string;
  // Assets
  assets: {
    currentAssets: {
      items: StatementLineItem[];
      total: number;
    };
    nonCurrentAssets: {
      items: StatementLineItem[];
      total: number;
    };
    totalAssets: number;
  };
  // Liabilities
  liabilities: {
    currentLiabilities: {
      items: StatementLineItem[];
      total: number;
    };
    nonCurrentLiabilities: {
      items: StatementLineItem[];
      total: number;
    };
    totalLiabilities: number;
  };
  // Equity
  equity: {
    items: StatementLineItem[];
    totalEquity: number;
  };
  // Balance check
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
  generatedAt: string;
}

/**
 * Get account type from account code
 */
const getAccountType = (code: string): AccountType => {
  const firstDigit = code.charAt(0);
  switch (firstDigit) {
    case '1': return 'asset';
    case '2': return 'liability';
    case '3': return 'equity';
    case '4': return 'revenue';
    case '5': return 'expense';
    default: return 'expense';
  }
};

/**
 * Check if account is current (short-term)
 */
const isCurrentAccount = (code: string): boolean => {
  const prefix = code.substring(0, 2);
  // Current assets: 11xxx (Cash, AR, Inventory)
  // Current liabilities: 21xxx (AP, Accrued)
  return prefix === '11' || prefix === '21';
};

/**
 * Calculate account balance from GL entries
 */
const calculateAccountBalances = (
  glEntries: PostedGLEntry[],
  clientId: string,
  startDate?: string,
  endDate?: string
): Map<string, { debit: number; credit: number; balance: number }> => {
  const balances = new Map<string, { debit: number; credit: number; balance: number }>();

  const filteredEntries = glEntries.filter(entry => {
    if (entry.clientId !== clientId) return false;
    if (startDate && entry.date < startDate) return false;
    if (endDate && entry.date > endDate) return false;
    return true;
  });

  filteredEntries.forEach(entry => {
    const current = balances.get(entry.account_code) || { debit: 0, credit: 0, balance: 0 };
    current.debit += entry.debit || 0;
    current.credit += entry.credit || 0;

    // Calculate balance based on account type
    const accountType = getAccountType(entry.account_code);
    if (accountType === 'asset' || accountType === 'expense') {
      // Debit normal balance
      current.balance = current.debit - current.credit;
    } else {
      // Credit normal balance
      current.balance = current.credit - current.debit;
    }

    balances.set(entry.account_code, current);
  });

  return balances;
};

/**
 * Get account name (Thai or English)
 */
const getAccountName = (code: string, language: 'en' | 'th' = 'th'): string => {
  const account = THAI_CHART_OF_ACCOUNTS.find(a => a.code === code);
  if (account) {
    return language === 'th' ? account.nameTh : account.name;
  }
  return code;
};

/**
 * Generate Trial Balance Report (งบทดลอง)
 */
export const generateTrialBalance = (
  glEntries: PostedGLEntry[],
  client: Client,
  asOfDate: string,
  periodStart: string
): TrialBalanceReport => {
  const balances = calculateAccountBalances(glEntries, client.id, periodStart, asOfDate);

  const entries: TrialBalanceEntry[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  // Sort by account code
  const sortedCodes = Array.from(balances.keys()).sort();

  sortedCodes.forEach(code => {
    const balance = balances.get(code)!;
    const accountType = getAccountType(code);

    // Determine debit/credit column based on normal balance
    let debitAmount = 0;
    let creditAmount = 0;

    if (balance.balance >= 0) {
      if (accountType === 'asset' || accountType === 'expense') {
        debitAmount = balance.balance;
      } else {
        creditAmount = balance.balance;
      }
    } else {
      if (accountType === 'asset' || accountType === 'expense') {
        creditAmount = Math.abs(balance.balance);
      } else {
        debitAmount = Math.abs(balance.balance);
      }
    }

    if (debitAmount !== 0 || creditAmount !== 0) {
      entries.push({
        accountCode: code,
        accountName: getAccountName(code, 'en'),
        accountNameTh: getAccountName(code, 'th'),
        debit: debitAmount,
        credit: creditAmount,
        balance: balance.balance,
        accountType
      });

      totalDebit += debitAmount;
      totalCredit += creditAmount;
    }
  });

  return {
    clientId: client.id,
    clientName: client.name,
    asOfDate,
    periodStart,
    periodEnd: asOfDate,
    entries,
    totalDebit,
    totalCredit,
    isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
    generatedAt: new Date().toISOString()
  };
};

/**
 * Generate Income Statement (งบกำไรขาดทุน)
 */
export const generateIncomeStatement = (
  glEntries: PostedGLEntry[],
  client: Client,
  periodStart: string,
  periodEnd: string
): IncomeStatement => {
  const balances = calculateAccountBalances(glEntries, client.id, periodStart, periodEnd);

  // Revenue items (4xxxx)
  const revenueItems: StatementLineItem[] = [];
  let totalRevenue = 0;

  // Cost of Sales items (51xxx)
  const costItems: StatementLineItem[] = [];
  let totalCostOfSales = 0;

  // Operating Expense items (52xxx - 59xxx)
  const expenseItems: StatementLineItem[] = [];
  let totalOperatingExpenses = 0;

  // Other income/expenses
  let otherIncome = 0;
  let otherExpenses = 0;

  balances.forEach((balance, code) => {
    const accountType = getAccountType(code);
    const amount = Math.abs(balance.balance);

    if (amount === 0) return;

    if (accountType === 'revenue') {
      // Check if it's other income (49xxx)
      if (code.startsWith('49')) {
        otherIncome += amount;
      } else {
        revenueItems.push({
          code,
          name: getAccountName(code, 'en'),
          nameTh: getAccountName(code, 'th'),
          amount,
          indent: 1
        });
        totalRevenue += amount;
      }
    } else if (accountType === 'expense') {
      if (code.startsWith('51')) {
        // Cost of Sales
        costItems.push({
          code,
          name: getAccountName(code, 'en'),
          nameTh: getAccountName(code, 'th'),
          amount,
          indent: 1
        });
        totalCostOfSales += amount;
      } else if (code.startsWith('59')) {
        // Other expenses
        otherExpenses += amount;
      } else {
        // Operating expenses
        expenseItems.push({
          code,
          name: getAccountName(code, 'en'),
          nameTh: getAccountName(code, 'th'),
          amount,
          indent: 1
        });
        totalOperatingExpenses += amount;
      }
    }
  });

  const grossProfit = totalRevenue - totalCostOfSales;
  const operatingProfit = grossProfit - totalOperatingExpenses;
  const profitBeforeTax = operatingProfit + otherIncome - otherExpenses;

  // Simplified tax calculation (20% corporate rate)
  const incomeTaxExpense = profitBeforeTax > 0 ? profitBeforeTax * 0.20 : 0;
  const netProfit = profitBeforeTax - incomeTaxExpense;

  return {
    clientId: client.id,
    clientName: client.name,
    periodStart,
    periodEnd,
    revenue: {
      items: revenueItems.sort((a, b) => a.code.localeCompare(b.code)),
      totalRevenue
    },
    costOfSales: {
      items: costItems.sort((a, b) => a.code.localeCompare(b.code)),
      totalCostOfSales
    },
    grossProfit,
    operatingExpenses: {
      items: expenseItems.sort((a, b) => a.code.localeCompare(b.code)),
      totalOperatingExpenses
    },
    operatingProfit,
    otherIncome,
    otherExpenses,
    incomeTaxExpense,
    profitBeforeTax,
    netProfit,
    generatedAt: new Date().toISOString()
  };
};

/**
 * Generate Balance Sheet (งบแสดงฐานะการเงิน)
 */
export const generateBalanceSheet = (
  glEntries: PostedGLEntry[],
  client: Client,
  asOfDate: string
): BalanceSheet => {
  // For balance sheet, we need cumulative balances from beginning
  const balances = calculateAccountBalances(glEntries, client.id, undefined, asOfDate);

  // Assets
  const currentAssetItems: StatementLineItem[] = [];
  let totalCurrentAssets = 0;

  const nonCurrentAssetItems: StatementLineItem[] = [];
  let totalNonCurrentAssets = 0;

  // Liabilities
  const currentLiabilityItems: StatementLineItem[] = [];
  let totalCurrentLiabilities = 0;

  const nonCurrentLiabilityItems: StatementLineItem[] = [];
  let totalNonCurrentLiabilities = 0;

  // Equity
  const equityItems: StatementLineItem[] = [];
  let totalEquity = 0;

  // Calculate retained earnings from revenue - expenses
  let retainedEarnings = 0;

  balances.forEach((balance, code) => {
    const accountType = getAccountType(code);
    const amount = balance.balance;

    if (Math.abs(amount) < 0.01) return;

    const lineItem: StatementLineItem = {
      code,
      name: getAccountName(code, 'en'),
      nameTh: getAccountName(code, 'th'),
      amount: Math.abs(amount),
      indent: 1
    };

    switch (accountType) {
      case 'asset':
        if (isCurrentAccount(code)) {
          currentAssetItems.push(lineItem);
          totalCurrentAssets += amount;
        } else {
          nonCurrentAssetItems.push(lineItem);
          totalNonCurrentAssets += amount;
        }
        break;

      case 'liability':
        if (isCurrentAccount(code)) {
          currentLiabilityItems.push(lineItem);
          totalCurrentLiabilities += amount;
        } else {
          nonCurrentLiabilityItems.push(lineItem);
          totalNonCurrentLiabilities += amount;
        }
        break;

      case 'equity':
        equityItems.push(lineItem);
        totalEquity += amount;
        break;

      case 'revenue':
        retainedEarnings += amount;
        break;

      case 'expense':
        retainedEarnings -= amount;
        break;
    }
  });

  // Add retained earnings to equity
  if (Math.abs(retainedEarnings) >= 0.01) {
    equityItems.push({
      code: '33000',
      name: 'Retained Earnings',
      nameTh: 'กำไรสะสม',
      amount: retainedEarnings,
      indent: 1
    });
    totalEquity += retainedEarnings;
  }

  const totalAssets = totalCurrentAssets + totalNonCurrentAssets;
  const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  return {
    clientId: client.id,
    clientName: client.name,
    asOfDate,
    assets: {
      currentAssets: {
        items: currentAssetItems.sort((a, b) => a.code.localeCompare(b.code)),
        total: totalCurrentAssets
      },
      nonCurrentAssets: {
        items: nonCurrentAssetItems.sort((a, b) => a.code.localeCompare(b.code)),
        total: totalNonCurrentAssets
      },
      totalAssets
    },
    liabilities: {
      currentLiabilities: {
        items: currentLiabilityItems.sort((a, b) => a.code.localeCompare(b.code)),
        total: totalCurrentLiabilities
      },
      nonCurrentLiabilities: {
        items: nonCurrentLiabilityItems.sort((a, b) => a.code.localeCompare(b.code)),
        total: totalNonCurrentLiabilities
      },
      totalLiabilities
    },
    equity: {
      items: equityItems.sort((a, b) => a.code.localeCompare(b.code)),
      totalEquity
    },
    totalLiabilitiesAndEquity,
    isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01,
    generatedAt: new Date().toISOString()
  };
};

/**
 * Format currency for display
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Generate HTML for Trial Balance printing
 */
export const generateTrialBalanceHTML = (report: TrialBalanceReport): string => {
  const rows = report.entries.map(entry => `
    <tr>
      <td style="text-align: left;">${entry.accountCode}</td>
      <td style="text-align: left;">${entry.accountNameTh}</td>
      <td style="text-align: right;">${entry.debit > 0 ? formatCurrency(entry.debit) : ''}</td>
      <td style="text-align: right;">${entry.credit > 0 ? formatCurrency(entry.credit) : ''}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>งบทดลอง - ${report.clientName}</title>
      <style>
        body { font-family: 'Sarabun', sans-serif; padding: 20px; }
        h1 { text-align: center; margin-bottom: 5px; }
        h2 { text-align: center; margin-top: 0; font-weight: normal; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #333; padding: 8px; }
        th { background-color: #f0f0f0; }
        .total-row { font-weight: bold; background-color: #e0e0e0; }
        .balanced { color: green; }
        .unbalanced { color: red; }
      </style>
    </head>
    <body>
      <h1>งบทดลอง</h1>
      <h2>${report.clientName}</h2>
      <p style="text-align: center;">
        สำหรับงวด ${report.periodStart} ถึง ${report.periodEnd}
      </p>

      <table>
        <thead>
          <tr>
            <th style="width: 15%;">รหัสบัญชี</th>
            <th style="width: 45%;">ชื่อบัญชี</th>
            <th style="width: 20%;">เดบิต</th>
            <th style="width: 20%;">เครดิต</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="total-row">
            <td colspan="2" style="text-align: right;">รวม</td>
            <td style="text-align: right;">${formatCurrency(report.totalDebit)}</td>
            <td style="text-align: right;">${formatCurrency(report.totalCredit)}</td>
          </tr>
        </tbody>
      </table>

      <p class="${report.isBalanced ? 'balanced' : 'unbalanced'}" style="text-align: center; margin-top: 20px;">
        ${report.isBalanced ? '✓ งบทดลองสมดุล' : '✗ งบทดลองไม่สมดุล - กรุณาตรวจสอบ'}
      </p>

      <p style="text-align: right; font-size: 12px; margin-top: 30px;">
        สร้างเมื่อ: ${new Date(report.generatedAt).toLocaleString('th-TH')}
      </p>
    </body>
    </html>
  `;
};

/**
 * Generate HTML for Income Statement printing
 */
export const generateIncomeStatementHTML = (statement: IncomeStatement): string => {
  const revenueRows = statement.revenue.items.map(item => `
    <tr>
      <td style="padding-left: 20px;">${item.nameTh}</td>
      <td style="text-align: right;">${formatCurrency(item.amount)}</td>
    </tr>
  `).join('');

  const costRows = statement.costOfSales.items.map(item => `
    <tr>
      <td style="padding-left: 20px;">${item.nameTh}</td>
      <td style="text-align: right;">${formatCurrency(item.amount)}</td>
    </tr>
  `).join('');

  const expenseRows = statement.operatingExpenses.items.map(item => `
    <tr>
      <td style="padding-left: 20px;">${item.nameTh}</td>
      <td style="text-align: right;">${formatCurrency(item.amount)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>งบกำไรขาดทุน - ${statement.clientName}</title>
      <style>
        body { font-family: 'Sarabun', sans-serif; padding: 20px; }
        h1 { text-align: center; margin-bottom: 5px; }
        h2 { text-align: center; margin-top: 0; font-weight: normal; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        td { padding: 8px; border-bottom: 1px solid #ddd; }
        .section-header { font-weight: bold; background-color: #f5f5f5; }
        .total-row { font-weight: bold; border-top: 2px solid #333; }
        .grand-total { font-weight: bold; background-color: #e0e0e0; font-size: 1.1em; }
        .profit { color: green; }
        .loss { color: red; }
      </style>
    </head>
    <body>
      <h1>งบกำไรขาดทุน</h1>
      <h2>${statement.clientName}</h2>
      <p style="text-align: center;">
        สำหรับงวด ${statement.periodStart} ถึง ${statement.periodEnd}
      </p>

      <table>
        <tr class="section-header">
          <td>รายได้จากการขาย</td>
          <td></td>
        </tr>
        ${revenueRows}
        <tr class="total-row">
          <td>รวมรายได้</td>
          <td style="text-align: right;">${formatCurrency(statement.revenue.totalRevenue)}</td>
        </tr>

        <tr class="section-header">
          <td>ต้นทุนขาย</td>
          <td></td>
        </tr>
        ${costRows}
        <tr class="total-row">
          <td>รวมต้นทุนขาย</td>
          <td style="text-align: right;">(${formatCurrency(statement.costOfSales.totalCostOfSales)})</td>
        </tr>

        <tr class="total-row">
          <td>กำไรขั้นต้น</td>
          <td style="text-align: right;" class="${statement.grossProfit >= 0 ? 'profit' : 'loss'}">
            ${formatCurrency(statement.grossProfit)}
          </td>
        </tr>

        <tr class="section-header">
          <td>ค่าใช้จ่ายในการดำเนินงาน</td>
          <td></td>
        </tr>
        ${expenseRows}
        <tr class="total-row">
          <td>รวมค่าใช้จ่ายในการดำเนินงาน</td>
          <td style="text-align: right;">(${formatCurrency(statement.operatingExpenses.totalOperatingExpenses)})</td>
        </tr>

        <tr class="total-row">
          <td>กำไรจากการดำเนินงาน</td>
          <td style="text-align: right;" class="${statement.operatingProfit >= 0 ? 'profit' : 'loss'}">
            ${formatCurrency(statement.operatingProfit)}
          </td>
        </tr>

        ${statement.otherIncome > 0 ? `
        <tr>
          <td style="padding-left: 20px;">รายได้อื่น</td>
          <td style="text-align: right;">${formatCurrency(statement.otherIncome)}</td>
        </tr>
        ` : ''}

        ${statement.otherExpenses > 0 ? `
        <tr>
          <td style="padding-left: 20px;">ค่าใช้จ่ายอื่น</td>
          <td style="text-align: right;">(${formatCurrency(statement.otherExpenses)})</td>
        </tr>
        ` : ''}

        <tr class="total-row">
          <td>กำไรก่อนภาษีเงินได้</td>
          <td style="text-align: right;" class="${statement.profitBeforeTax >= 0 ? 'profit' : 'loss'}">
            ${formatCurrency(statement.profitBeforeTax)}
          </td>
        </tr>

        <tr>
          <td style="padding-left: 20px;">ภาษีเงินได้นิติบุคคล</td>
          <td style="text-align: right;">(${formatCurrency(statement.incomeTaxExpense)})</td>
        </tr>

        <tr class="grand-total">
          <td>กำไร (ขาดทุน) สุทธิ</td>
          <td style="text-align: right;" class="${statement.netProfit >= 0 ? 'profit' : 'loss'}">
            ${formatCurrency(statement.netProfit)}
          </td>
        </tr>
      </table>

      <p style="text-align: right; font-size: 12px; margin-top: 30px;">
        สร้างเมื่อ: ${new Date(statement.generatedAt).toLocaleString('th-TH')}
      </p>
    </body>
    </html>
  `;
};

/**
 * Generate HTML for Balance Sheet printing
 */
export const generateBalanceSheetHTML = (sheet: BalanceSheet): string => {
  const assetRows = (items: StatementLineItem[]) => items.map(item => `
    <tr>
      <td style="padding-left: 20px;">${item.nameTh}</td>
      <td style="text-align: right;">${formatCurrency(item.amount)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>งบแสดงฐานะการเงิน - ${sheet.clientName}</title>
      <style>
        body { font-family: 'Sarabun', sans-serif; padding: 20px; }
        h1 { text-align: center; margin-bottom: 5px; }
        h2 { text-align: center; margin-top: 0; font-weight: normal; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        td { padding: 8px; border-bottom: 1px solid #ddd; }
        .section-header { font-weight: bold; background-color: #f5f5f5; }
        .subsection { font-weight: bold; font-style: italic; }
        .total-row { font-weight: bold; border-top: 2px solid #333; }
        .grand-total { font-weight: bold; background-color: #e0e0e0; font-size: 1.1em; }
        .balanced { color: green; }
        .unbalanced { color: red; }
      </style>
    </head>
    <body>
      <h1>งบแสดงฐานะการเงิน</h1>
      <h2>${sheet.clientName}</h2>
      <p style="text-align: center;">ณ วันที่ ${sheet.asOfDate}</p>

      <table>
        <tr class="section-header">
          <td colspan="2">สินทรัพย์</td>
        </tr>

        <tr class="subsection">
          <td>สินทรัพย์หมุนเวียน</td>
          <td></td>
        </tr>
        ${assetRows(sheet.assets.currentAssets.items)}
        <tr class="total-row">
          <td>รวมสินทรัพย์หมุนเวียน</td>
          <td style="text-align: right;">${formatCurrency(sheet.assets.currentAssets.total)}</td>
        </tr>

        <tr class="subsection">
          <td>สินทรัพย์ไม่หมุนเวียน</td>
          <td></td>
        </tr>
        ${assetRows(sheet.assets.nonCurrentAssets.items)}
        <tr class="total-row">
          <td>รวมสินทรัพย์ไม่หมุนเวียน</td>
          <td style="text-align: right;">${formatCurrency(sheet.assets.nonCurrentAssets.total)}</td>
        </tr>

        <tr class="grand-total">
          <td>รวมสินทรัพย์</td>
          <td style="text-align: right;">${formatCurrency(sheet.assets.totalAssets)}</td>
        </tr>

        <tr><td colspan="2" style="height: 20px;"></td></tr>

        <tr class="section-header">
          <td colspan="2">หนี้สินและส่วนของเจ้าของ</td>
        </tr>

        <tr class="subsection">
          <td>หนี้สินหมุนเวียน</td>
          <td></td>
        </tr>
        ${assetRows(sheet.liabilities.currentLiabilities.items)}
        <tr class="total-row">
          <td>รวมหนี้สินหมุนเวียน</td>
          <td style="text-align: right;">${formatCurrency(sheet.liabilities.currentLiabilities.total)}</td>
        </tr>

        <tr class="subsection">
          <td>หนี้สินไม่หมุนเวียน</td>
          <td></td>
        </tr>
        ${assetRows(sheet.liabilities.nonCurrentLiabilities.items)}
        <tr class="total-row">
          <td>รวมหนี้สินไม่หมุนเวียน</td>
          <td style="text-align: right;">${formatCurrency(sheet.liabilities.nonCurrentLiabilities.total)}</td>
        </tr>

        <tr class="total-row">
          <td>รวมหนี้สิน</td>
          <td style="text-align: right;">${formatCurrency(sheet.liabilities.totalLiabilities)}</td>
        </tr>

        <tr class="subsection">
          <td>ส่วนของเจ้าของ</td>
          <td></td>
        </tr>
        ${assetRows(sheet.equity.items)}
        <tr class="total-row">
          <td>รวมส่วนของเจ้าของ</td>
          <td style="text-align: right;">${formatCurrency(sheet.equity.totalEquity)}</td>
        </tr>

        <tr class="grand-total">
          <td>รวมหนี้สินและส่วนของเจ้าของ</td>
          <td style="text-align: right;">${formatCurrency(sheet.totalLiabilitiesAndEquity)}</td>
        </tr>
      </table>

      <p class="${sheet.isBalanced ? 'balanced' : 'unbalanced'}" style="text-align: center; margin-top: 20px;">
        ${sheet.isBalanced ? '✓ งบดุลสมดุล' : '✗ งบดุลไม่สมดุล - กรุณาตรวจสอบ'}
      </p>

      <p style="text-align: right; font-size: 12px; margin-top: 30px;">
        สร้างเมื่อ: ${new Date(sheet.generatedAt).toLocaleString('th-TH')}
      </p>
    </body>
    </html>
  `;
};

export default {
  generateTrialBalance,
  generateIncomeStatement,
  generateBalanceSheet,
  generateTrialBalanceHTML,
  generateIncomeStatementHTML,
  generateBalanceSheetHTML,
  formatCurrency
};

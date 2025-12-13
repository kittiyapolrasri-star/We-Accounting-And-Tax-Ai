/**
 * Payroll & Personal Income Tax (PIT) Service
 * Thai tax calculation based on Revenue Department regulations
 */

// Thai Personal Income Tax Brackets (2024)
export const PIT_BRACKETS = [
  { min: 0, max: 150000, rate: 0 },           // Exempt
  { min: 150001, max: 300000, rate: 5 },      // 5%
  { min: 300001, max: 500000, rate: 10 },     // 10%
  { min: 500001, max: 750000, rate: 15 },     // 15%
  { min: 750001, max: 1000000, rate: 20 },    // 20%
  { min: 1000001, max: 2000000, rate: 25 },   // 25%
  { min: 2000001, max: 5000000, rate: 30 },   // 30%
  { min: 5000001, max: Infinity, rate: 35 },  // 35%
];

// Personal allowances and deductions
export const TAX_DEDUCTIONS = {
  PERSONAL_ALLOWANCE: 60000,           // ค่าลดหย่อนส่วนตัว
  SPOUSE_ALLOWANCE: 60000,             // ค่าลดหย่อนคู่สมรส (ไม่มีรายได้)
  CHILD_ALLOWANCE: 30000,              // ค่าลดหย่อนบุตร (ต่อคน)
  CHILD_ALLOWANCE_BORN_2018: 60000,    // ค่าลดหย่อนบุตรคนที่ 2+ (เกิดปี 2561+)
  PARENT_ALLOWANCE: 30000,             // ค่าลดหย่อนบิดามารดา (ต่อคน, สูงสุด 4 คน)
  DISABLED_ALLOWANCE: 60000,           // ค่าลดหย่อนคนพิการ
  EXPENSE_DEDUCTION_PERCENT: 50,       // หักค่าใช้จ่ายเหมา 50%
  EXPENSE_DEDUCTION_MAX: 100000,       // หักค่าใช้จ่ายเหมาสูงสุด
  SSO_MAX: 9000,                       // ประกันสังคมสูงสุด/ปี
  PROVIDENT_FUND_MAX: 500000,          // กองทุนสำรองเลี้ยงชีพสูงสุด
  INSURANCE_MAX: 100000,               // ประกันชีวิตสูงสุด
  HEALTH_INSURANCE_MAX: 25000,         // ประกันสุขภาพสูงสุด
  PARENT_HEALTH_INSURANCE_MAX: 15000,  // ประกันสุขภาพบิดามารดา
  HOUSING_LOAN_INTEREST_MAX: 100000,   // ดอกเบี้ยบ้านสูงสุด
  LTF_RMF_MAX_PERCENT: 30,             // RMF/SSF สูงสุด 30% ของรายได้
  LTF_RMF_MAX: 500000,                 // รวม RMF/SSF สูงสุด
  DONATION_MAX_PERCENT: 10,            // บริจาคสูงสุด 10% ของรายได้หลังหัก
};

// Social Security rates
export const SSO_RATES = {
  EMPLOYEE_RATE: 5,      // 5% from employee
  EMPLOYER_RATE: 5,      // 5% from employer
  MAX_SALARY: 15000,     // Max salary for SSO calculation
  MONTHLY_MAX: 750,      // Max monthly contribution
};

export interface Employee {
  id: string;
  clientId: string;
  employeeCode: string;
  titleTh: string;
  firstNameTh: string;
  lastNameTh: string;
  titleEn?: string;
  firstNameEn?: string;
  lastNameEn?: string;
  nationalId: string;
  taxId?: string;
  dateOfBirth: string;
  startDate: string;
  endDate?: string;
  position: string;
  department?: string;
  bankAccount?: string;
  bankName?: string;
  status: 'active' | 'resigned' | 'suspended';
}

export interface SalaryStructure {
  baseSalary: number;
  positionAllowance?: number;
  housingAllowance?: number;
  transportAllowance?: number;
  mealAllowance?: number;
  otherAllowance?: number;
  commission?: number;
  bonus?: number;
  overtime?: number;
}

export interface Deductions {
  sso: number;
  providentFund?: number;
  loan?: number;
  otherDeductions?: number;
}

export interface TaxDeductionItems {
  personalAllowance: number;
  spouseAllowance: number;
  childrenAllowance: number;
  parentAllowance: number;
  disabledAllowance: number;
  expenseDeduction: number;
  ssoDeduction: number;
  providentFundDeduction: number;
  lifeInsurance: number;
  healthInsurance: number;
  parentHealthInsurance: number;
  housingLoanInterest: number;
  rmfSsf: number;
  donations: number;
  otherDeductions: number;
}

export interface PaySlip {
  id: string;
  employeeId: string;
  clientId: string;
  period: string; // YYYY-MM
  periodStart: string;
  periodEnd: string;

  // Earnings
  earnings: SalaryStructure;
  totalEarnings: number;

  // Deductions
  deductions: Deductions;
  wht: number; // Withholding tax
  totalDeductions: number;

  // Net
  netPay: number;

  // YTD (Year to Date)
  ytdEarnings: number;
  ytdWht: number;
  ytdSso: number;

  status: 'draft' | 'approved' | 'paid';
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

/**
 * Calculate Personal Income Tax
 */
export const calculatePIT = (annualIncome: number): number => {
  let remainingIncome = annualIncome;
  let totalTax = 0;

  for (const bracket of PIT_BRACKETS) {
    if (remainingIncome <= 0) break;

    const taxableInThisBracket = Math.min(
      remainingIncome,
      bracket.max - bracket.min + 1
    );

    if (taxableInThisBracket > 0) {
      totalTax += (taxableInThisBracket * bracket.rate) / 100;
      remainingIncome -= taxableInThisBracket;
    }
  }

  return Math.max(0, Math.round(totalTax));
};

/**
 * Calculate taxable income after deductions
 */
export const calculateTaxableIncome = (
  annualIncome: number,
  deductions: Partial<TaxDeductionItems>
): { taxableIncome: number; totalDeductions: number; breakdown: TaxDeductionItems } => {
  // Default deductions
  const defaults: TaxDeductionItems = {
    personalAllowance: TAX_DEDUCTIONS.PERSONAL_ALLOWANCE,
    spouseAllowance: 0,
    childrenAllowance: 0,
    parentAllowance: 0,
    disabledAllowance: 0,
    expenseDeduction: Math.min(
      annualIncome * TAX_DEDUCTIONS.EXPENSE_DEDUCTION_PERCENT / 100,
      TAX_DEDUCTIONS.EXPENSE_DEDUCTION_MAX
    ),
    ssoDeduction: 0,
    providentFundDeduction: 0,
    lifeInsurance: 0,
    healthInsurance: 0,
    parentHealthInsurance: 0,
    housingLoanInterest: 0,
    rmfSsf: 0,
    donations: 0,
    otherDeductions: 0,
  };

  // Merge with provided deductions
  const finalDeductions: TaxDeductionItems = {
    ...defaults,
    ...deductions,
    // Apply caps
    spouseAllowance: Math.min(deductions.spouseAllowance || 0, TAX_DEDUCTIONS.SPOUSE_ALLOWANCE),
    ssoDeduction: Math.min(deductions.ssoDeduction || 0, TAX_DEDUCTIONS.SSO_MAX),
    providentFundDeduction: Math.min(deductions.providentFundDeduction || 0, TAX_DEDUCTIONS.PROVIDENT_FUND_MAX),
    lifeInsurance: Math.min(deductions.lifeInsurance || 0, TAX_DEDUCTIONS.INSURANCE_MAX),
    healthInsurance: Math.min(deductions.healthInsurance || 0, TAX_DEDUCTIONS.HEALTH_INSURANCE_MAX),
    parentHealthInsurance: Math.min(deductions.parentHealthInsurance || 0, TAX_DEDUCTIONS.PARENT_HEALTH_INSURANCE_MAX),
    housingLoanInterest: Math.min(deductions.housingLoanInterest || 0, TAX_DEDUCTIONS.HOUSING_LOAN_INTEREST_MAX),
    rmfSsf: Math.min(
      deductions.rmfSsf || 0,
      Math.min(annualIncome * TAX_DEDUCTIONS.LTF_RMF_MAX_PERCENT / 100, TAX_DEDUCTIONS.LTF_RMF_MAX)
    ),
  };

  const totalDeductions = Object.values(finalDeductions).reduce((sum, val) => sum + val, 0);
  const taxableIncome = Math.max(0, annualIncome - totalDeductions);

  return {
    taxableIncome,
    totalDeductions,
    breakdown: finalDeductions,
  };
};

/**
 * Calculate monthly withholding tax
 */
export const calculateMonthlyWHT = (
  monthlyIncome: number,
  ytdIncome: number,
  ytdWht: number,
  monthsRemaining: number,
  annualDeductions: number
): number => {
  // Project annual income
  const projectedAnnualIncome = ytdIncome + (monthlyIncome * monthsRemaining);

  // Calculate taxable income
  const taxableIncome = Math.max(0, projectedAnnualIncome - annualDeductions);

  // Calculate annual tax
  const annualTax = calculatePIT(taxableIncome);

  // Calculate remaining tax for the year
  const remainingTax = Math.max(0, annualTax - ytdWht);

  // Divide by remaining months
  const monthlyWht = Math.round(remainingTax / monthsRemaining);

  return Math.max(0, monthlyWht);
};

/**
 * Calculate Social Security contribution
 */
export const calculateSSO = (monthlySalary: number): {
  employeeContribution: number;
  employerContribution: number;
  total: number;
} => {
  const cappedSalary = Math.min(monthlySalary, SSO_RATES.MAX_SALARY);

  const employeeContribution = Math.min(
    Math.round(cappedSalary * SSO_RATES.EMPLOYEE_RATE / 100),
    SSO_RATES.MONTHLY_MAX
  );

  const employerContribution = Math.min(
    Math.round(cappedSalary * SSO_RATES.EMPLOYER_RATE / 100),
    SSO_RATES.MONTHLY_MAX
  );

  return {
    employeeContribution,
    employerContribution,
    total: employeeContribution + employerContribution,
  };
};

/**
 * Calculate payslip
 */
export const calculatePaySlip = (
  employee: Employee,
  earnings: SalaryStructure,
  ytd: { earnings: number; wht: number; sso: number },
  month: number, // 1-12
  providentFundPercent: number = 0,
  annualDeductions: number = TAX_DEDUCTIONS.PERSONAL_ALLOWANCE + TAX_DEDUCTIONS.EXPENSE_DEDUCTION_MAX
): Omit<PaySlip, 'id' | 'createdAt' | 'status'> => {
  // Calculate total earnings
  const totalEarnings =
    (earnings.baseSalary || 0) +
    (earnings.positionAllowance || 0) +
    (earnings.housingAllowance || 0) +
    (earnings.transportAllowance || 0) +
    (earnings.mealAllowance || 0) +
    (earnings.otherAllowance || 0) +
    (earnings.commission || 0) +
    (earnings.bonus || 0) +
    (earnings.overtime || 0);

  // Calculate SSO
  const sso = calculateSSO(earnings.baseSalary || 0);

  // Calculate Provident Fund
  const providentFund = Math.round(
    (earnings.baseSalary || 0) * providentFundPercent / 100
  );

  // Update YTD
  const newYtdEarnings = ytd.earnings + totalEarnings;
  const newYtdSso = ytd.sso + sso.employeeContribution;

  // Calculate WHT
  const monthsRemaining = 13 - month; // Including current month
  const monthlyWht = calculateMonthlyWHT(
    totalEarnings,
    ytd.earnings,
    ytd.wht,
    monthsRemaining,
    annualDeductions + newYtdSso + (providentFund * 12)
  );

  // Total deductions
  const totalDeductions = sso.employeeContribution + providentFund + monthlyWht;

  // Net pay
  const netPay = totalEarnings - totalDeductions;

  // Period info
  const year = new Date().getFullYear();
  const periodStart = new Date(year, month - 1, 1).toISOString().split('T')[0];
  const periodEnd = new Date(year, month, 0).toISOString().split('T')[0];

  return {
    employeeId: employee.id,
    clientId: employee.clientId,
    period: `${year}-${String(month).padStart(2, '0')}`,
    periodStart,
    periodEnd,
    earnings,
    totalEarnings,
    deductions: {
      sso: sso.employeeContribution,
      providentFund,
    },
    wht: monthlyWht,
    totalDeductions,
    netPay,
    ytdEarnings: newYtdEarnings,
    ytdWht: ytd.wht + monthlyWht,
    ytdSso: newYtdSso,
  };
};

/**
 * Format Thai Baht
 */
export const formatThaiCurrency = (amount: number): string => {
  return amount.toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Get tax bracket info for an income level
 */
export const getTaxBracketInfo = (taxableIncome: number): {
  bracket: typeof PIT_BRACKETS[number];
  effectiveRate: number;
  marginalRate: number;
} => {
  const bracket = PIT_BRACKETS.find(b => taxableIncome >= b.min && taxableIncome <= b.max)
    || PIT_BRACKETS[PIT_BRACKETS.length - 1];

  const totalTax = calculatePIT(taxableIncome);
  const effectiveRate = taxableIncome > 0 ? (totalTax / taxableIncome) * 100 : 0;

  return {
    bracket,
    effectiveRate,
    marginalRate: bracket.rate,
  };
};

export default {
  PIT_BRACKETS,
  TAX_DEDUCTIONS,
  SSO_RATES,
  calculatePIT,
  calculateTaxableIncome,
  calculateMonthlyWHT,
  calculateSSO,
  calculatePaySlip,
  formatThaiCurrency,
  getTaxBracketInfo,
};

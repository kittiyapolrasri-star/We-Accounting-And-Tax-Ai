// Test Data Generator for WE Accounting & Tax AI
// This file contains sample data that can be imported via Data Import Wizard

export interface TestChartOfAccount {
    accountCode: string;
    accountName: string;
    accountType: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
    parentCode?: string;
}

export interface TestJournalEntry {
    date: string;
    reference: string;
    description: string;
    debitAccount: string;
    creditAccount: string;
    amount: number;
}

export interface TestFixedAsset {
    assetCode: string;
    assetName: string;
    category: string;
    acquisitionDate: string;
    acquisitionCost: number;
    usefulLife: number;
    depreciationMethod: 'straight-line' | 'declining-balance';
}

// === CHART OF ACCOUNTS (Thailand Standard) ===
export const testChartOfAccounts: TestChartOfAccount[] = [
    // Assets (1xxx)
    { accountCode: '1000', accountName: 'สินทรัพย์', accountType: 'asset' },
    { accountCode: '1100', accountName: 'สินทรัพย์หมุนเวียน', accountType: 'asset', parentCode: '1000' },
    { accountCode: '1110', accountName: 'เงินสด', accountType: 'asset', parentCode: '1100' },
    { accountCode: '1111', accountName: 'เงินสดในมือ', accountType: 'asset', parentCode: '1110' },
    { accountCode: '1112', accountName: 'เงินสดย่อย', accountType: 'asset', parentCode: '1110' },
    { accountCode: '1120', accountName: 'เงินฝากธนาคาร', accountType: 'asset', parentCode: '1100' },
    { accountCode: '1121', accountName: 'เงินฝากธนาคารกรุงเทพ', accountType: 'asset', parentCode: '1120' },
    { accountCode: '1122', accountName: 'เงินฝากธนาคารกสิกร', accountType: 'asset', parentCode: '1120' },
    { accountCode: '1130', accountName: 'ลูกหนี้การค้า', accountType: 'asset', parentCode: '1100' },
    { accountCode: '1140', accountName: 'สินค้าคงเหลือ', accountType: 'asset', parentCode: '1100' },
    { accountCode: '1150', accountName: 'ภาษีซื้อ', accountType: 'asset', parentCode: '1100' },
    { accountCode: '1160', accountName: 'ภาษีซื้อรอเครดิต', accountType: 'asset', parentCode: '1100' },
    { accountCode: '1200', accountName: 'สินทรัพย์ไม่หมุนเวียน', accountType: 'asset', parentCode: '1000' },
    { accountCode: '1210', accountName: 'ที่ดิน', accountType: 'asset', parentCode: '1200' },
    { accountCode: '1220', accountName: 'อาคาร', accountType: 'asset', parentCode: '1200' },
    { accountCode: '1221', accountName: 'ค่าเสื่อมราคาสะสม-อาคาร', accountType: 'asset', parentCode: '1220' },
    { accountCode: '1230', accountName: 'อุปกรณ์', accountType: 'asset', parentCode: '1200' },
    { accountCode: '1231', accountName: 'ค่าเสื่อมราคาสะสม-อุปกรณ์', accountType: 'asset', parentCode: '1230' },
    { accountCode: '1240', accountName: 'ยานพาหนะ', accountType: 'asset', parentCode: '1200' },
    { accountCode: '1241', accountName: 'ค่าเสื่อมราคาสะสม-ยานพาหนะ', accountType: 'asset', parentCode: '1240' },
    { accountCode: '1250', accountName: 'เครื่องจักร', accountType: 'asset', parentCode: '1200' },
    { accountCode: '1251', accountName: 'ค่าเสื่อมราคาสะสม-เครื่องจักร', accountType: 'asset', parentCode: '1250' },

    // Liabilities (2xxx)
    { accountCode: '2000', accountName: 'หนี้สิน', accountType: 'liability' },
    { accountCode: '2100', accountName: 'หนี้สินหมุนเวียน', accountType: 'liability', parentCode: '2000' },
    { accountCode: '2110', accountName: 'เจ้าหนี้การค้า', accountType: 'liability', parentCode: '2100' },
    { accountCode: '2120', accountName: 'เงินกู้ยืมระยะสั้น', accountType: 'liability', parentCode: '2100' },
    { accountCode: '2130', accountName: 'ภาษีขาย', accountType: 'liability', parentCode: '2100' },
    { accountCode: '2140', accountName: 'ภาษีหัก ณ ที่จ่ายค้างจ่าย', accountType: 'liability', parentCode: '2100' },
    { accountCode: '2141', accountName: 'ภ.ง.ด.3 ค้างจ่าย', accountType: 'liability', parentCode: '2140' },
    { accountCode: '2142', accountName: 'ภ.ง.ด.53 ค้างจ่าย', accountType: 'liability', parentCode: '2140' },
    { accountCode: '2150', accountName: 'เงินเดือนค้างจ่าย', accountType: 'liability', parentCode: '2100' },
    { accountCode: '2160', accountName: 'ประกันสังคมค้างจ่าย', accountType: 'liability', parentCode: '2100' },
    { accountCode: '2200', accountName: 'หนี้สินไม่หมุนเวียน', accountType: 'liability', parentCode: '2000' },
    { accountCode: '2210', accountName: 'เงินกู้ยืมระยะยาว', accountType: 'liability', parentCode: '2200' },

    // Equity (3xxx)
    { accountCode: '3000', accountName: 'ส่วนของผู้ถือหุ้น', accountType: 'equity' },
    { accountCode: '3100', accountName: 'ทุนจดทะเบียน', accountType: 'equity', parentCode: '3000' },
    { accountCode: '3200', accountName: 'กำไร(ขาดทุน)สะสม', accountType: 'equity', parentCode: '3000' },
    { accountCode: '3300', accountName: 'กำไร(ขาดทุน)ประจำปี', accountType: 'equity', parentCode: '3000' },

    // Income (4xxx)
    { accountCode: '4000', accountName: 'รายได้', accountType: 'income' },
    { accountCode: '4100', accountName: 'รายได้จากการขาย', accountType: 'income', parentCode: '4000' },
    { accountCode: '4110', accountName: 'รายได้จากการขายสินค้า', accountType: 'income', parentCode: '4100' },
    { accountCode: '4120', accountName: 'รายได้จากการให้บริการ', accountType: 'income', parentCode: '4100' },
    { accountCode: '4200', accountName: 'รายได้อื่น', accountType: 'income', parentCode: '4000' },
    { accountCode: '4210', accountName: 'ดอกเบี้ยรับ', accountType: 'income', parentCode: '4200' },
    { accountCode: '4220', accountName: 'กำไรจากการขายสินทรัพย์', accountType: 'income', parentCode: '4200' },

    // Expenses (5xxx)
    { accountCode: '5000', accountName: 'ค่าใช้จ่าย', accountType: 'expense' },
    { accountCode: '5100', accountName: 'ต้นทุนขาย', accountType: 'expense', parentCode: '5000' },
    { accountCode: '5110', accountName: 'ต้นทุนสินค้าขาย', accountType: 'expense', parentCode: '5100' },
    { accountCode: '5200', accountName: 'ค่าใช้จ่ายในการขาย', accountType: 'expense', parentCode: '5000' },
    { accountCode: '5210', accountName: 'ค่านายหน้า', accountType: 'expense', parentCode: '5200' },
    { accountCode: '5220', accountName: 'ค่าโฆษณา', accountType: 'expense', parentCode: '5200' },
    { accountCode: '5230', accountName: 'ค่าขนส่ง', accountType: 'expense', parentCode: '5200' },
    { accountCode: '5300', accountName: 'ค่าใช้จ่ายในการบริหาร', accountType: 'expense', parentCode: '5000' },
    { accountCode: '5310', accountName: 'เงินเดือนพนักงาน', accountType: 'expense', parentCode: '5300' },
    { accountCode: '5320', accountName: 'ค่าเช่าสำนักงาน', accountType: 'expense', parentCode: '5300' },
    { accountCode: '5330', accountName: 'ค่าน้ำประปา', accountType: 'expense', parentCode: '5300' },
    { accountCode: '5340', accountName: 'ค่าไฟฟ้า', accountType: 'expense', parentCode: '5300' },
    { accountCode: '5350', accountName: 'ค่าโทรศัพท์', accountType: 'expense', parentCode: '5300' },
    { accountCode: '5360', accountName: 'ค่าเสื่อมราคา', accountType: 'expense', parentCode: '5300' },
    { accountCode: '5370', accountName: 'ค่าใช้จ่ายเบ็ดเตล็ด', accountType: 'expense', parentCode: '5300' },
    { accountCode: '5400', accountName: 'ค่าใช้จ่ายอื่น', accountType: 'expense', parentCode: '5000' },
    { accountCode: '5410', accountName: 'ดอกเบี้ยจ่าย', accountType: 'expense', parentCode: '5400' },
    { accountCode: '5420', accountName: 'ค่าธรรมเนียมธนาคาร', accountType: 'expense', parentCode: '5400' },
];

// === SAMPLE JOURNAL ENTRIES ===
export const testJournalEntries: TestJournalEntry[] = [
    // Opening Balance
    { date: '2024-01-01', reference: 'OB-001', description: 'ยอดยกมา - เงินสด', debitAccount: '1110', creditAccount: '3200', amount: 100000 },
    { date: '2024-01-01', reference: 'OB-002', description: 'ยอดยกมา - เงินฝากธนาคาร', debitAccount: '1121', creditAccount: '3200', amount: 500000 },
    { date: '2024-01-01', reference: 'OB-003', description: 'ยอดยกมา - สินค้าคงเหลือ', debitAccount: '1140', creditAccount: '3200', amount: 200000 },
    { date: '2024-01-01', reference: 'OB-004', description: 'ยอดยกมา - อุปกรณ์', debitAccount: '1230', creditAccount: '3200', amount: 150000 },
    { date: '2024-01-01', reference: 'OB-005', description: 'ยอดยกมา - ทุนจดทะเบียน', debitAccount: '3200', creditAccount: '3100', amount: 1000000 },

    // January Sales
    { date: '2024-01-05', reference: 'INV-001', description: 'ขายสินค้า - บริษัท ABC', debitAccount: '1130', creditAccount: '4110', amount: 50000 },
    { date: '2024-01-05', reference: 'INV-001-VAT', description: 'ภาษีขาย - INV-001', debitAccount: '1130', creditAccount: '2130', amount: 3500 },
    { date: '2024-01-10', reference: 'INV-002', description: 'ขายสินค้า - บริษัท XYZ', debitAccount: '1130', creditAccount: '4110', amount: 80000 },
    { date: '2024-01-10', reference: 'INV-002-VAT', description: 'ภาษีขาย - INV-002', debitAccount: '1130', creditAccount: '2130', amount: 5600 },
    { date: '2024-01-15', reference: 'RV-001', description: 'รับชำระหนี้ - บริษัท ABC', debitAccount: '1121', creditAccount: '1130', amount: 53500 },

    // January Expenses
    { date: '2024-01-20', reference: 'PV-001', description: 'จ่ายค่าเช่าสำนักงาน', debitAccount: '5320', creditAccount: '1121', amount: 25000 },
    { date: '2024-01-25', reference: 'PV-002', description: 'จ่ายเงินเดือนพนักงาน', debitAccount: '5310', creditAccount: '1121', amount: 120000 },
    { date: '2024-01-25', reference: 'PV-002-WHT', description: 'หัก ภ.ง.ด.1 ณ ที่จ่าย', debitAccount: '1121', creditAccount: '2141', amount: 5000 },
    { date: '2024-01-28', reference: 'PV-003', description: 'จ่ายค่าไฟฟ้า', debitAccount: '5340', creditAccount: '1111', amount: 8500 },
    { date: '2024-01-28', reference: 'PV-004', description: 'จ่ายค่าโทรศัพท์', debitAccount: '5350', creditAccount: '1111', amount: 3200 },

    // February Transactions
    { date: '2024-02-05', reference: 'INV-003', description: 'ขายสินค้า - บริษัท DEF', debitAccount: '1130', creditAccount: '4110', amount: 120000 },
    { date: '2024-02-05', reference: 'INV-003-VAT', description: 'ภาษีขาย - INV-003', debitAccount: '1130', creditAccount: '2130', amount: 8400 },
    { date: '2024-02-10', reference: 'RV-002', description: 'รับชำระหนี้ - บริษัท XYZ', debitAccount: '1121', creditAccount: '1130', amount: 85600 },
    { date: '2024-02-15', reference: 'PO-001', description: 'ซื้อสินค้า - บริษัท Supply', debitAccount: '1140', creditAccount: '2110', amount: 75000 },
    { date: '2024-02-15', reference: 'PO-001-VAT', description: 'ภาษีซื้อ - PO-001', debitAccount: '1150', creditAccount: '2110', amount: 5250 },
    { date: '2024-02-20', reference: 'PV-005', description: 'จ่ายชำระหนี้ - บริษัท Supply', debitAccount: '2110', creditAccount: '1121', amount: 80250 },
];

// === SAMPLE FIXED ASSETS ===
export const testFixedAssets: TestFixedAsset[] = [
    { assetCode: 'EQ-001', assetName: 'คอมพิวเตอร์ตั้งโต๊ะ 1', category: 'equipment', acquisitionDate: '2023-01-15', acquisitionCost: 35000, usefulLife: 5, depreciationMethod: 'straight-line' },
    { assetCode: 'EQ-002', assetName: 'คอมพิวเตอร์ตั้งโต๊ะ 2', category: 'equipment', acquisitionDate: '2023-03-01', acquisitionCost: 42000, usefulLife: 5, depreciationMethod: 'straight-line' },
    { assetCode: 'EQ-003', assetName: 'เครื่องพิมพ์ HP LaserJet', category: 'equipment', acquisitionDate: '2023-02-10', acquisitionCost: 15000, usefulLife: 5, depreciationMethod: 'straight-line' },
    { assetCode: 'EQ-004', assetName: 'โปรเจคเตอร์ Epson', category: 'equipment', acquisitionDate: '2023-06-01', acquisitionCost: 28000, usefulLife: 5, depreciationMethod: 'straight-line' },
    { assetCode: 'FN-001', assetName: 'โต๊ะทำงานผู้จัดการ', category: 'furniture', acquisitionDate: '2022-12-01', acquisitionCost: 25000, usefulLife: 10, depreciationMethod: 'straight-line' },
    { assetCode: 'FN-002', assetName: 'ชุดโต๊ะประชุม 6 ที่นั่ง', category: 'furniture', acquisitionDate: '2022-12-01', acquisitionCost: 45000, usefulLife: 10, depreciationMethod: 'straight-line' },
    { assetCode: 'VH-001', assetName: 'รถยนต์ Toyota Camry', category: 'vehicle', acquisitionDate: '2022-06-15', acquisitionCost: 1200000, usefulLife: 5, depreciationMethod: 'declining-balance' },
    { assetCode: 'VH-002', assetName: 'รถกระบะ Isuzu D-Max', category: 'vehicle', acquisitionDate: '2023-09-01', acquisitionCost: 850000, usefulLife: 5, depreciationMethod: 'declining-balance' },
];

// === HELPER FUNCTION TO GENERATE CSV ===
export function generateChartOfAccountsCSV(): string {
    const headers = ['รหัสบัญชี', 'ชื่อบัญชี', 'ประเภท', 'รหัสบัญชีแม่'];
    const rows = testChartOfAccounts.map(acc => [
        acc.accountCode,
        acc.accountName,
        acc.accountType,
        acc.parentCode || ''
    ]);
    return [headers, ...rows].map(row => row.join(',')).join('\n');
}

export function generateJournalEntriesCSV(): string {
    const headers = ['วันที่', 'เลขที่อ้างอิง', 'รายละเอียด', 'บัญชีเดบิต', 'บัญชีเครดิต', 'จำนวนเงิน'];
    const rows = testJournalEntries.map(je => [
        je.date,
        je.reference,
        je.description,
        je.debitAccount,
        je.creditAccount,
        je.amount.toString()
    ]);
    return [headers, ...rows].map(row => row.join(',')).join('\n');
}

export function generateFixedAssetsCSV(): string {
    const headers = ['รหัสสินทรัพย์', 'ชื่อสินทรัพย์', 'หมวดหมู่', 'วันที่ซื้อ', 'ราคาทุน', 'อายุการใช้งาน(ปี)', 'วิธีคิดค่าเสื่อม'];
    const rows = testFixedAssets.map(fa => [
        fa.assetCode,
        fa.assetName,
        fa.category,
        fa.acquisitionDate,
        fa.acquisitionCost.toString(),
        fa.usefulLife.toString(),
        fa.depreciationMethod
    ]);
    return [headers, ...rows].map(row => row.join(',')).join('\n');
}

// === EXPORT ALL TEST DATA ===
export const allTestData = {
    chartOfAccounts: testChartOfAccounts,
    journalEntries: testJournalEntries,
    fixedAssets: testFixedAssets,
    generateCSV: {
        chartOfAccounts: generateChartOfAccountsCSV,
        journalEntries: generateJournalEntriesCSV,
        fixedAssets: generateFixedAssetsCSV,
    }
};

export default allTestData;

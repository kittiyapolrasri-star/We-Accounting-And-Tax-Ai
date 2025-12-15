/**
 * excelParser.ts
 * 
 * Smart Excel Parser for Accounting Data
 * รองรับไฟล์จาก POS, Grab, LINE MAN และแพลตฟอร์มอื่นๆ
 * 
 * Features:
 * - Auto-detect data source
 * - Multi-sheet support
 * - Thai column names
 * - Skip header rows
 * - Date format parsing
 */

import * as XLSX from 'xlsx';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type DataSourceType =
    | 'grab_food'
    | 'lineman'
    | 'shopee_food'
    | 'pos_foodstory'
    | 'pos_generic'
    | 'bank_statement'
    | 'unknown';

export interface ParsedSheet {
    name: string;
    data: Record<string, any>[];
    columns: string[];
    rowCount: number;
}

export interface ExcelParseResult {
    filename: string;
    source: DataSourceType;
    sourceName: string;
    sheets: ParsedSheet[];
    metadata: {
        totalRows: number;
        totalSheets: number;
        dateRange?: { start: string; end: string };
        branches?: string[];
        restaurant?: string;
    };
    rawData: Record<string, any>[];
}

export interface SalesTransaction {
    id: string;
    date: Date;
    orderId: string;
    source: DataSourceType;
    branch?: string;
    grossAmount: number;
    discount: number;
    netAmount: number;
    commission?: number;
    commissionVat?: number;
    payout?: number;
    paymentMethod?: string;
    orderType?: string; // Dine-in, Delivery, Take Away
    status: 'completed' | 'cancelled' | 'refunded' | 'pending';
    customerName?: string;
    notes?: string;
    rawData: Record<string, any>;
}

export interface DailySalesSummary {
    date: string;
    source: DataSourceType;
    branch?: string;
    totalOrders: number;
    grossSales: number;
    discounts: number;
    netSales: number;
    commissions: number;
    payouts: number;
    cancelledOrders: number;
    refunds: number;
}

// ============================================================================
// SOURCE DETECTION
// ============================================================================

const SOURCE_SIGNATURES: Record<DataSourceType, { columns: string[]; sheetPatterns?: string[] }> = {
    grab_food: {
        columns: ['Short Order ID', 'GrabFood', 'Channel Commission', 'Net Sales'],
        sheetPatterns: ['Grab', 'GrabFood']
    },
    lineman: {
        columns: ['wongnai_restaurant_id', 'gp_fee_with_vat', 'payout'],
        sheetPatterns: ['Lineman', 'wongnai']
    },
    shopee_food: {
        columns: ['Order ID', 'ShopeeFood', 'Platform Fee'],
        sheetPatterns: ['Shopee']
    },
    pos_foodstory: {
        columns: ['POS ID', 'หมายเลขใบเสร็จ', 'ยอดก่อนลด', 'รวมสุทธิ'],
        sheetPatterns: []
    },
    pos_generic: {
        columns: ['วันที่ชำระเงิน', 'ประเภทการชำระเงิน', 'สาขา'],
        sheetPatterns: []
    },
    bank_statement: {
        columns: ['วันที่', 'รายการ', 'ฝาก', 'ถอน', 'ยอดคงเหลือ'],
        sheetPatterns: ['Statement', 'Bank']
    },
    unknown: {
        columns: [],
        sheetPatterns: []
    }
};

function detectSource(columns: string[], sheetNames: string[]): DataSourceType {
    // Check each source signature
    for (const [source, signature] of Object.entries(SOURCE_SIGNATURES)) {
        if (source === 'unknown') continue;

        // Check column matches
        const columnMatches = signature.columns.filter(col =>
            columns.some(c => c?.toString().toLowerCase().includes(col.toLowerCase()))
        );

        // Check sheet name patterns
        const sheetMatches = signature.sheetPatterns?.filter(pattern =>
            sheetNames.some(name => name.toLowerCase().includes(pattern.toLowerCase()))
        ) || [];

        // If enough matches found, return this source
        if (columnMatches.length >= 2 || sheetMatches.length >= 1) {
            return source as DataSourceType;
        }
    }

    return 'unknown';
}

function getSourceName(source: DataSourceType): string {
    const names: Record<DataSourceType, string> = {
        grab_food: 'Grab Food',
        lineman: 'LINE MAN',
        shopee_food: 'Shopee Food',
        pos_foodstory: 'FoodStory POS',
        pos_generic: 'ระบบ POS',
        bank_statement: 'Bank Statement',
        unknown: 'ไม่ทราบแหล่งที่มา'
    };
    return names[source];
}

// ============================================================================
// EXCEL PARSER CLASS
// ============================================================================

export class SmartExcelParser {

    /**
     * Parse Excel file from File object or ArrayBuffer
     */
    static async parseFile(file: File): Promise<ExcelParseResult> {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, {
            type: 'array',
            cellDates: true,
            dateNF: 'yyyy-mm-dd'
        });

        return this.parseWorkbook(workbook, file.name);
    }

    /**
     * Parse workbook and detect source
     */
    static parseWorkbook(workbook: XLSX.WorkBook, filename: string): ExcelParseResult {
        const sheets: ParsedSheet[] = [];
        let allColumns: string[] = [];
        let allData: Record<string, any>[] = [];

        // Parse each sheet
        for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];

            // Try different header rows (0, 1, 2) to find the best one
            let bestData: any[] = [];
            let bestColumns: string[] = [];

            for (let headerRow = 0; headerRow <= 2; headerRow++) {
                const data = XLSX.utils.sheet_to_json(worksheet, {
                    header: headerRow === 0 ? 1 : undefined,
                    range: headerRow,
                    defval: null,
                    raw: false
                });

                if (data.length > 0) {
                    const firstRow = data[0] as Record<string, any>;
                    const columns = Object.keys(firstRow).filter(c => !c.startsWith('__'));
                    const namedColumns = columns.filter(c => !c.match(/^Unnamed/));

                    // If this header row has more named columns, use it
                    if (namedColumns.length > bestColumns.filter(c => !c.match(/^Unnamed/)).length) {
                        bestData = data as any[];
                        bestColumns = columns;
                    }
                }
            }

            if (bestData.length > 0) {
                sheets.push({
                    name: sheetName,
                    data: bestData,
                    columns: bestColumns,
                    rowCount: bestData.length
                });

                allColumns = [...new Set([...allColumns, ...bestColumns])];
                allData = [...allData, ...bestData];
            }
        }

        // Detect source
        const source = detectSource(allColumns, workbook.SheetNames);

        // Extract metadata
        const metadata = this.extractMetadata(sheets, source);

        return {
            filename,
            source,
            sourceName: getSourceName(source),
            sheets,
            metadata,
            rawData: allData
        };
    }

    /**
     * Extract metadata from parsed sheets
     */
    private static extractMetadata(sheets: ParsedSheet[], source: DataSourceType): ExcelParseResult['metadata'] {
        const allData = sheets.flatMap(s => s.data);

        // Find date columns
        const dateColumns = ['date', 'summary_date', 'Created On', 'วันที่ชำระเงิน', 'Transfer Date'];
        let dates: Date[] = [];

        for (const row of allData) {
            for (const col of dateColumns) {
                if (row[col]) {
                    const parsed = this.parseDate(row[col]);
                    if (parsed) dates.push(parsed);
                }
            }
        }

        // Find branches
        const branchColumns = ['branch_name', 'สาขา', 'Branch'];
        const branches = new Set<string>();
        for (const row of allData) {
            for (const col of branchColumns) {
                if (row[col] && typeof row[col] === 'string') {
                    branches.add(row[col]);
                }
            }
        }

        // Find restaurant name
        let restaurant: string | undefined;
        const restaurantColumns = ['restaurant_name', 'ชื่อร้าน'];
        for (const row of allData) {
            for (const col of restaurantColumns) {
                if (row[col]) {
                    restaurant = row[col] as string;
                    break;
                }
            }
            if (restaurant) break;
        }

        return {
            totalRows: allData.length,
            totalSheets: sheets.length,
            dateRange: dates.length > 0 ? {
                start: new Date(Math.min(...dates.map(d => d.getTime()))).toISOString().split('T')[0],
                end: new Date(Math.max(...dates.map(d => d.getTime()))).toISOString().split('T')[0]
            } : undefined,
            branches: branches.size > 0 ? Array.from(branches) : undefined,
            restaurant
        };
    }

    /**
     * Parse date from various formats
     */
    static parseDate(value: any): Date | null {
        if (!value) return null;

        if (value instanceof Date) return value;

        if (typeof value === 'number') {
            // Excel serial date
            return new Date((value - 25569) * 86400 * 1000);
        }

        if (typeof value === 'string') {
            // Try various formats
            const formats = [
                // DD/MM/YYYY
                /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
                // YYYY-MM-DD
                /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
                // DD-MM-YYYY
                /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
            ];

            for (const format of formats) {
                const match = value.match(format);
                if (match) {
                    if (format === formats[0]) {
                        // DD/MM/YYYY
                        return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
                    } else if (format === formats[1]) {
                        // YYYY-MM-DD
                        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
                    } else {
                        // DD-MM-YYYY
                        return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
                    }
                }
            }

            // Try native parsing
            const parsed = new Date(value);
            if (!isNaN(parsed.getTime())) return parsed;
        }

        return null;
    }

    /**
     * Parse number from various formats (Thai/English)
     */
    static parseNumber(value: any): number {
        if (typeof value === 'number') return value;
        if (!value) return 0;

        const str = value.toString().replace(/[,฿]/g, '').trim();
        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
    }
}

// ============================================================================
// PLATFORM-SPECIFIC PARSERS
// ============================================================================

export class GrabFoodParser {

    static parseTransactions(result: ExcelParseResult): SalesTransaction[] {
        const transactions: SalesTransaction[] = [];

        for (const sheet of result.sheets) {
            // Skip summary sheets
            if (sheet.name.toLowerCase().includes('summary')) continue;

            for (const row of sheet.data) {
                // Skip non-payment rows
                if (row['Category'] !== 'Payment' && row['Type'] !== 'GrabFood') continue;

                const date = SmartExcelParser.parseDate(row['Created On']);
                if (!date) continue;

                const grossAmount = SmartExcelParser.parseNumber(row['Amount']);
                const netSales = SmartExcelParser.parseNumber(row['Net Sales']);
                const commission = Math.abs(SmartExcelParser.parseNumber(row['Channel Commission']));
                const otherCommission = Math.abs(SmartExcelParser.parseNumber(row['GrabFood / GrabMart Other Commission']));
                const total = SmartExcelParser.parseNumber(row['Total']);
                const commissionVat = Math.abs(SmartExcelParser.parseNumber(row['Tax on GrabFood / GrabMart Commission, Adjustments, Ads']));

                const orderId = row['Short Order ID'] || `GRAB-${date.getTime()}`;
                const status = row['Cancellation Reason'] ? 'cancelled' : 'completed';

                transactions.push({
                    id: `grab-${orderId}-${date.getTime()}`,
                    date,
                    orderId,
                    source: 'grab_food',
                    branch: this.extractBranch(sheet.name),
                    grossAmount,
                    discount: 0,
                    netAmount: netSales,
                    commission: commission + otherCommission,
                    commissionVat,
                    payout: total,
                    orderType: 'Delivery',
                    status,
                    notes: row['Description'] || undefined,
                    rawData: row
                });
            }
        }

        return transactions;
    }

    private static extractBranch(sheetName: string): string {
        // Extract branch from sheet name like "Park Silom Grab All Transaction"
        const parts = sheetName.replace(/Grab.*$/i, '').trim();
        return parts || 'Main';
    }

    static generateSummary(transactions: SalesTransaction[]): DailySalesSummary[] {
        const summaryMap = new Map<string, DailySalesSummary>();

        for (const tx of transactions) {
            const dateKey = tx.date.toISOString().split('T')[0];
            const key = `${dateKey}-${tx.branch || 'main'}`;

            if (!summaryMap.has(key)) {
                summaryMap.set(key, {
                    date: dateKey,
                    source: 'grab_food',
                    branch: tx.branch,
                    totalOrders: 0,
                    grossSales: 0,
                    discounts: 0,
                    netSales: 0,
                    commissions: 0,
                    payouts: 0,
                    cancelledOrders: 0,
                    refunds: 0
                });
            }

            const summary = summaryMap.get(key)!;
            summary.totalOrders++;
            summary.grossSales += tx.grossAmount;
            summary.discounts += tx.discount;
            summary.netSales += tx.netAmount;
            summary.commissions += tx.commission || 0;
            summary.payouts += tx.payout || 0;

            if (tx.status === 'cancelled') {
                summary.cancelledOrders++;
            }
            if (tx.status === 'refunded') {
                summary.refunds += tx.grossAmount;
            }
        }

        return Array.from(summaryMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    }
}

export class LineManParser {

    static parseTransactions(result: ExcelParseResult): SalesTransaction[] {
        const transactions: SalesTransaction[] = [];

        for (const sheet of result.sheets) {
            // Skip summary sheets
            if (sheet.name.toLowerCase().includes('summary')) continue;

            for (const row of sheet.data) {
                const date = SmartExcelParser.parseDate(row['summary_date']);
                if (!date) continue;

                const grossAmount = SmartExcelParser.parseNumber(row['total_revenue']);
                const commission = SmartExcelParser.parseNumber(row['gp_fee_with_vat']);
                const adFee = SmartExcelParser.parseNumber(row['ad_service_fee']);
                const adjustment = SmartExcelParser.parseNumber(row['adjustment']);
                const payout = SmartExcelParser.parseNumber(row['payout']);

                const orderId = `LM-${row['wongnai_restaurant_id']}-${date.toISOString().split('T')[0]}`;

                transactions.push({
                    id: `lineman-${orderId}`,
                    date,
                    orderId,
                    source: 'lineman',
                    branch: row['branch_name'] || 'Main',
                    grossAmount,
                    discount: 0,
                    netAmount: grossAmount,
                    commission: commission + adFee,
                    commissionVat: commission * 0.07, // Estimate VAT portion
                    payout,
                    orderType: 'Delivery',
                    status: 'completed',
                    notes: row['restaurant_name'] || undefined,
                    rawData: row
                });
            }
        }

        return transactions;
    }

    static generateSummary(transactions: SalesTransaction[]): DailySalesSummary[] {
        const summaryMap = new Map<string, DailySalesSummary>();

        for (const tx of transactions) {
            const dateKey = tx.date.toISOString().split('T')[0];
            const key = `${dateKey}-${tx.branch || 'main'}`;

            if (!summaryMap.has(key)) {
                summaryMap.set(key, {
                    date: dateKey,
                    source: 'lineman',
                    branch: tx.branch,
                    totalOrders: 0,
                    grossSales: 0,
                    discounts: 0,
                    netSales: 0,
                    commissions: 0,
                    payouts: 0,
                    cancelledOrders: 0,
                    refunds: 0
                });
            }

            const summary = summaryMap.get(key)!;
            summary.totalOrders++;
            summary.grossSales += tx.grossAmount;
            summary.netSales += tx.netAmount;
            summary.commissions += tx.commission || 0;
            summary.payouts += tx.payout || 0;
        }

        return Array.from(summaryMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    }
}

export class POSParser {

    static parseTransactions(result: ExcelParseResult): SalesTransaction[] {
        const transactions: SalesTransaction[] = [];

        for (const sheet of result.sheets) {
            for (let i = 0; i < sheet.data.length; i++) {
                const row = sheet.data[i];

                // Find columns dynamically (Thai column names)
                const dateCol = this.findColumn(row, ['วันที่ชำระเงิน', 'วันที่', 'Date']);
                const receiptCol = this.findColumn(row, ['หมายเลขใบเสร็จ', 'Receipt', 'POS ID']);
                const grossCol = this.findColumn(row, ['ยอดก่อนลด', 'Gross', 'ยอดรวม']);
                const discountCol = this.findColumn(row, ['ส่วนลดสินค้า', 'ส่วนลดบิล', 'Discount']);
                const netCol = this.findColumn(row, ['รวมสุทธิ', 'Net', 'Total']);
                const paymentCol = this.findColumn(row, ['ประเภทการชำระเงิน', 'Payment']);
                const orderTypeCol = this.findColumn(row, ['ประเภทการสั่ง', 'Order Type']);
                const branchCol = this.findColumn(row, ['สาขา', 'Branch']);

                const date = SmartExcelParser.parseDate(row[dateCol]);
                if (!date) continue;

                const orderId = row[receiptCol] || `POS-${i}-${date.getTime()}`;
                const grossAmount = SmartExcelParser.parseNumber(row[grossCol]);
                const discount = SmartExcelParser.parseNumber(row[discountCol]);
                const netAmount = SmartExcelParser.parseNumber(row[netCol]);

                if (netAmount === 0 && grossAmount === 0) continue;

                transactions.push({
                    id: `pos-${orderId}`,
                    date,
                    orderId: orderId.toString(),
                    source: result.source,
                    branch: row[branchCol] || undefined,
                    grossAmount,
                    discount,
                    netAmount: netAmount || (grossAmount - discount),
                    paymentMethod: row[paymentCol] || undefined,
                    orderType: row[orderTypeCol] || undefined,
                    status: 'completed',
                    rawData: row
                });
            }
        }

        return transactions;
    }

    private static findColumn(row: Record<string, any>, candidates: string[]): string {
        for (const key of Object.keys(row)) {
            for (const candidate of candidates) {
                if (key.includes(candidate)) {
                    return key;
                }
            }
        }
        return candidates[0];
    }

    static generateSummary(transactions: SalesTransaction[]): DailySalesSummary[] {
        const summaryMap = new Map<string, DailySalesSummary>();

        for (const tx of transactions) {
            const dateKey = tx.date.toISOString().split('T')[0];
            const key = `${dateKey}-${tx.branch || 'main'}`;

            if (!summaryMap.has(key)) {
                summaryMap.set(key, {
                    date: dateKey,
                    source: tx.source,
                    branch: tx.branch,
                    totalOrders: 0,
                    grossSales: 0,
                    discounts: 0,
                    netSales: 0,
                    commissions: 0,
                    payouts: 0,
                    cancelledOrders: 0,
                    refunds: 0
                });
            }

            const summary = summaryMap.get(key)!;
            summary.totalOrders++;
            summary.grossSales += tx.grossAmount;
            summary.discounts += tx.discount;
            summary.netSales += tx.netAmount;
        }

        return Array.from(summaryMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    }
}

// ============================================================================
// UNIFIED PARSER INTERFACE
// ============================================================================

export class SalesDataImporter {

    /**
     * Import sales data from Excel file
     * Auto-detects source and parses accordingly
     */
    static async importFromExcel(file: File): Promise<{
        result: ExcelParseResult;
        transactions: SalesTransaction[];
        summary: DailySalesSummary[];
    }> {
        const result = await SmartExcelParser.parseFile(file);

        let transactions: SalesTransaction[] = [];
        let summary: DailySalesSummary[] = [];

        switch (result.source) {
            case 'grab_food':
                transactions = GrabFoodParser.parseTransactions(result);
                summary = GrabFoodParser.generateSummary(transactions);
                break;

            case 'lineman':
                transactions = LineManParser.parseTransactions(result);
                summary = LineManParser.generateSummary(transactions);
                break;

            case 'pos_foodstory':
            case 'pos_generic':
                transactions = POSParser.parseTransactions(result);
                summary = POSParser.generateSummary(transactions);
                break;

            default:
                console.warn(`Unknown source: ${result.source}, attempting generic POS parsing`);
                transactions = POSParser.parseTransactions(result);
                summary = POSParser.generateSummary(transactions);
        }

        return { result, transactions, summary };
    }

    /**
     * Generate GL entries from sales transactions
     */
    static generateGLEntries(transactions: SalesTransaction[], clientId: string): Array<{
        date: string;
        accountCode: string;
        accountName: string;
        debit: number;
        credit: number;
        description: string;
        reference: string;
    }> {
        const entries: Array<{
            date: string;
            accountCode: string;
            accountName: string;
            debit: number;
            credit: number;
            description: string;
            reference: string;
        }> = [];

        // Group by date for daily summary entries
        const dailyTotals = new Map<string, {
            grossSales: number;
            discounts: number;
            commissions: number;
            commissionVat: number;
            payouts: number;
            sources: Set<string>;
        }>();

        for (const tx of transactions) {
            if (tx.status !== 'completed') continue;

            const dateKey = tx.date.toISOString().split('T')[0];

            if (!dailyTotals.has(dateKey)) {
                dailyTotals.set(dateKey, {
                    grossSales: 0,
                    discounts: 0,
                    commissions: 0,
                    commissionVat: 0,
                    payouts: 0,
                    sources: new Set()
                });
            }

            const daily = dailyTotals.get(dateKey)!;
            daily.grossSales += tx.netAmount;
            daily.discounts += tx.discount;
            daily.commissions += tx.commission || 0;
            daily.commissionVat += tx.commissionVat || 0;
            daily.payouts += tx.payout || 0;
            daily.sources.add(tx.source);
        }

        // Generate entries for each day
        for (const [date, totals] of dailyTotals) {
            const sourceNames = Array.from(totals.sources).map(s => getSourceName(s as DataSourceType)).join(', ');
            const vatAmount = totals.grossSales * 7 / 107; // VAT 7% included
            const beforeVat = totals.grossSales - vatAmount;

            // Debit: Cash/Bank or Platform Receivable
            entries.push({
                date,
                accountCode: '1121',
                accountName: 'ลูกหนี้ - แพลตฟอร์ม',
                debit: totals.payouts || totals.grossSales,
                credit: 0,
                description: `รายได้ขาย ${sourceNames} วันที่ ${date}`,
                reference: `SALES-${date}`
            });

            // If there's commission, Debit: Commission Expense
            if (totals.commissions > 0) {
                entries.push({
                    date,
                    accountCode: '5401',
                    accountName: 'ค่าคอมมิชชั่น - แพลตฟอร์ม',
                    debit: totals.commissions - totals.commissionVat,
                    credit: 0,
                    description: `ค่า GP ${sourceNames}`,
                    reference: `COMM-${date}`
                });

                // VAT on commission (deductible)
                if (totals.commissionVat > 0) {
                    entries.push({
                        date,
                        accountCode: '1181',
                        accountName: 'ภาษีซื้อ',
                        debit: totals.commissionVat,
                        credit: 0,
                        description: `VAT ค่า GP ${sourceNames}`,
                        reference: `VATBUY-${date}`
                    });
                }
            }

            // Credit: Sales Revenue (before VAT)
            entries.push({
                date,
                accountCode: '4101',
                accountName: 'รายได้จากการขาย',
                debit: 0,
                credit: beforeVat,
                description: `รายได้ขาย ${sourceNames}`,
                reference: `SALES-${date}`
            });

            // Credit: VAT Output
            entries.push({
                date,
                accountCode: '2181',
                accountName: 'ภาษีขาย',
                debit: 0,
                credit: vatAmount,
                description: `ภาษีขาย ${sourceNames}`,
                reference: `VATSELL-${date}`
            });
        }

        return entries;
    }
}

// Export singleton for easy use
export const excelParser = {
    parse: SmartExcelParser.parseFile.bind(SmartExcelParser),
    import: SalesDataImporter.importFromExcel.bind(SalesDataImporter),
    generateGL: SalesDataImporter.generateGLEntries.bind(SalesDataImporter)
};

export default excelParser;

/**
 * Financial Reports Routes
 * Generate Income Statement, Balance Sheet, Trial Balance
 */

import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, requireClientAccess } from '../middleware/auth';

const router = Router();

// Account type classification
type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

interface StatementLineItem {
    code: string;
    name: string;
    amount: number;
    indent: number;
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
    return prefix === '11' || prefix === '21';
};

/**
 * Format currency for display
 */
const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

/**
 * GET /api/reports/income-statement
 * Generate Income Statement (งบกำไรขาดทุน)
 */
router.get('/income-statement', async (req: AuthRequest, res: Response) => {
    try {
        const { clientId, periodStart, periodEnd, period } = req.query;

        if (!clientId) {
            return res.status(400).json({
                success: false,
                error: 'กรุณาระบุ clientId',
            });
        }

        // Get client info
        const client = await prisma.client.findUnique({
            where: { id: clientId as string },
        });

        if (!client) {
            return res.status(404).json({
                success: false,
                error: 'ไม่พบลูกค้า',
            });
        }

        // Build date filter
        const dateFilter: any = { client_id: clientId as string };

        if (period) {
            dateFilter.period = period;
        } else if (periodStart && periodEnd) {
            dateFilter.date = {
                gte: new Date(periodStart as string),
                lte: new Date(periodEnd as string),
            };
        }

        // Get all GL entries for the period
        const entries = await prisma.gLEntry.groupBy({
            by: ['account_code', 'account_name'],
            where: dateFilter,
            _sum: {
                debit: true,
                credit: true,
            },
        });

        // Initialize categories
        const revenueItems: StatementLineItem[] = [];
        let totalRevenue = 0;

        const costItems: StatementLineItem[] = [];
        let totalCostOfSales = 0;

        const expenseItems: StatementLineItem[] = [];
        let totalOperatingExpenses = 0;

        let otherIncome = 0;
        let otherExpenses = 0;

        // Categorize entries
        entries.forEach(entry => {
            const accountType = getAccountType(entry.account_code);
            const debit = entry._sum.debit || 0;
            const credit = entry._sum.credit || 0;

            // Calculate balance based on account type
            let balance: number;
            if (accountType === 'asset' || accountType === 'expense') {
                balance = debit - credit;
            } else {
                balance = credit - debit;
            }

            const amount = Math.abs(balance);
            if (amount < 0.01) return;

            const lineItem: StatementLineItem = {
                code: entry.account_code,
                name: entry.account_name,
                amount,
                indent: 1,
            };

            if (accountType === 'revenue') {
                if (entry.account_code.startsWith('49')) {
                    otherIncome += amount;
                } else {
                    revenueItems.push(lineItem);
                    totalRevenue += amount;
                }
            } else if (accountType === 'expense') {
                if (entry.account_code.startsWith('51')) {
                    costItems.push(lineItem);
                    totalCostOfSales += amount;
                } else if (entry.account_code.startsWith('59')) {
                    otherExpenses += amount;
                } else {
                    expenseItems.push(lineItem);
                    totalOperatingExpenses += amount;
                }
            }
        });

        // Calculate profitability
        const grossProfit = totalRevenue - totalCostOfSales;
        const operatingProfit = grossProfit - totalOperatingExpenses;
        const profitBeforeTax = operatingProfit + otherIncome - otherExpenses;
        const incomeTaxExpense = profitBeforeTax > 0 ? profitBeforeTax * 0.20 : 0;
        const netProfit = profitBeforeTax - incomeTaxExpense;

        res.json({
            success: true,
            data: {
                clientId: client.id,
                clientName: client.name,
                periodStart: periodStart || period,
                periodEnd: periodEnd || period,
                revenue: {
                    items: revenueItems.sort((a, b) => a.code.localeCompare(b.code)),
                    totalRevenue,
                },
                costOfSales: {
                    items: costItems.sort((a, b) => a.code.localeCompare(b.code)),
                    totalCostOfSales,
                },
                grossProfit,
                operatingExpenses: {
                    items: expenseItems.sort((a, b) => a.code.localeCompare(b.code)),
                    totalOperatingExpenses,
                },
                operatingProfit,
                otherIncome,
                otherExpenses,
                profitBeforeTax,
                incomeTaxExpense,
                netProfit,
                generatedAt: new Date().toISOString(),
            },
        });
    } catch (error: any) {
        console.error('Generate income statement error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถสร้างงบกำไรขาดทุนได้',
        });
    }
});

/**
 * GET /api/reports/balance-sheet
 * Generate Balance Sheet (งบแสดงฐานะการเงิน)
 */
router.get('/balance-sheet', async (req: AuthRequest, res: Response) => {
    try {
        const { clientId, asOfDate, period } = req.query;

        if (!clientId) {
            return res.status(400).json({
                success: false,
                error: 'กรุณาระบุ clientId',
            });
        }

        const client = await prisma.client.findUnique({
            where: { id: clientId as string },
        });

        if (!client) {
            return res.status(404).json({
                success: false,
                error: 'ไม่พบลูกค้า',
            });
        }

        // Get all GL entries up to the date
        const dateFilter: any = { client_id: clientId as string };
        if (asOfDate) {
            dateFilter.date = { lte: new Date(asOfDate as string) };
        }

        const entries = await prisma.gLEntry.groupBy({
            by: ['account_code', 'account_name'],
            where: dateFilter,
            _sum: {
                debit: true,
                credit: true,
            },
        });

        // Initialize categories
        const currentAssetItems: StatementLineItem[] = [];
        let totalCurrentAssets = 0;

        const nonCurrentAssetItems: StatementLineItem[] = [];
        let totalNonCurrentAssets = 0;

        const currentLiabilityItems: StatementLineItem[] = [];
        let totalCurrentLiabilities = 0;

        const nonCurrentLiabilityItems: StatementLineItem[] = [];
        let totalNonCurrentLiabilities = 0;

        const equityItems: StatementLineItem[] = [];
        let totalEquity = 0;

        let retainedEarnings = 0;

        // Categorize entries
        entries.forEach(entry => {
            const accountType = getAccountType(entry.account_code);
            const debit = entry._sum.debit || 0;
            const credit = entry._sum.credit || 0;

            let balance: number;
            if (accountType === 'asset' || accountType === 'expense') {
                balance = debit - credit;
            } else {
                balance = credit - debit;
            }

            if (Math.abs(balance) < 0.01) return;

            const lineItem: StatementLineItem = {
                code: entry.account_code,
                name: entry.account_name,
                amount: Math.abs(balance),
                indent: 1,
            };

            switch (accountType) {
                case 'asset':
                    if (isCurrentAccount(entry.account_code)) {
                        currentAssetItems.push(lineItem);
                        totalCurrentAssets += balance;
                    } else {
                        nonCurrentAssetItems.push(lineItem);
                        totalNonCurrentAssets += balance;
                    }
                    break;

                case 'liability':
                    if (isCurrentAccount(entry.account_code)) {
                        currentLiabilityItems.push(lineItem);
                        totalCurrentLiabilities += balance;
                    } else {
                        nonCurrentLiabilityItems.push(lineItem);
                        totalNonCurrentLiabilities += balance;
                    }
                    break;

                case 'equity':
                    equityItems.push(lineItem);
                    totalEquity += balance;
                    break;

                case 'revenue':
                    retainedEarnings += balance;
                    break;

                case 'expense':
                    retainedEarnings -= balance;
                    break;
            }
        });

        // Add retained earnings to equity
        if (Math.abs(retainedEarnings) >= 0.01) {
            equityItems.push({
                code: '33000',
                name: 'กำไรสะสม (Retained Earnings)',
                amount: retainedEarnings,
                indent: 1,
            });
            totalEquity += retainedEarnings;
        }

        const totalAssets = totalCurrentAssets + totalNonCurrentAssets;
        const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;
        const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

        res.json({
            success: true,
            data: {
                clientId: client.id,
                clientName: client.name,
                asOfDate: asOfDate || period || new Date().toISOString().split('T')[0],
                assets: {
                    currentAssets: {
                        items: currentAssetItems.sort((a, b) => a.code.localeCompare(b.code)),
                        total: totalCurrentAssets,
                    },
                    nonCurrentAssets: {
                        items: nonCurrentAssetItems.sort((a, b) => a.code.localeCompare(b.code)),
                        total: totalNonCurrentAssets,
                    },
                    totalAssets,
                },
                liabilities: {
                    currentLiabilities: {
                        items: currentLiabilityItems.sort((a, b) => a.code.localeCompare(b.code)),
                        total: totalCurrentLiabilities,
                    },
                    nonCurrentLiabilities: {
                        items: nonCurrentLiabilityItems.sort((a, b) => a.code.localeCompare(b.code)),
                        total: totalNonCurrentLiabilities,
                    },
                    totalLiabilities,
                },
                equity: {
                    items: equityItems.sort((a, b) => a.code.localeCompare(b.code)),
                    totalEquity,
                },
                totalLiabilitiesAndEquity,
                isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01,
                generatedAt: new Date().toISOString(),
            },
        });
    } catch (error: any) {
        console.error('Generate balance sheet error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถสร้างงบแสดงฐานะการเงินได้',
        });
    }
});

/**
 * GET /api/reports/income-statement/html
 * Generate Income Statement HTML for printing
 */
router.get('/income-statement/html', async (req: AuthRequest, res: Response) => {
    try {
        const { clientId, periodStart, periodEnd, period } = req.query;

        // Reuse the JSON endpoint logic
        const jsonRes: any = {
            json: (data: any) => data,
            status: () => ({ json: (data: any) => data }),
        };

        // Get the data
        req.query = { clientId, periodStart, periodEnd, period };
        const result = await new Promise((resolve) => {
            const mockRes = {
                json: resolve,
                status: () => ({ json: resolve }),
            };
            // We'll generate inline for HTML
        });

        // Generate HTML directly
        const client = await prisma.client.findUnique({
            where: { id: clientId as string },
        });

        if (!client) {
            return res.status(404).send('ไม่พบลูกค้า');
        }

        // Get statement data (reusing logic from above)
        const dateFilter: any = { client_id: clientId as string };
        if (period) dateFilter.period = period;

        const entries = await prisma.gLEntry.groupBy({
            by: ['account_code', 'account_name'],
            where: dateFilter,
            _sum: { debit: true, credit: true },
        });

        // Process entries...
        let totalRevenue = 0, totalCostOfSales = 0, totalOperatingExpenses = 0;
        let otherIncome = 0, otherExpenses = 0;
        const revenueRows: string[] = [];
        const costRows: string[] = [];
        const expenseRows: string[] = [];

        entries.forEach(entry => {
            const accountType = getAccountType(entry.account_code);
            const debit = entry._sum.debit || 0;
            const credit = entry._sum.credit || 0;
            const balance = accountType === 'expense' ? debit - credit : credit - debit;
            const amount = Math.abs(balance);
            if (amount < 0.01) return;

            const row = `<tr><td style="padding-left: 20px;">${entry.account_name}</td><td style="text-align: right;">${formatCurrency(amount)}</td></tr>`;

            if (accountType === 'revenue') {
                if (entry.account_code.startsWith('49')) {
                    otherIncome += amount;
                } else {
                    revenueRows.push(row);
                    totalRevenue += amount;
                }
            } else if (accountType === 'expense') {
                if (entry.account_code.startsWith('51')) {
                    costRows.push(row);
                    totalCostOfSales += amount;
                } else if (entry.account_code.startsWith('59')) {
                    otherExpenses += amount;
                } else {
                    expenseRows.push(row);
                    totalOperatingExpenses += amount;
                }
            }
        });

        const grossProfit = totalRevenue - totalCostOfSales;
        const operatingProfit = grossProfit - totalOperatingExpenses;
        const profitBeforeTax = operatingProfit + otherIncome - otherExpenses;
        const incomeTaxExpense = profitBeforeTax > 0 ? profitBeforeTax * 0.20 : 0;
        const netProfit = profitBeforeTax - incomeTaxExpense;

        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>งบกำไรขาดทุน - ${client.name}</title>
    <style>
        body { font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; padding: 20px; }
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
    <h2>${client.name}</h2>
    <p style="text-align: center;">สำหรับงวด ${period || periodStart + ' ถึง ' + periodEnd}</p>

    <table>
        <tr class="section-header"><td>รายได้จากการขาย</td><td></td></tr>
        ${revenueRows.join('')}
        <tr class="total-row"><td>รวมรายได้</td><td style="text-align: right;">${formatCurrency(totalRevenue)}</td></tr>

        <tr class="section-header"><td>ต้นทุนขาย</td><td></td></tr>
        ${costRows.join('')}
        <tr class="total-row"><td>รวมต้นทุนขาย</td><td style="text-align: right;">(${formatCurrency(totalCostOfSales)})</td></tr>

        <tr class="total-row">
            <td>กำไรขั้นต้น</td>
            <td style="text-align: right;" class="${grossProfit >= 0 ? 'profit' : 'loss'}">${formatCurrency(grossProfit)}</td>
        </tr>

        <tr class="section-header"><td>ค่าใช้จ่ายในการดำเนินงาน</td><td></td></tr>
        ${expenseRows.join('')}
        <tr class="total-row"><td>รวมค่าใช้จ่ายในการดำเนินงาน</td><td style="text-align: right;">(${formatCurrency(totalOperatingExpenses)})</td></tr>

        <tr class="total-row">
            <td>กำไรจากการดำเนินงาน</td>
            <td style="text-align: right;" class="${operatingProfit >= 0 ? 'profit' : 'loss'}">${formatCurrency(operatingProfit)}</td>
        </tr>

        ${otherIncome > 0 ? `<tr><td style="padding-left: 20px;">รายได้อื่น</td><td style="text-align: right;">${formatCurrency(otherIncome)}</td></tr>` : ''}
        ${otherExpenses > 0 ? `<tr><td style="padding-left: 20px;">ค่าใช้จ่ายอื่น</td><td style="text-align: right;">(${formatCurrency(otherExpenses)})</td></tr>` : ''}

        <tr class="total-row">
            <td>กำไรก่อนภาษีเงินได้</td>
            <td style="text-align: right;" class="${profitBeforeTax >= 0 ? 'profit' : 'loss'}">${formatCurrency(profitBeforeTax)}</td>
        </tr>

        <tr><td style="padding-left: 20px;">ภาษีเงินได้นิติบุคคล (20%)</td><td style="text-align: right;">(${formatCurrency(incomeTaxExpense)})</td></tr>

        <tr class="grand-total">
            <td>กำไร (ขาดทุน) สุทธิ</td>
            <td style="text-align: right;" class="${netProfit >= 0 ? 'profit' : 'loss'}">${formatCurrency(netProfit)}</td>
        </tr>
    </table>

    <p style="text-align: right; font-size: 12px; margin-top: 30px;">
        สร้างเมื่อ: ${new Date().toLocaleString('th-TH')}
    </p>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    } catch (error: any) {
        console.error('Generate income statement HTML error:', error);
        res.status(500).send('ไม่สามารถสร้างงบกำไรขาดทุนได้');
    }
});

/**
 * GET /api/reports/summary
 * Get summary of financial data for dashboard
 */
router.get('/summary', async (req: AuthRequest, res: Response) => {
    try {
        const { clientId, period } = req.query;

        if (!clientId) {
            return res.status(400).json({
                success: false,
                error: 'กรุณาระบุ clientId',
            });
        }

        const where: any = { client_id: clientId as string };
        if (period) where.period = period;

        // Get totals by account type
        const entries = await prisma.gLEntry.groupBy({
            by: ['account_code'],
            where,
            _sum: {
                debit: true,
                credit: true,
            },
        });

        let totalRevenue = 0;
        let totalExpenses = 0;
        let totalAssets = 0;
        let totalLiabilities = 0;

        entries.forEach(entry => {
            const accountType = getAccountType(entry.account_code);
            const debit = entry._sum.debit || 0;
            const credit = entry._sum.credit || 0;

            switch (accountType) {
                case 'revenue':
                    totalRevenue += credit - debit;
                    break;
                case 'expense':
                    totalExpenses += debit - credit;
                    break;
                case 'asset':
                    totalAssets += debit - credit;
                    break;
                case 'liability':
                    totalLiabilities += credit - debit;
                    break;
            }
        });

        // Get document counts
        const documentStats = await prisma.document.groupBy({
            by: ['status'],
            where: { client_id: clientId as string },
            _count: true,
        });

        res.json({
            success: true,
            data: {
                financial: {
                    totalRevenue,
                    totalExpenses,
                    netProfit: totalRevenue - totalExpenses,
                    totalAssets,
                    totalLiabilities,
                },
                documents: documentStats.reduce((acc, s) => {
                    acc[s.status] = s._count;
                    return acc;
                }, {} as Record<string, number>),
                period: period || 'all',
            },
        });
    } catch (error: any) {
        console.error('Get financial summary error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถดึงข้อมูลสรุปได้',
        });
    }
});

// ============================================================================
// COMPARATIVE FINANCIAL STATEMENTS (FOR CPA AUDIT)
// ============================================================================

/**
 * GET /api/reports/income-statement/comparative
 * Generate Comparative Income Statement (Year-over-Year)
 * For CPA Audit Requirements
 */
router.get('/income-statement/comparative', async (req: AuthRequest, res: Response) => {
    try {
        const { clientId, currentYear, previousYear } = req.query;

        if (!clientId || !currentYear) {
            return res.status(400).json({
                success: false,
                error: 'กรุณาระบุ clientId และ currentYear',
            });
        }

        const client = await prisma.client.findUnique({
            where: { id: clientId as string },
        });

        if (!client) {
            return res.status(404).json({
                success: false,
                error: 'ไม่พบลูกค้า',
            });
        }

        const currYear = parseInt(currentYear as string);
        const prevYear = previousYear ? parseInt(previousYear as string) : currYear - 1;

        // Helper function to get income statement data for a year
        const getYearData = async (year: number) => {
            const yearStart = `${year}-01-01`;
            const yearEnd = `${year}-12-31`;

            const entries = await prisma.gLEntry.groupBy({
                by: ['account_code', 'account_name'],
                where: {
                    client_id: clientId as string,
                    date: {
                        gte: new Date(yearStart),
                        lte: new Date(yearEnd),
                    },
                },
                _sum: {
                    debit: true,
                    credit: true,
                },
            });

            let totalRevenue = 0;
            let totalCostOfSales = 0;
            let totalOperatingExpenses = 0;
            let otherIncome = 0;
            let otherExpenses = 0;

            const revenueItems: { code: string; name: string; amount: number }[] = [];
            const costItems: { code: string; name: string; amount: number }[] = [];
            const expenseItems: { code: string; name: string; amount: number }[] = [];

            entries.forEach(entry => {
                const accountType = getAccountType(entry.account_code);
                const debit = entry._sum.debit || 0;
                const credit = entry._sum.credit || 0;
                const balance = accountType === 'expense' ? debit - credit : credit - debit;
                const amount = Math.abs(balance);
                if (amount < 0.01) return;

                if (accountType === 'revenue') {
                    if (entry.account_code.startsWith('49')) {
                        otherIncome += amount;
                    } else {
                        revenueItems.push({ code: entry.account_code, name: entry.account_name, amount });
                        totalRevenue += amount;
                    }
                } else if (accountType === 'expense') {
                    if (entry.account_code.startsWith('51')) {
                        costItems.push({ code: entry.account_code, name: entry.account_name, amount });
                        totalCostOfSales += amount;
                    } else if (entry.account_code.startsWith('59')) {
                        otherExpenses += amount;
                    } else {
                        expenseItems.push({ code: entry.account_code, name: entry.account_name, amount });
                        totalOperatingExpenses += amount;
                    }
                }
            });

            const grossProfit = totalRevenue - totalCostOfSales;
            const operatingProfit = grossProfit - totalOperatingExpenses;
            const profitBeforeTax = operatingProfit + otherIncome - otherExpenses;
            const incomeTaxExpense = profitBeforeTax > 0 ? profitBeforeTax * 0.20 : 0;
            const netProfit = profitBeforeTax - incomeTaxExpense;

            return {
                year,
                revenueItems,
                totalRevenue,
                costItems,
                totalCostOfSales,
                grossProfit,
                expenseItems,
                totalOperatingExpenses,
                operatingProfit,
                otherIncome,
                otherExpenses,
                profitBeforeTax,
                incomeTaxExpense,
                netProfit,
            };
        };

        const currentYearData = await getYearData(currYear);
        const previousYearData = await getYearData(prevYear);

        // Calculate variances
        const variance = {
            totalRevenue: currentYearData.totalRevenue - previousYearData.totalRevenue,
            totalRevenuePercent: previousYearData.totalRevenue > 0
                ? ((currentYearData.totalRevenue - previousYearData.totalRevenue) / previousYearData.totalRevenue * 100)
                : 0,
            grossProfit: currentYearData.grossProfit - previousYearData.grossProfit,
            grossProfitPercent: previousYearData.grossProfit > 0
                ? ((currentYearData.grossProfit - previousYearData.grossProfit) / previousYearData.grossProfit * 100)
                : 0,
            netProfit: currentYearData.netProfit - previousYearData.netProfit,
            netProfitPercent: previousYearData.netProfit > 0
                ? ((currentYearData.netProfit - previousYearData.netProfit) / previousYearData.netProfit * 100)
                : 0,
            operatingProfit: currentYearData.operatingProfit - previousYearData.operatingProfit,
        };

        res.json({
            success: true,
            data: {
                clientId: client.id,
                clientName: client.name,
                reportTitle: 'งบกำไรขาดทุนเปรียบเทียบ (Comparative Income Statement)',
                currentYear: currentYearData,
                previousYear: previousYearData,
                variance,
                generatedAt: new Date().toISOString(),
            },
        });
    } catch (error: any) {
        console.error('Generate comparative income statement error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถสร้างงบกำไรขาดทุนเปรียบเทียบได้',
        });
    }
});

/**
 * GET /api/reports/balance-sheet/comparative
 * Generate Comparative Balance Sheet (Year-over-Year)
 */
router.get('/balance-sheet/comparative', async (req: AuthRequest, res: Response) => {
    try {
        const { clientId, currentYear, previousYear } = req.query;

        if (!clientId || !currentYear) {
            return res.status(400).json({
                success: false,
                error: 'กรุณาระบุ clientId และ currentYear',
            });
        }

        const client = await prisma.client.findUnique({
            where: { id: clientId as string },
        });

        if (!client) {
            return res.status(404).json({
                success: false,
                error: 'ไม่พบลูกค้า',
            });
        }

        const currYear = parseInt(currentYear as string);
        const prevYear = previousYear ? parseInt(previousYear as string) : currYear - 1;

        // Helper to get balance sheet data as of year-end
        const getYearEndData = async (year: number) => {
            const yearEnd = `${year}-12-31`;

            const entries = await prisma.gLEntry.groupBy({
                by: ['account_code', 'account_name'],
                where: {
                    client_id: clientId as string,
                    date: { lte: new Date(yearEnd) },
                },
                _sum: {
                    debit: true,
                    credit: true,
                },
            });

            let totalCurrentAssets = 0;
            let totalNonCurrentAssets = 0;
            let totalCurrentLiabilities = 0;
            let totalNonCurrentLiabilities = 0;
            let totalEquity = 0;
            let retainedEarnings = 0;

            const currentAssetItems: { code: string; name: string; amount: number }[] = [];
            const nonCurrentAssetItems: { code: string; name: string; amount: number }[] = [];
            const currentLiabilityItems: { code: string; name: string; amount: number }[] = [];
            const nonCurrentLiabilityItems: { code: string; name: string; amount: number }[] = [];
            const equityItems: { code: string; name: string; amount: number }[] = [];

            entries.forEach(entry => {
                const accountType = getAccountType(entry.account_code);
                const debit = entry._sum.debit || 0;
                const credit = entry._sum.credit || 0;
                let balance = accountType === 'asset' || accountType === 'expense' ? debit - credit : credit - debit;
                if (Math.abs(balance) < 0.01) return;

                const item = { code: entry.account_code, name: entry.account_name, amount: Math.abs(balance) };

                switch (accountType) {
                    case 'asset':
                        if (isCurrentAccount(entry.account_code)) {
                            currentAssetItems.push(item);
                            totalCurrentAssets += balance;
                        } else {
                            nonCurrentAssetItems.push(item);
                            totalNonCurrentAssets += balance;
                        }
                        break;
                    case 'liability':
                        if (isCurrentAccount(entry.account_code)) {
                            currentLiabilityItems.push(item);
                            totalCurrentLiabilities += balance;
                        } else {
                            nonCurrentLiabilityItems.push(item);
                            totalNonCurrentLiabilities += balance;
                        }
                        break;
                    case 'equity':
                        equityItems.push(item);
                        totalEquity += balance;
                        break;
                    case 'revenue':
                        retainedEarnings += balance;
                        break;
                    case 'expense':
                        retainedEarnings -= balance;
                        break;
                }
            });

            totalEquity += retainedEarnings;
            const totalAssets = totalCurrentAssets + totalNonCurrentAssets;
            const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;

            return {
                year,
                asOfDate: `${year}-12-31`,
                totalCurrentAssets,
                totalNonCurrentAssets,
                totalAssets,
                totalCurrentLiabilities,
                totalNonCurrentLiabilities,
                totalLiabilities,
                totalEquity,
                retainedEarnings,
                totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
                currentAssetItems,
                nonCurrentAssetItems,
                currentLiabilityItems,
                nonCurrentLiabilityItems,
                equityItems,
            };
        };

        const currentYearData = await getYearEndData(currYear);
        const previousYearData = await getYearEndData(prevYear);

        // Calculate key ratios and variances
        const analysis = {
            currentRatio: {
                current: currentYearData.totalCurrentLiabilities > 0
                    ? currentYearData.totalCurrentAssets / currentYearData.totalCurrentLiabilities : 0,
                previous: previousYearData.totalCurrentLiabilities > 0
                    ? previousYearData.totalCurrentAssets / previousYearData.totalCurrentLiabilities : 0,
            },
            debtToEquity: {
                current: currentYearData.totalEquity > 0
                    ? currentYearData.totalLiabilities / currentYearData.totalEquity : 0,
                previous: previousYearData.totalEquity > 0
                    ? previousYearData.totalLiabilities / previousYearData.totalEquity : 0,
            },
            assetGrowth: previousYearData.totalAssets > 0
                ? ((currentYearData.totalAssets - previousYearData.totalAssets) / previousYearData.totalAssets * 100) : 0,
            equityGrowth: previousYearData.totalEquity > 0
                ? ((currentYearData.totalEquity - previousYearData.totalEquity) / previousYearData.totalEquity * 100) : 0,
        };

        res.json({
            success: true,
            data: {
                clientId: client.id,
                clientName: client.name,
                reportTitle: 'งบแสดงฐานะการเงินเปรียบเทียบ (Comparative Balance Sheet)',
                currentYear: currentYearData,
                previousYear: previousYearData,
                analysis,
                generatedAt: new Date().toISOString(),
            },
        });
    } catch (error: any) {
        console.error('Generate comparative balance sheet error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถสร้างงบแสดงฐานะการเงินเปรียบเทียบได้',
        });
    }
});

/**
 * GET /api/reports/multi-year-analysis
 * Get multi-year financial trends (3-5 years)
 */
router.get('/multi-year-analysis', async (req: AuthRequest, res: Response) => {
    try {
        const { clientId, years = '5' } = req.query;

        if (!clientId) {
            return res.status(400).json({
                success: false,
                error: 'กรุณาระบุ clientId',
            });
        }

        const client = await prisma.client.findUnique({
            where: { id: clientId as string },
        });

        if (!client) {
            return res.status(404).json({
                success: false,
                error: 'ไม่พบลูกค้า',
            });
        }

        const currentYear = new Date().getFullYear();
        const numYears = Math.min(parseInt(years as string), 10);
        const yearList = Array.from({ length: numYears }, (_, i) => currentYear - i).reverse();

        // Get yearly summaries
        const yearlyData = await Promise.all(
            yearList.map(async (year) => {
                const yearStart = `${year}-01-01`;
                const yearEnd = `${year}-12-31`;

                const entries = await prisma.gLEntry.groupBy({
                    by: ['account_code'],
                    where: {
                        client_id: clientId as string,
                        date: {
                            gte: new Date(yearStart),
                            lte: new Date(yearEnd),
                        },
                    },
                    _sum: {
                        debit: true,
                        credit: true,
                    },
                });

                let totalRevenue = 0;
                let totalExpenses = 0;
                let totalAssets = 0;
                let totalLiabilities = 0;

                entries.forEach(e => {
                    const type = getAccountType(e.account_code);
                    const debit = e._sum.debit || 0;
                    const credit = e._sum.credit || 0;

                    switch (type) {
                        case 'revenue': totalRevenue += credit - debit; break;
                        case 'expense': totalExpenses += debit - credit; break;
                        case 'asset': totalAssets += debit - credit; break;
                        case 'liability': totalLiabilities += credit - debit; break;
                    }
                });

                const netProfit = totalRevenue - totalExpenses;
                const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue * 100) : 0;

                return {
                    year,
                    totalRevenue,
                    totalExpenses,
                    netProfit,
                    profitMargin: Math.round(profitMargin * 100) / 100,
                    totalAssets,
                    totalLiabilities,
                    equity: totalAssets - totalLiabilities,
                };
            })
        );

        // Calculate trends (CAGR, averages)
        const firstYear = yearlyData[0];
        const lastYear = yearlyData[yearlyData.length - 1];
        const yearsSpan = numYears - 1;

        const trends = {
            revenueCAGR: firstYear.totalRevenue > 0 && yearsSpan > 0
                ? (Math.pow(lastYear.totalRevenue / firstYear.totalRevenue, 1 / yearsSpan) - 1) * 100
                : 0,
            profitCAGR: firstYear.netProfit > 0 && yearsSpan > 0
                ? (Math.pow(Math.max(lastYear.netProfit, 1) / Math.max(firstYear.netProfit, 1), 1 / yearsSpan) - 1) * 100
                : 0,
            avgProfitMargin: yearlyData.reduce((sum, y) => sum + y.profitMargin, 0) / numYears,
            avgRevenue: yearlyData.reduce((sum, y) => sum + y.totalRevenue, 0) / numYears,
        };

        res.json({
            success: true,
            data: {
                clientId: client.id,
                clientName: client.name,
                reportTitle: 'การวิเคราะห์แนวโน้มหลายปี (Multi-Year Trend Analysis)',
                yearlyData,
                trends: {
                    revenueCAGR: Math.round(trends.revenueCAGR * 100) / 100,
                    profitCAGR: Math.round(trends.profitCAGR * 100) / 100,
                    avgProfitMargin: Math.round(trends.avgProfitMargin * 100) / 100,
                    avgRevenue: Math.round(trends.avgRevenue * 100) / 100,
                },
                generatedAt: new Date().toISOString(),
            },
        });
    } catch (error: any) {
        console.error('Get multi-year analysis error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถสร้างการวิเคราะห์หลายปีได้',
        });
    }
});

/**
 * GET /api/reports/available-years
 * Get list of years with data for a client
 */
router.get('/available-years', async (req: AuthRequest, res: Response) => {
    try {
        const { clientId } = req.query;

        if (!clientId) {
            return res.status(400).json({
                success: false,
                error: 'กรุณาระบุ clientId',
            });
        }

        const entries = await prisma.gLEntry.findMany({
            where: { client_id: clientId as string },
            select: { year: true },
            distinct: ['year'],
            orderBy: { year: 'desc' },
        });

        const years = entries.map(e => e.year);

        res.json({
            success: true,
            data: {
                clientId,
                years,
                currentYear: new Date().getFullYear(),
            },
        });
    } catch (error: any) {
        console.error('Get available years error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถดึงรายการปีได้',
        });
    }
});

export { router as reportsRouter };


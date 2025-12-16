/**
 * GL Entry Routes
 * CRUD operations for General Ledger entries
 */

import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, requireClientAccess } from '../middleware/auth';

const router = Router();

/**
 * GET /api/gl
 * Get GL entries (paginated, filtered)
 */
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { clientId, period, account_code, limit = '100', offset = '0' } = req.query;
        const user = req.user!;

        // Build where clause
        const where: any = {};

        if (clientId) {
            where.client_id = clientId;
        } else if (!['admin', 'manager'].includes(user.role)) {
            where.client_id = { in: user.assignedClients };
        }

        if (period) {
            where.period = period;
        }

        if (account_code) {
            where.account_code = { startsWith: account_code as string };
        }

        const [entries, total] = await Promise.all([
            prisma.gLEntry.findMany({
                where,
                orderBy: { date: 'desc' },
                take: parseInt(limit as string),
                skip: parseInt(offset as string),
                include: {
                    client: {
                        select: { id: true, name: true },
                    },
                },
            }),
            prisma.gLEntry.count({ where }),
        ]);

        res.json({
            success: true,
            data: entries,
            pagination: {
                total,
                limit: parseInt(limit as string),
                offset: parseInt(offset as string),
            },
        });
    } catch (error: any) {
        console.error('Get GL entries error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถดึงข้อมูลบัญชีได้',
        });
    }
});

/**
 * GET /api/gl/trial-balance
 * Get trial balance for a period
 */
router.get('/trial-balance', async (req: AuthRequest, res: Response) => {
    try {
        const { clientId, period } = req.query;

        if (!clientId || !period) {
            return res.status(400).json({
                success: false,
                error: 'กรุณาระบุ clientId และ period',
            });
        }

        // Group by account_code and sum debits/credits
        const entries = await prisma.gLEntry.groupBy({
            by: ['account_code', 'account_name'],
            where: {
                client_id: clientId as string,
                period: period as string,
            },
            _sum: {
                debit: true,
                credit: true,
            },
        });

        const trialBalance = entries.map(e => ({
            account_code: e.account_code,
            account_name: e.account_name,
            debit: e._sum.debit || 0,
            credit: e._sum.credit || 0,
            balance: (e._sum.debit || 0) - (e._sum.credit || 0),
        }));

        // Calculate totals
        const totalDebit = trialBalance.reduce((sum, e) => sum + e.debit, 0);
        const totalCredit = trialBalance.reduce((sum, e) => sum + e.credit, 0);

        res.json({
            success: true,
            data: {
                entries: trialBalance.sort((a, b) => a.account_code.localeCompare(b.account_code)),
                totals: {
                    debit: totalDebit,
                    credit: totalCredit,
                    balanced: Math.abs(totalDebit - totalCredit) < 0.01,
                },
            },
        });
    } catch (error: any) {
        console.error('Get trial balance error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถสร้างงบทดลองได้',
        });
    }
});

/**
 * POST /api/gl
 * Create GL entry
 */
router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const {
            client_id,
            date,
            entries, // Array of { account_code, account_name, debit, credit, description }
            source_doc_id,
            journal_ref,
        } = req.body;

        if (!client_id || !date || !entries || !Array.isArray(entries)) {
            return res.status(400).json({
                success: false,
                error: 'ข้อมูลไม่ครบถ้วน',
            });
        }

        // Validate balance
        const totalDebit = entries.reduce((sum: number, e: any) => sum + (e.debit || 0), 0);
        const totalCredit = entries.reduce((sum: number, e: any) => sum + (e.credit || 0), 0);

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            return res.status(400).json({
                success: false,
                error: 'เดบิตและเครดิตไม่เท่ากัน',
                details: { totalDebit, totalCredit },
            });
        }

        const entryDate = new Date(date);
        const year = entryDate.getFullYear();
        const month = String(entryDate.getMonth() + 1).padStart(2, '0');
        const period = `${year}-${month}`;

        // Create all entries in a transaction
        const createdEntries = await prisma.$transaction(
            entries.map((entry: any) =>
                prisma.gLEntry.create({
                    data: {
                        client_id,
                        date: entryDate,
                        account_code: entry.account_code,
                        account_name: entry.account_name,
                        debit: entry.debit || 0,
                        credit: entry.credit || 0,
                        description: entry.description,
                        source_doc_id,
                        journal_ref,
                        year,
                        month,
                        period,
                        posted_by: req.user!.uid,
                    },
                })
            )
        );

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: 'CREATE',
                entity_type: 'gl_entry',
                entity_id: createdEntries[0].id,
                user_id: req.user!.uid,
                user_email: req.user!.email,
                details: { client_id, entries_count: entries.length, total: totalDebit },
            },
        });

        res.status(201).json({
            success: true,
            data: createdEntries,
        });
    } catch (error: any) {
        console.error('Create GL entry error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถบันทึกรายการบัญชีได้',
        });
    }
});

/**
 * DELETE /api/gl/:id
 * Delete GL entry
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        await prisma.gLEntry.delete({
            where: { id },
        });

        res.json({
            success: true,
            message: 'ลบรายการบัญชีสำเร็จ',
        });
    } catch (error: any) {
        console.error('Delete GL entry error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถลบรายการบัญชีได้',
        });
    }
});

export { router as glRouter };

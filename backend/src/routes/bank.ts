/**
 * Bank Transactions Routes
 * CRUD operations for bank transactions and reconciliation
 */

import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, requireClientAccess } from '../middleware/auth';

const router = Router();

/**
 * GET /api/bank
 * Get bank transactions (filtered)
 */
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { clientId, status, year, month, limit = '100', offset = '0' } = req.query;
        const user = req.user!;

        const where: any = {};

        if (clientId) {
            where.client_id = clientId;
        } else if (!['admin', 'manager'].includes(user.role)) {
            where.client_id = { in: user.assignedClients };
        }

        if (status) where.status = status;
        if (year) where.year = parseInt(year as string);
        if (month) where.month = month;

        const [transactions, total] = await Promise.all([
            prisma.bankTransaction.findMany({
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
            prisma.bankTransaction.count({ where }),
        ]);

        res.json({
            success: true,
            data: transactions,
            pagination: {
                total,
                limit: parseInt(limit as string),
                offset: parseInt(offset as string),
            },
        });
    } catch (error: any) {
        console.error('Get bank transactions error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถดึงข้อมูลธุรกรรมธนาคารได้',
        });
    }
});

/**
 * POST /api/bank
 * Create bank transaction
 */
router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const {
            client_id,
            date,
            description,
            amount,
            balance,
            bank_account,
            transaction_type,
            reference,
        } = req.body;

        if (!client_id || !date || !description || amount === undefined) {
            return res.status(400).json({
                success: false,
                error: 'ข้อมูลไม่ครบถ้วน',
            });
        }

        const transactionDate = new Date(date);
        const year = transactionDate.getFullYear();
        const month = String(transactionDate.getMonth() + 1).padStart(2, '0');

        const transaction = await prisma.bankTransaction.create({
            data: {
                client_id,
                date: transactionDate,
                description,
                amount,
                balance,
                bank_account,
                transaction_type,
                reference,
                year,
                month,
            },
        });

        res.status(201).json({
            success: true,
            data: transaction,
        });
    } catch (error: any) {
        console.error('Create bank transaction error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถสร้างธุรกรรมธนาคารได้',
        });
    }
});

/**
 * POST /api/bank/import
 * Import multiple bank transactions
 */
router.post('/import', async (req: AuthRequest, res: Response) => {
    try {
        const { client_id, transactions } = req.body;

        if (!client_id || !transactions || !Array.isArray(transactions)) {
            return res.status(400).json({
                success: false,
                error: 'ข้อมูลไม่ครบถ้วน',
            });
        }

        const created = await prisma.$transaction(
            transactions.map((tx: any) => {
                const txDate = new Date(tx.date);
                return prisma.bankTransaction.create({
                    data: {
                        client_id,
                        date: txDate,
                        description: tx.description,
                        amount: tx.amount,
                        balance: tx.balance,
                        bank_account: tx.bank_account,
                        transaction_type: tx.transaction_type,
                        reference: tx.reference,
                        year: txDate.getFullYear(),
                        month: String(txDate.getMonth() + 1).padStart(2, '0'),
                    },
                });
            })
        );

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: 'IMPORT',
                entity_type: 'bank_transaction',
                user_id: req.user!.uid,
                user_email: req.user!.email,
                details: { client_id, count: transactions.length },
            },
        });

        res.status(201).json({
            success: true,
            data: created,
            count: created.length,
        });
    } catch (error: any) {
        console.error('Import bank transactions error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถนำเข้าธุรกรรมธนาคารได้',
        });
    }
});

/**
 * POST /api/bank/:id/match
 * Match bank transaction with document
 */
router.post('/:id/match', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { documentId } = req.body;

        const transaction = await prisma.bankTransaction.update({
            where: { id },
            data: {
                status: 'matched',
                matched_doc_id: documentId,
            },
        });

        res.json({
            success: true,
            data: transaction,
        });
    } catch (error: any) {
        console.error('Match transaction error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถจับคู่ธุรกรรมได้',
        });
    }
});

/**
 * POST /api/bank/:id/reconcile
 * Mark transaction as reconciled
 */
router.post('/:id/reconcile', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const transaction = await prisma.bankTransaction.update({
            where: { id },
            data: {
                status: 'reconciled',
            },
        });

        res.json({
            success: true,
            data: transaction,
        });
    } catch (error: any) {
        console.error('Reconcile transaction error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถกระทบยอดธุรกรรมได้',
        });
    }
});

/**
 * GET /api/bank/summary
 * Get bank reconciliation summary
 */
router.get('/summary', async (req: AuthRequest, res: Response) => {
    try {
        const { clientId, year, month } = req.query;

        if (!clientId) {
            return res.status(400).json({
                success: false,
                error: 'กรุณาระบุ clientId',
            });
        }

        const where: any = { client_id: clientId };
        if (year) where.year = parseInt(year as string);
        if (month) where.month = month;

        const [unmatched, matched, reconciled, totals] = await Promise.all([
            prisma.bankTransaction.count({ where: { ...where, status: 'unmatched' } }),
            prisma.bankTransaction.count({ where: { ...where, status: 'matched' } }),
            prisma.bankTransaction.count({ where: { ...where, status: 'reconciled' } }),
            prisma.bankTransaction.aggregate({
                where,
                _sum: { amount: true },
                _count: true,
            }),
        ]);

        res.json({
            success: true,
            data: {
                unmatched,
                matched,
                reconciled,
                total_transactions: totals._count,
                total_amount: totals._sum.amount || 0,
            },
        });
    } catch (error: any) {
        console.error('Get bank summary error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถดึงข้อมูลสรุปได้',
        });
    }
});

/**
 * DELETE /api/bank/:id
 * Delete bank transaction
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        await prisma.bankTransaction.delete({
            where: { id },
        });

        res.json({
            success: true,
            message: 'ลบธุรกรรมธนาคารสำเร็จ',
        });
    } catch (error: any) {
        console.error('Delete bank transaction error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถลบธุรกรรมธนาคารได้',
        });
    }
});

export { router as bankRouter };

/**
 * Period Closing Routes
 * Month-end closing, period locking, balance verification
 */

import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

/**
 * GET /api/period/status
 * Get period closing status for a client
 */
router.get('/status', async (req: AuthRequest, res: Response) => {
    try {
        const { clientId, period } = req.query;

        if (!clientId) {
            return res.status(400).json({
                success: false,
                error: 'กรุณาระบุ clientId',
            });
        }

        const client = await prisma.client.findUnique({
            where: { id: clientId as string },
            select: {
                id: true,
                name: true,
                current_month: true,
                vat_status: true,
                wht_status: true,
                closing_status: true,
            },
        });

        if (!client) {
            return res.status(404).json({
                success: false,
                error: 'ไม่พบลูกค้า',
            });
        }

        // Get document counts by status for the period
        const documentStats = await prisma.document.groupBy({
            by: ['status'],
            where: {
                client_id: clientId as string,
                period: period as string || client.current_month,
            },
            _count: true,
        });

        // Get unreconciled bank transactions
        const unreconciledBank = await prisma.bankTransaction.count({
            where: {
                client_id: clientId as string,
                status: { not: 'reconciled' },
            },
        });

        // Calculate completeness
        const docStats = documentStats.reduce((acc, s) => {
            acc[s.status] = s._count;
            return acc;
        }, {} as Record<string, number>);

        const totalDocs = Object.values(docStats).reduce((a, b) => a + b, 0);
        const pendingDocs = docStats['pending_review'] || 0;
        const rejectedDocs = docStats['rejected'] || 0;
        const isDocComplete = pendingDocs === 0 && rejectedDocs === 0;

        res.json({
            success: true,
            data: {
                clientId: client.id,
                clientName: client.name,
                currentPeriod: period || client.current_month,
                periodStatus: {
                    vat: client.vat_status,
                    wht: client.wht_status,
                    closing: client.closing_status,
                },
                documents: {
                    total: totalDocs,
                    pending: pendingDocs,
                    rejected: rejectedDocs,
                    approved: docStats['approved'] || 0,
                    posted: docStats['posted'] || 0,
                    isComplete: isDocComplete,
                },
                bank: {
                    unreconciledCount: unreconciledBank,
                    isComplete: unreconciledBank === 0,
                },
                canClose: isDocComplete && unreconciledBank === 0,
            },
        });
    } catch (error: any) {
        console.error('Get period status error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถดึงสถานะงวดได้',
        });
    }
});

/**
 * POST /api/period/close
 * Close a period (lock from further changes)
 */
router.post('/close', requireRole(['admin', 'manager']), async (req: AuthRequest, res: Response) => {
    try {
        const { clientId, period } = req.body;

        if (!clientId || !period) {
            return res.status(400).json({
                success: false,
                error: 'กรุณาระบุ clientId และ period',
            });
        }

        // Check for pending documents
        const pendingDocs = await prisma.document.count({
            where: {
                client_id: clientId,
                period,
                status: 'pending_review',
            },
        });

        if (pendingDocs > 0) {
            return res.status(400).json({
                success: false,
                error: `ยังมีเอกสารรอตรวจสอบ ${pendingDocs} รายการ`,
            });
        }

        // Update client closing status
        const client = await prisma.client.update({
            where: { id: clientId },
            data: {
                closing_status: 'closed',
                current_month: getNextPeriod(period),
            },
        });

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: 'CLOSE_PERIOD',
                entity_type: 'client',
                entity_id: clientId,
                user_id: req.user!.uid,
                user_email: req.user!.email,
                details: { period, closed_at: new Date().toISOString() },
            },
        });

        res.json({
            success: true,
            message: `ปิดงวด ${period} สำเร็จ`,
            data: {
                clientId: client.id,
                closedPeriod: period,
                nextPeriod: client.current_month,
            },
        });
    } catch (error: any) {
        console.error('Close period error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถปิดงวดได้',
        });
    }
});

/**
 * POST /api/period/reopen
 * Reopen a closed period (admin only)
 */
router.post('/reopen', requireRole(['admin']), async (req: AuthRequest, res: Response) => {
    try {
        const { clientId, period, reason } = req.body;

        if (!clientId || !period || !reason) {
            return res.status(400).json({
                success: false,
                error: 'กรุณาระบุ clientId, period และเหตุผล',
            });
        }

        const client = await prisma.client.update({
            where: { id: clientId },
            data: {
                closing_status: 'pending',
                current_month: period,
            },
        });

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: 'REOPEN_PERIOD',
                entity_type: 'client',
                entity_id: clientId,
                user_id: req.user!.uid,
                user_email: req.user!.email,
                details: { period, reason, reopened_at: new Date().toISOString() },
            },
        });

        res.json({
            success: true,
            message: `เปิดงวด ${period} อีกครั้งสำเร็จ`,
            data: { clientId: client.id, period },
        });
    } catch (error: any) {
        console.error('Reopen period error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถเปิดงวดได้',
        });
    }
});

/**
 * GET /api/period/balance-check
 * Verify trial balance is balanced for a period
 */
router.get('/balance-check', async (req: AuthRequest, res: Response) => {
    try {
        const { clientId, period } = req.query;

        if (!clientId || !period) {
            return res.status(400).json({
                success: false,
                error: 'กรุณาระบุ clientId และ period',
            });
        }

        // Get GL totals
        const result = await prisma.gLEntry.aggregate({
            where: {
                client_id: clientId as string,
                period: period as string,
            },
            _sum: {
                debit: true,
                credit: true,
            },
        });

        const totalDebit = result._sum.debit || 0;
        const totalCredit = result._sum.credit || 0;
        const difference = Math.abs(totalDebit - totalCredit);
        const isBalanced = difference < 0.01;

        res.json({
            success: true,
            data: {
                clientId,
                period,
                totals: {
                    debit: totalDebit,
                    credit: totalCredit,
                    difference,
                },
                isBalanced,
                message: isBalanced ? 'เดบิตและเครดิตสมดุล' : 'ยอดไม่สมดุล กรุณาตรวจสอบ',
            },
        });
    } catch (error: any) {
        console.error('Balance check error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถตรวจสอบยอดได้',
        });
    }
});

/**
 * GET /api/period/history
 * Get closing history for a client
 */
router.get('/history', async (req: AuthRequest, res: Response) => {
    try {
        const { clientId, limit = '12' } = req.query;

        if (!clientId) {
            return res.status(400).json({
                success: false,
                error: 'กรุณาระบุ clientId',
            });
        }

        const history = await prisma.activityLog.findMany({
            where: {
                entity_type: 'client',
                entity_id: clientId as string,
                action: { in: ['CLOSE_PERIOD', 'REOPEN_PERIOD'] },
            },
            orderBy: { timestamp: 'desc' },
            take: parseInt(limit as string),
        });

        res.json({
            success: true,
            data: history,
        });
    } catch (error: any) {
        console.error('Get history error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถดึงประวัติได้',
        });
    }
});

// Helper: Get next period
function getNextPeriod(period: string): string {
    const [year, month] = period.split('-').map(Number);
    const nextMonth = month + 1;
    if (nextMonth > 12) {
        return `${year + 1}-01`;
    }
    return `${year}-${String(nextMonth).padStart(2, '0')}`;
}

export { router as periodRouter };

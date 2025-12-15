/**
 * Activity Logs Routes
 * CRUD operations for activity/audit logs
 */

import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

/**
 * GET /api/activity-logs
 * Get activity logs (paginated)
 */
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const {
            limit = '50',
            offset = '0',
            entity_type,
            entity_id,
            user_id,
            action
        } = req.query;

        // Build where clause
        const where: any = {};

        if (entity_type) {
            where.entity_type = entity_type;
        }

        if (entity_id) {
            where.entity_id = entity_id;
        }

        if (user_id) {
            where.user_id = user_id;
        }

        if (action) {
            where.action = action;
        }

        const [logs, total] = await Promise.all([
            prisma.activityLog.findMany({
                where,
                orderBy: { timestamp: 'desc' },
                take: parseInt(limit as string),
                skip: parseInt(offset as string),
            }),
            prisma.activityLog.count({ where }),
        ]);

        res.json({
            success: true,
            data: logs,
            pagination: {
                total,
                limit: parseInt(limit as string),
                offset: parseInt(offset as string),
            },
        });
    } catch (error: any) {
        console.error('Get activity logs error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถดึงข้อมูล logs ได้',
        });
    }
});

/**
 * POST /api/activity-logs
 * Create activity log
 */
router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const {
            action,
            entity_type,
            entity_id,
            details,
        } = req.body;

        if (!action || !entity_type) {
            return res.status(400).json({
                success: false,
                error: 'กรุณาระบุ action และ entity_type',
            });
        }

        const log = await prisma.activityLog.create({
            data: {
                action,
                entity_type,
                entity_id,
                user_id: req.user?.uid,
                user_email: req.user?.email,
                details,
                ip_address: req.ip,
            },
        });

        res.status(201).json({
            success: true,
            data: log,
        });
    } catch (error: any) {
        console.error('Create activity log error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถสร้าง log ได้',
        });
    }
});

/**
 * GET /api/activity-logs/entity/:entityType/:entityId
 * Get logs for a specific entity
 */
router.get('/entity/:entityType/:entityId', async (req: AuthRequest, res: Response) => {
    try {
        const { entityType, entityId } = req.params;
        const { limit = '20' } = req.query;

        const logs = await prisma.activityLog.findMany({
            where: {
                entity_type: entityType,
                entity_id: entityId,
            },
            orderBy: { timestamp: 'desc' },
            take: parseInt(limit as string),
        });

        res.json({
            success: true,
            data: logs,
        });
    } catch (error: any) {
        console.error('Get entity logs error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถดึงข้อมูล logs ได้',
        });
    }
});

/**
 * GET /api/activity-logs/user/:userId
 * Get logs for a specific user
 */
router.get('/user/:userId', requireRole(['admin', 'manager']), async (req: AuthRequest, res: Response) => {
    try {
        const { userId } = req.params;
        const { limit = '50' } = req.query;

        const logs = await prisma.activityLog.findMany({
            where: {
                user_id: userId,
            },
            orderBy: { timestamp: 'desc' },
            take: parseInt(limit as string),
        });

        res.json({
            success: true,
            data: logs,
        });
    } catch (error: any) {
        console.error('Get user logs error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถดึงข้อมูล logs ได้',
        });
    }
});

export { router as activityLogsRouter };

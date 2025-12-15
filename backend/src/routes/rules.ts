/**
 * Vendor Rules Routes
 * CRUD operations for vendor auto-categorization rules
 */

import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, requireClientAccess } from '../middleware/auth';

const router = Router();

/**
 * GET /api/rules
 * Get vendor rules (filtered by client)
 */
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { clientId, is_active } = req.query;
        const user = req.user!;

        const where: any = {};

        // Get rules for specific client or global rules (client_id = null)
        if (clientId) {
            where.OR = [
                { client_id: clientId },
                { client_id: null }, // Global rules
            ];
        } else if (!['admin', 'manager'].includes(user.role)) {
            where.OR = [
                { client_id: { in: user.assignedClients } },
                { client_id: null },
            ];
        }

        if (is_active !== undefined) {
            where.is_active = is_active === 'true';
        }

        const rules = await prisma.vendorRule.findMany({
            where,
            orderBy: { created_at: 'desc' },
            include: {
                client: {
                    select: { id: true, name: true },
                },
            },
        });

        res.json({
            success: true,
            data: rules,
        });
    } catch (error: any) {
        console.error('Get vendor rules error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถดึงข้อมูล vendor rules ได้',
        });
    }
});

/**
 * POST /api/rules
 * Create vendor rule
 */
router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const {
            client_id, // null = global rule
            vendor_pattern,
            default_account,
            default_doc_type,
            wht_rate,
            description,
        } = req.body;

        if (!vendor_pattern || !default_account) {
            return res.status(400).json({
                success: false,
                error: 'กรุณาระบุ vendor_pattern และ default_account',
            });
        }

        const rule = await prisma.vendorRule.create({
            data: {
                client_id,
                vendor_pattern,
                default_account,
                default_doc_type,
                wht_rate,
                description,
            },
        });

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: 'CREATE',
                entity_type: 'vendor_rule',
                entity_id: rule.id,
                user_id: req.user!.uid,
                user_email: req.user!.email,
                details: { vendor_pattern, default_account },
            },
        });

        res.status(201).json({
            success: true,
            data: rule,
        });
    } catch (error: any) {
        console.error('Create vendor rule error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถสร้าง vendor rule ได้',
        });
    }
});

/**
 * PUT /api/rules/:id
 * Update vendor rule
 */
router.put('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        delete updateData.id;
        delete updateData.created_at;

        const rule = await prisma.vendorRule.update({
            where: { id },
            data: updateData,
        });

        res.json({
            success: true,
            data: rule,
        });
    } catch (error: any) {
        console.error('Update vendor rule error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถอัพเดท vendor rule ได้',
        });
    }
});

/**
 * POST /api/rules/match
 * Find matching rule for a vendor name
 */
router.post('/match', async (req: AuthRequest, res: Response) => {
    try {
        const { vendorName, clientId } = req.body;

        if (!vendorName) {
            return res.status(400).json({
                success: false,
                error: 'กรุณาระบุ vendorName',
            });
        }

        // Get all applicable rules
        const rules = await prisma.vendorRule.findMany({
            where: {
                is_active: true,
                OR: [
                    { client_id: clientId },
                    { client_id: null },
                ],
            },
            orderBy: [
                { client_id: 'desc' }, // Client-specific rules first
                { created_at: 'desc' },
            ],
        });

        // Find first matching rule
        const vendorLower = vendorName.toLowerCase();
        const matchedRule = rules.find(rule => {
            const pattern = rule.vendor_pattern.toLowerCase();
            // Simple pattern matching (contains)
            if (vendorLower.includes(pattern)) return true;
            // Try as regex
            try {
                const regex = new RegExp(pattern, 'i');
                return regex.test(vendorName);
            } catch {
                return false;
            }
        });

        res.json({
            success: true,
            matched: !!matchedRule,
            data: matchedRule || null,
        });
    } catch (error: any) {
        console.error('Match vendor rule error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถค้นหา vendor rule ได้',
        });
    }
});

/**
 * DELETE /api/rules/:id
 * Delete vendor rule
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        await prisma.vendorRule.delete({
            where: { id },
        });

        res.json({
            success: true,
            message: 'ลบ vendor rule สำเร็จ',
        });
    } catch (error: any) {
        console.error('Delete vendor rule error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถลบ vendor rule ได้',
        });
    }
});

export { router as rulesRouter };

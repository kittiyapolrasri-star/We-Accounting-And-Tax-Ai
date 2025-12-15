/**
 * Fixed Assets Routes
 * CRUD operations for fixed assets and depreciation
 */

import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, requireClientAccess } from '../middleware/auth';

const router = Router();

/**
 * GET /api/assets
 * Get all assets (filtered by client)
 */
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { clientId, status, category } = req.query;
        const user = req.user!;

        const where: any = {};

        if (clientId) {
            where.client_id = clientId;
        } else if (!['admin', 'manager'].includes(user.role)) {
            where.client_id = { in: user.assignedClients };
        }

        if (status) where.status = status;
        if (category) where.category = category;

        const assets = await prisma.fixedAsset.findMany({
            where,
            orderBy: { purchase_date: 'desc' },
            include: {
                client: {
                    select: { id: true, name: true },
                },
            },
        });

        res.json({
            success: true,
            data: assets,
        });
    } catch (error: any) {
        console.error('Get assets error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถดึงข้อมูลสินทรัพย์ได้',
        });
    }
});

/**
 * GET /api/assets/:id
 * Get single asset
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const asset = await prisma.fixedAsset.findUnique({
            where: { id },
            include: {
                client: {
                    select: { id: true, name: true },
                },
            },
        });

        if (!asset) {
            return res.status(404).json({
                success: false,
                error: 'ไม่พบสินทรัพย์',
            });
        }

        res.json({
            success: true,
            data: asset,
        });
    } catch (error: any) {
        console.error('Get asset error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถดึงข้อมูลสินทรัพย์ได้',
        });
    }
});

/**
 * POST /api/assets
 * Create new asset
 */
router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const {
            client_id,
            name,
            asset_code,
            category,
            purchase_date,
            purchase_value,
            useful_life,
            salvage_value = 0,
            depreciation_method = 'straight_line',
        } = req.body;

        if (!client_id || !name || !purchase_date || !purchase_value || !useful_life) {
            return res.status(400).json({
                success: false,
                error: 'ข้อมูลไม่ครบถ้วน',
            });
        }

        const asset = await prisma.fixedAsset.create({
            data: {
                client_id,
                name,
                asset_code,
                category,
                purchase_date: new Date(purchase_date),
                purchase_value,
                useful_life,
                salvage_value,
                depreciation_method,
            },
        });

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: 'CREATE',
                entity_type: 'fixed_asset',
                entity_id: asset.id,
                user_id: req.user!.uid,
                user_email: req.user!.email,
                details: { name, purchase_value },
            },
        });

        res.status(201).json({
            success: true,
            data: asset,
        });
    } catch (error: any) {
        console.error('Create asset error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถสร้างสินทรัพย์ได้',
        });
    }
});

/**
 * PUT /api/assets/:id
 * Update asset
 */
router.put('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        delete updateData.id;
        delete updateData.created_at;

        if (updateData.purchase_date) {
            updateData.purchase_date = new Date(updateData.purchase_date);
        }
        if (updateData.disposal_date) {
            updateData.disposal_date = new Date(updateData.disposal_date);
        }

        const asset = await prisma.fixedAsset.update({
            where: { id },
            data: updateData,
        });

        res.json({
            success: true,
            data: asset,
        });
    } catch (error: any) {
        console.error('Update asset error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถอัพเดทสินทรัพย์ได้',
        });
    }
});

/**
 * POST /api/assets/:id/depreciate
 * Calculate and record depreciation
 */
router.post('/:id/depreciate', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { period } = req.body; // Format: YYYY-MM

        const asset = await prisma.fixedAsset.findUnique({
            where: { id },
        });

        if (!asset) {
            return res.status(404).json({
                success: false,
                error: 'ไม่พบสินทรัพย์',
            });
        }

        if (asset.status !== 'active') {
            return res.status(400).json({
                success: false,
                error: 'สินทรัพย์ไม่อยู่ในสถานะใช้งาน',
            });
        }

        // Calculate monthly depreciation (straight-line)
        const depreciableValue = asset.purchase_value - asset.salvage_value;
        const monthlyDepreciation = depreciableValue / asset.useful_life;

        // Check if fully depreciated
        const newAccumulatedDep = asset.accumulated_depreciation + monthlyDepreciation;
        const maxDepreciation = depreciableValue;

        const actualDepreciation = Math.min(monthlyDepreciation, maxDepreciation - asset.accumulated_depreciation);

        if (actualDepreciation <= 0) {
            return res.status(400).json({
                success: false,
                error: 'สินทรัพย์หักค่าเสื่อมครบแล้ว',
            });
        }

        // Update accumulated depreciation
        const updatedAsset = await prisma.fixedAsset.update({
            where: { id },
            data: {
                accumulated_depreciation: asset.accumulated_depreciation + actualDepreciation,
                status: newAccumulatedDep >= maxDepreciation ? 'fully_depreciated' : 'active',
            },
        });

        res.json({
            success: true,
            data: {
                asset: updatedAsset,
                depreciation: {
                    amount: actualDepreciation,
                    period,
                    method: asset.depreciation_method,
                },
            },
        });
    } catch (error: any) {
        console.error('Depreciate asset error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถคำนวณค่าเสื่อมได้',
        });
    }
});

/**
 * DELETE /api/assets/:id
 * Delete asset
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        await prisma.fixedAsset.delete({
            where: { id },
        });

        res.json({
            success: true,
            message: 'ลบสินทรัพย์สำเร็จ',
        });
    } catch (error: any) {
        console.error('Delete asset error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถลบสินทรัพย์ได้',
        });
    }
});

export { router as assetsRouter };

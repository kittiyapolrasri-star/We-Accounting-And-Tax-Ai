/**
 * Clients Routes
 * CRUD operations for clients
 */

import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, requireRole, requireClientAccess } from '../middleware/auth';

const router = Router();

/**
 * GET /api/clients
 * Get all clients (filtered by user access)
 */
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { status, search } = req.query;
        const user = req.user!;

        // Build where clause
        const where: any = {};

        // Filter by status
        if (status && status !== 'all') {
            where.status = status;
        }

        // Search by name or tax_id
        if (search) {
            where.OR = [
                { name: { contains: search as string, mode: 'insensitive' } },
                { tax_id: { contains: search as string } },
            ];
        }

        // Filter by assigned clients for non-admin users
        if (!['admin', 'manager'].includes(user.role)) {
            where.id = { in: user.assignedClients };
        }

        const clients = await prisma.client.findMany({
            where,
            orderBy: { name: 'asc' },
            include: {
                _count: {
                    select: {
                        documents: true,
                        gl_entries: true,
                        tasks: { where: { status: 'pending' } },
                    },
                },
            },
        });

        res.json({
            success: true,
            data: clients.map(c => ({
                ...c,
                doc_count: c._count.documents,
                gl_count: c._count.gl_entries,
                pending_tasks: c._count.tasks,
            })),
        });
    } catch (error: any) {
        console.error('Get clients error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถดึงข้อมูลลูกค้าได้',
        });
    }
});

/**
 * GET /api/clients/:id
 * Get single client
 */
router.get('/:id', requireClientAccess, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const client = await prisma.client.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        documents: true,
                        gl_entries: true,
                    },
                },
            },
        });

        if (!client) {
            return res.status(404).json({
                success: false,
                error: 'ไม่พบลูกค้า',
            });
        }

        res.json({
            success: true,
            data: client,
        });
    } catch (error: any) {
        console.error('Get client error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถดึงข้อมูลลูกค้าได้',
        });
    }
});

/**
 * POST /api/clients
 * Create new client
 */
router.post('/', requireRole(['admin', 'manager']), async (req: AuthRequest, res: Response) => {
    try {
        const { name, tax_id, address, phone, email, contact_person, business_type, vat_registered } = req.body;

        if (!name || !tax_id) {
            return res.status(400).json({
                success: false,
                error: 'กรุณากรอกชื่อและเลขประจำตัวผู้เสียภาษี',
            });
        }

        // Check for duplicate tax_id
        const existing = await prisma.client.findUnique({
            where: { tax_id },
        });

        if (existing) {
            return res.status(409).json({
                success: false,
                error: 'เลขประจำตัวผู้เสียภาษีนี้ถูกใช้แล้ว',
            });
        }

        const client = await prisma.client.create({
            data: {
                name,
                tax_id,
                address,
                phone,
                email,
                contact_person,
                business_type,
                vat_registered: vat_registered ?? true,
            },
        });

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: 'CREATE',
                entity_type: 'client',
                entity_id: client.id,
                user_id: req.user!.uid,
                user_email: req.user!.email,
                details: { name: client.name },
            },
        });

        res.status(201).json({
            success: true,
            data: client,
        });
    } catch (error: any) {
        console.error('Create client error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถสร้างลูกค้าได้',
        });
    }
});

/**
 * PUT /api/clients/:id
 * Update client
 */
router.put('/:id', requireRole(['admin', 'manager']), async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Remove fields that shouldn't be updated directly
        delete updateData.id;
        delete updateData.created_at;

        const client = await prisma.client.update({
            where: { id },
            data: updateData,
        });

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: 'UPDATE',
                entity_type: 'client',
                entity_id: client.id,
                user_id: req.user!.uid,
                user_email: req.user!.email,
                details: { updated_fields: Object.keys(updateData) },
            },
        });

        res.json({
            success: true,
            data: client,
        });
    } catch (error: any) {
        console.error('Update client error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถอัพเดทลูกค้าได้',
        });
    }
});

/**
 * DELETE /api/clients/:id
 * Delete client (soft delete by setting status to Inactive)
 */
router.delete('/:id', requireRole(['admin']), async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const client = await prisma.client.update({
            where: { id },
            data: { status: 'Inactive' },
        });

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: 'DELETE',
                entity_type: 'client',
                entity_id: client.id,
                user_id: req.user!.uid,
                user_email: req.user!.email,
            },
        });

        res.json({
            success: true,
            message: 'ลบลูกค้าสำเร็จ',
        });
    } catch (error: any) {
        console.error('Delete client error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถลบลูกค้าได้',
        });
    }
});

export { router as clientsRouter };

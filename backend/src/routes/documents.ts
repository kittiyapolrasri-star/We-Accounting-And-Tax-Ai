/**
 * Documents Routes
 * CRUD operations for documents
 */

import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, requireClientAccess } from '../middleware/auth';

const router = Router();

/**
 * Helper: Get period info from date
 */
const getPeriodInfo = (date: Date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const period = `${year}-${month}`;
    return { year, month, period };
};

/**
 * GET /api/documents
 * Get all documents (paginated, filtered)
 */
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { clientId, status, period, limit = '50', offset = '0' } = req.query;
        const user = req.user!;

        // Build where clause
        const where: any = {};

        if (clientId) {
            where.client_id = clientId;
        } else if (!['admin', 'manager'].includes(user.role)) {
            // Non-admin users can only see their assigned clients
            where.client_id = { in: user.assignedClients };
        }

        if (status && status !== 'all') {
            where.status = status;
        }

        if (period) {
            where.period = period;
        }

        const [documents, total] = await Promise.all([
            prisma.document.findMany({
                where,
                orderBy: { uploaded_at: 'desc' },
                take: parseInt(limit as string),
                skip: parseInt(offset as string),
                include: {
                    client: {
                        select: { id: true, name: true },
                    },
                },
            }),
            prisma.document.count({ where }),
        ]);

        res.json({
            success: true,
            data: documents,
            pagination: {
                total,
                limit: parseInt(limit as string),
                offset: parseInt(offset as string),
            },
        });
    } catch (error: any) {
        console.error('Get documents error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถดึงข้อมูลเอกสารได้',
        });
    }
});

/**
 * GET /api/documents/:id
 * Get single document
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const document = await prisma.document.findUnique({
            where: { id },
            include: {
                client: {
                    select: { id: true, name: true, tax_id: true },
                },
            },
        });

        if (!document) {
            return res.status(404).json({
                success: false,
                error: 'ไม่พบเอกสาร',
            });
        }

        res.json({
            success: true,
            data: document,
        });
    } catch (error: any) {
        console.error('Get document error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถดึงข้อมูลเอกสารได้',
        });
    }
});

/**
 * POST /api/documents
 * Create new document record
 */
router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const {
            client_id,
            filename,
            original_filename,
            file_path,
            file_url,
            mime_type,
            file_size,
            doc_type,
            ai_data,
            confidence_score,
            amount,
            vat_amount,
            wht_amount,
            vendor_name,
            vendor_tax_id,
            invoice_number,
            invoice_date,
        } = req.body;

        if (!client_id || !filename || !mime_type) {
            return res.status(400).json({
                success: false,
                error: 'ข้อมูลไม่ครบถ้วน',
            });
        }

        const { year, month, period } = getPeriodInfo(invoice_date ? new Date(invoice_date) : new Date());

        // Determine status based on confidence
        let status = 'pending_review';
        if (confidence_score && confidence_score >= 85) {
            status = 'approved';
        } else if (confidence_score && confidence_score < 50) {
            status = 'rejected';
        }

        const document = await prisma.document.create({
            data: {
                client_id,
                filename,
                original_filename: original_filename || filename,
                file_path,
                file_url,
                mime_type,
                file_size,
                doc_type,
                status,
                ai_data,
                confidence_score,
                amount,
                vat_amount,
                wht_amount,
                vendor_name,
                vendor_tax_id,
                invoice_number,
                invoice_date: invoice_date ? new Date(invoice_date) : null,
                year,
                month,
                period,
                uploaded_by: req.user!.uid,
            },
        });

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: 'CREATE',
                entity_type: 'document',
                entity_id: document.id,
                user_id: req.user!.uid,
                user_email: req.user!.email,
                details: { filename, client_id },
            },
        });

        res.status(201).json({
            success: true,
            data: document,
        });
    } catch (error: any) {
        console.error('Create document error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถสร้างเอกสารได้',
        });
    }
});

/**
 * PUT /api/documents/:id
 * Update document
 */
router.put('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Remove fields that shouldn't be updated directly
        delete updateData.id;
        delete updateData.created_at;
        delete updateData.uploaded_at;

        // If approving, set approved_at and approved_by
        if (updateData.status === 'approved') {
            updateData.approved_at = new Date();
            updateData.approved_by = req.user!.uid;
        }

        const document = await prisma.document.update({
            where: { id },
            data: updateData,
        });

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: 'UPDATE',
                entity_type: 'document',
                entity_id: document.id,
                user_id: req.user!.uid,
                user_email: req.user!.email,
                details: { updated_fields: Object.keys(updateData) },
            },
        });

        res.json({
            success: true,
            data: document,
        });
    } catch (error: any) {
        console.error('Update document error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถอัพเดทเอกสารได้',
        });
    }
});

/**
 * DELETE /api/documents/:id
 * Delete document
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        await prisma.document.delete({
            where: { id },
        });

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: 'DELETE',
                entity_type: 'document',
                entity_id: id,
                user_id: req.user!.uid,
                user_email: req.user!.email,
            },
        });

        res.json({
            success: true,
            message: 'ลบเอกสารสำเร็จ',
        });
    } catch (error: any) {
        console.error('Delete document error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถลบเอกสารได้',
        });
    }
});

/**
 * POST /api/documents/:id/approve
 * Approve document
 */
router.post('/:id/approve', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const document = await prisma.document.update({
            where: { id },
            data: {
                status: 'approved',
                approved_at: new Date(),
                approved_by: req.user!.uid,
            },
        });

        res.json({
            success: true,
            data: document,
        });
    } catch (error: any) {
        console.error('Approve document error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถอนุมัติเอกสารได้',
        });
    }
});

/**
 * POST /api/documents/:id/reject
 * Reject document
 */
router.post('/:id/reject', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const document = await prisma.document.update({
            where: { id },
            data: {
                status: 'rejected',
                ai_data: {
                    ...(await prisma.document.findUnique({ where: { id } }))?.ai_data as any,
                    rejection_reason: reason,
                },
            },
        });

        res.json({
            success: true,
            data: document,
        });
    } catch (error: any) {
        console.error('Reject document error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถปฏิเสธเอกสารได้',
        });
    }
});

export { router as documentsRouter };

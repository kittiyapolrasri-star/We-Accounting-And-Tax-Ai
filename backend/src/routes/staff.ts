/**
 * Staff Routes
 * CRUD operations for staff/users management
 */

import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { AuthRequest, requireRole } from '../middleware/auth';

const router = Router();

/**
 * GET /api/staff
 * Get all staff members (admin/manager only)
 */
router.get('/', requireRole(['admin', 'manager']), async (req: AuthRequest, res: Response) => {
    try {
        const { role, is_active } = req.query;

        const where: any = {};
        if (role) where.role = role;
        if (is_active !== undefined) where.is_active = is_active === 'true';

        const staff = await prisma.staff.findMany({
            where,
            orderBy: { name: 'asc' },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                assigned_clients: true,
                is_active: true,
                last_login: true,
                created_at: true,
            },
        });

        res.json({
            success: true,
            data: staff,
        });
    } catch (error: any) {
        console.error('Get staff error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถดึงข้อมูลพนักงานได้',
        });
    }
});

/**
 * GET /api/staff/:id
 * Get single staff member
 */
router.get('/:id', requireRole(['admin', 'manager']), async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const staff = await prisma.staff.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                assigned_clients: true,
                is_active: true,
                last_login: true,
                created_at: true,
            },
        });

        if (!staff) {
            return res.status(404).json({
                success: false,
                error: 'ไม่พบพนักงาน',
            });
        }

        res.json({
            success: true,
            data: staff,
        });
    } catch (error: any) {
        console.error('Get staff error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถดึงข้อมูลพนักงานได้',
        });
    }
});

/**
 * POST /api/staff
 * Create new staff member (admin only)
 */
router.post('/', requireRole(['admin']), async (req: AuthRequest, res: Response) => {
    try {
        const { email, password, name, role = 'accountant', assigned_clients = [] } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({
                success: false,
                error: 'กรุณากรอกข้อมูลให้ครบ',
            });
        }

        // Check if email exists
        const existing = await prisma.staff.findUnique({
            where: { email: email.toLowerCase() },
        });

        if (existing) {
            return res.status(409).json({
                success: false,
                error: 'Email นี้ถูกใช้แล้ว',
            });
        }

        // Hash password
        const password_hash = await bcrypt.hash(password, 12);

        const staff = await prisma.staff.create({
            data: {
                email: email.toLowerCase(),
                password_hash,
                name,
                role,
                assigned_clients,
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                assigned_clients: true,
            },
        });

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: 'CREATE',
                entity_type: 'staff',
                entity_id: staff.id,
                user_id: req.user!.uid,
                user_email: req.user!.email,
                details: { name: staff.name, role: staff.role },
            },
        });

        res.status(201).json({
            success: true,
            data: staff,
        });
    } catch (error: any) {
        console.error('Create staff error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถสร้างพนักงานได้',
        });
    }
});

/**
 * PUT /api/staff/:id
 * Update staff member
 */
router.put('/:id', requireRole(['admin']), async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { name, role, assigned_clients, is_active } = req.body;

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (role !== undefined) updateData.role = role;
        if (assigned_clients !== undefined) updateData.assigned_clients = assigned_clients;
        if (is_active !== undefined) updateData.is_active = is_active;

        const staff = await prisma.staff.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                assigned_clients: true,
                is_active: true,
            },
        });

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: 'UPDATE',
                entity_type: 'staff',
                entity_id: staff.id,
                user_id: req.user!.uid,
                user_email: req.user!.email,
                details: { updated_fields: Object.keys(updateData) },
            },
        });

        res.json({
            success: true,
            data: staff,
        });
    } catch (error: any) {
        console.error('Update staff error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถอัพเดทพนักงานได้',
        });
    }
});

/**
 * POST /api/staff/:id/reset-password
 * Reset staff password (admin only)
 */
router.post('/:id/reset-password', requireRole(['admin']), async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
            });
        }

        const password_hash = await bcrypt.hash(newPassword, 12);

        await prisma.staff.update({
            where: { id },
            data: { password_hash },
        });

        res.json({
            success: true,
            message: 'รีเซ็ตรหัสผ่านสำเร็จ',
        });
    } catch (error: any) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถรีเซ็ตรหัสผ่านได้',
        });
    }
});

/**
 * DELETE /api/staff/:id
 * Deactivate staff member (soft delete)
 */
router.delete('/:id', requireRole(['admin']), async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        // Don't allow deleting yourself
        if (id === req.user!.uid) {
            return res.status(400).json({
                success: false,
                error: 'ไม่สามารถลบบัญชีตัวเองได้',
            });
        }

        await prisma.staff.update({
            where: { id },
            data: { is_active: false },
        });

        res.json({
            success: true,
            message: 'ระงับบัญชีพนักงานสำเร็จ',
        });
    } catch (error: any) {
        console.error('Delete staff error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถลบพนักงานได้',
        });
    }
});

export { router as staffRouter };

/**
 * Auth Routes
 * Login, Register, Token Refresh
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { JWT_SECRET, AuthRequest, verifyToken } from '../middleware/auth';

const router = Router();

const JWT_EXPIRES_IN = '7d';

/**
 * POST /api/auth/login
 * User login
 */
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'กรุณากรอก email และ password',
            });
        }

        // Find user
        const staff = await prisma.staff.findUnique({
            where: { email: email.toLowerCase() },
        });

        if (!staff) {
            return res.status(401).json({
                success: false,
                error: 'ไม่พบบัญชีผู้ใช้นี้',
            });
        }

        if (!staff.is_active) {
            return res.status(401).json({
                success: false,
                error: 'บัญชีนี้ถูกระงับ',
            });
        }

        // Verify password
        const isValid = await bcrypt.compare(password, staff.password_hash);

        if (!isValid) {
            return res.status(401).json({
                success: false,
                error: 'รหัสผ่านไม่ถูกต้อง',
            });
        }

        // Generate token
        const token = jwt.sign(
            {
                uid: staff.id,
                email: staff.email,
                name: staff.name,
                role: staff.role,
                assignedClients: staff.assigned_clients,
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Update last login
        await prisma.staff.update({
            where: { id: staff.id },
            data: { last_login: new Date() },
        });

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: 'LOGIN',
                entity_type: 'staff',
                entity_id: staff.id,
                user_id: staff.id,
                user_email: staff.email,
                details: { ip: req.ip },
            },
        });

        res.json({
            success: true,
            token,
            user: {
                uid: staff.id,
                email: staff.email,
                displayName: staff.name,
                role: staff.role,
                assignedClients: staff.assigned_clients,
            },
        });
    } catch (error: any) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาด กรุณาลองใหม่',
        });
    }
});

/**
 * POST /api/auth/register
 * Register new user (admin only in production)
 */
router.post('/register', async (req: Request, res: Response) => {
    try {
        const { email, password, name, role = 'accountant' } = req.body;

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

        // Create user
        const staff = await prisma.staff.create({
            data: {
                email: email.toLowerCase(),
                password_hash,
                name,
                role,
                assigned_clients: [],
            },
        });

        // Generate token
        const token = jwt.sign(
            {
                uid: staff.id,
                email: staff.email,
                name: staff.name,
                role: staff.role,
                assignedClients: staff.assigned_clients,
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.status(201).json({
            success: true,
            token,
            user: {
                uid: staff.id,
                email: staff.email,
                displayName: staff.name,
                role: staff.role,
            },
        });
    } catch (error: any) {
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาด กรุณาลองใหม่',
        });
    }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const staff = await prisma.staff.findUnique({
            where: { id: req.user!.uid },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                assigned_clients: true,
                last_login: true,
            },
        });

        if (!staff) {
            return res.status(404).json({
                success: false,
                error: 'ไม่พบข้อมูลผู้ใช้',
            });
        }

        res.json({
            success: true,
            user: {
                uid: staff.id,
                email: staff.email,
                displayName: staff.name,
                role: staff.role,
                assignedClients: staff.assigned_clients,
                lastLogin: staff.last_login,
            },
        });
    } catch (error: any) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาด',
        });
    }
});

/**
 * POST /api/auth/change-password
 * Change password
 */
router.post('/change-password', verifyToken, async (req: AuthRequest, res: Response) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'กรุณากรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่',
            });
        }

        const staff = await prisma.staff.findUnique({
            where: { id: req.user!.uid },
        });

        if (!staff) {
            return res.status(404).json({
                success: false,
                error: 'ไม่พบข้อมูลผู้ใช้',
            });
        }

        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, staff.password_hash);

        if (!isValid) {
            return res.status(401).json({
                success: false,
                error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง',
            });
        }

        // Hash new password
        const password_hash = await bcrypt.hash(newPassword, 12);

        // Update password
        await prisma.staff.update({
            where: { id: staff.id },
            data: { password_hash },
        });

        res.json({
            success: true,
            message: 'เปลี่ยนรหัสผ่านสำเร็จ',
        });
    } catch (error: any) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            error: 'เกิดข้อผิดพลาด',
        });
    }
});

export { router as authRouter };

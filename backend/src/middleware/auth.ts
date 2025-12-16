/**
 * Auth Middleware
 * JWT Token Verification
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'we-accounting-local-secret-key-change-in-production';

export interface AuthUser {
    uid: string;
    email: string;
    name: string;
    role: string;
    assignedClients: string[];
}

export interface AuthRequest extends Request {
    user?: AuthUser;
}

/**
 * Verify JWT token middleware
 */
export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: 'กรุณาเข้าสู่ระบบ',
            code: 'AUTH_REQUIRED',
        });
    }

    const token = authHeader.substring(7);

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
        req.user = decoded;
        next();
    } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่',
                code: 'TOKEN_EXPIRED',
            });
        }

        return res.status(401).json({
            success: false,
            error: 'Token ไม่ถูกต้อง',
            code: 'INVALID_TOKEN',
        });
    }
};

/**
 * Check if user has required role
 */
export const requireRole = (roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'กรุณาเข้าสู่ระบบ',
                code: 'AUTH_REQUIRED',
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'ไม่มีสิทธิ์เข้าถึง',
                code: 'FORBIDDEN',
            });
        }

        next();
    };
};

/**
 * Check if user has access to specific client
 */
export const requireClientAccess = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'กรุณาเข้าสู่ระบบ',
            code: 'AUTH_REQUIRED',
        });
    }

    const clientId = req.params.clientId || req.body.clientId;

    // Admin and manager have access to all clients
    if (['admin', 'manager'].includes(req.user.role)) {
        return next();
    }

    // Check if user has access to this client
    if (clientId && !req.user.assignedClients.includes(clientId)) {
        return res.status(403).json({
            success: false,
            error: 'ไม่มีสิทธิ์เข้าถึงลูกค้านี้',
            code: 'CLIENT_ACCESS_DENIED',
        });
    }

    next();
};

export { JWT_SECRET };

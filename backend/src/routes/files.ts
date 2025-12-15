/**
 * File Storage Routes
 * Handle file uploads and serving
 */

import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// Storage configuration
const STORAGE_ROOT = process.env.STORAGE_PATH || path.join(__dirname, '../../storage');

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_ROOT)) {
    fs.mkdirSync(STORAGE_ROOT, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const clientId = (req as AuthRequest).body.clientId || 'unknown';
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');

        const destPath = path.join(STORAGE_ROOT, 'clients', clientId, year.toString(), month);

        // Create directory if not exists
        fs.mkdirSync(destPath, { recursive: true });

        cb(null, destPath);
    },
    filename: (req, file, cb) => {
        // Generate unique filename
        const ext = path.extname(file.originalname);
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const uniqueName = `${Date.now()}_${uuidv4().substring(0, 8)}${ext}`;
        cb(null, uniqueName);
    },
});

// File filter
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedMimes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'application/pdf',
    ];

    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`ไม่รองรับไฟล์ประเภท ${file.mimetype}`));
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
});

/**
 * POST /api/files/upload
 * Upload a file
 */
router.post('/upload', upload.single('file'), async (req: AuthRequest, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'ไม่พบไฟล์',
            });
        }

        const file = req.file;
        const clientId = req.body.clientId || 'unknown';

        // Generate relative path for storage
        const relativePath = path.relative(STORAGE_ROOT, file.path).replace(/\\/g, '/');
        const fileUrl = `/api/files/serve/${relativePath}`;

        res.json({
            success: true,
            data: {
                filename: file.filename,
                originalFilename: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
                path: relativePath,
                url: fileUrl,
            },
        });
    } catch (error: any) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'อัพโหลดไฟล์ไม่สำเร็จ',
        });
    }
});

/**
 * POST /api/files/upload-base64
 * Upload a file as base64
 */
router.post('/upload-base64', async (req: AuthRequest, res: Response) => {
    try {
        const { base64Data, filename, mimeType, clientId } = req.body;

        if (!base64Data || !filename) {
            return res.status(400).json({
                success: false,
                error: 'ข้อมูลไม่ครบถ้วน',
            });
        }

        // Create destination path
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const destDir = path.join(STORAGE_ROOT, 'clients', clientId || 'unknown', year.toString(), month);

        fs.mkdirSync(destDir, { recursive: true });

        // Generate unique filename
        const ext = path.extname(filename);
        const uniqueName = `${Date.now()}_${uuidv4().substring(0, 8)}${ext}`;
        const filePath = path.join(destDir, uniqueName);

        // Write file
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(filePath, buffer);

        // Generate relative path
        const relativePath = path.relative(STORAGE_ROOT, filePath).replace(/\\/g, '/');
        const fileUrl = `/api/files/serve/${relativePath}`;

        res.json({
            success: true,
            data: {
                filename: uniqueName,
                originalFilename: filename,
                mimeType: mimeType || 'application/octet-stream',
                size: buffer.length,
                path: relativePath,
                url: fileUrl,
            },
        });
    } catch (error: any) {
        console.error('Upload base64 error:', error);
        res.status(500).json({
            success: false,
            error: 'อัพโหลดไฟล์ไม่สำเร็จ',
        });
    }
});

/**
 * GET /api/files/serve/:path*
 * Serve a file
 */
router.get('/serve/*', async (req: AuthRequest, res: Response) => {
    try {
        const filePath = req.params[0];
        const fullPath = path.join(STORAGE_ROOT, filePath);

        // Security: Prevent path traversal
        if (!fullPath.startsWith(STORAGE_ROOT)) {
            return res.status(403).json({
                success: false,
                error: 'Access denied',
            });
        }

        // Check if file exists
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({
                success: false,
                error: 'ไม่พบไฟล์',
            });
        }

        res.sendFile(fullPath);
    } catch (error: any) {
        console.error('Serve file error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถดึงไฟล์ได้',
        });
    }
});

/**
 * DELETE /api/files
 * Delete a file
 */
router.delete('/', async (req: AuthRequest, res: Response) => {
    try {
        const { filePath } = req.body;

        if (!filePath) {
            return res.status(400).json({
                success: false,
                error: 'กรุณาระบุ path ของไฟล์',
            });
        }

        const fullPath = path.join(STORAGE_ROOT, filePath);

        // Security: Prevent path traversal
        if (!fullPath.startsWith(STORAGE_ROOT)) {
            return res.status(403).json({
                success: false,
                error: 'Access denied',
            });
        }

        // Check if file exists
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({
                success: false,
                error: 'ไม่พบไฟล์',
            });
        }

        fs.unlinkSync(fullPath);

        res.json({
            success: true,
            message: 'ลบไฟล์สำเร็จ',
        });
    } catch (error: any) {
        console.error('Delete file error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถลบไฟล์ได้',
        });
    }
});

export { router as filesRouter };

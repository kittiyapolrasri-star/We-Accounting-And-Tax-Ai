/**
 * WE Accounting & Tax AI - Local Backend Server
 * Express.js API Server with PostgreSQL
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';

import { authRouter } from './routes/auth';
import { clientsRouter } from './routes/clients';
import { documentsRouter } from './routes/documents';
import { glRouter } from './routes/gl';
import { filesRouter } from './routes/files';
import { analyzeRouter } from './routes/analyze';
import { activityLogsRouter } from './routes/activityLogs';
import { staffRouter } from './routes/staff';
import { assetsRouter } from './routes/assets';
import { bankRouter } from './routes/bank';
import { rulesRouter } from './routes/rules';
import { tasksRouter } from './routes/tasks';
import { reportsRouter } from './routes/reports';
import { verifyToken } from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 3001;

// ======================
// SECURITY
// ======================
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS - Allow frontend
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:3000',
        'http://127.0.0.1:5173',
        process.env.FRONTEND_URL || '',
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Body parser
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Static files for document storage
app.use('/files', express.static(path.join(__dirname, '../storage')));

// ======================
// REQUEST LOGGING
// ======================
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    });
    next();
});

// ======================
// ROUTES
// ======================

// Health check (public)
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        mode: 'local',
    });
});

// Auth routes (public)
app.use('/api/auth', authRouter);

// Protected routes
app.use('/api/clients', verifyToken, clientsRouter);
app.use('/api/documents', verifyToken, documentsRouter);
app.use('/api/gl', verifyToken, glRouter);
app.use('/api/analyze', verifyToken, analyzeRouter);
app.use('/api/files', verifyToken, filesRouter);
app.use('/api/activity-logs', verifyToken, activityLogsRouter);
app.use('/api/staff', verifyToken, staffRouter);
app.use('/api/assets', verifyToken, assetsRouter);
app.use('/api/bank', verifyToken, bankRouter);
app.use('/api/rules', verifyToken, rulesRouter);
app.use('/api/tasks', verifyToken, tasksRouter);
app.use('/api/reports', verifyToken, reportsRouter);

// ======================
// ERROR HANDLING
// ======================

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.path,
    });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);

    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
});

// ======================
// START SERVER
// ======================
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 WE Accounting & Tax AI - Local Backend                ║
║                                                            ║
║   Server running on: http://localhost:${PORT}               ║
║   Mode: ${process.env.NODE_ENV || 'development'}                                    ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

export default app;

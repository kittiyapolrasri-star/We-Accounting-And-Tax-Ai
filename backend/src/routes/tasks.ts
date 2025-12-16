/**
 * Tasks Routes
 * CRUD operations for task management
 */

import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, requireClientAccess } from '../middleware/auth';

const router = Router();

/**
 * GET /api/tasks
 * Get tasks (filtered)
 */
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { clientId, assigneeId, status, priority, task_type } = req.query;
        const user = req.user!;

        const where: any = {};

        if (clientId) {
            where.client_id = clientId;
        } else if (!['admin', 'manager'].includes(user.role)) {
            // Show tasks for assigned clients or assigned to user
            where.OR = [
                { client_id: { in: user.assignedClients } },
                { assignee_id: user.uid },
            ];
        }

        if (assigneeId) where.assignee_id = assigneeId;
        if (status) where.status = status;
        if (priority) where.priority = priority;
        if (task_type) where.task_type = task_type;

        const tasks = await prisma.task.findMany({
            where,
            orderBy: [
                { priority: 'desc' },
                { due_date: 'asc' },
                { created_at: 'desc' },
            ],
            include: {
                client: {
                    select: { id: true, name: true },
                },
                assignee: {
                    select: { id: true, name: true, email: true },
                },
            },
        });

        res.json({
            success: true,
            data: tasks,
        });
    } catch (error: any) {
        console.error('Get tasks error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถดึงข้อมูลงานได้',
        });
    }
});

/**
 * GET /api/tasks/my
 * Get tasks assigned to current user
 */
router.get('/my', async (req: AuthRequest, res: Response) => {
    try {
        const { status } = req.query;
        const user = req.user!;

        const where: any = {
            assignee_id: user.uid,
        };

        if (status) where.status = status;

        const tasks = await prisma.task.findMany({
            where,
            orderBy: [
                { priority: 'desc' },
                { due_date: 'asc' },
            ],
            include: {
                client: {
                    select: { id: true, name: true },
                },
            },
        });

        res.json({
            success: true,
            data: tasks,
        });
    } catch (error: any) {
        console.error('Get my tasks error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถดึงข้อมูลงานได้',
        });
    }
});

/**
 * POST /api/tasks
 * Create task
 */
router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const {
            client_id,
            assignee_id,
            title,
            description,
            task_type,
            priority = 'medium',
            due_date,
            related_doc_id,
        } = req.body;

        if (!client_id || !title) {
            return res.status(400).json({
                success: false,
                error: 'กรุณาระบุ client_id และ title',
            });
        }

        const task = await prisma.task.create({
            data: {
                client_id,
                assignee_id,
                title,
                description,
                task_type,
                priority,
                due_date: due_date ? new Date(due_date) : null,
                related_doc_id,
            },
        });

        // Log activity
        await prisma.activityLog.create({
            data: {
                action: 'CREATE',
                entity_type: 'task',
                entity_id: task.id,
                user_id: req.user!.uid,
                user_email: req.user!.email,
                details: { title, client_id },
            },
        });

        res.status(201).json({
            success: true,
            data: task,
        });
    } catch (error: any) {
        console.error('Create task error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถสร้างงานได้',
        });
    }
});

/**
 * PUT /api/tasks/:id
 * Update task
 */
router.put('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        delete updateData.id;
        delete updateData.created_at;

        if (updateData.due_date) {
            updateData.due_date = new Date(updateData.due_date);
        }

        // If completing task, set completed_at
        if (updateData.status === 'completed') {
            updateData.completed_at = new Date();
        }

        const task = await prisma.task.update({
            where: { id },
            data: updateData,
        });

        res.json({
            success: true,
            data: task,
        });
    } catch (error: any) {
        console.error('Update task error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถอัพเดทงานได้',
        });
    }
});

/**
 * POST /api/tasks/:id/complete
 * Mark task as completed
 */
router.post('/:id/complete', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const task = await prisma.task.update({
            where: { id },
            data: {
                status: 'completed',
                completed_at: new Date(),
            },
        });

        res.json({
            success: true,
            data: task,
        });
    } catch (error: any) {
        console.error('Complete task error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถเสร็จสิ้นงานได้',
        });
    }
});

/**
 * DELETE /api/tasks/:id
 * Delete task
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        await prisma.task.delete({
            where: { id },
        });

        res.json({
            success: true,
            message: 'ลบงานสำเร็จ',
        });
    } catch (error: any) {
        console.error('Delete task error:', error);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถลบงานได้',
        });
    }
});

export { router as tasksRouter };

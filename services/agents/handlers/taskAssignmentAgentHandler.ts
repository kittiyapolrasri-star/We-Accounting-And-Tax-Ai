/**
 * Task Assignment Agent Handler
 * AI-powered intelligent task distribution and workload balancing
 */

import { AgentHandler, AgentContext } from '../agentOrchestrator';
import { AgentInput, AgentOutput } from '../../../types/agents';
import { Task, TaskCategory, StaffWorkload } from '../../../types/tasks';
import { Staff } from '../../../types';
import { calculateStaffWorkload } from '../../taskManagement';

interface TaskAssignment {
  taskId: string;
  staffId: string;
  staffName: string;
  reason: string;
  confidence: number;
}

interface TaskAssignmentResult {
  assignments: Array<{
    taskId: string;
    assignedTo: string;
    reason: string;
  }>;
  workloadSummary: Array<{
    staffId: string;
    staffName: string;
    utilization: number;
    totalTasks: number;
    isAvailable: boolean;
  }>;
  rebalanceNeeded: boolean;
  confidenceScore: number;
}

export class TaskAssignmentAgentHandler implements AgentHandler {
  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    context.addLog('start', 'เริ่มวิเคราะห์การมอบหมายงาน', 'pending');

    const { tasks, staff, unassignedTasks } = input.context || {};

    if (!staff || !Array.isArray(staff) || staff.length === 0) {
      return {
        success: false,
        result: {
          error: 'ไม่พบข้อมูลพนักงาน',
          confidenceScore: 0,
        },
      };
    }

    const tasksToAssign = unassignedTasks || tasks?.filter((t: Task) => !t.assignedTo) || [];

    if (tasksToAssign.length === 0) {
      return {
        success: true,
        result: {
          message: 'ไม่มีงานที่ต้องมอบหมาย',
          confidenceScore: 100,
        },
      };
    }

    try {
      // Calculate current workload for each staff
      context.addLog('analyze_workload', 'วิเคราะห์ภาระงานของพนักงาน', 'pending');

      const workloads: Map<string, StaffWorkload> = new Map();
      const allTasks = tasks || [];

      for (const staffMember of staff) {
        const workload = calculateStaffWorkload(staffMember, allTasks, allTasks);
        workloads.set(staffMember.id, workload);
      }

      // Assign tasks intelligently
      const assignments: TaskAssignment[] = [];
      let totalConfidence = 0;

      for (const task of tasksToAssign) {
        context.addLog('assign_task', `กำลังหาผู้รับผิดชอบสำหรับ: ${task.title}`, 'pending');

        const bestAssignment = this.findBestAssignee(task, staff, workloads, allTasks);

        if (bestAssignment) {
          assignments.push(bestAssignment);
          totalConfidence += bestAssignment.confidence;

          // Update workload tracking
          const currentWorkload = workloads.get(bestAssignment.staffId);
          if (currentWorkload) {
            currentWorkload.totalTasks++;
            currentWorkload.utilizationPercent = Math.min(100, currentWorkload.utilizationPercent + 10);
          }

          context.addLog(
            'assigned',
            `มอบหมาย "${task.title}" ให้ ${bestAssignment.staffName} (${bestAssignment.confidence}%)`,
            'success'
          );
        }
      }

      const avgConfidence = assignments.length > 0
        ? Math.round(totalConfidence / assignments.length)
        : 0;

      // Prepare workload summary
      const workloadSummary = Array.from(workloads.entries()).map(([staffId, wl]) => ({
        staffId,
        staffName: wl.staffName,
        utilization: wl.utilizationPercent,
        totalTasks: wl.totalTasks,
        isAvailable: wl.isAvailable,
      }));

      const result: TaskAssignmentResult = {
        assignments: assignments.map(a => ({
          taskId: a.taskId,
          assignedTo: a.staffId,
          reason: a.reason,
        })),
        workloadSummary,
        rebalanceNeeded: this.checkRebalanceNeeded(workloads),
        confidenceScore: avgConfidence,
      };

      context.addLog('complete', `มอบหมายงานสำเร็จ ${assignments.length}/${tasksToAssign.length} รายการ`, 'success');

      return {
        success: true,
        result,
        actions: [
          {
            type: 'apply_assignments',
            label: `ยืนยันการมอบหมาย ${assignments.length} งาน`,
            data: { assignments },
          },
          ...(result.rebalanceNeeded ? [{
            type: 'rebalance_workload',
            label: 'จัดสรรงานใหม่เพื่อความสมดุล',
            data: { workloadSummary },
          }] : []),
        ],
      };
    } catch (error) {
      context.addLog('error', `เกิดข้อผิดพลาด: ${error}`, 'failure');
      return {
        success: false,
        result: {
          error: String(error),
          confidenceScore: 0,
        },
      };
    }
  }

  private findBestAssignee(
    task: Task,
    staff: Staff[],
    workloads: Map<string, StaffWorkload>,
    allTasks: Task[]
  ): TaskAssignment | null {
    let bestStaff: Staff | null = null;
    let bestScore = 0;
    let bestReason = '';

    // Filter available staff (using active_tasks as availability indicator)
    const availableStaff = staff.filter(s => {
      const workload = workloads.get(s.id);
      return workload && workload.isAvailable;
    });

    if (availableStaff.length === 0) {
      // All staff are busy, find least loaded
      const leastLoaded = this.findLeastLoadedStaff(staff, workloads);
      if (leastLoaded) {
        return {
          taskId: task.id,
          staffId: leastLoaded.id,
          staffName: leastLoaded.name,
          reason: 'ผู้ที่มีภาระงานน้อยที่สุด',
          confidence: 60,
        };
      }
      return null;
    }

    for (const staffMember of availableStaff) {
      const score = this.calculateAssignmentScore(task, staffMember, workloads, allTasks);

      if (score.total > bestScore) {
        bestScore = score.total;
        bestStaff = staffMember;
        bestReason = score.reason;
      }
    }

    if (bestStaff) {
      return {
        taskId: task.id,
        staffId: bestStaff.id,
        staffName: bestStaff.name,
        reason: bestReason,
        confidence: Math.min(100, bestScore),
      };
    }

    return null;
  }

  private calculateAssignmentScore(
    task: Task,
    staffMember: Staff,
    workloads: Map<string, StaffWorkload>,
    allTasks: Task[]
  ): { total: number; reason: string } {
    let score = 0;
    const reasons: string[] = [];

    const workload = workloads.get(staffMember.id);
    if (!workload) return { total: 0, reason: '' };

    // 1. Workload availability (0-30 points)
    const availabilityScore = Math.max(0, 30 - workload.utilizationPercent * 0.3);
    score += availabilityScore;
    if (availabilityScore > 20) {
      reasons.push('มีความพร้อมรับงานสูง');
    }

    // 2. Skill match based on category (0-30 points)
    const skillScore = this.calculateSkillMatch(task, workload);
    score += skillScore;
    if (skillScore > 20) {
      reasons.push('ทักษะตรงกับงาน');
    }

    // 3. Client familiarity (0-20 points)
    if (task.clientId && workload.clientExpertise?.includes(task.clientId)) {
      score += 20;
      reasons.push('ดูแลลูกค้ารายนี้อยู่แล้ว');
    }

    // 4. Priority handling (0-10 points)
    if (task.priority === 'urgent' || task.priority === 'high') {
      // Prefer staff with lower workload for urgent tasks
      if (workload.utilizationPercent < 50) {
        score += 10;
        reasons.push('เหมาะกับงานสำคัญ');
      }
    }

    // 5. Past performance on similar tasks (0-10 points)
    const similarTasks = allTasks.filter(
      t => t.assignedTo === staffMember.id && t.category === task.category && t.status === 'completed'
    );
    if (similarTasks.length > 0) {
      score += Math.min(10, similarTasks.length * 2);
      reasons.push('มีประสบการณ์งานประเภทนี้');
    }

    return {
      total: Math.min(100, score),
      reason: reasons.slice(0, 2).join(', ') || 'เหมาะสมตามภาระงาน',
    };
  }

  private calculateSkillMatch(task: Task, workload: StaffWorkload): number {
    const skillMap: Record<TaskCategory, string[]> = {
      tax_filing: ['tax', 'วางแผนภาษี', 'ยื่นภาษี'],
      gl_posting: ['accounting', 'บันทึกบัญชี', 'GL'],
      document_review: ['audit', 'ตรวจสอบ', 'review'],
      bank_reconciliation: ['reconciliation', 'กระทบยอด'],
      period_closing: ['closing', 'ปิดงวด'],
      financial_report: ['report', 'งบการเงิน'],
      audit_preparation: ['audit', 'ตรวจสอบ'],
      client_request: ['service', 'บริการลูกค้า'],
      document_collection: ['document', 'เอกสาร'],
      client_meeting: ['meeting', 'ประชุม'],
      consultation: ['consulting', 'ที่ปรึกษา'],
      general: ['general', 'ทั่วไป'],
      training: ['training', 'อบรม'],
      internal_meeting: ['meeting', 'ประชุม'],
      administrative: ['admin', 'ธุรการ'],
    };

    const requiredSkills = skillMap[task.category] || [];
    const staffSkills = workload.skills || [];

    const matchCount = requiredSkills.filter(skill =>
      staffSkills.some((s: string) => s.toLowerCase().includes(skill.toLowerCase()))
    ).length;

    return Math.min(30, matchCount * 15);
  }

  private findLeastLoadedStaff(staff: Staff[], workloads: Map<string, StaffWorkload>): Staff | null {
    let leastLoaded: Staff | null = null;
    let lowestUtilization = Infinity;

    for (const staffMember of staff) {
      const workload = workloads.get(staffMember.id);
      if (workload && workload.utilizationPercent < lowestUtilization) {
        lowestUtilization = workload.utilizationPercent;
        leastLoaded = staffMember;
      }
    }

    return leastLoaded;
  }

  private checkRebalanceNeeded(workloads: Map<string, StaffWorkload>): boolean {
    const utilizations = Array.from(workloads.values())
      .filter(w => w.isAvailable)
      .map(w => w.utilizationPercent);

    if (utilizations.length < 2) return false;

    const max = Math.max(...utilizations);
    const min = Math.min(...utilizations);

    // Rebalance if difference > 40%
    return max - min > 40;
  }

  canHandle(input: AgentInput): boolean {
    return input.type === 'task_assignment' || input.type === 'workload_balancing';
  }

  getRequiredPermissions(): string[] {
    return ['view_tasks', 'view_staff', 'assign_tasks'];
  }
}

export const taskAssignmentAgentHandler = new TaskAssignmentAgentHandler();
